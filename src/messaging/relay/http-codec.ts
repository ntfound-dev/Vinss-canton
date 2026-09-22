const TYPE_KEY = "__vinssRelayType";

type EncodedValue =
  | {
      [TYPE_KEY]: "bytes";
      value: string;
    }
  | {
      [TYPE_KEY]: "bigint";
      value: string;
    };

export function encodeRelayJson(
  value: unknown,
): string {
  return JSON.stringify(
    value,
    (_key, current) => {
      if (
        current instanceof Uint8Array
      ) {
        return {
          [TYPE_KEY]: "bytes",
          value:
            bytesToBase64(current),
        } satisfies EncodedValue;
      }

      if (
        typeof current === "bigint"
      ) {
        return {
          [TYPE_KEY]: "bigint",
          value:
            current.toString(),
        } satisfies EncodedValue;
      }

      return current;
    },
  );
}

export function decodeRelayJson<T>(
  text: string,
): T {
  return JSON.parse(
    text,
    (_key, current) => {
      if (!isRecord(current)) {
        return current;
      }

      if (
        current[TYPE_KEY] === "bytes" &&
        typeof current.value === "string"
      ) {
        return base64ToBytes(
          current.value,
        );
      }

      if (
        current[TYPE_KEY] === "bigint" &&
        typeof current.value === "string"
      ) {
        if (
          !/^-?\d+$/.test(
            current.value,
          )
        ) {
          throw new Error(
            "Invalid relay bigint",
          );
        }

        return BigInt(
          current.value,
        );
      }

      return current;
    },
  ) as T;
}

function bytesToBase64(
  bytes: Uint8Array,
): string {
  let binary = "";

  const chunkSize = 0x8000;

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        offset + chunkSize,
      );

    binary +=
      String.fromCharCode(
        ...chunk,
      );
  }

  return btoa(binary);
}

function base64ToBytes(
  value: string,
): Uint8Array {
  const binary =
    atob(value);

  const result =
    new Uint8Array(
      binary.length,
    );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    result[index] =
      binary.charCodeAt(index);
  }

  return result;
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
