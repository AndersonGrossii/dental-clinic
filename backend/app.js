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
app.use(cors({
  origin: config.app.env === 'development' ? config.app.frontendUrl : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ---- Rate Limiting ----
app.use(generalLimiter);

// ---- Body Parsing ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---- Sanitización XSS ----
app.use(sanitizeBody);

// ---- Logging HTTP ----
app.use(morgan(config.app.env === 'production' ? 'combined' : 'dev'));

// ---- Archivos estáticos (uploads) ----
app.use('/uploads', express.static(config.upload.path));

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
