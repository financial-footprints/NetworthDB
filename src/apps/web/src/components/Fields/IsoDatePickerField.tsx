import { DatePickerField } from "@web/components/Fields/DatePickerField";
import { accountDateToIso, isoToAccountDate } from "@web/utils/active-period";

type IsoDatePickerFieldProps = {
  value: string;
  onChange: (isoValue: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  isClearable?: boolean;
  embedded?: boolean;
  "aria-label"?: string;
};

export function IsoDatePickerField({ value, onChange, ...rest }: IsoDatePickerFieldProps) {
  const accountDate = value.trim() ? isoToAccountDate(value) : "";

  return (
    <DatePickerField
      {...rest}
      value={accountDate}
      onChange={(next) => {
        if (!next.trim()) {
          onChange("");
          return;
        }
        onChange(accountDateToIso(next));
      }}
    />
  );
}
