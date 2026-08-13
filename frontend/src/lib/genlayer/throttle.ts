/**
 * Client-side rate limiting for contract reads.
 *
 * StudioNet enforces 30 requests per minute per client. A single page in
 * this app can fan out well past that — a profile view alone loads the
 * profile, its claim-id list, every claim, its credential-id list, and
 * every credential. Without throttling those bursts hit the limit and
 * surface as "Failed to fetch", which previously rendered as though the
 * user's records were missing.
 *
 * A token bucket keeps sustained throughput under the server's ceiling
 * while still allowing a short burst, so the common case (one page load)
 * stays fast and only sustained traffic is slowed.
 */

/** Kept just under the server's 30/min so retries have headroom. */
const REFILL_PER_MINUTE = 26;
const REFILL_INTERVAL_MS = 60_000 / REFILL_PER_MINUTE;

/** Allows a typical page's fan-out to go through without waiting. */
const BUCKET_CAPACITY = 8;

/** Caps parallel in-flight requests so we never slam the endpoint. */
const MAX_CONCURRENT = 4;

let tokens = BUCKET_CAPACITY;
let lastRefill = Date.now();
let inFlight = 0;
const waiters: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function refill(): void {
  const elapsed = Date.now() - lastRefill;
  if (elapsed < REFILL_INTERVAL_MS) return;

  const gained = Math.floor(elapsed / REFILL_INTERVAL_MS);
  tokens = Math.min(BUCKET_CAPACITY, tokens + gained);
  lastRefill += gained * REFILL_INTERVAL_MS;
}

function canProceed(): boolean {
  refill();
  return tokens > 0 && inFlight < MAX_CONCURRENT;
}

/**
 * Keeps a single timer alive while work is queued. Rescheduling itself is
 * what makes the queue drain: without it the bucket refills but nothing
 * wakes up to spend the tokens, and queued reads stall indefinitely.
 */
function scheduleWake(): void {
  if (timer !== undefined || waiters.length === 0) return;
  timer = setTimeout(() => {
    timer = undefined;
    pump();
  }, REFILL_INTERVAL_MS);
}

function pump(): void {
  while (waiters.length > 0 && canProceed()) {
    tokens -= 1;
    inFlight += 1;
    waiters.shift()!();
  }
  scheduleWake();
}

/**
 * Runs `task` once the rate limiter allows it. Requests queue in FIFO
 * order, so an early page's reads are not starved by a later burst.
 */
export function throttled<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiters.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          inFlight -= 1;
          pump();
        });
    });
    pump();
  });
}
