type FormFieldErrorProps = {
  message?: string;
};

export function FormFieldError({ message }: FormFieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-xs leading-relaxed text-red-600" role="alert">
      {message}
    </p>
  );
}
