import fetch from 'node-fetch'

export const callAiPredict = async ({ input }) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30_000)   // ✅ timeout 30s

  try {
    const res = await fetch(`${process.env.AI_SERVICE_URL}/predict`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    process.env.AI_SERVICE_KEY
      },
      body: JSON.stringify(input),
      signal: ctrl.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`AI service ${res.status}: ${err}`)
    }
    return await res.json()
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error('AI_TIMEOUT')
    throw e
  }
}

