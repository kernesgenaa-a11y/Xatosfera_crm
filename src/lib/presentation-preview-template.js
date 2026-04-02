export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

const PAGE_WIDTH = `${PAGE_WIDTH_MM}mm`;
const PAGE_HEIGHT = `${PAGE_HEIGHT_MM}mm`;
const AGENCY_LABEL = '\u0410\u0433\u0435\u043d\u0446\u0456\u044f \u041d\u0435\u0440\u0443\u0445\u043e\u043c\u043e\u0441\u0442\u0456';
const CITY_LABEL = '\u041a\u0440\u043e\u043f\u0438\u0432\u043d\u0438\u0446\u044c\u043a\u0438\u0439';
const CITY_PREFIX_LABEL = '\u043c. \u041a\u0440\u043e\u043f\u0438\u0432\u043d\u0438\u0446\u044c\u043a\u0438\u0439';
const SPECS_TITLE = '\u0425\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0438';
const DESCRIPTION_TITLE = '\u041e\u043f\u0438\u0441';
const GALLERY_TITLE = '\u0413\u0430\u043b\u0435\u0440\u0435\u044f';
const AGENT_LABEL = '\u0410\u0433\u0435\u043d\u0442 \u043d\u0435\u0440\u0443\u0445\u043e\u043c\u043e\u0441\u0442\u0456';
const FALLBACK_SITE = 'hatosfera-crm.pp.ua';
const EM_DASH = '&mdash;';

/**
 * @typedef {[string, string | number]} PresentationSpecEntry
 */

/**
 * @param {{
 *   template: 'classic' | 'editorial' | 'minimal',
 *   isPreview: boolean,
 *   logoHtml: string,
 *   opLabel: string,
 *   catLabel: string,
 *   price: string,
 *   pricePerSqm: string,
 *   address: string,
 *   displayTitle: string,
 *   displayDesc: string | null,
 *   photoDataUrls: string[],
 *   photoGrid: string,
 *   specs: PresentationSpecEntry[],
 *   specsRows: string,
 *   classicDetailsGrid: string,
 *   manager: { full_name?: string | null, phone?: string | null } | null,
 *   managerBlock: string,
 *   tagsHtml: string,
 * }} input
 */
