# The Insight News (theinsightnews.co)

Monorepo ของเว็บไซต์และระบบจัดการเนื้อหา ทั้งระบบรันบน Cloudflare

| แอป | คืออะไร | รันบน |
| --- | --- | --- |
| `apps/web` | เว็บไซต์ข่าว (Next.js 16) | Cloudflare Workers ผ่าน OpenNext |
| `apps/cms` | Payload CMS 3 ระบบหลังบ้านที่มาแทน WordPress | Cloudflare Workers + D1 (ฐานข้อมูล) + R2 (ไฟล์สื่อ) |
| `apps/files` | worker สำรอง (ไม่ได้ใช้แล้ว) — files.theinsightnews.co เป็น custom domain ของ R2 โดยตรง | Cloudflare Worker (ไม่มี route) |

```
packages/
  shared/  โค้ดที่ CMS และเว็บใช้ร่วมกัน (ขนาดรูปย่อ)
apps/
  web/   เว็บไซต์ — อ่านเนื้อหาจาก Payload (หรือ WordPress เดิม) ผ่าน REST API
    wordpress-plugin/   plugin “Headless Helpers” ของ WordPress เดิม
  cms/   Payload CMS — /admin สำหรับกองบรรณาธิการ
    scripts/migrate-wp/       สคริปต์ย้ายข้อมูลจาก WordPress
    scripts/recover-images/   หาสำเนารูปที่ลิงก์เสียในเนื้อหา (Wayback Machine)
  files/ Worker ของ files.theinsightnews.co
```

## ตอนนี้อยู่ตรงไหน

| | WordPress เดิม (ใช้งานจริง) | ระบบใหม่ (ทดสอบ) |
| --- | --- | --- |
| เว็บ | www.theinsightnews.co (worker `theinsightnews-fe`) | new.theinsightnews.co (worker `theinsightnews-web`, noindex) |
| หลังบ้าน | cms.theinsightnews.co (WordPress) | `theinsightnews-cms.<account>.workers.dev/admin` |
| ไฟล์สื่อ | files.theinsightnews.co (custom domain ของ R2 bucket `theinsightnews-media` อ่านตรงจาก R2) | ใช้ร่วมกัน |

## เริ่มต้นพัฒนา

ต้องใช้ Node 22+ และ pnpm 10

```bash
pnpm install
cp apps/cms/.env.example apps/cms/.env        # ใส่ PAYLOAD_SECRET (openssl rand -hex 32)
cp apps/web/.env.example apps/web/.env.local  # REVALIDATE_SECRET / PREVIEW_SECRET ให้ตรงกับฝั่ง CMS
pnpm --filter @theinsightnews/cms migrate:db  # สร้างตารางใน D1 local (.wrangler)
pnpm dev                                       # web :3000, cms :3001
```

- หลังบ้าน: http://localhost:3001/admin
- เว็บ: http://localhost:3000 — ตั้ง `CMS_SOURCE=wordpress` ใน `apps/web/.env.local` เพื่อกลับไปอ่านจาก WordPress เดิมได้ทุกเมื่อ

### แก้ schema ของ CMS

แก้ไฟล์ใน `apps/cms/src/collections` แล้ว

```bash
pnpm --filter @theinsightnews/cms generate:types
pnpm --filter @theinsightnews/cms migrate:create <ชื่อ>
pnpm --filter @theinsightnews/cms migrate:db
```

ปิด `push` ไว้ ทุกการเปลี่ยน schema ต้องผ่าน migration เพื่อให้ local และ production ตรงกัน

## เว็บอ่านข้อมูลจาก CMS อย่างไร

หน้าเว็บทั้งหมดเรียกข้อมูลผ่าน `apps/web/lib/api.js` เหมือนเดิม ข้างในมีสวิตช์ `CMS_SOURCE`:

- `wordpress` — เรียก `wp/v2` และ `tin/v1` ของ WordPress ตรง ๆ (แบบเดิม)
- `payload` — `apps/web/lib/payload.js` ตอบคำขอเดียวกันจาก Payload REST API โดยคืนข้อมูลรูปแบบเดียวกับ WordPress (รวม `yoast` / `yoast_head_json` ที่สร้างจากฟิลด์ SEO ใน CMS) หน้าเว็บ ฟีด และ sitemap จึงไม่ต้องแก้

การ fetch ทุกครั้งติด cache tag (`posts`, `post-{id}`, `categories`, `tags`, `users`, …) เมื่อบันทึก/เผยแพร่ใน CMS ระบบจะยิง `POST /api/revalidate` ไปที่เว็บพร้อม tag และ path ที่เปลี่ยน (`apps/cms/src/hooks/revalidate.ts`)

