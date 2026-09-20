// Renders the one-page hotel demo site as an HTML string for a given config + language.
// Pure function of (config, lang) -> string. No hotel-specific logic lives here;
// everything comes from the config object.

const STRINGS = {
  en: {
    dir: "ltr",
    lang: "en",
    skipToContent: "Skip to content",
    navHome: "Le Blanc Bleu",
    switchLang: "العربية",
    ratingSuffix: "on Google",
    reviewsHeading: "What guests say",
    footerFollow: "Follow along",
    footerContact: "Contact",
    footerAddress: "Address",
    footerDirections: "Get directions",
    callLabel: "Call",
    whatsappLabel: "WhatsApp",
    reducedMotionNote: "",
    demoBannerClose: "Dismiss"
  },
  ar: {
    dir: "rtl",
    lang: "ar",
    skipToContent: "الانتقال إلى المحتوى",
    navHome: "لو بلان بلو",
    switchLang: "English",
    ratingSuffix: "على غوغل",
    reviewsHeading: "ماذا يقول ضيوفنا",
    footerFollow: "تابعونا",
    footerContact: "تواصل معنا",
    footerAddress: "العنوان",
    footerDirections: "احصل على الاتجاهات",
    callLabel: "اتصال",
    whatsappLabel: "واتساب",
    reducedMotionNote: "",
    demoBannerClose: "إغلاق"
  }
};

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2p(text) {
  return text
    .split("\n")
    .map((line) => esc(line))
    .join("<br>");
}

function pictureSources(photo, sizes) {
  const byFormat = { avif: [], webp: [] };
  for (const v of photo.variants) byFormat[v.format].push(v);
  const srcset = (fmt) =>
    byFormat[fmt]
      .sort((a, b) => a.width - b.width)
      .map((v) => `media/${v.file} ${v.width}w`)
      .join(", ");
  const largestWebp = byFormat.webp.sort((a, b) => b.width - a.width)[0];
  return `
    <picture>
      <source type="image/avif" srcset="${srcset("avif")}" sizes="${sizes}">
      <source type="image/webp" srcset="${srcset("webp")}" sizes="${sizes}">
      <img src="media/${largestWebp.file}" alt="" width="${photo.sourceWidth}" height="${photo.sourceHeight}" loading="lazy" decoding="async">
    </picture>`;
}

function altFor(photo, lang) {
  return esc(photo.alt?.[lang] || "");
}

function pictureWithAlt(photo, lang, sizes) {
  return pictureSources(photo, sizes).replace('alt=""', `alt="${altFor(photo, lang)}"`);
}

export function renderPage({ config, lang, photos, canonicalBase, siteUrl }) {
  const t = STRINGS[lang];
  const other = lang === "en" ? "ar" : "en";
  const up = lang === "en" ? ".." : "../..";
  const S = config.sections;
  const waMsg = encodeURIComponent(config.contact.whatsappMessage[lang]);
  const waHref = `https://wa.me/${config.contact.whatsapp}?text=${waMsg}`;
  const telHref = `tel:${config.contact.phoneTel}`;
  const demoWaHref = `https://wa.me/${config.demoBanner.whatsapp}`;
  const pagePath = lang === "en" ? `${config.slug}/` : `${config.slug}/ar/`;
  const canonical = `${canonicalBase}/${pagePath}`;
  const altPath = lang === "en" ? `${config.slug}/ar/` : `${config.slug}/`;
  const ogImage = `${canonicalBase}/${config.slug}/media/og.jpg`;

  const heroPhoto = photos.find((p) => p.id === "1-3") || photos[0];
  const aboutPhotos = photos.filter((p) => ["1-3", "1"].includes(p.id));
  const stayPhotos = photos.filter((p) => ["bg2019new", "1-2"].includes(p.id));
  const galleryRest = photos.filter((p) => ["1-4", "bg20193", "2"].includes(p.id));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: config.name,
    url: `${canonicalBase}/${config.slug}/`,
    telephone: config.contact.phoneTel,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address.en,
      addressCountry: "LB"
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: config.geo.lat,
      longitude: config.geo.lng
    },
    sameAs: [config.social.instagram, config.social.facebook]
  };

  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}" data-demo="${config.demo}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.name)} — ${esc(config.tagline[lang])}</title>
