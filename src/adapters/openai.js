const axios = require('axios');
const config = require('../../config');
const { isStreaming, normalizeUpstreamError, pipeStream } = require('./base');
const { getProviderInstance } = require('../pool/provider-pool');

/**
 * Transform vear-style payload → OpenAI API format
 * (Mostly 1:1, but we ensure compatibility)
 */
function transformRequest(vearPayload) {
  const { model, messages, temperature, top_p, max_tokens, stream, ...rest } = vearPayload;
  
  return {
    model: model?.replace('vear/', ''), // Strip vear/ prefix for upstream
    messages,
    temperature,
    top_p,
    max_completion_tokens: max_tokens, // OpenAI prefers this now
    stream,
    ...rest
  };
}

/**
 * Transform OpenAI response → vear-compatible format
 */
function transformResponse(openaiResponse) {
  return {
    id: openaiResponse.id,
    object: 'chat.completion',
    created: openaiResponse.created,
    model: `vear/${openaiResponse.model}`,
    choices: openaiResponse.choices,
    usage: openaiResponse.usage,
    system_fingerprint: openaiResponse.system_fingerprint
  };
}

/**
 * Execute request to OpenAI-compatible endpoint
 */
async function execute(vearPayload, modelConfig) {
  const apiKey = process.env[modelConfig.auth_env];
  
  if (!apiKey) {
    throw {
      upstream: false,
      type: 'missing_provider_key',
      message: `Missing environment variable: ${modelConfig.auth_env}`,
      verbose: {
        hint: `Set ${modelConfig.auth_env} in your .env file`,
        model: modelConfig.provider
      }
    };
  }
  
  const transformed = transformRequest(vearPayload);
  const client = getProviderInstance('openai');
  
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...modelConfig.headers
  };
  
  const url = modelConfig.endpoint;
  
  try {
    if (isStreaming(vearPayload) && modelConfig.supports_streaming) {
      // Streaming: pipe SSE directly
      const response = await client.post(url, transformed, {
        headers,
        responseType: 'stream'
      });
      
      return { stream: true, response };
    } else {
      // Non-streaming: get JSON response
      const response = await client.post(url, transformed, { headers });
      
      if (response.status >= 400) {
        throw normalizeUpstreamError('openai', new Error(response.statusText), response);
      }
      
      return {
        stream: false,
        data: transformResponse(response.data)
      };
    }
  } catch (error) {
    if (error.upstream) throw error;
    throw normalizeUpstreamError('openai', error, error.response);
  }
}

module.exports = {
  transformRequest,
  transformResponse,
  execute
};