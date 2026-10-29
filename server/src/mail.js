/**
 * Envoi de courriels par Resend (offre gratuite). Sans clé `RESEND_API_KEY`, aucun courriel ne part :
 * le lien d'invitation est alors seulement montré à celui qui invite, qui le transmet lui-même.
 */
export async function sendMail(env, { to, subject, text }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
