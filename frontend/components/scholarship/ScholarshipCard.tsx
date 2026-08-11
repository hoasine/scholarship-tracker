"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  UserPlus,
  Wallet,
} from "lucide-react";
import type { ScholarshipView } from "@/lib/contracts/ScholarshipTracker";
import {
  useAmendConditions,
  useAwardStudent,
  useCloseScholarship,
  useFundScholarship,
  useScholarshipAwards,
} from "@/lib/hooks/useScholarshipTracker";
import { useTxFeedback } from "@/lib/hooks/useTxFeedback";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { formatGen, parseGenToWei, shortAddr } from "@/lib/utils/format";
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
import { AwardPanel } from "@/components/scholarship/AwardPanel";
import { TxStatus } from "@/components/TxStatus";

const MIN_WEI = 10_000_000_000_000_000n;

function toBig(value: number | string | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value);
  return BigInt(Math.trunc(value));
}

function epochsRemaining(pool: number | string, amount: number | string): number {
  try {
    const p = toBig(pool);
    const a = toBig(amount);
    if (a <= 0n) return 0;
    return Number(p / a);
  } catch {
    return 0;
  }
}

function statusChip(status: string) {
  if (status === "AMENDED") return "bg-sky/15 text-sky border-sky/40";
  if (status === "CLOSED") return "bg-secondary text-muted-foreground border-border";
  return "bg-primary/15 text-primary border-primary/30";
}

