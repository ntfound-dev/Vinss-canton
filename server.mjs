import http from "node:http";
import { HttpCantonLedgerClient } from "./dist/canton/http-ledger-client.js";

const port = Number(process.env.PORT || 3000);

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    return send(res, 200, {
      ok: true,
      service: "vinss-canton",
    });
  }

  if (req.url === "/ready") {
    const baseUrl = process.env.CANTON_LEDGER_URL;
    const userId = process.env.CANTON_USER_ID;

    if (!baseUrl || !userId) {
      return send(res, 200, {
        ok: false,
        configured: false,
        reason: "Canton validator not configured yet",
      });
    }

    try {
      const ledger = new HttpCantonLedgerClient({
        baseUrl,
        userId,
        getAccessToken: async () =>
          process.env.CANTON_ACCESS_TOKEN || undefined,
      });

      const identity = await ledger.getAuthenticatedIdentity();

      return send(res, 200, {
        ok: true,
        configured: true,
        canton: {
          userId: identity.userId,
          primaryParty: identity.primaryParty,
        },
      });
    } catch (error) {
      return send(res, 503, {
        ok: false,
        configured: true,
        error:
          error instanceof Error
            ? error.message
            : "Canton connection failed",
      });
    }
  }

  send(res, 404, {
    ok: false,
    error: "Not found",
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`VINSS Canton listening on ${port}`);
});
