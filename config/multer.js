import multer from 'multer'
import { fileURLToPath } from 'url'
import { dirname, extname } from 'path'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ═══════════════════════════════════════
// CONFIGURATION UPLOAD PHOTOS PRODUITS
// ═══════════════════════════════════════

// Types MIME autorisés
const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png',
  'image/webp', 'image/gif'
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_FILES = 5 // Maximum 5 photos par produit

// Stockage en mémoire (pour Cloudinary ou envoi vers un CDN)
const storage = multer.memoryStorage()

// Filtre des fichiers
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`❌ Type de fichier non autorisé : ${file.mimetype}. Formats acceptés : JPEG, PNG, WebP, GIF`), false)
  }
}

// Middleware Multer
export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  }
}).array('images', MAX_FILES)

// Middleware single upload (avatar, etc.)
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB pour avatar
}).single('avatar')

// Générer un nom de fichier unique
export const generateFileName = (originalName) => {
  const ext = extname(originalName)
  const hash = crypto.randomBytes(16).toString('hex')
  return `${hash}${ext}`
}

// Erreur Multer gérée
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `❌ Fichier trop volumineux. Taille max : ${MAX_FILE_SIZE / 1024 / 1024}MB` })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: `❌ Trop de fichiers. Maximum : ${MAX_FILES} photos` })
    }
    return res.status(400).json({ message: `❌ Erreur upload : ${err.message}` })
  }
  if (err) {
    return res.status(400).json({ message: err.message })
  }
  next()
}