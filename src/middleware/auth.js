const config = require('../../config');

module.exports = (req, res, next) => {
  const authMode = config.auth.mode;
  
  // Skip auth for dev/none mode
  if (authMode === 'none') {
    console.warn('⚠️  Auth disabled (AUTH_MODE=none) - DO NOT USE IN PRODUCTION');
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: {
        type: 'missing_authorization',
        message: 'Missing Authorization header',
        verbose: 'Expected: Authorization: Bearer <token>'
      }
    });
  }
  
  const [type, token] = authHeader.split(' ');
  
  if (type?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({
      error: {
        type: 'invalid_authorization_format',
        message: 'Invalid Authorization header format',
        verbose: 'Expected: Authorization: Bearer <token>'
      }
    });
  }
  
  // Validate token against allowlist
  if (config.auth.allowed_tokens.length > 0 && !config.auth.allowed_tokens.includes(token)) {
    return res.status(401).json({
      error: {
        type: 'invalid_token',
        message: 'Invalid or unauthorized token',
        verbose: {
          allowed_count: config.auth.allowed_tokens.length,
          hint: 'Check ALLOWED_TOKENS environment variable'
        }
      }
    });
  }
  
  // Attach token to request for downstream use if needed
  req.vearAuthToken = token;
  next();
};