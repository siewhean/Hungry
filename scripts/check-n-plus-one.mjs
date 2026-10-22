#!/usr/bin/env node
// Flags database/service/storage calls made once per item inside a loop or an array callback
// (the N+1 pattern). Fetch the whole set in one query (`.in(...)`, a join, or a batched RPC) and
// look rows up from a Map instead.
//
//   node scripts/check-n-plus-one.mjs            # fail on findings that are not in the baseline
//   node scripts/check-n-plus-one.mjs --list     # print every finding, baselined or not
//   node scripts/check-n-plus-one.mjs --update   # rewrite the baseline (review the diff!)
//
// A call that really must run once per item (a file upload, a paginated read that needs the
// previous page's cursor, one transaction per row) is marked with a comment on the same line or
// within three lines above, with the reason:   // n-plus-one-ok: <why one call per item is required>
// scripts/n-plus-one-baseline.json holds findings that existed when this check was added; it
// should only shrink.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const BASELINE_PATH = path.join(root, "scripts", "n-plus-one-baseline.json");
const SCAN_DIRS = ["src", "supabase/functions"];
const SKIP = /(\.test\.|\.spec\.|\/__tests__\/|\/node_modules\/|\.d\.ts$)/;

const LOOP_HEAD =
  /\b(?:for\s*(?:await\s*)?\(|while\s*\()|\.(?:map|forEach|flatMap|reduce|filter|some|every)\s*\(/g;
const DATA_ACCESS = new RegExp(
  [
    String.raw`(?<!\b(?:Array|Buffer|Uint8Array|Int8Array|Float32Array|Float64Array|Object)\s*)\.from\s*\(`,
    String.raw`\.rpc\s*\(`,
    String.raw`\.createSigned(?:Url|Urls)\s*\(`,
    String.raw`\bcreateSignedStorageUrl\s*\(`,
    String.raw`\bresolvePostMediaDisplayUrl\s*\(`,
    String.raw`\bgetHungryService\s*\(\)\s*\.\s*\w+\s*\.\s*\w+\s*\(`,
    String.raw`\bservice\s*\.\s*\w+\s*\.\s*\w+\s*\(`,
  ].join("|"),
  "g",
);

/** Same text with comments and string contents blanked, so braces inside them are ignored. */
function mask(source) {
  const out = source.split("");
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== "\n")
        j += source[j] === "\\" ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
    } else if (c === "`") {
      // Template literal: blank the text but keep `${ ... }` code visible.
      let j = i + 1;
      while (j < source.length && source[j] !== "`") {
        if (source[j] === "\\") {
          blank(j, j + 2);
          j += 2;
        } else if (source[j] === "$" && source[j + 1] === "{") {
          let depth = 1;
          j += 2;
          while (j < source.length && depth > 0) {
            if (source[j] === "{") depth += 1;
            else if (source[j] === "}") depth -= 1;
            j += 1;
          }
        } else {
          blank(j, j + 1);
          j += 1;
        }
      }
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return out.join("");
}

function matching(masked, openIndex) {
  const open = masked[openIndex];
  const close = open === "(" ? ")" : open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = openIndex; i < masked.length; i += 1) {
    if (masked[i] === open) depth += 1;
    else if (masked[i] === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === "\n") line += 1;
  return line;
}

export function findNPlusOne(source) {
  const masked = mask(source);
  const lines = source.split("\n");
  const found = new Map(); // access line -> { loopLine, suppressed }
  const ok = (line) =>
    [0, 1, 2, 3].some((back) => /n-plus-one-ok/.test(lines[line - 1 - back] ?? ""));

  for (const head of masked.matchAll(LOOP_HEAD)) {
    const parenAt = head.index + head[0].length - 1;
    const parenEnd = matching(masked, parenAt);
    if (parenEnd === -1) continue;
    const isCallback = head[0].startsWith(".");
    let from;
    let to;
    if (isCallback) {
      from = parenAt;
      to = parenEnd;
    } else {
      const afterHead = masked.slice(parenEnd + 1).match(/^\s*\{/);
      if (!afterHead) continue;
      const braceAt = parenEnd + 1 + afterHead[0].length - 1;
      const braceEnd = matching(masked, braceAt);
      if (braceEnd === -1) continue;
      from = braceAt;
      to = braceEnd;
    }
    const loopLine = lineOf(masked, head.index);
    const body = masked.slice(from, to);
    for (const access of body.matchAll(DATA_ACCESS)) {
      const line = lineOf(masked, from + access.index);
      const previous = found.get(line);
      // A marker on the access line, or on any loop that encloses it, allows the call.
      const suppressed = (previous?.suppressed ?? false) || ok(line) || ok(loopLine);
      found.set(line, { loopLine: previous?.loopLine ?? loopLine, suppressed });
    }
  }
  return [...found.entries()]
    .filter(([, info]) => !info.suppressed)
    .map(([line, info]) => ({ line, loopLine: info.loopLine, text: lines[line - 1].trim() }));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(full, files);
    } else if (/\.(ts|tsx|mjs)$/.test(entry.name) && !SKIP.test(full.split(path.sep).join("/"))) {
      files.push(full);
    }
  }
  return files;
}

export function scanRepo() {
  const results = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(root, dir))) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      for (const finding of findNPlusOne(fs.readFileSync(file, "utf8"))) {
        results.push({ file: rel, ...finding });
      }
    }
  }
  return results;
}

const key = (finding) => `${finding.file} :: ${finding.text}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = scanRepo();
  const args = new Set(process.argv.slice(2));

  if (args.has("--list")) {
    for (const f of findings) console.log(`${f.file}:${f.line} (loop at ${f.loopLine})  ${f.text}`);
    console.log(`\n${findings.length} finding(s)`);
    process.exit(0);
  }

  const counts = {};
  for (const finding of findings) counts[key(finding)] = (counts[key(finding)] ?? 0) + 1;

  if (args.has("--update")) {
    const sorted = Object.fromEntries(
      Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
    );
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`[check-n-plus-one] baseline written: ${Object.keys(sorted).length} entries`);
    process.exit(0);
  }

  const baseline = fs.existsSync(BASELINE_PATH)
    ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"))
    : {};
  const fresh = findings.filter((finding) => {
    const allowed = baseline[key(finding)] ?? 0;
    if (allowed > 0) {
      baseline[key(finding)] = allowed - 1;
      return false;
    }
    return true;
  });
  if (fresh.length > 0) {
    console.error(
      "[check-n-plus-one] database/service/storage call made once per item inside a loop:",
    );
    for (const f of fresh)
      console.error(`  ${f.file}:${f.line} (loop at ${f.loopLine})  ${f.text}`);
    console.error(
      "\nFetch the whole set in one query (.in(...), a join, or a batched RPC) and look rows up from a Map.\n" +
        "If one call per item is really required, add `// n-plus-one-ok: <reason>` on or above the line.",
    );
    process.exit(1);
  }
  console.log(`[check-n-plus-one] ok (${findings.length} baselined finding(s))`);
}
