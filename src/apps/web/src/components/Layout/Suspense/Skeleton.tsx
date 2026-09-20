import type { ReactNode } from "react";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div aria-hidden className={`animate-pulse rounded-sm bg-slate-200 ${className}`.trim()} />
  );
}

const CIRCLE_SIZE = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

type SkeletonCircleProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function SkeletonCircle({ size = "md", className = "" }: SkeletonCircleProps) {
  return <Skeleton className={`rounded-full ${CIRCLE_SIZE[size]} ${className}`.trim()} />;
}

type SkeletonStatusProps = {
  label?: string;
  children: ReactNode;
};

export function SkeletonStatus({ label = "Loading page content", children }: SkeletonStatusProps) {
  return (
    <output aria-busy="true" aria-label={label}>
      {children}
    </output>
  );
}

const TEXT_WIDTH = {
  sm: "w-16",
  md: "w-32",
  lg: "w-48",
  xl: "w-64",
  full: "w-full",
} as const;

type SkeletonTextProps = {
  size?: keyof typeof TEXT_WIDTH;
  className?: string;
};

export function SkeletonText({ size = "md", className = "" }: SkeletonTextProps) {
  return <Skeleton className={`h-4 ${TEXT_WIDTH[size]} ${className}`.trim()} />;
}
