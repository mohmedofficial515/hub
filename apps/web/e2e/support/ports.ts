/**
 * @file Where the throwaway stack listens: beside a running Hub (7300, 7310), never on it.
 */
export const API_PORT = Number(process.env['E2E_API_PORT'] ?? 7319);
export const WEB_PORT = Number(process.env['E2E_WEB_PORT'] ?? 7359);
export const LAB_PORT = Number(process.env['E2E_LAB_PORT'] ?? 7369);
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
