import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { sendWelcomeEmail } from '../services/emailService.js'
import rateLimit from 'express-rate-limit'

// ✅ CORRECTION 4.1 — SECRET obligatoire (pas de fallback dev)
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET doit être défini en production')
}
const REAL_SECRET = JWT_SECRET || 'agroafrica_dev_only_localhost'

// ✅ CORRECTION 4.2 — Rate limit
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { message: '❌ Trop de tentatives, réessayez dans 15 min' }
})

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, REAL_SECRET, { expiresIn: '7d' })  // ✅ 4.4 — plus court
}

// ✅ CORRECTION 4.3 — Rôle whitelisté
const ALLOWED_ROLES = ['acheteur', 'vendeur']
const ALLOWED_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim())

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: '❌ Tous les champs obligatoires doivent être remplis' })
    }
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      return res.status(400).json({ message: '❌ Email invalide' })              // ✅ 4.8
    }
    if (password.length < 8) {
      return res.status(400).json({ message: '❌ Mot de passe ≥ 8 caractères' })
    }

    // ✅ Normalisation téléphone
    const normalizedPhone = phone.replace(/[\s+()-]/g, '')

    const userExists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: normalizedPhone }]
    })
    if (userExists) {
      return res.status(400).json({ message: '❌ Email ou téléphone déjà utilisé' })
    }

    // ✅ Rôle : whitelist + séparateur admin
    let finalRole = 'acheteur'
    if (role && ALLOWED_ROLES.includes(role)) finalRole = role
    if (ALLOWED_ADMIN_EMAILS.includes(email.toLowerCase())) finalRole = 'admin'

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
      name,
      email:    email.toLowerCase(),
      phone:    normalizedPhone,
      password: hashedPassword,
      role:     finalRole
    })

    // ✅ CORRECTION 4.6 — Email best-effort logué
    sendWelcomeEmail(user).catch(err =>
      console.warn(`⚠️ Email bienvenue non envoyé à ${user.email}:`, err.message)
    )

    res.status(201).json({
      message: '✅ Inscription réussie',
      token:   generateToken(user._id, user.role),
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        phone: user.phone,
        role:  user.role
      }
    })
  } catch (error) {
    console.error('register:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: '❌ Email et mot de passe requis' })
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    if (!user) {
      return res.status(401).json({ message: '❌ Identifiants incorrects' })     // ✅ Message générique
    }
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return res.status(401).json({ message: '❌ Identifiants incorrects' })
    }

    res.json({
      message: '✅ Connexion réussie',
      token:   generateToken(user._id, user.role),
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        phone: user.phone,
        role:  user.role
      }
    })
  } catch (error) {
    console.error('login:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const getProfile = async (req, res) => {
  try {
    // ✅ Retourne le user SANS le password
    const user = await User.findById(req.user._id)
      .select('-password')
      .lean()
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })
    res.json({ user })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

export const updateProfile = async (req, res) => {
  try {
    const updates = {}
    const allowed = ['name', 'email', 'phone', 'country']
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k]
    }
    if (updates.phone)  updates.phone  = updates.phone.replace(/[\s+()-]/g, '')
    if (updates.email)  updates.email  = updates.email.toLowerCase()

    const user = await User.findByIdAndUpdate(
      req.user._id, updates, { new: true, runValidators: true }
    ).select('-password')
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })

    res.json({ user })
  } catch (error) {
    console.error('updateProfile:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}

// ✅ CORRECTION 4.4 — Change password invalide TOUS les tokens (changer version token)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '❌Mots de passe requis' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: '❌ Nouveau mot de passe ≥ 8 caractères' })
    }
    const user = await User.findById(req.user._id).select('+password')
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })

    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) return res.status(401).json({ message: '❌ Mot de passe actuel incorrect' })

    user.password       = await bcrypt.hash(newPassword, 12)
    user.tokenVersion  = (user.tokenVersion || 0) + 1    // Force invalidation JWT
    await user.save()

    res.json({
      message: '✅ Mot de passe mis à jour, reconnectez-vous',
      token:   generateToken(user._id, user.role)
    })
  } catch (error) {
    console.error('changePassword:', error)
    res.status(500).json({ message: '❌ Erreur serveur' })
  }
}
