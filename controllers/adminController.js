import User from '../models/User.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'

// ✅ Middleware appliqué en amont : requireAdmin
export const getDashboardStats = async (req, res) => {
  try {
    // ✅ CORRECTION 5.1 — Requêtes en parallèle + sélect minimal + lean
    const [
      totalUsers, totalProducts, totalOrders, totalSellers,
      revenueAgg, usersByRole, ordersByStatus, recentOrders, topProducts
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments({ role: 'vendeur' }),
      Order.aggregate([
        { $match: { paymentStatus: 'payé' } },
        { $group: {
          _id: null,
          totalRevenue:     { $sum: '$totalAmount' },
          totalCommission:  { $sum: '$commission' },
          avgOrder:         { $avg: '$totalAmount' }
        }}
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // ✅ CORRECTION 5.7 — limit + lean
      Order.find().sort({ createdAt: -1 }).limit(5)
        .populate('buyer', 'name email').lean(),
      Product.find().sort({ rating: -1 }).limit(5)
        .select('name emoji rating salesCount').lean()
    ])

    res.json({
      overview: {
        totalUsers,
        totalSellers,
        totalProducts,
        totalOrders,
        revenue: revenueAgg[0] || { totalRevenue: 0, totalCommission: 0, avgOrder: 0 }
      },
      usersByRole,
      ordersByStatus,
      recentOrders,
      topProducts
    })
  } catch (error) {
    console.error('getDashboardStats:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const getAllUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query
    const pageNum = Math.max(1, Number(page))
    const lim     = Math.min(100, Number(limit))
    const skip    = (pageNum - 1) * lim

    const filter = {}
    if (role && ['acheteur', 'vendeur', 'admin'].includes(role)) filter.role = role
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')   // ✅ sanitization
      filter.$or = [{ name: rx }, { email: rx }]
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 })
        .skip(skip).limit(lim).lean(),
      User.countDocuments(filter)
    ])
    res.json({ users, total, page: pageNum, pages: Math.ceil(total / lim) })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean()
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })
    res.json({ user })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const updateUser = async (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'role', 'country', 'isVerified']
    const updates = {}
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k]
    }
    if (updates.role && !['acheteur', 'vendeur', 'admin'].includes(updates.role)) {
      return res.status(400).json({ message: '❌ Rôle invalide' })
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true
    }).select('-password')
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })
    res.json({ user })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ✅ CORRECTION 5.2 — Cascade + protection admin
export const deleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id).lean()
    if (!target) return res.status(404).json({ message: '❌ Utilisateur introuvable' })
    if (target.role === 'admin') {
      return res.status(403).json({ message: '❌ Impossible de supprimer un admin' })
    }

    await Promise.all([
      User.findByIdAndDelete(req.params.id),
      // Cascade : anonymiser les commandes au lieu de supprimer
      Order.updateMany(
        { buyer: req.params.id },
        { $set: { buyerDeleted: true } }
      ),
      // Marquer ses produits comme inactifs
      Product.updateMany({ seller: req.params.id }, { $set: { isActive: false } })
    ])

    res.json({ message: '✅ Utilisateur supprimé (commandes anonymisées)' })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const verifyUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { isVerified: true }, { new: true }
    ).select('-password')
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })
    res.json({ message: '✅ Utilisateur vérifié', user })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const suspendUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { isVerified: false, tokenVersion: { $inc: 1 } }, { new: true }
    ).select('-password')
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })
    res.json({ message: '✅ Utilisateur suspendu', user })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ✅ CORRECTION 5.4 — Index requis sur `country`
export const getStatsByCountry = async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ])
    res.json({ stats })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ✅ CORRECTION 5.5 — Lookup limité aux 1000 dernières commandes d'abord
export const getSalesByMonth = async (req, res) => {
  try {
    const since = new Date()
    since.setMonth(since.getMonth() - 12)

    const stats = await Order.aggregate([
      { $match: { createdAt: { $gte: since }, paymentStatus: 'payé' } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        orders:     { $sum: 1 },
        revenue:    { $sum: '$totalAmount' },
        commission: { $sum: '$commission' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])
    res.json({ stats })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const getTopSellers = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $match: { paymentStatus: 'payé' } },
      { $unwind: '$items' },
      { $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product'
      }},
      { $unwind: '$product' },
      { $group: {
        _id: '$product.seller',
        totalSales:  { $sum: '$items.qty' },
        totalRevenue:{ $sum: { $multiply: ['$items.price', '$items.qty'] } },
        orderCount:  { $sum: 1 }
      }},
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'seller'
      }},
      { $unwind: '$seller' },
      { $project: {
        name: '$seller.name',
        email: '$seller.email',
        country: '$seller.country',
        totalSales: 1,
        totalRevenue: 1,
        orderCount: 1
      }}
    ])
    res.json({ sellers: stats })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}
