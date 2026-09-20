import otherIcon from "@web/assets/images/logo/fiscal_institutions/other.svg";

const iconModules = import.meta.glob("../assets/images/logo/fiscal_institutions/*.{svg,png}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const ICONS: Record<string, string> = {};

for (const [path, url] of Object.entries(iconModules)) {
  const match = path.match(/\/([^/]+)\.(svg|png)$/);
  if (!match) continue;
  const name = match[1].toLowerCase();
  if (name === "other") continue;
  ICONS[name] = url;
}

export function bankIcon(bank: string): string {
  return ICONS[bank.toLowerCase()] ?? otherIcon;
}
