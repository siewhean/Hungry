// Production bundles resolve the mock service, mock fixtures and the Excel catalog
// (9.4 MB JSON) to this stub via metro.config.js. Production always uses Supabase
// (see getConfiguredDataSource), so nothing should read from it; if something does,
// fail loudly instead of silently showing fixture data.
const message =
  "Mock/Excel data sources are not bundled in production builds. Use the Supabase provider.";

module.exports = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === "__esModule" || property === "then" || typeof property === "symbol") {
        return undefined;
      }
      throw new Error(`${message} (accessed "${String(property)}")`);
    },
  },
);
