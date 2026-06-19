/**
 * AgroAfrica — Upload sécurisé d'images (V2.0)
 *  - mémoire tampon limitée (1 fichier, 5 Mo)
 *  - validation magic bytes (pas MIME-only)
 *  - compression automatique (Sharp)
 *  - URLs Cloudinary retournées au contrôleur
 *  - AVEC gestion d'erreurs intégrée
 */
import multer from 'multer'
import crypto from 'crypto'
import sharp from 'sharp'

const MAX_FILE_SIZE_PRODUCT = 5 * 1024 * 1024   // 5 Mo / image
const MAX_FILE_SIZE_AVATAR  = 2 * 1024 * 1024   // 2 Mo / avatar
const MAX_FILES_PER_PRODUCT = 5
const MAX_PARALLEL_UPLOADS  = 3                // ✅ limite RAM

// ✅ CORRECTION 2.2 / 2.7 — Magic bytes par type
const MAGIC_BYTES = {
  jpeg: { bytes: [0xff, 0xd8, 0xff],           extensions: ['jpg', 'jpeg'] },
  png:  { bytes: [0x89, 0x50, 0x4e, 0x47],     extensions: ['png'] },
  webp: { bytes: [0x52, 0x49, 0x46, 0x46],     extensions: ['webp'] },  // RIFF...
  gif:  { bytes: [0x47, 0x49, 0x46, 0x38],     extensions: ['gif'] }
}

const detectRealType = (buffer) => {
  for (const [type, info] of Object.entries(MAGIC_BYTES)) {
    const match = info.bytes.every((b, i) => buffer[i] === b)
    if (match) return type
  }
  return null
}

// ✅ CORRECTION 2.7 — Compression + re-typisation
const compressImage = async (buffer, realType) => {
  const pipeline = sharp(buffer, { failOn: 'truncated' }).rotate()   // respecte EXIF
  if (realType === 'gif') {
    return pipeline.gif({ quality: 80 }).toBuffer()
  }
  // Tout le reste → WebP (gain ~70% taille)
  return pipeline.webp({ quality: 82 }).toBuffer()
}

// ✅ Stockage mémoire pour compression immédiate puis suppression
const memoryStorage = multer.memoryStorage()

// ✅ CORRECTION 2.1 — Validation MIME + magic bytes
const makeFileFilter = ({ allowedTypes }) => (req, file, cb) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`❌ Type MIME non autorisé : ${file.mimetype}. Acceptés : ${allowedTypes.join(', ')}`), false)
  }
  cb(null, true)
}

/**
 * Middleware : upload + rejection magic bytes échoués
 */
const buildUploadMiddleware = ({ fieldName, maxCount, maxBytes, allowedTypes }) => {
  const middleware = multer({
    storage: memoryStorage,
    fileFilter: makeFileFilter({ allowedTypes }),
    limits: {
      fileSize: maxBytes,
      files:    Math.min(maxCount, MAX_PARALLEL_UPLOADS)
    }
  })[maxCount === 1 ? 'single' : 'array'](fieldName, Math.min(maxCount, MAX_PARALLEL_UPLOADS))

  return async (req, res, next) => {
    middleware(req, res, async (err) => {
      if (err) return handleMulterError(err, req, res, next)

      const files = req.files ?? (req.file ? [req.file] : [])
      req.validatedFiles = []

      for (const f of files) {
        // ✅ Magic bytes check
        const realType = detectRealType(f.buffer)
        if (!realType) {
          return res.status(400).json({
            message: `❌ Image invalide (signature incorrecte) : ${f.originalname}`
          })
        }
        const expected = MAGIC_BYTES[realType].extensions
        const ext = f.originalname.toLowerCase().split('.').pop()
        if (!expected.includes(ext)) {
          return res.status(400).json({
            message: `❌ Extension .${ext} incohérente avec contenu image`
          })
        }

        // ✅ Compression → tampon plus petit pour upload CDN
        try {
          const compressed = await compressImage(f.buffer, realType)
          req.validatedFiles.push({
            buffer:      compressed,
            mimetype:    realType === 'gif' ? 'image/gif' : 'image/webp',
            originalName: f.originalname,
            size:         compressed.length,
            originalSize: f.size,
            realType
          })
        } catch (e) {
          return res.status(400).json({
            message: `❌ Image corrompue ou non traitable : ${f.originalname}`
          })
        }
      }
      next()
    })
  }
}

// ✅ CORRECTION 2.6 — Helpers producteur/upload
export const generateFileName = (originalName) => {
  const ext = originalName.split('.').pop()
  const hash = crypto.randomBytes(16).toString('hex')
  const ts = Date.now()
  return `agro_${ts}_${hash}.${ext}`
}

/**
 * Préfixe CDN pour suppression future facile
 */
export const buildCdnPublicId = (category, productId, fileName) =>
  `agroafrica/${category}/${productId}/${fileName.replace(/\.[^.]+$/, '')}`

// ============================================================
// Middlewares exportés
// ============================================================

export const uploadProductImages = buildUploadMiddleware({
  fieldName:  'images',
  maxCount:   MAX_FILES_PER_PRODUCT,
  maxBytes:   MAX_FILE_SIZE_PRODUCT,
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
})

export const uploadAvatar = buildUploadMiddleware({
  fieldName:  'avatar',
  maxCount:   1,
  maxBytes:   MAX_FILE_SIZE_AVATAR,
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
})

/**
 * Upload vers Cloudinary (lazy import — ne crash pas si non configuré)
 */
export const uploadToCloudinary = async (file, publicId) => {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error('CLOUDINARY_URL non configuré')
  }
  const { v2: cloudinary } = await import('cloudinary')
  cloudinary.config({ secure: true })

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id:     publicId,
        folder:         undefined,
        resource_type: 'image',
        overwrite:      false,
        invalidate:     true
      },
      (error, result) => error ? reject(error) : resolve(result)
    )
    stream.end(file.buffer)
  })
}

// ============================================================
// ✅ CORRECTION 2.8 — Erreur Multer -> réponse claire
// ============================================================
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')  return res.status(413).json({ message: `❌ Fichier trop volumineux (max ${Math.round(err.limit / 1024 / 1024)} Mo)` })
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ message: `❌ Trop de fichiers (max ${err.limit})` })
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ message: `❌ Champ inattendu : ${err.field}` })
    return res.status(400).json({ message: `❌ Upload : ${err.message}` })
  }
  if (err) return res.status(400).json({ message: err.message })
  next()
}
