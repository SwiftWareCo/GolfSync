# GolfSync Agent Instructions

## Architecture Snapshot
- Next.js 16 App Router with grouped routes in `src/app/(admin|auth|members)`; server components load data and hand off to client wrappers like `src/components/teesheet/TeesheetPageClient.tsx`.
- State and data flow revolve around teesheet operations; see `src/app/(admin)/admin/page.tsx` for the canonical server→client handoff.
- Database is Postgres via Drizzle + Neon HTTP (`src/server/db/index.ts`, `schema.ts`); mind the `drizzle` ESLint rules requiring `where` clauses on mutations.
- Aliases resolve through `~/` (see `tsconfig.json`); prefer them over deep relative paths.

## Data & Server Patterns
- Domain folders under `src/server/**` pair `data.ts` (pure DB helpers, `server-only`) with `actions.ts` (`"use server"` entry points). Only call `actions` from client code per `.cursor/rules/golfsync.mdc`.
- Query + mutation definitions live in `src/server/query-options/*.ts` with keys centralized in `query-keys.ts`; extend these before adding new `useQuery` calls.
- Timezone logic must use `src/lib/dates.ts` helpers (`getBCToday`, `parseDate`, etc.) to keep BC-local behavior consistent in DB + UI layers.

## Client & UI Patterns
- TanStack Query is mandatory (see `docs/features/tanstack-query-migration.md` and `src/hooks/useTeesheetQuery.ts`); no manual `useEffect`/`fetch` in client components.
- UI primitives live in `src/components/ui/*` (Shadcn-inspired); reuse them plus domain components in `src/components/**` for consistent styling/colors (e.g., `Button` enforces org palette).

## Integrations & Ops
- Authentication/authorization flows through Clerk; middleware routing is enforced in `src/proxy.ts` using `publicMetadata.isAdmin/isMember`. Update both metadata and middleware when adding role-specific routes.
- Weather + alerts: cron endpoint `src/app/api/cron/update-weather/route.ts` requires `CRON_SECRET` and delegates to `src/server/weather/cache.ts`; pushing notifications relies on the VAPID keys in `src/env.js` and the service worker in `public/sw.js`.
- PWA manifest is defined in `src/app/manifest.ts`; any brand/profile changes should mirror `public/` icons and Tailwind theme tokens.
- Environment validation is centralized in `src/env.js`; either set variables or use `SKIP_ENV_VALIDATION=1` for builds/CI hacking.
