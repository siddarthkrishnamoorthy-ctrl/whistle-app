// Server-only: base URL the Next.js Route Handlers use to reach the NestJS
// API. Never imported from client components.
export const API_URL = process.env.API_URL || "http://localhost:4000/api/v1";
