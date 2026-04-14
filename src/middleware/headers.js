module.exports = (req, res, next) => {
  // Set consistent response headers
  res.setHeader('X-Powered-By', 'vear-reverse/0.1.0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // CORS - minimal for API usage
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
};