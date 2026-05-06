const jwt = require("jsonwebtoken");
const fs = require("fs");
const content = fs.readFileSync(".env.local", "utf-8");
let key = "";
content.split("\n").forEach((line) => {
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    key = line.split("=")[1].replace(/^["'](.*)["']$/, '$1').trim();
  }
});
console.log(jwt.decode(key));
