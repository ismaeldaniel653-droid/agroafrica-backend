// ═══════════════════════════════════════
// SERVICE EMAIL — NodeMailer (optionnel)
// ═══════════════════════════════════════
// En production, configurez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS dans .env

let transporter = null

const initTransporter = async () => {
  try {
    // Dynamic import pour ne pas planter si nodemailer n'est pas installé
    const nodemailer = await import('nodemailer')

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })
      console.log('✅ Service email configuré')
    } else {
      console.log('⚠️ Service email non configuré (SMTP manquant)')
    }
  } catch (err) {
    console.log('⚠️ nodemailer non installé — emails désactivés')
  }
}

// Initialiser au démarrage
initTransporter()

// ═══════════════════════════════════════
// TEMPLATES EMAIL
// ═══════════════════════════════════════

const emailStyles = `
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #F5F7F5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0C6B4E, #18A070); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; color: #1A2E25; }
    .footer { background: #0D1F2D; padding: 20px; text-align: center; color: white; font-size: 12px; }
    .btn { display: inline-block; background: #F0A500; color: #0D1F2D; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; }
    .order-box { background: #E8F7F1; border-radius: 12px; padding: 16px; margin: 16px 0; }
  </style>
`

export const sendOrderConfirmation = async ({ to, name, orderId, items, total }) => {
  if (!transporter) {
    console.log(`📧 [MOCK] Email confirmation envoyé à ${to} — Commande ${orderId}`)
    return { sent: true, mock: true }
  }

  const itemsHtml = items.map(i => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;">
      <span>${i.emoji || '📦'} ${i.name} x${i.qty}</span>
      <strong>${(i.price * i.qty).toLocaleString()} FCFA</strong>
    </div>
  `).join('')

  const html = `
    ${emailStyles}
    <div class="container">
      <div class="header">
        <h1>🌿 AgroAfrica</h1>
        <p>Confirmation de commande</p>
      </div>
      <div class="content">
        <h2>Bonjour ${name} ! 👋</h2>
        <p>Votre commande <strong>${orderId}</strong> a été confirmée avec succès.</p>
        <div class="order-box">
          <p><strong>📦 Articles :</strong></p>
          ${itemsHtml}
          <div style="text-align:right; margin-top:12px; font-size:18px;">
            <strong>Total : ${total.toLocaleString()} FCFA</strong>
          </div>
        </div>
        <p>Vous recevrez un suivi de livraison prochainement.</p>
        <p style="text-align:center; margin-top:24px;">
          <a href="https://agroafrica.com/my-orders" class="btn">Voir mes commandes</a>
        </p>
      </div>
      <div class="footer">
        <p>AgroAfrica — Le marché agricole et artisanal africain 🌍</p>
        <p>© ${new Date().getFullYear()} AgroAfrica. Tous droits réservés.</p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"AgroAfrica" <${process.env.SMTP_USER || 'noreply@agroafrica.com'}>`,
      to,
      subject: `✅ Commande ${orderId} confirmée — AgroAfrica`,
      html
    })
    return { sent: true }
  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message)
    return { sent: false, error: error.message }
  }
}

export const sendPaymentConfirmation = async ({ to, name, orderId, amount, method }) => {
  if (!transporter) {
    console.log(`📧 [MOCK] Email paiement envoyé à ${to} — ${amount} FCFA via ${method}`)
    return { sent: true, mock: true }
  }

  const methodLabels = { mtn: 'MTN MoMo', orange: 'Orange Money', wave: 'Wave', visa: 'Visa/Mastercard', paypal: 'PayPal' }

  const html = `
    ${emailStyles}
    <div class="container">
      <div class="header">
        <h1>🌿 AgroAfrica</h1>
        <p>Confirmation de paiement</p>
      </div>
      <div class="content">
        <h2>Paiement reçu ! 💰</h2>
        <p>Bonjour ${name},</p>
        <p>Votre paiement de <strong>${amount.toLocaleString()} FCFA</strong> via <strong>${methodLabels[method] || method}</strong> pour la commande <strong>${orderId}</strong> a été enregistré.</p>
        <div class="order-box" style="text-align:center;">
          <p style="font-size:24px; margin:0;">✅ ${amount.toLocaleString()} FCFA</p>
          <p style="color:#8AADA0; margin:4px 0 0;">via ${methodLabels[method] || method}</p>
        </div>
        <p style="text-align:center; margin-top:24px;">
          <a href="https://agroafrica.com/payment-status/${orderId}" class="btn">Suivre la commande</a>
        </p>
      </div>
      <div class="footer">
        <p>AgroAfrica — Le marché agricole et artisanal africain 🌍</p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"AgroAfrica" <${process.env.SMTP_USER || 'noreply@agroafrica.com'}>`,
      to,
      subject: `💰 Paiement de ${amount.toLocaleString()} FCFA confirmé — Commande ${orderId}`,
      html
    })
    return { sent: true }
  } catch (error) {
    return { sent: false, error: error.message }
  }
}

export const sendWelcomeEmail = async ({ to, name, role }) => {
  if (!transporter) {
    console.log(`📧 [MOCK] Email bienvenue envoyé à ${to}`)
    return { sent: true, mock: true }
  }

  const roleText = role === 'vendeur' ? 'vendeur' : role === 'cooperative' ? 'membre de coopérative' : 'acheteur'

  const html = `
    ${emailStyles}
    <div class="container">
      <div class="header">
        <h1>🌿 Bienvenue sur AgroAfrica !</h1>
        <p>Votre compte est créé</p>
      </div>
      <div class="content">
        <h2>Bonjour ${name} ! 🎉</h2>
        <p>Votre compte <strong>${roleText}</strong> a été créé avec succès.</p>
        <p>Vous pouvez dès maintenant :</p>
        <ul>
          ${role === 'vendeur' || role === 'cooperative' ? '<li>Publier vos produits sur le marché</li><li>Gérer vos commandes depuis le tableau de bord</li>' : '<li>Parcourir le catalogue de produits</li><li>Passer des commandes sécurisées</li>'}
          <li>Profiler votre profil et vos paramètres</li>
        </ul>
        <p style="text-align:center; margin-top:24px;">
          <a href="https://agroafrica.com" class="btn">Accéder à AgroAfrica</a>
        </p>
      </div>
      <div class="footer">
        <p>AgroAfrica — Le marché agricole et artisanal africain 🌍</p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"AgroAfrica" <${process.env.SMTP_USER || 'noreply@agroafrica.com'}>`,
      to,
      subject: `🌿 Bienvenue sur AgroAfrica, ${name} !`,
      html
    })
    return { sent: true }
  } catch (error) {
    return { sent: false, error: error.message }
  }
}