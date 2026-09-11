import type { ReactNode } from "react";

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
