const INSERTS = [
  'description contains ""',
  "amount > ",
  'source account is ""',
  'destination account is ""',
  'either account is ""',
  'category is ""',
  "category is empty",
  'tag is ""',
  'reference contains ""',
  "reference is empty",
  "transaction is spend",
] as const;

type WhenEditorProps = {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
};

export function When({ value, onChange, error }: WhenEditorProps) {
  function insert(snippet: string) {
    if (value.trim().length === 0) {
      onChange(snippet);
      return;
    }
    onChange(`${value.replace(/\s+$/, "")}\n${snippet}`);
  }

  function insertGroup() {
    if (value.trim().length === 0) {
      insert('(\n  description contains ""\n)');
      return;
    }
    insert('and (\n  description contains ""\n)');
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-800">When</p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <textarea
          className="form-input min-h-64 w-full font-mono text-sm"
          spellCheck={false}
          value={value}
          placeholder={'description contains "swiggy"\nand amount > 500'}
          onChange={(event) => onChange(event.target.value)}
        />
        <aside>
          <p className="mb-2 text-xs font-medium text-slate-500">Insert</p>
          <div className="space-y-0.5">
            {INSERTS.map((snippet) => (
              <button
                key={snippet}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                onClick={() => insert(snippet)}
              >
                {snippet}
              </button>
            ))}
            <button
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
              onClick={insertGroup}
            >
              Group
            </button>
          </div>
        </aside>
      </div>
      <p className="text-xs text-slate-500">
        Put and or or between conditions. Parentheses group them.
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
