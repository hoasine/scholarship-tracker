"use client";

import { AlertCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getContractAddress } from "@/lib/genlayer/client";

export function ContractSetupBanner() {
  if (getContractAddress()) return null;

  return (
    <Alert className="mb-8 border-amber/50 bg-amber/10">
      <AlertCircle className="h-5 w-5 text-[oklch(0.5_0.12_70)]" />
      <AlertTitle className="text-[oklch(0.38_0.08_70)]">Contract not configured</AlertTitle>
      <AlertDescription className="space-y-2 text-muted-foreground">
        <p>
          Deploy <code className="text-primary">scholarship_tracker.py</code> on GenLayer Studio,
          then create <code className="text-primary">frontend/.env.local</code> with your contract
          address:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs text-foreground">
          {`NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api`}
        </pre>
        <p className="text-sm">
          Copy from <code>.env.example</code>, then restart <code>npm run dev</code>.
        </p>
        <a
          href="https://studio.genlayer.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Open GenLayer Studio <ExternalLink className="h-3 w-3" />
        </a>
      </AlertDescription>
    </Alert>
  );
}
