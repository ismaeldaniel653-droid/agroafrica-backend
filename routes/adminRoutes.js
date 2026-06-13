import express from 'express'
import {
  getDashboardStats,
  getAllUsers, getUser, updateUser, deleteUser,
  verifyUser, suspendUser,
  getStatsByCountry, getSalesByMonth, getTopSellers
} from '../controllers/adminController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Middleware : admin uniquement
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '❌ Accès administrateur uniquement' })
  }
  next()
}

// Dashboard & Stats
router.get('/dashboard',       protect, adminOnly, getDashboardStats)
router.get('/stats/countries',  protect, adminOnly, getStatsByCountry)
router.get('/stats/sales',      protect, adminOnly, getSalesByMonth)
router.get('/stats/sellers',    protect, adminOnly, getTopSellers)

// Gestion Utilisateurs
router.get('/users',            protect, adminOnly, getAllUsers)
router.get('/users/:id',        protect, adminOnly, getUser)
router.put('/users/:id',        protect, adminOnly, updateUser)
router.delete('/users/:id',     protect, adminOnly, deleteUser)
router.patch('/users/:id/verify',   protect, adminOnly, verifyUser)
router.patch('/users/:id/suspend',  protect, adminOnly, suspendUser)

export default router