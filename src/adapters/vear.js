const WebSocket = require('ws');
const crypto = require('crypto');
const { pipeStream } = require('./base');

/**
 * Generates a random alphanumeric string for Vear IDs
 */
function generateId(length = 20) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Execute request to Vear.com API via WebSockets
 */
async function execute(vearPayload, modelConfig) {
  const authCookieString = process.env.VEAR_COOKIE;
  
  if (!authCookieString) {
    throw {
      upstream: false,
      type: 'missing_provider_key',
      message: `Missing environment variable: VEAR_COOKIE`,
      verbose: {
        hint: `Set VEAR_COOKIE in your .env file with your PHPSESSID from vear.com. You can separate multiple cookies with commas.`,
        model: modelConfig.provider
      }
    };
  }

  // Support multiple cookies separated by commas
  const cookies = authCookieString.split(',').map(c => c.trim()).filter(Boolean);
  const authCookie = cookies[Math.floor(Math.random() * cookies.length)];

  // Extract the latest user message from the payload
  const messages = vearPayload.messages || [];
  const latestMessage = messages[messages.length - 1];
  const prompt = latestMessage ? latestMessage.content : '';
  const modelId = vearPayload.model;

  // We need to return an object with a response property that is a readable stream,
  // just like the axios response objects returned by other adapters
  const { PassThrough } = require('stream');
  const responseStream = new PassThrough();

  const isStreaming = vearPayload.stream !== false;
  let fullResponse = '';

  const ws = new WebSocket('wss://vear.com/conversation/go', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
      'Origin': 'https://vear.com',
      'Cookie': `PHPSESSID=${authCookie}`
    }
  });

  const uid = `uid-${generateId(15)}`;
  const mid = `mid-${generateId(25)}`;
  
  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      // Send the initial payload user captured
      const payload = {
        id: uid,
        mid: mid,
        q: prompt,
        m: 11, // This is model generic routing it seems based on user payload
        ms: 10,
        t: "m",
        uid: uid
      };
      
      ws.send(JSON.stringify(payload));
      
      // If streaming, resolve immediately with the stream so the router can pipe it
      if (isStreaming) {
        resolve({ stream: true, response: responseStream });
      }
    });

    ws.on('message', (data) => {
      try {
        const msgStr = data.toString();
        // Sometimes WebSocket messages from Vear might be separated by newlines if bundled
        const parts = msgStr.split('\n').filter(p => p.trim());
        
        for (const part of parts) {
          const msg = JSON.parse(part);
          
          if (msg.t === 's' && msg.c) {
            // Stream token received
            fullResponse += msg.c;
            if (isStreaming) {
              const chunk = formatSSEChunk(msg.c, modelId);
              responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
          } else if (msg.t === 'm' && msg.c) {
            // Alternative stream token received
            fullResponse += msg.c;
            if (isStreaming) {
              const chunk = formatSSEChunk(msg.c, modelId);
              responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
          } else if (msg.t === 'n' && msg.c === '') {
            // End of stream received
            if (isStreaming) {
              const endChunk = formatSSEChunk('', modelId, 'stop');
              responseStream.write(`data: ${JSON.stringify(endChunk)}\n\n`);
              responseStream.write('data: [DONE]\n\n');
              responseStream.end();
            } else {
              // Resolve promise with final payload if not streaming
              resolve({
                stream: false,
                data: formatFullResponse(fullResponse, modelId)
              });
            }
            ws.close();
          }
        }
      } catch (err) {
        console.error("Error parsing WS message:", err, data.toString());
      }
    });

    ws.on('error', (err) => {
      if (isStreaming) {
        responseStream.end();
      }
      reject({
        upstream: true,
        type: 'upstream_error',
        message: err.message
      });
    });

    ws.on('close', () => {
      if (isStreaming) {
        responseStream.end();
      }
    });
  });
}

function formatSSEChunk(content, modelId, finishReason = null) {
  return {
    id: `chatcmpl-${crypto.randomBytes(4).toString('hex')}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      delta: content ? { content } : {},
      finish_reason: finishReason
    }]
  };
}

function formatFullResponse(content, modelId) {
  return {
    id: `chatcmpl-${crypto.randomBytes(4).toString('hex')}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

module.exports = {
  execute,
  formatSSEChunk,
  formatFullResponse
};
