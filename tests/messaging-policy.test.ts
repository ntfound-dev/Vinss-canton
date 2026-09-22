import { describe, expect, it } from "vitest";
import { canPerform, requirePermission } from "../src/messaging/policy.js";

describe("VINSS group permissions", () => {
  it("allows members to send messages", () => {
    expect(canPerform("member", "send_message")).toBe(true);
  });

  it("does not allow ordinary members to remove members", () => {
    expect(canPerform("member", "remove_member")).toBe(false);
  });

  it("allows admins to manage membership", () => {
    expect(canPerform("admin", "add_member")).toBe(true);
    expect(canPerform("admin", "remove_member")).toBe(true);
  });

  it("only allows super admins to promote admins", () => {
    expect(canPerform("admin", "promote_admin")).toBe(false);
    expect(canPerform("super_admin", "promote_admin")).toBe(true);
  });

  it("throws for forbidden operations", () => {
    expect(() => requirePermission("member", "change_metadata")).toThrow();
  });
});
