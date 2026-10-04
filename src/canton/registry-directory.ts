export interface CantonRegistryDirectory {
  registryUrlForAdmin(
    instrumentAdmin: string,
  ): string;
}

/**
 * CIP-56 currently requires wallets/apps to maintain the mapping from an
 * instrument admin Party to its registry URL. Unknown admins are rejected
 * instead of guessing a registry endpoint.
 */
export class StaticCantonRegistryDirectory
  implements CantonRegistryDirectory
{
  readonly #urls:
    ReadonlyMap<string, string>;

  constructor(
    entries:
      Readonly<
        Record<string, string>
      >,
  ) {
    this.#urls =
      new Map(
        Object.entries(
          entries,
        ).map(
          ([admin, url]) => [
            admin,
            normalizeUrl(
              url,
            ),
          ],
        ),
      );
  }

  registryUrlForAdmin(
    instrumentAdmin: string,
  ): string {
    const url =
      this.#urls.get(
        instrumentAdmin,
      );

    if (!url) {
      throw new Error(
        `No Canton Token Registry URL configured for instrument admin: ${instrumentAdmin}`,
      );
    }

    return url;
  }
}

function normalizeUrl(
  value: string,
): string {
  const clean =
    value.trim()
      .replace(
        /\/+$/,
        "",
      );

  if (
    !/^https?:\/\//i.test(
      clean,
    )
  ) {
    throw new Error(
      "Canton Token Registry URL must use http or https",
    );
  }

  return clean;
}
