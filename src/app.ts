import express from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { corsMiddleware } from './middleware/cors.js';
import { apiRouter } from './routes/index.js';

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
app.use(corsMiddleware);

// --- Body Parsing ---
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- API Routes ---
app.use('/api', apiRouter);

// --- Global Error Handler ---
app.use(errorHandler);

export { app };
