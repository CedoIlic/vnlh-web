/* 0-Jezik.js — globalni prebacivač jezika u zaglavlju + i18n runtime (t() i data-i18n swapper).
 * Ubacuje zastavu trenutnog jezika lijevo od chat ikone (.naslov-forme__ikone); klik → popup s jezicima
 * dostupnima za formu (window.__VNLH_FORM_JEZICI__; inače svi aktivni); izbor → sprema jezik (0-Jezik_postavi.php) + reload.
 * Rječnik injektira server (window.__I18N__ po formi); master jezik (window.__VNLH_JEZIK_MASTER__) = literali iz koda → swapper je no-op.
 * NE dira 0-Common.js — samo čita/dopunjuje wrapper ikona u zaglavlju.
 */
// @ts-nocheck
(function () {
  'use strict';

  /** API putanja neovisna o kontekstu (kao 0-Poruke_Tekstovi.js): app base + /php/, fallback ../php/. */
  function apiUrl(file) {
    if (typeof window.vnlhAppBasePathname === 'function') {
      var base = window.vnlhAppBasePathname();
      if (base) return base.replace(/\/$/, '') + '/php/' + file;
    }
    return '../php/' + file;
  }
  function flagUrl(drzavaKod) {
    var k = (drzavaKod != null ? String(drzavaKod) : '').trim().toLowerCase();
    return k !== '' ? apiUrl('Jezici_CRUD_Zastava.php') + '?kod=' + encodeURIComponent(k) : '';
  }

  /* ---------- i18n runtime: t() + data-i18n swapper ---------- */
  function tLookup(key) {
    var d = window.__I18N__;
    if (!d || !key) return null;
    return Object.prototype.hasOwnProperty.call(d, key) ? d[key] : null;
  }
  /** Prijevod ključa; fallback = drugi argument (master literal) ili sam ključ. params: {1:'x'} → zamjena {1}. */
  function t(key, fallback, params) {
    var s = tLookup(key);
    if (s == null) s = (fallback != null ? fallback : key);
    if (params) for (var k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k)) s = s.split('{' + k + '}').join(String(params[k]));
    }
    return s;
  }
  function prevediElement(el) {
    var v;
    if (el.hasAttribute('data-i18n')) { v = tLookup(el.getAttribute('data-i18n')); if (v != null) el.textContent = v; }
    if (el.hasAttribute('data-i18n-placeholder')) { v = tLookup(el.getAttribute('data-i18n-placeholder')); if (v != null) el.setAttribute('placeholder', v); }
    if (el.hasAttribute('data-i18n-title')) { v = tLookup(el.getAttribute('data-i18n-title')); if (v != null) el.setAttribute('title', v); }
    if (el.hasAttribute('data-i18n-aria')) { v = tLookup(el.getAttribute('data-i18n-aria')); if (v != null) el.setAttribute('aria-label', v); }
  }
  var I18N_SEL = '[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria]';
  /** Prevede sve data-i18n elemente unutar root (default document). Master jezik → no-op (literali ostaju). */
  function prevedi(root) {
    if (window.__VNLH_JEZIK_MASTER__) return;
    root = root || document;
    if (root.nodeType === 1 && root.matches && root.matches(I18N_SEL)) prevediElement(root);
    if (root.querySelectorAll) { var els = root.querySelectorAll(I18N_SEL); for (var i = 0; i < els.length; i++) prevediElement(els[i]); }
  }
  /** Prati dinamički ubačen DOM (modali, fragmenti) i prevede ga. Master → ništa. */
  function pratiDOM() {
    if (window.__VNLH_JEZIK_MASTER__ || !window.MutationObserver || !document.body) return;
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var a = muts[i].addedNodes;
        for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) prevedi(a[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  /** Prevede zaglavlje tablice iz JEDNOG ključa (master naslovi spojeni zarezom). Vraća KLON s prevedenim
   *  title; ako prijevoda nema ili se broj stupaca ne slaže → vraća original (master). delimiter default ','. */
  function tZaglavlje(key, zaglavlje, delimiter) {
    if (!Array.isArray(zaglavlje) || !zaglavlje.length) return zaglavlje;
    var prijevod = tLookup(key);
    if (prijevod == null) return zaglavlje; // master jezik ili nema prijevoda → naslovi iz koda
    var d = delimiter || ',';
    var dijelovi = String(prijevod).split(d);
    if (dijelovi.length !== zaglavlje.length) return zaglavlje; // broj stupaca se ne slaže → sigurno master
    return zaglavlje.map(function (c, i) {
      var klon = {};
      for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) klon[k] = c[k];
      klon.title = dijelovi[i].replace(/^\s+|\s+$/g, '');
      return klon;
    });
  }

  /* Globalno: t() za programatske stringove, vnlhI18nPrevedi() nakon ručnog ubacivanja fragmenata,
     vnlhTZaglavlje() za prijevod zaglavlja tablice iz jednog ključa. */
  window.vnlhT = t;
  window.vnlhI18nPrevedi = prevedi;
  window.vnlhTZaglavlje = tZaglavlje;

  var jezici = [];       // [{kod, naziv, naziv_izvorni, drzava_kod, zadani}]
  var trenutniKod = '';  // odabrani jezik (in-memory, bez persistencije)
  var popupEl = null;

  function drzavaZaKod(kod) {
    for (var i = 0; i < jezici.length; i++) if (jezici[i].kod === kod) return jezici[i].drzava_kod || '';
    return '';
  }

  function postaviZastavuUZaglavlju(drzavaKod) {
    var imgs = document.querySelectorAll('.naslov-forme__jezik-flag');
    var url = flagUrl(drzavaKod);
    for (var i = 0; i < imgs.length; i++) {
      if (url) { imgs[i].src = url; imgs[i].style.visibility = ''; }
      else { imgs[i].removeAttribute('src'); imgs[i].style.visibility = 'hidden'; }
    }
  }

  function spremiJezik(kod, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl('0-Jezik_postavi.php'), true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (cb) cb((xhr.responseText || '').trim() === 'OK');
    };
    xhr.send('kod=' + encodeURIComponent(kod));
  }

  function odaberiJezik(kod) {
    zatvoriPopup();
    if (kod === trenutniKod) return;
    spremiJezik(kod, function (ok) {
      if (ok) window.location.reload(); // novi rječnik se injektira pri ponovnom učitavanju
    });
  }

  /** Jezici dostupni za ovu formu: __VNLH_FORM_JEZICI__ (kodovi) + uvijek master/zadani; inače svi aktivni. */
  function jeziciZaFormu() {
    var dop = window.__VNLH_FORM_JEZICI__;
    if (!dop || !dop.length) return jezici;
    var set = {};
    for (var i = 0; i < dop.length; i++) set[String(dop[i]).toLowerCase()] = 1;
    var out = [];
    for (var j = 0; j < jezici.length; j++) {
      if ((jezici[j].zadani | 0) === 1 || set[jezici[j].kod]) out.push(jezici[j]);
    }
    return out;
  }

  function zatvoriPopup() {
    if (popupEl) { if (popupEl.parentNode) popupEl.parentNode.removeChild(popupEl); popupEl = null; }
    document.removeEventListener('click', vanjskiKlik, true);
    document.removeEventListener('keydown', escZatvori, true);
    window.removeEventListener('scroll', zatvoriPopup, true);
    window.removeEventListener('resize', zatvoriPopup, true);
  }
  function vanjskiKlik(e) {
    if (!popupEl) return;
    if (popupEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.naslov-forme__jezik')) return;
    zatvoriPopup();
  }
  function escZatvori(e) { if (e.key === 'Escape') zatvoriPopup(); }

  function otvoriPopup(anchorBtn) {
    if (popupEl) { zatvoriPopup(); return; }
    popupEl = document.createElement('div');
    popupEl.className = 'naslov-forme__jezik-popup';
    var lista = jeziciZaFormu();
    for (var i = 0; i < lista.length; i++) {
      var j = lista[i];
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'naslov-forme__jezik-popup-stavka';
      if (j.kod === trenutniKod) row.classList.add('naslov-forme__jezik-popup-stavka--aktivna');

      var im = document.createElement('img');
      im.className = 'naslov-forme__jezik-popup-flag';
      im.alt = '';
      var fu = flagUrl(j.drzava_kod);
      if (fu) im.src = fu; else im.style.visibility = 'hidden';
      im.addEventListener('error', function () { this.style.visibility = 'hidden'; });

      var txt = document.createElement('span');
      var izvorni = j.naziv_izvorni || j.naziv || j.kod;
      txt.textContent = izvorni + (j.naziv ? ' (' + j.naziv + ')' : '');

      row.appendChild(im);
      row.appendChild(txt);
      (function (kod) {
        row.addEventListener('click', function (e) { e.stopPropagation(); odaberiJezik(kod); });
      })(j.kod);
      popupEl.appendChild(row);
    }
    /* Fiksno preko body-a (izbjegava rezanje ako zaglavlje ima overflow); pozicija ispod gumba. */
    document.body.appendChild(popupEl);
    var r = anchorBtn.getBoundingClientRect();
    var w = popupEl.offsetWidth;
    var left = Math.round(r.left);
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - w);
    popupEl.style.left = left + 'px';
    popupEl.style.top = Math.round(r.bottom + 6) + 'px';
    /* listeneri za zatvaranje tek nakon trenutnog klika (da ovaj isti klik ne zatvori popup). */
    setTimeout(function () {
      document.addEventListener('click', vanjskiKlik, true);
      document.addEventListener('keydown', escZatvori, true);
      window.addEventListener('scroll', zatvoriPopup, true);
      window.addEventListener('resize', zatvoriPopup, true);
    }, 0);
  }

  function napraviGumb() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'naslov-forme__jezik';
    btn.setAttribute('aria-label', 'Jezik');
    btn.title = 'Jezik';
    var im = document.createElement('img');
    im.className = 'naslov-forme__jezik-flag';
    im.alt = '';
    im.addEventListener('error', function () { this.style.visibility = 'hidden'; });
    btn.appendChild(im);
    btn.addEventListener('click', function (e) { e.stopPropagation(); otvoriPopup(btn); });
    return btn;
  }

  function inicijalniKod() {
    if (trenutniKod) return trenutniKod;
    if (window.__VNLH_JEZIK__) return String(window.__VNLH_JEZIK__);
    for (var i = 0; i < jezici.length; i++) if ((jezici[i].zadani | 0) === 1) return jezici[i].kod;
    return jezici.length ? jezici[0].kod : '';
  }

  function ubaciGumb() {
    var wraps = document.querySelectorAll('.naslov-forme__ikone');
    for (var i = 0; i < wraps.length; i++) {
      if (wraps[i].querySelector('.naslov-forme__jezik')) continue;
      wraps[i].insertBefore(napraviGumb(), wraps[i].firstChild); // lijevo od chata
    }
    trenutniKod = inicijalniKod();
    if (trenutniKod) postaviZastavuUZaglavlju(drzavaZaKod(trenutniKod));
  }

  function ucitajJezike(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl('0-Jezik_dostupni.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text.charAt(0) === '[') { try { jezici = JSON.parse(text); } catch (e) { jezici = []; } }
      if (cb) cb();
    };
    xhr.send();
  }

  function init() {
    if (/Login\.(html|php)/i.test(window.location.pathname || '')) return;
    if (document.body && document.body.classList.contains('login-win')) return;
    /* i18n: prevedi statički DOM i prati dinamički (neovisno o postojanju zaglavlja). */
    prevedi(document);
    pratiDOM();
    if (!document.querySelector('.naslov-forme')) return;
    ucitajJezike(function () {
      if (jezici.length) ubaciGumb();
    });
  }

  /* defer skripta: čekaj DOMContentLoaded (nakon što 0-Common.js kreira .naslov-forme__ikone). */
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
