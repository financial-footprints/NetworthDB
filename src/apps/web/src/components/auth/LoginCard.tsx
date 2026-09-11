import { BrandLogo } from "@web/components/brand/BrandLogo";
import type { ReactNode } from "react";

const LOGIN_CARD_BASE_CLASS_NAME =
  "flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:flex-row";

function LoginLogoColumn() {
  return (
    <div className="flex self-stretch items-center justify-center border-b border-slate-100 bg-slate-50/60 p-8 sm:w-56 sm:border-b-0 sm:border-r md:w-64">
      <BrandLogo size="fill" className="max-h-48 max-w-full" />
    </div>
  );
}

type LoginCardProps = {
  size: "fixed" | "content";
  children: ReactNode;
};

export function LoginCard({ size, children }: LoginCardProps) {
  const cardClassName =
    size === "fixed" ? `${LOGIN_CARD_BASE_CLASS_NAME} h-[16.75rem]` : LOGIN_CARD_BASE_CLASS_NAME;

  const contentClassName =
    size === "content"
      ? "flex min-h-0 flex-1 flex-col overflow-y-auto p-8 sm:min-h-[28rem]"
      : "flex min-h-0 flex-1 flex-col overflow-hidden p-8";

  return (
    <div className={cardClassName}>
      <LoginLogoColumn />
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

function LoginFormSkeletonRow() {
  return (
    <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[140px_1fr] sm:gap-4">
      <div className="h-4 w-20 animate-pulse rounded-sm bg-slate-100" />
      <div className="h-10 animate-pulse rounded-sm bg-slate-100" />
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <LoginFormSkeletonRow />
      <LoginFormSkeletonRow />
      <div className="h-10 animate-pulse rounded-sm bg-[#1a5fb4]/20" />
    </div>
  );
}

export function LoginCardSkeleton() {
  return (
    <LoginCard size="fixed">
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        <LoginFormSkeleton />
      </div>
    </LoginCard>
  );
}
