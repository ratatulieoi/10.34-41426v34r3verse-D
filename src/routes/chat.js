const express = require('express');
const router = express.Router();
const { resolveModel } = require('../utils/model-router');
const { pipeStream } = require('../adapters/base');
const streamProxy = require('../utils/stream-proxy');

// Adapter imports
const openaiAdapter = require('../adapters/openai');
const anthropicAdapter = require('../adapters/anthropic');
const geminiAdapter = require('../adapters/gemini');

// Adapter registry
const adapters = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  vear: require('../adapters/vear')
};

/**
 * Convert a non-streaming chat.completion response into SSE chunks
 * for clients that requested streaming.
 */
function convertToSSE(data, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const content = data.choices[0].message.content;
  const toolCalls = data.choices[0].message.tool_calls;
  const model = data.model;
  const id = data.id;

  // Send role delta
  res.write(`data: ${JSON.stringify({
    id, object: 'chat.completion.chunk', created: data.created, model,
    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
  })}\n\n`);

  // Send content as a single chunk (or tool calls)
  if (toolCalls) {
    res.write(`data: ${JSON.stringify({
      id, object: 'chat.completion.chunk', created: data.created, model,
      choices: [{ index: 0, delta: { tool_calls: toolCalls }, finish_reason: null }]
    })}\n\n`);
  } else if (content) {
    res.write(`data: ${JSON.stringify({
      id, object: 'chat.completion.chunk', created: data.created, model,
      choices: [{ index: 0, delta: { content }, finish_reason: null }]
    })}\n\n`);
  }

  // Send finish
  res.write(`data: ${JSON.stringify({
    id, object: 'chat.completion.chunk', created: data.created, model,
    choices: [{ index: 0, delta: {}, finish_reason: data.choices[0].finish_reason }]
  })}\n\n`);

  res.write('data: [DONE]\n\n');
  res.end();
}

router.post('/', async (req, res, next) => {
  try {
    const { model, stream, ...payload } = req.body;
    const wantsStreaming = stream !== false;

    // Resolve model to provider config
    const { modelId, provider, ...modelConfig } = resolveModel(model);

    // Get appropriate adapter
    const adapter = adapters[provider];
    if (!adapter) {
      throw {
        type: 'adapter_not_found',
        message: `No adapter implemented for provider: ${provider}`,
        verbose: {
          model: modelId,
          provider,
          available: Object.keys(adapters).join(', ')
        }
      };
    }

    // Execute via adapter
    const result = await adapter.execute({ model, stream, ...payload }, modelConfig);

    // Vear adapter always returns { stream: false, data: ... }
    // If client requested streaming, convert the full response into SSE chunks
    if (wantsStreaming && !result.stream) {
      convertToSSE(result.data, res);
    } else if (result.stream && modelConfig.supports_streaming) {
      // Other adapters that use real streaming
      const proxyFn = streamProxy[`proxy${provider.charAt(0).toUpperCase() + provider.slice(1)}Stream`];

      if (proxyFn) {
        proxyFn(result.response, res);
      } else {
        pipeStream(result.response, res);
      }
    } else {
      // Non-streaming response
      res.json(result.data);
    }

  } catch (error) {
    next(error);
  }
});

module.exports = router;