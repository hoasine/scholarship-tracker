"""Deploy Scholarship Tracker to GenLayer Studionet.

Usage:
  set PRIVATE_KEY=0x...
  python scripts/deploy_studionet.py

Prints the new contract address for README / Vercel env update.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet
from genlayer_py.types import TransactionStatus


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "scholarship_tracker.py"


def main() -> int:
    key = (os.environ.get("PRIVATE_KEY") or "").strip()
    if not key:
        print("PRIVATE_KEY is required", file=sys.stderr)
        return 1
    if not CONTRACT.is_file():
        print(f"Missing contract: {CONTRACT}", file=sys.stderr)
        return 1

    account = create_account(key)
    client = create_client(chain=studionet, account=account)
    code = CONTRACT.read_text(encoding="utf-8")

    print(f"Deploying from {account.address} …")
    tx_hash = client.deploy_contract(code=code, args=[])
    print(f"Deploy tx: {tx_hash}")

    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash,
        status=TransactionStatus.ACCEPTED,
        retries=200,
        interval=4000,
    )

    address = None
    if isinstance(receipt, dict):
        data = receipt.get("data") or {}
        if isinstance(data, dict):
            address = data.get("contract_address")
        decoded = receipt.get("txDataDecoded") or receipt.get("tx_data_decoded") or {}
        if not address and isinstance(decoded, dict):
            address = decoded.get("contractAddress") or decoded.get("contract_address")

    if not address:
        print("Deploy finished but address not found in receipt:")
        print(receipt)
        return 2

    print(f"Contract deployed at address: {address}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
