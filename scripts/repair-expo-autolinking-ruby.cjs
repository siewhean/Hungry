const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const target = path.join(
  projectRoot,
  "node_modules",
  "expo-modules-autolinking",
  "scripts",
  "ios",
  "precompiled_modules.rb",
);

if (!fs.existsSync(target)) {
  console.log("repair-expo-autolinking-ruby: skipped, file not found");
  process.exit(0);
}

let source = fs.readFileSync(target, "utf8");
const before = source;

if (source.includes("(external_dependencies || []).filter_map do |dep|")) {
  source = source.replace(
    "(external_dependencies || []).filter_map do |dep|",
    "(external_dependencies || []).map do |dep|",
  );
  source = source.replace("        end.uniq\n      end", "        end.compact.uniq\n      end");
}

if (source.includes("        Dir.children(xcframework_path).filter_map do |slice|")) {
  source = source.replace(
    "        Dir.children(xcframework_path).filter_map do |slice|",
    "        Dir.children(xcframework_path).map do |slice|",
  );
  source = source.replace(
    "          framework_headers if File.directory?(framework_headers)\n        end\n      end",
    "          framework_headers if File.directory?(framework_headers)\n        end.compact\n      end",
  );
}

if (source !== before) {
  fs.writeFileSync(target, source);
}

console.log(
  `repair-expo-autolinking-ruby: ${source === before ? "already patched" : "patched"}`,
);
