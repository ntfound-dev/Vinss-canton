import type {
  KeyPackageEnvelope,
  MessagingTransport,
  MlsHandshakeDelivery,
  MlsHandshakeEnvelope,
} from "../transport.js";

import type {
  CiphertextEnvelope,
  ConversationId,
  InstallationId,
} from "../types.js";

import {
  decodeRelayJson,
  encodeRelayJson,
} from "./http-codec.js";

export type RelayFetch =
  typeof globalThis.fetch;

export class HttpMessagingTransport
  implements MessagingTransport
{
  readonly #baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetcher:
      RelayFetch =
        globalThis.fetch.bind(
          globalThis,
        ),
  ) {
    this.#baseUrl =
      baseUrl.replace(/\/+$/, "");
  }

  async publishKeyPackage(
    envelope: KeyPackageEnvelope,
  ): Promise<void> {
    await this.request(
      "/v1/key-packages",
      {
        method: "POST",
        body:
          encodeRelayJson(
            envelope,
          ),
      },
    );
  }

  async fetchKeyPackages(
    installationIds:
      readonly InstallationId[],
  ): Promise<
    readonly KeyPackageEnvelope[]
  > {
    return this.request<
      readonly KeyPackageEnvelope[]
    >(
      "/v1/key-packages/query",
      {
        method: "POST",
        body:
          encodeRelayJson({
            installationIds,
          }),
      },
    );
  }

  async publishHandshakes(
    deliveries:
      readonly MlsHandshakeDelivery[],
  ): Promise<void> {
    await this.request(
      "/v1/handshakes/batch",
      {
        method: "POST",
        body:
          encodeRelayJson({
            deliveries,
          }),
      },
    );
  }

  async fetchHandshakes(
    installationId: InstallationId,
    cursor?: string,
  ): Promise<{
    items:
      readonly MlsHandshakeEnvelope[];
    nextCursor?: string;
  }> {
    const query =
      new URLSearchParams({
        installationId,
      });

    if (cursor) {
      query.set(
        "cursor",
        cursor,
      );
    }

    return this.request(
      `/v1/handshakes?${query}`,
      {
        method: "GET",
      },
    );
  }

  async publishCiphertext(
    envelope: CiphertextEnvelope,
  ): Promise<void> {
    await this.request(
      "/v1/ciphertexts",
      {
        method: "POST",
        body:
          encodeRelayJson(
            envelope,
          ),
      },
    );
  }

  async fetchCiphertexts(
    conversationId:
      ConversationId,
    cursor?: string,
  ): Promise<{
    items:
      readonly CiphertextEnvelope[];
    nextCursor?: string;
  }> {
    const query =
      new URLSearchParams({
        conversationId,
      });

    if (cursor) {
      query.set(
        "cursor",
        cursor,
      );
    }

    return this.request(
      `/v1/ciphertexts?${query}`,
      {
        method: "GET",
      },
    );
  }

  private async request<T = void>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const response =
      await this.fetcher(
        `${this.#baseUrl}${path}`,
        {
          ...init,
          headers: {
            accept:
              "application/json",
            ...(init.body
              ? {
                  "content-type":
                    "application/json",
                }
              : {}),
            ...init.headers,
          },
        },
      );

    if (!response.ok) {
      const detail =
        await response.text();

      throw new Error(
        `VINSS relay ${response.status}: ${
          detail ||
          response.statusText
        }`,
      );
    }

    if (
      response.status === 204
    ) {
      return undefined as T;
    }

    const text =
      await response.text();

    if (!text) {
      return undefined as T;
    }

    return decodeRelayJson<T>(
      text,
    );
  }
}
