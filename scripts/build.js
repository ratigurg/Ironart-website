// Static site build: data/*.json + src/ templates -> HTML pages (ka + en)
//   npm run build        (optimised images first, then pages)
//   npm run pages        (pages only)
//
// Generated (overwritten on every build; the build never deletes anything, it only warns about stale files):
//   index.html, en/index.html
//   namushevrebi/, en/work/          all work + category pages
//   photo/, en/photo/                one page per photo
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readJSON = f => JSON.parse(read(f));

const photos = readJSON('data/photos.json');
const cats = readJSON('data/categories.json');
const STR = readJSON('data/strings.json');
const meta = readJSON('data/image-meta.json');
const site = readJSON('data/site.json');

const LANGS = ['ka', 'en'];
const SITE = site.url.replace(/\/$/, '');
const absUrl = dir => SITE + '/' + dir + (dir ? '/' : '');
const ORG = { '@type': 'Organization', name: site.name, url: SITE + '/', telephone: site.phone };
const GENERATED = ['en', 'namushevrebi', 'photo'];

// ---------- helpers ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = n => String(n).padStart(2, '0');
const trunc = (s, n = 155) => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '') + '…';
};
const jsonForScript = o => JSON.stringify(o).replace(/</g, '\\u003c');

// Directory (relative to site root, no slashes at ends) of every page
const dirs = {
  home: l => (l === 'ka' ? '' : 'en'),
  work: l => (l === 'ka' ? 'namushevrebi' : 'en/work'),
  cat: (l, c) => (l === 'ka' ? `namushevrebi/${c.slug_ka}` : `en/work/${c.slug_en}`),
  photo: (l, p) => (l === 'ka' ? `photo/${p.slug_ka}` : `en/photo/${p.slug_en}`),
};
// relative URL between page directories ("" = site root); works on any host/sub-path
const href = (from, to) => {
  const r = path.posix.relative(from || '.', to || '.');
  return r === '' ? './' : r + '/';
};
const rootOf = dir => (dir ? '../'.repeat(dir.split('/').length) : '');

const catById = Object.fromEntries(cats.map(c => [c.id, c]));
const catName = (l, c) => (l === 'ka' ? c.name_ka : c.name_en);
const catSlug = (l, c) => (l === 'ka' ? c.slug_ka : c.slug_en);
const pTitle = (l, p) => (l === 'ka' ? p.title_ka : p.title_en);
const pDesc = (l, p) => (l === 'ka' ? p.desc_ka : p.desc_en);
const pSlug = (l, p) => (l === 'ka' ? p.slug_ka : p.slug_en);
const imgBase = p => 'img/ironart-' + p.slug_en;

const byCat = Object.fromEntries(cats.map(c => [c.id, photos.filter(p => p.category === c.id)]));
const photosInCatOrder = cats.flatMap(c => byCat[c.id]);
const byFile = Object.fromEntries(photos.map(p => [p.file, p]));

// ---------- templates ----------
const tpl = {
  header: read('src/partials/header.html'),
  mmenu: read('src/partials/mmenu.html'),
  footer: read('src/partials/footer.html'),
  mbar: read('src/partials/mbar.html'),
  home: read('src/home-main.html'),
};
const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
const ARROW_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>';

// Replace text of [data-i18n] elements / attributes from strings.json, drop the data-* hooks
function translate(html, lang) {
  const get = key => key.split('.').reduce((o, k) => (o == null ? o : o[k]), STR[lang]);
  const need = key => {
    const v = get(key);
    if (v == null) throw new Error(`Missing string "${key}" for ${lang}`);
    return v;
  };
  html = html.replace(/(<(\w+)[^>]*?) data-i18n="([^"]+)"([^>]*>)([^<]*)(<\/\2>)/g,
    (m, open, tag, key, rest, _old, close) => `${open}${rest}${esc(need(key))}${close}`);
  html = html.replace(/ data-i18n-alt="([^"]+)"/g, (m, key) => '');
  html = html.replace(/ data-i18n-aria="([^"]+)" aria-label="[^"]*"/g, (m, key) => ` aria-label="${esc(need(key))}"`);
  return html;
}
function fill(html, vars, lang) {
  return html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (k in vars) return vars[k];
    const v = STR[lang][k];
    if (typeof v === 'string') return esc(v);
    throw new Error(`Unresolved placeholder {{${k}}}`);
  });
}

