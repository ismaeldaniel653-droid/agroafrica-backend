/**
 * AgroAfrica — Upload Routes V2.0
 *  - Rate limit
 *  - Validation taille
 *  - Erreur handler global
 */
import express from 'express'
import rateLimit from 'express-rate-limit'

import { protect } from '../middleware/authMiddleware.js'
import {
  uploadProductImages, uploadAvatar, uploadToCloudinary,
  buildCdnPublicId, handleMulterError
} from '../config/multer.js'

const router = express.Router()

// ✅ Validation taille avant lecture multer
router.use(express.json({ limit: '5kb' }))

const writeLimiter = rateLimit({ windowMs: 60_000, max: 30 })

router.post('/product', protect, writeLimiter, uploadProductImages, async (req, res) => {
  try {
    if (!req.validatedFiles?.length) {
      return res.status(400).json({ message: '❌ Aucune image reçue' })
    }
    const category = req.body.category || 'misc'
    const productId = req.body.productId || `tmp_${Date.now()}`
    const uploaded = []

    for (const f of req.validatedFiles) {
      const publicId = buildCdnPublicId(category, productId, f.originalName)
      const result   = await uploadToCloudinary(f, publicId)
      uploaded.push({
        url:         result.secure_url,
        publicId:    result.public_id,
        size:        f.size,
        compression: `${Math.round((1 - f.size / f.originalSize) * 100)}%`
      })
    }
    res.json({ message: '✅ Images uploadées', uploaded })
  } catch (e) {
    console.error('upload product:', e)
    res.status(500).json({ message: '❌ Upload échoué', error: e.message })
  }
})

router.post('/avatar', protect, writeLimiter, uploadAvatar, async (req, res) => {
  try {
    if (!req.validatedFiles?.length) {
      return res.status(400).json({ message: '❌ Avatar manquant' })
    }
    const f        = req.validatedFiles[0]
    const publicId = buildCdnPublicId('avatars', req.userId, f.originalName)
    const result   = await uploadToCloudinary(f, publicId)
    res.json({ message: '✅ Avatar uploadé', url: result.secure_url })
  } catch (e) {
    console.error('upload avatar:', e)
    res.status(500).json({ message: '❌ Upload avatar échoué', error: e.message })
  }
})

// ⚠️ Toujours en dernier
router.use(handleMulterError)

export default router
