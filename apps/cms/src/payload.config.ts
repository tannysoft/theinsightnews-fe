import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { th } from '@payloadcms/translations/languages/th'
import { en } from '@payloadcms/translations/languages/en'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { r2Storage } from '@payloadcms/storage-r2'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import type { GetPlatformProxyOptions } from 'wrangler'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Pages } from './collections/Pages'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { Redirects } from './collections/Redirects'
import { ImageRecoveries } from './collections/ImageRecoveries'
import { articleEditor } from './lib/editor'
import { mediaFileURL, MEDIA_URL, WEB_URL } from './lib/env'
import { cloudflareEmailAdapter } from './lib/email'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined)

const isCLI = process.argv.some((value) => realpath(value)?.endsWith(path.join('payload', 'bin.js')))
const isProduction = process.env.NODE_ENV === 'production'
// Scripts (WordPress import) run in Node and reach D1/R2 through Wrangler.
const isScript = process.env.PAYLOAD_SCRIPT === '1'
// `next build` only needs the config, never the database; its parallel
// workers would otherwise all start wrangler against the same local D1.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build'

const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === 'string') fn(JSON.stringify({ level, msg: objOrMsg }))
    else fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
  }

const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

/** D1/R2 bindings (exported for the import scripts). */
export const cloudflare =
  isBuild
    ? ({ env: {} } as unknown as CloudflareContext)
    : isCLI || isScript || !isProduction
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

export default buildConfig({
  serverURL: process.env.CMS_URL || undefined,
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' — The Insight News CMS' },
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      afterNavLinks: ['/components/admin/ImageRecovery#ImageRecoveryNavLink'],
      views: {
        imageRecovery: {
          Component: '/components/admin/ImageRecovery#ImageRecoveryView',
          path: '/image-recovery',
        },
      },
    },
  },
  i18n: {
    supportedLanguages: { th, en },
    fallbackLanguage: 'th',
  },
  collections: [Posts, Pages, Categories, Tags, Media, Users, Redirects, ImageRecoveries],
  editor: articleEditor,
  // Forgot-password and other auth mail via Cloudflare Email Sending.
  email: cloudflareEmailAdapter,
  secret: process.env.PAYLOAD_SECRET || '',
  cors: [WEB_URL],
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // allowIDOnCreate: imported content keeps its WordPress ids (media, terms and authors are referenced by id).
  // push: false: schema changes always go through migrations (pnpm migrate:create).
  db: sqliteD1Adapter({ binding: cloudflare.env.D1, allowIDOnCreate: true, push: false }),
  logger: isProduction ? cloudflareLogger : undefined,
  graphQL: { disable: true },
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2 as never,
      // Keep the per-file `prefix` (year/month folder) even without a collection prefix.
      alwaysInsertFields: true,
      collections: {
        media: {
          // Serve files straight from the public R2 domain when it's configured.
          ...(MEDIA_URL
            ? {
                disablePayloadAccessControl: true as const,
                generateFileURL: ({ filename, prefix }) => mediaFileURL(prefix, filename),
              }
            : {}),
        },
      },
    }),
    seoPlugin({
      collections: ['posts', 'pages', 'categories', 'tags'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => (doc as { title?: string; name?: string }).title ?? (doc as { name?: string }).name ?? '',
      generateDescription: ({ doc }) => (doc as { excerpt?: string; description?: string }).excerpt ?? (doc as { description?: string }).description ?? '',
      generateURL: ({ doc, collectionSlug }) => {
        const slug = encodeURIComponent((doc as { slug?: string }).slug ?? '')
        if (collectionSlug === 'categories') return `${WEB_URL}/category/${slug}`
        if (collectionSlug === 'tags') return `${WEB_URL}/tag/${slug}`
        return `${WEB_URL}/${slug}`
      },
      // Yoast settings kept from WordPress (title/description come from the defaults).
      fields: ({ defaultFields }) => [
        ...defaultFields,
        { name: 'focusKeyword', label: 'คีย์เวิร์ดหลัก', type: 'text' },
        { name: 'canonical', label: 'Canonical URL', type: 'text', admin: { description: 'เว้นว่าง = URL ของหน้านี้' } },
        { name: 'noindex', label: 'noindex', type: 'checkbox', defaultValue: false },
        { name: 'nofollow', label: 'nofollow', type: 'checkbox', defaultValue: false },
      ],
    }),
  ],
})

// Adapted from the Payload Cloudflare template / opennextjs-cloudflare getCloudflareContext.
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  // PAYLOAD_REMOTE=1 (import scripts) or the payload CLI in production mode
  // (`deploy:database`) talk to the real D1/R2 via the "remote" wrangler env.
  const remote = process.env.PAYLOAD_REMOTE === '1' || (isCLI && isProduction)
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(({ getPlatformProxy }) =>
    getPlatformProxy({
      environment: remote ? 'remote' : process.env.CLOUDFLARE_ENV,
      remoteBindings: remote,
      persist: process.env.WRANGLER_PERSIST_TO ? { path: process.env.WRANGLER_PERSIST_TO } : undefined,
    } satisfies GetPlatformProxyOptions),
  )
}
