const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api/polymarket",
    createProxyMiddleware({
      target: "https://gamma-api.polymarket.com",
      changeOrigin: true,
      pathRewrite: { "^/api/polymarket": "" },
    }),
  );
};
