/** Space out Polygon calls in a single handler to reduce 429 rate limits. */
export const POLYGON_CALL_GAP_MS = 300;

/** Wait after HTTP 429 before one retry. */
export const POLYGON_429_RETRY_MS = 1000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET from Polygon; on 429 waits {@link POLYGON_429_RETRY_MS} and retries once.
 */
export async function polygonFetch(
  url: string,
  revalidateSeconds: number,
): Promise<Response> {
  const init: RequestInit = { next: { revalidate: revalidateSeconds } };
  let res = await fetch(url, init);
  if (res.status === 429) {
    await sleep(POLYGON_429_RETRY_MS);
    res = await fetch(url, init);
  }
  return res;
}
