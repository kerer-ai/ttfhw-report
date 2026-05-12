# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (Next.js Turbopack)
npm run build        # Production build (SSG, 49 static pages)
npm run start        # Serve production build
npm run lint         # ESLint
```

## Architecture

Static Next.js 16 App Router dashboard that renders build verification reports from local JSON files. No API routes, no database, no authentication — purely a read-only SSG site.

**Data flow:** `json/*.json` → `lib/data-loader.ts` (server-side) → React components (client-side).

**Dual JSON format handling:** The JSON files come in two formats. The older "report-511" format (with `metadata`, `final_results`, `execution_log` top-level keys) gets converted to a standard format (with `meta`, `build_result`, `ut_stats`, `attempt_log`) by `convertReport511Format()` in `data-loader.ts`. The normalized format is what all components consume.

**Routes:**
- `/` — homepage with stats overview, pie chart, bar chart, filterable repo table
- `/[repo]` — per-repo detail page with build/UT/environment info and full raw JSON dump
- `/_not-found` — required by Next.js 16

**Repo naming:** JSON filenames like `verification_report_WSL_AMCT_20260510.json` are parsed by stripping the prefix and date suffix to derive the route segment (`WSL_AMCT`). `getAllRepoNames()` in `data-loader.ts` handles this. Repo metadata (display name, community, URL) is resolved via `deriveRepoIdentity()` in `utils.ts`, backed by `lib/repo-communities.yaml`.

**Components split:**
- `summary/` — homepage widgets (StatsOverview, FilterBar, RepoTable)
- `detail/` — per-repo page widgets (InfoCards, BuildCard, TestCard, TimelineCard)
- `charts/` — Recharts wrappers (ResultPieChart, DurationBarChart)
- `ui/` — reusable primitives (Card, Badge, StatCard)

## Key patterns

- **Next.js 16 params:** Route params are `Promise<T>`. Page components that use `params` must be `async` and call `await params`. See `app/[repo]/page.tsx`.
- **Duration estimation:** When `final_results` lacks explicit durations, helper functions (`getBuildDuration`, `getUtDuration`, etc.) fall back to estimating from `execution_log` timestamps and keyword matching on step/command strings.
- **Status normalization:** All status strings go through `normalizeStatusString()` → `'success' | 'failed' | 'partial_success' | 'not_run' | 'unknown'`.
- **Data desensitization:** All JSON files in `json/` have had internal IPs (`10.x.x.x`), usernames (`/home/<user>/`), and internal hostnames replaced with placeholders. New data added to `json/` should go through the same sanitization.
