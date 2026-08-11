# Scholarship Tracker

## Escrowed scholarships with AI epoch review (GenLayer)

Sponsors lock funds on-chain and publish **public, verifiable** conditions (progress reports, public URLs — not private GPA). Students must **accept** an offer before epochs start. Each epoch they submit proof; AI returns `PASS` / `WARN` / `FAIL`.

- **PASS** → release one epoch stipend from the pool  
- **WARN** → award becomes `AT_RISK`; student may resubmit  
- **FAIL** after a prior warn → `CUT`  
- Sponsors can amend conditions (stake + reason)  
- Students can claim unfair cuts / unfair mid-stream rule changes  
- Students can `leave_award` anytime before cut  

## Safety features

- Offer → accept gate (no forced awards)  
- Conditions version pinned at accept time  
- Sponsor cannot award themselves  
- No early review without proof unless the deadline has passed  
- Private/localhost evidence URLs blocked  
- Amend after create still allows new awards (`ACTIVE` / `AMENDED`)  

## Statuses

Scholarship: `ACTIVE` → `AMENDED` → `CLOSED`  
Award: `OFFERED` → `ACTIVE` → `AT_RISK` → `CUT` / `LEFT` (claim may restore `ACTIVE`)

## Core API

| Function | Type | Description |
|----------|------|-------------|
| `create_scholarship` | payable write | Create + fund pool |
| `fund_scholarship` | payable write | Top up pool |
| `award_student` | write | Create `OFFERED` award |
| `accept_award` | write | Student accepts; pins conditions; starts epoch |
| `leave_award` | write | Student exits offer/active award |
| `submit_proof` | write | Student proof for current epoch |
| `review_epoch` | write | AI review + payout / warn / cut |
| `amend_conditions` | payable write | Change conditions with stake |
| `file_claim` / `judge_claim` | payable / write | Unfair-cut arbitration |
| `close_scholarship` | write | Sponsor recovers remaining pool |
| `get_scholarship` / `get_award` / … | view | Reads |

## Config defaults

- `minimum_stake` = 0.01 GEN  
- `minimum_epoch_seconds` = 60 (demo-friendly)  
- `max_warns_before_cut` = 1  

## Local development

```bash
# Contract tests
pip install -r requirements-dev.txt
python -m pytest tests/direct/test_scholarship_tracker.py

# Frontend
cd frontend
npm install
npm run dev
```

Deploy `contracts/scholarship_tracker.py` in GenLayer Studio, then set `frontend/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
```

## Demo script

1. Sponsor creates “Builder Grant” with public monthly report conditions + pool  
2. Award student → student **accepts** (pins condition version)  
3. Student submits proof URL → `review_epoch` → `PASS` + stipend  
4. Weak epoch → `WARN` → another fail → `CUT`  
5. Optional: amend conditions / student claim / leave  

## Disclaimer

Prototype for education/funding experiments. Not legal advice.
