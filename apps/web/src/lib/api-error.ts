import { z } from "zod";

const ErrorBodySchema = z.object({ error: z.string() });

/** The `{ error }` message an API route sent with a failed response, or `fallback`. */
const readApiError = async (response: Response, fallback: string): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  const parsed = ErrorBodySchema.safeParse(body);

  return parsed.success ? parsed.data.error : fallback;
};

export { readApiError };
