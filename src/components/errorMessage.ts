import { useTranslations } from "next-intl";

/** The code a server action threw (see the `errors` namespace in messages/*.json). */
export function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

/** Translates a thrown error code, falling back to the generic message. */
export function useErrorMessage(): (error: unknown) => string {
  const tErrors = useTranslations("errors");
  return (error) => {
    const code = errorCode(error);
    return code && tErrors.has(code) ? tErrors(code) : tErrors("GENERIC");
  };
}
