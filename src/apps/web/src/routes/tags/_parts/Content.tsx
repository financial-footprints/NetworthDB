import defaultEmptyIllustration from "@web/assets/images/illustrations/empty.svg";
import { ConfirmDeleteButton, IconActionButton, PrimaryButton } from "@web/components/Button";
import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { PageHeading } from "@web/components/Layout/PageHeading";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { StatusView } from "@web/components/Layout/StatusView";
import { Search } from "@web/components/List/Search";
import { Toolbar } from "@web/components/List/Toolbar";
import { useListQuery } from "@web/hooks/query";
import { Modal } from "@web/routes/tags/_parts/Modal";
import { TagsPageSkeleton } from "@web/routes/tags/suspense";
import { deleteTag, fetchTags } from "@web/utils/api/routes/tags";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { errorMessage } from "@web/utils/errors";
import { searchQuery } from "@web/utils/list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LuPencil } from "react-icons/lu";

export function Content() {
  const listQuery = useListQuery(searchQuery);
  const [items, setItems] = useState<TagApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TagApi | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTags({ limit: 200 });
      setItems(response.items);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not load tags"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = listQuery.search.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((row) => row.name.toLowerCase().includes(q));
  }, [items, listQuery.search]);

  const searchActive = listQuery.search.trim().length > 0;
  const showEmptyState = !loading && !error && filtered.length === 0;
  const emptyTitle = searchActive || items.length > 0 ? "No Tags Match" : "No Tags Yet";
  const emptyMessage =
    searchActive || items.length > 0
      ? "Try a different search term."
      : "Create tags to label and filter transactions across your accounts.";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page="Tags" />
      <PageBoundary errorTitle="Could not load tags" onRetry={() => void load()}>
        <PageHeading
          title="Tags"
          action={
            <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
              Add Tag
            </PrimaryButton>
          }
        />
        <Toolbar
          search={
            <Search
              value={listQuery.searchInput}
              placeholder="Search Tags"
              onChange={listQuery.setSearchInput}
            />
          }
        />
        {loading ? <TagsPageSkeleton /> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {showEmptyState ? (
          <StatusView
            illustration={defaultEmptyIllustration}
            title={emptyTitle}
            message={emptyMessage}
            actions={
              !searchActive && items.length === 0 ? (
                <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
                  Add Tag
                </PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tag) => (
                  <tr key={tag.id} className="border-b border-slate-100">
                    <td className="px-4 py-2">{tag.name}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <IconActionButton
                          title="Edit"
                          tone="edit"
                          onClick={() => setEditTarget(tag)}
                        >
                          <LuPencil className="size-4" strokeWidth={1.75} aria-hidden />
                        </IconActionButton>
                        <ConfirmDeleteButton
                          variant="icon"
                          title="Delete"
                          confirmMessage="Delete this tag? It is removed from all transactions."
                          onDelete={async () => {
                            await deleteTag(tag.id);
                            await load();
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBoundary>
      <Modal
        isOpen={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={() => void load()}
      />
      <Modal
        isOpen={editTarget !== null}
        mode="edit"
        tagId={editTarget?.id}
        initialName={editTarget?.name ?? ""}
        onClose={() => setEditTarget(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}
