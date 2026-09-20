import { ValidationError } from "@ndb/core";

type MultipartBody = Record<string, string | File>;

export function readStringField(body: MultipartBody, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError("This field is required.", { field });
  }

  return value;
}

export function readOptionalStringField(body: MultipartBody, field: string): string | null {
  const value = body[field];
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError("This field has an invalid type.", { field });
  }

  return value;
}

export function readFileField(body: MultipartBody, field: string): File {
  const value = body[field];
  if (!(value instanceof File)) {
    throw new ValidationError("This field is required.", { field });
  }

  return value;
}
