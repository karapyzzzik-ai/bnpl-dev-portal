# bnpl.kz Dev Portal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `https://bnpl.kz/dev-portal/` as a standalone, modern documentation site (Nextra/Next.js), with the same content, RU+EN, light/dark theme, search, and a live API-try-it panel, deployed to Vercel via GitHub.

**Architecture:** Nextra 3 (App Router) project with content stored as MDX under `content/ru/` and `content/en/`, a small custom middleware for locale routing, and a client-side `ApiPlayground` React component embedded in method pages that performs live `fetch` calls to bnpl's DEV/STAGE endpoints.

**Tech Stack:** Next.js 14 (App Router), Nextra 3 + nextra-theme-docs, TypeScript, Vitest (unit tests for the playground's pure logic), Firecrawl MCP (content scraping), Playwright/Chrome DevTools MCP (fallback scraping for click-revealed content), git + GitHub CLI (`gh`), Vercel.

## Global Constraints

- Content scope is the entire existing dev-portal, per the real 28-URL site map in `data/source-urls.json` (Task 3) — not the narrower list originally guessed in this plan. Real path prefix is `/dev-portal/docs-api/...` (not `/dev-portal/...` directly). Sections: Введение (root), Customer journey (+ `widget`, `android-biometry` subpages), Методы (Авторизация, Скоринг, Изменение статуса заказа × 4, Получение статуса заказа), BCC Mall (+ `api` subpage), Лимит на рассрочку (+ `get-limit-data` subpage), Маркетинг (+ `card-product`, `payment-schedule` subpages), **FAQ** (`general`, `post-service`), and **Документация брокера / docs-broker** (`authorization`, `get-scoring`, `new-preapp`, `approve`, `get-status`) — the latter two sections were discovered during Task 3's real site crawl and are in scope per explicit user confirmation. No invented content.
- Stack must be Next.js-based (Nextra), matching the original site.
- Two locales: `ru` (primary/source of truth) and `en` (translation; technical identifiers like `orderId`, `merchantId`, `delivered`, `buyed` stay untranslated).
- Theme: light "Clean Light" (blue accent, ~`#2563eb`) as default, dark theme available via toggle.
- Client-side search enabled.
- Code examples are curl-only (no added language tabs) — matches the original.
- API Playground performs real `fetch` calls from the browser to `dev.bnpl.kz`/`stage.bnpl.kz`; no credentials or form values are persisted anywhere.
- Repo name: `bnpl-dev-portal`, public, on the user's GitHub account. Deploy target: Vercel, connected to the GitHub repo, auto-deploy on push to `main`.

---

### Task 1: Project scaffold (Nextra + Next.js skeleton)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `middleware.ts`
- Create: `mdx-components.tsx`
- Create: `app/[lang]/layout.tsx`
- Create: `app/[lang]/[[...mdxPath]]/page.tsx`
- Create: `content/ru/index.mdx`
- Create: `content/ru/_meta.json`
- Create: `content/en/index.mdx`
- Create: `content/en/_meta.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: locale-prefixed routing (`/ru/...`, `/en/...`) that every later content task relies on; content files live under `content/<lang>/...` and are resolved by `importPage([lang, ...mdxPath])`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bnpl-dev-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "check-content": "node scripts/check-content-parity.mjs"
  },
  "dependencies": {
    "next": "^14.2.5",
    "nextra": "^3.0.15",
    "nextra-theme-docs": "^3.0.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, exit code 0.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
import nextra from 'nextra'

const withNextra = nextra({})

export default withNextra({
  reactStrictMode: true
})
```

- [ ] **Step 5: Create `middleware.ts`** (locale prefix redirect — no locale in URL redirects to `/ru/...`)

```ts
import { NextRequest, NextResponse } from 'next/server'

const SUPPORTED_LOCALES = ['ru', 'en']
const DEFAULT_LOCALE = 'ru'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasLocale = SUPPORTED_LOCALES.some(
    locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
  if (hasLocale) {
    return NextResponse.next()
  }
  const url = request.nextUrl.clone()
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)']
}
```

- [ ] **Step 6: Create `mdx-components.tsx`**

```tsx
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components: Record<string, unknown> = {}) {
  return {
    ...docsComponents,
    ...components
  }
}
```

- [ ] **Step 7: Create `app/[lang]/layout.tsx`**

```tsx
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: 'bnpl developers'
}

const navbar = <Navbar logo={<b>bnpl developers</b>} />
const footer = <Footer>{new Date().getFullYear()} © bnpl.kz</Footer>

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <html lang={lang} dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap(`/${lang}`)}
          footer={footer}
          docsRepositoryBase="https://github.com/REPLACE_WITH_GH_USERNAME/bnpl-dev-portal"
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: Create `app/[lang]/[[...mdxPath]]/page.tsx`**

```tsx
import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents as getMDXComponents } from '../../../mdx-components'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

export async function generateMetadata(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>
}) {
  const params = await props.params
  const { metadata } = await importPage([params.lang, ...(params.mdxPath || [])])
  return metadata
}

const Wrapper = getMDXComponents().wrapper

export default async function Page(props: {
  params: Promise<{ lang: string; mdxPath?: string[] }>
}) {
  const params = await props.params
  const result = await importPage([params.lang, ...(params.mdxPath || [])])
  const { default: MDXContent, toc, metadata } = result
  return (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  )
}
```

- [ ] **Step 9: Create placeholder home content**

`content/ru/index.mdx`:
```mdx
# bnpl developers

Документация для интеграции с bnpl.kz: авторизация, скоринг, управление статусом заказа и лимитами рассрочки.
```

`content/ru/_meta.json`:
```json
{
  "index": "Введение"
}
```

`content/en/index.mdx`:
```mdx
# bnpl developers

