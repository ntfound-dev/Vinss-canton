import type {
  InstallationId,
} from "../types.js";

import {
  decodeOpenMlsCheckpoint,
  encodeOpenMlsCheckpoint,
} from "./checkpoint.js";

import type {
  OpenMlsCheckpoint,
  OpenMlsCheckpointStore,
} from "./checkpoint.js";

const DB_VERSION = 1;

const KEY_STORE =
  "device-keys";

const CHECKPOINT_STORE =
  "checkpoints";

const FORMAT_VERSION = 1;

interface EncryptedCheckpoint {
  version: 1;

  iv: ArrayBuffer;

  ciphertext:
    ArrayBuffer;
}

export interface IndexedDbCheckpointOptions {
  dbName?: string;

  indexedDB?:
    IDBFactory;

  crypto?:
    Crypto;
}

export class IndexedDbOpenMlsCheckpointStore
  implements OpenMlsCheckpointStore
{
  readonly #dbName: string;
  readonly #indexedDB:
    IDBFactory;
  readonly #crypto:
    Crypto;

  constructor(
    options:
      IndexedDbCheckpointOptions = {},
  ) {
    this.#dbName =
      options.dbName ??
      "vinss-openmls";

    this.#indexedDB =
      options.indexedDB ??
      globalThis.indexedDB;

    this.#crypto =
      options.crypto ??
      globalThis.crypto;

    if (!this.#indexedDB) {
      throw new Error(
        "IndexedDB is unavailable",
      );
    }

    if (!this.#crypto?.subtle) {
      throw new Error(
        "WebCrypto is unavailable",
      );
    }
  }

  async load(
    installationId:
      InstallationId,
  ): Promise<
    OpenMlsCheckpoint | undefined
  > {
    const db =
      await this.openDatabase();

    try {
      const encrypted =
        await getValue<
          EncryptedCheckpoint
        >(
          db,
          CHECKPOINT_STORE,
          installationId,
        );

      if (!encrypted) {
        return undefined;
      }

      if (
        encrypted.version !==
        FORMAT_VERSION
      ) {
        throw new Error(
          "Unsupported encrypted OpenMLS checkpoint",
        );
      }

      const key =
        await getValue<
          CryptoKey
        >(
          db,
          KEY_STORE,
          installationId,
        );

      if (!key) {
        throw new Error(
          "OpenMLS device encryption key is missing",
        );
      }

      const plaintext =
        new Uint8Array(
          await this.#crypto
            .subtle.decrypt(
              {
                name:
                  "AES-GCM",

                iv:
                  encrypted.iv,

                additionalData:
                  additionalData(
                    installationId,
                  ),
              },

              key,
              encrypted
                .ciphertext,
            ),
        );

      try {
        return decodeOpenMlsCheckpoint(
          plaintext,
        );
      } finally {
        plaintext.fill(0);
      }
    } finally {
      db.close();
    }
  }

  async save(
    installationId:
      InstallationId,

    checkpoint:
      OpenMlsCheckpoint,
  ): Promise<void> {
    const db =
      await this.openDatabase();

    try {
      const key =
        await this.getOrCreateKey(
          db,
          installationId,
        );

      const plaintext =
        encodeOpenMlsCheckpoint(
          checkpoint,
        );

      const plaintextBuffer =
        copyArrayBuffer(
          plaintext,
        );

      const iv =
        this.#crypto
          .getRandomValues(
            new Uint8Array(12),
          );

      try {
        const ciphertext =
          await this.#crypto
            .subtle.encrypt(
              {
                name:
                  "AES-GCM",

                iv,

                additionalData:
                  additionalData(
                    installationId,
                  ),
              },

              key,
              plaintextBuffer,
            );

        await putValue(
          db,
          CHECKPOINT_STORE,
          installationId,
          {
            version:
              FORMAT_VERSION,

            iv:
              copyArrayBuffer(
                iv,
              ),

            ciphertext:
              copyArrayBuffer(
                new Uint8Array(
                  ciphertext,
                ),
              ),
          } satisfies
            EncryptedCheckpoint,
        );
      } finally {
        plaintext.fill(0);
      }
    } finally {
      db.close();
    }
  }

  async clear(
    installationId:
      InstallationId,
  ): Promise<void> {
    const db =
      await this.openDatabase();

    try {
      await deleteValue(
        db,
        CHECKPOINT_STORE,
        installationId,
      );

      await deleteValue(
        db,
        KEY_STORE,
        installationId,
      );
    } finally {
      db.close();
    }
  }

  private async getOrCreateKey(
    db: IDBDatabase,
    installationId:
      InstallationId,
  ): Promise<CryptoKey> {
    const existing =
      await getValue<CryptoKey>(
        db,
        KEY_STORE,
        installationId,
      );

    if (existing) {
      return existing;
    }

    const key =
      await this.#crypto
        .subtle.generateKey(
          {
            name:
              "AES-GCM",

            length: 256,
          },

          false,

          [
            "encrypt",
            "decrypt",
          ],
        );

    await putValue(
      db,
      KEY_STORE,
      installationId,
      key,
    );

    return key;
  }

  private openDatabase():
    Promise<IDBDatabase> {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const request =
          this.#indexedDB.open(
            this.#dbName,
            DB_VERSION,
          );

        request.onupgradeneeded =
          () => {
            const db =
              request.result;

            if (
              !db.objectStoreNames
                .contains(
                  KEY_STORE,
                )
            ) {
              db.createObjectStore(
                KEY_STORE,
              );
            }

            if (
              !db.objectStoreNames
                .contains(
                  CHECKPOINT_STORE,
                )
            ) {
              db.createObjectStore(
                CHECKPOINT_STORE,
              );
            }
          };

        request.onsuccess =
          () => {
            resolve(
              request.result,
            );
          };

        request.onerror =
          () => {
            reject(
              request.error ??
                new Error(
                  "Failed to open VINSS IndexedDB",
                ),
            );
          };
      },
    );
  }
}

