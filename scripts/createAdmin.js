import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import User from '../models/User.js'

dotenv.config()

const createAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI)

  const existing = await User.findOne({ email: 'admin@agroafrica.com' })
  if (existing) {
    console.log('⚠️ Admin existe déjà')
    process.exit()
  }

  const hashedPassword = await bcrypt.hash('Admin@2025', 12)

  await User.create({
    name:       'Administrateur AgroAfrica',
    email:      'admin@agroafrica.com',
    phone:      '+237 000 000 000',
    password:   hashedPassword,
    role:       'admin',
    isVerified: true
  })

  console.log('✅ Admin créé !')
  console.log('   Email    : admin@agroafrica.com')
  console.log('   Password : Admin@2025')
  process.exit()
}

createAdmin()