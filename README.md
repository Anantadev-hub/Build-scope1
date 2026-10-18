# BuildScope AI — hackathon investigation workspace

An investigative workspace that answers one question: **is this idea worth building, what already
exists, what can we realistically deliver, and what evidence will prove it works?**

The product is frontend-only. It is honest about that: no live search, repository metadata
retrieval, official verification, or AI analysis is connected in this build. Everything is computed
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
  services/       auth adapter (local demo) and provider interfaces for future backend
                  integrations (all provider methods unimplemented by design)
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
and the activity log. Malformed or unreadable stored data falls back to a fresh demo workspace and says
so instead of crashing.

Workspace controls live on **My Projects**: add the demo case (never replacing existing work) or clear
the local workspace (with confirmation). Deleting a case removes its dependent records and its XP.

## Future backend integration

`src/services/providers.js` defines provider factories for repository search, web/page retrieval, and
hackathon discovery. Every method throws `ProviderNotConfiguredError` — no fake "live" data is ever
returned. Normalisation (`normalizeRepository`), deduplication, and the local relevance heuristic are
implemented so a real adapter can drop in without changing the UI. Secret-bearing calls belong in a
server route (for example `POST /api/search/repositories`); no credentials belong in this client.

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
  browser-local.
- Live search, official-source verification, similarity analysis, CI webhooks, and email delivery remain
  provider/server work. Nothing in the UI claims otherwise.
- The Opportunity-to-Proof graph only records what the team enters. It never implies that code or tests
  were independently verified.
- Comparison relevance is a documented local text heuristic, not a live ranking.
- The Buildability Passport is a decision summary, not a guarantee or a completion badge.
