# bnpl.kz Dev Portal — Redesign

## Purpose

Rebuild the developer documentation portal currently at `https://bnpl.kz/dev-portal/` as a modern, standalone site, using the content from the original portal as source material. The new site is deployed publicly via GitHub + Vercel, independent of the original bnpl.kz infrastructure.

## Scope

Full content of the existing dev portal:

- Введение (Introduction)
- Интерфейс клиентского пути (Customer journey)
- Методы (Methods):
  - Авторизация (Authorization)
  - Создание заявки и получение результатов скоринга (Scoring)
  - Изменение статуса заказа (Change order status): Доставка/частичная доставка, Отмена, Возврат, Частичный возврат
  - Получение статуса заказа (Order status)
- BCC Mall
- Лимит на рассрочку (Installment limit)
- Маркетинг (Marketing)

Out of scope: anything not published on the current dev portal (no new API methods, no content not present in the source).

## Stack

**Nextra** (Next.js-based documentation framework), matching the original site's Next.js stack while providing built-in:
- Client-side search (Cmd+K)
- Light/dark theme toggle
- i18n routing (ru/en)
- Sidebar navigation generated from file structure
- Code block syntax highlighting

Rejected alternatives:
- Custom Next.js app from scratch — same stack, but search/i18n/theming would need to be built manually with no benefit over Nextra.
- Docusaurus — popular for docs, but not Next.js-based; doesn't match the "same stack as original" requirement.

## Content Pipeline

1. `firecrawl_map` on `https://bnpl.kz/dev-portal/` to enumerate all pages under the dev-portal section.
2. `firecrawl_scrape` (JS-rendered) each URL to Markdown.
3. Content lands in `content/ru/**/*.mdx`, one file per page, mirroring the original URL hierarchy, with a `_meta.json` per folder for Nextra's sidebar ordering.
4. Collapsible sections from the original ("Запрос", "Пример запроса", "Структура запроса") become headings/accordions in MDX — content preserved, not lost.
5. `content/en/**/*.mdx` is a translation of the Russian content. Technical identifiers (`orderId`, `merchantId`, status values like `delivered`/`buyed`, etc.) are left untranslated.
6. Fallback for any content that doesn't surface in a static scrape (e.g., tab-click-revealed sections): manual pass using the already-installed Playwright/Chrome DevTools MCP servers (navigate, click, snapshot) to extract the text.

## Design

- Theme: Nextra "docs" theme, customized to a **Clean Light** style (light background, blue accent, ~`#2563eb`) with a dark theme available via the built-in toggle.
- Navigation: left sidebar mirroring the original section order; top bar with logo, search (Cmd+K), theme toggle, RU/EN language switch.
- Method pages (e.g., "Доставка"): title, business-logic description, URL block (DEV/STAGE), curl example with copy-to-clipboard, success/error response examples — same shape as the original, curl-only (no added language tabs, per explicit decision to stay close to the source).

## API Playground

Each method page gets a "Попробовать запрос" (Try it) panel below the example:

- Form fields generated from that page's request structure (e.g., `merchantId`, `orders[].amount`, `orderId`, `status`).
- DEV/STAGE endpoint toggle.
- "Отправить" button performs a `fetch` directly from the user's browser to `dev.bnpl.kz` / `stage.bnpl.kz`.
- No credentials or form values are persisted anywhere (not in local storage, not sent to any server we control) — they exist only in the browser tab's memory for the duration of the session.

**Known risk — CORS:** the real bnpl API may not send CORS headers permitting our Vercel origin. If the browser blocks the request, the playground shows a clear error and falls back to a generated `curl` command the user can copy into a terminal.

## Testing & Validation

- Content parity check: compare page count and key facts (amounts, method URLs, response codes) between the original and the generated MDX to catch scraping loss.
- Build check: `next build` succeeds; search returns results; theme and language toggles work; playground either completes a real request or fails gracefully into the curl fallback.

## Tooling Setup Required

- `git` — installed.
- `gh` (GitHub CLI) — not yet installed; needed to create the GitHub repo and push. Requires interactive browser login.

## Deployment

- Repository: `bnpl-dev-portal`, public, on the user's GitHub account.
- Vercel project connected to the GitHub repo; auto-deploy on push to `main`.

## Known Risks

1. CORS may block the live API playground (mitigated with curl fallback).
2. Some original content may be revealed only via client-side interaction (tab clicks) and require manual extraction via Playwright/Chrome DevTools MCP.
3. English translation is machine-assisted, not native — should be reviewed before treating as final/public-facing.
