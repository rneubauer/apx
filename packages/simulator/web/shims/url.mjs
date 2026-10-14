/** node:url for the browser build: file URLs inside the virtual filesystem. */
export const fileURLToPath = (url) => decodeURIComponent(new URL(String(url)).pathname);
export const pathToFileURL = (path) => new URL(`file://${path}`);
export default { fileURLToPath, pathToFileURL };
