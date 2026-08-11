"use client";

import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TxStatus } from "@/components/TxStatus";
import { useCreateScholarship } from "@/lib/hooks/useScholarshipTracker";
import { useTxFeedback } from "@/lib/hooks/useTxFeedback";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { parseGenToWei } from "@/lib/utils/format";
import { error as toastError } from "@/lib/utils/toast";
import { cn } from "@/lib/utils";

const MIN_WEI = 10_000_000_000_000_000n;

const EPOCH_PRESETS = [
  { id: "demo", label: "60s demo", seconds: 60 },
  { id: "week", label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { id: "month", label: "30 days", seconds: 30 * 24 * 60 * 60 },
] as const;

export function CreateScholarshipForm({ onDone }: { onDone?: () => void }) {
  const { isConnected } = useWallet();
  const create = useCreateScholarship();
  const tx = useTxFeedback();
  const [title, setTitle] = useState("");
  const [conditions, setConditions] = useState("");
  const [epochSeconds, setEpochSeconds] = useState(60);
  const [amount, setAmount] = useState("0.05");
  const [pool, setPool] = useState("0.5");

  const pending = create.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      toastError("Connect your wallet to continue");
      return;
    }
    try {
      if (!title.trim() || !conditions.trim()) {
        throw new Error("Title and conditions are required");
      }
      const amountPerEpochWei = parseGenToWei(amount);
      const poolWei = parseGenToWei(pool);
      if (amountPerEpochWei < MIN_WEI) {
        throw new Error("Amount per epoch must be at least 0.01 GEN");
      }
      if (poolWei < MIN_WEI) {
        throw new Error("Pool must be at least 0.01 GEN");
      }
      if (poolWei < amountPerEpochWei) {
        throw new Error("Pool must be greater than or equal to amount per epoch");
      }
      if (epochSeconds < 60) {
        throw new Error("Epoch must be at least 60 seconds");
      }
      tx.begin("Creating scholarship");
      const result = await create.mutateAsync({
        title: title.trim(),
        conditions: conditions.trim(),
        epochSeconds,
        amountPerEpochWei,
        poolWei,
        onProgress: tx.setProgress,
      });
      tx.succeed(
        "Scholarship created",
        `Scholarship #${result.scholarshipId} is funded on-chain.`
      );
      setTitle("");
      setConditions("");
      onDone?.();
    } catch (err) {
      tx.fail("Unable to create scholarship", err);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card space-y-6 p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="gradient-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            New scholarship
          </p>
          <h2 className="font-display text-xl font-bold">Fund a grant with public conditions</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Escrow GEN in a pool. Students earn per-epoch stipends when AI review PASSes public
            proof.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g. Builder Grant — Q3"
          disabled={!isConnected || pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conditions">Public conditions</Label>
        <Textarea
          id="conditions"
          required
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Publish a public progress report URL each epoch showing milestones completed. Do not require private GPA."
          disabled={!isConnected || pending}
        />
        <p className="text-xs text-muted-foreground">
          Conditions must be publicly verifiable (reports, links). Do not require private GPA or
          school-only grades.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Epoch length</Label>
        <div className="flex flex-wrap gap-2">
          {EPOCH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={!isConnected || pending}
              onClick={() => setEpochSeconds(preset.seconds)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                epochSeconds === preset.seconds
                  ? "gradient-brand border-transparent text-white"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Selected: {epochSeconds}s
          {epochSeconds >= 86400
            ? ` (${Math.round(epochSeconds / 86400)} day${epochSeconds >= 172800 ? "s" : ""})`
            : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount per epoch (GEN)</Label>
          <Input
            id="amount"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            min="0.01"
            step="0.000000000000000001"
            type="number"
            disabled={!isConnected || pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pool">Initial pool (GEN)</Label>
          <Input
            id="pool"
            required
            value={pool}
            onChange={(e) => setPool(e.target.value)}
            inputMode="decimal"
            min="0.01"
            step="0.000000000000000001"
            type="number"
            disabled={!isConnected || pending}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Pool must be ≥ amount per epoch. Minimums are 0.01 GEN. You can fund more later.
      </p>

      <Button type="submit" variant="gradient" className="w-full" disabled={!isConnected || pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <GraduationCap className="mr-2 h-4 w-4" />
            Create and fund scholarship
          </>
        )}
      </Button>
      <TxStatus progress={tx.progress} errorMessage={tx.errorMessage} />
    </form>
  );
}
