import { afterEach, describe, expect, it, vi } from "vitest";
import { walletWait } from "../frontend/lib/wallet-wait.js";
afterEach(() => vi.useRealTimers());
describe("Canton wallet waiting boundary", () => {
  it("releases the UI deadline without cancelling an eventual wallet approval", async () => {
    vi.useFakeTimers();
    let approve!: (value: string) => void;
    const wallet = new Promise<string>((resolve) => { approve = resolve; });
    const result = walletWait(wallet, 60000);
    const failure = expect(result).rejects.toThrow("Complete or cancel the request");
    await vi.advanceTimersByTimeAsync(60000);
    await failure;
    approve("authenticated account");
    await expect(wallet).resolves.toBe("authenticated account");
  });
  it("clears its deadline after an approval", async () => {
    vi.useFakeTimers();
    await expect(walletWait(Promise.resolve("account"), 60000)).resolves.toBe("account");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the wallet rejection instead of reporting a timeout", async () => {
    vi.useFakeTimers();
    await expect(walletWait(Promise.reject(new Error("User rejected")), 60000)).rejects.toThrow("User rejected");
    expect(vi.getTimerCount()).toBe(0);
  });
});
