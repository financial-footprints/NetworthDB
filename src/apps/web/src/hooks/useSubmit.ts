import { useState } from "react";

/** Tracks busy state around an async click/submit action. */
export function useSubmit(): {
  isSubmitting: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
} {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function run(action: () => Promise<void>): Promise<void> {
    setIsSubmitting(true);
    try {
      await action();
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, run };
}
