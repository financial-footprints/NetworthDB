import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { useState } from "react";

type RecoveryCodesDisplayProps = {
  codes: string[];
  onComplete: () => void;
};

export function RecoveryCodesDisplay({ codes, onComplete }: RecoveryCodesDisplayProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const codesText = codes.join("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codesText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function handleDownload() {
    const blob = new Blob([codesText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <li
            key={code}
            className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800"
          >
            {code}
          </li>
        ))}
      </ul>

      {copyStatus === "failed" ? (
        <p className="text-sm text-red-700" role="alert">
          Could not copy to clipboard. Download the file instead.
        </p>
      ) : null}

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5"
        />
        <span>I have saved these recovery codes</span>
      </label>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SecondaryButton type="button" onClick={() => void handleCopy()}>
            {copyStatus === "copied" ? "Copied" : "Copy All"}
          </SecondaryButton>
          <SecondaryButton type="button" onClick={handleDownload}>
            Download
          </SecondaryButton>
        </div>
        <PrimaryButton type="button" disabled={!acknowledged} onClick={onComplete}>
          Done
        </PrimaryButton>
      </div>
    </div>
  );
}
