# Vear.com Reverse Proxy

A standalone, OpenAI-compatible reverse proxy that connects directly to Vear.com's WebSocket backend. This allows you to use premium web-based models (such as GPT-5, Claude 4.6, Gemini 3.1, Grok 4.1) locally in your own applications (like simple terminals, Python scripts, LangChain, etc.) that expect a standard OpenAI API.

**Zero config. No API keys, no cookies, no accounts needed.**

## How It Works

The proxy reverse-engineers Vear.com's authentication from their frontend JavaScript:

1. **Auto-fetches a `_wt` token** from Vear.com's server-rendered HTML on each request (publicly accessible, no login).
2. **Generates an HMAC-signed fingerprint (`fp`)** using the signing key extracted from `dist.js` (`vr_8x$kQ2m!pL7dZw3Nf9RjY6aTcE1bH`).
3. **Connects over WebSocket** to `wss://vear.com/conversation/go` with the correct model routing IDs (`m`/`ms`).
4. **Formats responses** as OpenAI-compatible SSE `chat.completion.chunk` events.

No PHPSESSID cookie, no browser login, no manual key collection.

## Quick Start

### 1. Install Dependencies
```bash
cd vear-reverse
npm install
```

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
```
Edit `.env` — set `ALLOWED_TOKENS` to your desired proxy password. That's it.

### 3. Start the Proxy Server
```bash
npm start
```
The server will listen on port `3001`.

---

## Using the API

Point any OpenAI-compatible application to `http://localhost:3001/v1`.

### Check Available Models
```bash
curl -X GET http://localhost:3001/v1/models \
  -H "Authorization: Bearer sk-vear-proxy-token-change-me"
```

### Prompt a Model (Chat Completions)
```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-vear-proxy-token-change-me" \
  -d '{
    "model": "vear/claude-4.6-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### Supported Models

Prefix all models with `vear/`:

**Anthropic**
- `vear/claude-4.6-opus`
- `vear/claude-4.6-sonnet`
- `vear/claude-4.5-opus`
- `vear/claude-4.5-sonnet`
- `vear/claude-4.5-haiku`

**OpenAI**
- `vear/gpt-5.4`
- `vear/gpt-5.2`
- `vear/gpt-5.1`
- `vear/gpt-5`
- `vear/gpt-5-mini`
- `vear/gpt-5-nano`

**Google**
- `vear/gemini-3.1-pro`
- `vear/gemini-3.0-pro`

**xAI**
- `vear/grok-4.1`
- `vear/grok-4`

**DeepSeek**
- `vear/deepseek-v3`
- `vear/deepseek-r1`

**Image**
- `vear/dall-e-3`