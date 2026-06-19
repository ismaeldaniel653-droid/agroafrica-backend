import Order from '../models/Order.js'
import Product from '../models/Product.js'
import mongoose from 'mongoose'

// CRÉER UNE COMMANDE (V2.0 — transaction atomique + machine à états)
const ALLOWED_STATUSES = ['confirmé', 'en cours', 'livré', 'annulé']

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { items, totalAmount, paymentMethod, deliveryAddress } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: '❌ La commande doit contenir au moins un article' })
    }
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ message: '❌ Montant total invalide' })
    }
    if (!deliveryAddress || !deliveryAddress.city || !deliveryAddress.phone) {
      return res.status(400).json({ message: '❌ Adresse de livraison incomplète' })
    }

    let validatedItems = []
    let computedTotal = 0

    for (const item of items) {
      if (!item.product || !item.qty || item.qty <= 0) {
        await session.abortTransaction()
        return res.status(400).json({ message: '❌ Article de commande invalide' })
      }

      // ✅ CORRECTION 1.1 — Atomic decrement avec vérification de stock intégrée
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
        { new: true, session }
      )

      if (!updatedProduct) {
        await session.abortTransaction()
        return res.status(400).json({
          message: `❌ Stock insuffisant ou produit introuvable : ${item.product}`
        })
      }

      validatedItems.push({
        product: updatedProduct._id,
        name:    updatedProduct.name,
        emoji:   updatedProduct.emoji,
        price:   updatedProduct.price,
        qty:     item.qty
      })
      computedTotal += updatedProduct.price * item.qty
    }

    // Réconciliation serveur : le client ne décide pas du prix
    if (Math.abs(computedTotal - totalAmount) > 1) {
      await session.abortTransaction()
      return res.status(400).json({ message: '❌ Incohérence montant serveur / client' })
    }

    // ✅ CORRECTION 1.6 — Commission arrondie
    const commission = Math.round(totalAmount * 0.05)
    const vendeurNet = totalAmount - commission

    const [order] = await Order.create([{
      buyer: req.user._id,
      items: validatedItems,
      totalAmount,
      commission,
      vendeurNet,
      paymentMethod:  paymentMethod || 'mobile_money',
      deliveryAddress,
      status:         'confirmé',
      paymentStatus:  'en attente'
    }], { session })

    await session.commitTransaction()

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
    await session.abortTransaction()
    console.error('❌ createOrder:', error)
    res.status(500).json({ message: '❌ Erreur serveur' }) // ✅ 1.10 — pas de fuite
  } finally {
    session.endSession()
  }
}

// MES COMMANDES
export const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const skip = (Math.max(1, page) - 1) * Math.min(100, limit)

    const [orders, total] = await Promise.all([
      Order.find({ buyer: req.user._id })
        .populate('items.product', 'name emoji price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(100, limit))
        .lean(),                                                  // ✅ .lean() = 5× plus rapide
      Order.countDocuments({ buyer: req.user._id })
    ])

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('getMyOrders:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// DÉTAIL COMMANDE
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'name email phone')
      .populate('items.product', 'name emoji price seller')
      .lean()

    if (!order) return res.status(404).json({ message: '❌ Commande introuvable' })

    const isBuyer  = order.buyer?._id?.toString() === req.user._id?.toString()
    const isAdmin  = req.user.role === 'admin'
    const isSeller = order.items?.some(it =>
      it.product?.seller?.toString() === req.user._id?.toString()
    )

    if (!isBuyer && !isAdmin && !isSeller) {
      return res.status(403).json({ message: '❌ Accès non autorisé' })
    }

    res.json({ order })
  } catch (error) {
    console.error('getOrder:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// TOUTES LES COMMANDES (admin/vendeur) — pagination + index
export const getAllOrders = async (req, res) => {
  try {
    if (req.user.role === 'acheteur') {
      return res.status(403).json({ message: '❌ Accès non autorisé' })
    }

    const { page = 1, limit = 20, status } = req.query
    const skip = (Math.max(1, page) - 1) * Math.min(100, limit)

    // ✅ CORRECTION 1.4 — Filtre en DB, pas en mémoire
    let filter = {}
    if (status && ALLOWED_STATUSES.includes(status)) filter.status = status

    let ordersQuery
    if (req.user.role === 'vendeur') {
      // ✅ Le vendeur voit SES commandes via les produits qu'il possède
      const myProducts = await Product.find({ seller: req.user._id }).select('_id').lean()
      const productIds = myProducts.map(p => p._id)
      filter['items.product'] = { $in: productIds }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('buyer', 'name email')
        .populate('items.product', 'name seller price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(100, limit))
        .lean(),
      Order.countDocuments(filter)
    ])

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('getAllOrders:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ✅ CORRECTION 1.5 — Machine à états (transitions valides uniquement)
const STATUS_TRANSITIONS = {
  'confirmé': ['en cours', 'annulé'],
  'en cours': ['livré', 'annulé'],
  'livré':    [],
  'annulé':   []
}

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: '❌ Statut invalide' })
    }

    const order = await Order.findById(req.params.id)
      .populate('items.product', 'seller')
    if (!order) return res.status(404).json({ message: '❌ Commande introuvable' })

    const isAdmin = req.user.role === 'admin'
    const isSeller = order.items.some(it =>
      it.product?.seller?.toString() === req.user._id?.toString()
    )
    if (!isAdmin && !isSeller) {
      return res.status(403).json({ message: '❌ Vous n’êtes pas autorisé' })
    }

    // ✅ Bloquer les transitions interdites
    const allowedNext = STATUS_TRANSITIONS[order.status] || []
    if (order.status !== status && !allowedNext.includes(status)) {
      return res.status(400).json({
        message: `❌ Transition interdite : ${order.status} → ${status}`
      })
    }

    // ✅ Si annulation → restocker
    if (status === 'annulé' && order.status !== 'annulé') {
      for (const it of order.items) {
        await Product.findByIdAndUpdate(it.product, { $inc: { stock: it.qty } })
      }
    }

    order.status = status
    await order.save()

    res.json({ message: '✅ Statut mis à jour', order })
  } catch (error) {
    console.error('updateOrderStatus:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}
