import { useFileViewer } from "@web/contexts/FileViewer/Context";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaCopy, FaDownload, FaTimes } from "react-icons/fa";

const COPY_FEEDBACK_MS = 2000;

function formatJsonContent(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function Modal() {
  const { request, closeFileViewer } = useFileViewer();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, []);

  const open = request !== null;
  const title = request?.title ?? "";
  const url = request?.url ?? "";
  const format = request?.format ?? "text";
  const downloadFilename =
    request?.downloadFilename ?? (format === "json" ? "metadata.json" : undefined);
  const canCopy = !loading && !error && textContent !== null;
  const canDownload = canCopy && downloadFilename !== undefined;

  useEffect(() => {
    if (!open) {
      setCopied(false);
      clearCopyTimer();
    }
  }, [open, clearCopyTimer]);

  useEffect(() => {
    return () => {
      clearCopyTimer();
    };
  }, [clearCopyTimer]);

  useEffect(() => {
    if (!open) {
      setTextContent(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTextContent(null);
    setCopied(false);

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new ApiError(response.status, response.statusText);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setTextContent(format === "json" ? formatJsonContent(text) : text);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled && !controller.signal.aborted) {
          setError(errorMessage(fetchError, "Could not load file."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, format, url]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFileViewer();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeFileViewer]);

  async function handleCopy() {
    if (!textContent) return;

    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      clearCopyTimer();
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  function handleDownload() {
    if (!textContent || !downloadFilename) return;

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = downloadFilename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-overlay fixed inset-0 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close viewer"
        onClick={closeFileViewer}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-sm bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!canDownload}
              className="flex size-9 shrink-0 items-center justify-center rounded-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Download file"
            >
              <FaDownload aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!canCopy}
              className="flex h-9 w-14 shrink-0 items-center justify-center rounded-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={copied ? "Copied" : "Copy to clipboard"}
            >
              {copied ? (
                <span className="text-xs font-medium">Copied</span>
              ) : (
                <FaCopy aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={closeFileViewer}
              className="flex size-9 shrink-0 items-center justify-center rounded-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close"
            >
              <FaTimes aria-hidden />
            </button>
          </div>
        </header>
        <div className="min-h-80 flex-1 overflow-auto bg-slate-50">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : error ? (
            <p className="p-6 text-sm text-red-600">{error}</p>
          ) : (
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
              {textContent ?? ""}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
