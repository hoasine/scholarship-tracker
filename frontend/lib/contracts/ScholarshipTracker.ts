import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import {
  extractTxErrorMessage,
  isFailureResultName,
  isPendingResultName,
  isSuccessResultName,
} from "./tx-error";
import { withTransientRpcRetry } from "@/lib/utils/rpc-retry";

export type ScholarshipStatus = "ACTIVE" | "AMENDED" | "CLOSED";
export type AwardStatus = "OFFERED" | "ACTIVE" | "AT_RISK" | "CUT" | "LEFT";
export type ReviewVerdict = "PASS" | "WARN" | "FAIL" | "";
export type ClaimVerdict = "STUDENT_WINS" | "SPONSOR_WINS" | "INCONCLUSIVE" | "";
export type ClaimStatus = "OPEN" | "JUDGED";

export type ScholarshipView = {
  id: number;
  sponsor: string;
  title: string;
  conditions: string;
  epoch_seconds: number;
  amount_per_epoch: number | string;
  pool_balance: number | string;
  created_at: number;
  version: number;
  amendment_count: number;
  award_count: number;
  active_award_count: number;
  open_claim_count: number;
  status: ScholarshipStatus;
  closed: boolean;
};

export type AwardView = {
  id: number;
  scholarship_id: number;
  student: string;
  status: AwardStatus;
  current_epoch: number;
  warn_count: number;
  total_released: number | string;
  awarded_at: number;
  epoch_deadline: number;
  last_review_at: number;
  proof_count: number;
  review_count: number;
  has_open_claim: boolean;
  open_claim_id: number;
  cut_at: number;
  accepted_at: number;
  accepted_conditions_version: number;
  accepted_conditions: string;
};

export type ProofView = {
  id: number;
  award_id: number;
  scholarship_id: number;
  student: string;
  epoch: number;
  notes: string;
  evidence_urls: string;
  submitted_at: number;
  reviewed: boolean;
};

export type EpochReviewView = {
  id: number;
  award_id: number;
  scholarship_id: number;
  epoch: number;
  proof_id: number;
  verdict: ReviewVerdict;
  confidence: number;
  reasoning: string;
  amount_released: number | string;
  reviewed_at: number;
  late_submission: boolean;
};

export type AmendmentView = {
  id: number;
  scholarship_id: number;
  sponsor: string;
  reason: string;
  old_conditions: string;
  new_conditions: string;
  stake: number | string;
  created_at: number;
  version: number;
};

export type ClaimView = {
  id: number;
  scholarship_id: number;
  award_id: number;
  student: string;
  reason: string;
  evidence: string;
  evidence_urls: string;
  stake: number | string;
  created_at: number;
  judged_at: number;
  verdict: ClaimVerdict;
  confidence: number;
  reasoning: string;
  status: ClaimStatus;
  paid_out: boolean;
};

export type ProtocolConfig = {
  minimum_stake: number | string;
  minimum_epoch_seconds: number;
  max_warns_before_cut: number;
  scholarship_count: number;
  award_count: number;
  claim_count: number;
};

export type TransactionProgress = {
  hash?: string;
  stage: "preparing" | "submitted" | "finalizing" | "finalized";
  /** Optional UI copy (e.g. RPC cooldown while retrying). */
  message?: string;
};

export type WriteResult = {
  hash: string;
  receipt: unknown;
};

const AI_TX_WAIT = {
  retries: 90,
  interval: 2000,
  status: TransactionStatus.ACCEPTED,
};
const FAST_TX_WAIT = {
  retries: 40,
  interval: 2000,
  status: TransactionStatus.ACCEPTED,
};

function normalizeReadValue(value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of value.entries()) {
      obj[String(key)] = normalizeReadValue(entry);
    }
    return obj;
  }
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeReadValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeReadValue(entry)])
    );
  }
  return value;
}

function normalizeReadResult<T>(raw: unknown): T {
  return normalizeReadValue(raw) as T;
}

export class ScholarshipTrackerClient {
  private contractAddress: `0x${string}`;
  private readClient: ReturnType<typeof createClient>;
  private account?: `0x${string}`;
  private endpoint?: string;

  constructor(contractAddress: string, account?: string | null, endpoint?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.account = account ? (account as `0x${string}`) : undefined;
    this.endpoint = endpoint;
    const config: Record<string, unknown> = { chain: studionet };
    if (endpoint) config.endpoint = endpoint;
    this.readClient = createClient(config as Parameters<typeof createClient>[0]);
  }

