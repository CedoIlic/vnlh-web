/* =========================================================
   0-Kontrole_Tab.js
   Tab kontrola (traka kartica + prikaz sadržaja). Ovisnosti: 0-Kontrole_Tab.css.
   Konvencija DOM-a: unutar .kontrola-tab, gumbi .kontrola-tab__kartica s data-tab-index;
   u .kontrola-tab__tijelo djeca .kontrola-tab__panel u istom redoslijedu.
   ========================================================= */

(function (global) {
  'use strict';

  /**
   * Postavlja aktivni tab (indeks 0..n-1).
   * @param {Element} root .kontrola-tab
   * @param {number} index Indeks kartice / panela
   */
  function kontrolaTabPostaviAktivni(root, index) {
    if (!root || !root.classList || !root.classList.contains('kontrola-tab')) {
      return;
    }
    var kartice = root.querySelectorAll('.kontrola-tab__kartica');
    var tijelo = root.querySelector('.kontrola-tab__tijelo');
    if (!tijelo) return;
    var paneli = tijelo.querySelectorAll('.kontrola-tab__panel');
    var n = Math.min(kartice.length, paneli.length);
    if (n === 0) return;
    var i;
    var akt = Math.max(0, Math.min(Math.floor(index), n - 1));
    for (i = 0; i < n; i++) {
      var k = kartice[i];
      var p = paneli[i];
      var jeAkt = i === akt;
      if (k) {
        if (jeAkt) {
          k.classList.add('kontrola-tab__kartica--aktivna');
          k.setAttribute('aria-selected', 'true');
          k.removeAttribute('tabindex');
        } else {
          k.classList.remove('kontrola-tab__kartica--aktivna');
          k.setAttribute('aria-selected', 'false');
          k.setAttribute('tabindex', '-1');
        }
      }
      if (p) {
        if (jeAkt) {
          p.removeAttribute('hidden');
        } else {
          p.setAttribute('hidden', '');
        }
      }
    }
  }

  /**
   * Inicijalizira tab kontrolu: klik po karticama, tipke lijevo/desno s fokusa na traci.
   * @param {Element|null} root Korijen .kontrola-tab ili null
   */
  function KontroleTabInit(root) {
    if (!root || !root.classList || !root.classList.contains('kontrola-tab')) {
      return;
    }

    var kartice = root.querySelectorAll('.kontrola-tab__kartica');
    var tijelo = root.querySelector('.kontrola-tab__tijelo');
    if (!tijelo || !kartice.length) return;
    var paneli = tijelo.querySelectorAll('.kontrola-tab__panel');
    var n = Math.min(kartice.length, paneli.length);
    if (n === 0) return;

    /** Trenutačni aktivni indeks (iz DOM-a pri prvom čitanju). */
    function trenutniIndeks() {
      var i;
      for (i = 0; i < n; i++) {
        if (kartice[i].classList.contains('kontrola-tab__kartica--aktivna')) return i;
      }
      for (i = 0; i < n; i++) {
        if (!paneli[i].hasAttribute('hidden')) return i;
      }
      return 0;
    }

    function indeksIzGumba(btn) {
      var j, s;
      if (btn && btn.getAttribute) {
        s = btn.getAttribute('data-tab-index');
        if (s != null && s !== '') {
          var parsed = parseInt(s, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
      for (j = 0; j < kartice.length; j++) {
        if (kartice[j] === btn) return j;
      }
      return 0;
    }

    kartice.forEach(function (btn) {
      btn.addEventListener('click', function () {
        kontrolaTabPostaviAktivni(root, indeksIzGumba(btn));
      });
    });

    /** Kretanje strelicama kad je fokus na kartici (traka). */
    var traka = root.querySelector('.kontrola-tab__traka');
    if (traka) traka.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains('kontrola-tab__kartica')) return;
      var key = ev.key;
      if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
      var cur = trenutniIndeks();
      var next = cur;
      if (key === 'ArrowLeft') next = (cur - 1 + n) % n;
      else if (key === 'ArrowRight') next = (cur + 1) % n;
      else if (key === 'Home') next = 0;
      else if (key === 'End') next = n - 1;
      if (next !== cur) {
        ev.preventDefault();
        kontrolaTabPostaviAktivni(root, next);
        if (kartice[next]) {
          try {
            kartice[next].focus();
          } catch (e) { /* */ }
        }
      }
    });
  }

  global.KontroleTabInit = KontroleTabInit;
  global.kontrolaTabPostaviAktivni = kontrolaTabPostaviAktivni;
})(typeof window !== 'undefined' ? window : this);
