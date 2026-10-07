import type { PlainMessage } from "../types.js";
export interface LocalPlaintextStore {
  list(conversationId: string): Promise<readonly PlainMessage[]>;
  get(
    conversationId: string,
    messageId: string,
  ): Promise<PlainMessage | undefined>;
  save(message: PlainMessage): Promise<void>;
  hasProcessed?(conversationId: string, messageId: string): Promise<boolean>;
  markProcessed?(conversationId: string, messageId: string): Promise<void>;
  clear(conversationId: string): Promise<void>;
}
// Explicit client-only plaintext history. Never pass this store to a transport/server.
export class IndexedDbPlaintextStore implements LocalPlaintextStore {
  constructor(
    private readonly scope: string,
    private readonly factory: IDBFactory = globalThis.indexedDB,
    private readonly dbName = "vinss-message-history",
  ) {
    if (!factory)
      throw new Error("IndexedDB is required for local message history");
  }
  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("messages", {
          keyPath: "key",
        });
        store.createIndex("room", "room");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Close other VINSS tabs to open message history"));
    });
  }
  private room(id: string) {
    return JSON.stringify([this.scope, id]);
  }
  private key(room: string, id: string) {
    return JSON.stringify([this.scope, room, id]);
  }
  async list(conversationId: string): Promise<readonly PlainMessage[]> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("messages", "readonly");
        const req = tx
          .objectStore("messages")
          .index("room")
          .getAll(this.room(conversationId));
        req.onsuccess = () =>
          resolve(
            (req.result as { message: PlainMessage }[])
              .filter((r) => r.message)
              .map((r) => r.message)
              .sort((a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id)),
          );
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }
  async get(
    conversationId: string,
    id: string,
  ): Promise<PlainMessage | undefined> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const req = db
          .transaction("messages", "readonly")
          .objectStore("messages")
          .get(this.key(conversationId, id));
        req.onsuccess = () => resolve(req.result?.message);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }
  async hasProcessed(conversationId: string, id: string): Promise<boolean> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const req = db
          .transaction("messages", "readonly")
          .objectStore("messages")
          .count(this.key(conversationId, id));
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }
  async markProcessed(conversationId: string, id: string): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("messages", "readwrite");
        tx.objectStore("messages").put({
          key: this.key(conversationId, id),
          room: this.room(conversationId),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error ?? new Error("Local processing marker save aborted"));
      });
    } finally {
      db.close();
    }
  }
  async save(message: PlainMessage): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("messages", "readwrite");
        tx.objectStore("messages").put({
          key: this.key(message.conversationId, message.id),
          room: this.room(message.conversationId),
          message,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error ?? new Error("Local message save was aborted"));
      });
    } finally {
      db.close();
    }
  }
  async clear(conversationId: string): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("messages", "readwrite"),
          store = tx.objectStore("messages"),
          req = store.index("room").openKeyCursor(this.room(conversationId));
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error ?? new Error("Local history clear was aborted"));
      });
    } finally {
      db.close();
    }
  }
}
