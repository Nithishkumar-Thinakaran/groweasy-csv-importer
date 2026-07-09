/**
 * Runs `fn` and retries on failure with exponential backoff.
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseDelayMs?: number, onRetry?: (err, attempt) => void }} opts
 */
export async function withRetry(fn, opts = {}) {
  const { retries = 3, baseDelayMs = 500, onRetry } = opts;
  let lastErr;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (onRetry) onRetry(err, attempt);
      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  throw lastErr;
}

export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
