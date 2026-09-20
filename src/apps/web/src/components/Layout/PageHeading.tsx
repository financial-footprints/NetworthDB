import type { ReactNode } from "react";

type PageHeadingProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeading({ title, description, action }: PageHeadingProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold text-slate-900">{title}</h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="mt-2 text-base leading-relaxed text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
