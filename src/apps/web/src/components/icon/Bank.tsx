import { IconFI } from "@web/utils/icons";

type BankIconProps = {
  bank: string;
};

export function BankIcon({ bank }: BankIconProps) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-slate-50 ring-1 ring-slate-200">
      <img src={IconFI(bank)} alt="" aria-hidden className="h-7 w-auto max-w-9 object-contain" />
    </div>
  );
}
