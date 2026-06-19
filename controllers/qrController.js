import Product from '../models/Product.js'
import NodeCache from 'node-cache'
import { generateProductQR } from '../services/qrCodeService.js'
import rateLimit from 'express-rate-limit'

// ✅ CORRECTION 6.3 — Cache 1h
const qrCache = new NodeCache({ stdTTL: 3600, maxKeys: 5000 })

// ✅ CORRECTION 6.4 — Rate limit
export const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: '❌ Trop de scans' }
})

export const generateQR = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name country')
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })

    // ✅ CORRECTION 6.1 — Garde-fou sur seller null
    const sellerId = product.seller?._id?.toString() || product.seller?.toString()
    if (!sellerId) return res.status(400).json({ message: '❌ Produit sans vendeur' })
    if (sellerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Non autorisé' })
    }

    // ✅ Cache hit
    const cached = qrCache.get(product._id.toString())
    if (cached) return res.json(cached)

    const result = await generateProductQR(product)
    if (!result.success) return res.status(500).json({ message: '❌ Erreur génération QR' })

    product.qrCode = result.qrCode
    await product.save()

    const payload = {
      message: '✅ QR Code généré',
      qrCode:  result.qrCode,
      product: {
        id:     product._id,
        name:   product.name,
        origin: product.origin,
        seller: product.seller?.name
      }
    }
    qrCache.set(product._id.toString(), payload)
    res.json(payload)
  } catch (error) {
    console.error('generateQR:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const getTraceability = async (req, res) => {
  try {
    const cacheKey = `trace:${req.params.id}`
    const cached = qrCache.get(cacheKey)
    if (cached) return res.json(cached)

    const product = await Product.findById(req.params.id)
      .populate('seller', 'name country email')
      .lean()
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })

    const payload = {
      product,
      trace: {
        origin:       product.origin,
        producerName: product.seller?.name || 'Inconnu',
        country:      product.seller?.country || product.origin,
        harvestDate:  product.harvestDate || product.createdAt,
        certification: product.badge?.includes('bio') ? 'Bio certifié' : 'Standard',
        platform:     'AgroAfrica — Marché africain certifié'
      }
    }
    qrCache.set(cacheKey, payload)
    res.json(payload)
  } catch (error) {
    console.error('getTraceability:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}
