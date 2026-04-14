const axios = require('axios');
const config = require('../../config');
const { isStreaming, normalizeUpstreamError, pipeStream } = require('./base');
const { getProviderInstance } = require('../pool/provider-pool');

/**
 * Transform vear-style payload → Anthropic Messages API format
 */
function transformRequest(vearPayload) {
  const { model, messages, temperature, top_p, max_tokens, stream, stop_sequences, ...rest } = vearPayload;
  
  // Convert OpenAI-style messages to Anthropic format
  // Anthropic requires: role = 'user' | 'assistant', content can be string or array
  const anthropicMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));
  
  return {
    model: model?.replace('vear/', ''),
    messages: anthropicMessages,
    temperature,
    top_p,
    max_tokens: max_tokens || 4096, // Anthropic requires this
    stream,
    stop_sequences,
    ...rest
  };
}

/**
 * Transform Anthropic response → vear-compatible format
 */
function transformResponse(anthropicResponse) {
  // Handle streaming vs non-streaming
  if (anthropicResponse.type === 'message_start') {
    return {
      id: anthropicResponse.message?.id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: `vear/${anthropicResponse.message?.model}`,
      choices: [{
        index: 0,
        delta: { role: 'assistant', content: '' },
        finish_reason: null
      }]
    };
  }
  
  if (anthropicResponse.type === 'content_block_delta') {
    return {
      id: anthropicResponse.message_id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: `vear/claude`,
      choices: [{
        index: 0,
        delta: { content: anthropicResponse.delta?.text },
        finish_reason: null
      }]
    };
  }
  
  // Non-streaming full response
  return {
    id: anthropicResponse.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: `vear/${anthropicResponse.model}`,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: anthropicResponse.content?.[0]?.text || ''
      },
      finish_reason: anthropicResponse.stop_reason
    }],
    usage: anthropicResponse.usage ? {
      prompt_tokens: anthropicResponse.usage.input_tokens,
      completion_tokens: anthropicResponse.usage.output_tokens,
      total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens
    } : undefined
  };
}

/**
 * Execute request to Anthropic API
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
  const client = getProviderInstance('anthropic');
  
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': modelConfig.headers['anthropic-version'],
    'Content-Type': 'application/json',
    ...modelConfig.headers
  };
  
  const url = modelConfig.endpoint;
  
  try {
    if (isStreaming(vearPayload) && modelConfig.supports_streaming) {
      // Anthropic streaming uses SSE
      const response = await client.post(url, transformed, {
        headers,
        responseType: 'stream'
      });
      
      return { stream: true, response };
    } else {
      const response = await client.post(url, transformed, { headers });
      
      if (response.status >= 400) {
        throw normalizeUpstreamError('anthropic', new Error(response.statusText), response);
      }
      
      return {
        stream: false,
        data: transformResponse(response.data)
      };
    }
  } catch (error) {
    if (error.upstream) throw error;
    throw normalizeUpstreamError('anthropic', error, error.response);
  }
}

module.exports = {
  transformRequest,
  transformResponse,
  execute
};