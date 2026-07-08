// ============================================
// Configuración de la Aplicación Express
// ============================================
import dotenv from 'dotenv';
dotenv.config();

// Parse Railway DATABASE_URL into individual fields
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    process.env.DB_HOST = url.hostname;
    process.env.DB_PORT = url.port;
    process.env.DB_USER = url.username;
    process.env.DB_PASSWORD = url.password;
    process.env.DB_NAME = url.pathname.replace('/', '');
  } catch (err) {
    console.error('Error parsing DATABASE_URL:', err.message);
  }
}

/**
 * Configuración centralizada de la aplicación.
 * Todas las variables de entorno se acceden desde aquí.
 */
const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 4000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'dental_clinic',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'S@ntos9403',
    ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production',
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    poolIdleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiration: process.env.JWT_EXPIRATION || '1h',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 2000,
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 500,
  },
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 10485760,
    path: process.env.UPLOAD_PATH || './uploads',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    file: process.env.LOG_FILE || './logs/app.log',
  },
};

export default config;