// ---------- fragments ----------
function langSwitch(lang, dir, altDirs, hrefFn = href) {
  const a = l => `<a href="${l === lang ? '#' : hrefFn(dir, altDirs[l])}" hreflang="${l}" lang="${l}" aria-label="${l === 'ka' ? 'ქართული' : 'English'}"${l === lang ? ' aria-current="true"' : ''}>${l === 'ka' ? 'ქარ' : 'EN'}</a>`;
  return `<div class="lang" role="group" aria-label="${esc(STR[lang].langAria)}">\n    ${a('ka')}\n    ${a('en')}\n  </div>`;
}

function card(lang, dir, p, idx) {
  const base = rootOf(dir) + imgBase(p);
  const m = meta[p.slug_en];
  const t = esc(pTitle(lang, p));
  return `<a class="card" href="${href(dir, dirs.photo(lang, p))}">
  <div class="ph"><picture><source type="image/webp" srcset="${base}-thumb.webp"><img src="${base}-thumb.jpg" alt="${t}" width="${m.tw}" height="${m.th}" loading="lazy" decoding="async"></picture></div>
  <div class="cap"><span class="idx">${pad(idx)}</span><span class="t">${t}</span><span class="cnt">${esc(catName(lang, catById[p.category]))}</span></div>
</a>`;
}
const grid = (lang, dir, list) =>
  `<div class="grid">${list.map((p, i) => card(lang, dir, p, i + 1)).join('')}</div>`;

function ctaSection(lang, { photo = false } = {}) {
  // Same block as the home "contact" section; no map on inner pages
  let s = tpl.home.match(/<section id="contact"[\s\S]*?<\/section>/)[0];
  s = s.replace(/\s*<iframe[\s\S]*?<\/iframe>/, '').replace('<section id="contact" class', '<section class');
  if (photo) s = s.replace('data-i18n="ctaH"', 'data-i18n="ctaPhotoH"').replace('data-i18n="ctaP"', 'data-i18n="ctaPhotoP"');
  return translate(s, lang);
}

function crumbs(lang, dir, items) {
  const li = items.map(([label, to], i) =>
    i === items.length - 1
      ? `<li><span aria-current="page">${esc(label)}</span></li>`
      : `<li><a href="${href(dir, to)}">${esc(label)}</a></li>`).join('');
  return `<nav class="crumbs" aria-label="${esc(STR[lang].crumbLabel)}"><ol>${li}</ol></nav>`;
}

