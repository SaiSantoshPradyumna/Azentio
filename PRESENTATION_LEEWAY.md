# azentio.ai build — leeway & assumptions taken

**Status for demo:** Phases 1–8 work end-to-end. Access Test Runner **12/12 PASS**. Phase 9 polish (full AIRA UX, deep a11y pass, polished README) is light-touch only — enough to demo, not production-perfect.

**Demo accounts:** see `/login` when `DEMO_MODE=true`. Codes appear in `/dev/outbox` (queued demo — never “emailed”).

This note maps our pre-build clarification questions to **what we actually shipped**, so judges can see where we followed the later `BUILD_SPEC` and where we chose the simplest honest option.

---

## Executive summary

| Area | What we did |
|---|---|
| Stack | Next.js 14 + SQLite (`better-sqlite3`) + Zod + Vitest — no ORM, no cloud email, no billing |
| Auth | One-time code by email; httpOnly `sid` cookie; employee = `@azentio.com` **and** provisioning row |
| Authority | Roles / tenants / permissions **never** from localStorage, URL, or request body |
| Shared learning | Only via `lib/visible.ts`; withdrawal purges in one transaction |
| Access proof | Built-in Access Test Runner (AT-01…AT-12) |
| Islamic FI extras | Bilingual EN/AR + RTL + Hijri dates; AAOIFI / IFSB / IIFM **awareness** copy; local Ollama assist on Playground (optional) |

---

## A. Blocking questions → what we assumed and built

### A1. Priorities / scoring
**Assumption taken:** treat the collaboration portal + access tests as P0.  
**Built:** public site, OTP auth, tenant isolation, draft→submit→moderate→publish→withdraw, visibility-aware search/feed, cohort themes (min 3 orgs), ideas + client status, in-app notifications, Access Test Runner.

### A2. Missing lifecycle
**Assumption taken:** Draft, Submitted, In review, Returned, Published, Unpublished, Rejected, Withdrawn.  
**Built:** exact state machine in `lib/lifecycle.ts` per BUILD_SPEC Section 9 (including Unpublished → Withdrawn so authors can purge a suspended copy).

### A3. Acceptance tests
**Assumption taken:** judges use direct API calls + withdrawal timing.  
**Built:** `/admin` Access Test Runner creates real sessions and hits live HTTP APIs (AT-01…AT-12). Latest summary also surfaces on `/trust`.

### A4. API style
**Assumption taken:** REST + JSON.  
**Built:** App Router route handlers under `/api/*`, all wrapped in `withAuth` (except the public list). No OpenAPI file required by our BUILD_SPEC — endpoints are listed in the spec and exercised by the runner.

### A5. Media protection
**Assumption taken:** authorising proxy (not public static files for private media).  
**Built:** files in `data/private-media/`; `GET /api/media/[id]` authorises audience then streams with **Range / 206**. Public banners only under `public/banners/`. Seed files are tiny **placeholders**.

### A6. Employee identity without Entra / mail
**Assumption taken:** organiser-supplied / seeded `@azentio.com` accounts + demo outbox.  
**Built:** seeded employees; OTP written to Dev outbox (`/dev/outbox`). Domain alone grants nothing.

### A7. Invitations vs email
**Assumption taken:** show link to inviter + outbox; never claim email delivered.  
**Built:** `POST /api/invitations` returns `accept_path` + token; outbox row labelled **queued (demo)**.

---

## B. Important questions → leeway taken

### B1. Personas / grants
**Taken:** Product owner, moderator, publisher, admin are **platform grants** on provisioned employees — not client roles.  
**Built:** two-person approval for `platform.role.grant` (request then a *different* admin approves). Client admins can only grant `client_admin` / `contributor` / `viewer`.

### B2. Support / private source
**Taken:** moderator may see private source only in Submitted / In review / Returned / open report. Break-glass needs dual-approved `support_grants` (schema present; full UI not the demo focus).  
**Built:** report → suspend shared copy; moderator console for private vs redacted; support grant table exists for the dual-approval path.

### B3. Audiences
**Taken (exact):** `public` | `employee` | `tenant:<id>` | `tenant:<id>:product:<slug>` | `community`.  
**Built:** `lib/authorize.ts` evaluates in that order; missing/unknown audience = deny.

### B4. Client roles
**Taken:** `client_admin`, `contributor`, `viewer` only.  
**Built:** inviting `moderator` (or any platform role) → **400**.

