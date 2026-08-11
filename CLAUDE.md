# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** this file is listed in `.gitignore`, so it will not be committed or visible on GitHub. It still applies locally.

## Project Overview

A Traditional Chinese chatbot frontend for **clinician-facing** newborn jaundice clinical care education ("新生兒黃疸臨床衛教智慧客服小幫手"). Vanilla JS single-page app — no build step, no npm, no framework.

This is a separate git repository (remote: `jaundice_inside`) from the sibling public-facing repo `jaundice` (remote: `jaundice.git`), checked out alongside it in this working directory. The two started from the same codebase but have diverged — do not assume a fix in one is present in the other.

## Running Locally

Serve the static files with any HTTP server, e.g.:

```bash
python -m http.server 8080
# or
npx http-server .
```

Then open `http://localhost:8080` in a browser.

## Deployment

GitHub Actions (`.github/workflows/static.yml`) auto-deploys to GitHub Pages on every push to `main`. No manual deploy step.

## Architecture

All logic lives in three files at the root:

| File | Role |
|---|---|
| `index.html` | Shell — semantic layout (header / main / footer), no inline logic |
| `app.js` | All frontend behavior |
| `styles.css` | Mobile-first responsive design, warm healthcare palette |

**Backend:** External REST API at `https://jaundice-server.onrender.com`. Unlike the public `jaundice` frontend (which posts to `/api/chat`), this clinical variant POSTs JSON to **`/api/chat-clinical`**:

```json
{ "text": "...", "clientId": "...", "babyId": null, "clinicianId": null, "language": "繁體中文", "role": "user" }
```

The `clientId` is also sent as an `X-Client-Id` request header, and, if a Firebase ID token has been injected, an `Authorization: Bearer <token>` header.

### `app.js` internals

**Session identity:** `clientId` is a UUID stored in `localStorage` under the key `fourleaf_client_id`.

**WebView bridge:** The Flutter app injects identifiers/tokens after the page loads via:
- `window.setBabyId(id)` — injects the patient's baby ID; persisted under `babyID` in localStorage.
- `window.clearBabyId()` — clears `babyId` from memory and `localStorage`. Called by the app for sessions with no baby in context (e.g. a clinician home page), to prevent a previous WebView session's `babyId` from leaking into a new one that shares the same origin storage.
- `window.setClinicianId(id)` — injects the logged-in clinician's ID; persisted under `clinicianID` in localStorage.
- `window.setAuthToken(token)` — injects a Firebase ID token; kept in memory only (not persisted), sent as a `Bearer` token on every request once set.

There is no `parentId`/`setParentId` and no language selector in this variant (see `docs/flutter-webview-baby-id.md` for the original babyId injection design, written before `clearBabyId`/`clinicianId` were added).

**Input preprocessing:** `processQuestionMarks()` strips trailing `?`/`？` and converts mid-sentence question marks to newlines before the text is sent to the API.

**Content rendering pipeline (bot messages only):**
1. `isHtmlFormat()` — if the response contains HTML tags, treat it as HTML.
2. `processContent()` — detects Markdown patterns; if found and `marked` is available, runs `marked.parse()`.
3. Fallback — `escapeHtml()` + replace `\n` with `<br>`. User messages always use this fallback.
4. Regardless of which path produced the HTML, `processContent()` always runs it through `DOMPurify.sanitize()` before returning — this is the actual XSS defense, not step 1's "no escaping" on its own.

**Dangerous keyword interception:** `DANGEROUS_KEYWORDS` (currently just `"自殺"`) is checked on every keystroke via `containsDangerousKeyword()`. A match calls `triggerDangerAlert()`, which clears and disables the input box, disables the send button, and shows the `#dangerAlertModal` dialog. The user must click the modal's confirm button (`dismissDangerAlert()`) to re-enable input. The keyword list is intentionally minimal/test-only and expected to grow.

**Temp messages:** During a pending request, progress messages (`{ isTemp: true }`) are pushed to the `messages` array at 4 s and 8 s. `clearAllTempMessages()` removes all of them before the final reply or error is rendered.

**Concurrency guard:** `window.isChatFetching` blocks re-entry on double-click. `window.globalReqId` (incremented per request) lets stale timeout callbacks detect they've been superseded and abort their `updateTempMsg()` call.

**Retry logic:** Three independent retry counters in `retryCounts`:
- `emptyResponse` — HTTP 200 with empty/null `text` field (max 1 retry).
- `incompleteMarkers` — response body contains both `"search results"` and `"html"` (max 1 retry).
- `httpErrors` — HTTP 500/502/503/504/401/404 (max 1 retry).

Each path inserts an interim status message, waits 1 s, then calls `sendText()` recursively. Second failure throws and lands in the catch block.

**Avatar images:** Loaded from the local `./assets/` folder (unlike the sibling `jaundice` repo, which loads avatars from a GitHub CDN URL) — avatars work offline here.

### CSS conventions

- Uses CSS custom properties (`--primary`, etc.) for theming.
- Warm healthcare palette: cream `#FFFBF2`, amber `#F59E0B`.
- Mobile-first; uses `safe-area-inset` and dynamic `dvh` units for keyboard-aware layout on iOS.
- `.hidden { display: none !important }` is the sole visibility toggle used throughout.

## Static assets

- `assets/` — logo and avatar images (logo, user, bot), loaded and used at runtime by `app.js`.
- `marked.umd.js` — bundled markdown parser; update by replacing this file with a newer UMD build from the marked project.
- `dompurify.umd.js` — bundled HTML sanitizer; every string `processContent()` produces is passed through `DOMPurify.sanitize()` before being written to the DOM. Update by replacing this file with a newer UMD build from the DOMPurify project.
- `docs/flutter-webview-baby-id.md` — design notes (in Chinese) for how the Flutter app injects `babyId` into the WebView via `window.setBabyId()`. Predates `clearBabyId`/`clinicianId`/`setAuthToken`.

There is no `pic/` folder in this repo (the public `jaundice` repo has one for educational images embedded in chat responses).

## Content Security Policy

`index.html` sets a CSP via `<meta http-equiv="Content-Security-Policy">`:
- `script-src 'self'` — no inline scripts, no external script hosts.
- `connect-src 'self' https://jaundice-server.onrender.com` — fetch/XHR limited to same origin and the backend API.
- `img-src 'self' https://jaundice.smartchat.live data:` — images limited to same origin, that one external host (used for images embedded in bot replies), and `data:` URIs.

When adding a new external resource (API host, image host, font, etc.), update this CSP or the browser will silently block it.
