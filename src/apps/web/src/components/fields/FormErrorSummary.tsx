import { toTitleCase } from "@web/utils/strings";
import { FaExclamationCircle } from "react-icons/fa";

type FormErrorSummaryProps = {
  title?: string;
  messages: string[];
  footnote?: string;
  className?: string;
};

export function FormErrorSummary({
  title = "Error",
  messages,
  footnote,
  className = "",
}: FormErrorSummaryProps) {
  if (messages.length === 0) {
    return null;
  }

  const normalizedTitle = title.replace(/:+$/, "").trim();
  const isSingleMessage = messages.length === 1;

  const formattedMessages = messages.map(toTitleCase);

  return (
    <div
      role="alert"
      className={`flex overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="w-1 shrink-0 bg-red-500" aria-hidden />
      <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3.5 py-3">
        <FaExclamationCircle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
        <div className="min-w-0">
          {isSingleMessage ? (
            <div>
              {normalizedTitle ? (
                <p className="text-sm font-medium text-slate-900">{normalizedTitle}</p>
              ) : null}
              <p
                className={`text-sm leading-relaxed text-slate-600${normalizedTitle ? " mt-0.5" : ""}`}
              >
                {formattedMessages[0]}
              </p>
            </div>
          ) : (
            <>
              {normalizedTitle ? (
                <p className="text-sm font-medium text-slate-900">{normalizedTitle}</p>
              ) : null}
              <ul
                className={`space-y-1 text-sm leading-relaxed text-slate-600${normalizedTitle ? " mt-1.5" : ""}`}
              >
                {formattedMessages.map((message) => (
                  <li key={message} className="flex gap-2">
                    <span className="text-slate-400" aria-hidden>
                      ·
                    </span>
                    <span>{message}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {footnote ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{footnote}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
