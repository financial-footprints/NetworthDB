import { ErrorViewContent } from "@web/components/error/ErrorViewContent";

type AppErrorViewProps = {
  error: Error;
  reset: () => void;
};

export function AppErrorView({ error, reset }: AppErrorViewProps) {
  return (
    <ErrorViewContent
      fullPage
      message={error.message || "An unexpected error occurred."}
      onRetry={reset}
    />
  );
}
