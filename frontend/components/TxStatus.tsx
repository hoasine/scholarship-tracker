"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { TransactionProgress } from "@/lib/contracts/ScholarshipTracker";
import { STAGE_ORDER, progressCopy } from "@/lib/utils/tx-user";
import { cn } from "@/lib/utils";

export function TxStatus({
  progress,
  errorMessage,
  className,
}: {
  progress: TransactionProgress | null;
  errorMessage?: string | null;
  className?: string;
}) {
  if (!progress && !errorMessage) return null;

  const { title, hint, index } = progressCopy(progress);

  return (
    <div
      className={cn("soft-tile space-y-3 p-4 text-sm", className)}
      role="status"
      aria-live="polite"
    >
      {progress && !errorMessage && (
        <>
          <div className="flex items-center gap-2 font-medium">
            {progress.stage === "finalized" ? (
              <CheckCircle2 className="h-4 w-4 text-mint" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            <span>{title}</span>
          </div>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <ol className="space-y-1.5">
            {STAGE_ORDER.map((stage, i) => {
              const done = index > i || progress.stage === "finalized";
              const active = index === i && progress.stage !== "finalized";
              return (
                <li
                  key={stage}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    done && "text-mint",
                    active && "font-semibold text-foreground",
                    !done && !active && "text-muted-foreground"
                  )}
                >
                  {active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span className="inline-block h-3 w-3 rounded-full border border-border" />
                  )}
                  {stage === "preparing"
                    ? "1. Prepare"
                    : stage === "submitted"
                      ? "2. Submit"
                      : stage === "finalizing"
                        ? "3. Finalize"
                        : "4. Confirmed"}
                </li>
              );
            })}
          </ol>
          {progress.hash && (
            <code className="mt-1 block break-all text-[11px] text-muted-foreground">
              {progress.hash}
            </code>
          )}
        </>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Transaction failed</p>
            <p className="mt-1 text-xs leading-relaxed text-destructive/90">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
