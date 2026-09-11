import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const actionButtonClassName =
  "inline-flex rounded-xs bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900";

type ActionButtonBaseProps = {
  children: ReactNode;
};

type ActionButtonAsButton = ActionButtonBaseProps & {
  onClick: () => void;
};

type ActionButtonAsLink = ActionButtonBaseProps & {
  to: string;
};

type ActionButtonProps = ActionButtonAsButton | ActionButtonAsLink;

export function ActionButton(props: ActionButtonProps) {
  const { children } = props;

  if ("onClick" in props) {
    return (
      <button type="button" onClick={props.onClick} className={actionButtonClassName}>
        {children}
      </button>
    );
  }

  return (
    <Link to={props.to} className={actionButtonClassName}>
      {children}
    </Link>
  );
}
