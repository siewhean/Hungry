import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDirectory = resolve("dist");
const maximumJavaScriptBytes = 190 * 1024;
const maximumGzipBytes = 65 * 1024;

async function findJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return findJavaScriptFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
    }),
  );
  return nestedFiles.flat();
}

const files = await findJavaScriptFiles(distDirectory);
if (files.length === 0) {
  throw new Error("Bundle budget failed: dist contains no JavaScript files. Run the production build first.");
}

const buffers = await Promise.all(files.map((file) => readFile(file)));
const rawBytes = buffers.reduce((total, buffer) => total + buffer.byteLength, 0);
const gzipBytes = buffers.reduce(
  (total, buffer) => total + gzipSync(buffer, { level: 9 }).byteLength,
  0,
);

const formatKilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
console.log(
  `JavaScript bundle: ${formatKilobytes(rawBytes)} raw / ${formatKilobytes(gzipBytes)} gzip`,
);
console.log(
  `Budget: ${formatKilobytes(maximumJavaScriptBytes)} raw / ${formatKilobytes(maximumGzipBytes)} gzip`,
);

if (rawBytes > maximumJavaScriptBytes || gzipBytes > maximumGzipBytes) {
  throw new Error("Bundle budget exceeded.");
}
