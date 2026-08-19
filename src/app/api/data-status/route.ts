// Stable operator-facing alias. Keep the original endpoint for backwards
// compatibility with deployed clients while new monitoring uses /api/data-status.
export { dynamic, GET } from "../data-sources/health/route";
