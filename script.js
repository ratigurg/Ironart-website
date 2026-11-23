// IronArt: mobile menu on every page; hero slider, 3D strip lightbox and services only on the home page
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };

  // mobile menu
  var menu = $('#mmenu'), mbtn = $('.menubtn');
  if (menu && mbtn) {
    var setMenu = function (open) {
      menu.classList.toggle('open', open);
      mbtn.setAttribute('aria-expanded', open);
      mbtn.textContent = open ? mbtn.dataset.close : mbtn.dataset.open;
    };
    mbtn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1080 && menu.classList.contains('open')) setMenu(false); });
  }

  // photo pages: left/right arrow keys follow the previous/next photo
  var prevLink = $('.pnav.prev'), nextLink = $('.pnav.next');
  if (prevLink && nextLink) {
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var t = e.target && e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      if (e.key === 'ArrowLeft') { window.location.href = prevLink.href; }
      else if (e.key === 'ArrowRight') { window.location.href = nextLink.href; }
    });

    // swipe on the photo: left -> next, right -> previous (only clear horizontal swipes; vertical scrolling is untouched)
    var pimg = $('.pimg'), sx = 0, sy = 0, st = 0, tracking = false;
    if (pimg) {
      pimg.addEventListener('touchstart', function (e) {
        tracking = e.touches.length === 1 && !e.target.closest('.pnav');
        if (tracking) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }
      }, { passive: true });
      pimg.addEventListener('touchcancel', function () { tracking = false; }, { passive: true });
      pimg.addEventListener('touchend', function (e) {
        if (!tracking) return; tracking = false;
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - st > 800) return;
        window.location.href = (dx < 0 ? nextLink : prevLink).href;
      }, { passive: true });
    }
  }

  var IA = window.IA;
  if (!IA) return;

  // hero slider (finished work)
  var heroImg = $('#heroImg');
  if (heroImg && IA.hero) {
    var setHero = function (i) {
      heroImg.src = IA.hero[i].src; heroImg.alt = IA.hero[i].alt;
      $('#heroCap').textContent = IA.hero[i].alt;
      $('#heroIdx').textContent = pad(i + 1) + ' / ' + pad(IA.hero.length);
      $$('.tab').forEach(function (b, k) { b.classList.toggle('on', k === i); });
    };
    $$('.tab').forEach(function (b) { b.addEventListener('click', function () { setHero(+b.dataset.i); }); });
    (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(function () {
      IA.hero.forEach(function (d) { var im = new Image(); im.src = d.src; });
    });
  }

  // 3D strip: open full-size images in a lightbox
  var strip = $('.d3strip');
  if (strip && IA.d3) {
    var lb = null, cur = 0, opener = null;
    var show = function (i) {
      cur = (i + IA.d3.length) % IA.d3.length;
      var im = $('img', lb); im.src = IA.d3[cur].src; im.alt = IA.d3[cur].alt;
      $('figcaption', lb).textContent = IA.d3[cur].alt;
    };
    var close = function () {
      if (!lb) return;
      document.removeEventListener('keydown', onKey);
      lb.remove(); lb = null; document.body.style.overflow = '';
      if (opener) opener.focus();
    };
    var onKey = function (e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(cur + 1);
      else if (e.key === 'ArrowLeft') show(cur - 1);
    };
    var open = function (i, btn) {
      opener = btn;
      lb = document.createElement('div');
      lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
      lb.innerHTML = '<button type="button" class="lb-x"></button><button type="button" class="lb-nav prev">&#8249;</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lb-nav next">&#8250;</button>';
      $('.lb-x', lb).setAttribute('aria-label', strip.dataset.lbClose); $('.lb-x', lb).textContent = '\u00d7';
      $('.prev', lb).setAttribute('aria-label', strip.dataset.lbPrev);
      $('.next', lb).setAttribute('aria-label', strip.dataset.lbNext);
      lb.addEventListener('click', function (e) {
        if (e.target.closest('.prev')) show(cur - 1);
        else if (e.target.closest('.next')) show(cur + 1);
        else if (e.target === lb || e.target.closest('.lb-x')) close();
      });
      document.body.appendChild(lb); document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      show(i); $('.lb-x', lb).focus();
    };
    $$('.d3item', strip).forEach(function (b) { b.addEventListener('click', function () { open(+b.dataset.i, b); }); });
  }

  // services
  var svcImg = $('#svcImg');
  if (svcImg && IA.svc) {
    var setSvc = function (i) {
      svcImg.src = IA.svc[i].src; svcImg.alt = IA.svc[i].alt;
      $('#svcD').textContent = IA.svc[i].desc;
      $$('.svc').forEach(function (b, k) { b.classList.toggle('on', k === i); });
    };
    $$('.svc').forEach(function (b) {
      b.addEventListener('click', function () { setSvc(+b.dataset.i); });
      b.addEventListener('mouseenter', function () { setSvc(+b.dataset.i); });
    });
  }
})();
