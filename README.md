# Horizon Valley — dashboard and widget (frontend)

The customer-facing half of Horizon Valley, a multi-tenant RAG chatbot platform. The backend
(Go API + Python RAG service) lives in
[`Rag-Backend`](https://github.com/ai-code-101/Rag-Backend), which also has the
architecture doc, the database schema and the docker-compose stack.

| Path | What it is |
| --- | --- |
| `web/` | Next.js 16 (App Router, TypeScript, Tailwind 4): dashboard, the chat UI served inside the widget iframe, and `/widget.js` |
| `widget/` | The embeddable vanilla-JS loader (`src/loader.js`), its build script and tests |

## Features

* **Auth screens:** signup and login with email and password (accounts are usable
  immediately; there is no email verification).
* **Bots:** list, create, delete, rotate keys.
* **Knowledge tab:** drag-and-drop upload (PDF, DOCX, TXT, Markdown), import a URL, paste
  text; the document list updates live while ingestion runs; delete, refresh/retry.
* **Instructions tab:** large editor for tone, persona, rules and what to avoid
  (with a template), fallback message, model and temperature, and the allowed-websites list.
* **Widget tab:** theme, content, behaviour and feature settings with a live preview iframe
  that applies unsaved changes instantly, plus a "Copy embed code" button.
* **Test chat:** try the bot with the same pipeline as the widget, with sources and token
  usage shown under every answer.

## Embedding

```html
<script src="https://app.example.com/widget.js" data-bot="pk_XXXXXXXXXXXXXXXXXXXXXXXX" async></script>
```

* Works in `<head>` or `<body>` and waits for `DOMContentLoaded` if needed. It is about 4 KB gzipped.
* Fetches the public config by key and renders a launcher in a Shadow DOM, so host-page
  CSS can't affect it. The chat itself loads in an iframe (`/widget/<key>`), created lazily
  on first hover, focus or open.
* Theming is done entirely with CSS variables built from strictly validated config
  values. Supports left/right position, offsets, auto-open (`behavior.auto_open`, or
  `?chat=open` in the page URL), hide-on-paths (including SPA navigations), and a
  full-screen panel on phones.
* JavaScript API for host-site developers:

  ```js
  HorizonValley.open(); HorizonValley.close(); HorizonValley.toggle(); HorizonValley.isOpen();
  HorizonValley.identify({ id: "42", name: "Ada", email: "ada@example.com" });
  // Calls made before the script loads can be queued:
  window.HorizonValley = window.HorizonValley || { q: [] }; HorizonValley.q.push(["open"]);
  ```

### Security model

* `/widget/<key>` responses carry `Content-Security-Policy: frame-ancestors 'self' <allowed origins>`
  (set in `web/proxy.ts`), so only the bot's allowed sites can frame the chat.
* postMessage in both directions is origin- and source-checked. The loader only accepts
  messages from its own iframe on the Horizon Valley origin. The iframe accepts messages only
  from `window.parent` on an allowed origin, and draft previews only from the dashboard
  origin. Messages contain no secrets.
* The visitor id and conversation id live in the iframe's `localStorage`, so no
  third-party cookies are used.
* Assistant messages are rendered by a small Markdown renderer that builds React elements
  directly. It never uses `innerHTML`, and only `http(s)`/`mailto` links are rendered.
* Dashboard: the access token is held in memory only. The refresh token is an `httpOnly`
  `SameSite=Strict` cookie that stays first-party because every dashboard call goes
  through the same-origin `/api/*` proxy (`app/api/[...path]/route.ts`), which streams
  uploads and SSE without buffering.

## Development

```bash
# backend first (see Rag-Backend/README.md), e.g. docker compose up in ../Rag-Backend
cd web
cp .env.example .env.local     # API_INTERNAL_URL, PUBLIC_API_URL, PUBLIC_WEB_URL
npm install
npm run dev                    # http://localhost:3000
```

The loader is built into the web app:

```bash
cd widget && npm install
npm test                       # jsdom tests for the loader
npm run build                  # writes web/lib/widget-loader.generated.ts (commit it)
```

`/widget.js` is served by `web/app/widget.js/route.ts`, which substitutes
`PUBLIC_API_URL` and `PUBLIC_WEB_URL` at request time, so one image works in every
environment.

## Environment variables (`web/`)

| Variable | Used by | Example |
| --- | --- | --- |
| `API_INTERNAL_URL` | `/api` proxy, server-rendered widget config | `http://api:8080` or the API's Cloud Run URL |
| `PUBLIC_API_URL` | browser → API for widget config and streaming chat | `https://api.example.com` |
| `PUBLIC_WEB_URL` | baked into `widget.js` (iframe origin) | `https://app.example.com` |

Set the API's `WEB_ORIGIN` to the same value as `PUBLIC_WEB_URL`.

## Tests

```bash
cd widget && npm test   # loader: DOM-ready, theming/CSS-injection guard, iframe, postMessage origin checks,
                        # ?chat=open, auto-open delay, hide-on-paths + SPA navigation, queued calls
cd web && npm test      # markdown sanitisation, origin matching, SSE parsing, colour contrast
cd web && npm run lint && npm run build
```

## Deploying to Cloud Run

```bash
gcloud builds submit web --tag $REGION-docker.pkg.dev/$PROJECT/horizonvalley/web
gcloud run deploy horizon-valley-web --image $REGION-docker.pkg.dev/$PROJECT/horizonvalley/web \
  --region $REGION --allow-unauthenticated \
  --set-env-vars API_INTERNAL_URL=https://horizon-valley-api-xxxx.run.app,PUBLIC_API_URL=https://api.example.com,PUBLIC_WEB_URL=https://app.example.com
```

The container is stateless (Next.js standalone output, non-root). Put a CDN in front for
`/_next/static/*` and `/widget.js`; both send cache headers.
