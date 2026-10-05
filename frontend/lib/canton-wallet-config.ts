import {
  RemoteAdapter,
} from "@canton-network/dapp-sdk";

import * as cantonSdk
  from "@canton-network/dapp-sdk";

let initPromise:
  Promise<void> |
  undefined;

export function initCantonWalletSdk():
  Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  const gateway =
    process.env
      .NEXT_PUBLIC_CANTON_WALLET_GATEWAY_URL
      ?.trim();

  if (!gateway) {
    initPromise =
      cantonSdk.init();

    return initPromise;
  }

  const name =
    process.env
      .NEXT_PUBLIC_CANTON_WALLET_GATEWAY_NAME
      ?.trim() ||
    "VINSS Canton Wallet";

  initPromise =
    cantonSdk.init({
      defaultAdapters: [
        new RemoteAdapter({
          name,
          rpcUrl:
            normalizeGatewayUrl(
              gateway,
            ),
        }),
      ],
    });

  return initPromise;
}

function normalizeGatewayUrl(
  value: string,
): string {
  const clean =
    value.replace(
      /\/+$/,
      "",
    );

  if (
    clean.endsWith(
      "/api/v0/dapp",
    )
  ) {
    return clean;
  }

  return (
    `${clean}` +
    "/api/v0/dapp"
  );
}
