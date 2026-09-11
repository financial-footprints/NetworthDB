import type { ReactNode } from "react";

type StatusViewProps = {
  illustration: string;
  title: string;
  message?: string;
  code?: string;
  actions?: ReactNode;
  fullPage?: boolean;
  variant?: "default" | "loading";
};

export function StatusView({
  illustration,
  title,
  message,
  code,
  actions,
  fullPage = false,
  variant = "default",
}: StatusViewProps): ReactNode {
  const isLoading = variant === "loading";

  const wrapperClass = fullPage
    ? "flex min-h-screen items-center justify-center bg-slate-50 p-6"
    : "flex flex-1 items-center justify-center px-4 py-12";

  return (
    <div
      className={wrapperClass}
      {...(isLoading && {
        role: "status",
        "aria-live": "polite" as const,
        "aria-busy": true,
      })}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-6 p-8 sm:flex-row sm:items-center sm:gap-8 sm:p-10">
          <div className="flex shrink-0 items-center justify-center rounded-sm bg-blue-50/80 p-4">
            <img src={illustration} alt="" aria-hidden className="h-28 w-auto sm:h-32" />
          </div>

          <div className="flex flex-1 flex-col items-center text-center sm:items-start sm:text-left">
            {code && <p className="text-5xl font-bold tracking-tight text-slate-200">{code}</p>}
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
            {message && <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>}
            {isLoading && (
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
              </div>
            )}
            {actions && (
              <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