<meta name="description" content="${esc(config.metaDescription[lang])}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="en" href="${canonicalBase}/${config.slug}/">
<link rel="alternate" hreflang="ar" href="${canonicalBase}/${config.slug}/ar/">
<link rel="alternate" hreflang="x-default" href="${canonicalBase}/${config.slug}/">
${config.demo ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta name="theme-color" content="${config.themeColor}">

<meta property="og:type" content="website">
<meta property="og:title" content="${esc(config.name)} — ${esc(config.tagline[lang])}">
<meta property="og:description" content="${esc(config.metaDescription[lang])}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:locale" content="${lang === "en" ? "en_US" : "ar_LB"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(config.name)}">
<meta name="twitter:description" content="${esc(config.metaDescription[lang])}">
<meta name="twitter:image" content="${ogImage}">

<link rel="icon" href="${up}/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${up}/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="${up}/apple-touch-icon.png">

<link rel="preload" as="font" type="font/woff2" href="${up}/fonts/fraunces-latin-600-normal.woff2" crossorigin>
<style>${CRITICAL_CSS(lang)}</style>
<link rel="stylesheet" href="${up}/main.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<a class="skip-link" href="#main">${t.skipToContent}</a>

<div class="demo-banner" id="demo-banner" role="note">
  <p>${esc(config.demoBanner[lang])} <a href="${demoWaHref}" target="_blank" rel="noopener">WhatsApp</a></p>
  <button type="button" id="demo-banner-close" aria-label="${t.demoBannerClose}">&times;</button>
</div>

<header class="site-header">
  <div class="wrap site-header__row">
    <a class="brand" href="#top">
      <img src="${up}/assets/logo-mark.svg" alt="" width="34" height="40" class="brand__mark">
      <span class="brand__name">${esc(t.navHome)}</span>
    </a>
    <a class="lang-switch" href="${lang === "en" ? "ar/" : "../"}" hreflang="${other}">${t.switchLang}</a>
  </div>
</header>

<main id="main">
<section class="hero" id="top">
  <div class="hero__media" data-parallax-layer="slow">
    <video
      id="hero-video"
      class="hero__video"
      autoplay muted loop playsinline preload="metadata"
      poster="media/poster.jpg">
      <source src="media/hero-1080.webm" type="video/webm" media="(min-width:701px)">
      <source src="media/hero-1080.mp4" type="video/mp4" media="(min-width:701px)">
      <source src="media/hero-720.mp4" type="video/mp4">
    </video>
    <img class="hero__poster" src="media/poster.jpg" alt="" hidden>
    <div class="hero__scrim"></div>
  </div>
  <div class="hero__content wrap" data-parallax-layer="medium">
    <p class="eyebrow">${esc(S.hero[lang].eyebrow)}</p>
    <h1 class="hero__title">${esc(S.hero[lang].headline)}</h1>
    <p class="hero__sub">${esc(S.hero[lang].sub)}</p>
    <div class="cta-row">
      <a class="btn btn--primary" href="${waHref}" target="_blank" rel="noopener">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.44 1.33 4.93L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm0 18.2h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.26-8.25 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.84c0 4.55-3.7 8.23-8.25 8.23Zm4.53-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.36-.77-1.86-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.23.89 2.42 1.02 2.58.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z"/></svg>
        ${esc(config.cta.primary[lang])}
      </a>
      <a class="btn btn--ghost" href="${telHref}">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/></svg>
        ${esc(config.cta.secondary[lang])}
      </a>
    </div>
  </div>
  <div class="hero__foreground" data-parallax-layer="fast" aria-hidden="true">
    <img src="${up}/assets/arch-foreground.svg" alt="">
  </div>
</section>

<section class="section about" id="about">
  <div class="wrap section-grid">
    <div class="section-copy">
      <p class="eyebrow">${lang === "en" ? "About" : "من نحن"}</p>
      <h2>${esc(S.about[lang].heading)}</h2>
      <p>${esc(S.about[lang].body)}</p>
    </div>
    <div class="section-media depth-media">
      ${aboutPhotos.map((p, i) => `<div class="arch-frame arch-frame--${i === 0 ? "lead" : "sub"}" data-depth="${i === 0 ? "1" : "2"}">${pictureWithAlt(p, lang, "(max-width:700px) 90vw, 480px")}</div>`).join("")}
    </div>
  </div>
</section>

<section class="section stay" id="stay">
  <div class="wrap">
    <p class="eyebrow">${lang === "en" ? "Services" : "الخدمات"}</p>
    <h2>${esc(S.stay[lang].heading)}</h2>
    <div class="stay-grid">
      ${S.stay[lang].items
        .map(
          (item) => `
      <div class="stay-card">
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.body)}</p>
      </div>`
        )
        .join("")}
    </div>
    <div class="stay-media">
      ${stayPhotos.map((p) => `<div class="arch-frame arch-frame--wide">${pictureWithAlt(p, lang, "(max-width:700px) 90vw, 560px")}</div>`).join("")}
    </div>
  </div>
</section>

<section class="section gallery" id="gallery">
  <div class="wrap gallery-strip">
    ${galleryRest.map((p) => `<div class="arch-frame arch-frame--gallery">${pictureWithAlt(p, lang, "(max-width:700px) 60vw, 340px")}</div>`).join("")}
  </div>
</section>

<section class="section reviews" id="reviews">
  <div class="wrap">
    <p class="eyebrow">${t.reviewsHeading}</p>
    <div class="rating-line">
      <span class="rating-stars" aria-hidden="true">★★★★★</span>
      <strong>${config.rating.value}</strong>
      <span>(${config.rating.count}) ${t.ratingSuffix}</span>
    </div>
    <div class="review-grid">
      ${config.reviews
        .map(
          (r) => `
      <blockquote class="review-card">
        <p>${nl2p(r.text)}</p>
        <cite>— ${esc(r.attribution[lang])}</cite>
      </blockquote>`
        )
        .join("")}
    </div>
  </div>
</section>

<section class="section season" id="season">
  <div class="wrap season-inner">
    <h2>${esc(S.season[lang].heading)}</h2>
    <p>${esc(S.season[lang].body)}</p>
  </div>
</section>

<section class="section location" id="location">
  <div class="wrap section-grid">
    <div class="section-copy">
      <p class="eyebrow">${lang === "en" ? "Location" : "الموقع"}</p>
      <h2>${esc(S.location[lang].heading)}</h2>
      <p>${esc(S.location[lang].body)}</p>
      <a class="btn btn--outline" href="${esc(config.directionsUrl)}" target="_blank" rel="noopener">${esc(config.address[lang])} ↗</a>
    </div>
    <div class="section-media">
      ${coastlineSvg()}
    </div>
  </div>
</section>

<section class="section book-direct" id="book">
  <div class="wrap book-direct__inner">
    <h2>${esc(S.bookDirect[lang].heading)}</h2>
    <p>${esc(S.bookDirect[lang].body)}</p>
    <div class="cta-row cta-row--center">
      <a class="btn btn--primary btn--large" href="${waHref}" target="_blank" rel="noopener">${esc(config.cta.primary[lang])}</a>
      <a class="btn btn--ghost btn--large" href="${telHref}">${esc(config.cta.secondary[lang])} · ${esc(config.contact.phoneDisplay)}</a>
    </div>
  </div>
</section>
</main>

<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <img src="${up}/assets/logo-mark.svg" alt="" width="34" height="40">
      <p class="footer-name">${esc(config.name)}</p>
    </div>
    <div>
      <h3>${t.footerContact}</h3>
      <p><a href="${telHref}">${esc(config.contact.phoneDisplay)}</a></p>
      <p><a href="${waHref}" target="_blank" rel="noopener">${t.whatsappLabel}</a></p>
    </div>
    <div>
      <h3>${t.footerAddress}</h3>
      <p><a href="${esc(config.directionsUrl)}" target="_blank" rel="noopener">${esc(config.address[lang])}</a></p>
    </div>
    <div>
      <h3>${t.footerFollow}</h3>
      <p><a href="${esc(config.social.instagram)}" target="_blank" rel="noopener">Instagram</a></p>
      <p><a href="${esc(config.social.facebook)}" target="_blank" rel="noopener">Facebook</a></p>
    </div>
  </div>
  <div class="wrap footer-fine">
    <p>${esc(config.footer.disclaimer[lang])}</p>
    <p>© ${new Date().getFullYear()} ${esc(config.name)}</p>
  </div>
</footer>

<script src="${up}/main.js" defer></script>
</body>
</html>`;
}

function coastlineSvg() {
  return `
  <svg class="coastline-illustration" viewBox="0 0 480 360" role="img" aria-label="Map illustration of the coastline near Halat, Jbeil">
    <rect width="480" height="360" fill="#DDEAF2"/>
    <path d="M0 210 C 60 190, 120 230, 190 200 C 260 170, 300 220, 360 205 C 410 193, 440 215, 480 200 L480 360 L0 360 Z" fill="#F7F6F2"/>
    <path d="M0 225 C 60 205, 120 245, 190 215 C 260 185, 300 235, 360 220 C 410 208, 440 230, 480 215" fill="none" stroke="#3E7CB1" stroke-width="3"/>
    <circle cx="330" cy="196" r="9" fill="#E3924F"/>
    <circle cx="330" cy="196" r="16" fill="none" stroke="#E3924F" stroke-width="2" opacity="0.5"/>
    <path d="M60 90 q10 -18 20 0 M110 100 q10 -18 20 0 M400 90 q10 -18 20 0" stroke="#1F5C8C" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>
  </svg>`;
}

function CRITICAL_CSS(lang) {
  return `
  html{background:#F7F6F2}
  body{margin:0;font-family:${lang === "ar" ? "'IBM Plex Sans Arabic'" : "'Figtree'"},sans-serif;color:#0E2A47}
  .hero{position:relative;min-height:100svh;overflow:hidden;display:flex;align-items:flex-end}
  `;
}
