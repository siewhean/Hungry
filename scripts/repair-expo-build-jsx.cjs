const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const projectRoot = path.resolve(__dirname, "..");
const nodeModulesRoot = path.join(projectRoot, "node_modules");
const babelConfigPath = path.join(projectRoot, "babel.config.js");

const JSX_PATTERN = /<([A-Z][A-Za-z0-9]*)(\s|\/|>)/;

function listExpoBuildFiles() {
  if (!fs.existsSync(nodeModulesRoot)) {
    return [];
  }

  const packageDirs = fs
    .readdirSync(nodeModulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("expo"))
    .map((entry) => path.join(nodeModulesRoot, entry.name, "build"));

  const files = [];

  for (const buildDir of packageDirs) {
    if (!fs.existsSync(buildDir)) continue;
    walk(buildDir, files);
  }

  return files.filter((file) => file.endsWith(".js"));
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(target, files);
      continue;
    }
    files.push(target);
  }
}

function needsTranspile(source) {
  return JSX_PATTERN.test(source);
}

function transpileFile(file) {
  const source = fs.readFileSync(file, "utf8");
  if (!needsTranspile(source)) {
    return false;
  }

  const transformed = babel.transformFileSync(file, {
    configFile: babelConfigPath,
  });

  if (!transformed?.code) {
    throw new Error(`No transformed output for ${file}`);
  }

  fs.writeFileSync(file, `${transformed.code}\n`);
  return true;
}

let touched = 0;
for (const file of listExpoBuildFiles()) {
  if (transpileFile(file)) {
    touched += 1;
  }
}

console.log(`repair-expo-build-jsx: transpiled ${touched} file(s)`);
