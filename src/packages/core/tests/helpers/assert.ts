export function firstElement<T>(items: readonly T[], label = "item"): T {
  const item = items[0];
  if (!item) {
    throw new Error(`expected ${label}`);
  }

  return item;
}
