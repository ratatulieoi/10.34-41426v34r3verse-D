
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('../config');
const authMiddleware = require('./middleware/auth');
const headersMiddleware = require('./middleware/headers');
const chatRoute = require('./routes/chat');
const modelsRoute = require('./routes/models');

const app = express();

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // API-only, no UI
    crossOriginEmbedderPolicy: false
}));

// Logging
if (config.logging.level !== 'silent') {
    app.use(morgan(config.logging.level === 'debug' ? 'dev' : 'combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global middleware
app.use(headersMiddleware);

// Auth (applied per-route as needed)
app.use('/v1', authMiddleware);

// Routes
app.use('/v1/chat/completions', chatRoute);
app.use('/v1/models', modelsRoute);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            type: 'not_found',
            message: `Route ${req.method} ${req.path} not found`,
            verbose: 'vear-reverse proxy only supports POST /v1/chat/completions'
        }
    });
});

// Global error handler - VERBOSE, pass real errors
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);

    // If it's an upstream error, pass it through verbosely
    if (err.upstream) {
        return res.status(err.status || 502).json({
            error: {
                type: err.type || 'upstream_error',
                message: err.message || 'Upstream provider error',
                verbose: {
                    provider: err.provider,
                    upstream_status: err.upstream_status,
                    upstream_body: err.upstream_body,
                    original_error: err.original_error
                }
            }
        });
    }

    // Generic server error
    res.status(err.status || 500).json({
        error: {
            type: err.type || 'internal_error',
            message: err.message || 'Internal server error',
            verbose: config.nodeEnv === 'development' ? { stack: err.stack } : undefined
        }
    });
});

// Start server
const server = app.listen(config.port, () => {
    console.log(`🚀 vear-reverse listening on port ${config.port}`);
    console.log(`📡 Endpoint: POST http://localhost:${config.port}/v1/chat/completions`);
    console.log(`🔑 Auth mode: ${config.auth.mode}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = app;