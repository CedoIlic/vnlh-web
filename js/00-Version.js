// =====================================================
// 00-Version.js
// Centralna verzija VNLH WEB aplikacije.
//
// Izvor istine za broj verzije: samo window.VNLH_VERZIJA ispod. Kad bumpaš verziju, prvo to ovdje,
// zatim po potrebi ?v= na script/link u HTML-ima (cache-busting).
// Razvoj: 1 = lokalno (klik na badge otvara modal, php/Version_Update.php ažurira datoteku);
//         0 = produkcija (samo prikaz, verzija se mijenja distribucijom).
// Prikaz "V x.x.x" uvijek je window.VNLH_VERZIJA iz ove datoteke (nema localStorage overridea).
//
// Upute za novu verziju:
// 1. Lokalno (Razvoj=1): klik na "V x.x.x" u naslovu → unesi novu verziju → OK.
// 2. Distribucija: postavi VNLH_RAZVOJ=0, ažuriraj VNLH_VERZIJA i ?v= u HTML-ima.
// =====================================================
window.VNLH_VERZIJA = "1.0.220";
window.VNLH_RAZVOJ = 1;

(function () {
  'use strict';
  var versionUpdateUrl = null;
  var versionCheckUrl = null;
  var fileVersionAtLoad = window.VNLH_VERZIJA || '';

  /* Stari razvojni override u localStorage više se ne koristi – ukloni da ne ostane zastarjeli broj. */
  try {
    localStorage.removeItem('vnlh_verzija_override');
  } catch (e) {}

  (function initVersionUrls() {
    try {
      var script = document.currentScript;
      var path;
      if (script && script.src) {
        var url = new URL(script.src);
        path = url.pathname.replace(/\/[^/]+$/, '').replace(/\/[^/]+$/, '');
        versionUpdateUrl = url.origin + path + '/php/Version_Update.php';
        versionCheckUrl = url.origin + path + '/php/Version_Check.php';
      } else {
        var loc = window.location;
        path = loc.pathname.replace(/\/html\/[^/]*$/, '').replace(/\/[^/]*$/, '') || '/';
        versionUpdateUrl = loc.origin + path + '/php/Version_Update.php';
        versionCheckUrl = loc.origin + path + '/php/Version_Check.php';
      }
    } catch (e) {}
  })();

  /** Provjera verzije na serveru pri učitavanju – ako se razlikuje, osvježi stranicu (cache-busting).
   *  Guard: ako URL već sadrži parametar _ (prethodni pokušaj reloada), ne pokušavaj ponovo —
   *  preglednikov keš možda i dalje servira stari JS unatoč reloadu stranice, pa bi bez
   *  ovog guarda nastala beskonačna petlja reload-a. */
  (function checkVersionOnLoad() {
    if (!versionCheckUrl) return;
    var clientVer = (window.VNLH_VERZIJA || '').trim();
    if (!clientVer) return;
    var alreadyReloaded = false;
    try { alreadyReloaded = new URLSearchParams(location.search).has('_'); } catch (e) {}
    fetch(versionCheckUrl, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (serverVer) {
        serverVer = (serverVer || '').trim();
        if (serverVer && serverVer !== clientVer) {
          if (alreadyReloaded) {
            /* Već smo jednom reload-ali ali keš i dalje servira stari JS — ne pokušavaj ponovo.
               Ažuriraj klijentsku verziju u memoriji da badge bude točan. */
            window.VNLH_VERZIJA = serverVer;
            try {
              var u = new URL(location.href);
              u.searchParams.delete('_');
              var clean = u.pathname + (u.search || '') + (u.hash || '');
              if (clean !== location.pathname + location.search + location.hash) {
                history.replaceState(null, '', clean);
              }
            } catch (e) {}
            return;
          }
          try {
            var u = new URL(location.href);
            u.searchParams.set('_', Date.now().toString());
            if (typeof window.__vnlhAppNavInternal !== 'undefined') window.__vnlhAppNavInternal = true;
            location.replace(u.href);
          } catch (e) {
            if (typeof window.__vnlhAppNavInternal !== 'undefined') window.__vnlhAppNavInternal = true;
            location.reload();
          }
        } else {
          /* Ukloni parametar _ iz URL-a ako je ostao od prethodnog osvježavanja */
          try {
            var u = new URL(location.href);
            if (u.searchParams.has('_')) {
              u.searchParams.delete('_');
              var clean = u.pathname + (u.search || '') + (u.hash || '');
              if (clean !== location.pathname + location.search + location.hash) {
                history.replaceState(null, '', clean);
              }
            }
          } catch (e) {}
        }
      })
      .catch(function () {});
  })();

  function getVerzija() {
    return (window.VNLH_VERZIJA || '').trim();
  }

  function setVerzija(v) {
    window.VNLH_VERZIJA = v;
  }

  function showModalPromjenaVerzije(currentVerzija, onOk) {
    var overlay = document.createElement('div');
    overlay.className = 'vnlh-verzija-modal-overlay';
    overlay.setAttribute('aria-hidden', 'false');

    var dialog = document.createElement('div');
    dialog.className = 'vnlh-verzija-modal-dialog';

    var header = document.createElement('div');
    header.className = 'vnlh-verzija-modal-header';
    header.textContent = 'Promjena verzije';

    var body = document.createElement('div');
    body.className = 'vnlh-verzija-modal-body';
    var label = document.createElement('label');
    label.className = 'kontrola-labela';
    label.setAttribute('for', 'vnlh_verzija_edit');
    label.textContent = 'Verzija';
    var input = document.createElement('input');
    input.id = 'vnlh_verzija_edit';
    input.type = 'text';
    input.className = 'kontrola-edit';
    input.value = currentVerzija;
    input.placeholder = 'npr. 10.12.18';
    body.appendChild(label);
    body.appendChild(input);

    var footer = document.createElement('div');
    footer.className = 'vnlh-verzija-modal-footer';
    var btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = 'kontrola-btn kontrola-btn--primary';
    btnOk.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">OK</span></span></span>';
    var btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'kontrola-btn';
    btnCancel.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">Odustani</span></span></span>';

    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      document.body.style.overflow = '';
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnOk.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }
    document.addEventListener('keydown', onKey);

    btnOk.addEventListener('click', function () {
      var v = String(input.value || '').trim();
      if (!v) return;
      setVerzija(v);
      if (onOk) onOk(v);
      close();
      // Ažuriraj 00-Version.js na serveru (samo kad Razvoj=1)
      if (window.VNLH_RAZVOJ === 1 && versionUpdateUrl) {
        var body = new URLSearchParams();
        body.set('version', v);
        body.set('razvoj', '1');
        fetch(versionUpdateUrl, {
            method: 'POST',
            body: body
          }).then(function (r) { return r.text(); }).then(function (txt) {
            if (txt === 'OK') {
              try {
                var u = new URL(location.href);
                u.searchParams.set('_', Date.now().toString());
                if (typeof window.__vnlhAppNavInternal !== 'undefined') window.__vnlhAppNavInternal = true;
                location.replace(u.href);
              } catch (e) {
                if (typeof window.__vnlhAppNavInternal !== 'undefined') window.__vnlhAppNavInternal = true;
                location.reload();
              }
            } else {
              console.warn('Version_Update:', txt);
            }
          }).catch(function (e) { console.warn('Version_Update:', e); });
      }
    });
    btnCancel.addEventListener('click', close);

    footer.appendChild(btnOk);
    footer.appendChild(btnCancel);
    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    input.focus();
  }

  function init() {
    if (document.querySelector('.vnlh-verzija-badge')) {
      return;
    }
    var blokovi = document.querySelectorAll('.naslov-forme');
    if (!blokovi.length) {
      return;
    }
    // Ako postoji više .naslov-forme (npr. keš/duplikat), umetni badge u blok s nepraznim h2 – ne u prvi prazan.
    var naslov = null;
    var j;
    for (j = 0; j < blokovi.length; j++) {
      var h2c = blokovi[j].querySelector('h2');
      if (h2c && String(h2c.textContent || '').trim() !== '') {
        naslov = blokovi[j];
        break;
      }
    }
    if (!naslov) {
      naslov = blokovi[0];
    }

    var verzija = getVerzija();
    // Gumb umjesto span-a: klik ne aktivira dvosmislena ponašanja (fokus/označavanje) kao interaktivni tekst.
    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'vnlh-verzija-badge';
    badge.textContent = 'V ' + verzija;
    badge.title = 'Verzija' + (window.VNLH_RAZVOJ === 1 ? ' (klik za promjenu)' : '');
    if (window.VNLH_RAZVOJ === 1) {
      badge.setAttribute('aria-label', 'Promjena verzije aplikacije');
    } else {
      badge.setAttribute('aria-label', 'Verzija aplikacije');
    }
    naslov.style.position = 'relative';
    naslov.appendChild(badge);

    if (window.VNLH_RAZVOJ === 1) {
      var lastModalAt = 0;
      badge.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var t = Date.now();
        if (t - lastModalAt < 450) {
          return;
        }
        lastModalAt = t;
        showModalPromjenaVerzije(fileVersionAtLoad, function (v) {
          fileVersionAtLoad = v;
          badge.textContent = 'V ' + v;
          var footerEl = document.getElementById('vnlhFooterVer');
          if (footerEl) footerEl.textContent = 'Verzija: ' + v;
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
