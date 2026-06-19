/**
 * AgroAfrica — Order Routes V2.0
 *  - Middlewares role explicites
 *  - Pagination forcée
 *  - Idempotency POST
 *  - Validation ObjectId
 */
import express from 'express'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'

import {
  createOrder, getMyOrders,
  getOrder, getAllOrders, updateOrderStatus
} from '../controllers/orderController.js'
import { protect, adminOnly, vendeurOnly, requireRole } from '../middleware/authMiddleware.js'

const router = express.Router()

const publicLimiter = rateLimit({ windowMs: 60_000, max: 60 })
const writeLimiter  = rateLimit({ windowMs: 60_000, max: 30 })

const validate = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: '❌ id invalide' })
  }
  next()
}

// ✅ Idempotency-Key
const idempotency = (req, res, next) => {
  const key = req.headers['x-idempotency-key']
  if (key) req.idempotencyKey = key
  next()
}

router.use(express.json({ limit: '50kb' }))

// ✅ CORRECTION 6.5 — Idempotency sur création
router.post('/',       protect, writeLimiter, idempotency, createOrder)
router.get('/my',      protect, publicLimiter, getMyOrders)
router.get('/:id',     protect, publicLimiter, validate, getOrder)

// ✅ CORRECTION 6.3 — Seuls admin/vendeur peuvent tout voir
router.get('/',        protect, requireRole('admin', 'vendeur', 'cooperative'), publicLimiter, getAllOrders)

// ✅ CORRECTION 6.4 — Middlewares alignés
router.put('/:id/status', protect, requireRole('admin', 'vendeur', 'cooperative'), writeLimiter, validate, updateOrderStatus)

export default router
