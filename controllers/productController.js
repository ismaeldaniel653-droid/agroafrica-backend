import Product from '../models/Product.js'
import { getCachedProducts, setCachedProducts } from '../services/productCacheService.js'

// GET tous les produits — Recherche avancée + Pagination + Tri
export const getProducts = async (req, res) => {
  try {
    const {
      category, search, origin, badge,
      minPrice, maxPrice,
      sort = 'createdAt', order = 'desc',
      page = 1, limit = 20
    } = req.query

    // Cache Redis (si dispo)
    const cached = await getCachedProducts({ category, search })
    if (cached && !origin && !minPrice && !maxPrice) return res.json({ products: cached, cached: true })

    // Construction du filtre
    let filter = {}

    if (category) filter.category = category
    if (badge) filter.badge = badge
    if (origin) filter.origin = { $regex: origin, $options: 'i' }

    // Recherche textuelle améliorée (nom + description + origine)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { origin: { $regex: search, $options: 'i' } }
      ]
    }

    // Filtre par prix
    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number(minPrice)
      if (maxPrice) filter.price.$lte = Number(maxPrice)
    }

    // Tri
    const sortOptions = {}
    if (sort === 'price') sortOptions.price = order === 'asc' ? 1 : -1
    else if (sort === 'rating') sortOptions.rating = order === 'asc' ? 1 : -1
    else if (sort === 'name') sortOptions.name = order === 'asc' ? 1 : -1
    else if (sort === 'popular') sortOptions.reviews = -1
    else sortOptions.createdAt = order === 'asc' ? 1 : -1

    // Pagination
    const skip = (Number(page) - 1) * Number(limit)

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('seller', 'name country')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter)
    ])

    await setCachedProducts({ category, search, payload: products })

    res.json({
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      cached: false
    })

  } catch (error) {
    // Fallback sans cache
    try {
      const { category, search } = req.query
      let filter = {}
      if (category) filter.category = category
      if (search) filter.name = { $regex: search, $options: 'i' }
      const products = await Product.find(filter).populate('seller', 'name')
      return res.json({ products, cached: false })
    } catch {
      res.status(500).json({ message: '❌ Erreur serveur' })
    }
  }
}

// GET un produit
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('seller', 'name country')
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })
    res.json({ product })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// CRÉER un produit (avec upload photos)
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, origin } = req.body

    if (!name || !description || !price || !category || !origin) {
      return res.status(400).json({ message: '❌ Champs obligatoires manquants' })
    }

    // Gérer les images uploadées (Multer)
    let images = []
    if (req.files && req.files.length > 0) {
      // En prod : upload vers Cloudinary/CDN, ici on stocke en base64
      images = req.files.map(file => ({
        data: file.buffer.toString('base64'),
        contentType: file.mimetype,
        name: file.originalname
      }))
    }

    const product = await Product.create({
      ...req.body,
      images: images.length > 0 ? images : [],
      seller: req.user._id
    })

    res.status(201).json({
      message: '✅ Produit créé',
      product
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// MODIFIER un produit (avec upload photos)
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Vous n\'êtes pas autorisé à modifier ce produit' })
    }

    // Ajouter nouvelles images si upload
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        data: file.buffer.toString('base64'),
        contentType: file.mimetype,
        name: file.originalname
      }))
      product.images = [...(product.images || []), ...newImages]
    }

    Object.assign(product, req.body)
    await product.save()

    res.json({ message: '✅ Produit modifié', product })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// SUPPRIMER un produit
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Vous n\'êtes pas autorisé à supprimer ce produit' })
    }

    await Product.findByIdAndDelete(req.params.id)
    res.json({ message: '✅ Produit supprimé' })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// STATISTIQUES PRODUITS (pour dashboard admin)
export const getProductStats = async (req, res) => {
  try {
    const [totalProducts, byCategory, avgPrice, topRated] = await Promise.all([
      Product.countDocuments(),
      Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, totalStock: { $sum: '$stock' } } }
      ]),
      Product.aggregate([
        { $group: { _id: null, avgPrice: { $avg: '$price' }, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } }
      ]),
      Product.find().sort({ rating: -1, reviews: -1 }).limit(5).select('name emoji rating reviews price')
    ])

    res.json({
      totalProducts,
      byCategory,
      priceStats: avgPrice[0] || { avgPrice: 0, minPrice: 0, maxPrice: 0 },
      topRated
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}