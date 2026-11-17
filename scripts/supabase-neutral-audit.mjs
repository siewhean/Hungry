import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const functionsDir = path.join(repoRoot, "supabase", "functions");

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function listFiles(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => predicate(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function walkFiles(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", ".expo"].includes(entry.name)) continue;
      out.push(...walkFiles(entryPath, predicate));
    } else if (predicate(entry.name)) {
      out.push(entryPath);
    }
  }
  return out.sort();
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

const migrationFiles = listFiles(migrationsDir, (name) => name.endsWith(".sql"));
const migrations = migrationFiles.map((filePath) => ({
  file: path.relative(repoRoot, filePath),
  sql: readIfExists(filePath),
}));

const createTableMatches = [];
const rlsEnabled = [];
const policies = [];
const activePolicies = new Map();
const securityDefinerFunctions = [];
const grants = [];
const storageBuckets = [];

for (const migration of migrations) {
  const source = migration.sql;
  for (const match of source.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(public)\.)?("?[\w]+"?)/gi)) {
    createTableMatches.push({
      table: match[2].replaceAll('"', ""),
      file: migration.file,
      line: lineNumber(source, match.index ?? 0),
    });
  }
  for (const match of source.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:(public)\.)?("?[\w]+"?)\s+enable\s+row\s+level\s+security/gi)) {
    rlsEnabled.push(match[2].replaceAll('"', ""));
  }
  for (const match of source.matchAll(/drop\s+policy\s+if\s+exists\s+"?([^"\n]+?)"?\s+on\s+("?[\w]+"?)\s*;/gi)) {
    const name = match[1].trim();
    const table = match[2].replaceAll('"', "");
    activePolicies.delete(`${table}:${name}`);
  }
  for (const match of source.matchAll(/create\s+policy\s+"?([^"\n]+?)"?\s+on\s+("?[\w]+"?)[\s\S]*?;/gi)) {
    const statement = match[0];
    const roleMatch = statement.match(/\bto\s+([^(\n]+?)(?:\s+using|\s+with\s+check|\s*$)/i);
    const commandMatch = statement.match(/\bfor\s+(all|select|insert|update|delete)\b/i);
    const policy = {
      name: match[1].trim(),
      table: match[2].replaceAll('"', ""),
      command: commandMatch?.[1]?.toLowerCase() ?? "all",
      roles: roleMatch?.[1]?.trim().replace(/\s+/g, " ") ?? "public",
      file: migration.file,
      line: lineNumber(source, match.index ?? 0),
      statement,
    };
    policies.push(policy);
    activePolicies.set(`${policy.table}:${policy.name}`, policy);
  }
  for (const match of source.matchAll(/create\s+or\s+replace\s+function\s+public\.("?[\w]+"?)\s*\(([\s\S]*?)\)[\s\S]*?;/gi)) {
    const statement = match[0];
    if (/security\s+definer/i.test(statement)) {
      securityDefinerFunctions.push({
        function: match[1].replaceAll('"', ""),
        file: migration.file,
        line: lineNumber(source, match.index ?? 0),
        hasSearchPath: /set\s+search_path\s*=/i.test(statement),
      });
    }
  }
  for (const match of source.matchAll(/grant\s+([\s\S]*?)\s+on\s+(?:function|table)\s+([\s\S]*?)\s+to\s+([^;]+);/gi)) {
    grants.push({
      privileges: match[1].trim().replace(/\s+/g, " "),
      object: match[2].trim().replace(/\s+/g, " "),
      roles: match[3].trim().replace(/\s+/g, " "),
      file: migration.file,
      line: lineNumber(source, match.index ?? 0),
    });
  }
  for (const match of source.matchAll(
    /insert\s+into\s+storage\.buckets[\s\S]*?values\s*([\s\S]*?)(?:on\s+conflict|;)/gi,
  )) {
    const valuesBlock = match[1];
    const tupleRegex =
      /\(\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*(true|false)\s*,[\s\S]*?\)(?=\s*,\s*\(|\s*$)/gi;
    for (const tupleMatch of valuesBlock.matchAll(tupleRegex)) {
      storageBuckets.push({
        bucket: tupleMatch[1],
        file: migration.file,
        line: lineNumber(source, (match.index ?? 0) + (tupleMatch.index ?? 0)),
        public: tupleMatch[2].toLowerCase() === "true",
      });
    }
  }
}

const createdTables = unique(createTableMatches.map((entry) => entry.table));
const rlsTables = new Set(unique(rlsEnabled));
const tablesMissingRls = createdTables.filter((table) => !rlsTables.has(table));
const effectivePolicies = Array.from(activePolicies.values());
const policyTables = new Set(effectivePolicies.map((policy) => policy.table));
const tablesWithoutPolicies = createdTables.filter((table) => !policyTables.has(table));
const anonWritePolicies = effectivePolicies.filter(
  (policy) =>
    /\banon\b/i.test(policy.roles) &&
    ["all", "insert", "update", "delete"].includes(policy.command),
);

const directSupabaseClientFiles = walkFiles(repoRoot, (name) => /\.(ts|tsx|js|mjs|cjs)$/.test(name))
  .filter((filePath) => !filePath.includes(`${path.sep}node_modules${path.sep}`))
  .filter((filePath) => {
    const relative = path.relative(repoRoot, filePath);
    if (!relative.startsWith("src/") && !relative.startsWith("utils/")) return false;
    if (relative === "src/lib/services/supabase/client.ts") return false;
    if (relative.startsWith(`supabase${path.sep}functions${path.sep}`)) return false;
    if (relative.startsWith(`scripts${path.sep}`)) return false;
    const source = readIfExists(filePath);
    return /createClient\s*\(/.test(source) && /@supabase\/supabase-js/.test(source);
  })
  .map((filePath) => path.relative(repoRoot, filePath));

const edgeFunctions = fs.existsSync(functionsDir)
  ? fs
      .readdirSync(functionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const indexPath = path.join(functionsDir, entry.name, "index.ts");
        const source = readIfExists(indexPath);
        return {
          name: entry.name,
          file: path.relative(repoRoot, indexPath),
          usesServiceRole: /SUPABASE_SERVICE_ROLE_KEY/.test(source),
          validatesJwtInCode: /auth\.getUser\(\)/.test(source),
          usesAllowedOrigins: /ALLOWED_ORIGINS|AllowedOrigins|allowedOrigins/.test(source),
          tsNocheck: /@ts-nocheck/.test(source),
        };
      })
  : [];

const report = {
  generatedAt: new Date().toISOString(),
  scope: "repo-static-only",
  migrations: {
    count: migrations.length,
    first: migrations[0]?.file ?? null,
    last: migrations.at(-1)?.file ?? null,
  },
  tables: {
    createdCount: createdTables.length,
    createdTables,
    rlsEnabledCount: rlsTables.size,
    tablesMissingRls,
    tablesWithoutPolicies,
  },
  policies: {
    count: effectivePolicies.length,
    anonWritePolicies: anonWritePolicies.map(({ name, table, command, roles, file, line }) => ({
      name,
      table,
      command,
      roles,
      file,
      line,
    })),
  },
  storage: {
    buckets: storageBuckets,
  },
  functions: {
    edgeFunctions,
    securityDefinerFunctions,
    grants,
  },
  appIntegration: {
    directSupabaseClientFiles,
    note: "Direct app clients should be rare; app code should normally use src/lib/services/supabase/client.ts.",
  },
};

console.log(JSON.stringify(report, null, 2));
