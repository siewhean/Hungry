import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const chunksDir = join(root, ".next", "static", "chunks");
const MAX_LARGEST_CHUNK_BYTES = 900 * 1024;
const MAX_TOTAL_CHUNK_BYTES = 4.5 * 1024 * 1024;

function walkJsFiles(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkJsFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
    });
  } catch {
    return [];
  }
}

const files = walkJsFiles(chunksDir)
  .map((path) => ({ path, size: statSync(path).size }))
  .sort((left, right) => right.size - left.size);

if (!files.length) {
  console.error("No built JS chunks found. Run `npm run build` before `npm run bundle:budget`.");
  process.exit(1);
}

const total = files.reduce((sum, file) => sum + file.size, 0);
const largest = files[0];
const formatKiB = (bytes) => `${Math.round(bytes / 1024)} KiB`;

console.log("Largest web-v2 chunks:");
files.slice(0, 8).forEach((file) => {
  console.log(`- ${formatKiB(file.size)} ${file.path.replace(`${root}/`, "")}`);
});
console.log(`Total chunk JS: ${formatKiB(total)}`);

if (largest.size > MAX_LARGEST_CHUNK_BYTES) {
  console.error(
    `Largest chunk ${formatKiB(largest.size)} exceeds budget ${formatKiB(
      MAX_LARGEST_CHUNK_BYTES,
    )}.`,
  );
  process.exit(1);
}

if (total > MAX_TOTAL_CHUNK_BYTES) {
  console.error(
    `Total chunk JS ${formatKiB(total)} exceeds budget ${formatKiB(MAX_TOTAL_CHUNK_BYTES)}.`,
  );
  process.exit(1);
}
