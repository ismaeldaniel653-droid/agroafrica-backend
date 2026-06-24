/**
 * AgroAfrica — Admin Routes V2.0
 *  - Réutilise adminOnly commun
 *  - Validation ObjectId
 *  - Audit log
 *  - Cache invalidation userctx
 */
import express from 'express'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'

import {
  getDashboardStats,
  getAllUsers, getUser, updateUser, deleteUser,
  verifyUser, suspendUser,
  getStatsByCountry, getSalesByMonth, getTopSellers
} from '../controllers/adminController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'
import { cacheDel } from '../infrastructure/redisClient.js'

const router = express.Router()

// ✅ CORRECTION 5.1 — Utilise adminOnly de authMiddleware
const validator = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: '❌ id invalide' })
  }
  next()
}

// ✅ Audit log helper
const audit = (action) => (req, res, next) => {
  console.log(JSON.stringify({
    event:     'admin_action',
    action,
    actor:     req.userId,
    target:    req.params.id,
    ip:        req.ip,
    at:        new Date().toISOString()
  }))
  next()
}

// ✅ CORRECTION 5.2 — Rate limit
const adminLimiter = rateLimit({ windowMs: 60_000, max: 60 })

// ✅ CORRECTION 5.4 — Invalidation cache userctx
const invalidateUserCache = async (req, _res, next) => {
  await cacheDel(`userctx:${req.params.id}`).catch(() => {})
  next()
}

router.use(protect, adminOnly, adminLimiter)

// Dashboard & Stats (pas de validation :id mais rate limit++)
router.get('/dashboard',      getDashboardStats)
router.get('/stats/countries', getStatsByCountry)
router.get('/stats/sales',     getSalesByMonth)
router.get('/stats/sellers',   getTopSellers)

router.get('/users',               getAllUsers)
router.get('/users/:id',           validator, getUser)
router.put('/users/:id',           validator, audit('update_user'), invalidateUserCache, updateUser)
router.delete('/users/:id',        validator, audit('delete_user'), invalidateUserCache, deleteUser)
router.patch('/users/:id/verify',  validator, audit('verify_user'), invalidateUserCache, verifyUser)
router.patch('/users/:id/suspend', validator, audit('suspend_user'), invalidateUserCache, suspendUser)

export default router