  updateAccount(address: string, endpoint?: string) {
    this.account = address as `0x${string}`;
    this.endpoint = endpoint ?? this.endpoint;
  }

  private async getWriteClient() {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("A browser wallet is required to send transactions.");
    }
    if (!this.account) {
      throw new Error("Connect your wallet before sending a transaction.");
    }
    const client = createClient({
      chain: studionet,
      endpoint: this.endpoint,
      account: this.account,
      provider: window.ethereum as NonNullable<
        Parameters<typeof createClient>[0]
      >["provider"],
    });
    await client.connect("studionet");
    return client;
  }

  private notifyRpcWait(
    onProgress: ((progress: TransactionProgress) => void) | undefined,
    stage: TransactionProgress["stage"],
    hash: string | undefined,
    remainingMs: number
  ) {
    const secs = Math.max(1, Math.ceil(remainingMs / 1000));
    onProgress?.({
      hash,
      stage,
      message: `RPC busy — still checking for up to ~${secs}s…`,
    });
  }

  private async waitForWrite(
    client: ReturnType<typeof createClient>,
    hash: Awaited<ReturnType<ReturnType<typeof createClient>["writeContract"]>>,
    options: {
      retries: number;
      interval: number;
      status?: TransactionStatus;
    } = AI_TX_WAIT,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    const hashStr = String(hash);
    onProgress?.({ hash: hashStr, stage: "finalizing" });

    const receipt = await withTransientRpcRetry(
      () =>
        client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.FINALIZED,
          retries: options.retries,
          interval: options.interval,
          fullTransaction: true,
        } as Parameters<typeof client.waitForTransactionReceipt>[0] & {
          fullTransaction?: boolean;
        }),
      {
        timeoutMs: 60_000,
        onRetry: ({ remainingMs }) =>
          this.notifyRpcWait(onProgress, "finalizing", hashStr, remainingMs),
      }
    );

    const statusName = String(
      (receipt as { statusName?: string }).statusName ?? ""
    ).toUpperCase();
    const resultName = (receipt as { resultName?: string }).resultName;

    if (statusName.includes("CANCEL") || statusName.includes("TIMEOUT")) {
      throw new Error(`Transaction ${statusName.toLowerCase().replace(/_/g, " ")}.`);
    }

    if (!isPendingResultName(resultName) && !isSuccessResultName(resultName)) {
      let errMsg = extractTxErrorMessage(receipt);
      if (!errMsg || errMsg.includes("UserWarning")) {
        try {
          const fullTx = await client.getTransaction({ hash });
          errMsg = extractTxErrorMessage(fullTx) ?? errMsg;
        } catch {
          // keep prior
        }
      }
      if (errMsg) throw new Error(errMsg);
    }

    if (isFailureResultName(resultName)) {
      const errMsg = extractTxErrorMessage(receipt);
      throw new Error(
        errMsg ?? `Transaction failed (${String(resultName)}). Check GenLayer Studio.`
      );
    }

    onProgress?.({ hash: hashStr, stage: "finalized" });
    return { hash: hashStr, receipt } satisfies WriteResult;
  }

  private async write(
    functionName: string,
    args: Array<string | number>,
    value: bigint,
    wait = FAST_TX_WAIT,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    onProgress?.({ stage: "preparing" });
    const client = await this.getWriteClient();
    const hash = await withTransientRpcRetry(
      () =>
        client.writeContract({
          address: this.contractAddress,
          functionName,
          args,
          value,
        }),
      {
        timeoutMs: 60_000,
        onRetry: ({ remainingMs }) =>
          this.notifyRpcWait(onProgress, "preparing", undefined, remainingMs),
      }
    );
    onProgress?.({ hash: String(hash), stage: "submitted" });
    return this.waitForWrite(client, hash, wait, onProgress);
  }

  async getProtocolConfig(): Promise<ProtocolConfig> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_protocol_config",
      args: [],
    });
    return normalizeReadResult<ProtocolConfig>(raw);
  }

  async getAllScholarships(): Promise<ScholarshipView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_all_scholarships",
      args: [],
    });
    const list = normalizeReadResult<ScholarshipView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getScholarship(id: number): Promise<ScholarshipView> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_scholarship",
      args: [id],
    });
    return normalizeReadResult<ScholarshipView>(raw);
  }

  async getAward(id: number): Promise<AwardView> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_award",
      args: [id],
    });
    return normalizeReadResult<AwardView>(raw);
  }

  async getScholarshipAwards(scholarshipId: number): Promise<AwardView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_scholarship_awards",
      args: [scholarshipId],
    });
    const list = normalizeReadResult<AwardView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getAwardProofs(awardId: number): Promise<ProofView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_award_proofs",
      args: [awardId],
    });
    const list = normalizeReadResult<ProofView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getAwardReviews(awardId: number): Promise<EpochReviewView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_award_reviews",
      args: [awardId],
    });
    const list = normalizeReadResult<EpochReviewView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getScholarshipAmendments(scholarshipId: number): Promise<AmendmentView[]> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_scholarship_amendments",
      args: [scholarshipId],
    });
    const list = normalizeReadResult<AmendmentView[]>(raw);
    return Array.isArray(list) ? list : [];
  }

  async getClaim(id: number): Promise<ClaimView> {
    const raw = await this.readClient.readContract({
      address: this.contractAddress,
      functionName: "get_claim",
      args: [id],
    });
    return normalizeReadResult<ClaimView>(raw);
  }

  async createScholarship(
    title: string,
    conditions: string,
    epochSeconds: number,
    amountPerEpochWei: bigint,
    poolWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    const before = (await this.getProtocolConfig()).scholarship_count ?? 0;
    onProgress?.({ stage: "preparing" });
    const client = await this.getWriteClient();
    const hash = await withTransientRpcRetry(
      () =>
        client.writeContract({
          address: this.contractAddress,
          functionName: "create_scholarship",
          args: [title, conditions, epochSeconds, amountPerEpochWei.toString()],
          value: poolWei,
        }),
      {
        timeoutMs: 60_000,
        onRetry: ({ remainingMs }) =>
          this.notifyRpcWait(onProgress, "preparing", undefined, remainingMs),
      }
    );
    onProgress?.({ hash: String(hash), stage: "submitted" });
    const transaction = await this.waitForWrite(client, hash, FAST_TX_WAIT, onProgress);
    for (let i = 0; i < 20; i++) {
      const n = (await this.getProtocolConfig()).scholarship_count ?? 0;
      if (n > before) return { scholarshipId: n - 1, ...transaction };
      await new Promise((r) => setTimeout(r, 1500));
    }
    return { scholarshipId: Math.max(0, before), ...transaction };
  }

  fundScholarship(
    scholarshipId: number,
    valueWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("fund_scholarship", [scholarshipId], valueWei, FAST_TX_WAIT, onProgress);
  }

  awardStudent(
    scholarshipId: number,
    student: string,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("award_student", [scholarshipId, student], 0n, FAST_TX_WAIT, onProgress);
  }

  acceptAward(awardId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("accept_award", [awardId], 0n, FAST_TX_WAIT, onProgress);
  }

  leaveAward(awardId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("leave_award", [awardId], 0n, FAST_TX_WAIT, onProgress);
  }

  submitProof(
    awardId: number,
    notes: string,
    evidenceUrls: string,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "submit_proof",
      [awardId, notes, evidenceUrls],
      0n,
      FAST_TX_WAIT,
      onProgress
    );
  }

  reviewEpoch(awardId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("review_epoch", [awardId], 0n, AI_TX_WAIT, onProgress);
  }

  amendConditions(
    scholarshipId: number,
    newConditions: string,
    reason: string,
    stakeWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "amend_conditions",
      [scholarshipId, newConditions, reason],
      stakeWei,
      FAST_TX_WAIT,
      onProgress
    );
  }

  fileClaim(
    awardId: number,
    reason: string,
    evidence: string,
    evidenceUrls: string,
    stakeWei: bigint,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write(
      "file_claim",
      [awardId, reason, evidence, evidenceUrls],
      stakeWei,
      FAST_TX_WAIT,
      onProgress
    );
  }

  judgeClaim(claimId: number, onProgress?: (progress: TransactionProgress) => void) {
    return this.write("judge_claim", [claimId], 0n, AI_TX_WAIT, onProgress);
  }

  closeScholarship(
    scholarshipId: number,
    onProgress?: (progress: TransactionProgress) => void
  ) {
    return this.write("close_scholarship", [scholarshipId], 0n, FAST_TX_WAIT, onProgress);
  }
}
