# ve@r.com Reverse Proxy
A standalone, OpenAI-compatible reverse proxy that connects directly to ve@r.com's WebSocket backend. This allows you to use premium web-based models (such as GPT-5, Claude 4.6) locally in your own applications (like simple terminals, Python scripts, LangChain, etc.) that expect a standard structured OpenAI API.

## Features
- **OpenAI Streaming Compatibility:** Sends requests and formats the stream chunks precisely in the `chat.completion.chunk` Server-Sent Events (SSE) format.
- **WebSocket Interception:** Disguises the connection as an Android client to bypass CloudFlare blocks. 
- **Universal Provider Endpoint:** Maps ve@r.com models flawlessly using simple aliases.

---

## 🔑 Quick Start Setup

### 1. Install Dependencies
```bash
cd ve@r-reverse
npm install
```

### 2. Configure Environment (`.env`)
1. Create a file named `.env` by copying our template:
   ```bash
   cp .env.example .env
   ```
2. Retrieve your `ve@r_COOKIE`:
   - Open your Thorium/Chrome browser.
   - Go to `https://ve@r.com/` and log in (if necessary).
   - Right-click anywhere, select **Inspect** to open Developer Tools.
   - Go to the **Application** tab. On the left side, under **Storage**, expand **Cookies** and click on `https://ve@r.com`.
   - Find the cookie named `PHPSESSID`. 
   - Copy only its Value (e.g., `0e9mjc775v425cg00dvuuhvv2j`).
3. Set your internal `ALLOWED_TOKENS` proxy password (this ensures random people on the internet can't use your proxy if exposed).
4. Paste the details into your `.env` file like this:
   ```env
   # Your proxy password:
   ALLOWED_TOKENS=sk-ve@r-proxy-token-change-me

   # Your actual ve@r bypass cookie (can be a comma-separated list of cookies for rotation/stacking):
   ve@r_COOKIE=0e9mjc775v425cg00dvuuhvv2j,cookie2,cookie3
   ```

### 3. Start the Proxy Server
```bash
npm start
```
The server will now listen locally on port `3011`. 

---

## 📡 Using the API

You can point any OpenAI-compatible application to `http://localhost:3011/v1`. 

### Check Available Models
Returns a JSON list of all the ve@r mapped models:
```bash
curl -X GET http://localhost:3011/v1/models \
  -H "Authorization: Bearer sk-ve@r-proxy-token-change-me"
```

### Prompting Models (Chat Completions)
Sends a request utilizing ve@r.com's websockets behind the scene:
```bash
curl -X POST http://localhost:3011/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ve@r-proxy-token-change-me" \
  -d '{
    "model": "ve@r/claude-4.6-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### Supported Models
You must prefix your requested models with `ve@r/`:

**Anthropic**
- `ve@r/claude-4.6-opus`
- `ve@r/claude-4.6-sonnet`
- `ve@r/claude-4.5-opus`
- `ve@r/claude-4.5-sonnet`
- `ve@r/claude-4.5-haiku`

**OpenAI**
- `ve@r/gpt-5.4`
- `ve@r/gpt-5.2`
- `ve@r/gpt-5.1`
- `ve@r/gpt-5`
- `ve@r/gpt-5-mini`
- `ve@r/gpt-5-nano`

**Gemini**
- `ve@r/gemini-3.1-pro` 
- `ve@r/gemini-3.0-pro`

**Grok**
- `ve@r/grok-4.1`
- `ve@r/grok-4`
