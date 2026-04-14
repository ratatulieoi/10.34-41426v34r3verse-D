const config = require('../../config');

/**
 * Parse model ID and return provider config
 * @param {string} modelId - e.g., "vear/gemini-3.1-pro"
 * @returns {Object} modelConfig or throws error
 */
function resolveModel(modelId) {
  if (!modelId) {
    throw {
      type: 'missing_model',
      message: 'Missing "model" field in request',
      verbose: { hint: 'Use format: vear/<model-name>, e.g., vear/gemini-3.1-pro' }
    };
  }
  
  const modelConfig = config.models[modelId];
  
  if (!modelConfig) {
    const available = Object.keys(config.models).join(', ');
    throw {
      type: 'unknown_model',
      message: `Unknown model: ${modelId}`,
      verbose: {
        requested: modelId,
        available_models: available,
        hint: 'Model IDs must use format: vear/<model-name>'
      }
    };
  }
  
  return { modelId, ...modelConfig };
}

module.exports = { resolveModel };