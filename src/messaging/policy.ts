import type { GroupMember, MemberRole, UserId } from "./types.js";

export type GroupOperation =
  | "send_message"
  | "add_member"
  | "remove_member"
  | "promote_admin"
  | "change_metadata";

const permissionMatrix: Record<GroupOperation, readonly MemberRole[]> = {
  send_message: ["member", "admin", "super_admin"],
  add_member: ["admin", "super_admin"],
  remove_member: ["admin", "super_admin"],
  promote_admin: ["super_admin"],
  change_metadata: ["admin", "super_admin"],
};

export function canPerform(
  role: MemberRole,
  operation: GroupOperation,
): boolean {
  return permissionMatrix[operation].includes(role);
}

export function requirePermission(
  role: MemberRole,
  operation: GroupOperation,
): void {
  if (!canPerform(role, operation)) {
    throw new Error(`Role ${role} cannot perform ${operation}`);
  }
}

export function findUserRole(
  members: readonly GroupMember[],
  userId: UserId,
): MemberRole | undefined {
  const roles = members
    .filter((member) => member.userId === userId)
    .map((member) => member.role);

  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("member")) return "member";
  return undefined;
}