function additionalData(
  installationId: string,
): ArrayBuffer {
  const bytes =
    new TextEncoder()
      .encode(
        `vinss-openmls:${FORMAT_VERSION}:${installationId}`,
      );

  return copyArrayBuffer(
    bytes,
  );
}

function copyArrayBuffer(
  value: Uint8Array,
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.length,
    );

  copy.set(value);

  return copy.buffer;
}

function getValue<T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const transaction =
        db.transaction(
          storeName,
          "readonly",
        );

      const request =
        transaction
          .objectStore(
            storeName,
          )
          .get(key);

      request.onsuccess =
        () => {
          resolve(
            request.result as
              | T
              | undefined,
          );
        };

      request.onerror =
        () => {
          reject(
            request.error ??
              new Error(
                "IndexedDB read failed",
              ),
          );
        };
    },
  );
}

function putValue(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
  value: unknown,
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const transaction =
        db.transaction(
          storeName,
          "readwrite",
        );

      transaction
        .objectStore(
          storeName,
        )
        .put(
          value,
          key,
        );

      transaction.oncomplete =
        () => resolve();

      transaction.onerror =
        () => {
          reject(
            transaction.error ??
              new Error(
                "IndexedDB write failed",
              ),
          );
        };

      transaction.onabort =
        transaction.onerror;
    },
  );
}

function deleteValue(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const transaction =
        db.transaction(
          storeName,
          "readwrite",
        );

      transaction
        .objectStore(
          storeName,
        )
        .delete(key);

      transaction.oncomplete =
        () => resolve();

      transaction.onerror =
        () => {
          reject(
            transaction.error ??
              new Error(
                "IndexedDB delete failed",
              ),
          );
        };

      transaction.onabort =
        transaction.onerror;
    },
  );
}
