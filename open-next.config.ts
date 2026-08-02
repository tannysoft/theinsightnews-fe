// OpenNext adapter config for Cloudflare Workers.
// Docs: https://opennext.js.org/cloudflare/caching
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
