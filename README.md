# Scholarship Tracker

## Escrowed scholarships with AI epoch review (GenLayer)

Sponsors fund a pool and publish **public, verifiable** conditions (progress reports, public URLs — not private GPA). Students submit proof each epoch. AI validators return `PASS` / `WARN` / `FAIL`.

- **PASS** → release one epoch stipend from the pool  
- **WARN** → award becomes `AT_RISK`; student may resubmit  
- **FAIL** after a prior warn → `CUT`  
- Sponsors can amend conditions (stake + reason)  
- Students can claim unfair cuts / unfair mid-stream rule changes  

> Contract-only scaffold for now. Frontend planned next.

## Core API

| Function | Type | Description |
|----------|------|-------------|
| `create_scholarship` | payable write | Create + fund pool |
| `fund_scholarship` | payable write | Top up pool |
| `award_student` | write | Sponsor awards a student |
| `submit_proof` | write | Student proof for current epoch |
| `review_epoch` | write | AI review + payout / warn / cut |
| `amend_conditions` | payable write | Change conditions with stake |
| `file_claim` / `judge_claim` | payable / write | Unfair-cut arbitration |
| `close_scholarship` | write | Sponsor recovers remaining pool |
| `get_scholarship` / `get_award` / … | view | Reads |

## Statuses

Scholarship: `ACTIVE` → `AMENDED` → `CLOSED`  
Award: `ACTIVE` → `AT_RISK` → `CUT` (or back to `ACTIVE` after successful claim)

## Config defaults

- `minimum_stake` = 0.01 GEN  
- `minimum_epoch_seconds` = 60 (demo-friendly)  
- `max_warns_before_cut` = 1  

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/direct/test_scholarship_tracker.py
```

## Deploy

Deploy `contracts/scholarship_tracker.py` via GenLayer Studio or:

```bash
# from GenLayer project tooling
# deploy/deployScript.ts → scholarship_tracker.py
```

## Demo script (for later UI)

1. Sponsor creates “Builder Grant” with public monthly report conditions + pool  
2. Award student  
3. Student submits proof URL → `review_epoch` → `PASS` + stipend  
4. Weak epoch → `WARN` → another fail → `CUT`  
5. Optional: amend conditions / student claim  

## Disclaimer

Prototype for education/funding experiments. Not legal advice.
