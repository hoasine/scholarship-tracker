# Scholarship Tracker

<div align="center">

## Escrowed Scholarships with AI Epoch Review on GenLayer

| **Scholarship Tracker Platform** |
|---|
| **Lock GEN. Publish public conditions. Release stipends by milestone. Appeal unfair cuts.** |

[![Live App](https://img.shields.io/badge/Live-scholarship--tracker--black.vercel.app-0f172a?style=for-the-badge&logo=vercel)](https://scholarship-tracker-black.vercel.app)
[![Contract](https://img.shields.io/badge/Contract-0x5545bEfB…1bA9A-1f6feb?style=for-the-badge)](#deployment)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js_+_TypeScript-111827?style=for-the-badge)](#project-structure)
[![Network](https://img.shields.io/badge/Network-GenLayer_Studionet-16a34a?style=for-the-badge)](#deployment)

</div>

---

## Deployment

| Item | Value |
|------|--------|
| Live app | https://scholarship-tracker-black.vercel.app |
| GitHub | https://github.com/hoasine/scholarship-tracker-dapp |
| Network | GenLayer Studionet (`chainId` `61999`) |
| Contract | `0x5545bEfBAb9773728e5Df0B23c543d947891bA9A` |
| Source | `contracts/scholarship_tracker.py` |

This address is the GenVM-compliant redeploy: `gl.nondet.web.render` runs inside the leader/validator nondet flow for `review_epoch` and `judge_claim`.

## Overview

Scholarship Tracker is an education-funding protocol where sponsors lock GEN behind **public, verifiable** conditions (progress reports, public links — not private GPA).

Students must **accept** an offer before epochs start. Each epoch they submit proof; GenLayer AI validators return `PASS` / `WARN` / `FAIL`. Passing releases one stipend from the pool. Weak results warn first; repeated failure cuts funding. Students can leave early or claim if a cut / mid-stream rule change is unfair.

## Core Value Proposition

- **Milestone payouts:** GEN releases only after AI epoch review
- **Accept-before-start:** no forced awards; conditions pinned at accept time
- **Fair cut path:** `WARN` → `FAIL` → `CUT` instead of one-shot termination
- **Accountable amendments:** changing conditions requires stake + public reason
- **Appeal layer:** students can claim unfair cuts or unfair rule changes
- **Public evidence only:** localhost / private URLs blocked for AI-readable proofs
- **GenVM-safe web evidence:** validators independently fetch pages inside `run_nondet_unsafe`

## Protocol Flow

1. **Sponsor creates scholarship** — funds a pool and publishes public conditions
2. **Sponsor awards a student** — creates an `OFFERED` award (cannot self-award)
3. **Student accepts** — pins condition version, reserves one epoch stipend, starts the first deadline
4. **Student submits proof** — notes + public evidence URLs for the current epoch
5. **Anyone calls `review_epoch`** — AI returns `PASS` / `WARN` / `FAIL` and settles
6. **Optional amend / claim / leave / close** — Material vs Clarify rule changes, unfair-cut appeals, exit, recover pool

Statuses:

| Entity | Path |
|--------|------|
| Scholarship | `ACTIVE` → `AMENDED` → `CLOSED` |
| Award | `OFFERED` → `ACTIVE` → `AT_RISK` → `CUT` / `LEFT` (claim may restore `ACTIVE`) |

## Amend & Claim Rules

| Rule | Behavior |
|------|----------|
| Amend while claim open | Blocked on-chain |
| Clarify amend | Stake ≥ minimum stake; does **not** open a claim window |
| Material amend | Stake ≥ `amount_per_epoch`; bumps conditions version; opens a **1-hour** claim window for active awards |
| Claim after CUT | Allowed only while the post-cut claim window is open |
| Claim after material amend | Allowed while award is `ACTIVE` / `AT_RISK` and the window is open |
| LEFT awards | Cannot file claims |
| Claim stake | Must cover contested item (epoch payout or amend stake) |
| Claim evidence | Attaches challenged review; sponsor can `respond_to_claim` before judgment |
| Fetch fail / empty page | Claim → `INCONCLUSIVE`; epoch review → `WARN` |
| Close | Blocked while any award still has an open claim window |

Demo claim / response window: `claim_window_seconds = 3600` (1 hour).

## Risk Controls

| Risk | Mitigation in Scholarship Tracker |
|------|-----------------------------------|
| Forced / surprise awards | Offer → `accept_award` gate before proofs/reviews |
| Mid-stream condition bait-and-switch | Conditions version + snapshot pinned at accept; Material vs Clarify |
| Instant unfair cut | Soft `WARN` before hard `CUT` |
| Early spam reviews | No review without proof until deadline passes |
| Private GPA / LMS dependence | Public URL + notes only; private hosts blocked |
| Sponsor self-dealing | Sponsor cannot award themselves |
| Amend blocking new awards | Awards allowed on `ACTIVE` or `AMENDED` |
| Opaque pool drain | Epoch amount capped; remaining pool recoverable on close |
| Invalid GenVM web scrape | `web.render` only inside leader/validator nondet blocks |
| One-sided claim records | Claims attach challenged review + sponsor response evidence |
| Unauthenticated pages | Timed consensus snapshots at proof/claim/response |
| Unfunded accepted awards | One epoch stipend reserved from pool on `accept_award` |
| Amend during open claim | Blocked on-chain |
| Cheap claims | Claim stake must cover contested epoch/amend amount |
| Left students claiming | `LEFT` cannot file claims |
| Close while windows open | Blocked until claim windows expire |

## Core Contract API

| Function | Type | Description |
|----------|------|-------------|
| `create_scholarship` | write (payable) | Create scholarship + fund pool |
| `fund_scholarship` | write (payable) | Top up pool |
| `award_student` | write | Create `OFFERED` award |
| `accept_award` | write | Student accepts; pins conditions; reserves one epoch |
| `leave_award` | write | Student exits offer / active award |
| `submit_proof` | write | Student proof for current epoch |
| `review_epoch` | write | AI review + payout / warn / cut |
| `amend_conditions` | write (payable) | Clarify or Material change (`is_material`) + stake + reason |
| `file_claim` | write (payable) | Student unfair-cut / unfair-change claim |
| `respond_to_claim` | write | Sponsor reply before AI judgment |
| `judge_claim` | write | AI arbitration + payout |
| `close_scholarship` | write | Sponsor recovers remaining pool (blocked if claim windows open) |
| `get_scholarship` / `get_award` / … | view | Entity reads |

## Demo Walkthrough (Studionet)

1. Open the [live app](https://scholarship-tracker-black.vercel.app) and connect MetaMask on **GenLayer Studionet**.
2. **Create scholarship** — use a 60s epoch for demos; pool ≥ amount/epoch (min 0.01 GEN).
3. **Award** a second wallet (sponsor cannot self-award).
4. As the student: **Accept** → **Submit proof** with a **public HTTPS** report URL (GitHub README / blog).
5. Anyone: **Review epoch** — wait for staged loading; do not spam retries if Studio RPC is busy.
6. Optional: **Clarify** or **Material** amend (Material needs stake ≥ amount/epoch and opens a claim window), leave, file/respond/judge claim, or close after windows expire.

Notes for reviewers:

- `60s` epochs are demo-friendly; production programs can use longer windows.
- Evidence must be publicly crawlable — localhost / private LAN URLs are rejected on-chain.
- If Studio rate-limits, the UI keeps loading and retries for ~1 minute before surfacing an error.
- After contract source changes, redeploy on Studionet and update `NEXT_PUBLIC_CONTRACT_ADDRESS` so live matches this build.

## Project Structure

```text
contracts/   # GenLayer intelligent contract (Python)
deploy/      # Contract deployment scripts
scripts/     # Studionet deploy helper
frontend/    # Next.js application (TypeScript)
tests/       # Contract/integration tests
```

## Environment Variables

Configure in `frontend/.env.local` (see `frontend/.env.example`):

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5545bEfBAb9773728e5Df0B23c543d947891bA9A
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studionet
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
```

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Deploy `contracts/scholarship_tracker.py` first (or use the Studionet address above), then update `NEXT_PUBLIC_CONTRACT_ADDRESS`.

Studionet redeploy (after editing the contract):

```bash
set PRIVATE_KEY=0x...
python scripts/deploy_studionet.py
```

## GenVM / Equivalence Principle

`gl.nondet.web.render` for evidence pages runs **inside** `leader_fn` for both `review_epoch` and `judge_claim`. Validators re-run the same function via `gl.vm.run_nondet_unsafe`, so each validator independently acquires the pages before LLM judgment.

Do **not** call `web.render` in ordinary write-path code outside that nondet block — GenVM validation will reject the contract.

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/direct/test_scholarship_tracker.py
```

## Links

- Live app: [https://scholarship-tracker-black.vercel.app](https://scholarship-tracker-black.vercel.app)
- GitHub: [https://github.com/hoasine/scholarship-tracker-dapp](https://github.com/hoasine/scholarship-tracker-dapp)
- Contract (Studionet): [`0x5545bEfBAb9773728e5Df0B23c543d947891bA9A`](https://studio.genlayer.com)

## Disclaimer

Prototype/demo software for education/funding experiments. Not financial, legal, or scholarship compliance advice.
