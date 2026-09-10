export type DomainErrorCode =
  | "not_found"
  | "conflict"
  | "invalid_input"
  | "unauthorized"
  | "internal";

export type DomainError = {
  code: DomainErrorCode;
  message: string;
};
