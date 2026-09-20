type InvalidateAllLists = () => void;

let invalidateAllLists: InvalidateAllLists | null = null;
let clearDetailsCache: (() => void) | null = null;

export function registerAccountCacheHandlers(handlers: {
  invalidateAllLists: InvalidateAllLists;
  clearDetailsCache: () => void;
}): void {
  invalidateAllLists = handlers.invalidateAllLists;
  clearDetailsCache = handlers.clearDetailsCache;
}

export function invalidateAllAccountCaches(): void {
  if (!invalidateAllLists || !clearDetailsCache) {
    return;
  }
  invalidateAllLists();
  clearDetailsCache();
}
