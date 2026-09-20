export type Pagination = {
  limit?: number;
  offset?: number;
};

export type ListData<T> = {
  items: T[];
  total: number;
};

export type ValidationDetails = {
  loc: string[];
  msg: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;
  readonly validationDetails?: ValidationDetails[];

  constructor(
    status: number,
    message: string,
    code?: string,
    field?: string,
    validationDetails?: ValidationDetails[]
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.validationDetails = validationDetails;
  }
}
