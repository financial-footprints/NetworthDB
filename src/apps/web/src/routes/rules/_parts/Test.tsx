import { SecondaryButton } from "@web/components/Button";
import { FormRow } from "@web/components/Fields/FormRow";
import { IsoDatePickerField } from "@web/components/Fields/IsoDatePickerField";
import { testRule } from "@web/utils/api/routes/rules";
import type { TestRuleResponse } from "@web/utils/api/routes/rules/types";
import { errorMessage } from "@web/utils/errors";
import { parseRupeeToInteger } from "@web/utils/money";
import { useState } from "react";

type RuleTestPanelProps = {
  ruleId: string;
  accountOptions: { id: string; label: string }[];
  defaultSourceId?: string;
  defaultDestId?: string;
};

export function Test({
  ruleId,
  accountOptions,
  defaultSourceId,
  defaultDestId,
}: RuleTestPanelProps) {
  const [date, setDate] = useState("2024-06-01");
  const [amount, setAmount] = useState("100");
  const [sourceAccountId, setSourceAccountId] = useState(defaultSourceId ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(defaultDestId ?? "");
  const [description, setDescription] = useState("");
  const [testing, setTesting] = useState(false);
  const [matched, setMatched] = useState<boolean | null>(null);
  const [actionSummary, setActionSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    const trimmed = description.trim();
    const minorAmount = readTestMinorAmount(amount);
    if (!sourceAccountId || !destinationAccountId) {
      setError("Choose source and destination accounts.");
      return;
    }
    if (!trimmed) {
      setError("Description is required.");
      return;
    }
    if (minorAmount === null) {
      setError("Amount must be greater than 0.");
      return;
    }

    setTesting(true);
    setError(null);
    setMatched(null);
    setActionSummary(null);
    try {
      const response = await testRule(ruleId, {
        date,
        amount: minorAmount,
        sourceAccountId,
        destinationAccountId,
        description: trimmed,
      });
      applyTestResult(response, setMatched, setActionSummary, setError);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not test rule"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
      <h3 className="text-sm font-medium text-slate-800">Test Against Sample Transaction</h3>
      <p className="text-xs text-slate-600">
        Runs triggers and actions in memory without saving to the ledger.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormRow label="Date">
          <IsoDatePickerField value={date} onChange={setDate} />
        </FormRow>
        <FormRow label="Amount (₹)">
          <input
            type="text"
            className="form-input w-full"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </FormRow>
        <FormRow label="Source Account">
          <select
            className="form-input w-full"
            value={sourceAccountId}
            onChange={(event) => setSourceAccountId(event.target.value)}
          >
            <option value="">Select…</option>
            {accountOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Destination Account">
          <select
            className="form-input w-full"
            value={destinationAccountId}
            onChange={(event) => setDestinationAccountId(event.target.value)}
          >
            <option value="">Select…</option>
            {accountOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </FormRow>
      </div>
      <FormRow label="Description">
        <input
          type="text"
          className="form-input w-full"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormRow>
      <div className="flex flex-wrap items-center gap-3">
        <SecondaryButton type="button" onClick={() => void handleTest()} disabled={testing}>
          {testing ? "Testing…" : "Test"}
        </SecondaryButton>
        {matched !== null ? (
          <span className="text-sm text-slate-700">
            Matched: <strong>{matched ? "yes" : "no"}</strong>
            {actionSummary ? ` — ${actionSummary}` : null}
          </span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function readTestMinorAmount(amount: string): number | null {
  let minorAmount: number;
  try {
    minorAmount = parseRupeeToInteger(amount);
  } catch {
    return null;
  }
  return minorAmount > 0 ? minorAmount : null;
}

function applyTestResult(
  response: TestRuleResponse,
  setMatched: (matched: boolean) => void,
  setActionSummary: (summary: string) => void,
  setError: (error: string) => void
): void {
  setMatched(response.matched);
  if (response.matched) {
    const types = response.actions.map((action) => action.type).join(", ");
    setActionSummary(types || "(no actions)");
  } else {
    setActionSummary("No match");
  }
  if (response.warnings.length > 0) {
    setError(response.warnings.join(", "));
  }
}
