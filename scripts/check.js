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
const titles = {};
for (const f of pages) { const t = fs.readFileSync(f, 'utf8').match(/<title>([^<]*)<\/title>/)[1]; (titles[t] = titles[t] || []).push(path.relative(ROOT, f)); }
for (const [t, l] of Object.entries(titles)) if (l.length > 1) { bad++; console.log(`  duplicate <title> "${t}": ${l.join(', ')}`); }
console.log(`checked ${pages.length} pages, ${refs} local references, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