## โครงสร้างข้อมูลใน CMS (เทียบ WordPress)

| WordPress | Payload | หมายเหตุ |
| --- | --- | --- |
| post | `posts` | id และ slug เดิม — URL `/{slug}` ไม่เปลี่ยน, มี draft/เวอร์ชัน/autosave, ตั้งเวลาเผยแพร่ด้วย `publishedAt` |
| `_wp_old_slug` | `redirects` | slug เดิมของบทความที่เคยเปลี่ยนชื่อ → redirect ไปบทความปัจจุบัน แก้ slug หลังเผยแพร่ ระบบเพิ่มให้อัตโนมัติ |
| page | `pages` | |
| category | `categories` | หมวดแม่, noindex |
| post_tag | `tags` | `postCount` นับอัตโนมัติ (แท็กที่มีบทความน้อยกว่า 3 เรื่องเป็น noindex เหมือนเดิม) |
| attachment | `media` | R2 bucket `theinsightnews-media` ที่ path `wp-content/uploads/{ปี}/{เดือน}/{ไฟล์}` — path เดียวกับ WordPress ลิงก์รูปเดิมจึงใช้ได้ต่อ |
| user | `users` | บทบาท admin / editor / author, เลือกได้ว่าจะแสดงชื่อเป็นผู้เขียนหรือ “กองบรรณาธิการ” |
| Yoast SEO | `meta` (SEO plugin) | title, description, รูป OG, canonical, noindex/nofollow |

ข่าวใหม่ที่บันทึกโดยไม่ใส่ slug: Claude ตั้ง slug ภาษาอังกฤษจากหัวข้อและเนื้อหาให้ ในรูปแบบเดียวกับ URL เดิมของเว็บ (`apps/cms/src/lib/ai-slug.ts`, ต้องตั้ง secret `ANTHROPIC_API_KEY`) ข้าม autosave, ข่าวที่มี slug แล้วไม่ถูกแตะ (ลบ slug ทิ้งจะได้ค่าเดิมคืน), ถ้าเรียก Claude ไม่ได้จะใช้ slug จากหัวข้อแทน

เนื้อหาเก็บเป็น Lexical (แก้ไขได้ใน editor) และสร้าง `contentHtml` + เวลาอ่าน (`readingMinutes`) อัตโนมัติทุกครั้งที่บันทึก

### รูปภาพ

- CMS สร้างรูปย่อ WebP ตามขนาดที่หน้าเว็บใช้ (`packages/shared/src/image-sizes.ts`) เก็บข้างไฟล์ต้นฉบับ เช่น `x.jpg` → `x-320w.webp`, `x-768w.webp`, `x-1280w.webp`
  - อัปโหลดใหม่ใน CMS: สร้างให้อัตโนมัติด้วย Cloudflare Images binding
  - รูปเดิมที่ย้ายมา: `pnpm migrate:wp --steps=sizes` (ย่อด้วย sharp บนเครื่อง)
- เว็บเรียกไฟล์จาก files.theinsightnews.co ตรง ๆ ไม่ผ่าน Next Image รูปในเนื้อหาใช้ `<picture>` (WebP + ไฟล์ต้นฉบับเป็น fallback) ระหว่างที่รูปย่อยังไม่ครบ เว็บใช้ไฟล์ต้นฉบับ (`sizesReady`)
- ไฟล์ต้นฉบับและรูปย่อที่ WordPress สร้างไว้ (`-300x169.jpg` ฯลฯ) ถูกคัดลอกเข้า R2 ด้วย เพราะเว็บ WordPress เดิมยังลิงก์ถึง
- files.theinsightnews.co เป็น custom domain ของ R2 bucket `theinsightnews-media` (ตั้งแต่ 2026-11-03) รูปอ่านตรงจาก R2 ไม่ผ่าน worker · `apps/files` เป็น worker เดิมที่เก็บไว้เผื่อย้อนกลับ (ไม่มี route)
- รูปในเนื้อหาที่ลิงก์ไปเว็บที่ปิดแล้ว (เช่น songsue.co): หน้า **กู้รูปที่หายไป** ใน admin (`/admin/image-recovery`) ให้บรรณาธิการเทียบสำเนาจาก Wayback แล้วกดใช้ (เข้าคลังสื่อ + แก้ข่าว) หรือลบรูปเสียออก รายการสร้างด้วย `apps/cms/scripts/recover-images/`

## ส่งข่าวเข้ามาเป็นฉบับร่าง (API)

`POST /api/posts/drafts` บน CMS ให้ระบบอื่นส่งเนื้อหาเข้ามาเป็น **ฉบับร่าง** เสมอ ไม่มีอะไรขึ้นเว็บจนกว่ากองบรรณาธิการจะกดเผยแพร่ใน admin (โค้ด: `apps/cms/src/endpoints/drafts.ts`)

