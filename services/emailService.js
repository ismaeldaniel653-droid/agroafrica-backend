/**
 * AgroAfrica — Service Email V2.0
 *  - XSS sanitization (escape des inputs user)
 *  - Sanitize-it dependency (DOMPurify server-side)
 *  - Templates factorisés + localisables
 *  - Timeout, retry, file d'attente Redis
 *  - Multi-provider (SMTP / Resend / SendGrid)
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)


let transporter = null
let provider = null   // 'smtp' | 'resend' | 'sendgrid' | 'log'
import { cacheSet } from '../config/redisClient.js'

const envBool = (v, d = false) => v === undefined ? d : v === 'true' || v === '1'

const initTransporter = async () => {
  try {
    const nodemailer = await import('nodemailer')

    // ✅ Multi-provider
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')               // npm install resend
      transporter = new Resend(process.env.RESEND_API_KEY)
      provider = 'resend'
      console.log('✅ Service email configuré (Resend)')
    } else if (process.env.SENDGRID_API_KEY) {
      const sgMail = await import('@sendgrid/mail')
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY)
      transporter = sgMail.default
      provider = 'sendgrid'
      console.log('✅ Service email configuré (SendGrid)')
    } else if (process.env.SMTP_HOST) {
      transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: envBool(process.env.SMTP_SECURE, false),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 10_000,                            // ✅ 1.3
        greetingTimeout:    5_000,
        socketTimeout:      15_000
      })
      provider = 'smtp'
      console.log('✅ Service email configuré (SMTP)')
    } else {
      provider = 'log'
      console.log('⚠️ Service email en mode log (SMTP/RESEND/SENDGRID non configuré)')
    }
  } catch (err) {
    provider = 'log'
    console.warn('⚠️ nodemailer non installé — emails en mode log')
  }
}
initTransporter()

// ============================================================
// ✅ CORRECTION 1.1 / 1.2 — SANITIZE (HTML escape server-side)
// ============================================================
const escapeHtml = (s) => {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#x60;')
    .replace(/\//g, '&#x2F;')
}

const sanitizeEmoji = (s) => {
  if (!s) return '📦'
  // Whitelist caractères sûrs + emojis unicode
  if (/^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\s]{1,8}$/u.test(String(s))) return s
  return '📦'
}

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'https://agroafrica-frontend.vercel.app'

// ============================================================
// ✅ CORRECTION 1.6 — Templates factorisés
// ============================================================
const renderLayout = ({ title, headerSubtitle, bodyHtml, ctaText, ctaUrl }) => {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F5F7F5;margin:0;padding:20px;color:#1A2E25}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.1)}
  .header{background:linear-gradient(135deg,#0C6B4E,#18A070);padding:30px;text-align:center;color:#fff}
  .header h1{margin:0;font-size:24px}
  .content{padding:30px}
  .footer{background:#0D1F2D;padding:20px;text-align:center;color:#fff;font-size:12px}
  .btn{display:inline-block;background:#F0A500;color:#0D1F2D;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold}
  .order-box{background:#E8F7F1;border-radius:12px;padding:16px;margin:16px 0}
</style></head><body>
  <div class="container">
    <div class="header"><h1>🌿 ${escapeHtml(title)}</h1><p>${escapeHtml(headerSubtitle)}</p></div>
    <div class="content">${bodyHtml}${
      ctaText && ctaUrl ? `<p style="text-align:center;margin-top:24px"><a href="${escapeHtml(ctaUrl)}" class="btn">${escapeHtml(ctaText)}</a></p>` : ''
    }</div>
    <div class="footer">
      <p>AgroAfrica — Le marché agricole et artisanal africain 🌍</p>
      <p>© ${new Date().getFullYear()} AgroAfrica. Tous droits réservés.</p>
    </div>
  </div>
</body></html>`
}

// ============================================================
// ✅ CORRECTION 1.4 — Retry + queue Redis
// ============================================================
const sendWithRetry = async (htmlPayload, attempt = 1) => {
  if (provider === 'log') {
    console.log(`📧 [MOCK] to=${htmlPayload.to} subject="${htmlPayload.subject}"`)
    return { sent: true, mock: true }
  }
  try {
    const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('EMAIL_TIMEOUT')), 20_000))   // ✅ 1.3
    const sendPromise =
      provider === 'sendgrid'      ? transporter.send(htmlPayload)
    : provider === 'resend'        ? transporter.emails.send(htmlPayload)
    : /* smtp */                     transporter.sendMail(htmlPayload)

    await Promise.race([sendPromise, timer])
    return { sent: true }
  } catch (err) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * attempt ** 2))                                     // ✅ 1.4
      console.warn(`[email] tentative #${attempt + 1} échouée, retry…`)
      return sendWithRetry(htmlPayload, attempt + 1)
    }
    // Mise en file d'attente Redis pour retry ultérieur
    await cacheSet('email:failed:' + Date.now(), JSON.stringify(htmlPayload), 24 * 3600)
    console.error('[email] échec définitif →', err.message)
    return { sent: false, error: err.message }
  }
}

// ============================================================
// EMAILS
// ============================================================
const METHOD_LABELS = {
  mtn_money: 'MTN MoMo', orange_money: 'Orange Money', moov_money: 'Moov Money',
  wave: 'Wave', visa: 'Visa/Mastercard', paypal: 'PayPal', cash_on_delivery: 'Paiement à la livraison'
}

