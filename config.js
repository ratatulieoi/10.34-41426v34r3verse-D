require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Model mapping with Vear.com's internal routing IDs (m = provider, ms = model variant).
  // Extracted from dist.js and the frontend's data-id/data-subid attributes.
  // No API keys or cookies needed — the proxy auto-fetches a _wt token per request.
  models: {
    // Anthropic (m=11)
    'vear/claude-4.6-opus':   { provider: 'vear', m: 11, ms: 11, supports_streaming: true },
    'vear/claude-4.6-sonnet': { provider: 'vear', m: 11, ms: 10, supports_streaming: true },
    'vear/claude-4.5-opus':   { provider: 'vear', m: 11, ms: 9,  supports_streaming: true },
    'vear/claude-4.5-sonnet': { provider: 'vear', m: 11, ms: 8,  supports_streaming: true },
    'vear/claude-4.5-haiku':  { provider: 'vear', m: 11, ms: 7,  supports_streaming: true },

    // OpenAI (m=12)
    'vear/gpt-5.4':     { provider: 'vear', m: 12, ms: 19, supports_streaming: true },
    'vear/gpt-5.2':     { provider: 'vear', m: 12, ms: 17, supports_streaming: true },
    'vear/gpt-5.1':     { provider: 'vear', m: 12, ms: 16, supports_streaming: true },
    'vear/gpt-5':       { provider: 'vear', m: 12, ms: 13, supports_streaming: true },
    'vear/gpt-5-mini':  { provider: 'vear', m: 12, ms: 14, supports_streaming: true },
    'vear/gpt-5-nano':  { provider: 'vear', m: 12, ms: 15, supports_streaming: true },

    // Gemini (m=13)
    'vear/gemini-3.1-pro': { provider: 'vear', m: 13, ms: 6, supports_streaming: true },
    'vear/gemini-3.0-pro': { provider: 'vear', m: 13, ms: 5, supports_streaming: true },

    // Grok (m=14)
    'vear/grok-4.1': { provider: 'vear', m: 14, ms: 6, supports_streaming: true },
    'vear/grok-4':   { provider: 'vear', m: 14, ms: 5, supports_streaming: true },

    // DeepSeek (m=16)
    'vear/deepseek-v3': { provider: 'vear', m: 16, ms: 1, supports_streaming: true },
    'vear/deepseek-r1': { provider: 'vear', m: 16, ms: 2, supports_streaming: true },

    // DALL-E 3 (m=21, image model — streaming not applicable)
    'vear/dall-e-3': { provider: 'vear', m: 21, ms: 1, supports_streaming: false }
  },
  
  auth: {
    mode: process.env.AUTH_MODE || 'bearer',
    allowed_tokens: (process.env.ALLOWED_TOKENS || '').split(',').filter(t => t.trim())
  },
  
  timeouts: {
    upstream_request_ms: parseInt(process.env.UPSTREAM_TIMEOUT_MS) || 120000,
    idle_connection_ms: 30000
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logRequestBodies: process.env.LOG_REQUEST_BODIES === 'true'
  }
};