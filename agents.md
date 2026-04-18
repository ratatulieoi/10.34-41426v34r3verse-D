# vear-reverse — API Reverse Proxy

## 🎯 Purpose
Standalone OpenAI-compatible reverse proxy for Vear.com's aggregated AI models.
**Zero config** — no API keys, cookies, or accounts needed. The proxy auto-fetches auth tokens from vear.com.

## 🔑 How It Works (No Cookie Needed)
The proxy reverse-engineers Vear.com's frontend authentication:
1. Auto-fetches `_wt` token from vear.com's server-rendered HTML (public, no login).
2. Generates HMAC-signed `fp` fingerprint using the signing key `vr_8x$kQ2m!pL7dZw3Nf9RjY6aTcE1bH` extracted from dist.js.
3. Connects over WebSocket to `wss://vear.com/conversation/go` with correct model routing IDs (`m`/`ms`).

## Commands
```bash
npm install
npm start       # Server on port 3011
npm run dev      # nodemon
npm test         # jest smoke tests
```

## Validation
```bash
node --check src/server.js
node --check src/adapters/vear.js
node --check config.js
```

## Key Files
- `src/adapters/vear.js` — WebSocket adapter with auto-auth (the core)
- `config.js` — Model registry with `m`/`ms` routing IDs mapped from Vear's frontend
- `src/server.js` — Express app entry point
- `src/routes/chat.js` — Chat completions route
- `src/routes/models.js` — Model listing

## Model Routing IDs (from Vear frontend)
| m  | ms | Model                 |
|----|----|-----------------------|
| 11 | 11 | Claude-4.6-Opus       |
| 11 | 10 | Claude-4.6-Sonnet     |
| 11 | 9  | Claude-4.5-Opus       |
| 11 | 8  | Claude-4.5-Sonnet     |
| 11 | 7  | Claude-4.5-Haiku       |
| 12 | 19 | GPT-5.4               |
| 12 | 17 | GPT-5.2               |
| 12 | 16 | GPT-5.1               |
| 12 | 13 | GPT-5                 |
| 12 | 14 | GPT-5 mini            |
| 12 | 15 | GPT-5 nano            |
| 13 | 6  | Gemini-3.1 Pro        |
| 13 | 5  | Gemini-3.0 Pro        |
| 14 | 6  | Grok-4.1              |
| 14 | 5  | Grok-4                 |
| 16 | 1  | DeepSeek V3           |
| 16 | 2  | DeepSeek R1           |
| 21 | 1  | DALL-E 3 (image)      |

## WS Message Types (Vear protocol)
- `m` (client→server) — new message request
- `s` — server echo of user prompt (skip in output)
- `m` (server→client) — content token
- `n` — end of response
- `e` — error
- `b` — rate limited / blocked