function filters(lang, dir, activeId) {
  const s = STR[lang];
  const link = (label, to, on) => `<a href="${href(dir, to)}"${on ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  return `<nav class="filters" aria-label="${esc(s.filterLabel)}">${link(s.all, dirs.work(lang), activeId === 'all')}${cats.map(c => link(catName(lang, c), dirs.cat(lang, c), activeId === c.id)).join('')}</nav>`;
}

// ---------- SEO ----------
const crumbLd = items => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, d], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absUrl(d) })),
});
function seoHead({ lang, dir, altDirs, title, description, og, ld, noindex }) {
  const out = [];
  if (noindex) {
    out.push('<meta name="robots" content="noindex">');
  } else {
    out.push(`<link rel="canonical" href="${absUrl(dir)}">`);
    out.push(`<link rel="alternate" hreflang="ka" href="${absUrl(altDirs.ka)}">`);
    out.push(`<link rel="alternate" hreflang="en" href="${absUrl(altDirs.en)}">`);
    out.push(`<link rel="alternate" hreflang="x-default" href="${absUrl(altDirs.ka)}">`);
    out.push('<meta property="og:type" content="website">');
    out.push(`<meta property="og:site_name" content="${esc(site.name)}">`);
    out.push(`<meta property="og:locale" content="${lang === 'ka' ? 'ka_GE' : 'en_US'}">`);
    out.push(`<meta property="og:locale:alternate" content="${lang === 'ka' ? 'en_US' : 'ka_GE'}">`);
    out.push(`<meta property="og:title" content="${esc(title)}">`);
    out.push(`<meta property="og:description" content="${esc(description)}">`);
    out.push(`<meta property="og:url" content="${absUrl(dir)}">`);
    if (og) {
      out.push(`<meta property="og:image" content="${SITE}/${og.path}">`);
      out.push(`<meta property="og:image:width" content="${og.w}">`);
      out.push(`<meta property="og:image:height" content="${og.h}">`);
      out.push(`<meta property="og:image:alt" content="${esc(og.alt)}">`);
      out.push('<meta name="twitter:card" content="summary_large_image">');
    }
  }
  if (ld && ld.length) {
    const doc = ld.length === 1 ? { '@context': 'https://schema.org', ...ld[0] } : { '@context': 'https://schema.org', '@graph': ld };
    out.push(`<script type="application/ld+json">${jsonForScript(doc)}</script>`);
  }
  return out.join('\n') + '\n';
}
const ogOf = (p, lang) => ({ path: imgBase(p) + '.jpg', w: meta[p.slug_en].w, h: meta[p.slug_en].h, alt: pTitle(lang, p) });

// ---------- page shell ----------
// abs: root-relative URLs ("/style.css") for pages served from unknown depths (404.html)
function page({ lang, dir, altDirs, title, description, main, headExtra = '', scriptData = '', og, ld, noindex = false, abs = false }) {
  const hrefFn = abs ? (f, to) => '/' + (to ? to + '/' : '') : href;
  const root = abs ? '/' : rootOf(dir);
  const vars = {
    ROOT: root,
    H: !abs && dir === dirs.home(lang) ? '' : hrefFn(dir, dirs.home(lang)),
    WORK: hrefFn(dir, dirs.work(lang)),
    LANG: langSwitch(lang, dir, altDirs, hrefFn),
  };
  const part = html => fill(translate(html, lang), vars, lang);
  const head = `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${seoHead({ lang, dir, altDirs, title, description, og, ld, noindex })}<meta name="theme-color" content="${site.themeColor}">
<link rel="icon" type="image/png" sizes="512x512" href="${root}${site.favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;600;700;800&family=Noto+Sans+Georgian:wght@300;400;600;700;800&display=swap" rel="stylesheet">
${headExtra}<link rel="stylesheet" href="${root}style.css">
</head>`;
  return `<!DOCTYPE html>
<html lang="${lang}">
${head}
<body>

${part(tpl.header)}
${part(tpl.mmenu)}
<main>
${main}
</main>

${part(tpl.footer)}

${part(tpl.mbar)}
${scriptData}<script src="${root}script.js" defer></script>
</body>
</html>
`;
}

const written = new Set();
function write(dir, html) {
  const out = path.join(ROOT, dir, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  written.add(path.normalize(out));
}

// ---------- pages ----------
const homeStrings = {
  ka: {
    title: 'IronArt — ლითონის ნაკეთობათა საამქრო თბილისში',
    description: 'IronArt — ლითონის ნაკეთობათა საამქრო თბილისში: ჭიშკრები, ღობეები, მოაჯირები, კიბეები, ავეჯი და ინდივიდუალური შეკვეთები. 25+ წელი. ☎ 599 01 21 05',
  },
  en: {
    title: 'IronArt — Metal fabrication workshop in Tbilisi',
    description: 'IronArt — metal fabrication workshop in Tbilisi: gates, fences, railings, staircases, furniture and custom orders. 25+ years. Tel. 599 01 21 05',
  },
};
const D3_FILES = ['IMG_2424', 'IMG_0001', 'IMG_2640', 'IMG_1632', 'IMG_2278', 'IMG_0336', 'IMG_2533'].map(n => byFile[`Images/3d/web/${n}.jpg`]);
const SVC_FILES = ['IMG_2659', 'IMG_0487', 'IMG_2661', 'IMG_8915'].map(n => byFile[`Images/selected/${n}.jpg`]);
const FINISHED = byFile['Images/selected/spiral-stair-clean.jpg'];
const featured = photos.filter(p => p.featured);
if (featured.length !== 8) throw new Error(`Expected 8 featured photos, found ${featured.length}`);
[...D3_FILES, ...SVC_FILES, FINISHED].forEach(p => { if (!p) throw new Error('Home page photo missing from photos.json'); });

function buildHome(lang) {
  const dir = dirs.home(lang);
  const root = rootOf(dir);
  const altDirs = { ka: dirs.home('ka'), en: dirs.home('en') };
  const s = STR[lang];
  const d3 = D3_FILES.map((p, i) => ({ src: `${root}${imgBase(p)}.webp`, alt: s.d3[i] }));
  const svc = SVC_FILES.map((p, i) => ({ src: `${root}${imgBase(p)}.webp`, alt: s.svc[i][0], desc: s.svc[i][1] }));
  const fb = root + imgBase(FINISHED);
  const fm = meta[FINISHED.slug_en];
  const finishedPicture = `<picture><source type="image/webp" srcset="${fb}.webp"><img src="${fb}.jpg" alt="${esc(pTitle(lang, FINISHED))}" loading="lazy" decoding="async" width="${fm.w}" height="${fm.h}" style="width:100%;height:100%;object-fit:cover;object-position:50% 58%"></picture>`;
  const galleryGrid = grid(lang, dir, featured) +
    `\n    <div class="gmore"><a href="${href(dir, dirs.work(lang))}" class="btn pri"><span>${esc(s.allWork)}</span>${ARROW}</a></div>`;
  const main = fill(translate(tpl.home, lang), {
    ROOT: root,
    H: '',
    WORK: href(dir, dirs.work(lang)),
    HERO_SRC: d3[0].src,
    HERO_ALT: esc(d3[0].alt),
    SVC_SRC: svc[0].src,
    SVC_ALT: esc(svc[0].alt),
    SVC_D: esc(svc[0].desc),
    FINISHED_PICTURE: finishedPicture,
    GALLERY_GRID: galleryGrid,
  }, lang).replace(/^<main>\n?/, '').replace(/\n?<\/main>\s*$/, '');
  const ld = { ...site.jsonld_home, '@type': site.jsonld_home['@type'], url: absUrl(dir), inLanguage: lang, image: `${SITE}/${imgBase(D3_FILES[0])}.jpg` };
  delete ld['@context'];
  if (lang === 'en') ld.description = 'Metal fabrication workshop — gates, fences, railings, staircases, furniture and custom orders.';
  const headExtra = `<link rel="preload" as="image" href="${d3[0].src}" type="image/webp">\n<script type="module" src="${root}assets/model-viewer.min.js"></script>\n`;
  const scriptData = `<script>window.IA=${jsonForScript({ d3, svc })};</script>\n`;
  write(dir, page({ lang, dir, altDirs, title: homeStrings[lang].title, description: homeStrings[lang].description, main, headExtra, scriptData, og: { ...ogOf(D3_FILES[0], lang), alt: s.d3[0] }, ld: [ld] }));
}

function listingMain(lang, dir, { h1, intro, activeId, list, trail }) {
  const s = STR[lang];
  return `${crumbs(lang, dir, trail)}
  <section class="gallery inner">
    <div class="ghead">
      <div><div class="label"><span class="sq"></span><span>${esc(s.galL)}</span></div><h1 class="h2">${esc(h1)}</h1></div>
      <p class="intro">${esc(intro)}</p>
    </div>
    ${filters(lang, dir, activeId)}
    ${grid(lang, dir, list)}
  </section>
${ctaSection(lang)}`;
}

const itemList = (lang, list) => ({
  '@type': 'ItemList',
  numberOfItems: list.length,
  itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(dirs.photo(lang, p)), name: pTitle(lang, p) })),
});
const collectionLd = (lang, dir, name, description, list) => ({
  '@type': 'CollectionPage', name, description, url: absUrl(dir), inLanguage: lang,
  isPartOf: { '@type': 'WebSite', name: site.name, url: SITE + '/' },
  mainEntity: itemList(lang, list),
});

function buildWork(lang) {
  const dir = dirs.work(lang);
  const s = STR[lang];
  const altDirs = { ka: dirs.work('ka'), en: dirs.work('en') };
  const trail = [[s.crumbHome, dirs.home(lang)], [s.crumbWork, dir]];
  const main = listingMain(lang, dir, { h1: s.workH1, intro: s.workIntro, activeId: 'all', list: photosInCatOrder, trail });
  const brand = lang === 'ka' ? 'IronArt — თბილისი' : 'IronArt — Tbilisi';
  write(dir, page({ lang, dir, altDirs, title: `${s.workH1} | ${brand}`, description: trunc(s.workIntro), main,
    og: ogOf(featured[0], lang), ld: [collectionLd(lang, dir, s.workH1, trunc(s.workIntro), photosInCatOrder), crumbLd(trail)] }));
}

function buildCategory(lang, c) {
  const dir = dirs.cat(lang, c);
  const s = STR[lang];
  const altDirs = { ka: dirs.cat('ka', c), en: dirs.cat('en', c) };
  const intro = lang === 'ka' ? c.intro_ka : c.intro_en;
  const trail = [[s.crumbHome, dirs.home(lang)], [s.crumbWork, dirs.work(lang)], [catName(lang, c), dir]];
  const main = listingMain(lang, dir, { h1: catName(lang, c), intro, activeId: c.id, list: byCat[c.id], trail });
  const brand = lang === 'ka' ? 'IronArt — თბილისი' : 'IronArt — Tbilisi';
  write(dir, page({ lang, dir, altDirs, title: `${catName(lang, c)} | ${brand}`, description: trunc(intro), main,
    og: ogOf(byCat[c.id][0], lang), ld: [collectionLd(lang, dir, catName(lang, c), trunc(intro), byCat[c.id]), crumbLd(trail)] }));
}

function buildPhoto(lang, p) {
  const dir = dirs.photo(lang, p);
  const s = STR[lang];
  const c = catById[p.category];
  const altDirs = { ka: dirs.photo('ka', p), en: dirs.photo('en', p) };
  const root = rootOf(dir);
  const base = root + imgBase(p);
  const m = meta[p.slug_en];
  const t = pTitle(lang, p);
  const list = byCat[c.id];
  const i = list.indexOf(p);
  const n = list.length;
  const prev = list[(i - 1 + n) % n];
  const next = list[(i + 1) % n];
  const related = [];
  for (let k = 1; k < n && related.length < 4; k++) related.push(list[(i + k) % n]);

  const pager = n > 1 ? `
  <nav class="pager" aria-label="${esc(s.pagerL)}">
    <a href="${href(dir, dirs.photo(lang, prev))}" rel="prev">${ARROW_L}<span><span class="k">${esc(s.prev)}</span><br><b>${esc(pTitle(lang, prev))}</b></span></a>
    <a class="nx" href="${href(dir, dirs.photo(lang, next))}" rel="next"><span><span class="k">${esc(s.next)}</span><br><b>${esc(pTitle(lang, next))}</b></span>${ARROW}</a>
  </nav>` : '';
  const rel = related.length ? `
  <section class="gallery inner">
    <div class="ghead">
      <div><div class="label"><span class="sq"></span><span>${esc(catName(lang, c))}</span></div><h2 class="h2">${esc(s.similarH)}</h2></div>
    </div>
    ${grid(lang, dir, related)}
  </section>` : '';

  const trail = [[s.crumbHome, dirs.home(lang)], [s.crumbWork, dirs.work(lang)], [catName(lang, c), dirs.cat(lang, c)], [t, dir]];
  const imageLd = {
    '@type': 'ImageObject', '@id': absUrl(dir) + '#image',
    contentUrl: `${SITE}/${imgBase(p)}.jpg`, thumbnailUrl: `${SITE}/${imgBase(p)}-thumb.jpg`,
    name: t, description: pDesc(lang, p), width: m.w, height: m.h, encodingFormat: 'image/jpeg',
    inLanguage: lang, mainEntityOfPage: absUrl(dir), publisher: ORG,
  };
  const main = `${crumbs(lang, dir, trail)}
  <section class="pp">
    <figure><picture><source type="image/webp" srcset="${base}.webp"><img src="${base}.jpg" alt="${esc(t)}" width="${m.w}" height="${m.h}" fetchpriority="high" decoding="async"></picture></figure>
    <div class="pinfo">
      <div class="label"><span class="sq"></span><a href="${href(dir, dirs.cat(lang, c))}">${esc(catName(lang, c))}</a></div>
      <h1>${esc(t)}</h1>
      <p>${esc(pDesc(lang, p))}</p>
    </div>
  </section>${pager}${rel}
${ctaSection(lang, { photo: true })}`;
  const brand = lang === 'ka' ? 'IronArt — თბილისი' : 'IronArt — Tbilisi';
  write(dir, page({ lang, dir, altDirs, title: `${t} | ${brand}`, description: trunc(pDesc(lang, p)), main,
    og: ogOf(p, lang), ld: [imageLd, crumbLd(trail)] }));
}

// ---------- 404, sitemap, robots ----------
function build404() {
  const lang = 'ka';
  const s = STR.ka;
  const links = [['/' + dirs.work('ka') + '/', s.allWork], ...cats.map(c => ['/' + dirs.cat('ka', c) + '/', c.name_ka])];
  const main = `
  <section class="gallery inner">
    <div class="ghead">
      <div><div class="label"><span class="sq"></span><span>404</span></div><h1 class="h2">გვერდი ვერ მოიძებნა</h1></div>
      <p class="intro">ეს მისამართი არ არსებობს ან გვერდი გადატანილია. დაბრუნდით მთავარ გვერდზე ან აირჩიეთ ნამუშევრების კატეგორია.<br><span lang="en">Page not found. Go back to the <a href="/en/">English home page</a> or browse our work.</span></p>
    </div>
    <nav class="filters" aria-label="${esc(s.filterLabel)}">${links.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join('')}</nav>
    <div class="gmore"><a href="/" class="btn pri"><span>${esc(s.crumbHome)}</span>${ARROW}</a></div>
  </section>
${ctaSection(lang)}`;
  const html = page({
    lang, dir: '', altDirs: { ka: '', en: 'en' }, abs: true, noindex: true,
    title: 'გვერდი ვერ მოიძებნა | IronArt — თბილისი',
    description: 'გვერდი ვერ მოიძებნა. დაბრუნდით IronArt-ის მთავარ გვერდზე ან დაათვალიერეთ ლითონის ნაკეთობების ნამუშევრები თბილისში.',
    main,
  });
  fs.writeFileSync(path.join(ROOT, '404.html'), html);
}

const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function buildSitemap() {
  const entries = [];
  const imgsOf = (lang, list) => list.map(p => ({ loc: `${SITE}/${imgBase(p)}.jpg`, title: pTitle(lang, p), caption: pDesc(lang, p) }));
  for (const lang of LANGS) {
    entries.push({ lang, key: 'home', dir: dirs.home(lang), alts: { ka: dirs.home('ka'), en: dirs.home('en') }, images: imgsOf(lang, featured) });
    entries.push({ lang, key: 'work', dir: dirs.work(lang), alts: { ka: dirs.work('ka'), en: dirs.work('en') }, images: imgsOf(lang, photosInCatOrder) });
    for (const c of cats) entries.push({ lang, key: 'cat', dir: dirs.cat(lang, c), alts: { ka: dirs.cat('ka', c), en: dirs.cat('en', c) }, images: imgsOf(lang, byCat[c.id]) });
    for (const p of photos) entries.push({ lang, key: 'photo', dir: dirs.photo(lang, p), alts: { ka: dirs.photo('ka', p), en: dirs.photo('en', p) }, images: imgsOf(lang, [p]) });
  }
  const order = { home: 0, work: 1, cat: 2, photo: 3 };
  entries.sort((a, b) => order[a.key] - order[b.key] || LANGS.indexOf(a.lang) - LANGS.indexOf(b.lang));
  const body = entries.map(e => `  <url>
    <loc>${absUrl(e.dir)}</loc>
    <xhtml:link rel="alternate" hreflang="ka" href="${absUrl(e.alts.ka)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${absUrl(e.alts.en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(e.alts.ka)}"/>
${e.images.map(i => `    <image:image>
      <image:loc>${xml(i.loc)}</image:loc>
      <image:title>${xml(i.title)}</image:title>
      <image:caption>${xml(i.caption)}</image:caption>
    </image:image>`).join('\n')}
  </url>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`);
  return entries.length;
}

function buildRobots() {
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *
Allow: /
# originals, build inputs and scripts are not pages; optimised images live in /img/
Disallow: /Images/
Disallow: /data/
Disallow: /src/
Disallow: /scripts/

Sitemap: ${SITE}/sitemap.xml
`);
}

// ---------- run ----------
let count = 0;
for (const lang of LANGS) {
  buildHome(lang); count++;
  buildWork(lang); count++;
  for (const c of cats) { buildCategory(lang, c); count++; }
  for (const p of photos) { buildPhoto(lang, p); count++; }
}
build404();
const sitemapUrls = buildSitemap();
buildRobots();
console.log(`sitemap.xml: ${sitemapUrls} URLs, robots.txt, 404.html`);
console.log(`pages: ${count} written (${LANGS.length} languages, ${photos.length} photos, ${cats.length} categories)`);

// Pages from an earlier build that no longer exist (e.g. a renamed slug). Not deleted automatically.
const stale = [];
const walk = d => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name === 'index.html' && !written.has(path.normalize(f))) stale.push(path.relative(ROOT, f));
  }
};
GENERATED.forEach(d => walk(path.join(ROOT, d)));
if (stale.length) console.warn('WARNING: stale pages from an earlier build (delete these folders by hand):\n  ' + stale.join('\n  '));
