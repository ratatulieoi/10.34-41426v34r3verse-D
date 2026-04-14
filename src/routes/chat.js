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

router.post('/', async (req, res, next) => {
  try {
    const { model, stream, ...payload } = req.body;
    
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
    const result = await adapter.execute({ model, ...payload }, modelConfig);
    
    if (result.stream && modelConfig.supports_streaming) {
      // Handle streaming response
      const proxyFn = streamProxy[`proxy${provider.charAt(0).toUpperCase() + provider.slice(1)}Stream`];
      
      if (proxyFn) {
        proxyFn(result.response, res);
      } else if (provider === 'vear') {
        // Vear adapter directly emits valid SSE strings, so we can just pipe directly.
        // We set the standard SSE headers first.
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        result.response.on('data', chunk => {
          res.write(chunk);
        });
        
        result.response.on('end', () => {
          res.end();
        });
      } else {
        // Fallback to basic pipe
        pipeStream(result.response, res);
      }
    } else {
      // Handle non-streaming response
      res.json(result.data);
    }
    
  } catch (error) {
    // Pass all errors to global error handler for verbose output
    next(error);
  }
});

module.exports = router;