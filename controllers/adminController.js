import User from '../models/User.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'

// ═══════════════════════════════════════
// DASHBOARD ADMIN — Statistiques globales
// ═══════════════════════════════════════
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      revenueData,
      usersByRole,
      ordersByStatus,
      recentOrders,
      topProducts
    ] = await Promise.all([
      // Nombre total d'utilisateurs
      User.countDocuments(),

      // Nombre total de produits
      Product.countDocuments(),

      // Nombre total de commandes
      Order.countDocuments(),

      // Revenus totaux
      Order.aggregate([
        { $match: { paymentStatus: 'payé' } },
        { $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalCommission: { $sum: '$commission' },
          avgOrder: { $avg: '$totalAmount' }
        }}
      ]),

      // Utilisateurs par rôle
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),

      // Commandes par statut
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // 5 dernières commandes
      Order.find()
        .populate('buyer', 'name email')
        .sort({ createdAt: -1 })
        .limit(5),

      // Top 5 produits par ventes
      Product.find()
        .sort({ reviews: -1 })
        .limit(5)
        .select('name emoji price rating reviews')
    ])

    const stats = revenueData[0] || { totalRevenue: 0, totalCommission: 0, avgOrder: 0 }

    res.json({
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: stats.totalRevenue,
        totalCommission: stats.totalCommission,
        avgOrder: Math.round(stats.avgOrder)
      },
      usersByRole: usersByRole.reduce((acc, r) => { acc[r._id] = r.count; return acc }, {}),
      ordersByStatus: ordersByStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc }, {}),
      recentOrders,
      topProducts
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// ═══════════════════════════════════════
// GESTION UTILISATEURS
// ═══════════════════════════════════════

// Lister tous les utilisateurs
export const getAllUsers = async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query

    let filter = {}
    if (role) filter.role = role
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ])

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// Voir un utilisateur
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })
    res.json({ user })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// Modifier un utilisateur
export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })

    const { name, email, phone, role, country, isVerified } = req.body

    if (name) user.name = name
    if (email) user.email = email
    if (phone) user.phone = phone
    if (role) user.role = role
    if (country) user.country = country
    if (isVerified !== undefined) user.isVerified = isVerified

    await user.save()

    res.json({ message: '✅ Utilisateur mis à jour', user: { ...user.toObject(), password: undefined } })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// Supprimer un utilisateur
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })

    if (user.role === 'admin') {
      return res.status(400).json({ message: '❌ Impossible de supprimer un administrateur' })
    }

    await User.findByIdAndDelete(req.params.id)
    res.json({ message: '✅ Utilisateur supprimé' })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// Vérifier un utilisateur
export const verifyUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })

    user.isVerified = true
    await user.save()

    res.json({ message: '✅ Utilisateur vérifié', user: { ...user.toObject(), password: undefined } })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// Suspendre un utilisateur
export const suspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })

    user.isVerified = false
    await user.save()

    res.json({ message: '✅ Utilisateur suspendu', user: { ...user.toObject(), password: undefined } })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ═══════════════════════════════════════
// STATISTIQUES AVANCÉES
// ═══════════════════════════════════════

// Statistiques par pays
export const getStatsByCountry = async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    res.json({ countries: stats })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// Statistiques de ventes par mois
export const getSalesByMonth = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 12 }
    ])
    res.json({ monthly: stats })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// Top vendeurs
export const getTopSellers = async (req, res) => {
  try {
    const sellers = await Order.aggregate([
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $group: {
          _id: '$productInfo.seller',
          totalSales: { $sum: '$items.qty' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'sellerInfo'
        }
      },
      { $unwind: { path: '$sellerInfo', preserveNullAndEmptyArrays: true } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: '$sellerInfo.name',
          email: '$sellerInfo.email',
          country: '$sellerInfo.country',
          totalSales: 1,
          totalRevenue: 1,
          orderCount: 1
        }
      }
    ])
    res.json({ sellers })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}