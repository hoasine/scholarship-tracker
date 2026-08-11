"use client";

import { useCallback, useState } from "react";
import type { TransactionProgress } from "@/lib/contracts/ScholarshipTracker";
import { friendlyTxError, stageLabel } from "@/lib/utils/tx-user";
import { txError, txLoading, txLoadingUpdate, txSuccess } from "@/lib/utils/toast";

export function useTxFeedback() {
  const [progress, setProgressState] = useState<TransactionProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setProgress = useCallback((next: TransactionProgress) => {
    setProgressState(next);
    setErrorMessage(null);
    txLoadingUpdate(next.message ?? `${stageLabel(next.stage)}…`);
  }, []);

  const begin = useCallback((label: string) => {
    setErrorMessage(null);
    setProgressState({ stage: "preparing" });
    txLoading(`${label} — preparing…`);
  }, []);

  const succeed = useCallback((title: string, description?: string) => {
    setProgressState({ stage: "finalized" });
    txSuccess(title, { description });
    window.setTimeout(() => setProgressState(null), 1800);
  }, []);

  const fail = useCallback((title: string, err: unknown) => {
    const description = friendlyTxError(err);
    setErrorMessage(description);
    setProgressState(null);
    txError(title, { description });
  }, []);

  const clear = useCallback(() => {
    setProgressState(null);
    setErrorMessage(null);
  }, []);

  return { progress, errorMessage, setProgress, begin, succeed, fail, clear };
}
