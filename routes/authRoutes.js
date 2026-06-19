/**
 * AgroAfrica — Auth Routes V2.0
 *  - Rate-limit strict sur login/register
 *  - Validation payload
 *  - Logout + refresh
 *  - Honeypot anti-bot
 */
import express from 'express'
import rateLimit from 'express-rate-limit'
import {
  register, login, getProfile, updateProfile, changePassword, logout, refreshToken
} from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// ✅ CORRECTION 3.1 — Rate limit agressif
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { message: '❌ Trop de tentatives, réessayez dans 15 min' }
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: '❌ Trop de tentatives de connexion' }
})

// ✅ CORRECTION 3.2 — Honeypot anti-bot
const honeypot = (req, res, next) => {
  if (req.body?.website) {       // champ caché classique
    return res.status(400).json({ message: '❌ Bot détecté' })
  }
  next()
}

// ✅ CORRECTION 3.3 — Validation taille payload
router.use(express.json({ limit: '10kb' }))

router.post('/register', authLimiter, honeypot, register)
router.post('/login',    loginLimiter, honeypot, login)
router.post('/logout',   protect, logout)
router.post('/refresh',  protect, refreshToken)

router.get('/profile',    protect, getProfile)
router.put('/profile',    protect, updateProfile)
router.put('/password',   protect, changePassword)

export default router
