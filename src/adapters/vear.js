const WebSocket = require('ws');
const https = require('https');
const crypto = require('crypto');

// Hardcoded HMAC key extracted from Vear.com's dist.js frontend source.
// Used by F() to sign the telemetry fingerprint.
const HMAC_KEY = 'vr_8x$kQ2m!pL7dZw3Nf9RjY6aTcE1bH';
const HMAC_KEY_BUF = Buffer.from(HMAC_KEY, 'utf8');

// Cached _wt token and its expiry
let cachedWt = null;
let cachedWtExpiry = 0;
const WT_TTL_MS = 4 * 60 * 1000; // Refresh every 4 minutes

/**
 * Generate a random alphanumeric string
 */
function generateId(length = 20) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Fetch the _wt token from Vear.com's server-rendered HTML.
 * No cookie is required — the page is publicly accessible.
 */
function fetchWtToken() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'vear.com',
      path: '/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const match = data.match(/window\._wt='([^']+)'/);
        if (match && match[1]) {
          resolve(match[1]);
        } else {
          reject(new Error('_wt token not found in Vear.com HTML response'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Timeout fetching _wt token from vear.com'));
    });
    req.end();
  });
}

/**
 * Get a cached _wt token, refreshing if expired
 */
async function getWtToken() {
  if (cachedWt && Date.now() < cachedWtExpiry) {
    return cachedWt;
  }
  cachedWt = await fetchWtToken();
  cachedWtExpiry = Date.now() + WT_TTL_MS;
  return cachedWt;
}

/**
 * Generate the fp (fingerprint) field using HMAC-SHA256,
 * replicating the F() function from Vear.com's dist.js.
 *
 * F(telemetryHash) = telemetryHash + s + hex(HMAC-SHA256(key, telemetryHash + ':' + s))
 * where s = hex(Date.now())[0:12] + hex(random 0-65535)[0:4], sliced to 16 chars
 *
 * Vear's server requires a non-empty telemetryHash (32-char hex, like MurmurHash3 output).
 * We use a deterministic placeholder — the server does not validate it against a real fingerprint.
 */
const PLACEHOLDER_TELEMETRY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
function generateFingerprint() {
  const timestampHex = Date.now().toString(16).padStart(12, '0');
  const randomHex = Math.floor(Math.random() * 65535).toString(16).padStart(4, '0');
  const s = (timestampHex + randomHex).slice(0, 16);
  const hmac = crypto.createHmac('sha256', HMAC_KEY_BUF);
  hmac.update(PLACEHOLDER_TELEMETRY + ':' + s);
  const signature = hmac.digest('hex');
  return PLACEHOLDER_TELEMETRY + s + signature;
}

/**
 * Execute request to Vear.com API via WebSockets (no cookie needed)
 */
async function execute(vearPayload, modelConfig) {
  // Fetch _wt token automatically — no manual config required
  let wt;
  try {
    wt = await getWtToken();
  } catch (err) {
    throw {
      upstream: true,
      type: 'wt_fetch_error',
      message: `Failed to fetch _wt token from vear.com: ${err.message}`,
      verbose: {
        hint: 'The proxy automatically fetches a token from vear.com. Check your network connection.',
        original_error: err.message
      }
    };
  }

  // Generate HMAC-signed fingerprint
  const fp = generateFingerprint();

  // Extract the latest user message from the payload
  const messages = vearPayload.messages || [];
  const latestMessage = messages[messages.length - 1];
  const prompt = latestMessage ? latestMessage.content : '';
  const modelId = vearPayload.model;

  // Vear model routing IDs from the frontend source
  const m = modelConfig.m;
  const ms = modelConfig.ms;

  if (!m || !ms) {
    throw {
      upstream: false,
      type: 'missing_model_routing',
      message: `Model ${modelId} is missing m/ms routing IDs in config`,
      verbose: { modelId, modelConfig }
    };
  }

  const { PassThrough } = require('stream');
  const responseStream = new PassThrough();

  const isStreaming = vearPayload.stream !== false;
  let fullResponse = '';

  const uid = `uid-${generateId(15)}`;
  const mid = `mid-${generateId(25)}`;

  const ws = new WebSocket('wss://vear.com/conversation/go', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
      'Origin': 'https://vear.com'
    }
  });

  return new Promise((resolve, reject) => {
    const upstreamTimeout = setTimeout(() => {
      ws.close();
      reject({
        upstream: true,
        type: 'upstream_timeout',
        message: 'Vear.com WebSocket connection timed out'
      });
    }, 120000);

    ws.on('open', () => {
      const payload = {
        uid: uid,
        mid: mid,
        fp: fp,
        wt: wt,
        q: prompt,
        m: m,
        ms: ms,
        t: 'm'
      };

      ws.send(JSON.stringify(payload));

      if (isStreaming) {
        resolve({ stream: true, response: responseStream });
      }
    });

    ws.on('message', (data) => {
      try {
        const msgStr = data.toString();
        const parts = msgStr.split('\n').filter(p => p.trim());

        for (const part of parts) {
          const msg = JSON.parse(part);

          if (msg.t === 'e' || msg.t === 'b') {
            // Error (e) or rate-limit/block (b) from server
            clearTimeout(upstreamTimeout);
            ws.close();
            if (isStreaming) {
              responseStream.end();
            }
            const errorType = msg.t === 'b' ? 'vear_rate_limited' : 'vear_server_error';
            reject({
              upstream: true,
              type: errorType,
              message: msg.c || 'Unknown error from Vear.com',
              verbose: { serverCode: msg.t, modelId, m, ms }
            });
            return;
          } else if (msg.t === 's') {
            // 's' = first message / echo of the user prompt — skip for output
            // (we only use it for the cid/sid metadata if needed)
          } else if (msg.t === 'm' && msg.c) {
            // Content token (actual model output)
            fullResponse += msg.c;
            if (isStreaming) {
              const chunk = formatSSEChunk(msg.c, modelId);
              responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
          } else if (msg.t === 'n' && msg.c === '') {
            // End of stream
            clearTimeout(upstreamTimeout);
            if (isStreaming) {
              const endChunk = formatSSEChunk('', modelId, 'stop');
              responseStream.write(`data: ${JSON.stringify(endChunk)}\n\n`);
              responseStream.write('data: [DONE]\n\n');
              responseStream.end();
            } else {
              resolve({
                stream: false,
                data: formatFullResponse(fullResponse, modelId)
              });
            }
            ws.close();
          }
        }
      } catch (err) {
        console.error('[VEAR] Error parsing WS message:', err.message);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(upstreamTimeout);
      if (isStreaming) {
        responseStream.end();
      }
      reject({
        upstream: true,
        type: 'upstream_error',
        message: err.message
      });
    });

    ws.on('close', () => {
      clearTimeout(upstreamTimeout);
      if (isStreaming) {
        responseStream.end();
      }
    });
  });
}

function formatSSEChunk(content, modelId, finishReason = null) {
  return {
    id: `chatcmpl-${crypto.randomBytes(4).toString('hex')}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      delta: content ? { content } : {},
      finish_reason: finishReason
    }]
  };
}

function formatFullResponse(content, modelId) {
  return {
    id: `chatcmpl-${crypto.randomBytes(4).toString('hex')}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

module.exports = {
  execute,
  formatSSEChunk,
  formatFullResponse
};