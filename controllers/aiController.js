import { callAiPredict } from '../services/aiService.js'
import rateLimit from 'express-rate-limit'

export const aiPredictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: '❌ Trop de requêtes IA' }
})

export const predict = async (req, res) => {
  try {
    const input = req.body || {}
    if (!input || Object.keys(input).length === 0) {
      return res.status(400).json({ message: '❌ Body requis' })
    }

    // ✅ Validation taille
    const inputSize = JSON.stringify(input).length
    if (inputSize > 50_000) {
      return res.status(413).json({ message: '❌ Payload trop volumineux' })
    }

    const aiResponse = await callAiPredict({ input })
    // aiResponse = { message, result, meta }
    res.json({ message: '✅ IA prédiction prête', result: aiResponse.result })
  } catch (error) {
    console.error('predict:', error)
    if (error.message === 'AI_TIMEOUT') {
      return res.status(504).json({ message: '❌ Service IA timeout' })
    }
    res.status(500).json({ message: '❌ Erreur IA', error: error.message })
  }
}


