const request = require('supertest');
const app = require('../../src/server');
const config = require('../../config');

describe('Authentication', () => {
  const validToken = config.auth.allowed_tokens[0] || 'test-token';
  
  test('POST /v1/chat/completions returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({ model: 'vear/gpt-5', messages: [] });
    
    expect(res.status).toBe(401);
    expect(res.body.error.type).toBe('missing_authorization');
    expect(res.body.error.verbose).toBeDefined();
  });
  
  test('POST /v1/chat/completions returns 401 with invalid token', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer invalid-token')
      .send({ model: 'vear/gpt-5', messages: [] });
    
    expect(res.status).toBe(401);
    expect(res.body.error.type).toBe('invalid_token');
  });
  
  test('POST /v1/chat/completions accepts valid bearer token', async () => {
    // This will fail at model resolution (no upstream keys), but auth should pass
    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ model: 'vear/gpt-5', messages: [{ role: 'user', content: 'hi' }] });
    
    // Expect auth to pass, then fail at provider key check (which is expected in tests)
    expect(res.status).not.toBe(401);
    expect(res.body.error?.type).not.toBe('invalid_token');
  });
  
  test('GET /health returns 200 without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});