"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { getContractAddress, getStudioUrl, ensureGenLayerNetwork } from "@/lib/genlayer/client";
import {
  ScholarshipTrackerClient,
  type TransactionProgress,
} from "@/lib/contracts/ScholarshipTracker";

export function useScholarshipClient() {
  const { address } = useWallet();
  const contract = getContractAddress();
  return useMemo(() => {
    if (!contract) return null;
    return new ScholarshipTrackerClient(contract, address, getStudioUrl());
  }, [contract, address]);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["scholarships"] }),
      qc.invalidateQueries({ queryKey: ["scholarship"] }),
      qc.invalidateQueries({ queryKey: ["scholarship-awards"] }),
      qc.invalidateQueries({ queryKey: ["award"] }),
      qc.invalidateQueries({ queryKey: ["award-details"] }),
      qc.invalidateQueries({ queryKey: ["scholarship-amendments"] }),
    ]);
}

export function useScholarships() {
  const client = useScholarshipClient();
  return useQuery({
    queryKey: ["scholarships", getContractAddress()],
    queryFn: async () => {
      if (!client) return [];
      const list = await client.getAllScholarships();
      return [...list].sort((a, b) => b.id - a.id);
    },
    enabled: !!client,
    refetchInterval: 8000,
  });
}

export function useScholarshipAwards(scholarshipId: number, enabled = true) {
  const client = useScholarshipClient();
  return useQuery({
    queryKey: ["scholarship-awards", getContractAddress(), scholarshipId],
    queryFn: () => client!.getScholarshipAwards(scholarshipId),
    enabled: !!client && enabled && scholarshipId >= 0,
    refetchInterval: 8000,
  });
}

export function useAwardDetails(awardId: number, enabled = true) {
  const client = useScholarshipClient();
  return useQuery({
    queryKey: ["award-details", getContractAddress(), awardId],
    queryFn: async () => {
      if (!client) return { proofs: [], reviews: [] };
      const [proofs, reviews] = await Promise.all([
        client.getAwardProofs(awardId),
        client.getAwardReviews(awardId),
      ]);
      return { proofs, reviews };
    },
    enabled: !!client && enabled && awardId >= 0,
    refetchInterval: 8000,
  });
}

export function useScholarshipAmendments(scholarshipId: number, enabled = true) {
  const client = useScholarshipClient();
  return useQuery({
    queryKey: ["scholarship-amendments", getContractAddress(), scholarshipId],
    queryFn: () => client!.getScholarshipAmendments(scholarshipId),
    enabled: !!client && enabled && scholarshipId >= 0,
  });
}

export function useProtocolConfig() {
  const client = useScholarshipClient();
  return useQuery({
    queryKey: ["scholarship-tracker-config", getContractAddress()],
    queryFn: () => client!.getProtocolConfig(),
    enabled: !!client,
    staleTime: 60_000,
  });
}

type ProgressInput = { onProgress?: (progress: TransactionProgress) => void };

export function useCreateScholarship() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: {
        title: string;
        conditions: string;
        epochSeconds: number;
        amountPerEpochWei: bigint;
        poolWei: bigint;
      } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.createScholarship(
        input.title,
        input.conditions,
        input.epochSeconds,
        input.amountPerEpochWei,
        input.poolWei,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useFundScholarship() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: { scholarshipId: number; valueWei: bigint } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.fundScholarship(input.scholarshipId, input.valueWei, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useAwardStudent() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: { scholarshipId: number; student: string } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.awardStudent(input.scholarshipId, input.student, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useAcceptAward() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { awardId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.acceptAward(input.awardId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useLeaveAward() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { awardId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.leaveAward(input.awardId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useSubmitProof() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: { awardId: number; notes: string; evidenceUrls: string } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.submitProof(
        input.awardId,
        input.notes,
        input.evidenceUrls,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useReviewEpoch() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { awardId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.reviewEpoch(input.awardId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useAmendConditions() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: {
        scholarshipId: number;
        newConditions: string;
        reason: string;
        isMaterial: boolean;
        stakeWei: bigint;
      } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.amendConditions(
        input.scholarshipId,
        input.newConditions,
        input.reason,
        input.isMaterial,
        input.stakeWei,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useFileClaim() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: {
        awardId: number;
        reason: string;
        evidence: string;
        evidenceUrls: string;
        stakeWei: bigint;
      } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.fileClaim(
        input.awardId,
        input.reason,
        input.evidence,
        input.evidenceUrls,
        input.stakeWei,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useRespondToClaim() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: {
        claimId: number;
        evidence: string;
        evidenceUrls: string;
      } & ProgressInput
    ) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.respondToClaim(
        input.claimId,
        input.evidence,
        input.evidenceUrls,
        input.onProgress
      );
    },
    onSuccess: invalidate,
  });
}

export function useJudgeClaim() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { claimId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.judgeClaim(input.claimId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}

export function useCloseScholarship() {
  const client = useScholarshipClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { scholarshipId: number } & ProgressInput) => {
      if (!client) throw new Error("Contract address not set");
      await ensureGenLayerNetwork();
      return client.closeScholarship(input.scholarshipId, input.onProgress);
    },
    onSuccess: invalidate,
  });
}
