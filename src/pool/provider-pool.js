const axios = require('axios');
const config = require('../../config');

// HTTP agent with keep-alive for connection pooling
const createAgent = () => {
  if (typeof require !== 'undefined') {
    try {
      const HttpsProxyAgent = require('https-proxy-agent');
      // Add proxy support if needed in future
    } catch (e) { /* optional */ }
  }
  return {
    keepAlive: true,
    keepAliveMsecs: config.timeouts.idle_connection_ms,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: config.timeouts.upstream_request_ms
  };
};

// Create axios instances per provider for connection pooling
const instances = {};

const getProviderInstance = (providerName) => {
  if (!instances[providerName]) {
    instances[providerName] = axios.create({
      httpsAgent: createAgent(),
      timeout: config.timeouts.upstream_request_ms,
      validateStatus: () => true // Always resolve, handle status manually
    });
  }
  return instances[providerName];
};

module.exports = {
  getProviderInstance,
  closeAll: () => {
    Object.values(instances).forEach(instance => {
      // axios doesn't expose agent directly; rely on Node.js cleanup
    });
  }
};