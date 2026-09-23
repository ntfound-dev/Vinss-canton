import type {
  CantonPartyId,
} from "./types.js";

export interface CantonCreate {
  templateId: string;
  createArguments:
    Record<string, unknown>;
}

export interface CantonSubmitCreates {
  actingParty: CantonPartyId;
  commandId: string;
  creates:
    readonly CantonCreate[];
}

export interface CantonSubmissionResult {
  updateId: string;
  completionOffset: bigint;
}

export interface CantonCreatedContract {
  contractId: string;
  templateId: string;
  offset: bigint;
  createArgument:
    Record<string, unknown>;
  packageName?: string;
}

export interface CantonLedgerClient {
  submitCreates(
    input: CantonSubmitCreates,
  ): Promise<CantonSubmissionResult>;

  queryActiveContracts(
    party: CantonPartyId,
  ): Promise<
    readonly CantonCreatedContract[]
  >;
}
