/* Webpack overrides for react-app-rewired. */
const path = require("path");

module.exports = function override(config, env) {
  config.resolve = config.resolve || {};

  // Excalidraw imports roughjs as `roughjs/bin/rough` (etc.) without a file
  // extension, which webpack 5 rejects under strict ESM. Alias each of those
  // bare paths to the exact resolved file so the extensionless imports resolve.
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    "roughjs/bin/rough$": path.resolve(__dirname, "node_modules/roughjs/bin/rough.js"),
    "roughjs/bin/generator$": path.resolve(__dirname, "node_modules/roughjs/bin/generator.js"),
    "roughjs/bin/math$": path.resolve(__dirname, "node_modules/roughjs/bin/math.js"),
  };

  // Silence the noisy "Failed to parse source map ... ENOENT" warnings from
  // @excalidraw/mermaid-to-excalidraw (its dist files reference .ts sources
  // that aren't shipped in the package). This is cosmetic only — the app
  // still runs; these just remove the dev-server warning spam.
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];
  config.module.rules.push({
    test: /\.(js|mjs|cjs)$/,
    enforce: "pre",
    include: path.resolve(__dirname, "node_modules/@excalidraw"),
    use: [{
      loader: require.resolve("source-map-loader"),
      options: { filterSourceMappingUrl: () => false },
    }],
  });

  return config;
};
