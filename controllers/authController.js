import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { sendWelcomeEmail } from '../services/emailService.js'

const JWT_SECRET = process.env.JWT_SECRET || 'agroafrica_secret_dev'

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' })
}

// INSCRIPTION
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: '❌ Tous les champs obligatoires doivent être remplis' })
    }

    if (password.length < 8) {
      return res.status(400).json({ message: '❌ Le mot de passe doit contenir au moins 8 caractères' })
    }

    const userExists = await User.findOne({ email })
    if (userExists) {
      return res.status(400).json({ message: '❌ Email déjà utilisé' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
      name, email, phone,
      password: hashedPassword,
      role: role || 'acheteur'
    })

    // Envoyer email de bienvenue (non bloquant)
    sendWelcomeEmail({ to: email, name, role: role || 'acheteur' }).catch(() => {})

    res.status(201).json({
      message: '✅ Compte créé avec succès',
      token: generateToken(user._id),
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role
      }
    })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// CONNEXION
export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: '❌ Email et mot de passe sont requis' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: '❌ Email ou mot de passe incorrect' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: '❌ Email ou mot de passe incorrect' })
    }

    res.json({
      message: '✅ Connexion réussie',
      token: generateToken(user._id),
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role
      }
    })

  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// PROFIL
export const getProfile = async (req, res) => {
  res.json({ user: req.user })
}

// MODIFIER PROFIL
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: '❌ Utilisateur introuvable' })

    const { name, email, phone, country } = req.body

    if (name) user.name = name
    if (email) user.email = email
    if (phone) user.phone = phone
    if (country) user.country = country

    await user.save()

    res.json({
      message: '✅ Profil mis à jour',
      user: { ...user.toObject(), password: undefined }
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}

// CHANGER MOT DE PASSE
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '❌ Mot de passe actuel et nouveau mot de passe requis' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: '❌ Le nouveau mot de passe doit contenir au moins 8 caractères' })
    }

    const user = await User.findById(req.user._id)
    const isMatch = await bcrypt.compare(currentPassword, user.password)

    if (!isMatch) {
      return res.status(400).json({ message: '❌ Mot de passe actuel incorrect' })
    }

    user.password = await bcrypt.hash(newPassword, 12)
    await user.save()

    res.json({ message: '✅ Mot de passe mis à jour' })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur serveur', error: error.message })
  }
}