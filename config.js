require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  models: {
    // Anthropic
    'vear/claude-4.6-opus': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/claude-4.6-sonnet': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/claude-4.5-opus': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/claude-4.5-sonnet': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/claude-4.5-haiku': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },

    // OpenAI
    'vear/gpt-5.4': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/gpt-5.2': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/gpt-5.1': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/gpt-5': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/gpt-5-mini': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/gpt-5-nano': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },

    // Gemini
    'vear/gemini-3.1-pro': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/gemini-3.0-pro': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },

    // Grok
    'vear/grok-4.1': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true },
    'vear/grok-4': { provider: 'vear', auth_env: 'VEAR_COOKIE', supports_streaming: true }
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