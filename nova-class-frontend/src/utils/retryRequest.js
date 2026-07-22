function abortError() {
  if (typeof DOMException === "function") {
    return new DOMException("Aborted", "AbortError");
  }
  return Object.assign(new Error("Aborted"), { name: "AbortError" });
}

export function isRetryableRequestError(error) {
  if (error?.name === "AbortError" || error?.code === "ERR_CANCELED") return false;

  const status = error?.response?.status;
  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500;
  }

  return Boolean(
    error?.request ||
    error?.code === "ECONNABORTED" ||
    error?.code === "ERR_NETWORK" ||
    error?.code === "ETIMEDOUT"
  );
}

function wait(delay, signal) {
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);

    function onAbort() {
      globalThis.clearTimeout(timer);
      reject(abortError());
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function retryRequest(
  operation,
  { delays = [300, 600, 1200], signal } = {}
) {
  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) throw abortError();

    try {
      return await operation();
    } catch (error) {
      if (!isRetryableRequestError(error) || attempt >= delays.length) throw error;
      await wait(delays[attempt], signal);
    }
  }
}
