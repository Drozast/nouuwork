/**
 * Script de un solo uso: sube el template HTML de "Restablecer contraseña"
 * al proyecto Firebase de la app Nouu (nouu-f8214).
 *
 * Requisito: estar autenticado con gcloud
 *   gcloud auth application-default login
 *
 * Uso:
 *   cd functions
 *   node scripts/update-email-template.js
 */

const admin = require('firebase-admin');
const https = require('https');

// ── Proyecto destino (la app Flutter/mobile) ───────────────────────────────
const PROJECT_ID = 'nouu-f8214';

// ── Template HTML (Firebase usa %LINK% como placeholder del enlace) ────────
const EMAIL_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Restablecer Contraseña · Nouu</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Montserrat', Arial, sans-serif; background-color: #0B0B0B; color: #FFFFFF; margin: 0; padding: 30px 16px; width: 100%; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #0B0B0B; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,59,92,0.2); box-shadow: 0 0 60px rgba(255,59,92,0.08), 0 0 120px rgba(0,0,0,0.8); }
    .email-header { background: linear-gradient(160deg,#1A0A0F 0%,#2B0D14 50%,#1A0A0F 100%); padding: 48px 40px 44px; text-align: center; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,59,92,0.25); }
    .email-header::before { content:''; position:absolute; top:-80px; left:50%; transform:translateX(-50%); width:400px; height:300px; background:radial-gradient(ellipse,rgba(255,59,92,0.22) 0%,transparent 70%); pointer-events:none; }
    .logo-text { font-size:38px; font-weight:800; color:#FFFFFF; letter-spacing:-1px; line-height:1; display:inline-block; position:relative; }
    .logo-text .excl { color:#FF3B5C; }
    .header-icon-wrap { width:76px; height:76px; margin:24px auto 20px; background:rgba(255,59,92,0.12); border:2px solid rgba(255,59,92,0.35); border-radius:50%; display:flex; align-items:center; justify-content:center; }
    .header-title { font-size:26px; font-weight:800; color:#FFFFFF; letter-spacing:-0.5px; line-height:1.25; }
    .header-subtitle { font-size:13px; font-weight:500; color:rgba(255,255,255,0.45); margin-top:8px; letter-spacing:0.4px; }
    .email-body { background-color:#111111; padding:40px 40px 36px; }
    .section-heading { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
    .section-heading h2 { font-size:19px; font-weight:700; color:#FFFFFF; }
    .body-text { font-size:15px; font-weight:400; color:rgba(255,255,255,0.68); line-height:1.75; margin-bottom:14px; }
    .divider { height:1px; background:linear-gradient(90deg,transparent,rgba(255,59,92,0.25),transparent); margin:30px 0; }
    .cta-wrap { text-align:center; margin:36px 0; }
    .cta-button { display:inline-block; background:linear-gradient(135deg,#FF3B5C 0%,#E0243F 100%); color:#FFFFFF !important; text-decoration:none; font-family:'Montserrat',Arial,sans-serif; font-size:16px; font-weight:700; letter-spacing:0.2px; padding:18px 52px; border-radius:14px; box-shadow:0 8px 28px rgba(255,59,92,0.4),0 2px 8px rgba(255,59,92,0.2); }
    .warning-box { background:rgba(255,59,92,0.07); border:1px solid rgba(255,59,92,0.28); border-left:4px solid #FF3B5C; border-radius:12px; padding:16px 20px; margin:24px 0; }
    .warning-box p { font-size:13px; font-weight:500; color:rgba(255,255,255,0.72); line-height:1.65; }
    .warning-box strong { color:#FF3B5C; font-weight:700; }
    .fallback-label { font-size:13px; font-weight:500; color:rgba(255,255,255,0.45); margin-bottom:10px; }
    .fallback-link { display:block; font-size:12px; color:#FF3B5C; text-decoration:none; word-break:break-all; line-height:1.6; padding:12px 16px; background:rgba(255,59,92,0.05); border-radius:8px; border:1px solid rgba(255,59,92,0.15); }
    .tips-box { background:#1A1A1A; border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:22px 24px; margin:28px 0; }
    .tips-header { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
    .tips-header h3 { font-size:15px; font-weight:700; color:#FF3B5C; }
    .tips-list { list-style:none; }
    .tips-list li { font-size:13px; font-weight:500; color:rgba(255,255,255,0.62); line-height:1.55; padding:6px 0 6px 20px; position:relative; }
    .tips-list li::before { content:''; position:absolute; left:0; top:14px; width:6px; height:6px; background:#FF3B5C; border-radius:50%; }
    .not-requested { background:#151515; border-radius:12px; border:1px solid rgba(255,255,255,0.06); padding:22px 24px; margin-top:28px; }
    .not-requested h3 { font-size:15px; font-weight:700; color:#FF3B5C; margin-bottom:12px; }
    .not-requested p { font-size:13px; color:rgba(255,255,255,0.58); line-height:1.7; margin-bottom:10px; }
    .not-requested p:last-child { margin-bottom:0; }
    .email-footer { background:#0B0B0B; border-top:1px solid rgba(255,255,255,0.07); padding:32px 40px; text-align:center; }
    .footer-logo { font-size:24px; font-weight:800; color:#FFFFFF; letter-spacing:-0.5px; margin-bottom:6px; }
    .footer-logo span { color:#FF3B5C; }
    .footer-tagline { font-size:13px; font-weight:500; color:rgba(255,255,255,0.38); margin-bottom:4px; }
    .footer-location { font-size:12px; color:rgba(255,255,255,0.28); margin-bottom:22px; }
    .footer-links { display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
    .footer-links a { font-size:13px; font-weight:600; color:#FF3B5C; text-decoration:none; }
    .footer-dot { color:rgba(255,255,255,0.25); font-size:12px; }
    .footer-copy { font-size:11px; color:rgba(255,255,255,0.22); }
    @media (max-width:620px) { body { padding:0; } .email-wrapper { border-radius:0; } .email-header { padding:36px 24px 32px; } .email-body { padding:32px 24px; } .email-footer { padding:28px 20px; } .header-title { font-size:22px; } .cta-button { padding:16px 32px; font-size:15px; width:90%; } }
  </style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">
    <div class="logo-text">Nouu<span class="excl">!</span></div>
    <div class="header-icon-wrap">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="11" width="18" height="12" rx="3" fill="#FF3B5C" opacity="0.85"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#FF3B5C" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        <circle cx="12" cy="16.5" r="1.5" fill="white"/>
        <line x1="12" y1="18" x2="12" y2="20.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </div>
    <h1 class="header-title">Restablecer Contrase&ntilde;a</h1>
    <p class="header-subtitle">Solicitud de restablecimiento de cuenta</p>
  </div>
  <div class="email-body">
    <div class="section-heading">
      <span style="font-size:22px;">&#128272;</span>
      <h2>Solicitud de Restablecimiento</h2>
    </div>
    <p class="body-text">Hemos recibido una solicitud para restablecer la contrase&ntilde;a de tu cuenta de <strong style="color:#fff;">Nouu</strong>.</p>
    <p class="body-text">Si realizaste esta solicitud, haz clic en el bot&oacute;n de abajo para crear una nueva contrase&ntilde;a:</p>
    <div class="cta-wrap">
      <a href="%LINK%" class="cta-button" target="_blank" rel="noopener noreferrer">Restablecer Contrase&ntilde;a</a>
    </div>
    <div class="warning-box">
      <p>&#9200; <strong>Este enlace expirar&aacute; en 1 hora</strong> por razones de seguridad. Si necesitas m&aacute;s tiempo, puedes solicitar un nuevo enlace desde la aplicaci&oacute;n.</p>
    </div>
    <div class="divider"></div>
    <p class="fallback-label">Si el bot&oacute;n no funciona, copia y pega el siguiente enlace en tu navegador:</p>
    <a href="%LINK%" class="fallback-link" target="_blank" rel="noopener noreferrer">%LINK%</a>
    <div class="tips-box">
      <div class="tips-header">
        <span style="font-size:18px;">&#128737;</span>
        <h3>Consejos de Seguridad</h3>
      </div>
      <ul class="tips-list">
        <li>Usa una contrase&ntilde;a &uacute;nica que no hayas usado en otros sitios</li>
        <li>Incluye may&uacute;sculas, min&uacute;sculas, n&uacute;meros y s&iacute;mbolos</li>
        <li>Nunca compartas tu contrase&ntilde;a con nadie</li>
        <li>Considera usar un gestor de contrase&ntilde;as</li>
      </ul>
    </div>
    <div class="not-requested">
      <h3>&iquest;No solicitaste este cambio?</h3>
      <p>Si no fuiste t&uacute; quien solicit&oacute; restablecer la contrase&ntilde;a, puedes ignorar este email de forma segura. Tu contrase&ntilde;a actual seguir&aacute; siendo v&aacute;lida.</p>
      <p>Si crees que alguien m&aacute;s est&aacute; intentando acceder a tu cuenta, te recomendamos que cambies tu contrase&ntilde;a de inmediato y contactes a nuestro equipo de soporte.</p>
    </div>
  </div>
  <div class="email-footer">
    <div class="footer-logo">Nouu<span>!</span></div>
    <p class="footer-tagline">Conectando necesidades con soluciones</p>
    <p class="footer-location">Santiago, Chile</p>
    <div class="footer-links">
      <a href="https://www.nouu.cl" target="_blank" rel="noopener noreferrer">Sitio Web</a>
      <span class="footer-dot">&middot;</span>
      <a href="mailto:soporte@nouu.cl">Soporte</a>
      <span class="footer-dot">&middot;</span>
      <a href="https://www.nouu.cl/privacidad" target="_blank" rel="noopener noreferrer">Privacidad</a>
    </div>
    <p class="footer-copy">&copy; 2026 Nouu. Todos los derechos reservados.</p>
  </div>
</div>
</body>
</html>`;

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // Init con proyecto nouu-f8214 (app Flutter)
  const app = admin.initializeApp({
    projectId: PROJECT_ID,
  });

  console.log(`Obteniendo token para proyecto ${PROJECT_ID}...`);

  // Obtener access token via Application Default Credentials
  const token = await app.options.credential
    ? await new Promise((resolve, reject) => {
        admin.app().options.credential?.getAccessToken?.((err, token) => {
          if (err) reject(err);
          else resolve(token?.access_token);
        });
      })
    : null;

  if (!token) {
    // Fallback: usar google-auth-library si está disponible
    try {
      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
      const client = await auth.getClient();
      const tokenRes = await client.getAccessToken();
      await updateTemplate(tokenRes.token);
    } catch (e) {
      console.error('No se pudo obtener el token. Asegúrate de correr:');
      console.error('  gcloud auth application-default login');
      process.exit(1);
    }
    return;
  }

  await updateTemplate(token);
}

async function updateTemplate(accessToken) {
  const body = JSON.stringify({
    notification: {
      sendEmail: {
        resetPasswordTemplate: {
          senderDisplayName: 'Nouu',
          subject: 'Restablecer tu contraseña en Nouu',
          body: EMAIL_HTML,
          bodyFormat: 'HTML',
          customized: true,
        },
      },
    },
  });

  const url = `identitytoolkit.googleapis.com`;
  const path = `/admin/v2/projects/${PROJECT_ID}/config?updateMask=notification.sendEmail.resetPasswordTemplate`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url,
        path,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Template de email actualizado exitosamente en nouu-f8214');
            resolve();
          } else {
            console.error(`❌ Error ${res.statusCode}:`, data);
            reject(new Error(data));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
