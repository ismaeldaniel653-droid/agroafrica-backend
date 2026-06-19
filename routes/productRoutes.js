/**
 * AgroAfrica — Product Routes V2.0
 *  - Rate limit readonly + write
 *  - Pagination standardisée
 *  - Validation ObjectId
 *  - Cache invalidation
 */
import express from 'express'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'

import {
  getProducts, getProduct,
  createProduct, updateProduct, deleteProduct,
  getProductStats
} from '../controllers/productController.js'
import { protect, vendeurOnly, adminOnly } from '../middleware/authMiddleware.js'
import { uploadProductImages, handleMulterError } from '../config/multer.js'
import { cacheDel } from '../config/redisClient.js'

const router = express.Router()

// ✅ CORRECTION 2.6 — Rate limit spécifique
const publicLimiter = rateLimit({ windowMs: 60_000, max: 120 })   // 2 req/s
const writeLimiter  = rateLimit({ windowMs: 60_000, max: 30 })

// ✅ 2.3 — Helper ObjectId
const validateObjectId = (paramName = 'id') => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[paramName])) {
    return res.status(400).json({ message: `❌ ${paramName} invalide` })
  }
  next()
}

// ✅ CORRECTION 2.7 — Routes spécifiques AVANT les génériques
router.get('/admin/stats', protect, adminOnly, getProductStats)

// ✅ CORRECTION 2.4 — Idempotency pour POST produit
const idempotency = (req, res, next) => {
  const key = req.headers['x-idempotency-key']
  if (!key) return next()
  req.idempotencyKey = key
  next()
}

// ✅ Routes publiques
router.get('/',       publicLimiter, getProducts)
router.get('/:id',    publicLimiter, validateObjectId(), getProduct)

// ✅ Routes vendeur (write)
router.post('/',    protect, vendeurOnly, idempotency, writeLimiter, uploadProductImages, handleMulterError,
  async (req, res, next) => {
    // ✅ CORRECTION 2.5 — Invalidation cache après write
    await cacheDel('products:*').catch(() => {})
    createProduct(req, res, next)
  })

router.put('/:id',  protect, vendeurOnly, writeLimiter, validateObjectId(), uploadProductImages, handleMulterError,
  async (req, res, next) => {
    await cacheDel(`products:*`).catch(() => {})
    updateProduct(req, res, next)
  })

router.delete('/:id', protect, vendeurOnly, writeLimiter, validateObjectId(),
  async (req, res, next) => {
    await cacheDel('products:*').catch(() => {})
    deleteProduct(req, res, next)
  })

export default router
