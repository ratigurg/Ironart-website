// Sanity check of the generated site: every local href/src/srcset target exists,
// every page has one h1, a title, a description and matching language-switch links.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pages = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'Images', 'img', 'assets', 'data', 'src', 'scripts'].includes(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (e.name === 'index.html') pages.push(f);
  }
};
walk(ROOT);
let bad = 0, refs = 0;
const fail = (p, msg) => { bad++; console.log(`  ${path.relative(ROOT, p)}: ${msg}`); };
for (const f of pages) {
  const html = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f);
  const urls = [];
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) m[1].split(',').forEach(s => urls.push(s.trim().split(/\s+/)[0]));
  for (let u of urls) {
    if (/^(https?:|tel:|mailto:|#|data:)/.test(u)) continue;
    refs++;
    u = u.split('#')[0].split('?')[0];
    if (!u) continue;
    let t = path.resolve(dir, u);
    if (u.endsWith('/') || (fs.existsSync(t) && fs.statSync(t).isDirectory())) t = path.join(t, 'index.html');
    if (!fs.existsSync(t)) fail(f, `missing target ${u}`);
  }
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(f, `${h1} <h1> elements`);
  if (!/<title>[^<]+<\/title>/.test(html)) fail(f, 'no <title>');
  if (!/<meta name="description" content="[^"]{20,}">/.test(html)) fail(f, 'no meta description');
  if (/\{\{|data-i18n/.test(html)) fail(f, 'unresolved template/i18n marker');
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  for (const i of imgs) if (!/ alt="[^"]*"/.test(i) || !/ width="\d+"/.test(i) || !/ height="\d+"/.test(i)) fail(f, 'img without alt/width/height: ' + i.slice(0, 80));
}
// photos of the same work (data/photos.json "group") may share title and description
const photoList = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/photos.json'), 'utf8'));
const groupOfDir = {};
for (const ph of photoList) if (ph.group) { groupOfDir[`photo/${ph.slug_ka}`] = ph.group; groupOfDir[`en/photo/${ph.slug_en}`] = ph.group; }
const sameGroup = list => { const g = list.map(x => groupOfDir[x.replace(/\/index\.html$/, '')]); return !!g[0] && g.every(v => v === g[0]); };
const titles = {};
for (const f of pages) { const t = fs.readFileSync(f, 'utf8').match(/<title>([^<]*)<\/title>/)[1]; (titles[t] = titles[t] || []).push(path.relative(ROOT, f)); }
for (const [t, l] of Object.entries(titles)) if (l.length > 1 && !sameGroup(l)) {
  if (l.every(x => /(^|\/)photo\//.test(x))) console.log(`  note: photo pages share a <title> "${t}": ${l.join(', ')}`);
  else { bad++; console.log(`  duplicate <title> "${t}": ${l.join(', ')}`); }
}
// ---------- SEO checks ----------
const SITE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8')).url.replace(/\/$/, '');
const dirOf = f => path.relative(ROOT, path.dirname(f)).split(path.sep).join('/');
const urlOf = d => SITE + '/' + d + (d ? '/' : '');
const attr = (html, re) => (html.match(re) || [])[1];
const byUrl = {};
for (const f of pages) byUrl[urlOf(dirOf(f))] = f;
const seen = { desc: {} };
for (const f of pages) {
  const html = fs.readFileSync(f, 'utf8');
  const d = dirOf(f);
  const me = urlOf(d);
  const lang = d === 'en' || d.startsWith('en/') ? 'en' : 'ka';
  if (attr(html, /<html lang="(\w+)"/) !== lang) fail(f, 'wrong <html lang>');
  if (attr(html, /<link rel="canonical" href="([^"]+)"/) !== me) fail(f, `canonical should be ${me}`);
  const alt = {};
  for (const m of html.matchAll(/<link rel="alternate" hreflang="([\w-]+)" href="([^"]+)"/g)) alt[m[1]] = m[2];
  if (!alt.ka || !alt.en || !alt['x-default']) fail(f, 'missing hreflang ka/en/x-default');
  else {
    if (alt[lang] !== me) fail(f, 'hreflang does not point to itself');
    if (alt['x-default'] !== alt.ka) fail(f, 'x-default should be the ka page');
    for (const l of ['ka', 'en']) {
      const g = byUrl[alt[l]];
      if (!g) { fail(f, `hreflang ${l} target is not a page: ${alt[l]}`); continue; }
      const back = {};
      for (const m of fs.readFileSync(g, 'utf8').matchAll(/<link rel="alternate" hreflang="([\w-]+)" href="([^"]+)"/g)) back[m[1]] = m[2];
      if (back[lang] !== me) fail(f, `hreflang not reciprocal with ${alt[l]}`);
    }
  }
  for (const k of ['title', 'description', 'url', 'image', 'image:alt']) if (!new RegExp(`<meta property="og:${k}" content="[^"]+"`).test(html)) fail(f, `missing og:${k}`);
  if (attr(html, /<meta property="og:url" content="([^"]+)"/) !== me) fail(f, 'og:url differs from canonical');
  const og = attr(html, /<meta property="og:image" content="([^"]+)"/);
  if (og && !fs.existsSync(path.join(ROOT, og.replace(SITE + '/', '')))) fail(f, `og:image file missing ${og}`);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/) || '';
  const plain = desc.replace(/&amp;/g, '&');
  if (plain.length > 155) fail(f, `description is ${plain.length} chars (max 155)`);
  (seen.desc[desc] = seen.desc[desc] || []).push(d || '/');
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!lds.length) fail(f, 'no JSON-LD');
  let types = [];
  for (const m of lds) {
    try { const j = JSON.parse(m[1]); types.push(...(j['@graph'] || [j]).map(x => x['@type'])); } catch (e) { fail(f, 'invalid JSON-LD: ' + e.message); }
  }
  const kind = d === '' || d === 'en' ? 'home' : /(^|\/)photo\//.test(d) ? 'photo' : 'list';
  const need = { home: ['HomeAndConstructionBusiness'], photo: ['ImageObject', 'BreadcrumbList'], list: ['CollectionPage', 'BreadcrumbList'] }[kind];
  for (const n of need) if (!types.includes(n)) fail(f, `JSON-LD lacks ${n}`);
}
for (const [dsc, l] of Object.entries(seen.desc)) if (l.length > 1 && !sameGroup(l)) {
  if (l.every(x => /(^|\/)photo\//.test(x))) console.log(`  note: photo pages share a description: ${l.join(', ')}`);
  else { bad++; console.log(`  duplicate description on: ${l.join(', ')}`); }
}

// sitemap
const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const pageUrls = Object.keys(byUrl);
for (const u of pageUrls) if (!locs.includes(u)) { bad++; console.log(`  sitemap lacks ${u}`); }
for (const u of locs) if (!byUrl[u]) { bad++; console.log(`  sitemap has unknown URL ${u}`); }
if (new Set(locs).size !== locs.length) { bad++; console.log('  sitemap has duplicate <loc>'); }
let imgs = 0;
for (const m of sm.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) { imgs++; if (!fs.existsSync(path.join(ROOT, m[1].replace(SITE + '/', '')))) { bad++; console.log(`  sitemap image missing ${m[1]}`); } }
const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) { bad++; console.log('  robots.txt lacks the sitemap line'); }
const nf = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
if (!/<meta name="robots" content="noindex">/.test(nf)) { bad++; console.log('  404.html is not noindex'); }
if (!/href="\/style\.css"/.test(nf)) { bad++; console.log('  404.html should use root-relative asset URLs'); }
// redirects: every target exists, no source is still a real page/file
const rd = fs.existsSync(path.join(ROOT, '_redirects')) ? fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n').filter(l => l && !l.startsWith('#')) : [];
for (const l of rd) {
  const [from, to, code] = l.split(/\s+/);
  const fp = x => path.join(ROOT, x.replace(/^\//, ''), x.endsWith('/') ? 'index.html' : '');
  if (!fs.existsSync(fp(to))) { bad++; console.log(`  redirect target missing: ${to}`); }
  if (fs.existsSync(fp(from)) && fs.statSync(fp(from)).isFile()) { bad++; console.log(`  redirect source still exists as a page: ${from}`); }
  if (code !== '301') { bad++; console.log(`  redirect is not 301: ${l}`); }
}
// photo pages: arrows on the photo point to the same pages as the pager below it
for (const u of Object.keys(byUrl).filter(u => /\/photo\/[^/]+\/$/.test(u))) {
  const h = fs.readFileSync(byUrl[u], 'utf8');
  const ov = (re) => (h.match(re) || [])[1];
  const pn = ov(/<a class="pnav prev" href="([^"]+)"/), nn = ov(/<a class="pnav next" href="([^"]+)"/);
  const pp = ov(/<a href="([^"]+)" rel="prev"/), np = ov(/<a class="nx" href="([^"]+)" rel="next"/);
  if (!pn || !nn || pn !== pp || nn !== np) { bad++; console.log(`  photo arrows differ from pager on ${u}`); }
}
// photo pager: following rel="next" on the ka pages visits every photo once and returns to the start
const photoPages = Object.keys(byUrl).filter(u => /^https?:\/\/[^/]+\/photo\/[^/]+\/$/.test(u));
const nextOf = u => { const h = fs.readFileSync(byUrl[u], 'utf8'); const m = h.match(/<a class="nx" href="([^"]+)" rel="next"/); return m && new URL(m[1], u).href; };
const prevOf = u => { const h = fs.readFileSync(byUrl[u], 'utf8'); const m = h.match(/<a href="([^"]+)" rel="prev"/); return m && new URL(m[1], u).href; };
{
  const start = photoPages[0]; const visited = new Set(); let u = start;
  while (u && !visited.has(u)) { visited.add(u); const n = nextOf(u); if (!n || prevOf(n) !== u) { bad++; console.log(`  pager not reciprocal at ${u}`); break; } u = n; }
  if (visited.size !== photoPages.length || u !== start) { bad++; console.log(`  pager chain visits ${visited.size}/${photoPages.length} photos`); }
}
console.log(`checked ${pages.length} pages, ${refs} local references, ${locs.length} sitemap URLs, ${imgs} sitemap images, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
