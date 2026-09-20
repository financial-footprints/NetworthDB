import type { AriaAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type PrimaryButtonBaseProps = {
  children: ReactNode;
};

type PrimaryButtonAsButton = PrimaryButtonBaseProps & {
  onClick?: () => void;
  disabled?: boolean;
  "aria-busy"?: AriaAttributes["aria-busy"];
  type?: "button" | "submit" | "reset";
  form?: string;
};

type PrimaryButtonAsLink = PrimaryButtonBaseProps & {
  to: string;
};

type PrimaryButtonProps = PrimaryButtonAsButton | PrimaryButtonAsLink;

export function PrimaryButton(props: PrimaryButtonProps) {
  const { children } = props;

  if ("to" in props) {
    return (
      <Link to={props.to} className="btn-primary">
        {children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      form={props.form}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-busy={props["aria-busy"]}
      className="btn-primary"
    >
      {children}
    </button>
  );
}
