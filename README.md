# Azentio.ai — Intelligent Collaboration Portal

A public marketing site plus a secure multi-tenant collaboration portal for Azentio Financial Software. Clients submit observations; a moderator reviews and redacts them; approved de-identified copies become searchable shared learning; themes require a minimum cohort of organisations; a product owner links themes to improvement ideas; and a client can withdraw a contribution so it disappears everywhere immediately.

**All data in this repository is synthetic.** There are no real customers, no real credit decisions, and no real email. No model training programme is enabled.

| | |
| --- | --- |
| **Stack** | Next.js 14 (App Router) · TypeScript strict · SQLite (`better-sqlite3`) · Zod · Tailwind · Vitest |
| **Auth** | Demo OTP codes (SHA-256 hashed) · httpOnly session cookie · server-side policy engine |
| **Status** | Phases 1–8 complete · **147** unit tests · Access Test Runner **AT-01…AT-12** pass |

---

## Quick start

**Requires Node.js 20+** (recommended: **22.17.x** — native modules like `better-sqlite3` must match your Node ABI).

```bash
npm install
cp .env.example .env.local   # set SESSION_SECRET to a long random value
npm run seed                 # recreates data/app.db with the synthetic dataset
npm run dev                  # http://localhost:3000
```

If port 3000 is already in use:

```bash
npx next dev -p 3200
```

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (default port 3000). |
| `npm run build` / `npm start` | Production build and serve. |
| `npm test` | Vitest suite (147 tests). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run seed` / `npm run reset` | Drop and recreate every table, then load the synthetic dataset. |

---

## Environment

`.env.local` (see `.env.example`):

| Key | Demo value | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | `change-me-long-random` | Reserved for signed sessions; opaque DB session ids today. |
| `COHORT_MIN` | `3` | Minimum distinct organisations before a theme is shown. |
| `DEMO_MODE` | `true` | Enables the developer outbox at `/dev/outbox`. |
| `BASE_URL` | `http://localhost:3000` | Absolute link base for invitation URLs. |
| `OLLAMA_BASE_URL` | *(optional)* | Local Ollama for Playground assist (`qwen2.5-coder:7b`). |

---

## What is built

### Public site
`/`, `/products`, `/products/[slug]`, `/solutions`, `/technology`, `/media`, `/insights`, `/about`, `/connect`, `/trust` — marketing pages, enquiry forms, trust centre with Access Test Runner results. Bilingual **EN/AR** with RTL and Hijri date strip; AAOIFI / IFSB / IIFM awareness copy on About and Trust.

### Auth & policy
OTP sign-in → `/dev/outbox` (demo queue) → httpOnly `sid` cookie. Every privileged API goes through `withAuth` + `authorize` (audience, membership, entitlement, platform grants). Hash-chained audit log; denials are recorded the same way as allowances.

### Client portal (`/c/[tenantId]`)
Observations (draft → submit → withdraw), Visibility Inspector, shared learning feed & search, themes (cohort-gated), improvement ideas (client-safe fields only), entitled Playground demos, org admin invitations.

### Employee portal
Moderation queue & scanner, shared-view publishing, product-owner ideas with evidence grants and public-update approval, content publisher, live/library media with **HTTP Range** streaming (`206`), Playground (synthetic scenarios; optional Ollama assist).

### Admin
Organisations & entitlements, two-person platform grant workflow, Access Test Runner **AT-01…AT-12** (results surface on `/trust`).

---

## Signing in (demo accounts)

`/login` → request a code → open **`/dev/outbox`** → paste the six-digit code. Nothing is emailed.

| Address | Role | Opens |
| --- | --- | --- |
| `priya.admin@azentio.com` | Employee, admin | `/employee`, `/admin`, `/admin/audit` |
| `arjun.admin@azentio.com` | Second approver | `/employee`, `/admin` |
| `meera.mod@azentio.com` | Moderator | `/employee`, `/moderate` |
| `rohan.po@azentio.com` | Product owner | `/employee` (ideas) |
| `kavya.pub@azentio.com` | Publisher | `/employee` (publish / media) |
| `dev.emp@azentio.com` | Employee, no grants | `/employee` only (denials audited) |
| `admin@aurora.example` / `maya@aurora.example` | Aurora Microfinance | `/c/tenant-aurora` |
| `admin@beacon.example` / `sam@beacon.example` | Beacon Credit | `/c/tenant-beacon` |
| `admin@cedar.example` | Cedar Bank | `/c/tenant-cedar` |
| `admin@delta.example` | Delta Leasing | `/c/tenant-delta` |
| `shared@consult.example` | Multi-org consultant | Choose workspace at `/c` |
| `ex.member@aurora.example` | Revoked member | Signs in; tenant URLs → 404 |

No passwords. Client accounts never receive platform grants. An `@azentio.com` address without an active `employee_provisioning` row is not an employee.

---

## Demo walkthrough (≈5 minutes)

1. **Public** — open `/` and `/trust`; note Synthetic / Simulated labels and cohort rule.
2. **Client submit** — sign in as `maya@aurora.example`, file or open an observation, read the Visibility Inspector, submit with consents (`train` always refused in seed).
3. **Moderate** — sign in as `meera.mod@azentio.com`, open `/moderate`, approve a de-identified summary (or resolve a report).
4. **Shared learning** — as Maya or Sam, open the feed / search / themes; seasonality needs ≥3 orgs.
5. **Ideas** — as `rohan.po@azentio.com`, open `/employee/ideas`; attach evidence; post a public update; Meera must approve before clients see the text.
6. **Playground** — `/employee/playground` (synthetic portfolio; badges **Synthetic data** / **Simulated output, not a credit decision**).
7. **Admin** — as Priya, `/admin` → Access Test Runner → expect **12/12 PASS**.
8. **Withdraw** — author withdraws a published item; it disappears from feed, search, export, themes, and idea evidence.

Full mentor Q&A notes: [PRESENTATION_LEEWAY.md](PRESENTATION_LEEWAY.md). Phase log: [PROGRESS.md](PROGRESS.md). Design choices: [DECISIONS.md](DECISIONS.md).

---

## Honest labels (non-negotiable)

- Scenario outputs: **Synthetic data** and **Simulated output, not a credit decision**.
- Shared learning: **de-identified and moderator-reviewed** — never “anonymous”.
- Notifications: **stored** or **queued (demo)** — never “email delivered”.
- Themes always show limitation text; a count is never market prevalence.
- Public footer: *Product information is indicative and subject to validation.*

---

## Project layout (high level)

```
app/           # App Router pages + API routes
lib/           # db, auth, authorize, seed, playground, media helpers
styles/        # tokens.css (brand colours)
tests/         # vitest
data/          # app.db + private-media (gitignored; recreated by seed)
```

---

## License / data notice

Hackathon / challenge demo. Synthetic dataset only. Not for production deployment without a full security and compliance review.
