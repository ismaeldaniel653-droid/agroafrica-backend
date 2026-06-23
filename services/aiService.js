/**
 * AgroAfrica — AI Service Proxy V2.0
 *  - API Key obligatoire
 *  - Timeout AbortController
 *  - Retry 1× sur timeout (cold start)
 *  - Validation URL + format
 *  - Logs structurés
 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY
const TIMEOUT_MS = 30_000
const RETRY_ON_TIMEOUT = 1

const log = (...a) => console.log('[ai-proxy]', ...a)
const warn = (...a) => console.warn('[ai-proxy]', ...a)

// ✅ CORRECTION 3.3 — Validation au démarrage
const validateConfig = () => {
  try {
    new URL(AI_SERVICE_URL)
  } catch {
    throw new Error(`❌ AI_SERVICE_URL invalide : ${AI_SERVICE_URL}`)
  }
}
validateConfig()

const fetchWithTimeout = async (url, options, ms) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...options, signal: ctrl.signal }) }
  finally { clearTimeout(timer) }
}

const callOnce = async (input) => {
  const res = await fetchWithTimeout(`${AI_SERVICE_URL}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key':    AI_SERVICE_KEY || ''         // ✅ 3.1
    },
    body: JSON.stringify({ ...input })
  }, TIMEOUT_MS)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(`AI service ${res.status}: ${text}`), { status: res.status })
  }
  return res.json()
}

export const callAiPredict = async ({ input }, attempt = 1) => {
  // ✅ 3.5 — Shape minimale attendue par le service Python
  if (typeof input !== 'object' || input === null) {
    throw new Error('input doit être un objet {category, badge, origin, season, qty_kg}')
  }
  if (JSON.stringify(input).length > 50_000) {
    throw new Error('input trop volumineux')
  }

  log(`predict cat=${input.category} origin=${input.origin} attempt=${attempt}`)

  try {
    return await callOnce(input)
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    warn(`attempt ${attempt} failed: ${err.message}`)
    if (isTimeout && attempt <= RETRY_ON_TIMEOUT) {
      await new Promise(r => setTimeout(r, 1500))                   // 3.4 — backoff
      return callAiPredict({ input }, attempt + 1)
    }
    if (isTimeout) throw new Error('AI_TIMEOUT')
    throw err
  }
}

export const pingAiService = async () => {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5_000)
    const res = await fetch(`${AI_SERVICE_URL}/health`, { signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok
  } catch { return false }
}
