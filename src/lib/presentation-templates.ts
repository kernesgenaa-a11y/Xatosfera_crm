export type PresentationTemplate = 'classic' | 'editorial' | 'minimal';

export { PAGE_WIDTH_MM, PAGE_HEIGHT_MM } from './presentation-preview-template.js';

export const PRESENTATION_TEMPLATE_LABELS: Record<PresentationTemplate, string> = {
  classic: 'Classic',
  editorial: 'Editorial',
  minimal: 'Minimal',
};

export interface PresentationSpec {
  label: string;
  value: string;
}

export interface PresentationHtmlData {
  title: string;
  price: string;
  description: string;
  notes?: string;
  address?: string;
  photoDataUrls: string[];
  specs?: PresentationSpec[];
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toParagraphs = (value: string): string =>
  escapeHtml(value)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');

const renderPhotos = (photos: string[], aspectClass: string): string =>
  photos
    .map(
      (photo) => `
        <div class="photo ${aspectClass}">
          <img src="${photo}" alt="Presentation photo" />
        </div>
      `,
    )
    .join('');

const renderSpecs = (specs: PresentationSpec[]): string => {
  if (specs.length === 0) return '';

  return `
    <div class="specs">
      ${specs
        .map(
          (spec) => `
            <div class="spec">
              <span class="spec-label">${escapeHtml(spec.label)}</span>
              <span class="spec-value">${escapeHtml(spec.value)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
};

function buildClassicHtml(data: PresentationHtmlData): string {
  const { title, price, description, notes = '', address = '', photoDataUrls, specs = [] } = data;

  return `
    <!DOCTYPE html>
    <html lang="uk">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #0d0d0d; color: #f7f1e4; }
          .page { width: 1280px; min-height: 720px; padding: 48px; background: radial-gradient(circle at top right, rgba(198, 153, 79, 0.16), transparent 34%), linear-gradient(135deg, #121212 0%, #060606 100%); }
          .hero { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 28px; align-items: stretch; }
          .hero-main img, .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .hero-main { min-height: 420px; overflow: hidden; border-radius: 28px; border: 1px solid rgba(214, 176, 96, 0.22); }
          .meta { display: flex; flex-direction: column; justify-content: space-between; gap: 24px; padding: 28px; border-radius: 28px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); backdrop-filter: blur(14px); }
          .eyebrow { font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; color: #d6b060; }
          h1 { margin: 10px 0 12px; font-size: 46px; line-height: 1.05; }
          .price { font-size: 28px; color: #f0c978; }
          .address { font-size: 15px; color: rgba(247, 241, 228, 0.72); }
          .description { margin-top: 28px; display: grid; grid-template-columns: 0.95fr 1.05fr; gap: 28px; }
          .card { padding: 24px; border-radius: 24px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); }
          .card p { margin: 0 0 10px; font-size: 15px; line-height: 1.65; color: rgba(247, 241, 228, 0.84); }
          .specs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
          .spec { padding: 14px 16px; border-radius: 18px; background: rgba(214, 176, 96, 0.08); }
          .spec-label { display: block; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(247, 241, 228, 0.54); }
          .spec-value { display: block; margin-top: 6px; font-size: 16px; }
          .gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 28px; }
          .photo.landscape { height: 156px; overflow: hidden; border-radius: 18px; }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="hero">
            <div class="hero-main">${photoDataUrls[0] ? `<img src="${photoDataUrls[0]}" alt="Main photo" />` : ''}</div>
            <div class="meta">
              <div>
                <div class="eyebrow">Xatosfera Collection</div>
                <h1>${escapeHtml(title)}</h1>
                <div class="price">${escapeHtml(price)}</div>
              </div>
              <div>
                ${address ? `<div class="address">${escapeHtml(address)}</div>` : ''}
                ${renderSpecs(specs)}
              </div>
            </div>
          </section>
          <section class="description">
            <div class="card"><div class="eyebrow">Description</div>${toParagraphs(description)}</div>
            <div class="card"><div class="eyebrow">Notes</div>${toParagraphs(notes || ' ')}</div>
          </section>
          ${photoDataUrls.length > 1 ? `<section class="gallery">${renderPhotos(photoDataUrls.slice(1, 7), 'landscape')}</section>` : ''}
        </main>
      </body>
    </html>
  `;
}

function buildEditorialHtml(data: PresentationHtmlData): string {
  const { title, price, description, notes = '', address = '', photoDataUrls, specs = [] } = data;

  return `
    <!DOCTYPE html>
    <html lang="uk">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; background: #f3ede1; color: #181512; }
          .page { width: 1280px; min-height: 720px; padding: 36px; background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(243,237,225,0.94)), #f3ede1; }
          .layout { display: grid; grid-template-columns: 0.86fr 1.14fr; gap: 24px; }
          .sidebar { padding: 28px; border: 1px solid rgba(24, 21, 18, 0.08); background: rgba(255, 255, 255, 0.54); min-height: 648px; }
          .kicker { font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; color: #8a6b3f; }
          h1 { margin: 14px 0; font-size: 54px; line-height: 0.96; font-weight: 600; }
          .price { margin-bottom: 20px; font-size: 30px; }
          .copy p { margin: 0 0 12px; font-size: 15px; line-height: 1.7; color: rgba(24, 21, 18, 0.84); }
          .specs { margin-top: 24px; display: grid; gap: 10px; }
          .spec { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(24, 21, 18, 0.12); }
          .spec-label { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(24, 21, 18, 0.48); }
          .spec-value { font-size: 15px; text-align: right; }
          .content { display: grid; grid-template-rows: 1.15fr 0.85fr; gap: 18px; }
          .hero, .photo { overflow: hidden; border-radius: 22px; }
          .hero img, .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .hero { min-height: 408px; }
          .gallery { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
          .photo.square { aspect-ratio: 1 / 1; }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="layout">
            <aside class="sidebar">
              <div class="kicker">Editorial Selection</div>
              <h1>${escapeHtml(title)}</h1>
              <div class="price">${escapeHtml(price)}</div>
              ${address ? `<p>${escapeHtml(address)}</p>` : ''}
              <div class="copy">${toParagraphs(description)}</div>
              ${notes ? `<div class="copy">${toParagraphs(notes)}</div>` : ''}
              ${renderSpecs(specs)}
            </aside>
            <section class="content">
              <div class="hero">${photoDataUrls[0] ? `<img src="${photoDataUrls[0]}" alt="Main photo" />` : ''}</div>
              <div class="gallery">${renderPhotos(photoDataUrls.slice(1, 5), 'square')}</div>
            </section>
          </section>
        </main>
      </body>
    </html>
  `;
}

function buildMinimalHtml(data: PresentationHtmlData): string {
  const { title, price, description, notes = '', address = '', photoDataUrls, specs = [] } = data;

  return `
    <!DOCTYPE html>
    <html lang="uk">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; background: #ffffff; color: #111111; }
          .page { width: 1280px; min-height: 720px; padding: 40px; }
          .top { display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 24px; align-items: center; }
          .hero { min-height: 420px; border-radius: 24px; overflow: hidden; background: #f1f1f1; }
          .hero img, .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .eyebrow { font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; color: #9a7b42; }
          h1 { margin: 16px 0 10px; font-size: 52px; line-height: 1; }
          .price { font-size: 28px; }
          .address { margin-top: 10px; font-size: 15px; color: #6a6a6a; }
          .body { display: grid; grid-template-columns: 1fr 320px; gap: 24px; margin-top: 28px; }
          .copy p { margin: 0 0 12px; font-size: 15px; line-height: 1.72; color: #2e2e2e; }
          .specs { display: grid; gap: 12px; }
          .spec { padding: 14px 16px; border: 1px solid #ece6d9; border-radius: 16px; background: #fbf8f1; }
          .spec-label { display: block; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #8d7b5c; }
          .spec-value { display: block; margin-top: 6px; font-size: 16px; }
          .gallery { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 24px; }
          .photo.landscape { aspect-ratio: 1.35 / 1; border-radius: 18px; overflow: hidden; background: #f1f1f1; }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="top">
            <div class="hero">${photoDataUrls[0] ? `<img src="${photoDataUrls[0]}" alt="Main photo" />` : ''}</div>
            <div>
              <div class="eyebrow">Minimal Edition</div>
              <h1>${escapeHtml(title)}</h1>
              <div class="price">${escapeHtml(price)}</div>
              ${address ? `<div class="address">${escapeHtml(address)}</div>` : ''}
            </div>
          </section>
          <section class="body">
            <div class="copy">${toParagraphs(description)}${notes ? toParagraphs(notes) : ''}</div>
            ${renderSpecs(specs)}
          </section>
          ${photoDataUrls.length > 1 ? `<section class="gallery">${renderPhotos(photoDataUrls.slice(1, 9), 'landscape')}</section>` : ''}
        </main>
      </body>
    </html>
  `;
}

export function getPresentationHtml(
  templateType: PresentationTemplate,
  data: PresentationHtmlData,
): string {
  switch (templateType) {
    case 'editorial':
      return buildEditorialHtml(data);
    case 'minimal':
      return buildMinimalHtml(data);
    case 'classic':
    default:
      return buildClassicHtml(data);
  }
}