export function ScholarshipCard({ scholarship }: { scholarship: ScholarshipView }) {
  const { address, isConnected } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const tx = useTxFeedback();

  const [fundOpen, setFundOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState("0.1");
  const [studentAddr, setStudentAddr] = useState("");
  const [newConditions, setNewConditions] = useState(scholarship.conditions);
  const [amendReason, setAmendReason] = useState("");
  const [amendStake, setAmendStake] = useState("0.01");

  const awards = useScholarshipAwards(scholarship.id, true);
  const fund = useFundScholarship();
  const awardStudent = useAwardStudent();
  const amend = useAmendConditions();
  const close = useCloseScholarship();

  const me = address?.toLowerCase();
  const isSponsor = Boolean(me && scholarship.sponsor.toLowerCase() === me);
  const closed = Boolean(scholarship.closed) || scholarship.status === "CLOSED";
  const remaining = epochsRemaining(scholarship.pool_balance, scholarship.amount_per_epoch);

  const canSponsorAct = Boolean(isConnected) && isSponsor && !closed;
  const actionPending =
    fund.isPending || awardStudent.isPending || amend.isPending || close.isPending;

  const onFund = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const valueWei = parseGenToWei(fundAmount);
      if (valueWei < MIN_WEI) throw new Error("Fund amount must be at least 0.01 GEN");
      tx.begin("Funding pool");
      await fund.mutateAsync({
        scholarshipId: scholarship.id,
        valueWei,
        onProgress: tx.setProgress,
      });
      setFundOpen(false);
      tx.succeed("Pool funded", `Added ${fundAmount} GEN to the pool.`);
    } catch (err) {
      tx.fail("Fund failed", err);
    }
  };

  const onAward = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const student = studentAddr.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(student)) {
        throw new Error("Enter a valid 0x student address");
      }
      tx.begin("Awarding student");
      await awardStudent.mutateAsync({
        scholarshipId: scholarship.id,
        student,
        onProgress: tx.setProgress,
      });
      setAwardOpen(false);
      setStudentAddr("");
      tx.succeed("Student awarded", "Offer created — student can accept.");
    } catch (err) {
      tx.fail("Award failed", err);
    }
  };

  const onAmend = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const stakeWei = parseGenToWei(amendStake);
      if (stakeWei < MIN_WEI) throw new Error("Stake must be at least 0.01 GEN");
      if (!newConditions.trim() || !amendReason.trim()) {
        throw new Error("New conditions and reason are required");
      }
      if (
        !window.confirm(
          "Amend conditions with stake? Active students keep their pinned accepted conditions; they may claim if the change is unfair."
        )
      ) {
        return;
      }
      tx.begin("Amending conditions");
      await amend.mutateAsync({
        scholarshipId: scholarship.id,
        newConditions: newConditions.trim(),
        reason: amendReason.trim(),
        stakeWei,
        onProgress: tx.setProgress,
      });
      setAmendOpen(false);
      setAmendReason("");
      tx.succeed("Conditions amended", "New version recorded on-chain.");
    } catch (err) {
      tx.fail("Amend failed", err);
    }
  };

  const onClose = async () => {
    if (Number(scholarship.active_award_count) > 0) {
      tx.fail(
        "Cannot close",
        new Error("Active awards remain. Wait until awards are CUT or LEFT.")
      );
      return;
    }
    if (
      !window.confirm(
        "Close this scholarship and recover remaining pool? This cannot be undone."
      )
    ) {
      return;
    }
    try {
      tx.begin("Closing scholarship");
      await close.mutateAsync({
        scholarshipId: scholarship.id,
        onProgress: tx.setProgress,
      });
      tx.succeed("Scholarship closed", "Remaining pool returned to sponsor.");
    } catch (err) {
      tx.fail("Close failed", err);
    }
  };

  const awardList = useMemo(
    () => [...(awards.data ?? [])].sort((a, b) => b.id - a.id),
    [awards.data]
  );

  return (
    <article className="glass-card brand-card-hover space-y-5 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              #{scholarship.id}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusChip(scholarship.status)}`}
            >
              {scholarship.status}
            </span>
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold">
              v{scholarship.version}
            </span>
            {Number(scholarship.open_claim_count) > 0 && (
              <span className="rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">
                {scholarship.open_claim_count} open claim
                {Number(scholarship.open_claim_count) === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <h3 className="font-display text-xl font-bold">{scholarship.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sponsor {shortAddr(scholarship.sponsor)} · epoch {scholarship.epoch_seconds}s
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-bold text-primary">
            {formatGen(scholarship.pool_balance)} GEN
          </p>
          <p className="text-xs text-muted-foreground">
            pool · {formatGen(scholarship.amount_per_epoch)} / epoch · ~{remaining} left
          </p>
        </div>
      </div>

      <div className="soft-tile p-4">
        <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
          Public conditions
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
          {scholarship.conditions}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="soft-tile px-3 py-2">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Awards
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {scholarship.award_count} total · {scholarship.active_award_count} active
          </p>
        </div>
        <div className="soft-tile px-3 py-2">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Amendments
          </p>
          <p className="mt-0.5 text-sm font-semibold">{scholarship.amendment_count}</p>
        </div>
        <div className="soft-tile px-3 py-2">
          <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Created
          </p>
          <p className="mt-0.5 text-sm">
            {scholarship.created_at
              ? new Date(scholarship.created_at * 1000).toLocaleDateString()
              : "—"}
          </p>
        </div>
      </div>

      {canSponsorAct && (
        <div className="flex flex-wrap gap-2">
          <Dialog open={fundOpen} onOpenChange={setFundOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={actionPending}>
                <Wallet className="h-4 w-4" />
                Fund
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fund scholarship #{scholarship.id}</DialogTitle>
                <DialogDescription>Top up the escrow pool with GEN.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onFund}>
                <div className="space-y-2">
                  <Label htmlFor={`fund-${scholarship.id}`}>Amount (GEN)</Label>
                  <Input
                    id={`fund-${scholarship.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.000000000000000001"
                    required
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={fund.isPending}>
                  {fund.isPending ? "Funding…" : "Confirm fund"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" disabled={actionPending}>
                <UserPlus className="h-4 w-4" />
                Award student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Award a student</DialogTitle>
                <DialogDescription>
                  Creates an OFFERED award. The student must accept to start epochs.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onAward}>
                <div className="space-y-2">
                  <Label htmlFor={`student-${scholarship.id}`}>Student address</Label>
                  <Input
                    id={`student-${scholarship.id}`}
                    required
                    value={studentAddr}
                    onChange={(e) => setStudentAddr(e.target.value)}
                    placeholder="0x…"
                    className="font-mono"
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={awardStudent.isPending}
                >
                  {awardStudent.isPending ? "Awarding…" : "Create offer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={actionPending}>
                Amend
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Amend conditions</DialogTitle>
                <DialogDescription>
                  Requires stake + reason. Students may claim if the change is unfair.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onAmend}>
                <div className="space-y-2">
                  <Label htmlFor={`amend-cond-${scholarship.id}`}>New conditions</Label>
                  <Textarea
                    id={`amend-cond-${scholarship.id}`}
                    required
                    rows={4}
                    value={newConditions}
                    onChange={(e) => setNewConditions(e.target.value)}
                    maxLength={4000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`amend-reason-${scholarship.id}`}>Reason</Label>
                  <Textarea
                    id={`amend-reason-${scholarship.id}`}
                    required
                    rows={2}
                    value={amendReason}
                    onChange={(e) => setAmendReason(e.target.value)}
                    maxLength={1500}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`amend-stake-${scholarship.id}`}>Stake (GEN)</Label>
                  <Input
                    id={`amend-stake-${scholarship.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.000000000000000001"
                    required
                    value={amendStake}
                    onChange={(e) => setAmendStake(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={amend.isPending}>
                  {amend.isPending ? "Amending…" : "Confirm amendment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={onClose} disabled={actionPending}>
            {close.isPending ? "Closing…" : "Close"}
          </Button>
        </div>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-border bg-secondary/70 px-4 py-3 text-left text-sm font-semibold"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        Awards ({awardList.length})
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </button>

      {expanded && (
        <section className="space-y-4" aria-label={`Awards for ${scholarship.title}`}>
          {awards.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading awards…
            </div>
          )}
          {awards.isError && (
            <div role="alert" className="text-sm text-destructive">
              Unable to load awards.{" "}
              <button type="button" className="underline" onClick={() => awards.refetch()}>
                Retry
              </button>
            </div>
          )}
          {!awards.isLoading && awardList.length === 0 && (
            <p className="text-sm text-muted-foreground">No awards yet.</p>
          )}
          {awardList.map((award) => (
            <AwardPanel
              key={award.id}
              award={award}
              scholarship={scholarship}
              defaultExpanded={false}
            />
          ))}
        </section>
      )}

      <TxStatus progress={tx.progress} errorMessage={tx.errorMessage} />
    </article>
  );
}
