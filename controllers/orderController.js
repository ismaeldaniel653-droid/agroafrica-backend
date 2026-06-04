import Order from '../models/Order.js'
import Product from '../models/Product.js'

// CRÉER UNE COMMANDE
export const createOrder = async (req, res) => {
  try {
    const { items, totalAmount, paymentMethod, deliveryAddress } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: '❌ La commande doit contenir au moins un article' })
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ message: '❌ Montant total invalide' })
    }

    let validatedItems = []
    for (const item of items) {
      if (!item.product || !item.qty || item.qty <= 0) {
        return res.status(400).json({ message: '❌ Article de commande invalide' })
      }

      const product = await Product.findById(item.product)
      if (!product) {
        return res.status(404).json({ message: `❌ Produit introuvable : ${item.product}` })
      }

      if (product.stock < item.qty) {
        return res.status(400).json({ message: `❌ Stock insuffisant pour ${product.name}` })
      }

      validatedItems.push({
        product: product._id,
        name:    product.name,
        emoji:   product.emoji,
        price:   product.price,
        qty:     item.qty
      })
    }

    const commission = totalAmount * 0.05
    const vendeurNet = totalAmount - commission

    const order = await Order.create({
      buyer: req.user._id,
      items: validatedItems,
      totalAmount,
      commission,
      vendeurNet,
      paymentMethod,
      deliveryAddress,
      status:        'confirmé',
      paymentStatus: 'en attente'
    })

    for (const item of validatedItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.qty } },
        { new: true }
      )
    }

    res.status(201).json({
      message: '✅ Commande créée',
      order,
      details: {
        totalAmount,
        commission: `${commission} FCFA (5%)`,
        vendeurNet: `${vendeurNet} FCFA`
      }
    })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// MES COMMANDES (acheteur)
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate('items.product', 'name emoji price')
      .sort({ createdAt: -1 })

    res.json({ orders })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// UNE COMMANDE (détail)
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'name email phone')
      .populate('items.product', 'name emoji price seller')

    if (!order) {
      return res.status(404).json({ message: '❌ Commande introuvable' })
    }

    const isBuyer = order.buyer._id.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'
    const isSeller = order.items.some(item =>
      item.product && item.product.seller && item.product.seller.toString() === req.user._id.toString()
    )

    if (!isBuyer && !isAdmin && !isSeller) {
      return res.status(403).json({ message: '❌ Accès non autorisé' })
    }

    res.json({ order })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// TOUTES LES COMMANDES (admin/vendeur)
export const getAllOrders = async (req, res) => {
  try {
    if (req.user.role === 'acheteur') {
      return res.status(403).json({ message: '❌ Accès non autorisé' })
    }

    if (req.user.role === 'vendeur') {
      const orders = await Order.find({}).populate('items.product', 'seller name')
      const myOrders = orders.filter(o =>
        o.items.some(item =>
          item.product && item.product.seller && item.product.seller.toString() === req.user._id.toString()
        )
      )
      return res.json({ orders: myOrders })
    }

    const orders = await Order.find({})
      .populate('buyer', 'name email')
      .populate('items.product', 'name seller')
      .sort({ createdAt: -1 })

    res.json({ orders })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// METTRE À JOUR STATUT COMMANDE
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body
    const order = await Order.findById(req.params.id).populate('items.product', 'seller')

    if (!order) {
      return res.status(404).json({ message: '❌ Commande introuvable' })
    }

    const isAdmin = req.user.role === 'admin'
    const isSeller = order.items.some(item =>
      item.product && item.product.seller && item.product.seller.toString() === req.user._id.toString()
    )

    if (!isAdmin && !isSeller) {
      return res.status(403).json({ message: '❌ Vous n’êtes pas autorisé à mettre à jour ce statut' })
    }

    order.status = status
    await order.save()

    res.json({
      message: '✅ Statut mis à jour',
      order
    })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}