import mongoose from 'mongoose'

let mongoServerInstance = null

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI

  try {
    if (mongoUri) {
      await mongoose.connect(mongoUri)
      console.log('✅ MongoDB connecté (URI fourni)')
      return
    }

    // fallback: lancer une instance MongoDB en mémoire (dev)
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    mongoServerInstance = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 60000
      }
    })
    const uri = mongoServerInstance.getUri()
    await mongoose.connect(uri)
    console.log('✅ MongoDB en mémoire démarré (dev fallback)')
  } catch (error) {
    console.error('❌ Erreur MongoDB :', error.message)
    if (mongoUri && process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Connexion à MONGO_URI impossible, bascule sur MongoDB en mémoire pour le développement')
      const { MongoMemoryServer } = await import('mongodb-memory-server')
      mongoServerInstance = await MongoMemoryServer.create({
        instance: {
          launchTimeout: 60000
        }
      })
      const uri = mongoServerInstance.getUri()
      await mongoose.connect(uri)
      console.log('✅ MongoDB en mémoire démarré après échec du MONGO_URI')
      return
    }
    throw error
  }
}

export const stopMemoryServer = async () => {
  if (mongoServerInstance) {
    await mongoose.disconnect()
    await mongoServerInstance.stop()
    console.log('🛑 MongoDB en mémoire arrêté')
  }
}

export default connectDB