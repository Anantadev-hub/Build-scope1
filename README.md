# BuildScope AI — hackathon investigation workspace

An investigative workspace that answers one question: **is this idea worth building, what already
exists, what can we realistically deliver, and what evidence will prove it works?**

The product is frontend-only. It is honest about that: no live search, repository metadata
retrieval, official verification, or AI analysis is connected in this build. Everything is computed
from data the user enters or from clearly labelled demo fixtures.

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
    onboarding/   first-run choice: explore the demo case or start blank
    projects/     case register, guided brief form, case-file overview
    missions/     Mission Control dashboard
    discovery/    Prior Art Lab: leads, filters, comparison matrix, evidence register
    differentiation/ claims, evidence links, recommended moves
    feasibility/  dependency checks, risk matrix, build scope, acceptance criteria
    requirements/ official brief source, requirement mapping, compliance dashboard
    learning/     gap-to-skill paths, resource library, learning log
    hackathons/   Hackathon Radar: filters, tracking, preparation tasks
    reports/      section selection, preview, saved versions, PDF export
    passport/     Buildability Passport with per-check reasons
    gamification/ ranks, XP ledger, achievements
  lib/            models, scoring (missions/XP/passport), report model, PDF renderer, formatting
  services/       provider interfaces for future backend integrations (all unimplemented by design)
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

## Local persistence

Everything is stored in `localStorage` under `buildscope.ai.workspace.v1`: projects, mission state,
evidence, comparisons, risks, requirements, scope, acceptance criteria, learning progress, hackathon
tracking, reports, passports, XP, achievements, and the activity log. Malformed or unreadable stored
data falls back to a fresh demo workspace and says so instead of crashing.

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
npm run dev &                     # app must be running on :3000
node scripts/smoke.mjs            # renders every route, captures console errors + screenshots
node scripts/acceptance.mjs       # full workflow test, including real PDF download
node scripts/supplementary.mjs    # command palette, print CSS, filters, empty states, deletion
node scripts/verify-pdf.mjs shots/<file>.pdf     # page count + extracted text
node scripts/render-pdf.mjs shots/<file>.pdf     # rasterise pages for visual inspection
```

In a bare container, headless Chromium may need extra system libraries. This workspace keeps an
extracted copy under `.libs/` and runs the scripts with:

```bash
LD_LIBRARY_PATH=$PWD/.libs/usr/lib/x86_64-linux-gnu FONTCONFIG_FILE=$PWD/.libs/fonts.conf node scripts/acceptance.mjs
```

## Known limitations

- No backend, no accounts, no sync: data is browser-local.
- Live search, official-source verification, and similarity analysis remain provider work.
- Comparison relevance is a documented local text heuristic, not a live ranking.
- The Buildability Passport is a decision summary, not a guarantee or a completion badge.
