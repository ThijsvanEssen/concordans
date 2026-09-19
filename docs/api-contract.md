# API Contract

- The canonical API contract lives at the repository root in `openapi.json`.
- Frontend types derive directly (manually in `src/lib/api/generated/openapi-types.ts`) from that schema, and consumers use the 
  simpler aliases in `src/lib/api/types.ts`.
- Client helpers (`src/lib/api/*`) rely on those typed DTOs and call the documented paths with the same query parameters.

## Updating the contract

1. Replace `openapi.json` with a fresh export from the backend when models change.
2. Update `src/lib/api/generated/openapi-types.ts` so the DTOs mirror any schema changes.
3. Tweak `src/lib/api/types.ts`, API clients, and components to use the new fields (avoid referencing backend internals such as `props.*`).
