import { type ChangeEvent, type DragEvent, useId, useRef, useState } from "react";
import { LuUpload } from "react-icons/lu";

type FileDropzoneProps = {
  id?: string;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  onReject?: (reason: string) => void;
  disabled?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  selectedHint?: string;
  className?: string;
};

function fileMatchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) {
    return true;
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(",").some((token) => {
    const normalized = token.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized.startsWith(".")) {
      return name.endsWith(normalized);
    }
    if (normalized.endsWith("/*")) {
      return type.startsWith(normalized.slice(0, -1));
    }
    return type === normalized;
  });
}

export function FileDropzone({
  id,
  accept,
  value,
  onChange,
  onReject,
  disabled = false,
  emptyTitle = "Drag and drop a file here",
  emptyHint = "or click to browse",
  selectedHint = "Drop another file or click to replace",
  className,
}: FileDropzoneProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(file: File | null) {
    if (!file || disabled) {
      return;
    }
    if (!fileMatchesAccept(file, accept)) {
      onReject?.("Choose a file with an allowed type.");
      return;
    }
    onChange(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (disabled) {
      return;
    }
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  const stateClasses = disabled
    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
    : isDragging
      ? "border-blue-400 bg-blue-50 text-blue-700"
      : value
        ? "border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
        : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50";

  return (
    <label
      htmlFor={inputId}
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center transition ${stateClasses} ${className ?? ""}`.trim()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={handleInputChange}
      />
      <LuUpload className="size-8 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden />
      {value ? (
        <>
          <p className="text-sm font-medium text-slate-900">{value.name}</p>
          <p className="text-xs text-slate-500">{selectedHint}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-800">{emptyTitle}</p>
          <p className="text-xs text-slate-500">{emptyHint}</p>
        </>
      )}
    </label>
  );
}