ยืนยันตัวตนด้วย API key ของผู้ใช้ใน CMS (Users → เลือกผู้ใช้ → Enable API key) ผู้ใช้คนนั้นจะเป็นผู้เขียน และใช้สิทธิ์ตามบทบาท (author แก้ได้เฉพาะเรื่องของตัวเอง)

```bash
curl -X POST https://<cms>/api/posts/drafts \
  -H "Authorization: users API-Key $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "หัวข้อข่าว",
    "html": "<p>เนื้อหา…</p><figure><img src=\"https://example.com/a.jpg\"><figcaption>คำบรรยาย</figcaption></figure>",
    "excerpt": "สรุปสั้น",
    "categories": ["politics", 3094],
    "tags": ["AI", "เศรษฐกิจ"],
    "featuredImage": "https://example.com/cover.jpg",
    "publishedAt": "2026-11-05T09:00:00+07:00"
  }'
# → 201 { "id": 1000001, "slug": "…", "status": "draft", "adminUrl": "…", "url": "…" }
```

| ฟิลด์ | |
| --- | --- |
| `title` | ต้องมีเมื่อสร้างใหม่ |
| `html` หรือ `markdown` | เนื้อหา แปลงเป็น Lexical ให้แก้ต่อใน editor ได้ (หัวข้อ ย่อหน้า ลิงก์ รายการ รูป YouTube/embed; ตาราง/อื่น ๆ เป็น block HTML) |
| `categories` | slug หรือ id ต้องมีเมื่อสร้างใหม่ ตัวแรกคือหมวดหลัก |
| `tags` | ชื่อแท็ก ถ้ายังไม่มีจะสร้างให้ |
| `featuredImage` | id ในคลังสื่อ หรือ URL รูป |
| `excerpt`, `slug`, `publishedAt`, `sticky`, `meta.title`, `meta.description` | ไม่บังคับ — slug ซ้ำจะเติม `-2`, `-3` ให้ |
| `author` | id ผู้ใช้ (เฉพาะ editor/admin) |
| `id` | ส่งมาเพื่อแก้ร่างของเรื่องเดิม — เรื่องที่เผยแพร่แล้วยังแสดงฉบับเดิมจนกว่าจะกดเผยแพร่ |

รูปใน `html` ที่อยู่บน files.theinsightnews.co ผูกกับรูปในคลังสื่อเดิม รูปจากเว็บอื่นถูกดาวน์โหลดเข้าคลังสื่อ (สูงสุด 40 รูป รูปละไม่เกิน 20 MB) แล้วระบบสร้างรูปย่อ WebP ให้

เอกสารที่สร้างใน CMS ได้ id ตั้งแต่ 1,000,001 (`apps/cms/src/hooks/id-floor.ts`) เพื่อไม่ชนกับ id ของ WordPress ที่ยังออกเรื่อย ๆ จนวันย้ายระบบ

## ย้ายข้อมูลจาก WordPress

```bash
cd apps/cms
pnpm migrate:wp                          # users → categories → tags → media → posts → pages → redirects → counts (ลง D1 local)
pnpm migrate:wp --steps=posts --limit=50 # ทดลองบางส่วน
pnpm migrate:wp --since=2026-11-01       # เฉพาะที่แก้ไขหลังวันที่ (อัปเดตของเดิมด้วย)
pnpm migrate:wp --steps=files            # คัดลอกไฟล์สื่อ (ต้นฉบับ + ทุกขนาด) เข้า R2
pnpm migrate:wp --steps=sizes            # สร้างรูปย่อ WebP แล้ว mark sizesReady
```

- รันซ้ำได้ ข้ามรายการที่มีแล้ว จำหน้าที่ทำถึงไว้ใน `.migrate/state.json` (`--restart` เริ่มใหม่)
- ตัวเลือก: `--update` เขียนทับของเดิม, `--ids=1,2,3`, `--concurrency=6`, `--yoast=false` ข้ามค่า SEO ของ Yoast
- ใส่ `WP_USER` + `WP_APP_PASSWORD` (Application Password) ใน `.env` เพื่อดึงฉบับร่างและอีเมลจริงของผู้ใช้ ถ้าไม่ใส่จะได้เฉพาะที่เผยแพร่แล้ว และผู้ใช้ได้อีเมลชั่วคราว `…@users.theinsightnews.invalid` (admin ต้องแก้เป็นอีเมลจริงก่อนให้คนนั้นกด “ลืมรหัสผ่าน”)
- ผู้ใช้ที่ย้ายมา **ไม่มีรหัสผ่าน** (hash ของ WordPress ใช้กับ Payload ไม่ได้) ให้แต่ละคนตั้งเองผ่าน “ลืมรหัสผ่าน”
- ขั้น `redirects` อ่าน `/wp-json/tin/v1/old-slugs` ซึ่งมีใน plugin ตั้งแต่ 1.11.0 — ต้องอัปเดต `apps/web/wordpress-plugin/tin-cdn-rewrite.php` บน WordPress ก่อน (ถ้ายังไม่อัปเดต ขั้นนี้จะข้ามไป)
- ภาพที่หาในคลังสื่อไม่เจอ และบทความที่ย้ายไม่สำเร็จ บันทึกใน `.migrate/*-warnings.log`