Integration documentation for bnpl.kz: authorization, scoring, order status management, and installment limits.
```

`content/en/_meta.json`:
```json
{
  "index": "Introduction"
}
```

- [ ] **Step 10: Create `.gitignore`**

```
node_modules/
.next/
.vercel/
*.log
.superpowers/
```

- [ ] **Step 11: Verify the dev server serves both locale homepages**

Run: `npm run dev` (in background), then in a second terminal:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en
```
Expected: both print `200`. Stop the dev server after verifying.

- [ ] **Step 12: Commit**

```bash
git add package.json tsconfig.json next.config.mjs middleware.ts mdx-components.tsx app content .gitignore
git commit -m "Scaffold Nextra project with ru/en locale routing"
```

---

### Task 2: Theme — Clean Light + dark toggle, brand navbar

**Files:**
- Modify: `app/[lang]/layout.tsx`
- Create: `app/globals.css`
- Modify: `app/[lang]/layout.tsx` to import `./globals.css`

**Interfaces:**
- Consumes: `Layout`, `Navbar`, `Footer` from Task 1's layout.
- Produces: CSS custom properties (`--bnpl-accent`) later tasks (playground UI) may reuse.

- [ ] **Step 1: Create `app/globals.css`**

```css
:root {
  --bnpl-accent: #2563eb;
}

.nextra-nav-container {
  backdrop-filter: none !important;
  background-color: var(--nextra-bg) !important;
}

a[data-active='true'] {
  color: var(--bnpl-accent) !important;
}
```

- [ ] **Step 2: Import the stylesheet in the layout**

In `app/[lang]/layout.tsx`, add near the top:
```tsx
import './globals.css'
```

- [ ] **Step 3: Verify theme toggle and accent color render**

Run: `npm run dev`, open `http://localhost:3000/ru` in a browser (or via the already-installed Playwright MCP: `browser_navigate` to that URL, then `browser_snapshot`).
Expected: page loads with light background; a theme toggle control is present in the navbar/sidebar (Nextra ships this by default); clicking it switches to a dark background without errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/[lang]/layout.tsx
git commit -m "Add Clean Light theme accent and confirm dark toggle"
```

---

### Task 3: Map source site structure

**Files:**
- Create: `data/source-urls.json`
- Create: `scripts/validate-source-urls.mjs`

**Interfaces:**
- Produces: `data/source-urls.json` — a JSON array of absolute URLs under `https://bnpl.kz/dev-portal/`, consumed by Tasks 4–6 as the scrape worklist.

- [ ] **Step 1: Call the Firecrawl MCP `firecrawl_map` tool**

Call `firecrawl_map` with `url: "https://bnpl.kz/dev-portal/"`. Take the returned list of URLs and write them, deduplicated and sorted, to `data/source-urls.json` as a JSON array of strings, e.g.:

```json
[
  "https://bnpl.kz/dev-portal/",
  "https://bnpl.kz/dev-portal/customer-journey/",
  "https://bnpl.kz/dev-portal/methods/",
  "https://bnpl.kz/dev-portal/methods/scoring/",
  "https://bnpl.kz/dev-portal/methods/change-status/delivery/",
  "https://bnpl.kz/dev-portal/methods/change-status/cancel/",
  "https://bnpl.kz/dev-portal/methods/change-status/return/",
  "https://bnpl.kz/dev-portal/methods/change-status/part-return/",
  "https://bnpl.kz/dev-portal/methods/preapp/",
  "https://bnpl.kz/dev-portal/bcc-mall/connection/google-feed/",
  "https://bnpl.kz/dev-portal/installment-limit/",
  "https://bnpl.kz/dev-portal/marketing/"
]
```
(This is the known set from manual exploration; replace/extend with whatever `firecrawl_map` actually returns — the map call is authoritative, this list is the expected shape.)

- [ ] **Step 2: Write `scripts/validate-source-urls.mjs`**

```js
import { readFileSync } from 'node:fs'

const urls = JSON.parse(readFileSync('data/source-urls.json', 'utf-8'))

if (!Array.isArray(urls) || urls.length === 0) {
  console.error('FAIL: source-urls.json is empty or not an array')
  process.exit(1)
}

const badUrl = urls.find(u => typeof u !== 'string' || !u.startsWith('https://bnpl.kz/dev-portal'))
if (badUrl) {
  console.error(`FAIL: unexpected URL in list: ${badUrl}`)
  process.exit(1)
}

console.log(`OK: ${urls.length} URLs, all under https://bnpl.kz/dev-portal`)
```

- [ ] **Step 3: Run the validation script**

Run: `node scripts/validate-source-urls.mjs`
Expected: `OK: <N> URLs, all under https://bnpl.kz/dev-portal`

- [ ] **Step 4: Commit**

```bash
git add data/source-urls.json scripts/validate-source-urls.mjs
git commit -m "Add source URL map from firecrawl_map"
```

---

### Task 4: RU content — Введение, Customer Journey, top-level Методы pages

**Files:**
- Modify: `content/ru/index.mdx` (replace placeholder with real scraped intro content)
- Create: `content/ru/customer-journey/index.mdx`
- Create: `content/ru/customer-journey/widget.mdx`
- Create: `content/ru/customer-journey/android-biometry.mdx`
- Create: `content/ru/customer-journey/_meta.json`
- Create: `content/ru/methods/index.mdx`
- Create: `content/ru/methods/auth.mdx`
- Create: `content/ru/methods/scoring.mdx`
- Create: `content/ru/methods/preapp.mdx`
- Create: `content/ru/methods/_meta.json`
- Modify: `content/ru/_meta.json`

**Interfaces:**
- Consumes: `data/source-urls.json` from Task 3 (the real 28-URL map; real prefix is `/dev-portal/docs-api/...`).
- Produces: the `methods/_meta.json` ordering and `methods/change-status/` slot that Task 5 adds to.

