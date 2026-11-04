import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";

/**
 * Deploys the vinext production Worker with Wrangler.
 *
 * `vinext-cloudflare deploy` uses the `cf` CLI, which requires its own
 * authentication (CLOUDFLARE_API_TOKEN or `cf auth login`). When only Wrangler
 * is authenticated, this script stages the same build output in `dist-worker/`
 * and deploys it with `wrangler deploy`.
 */

const WORKER_OUTPUT = ".cloudflare/output/v0/workers/default";
const STAGING = "dist-worker";

function run(command) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit" });
}

run("npm run build:vinext");

if (!existsSync(`${WORKER_OUTPUT}/bundle/index.js`)) {
  throw new Error(
    `Missing vinext build output at ${WORKER_OUTPUT}/bundle/index.js. Run the build again.`,
  );
}

rmSync(STAGING, { recursive: true, force: true });
cpSync(`${WORKER_OUTPUT}/bundle`, `${STAGING}/worker`, { recursive: true });
cpSync(`${WORKER_OUTPUT}/assets`, `${STAGING}/assets`, { recursive: true });

// Wrangler refuses to deploy while the cf-style `.cloudflare/output` directory
// exists. The output has been staged, so remove it to run a plain deploy.
rmSync(".cloudflare/output", { recursive: true, force: true });

run("npx wrangler deploy");
