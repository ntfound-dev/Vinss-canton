import type {
  CantonCreatedContract,
  CantonLedgerClient,
} from "../../src/canton/ledger-client";
import { isCantonTemplate } from "../../src/messaging/canton/templates";
import { REQUEST_TEMPLATE, installationFor } from "./canton-invite";
import { cantonNetwork, type RoomBookmark } from "./workspace";
import type { JobListing } from "./job-types";
export async function startJobConversation(
  ledger: CantonLedgerClient,
  job: JobListing,
  party: string,
): Promise<RoomBookmark> {
  if (job.demo) throw new Error("Sample jobs cannot create real transactions.");
  if (job.network !== cantonNetwork())
    throw new Error("This job uses a different Canton network.");
  if (job.ownerParty === party)
    throw new Error("You cannot apply to your own job.");
  if ((await ledger.getAuthenticatedIdentity()).primaryParty !== party)
    throw new Error("Your wallet account changed. Please retry.");
  const installation = installationFor(`wallet:${party}`),
    id = crypto.randomUUID();
  await ledger.submitCreates({
    actingParty: party,
    commandId: `job-discussion-${id}`,
    creates: [
      {
        templateId: REQUEST_TEMPLATE,
        createArguments: {
          requestId: `vinss-job:v1:${job.id}:${id}`,
          requester: party,
          recipient: job.ownerParty,
          installationId: installation,
        },
      },
    ],
  });
  return {
    id,
    title: job.title,
    peerParty: job.ownerParty,
    peerInstallation: job.ownerInstallation,
    creator: true,
    updatedAt: Date.now(),
    jobId: job.id,
    bindingRequestId: `vinss-job:v1:${job.id}:${id}`,
  };
}
export function incomingJobRooms(
  contracts: readonly CantonCreatedContract[],
  party: string,
): RoomBookmark[] {
  const rows: RoomBookmark[] = [];
  for (const c of contracts) {
    const a = c.createArgument;
    if (
      !isCantonTemplate(c.templateId, "KeyPackageRequest") ||
      a.recipient !== party ||
      typeof a.requestId !== "string" ||
      typeof a.requester !== "string" ||
      a.requester === party ||
      typeof a.installationId !== "string" ||
      !/^[\da-f-]{36}$/i.test(a.installationId)
    )
      continue;
    const match = /^vinss-job:v1:([\w-]{1,80}):([a-f\d-]{36})$/i.exec(
      a.requestId,
    );
    if (!match) continue;
    rows.push({
      id: match[2],
      title: "Job discussion",
      peerParty: a.requester,
      peerInstallation: a.installationId,
      creator: false,
      updatedAt: Date.now(),
      jobId: match[1],
      bindingRequestId: a.requestId,
    });
  }
  return rows;
}
