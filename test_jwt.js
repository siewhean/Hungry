const jwt = require("jsonwebtoken");

if (process.env.HUNGRY_ALLOW_SERVICE_ROLE_SMOKE !== "1") {
  throw new Error("Refusing service-role smoke without HUNGRY_ALLOW_SERVICE_ROLE_SMOKE=1.");
}

const key = process.env.HUNGRY_SMOKE_SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  throw new Error("Set HUNGRY_SMOKE_SUPABASE_SERVICE_ROLE_KEY.");
}

console.log(jwt.decode(key));
