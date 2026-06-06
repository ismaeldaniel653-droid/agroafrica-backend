import fetch from 'node-fetch'

// Appel service IA Python
export const callAiPredict = async ({ input }) => {
  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000'
  const res = await fetch(`${aiUrl}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AI service error (${res.status}): ${text || res.statusText}`)
  }

  const data = await res.json()
  return data
}

