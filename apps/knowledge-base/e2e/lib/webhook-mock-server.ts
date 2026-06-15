// oxlint-disable node/no-process-env

import { createServer } from "node:http";

import { assert, log } from "@acdh-oeaw/lib";

/**
 * Server actions dispatch revalidation webhooks via `after()` (see
 * `@/lib/webhook/dispatch-webhook`). During e2e tests the real revalidation endpoint is not
 * running, so every dispatch would fail and flood the server logs with errors. This stand-in
 * listens on the webhook port and answers every request with `204`, mirroring how we mock the
 * analytics endpoint in `@/e2e/lib/test`.
 */

const webhookUrl = process.env.REVALIDATION_WEBHOOK_URL;

assert(webhookUrl != null, "REVALIDATION_WEBHOOK_URL is not set.");

const port = Number(new URL(webhookUrl).port) || 3002;

const server = createServer((request, response) => {
	// Drain the request body so the client sees a clean completion.
	request.resume();
	request.on("end", () => {
		response.writeHead(204).end();
	});
});

server.listen(port, () => {
	log.info(`[webhook-mock-server] Listening on port ${String(port)}.`);
});