- [ ] **Step 1: Scrape each URL**

For each of these real URLs from `data/source-urls.json`, call the Firecrawl MCP `firecrawl_scrape` tool (format: markdown) and keep the returned markdown for the next step:
- `https://bnpl.kz/dev-portal/` (root — install/intro content)
- `https://bnpl.kz/dev-portal/docs-api/customer-journey/`
- `https://bnpl.kz/dev-portal/docs-api/customer-journey/widget/`
- `https://bnpl.kz/dev-portal/docs-api/customer-journey/android-biometry/`
- `https://bnpl.kz/dev-portal/docs-api/methods/`
- `https://bnpl.kz/dev-portal/docs-api/methods/scoring/`
- `https://bnpl.kz/dev-portal/docs-api/methods/preapp/`

If a page's content looks incomplete (collapsed sections not expanded, e.g. "Запрос" / "Пример запроса" / "Структура запроса" toggles), fall back to the Playwright MCP: `browser_navigate` to the URL, `browser_click` each collapsed toggle, then `browser_snapshot` to read the revealed text.

Auth: the nav shows "Авторизация" linking to `https://bnpl.kz/dev-portal/docs-api/methods/` (same page as the methods index) — check the scraped `methods/` page for an auth-specific section for `methods/auth.mdx`.

- [ ] **Step 2: Write each MDX file with real content and frontmatter**

