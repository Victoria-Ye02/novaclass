function wait(delayMs) {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function withRetries(operation, { retries = 3, baseDelayMs = 250 } = {}) {
  if (typeof operation !== "function") throw new TypeError("operation must be a function");

  for (let retryIndex = 0; ; retryIndex += 1) {
    try {
      return await operation();
    } catch (error) {
      if (retryIndex >= retries) throw error;
      await wait(baseDelayMs * 2 ** retryIndex);
    }
  }
}

module.exports = { withRetries };
