import type { ReactNode } from "react";

type FormFieldLabelProps = {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
};

export function FormFieldLabel({ children, htmlFor, required = false }: FormFieldLabelProps) {
  const content = (
    <>
      {children}
      {required ? (
        <abbr title="required" className="ml-0.5 text-red-600 no-underline">
          *
        </abbr>
      ) : null}
    </>
  );

  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {content}
      </label>
    );
  }

  return <span className="text-sm font-medium text-slate-700">{content}</span>;
}
