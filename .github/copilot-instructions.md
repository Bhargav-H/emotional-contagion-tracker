# Copilot Instructions for TeamTone

## Project Overview

- **TeamTone** is a React + TypeScript web app for tracking emotional well-being in teams, using Supabase for backend (database, auth, API).
- Major features: emotional check-ins (quick/detailed), personal history, team insights, role-based dashboards, and emotional contagion analytics.

## Architecture & Key Patterns

- **Frontend**: All UI logic is in `src/` (see `components/`, `hooks/`, `lib/`).
  - `components/` contains page-level and shared UI (e.g., `CheckIn`, `Dashboard`, `TeamInsights`).
  - `hooks/` contains custom React hooks (e.g., `useAuth` for authentication state).
  - `lib/supabase.ts` initializes and exports the Supabase client for API/database/auth access.
- **Backend**: Supabase auto-generates REST API endpoints from the database schema. No custom backend code in this repo.
- **Data Flow**: Components fetch and mutate data via the Supabase client. Role-based access is enforced both in UI and via Supabase Row Level Security (RLS).
- **State Management**: Auth state is managed via `AuthProvider` context. Most other state is local to components or managed via hooks.

## Developer Workflows

- **Install**: `npm install`
- **Dev server**: `npm run dev` (Vite)
- **Build**: `npm run build`
- **Supabase setup**: Create a project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
- **DB migrations**: Run SQL in `supabase/migrations/` via Supabase dashboard.
- **Environment variables**: Required for Supabase connection; see `.env` example in README.

## Project Conventions

- **Styling**: Tailwind CSS utility classes. Extend via `tailwind.config.js`.
- **Charts**: Use Recharts in analytics components.
- **Auth**: Use Supabase Auth via `lib/supabase.ts` and `useAuth` hook.
- **Role-based UI**: Render different dashboards/components based on user role (Employee, Manager, Admin).
- **No custom backend**: All server logic is in Supabase (SQL, RLS, triggers if any).

## Integration Points

- **Supabase**: All data/auth flows use the Supabase JS client. See `lib/supabase.ts` for setup.
- **API usage**: Use Supabase client methods (not fetch/axios) for DB and auth.
- **Migrations**: SQL files in `supabase/migrations/` define schema. Apply via Supabase dashboard.

## Examples

- Fetching user data: `const { data } = await supabase.from('users').select('*')`
- Submitting a check-in: `supabase.from('emotion_logs').insert([{ ... }])`
- Using auth context: `const { user } = useAuth()`

## References

- See `README.md` for setup, schema, and workflow details.
- Key files: `src/components/`, `src/hooks/useAuth.ts`, `src/lib/supabase.ts`, `supabase/migrations/`

---

**AI agents:** Follow these conventions and use the Supabase client for all data/auth. Do not add custom backend code. When in doubt, check the README or existing component patterns.