### B5. Cohort threshold
**Taken:** min 3 distinct orgs; withdraw → theme re-evaluated immediately; no exact counts below the floor.  
**Built:** `lib/cohort.ts`; `seasonality-context` visible; `collections-messaging` suppressed; org bucket text = “3 or more organisations”.

### B6. Consent vs sharing
**Taken:** private / organisation / community map to process/publish/attribute; **train always false**.  
**Built:** four consent rows on submit; UI states “No model training programme is enabled.”

### B7. Edits to published items
**Taken:** previous live shared view stays until a new version publishes (then superseded).  
**Built:** lifecycle supports Published → In review with version +1; demo path emphasises withdraw / report / republish.

### B8. Withdrawal SLA
**Taken:** API / search / AIRA citation pool clear quickly; production SLA text shown on UI.  
**Built:** one SQLite transaction + withdrawal clock (`search`, `feed`, `theme`, `aira`); page states p99 60s / digests 5 min / copied content cannot be recalled.

### B9. AIRA
**Taken:** build a small deterministic retriever — no training, no employee/private content.  
**Built:** keyword overlap over **public** content blocks + `visibleSharedViews` only (`POST /api/aira/ask`). Not a hosted LLM product. Optional **local Ollama** (`qwen2.5-coder:7b`) explains Playground JSON only — labelled as local assist, not a credit decision.

### B10. Data / reference prototype
**Taken:** use BUILD_SPEC Section 19 seed exactly; visual tokens from the reference site.  
**Built:** synthetic seed orgs/users/contributions; colours `#171b3a` / `#69D393` / `#102031` / `#f5f7f9` / `#607080` from the iPad reference prototype.

---

## C. Lower-priority → what we skipped or simplified

| Question | Leeway |
|---|---|
| C1 Support tickets | Out of scope — not built |
| C2 Cross-client comments | Not built (no comments table in schema) |
| C3 Shared items ≠ sample tenant data | Enforced: shared DTOs never expose tenant/author |
| C4 Sessions | 30 min idle, 8 h absolute, revoke on logout; membership re-read each request |
| C5 NFR | WCAG-minded basics (labels, focus, reduced motion); iPad-width layouts; not a full audit |
| C6 Terminology | tenant = organisation = workspace; observation = contribution |
| C7 Federated track | Explicitly **not** in scope — “No training programme is enabled” |
| C8 Logistics | Local demo via this app + runner |
| C9 Document defects | Treated as formatting; we followed the concrete BUILD_SPEC |

---

## Appendix 1 (RACI) — how it maps in this build

| Activity | How it works here |
|---|---|
| Register org / entitlements | Admin with `org.manage` |
| Provision employees | Seed / `employee_provisioning` (not self-serve) |
| Grant platform roles | Two different `platform.role.grant` holders |
| Invite / client roles | Client admin only; client roles only |
| Banners / public content | `content.publish` (e.g. Kavya) |
| Employee recordings | Audience `employee`; Range streaming |
| Observations | Contributor / client_admin create & submit |
| Moderate / publish | `learning.moderate` (Meera) |
| Report | Any community member → suspend shared copy |
| Withdraw | Author or client_admin of owning tenant |
| Ideas + client update | `product.owner` writes; moderator approves client text |
| Audit | `audit.read` + hash chain check |

---

## Honest limits (say this in the pitch)

1. **Synthetic data only** — badges on every Playground output.  
2. **No real email** — Dev outbox is the delivery surface.  
3. **No model training / federated learning.**  
4. **AIRA** is keyword retrieval + optional local Ollama explanation — not production GenAI.  
5. **AAOIFI / IFSB / IIFM** = governance **awareness** for Islamic FIs, not a certification claim.  
6. **SQLite** for the hackathon; production note would be Postgres + RLS + real email.

---

## Quick demo path (~5 minutes)

1. Visitor: `/` → products → `/connect` (demo request stored).  
2. Sign in as `maya@aurora.example` → observations / Visibility Inspector.  
3. `meera.mod@azentio.com` → `/moderate` (flags, redact, publish).  
4. Themes: seasonality visible (3 orgs); collections suppressed.  
5. Withdraw → clock all clear.  
6. `priya.admin@azentio.com` → `/admin` → **Access Test Runner** → 12/12.  
7. Optional: `/employee/playground` + Ollama assist checkbox; switch locale to العربية (RTL + Hijri).

---

*Source of assumptions: our clarification note to organisers + the concrete `BUILD_SPEC.md` used as the build contract. Detailed engineering choices: `DECISIONS.md`.*
