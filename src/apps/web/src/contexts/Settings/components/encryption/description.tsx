import {
  ENCRYPTION_KIND_GUIDE_ORDER,
  EncryptionKindSymbol,
  encryptionKindGuideItem,
} from "@web/contexts/Settings/components/encryption/Symbol";

export const ENCRYPTION_DESCRIPTION = (
  <>
    <p className="font-semibold text-slate-800">How we store your data</p>
    <ul className="mt-2 list-none space-y-2.5 pl-0">
      {ENCRYPTION_KIND_GUIDE_ORDER.map((kind) => {
        const item = encryptionKindGuideItem(kind);
        return (
          <li key={kind} className="flex gap-2">
            <EncryptionKindSymbol kind={kind} />
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-slate-800">{item.title}</p>
              <p>{item.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  </>
);
