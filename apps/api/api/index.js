// Vercel serverless entrypoint. Deliberately plain JS, not TypeScript: Vercel
// bundles /api/*.ts functions with esbuild, which does not emit the decorator
// metadata Nest's dependency injection relies on. Requiring the already
// tsc-compiled dist/ (built by `nest build`, a real TypeScript compile) sidesteps
// that entirely — this file just wires the compiled app to Vercel's handler shape.
const { createApp } = require('../dist/bootstrap');

let handlerPromise;

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = createApp().then(async (app) => {
      await app.init();
      return app.getHttpAdapter().getInstance();
    });
  }
  return handlerPromise;
}

module.exports = async (req, res) => {
  const handler = await getHandler();
  return handler(req, res);
};
