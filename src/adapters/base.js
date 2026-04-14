/**
 * Base adapter utilities for provider transformations
 */

/**
 * Extract streaming flag from vear payload
 */
function isStreaming(payload) {
  return payload.stream === true;
}

/**
 * Normalize upstream error into verbose format
 */
function normalizeUpstreamError(provider, error, response) {
  return {
    upstream: true,
    provider,
    message: error?.message || 'Upstream request failed',
    type: error?.code || 'upstream_request_error',
    status: response?.status,
    upstream_status: response?.status,
    upstream_body: response?.data,
    original_error: {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    }
  };
}

/**
 * Pipe streaming response from upstream to client
 */
function pipeStream(upstreamResponse, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  upstreamResponse.data.on('data', (chunk) => {
    res.write(chunk);
  });
  
  upstreamResponse.data.on('end', () => {
    res.end();
  });
  
  upstreamResponse.data.on('error', (err) => {
    console.error('[STREAM ERROR]', err);
    if (!res.headersSent) {
      res.status(502).json({ error: { type: 'stream_error', message: err.message } });
    } else {
      res.end();
    }
  });
}

module.exports = {
  isStreaming,
  normalizeUpstreamError,
  pipeStream
};