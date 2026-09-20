import type { z } from "zod";

export const jsonMedia = <S extends z.ZodType>(schema: S) => ({
  "application/json": { schema },
});

export const jsonBody = <S extends z.ZodType>(schema: S) => ({
  content: jsonMedia(schema),
});

export const optionalJsonBody = <S extends z.ZodType>(schema: S) => ({
  content: jsonMedia(schema),
  required: false as const,
});
