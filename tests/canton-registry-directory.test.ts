import {
  describe,
  expect,
  it,
} from "vitest";

import {
  StaticCantonRegistryDirectory,
} from "../src/canton/registry-directory.js";

describe(
  "StaticCantonRegistryDirectory",
  () => {
    it(
      "maps an instrument admin to its registry",
      () => {
        const directory =
          new StaticCantonRegistryDirectory({
            "admin::123":
              "https://scan.example/",
          });

        expect(
          directory
            .registryUrlForAdmin(
              "admin::123",
            ),
        ).toBe(
          "https://scan.example",
        );
      },
    );

    it(
      "rejects an unconfigured admin",
      () => {
        const directory =
          new StaticCantonRegistryDirectory(
            {},
          );

        expect(
          () =>
            directory
              .registryUrlForAdmin(
                "unknown",
              ),
        ).toThrow(
          "No Canton Token Registry URL configured",
        );
      },
    );
  },
);
