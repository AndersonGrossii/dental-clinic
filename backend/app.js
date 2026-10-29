// ============================================
// Aplicación Express — Configuración
// ============================================
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { generalLimiter } from './middlewares/rateLimiter.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware.js';
import { sanitizeBody } from './middlewares/validation.middleware.js';
import config from './config/app.js';
import routes from './routes/index.js';

const __dirname = new URL('.', import.meta.url).pathname;
const app = express();
app.set('trust proxy', 1);

// ---- Seguridad ----
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

// ---- CORS ----
// In production, explicitly configure every browser origin that should access the API.
// Requests without an Origin header (e.g. server-to-server/webhook calls) are not browser CORS requests.
const configuredCorsOrigins = [
  config.app.frontendUrl,
  ...(process.env.CORS_ALLOWED_ORIGINS || '').split(','),
]
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedCorsOrigins = new Set(configuredCorsOrigins);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.has(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-ID', 'X-Hub-Signature-256'],
}));

// ---- Rate Limiting ----
app.use(generalLimiter);

// ---- Body Parsing ----
// Meta signs the exact request bytes. Preserve the raw JSON body before parsing it.
app.use(express.json({
  limit: '10mb',
  verify(req, _res, buffer) {
    req.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---- Sanitización XSS ----
app.use(sanitizeBody);

// ---- Logging HTTP ----
app.use(morgan(config.app.env === 'production' ? 'combined' : 'dev'));

// ---- Archivos estáticos (uploads) ----
// TODO(security): replace public static delivery with authenticated, clinic-scoped file access.

// ---- Archivos estáticos (frontend) en producción ----
if (config.app.env === 'production') {
  const frontendPath = path.resolve(__dirname, '../frontend');
  app.use(express.static(frontendPath));
}

// ---- Health Check ----
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API del Sistema de Gestión de Clínica Dental funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: config.app.env,
  });
});

// ---- Rutas de la API ----
app.use('/api/v1', routes);

// ---- SPA fallback (solo producción) ----
if (config.app.env === 'production') {
  const frontendPath = path.resolve(__dirname, '../frontend');
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// ---- Ruta 404 ----
app.use(notFoundMiddleware);

// ---- Manejo de errores ----
app.use(errorMiddleware);

export default app;
