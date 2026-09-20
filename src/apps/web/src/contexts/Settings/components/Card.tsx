import { Hover } from "@web/components/Popover/Hover";
import type { ReactNode } from "react";

type ProfileSectionCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

export function Card({ title, description, children }: ProfileSectionCardProps) {
  return (
    <section className="overflow-hidden rounded-sm border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {description ? <Hover ariaLabel={`About ${title}`}>{description}</Hover> : null}
        </div>
      </header>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  );
}
