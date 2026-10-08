/** Client requests remain bounded; a provider cooldown stops the remaining dates. */
export class TopicCooldownError extends Error {
  constructor(message: string, readonly retryAfter: string | null) {
    super(message);
    this.name = "TopicCooldownError";
  }
}
export async function settleTopicDates<T>(dates: readonly string[], load: (date: string) => Promise<T>, stopAfter?: (value: T) => TopicCooldownError | null): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let stop: unknown;
  for (const date of dates) {
    if (stop) { results.push({ status: "rejected", reason: stop }); continue; }
    try {
      const value = await load(date);
      stop = stopAfter?.(value);
      results.push({ status: "fulfilled", value });
    }
    catch (reason) {
      results.push({ status: "rejected", reason });
      if (reason instanceof TopicCooldownError || (reason instanceof Error && reason.name === "AbortError")) stop = reason;
    }
  }
  return results;
}
