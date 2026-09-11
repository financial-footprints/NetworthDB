import { Skeleton } from "@web/components/loading/Skeleton";

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
