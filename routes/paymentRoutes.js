/**
 * AgroAfrica — Payment Routes V2.0
 *  - Webhook sécurisé (HMAC + IP)
 *  - Idempotence
 *  - Rate limit strict
 *  - Cache webhook
 */
import express from 'express'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import {
  initiatePayment, paymentWebhook, checkPaymentStatus
} from '../controllers/paymentController.js'
import { protect } from '../middleware/authMiddleware.js'
import { cacheGet, cacheSet } from '../config/redisClient.js'

const router = express.Router()

const writeLimiter = rateLimit({ windowMs: 60_000, max: 20 })

// ✅ CORRECTION 4.1 + 4.2 — Middleware de sécurité webhook
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature']
  const secret    = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret) return res.status(500).json({ message: '❌ Webhook secret non configuré' })
  if (!signature) return res.status(401).json({ message: '❌ Missing signature' })

  const expected = crypto.createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex')
  if (signature !== expected) {
    return res.status(401).json({ message: '❌ Signature invalide' })
  }
  next()
}

// ✅ Whitelist IP (selon providers MTN/Orange/Moov)
const ipWhitelist = (req, res, next) => {
  const allowed = (process.env.PAYMENT_WEBHOOK_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (allowed.length === 0) return next()                                           // open en dev
  if (!allowed.includes(req.ip)) {
    return res.status(403).json({ message: '❌ IP non autorisée' })
  }
  next()
}

// ✅ CORRECTION 4.3 — Idempotence webhook
const idempotencyWebhook = async (req, res, next) => {
  const evtId = req.body?.transactionId
  if (!evtId) return next()
  const key = `webhook:paid:${evtId}`
  const seen = await cacheGet(key)
  if (seen) return res.json({ message: 'Déjà traité', idempotent: true })
  await cacheSet(key, JSON.stringify(req.body), 24 * 3600)
  next()
}

// ✅ CORRECTION 4.6 — raw body pour HMAC
router.post('/webhook',
  express.json({
    limit: '10kb',
    verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8') }
  }),
  ipWhitelist,
  verifyWebhookSignature,
  idempotencyWebhook,
  paymentWebhook
)

router.post('/initiate',       protect, writeLimiter, express.json({ limit: '5kb' }), initiatePayment)
router.get('/status/:orderId', protect, writeLimiter, checkPaymentStatus)

export default router
