// ============================================
// Logger — Utilidad de registro de eventos
// ============================================

/**
 * Logger simple y eficiente para la aplicación.
 * En producción se puede reemplazar por Winston o Pino.
 */
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'debug'] ?? 3;

/**
 * Formatea la fecha actual para los logs.
 * @returns {string}
 */
const timestamp = () => new Date().toISOString();

/**
 * Formatea un mensaje de log con nivel y timestamp.
 * @param {string} level
 * @param {string} message
 * @param  {...any} args
 */
const formatLog = (level, message, ...args) => {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (args.length > 0) {
    console.log(prefix, message, ...args);
  } else {
    console.log(prefix, message);
  }
};

export const logger = {
  error: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.error) formatLog('error', message, ...args);
  },
  warn: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.warn) formatLog('warn', message, ...args);
  },
  info: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.info) formatLog('info', message, ...args);
  },
  debug: (message, ...args) => {
    if (currentLevel >= LOG_LEVELS.debug) formatLog('debug', message, ...args);
  },
};
