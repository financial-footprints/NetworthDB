export function requireNamed<T extends { name: string }>(items: readonly T[], name: string): T {
  const found = items.find((item) => item.name === name);
  if (!found) {
    throw new Error(`expected ${name}`);
  }
  return found;
}
