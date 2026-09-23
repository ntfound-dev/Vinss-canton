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

export interface CantonExercise {
  actingParty: CantonPartyId;
  commandId: string;
  templateId: string;
  contractId: string;
  choice: string;
  choiceArgument:
    Record<string, unknown>;
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

export interface CantonActiveContractSnapshot {
  offset: bigint;

  contracts:
    readonly CantonCreatedContract[];
}

export interface CantonAuthenticatedIdentity {
  userId: string;
  primaryParty:
    CantonPartyId;
  canActAs:
    readonly CantonPartyId[];
  canReadAs:
    readonly CantonPartyId[];
}

export interface CantonLedgerClient {
  submitCreates(
    input:
      CantonSubmitCreates,
  ): Promise<CantonSubmissionResult>;

  submitExercise(
    input:
      CantonExercise,
  ): Promise<CantonSubmissionResult>;

  queryActiveContracts(
    party: CantonPartyId,
  ): Promise<
    readonly CantonCreatedContract[]
  >;

  queryActiveContractsSnapshot(
    party: CantonPartyId,
  ): Promise<
    CantonActiveContractSnapshot
  >;

  queryCreatedContractsSince(
    party: CantonPartyId,
    afterExclusive: bigint,
  ): Promise<
    readonly CantonCreatedContract[]
  >;

  getAuthenticatedIdentity():
    Promise<CantonAuthenticatedIdentity>;
}
