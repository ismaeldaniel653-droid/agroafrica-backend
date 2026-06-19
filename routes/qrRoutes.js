/**
 * AgroAfrica — QR Routes V2.0
 *  - Rate limit public trace
 *  - Validation ObjectId
 *  - Cache HTTP 1h (Cloudflare-friendly)
 */
import express from 'express'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'

import { generateQR, getTraceability, qrLimiter } from '../controllers/qrController.js'
import { protect, vendeurOnly } from '../middleware/authMiddleware.js'

const router = express.Router()

const validate = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: '❌ id invalide' })
  }
  next()
}

// ✅ CORRECTION 7.1 — Limiter sur /trace (public)
const publicTraceLimiter = rateLimit({ windowMs: 60_000, max: 90 })

// ✅ CORRECTION 7.4 — ETag pour cache navigateur
router.get('/trace/:id',
  publicTraceLimiter,
  validate,
  (req, res, next) => {
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    next()
  },
  getTraceability
)

router.get('/generate/:id',
  protect, vendeurOnly,
  qrLimiter,
  validate,
  generateQR
)

export default router
