import worker from "vinext/server/fetch-handler";
import { securityHeadersRecord } from "@/lib/security-headers";

interface WorkerModule {
  fetch: (
    request: Request,
    env: Record<string, unknown>,
    ctx: unknown,
  ) => Promise<Response> | Response;
}

// vinext does not currently apply next.config headers to prerendered/HTML
// responses, so the Worker wrapper enforces them for every Worker response.
// Cloudflare may still serve asset-layer responses through runWorkerFirst, and
// public/_headers covers directly-served static assets.
const SECURITY_HEADERS = securityHeadersRecord({ dev: false });

const vinextWorker = worker as unknown as WorkerModule;

const workerEntry = {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: unknown,
  ): Promise<Response> {
    const response = await vinextWorker.fetch(request, env, ctx);

    if (response.status === 101 || response.status === 204 || response.status === 304) {
      return response;
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default workerEntry;
