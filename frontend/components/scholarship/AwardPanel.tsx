"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Scale } from "lucide-react";
import type { AwardView, ScholarshipView } from "@/lib/contracts/ScholarshipTracker";
import {
  useAcceptAward,
  useAwardDetails,
  useFileClaim,
  useJudgeClaim,
  useLeaveAward,
  useReviewEpoch,
  useSubmitProof,
} from "@/lib/hooks/useScholarshipTracker";
import { useTxFeedback } from "@/lib/hooks/useTxFeedback";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { formatCountdown, formatGen, parseGenToWei, shortAddr } from "@/lib/utils/format";
import { validateEvidenceUrls } from "@/lib/utils/urls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TxStatus } from "@/components/TxStatus";

const MIN_WEI = 10_000_000_000_000_000n;

function isReviewed(value: boolean | number | string): boolean {
  return value === true || value === 1 || value === "1";
}

function statusChip(status: string) {
  if (status === "AT_RISK") return "bg-amber/15 text-amber border-amber/40";
  if (status === "CUT") return "bg-destructive/15 text-destructive border-destructive/40";
  if (status === "LEFT") return "bg-secondary text-muted-foreground border-border";
  if (status === "OFFERED") return "bg-sky/15 text-sky border-sky/40";
  if (status === "ACTIVE") return "bg-mint/15 text-mint border-mint/40";
  return "bg-primary/15 text-primary border-primary/30";
}

function verdictChip(verdict: string) {
  if (verdict === "PASS") return "bg-mint/15 text-mint border-mint/40";
  if (verdict === "WARN") return "bg-amber/15 text-amber border-amber/40";
  if (verdict === "FAIL") return "bg-destructive/15 text-destructive border-destructive/40";
  if (verdict === "STUDENT_WINS") return "bg-mint/15 text-mint border-mint/40";
  if (verdict === "SPONSOR_WINS") return "bg-sky/15 text-sky border-sky/40";
  if (verdict === "INCONCLUSIVE") return "bg-amber/15 text-amber border-amber/40";
  return "bg-secondary text-muted-foreground border-border";
}

