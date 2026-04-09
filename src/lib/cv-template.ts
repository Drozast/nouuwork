export interface CVData {
  name: string;
  email: string;
  phone: string;
  location: string;
  experience: string;
  education: string;
  skills: string;
  languages: string;
}

export function generateCVHtml(data: CVData): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV - ${data.name || 'Sin nombre'}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      text-align: center;
      margin-bottom: 5px;
      font-size: 28px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .contact-info {
      text-align: center;
      margin-bottom: 30px;
      font-size: 14px;
      color: #666;
    }
    .contact-info span {
      margin: 0 10px;
    }
    h2 {
      border-bottom: 2px solid #333;
      padding-bottom: 5px;
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section-content {
      margin-bottom: 20px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>${data.name || 'Tu Nombre'}</h1>
  <div class="contact-info">
    ${data.email ? `<span>${data.email}</span> | ` : ''}
    ${data.phone ? `<span>${data.phone}</span> | ` : ''}
    ${data.location ? `<span>${data.location}</span>` : ''}
  </div>

  ${data.experience ? `
  <h2>Experiencia Laboral</h2>
  <div class="section-content">${data.experience}</div>
  ` : ''}

  ${data.education ? `
  <h2>Educación</h2>
  <div class="section-content">${data.education}</div>
  ` : ''}

  ${data.skills ? `
  <h2>Habilidades</h2>
  <div class="section-content">${data.skills}</div>
  ` : ''}

  ${data.languages ? `
  <h2>Idiomas</h2>
  <div class="section-content">${data.languages}</div>
  ` : ''}
</body>
</html>
  `;
}
