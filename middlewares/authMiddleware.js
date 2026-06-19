/**
 * AgroAfrica — Middleware auth (V2.0)
 *  - tokenVersion ✓ (invalide tout après changePassword)
 *  - clock skew tolerance (30s)
 *  - cache permissions via Redis (60s)
 *  - logging des refus
 *  - distinction token manquant / invalide
 */
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { cacheGet, cacheSet } from '../config/redisClient.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET OBLIGATOIRE (env) — refuse de démarrer sans')
}
const CACHE_TTL = 60
const CLOCK_SKEW = 30           // ✅ 2.5 — 30 secondes

const log = (...a) => console.log('[auth]', ...a)
const warn = (...a) => console.warn('[auth]', ...a)

// ✅ CORRECTION 2.3 — Cache rôle minimaliste (1 query toutes les 60s)
const getUserContext = async (userId) => {
  const key = `userctx:${userId}`
  const cached = await cacheGet(key)
  if (cached) return cached
  const user = await User.findById(userId)
    .select('_id name email role country isVerified tokenVersion avatar')
    .lean()
  if (user) await cacheSet(key, user, CACHE_TTL)
  return user
}

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!token) {
    warn(`401 token manquant — IP=${req.ip} path=${req.path}`)
    return res.status(401).json({ message: '❌ Non autorisé, token requis' })   // ✅ 2.8
  }

  let decoded
  try {
    decoded = jwt.verify(token, JWT_SECRET, { clockTolerance: CLOCK_SKEW })   // ✅ 2.5
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '❌ Token expiré, reconnectez-vous' })
    }
    warn(`401 token invalide — IP=${req.ip} err=${e.message}`)
    return res.status(401).json({ message: '❌ Token invalide' })
  }

  try {
    // ✅ CORRECTION 2.2 — tokenVersion check
    if (decoded.tokenVersion !== undefined) {
      const ctx = await getUserContext(decoded.id)
      if (!ctx) return res.status(401).json({ message: '❌ Utilisateur introuvable' })
      if (ctx.tokenVersion !== decoded.tokenVersion) {
        warn(`401 token révoqué (changement password) — userId=${decoded.id}`)
        return res.status(401).json({ message: '❌ Session invalide, reconnectez-vous' })
      }
      req.user = ctx
    } else {
      // Ancien token sans version → on l'invalide
      return res.status(401).json({ message: '❌ Token obsolète, reconnectez-vous' })
    }

    // ✅ CORRECTION 2.6 — POJO, pas un document Mongoose mutable
    req.userId = req.user._id.toString()
    next()
  } catch (e) {
    errlog('protect:', e)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

const allow = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: '❌ Non autorisé' })
  if (!roles.includes(req.user.role)) {
    warn(`403 rôle insuffisant — user=${req.user._id} role=${req.user.role} requis=${roles.join('|')}`)
    return res.status(403).json({ message: `❌ Accès ${roles.join(' ou ')} uniquement` })
  }
  next()
}

export const requireRole = (...roles) => allow(...roles)
export const adminOnly    = allow('admin')
export const vendeurOnly  = allow('vendeur', 'cooperative', 'admin')
export const buyerOnly    = allow('acheteur', 'admin')
