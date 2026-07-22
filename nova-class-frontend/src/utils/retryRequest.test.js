import { describe, expect, it, vi } from "vitest";
import { isRetryableRequestError, retryRequest } from "./retryRequest";

function networkError() {
  return Object.assign(new Error("Network Error"), { request: {} });
}

describe("isRetryableRequestError", () => {
  it.each([408, 429, 500, 503])("retries HTTP %s", (status) => {
    expect(isRetryableRequestError({ response: { status } })).toBe(true);
  });

  it("does not retry an ordinary client error", () => {
    expect(isRetryableRequestError({ response: { status: 400 } })).toBe(false);
  });

  it("retries a network error without a response", () => {
    expect(isRetryableRequestError(networkError())).toBe(true);
  });
});

describe("retryRequest", () => {
  it("uses all three retries before returning success", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValue("saved");

    await expect(retryRequest(operation, { delays: [0, 0, 0] })).resolves.toBe("saved");
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it("throws after the initial request and three failed retries", async () => {
    const finalError = { response: { status: 503 }, message: "still unavailable" };
    const operation = vi.fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(finalError);

    await expect(retryRequest(operation, { delays: [0, 0, 0] })).rejects.toBe(finalError);
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it("does not retry a non-retryable response", async () => {
    const error = { response: { status: 400 } };
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryRequest(operation, { delays: [0, 0, 0] })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("does not start an operation when already aborted", async () => {
    const controller = new AbortController();
    const operation = vi.fn();
    controller.abort();

    await expect(retryRequest(operation, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(operation).not.toHaveBeenCalled();
  });
});
