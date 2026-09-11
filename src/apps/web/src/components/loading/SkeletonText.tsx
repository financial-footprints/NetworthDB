import { Skeleton } from "@web/components/loading/Skeleton";

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
