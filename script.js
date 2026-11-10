// IronArt: mobile menu on every page; hero 3D tabs, crosshair and services only on the home page
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
  }

  var IA = window.IA;
  if (!IA) return;

  // hero 3D tabs
  var heroImg = $('#heroImg');
  if (heroImg && IA.d3) {
    var setHero = function (i) {
      heroImg.src = IA.d3[i].src; heroImg.alt = IA.d3[i].alt;
      $('#heroCap').textContent = IA.d3[i].alt;
      $('#heroIdx').textContent = pad(i + 1) + ' / ' + pad(IA.d3.length);
      $$('.tab').forEach(function (b, k) { b.classList.toggle('on', k === i); });
    };
    $$('.tab').forEach(function (b) { b.addEventListener('click', function () { setHero(+b.dataset.i); }); });
    (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(function () {
      IA.d3.forEach(function (d) { var im = new Image(); im.src = d.src; });
    });
  }

  // crosshair
  var stage = $('#stage'), cx = $('.cx'), cy = $('.cy'), cr = $('.cr');
  if (stage && cx && cy && cr) {
    stage.addEventListener('mousemove', function (e) {
      var r = stage.getBoundingClientRect(), x = Math.max(0, Math.round(e.clientX - r.left)), y = Math.max(0, Math.round(e.clientY - r.top));
      cx.style.left = x + 'px'; cy.style.top = y + 'px';
      cr.textContent = 'X ' + String(x).padStart(4, '0') + '   Y ' + String(y).padStart(4, '0');
    });
  }

  // services
  var svcImg = $('#svcImg');
  if (svcImg && IA.svc) {
    var setSvc = function (i) {
      svcImg.src = IA.svc[i].src; svcImg.alt = IA.svc[i].alt;
      $('#svcD').textContent = IA.svc[i].desc; $('#svcN').textContent = pad(i + 1);
      $$('.svc').forEach(function (b, k) { b.classList.toggle('on', k === i); });
    };
    $$('.svc').forEach(function (b) {
      b.addEventListener('click', function () { setSvc(+b.dataset.i); });
      b.addEventListener('mouseenter', function () { setSvc(+b.dataset.i); });
    });
  }
})();
