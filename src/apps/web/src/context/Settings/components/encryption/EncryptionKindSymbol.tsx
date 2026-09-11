import type { EncryptionFieldKind } from "@web/utils/crypto/types";
import { LuEye, LuFingerprint, LuLock, LuShield } from "react-icons/lu";

type KindDisplay = {
  Icon: typeof LuLock;
  symbolClassName: string;
  title: string;
  body: string;
};

const KIND_DISPLAY: Record<EncryptionFieldKind, KindDisplay> = {
  e2ee: {
    Icon: LuLock,
    symbolClassName: "bg-green-100 text-green-700",
    title: "E2E Encrypted",
    body: "Some identifiable data is encrypted before it reaches us. Only your devices can read it. Not even our servers.",
  },
  server_hashed: {
    Icon: LuFingerprint,
    symbolClassName: "bg-blue-100 text-blue-700",
    title: "Hashed",
    body: "For some fields we never keep the real value. We only store enough to check what you enter later, such as a recovery email fingerprint.",
  },
  server_encrypted: {
    Icon: LuShield,
    symbolClassName: "bg-yellow-100 text-yellow-800",
    title: "Server Encrypted",
    body: "Other sensitive data is encrypted on our servers to reduce harm from leaks. It is not protected by your personal vault key.",
  },
  server_plain: {
    Icon: LuEye,
    symbolClassName: "bg-red-100 text-red-700",
    title: "No Encryption",
    body: "Some information is stored as-is because the app must read it directly, such as your username.",
  },
};

export const ENCRYPTION_KIND_GUIDE_ORDER: EncryptionFieldKind[] = [
  "e2ee",
  "server_hashed",
  "server_encrypted",
  "server_plain",
];

type EncryptionKindSymbolProps = {
  kind: EncryptionFieldKind;
};

export function EncryptionKindSymbol({ kind }: EncryptionKindSymbolProps) {
  const { Icon, symbolClassName } = KIND_DISPLAY[kind];

  return (
    <span
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-sm ${symbolClassName}`}
      aria-hidden
    >
      <Icon className="size-3" strokeWidth={2} />
    </span>
  );
}

export function encryptionKindGuideItem(kind: EncryptionFieldKind): KindDisplay {
  return KIND_DISPLAY[kind];
}
