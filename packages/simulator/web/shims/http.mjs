/** node:http for the browser build: there is no server; the page answers requests itself (web/browser.mjs). */
export function createServer() {
  throw new Error('the browser build has no HTTP server');
}
export default { createServer };
