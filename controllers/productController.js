import Product from '../models/Product.js'
import { getCachedProducts, setCachedProducts } from '../services/productCacheService.js'

// ✅ CORRECTION 7.2 — Cache key bornée (catégorie simple uniquement)
const CACHEABLE = new Set(['all', 'agricole', 'artisanal'])

export const getProducts = async (req, res) => {
  try {
    const {
      category, search, origin, badge, isActive = 'true',
      minPrice, maxPrice,
      sort = 'createdAt', order = 'desc',
      page = 1, limit = 20
    } = req.query

    const pageNum = Math.max(1, Number(page))
    const lim     = Math.min(50, Math.max(1, Number(limit)))
    const skip    = (pageNum - 1) * lim

    // Cache : uniquement catégorie pure sans filtre additionnel
    const cacheKey = CACHEABLE.has(category) && !search && !origin && !badge && !minPrice && !maxPrice
      ? `p:${category}:${sort}:${order}:${pageNum}:${lim}`
      : null

    if (cacheKey) {
      const cached = await getCachedProducts(cacheKey)
      if (cached) return res.json({ ...cached, cached: true })
    }

    const filter = { isActive: isActive === 'true' }
    if (category) filter.category = category
    if (badge)    filter.badge    = badge

    // ✅ CORRECTION 7.3 — Sanitization regex (escape Meta characters)
    const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (origin) filter.origin = { $regex: escapeRx(origin), $options: 'i' }
    if (search) {
      const rx = new RegExp(escapeRx(search), 'i')
      filter.$or = [
        { name:        rx },
        { description: rx },
        { origin:      rx }
      ]
    }
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }

    // Tri whitelisté
    const SORT_WHITELIST = { createdAt: 1, price: 1, rating: 1, name: 1, salesCount: 1 }
    const sortField = SORT_WHITELIST[sort] ? sort : 'createdAt'
    const sortOrder = order === 'asc' ? 1 : -1

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('seller', 'name country isVerified')
        .sort({ [sortField]: sortOrder })
        .skip(skip).limit(lim)
        .lean(),
      Product.countDocuments(filter)
    ])

    const response = { products, total, page: pageNum, pages: Math.ceil(total / lim) }
    if (cacheKey) await setCachedProducts(cacheKey, response, 120)  // 2 min
    res.json(response)
  } catch (error) {
    console.error('getProducts:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name country email isVerified phone')
      .lean()
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })
    res.json({ product })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ✅ CORRECTION 7.6 — Garde rôle vendeur
export const createProduct = async (req, res) => {
  try {
    if (!['vendeur', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: '❌ Seuls les vendeurs peuvent créer un produit' })
    }

    const required = ['name', 'category', 'price', 'stock', 'origin']
    for (const f of required) {
      if (req.body[f] === undefined) {
        return res.status(400).json({ message: `❌ Champ requis : ${f}` })
      }
    }
    if (req.body.price < 0 || req.body.stock < 0) {
      return res.status(400).json({ message: '❌ Prix/stock doivent être positifs' })
    }

    // ✅ CORRECTION 7.1 — Images = URLs (Cloudinary), jamais base64
    const images = Array.isArray(req.body.images)
      ? req.body.images.filter(img => typeof img === 'string' && /^https?:\/\//.test(img))
      : []

    const product = await Product.create({
      ...req.body,
      seller: req.user._id,
      images,
      isActive: req.body.isActive ?? true
    })
    res.status(201).json({ message: '✅ Produit créé', product })
  } catch (error) {
    console.error('createProduct:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Non autorisé' })
    }

    const allowed = ['name', 'description', 'category', 'price', 'stock', 'origin', 'badge', 'emoji', 'isActive']
    for (const k of allowed) {
      if (req.body[k] !== undefined) product[k] = req.body[k]
    }

    // ✅ CORRECTION 7.7 — Remplacement complet des images (URLs)
    if (Array.isArray(req.body.images)) {
      const validImages = req.body.images.filter(img =>
        typeof img === 'string' && /^https?:\/\//.test(img)
      )
      product.images = validImages
    }

    await product.save()
    res.json({ message: '✅ Produit mis à jour', product })
  } catch (error) {
    console.error('updateProduct:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })
    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Non autorisé' })
    }

    // ✅ Soft delete (préserve historique commandes)
    product.isActive = false
    product.deletedAt = new Date()
    await product.save()

    res.json({ message: '✅ Produit désactivé (historique préservé)' })
  } catch (error) {
    console.error('deleteProduct:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const getProductStats = async (req, res) => {
  try {
    const [total, byCategory, priceAgg, topRated] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: {
          _id: null,
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }}
      ]),
      Product.find({ isActive: true })
        .sort({ rating: -1 }).limit(5)
        .select('name emoji rating salesCount price').lean()
    ])
    res.json({
      total,
      byCategory,
      priceStats: priceAgg[0] || { avgPrice: 0, minPrice: 0, maxPrice: 0 },
      topRated
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}