export function AwardPanel({
  award,
  scholarship,
  defaultExpanded = false,
}: {
  award: AwardView;
  scholarship: ScholarshipView;
  defaultExpanded?: boolean;
}) {
  const { address, isConnected } = useWallet();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const tx = useTxFeedback();

  const [proofOpen, setProofOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [urls, setUrls] = useState("");
  const [claimReason, setClaimReason] = useState("");
  const [claimEvidence, setClaimEvidence] = useState("");
  const [claimUrls, setClaimUrls] = useState("");
  const [claimStake, setClaimStake] = useState("0.01");

  const reviewableStatus = award.status === "ACTIVE" || award.status === "AT_RISK";
  const details = useAwardDetails(
    award.id,
    expanded || Boolean(award.has_open_claim) || reviewableStatus
  );
  const accept = useAcceptAward();
  const leave = useLeaveAward();
  const submitProof = useSubmitProof();
  const review = useReviewEpoch();
  const fileClaim = useFileClaim();
  const judge = useJudgeClaim();

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const me = address?.toLowerCase();
  const isStudent = Boolean(me && award.student.toLowerCase() === me);
  const atRisk = award.status === "AT_RISK";

  const proofs = details.data?.proofs ?? [];
  const reviews = details.data?.reviews ?? [];

  const hasUnreviewedProof = useMemo(() => {
    return proofs.some(
      (p) => Number(p.epoch) === Number(award.current_epoch) && !isReviewed(p.reviewed)
    );
  }, [proofs, award.current_epoch]);

  const nowSec = Math.floor(nowMs / 1000);
  const deadlinePassed =
    Number(award.epoch_deadline) > 0 && nowSec > Number(award.epoch_deadline);
  const canReview =
    Boolean(isConnected) &&
    reviewableStatus &&
    !award.has_open_claim &&
    (hasUnreviewedProof || deadlinePassed);

  const canAccept = Boolean(isConnected) && isStudent && award.status === "OFFERED";
  const canLeave =
    Boolean(isConnected) &&
    isStudent &&
    (award.status === "OFFERED" ||
      award.status === "ACTIVE" ||
      award.status === "AT_RISK");
  const canSubmitProof =
    Boolean(isConnected) &&
    isStudent &&
    (award.status === "ACTIVE" || award.status === "AT_RISK") &&
    !award.has_open_claim;
  const canClaim =
    Boolean(isConnected) &&
    isStudent &&
    award.status === "CUT" &&
    !award.has_open_claim;
  const canJudge =
    Boolean(isConnected) && Boolean(award.has_open_claim) && Number(award.open_claim_id) >= 0;

  const actionPending =
    accept.isPending ||
    leave.isPending ||
    submitProof.isPending ||
    review.isPending ||
    fileClaim.isPending ||
    judge.isPending;

  const countdown =
    Number(award.epoch_deadline) > 0 && reviewableStatus
      ? formatCountdown(Number(award.epoch_deadline), nowMs)
      : null;

  const onAccept = async () => {
    try {
      tx.begin("Accepting award");
      await accept.mutateAsync({ awardId: award.id, onProgress: tx.setProgress });
      tx.succeed("Award accepted", `Pinned conditions version v${scholarship.version}.`);
    } catch (err) {
      tx.fail("Accept failed", err);
    }
  };

  const onLeave = async () => {
    const msg = atRisk
      ? "You are AT RISK. Leave this award anyway? This cannot be undone."
      : "Leave this award? This cannot be undone.";
    if (!window.confirm(msg)) return;
    try {
      tx.begin("Leaving award");
      await leave.mutateAsync({ awardId: award.id, onProgress: tx.setProgress });
      tx.succeed("Left award", "Award marked LEFT.");
    } catch (err) {
      tx.fail("Leave failed", err);
    }
  };

  const onProof = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const evidenceUrls = validateEvidenceUrls(urls);
      if (!notes.trim()) throw new Error("Proof notes are required");
      tx.begin("Submitting proof");
      await submitProof.mutateAsync({
        awardId: award.id,
        notes: notes.trim(),
        evidenceUrls,
        onProgress: tx.setProgress,
      });
      setProofOpen(false);
      setNotes("");
      setUrls("");
      tx.succeed("Proof submitted", "Anyone can trigger review when ready.");
    } catch (err) {
      tx.fail("Submit proof failed", err);
    }
  };

  const onReview = async () => {
    if (atRisk) {
      if (
        !window.confirm(
          "This award is AT RISK. One more failed review may cut funding. Trigger review anyway?"
        )
      ) {
        return;
      }
    }
    try {
      tx.begin("Reviewing epoch");
      await review.mutateAsync({ awardId: award.id, onProgress: tx.setProgress });
      tx.succeed("Epoch reviewed", "AI validators returned a verdict.");
    } catch (err) {
      tx.fail("Review failed", err);
    }
  };

  const onClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const stakeWei = parseGenToWei(claimStake);
      if (stakeWei < MIN_WEI) throw new Error("Stake must be at least 0.01 GEN");
      const evidenceUrls = validateEvidenceUrls(claimUrls);
      if (!claimReason.trim()) throw new Error("Claim reason is required");
      if (
        !window.confirm(
          "File an unfair-cut claim with stake? AI validators will judge the case."
        )
      ) {
        return;
      }
      tx.begin("Filing claim");
      await fileClaim.mutateAsync({
        awardId: award.id,
        reason: claimReason.trim(),
        evidence: claimEvidence.trim(),
        evidenceUrls,
        stakeWei,
        onProgress: tx.setProgress,
      });
      setClaimOpen(false);
      setClaimReason("");
      setClaimEvidence("");
      setClaimUrls("");
      tx.succeed("Claim filed", "Anyone can trigger AI judgment next.");
    } catch (err) {
      tx.fail("Claim failed", err);
    }
  };

  const onJudge = async () => {
    try {
      tx.begin("Judging claim");
      await judge.mutateAsync({
        claimId: award.open_claim_id,
        onProgress: tx.setProgress,
      });
      tx.succeed("Claim judged", "AI consensus settled the dispute.");
    } catch (err) {
      tx.fail("Judgment failed", err);
    }
  };

  return (
    <article className="space-y-4 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold">
              Award #{award.id}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusChip(award.status)}`}
            >
              {award.status}
            </span>
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs">
              Epoch {award.current_epoch}
            </span>
            {award.has_open_claim && (
              <span className="rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">
                Claim open
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Student {shortAddr(award.student)} · released {formatGen(award.total_released)} GEN ·
            warns {award.warn_count}
          </p>
          {countdown && (
            <p className="mt-1 text-xs font-medium text-primary">
              Epoch deadline: {countdown}
              {deadlinePassed ? " (passed)" : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          History
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {atRisk && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>One more failed review may cut funding</p>
        </div>
      )}

      {canAccept && (
        <div className="soft-tile space-y-2 p-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Pinned conditions on accept (v{scholarship.version})
          </p>
          <p className="whitespace-pre-wrap text-sm">{scholarship.conditions}</p>
          <Button variant="gradient" size="sm" onClick={onAccept} disabled={actionPending}>
            {accept.isPending ? "Accepting…" : "Accept award"}
          </Button>
        </div>
      )}

      {award.accepted_conditions && (
        <div className="soft-tile p-3">
          <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            Accepted conditions · v{award.accepted_conditions_version}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{award.accepted_conditions}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canSubmitProof && (
          <Dialog open={proofOpen} onOpenChange={setProofOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm" disabled={actionPending}>
                Submit proof
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit epoch proof</DialogTitle>
                <DialogDescription>
                  Public http(s) evidence only — no localhost or private URLs.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onProof}>
                <div className="space-y-2">
                  <Label htmlFor={`notes-${award.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${award.id}`}
                    required
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={2000}
                    placeholder="What progress did you make this epoch?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`urls-${award.id}`}>Evidence URLs</Label>
                  <Input
                    id={`urls-${award.id}`}
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                    placeholder="https://… (comma-separated)"
                    maxLength={2000}
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={submitProof.isPending}
                >
                  {submitProof.isPending ? "Submitting…" : "Submit proof"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {canLeave && (
          <Button variant="outline" size="sm" onClick={onLeave} disabled={actionPending}>
            {leave.isPending ? "Leaving…" : "Leave"}
          </Button>
        )}

        {canClaim && (
          <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" size="sm" disabled={actionPending}>
                <Scale className="h-3.5 w-3.5" />
                Claim if CUT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>File unfair-cut claim</DialogTitle>
                <DialogDescription>
                  Stake GEN. AI validators decide if the cut was unfair.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onClaim}>
                <div className="space-y-2">
                  <Label htmlFor={`claim-reason-${award.id}`}>Reason</Label>
                  <Textarea
                    id={`claim-reason-${award.id}`}
                    required
                    rows={3}
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`claim-evidence-${award.id}`}>Evidence notes</Label>
                  <Textarea
                    id={`claim-evidence-${award.id}`}
                    rows={3}
                    value={claimEvidence}
                    onChange={(e) => setClaimEvidence(e.target.value)}
                    maxLength={3000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`claim-urls-${award.id}`}>Evidence URLs</Label>
                  <Input
                    id={`claim-urls-${award.id}`}
                    value={claimUrls}
                    onChange={(e) => setClaimUrls(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`claim-stake-${award.id}`}>Stake (GEN)</Label>
                  <Input
                    id={`claim-stake-${award.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.000000000000000001"
                    required
                    value={claimStake}
                    onChange={(e) => setClaimStake(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={fileClaim.isPending}
                >
                  {fileClaim.isPending ? "Filing…" : "Stake and file claim"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onReview}
          disabled={!canReview || actionPending}
          title={
            !canReview
              ? "Disabled until an unreviewed proof exists or the epoch deadline has passed"
              : undefined
          }
        >
          {review.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reviewing…
            </>
          ) : (
            "Review epoch"
          )}
        </Button>

        {canJudge && (
          <Button variant="gradient" size="sm" onClick={onJudge} disabled={actionPending}>
            {judge.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Judging…
              </>
            ) : (
              <>
                <Scale className="h-3.5 w-3.5" />
                Judge claim
              </>
            )}
          </Button>
        )}
      </div>

      {expanded && (
        <section className="space-y-4 border-t border-border pt-4">
          {details.isLoading && (
            <p className="text-sm text-muted-foreground">Loading proofs & reviews…</p>
          )}
          {details.isError && (
            <div role="alert" className="text-sm text-destructive">
              Unable to load history.{" "}
              <button type="button" className="underline" onClick={() => details.refetch()}>
                Retry
              </button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Proofs ({proofs.length})
            </p>
            {proofs.length === 0 && (
              <p className="text-sm text-muted-foreground">No proofs yet.</p>
            )}
            {[...proofs]
              .sort((a, b) => b.id - a.id)
              .map((p) => (
                <article key={p.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold">
                      Proof #{p.id} · epoch {p.epoch}
                      {isReviewed(p.reviewed) ? " · reviewed" : " · pending"}
                    </span>
                    <time className="text-muted-foreground">
                      {p.submitted_at ? new Date(p.submitted_at * 1000).toLocaleString() : "—"}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{p.notes}</p>
                  {p.evidence_urls && (
                    <p className="mt-1 break-all text-xs text-primary">{p.evidence_urls}</p>
                  )}
                </article>
              ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Reviews ({reviews.length})
            </p>
            {reviews.length === 0 && (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            )}
            {[...reviews]
              .sort((a, b) => b.id - a.id)
              .map((r) => (
                <article key={r.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold">
                      Review #{r.id} · epoch {r.epoch}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${verdictChip(r.verdict)}`}
                    >
                      {r.verdict || "—"}
                    </span>
                    {r.late_submission ? (
                      <span className="text-xs text-amber">late</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      +{formatGen(r.amount_released)} GEN · conf {r.confidence}/10
                    </span>
                  </div>
                  {r.reasoning && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {r.reasoning}
                    </p>
                  )}
                </article>
              ))}
          </div>
        </section>
      )}

      <TxStatus progress={tx.progress} errorMessage={tx.errorMessage} />
    </article>
  );
}
