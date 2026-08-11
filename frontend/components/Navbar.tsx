"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountPanel } from "./AccountPanel";
import { Logo, LogoMark } from "./Logo";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-6 md:pt-4">
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 transition-all duration-300 md:px-5",
          isScrolled
            ? "border-border/80 bg-card/85 shadow-[0_18px_40px_-28px_oklch(0.05_0.03_250_/_0.7)] backdrop-blur-xl"
            : "border-transparent bg-card/40 backdrop-blur-md"
        )}
      >
        <Link href="/" className="flex items-center" aria-label="Scholarship Tracker home">
          <LogoMark size="md" className="flex md:hidden" />
          <Logo size="md" className="hidden md:inline-flex" />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full bg-secondary/80 p-1 md:flex">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "gradient-brand text-white shadow-[0_8px_18px_-12px_oklch(0.45_0.12_160_/_0.55)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <AccountPanel />
          <button
            type="button"
            className="rounded-lg border border-border bg-card/80 p-2 md:hidden"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="mx-auto mt-2 flex max-w-7xl flex-col gap-1 rounded-2xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur-xl md:hidden"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              aria-current={
                (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href))
                  ? "page"
                  : undefined
              }
              className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-secondary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
