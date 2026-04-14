# vear-reverse — API Reverse Proxy

## 🎯 Purpose
Expose Vear.com's aggregated AI models via a standalone, OpenAI-compatible API endpoint. Use from anywhere: curl, Python, LangChain, etc.

## 🔑 Quick Start

```bash
# 1. Install dependencies
cd vear-reverse
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set ALLOWED_TOKENS and at least one provider API key

# 3. Run
npm start
# Server: http://localhost:3001