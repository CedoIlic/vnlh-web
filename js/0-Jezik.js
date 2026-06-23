/* 0-Jezik.js — globalni prebacivač jezika u zaglavlju (ZASAD SIMULACIJA: samo zamjena zastave).
 * Ubacuje zastavu trenutnog jezika lijevo od chat ikone (.naslov-forme__ikone); klik → popup s aktivnim
 * jezicima (zastava + izvorni naziv + (naziv)); izbor → zamjena zastave u zaglavlju.
 * Bez persistencije — reload vraća na zadani jezik. Prava funkcionalnost (spremanje + prijevod) dolazi kasnije.
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

  function odaberiJezik(kod) {
    trenutniKod = kod;
    postaviZastavuUZaglavlju(drzavaZaKod(kod));
    zatvoriPopup();
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
    for (var i = 0; i < jezici.length; i++) {
      var j = jezici[i];
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
