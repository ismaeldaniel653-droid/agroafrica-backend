import Product from '../models/Product.js'
import { generateProductQR } from '../services/qrCodeService.js'

// GÉNÉRER QR CODE pour un produit
export const generateQR = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name country')

    if (!product) {
      return res.status(404).json({ message: '❌ Produit introuvable' })
    }

    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: '❌ Vous n’êtes pas autorisé à générer un QR pour ce produit' })
    }

    const result = await generateProductQR(product)

    if (!result.success) {
      return res.status(500).json({ message: '❌ Erreur génération QR' })
    }

    // Sauvegarder le QR dans le produit
    product.qrCode = result.qrCode
    await product.save()

    res.json({
      message: '✅ QR Code généré',
      qrCode:  result.qrCode,
      product: {
        id:     product._id,
        name:   product.name,
        origin: product.origin,
        seller: product.seller
      }
    })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// TRAÇABILITÉ PUBLIQUE — page scan QR
export const getTraceability = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name country phone')

    if (!product) {
      return res.status(404).json({ message: '❌ Produit introuvable' })
    }

    res.json({
      product: {
        id:          product._id,
        name:        product.name,
        description: product.description,
        category:    product.category,
        origin:      product.origin,
        seller:      product.seller,
        badge:       product.badge,
        createdAt:   product.createdAt,
        qrCode:      product.qrCode
      },
      trace: {
        origine:      product.origin,
        producteur:   product.seller?.name,
        pays:         product.seller?.country,
        dateRecolte:  product.createdAt,
        certification: product.badge === 'bio' ? 'Bio certifié 🌱' : 'Standard',
        plateforme:   'AgroAfrica — Marché africain certifié'
      }
    })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}