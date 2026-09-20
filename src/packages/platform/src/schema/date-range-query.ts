import { compareIsoDateStrings, isoDateFieldSchema } from "@platform/schema/iso-date";
import { z } from "zod";

export type OptionalIsoDateRange = {
  from?: string;
  to?: string;
};

export function optionalIsoDateRangeObjectSchema(invalidDateMessage: string) {
  const isoField = isoDateFieldSchema(invalidDateMessage);
  return z.object({
    from: isoField.optional(),
    to: isoField.optional(),
  });
}

export function withOptionalIsoDateRangeRefine<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  invalidRangeMessage = "Date range is invalid."
) {
  return schema.superRefine((value, ctx) => {
    const { from, to } = value as OptionalIsoDateRange;
    if ((from === undefined) !== (to === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Both from and to are required, or omit both for all dates.",
      });
      return;
    }
    if (from !== undefined && to !== undefined && compareIsoDateStrings(from, to) > 0) {
      ctx.addIssue({
        code: "custom",
        message: invalidRangeMessage,
      });
    }
  });
}

export function optionalIsoDateRangeQuerySchema(
  invalidDateMessage: string,
  invalidRangeMessage = "Date range is invalid."
) {
  return withOptionalIsoDateRangeRefine(
    optionalIsoDateRangeObjectSchema(invalidDateMessage),
    invalidRangeMessage
  );
}
