/**
 * Scholarship Tracker logo — grant/medal mark with navy/teal gradient.
 */

import React from "react";

export type LogoVariant = "full" | "mark" | "wordmark";
export type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const sizeMap = {
  sm: { box: "h-7 w-7", icon: "h-4 w-4", text: "text-base" },
  md: { box: "h-9 w-9", icon: "h-5 w-5", text: "text-lg" },
  lg: { box: "h-11 w-11", icon: "h-6 w-6", text: "text-2xl" },
};

function GrantMark({ size = "md" }: { size?: LogoSize }) {
  const { box, icon } = sizeMap[size];
  return (
    <span
      className={`gradient-brand inline-flex items-center justify-center rounded-xl text-white shadow-[0_8px_20px_-10px_oklch(0.45_0.12_160_/_0.7)] ${box}`}
    >
      <svg
        className={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Scholarship Tracker"
      >
        {/* Ribbon / grant medal */}
        <circle cx="12" cy="9" r="4.5" />
        <path d="M8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5" />
        <path d="M10 8.5h4" opacity="0.9" />
      </svg>
    </span>
  );
}

function Wordmark({ size = "md" }: { size?: LogoSize }) {
  const { text } = sizeMap[size];
  return (
    <span
      className={`font-display font-bold tracking-tight text-foreground ${text}`}
      style={{ letterSpacing: "-0.03em" }}
    >
      Scholarship <span className="text-gradient">Tracker</span>
    </span>
  );
}

export function Logo({ variant = "full", size = "md", className = "" }: LogoProps) {
  if (variant === "mark") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <GrantMark size={size} />
      </span>
    );
  }

  if (variant === "wordmark") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Wordmark size={size} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <GrantMark size={size} />
      <Wordmark size={size} />
    </span>
  );
}

export function LogoFull(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="full" />;
}

export function LogoMark(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="mark" />;
}

export function LogoWordmark(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="wordmark" />;
}