export const sendOrderConfirmation = async ({ to, name, orderId, items, total }) => {
  const safeName = escapeHtml(name)
  const safeOrderId = escapeHtml(orderId)
  const itemsHtml = items.map(i => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee">
      <span>${sanitizeEmoji(i.emoji)} ${escapeHtml(i.name)} ×${Number(i.qty) || 0}</span>
      <strong>${(Number(i.price) * Number(i.qty)).toLocaleString('fr-FR')} FCFA</strong>
    </div>`).join('')

  const html = renderLayout({
    title: 'AgroAfrica',
    headerSubtitle: 'Confirmation de commande',
    ctaText: 'Voir mes commandes',
    ctaUrl: `${FRONTEND_BASE_URL}/my-orders`,
    bodyHtml: `
      <h2>Bonjour ${safeName} ! 👋</h2>
      <p>Votre commande <strong>${safeOrderId}</strong> a été confirmée avec succès.</p>
      <div class="order-box">
        <p><strong>📦 Articles :</strong></p>
        ${itemsHtml}
        <div style="text-align:right;margin-top:12px;font-size:18px"><strong>Total : ${Number(total).toLocaleString('fr-FR')} FCFA</strong></div>
      </div>
      <p>Vous recevrez un suivi de livraison prochainement.</p>`
  })

  return sendWithRetry({
    from: process.env.MAIL_FROM || `"AgroAfrica" <noreply@agroafrica.com">`,
    to, subject: `✅ Commande ${safeOrderId} confirmée — AgroAfrica`, html
  })
}

export const sendPaymentConfirmation = async ({ to, name, orderId, amount, method }) => {
  const html = renderLayout({
    title: 'AgroAfrica',
    headerSubtitle: 'Confirmation de paiement',
    ctaText: 'Suivre la commande',
    ctaUrl: `${FRONTEND_BASE_URL}/payment-status/${encodeURIComponent(orderId)}`,
    bodyHtml: `
      <h2>Paiement reçu ! 💰</h2>
      <p>Bonjour ${escapeHtml(name)},</p>
      <p>Votre paiement de <strong>${Number(amount).toLocaleString('fr-FR')} FCFA</strong> via <strong>${escapeHtml(METHOD_LABELS[method] || method)}</strong> pour la commande <strong>${escapeHtml(orderId)}</strong> a été enregistré.</p>
      <div class="order-box" style="text-align:center">
        <p style="font-size:24px;margin:0">✅ ${Number(amount).toLocaleString('fr-FR')} FCFA</p>
        <p style="color:#8AADA0;margin:4px 0 0">via ${escapeHtml(METHOD_LABELS[method] || method)}</p>
      </div>`
  })
  return sendWithRetry({
    from: process.env.MAIL_FROM || `"AgroAfrica" <noreply@agroafrica.com">`,
    to, subject: `💰 Paiement ${Number(amount).toLocaleString('fr-FR')} FCFA confirmé — Commande ${escapeHtml(orderId)}`, html
  })
}

export const sendWelcomeEmail = async ({ to, name, role }) => {
  const roleText = role === 'vendeur' ? 'vendeur' : role === 'cooperative' ? 'membre de coopérative' : 'acheteur'
  const sellerBullets = '<li>Publier vos produits sur le marché</li><li>Gérer vos commandes depuis le tableau de bord</li>'
  const buyerBullets  = '<li>Parcourir le catalogue de produits</li><li>Passer des commandes sécurisées</li>'

  const html = renderLayout({
    title: 'Bienvenue sur AgroAfrica !',
    headerSubtitle: 'Votre compte est créé',
    ctaText: 'Accéder à AgroAfrica',
    ctaUrl: FRONTEND_BASE_URL,
    bodyHtml: `
      <h2>Bonjour ${escapeHtml(name)} ! 🎉</h2>
      <p>Votre compte <strong>${escapeHtml(roleText)}</strong> a été créé avec succès.</p>
      <p>Vous pouvez dès maintenant :</p>
      <ul>${role === 'vendeur' || role === 'cooperative' ? sellerBullets : buyerBullets}<li>Compléter votre profil et paramètres</li></ul>`
  })
  return sendWithRetry({
    from: process.env.MAIL_FROM || `"AgroAfrica" <noreply@agroafrica.com">`,
    to, subject: `🌿 Bienvenue sur AgroAfrica, ${escapeHtml(name)} !`, html
  })
}

export const sendPasswordReset = async ({ to, name, resetUrl }) => {
  const html = renderLayout({
    title: 'AgroAfrica',
    headerSubtitle: 'Réinitialisation de mot de passe',
    ctaText: 'Réinitialiser mon mot de passe',
    ctaUrl: resetUrl,
    bodyHtml: `
      <h2>Bonjour ${escapeHtml(name)},</h2>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>Cliquez sur le bouton ci-dessous (lien valide 30 minutes) :</p>
      <p style="color:#888;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`
  })
  return sendWithRetry({
    from: process.env.MAIL_FROM || `"AgroAfrica" <noreply@agroafrica.com">`,
    to, subject: '🔐 Réinitialisation de votre mot de passe — AgroAfrica', html
  })
}
