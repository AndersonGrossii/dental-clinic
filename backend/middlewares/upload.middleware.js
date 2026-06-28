// ============================================
// Middleware de Upload de Archivos
// ============================================
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/app.js';

/**
 * Configuración de almacenamiento de Multer.
 * Los archivos se guardan con nombre único (UUID).
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.path);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

/**
 * Filtro de tipos de archivo permitidos.
 */
const fileFilter = (_req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Se aceptan: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX.'), false);
  }
};

/**
 * Middleware de Multer configurado para la aplicación.
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize,
  },
});

/**
 * Upload de imagen única.
 */
export const uploadSingleImage = upload.single('image');

/**
 * Upload de múltiples imágenes (máximo 10).
 */
export const uploadMultipleImages = upload.array('images', 10);

/**
 * Upload de documento único.
 */
export const uploadDocument = upload.single('document');
