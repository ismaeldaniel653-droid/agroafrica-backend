/**
 * AgroAfrica — Bootstrap Admin V2.0
 *  - Lit credentials depuis .env (jamais hardcodés)
 *  - Refuse en production sauf override explicite
 *  - Hash cost adaptatif
 *  - Idempotent + met à jour password si différent
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

const required = ['MONGO_URI', 'ADMIN_BOOTSTRAP_EMAIL']
for (const k of required) {
  if (!process.env[k]) {
    console.error(`❌ Variable d'env requise : ${k}`)
    process.exit(1)
  }
}

// ✅ 6.3 / 6.4 — Garde prod
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
  console.error('❌ Refusé en production sans ALLOW_ADMIN_BOOTSTRAP=true')
  process.exit(1)
}

const { default: User } = await import('../models/User.js')

const createAdmin = async () => {
  let exitCode = 0
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ MongoDB connecté')

    const email    = process.env.ADMIN_BOOTSTRAP_EMAIL
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD
    const phone    = process.env.ADMIN_BOOTSTRAP_PHONE || '+237000000000'
    const name     = process.env.ADMIN_BOOTSTRAP_NAME   || 'Administrateur AgroAfrica'

    if (!password || password.length < 12) {
      throw new Error('ADMIN_BOOTSTRAP_PASSWORD doit faire au moins 12 caractères')
    }

    // ✅ 6.7 — Idempotent
    const existing = await User.findOne({ email }).select('+password')
    if (existing) {
      const ok = await bcrypt.compare(password, existing.password)
      if (ok) {
        console.log(`ℹ️ Admin ${email} existe déjà avec ce mot de passe — rien à faire.`)
        return
      }
      console.log('⚠️ Admin existe mais mot de passe différent → mise à jour')
      const hashed = await bcrypt.hash(password, 14)
      existing.password = hashed
      existing.tokenVersion = (existing.tokenVersion || 0) + 1     // force re-login
      await existing.save()
      console.log('✅ Mot de passe admin mis à jour (avec tokenVersion incrémenté)')
      return
    }

    const hashed = await bcrypt.hash(password, 14)
    const admin  = await User.create({
      name, email, phone,
      password:   hashed,
      role:       'admin',
      isVerified: true,
      country:    'Cameroun'
    })
    console.log(`✅ Admin créé : ${admin.email}`)
    console.log('   → Connectez-vous puis changez immédiatement le mot de passe.')
  } catch (error) {
    console.error('❌ Erreur createAdmin:', error.message)
    exitCode = 1
  } finally {
    await mongoose.disconnect().catch(() => {})
    process.exit(exitCode)
  }
}

createAdmin()
