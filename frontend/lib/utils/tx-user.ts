import type { TransactionProgress } from "@/lib/contracts/ScholarshipTracker";

const STAGE_ORDER = ["preparing", "submitted", "finalizing", "finalized"] as const;

export type TxStage = (typeof STAGE_ORDER)[number];

export function stageLabel(stage: string): string {
  switch (stage) {
    case "preparing":
      return "Preparing wallet request";
    case "submitted":
      return "Submitted to GenLayer";
    case "finalizing":
      return "Waiting for validators";
    case "finalized":
      return "Confirmed on-chain";
    default:
      return stage;
  }
}

export function stageHint(stage: string): string {
  switch (stage) {
    case "preparing":
      return "Confirm in MetaMask if a popup appears.";
    case "submitted":
      return "Transaction sent. Do not spam retry.";
    case "finalizing":
      return "AI / consensus can take a little while…";
    case "finalized":
      return "Done.";
    default:
      return "";
  }
}

export function stageIndex(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage as TxStage);
  return idx >= 0 ? idx : 0;
}

export function friendlyTxError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const lower = raw.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("rejected the request") ||
    lower.includes("denied transaction")
  ) {
    return "You cancelled the wallet request.";
  }
  if (
    lower.includes("rate limited") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests")
  ) {
    return "GenLayer RPC stayed rate-limited after ~1 minute of retries. Try again later.";
  }
  if (
    lower.includes("reading 'json'") ||
    lower.includes('reading "json"') ||
    lower.includes("unknown rpc error") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error")
  ) {
    return "RPC stayed overloaded after ~1 minute of retries. Try again later.";
  }
  if (lower.includes("insufficient funds") || lower.includes("exceeds the balance")) {
    return "Not enough GEN for this transaction (value + gas).";
  }
  if (lower.includes("wrong network") || lower.includes("chain")) {
    return "Switch MetaMask to GenLayer Studionet (chain 61999), then retry.";
  }

  // Prefer short UserError-style messages from the contract.
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length > 260) return `${cleaned.slice(0, 260)}…`;
  return cleaned || "Transaction failed.";
}

export function progressCopy(progress: TransactionProgress | null): {
  title: string;
  hint: string;
  index: number;
} {
  if (!progress) {
    return { title: "", hint: "", index: -1 };
  }
  if (progress.message) {
    return {
      title: progress.message,
      hint: "Studio RPC is busy. Keeping this request alive instead of failing immediately.",
      index: stageIndex(progress.stage),
    };
  }
  return {
    title: stageLabel(progress.stage),
    hint: stageHint(progress.stage),
    index: stageIndex(progress.stage),
  };
}

export { STAGE_ORDER };
