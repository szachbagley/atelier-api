import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { securityHeaders } from './middleware/securityHeaders.js';

const app = express();

// --- Request ID ---
app.use(requestId);

// --- Logging ---
app.use(
  pinoHttp({
    logger,
    genReqId: (req) =>
      (req as express.Request & { requestId: string }).requestId,
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  })
);

// --- Security Headers ---
app.use(securityHeaders);

// --- CORS ---
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.cors.origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  })
);

// --- Body Parsing ---
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- API Routes (placeholder) ---
// API router will be mounted here in Phase 5+

// --- Global Error Handler ---
app.use(errorHandler);

export { app };