export function buildPropertyPresentationHtml(input) {
  const {
    template,
    isPreview,
    logoHtml,
    opLabel,
    catLabel,
    price,
    pricePerSqm,
    address,
    displayTitle,
    displayDesc,
    photoDataUrls,
    photoGrid,
    specs,
    specsRows,
    classicDetailsGrid,
    manager,
    managerBlock,
    tagsHtml,
  } = input;
  const previewBodyClass = isPreview ? 'preview-mode' : '';

  const classicHtml = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1a1a2e; width: ${PAGE_WIDTH}; min-height: ${PAGE_HEIGHT}; }
  .page { width: ${PAGE_WIDTH}; min-height: ${PAGE_HEIGHT}; padding: 12mm 14mm; display: flex; flex-direction: column; }

  .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 3px solid #1a1a2e; margin-bottom: 14px; }
  .logo-block { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #1a1a2e 0%, #4a4a8a 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; font-weight: 900; letter-spacing: -1px; }
  .logo-text h1 { font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #1a1a2e; }
  .logo-text p { font-size: 9px; color: #666; letter-spacing: 1px; text-transform: uppercase; }
  .header-badge { background: linear-gradient(135deg, #1a1a2e, #4a4a8a); color: white; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }

  .title-section { margin-bottom: 12px; }
  .operation-badge { display: inline-block; background: #f0f0ff; color: #1a1a2e; border: 1px solid #c0c0ff; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .property-title { font-size: 20px; font-weight: 700; line-height: 1.3; color: #1a1a2e; margin-bottom: 4px; }
  .property-address { font-size: 12px; color: #555; }

  .price-section { display: flex; align-items: baseline; gap: 14px; margin: 10px 0; padding: 10px 16px; background: linear-gradient(135deg, #1a1a2e08, #4a4a8a08); border-left: 4px solid #1a1a2e; border-radius: 0 8px 8px 0; }
  .price-main { font-size: 26px; font-weight: 800; color: #1a1a2e; }
  .price-sqm { font-size: 13px; color: #777; font-weight: 500; }

  .photo-grid { display: grid; gap: 4px; margin: 12px 0; border-radius: 8px; overflow: hidden; }
  .photo-grid.photos-1 { grid-template-columns: 1fr; height: 200px; }
  .photo-grid.photos-2 { grid-template-columns: 1fr 1fr; height: 160px; }
  .photo-grid.photos-3 { grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; height: 180px; }
  .photo-grid.photos-4 { grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; height: 180px; }
  .photo-grid.photos-5, .photo-grid.photos-6 { grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; height: 180px; }
  .photo-cell { overflow: hidden; }
  .photo-cell.photo-main { grid-row: 1 / 3; }
  .photo-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .no-photo { height: 120px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #aaa; font-size: 13px; margin: 12px 0; }

  .specs-title { font-size: 13px; font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; margin: 10px 0 6px; }
  .specs-table { width: 100%; border-collapse: collapse; }
  .specs-table tr { border-bottom: 1px solid #f0f0f0; }
  .specs-table tr:last-child { border-bottom: none; }
  .spec-key { padding: 5px 8px 5px 0; font-size: 11px; color: #888; font-weight: 500; width: 44%; }
  .spec-val { padding: 5px 0; font-size: 12px; color: #1a1a2e; font-weight: 600; }

  .description-block { margin-top: 10px; }
  .description-block p { font-size: 11.5px; line-height: 1.6; color: #444; }

  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .tag { background: #f0f0ff; color: #4a4a8a; border: 1px solid #d0d0ff; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }

  .footer { margin-top: auto; padding-top: 10px; border-top: 2px solid #1a1a2e; display: flex; justify-content: space-between; align-items: center; }
  .manager-block { display: flex; align-items: center; gap: 10px; }
  .manager-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #1a1a2e, #4a4a8a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .manager-info .manager-name { font-size: 12px; font-weight: 700; color: #1a1a2e; }
  .manager-info .manager-phone { font-size: 11px; color: #555; margin-top: 1px; }
  .footer-logo { text-align: right; }
  .footer-logo .agency { font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #1a1a2e; }
  .footer-logo .city { font-size: 9px; color: #888; letter-spacing: 0.5px; }

  body.preview-mode { width: 100%; min-height: 100vh; overflow-x: hidden; }
  body.preview-mode .page { width: 100%; min-height: auto; padding: 16px; gap: 12px; }
  body.preview-mode .header { gap: 10px; margin-bottom: 10px; }
  body.preview-mode .header-badge { display: none; }
  body.preview-mode .logo-text h1 { font-size: 18px; letter-spacing: 1.2px; }
  body.preview-mode .logo-text p { font-size: 8px; }
  body.preview-mode .property-title { font-size: 30px; line-height: 1.15; }
  body.preview-mode .property-address { font-size: 13px; }
  body.preview-mode .price-section { margin: 4px 0 8px; padding: 12px 14px; }
  body.preview-mode .price-main { font-size: 34px; }
  body.preview-mode .price-sqm { font-size: 13px; }
  body.preview-mode .photo-grid.photos-1,
  body.preview-mode .photo-grid.photos-2,
  body.preview-mode .photo-grid.photos-3,
  body.preview-mode .photo-grid.photos-4,
  body.preview-mode .photo-grid.photos-5,
  body.preview-mode .photo-grid.photos-6 { grid-template-columns: 1fr; grid-template-rows: none; height: auto; }
  body.preview-mode .photo-cell,
  body.preview-mode .photo-cell.photo-main { grid-row: auto; min-height: 220px; }
  body.preview-mode .spec-key,
  body.preview-mode .spec-val { font-size: 12px; }
  body.preview-mode .description-block p { font-size: 13px; }
  body.preview-mode .footer { margin-top: 8px; gap: 12px; align-items: flex-start; }
</style>
</head>
<body class="${previewBodyClass}">
<div class="page">
  <div class="header">
    <div class="logo-block">
      ${logoHtml}
      <div class="logo-text">
        <h1>ANGELS</h1>
        <p>${AGENCY_LABEL}</p>
      </div>
    </div>
    <div class="header-badge">${opLabel} &middot; ${catLabel}</div>
  </div>

  <div class="title-section">
    <div class="operation-badge">${opLabel}</div>
    <div class="property-title">${displayTitle}</div>
    ${address ? `<div class="property-address">&#128205; ${address}, ${CITY_PREFIX_LABEL}</div>` : ''}
  </div>

  <div class="price-section">
    <div class="price-main">${price}</div>
    ${pricePerSqm ? `<div class="price-sqm">${pricePerSqm}</div>` : ''}
  </div>

  ${photoGrid}

  <div style="display:grid;grid-template-columns:${classicDetailsGrid};gap:20px;margin-top:4px;">
    ${specs.length ? `
    <div>
      <div class="specs-title">${SPECS_TITLE}</div>
      <table class="specs-table"><tbody>${specsRows}</tbody></table>
    </div>` : ''}
    ${displayDesc ? `
    <div class="description-block">
      <div class="specs-title">${DESCRIPTION_TITLE}</div>
      <p>${displayDesc}</p>
    </div>` : ''}
  </div>

  ${tagsHtml}

  <div class="footer">
    ${managerBlock}
    <div class="footer-logo">
      <div class="agency">ANGELS</div>
      <div class="city">${CITY_LABEL}</div>
    </div>
  </div>
</div>
</body>
</html>`;

  const editorialHtml = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #f5f0e8; color: #1f2937; width: ${PAGE_WIDTH}; min-height: ${PAGE_HEIGHT}; }
  .page { width: ${PAGE_WIDTH}; min-height: ${PAGE_HEIGHT}; padding: 16mm; display: flex; flex-direction: column; gap: 10mm; }
  .hero { display: grid; grid-template-columns: 1.5fr 1fr; gap: 10mm; align-items: stretch; }
  .hero-image { min-height: 110mm; border-radius: 12px; overflow: hidden; background: #ddd; }
  .hero-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hero-copy { background: #18212b; color: #f8fafc; border-radius: 12px; padding: 10mm; display: flex; flex-direction: column; justify-content: space-between; }
  .eyebrow { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #d4b483; }
  .title { font-size: 28px; line-height: 1.15; font-weight: 700; margin-top: 6mm; }
  .price { font-size: 24px; font-weight: 700; color: #f4d19b; margin-top: 4mm; }
  .address { font-size: 12px; color: #d1d5db; margin-top: 4mm; }
  .section { background: rgba(255,255,255,0.78); border: 1px solid #ddd6c8; border-radius: 12px; padding: 8mm; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .section-title { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #6b7280; margin-bottom: 4mm; }
  .spec { display: flex; justify-content: space-between; gap: 4mm; padding: 2.5mm 0; border-bottom: 1px solid #ece7df; font-size: 12px; }
  .spec:last-child { border-bottom: none; }
  .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .gallery-item { height: 45mm; border-radius: 10px; overflow: hidden; background: #ddd; }
  .gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #d6c7b0; padding-top: 5mm; font-size: 11px; color: #4b5563; }

  body.preview-mode { width: 100%; min-height: 100vh; overflow-x: hidden; }
  body.preview-mode .page { width: 100%; min-height: auto; padding: 16px; gap: 14px; }
  body.preview-mode .hero,
  body.preview-mode .grid { grid-template-columns: 1fr; gap: 14px; }
  body.preview-mode .hero-image { min-height: 240px; }
  body.preview-mode .title { font-size: 32px; line-height: 1.1; }
  body.preview-mode .price { font-size: 30px; }
  body.preview-mode .section { padding: 14px; }
  body.preview-mode .gallery { grid-template-columns: 1fr; }
  body.preview-mode .gallery-item { height: 200px; }
  body.preview-mode .footer { margin-top: 4px; gap: 10px; align-items: flex-start; }
</style>
</head>
<body class="${previewBodyClass}">
  <div class="page">
    <div class="hero">
      <div class="hero-image">${photoDataUrls[0] ? `<img src="${photoDataUrls[0]}" alt="${'\u0424\u043e\u0442\u043e'} 1" />` : ''}</div>
      <div class="hero-copy">
        <div>
          <div class="eyebrow">${opLabel} / ${catLabel}</div>
          <div class="title">${displayTitle}</div>
          <div class="price">${price}</div>
          ${address ? `<div class="address">${address}</div>` : ''}
        </div>
        <div>
          ${pricePerSqm ? `<div class="eyebrow">${pricePerSqm}</div>` : ''}
          <div class="address">${manager?.full_name || 'ANGELS'}</div>
          ${manager?.phone ? `<div class="address">${manager.phone}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="grid">
      <div class="section">
        <div class="section-title">${SPECS_TITLE}</div>
        ${specsRows.replace(/<tr><td class="spec-key">/g, '<div class="spec"><span>').replace(/<\/td><td class="spec-val">/g, '</span><strong>').replace(/<\/td><\/tr>/g, '</strong></div>')}
      </div>
      <div class="section">
        <div class="section-title">${DESCRIPTION_TITLE}</div>
        <div style="font-size:12px;line-height:1.7;color:#374151;">${displayDesc || EM_DASH}</div>

      </div>
    </div>
    ${photoDataUrls.length > 1 ? `<div class="section"><div class="section-title">${GALLERY_TITLE}</div><div class="gallery">${photoDataUrls.slice(1, 4).map((src, i) => `<div class="gallery-item"><img src="${src}" alt="${'\u0424\u043e\u0442\u043e'} ${i + 2}" /></div>`).join('')}</div></div>` : ''}
    ${tagsHtml}
    <div class="footer">
      <div>ANGELS</div>
      <div>${manager?.full_name || AGENT_LABEL}</div>
    </div>
  </div>
</body>
</html>`;

  const minimalHtml = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, Arial, sans-serif; background: #ffffff; color: #111827; width: ${PAGE_WIDTH}; min-height: ${PAGE_HEIGHT}; }
  .page { width: ${PAGE_WIDTH}; min-height: ${PAGE_HEIGHT}; padding: 14mm; display: flex; flex-direction: column; gap: 7mm; }
  .top { display: flex; justify-content: space-between; gap: 8mm; border-bottom: 2px solid #111827; padding-bottom: 4mm; }
  .title { font-size: 24px; font-weight: 800; line-height: 1.15; }
  .meta { font-size: 11px; color: #6b7280; margin-top: 3mm; }
  .price { font-size: 22px; font-weight: 800; text-align: right; }
  .hero { height: 92mm; border-radius: 10px; overflow: hidden; background: #f3f4f6; }
  .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .content { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 7mm; }
  .block { border: 1px solid #e5e7eb; border-radius: 10px; padding: 6mm; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.4px; color: #6b7280; margin-bottom: 3mm; }
  .spec { display: grid; grid-template-columns: 1fr auto; gap: 4mm; padding: 2.2mm 0; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
  .spec:last-child { border-bottom: none; }
  .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .gallery div { height: 36mm; border-radius: 8px; overflow: hidden; background: #f3f4f6; }
  .gallery img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .footer { margin-top: auto; display: flex; justify-content: space-between; font-size: 11px; color: #4b5563; border-top: 1px solid #e5e7eb; padding-top: 4mm; }

  body.preview-mode { width: 100%; min-height: 100vh; overflow-x: hidden; }
  body.preview-mode .page { width: 100%; min-height: auto; padding: 16px; gap: 14px; }
  body.preview-mode .top,
  body.preview-mode .content { display: grid; grid-template-columns: 1fr; gap: 14px; }
  body.preview-mode .title { font-size: 30px; }
  body.preview-mode .price { font-size: 30px; text-align: left; }
  body.preview-mode .meta { font-size: 12px; }
  body.preview-mode .hero { height: 240px; }
  body.preview-mode .block { padding: 14px; }
  body.preview-mode .gallery { grid-template-columns: 1fr; }
  body.preview-mode .gallery div { height: 200px; }
  body.preview-mode .footer { margin-top: 4px; gap: 10px; flex-direction: column; }
</style>
</head>
<body class="${previewBodyClass}">
  <div class="page">
    <div class="top">
      <div>
        <div class="title">${displayTitle}</div>
        <div class="meta">${opLabel} / ${catLabel}</div>
        ${address ? `<div class="meta">${address}</div>` : ''}
      </div>
      <div>
        <div class="price">${price}</div>
        ${pricePerSqm ? `<div class="meta" style="text-align:right;">${pricePerSqm}</div>` : ''}
      </div>
    </div>
    <div class="hero">${photoDataUrls[0] ? `<img src="${photoDataUrls[0]}" alt="${'\u0424\u043e\u0442\u043e'} 1" />` : ''}</div>
    <div class="content">
      <div class="block">
        <div class="label">${DESCRIPTION_TITLE}</div>
        <div style="font-size:12px;line-height:1.7;color:#374151;">${displayDesc || EM_DASH}</div>

      </div>
      <div class="block">
        <div class="label">${SPECS_TITLE}</div>
        ${specs.map(([key, value]) => `<div class="spec"><span>${key}</span><strong>${value}</strong></div>`).join('')}
      </div>
    </div>
    ${photoDataUrls.length > 1 ? `<div class="block"><div class="label">${'\u0424\u043e\u0442\u043e'}</div><div class="gallery">${photoDataUrls.slice(1, 5).map((src, i) => `<div><img src="${src}" alt="${'\u0424\u043e\u0442\u043e'} ${i + 2}" /></div>`).join('')}</div></div>` : ''}
    <div class="footer">
      <div>${manager?.full_name || 'ANGELS'}</div>
      <div>${manager?.phone || FALLBACK_SITE}</div>
    </div>
  </div>
</body>
</html>`;

  return template === 'editorial'
    ? editorialHtml
    : template === 'minimal'
      ? minimalHtml
      : classicHtml;
}

