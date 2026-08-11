"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { WalletProvider } from "@/lib/genlayer/WalletProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2000,
            refetchOnWindowFocus: false,
            retry: 1,
            throwOnError: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>{children}</WalletProvider>
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
        offset="88px"
        toastOptions={{
          classNames: {
            toast: "scholarship-toast",
            title: "scholarship-toast-title",
            description: "scholarship-toast-description",
            closeButton: "scholarship-toast-close",
            loading: "scholarship-toast-loading",
          },
          style: {
            background: "oklch(0.2 0.028 250)",
            border: "1px solid oklch(0.34 0.03 250)",
            color: "oklch(0.93 0.015 230)",
            borderRadius: "0.9rem",
            boxShadow: "0 18px 40px -24px oklch(0.05 0.03 250 / 0.75)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
