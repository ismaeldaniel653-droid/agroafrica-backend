import Product from '../models/Product.js'

// GET tous les produits
export const getProducts = async (req, res) => {
  try {
    const { category, search } = req.query
    let filter = {}

    if (category) filter.category = category
    if (search)   filter.name = { $regex: search, $options: 'i' }

    const products = await Product.find(filter).populate('seller', 'name')
    res.json({ products })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// GET un produit
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('seller', 'name')
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })
    res.json({ product })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// CRÉER un produit
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, origin } = req.body

    if (!name || !description || !price || !category || !origin) {
      return res.status(400).json({ message: '❌ Champs obligatoires manquants' })
    }

    const product = await Product.create({
      ...req.body,
      seller: req.user._id
    })
    res.status(201).json({ message: '✅ Produit créé', product })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// MODIFIER un produit
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: '❌ Produit introuvable' })

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Vous n’êtes pas autorisé à modifier ce produit' })
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
      return res.status(403).json({ message: '❌ Vous n’êtes pas autorisé à supprimer ce produit' })
    }

    await product.remove()
    res.json({ message: '✅ Produit supprimé' })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}