// OpenNext config for the live worker (wrangler.live.jsonc): ISR cache in
// Workers KV, as before the monorepo. The preview worker uses open-next.config.ts.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
