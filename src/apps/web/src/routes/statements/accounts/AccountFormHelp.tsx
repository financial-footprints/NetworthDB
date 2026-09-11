import { HoverPopover } from "@web/components/popover";
import type { ReactNode } from "react";

function helpContent(title: string, children: ReactNode) {
  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </>
  );
}

export function AccountFormRequiredHelp() {
  return (
    <HoverPopover ariaLabel="Required fields help">
      {helpContent(
        "Required fields",
        <p>
          Fields marked with{" "}
          <abbr title="required" className="text-red-600 no-underline">
            *
          </abbr>{" "}
          must be filled in before you can save.
        </p>
      )}
    </HoverPopover>
  );
}

export function StatementPasswordsHelp() {
  return (
    <HoverPopover ariaLabel="Statement password help">
      {helpContent(
        "Statement passwords",
        <>
          <p>Enter the passwords you use to access your statement PDFs.</p>
          <p>
            Banks sometimes change the passwords used to access statement PDFs. When that happens,
            older statements may still need the previous password while the new ones may need the
            new password. Hence, you have the option to provide multiple passwords.
          </p>
        </>
      )}
    </HoverPopover>
  );
}

export function StatementMatchingHelp() {
  return (
    <HoverPopover ariaLabel="Statement Rules help">
      {helpContent(
        "Statement Rules",
        <>
          <p>
            Add one phrase at a time using the input and Add button. These checks run against
            statement text.
          </p>
          <p>
            <span className="font-medium text-slate-900">Must Contain</span>: the statement must
            include at least one of these phrases. Use this to tie a file to the right account, such
            as the last four digits of a card.
          </p>
          <p>
            <span className="font-medium text-slate-900">Must Not Contain</span>: the statement is
            rejected if any of these phrases appear. Use this to exclude the wrong statement type,
            such as an annual summary that is not a monthly bill.
          </p>
          <p>Update both fields to add extra matching rules.</p>
        </>
      )}
    </HoverPopover>
  );
}

export function MailMatchingHelp() {
  return (
    <HoverPopover ariaLabel="Email Rules help">
      {helpContent(
        "Email Rules",
        <>
          <p>
            Add one phrase at a time using the input and Add button. These override bank defaults
            only when filled in.
          </p>
          <p>
            <span className="font-medium text-slate-900">From Addresses</span>: sender address or
            domain fragments (for example, <code>icicibank.com</code>).
          </p>
          <p>
            <span className="font-medium text-slate-900">Email Subjects</span>: phrases that appear
            in the email subject line for statement messages.
          </p>
          <p>
            <span className="font-medium text-slate-900">Email Body Contains</span>: phrases in the
            email body or attachment names used to match this account.
          </p>
        </>
      )}
    </HoverPopover>
  );
}
