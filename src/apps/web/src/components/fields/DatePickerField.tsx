import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import { FaCalendarAlt } from "react-icons/fa";
import "react-datepicker/dist/react-datepicker.css";
import {
  formatAccountDate,
  maskAccountDateInput,
  maxAccountDate,
  parseAccountDate,
} from "@web/utils/time";
import "@web/assets/styles/date.css";

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  isClearable?: boolean;
  /** Use borderless input styling for EncryptionFieldShell / form-input-shell. */
  embedded?: boolean;
  "aria-label"?: string;
};

const DateInput = forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, ...props }, ref) => <input ref={ref} className={className} {...props} />
);
DateInput.displayName = "DateInput";

export function DatePickerField({
  value,
  onChange,
  className,
  placeholder = "DD-MM-YYYY",
  id,
  isClearable = false,
  embedded = false,
  "aria-label": ariaLabel,
}: DatePickerFieldProps) {
  const selected = parseAccountDate(value);
  const minDate = new Date(1970, 0, 1);
  const inputClassName = [embedded ? "form-input-inner" : "form-input", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={[
        "networth-date-picker-field w-full",
        isClearable ? "networth-date-picker-field--clearable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <DatePicker
        id={id}
        selected={selected}
        value={value}
        onChange={(date: Date | null) => {
          if (date) {
            onChange(formatAccountDate(date));
            return;
          }
          if (isClearable) {
            onChange("");
          }
        }}
        onChangeRaw={(event) => {
          if (event?.target instanceof HTMLInputElement) {
            onChange(maskAccountDateInput(event.target.value));
          }
        }}
        dateFormat="dd-MM-yyyy"
        placeholderText={placeholder}
        customInput={<DateInput className={inputClassName} />}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        minDate={minDate}
        maxDate={maxAccountDate()}
        isClearable={isClearable}
        autoComplete="off"
        showIcon
        toggleCalendarOnIconClick
        icon={<FaCalendarAlt className="size-3.5 text-slate-400" aria-hidden />}
        aria-label={ariaLabel}
        calendarClassName="networth-date-picker-calendar"
        popperClassName="networth-date-picker-popper"
      />
    </div>
  );
}
