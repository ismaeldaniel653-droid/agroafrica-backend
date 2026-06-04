import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

    if (!token) {
      return res.status(401).json({ message: '❌ Non autorisé, token manquant' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')

    if (!user) {
      return res.status(401).json({ message: '❌ Utilisateur introuvable' })
    }

    req.user = user
    next()

  } catch (error) {
    return res.status(401).json({ message: '❌ Token invalide ou expiré' })
  }
}

export const vendeurOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '❌ Non autorisé' })
  }

  if (['vendeur', 'cooperative', 'admin'].includes(req.user.role)) {
    return next()
  }

  return res.status(403).json({ message: '❌ Accès vendeur uniquement' })
}