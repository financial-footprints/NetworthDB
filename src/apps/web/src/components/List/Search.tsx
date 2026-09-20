import { HiOutlineSearch } from "react-icons/hi";

type ListSearchFieldProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function Search({ value, placeholder, onChange }: ListSearchFieldProps) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <HiOutlineSearch
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        className="form-input form-input-leading-icon w-full"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
