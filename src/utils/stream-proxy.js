/**
 * Handle streaming response passthrough with format normalization
 */

/**
 * Proxy Anthropic SSE stream → OpenAI-compatible SSE chunks
 */
function proxyAnthropicStream(upstreamRes, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  let buffer = '';
  
  upstreamRes.data.on('data', (chunk) => {
    buffer += chunk.toString();
    
    // Process complete SSE events (separated by \n\n)
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    
    for (const event of events) {
      if (!event.trim()) continue;
      
      try {
        // Anthropic sends "event: <type>\ndata: <json>"
        const lines = event.split('\n');
        const dataLine = lines.find(l => l.startsWith('data:'));
        if (!dataLine) continue;
        
        const jsonData = JSON.parse(dataLine.slice(5).trim());
        
        // Transform to OpenAI-compatible chunk
        const openaiChunk = {
          id: jsonData.message_id || `vear-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: `vear/${jsonData.model || 'claude'}`,
          choices: [{
            index: 0,
            delta: { 
              content: jsonData.delta?.text || '' 
            },
            finish_reason: jsonData.stop_reason || null
          }]
        };
        
        res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
      } catch (e) {
        console.warn('[STREAM PARSE ERROR]', e.message);
      }
    }
  });
  
  upstreamRes.data.on('end', () => {
    res.write('data: [DONE]\n\n');
    res.end();
  });
  
  upstreamRes.data.on('error', (err) => {
    console.error('[UPSTREAM STREAM ERROR]', err);
    if (!res.headersSent) {
      res.status(502).json({ error: { type: 'upstream_stream_error', message: err.message } });
    } else {
      res.end();
    }
  });
}

/**
 * Proxy Gemini NDJSON stream → OpenAI-compatible SSE
 */
function proxyGeminiStream(upstreamRes, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  let buffer = '';
  
  upstreamRes.data.on('data', (chunk) => {
    buffer += chunk.toString();
    
    // Gemini sends newline-delimited JSON (not SSE format)
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim() || line.startsWith('[')) continue; // Skip array start
      
      try {
        const jsonData = JSON.parse(line);
        
        // Gemini streaming response format
        const content = jsonData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const finishReason = jsonData.candidates?.[0]?.finishReason || null;
        
        const openaiChunk = {
          id: `vear-gemini-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: `vear/gemini`,
          choices: [{
            index: 0,
            delta: { content },
            finish_reason: finishReason
          }]
        };
        
        res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
        
        if (finishReason) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } catch (e) {
        // Ignore parse errors for partial chunks
      }
    }
  });
  
  upstreamRes.data.on('end', () => {
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });
  
  upstreamRes.data.on('error', (err) => {
    console.error('[GEMINI STREAM ERROR]', err);
    if (!res.headersSent) {
      res.status(502).json({ error: { type: 'upstream_stream_error', message: err.message } });
    }
  });
}

/**
 * Proxy OpenAI-compatible stream (pass through with minimal transformation)
 */
function proxyOpenAIStream(upstreamRes, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  upstreamRes.data.on('data', (chunk) => {
    const str = chunk.toString();
    
    // OpenAI sends "data: <json>\n\n"
    const lines = str.split('\n').filter(l => l.startsWith('data: '));
    
    for (const line of lines) {
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {
        res.write('data: [DONE]\n\n');
        continue;
      }
      
      try {
        const chunkData = JSON.parse(jsonStr);
        // Normalize model name to vear/<model>
        if (chunkData.model && !chunkData.model.startsWith('vear/')) {
          chunkData.model = `vear/${chunkData.model}`;
        }
        res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
      } catch (e) {
        // Pass through raw if parse fails
        res.write(line + '\n');
      }
    }
  });
  
  upstreamRes.data.on('end', () => {
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });
  
  upstreamRes.data.on('error', (err) => {
    console.error('[OPENAI STREAM ERROR]', err);
    if (!res.headersSent) {
      res.status(502).json({ error: { type: 'upstream_stream_error', message: err.message } });
    }
  });
}

module.exports = {
  proxyAnthropicStream,
  proxyGeminiStream,
  proxyOpenAIStream
};