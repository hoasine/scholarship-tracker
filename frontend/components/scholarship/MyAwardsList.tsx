"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { GraduationCap, Loader2 } from "lucide-react";
import { AwardPanel } from "@/components/scholarship/AwardPanel";
import {
  useScholarshipClient,
  useScholarships,
} from "@/lib/hooks/useScholarshipTracker";
import { getContractAddress } from "@/lib/genlayer/client";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import type { AwardView, ScholarshipView } from "@/lib/contracts/ScholarshipTracker";

type AwardRow = { award: AwardView; scholarship: ScholarshipView };

export function MyAwardsList() {
  const { address, isConnected } = useWallet();
  const client = useScholarshipClient();
  const { data: scholarships, isLoading, isError, error, refetch } = useScholarships();
  const contract = getContractAddress();

  const awardQueries = useQueries({
    queries: (scholarships ?? []).map((s) => ({
      queryKey: ["scholarship-awards", contract, s.id],
      queryFn: () => client!.getScholarshipAwards(s.id),
      enabled: !!client && !!isConnected && !!address,
      refetchInterval: 8000,
    })),
  });

  const rows = useMemo(() => {
    const me = address?.toLowerCase();
    if (!me || !scholarships) return [] as AwardRow[];
    const out: AwardRow[] = [];
    awardQueries.forEach((q, idx) => {
      const scholarship = scholarships[idx];
      if (!scholarship || !q.data) return;
      for (const award of q.data) {
        if (award.student.toLowerCase() === me) {
          out.push({ award, scholarship });
        }
      }
    });
    return out.sort((a, b) => b.award.id - a.award.id);
  }, [address, scholarships, awardQueries]);

  const loadingAwards = awardQueries.some((q) => q.isLoading);
  const atRisk = rows.filter((r) => r.award.status === "AT_RISK").length;

  if (!isConnected) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="font-display text-lg font-bold">Connect your wallet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          View awards offered to your address and manage proofs, leave, or claims.
        </p>
      </div>
    );
  }

  if (isLoading || loadingAwards) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your awards…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-card space-y-2 border-destructive/30 p-4 text-sm">
        <p className="font-medium text-destructive">Failed to load awards.</p>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <button type="button" className="text-primary underline" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <span className="gradient-brand mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white">
          <GraduationCap className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-bold">No awards yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          When a sponsor awards your address, offers will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {rows.length} award{rows.length === 1 ? "" : "s"}
        {atRisk > 0 ? ` · ${atRisk} at risk` : ""}
      </p>
      {rows.map(({ award, scholarship }) => (
        <div key={award.id} className="glass-card space-y-3 p-4 md:p-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {scholarship.title} · scholarship #{scholarship.id}
            </p>
          </div>
          <AwardPanel award={award} scholarship={scholarship} defaultExpanded />
        </div>
      ))}
    </div>
  );
}