## Deploy บน Cloudflare

ใช้ Workers Paid plan (bundle ของ Payload เกิน 3 MB)

ครั้งแรก (resource สร้างแล้ว id อยู่ใน `wrangler.jsonc`):

```bash
cd apps/cms
npx wrangler secret put PAYLOAD_SECRET     # openssl rand -hex 32
npx wrangler secret put REVALIDATE_SECRET
npx wrangler secret put PREVIEW_SECRET
npx wrangler secret put ANTHROPIC_API_KEY  # Claude ตั้ง slug ให้ข่าวใหม่ (ไม่ใส่ = slug จากหัวข้อ)
npx wrangler email sending enable notify.theinsightnews.co   # อีเมลลืมรหัสผ่าน (subdomain ไม่แตะ MX ของโดเมนหลัก)

cd ../web
npx wrangler secret put REVALIDATE_SECRET  # ค่าเดียวกับ CMS
npx wrangler secret put PREVIEW_SECRET     # ค่าเดียวกับ CMS
npx wrangler secret put CMS_PREVIEW_API_KEY  # API key ของผู้ใช้ใน CMS (เปิดในหน้าโปรไฟล์) สำหรับปุ่ม Preview
```

ข้อมูลขึ้น production (ย้ายลง local ก่อนแล้วอัปโหลดทีเดียว เร็วกว่าเขียนทีละแถว):

```bash
cd apps/cms
pnpm deploy:database   # schema ลง D1 remote
pnpm deploy:app        # deploy CMS แล้วสร้างบัญชี admin แรกที่ /admin
pnpm push:db           # คัดลอกข้อมูลจาก local ขึ้น D1 remote (ครั้งเดียว, ข้าม user ที่มีอยู่แล้ว)
```

Deploy ปกติ:

```bash
pnpm deploy:cms   # payload migrate กับ D1 remote แล้ว deploy Worker
pnpm deploy:web
```

`pnpm deploy` เฉย ๆ ชนกับคำสั่งของ pnpm ให้ใช้ `pnpm run deploy` หรือคำสั่งด้านบน

### เว็บจริง (www) ก่อนวันย้ายระบบ

โค้ดเว็บชุดเดียวกัน แต่ใช้ `apps/web/wrangler.live.jsonc` + `open-next.live.config.ts`: worker `theinsightnews-fe`, อ่านจาก WordPress (`CMS_SOURCE=wordpress`), ISR cache ใน KV, ไม่มี noindex

```bash
cd apps/web
pnpm build:live && pnpm deploy:live
```

Workers Builds ของ `theinsightnews-fe` (branch main) ต้องตั้งเป็น: Root directory `apps/web`, Build command `pnpm build:live`, Deploy command `pnpm deploy:live`

## วันย้ายระบบจริง (cutover)

1. งดแก้ไขใน WordPress
2. `PAYLOAD_REMOTE=1 pnpm migrate:wp --since=<วันที่ย้ายรอบแรก>` แล้ว `--steps=files` และ `--steps=sizes`
3. `apps/web/wrangler.jsonc`: เปลี่ยน `routes` เป็น www / apex แล้วลบ `SITE_NOINDEX`; `apps/cms/wrangler.jsonc`: เพิ่ม route `cms.theinsightnews.co`, ตั้ง `CMS_URL` / `WEB_URL` เป็นโดเมนจริง (และ `CMS_URL` ของเว็บ) แล้ว deploy ทั้งสองแอป
4. files.theinsightnews.co ย้ายเป็น custom domain ของ R2 แล้ว (ทำแล้ว 2026-11-03) ตั้ง Cache Rule ให้ host นี้ cache 1 ปี
5. ส่ง sitemap ใน Search Console

ย้อนกลับ: ตั้ง `CMS_SOURCE=wordpress` ใน `apps/web/wrangler.jsonc` แล้ว deploy เว็บ

## เอกสารเดิม

`apps/web/README.md` — การตั้งค่าเว็บกับ WordPress เดิม (plugin, DNS, cache)
