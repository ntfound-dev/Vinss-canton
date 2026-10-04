import {
  describe,
  expect,
  it,
} from "vitest";

import {
  HttpCantonTokenRegistryClient,
} from "../src/canton/token-registry-client.js";

describe(
  "HttpCantonTokenRegistryClient",
  () => {
    it(
      "loads AllocationFactory and its disclosed contracts",
      async () => {
        let requestedUrl =
          "";

        let requestedBody:
          unknown;

        const client =
          new HttpCantonTokenRegistryClient({
            baseUrl:
              "https://registry.example/",

            fetcher:
              (async (
                input,
                init,
              ) => {
                requestedUrl =
                  String(input);

                requestedBody =
                  JSON.parse(
                    String(
                      init?.body,
                    ),
                  );

                return new Response(
                  JSON.stringify({
                    factoryId:
                      "factory-1",

                    choiceContext: {
                      choiceContextData: {
                        values: {},
                      },

                      disclosedContracts: [
                        {
                          templateId:
                            "pkg:Mod:T",
                          contractId:
                            "cid-1",
                          createdEventBlob:
                            "Ym9i",
                          synchronizerId:
                            "sync-1",
                        },
                      ],
                    },
                  }),
                  {
                    status: 200,
                  },
                );
              }) as typeof fetch,
          });

        const factory =
          await client
            .getAllocationFactory({
              expectedAdmin:
                "admin",
            });

        expect(
          requestedUrl,
        ).toBe(
          "https://registry.example/registry/allocation-instruction/v1/allocation-factory",
        );

        expect(
          requestedBody,
        ).toEqual({
          choiceArguments: {
            expectedAdmin:
              "admin",
          },
          excludeDebugFields:
            true,
        });

        expect(
          factory.factoryId,
        ).toBe(
          "factory-1",
        );

        expect(
          factory
            .choiceContext
            .disclosedContracts[0]
            ?.synchronizerId,
        ).toBe(
          "sync-1",
        );
      },
    );

    it(
      "loads Allocation_ExecuteTransfer context",
      async () => {
        let requestedUrl =
          "";

        const client =
          new HttpCantonTokenRegistryClient({
            baseUrl:
              "https://registry.example",

            fetcher:
              (async (
                input,
              ) => {
                requestedUrl =
                  String(input);

                return new Response(
                  JSON.stringify({
                    choiceContextData: {
                      values: {},
                    },
                    disclosedContracts: [],
                  }),
                  {
                    status: 200,
                  },
                );
              }) as typeof fetch,
          });

        await expect(
          client
            .getAllocationExecuteTransferContext(
              "00ab/cid",
            ),
        ).resolves.toEqual({
          choiceContextData: {
            values: {},
          },
          disclosedContracts: [],
        });

        expect(
          requestedUrl,
        ).toContain(
          "/registry/allocations/v1/00ab%2Fcid/choice-contexts/execute-transfer",
        );
      },
    );
  },
);
