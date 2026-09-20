import defaultEmptyIllustration from "@web/assets/images/illustrations/empty.svg";
import { PrimaryButton } from "@web/components/Button";
import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { PageHeading } from "@web/components/Layout/PageHeading";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { StatusView } from "@web/components/Layout/StatusView";
import { Search } from "@web/components/List/Search";
import { Toolbar } from "@web/components/List/Toolbar";
import { useListQuery } from "@web/hooks/query";
import { Group } from "@web/routes/categories/_parts/Group";
import { Modal } from "@web/routes/categories/_parts/Modal";
import { buildCategoryTree } from "@web/routes/categories/_parts/tree";
import { CategoriesPageSkeleton } from "@web/routes/categories/suspense";
import { deleteCategory, fetchCategories } from "@web/utils/api/routes/categories";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import { errorMessage } from "@web/utils/errors";
import { searchQuery } from "@web/utils/list";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

export function Content() {
  const listQuery = useListQuery(searchQuery);
  const [items, setItems] = useState<CategoryApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryApi | null>(null);
  const [subParent, setSubParent] = useState<CategoryApi | null>(null);
  const [expansionRevision, setExpansionRevision] = useState(0);
  const [expansionTarget, setExpansionTarget] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCategories({ limit: 200 });
      setItems(response.items);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not load categories"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const search = listQuery.search.trim();
  const tree = useMemo(() => buildCategoryTree(items, search), [items, search]);
  const searchActive = search.length > 0;
  const hasCollapsibleGroups = useMemo(
    () => tree.roots.some((root) => (tree.childrenByParent.get(root.id)?.length ?? 0) > 0),
    [tree]
  );

  function setAllExpanded(expanded: boolean) {
    setExpansionTarget(expanded);
    setExpansionRevision((revision) => revision + 1);
  }

  async function handleDelete(category: CategoryApi) {
    await deleteCategory(category.id);
    await load();
  }

  const searchField = (
    <Search
      value={listQuery.searchInput}
      placeholder="Search Categories"
      onChange={listQuery.setSearchInput}
    />
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page="Categories" />
      <PageBoundary errorTitle="Could not load categories" onRetry={() => void load()}>
        <PageHeading
          title="Categories"
          action={
            <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
              Add Category
            </PrimaryButton>
          }
        />
        <CategoryResults
          loading={loading}
          error={error}
          searchActive={searchActive}
          itemCount={items.length}
          hasCollapsibleGroups={hasCollapsibleGroups}
          rootCount={tree.roots.length}
          searchField={searchField}
          onFoldAll={() => setAllExpanded(false)}
          onUnfoldAll={() => setAllExpanded(true)}
          onCreate={() => setCreateOpen(true)}
        />
        {!loading && !error && tree.roots.length > 0 ? (
          <div className="space-y-3">
            {tree.roots.map((root) => (
              <Group
                key={root.id}
                root={root}
                subcategories={tree.childrenByParent.get(root.id) ?? []}
                forceExpanded={searchActive}
                expansionRevision={expansionRevision}
                expansionTarget={expansionTarget}
                onEdit={setEditTarget}
                onAddSubcategory={setSubParent}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : null}
      </PageBoundary>
      <Modal
        isOpen={createOpen}
        mode="create"
        parentId={null}
        onClose={() => setCreateOpen(false)}
        onSaved={() => void load()}
      />
      <Modal
        isOpen={subParent !== null}
        mode="create"
        parentId={subParent?.id ?? null}
        parentName={subParent?.name}
        onClose={() => setSubParent(null)}
        onSaved={() => void load()}
      />
      <Modal
        isOpen={editTarget !== null}
        mode="edit"
        categoryId={editTarget?.id}
        initialName={editTarget?.name ?? ""}
        onClose={() => setEditTarget(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}

function categoryEmptyCopy(searchActive: boolean, itemCount: number) {
  if (searchActive || itemCount > 0) {
    return {
      title: "No Categories Match",
      message: "Try a different search term.",
      offerCreate: false,
    };
  }
  return {
    title: "No Categories Yet",
    message: "Create categories to classify transactions across your accounts.",
    offerCreate: true,
  };
}

function CategoryResults({
  loading,
  error,
  searchActive,
  itemCount,
  hasCollapsibleGroups,
  rootCount,
  searchField,
  onFoldAll,
  onUnfoldAll,
  onCreate,
}: {
  loading: boolean;
  error: string | null;
  searchActive: boolean;
  itemCount: number;
  hasCollapsibleGroups: boolean;
  rootCount: number;
  searchField: ReactNode;
  onFoldAll: () => void;
  onUnfoldAll: () => void;
  onCreate: () => void;
}) {
  const showBulkExpansion = !loading && !error && hasCollapsibleGroups && !searchActive;
  const showEmptyState = !loading && !error && rootCount === 0;
  const empty = categoryEmptyCopy(searchActive, itemCount);
  return (
    <>
      {showBulkExpansion ? (
        <div className="mb-4">
          <div className="-mb-2">
            <Toolbar search={searchField} />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="text-xs text-slate-500 transition hover:text-slate-700"
              onClick={onFoldAll}
            >
              Fold all
            </button>
            <button
              type="button"
              className="text-xs text-slate-500 transition hover:text-slate-700"
              onClick={onUnfoldAll}
            >
              Unfold all
            </button>
          </div>
        </div>
      ) : (
        <Toolbar search={searchField} />
      )}
      {loading ? <CategoriesPageSkeleton /> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {showEmptyState ? (
        <StatusView
          illustration={defaultEmptyIllustration}
          title={empty.title}
          message={empty.message}
          actions={
            empty.offerCreate ? (
              <PrimaryButton type="button" onClick={onCreate}>
                Add Category
              </PrimaryButton>
            ) : undefined
          }
        />
      ) : null}
    </>
  );
}
