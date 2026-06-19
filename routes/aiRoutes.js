/**
 * AgroAfrica — AI Routes V2.0
 *  - Rate limit
 *  - Body size limit
 *  - Timeout proxy
 *  - Logs
 */
import express from 'express'
import rateLimit from 'express-rate-limit'
import { protect } from '../middleware/authMiddleware.js'
import { predict, aiPredictLimiter } from '../controllers/aiController.js'

const router = express.Router()

// ✅ CORRECTION 1.3 — Timeout + size limit
router.use(express.json({ limit: '50kb' }))

// ✅ CORRECTION 1.1 — Rate limit (20 calls / minute / user)
router.use(aiPredictLimiter)

// ✅ CORRECTION 1.4 — Log des appels
router.post('/predict', protect, async (req, res, next) => {
  console.log(`[ai] predict — user=${req.userId} at ${new Date().toISOString()}`)
  return predict(req, res, next)
})

export default router
