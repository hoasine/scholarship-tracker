"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HandCoins,
  Loader2,
  Search,
} from "lucide-react";
import { CreateScholarshipForm } from "@/components/scholarship/CreateScholarshipForm";
import { ScholarshipCard } from "@/components/scholarship/ScholarshipCard";
import { MyAwardsList } from "@/components/scholarship/MyAwardsList";
import { ContractSetupBanner } from "@/components/ContractSetupBanner";
import {
  useScholarshipClient,
  useScholarships,
} from "@/lib/hooks/useScholarshipTracker";
import { getContractAddress } from "@/lib/genlayer/client";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TABS = [
  { id: "board", label: "Board" },
  { id: "create", label: "Create" },
  { id: "mine", label: "My awards" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PAGE_SIZE = 10;

function tabFromSearch(raw: string | null): TabId {
  if (raw === "create") return "create";
  if (raw === "mine" || raw === "awards") return "mine";
  return "board";
}

export function ScholarshipApp() {
  const search = useSearchParams();
  const [tab, setTab] = useState<TabId>(() => tabFromSearch(search.get("tab")));
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sponsorOnly, setSponsorOnly] = useState(false);
  const { address, isConnected } = useWallet();
  const contract = getContractAddress();
  const client = useScholarshipClient();
  const { data, isLoading, isError, error, refetch } = useScholarships();

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const me = address?.toLowerCase();
    const list = data ? [...data] : [];
    return list
      .filter((s) => {
        if (sponsorOnly && me && s.sponsor.toLowerCase() !== me) return false;
        if (status !== "all" && s.status !== status) return false;
        if (!term) return true;
        return (
          s.title.toLowerCase().includes(term) ||
          s.conditions.toLowerCase().includes(term) ||
          s.sponsor.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.id - a.id);
  }, [data, query, status, sponsorOnly, address]);

  const total = filtered.length;
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const hasMore = (page + 1) * PAGE_SIZE < total;

  const openAwards = filtered.reduce((sum, s) => sum + Number(s.active_award_count || 0), 0);

  const atRiskQueries = useQueries({
    queries: (data ?? []).map((s) => ({
      queryKey: ["scholarship-awards", contract, s.id],
      queryFn: () => client!.getScholarshipAwards(s.id),
      enabled: !!client && Number(s.active_award_count) > 0,
      refetchInterval: 8000,
    })),
  });

  const atRiskCount = useMemo(() => {
    let count = 0;
    for (const q of atRiskQueries) {
      for (const award of q.data ?? []) {
        if (award.status === "AT_RISK") count += 1;
      }
    }
    return count;
  }, [atRiskQueries]);

  const stats = [
    {
      label: sponsorOnly ? "My scholarships" : "Scholarships",
      value: total,
      icon: GraduationCap,
      tint: "gradient-brand",
    },
    { label: "Open awards", value: openAwards, icon: HandCoins, tint: "gradient-mint" },
    {
      label: "At-risk",
      value: atRiskCount,
      icon: AlertTriangle,
      tint: "gradient-amber",
    },
  ];

  return (
    <div className="space-y-8">
      {!contract && <ContractSetupBanner />}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="glass-card flex items-center gap-4 p-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${s.tint}`}
            >
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {s.label}
              </p>
              <p className="mt-0.5 font-display text-2xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="inline-flex gap-1 rounded-full border border-border bg-secondary/80 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all",
              tab === t.id
                ? "gradient-brand text-white shadow-[0_8px_18px_-12px_oklch(0.45_0.12_160_/_0.55)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <CreateScholarshipForm onDone={() => setTab("board")} />
      ) : tab === "mine" ? (
        <MyAwardsList />
      ) : (
        <div className="space-y-4">
          <section className="glass-card space-y-4 p-4" aria-label="Scholarship filters">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="inline-flex rounded-full border border-border bg-secondary/80 p-1"
                role="group"
                aria-label="Scholarship ownership"
              >
                <button
                  type="button"
                  aria-pressed={sponsorOnly}
                  disabled={!isConnected}
                  onClick={() => {
                    setSponsorOnly(true);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm",
                    sponsorOnly && "gradient-brand text-white"
                  )}
                >
                  My scholarships
                </button>
                <button
                  type="button"
                  aria-pressed={!sponsorOnly}
                  onClick={() => {
                    setSponsorOnly(false);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm",
                    !sponsorOnly && "gradient-brand text-white"
                  )}
                >
                  All
                </button>
              </div>
              {!isConnected && (
                <p className="text-xs text-muted-foreground">
                  Connect a wallet to filter your scholarships.
                </p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
              <label className="relative">
                <span className="sr-only">Search scholarships</span>
                <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Search title, conditions, or sponsor"
                  className="pl-9"
                />
              </label>
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
              >
                <option value="all">All statuses</option>
                {["ACTIVE", "AMENDED", "CLOSED"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading scholarships…
            </div>
          )}
          {isError && (
            <div className="glass-card space-y-2 border-destructive/30 p-4 text-sm">
              <p className="font-medium text-destructive">Failed to load scholarships.</p>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
              <button type="button" className="text-primary underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && pageItems.length === 0 && (
            <div className="glass-card p-10 text-center">
              <span className="gradient-brand mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white">
                <GraduationCap className="h-6 w-6" />
              </span>
              <p className="font-display text-lg font-bold">No scholarships yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first scholarship with a funded pool and public conditions.
              </p>
              <button
                type="button"
                onClick={() => setTab("create")}
                className="mt-4 text-sm font-semibold text-primary hover:underline"
              >
                Create scholarship
              </button>
            </div>
          )}
          {pageItems.map((s) => (
            <ScholarshipCard key={s.id} scholarship={s} />
          ))}
          {!isLoading && !isError && total > 0 && (
            <nav className="flex items-center justify-between" aria-label="Scholarship pagination">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1}
                {total > PAGE_SIZE ? ` · ${total} scholarships` : ""}
              </span>
              <Button
                variant="outline"
                disabled={!hasMore}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRight />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
