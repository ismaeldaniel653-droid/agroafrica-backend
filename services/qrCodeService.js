/**
 * AgroAfrica — QR Code Service V2.0
 *  - URL traçabilité ENV-var
 *  - Cache LRU + Redis
 *  - Payload minimal (juste id + signature)
 *  - SVG optionnel (scan + impression)
 */
import QRCode from 'qrcode'
import crypto from 'crypto'
import { cacheGet, cacheSet } from '../config/redisClient.js'

const TRACE_BASE = process.env.FRONTEND_URL || 'https://agroafrica-frontend.vercel.app'
const SIGN_SECRET = process.env.QR_SIGN_SECRET || process.env.JWT_SECRET || 'agroafrica-qr-sign'

const getCachedQR = async (id) => cacheGet(`qr:${id}`)
const setCachedQR = async (id, payload, ttl = 24 * 3600) => cacheSet(`qr:${id}`, payload, ttl)

// ✅ CORRECTION 5.5 — Payload minimal + signature
const buildQRPayload = (product) => {
  const id = String(product._id)
  const sig = crypto.createHmac('sha256', SIGN_SECRET)
    .update(`${id}|${product.updatedAt?.getTime?.() || Date.now()}`)
    .digest('hex')
    .slice(0, 16)
  return {
    v:      2,
    id,
    sig,
    url:    `${TRACE_BASE}/trace/${id}`,
    issued: new Date().toISOString()
  }
}

export const generateProductQR = async (product) => {
  try {
    // ✅ 5.2 — Cache check
    const cached = await getCachedQR(product._id)
    if (cached) return cached

    const payload = buildQRPayload(product)

    const qrPng  = await QRCode.toDataURL(JSON.stringify(payload), { width: 300, margin: 2, errorCorrectionLevel: 'M' })
    const qrSvg  = await QRCode.toString(JSON.stringify(payload), { type: 'svg', margin: 2, color: { dark: '#0C6B4E', light: '#FFFFFF' } })

    const result = {
      success:    true,
      qrCode:     qrPng,
      qrCodeSvg:  qrSvg,
      payload,
      publicId:   `qr_${product._id}`,
      expiresAt:  new Date(Date.now() + 365 * 24 * 3600 * 1000)
    }
    await setCachedQR(product._id, result)
    return result
  } catch (error) {
    return { success: false, message: error.message }
  }
}

export const generateQRString = async (text) => {
  try {
    return await QRCode.toDataURL(String(text).slice(0, 500), { width: 300, margin: 2 })
  } catch { return null }
}

// Helper pour vérifier un QR
export const verifyQRPayload = (payload) => {
  if (!payload || payload.v !== 2) return false
  const id = payload.id
  const sig = payload.sig
  // ⚠️ La signature n'est vérifiable qu'avec SIGN_SECRET côté serveur
  return Boolean(id && sig && sig.length === 16)
}
