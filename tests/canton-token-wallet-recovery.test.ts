import { describe, it, expect, vi } from "vitest";
import { CantonTokenWallet } from "../src/canton/token-wallet.js";
import type { CantonLedgerClient } from "../src/canton/ledger-client.js";
import type { CantonDealProvider } from "../src/canton/provider.js";
import type { DealAgreement } from "../src/canton/types.js";
const agreement: DealAgreement = { contractId: "agreement", acceptedAt: "2026-10-09T00:00:00Z", terms: {
  dealId: "deal", conversationId: "room", seller: "Bob", buyer: "Alice", termsHash: "hash", amount: "1", instrumentId: "CBTC", instrumentAdmin: "admin", expiresAt: "2026-10-10T00:00:00Z",
}};
describe("escrow funding recovery", () => {
  function setup(receiver = "Bob", settleBefore = "2026-10-10T00:00:00Z") {
    const fundEscrow = vi.fn().mockResolvedValue("escrow");
    const submitExercise = vi.fn();
    const queryInterfaceContracts = vi.fn().mockImplementation(async (_party, iface: string) => iface.includes("AllocationV1") ? [{ contractId: "allocation", interfaceView: { allocation: {
      settlement: { executor: "Bob", settlementRef: { id: "deal" }, settleBefore },
      transferLeg: { sender: "Alice", receiver, amount: "1.0000000000", instrumentId: { admin: "admin", id: "CBTC" } },
    } } }] : []);
    const wallet = new CantonTokenWallet({ ledger: { queryInterfaceContracts, submitExercise } as unknown as CantonLedgerClient,
      dealProvider: { fundEscrow } as unknown as CantonDealProvider,
      registryDirectory: { registryUrlForAdmin: () => "https://registry.example" }, now: () => new Date("2026-10-09T00:00:00Z") });
    return { wallet, fundEscrow, submitExercise };
  }
  it("reuses the matching live allocation without allocating holdings again", async () => {
    const { wallet, fundEscrow, submitExercise } = setup();
    expect(await wallet.allocateAndFundEscrow("Alice", agreement)).toEqual({ allocationContractId: "allocation", escrowContractId: "escrow" });
    expect(fundEscrow).toHaveBeenCalledWith("Alice", "agreement", "allocation");
    expect(submitExercise).not.toHaveBeenCalled();
  });
  it.each([["Mallory", "2026-10-10T00:00:00Z"], ["Bob", "2026-10-08T00:00:00Z"]])("does not fund a wrong receiver or expired allocation", async (receiver, expires) => {
    const { wallet, fundEscrow } = setup(receiver, expires);
    await expect(wallet.allocateAndFundEscrow("Alice", agreement)).rejects.toThrow("Insufficient");
    expect(fundEscrow).not.toHaveBeenCalled();
  });
});
