const axios = require('axios');
const config = require('../../config');
const { isStreaming, normalizeUpstreamError } = require('./base');
const { getProviderInstance } = require('../pool/provider-pool');

/**
 * Transform vear-style payload → Gemini REST API format
 */
function transformRequest(vearPayload) {
  const { model, messages, temperature, top_p, max_tokens, stream, ...rest } = vearPayload;
  
  // Convert OpenAI messages to Gemini contents format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
  
  const generationConfig = {
    temperature,
    topP: top_p,
    maxOutputTokens: max_tokens,
    stopSequences: rest.stop_sequences
  };
  
  // Remove undefined values
  Object.keys(generationConfig).forEach(key => {
    if (generationConfig[key] === undefined) delete generationConfig[key];
  });
  
  return {
    contents,
    generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
    ...rest
  };
}

/**
 * Transform Gemini response → vear-compatible format
 */
function transformResponse(geminiResponse) {
  const candidate = geminiResponse.candidates?.[0];
  
  return {
    id: `gemini-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: `vear/${geminiResponse.modelVersion || 'gemini'}`,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: candidate?.content?.parts?.[0]?.text || ''
      },
      finish_reason: candidate?.finishReason || 'stop'
    }],
    usage: geminiResponse.usageMetadata ? {
      prompt_tokens: geminiResponse.usageMetadata.promptTokenCount,
      completion_tokens: geminiResponse.usageMetadata.candidatesTokenCount,
      total_tokens: geminiResponse.usageMetadata.totalTokenCount
    } : undefined
  };
}

/**
 * Execute request to Gemini API
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
  const client = getProviderInstance('gemini');
  
  // Gemini uses API key in query param
  const url = new URL(modelConfig.endpoint);
  url.searchParams.append('key', apiKey);
  
  // Add streaming param if needed
  if (isStreaming(vearPayload) && modelConfig.supports_streaming && modelConfig.stream_param) {
    url.searchParams.append(modelConfig.stream_param, modelConfig.stream_value || 'sse');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...modelConfig.headers
  };
  
  try {
    if (isStreaming(vearPayload) && modelConfig.supports_streaming) {
      // Gemini streaming returns newline-delimited JSON
      const response = await client.post(url.toString(), transformed, {
        headers,
        responseType: 'stream'
      });
      
      return { stream: true, response };
    } else {
      const response = await client.post(url.toString(), transformed, { headers });
      
      if (response.status >= 400) {
        throw normalizeUpstreamError('gemini', new Error(response.statusText), response);
      }
      
      return {
        stream: false,
        data: transformResponse(response.data)
      };
    }
  } catch (error) {
    if (error.upstream) throw error;
    throw normalizeUpstreamError('gemini', error, error.response);
  }
}

module.exports = {
  transformRequest,
  transformResponse,
  execute
};