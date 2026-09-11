import { HoverPopover } from "@web/components/popover";
import type { ReactNode } from "react";

type ProfileSectionCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

export function ProfileSectionCard({ title, description, children }: ProfileSectionCardProps) {
  return (
    <section className="overflow-hidden rounded-sm border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {description ? (
            <HoverPopover ariaLabel={`About ${title}`}>{description}</HoverPopover>
          ) : null}
        </div>
      </header>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  );
}