Use this shape (shown for `content/ru/index.mdx` — repeat the pattern with each page's actual scraped text for the other files):

```mdx
# Введение

<!-- Replace this comment with the actual scraped introduction content,
     preserving headings, lists, and any code blocks as-is. -->
```

Each file must contain the **actual scraped text** for that page — not a placeholder. `customer-journey/index.mdx` is the customer-journey landing page; `customer-journey/widget.mdx` and `customer-journey/android-biometry.mdx` are its two sub-pages. `methods/auth.mdx` covers authorization; `methods/scoring.mdx` covers "Создание заявки и получение результатов скоринга" (keep the curl example, request/response structure, and field tables from the source); `methods/preapp.mdx` covers "Получение статуса заказа".

- [ ] **Step 2b: Write `content/ru/customer-journey/_meta.json`**

```json
{
  "index": "Интерфейс клиентского пути",
  "widget": "Виджет",
  "android-biometry": "Биометрия (Android)"
}
```
(Adjust the two sub-page labels to match their actual scraped page titles if different.)

- [ ] **Step 3: Write `content/ru/methods/_meta.json`**

```json
{
  "auth": "Авторизация",
  "scoring": "Создание заявки и получение результатов скоринга",
  "change-status": "Изменение статуса заказа",
  "preapp": "Получение статуса заказа"
}
```

- [ ] **Step 4: Update `content/ru/_meta.json`**

```json
{
  "index": "Введение",
  "customer-journey": "Интерфейс клиентского пути",
  "methods": "Методы"
}
```

- [ ] **Step 5: Verify pages render**

Run: `npm run dev`, then:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/customer-journey
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/customer-journey/widget
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/customer-journey/android-biometry
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/scoring
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/preapp
```
Expected: all print `200`.

- [ ] **Step 6: Commit**

```bash
git add content/ru
git commit -m "Add RU content: intro, customer journey, auth/scoring/preapp"
```

---

### Task 5: RU content — Изменение статуса заказа (change-status group)

**Files:**
- Create: `content/ru/methods/change-status/delivery.mdx`
- Create: `content/ru/methods/change-status/cancel.mdx`
- Create: `content/ru/methods/change-status/return.mdx`
- Create: `content/ru/methods/change-status/part-return.mdx`
- Create: `content/ru/methods/change-status/_meta.json`

**Interfaces:**
- Produces: four MDX files whose request/response JSON blocks Task 9's `ApiPlayground` field-configs (Task 10) are generated from — keep the `merchantId`/`orders[].amount`/`orderId`/`status` field names exact and consistent across all four.

- [ ] **Step 1: Write `content/ru/methods/change-status/delivery.mdx`** (content already captured from the live site during MCP verification — use verbatim)

```mdx
# Доставка/Частичная доставка

- Рассрочка по заказу клиента одобрена (статус completed/успешный заказ)
- Мерчант совершает доставку товара
- Мерчант отправляет статус "delivered" по API
- Система изменяет статус на "delivered"/"доставлен"
- Система изменяет статус на "buyed"/"выкуплен"

**Метод:** PUT

**URL**
- DEV: `https://dev.bnpl.kz/api/accounting/v1/changeStatus/json`
- STAGE: `https://stage.bnpl.kz/api/accounting/v1/changeStatus/json`

## Пример запроса

```bash
curl -X 'PUT' \
  'https://dev.bnpl.kz/api/accounting/v1/changeStatus/json' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '[
  {
    "merchantId": "string",
    "orders": [
      {
        "amount": int,
        "orderId": "string",
        "status": "string"
      }
    ]
  }
]'
```

После отправки запроса на доставку статус заказа меняется на «delivered». Статус «delivered» является промежуточным статусом системы и меняется на «buyed» (финальный успешный статус заказа) в течение 5-7 минут.

В поле `amount` можно передать значение **меньше**, чем первоначальная сумма заказа, тем самым вызвав «частичную доставку». Пример: клиент оформил заказ на 100 000 тг. в рассрочку и при доставке товара/самовывозе готов взять только на 80 000 тг.

Условие частичной доставки: сумма заказа должна быть не менее 500 тг.

## Успешный ответ

```json
{
  "messageId": "",
  "SuccessfulResponses": [
    {
      "error": "false",
      "msg": "cтатус заказа по MerchantId = test.kz и MerchantOrderId = 000000 успешно обновлен",
      "merchantOrderId": "000000"
    }
  ],
  "ErrorResponses": []
}
```

<ApiPlayground
  method="PUT"
  devUrl="https://dev.bnpl.kz/api/accounting/v1/changeStatus/json"
  stageUrl="https://stage.bnpl.kz/api/accounting/v1/changeStatus/json"
  fields={[
    { name: 'merchantId', type: 'string', required: true },
    { name: 'orderId', type: 'string', required: true },
    { name: 'amount', type: 'number', required: true },
    { name: 'status', type: 'string', required: true, defaultValue: 'delivered' }
  ]}
/>
```

- [ ] **Step 2: Scrape and write `cancel.mdx`, `return.mdx`, `part-return.mdx`**

For each of `https://bnpl.kz/dev-portal/docs-api/methods/change-status/cancel/`, `.../return/`, `.../part-return/`: call `firecrawl_scrape` (falling back to Playwright MCP click+snapshot for any collapsed sections, same as Task 4 Step 1), then write an MDX file following the **exact same structure** as `delivery.mdx` above (title, bullet flow, Метод/URL, curl example, explanation prose, success/error JSON, `<ApiPlayground>` block with that page's real field names and `status` default value, e.g. `cancelled`/`returned` — read the real value from the scraped success-response JSON, don't guess).

- [ ] **Step 3: Write `content/ru/methods/change-status/_meta.json`**

```json
{
  "delivery": "Доставка/частичная доставка",
  "cancel": "Отмена",
  "return": "Возврат",
  "part-return": "Частичный возврат"
}
```

- [ ] **Step 4: Verify all four pages render**

Run: `npm run dev`, then:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/delivery
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/cancel
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/return
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/part-return
```
Expected: all print `200`. (The `<ApiPlayground>` component won't exist yet until Task 9 — expect a build/render error mentioning `ApiPlayground` is undefined; that's expected at this point. Re-run this same check again after Task 10 to confirm it's fully green.)

- [ ] **Step 5: Commit**

```bash
git add content/ru/methods/change-status
git commit -m "Add RU content: change-status group (delivery/cancel/return/part-return)"
```

---

### Task 6: RU content — BCC Mall, Лимит на рассрочку, Маркетинг

**Files:**
- Create: `content/ru/bcc-mall/index.mdx`
- Create: `content/ru/bcc-mall/api.mdx`
- Create: `content/ru/bcc-mall/_meta.json`
- Create: `content/ru/installment-limit/index.mdx`
- Create: `content/ru/installment-limit/get-limit-data.mdx`
- Create: `content/ru/installment-limit/_meta.json`
- Create: `content/ru/marketing/index.mdx`
- Create: `content/ru/marketing/card-product.mdx`
- Create: `content/ru/marketing/payment-schedule.mdx`
- Create: `content/ru/marketing/_meta.json`
- Modify: `content/ru/_meta.json`

- [ ] **Step 1: Scrape and write each page**

Scrape and write, one MDX file per real URL from `data/source-urls.json`:
- `https://bnpl.kz/dev-portal/docs-api/bcc-mall/connection/google-feed/` → `bcc-mall/index.mdx`
- `https://bnpl.kz/dev-portal/docs-api/bcc-mall/api/` → `bcc-mall/api.mdx`
- `https://bnpl.kz/dev-portal/docs-api/installment-limit/` → `installment-limit/index.mdx`
- `https://bnpl.kz/dev-portal/docs-api/installment-limit/get-limit-data/` → `installment-limit/get-limit-data.mdx`
- `https://bnpl.kz/dev-portal/docs-api/marketing/` → `marketing/index.mdx`
- `https://bnpl.kz/dev-portal/docs-api/marketing/card-product/` → `marketing/card-product.mdx`
- `https://bnpl.kz/dev-portal/docs-api/marketing/payment-schedule/` → `marketing/payment-schedule.mdx`

Each file's top-level `#` heading should match its real scraped page title. Write a `_meta.json` per folder (`bcc-mall/_meta.json`, `installment-limit/_meta.json`, `marketing/_meta.json`) ordering `index` first, then sub-pages with their real titles as labels.

- [ ] **Step 2: Update `content/ru/_meta.json`**

```json
{
  "index": "Введение",
  "customer-journey": "Интерфейс клиентского пути",
  "methods": "Методы",
  "bcc-mall": "BCC Mall",
  "installment-limit": "Лимит на рассрочку",
  "marketing": "Маркетинг"
}
```

- [ ] **Step 3: Verify pages render**

```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/bcc-mall
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/bcc-mall/api
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/installment-limit
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/installment-limit/get-limit-data
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/marketing
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/marketing/card-product
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/marketing/payment-schedule
```
Expected: all `200`.

- [ ] **Step 4: Commit**

```bash
git add content/ru/bcc-mall content/ru/installment-limit content/ru/marketing content/ru/_meta.json
git commit -m "Add RU content: BCC Mall, installment limit, marketing"
```

---

### Task 7: RU content — FAQ

**Files:**
- Create: `content/ru/faq/index.mdx`
- Create: `content/ru/faq/general.mdx`
- Create: `content/ru/faq/post-service.mdx`
- Create: `content/ru/faq/_meta.json`
- Modify: `content/ru/_meta.json`

**Interfaces:**
- Consumes: `data/source-urls.json` from Task 3 (FAQ URLs).

This section was discovered during Task 3's real site crawl (not in the original plan) and is in scope per explicit user confirmation to cover the entire real site.

- [ ] **Step 1: Scrape and write each page**

Scrape and write:
- `https://bnpl.kz/dev-portal/FAQ/` → `faq/index.mdx`
- `https://bnpl.kz/dev-portal/FAQ/general/` → `faq/general.mdx`
- `https://bnpl.kz/dev-portal/FAQ/post-service/` → `faq/post-service.mdx`

Use each page's real scraped title as the `#` heading. If a page turns out to be a Q&A list, preserve the question/answer structure as-is (headings or bold question + answer paragraph) rather than flattening it into plain prose.

- [ ] **Step 2: Write `content/ru/faq/_meta.json`**

```json
{
  "index": "FAQ",
  "general": "Общие вопросы",
  "post-service": "После подключения"
}
```
(Adjust labels to match the real scraped page titles if different.)

- [ ] **Step 3: Update `content/ru/_meta.json`** — add `"faq": "FAQ"` as an entry (position it last, after `marketing`, matching the source site's nav order where FAQ is a separate top-level tab).

- [ ] **Step 4: Verify pages render**

```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/faq
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/faq/general
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/faq/post-service
```
Expected: all `200`.

- [ ] **Step 5: Commit**

```bash
git add content/ru/faq content/ru/_meta.json
git commit -m "Add RU content: FAQ"
```

---

### Task 8: RU content — Документация брокера (docs-broker)

**Files:**
- Create: `content/ru/broker/index.mdx`
- Create: `content/ru/broker/authorization.mdx`
- Create: `content/ru/broker/get-scoring.mdx`
- Create: `content/ru/broker/new-preapp.mdx`
- Create: `content/ru/broker/approve.mdx`
- Create: `content/ru/broker/get-status.mdx`
- Create: `content/ru/broker/_meta.json`
- Modify: `content/ru/_meta.json`

**Interfaces:**
- Consumes: `data/source-urls.json` from Task 3 (docs-broker URLs).
- Produces: MDX pages that Task 9's `ApiPlayground` may also be embedded into (Task 10 extends to check these pages too), if these pages describe request/response API methods the same way the change-status pages do — read each page's actual content to confirm before adding `<ApiPlayground>` blocks; if a page is pure prose with no request/response shape, leave it as plain MDX.

This section (broker integration docs) was discovered during Task 3's real site crawl (not in the original plan) and is in scope per explicit user confirmation to cover the entire real site.

- [ ] **Step 1: Scrape each URL**

Scrape:
- `https://bnpl.kz/dev-portal/docs-broker/` → `broker/index.mdx`
- `https://bnpl.kz/dev-portal/docs-broker/authorization/` → `broker/authorization.mdx`
- `https://bnpl.kz/dev-portal/docs-broker/get-scoring/` → `broker/get-scoring.mdx`
- `https://bnpl.kz/dev-portal/docs-broker/new-preapp/` → `broker/new-preapp.mdx`
- `https://bnpl.kz/dev-portal/docs-broker/approve/` → `broker/approve.mdx`
- `https://bnpl.kz/dev-portal/docs-broker/get-status/` → `broker/get-status.mdx`

Same collapsed-section fallback as Task 4 Step 1 (Playwright MCP click+snapshot) if any page's request/response examples are hidden behind a toggle.

- [ ] **Step 2: Write each MDX file**

Follow the `delivery.mdx` structure from Task 5 (title, description, Метод/URL, curl example, success/error response) for any page that documents an HTTP method + endpoint. For each such page, add an `<ApiPlayground>` block with that page's real method, URL, and field names — do not reuse the change-status field names (`orderId`/`amount`/`status`) if this API's request body has a different shape; read the actual scraped request structure and generate the `fields` prop to match it exactly.

- [ ] **Step 3: Write `content/ru/broker/_meta.json`**

```json
{
  "index": "Документация брокера",
  "authorization": "Авторизация",
  "get-scoring": "Получение скоринга",
  "new-preapp": "Создание заявки",
  "approve": "Подтверждение",
  "get-status": "Получение статуса"
}
```
(Adjust labels to match the real scraped page titles if different.)

- [ ] **Step 4: Update `content/ru/_meta.json`** — add `"broker": "Документация брокера"` (position after `methods`, matching the source site's nav order where broker docs are a separate top-level tab near the API docs).

- [ ] **Step 5: Verify pages render**

```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/broker
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/broker/authorization
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/broker/get-scoring
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/broker/new-preapp
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/broker/approve
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/broker/get-status
```
Expected: all `200` (or the expected `ApiPlayground`-undefined error until Task 11, same caveat as Task 5 — only applies to pages where you added an `<ApiPlayground>` block).

- [ ] **Step 6: Commit**

```bash
git add content/ru/broker content/ru/_meta.json
git commit -m "Add RU content: docs-broker section"
```

---

### Task 9: Content parity check

**Files:**
- Create: `scripts/check-content-parity.mjs`
- Create: `data/expected-facts.json`

**Interfaces:**
- Consumes: `content/ru/**/*.mdx` (all files from Tasks 4–8).

- [ ] **Step 1: Create `data/expected-facts.json`** — key facts that must survive the scrape, one entry per RU content file

```json
{
  "content/ru/methods/change-status/delivery.mdx": [
    "changeStatus/json",
    "buyed",
    "500 тг"
  ],
  "content/ru/methods/change-status/cancel.mdx": [
    "changeStatus/json"
  ],
  "content/ru/methods/change-status/return.mdx": [
    "changeStatus/json"
  ],
  "content/ru/methods/change-status/part-return.mdx": [
    "changeStatus/json"
  ],
  "content/ru/methods/scoring.mdx": [
    "scoring"
  ]
}
```
(Extend this file with one entry per RU page created in Tasks 4–8, using 2-3 distinctive strings/numbers you observed in that page's real scraped content — amounts, endpoint paths, status names.)

- [ ] **Step 2: Write `scripts/check-content-parity.mjs`**

```js
import { readFileSync, existsSync } from 'node:fs'

const expected = JSON.parse(readFileSync('data/expected-facts.json', 'utf-8'))
let failures = 0

for (const [file, facts] of Object.entries(expected)) {
  if (!existsSync(file)) {
    console.error(`FAIL: missing file ${file}`)
    failures++
    continue
  }
  const text = readFileSync(file, 'utf-8')
  for (const fact of facts) {
    if (!text.includes(fact)) {
      console.error(`FAIL: ${file} is missing expected fact: "${fact}"`)
      failures++
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} content parity failure(s)`)
  process.exit(1)
}
console.log(`OK: all ${Object.keys(expected).length} files contain their expected facts`)
```

- [ ] **Step 3: Run the check**

Run: `npm run check-content`
Expected: `OK: all <N> files contain their expected facts`. If it fails, fix the referenced MDX file (the scrape likely dropped a collapsed section — go back and use the Playwright MCP fallback from Task 4 Step 1) or correct the fact in `expected-facts.json` if it was transcribed wrong.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-content-parity.mjs data/expected-facts.json
git commit -m "Add content parity check against scraped RU content"
```

---

### Task 10: EN content (translation)

**Files:**
- Create: `content/en/customer-journey/index.mdx`
- Create: `content/en/customer-journey/widget.mdx`
- Create: `content/en/customer-journey/android-biometry.mdx`
- Create: `content/en/customer-journey/_meta.json`
- Create: `content/en/methods/index.mdx`
- Create: `content/en/methods/auth.mdx`
- Create: `content/en/methods/scoring.mdx`
- Create: `content/en/methods/preapp.mdx`
- Create: `content/en/methods/change-status/delivery.mdx`
- Create: `content/en/methods/change-status/cancel.mdx`
- Create: `content/en/methods/change-status/return.mdx`
- Create: `content/en/methods/change-status/part-return.mdx`
- Create: `content/en/bcc-mall/index.mdx`
- Create: `content/en/bcc-mall/api.mdx`
- Create: `content/en/bcc-mall/_meta.json`
- Create: `content/en/installment-limit/index.mdx`
- Create: `content/en/installment-limit/get-limit-data.mdx`
- Create: `content/en/installment-limit/_meta.json`
- Create: `content/en/marketing/index.mdx`
- Create: `content/en/marketing/card-product.mdx`
- Create: `content/en/marketing/payment-schedule.mdx`
- Create: `content/en/marketing/_meta.json`
- Create: `content/en/faq/index.mdx`
- Create: `content/en/faq/general.mdx`
- Create: `content/en/faq/post-service.mdx`
- Create: `content/en/faq/_meta.json`
- Create: `content/en/broker/index.mdx`
- Create: `content/en/broker/authorization.mdx`
- Create: `content/en/broker/get-scoring.mdx`
- Create: `content/en/broker/new-preapp.mdx`
- Create: `content/en/broker/approve.mdx`
- Create: `content/en/broker/get-status.mdx`
- Create: `content/en/broker/_meta.json`
- Create: `content/en/methods/_meta.json`
- Create: `content/en/methods/change-status/_meta.json`
- Modify: `content/en/_meta.json`

**Interfaces:**
- Consumes: every RU file from Tasks 4–8 as the source text.
- Produces: an EN tree that mirrors the RU tree file-for-file, including identical `<ApiPlayground>` props (only the surrounding prose is translated).

- [ ] **Step 1: Translate each RU file into its EN counterpart**

For every file under `content/ru/` (except `index.mdx` and `_meta.json`, already done in Task 1), create the matching path under `content/en/` with the prose translated to English. Keep unchanged: code blocks, curl commands, JSON keys/values, `<ApiPlayground>` component props, and field names (`merchantId`, `orderId`, `amount`, `status`, and status values like `delivered`/`buyed`/`cancelled`/`returned`, plus whatever field names Task 8's broker pages actually used).

- [ ] **Step 2: Mirror the `_meta.json` files with English labels**

`content/en/methods/_meta.json`:
```json
{
  "auth": "Authorization",
  "scoring": "Creating an order and getting scoring results",
  "change-status": "Changing order status",
  "preapp": "Getting order status"
}
```

`content/en/methods/change-status/_meta.json`:
```json
{
  "delivery": "Delivery / partial delivery",
  "cancel": "Cancellation",
  "return": "Return",
  "part-return": "Partial return"
}
```

`content/en/faq/_meta.json` and `content/en/broker/_meta.json`: mirror `content/ru/faq/_meta.json` and `content/ru/broker/_meta.json` (Tasks 7 and 8) with English labels, same keys.

`content/en/_meta.json`:
```json
{
  "index": "Introduction",
  "customer-journey": "Customer journey interface",
  "methods": "Methods",
  "broker": "Broker documentation",
  "bcc-mall": "BCC Mall",
  "installment-limit": "Installment limit",
  "marketing": "Marketing",
  "faq": "FAQ"
}
```

- [ ] **Step 3: Verify EN routes render and match RU page count**

```bash
node -e "
const { execSync } = require('child_process');
const ruCount = execSync('find content/ru -name \"*.mdx\" | wc -l').toString().trim();
const enCount = execSync('find content/en -name \"*.mdx\" | wc -l').toString().trim();
if (ruCount !== enCount) { console.error(\`FAIL: ru has \${ruCount} mdx files, en has \${enCount}\`); process.exit(1); }
console.log(\`OK: ru and en both have \${ruCount} mdx files\`);
"
```
Expected: `OK: ru and en both have <N> mdx files`. Then run `npm run dev` and spot-check:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/methods/change-status/delivery
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/installment-limit
```
Expected: both `200` (or the expected `ApiPlayground`-undefined error until Task 9/10, same caveat as Task 5).

- [ ] **Step 4: Commit**

```bash
git add content/en
git commit -m "Add EN translation mirroring RU content tree"
```

---

### Task 11: ApiPlayground component — core logic (unit tested)

**Files:**
- Create: `components/ApiPlayground.tsx`
- Create: `components/apiPlaygroundLogic.ts`
- Test: `components/apiPlaygroundLogic.test.ts`

**Interfaces:**
- Produces: `buildRequestBody(fields, values): unknown[]`, `classifyFetchError(err: unknown): { kind: 'cors' | 'network' | 'http' | 'unknown'; message: string }`, and the `<ApiPlayground>` component (props: `method: string; devUrl: string; stageUrl: string; fields: Array<{ name: string; type: 'string' | 'number'; required: boolean; defaultValue?: string }>`) consumed by every change-status MDX page from Tasks 5/10, and any broker pages from Task 8/10 that used an `<ApiPlayground>` block.

- [ ] **Step 1: Write the failing test for `buildRequestBody`**

```ts
// components/apiPlaygroundLogic.test.ts
import { describe, expect, it } from 'vitest'
import { buildRequestBody, classifyFetchError } from './apiPlaygroundLogic'

describe('buildRequestBody', () => {
  it('nests orderId/amount/status under orders[], keeps merchantId top-level', () => {
    const fields = [
      { name: 'merchantId', type: 'string' as const, required: true },
      { name: 'orderId', type: 'string' as const, required: true },
      { name: 'amount', type: 'number' as const, required: true },
      { name: 'status', type: 'string' as const, required: true }
    ]
    const values = { merchantId: 'test.kz', orderId: '000000', amount: '80000', status: 'delivered' }

    const result = buildRequestBody(fields, values)

    expect(result).toEqual([
      {
        merchantId: 'test.kz',
        orders: [{ orderId: '000000', amount: 80000, status: 'delivered' }]
      }
    ])
  })
})

describe('classifyFetchError', () => {
  it('classifies a TypeError with "Failed to fetch" as a likely CORS failure', () => {
    const err = new TypeError('Failed to fetch')
    expect(classifyFetchError(err)).toEqual({
      kind: 'cors',
      message: 'Запрос заблокирован браузером (вероятно, CORS). Используйте curl-команду ниже.'
    })
  })

  it('classifies an unknown thrown value as unknown', () => {
    expect(classifyFetchError('boom').kind).toBe('unknown')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/apiPlaygroundLogic.test.ts`
Expected: FAIL — `apiPlaygroundLogic` module not found.

- [ ] **Step 3: Write `components/apiPlaygroundLogic.ts`**

```ts
export interface PlaygroundField {
  name: string
  type: 'string' | 'number'
  required: boolean
  defaultValue?: string
}

const ORDER_FIELD_NAMES = new Set(['orderId', 'amount', 'status'])

export function buildRequestBody(
  fields: PlaygroundField[],
  values: Record<string, string>
): unknown[] {
  const merchantId = values.merchantId ?? ''
  const orderEntry: Record<string, unknown> = {}

  for (const field of fields) {
    if (field.name === 'merchantId') continue
    if (!ORDER_FIELD_NAMES.has(field.name)) continue
    const raw = values[field.name] ?? field.defaultValue ?? ''
    orderEntry[field.name] = field.type === 'number' ? Number(raw) : raw
  }

  return [
    {
      merchantId,
      orders: [orderEntry]
    }
  ]
}

export function classifyFetchError(
  err: unknown
): { kind: 'cors' | 'network' | 'http' | 'unknown'; message: string } {
  if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
    return {
      kind: 'cors',
      message: 'Запрос заблокирован браузером (вероятно, CORS). Используйте curl-команду ниже.'
    }
  }
  if (err instanceof Error) {
    return { kind: 'network', message: err.message }
  }
  return { kind: 'unknown', message: 'Неизвестная ошибка запроса.' }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/apiPlaygroundLogic.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write `components/ApiPlayground.tsx`** (client component using the logic above)

```tsx
'use client'

import { useState } from 'react'
import { buildRequestBody, classifyFetchError, type PlaygroundField } from './apiPlaygroundLogic'

export function ApiPlayground({
  method,
  devUrl,
  stageUrl,
  fields
}: {
  method: string
  devUrl: string
  stageUrl: string
  fields: PlaygroundField[]
}) {
  const [env, setEnv] = useState<'dev' | 'stage'>('dev')
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.name, f.defaultValue ?? '']))
  )
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const url = env === 'dev' ? devUrl : stageUrl
  const body = buildRequestBody(fields, values)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const text = await res.text()
      setResponse(`HTTP ${res.status}\n${text}`)
    } catch (err) {
      setError(classifyFetchError(err).message)
    } finally {
      setLoading(false)
    }
  }

  const curlCommand = `curl -X '${method}' \\\n  '${url}' \\\n  -H 'accept: application/json' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body)}'`

  return (
    <div className="nextra-card" style={{ padding: '1rem', marginTop: '1rem' }}>
      <h4>Попробовать запрос</h4>
      <label>
        <input type="radio" checked={env === 'dev'} onChange={() => setEnv('dev')} /> DEV
      </label>{' '}
      <label>
        <input type="radio" checked={env === 'stage'} onChange={() => setEnv('stage')} /> STAGE
      </label>
      {fields.map(field => (
        <div key={field.name} style={{ marginTop: '0.5rem' }}>
          <label>
            {field.name}
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={values[field.name] ?? ''}
              onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        </div>
      ))}
      <button onClick={handleSubmit} disabled={loading} style={{ marginTop: '0.75rem' }}>
        {loading ? 'Отправка...' : 'Отправить'}
      </button>
      {response && <pre style={{ marginTop: '0.75rem' }}>{response}</pre>}
      {error && (
        <div style={{ marginTop: '0.75rem', color: '#b91c1c' }}>
          <p>{error}</p>
          <pre>{curlCommand}</pre>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Register `ApiPlayground` as a global MDX component**

Modify `mdx-components.tsx` to add it:
```tsx
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import { ApiPlayground } from './components/ApiPlayground'

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components: Record<string, unknown> = {}) {
  return {
    ...docsComponents,
    ApiPlayground,
    ...components
  }
}
```

- [ ] **Step 7: Run the full unit test suite**

Run: `npm test`
Expected: all tests pass, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add components mdx-components.tsx
git commit -m "Add ApiPlayground component with tested request/error logic"
```

---

### Task 12: Verify ApiPlayground renders on every change-status page (RU + EN)

**Files:**
- No new files — this task only verifies Task 5/10 content (and any broker pages from Task 8/10 that used `<ApiPlayground>`) against the Task 11 component.

**Interfaces:**
- Consumes: `<ApiPlayground>` from Task 11, embedded in the 8 change-status MDX files (4 RU + 4 EN) from Tasks 5 and 10, plus any broker MDX files from Tasks 8/10 that embedded it.

- [ ] **Step 1: Start the dev server and re-check the previously-expected-to-fail routes**

Run: `npm run dev`, then:
```
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/delivery
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/cancel
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/return
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ru/methods/change-status/part-return
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/methods/change-status/delivery
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/methods/change-status/cancel
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/methods/change-status/return
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/methods/change-status/part-return
```
Expected: all 8 print `200` (no more `ApiPlayground is not defined` errors). If Task 8/10 embedded `<ApiPlayground>` in any `content/{ru,en}/broker/*.mdx` file, add the same 200-check for those routes too (e.g. `http://localhost:3000/ru/broker/authorization`).

- [ ] **Step 2: Manually exercise the playground once (Playwright MCP)**

Use the already-installed Playwright MCP: `browser_navigate` to `http://localhost:3000/ru/methods/change-status/delivery`, `browser_snapshot` to find the "Попробовать запрос" form, fill `merchantId`/`orderId`/`amount` with test values, click "Отправить".
Expected: either a real HTTP response renders in the `<pre>` block, or — if bnpl's CORS policy blocks it — the red error box appears with the CORS message and a `curl` fallback command. Both outcomes are acceptable; a silent crash or blank screen is not.

- [ ] **Step 3: Commit** (only if Step 1/2 required fixes)

```bash
git add -A
git commit -m "Fix ApiPlayground integration issues found during verification"
```
(Skip this commit if no changes were needed.)

---

### Task 13: Search

**Files:**
- No new files expected — Nextra 3's default theme ships Pagefind-based search out of the box once content exists.
- Modify: `next.config.mjs` only if search needs to be explicitly enabled/configured for the version installed.

- [ ] **Step 1: Build the site so the search index is generated**

Run: `npm run build`
Expected: build succeeds; look for search-index-related output in the build log (Nextra/Pagefind generates a static search index during `next build`).

- [ ] **Step 2: Verify search returns a result**

Run: `npm run start` (serves the production build), then use the Playwright MCP: `browser_navigate` to `http://localhost:3000/ru`, find the search input (`browser_snapshot`), `browser_type` a known term such as `доставка`, and check that a result linking to `/ru/methods/change-status/delivery` appears.
Expected: the result appears. If the installed Nextra version needs an explicit search config (check the error/log output from Step 1), add it to `next.config.mjs`'s `nextra({...})` options and re-run Steps 1–2.

- [ ] **Step 3: Commit** (only if `next.config.mjs` was changed)

```bash
git add next.config.mjs
git commit -m "Configure search"
```

---

### Task 14: GitHub repository and push

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: a `bnpl-dev-portal` GitHub repo with this project's full history pushed to `main`, and the real `docsRepositoryBase` URL to fill into Task 1's layout.

- [ ] **Step 1: Write `README.md`**

```md
# bnpl.kz Developer Portal

Documentation for integrating with bnpl.kz: authorization, scoring, order status changes, installment limits, and marketing.

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Content

MDX source lives under `content/ru/` and `content/en/`. See `docs/superpowers/specs/` for the design spec.
```

- [ ] **Step 2: Check for `gh` and authenticate if needed**

Run: `gh --version`
- If not found: install it (`winget install --id GitHub.cli -e`), then refresh PATH.
- Run: `gh auth status`. If not authenticated, run `gh auth login` and follow the interactive browser-login prompts — this step requires the user present at the keyboard, it cannot be scripted.

- [ ] **Step 3: Create the GitHub repo and push**

```bash
git add README.md
git commit -m "Add README"
gh repo create bnpl-dev-portal --public --source=. --remote=origin --push
```
Expected: command prints the new repo URL; `git remote -v` shows `origin` pointing at `github.com/<username>/bnpl-dev-portal`.

- [ ] **Step 4: Fill in the real repo URL in the layout**

Modify `app/[lang]/layout.tsx`: replace `docsRepositoryBase="https://github.com/REPLACE_WITH_GH_USERNAME/bnpl-dev-portal"` with the actual URL from Step 3.

```bash
git add app/[lang]/layout.tsx
git commit -m "Set real docsRepositoryBase URL"
git push
```

---

### Task 15: Vercel deployment

**Files:** none (external service configuration).

- [ ] **Step 1: Check for the Vercel CLI**

Run: `vercel --version`. If not found, install with `npm install -g vercel`.

- [ ] **Step 2: Link and deploy**

```bash
vercel login
vercel link
vercel --prod
```
`vercel login` opens a browser for authentication — requires the user present. `vercel link` prompts to connect the existing GitHub repo/project; accept defaults (project name `bnpl-dev-portal`).

- [ ] **Step 3: Verify the production URL**

Run: `curl -s -o /dev/null -w "%{http_code}" <the printed *.vercel.app URL>/ru`
Expected: `200`.

- [ ] **Step 4: Confirm auto-deploy on push**

Make a trivial change (e.g., fix a typo in `README.md`), commit, and `git push`. In the Vercel dashboard (or `vercel ls`), confirm a new deployment triggered automatically from the push.

```bash
git add README.md
git commit -m "Trigger Vercel auto-deploy check"
git push
```
