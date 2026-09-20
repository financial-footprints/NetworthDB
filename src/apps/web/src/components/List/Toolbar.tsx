import type { ReactNode } from "react";

type ListToolbarProps = {
  search?: ReactNode;
  filters?: ReactNode;
  sort?: ReactNode;
};

export function Toolbar({ search, filters, sort }: ListToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {search}
      {filters}
      {sort}
    </div>
  );
}
