import { callAiPredict } from '../services/aiService.js'

// POST /api/ai/predict
// body: { input: any }
export const predict = async (req, res) => {
  try {
    const { input } = req.body

    if (input === undefined) {
      return res.status(400).json({ message: '❌ input est requis' })
    }

    // Appel service IA (Python)
    const aiResult = await callAiPredict({ input })

    res.json({
      message: '✅ IA prédiction prête',
      result: aiResult
    })
  } catch (error) {
    res.status(500).json({ message: '❌ Erreur IA', error: error.message })
  }
}

