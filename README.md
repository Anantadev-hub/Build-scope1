# BuildScope AI — hackathon investigation workspace

An investigative workspace that answers one question: **is this idea worth building, what already
exists, what can we realistically deliver, and what evidence will prove it works?**

The product is frontend-only. It is honest about that: official verification and AI analysis are not
connected, and repository discovery only reaches a service when a backend route is configured for it
(see [Repository search configuration](#repository-search-configuration)). Everything else is computed
from data the user enters or from clearly labelled demo fixtures.

The app opens on a demo sign-in screen. **Enter demo workspace** needs no credentials and loads the
worked Kabadiwala Connect case; **Create a demo account** starts an empty, separate workspace stored in
the same browser. See [Demo authentication](#demo-authentication) for what that does and does not do.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production bundle in dist/
```

Vite rejects requests whose `Host` header it does not recognise. Hosted or tunnelled previews use a
hostname that changes per environment, so pass it at start-up instead of committing it:

```bash
PREVIEW_ALLOWED_HOSTS=my-preview-host.example npm run dev
```

React 18 + Vite. Routing with React Router. Icons from lucide-react. PDFs generated client-side with
jsPDF + jspdf-autotable. Fonts (Archivo / Inter / IBM Plex Mono) are self-hosted through
`@fontsource` packages, so the interface does not depend on a font CDN.

## Structure

```
src/
  app/            shell, routing outlet, command palette, persistent store, hooks
  components/     design-system primitives (buttons, cards, badges, modal, tracks, states)
  data/demo.js    clearly labelled demo fixtures, learning resources
  features/
    auth/         sign in, register, local password reset, shared field primitives
    onboarding/   first-run choice: explore the demo case or start blank
    projects/     case register, guided brief form, case-file overview
    missions/     Mission Control dashboard
    discovery/    Prior Art Lab: leads, filters, comparison matrix, evidence register
    differentiation/ claims, evidence links, recommended moves
    feasibility/  dependency checks, risk matrix, build scope, acceptance criteria
    requirements/ official brief source, requirement mapping, compliance dashboard
    learning/     gap-to-skill paths, resource library, learning log
    hackathons/   Hackathon Radar: filters, tracking, preparation tasks
    graph/        Opportunity-to-Proof graph (src/features/graph): five stages, links,
                  traceability table
    assurance/    acceptance-criteria tracker, manual test log, CI boundary
    reports/      section selection, preview, saved versions, PDF export
    passport/     Buildability Passport with per-check reasons
    gamification/ ranks, XP ledger, achievements
  lib/            models, scoring (missions/XP/passport), report model, PDF renderer,
                  graph + assurance derivations, formatting
  config.js       validated environment configuration and demo-mode policy
  services/       api client, auth adapter (local demo), repository-search client, and
                  provider interfaces for integrations still unimplemented by design
scripts/          Playwright verification scripts (see below)
```

## How the workflow hangs together

`Project → Prior art → Differentiation → Feasibility → Requirements → Scope & acceptance criteria →
Report → Buildability Passport`, with missions, XP, ranks, and achievements derived from the same
records. Cross-feature links are by stable IDs, not display names:

- Evidence saved in Prior Art Lab appears in the differentiation claim picker, the report source
  register, and the passport.
- A feasibility blocker and an unmitigated high risk surface on Mission Control and in the passport.
- An unverified official brief keeps the compliance banner, the report, and the passport honest.
- Completing a learning resource updates the learning log only; a project gap is resolved solely by
  recorded implementation evidence.
- Reports store a snapshot, so regenerating after changes does not rewrite history.

## Demo data rules

- Repository, product, dataset, and event records are simulated fixtures. They carry a `DEMO` badge,
  have no fabricated links, and show metadata (stars, licences, dates) as **unknown**.
- Fixtures are seeded only for an explicitly signed-in demo account, or when the build runs in demo
  mode (`VITE_APP_MODE=demo`, the default for `vite dev`). A registered account starts with an empty
  workspace, and a production build seeds nothing. See [Production configuration](#production-configuration).
- Hackathon Radar merges its simulated listings only in demo mode; otherwise it lists exactly the
  events the team recorded.
- Records returned by a configured repository service carry a `LIVE` badge and their retrieval
  timestamp. They are still public metadata only, not a verification of documented capability.
- Demo and user-asserted records never satisfy verification checks: `Source Verified`, evidence
  quality, and passport evidence checks only count records a user marked verified with a check date.
- Hackathon listings are labelled **DEMO DATA — NOT LIVE VERIFIED**; simulated dates are shown as
  unconfirmed rather than as countdowns.
- Learning resources link to real publishers, but availability and pricing are labelled as unchecked.

## Demo authentication

`src/services/auth.js` is the whole identity system in this build. Accounts live in this browser, the
password is kept only as a salted PBKDF2-SHA256 digest (120k iterations, per-account salt), and a session
is a local record in `localStorage` (or `sessionStorage` when “keep me signed in” is off). No request is
made and no credential exists to leak.

- Route guards (`RequireAuth`, `RedirectIfSignedIn`) send signed-out visitors to `/login` and remember the
  intended destination, so a deep link continues after sign-in.
- Each account gets its own workspace key, so signing in as a different demo account shows that account's
  cases, never a merge of two people's work. A legacy single-workspace `v1` record is adopted once, with a
  visible notice.
- The password reset screen explains that no email exists. It can replace the local digest for an account
  that is known in this browser, and says plainly that nothing was emailed or verified.
- The adapter exposes `signIn`, `register`, `signOut`, `getSession`, `requestPasswordReset`,
  `resetPasswordLocal` and `workspaceKeyFor`. `AUTH_CONTRACT` documents the endpoints a real backend must
  provide; swapping in a server adapter is a change to `AuthProvider`'s `adapter` prop, not to the screens.

This is demo-grade by design: there is no identity verification, no email delivery, no server-enforced
session, and clearing site data removes the account and its workspace.

## Local persistence

Everything is stored in `localStorage` under `buildscope.ai.workspace.v2:<accountId>`: projects, mission
state, evidence, comparisons, risks, requirements, scope, acceptance criteria, proof graph nodes and
links, manual test records, learning progress, hackathon tracking, reports, passports, XP, achievements,
and the activity log. Malformed or unreadable stored data falls back to a fresh workspace (seeded only in
demo mode) and says so instead of crashing.

This is the only persistence layer today. It is **not** a backend: data does not leave the browser and
nothing syncs across devices. Treat it as local-first storage that a server store will replace, not as
account persistence.

Workspace controls live on **My Projects**: add the demo case (never replacing existing work) or clear
the local workspace (with confirmation). Deleting a case removes its dependent records and its XP.

## Production configuration

Configuration is centralised in `src/config.js`. Values are public: Vite inlines every `VITE_*`
variable into the bundle, so a variable can hold a URL or a mode, never a credential.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_APP_MODE` | `demo` or `production` | `demo` for `vite dev`, `production` for `vite build` |
| `VITE_DEMO_DATA` | force fixtures `on`/`off` in either mode | unset |
| `VITE_AUTH_ADAPTER` | `local-demo` (implemented) or `backend` (reserved) | `local-demo` |
| `VITE_API_BASE_URL` | absolute API origin | same origin |
| `VITE_REPOSITORY_SEARCH_PATH` | default route the backend should expose | `/api/search/repositories` |
| `VITE_REPOSITORY_SEARCH_URL` | actual repository-search URL; empty disables the feature | unset |

What changes between modes:

- **Demo mode** seeds the worked Kabadiwala Connect case for the demo account, merges the simulated
  hackathon listings, and keeps the fixture-driven screens populated. Everything is labelled.
- **Production mode** seeds nothing, merges no fixtures, and shows empty states until real records
  exist or a service is connected. It never fills a failed request with demo data.
- A signed-in demo account counts as explicit demo mode in either build, because the user chose that
  entry point.

Configuration problems that would surface as opaque request failures are detected up front and shown in
Prior Art Lab's provider panel: malformed URLs, `http://` endpoints on an `https://` page (mixed content),
`VITE_AUTH_ADAPTER=backend` without an adapter, and fixtures forced on in production.

All HTTP goes through `src/services/api.js`: JSON encoding, a default 20 s timeout, abort propagation,
`{ error }` extraction, and a single 401 signal that ends the session in one place. Services translate
`ApiError` into domain messages; components never call `fetch` directly.

## Repository search configuration

Prior Art Lab can query a real repository service. The client is implemented; the service is not part
of this repository, so **nothing is retrieved until a backend route is configured**.

```bash
# .env (not committed) — public URL only, never a token
VITE_REPOSITORY_SEARCH_URL=https://your-backend.example.com/api/search/repositories
```

- With the variable set, opening a case that has no repository records runs one search automatically;
  the panel also has a query field and a **Search** / **Retry** button.
- With it unset, the panel reports **NOT CONFIGURED**, states that no request was made, and shows no
  substitute data. The derived query list and manual lead entry still work.
- Results are mapped into the normal record schema (`retrieval: 'live'`, retrieval timestamp,
  limitations), deduplicated against records already saved for the case, and badged **LIVE**.
- A failed request is reported with its status and message plus a retry; saved records are untouched and
  demo fixtures are never shown in place of live results. `src/data/demo.js` is only ever loaded onto
  the seeded demo case.

Contract the backend must satisfy (`REPOSITORY_SEARCH_CONTRACT` in `src/services/providers.js`):

```http
POST /api/search/repositories
Content-Type: application/json

{ "query": "string", "queries": ["string"], "limit": 20,
  "investigation": { "name": "", "problem": "", "solution": "", "desiredOutcome": "",
                     "targetUsers": [""], "features": [""], "stack": [""] } }
```

```json
{ "results": [ { "name": "", "owner": "", "url": "https://…", "description": "",
                 "language": "", "topics": [""], "stars": 0, "forks": 0,
                 "lastUpdated": "ISO date", "licence": "", "docs": "",
                 "matchReason": "", "overlap": "", "relevantFeatures": [""],
                 "limitations": "" } ],
  "retrievedAt": "ISO timestamp", "source": "github", "warnings": [""] }
```

Non-2xx responses should return `{ "error": "message" }`. The server owns the GitHub/FishAPI
credential, caching, and rate limits; only the route URL belongs in the browser build. A GitHub-shaped
response (`html_url`, `stargazers_count`, `updated_at`, `license.spdx_id`, `full_name`) is also accepted.

Other providers — web/product search, paper and dataset search, official-source checks, hackathon
discovery, CI results — remain unimplemented in `src/services/providers.js` and throw
`ProviderNotConfiguredError`. No fake "live" data is ever returned.

## Backend contracts required

Only the repository-search contract above is implemented on the client. The rest of the product is a
local-first workspace whose data model is already stable, so these are the remaining server contracts.
None of them exist in this repository; nothing in the UI pretends they do.

1. **Authentication / sessions** — `AUTH_CONTRACT` in `src/services/auth.js`: register, login, logout,
session read, password-reset request and reset. The browser needs an `httpOnly`, `Secure`, `SameSite`
session cookie; the client must never receive or store a bearer token. `GET /api/auth/session` returning
401 is already wired to end the session through `src/services/api.js`.
2. **Workspace persistence** — read and write projects (with their evidence, comparisons, risks,
requirements, scope, acceptance criteria, proof nodes/links, tests, reports, passports) scoped to the
authenticated account. Required semantics: server is the source of truth; a per-record revision or
`updatedAt` for conflict detection; 401/403 for unauthorized access; no account IDs accepted from the
client body. The store (`src/app/store.jsx`) is the single place that would be swapped for these calls.
3. **Official sources / verification** — no endpoint. Requirements and evidence are user-entered today;
any "verified" claim must come from a server-side check that records source URL, check time and method.
4. **CI results** — `/api/ci/runs` and `/api/ci/runs/:id/artifacts` are documented in `src/lib/assurance.js`
and remain unimplemented; the UI labels all test records "self-reported".
5. **Hackathon / paper / dataset discovery** — provider factories exist; capabilities, quotas and
licensing must be confirmed by the backend team before any adapter is written.

## Deployment

The app is a static Vite build with client-side routes.

```bash
npm ci
VITE_API_BASE_URL=https://api.example.com npm run build   # dist/
npm run preview                                           # local check on :3000
```

- Configuration is baked in at **build** time. Changing an environment variable requires a rebuild; a
  variable cannot be changed per request at runtime.
- Serve `index.html` for unknown paths so deep links such as `/projects/<id>/prior-art` survive a refresh.
  Netlify/Cloudflare Pages: `/* /index.html 200`. Vercel: a rewrite of `/(.*)` to `/index.html`. nginx:
  `try_files $uri $uri/ /index.html;`. `vite preview` already does this locally.
- No host name is compiled in: `vite.config.js` takes allowed preview hosts from
  `PREVIEW_ALLOWED_HOSTS`, so the same build works on any domain.
- Keep `.env` out of version control (it is git-ignored); only `.env.example` is committed.
- A failed or unreachable backend produces a visible error with a retry, not a blank screen: Prior Art
  Lab is the only screen that calls a backend today.

## Verification

```bash
npx playwright install chromium   # once per machine
npm run dev &                     # app must be running on :3000
node scripts/smoke.mjs            # renders every route, captures console errors + screenshots
node scripts/auth.mjs             # register, sign-in, guards, reset, per-account isolation
node scripts/acceptance.mjs       # full workflow test, including real PDF download
node scripts/supplementary.mjs    # command palette, print CSS, filters, empty states, deletion
node scripts/proof.mjs            # proof graph, assurance tracker, CI boundary, report sections
node scripts/audit.mjs            # every route at 1440/1024/768/390 px, overflow + landmarks
node scripts/verify-pdf.mjs shots/<file>.pdf     # page count + extracted text
node scripts/render-pdf.mjs shots/<file>.pdf     # rasterise pages for visual inspection
```

In a bare container, headless Chromium may need extra system libraries. This workspace keeps an
extracted copy under `.libs/` and runs the scripts with:

```bash
LD_LIBRARY_PATH=$PWD/.libs/usr/lib/x86_64-linux-gnu FONTCONFIG_FILE=$PWD/.libs/fonts.conf node scripts/acceptance.mjs
```

## Known limitations

- No backend, no real accounts, no sync: authentication is a local demo adapter and data is
  browser-local. Moving to server persistence is a store-level change plus the contracts above, and is
  not implemented here.
- Repository search needs `VITE_REPOSITORY_SEARCH_URL` pointing at a backend route that does not ship
  here; without it the app says so instead of showing results. Web/product search, paper and dataset
  search, official-source verification, similarity analysis, CI webhooks, and email delivery remain
  provider/server work. Nothing in the UI claims otherwise.
- The Opportunity-to-Proof graph only records what the team enters. It never implies that code or tests
  were independently verified.
- Comparison relevance is a documented local text heuristic, not a live ranking.
- The Buildability Passport is a decision summary, not a guarantee or a completion badge.
