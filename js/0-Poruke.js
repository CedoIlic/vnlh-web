/* =========================================================
   0-Poruke.js
   Modal „Poruke”: fragment, tablica, povijest, slanje; mail + (opcionalno) chat ikona u .naslov-forme + globalni polling nepročitanih.
   Otvaranje: klik na mail, window.vnlhOpenTestniModal / VnlhPorukeOpenModal; zatvaranje Povratak ili Escape.
   Podnožje: Lucide wrench – način „razvoj” (naslov, plava zona, slanje → 0-Poruke_posalji.php var. 1002, povijest → 0-Poruke_poruke_razvoj.php);
   nakon uspješnog slanja u tom načinu modal se vraća u zadano stanje (wrench isključen, tablica/povijest kao obične poruke).
   kad je uključen filtar liste „Razvoj”: samo pregled + ikona clipboard-paste (kopiraj sve razgovore u međuspremnik);
   uz svaku poruku u povijesti – mala ikona kopiranja; u međuspremnik se dodaje sufiks „ [ ID: <id> ]”.
   Ovisnosti: 0-Poruke.css, 0-Common.js (postFormData, vnlhAppBasePathname, .naslov-forme__ikone).
   API: 0-Poruke.php, 0-Poruke_lista.php, 0-Poruke_poruke.php, 0-Poruke_poruke_razvoj.php, 0-Poruke_neprocitane.php, 0-Poruke_posalji.php,
        0-Poruke_korisnici.php, 0-Poruke_brisi.php, 0-Poruke_razvoj_toggle_prikazi.php, poruke_razvoj_var_1002.php (server), common_sustav_varijable.php?id=101.
   Chat (opcionalno): dinamički 0-Chat.js + poruke_chat_*.php kad je VNLH_CHAT_DOZVOLJEN=1.
   Geometrija dijaloga (px) pamti se pri izlasku (desktop i mobitel zasebno) u localStorage i obnavlja pri sljedećem otvaranju.
   ========================================================= */
(function () {
  'use strict';

  function trim(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  function resolveApiBase() {
    var p = window.location.pathname || '';
    if (/\/html\//i.test(p) || /\/html$/i.test(p)) return '../php/';
    if (/\/php\//i.test(p)) return '';
    return 'php/';
  }

  /** URL do 0-Poruke.php iz pozicije učitane skripte 0-Poruke.js. */
  function resolveTemplateUrl(filename) {
    var u = trim(filename);
    if (!u) return u;
    if (/^https?:\/\//i.test(u) || u.charAt(0) === '/' || /^\.\.?\//.test(u)) return u;
    try {
      var nodes = document.querySelectorAll('script[src*="0-Poruke.js"]');
      var el = nodes.length ? nodes[nodes.length - 1] : null;
      if (el && el.src) {
        var scriptUrl = new URL(el.src);
        var pathname = scriptUrl.pathname;
        var jsDir = pathname.replace(/\/[^/]+$/, '/');
        var phpDir = jsDir.replace(/\/js\/$/i, '/php/');
        return scriptUrl.origin + phpDir + u.replace(/^\.\//, '');
      }
    } catch (e0) {}
    return u;
  }

  var API_BASE = resolveApiBase();
  var TEMPLATE_URL = resolveTemplateUrl('0-Poruke.php');
  /** Jedinstven prefiks id-jeva u umetnutom HTML-u (ne smije biti isti kao drugi moduli na stranici). */
  var ID_PREFIX = 'vnlh_modal_poruke';

  /** Zadani naslov zaglavlja modala Poruke (#…_header_title). */
  var PORUKE_NASLOV_DEFAULT = 'Poruke';
  /** Naslov kad je uključen način „Slanje poruke razvoju” (gumb ključa u podnožju). */
  var PORUKE_NASLOV_RAZVOJ = 'Slanje poruke razvoju';

  /** Lucide wrench – isti path kao u html/0-Poruke.html (podnožje). */
  var PORUKE_LUCIDE_WRENCH_SVG_INNER =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>';

  /**
   * Lucide clipboard-paste (https://lucide.dev/icons/clipboard-paste) – zamjena za wrench kad je uključen filtar liste „Razvoj”.
   * stroke-width nasljeđuje se s roditeljskog <svg> (1.5).
   */
  var PORUKE_LUCIDE_CLIPBOARD_PASTE_SVG_INNER =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M11 14h10"/>' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M16 4h2a2 2 0 0 1 2 2v1.344"/>' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="m17 18 4-4-4-4"/>' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/>' +
    '<rect x="8" y="2" width="8" height="4" rx="1" stroke-linecap="round" stroke-linejoin="round"/>';

  /**
   * Lucide clipboard-copy (https://lucide.dev/icons/clipboard-copy) – mala inline tipka uz poruku u filtru liste „Razvoj”.
   * Cijeli <svg> (viewBox 24×24) radi jednostavnog innerHTML na tipku; stroke nasljeđuje currentColor s .poruke__msg-copy-btn.
   */
  var PORUKE_LUCIDE_CLIPBOARD_COPY_MSG_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>' +
    '<path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>' +
    '<path d="M16 4h2a2 2 0 0 1 2 2v4"/>' +
    '<path d="M21 14H11"/>' +
    '<path d="m15 10-4 4 4 4"/>' +
    '</svg>';

  /**
   * Minimalne dimenzije dijaloga na desktopu (usklađeno s 0-Poruke.css).
   * Spremljena geometrija i nativni resize ne smiju biti manji od ovoga.
   */
  var TESTNI_MODAL_MIN_DIALOG_W = 720;
  var TESTNI_MODAL_MIN_DIALOG_H = 400;

  /**
   * ZAGLAVLJE_TABLICE_TESTNI (konceptualno – nema <thead> u DOM-u; stupci se iscrtavaju redom u <tr>).
   * Isti model kao renderTablica u 0-Poruke.js.
   *
   * | key          | tdClass            | Uloga | Moguće vrijednosti / napomena |
   * |--------------|--------------------|-------|--------------------------------|
   * | avatar       | poruke__cell--img  | Slika | img src = API Clanovi_CRUD_slika_thumb_round.php?id=id_posiljatelj; onerror → .poruke__avatar-fallback |
   * | ime          | poruke__cell--ime  | Tekst | prezime (bold), ime; prazno → „Nepoznati”/„Korisnik”; muted ako neprocitane===0 |
   * | neprocitane  | poruke__cell--count| Badge | 0 = prazno; 1–99 broj; 100+ → „...” |
   */
  var ZAGLAVLJE_TABLICE_TESTNI = [
    { key: 'avatar', tdClass: 'poruke__cell--img' },
    { key: 'ime', tdClass: 'poruke__cell--ime' },
    { key: 'neprocitane', tdClass: 'poruke__cell--count' }
  ];

  /** Keš liste s 0-Poruke_lista.php (isti JSON kao modal Poruke). */
  var testniListaPosiljatelja = [];
  /** id_posiljatelj označenog retka; povijest: testniFetchPoruke ili testniFetchPorukeRazvoj (način razvoj). */
  var testniOdabraniPosiljatelj = null;
  /**
   * Rastući broj za svaki GET povijesti: ako korisnik brzo promijeni red, zanemari odgovor starijeg zahtjeva
   * (ne prepisuje #_edit_povijest pogrešnim razgovorom).
   */
  var testniPovijestZahtjevId = 0;

  var modalLoaded = false;
  var modalOpen = false;

  var spremljenaGeometrijaTestnogModala = null;
  /** Geometrija testnog modala na mobitelu (≤768px); odvojena od desktop varijante jer su min dimenzije i centriranje drugačiji. */
  var spremljenaGeometrijaTestnogModalaMob = null;

  /** Ključevi localStorage za trajno pamćenje geometrije (širina/visina/left/top u px). */
  var LS_TESTNI_GEO_DESK = 'vnlh_poruke_testni_geo_desk';
  var LS_TESTNI_GEO_MOB = 'vnlh_poruke_testni_geo_mob';

  /**
   * Parsira JSON snap iz localStorage; vraća objekt ili null ako nije valjan (ograničenje protiv smeća/napada).
   */
  function parsirajSnapGeometrijeTestnogModala(s) {
    if (s == null || s === '') return null;
    try {
      var o = typeof s === 'string' ? JSON.parse(s) : s;
      if (!o || typeof o !== 'object') return null;
      var w = Number(o.width);
      var h = Number(o.height);
      var l = Number(o.left);
      var t = Number(o.top);
      if (!isFinite(w) || !isFinite(h) || !isFinite(l) || !isFinite(t)) return null;
      if (w < 200 || w > 5000 || h < 120 || h > 5000) return null;
      if (l < -500 || l > 10000 || t < -500 || t > 10000) return null;
      return { width: w, height: h, left: l, top: t };
    } catch (eParse) {
      return null;
    }
  }

  function ucitajGeometrijuTestnogModalaIzLocalStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      var d = parsirajSnapGeometrijeTestnogModala(localStorage.getItem(LS_TESTNI_GEO_DESK));
      if (d) spremljenaGeometrijaTestnogModala = d;
      var m = parsirajSnapGeometrijeTestnogModala(localStorage.getItem(LS_TESTNI_GEO_MOB));
      if (m) spremljenaGeometrijaTestnogModalaMob = m;
    } catch (eLs) {}
  }

  function snimiGeometrijuTestnogModalaULocalStorage(mob, snap) {
    try {
      if (typeof localStorage === 'undefined' || !snap) return;
      var key = mob ? LS_TESTNI_GEO_MOB : LS_TESTNI_GEO_DESK;
      localStorage.setItem(key, JSON.stringify(snap));
    } catch (eFull) {
      /* QuotaExceeded ili privatni način preglednika — ignoriraj, in-memory ostaje. */
    }
  }

  ucitajGeometrijuTestnogModalaIzLocalStorage();

  /** Keš korisnika za popup + (0-Poruke_korisnici.php). */
  var testniPopupKorisniciData = null;
  /**
   * Zadnji zbroj nepročitanih s 0-Poruke_neprocitane.php: globalni poll ažurira mail ikonu;
   * kad je modal otvoren, usporedba za crvenu refresh ikonu (.poruke__refresh-btn--nova).
   */
  var testniLastKnownNeprocitane = -1;
  /** Interval za GET 0-Poruke_neprocitane.php na cijeloj stranici (neovisno o modalu). */
  var porukeNeprocitaneGlobalIntervalId = null;
  /** Sekunde između poll poziva; default 30, prepisuje common_sustav_varijable.php?id=101. */
  var porukePollingSec = 30;
  var porukePollingSecUcitano = false;

  /**
   * Element modala: ID_PREFIX + suffix.
   * Prvo traži unutar korijenskog diva #ID_PREFIX (prazan suffix) — izbjegava pogrešan element ako postoji
   * kolizija id-jeva izvan modala; fallback na document.getElementById.
   */
  function id(suffix) {
    var fullId = ID_PREFIX + suffix;
    var root = document.getElementById(ID_PREFIX + '');
    if (suffix === '') return root;
    if (root) {
      var scoped = root.querySelector('#' + fullId);
      if (scoped) return scoped;
    }
    return document.getElementById(fullId);
  }

  /**
   * Testni modal Poruke: fokus ostaje na polju nove poruke (#…_edit_poruka).
   * Povijest (#…_edit_povijest) je namjerno izvan tab-reda (tabindex -1) i služi samo za scroll/dodir;
   * poziv nakon rendera povijesti ili kad se textarea omogući.
   */
  function testniFokusirajPoljePoruke() {
    try {
      var inp = id('_edit_poruka');
      if (inp && !inp.disabled && typeof inp.focus === 'function') {
        inp.focus();
      }
    } catch (eF) {}
  }

  /** Je li uključen način „Slanje poruke razvoju” (aktivan gumb ključa u podnožju). */
  function porukeJeRazvojMod() {
    var w = id('_footer_wrench');
    return !!(w && w.classList.contains('poruke__footer-wrench-btn--aktivno'));
  }

  /**
   * Je li uključen filtar liste „Razvoj” (desni toggle u retku) – tablica i GET povijesti samo tip Poruka razvoju.
   * Neovisno o načinu ključa u podnožju; kad je ključ aktivan, cijeli .poruke__toggle-row je skriven u CSS-u.
   */
  function porukeJeListaRazvojFilter() {
    var ch = id('_toggle_razvoj');
    return !!(ch && ch.checked);
  }

  /**
   * Jedinstveni red za eksport u međuspremnik: „Prezime Ime” iz retka tablice (0-Poruke_lista.php).
   */
  function testniFormatImeZaEksport(item) {
    if (!item) return 'Nepoznati korisnik';
    var p = item.prezime || '';
    var i = item.ime || '';
    var s = (p + ' ' + i).replace(/^\s+|\s+$/g, '');
    return s || 'Nepoznati korisnik';
  }

  /**
   * Iz HTTP odgovora izdvaja JSON niz poruka (tolerira BOM / upozorenja ispred prvog '[').
   * @returns {Array|null}
   */
  function testniIzvuciNizPorukaIzOdgovora(jsonTekst) {
    var t = trim(String(jsonTekst || ''));
    if (!t) return null;
    t = t.replace(/^\uFEFF/, '');
    var s = t.indexOf('[');
    var e = t.lastIndexOf(']');
    if (s < 0 || e <= s) return null;
    try {
      var arr = JSON.parse(t.substring(s, e + 1));
      return Array.isArray(arr) ? arr : null;
    } catch (eJ) {
      return null;
    }
  }

  /**
   * Blok u međuspremniku za jednog sugovornika (red tablice):
   *   1) jedan red – ime;
   *   2) sve poruke niti (primljena + odgovor), isključivo ako nije brisano (brisano !== 1 u JSON-u);
   *   3) kronološki po vrijeme_slanja: pri promjeni datuma red s dd.mm.yyyy., zatim (HH:MM) tekst poruke;
   *      na kraj retka poruke (samo ovaj izvoz, filtar liste „Razvoj”) dodaje se „ [ ID: <id> ]” ako JSON sadrži p.id.
   * testniExtractDate / testniExtractTime / testniFormatDateHR: deklaracije niže u istom modulu (hoist u IIFE).
   */
  function testniSastaviEksportBlokZaSugovornika(item, jsonTekst) {
    var linije = [testniFormatImeZaEksport(item)];
    var arr = testniIzvuciNizPorukaIzOdgovora(jsonTekst);
    if (!arr || !arr.length) {
      return linije.join('\n');
    }
    var aktivne = [];
    for (var i = 0; i < arr.length; i++) {
      var x = arr[i];
      if (!x) {
        continue;
      }
      if (Number(x.brisano) === 1) {
        continue;
      }
      aktivne.push(x);
    }
    if (!aktivne.length) {
      return linije.join('\n');
    }
    aktivne.sort(function (a, b) {
      return String(a.vrijeme_slanja || '').localeCompare(String(b.vrijeme_slanja || ''));
    });
    var zadnjiDatum = null;
    for (var j = 0; j < aktivne.length; j++) {
      var p = aktivne[j];
      var dKey = testniExtractDate(p.vrijeme_slanja);
      if (dKey !== zadnjiDatum) {
        zadnjiDatum = dKey;
        if (dKey && dKey.length >= 10) {
          linije.push(testniFormatDateHR(dKey));
        } else {
          linije.push(dKey || '—');
        }
      }
      var tm = testniExtractTime(p.vrijeme_slanja);
      if (!tm) {
        tm = '??:??';
      }
      var tekstPoruke = String(p.poruka != null ? p.poruka : '');
      /* Jedinstveni red u bazi (0-Poruke_poruke.php šalje polje id) – traženo za međuspremnik u načinu čitanja razvoju. */
      var idPoruke = p.id != null ? Number(p.id) : NaN;
      var sufiksId = !isNaN(idPoruke) && idPoruke > 0 ? ' [ ID: ' + String(idPoruke) + ' ]' : '';
      linije.push('(' + tm + ') ' + tekstPoruke + sufiksId);
    }
    return linije.join('\n');
  }

  /**
   * Kopiranje u međuspremnik (HTTPS: Clipboard API; inače textarea + execCommand).
   */
  function porukeKopirajTekstUClipboard(tekst, onGotovo) {
    var zavrsi = function (ok) {
      if (typeof onGotovo === 'function') onGotovo(!!ok);
    };
    if (!tekst) {
      zavrsi(false);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(tekst)
        .then(function () {
          zavrsi(true);
        })
        .catch(function () {
          porukeKopirajTekstExecCommand(tekst, zavrsi);
        });
      return;
    }
    porukeKopirajTekstExecCommand(tekst, zavrsi);
  }

  function porukeKopirajTekstExecCommand(tekst, zavrsi) {
    try {
      var ta = document.createElement('textarea');
      ta.value = tekst;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      zavrsi(ok);
    } catch (eC) {
      zavrsi(false);
    }
  }

  /**
   * Za svakog sugovornika iz trenutačne tablice (redoslijed kao u tablici): GET 0-Poruke_poruke.php?samo_razvoj=1,
   * zatim sastavljanje teksta i kopiranje. Sekvencijalni XHR da ne preopteretimo server.
   */
  function porukeKopirajSveRazgovoreRazvojUClipboard() {
    if (!modalOpen || !porukeJeListaRazvojFilter()) return;
    var lista = testniListaPosiljatelja || [];
    if (!lista.length) {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal('101', []);
      }
      return;
    }
    var btn = id('_footer_wrench');
    if (btn) btn.disabled = true;
    var dijelovi = [];
    var idx = 0;

    function sljedeci() {
      if (idx >= lista.length) {
        var cjelina = dijelovi.join('\n\n');
        porukeKopirajTekstUClipboard(cjelina, function (ok) {
          if (btn) btn.disabled = false;
          if (ok) {
            var staro = btn ? btn.getAttribute('title') : '';
            if (btn) {
              btn.setAttribute('title', 'Kopirano u međuspremnik');
              setTimeout(function () {
                if (btn && staro != null) btn.setAttribute('title', staro);
              }, 2000);
            }
          } else if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('101', []);
          }
        });
        return;
      }
      var item = lista[idx];
      var idP = item.id_posiljatelj;
      idx += 1;
      var url = API_BASE + '0-Poruke_poruke.php?id_posiljatelj=' + encodeURIComponent(idP) + '&samo_razvoj=1';
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr._vnlhExportGotovo) return;
        xhr._vnlhExportGotovo = true;
        var odg = xhr.status === 200 ? trim(xhr.responseText) : '';
        dijelovi.push(testniSastaviEksportBlokZaSugovornika(item, odg));
        sljedeci();
      };
      xhr.onerror = function () {
        dijelovi.push(testniSastaviEksportBlokZaSugovornika(item, ''));
        sljedeci();
      };
      xhr.send();
    }

    sljedeci();
  }

  /**
   * Ikonica u podnožju: wrench (način pisanja razvoju) ili clipboard-paste (samo pregled + kopiranje svih razgovora).
   */
  function porukeOsvjeziFooterAlatSvg() {
    var btn = id('_footer_wrench');
    var svg = btn ? btn.querySelector('.poruke__footer-wrench-icon') : null;
    if (!btn || !svg) return;
    if (porukeJeListaRazvojFilter()) {
      svg.innerHTML = PORUKE_LUCIDE_CLIPBOARD_PASTE_SVG_INNER;
      btn.classList.add('poruke__footer-wrench-btn--clipboard-mode');
      btn.setAttribute('aria-label', 'Kopiraj sve razgovore u međuspremnik');
      btn.setAttribute('title', 'Kopiraj sve razgovore (razvoj) u međuspremnik');
      btn.setAttribute('aria-pressed', 'false');
    } else {
      svg.innerHTML = PORUKE_LUCIDE_WRENCH_SVG_INNER;
      btn.classList.remove('poruke__footer-wrench-btn--clipboard-mode');
      btn.setAttribute('aria-label', 'Alat');
      btn.setAttribute('title', 'Alat');
    }
  }

  /**
   * Klik na srednji gumb podnožja: u filtru liste „Razvoj” kopiranje; inače uključivanje načina ključa (wrench).
   */
  function porukeFooterAlatKlik() {
    if (porukeJeListaRazvojFilter()) {
      porukeKopirajSveRazgovoreRazvojUClipboard();
      return;
    }
    porukeToggleFooterWrenchBtn();
  }

  /**
   * Uskladi korijen modala i tekst naslova s načinom razvoj: klasa .testni-modal--poruke-razvoj + boja u CSS-u;
   * naslov „Slanje poruke razvoju” / zadani „Poruke”.
   */
  function porukePrimijeniRazvojModNaModalu() {
    var root = id('');
    var titleEl = id('_header_title');
    if (!root) return;
    if (porukeJeRazvojMod()) {
      root.classList.add('testni-modal--poruke-razvoj');
      if (titleEl) titleEl.textContent = PORUKE_NASLOV_RAZVOJ;
    } else {
      root.classList.remove('testni-modal--poruke-razvoj');
      if (titleEl) titleEl.textContent = PORUKE_NASLOV_DEFAULT;
    }
  }

  /**
   * Gumb ključa: reset pri otvaranju/zatvaranju modala (bez testniSyncPorukaPanel – poziva ga testniOdznaciListu).
   */
  function porukeResetFooterWrenchBtn() {
    var w = id('_footer_wrench');
    if (!w) return;
    w.classList.remove('poruke__footer-wrench-btn--aktivno');
    w.setAttribute('aria-pressed', 'false');
    porukePrimijeniRazvojModNaModalu();
  }

  /** Klik na ključ: toggle + vizual + sinkronizacija polja poruke / Pošalji. */
  function porukeToggleFooterWrenchBtn() {
    var w = id('_footer_wrench');
    if (!w || w.disabled) return;
    var on = w.classList.toggle('poruke__footer-wrench-btn--aktivno');
    w.setAttribute('aria-pressed', on ? 'true' : 'false');
    porukePrimijeniRazvojModNaModalu();
    testniSyncPorukaPanel(!!testniOdabraniPosiljatelj);
    /* Povijest: u načinu razvoj GET 0-Poruke_poruke_razvoj.php; inače razgovor s retkom (sync već učitava razvoj kad nema retka). */
    if (porukeJeRazvojMod() && testniOdabraniPosiljatelj) {
      testniFetchPorukeRazvoj();
    } else if (!porukeJeRazvojMod() && testniOdabraniPosiljatelj) {
      testniFetchPoruke(testniOdabraniPosiljatelj);
    }
  }

  function porukeStopGlobalNeprocitanePolling() {
    if (porukeNeprocitaneGlobalIntervalId) {
      clearInterval(porukeNeprocitaneGlobalIntervalId);
      porukeNeprocitaneGlobalIntervalId = null;
    }
  }

  /** Boja mail ikone u naslovu ovisno o broju nepročitanih. */
  function porukeUpdateMailIconColor(neprocitane) {
    var icons = document.querySelectorAll('.naslov-forme__poruke');
    for (var im = 0; im < icons.length; im++) {
      if (neprocitane > 0) {
        icons[im].classList.add('naslov-forme__poruke--neprocitane');
      } else {
        icons[im].classList.remove('naslov-forme__poruke--neprocitane');
      }
    }
  }

  /** Boja chat ikone (nepročitane Chat poruke – ima_chat_neprocitanih u bazi). */
  function porukeUpdateChatIconColor(chatNeprocitane) {
    var icons = document.querySelectorAll('.naslov-forme__chat');
    for (var ic = 0; ic < icons.length; ic++) {
      if (chatNeprocitane > 0) {
        icons[ic].classList.add('naslov-forme__chat--neprocitane');
      } else {
        icons[ic].classList.remove('naslov-forme__chat--neprocitane');
      }
    }
  }

  /**
   * Učitava 0-Chat.js jednom (isti origin kao 0-Poruke.js) kad je chat dopušten.
   * Na load poziva window.vnlhChatBoot (fragment + vezivanje ikone).
   */
  function porukeUcitajChatModulJednom() {
    if (typeof window.VNLH_CHAT_DOZVOLJEN === 'undefined' || Number(window.VNLH_CHAT_DOZVOLJEN) !== 1) return;
    if (window.__vnlhChatModulLoaded) return;
    window.__vnlhChatModulLoaded = true;
    try {
      var nodes = document.querySelectorAll('script[src*="0-Poruke.js"]');
      var el = nodes.length ? nodes[nodes.length - 1] : null;
      if (!el || !el.src) return;
      var chatSrc = el.src.replace(/0-Poruke\.js/i, '0-Chat.js');
      var s = document.createElement('script');
      s.src = chatSrc;
      s.async = true;
      s.onload = function () {
        if (typeof window.vnlhChatBoot === 'function') window.vnlhChatBoot();
      };
      document.head.appendChild(s);
    } catch (eChatLoad) {}
  }

  /**
   * Jedan GET 0-Poruke_neprocitane.php: uvijek ažurira mail ikonu; ako je modal otvoren i broj poraste,
   * refresh tipka u zaglavlju dobije .poruke__refresh-btn--nova.
   */
  function porukeNeprocitaneGlobalTick() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + '0-Poruke_neprocitane.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = trim(xhr.responseText);
      if (!t || t.charAt(0) !== '{') return;
      try {
        var obj = JSON.parse(t);
        var n = typeof obj.neprocitane === 'number' ? obj.neprocitane : 0;
        porukeUpdateMailIconColor(n);
        var nc = typeof obj.chat_neprocitane === 'number' ? obj.chat_neprocitane : 0;
        porukeUpdateChatIconColor(nc);
        if (typeof window.vnlhChatNeprocitanePoll === 'function') window.vnlhChatNeprocitanePoll(obj);
        if (modalOpen && testniLastKnownNeprocitane >= 0 && n > testniLastKnownNeprocitane) {
          var refreshBtn = id('_refresh');
          if (refreshBtn) refreshBtn.classList.add('poruke__refresh-btn--nova');
        }
        testniLastKnownNeprocitane = n;
      } catch (ePoll) {}
    };
    xhr.send();
  }

  function porukeStartGlobalNeprocitanePolling() {
    porukeStopGlobalNeprocitanePolling();
    porukeNeprocitaneGlobalTick();
    porukeNeprocitaneGlobalIntervalId = setInterval(function () {
      if (typeof document.hidden !== 'undefined' && document.hidden) return;
      porukeNeprocitaneGlobalTick();
    }, Math.max(5, porukePollingSec) * 1000);
  }

  /** Jednokratno učitaj interval iz sustava (id=101), zatim callback (npr. pokretanje globalnog intervala). */
  function porukeUcitajIntervalPollingaJednom(cb) {
    if (porukePollingSecUcitano) {
      if (typeof cb === 'function') cb();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'common_sustav_varijable.php?id=101', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var sec = parseInt(trim(xhr.responseText), 10);
      if (!isNaN(sec) && sec > 0) porukePollingSec = sec;
      porukePollingSecUcitano = true;
      if (typeof cb === 'function') cb();
    };
    xhr.send();
  }

  function testniZatvoriPopup() {
    var popup = id('_popup_korisnici');
    if (popup) popup.style.display = 'none';
  }

  function testniTogglePopupKorisnici() {
    var popup = id('_popup_korisnici');
    if (!popup) return;
    if (popup.style.display !== 'none') {
      testniZatvoriPopup();
      return;
    }
    if (testniPopupKorisniciData) {
      testniPrikaziPopup(testniPopupKorisniciData);
    } else {
      testniFetchKorisnici(function (data) {
        testniPopupKorisniciData = data;
        testniPrikaziPopup(data);
      });
    }
  }

  function testniFetchKorisnici(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + '0-Poruke_korisnici.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      try {
        var data = JSON.parse(xhr.responseText);
        if (Array.isArray(data) && typeof callback === 'function') callback(data);
      } catch (eK) {}
    };
    xhr.send();
  }

  function testniPrikaziPopup(data) {
    var popup = id('_popup_korisnici');
    var lista = id('_popup_lista');
    var filterEl = id('_popup_filter');
    if (!popup || !lista) return;
    testniRenderPopupLista(data, lista);
    if (filterEl) filterEl.value = '';
    popup.style.display = '';
    if (filterEl) filterEl.focus();
  }

  function testniRenderPopupLista(data, container) {
    container.innerHTML = '';
    if (!data || data.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'poruke__popup-empty';
      empty.textContent = 'Nema korisnika';
      container.appendChild(empty);
      return;
    }
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var div = document.createElement('div');
      div.className = 'poruke__popup-item';
      div.textContent = (item.prezime || '') + ' ' + (item.ime || '');
      div.addEventListener(
        'click',
        (function (idK) {
          return function () {
            testniOdaberiKorisnikaZaNovuPoruku(idK);
          };
        })(item.id_korisnik)
      );
      container.appendChild(div);
    }
  }

  function testniFiltrirajPopup(tekst) {
    var lista = id('_popup_lista');
    if (!lista || !testniPopupKorisniciData) return;
    var t = trim(tekst).toLowerCase();
    if (!t) {
      testniRenderPopupLista(testniPopupKorisniciData, lista);
      return;
    }
    var filtered = [];
    for (var i = 0; i < testniPopupKorisniciData.length; i++) {
      var item = testniPopupKorisniciData[i];
      var full = ((item.prezime || '') + ' ' + (item.ime || '')).toLowerCase();
      if (full.indexOf(t) >= 0) filtered.push(item);
    }
    testniRenderPopupLista(filtered, lista);
  }

  function testniOdaberiKorisnikaZaNovuPoruku(idKorisnik) {
    testniZatvoriPopup();
    var postoji = false;
    for (var i = 0; i < testniListaPosiljatelja.length; i++) {
      if (testniListaPosiljatelja[i].id_posiljatelj === idKorisnik) {
        postoji = true;
        break;
      }
    }
    if (postoji) {
      testniSelektirajPosiljatelja(idKorisnik);
    } else {
      var ime = '';
      var prezime = '';
      if (testniPopupKorisniciData) {
        for (var j = 0; j < testniPopupKorisniciData.length; j++) {
          if (testniPopupKorisniciData[j].id_korisnik === idKorisnik) {
            prezime = testniPopupKorisniciData[j].prezime || '';
            ime = testniPopupKorisniciData[j].ime || '';
            break;
          }
        }
      }
      testniListaPosiljatelja.push({
        id_posiljatelj: idKorisnik,
        prezime: prezime,
        ime: ime,
        neprocitane: 0
      });
      renderTestniTablica(testniListaPosiljatelja);
      testniSelektirajPosiljatelja(idKorisnik);
    }
    var inp = id('_edit_poruka');
    if (inp && !inp.disabled) inp.focus();
  }

  /**
   * Lijevi stupac: pomiče vertikalni scroll .poruke__tablica-wrap dok red s id_posiljatelj = idPos
   * nije u potpunosti u vidljivom području (mali rub od 8 px).
   * Namjena: nakon „+” i odabira korisnika iz popupa red može biti izvan viewporta tablice;
   * bez ovoga korisnik ne vidi tko je odabran dok ručno ne skrola.
   * Više iteracija: nakon promjene scrollTop-a getBoundingClientRect se ponovno izračuna
   * (zaokruživanje, različite visine retka).
   */
  function porukeScrollRedPosiljateljaUVid(idPos) {
    var wrap = id('_tablica_wrap');
    var tbody = id('_tbody');
    if (!wrap || !tbody || idPos == null) return;
    var target = null;
    var rows = tbody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]._porukePosiljatelj === idPos) {
        target = rows[i];
        break;
      }
    }
    if (!target) return;

    var margin = 8;
    var maxIter = 48;
    var iter = 0;
    while (iter++ < maxIter) {
      var wRect = wrap.getBoundingClientRect();
      var tRect = target.getBoundingClientRect();
      if (tRect.top >= wRect.top + margin && tRect.bottom <= wRect.bottom - margin) return;

      var delta = 0;
      if (tRect.top < wRect.top + margin) {
        delta = tRect.top - wRect.top - margin;
      } else if (tRect.bottom > wRect.bottom - margin) {
        delta = tRect.bottom - wRect.bottom + margin;
      }
      if (delta === 0) return;
      wrap.scrollTop += delta;
    }
  }

  /** Selekcija retka + sync polja + GET povijest (selectPosiljatelj u 0-Poruke.js). */
  function testniSelektirajPosiljatelja(idPos) {
    testniOdabraniPosiljatelj = idPos;
    var tbody = id('_tbody');
    if (tbody) {
      var all = tbody.querySelectorAll('tr');
      for (var r = 0; r < all.length; r++) {
        if (all[r]._porukePosiljatelj === idPos) all[r].classList.add('poruke__row--selected');
        else all[r].classList.remove('poruke__row--selected');
      }
    }
    testniSyncPorukaPanel(true);
    if (porukeJeRazvojMod()) {
      testniFetchPorukeRazvoj();
    } else {
      testniFetchPoruke(idPos);
    }
    /* Nakon što preglednik primijeni layout (npr. upravo iscrtan tbody nakon +). */
    requestAnimationFrame(function () {
      porukeScrollRedPosiljateljaUVid(idPos);
      requestAnimationFrame(function () {
        porukeScrollRedPosiljateljaUVid(idPos);
      });
    });
  }

  function testniObrisiRazgovor(idPosiljatelj) {
    var btnBrisi = id('_brisi');
    if (btnBrisi) btnBrisi.disabled = true;
    var params = { id_posiljatelj: idPosiljatelj };
    if (porukeJeListaRazvojFilter()) {
      params.kontekst_razvoj = '1';
    }
    if (typeof window.CommonPostFormData === 'function') {
      window.CommonPostFormData(API_BASE + '0-Poruke_brisi.php', params, function (res) {
        testniOnRazgovorObrisan(res);
      });
    } else {
      var formData = new FormData();
      for (var key in params) {
        if (params.hasOwnProperty(key)) formData.append(key, params[key]);
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '0-Poruke_brisi.php', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        testniOnRazgovorObrisan(trim(xhr.responseText));
      };
      xhr.send(formData);
    }
  }

  function testniOnRazgovorObrisan(res) {
    if (res === '-1') {
      testniOdznaciListu();
      fetchTestniLista();
    } else {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(res || '101');
      }
      var btnB = id('_brisi');
      if (btnB && testniOdabraniPosiljatelj) btnB.disabled = false;
    }
  }

  /* --- Pomoćne funkcije za povijest (isti semantički model kao 0-Poruke.js: extractDate, extractTime, formatDateHR) --- */

  function testniExtractDate(dt) {
    if (!dt) return '';
    return String(dt).substring(0, 10);
  }

  function testniExtractTime(dt) {
    if (!dt) return '';
    var s = String(dt);
    var sp = s.indexOf(' ');
    if (sp >= 0 && s.length >= sp + 6) return s.substring(sp + 1, sp + 6);
    var tIdx = s.indexOf('T');
    if (tIdx >= 0 && s.length >= tIdx + 6) return s.substring(tIdx + 1, tIdx + 6);
    return '';
  }

  function testniFormatDateHR(dateStr) {
    if (!dateStr || dateStr.length < 10) return dateStr || '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts[2] + '.' + parts[1] + '.' + parts[0] + '.';
  }

  /** Ime pošiljatelja iz testniListaPosiljatelja (kao nadjiImePosiljatelja u 0-Poruke.js). */
  function testniNadjiImePosiljatelja(idPos) {
    for (var i = 0; i < testniListaPosiljatelja.length; i++) {
      if (testniListaPosiljatelja[i].id_posiljatelj === idPos) {
        var item = testniListaPosiljatelja[i];
        var p = item.prezime || '';
        var im = item.ime || '';
        if (!p && !im) return 'Nepoznati Korisnik';
        return (p + ' ' + im).replace(/^\s+|\s+$/g, '');
      }
    }
    return 'Nepoznati Korisnik';
  }

  /**
   * Jednoredni placeholder u povijesti (učitavanje, nema odabira, greška, prazan razgovor).
   * @param {HTMLElement} el #…_edit_povijest
   * @param {string} tekst prikazani tekst
   */
  function testniPovijestPostaviPlaceholder(el, tekst) {
    if (!el) return;
    el.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'testni-modal__povijest-placeholder';
    d.textContent = tekst || '';
    el.appendChild(d);
  }

  /**
   * Renderira poruke u scroll div – ista logika i CSS klase kao renderPoruke u 0-Poruke.js
   * (boje: primljena / primljena pročitana / odlazna / odlazna pročitana; .poruke__msg-procitano za kvačice).
   * @param {Array} poruke JSON s 0-Poruke_poruke.php
   * @param {string|number} idPosiljatelj sugovornik
   */
  function testniRenderPovijest(poruke, idPosiljatelj) {
    var napomena = id('_edit_povijest');
    if (!napomena) return;

    napomena.innerHTML = '';
    if (!poruke || poruke.length === 0) {
      testniPovijestPostaviPlaceholder(
        napomena,
        idPosiljatelj ? 'Nema poruka.' : 'Nema poruka upućenih razvoju.'
      );
      napomena.scrollTop = 0;
      requestAnimationFrame(function () {
        testniFokusirajPoljePoruke();
      });
      return;
    }

    var lastDate = '';
    for (var i = 0; i < poruke.length; i++) {
      var p = poruke[i];

      var datum = testniExtractDate(p.vrijeme_slanja);
      if (datum !== lastDate) {
        var sep = document.createElement('div');
        sep.className = 'poruke__datum-separator';
        sep.textContent = testniFormatDateHR(datum);
        napomena.appendChild(sep);
        lastDate = datum;
      }

      var div = document.createElement('div');
      div.className = 'poruke__msg';
      if (p.smjer === 'odgovor') {
        div.classList.add(p.procitano ? 'poruke__msg--odgovor-procitan' : 'poruke__msg--odgovor');
      } else {
        div.classList.add(p.procitano ? 'poruke__msg--primljena-procitana' : 'poruke__msg--primljena');
      }

      var autorSpan = document.createElement('span');
      autorSpan.className = 'poruke__msg-autor';
      autorSpan.textContent = p.smjer === 'odgovor' ? 'Ti:' : testniNadjiImePosiljatelja(idPosiljatelj) + ':';
      div.appendChild(autorSpan);

      div.appendChild(document.createTextNode(p.poruka || ''));

      var vrSpan = document.createElement('span');
      vrSpan.className = 'poruke__msg-vrijeme';
      vrSpan.textContent = testniExtractTime(p.vrijeme_slanja);
      if (p.procitano) {
        var checkSpan = document.createElement('span');
        checkSpan.className = 'poruke__msg-procitano';
        checkSpan.textContent = ' \u2713\u2713';
        vrSpan.appendChild(checkSpan);
      }
      div.appendChild(vrSpan);
      napomena.appendChild(div);
    }
    napomena.scrollTop = napomena.scrollHeight;
    requestAnimationFrame(function () {
      testniFokusirajPoljePoruke();
    });
  }

  /**
   * GET 0-Poruke_poruke.php – isti endpoint i JSON kao fetchPoruke u 0-Poruke.js.
   * Renderira #…_edit_povijest (DOM); nakon uspjeha osvježava listu (nepročitane) kao glavni modal.
   */
  function testniFetchPoruke(idPosiljatelj) {
    var pov = id('_edit_povijest');
    var zahtjev = ++testniPovijestZahtjevId;
    /** Snimljeno pri slanju GET-a – ako korisnik promijeni toggle prije odgovora, ne crtamo krivi tip niti. */
    var listaRazvojZaOvajZahtjev = porukeJeListaRazvojFilter();
    if (pov) testniPovijestPostaviPlaceholder(pov, 'Učitavanje…');
    var url = API_BASE + '0-Poruke_poruke.php?id_posiljatelj=' + encodeURIComponent(idPosiljatelj);
    if (listaRazvojZaOvajZahtjev) url += '&samo_razvoj=1';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (zahtjev !== testniPovijestZahtjevId) return;
      if (!modalOpen || porukeJeRazvojMod() || testniOdabraniPosiljatelj !== idPosiljatelj) return;
      if (listaRazvojZaOvajZahtjev !== porukeJeListaRazvojFilter()) return;
      var t = trim(xhr.responseText);
      var el = id('_edit_povijest');
      if (!el) return;
      if (!t || t.charAt(0) !== '[') {
        testniPovijestPostaviPlaceholder(el, 'Podaci nisu dostupni.');
        requestAnimationFrame(function () {
          testniFokusirajPoljePoruke();
        });
        return;
      }
      try {
        var poruke = JSON.parse(t);
        testniRenderPovijest(poruke, idPosiljatelj);
        fetchTestniLista();
      } catch (eP) {
        testniPovijestPostaviPlaceholder(el, 'Greška pri čitanju odgovora.');
        requestAnimationFrame(function () {
          testniFokusirajPoljePoruke();
        });
      }
    };
    xhr.send();
  }

  /**
   * GET 0-Poruke_poruke_razvoj.php – sve poruke tipa „Poruka razvoju” koje je logirani korisnik poslao.
   * Isti JSON oblik kao 0-Poruke_poruke.php; testniPovijestZahtjevId dijeli s testniFetchPoruke (međusobno poništavanje).
   */
  function testniFetchPorukeRazvoj() {
    var pov = id('_edit_povijest');
    var zahtjev = ++testniPovijestZahtjevId;
    if (pov) testniPovijestPostaviPlaceholder(pov, 'Učitavanje…');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + '0-Poruke_poruke_razvoj.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (zahtjev !== testniPovijestZahtjevId) return;
      if (!modalOpen || !porukeJeRazvojMod()) return;
      var t = trim(xhr.responseText);
      var el = id('_edit_povijest');
      if (!el) return;
      if (!t || t.charAt(0) !== '[') {
        testniPovijestPostaviPlaceholder(el, 'Podaci nisu dostupni.');
        requestAnimationFrame(function () {
          testniFokusirajPoljePoruke();
        });
        return;
      }
      try {
        var poruke = JSON.parse(t);
        testniRenderPovijest(poruke, 0);
      } catch (eR) {
        testniPovijestPostaviPlaceholder(el, 'Greška pri čitanju povijesti za razvoj.');
        requestAnimationFrame(function () {
          testniFokusirajPoljePoruke();
        });
      }
    };
    xhr.send();
  }

  /**
   * POST 0-Poruke_posalji.php (CommonPostFormData ili XHR + FormData).
   * @param {number} idPrimatelj sugovornik iz tablice kad slanjeRazvoj nije true
   * @param {string} tekst
   * @param {boolean} [slanjeRazvoj] true → slanje_razvoj=1, primatelji iz var. 1002 (zarez), tip Poruka razvoju
   */
  function testniPosaljiNaServer(idPrimatelj, tekst, slanjeRazvoj) {
    var btnPosalji = id('_posalji');
    var editPoruka = id('_edit_poruka');
    if (btnPosalji) btnPosalji.disabled = true;
    var params = {
      poruka: tekst,
      id_razgovor: '0'
    };
    if (slanjeRazvoj) {
      params.slanje_razvoj = '1';
      params.id_primatelj = '0';
    } else {
      params.id_primatelj = idPrimatelj;
      /* Nastavak niti u kontekstu filtra liste „Razvoj” – server postavlja tip Poruka razvoju (ne miješati sa slanje_razvoj). */
      if (porukeJeListaRazvojFilter()) {
        params.kontekst_razvoj = '1';
      }
    }
    if (typeof window.CommonPostFormData === 'function') {
      window.CommonPostFormData(API_BASE + '0-Poruke_posalji.php', params, function (res) {
        testniOnOdgovorPoslan(res, editPoruka, btnPosalji, idPrimatelj, !!slanjeRazvoj);
      });
    } else {
      var formData = new FormData();
      for (var key in params) {
        if (params.hasOwnProperty(key)) formData.append(key, params[key]);
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '0-Poruke_posalji.php', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        testniOnOdgovorPoslan(trim(xhr.responseText), editPoruka, btnPosalji, idPrimatelj, !!slanjeRazvoj);
      };
      xhr.send(formData);
    }
  }

  /**
   * Nakon odgovora 0-Poruke_posalji.php – kao onOdgovorPoslan u 0-Poruke.js (uspjeh -1, inače modal greške).
   * Uspjeh slanja „razvoju”: namjerno isključuje način ključa i vraća prikaz običnih poruka (očekivano ponašanje nakon jedne poruke razvoju).
   */
  function testniOnOdgovorPoslan(res, editPoruka, btnPosalji, idPrimatelj, slanjeRazvoj) {
    if (res === '-1') {
      if (editPoruka) editPoruka.value = '';
      if (btnPosalji) btnPosalji.disabled = true;
      testniOsvjeziPosaljiDisabled();
      if (slanjeRazvoj) {
        /*
         * Ne zovemo testniFetchPorukeRazvoj – korisnik izlazi iz načina ključa; tablica i naslov vraćaju se odmah.
         * Lista (brojači) + opcionalno povijest običnog razgovora ako je red još u memoriji ostao odabran.
         */
        porukeResetFooterWrenchBtn();
        fetchTestniLista();
        testniSyncPorukaPanel(!!testniOdabraniPosiljatelj);
        if (testniOdabraniPosiljatelj) {
          testniFetchPoruke(testniOdabraniPosiljatelj);
        }
      } else {
        testniFetchPoruke(idPrimatelj);
        fetchTestniLista();
      }
    } else {
      if (typeof window.showPorukaModal === 'function') {
        var code = res || '101';
        var parts = code.split(',');
        var mainCode = parts[0];
        var replacements = parts.length > 1 ? [parts.slice(1).join(',')] : [];
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[mainCode]) {
          window.showPorukaModal(mainCode, replacements);
        } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101']) {
          window.showPorukaModal('101', []);
        }
      }
      if (btnPosalji) btnPosalji.disabled = false;
      testniOsvjeziPosaljiDisabled();
    }
  }

  /** Prazni oznaku retka u tablici testnog modala (bez API poziva). */
  function testniOdznaciListu() {
    testniOdabraniPosiljatelj = null;
    var tbody = id('_tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('poruke__row--selected');
    }
    testniSyncPorukaPanel(false);
  }

  /**
   * Stanje polja „Poruka” i tipke Pošalji: kao clearSelection u 0-Poruke.js (textarea disabled dok nema odabranog pošiljatelja).
   * @param {boolean} imaSelekciju true nakon klika na red u tablici
   */
  function testniSyncPorukaPanel(imaSelekciju) {
    var inp = id('_edit_poruka');
    var btn = id('_posalji');
    var btnBrisi = id('_brisi');
    var pov = id('_edit_povijest');
    var listaR = porukeJeListaRazvojFilter();
    var razvoj = porukeJeRazvojMod();
    if (inp) {
      /*
       * Filtar liste „Razvoj”: samo pregled – polje poruke i slanje uvijek isključeni (prednost nad načinom ključa).
       */
      if (listaR) {
        inp.disabled = true;
        inp.value = '';
      } else if (razvoj) {
        inp.disabled = false;
        if (imaSelekciju) inp.value = '';
      } else {
        inp.disabled = !imaSelekciju;
        inp.value = '';
      }
    }
    if (btn) btn.disabled = true;
    if (btnBrisi) btnBrisi.disabled = !imaSelekciju;
    if (pov && !imaSelekciju) {
      if (listaR) {
        testniPovijestPostaviPlaceholder(pov, 'Odaberite red u tablici (samo pregled razgovora razvoju).');
      } else if (razvoj) {
        testniFetchPorukeRazvoj();
      } else {
        testniPovijestPostaviPlaceholder(pov, 'Odaberite pošiljatelja u tablici…');
      }
    }
    testniOsvjeziPosaljiDisabled();
    porukeOsvjeziFooterAlatSvg();
    /* Fokus na poruku čim je omogućena (u filtru liste „Razvoj” polje je read-only – ne forsiraj fokus). */
    if (!listaR && (imaSelekciju || razvoj)) {
      requestAnimationFrame(function () {
        testniFokusirajPoljePoruke();
      });
    }
  }

  /**
   * Tipka Pošalji: identično retku u setupHandlers za _input u 0-Poruke.js:
   *   btnPosalji.disabled = trim(inputEl.value) === '' || !selectedPosiljatelj;
   * Kad nema retka, textarea je disabled i selectedPosiljatelj je null → tipka ostaje disabled.
   */
  function testniOsvjeziPosaljiDisabled() {
    var inp = id('_edit_poruka');
    var btn = id('_posalji');
    if (!btn || !inp) return;
    if (porukeJeListaRazvojFilter()) {
      btn.disabled = true;
      return;
    }
    var prazan = trim(inp.value) === '';
    if (porukeJeRazvojMod()) {
      btn.disabled = prazan;
    } else {
      btn.disabled = prazan || !testniOdabraniPosiljatelj;
    }
  }

  /**
   * Jedna ćelija retka tablice prema ključu iz ZAGLAVLJE_TABLICE_TESTNI.
   * @param {string} key avatar | ime | neprocitane
   * @param {object} item element liste s 0-Poruke_lista.php
   * @returns {HTMLTableCellElement|null}
   */
  function testniGraditeljCelije(key, item) {
    if (key === 'avatar') {
      var tdImg = document.createElement('td');
      tdImg.className = 'poruke__cell--img';
      var img = document.createElement('img');
      img.className = 'poruke__avatar';
      img.src =
        API_BASE +
        'Clanovi_CRUD_slika_thumb_round.php?id=' +
        encodeURIComponent(item.id_posiljatelj) +
        '&t=' +
        Date.now();
      img.alt = '';
      img.draggable = false;
      img.onerror = function () {
        var fallback = document.createElement('div');
        fallback.className = 'poruke__avatar-fallback';
        fallback.textContent = '?';
        this.parentNode.replaceChild(fallback, this);
      };
      tdImg.appendChild(img);
      return tdImg;
    }
    if (key === 'ime') {
      var tdIme = document.createElement('td');
      tdIme.className = 'poruke__cell--ime';
      var prezime = item.prezime || '';
      var ime = item.ime || '';
      if (!prezime && !ime) {
        prezime = 'Nepoznati';
        ime = 'Korisnik';
      }
      var muted = item.neprocitane === 0 ? ' poruke__ime-line--muted' : '';
      var line1 = document.createElement('span');
      line1.className = 'poruke__ime-line poruke__ime-line--bold' + muted;
      line1.textContent = prezime;
      var line2 = document.createElement('span');
      line2.className = 'poruke__ime-line' + muted;
      line2.textContent = ime;
      tdIme.appendChild(line1);
      tdIme.appendChild(line2);
      return tdIme;
    }
    if (key === 'neprocitane') {
      var tdCount = document.createElement('td');
      tdCount.className = 'poruke__cell--count';
      if (item.neprocitane > 0) {
        var badge = document.createElement('span');
        badge.className = 'poruke__count-badge';
        badge.textContent = item.neprocitane > 99 ? '...' : String(item.neprocitane);
        tdCount.appendChild(badge);
      }
      return tdCount;
    }
    return null;
  }

  /**
   * Iscrtaj tbody iz keša; disable toggle kao u 0-Poruke.js kad nema razgovora i filter je „sve”.
   */
  function renderTestniTablica(data) {
    var tbody = id('_tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var toggleInput = id('_toggle');
    var toggleLabel = id('_toggle_label');
    var imaRazgovora = data && data.length > 0;
    var togChecked = toggleInput && toggleInput.checked;
    var shouldDisable = !imaRazgovora && !togChecked;
    if (toggleInput) toggleInput.disabled = shouldDisable;
    if (toggleLabel) {
      if (shouldDisable) toggleLabel.classList.add('poruke__toggle-label--disabled');
      else toggleLabel.classList.remove('poruke__toggle-label--disabled');
    }

    for (var i = 0; i < (data || []).length; i++) {
      var item = data[i];
      var tr = document.createElement('tr');
      tr._porukePosiljatelj = item.id_posiljatelj;
      if (testniOdabraniPosiljatelj === item.id_posiljatelj) {
        tr.classList.add('poruke__row--selected');
      }
      for (var c = 0; c < ZAGLAVLJE_TABLICE_TESTNI.length; c++) {
        var col = ZAGLAVLJE_TABLICE_TESTNI[c];
        var td = testniGraditeljCelije(col.key, item);
        if (td) tr.appendChild(td);
      }
      (function (idPos) {
        tr.addEventListener('click', function () {
          testniSelektirajPosiljatelja(idPos);
        });
      })(item.id_posiljatelj);
      tbody.appendChild(tr);
    }
    porukeOsvjeziFooterAlatSvg();
  }

  /** GET 0-Poruke_lista.php – isti parametar samo_neprocitane kao modal Poruke. */
  function fetchTestniLista() {
    var toggleInput = id('_toggle');
    var samoNeprocitane = toggleInput && toggleInput.checked ? '1' : '0';
    var url = API_BASE + '0-Poruke_lista.php?samo_neprocitane=' + samoNeprocitane;
    if (porukeJeListaRazvojFilter()) {
      url += '&samo_razvoj=1';
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = trim(xhr.responseText);
      if (!t || t.charAt(0) !== '[') return;
      try {
        var novaLista = JSON.parse(t);
        if (testniOdabraniPosiljatelj) {
          var nadjen = false;
          for (var i = 0; i < novaLista.length; i++) {
            if (novaLista[i].id_posiljatelj === testniOdabraniPosiljatelj) {
              nadjen = true;
              break;
            }
          }
          /* U filtru „Razvoj” ne vraćamo starog sugovornika iz keša normalnog tipa – lista mora odgovarati GET-u. */
          if (!nadjen && !porukeJeListaRazvojFilter()) {
            for (var j = 0; j < testniListaPosiljatelja.length; j++) {
              if (testniListaPosiljatelja[j].id_posiljatelj === testniOdabraniPosiljatelj) {
                novaLista.push(testniListaPosiljatelja[j]);
                break;
              }
            }
          }
        }
        testniListaPosiljatelja = novaLista;
        if (testniOdabraniPosiljatelj) {
          var josUVidiku = false;
          for (var k = 0; k < novaLista.length; k++) {
            if (novaLista[k].id_posiljatelj === testniOdabraniPosiljatelj) {
              josUVidiku = true;
              break;
            }
          }
          if (!josUVidiku) {
            testniOdznaciListu();
          }
        }
        renderTestniTablica(testniListaPosiljatelja);
      } catch (e1) {}
    };
    xhr.send();
  }

  function ensureModalLoaded(cb) {
    if (modalLoaded) {
      if (typeof cb === 'function') cb();
      return;
    }
    var sep = TEMPLATE_URL.indexOf('?') >= 0 ? '&' : '?';
    var ver = typeof window !== 'undefined' && window.VNLH_VERZIJA ? String(window.VNLH_VERZIJA) : '';
    var fetchUrl = ver ? TEMPLATE_URL + sep + 'v=' + encodeURIComponent(ver) : TEMPLATE_URL;
    fetch(fetchUrl, { cache: 'no-store' })
      .then(function (r) {
        return r.text();
      })
      .then(function (html) {
        var replaced = html.replace(/__ID_PREFIX__/g, ID_PREFIX);
        var mount = document.createElement('div');
        mount.innerHTML = replaced;
        var fragment = mount.firstElementChild;
        if (fragment) document.body.appendChild(fragment);
        modalLoaded = true;
        setupHandlers();
        if (typeof cb === 'function') cb();
      })
      .catch(function () {});
  }

  /**
   * Dijalog je unutar flex-centriranog overlaya – bez ovoga nativni resize:both često mijenja
   * širinu/visinu simetrično oko središta. fixed + eksplicitni left/top/width/height sidre gornji
   * lijevi kut pa se širenje vuče u smjeru povlačenja (donji desni grip).
   */
  function anchorDialogZaResize(dialog) {
    if (!dialog) return;
    var r = dialog.getBoundingClientRect();
    dialog.style.position = 'fixed';
    dialog.style.margin = '0';
    dialog.style.left = Math.round(r.left) + 'px';
    dialog.style.top = Math.round(r.top) + 'px';
    dialog.style.width = Math.round(r.width) + 'px';
    dialog.style.height = Math.round(r.height) + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
  }

  function resetDialogGeometriju(dialog) {
    if (!dialog) return;
    dialog.style.position = '';
    dialog.style.left = '';
    dialog.style.top = '';
    dialog.style.width = '';
    dialog.style.height = '';
    dialog.style.margin = '';
    dialog.style.right = '';
    dialog.style.bottom = '';
    dialog.style.minWidth = '';
    dialog.style.minHeight = '';
  }

  function jeMobitelZaTestniModal() {
    return typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  /**
   * Min/max širina i visina testnog modala na mobu (usklađeno s initTestniMobileDialogResizeHandle).
   * vw/vh za ograničenje left/top pri ponovnom otvaranju ili rotaciji.
   */
  function testniModalMobGranice() {
    var minW = 260;
    var minH = 160;
    var vw = typeof window.innerWidth === 'number' ? window.innerWidth : 400;
    var vh = typeof window.innerHeight === 'number' ? window.innerHeight : 600;
    var maxW = Math.max(minW, Math.min(vw * 0.98, vw - 8));
    var maxH = Math.max(minH, Math.min(vh * 0.92, vh - 16));
    return { minW: minW, minH: minH, maxW: maxW, maxH: maxH, vw: vw, vh: vh };
  }

  /**
   * Primijeni spremljenu mob geometriju uz clamp dimenzija i pozicije u trenutačni viewport (rotacija, drugačiji ekran).
   */
  function primijeniSpremljenuMobGeometriju(dialog, geo) {
    if (!dialog || !geo) return;
    var g = testniModalMobGranice();
    var w = Math.max(g.minW, Math.min(g.maxW, Math.round(geo.width)));
    var h = Math.max(g.minH, Math.min(g.maxH, Math.round(geo.height)));
    var left = Math.round(geo.left);
    var top = Math.round(geo.top);
    var margin = 4;
    var maxLeft = Math.max(margin, g.vw - w - margin);
    var maxTop = Math.max(margin, g.vh - h - margin);
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    if (left > maxLeft) left = maxLeft;
    if (top > maxTop) top = maxTop;
    dialog.style.position = 'fixed';
    dialog.style.margin = '0';
    dialog.style.left = left + 'px';
    dialog.style.top = top + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.width = w + 'px';
    dialog.style.height = h + 'px';
    dialog.style.minWidth = g.minW + 'px';
    dialog.style.minHeight = g.minH + 'px';
  }

  function primijeniGeometrijuDijalogaNakonOtvaranja(dialog) {
    if (!dialog || !modalOpen) return;
    var mob = jeMobitelZaTestniModal();
    if (mob && window.innerWidth > 0) {
      resetDialogGeometriju(dialog);
      if (spremljenaGeometrijaTestnogModalaMob) {
        primijeniSpremljenuMobGeometriju(dialog, spremljenaGeometrijaTestnogModalaMob);
        return;
      }
      var dialogW = Math.max(280, window.innerWidth * 0.95);
      var dialogH = Math.max(200, Math.min(window.innerHeight * 0.75, window.innerHeight - 24));
      dialog.style.position = 'fixed';
      dialog.style.margin = '10px auto 0';
      dialog.style.left = '0';
      dialog.style.right = '0';
      dialog.style.top = '10px';
      dialog.style.width = dialogW + 'px';
      dialog.style.height = dialogH + 'px';
      dialog.style.minWidth = '260px';
      dialog.style.minHeight = '160px';
      return;
    }
    if (spremljenaGeometrijaTestnogModala && !mob) {
      dialog.style.position = 'fixed';
      dialog.style.margin = '0';
      dialog.style.right = 'auto';
      dialog.style.bottom = 'auto';
      var wSp = Math.round(spremljenaGeometrijaTestnogModala.width);
      var hSp = Math.round(spremljenaGeometrijaTestnogModala.height);
      dialog.style.width = Math.max(TESTNI_MODAL_MIN_DIALOG_W, wSp) + 'px';
      dialog.style.height = Math.max(TESTNI_MODAL_MIN_DIALOG_H, hSp) + 'px';
      dialog.style.left = Math.round(spremljenaGeometrijaTestnogModala.left) + 'px';
      dialog.style.top = Math.round(spremljenaGeometrijaTestnogModala.top) + 'px';
      return;
    }
    anchorDialogZaResize(dialog);
  }

  /**
   * Mobitel (≤768px): kutni handle (#…_dialog_resize) u podnožju mijenja širinu i visinu .testni-modal__dialog
   * (cijeli panel), isti model kao setupResizeHandle u 0-Obrada_Slike.js. Na PC-u handle je display:none.
   */
  function initTestniMobileDialogResizeHandle(modal) {
    var handle = id('_dialog_resize');
    var dialog = modal.querySelector('.testni-modal__dialog');
    if (!handle || !dialog || handle._vnlhTestniDialogResizeBound) return;

    function jeMobitelResize() {
      return typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    }

    function startResize(clientX, clientY) {
      if (!jeMobitelResize()) return;
      var g = testniModalMobGranice();
      var startX = clientX;
      var startY = clientY;
      var startW = dialog.offsetWidth;
      var startH = dialog.offsetHeight;

      function move(cx, cy) {
        var dw = cx - startX;
        var dh = cy - startY;
        var newW = Math.max(g.minW, Math.min(g.maxW, Math.round(startW + dw)));
        var newH = Math.max(g.minH, Math.min(g.maxH, Math.round(startH + dh)));
        dialog.style.width = newW + 'px';
        dialog.style.height = newH + 'px';
      }

      function onMouseMove(e) {
        move(e.clientX, e.clientY);
      }
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onTouchStart(e) {
      if (!jeMobitelResize()) return;
      if (e.touches.length !== 1) return;
      e.preventDefault();
      var g = testniModalMobGranice();
      var startX = e.touches[0].clientX;
      var startY = e.touches[0].clientY;
      var startW = dialog.offsetWidth;
      var startH = dialog.offsetHeight;

      function onTouchMove(ev) {
        if (ev.touches.length !== 1) return;
        ev.preventDefault();
        var cx = ev.touches[0].clientX;
        var cy = ev.touches[0].clientY;
        var dw = cx - startX;
        var dh = cy - startY;
        var newW = Math.max(g.minW, Math.min(g.maxW, Math.round(startW + dw)));
        var newH = Math.max(g.minH, Math.min(g.maxH, Math.round(startH + dh)));
        dialog.style.width = newW + 'px';
        dialog.style.height = newH + 'px';
      }
      function onTouchEnd() {
        document.removeEventListener('touchmove', onTouchMove, { passive: false });
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
      }
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
      document.addEventListener('touchcancel', onTouchEnd);
    }

    handle.addEventListener('mousedown', function (e) {
      if (!jeMobitelResize()) return;
      if (e.button !== 0) return;
      e.preventDefault();
      startResize(e.clientX, e.clientY);
    });
    handle.addEventListener('touchstart', onTouchStart, { passive: false });
    handle._vnlhTestniDialogResizeBound = true;
  }

  function setupHandlers() {
    var modal = id('');
    if (!modal) return;
    var dialog = modal.querySelector('.testni-modal__dialog');
    var header = id('_header');

    if (header && dialog) {
      header.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        e.preventDefault();
        var rect = dialog.getBoundingClientRect();
        var startX = e.clientX;
        var startY = e.clientY;
        var startLeft = rect.left;
        var startTop = rect.top;
        dialog.style.position = 'fixed';
        dialog.style.margin = '0';
        dialog.style.left = startLeft + 'px';
        dialog.style.top = startTop + 'px';
        if (!dialog.style.width) dialog.style.width = Math.round(rect.width) + 'px';
        if (!dialog.style.height) dialog.style.height = Math.round(rect.height) + 'px';
        header.style.userSelect = 'none';
        function move(ev) {
          dialog.style.left = Math.round(startLeft + (ev.clientX - startX)) + 'px';
          dialog.style.top = Math.round(startTop + (ev.clientY - startY)) + 'px';
        }
        function up() {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          header.style.userSelect = '';
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }

    var btnRef = id('_refresh');
    if (btnRef) {
      btnRef.addEventListener('click', function () {
        if (typeof window.vnlhTestniModalRefresh === 'function') {
          try {
            window.vnlhTestniModalRefresh();
          } catch (eRef) {}
        }
        btnRef.classList.remove('poruke__refresh-btn--nova');
        testniOdznaciListu();
        fetchTestniLista();
      });
    }

    var btnNova = id('_nova');
    if (btnNova) {
      btnNova.addEventListener('click', function () {
        testniTogglePopupKorisnici();
      });
    }

    var btnBrisi = id('_brisi');
    if (btnBrisi) {
      btnBrisi.addEventListener('click', function () {
        if (!testniOdabraniPosiljatelj || btnBrisi.disabled) return;
        testniObrisiRazgovor(testniOdabraniPosiljatelj);
      });
    }

    var btnWrench = id('_footer_wrench');
    if (btnWrench) {
      btnWrench.addEventListener('click', function () {
        porukeFooterAlatKlik();
      });
    }

    document.addEventListener('mousedown', function (e) {
      var popup = id('_popup_korisnici');
      if (!popup || popup.style.display === 'none') return;
      var btnN = id('_nova');
      if (popup.contains(e.target) || (btnN && btnN.contains(e.target))) return;
      testniZatvoriPopup();
    });

    var popupFilter = id('_popup_filter');
    if (popupFilter) {
      popupFilter.addEventListener('input', function () {
        testniFiltrirajPopup(this.value);
      });
    }

    var toggleInput = id('_toggle');
    var toggleText = id('_toggle_text');
    if (toggleInput) {
      toggleInput.addEventListener('change', function () {
        if (toggleText) {
          toggleText.textContent = this.checked ? 'Samo nepročitane' : 'Sve poruke';
        }
        testniOdznaciListu();
        fetchTestniLista();
      });
    }

    var toggleRazvoj = id('_toggle_razvoj');
    if (toggleRazvoj) {
      toggleRazvoj.addEventListener('change', function () {
        /*
         * Način ključa (pisanje razvoju) i filtar liste „Razvoj” ne smiju biti aktivni istovremeno:
         * pri uključivanju filtra resetiramo wrench pa sinkroniziramo ikonu (clipboard-paste).
         */
        if (porukeJeListaRazvojFilter()) {
          porukeResetFooterWrenchBtn();
        }
        testniOdznaciListu();
        fetchTestniLista();
      });
    }

    var wrapRazvoj = id('_toggle_razvoj_wrap');
    if (wrapRazvoj) {
      fetch(API_BASE + '0-Poruke_razvoj_toggle_prikazi.php', { cache: 'no-store' })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          if (!wrapRazvoj) return;
          if (d && d.prikazi) {
            wrapRazvoj.style.display = '';
            wrapRazvoj.setAttribute('aria-hidden', 'false');
          } else {
            wrapRazvoj.style.display = 'none';
            wrapRazvoj.setAttribute('aria-hidden', 'true');
          }
        })
        .catch(function () {
          if (wrapRazvoj) {
            wrapRazvoj.style.display = 'none';
            wrapRazvoj.setAttribute('aria-hidden', 'true');
          }
        });
    }

    var btnPov = id('_povratak');
    if (btnPov) {
      btnPov.addEventListener('click', function () {
        closeTestniModal();
      });
    }

    var editPoruka = id('_edit_poruka');
    var btnPosalji = id('_posalji');
    if (editPoruka && btnPosalji) {
      /* Isti listener kao u 0-Poruke.js (input): samo sinkronizacija disabled na tipki Pošalji. */
      editPoruka.addEventListener('input', function () {
        testniOsvjeziPosaljiDisabled();
      });
      editPoruka.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !btnPosalji.disabled) {
          e.preventDefault();
          btnPosalji.click();
        }
      });
      btnPosalji.addEventListener('click', function () {
        if (btnPosalji.disabled) return;
        if (porukeJeListaRazvojFilter()) return;
        var tekst = trim(editPoruka.value);
        if (!tekst) return;
        var razvoj = porukeJeRazvojMod();
        if (!razvoj && !testniOdabraniPosiljatelj) return;
        /*
         * Način ključa (wrench): uvijek POST s slanje_razvoj=1 (primatelji iz var. 1002).
         * Ne smije ovisiti o testniOdabraniPosiljatelj: tablica je u CSS-u skrivena, ali selekcija iz
         * „normalnog” prikaza može ostati u memoriji – stara grana slala običnu poruku sugovorniku, pa je
         * testniFetchPoruke odbacio odgovor (guard: porukeJeRazvojMod()) i korisnik je vidio „povratak” u normalno ponašanje.
         */
        if (razvoj) {
          testniPosaljiNaServer(0, tekst, true);
        } else {
          testniPosaljiNaServer(testniOdabraniPosiljatelj, tekst, false);
        }
      });
    }

    initTestniMobileDialogResizeHandle(modal);

    /* Povijest ne smije zadržati fokus (scroll/touch ostaje); programski fokus na kontejner → natrag na textarea. */
    var povHist = id('_edit_povijest');
    if (povHist && !povHist._vnlhPorukePovijestFocusGuard) {
      povHist._vnlhPorukePovijestFocusGuard = true;
      povHist.addEventListener('focus', function () {
        try {
          povHist.blur();
        } catch (eBl) {}
        testniFokusirajPoljePoruke();
      });
    }
    if (modal && !modal._vnlhPorukeModalFocusinGuard) {
      modal._vnlhPorukeModalFocusinGuard = true;
      modal.addEventListener(
        'focusin',
        function (e) {
          var povF = id('_edit_povijest');
          var inpF = id('_edit_poruka');
          if (!povF || !inpF || !e || !e.target) return;
          var t = e.target;
          if (t === inpF || (typeof inpF.contains === 'function' && inpF.contains(t))) return;
          if (t === povF || (typeof povF.contains === 'function' && povF.contains(t))) {
            try {
              if (typeof t.blur === 'function') t.blur();
            } catch (eB) {}
            testniFokusirajPoljePoruke();
          }
        },
        true
      );
    }
  }

  function openTestniModal() {
    ensureModalLoaded(function () {
      var modal = id('');
      if (!modal) return;
      var dialog = modal.querySelector('.testni-modal__dialog');
      var overlayEl = modal.querySelector('.kontrola-modal__overlay');
      if (overlayEl) {
        overlayEl.style.opacity = '';
        overlayEl.style.pointerEvents = '';
      }
      modal.style.display = '';
      modal.style.visibility = '';
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.remove('kontrola-modal--open');
      modal.classList.add('testni-modal--pending-layout');
      document.body.style.overflow = 'hidden';
      /*
       * Odmah resetiraj selekciju i disabled polja (kao clearSelection pri otvaranju modala Poruke) —
       * ne čekati rAF: inače jedan kadar prikazuje staro stanje (npr. textarea enabled nakon zatvaranja s odabranim redom).
       */
      var ti0 = id('_toggle');
      var tt0 = id('_toggle_text');
      if (ti0 && ti0.checked) ti0.checked = false;
      if (tt0) tt0.textContent = 'Sve poruke';
      var trz = id('_toggle_razvoj');
      if (trz) trz.checked = false;
      /* Prvo isključi način razvoj (ključ) pa odznaci listu – inače sync misli da je razvoj još aktivan. */
      porukeResetFooterWrenchBtn();
      testniOdznaciListu();
      var rbOpen = id('_refresh');
      if (rbOpen) rbOpen.classList.remove('poruke__refresh-btn--nova');
      testniLastKnownNeprocitane = -1;
      modalOpen = true;
      requestAnimationFrame(function () {
        if (!modalOpen || !dialog) return;
        try {
          primijeniGeometrijuDijalogaNakonOtvaranja(dialog);
        } finally {
          modal.classList.remove('testni-modal--pending-layout');
          modal.classList.add('kontrola-modal--open');
        }
        /* Lista: dohvat nakon što je UI već u „nema selekcije” stanju. */
        fetchTestniLista();
      });
    });
  }

  function closeTestniModal() {
    var modal = id('');
    if (!modal) return;
    testniZatvoriPopup();
    var leftCol = modal.querySelector('.poruke__left');
    if (leftCol) leftCol.style.flex = '';
    var dialog = modal.querySelector('.testni-modal__dialog');
    var mobZatvori = jeMobitelZaTestniModal();
    if (dialog && dialog.offsetWidth > 0 && dialog.offsetHeight > 0) {
      var rect = dialog.getBoundingClientRect();
      var snap = {
        width: dialog.offsetWidth,
        height: dialog.offsetHeight,
        left: rect.left,
        top: rect.top
      };
      if (mobZatvori) {
        spremljenaGeometrijaTestnogModalaMob = snap;
      } else {
        spremljenaGeometrijaTestnogModala = snap;
      }
      snimiGeometrijuTestnogModalaULocalStorage(mobZatvori, snap);
    }
    resetDialogGeometriju(dialog);
    var overlayEl = modal.querySelector('.kontrola-modal__overlay');
    if (overlayEl) {
      overlayEl.style.opacity = '0';
      overlayEl.style.pointerEvents = 'none';
    }
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('kontrola-modal--open', 'testni-modal--pending-layout');
    modalOpen = false;
    porukeResetFooterWrenchBtn();
    /* Sljedeće otvaranje: textarea mora biti disabled dok korisnik ne odabere red (kao zatvaranje modala Poruke). */
    testniOdznaciListu();
    document.body.style.overflow = '';
    if (document.activeElement && modal.contains(document.activeElement)) {
      if (typeof document.activeElement.blur === 'function') document.activeElement.blur();
    }
  }

  /**
   * Chat ikona (Lucide messages-square) lijevo od pošte; PHP postavlja window.VNLH_CHAT_DOZVOLJEN (1/0).
   * Umeće se prije pošte: insertBefore(chat, odjava), zatim mail insertBefore(mail, odjava) → redoslijed chat | mail | odjava.
   * Klik: 0-Chat.js (učitava se iz porukeUcitajChatModulJednom → vnlhChatBoot).
   */
  function vnlhInjectNaslovChat() {
    try {
      if (typeof window.VNLH_CHAT_DOZVOLJEN === 'undefined' || Number(window.VNLH_CHAT_DOZVOLJEN) !== 1) return;
      var path = window.location.pathname || '';
      if (/Login\.(html|php)/i.test(path)) return;
      if (document.body && document.body.classList.contains('login-win')) return;

      var list = document.querySelectorAll('.naslov-forme');
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.querySelector('.naslov-forme__chat')) continue;
        var wrapper = el.querySelector('.naslov-forme__ikone');
        var odjava = wrapper ? wrapper.querySelector('.naslov-forme__odjava') : null;
        if (!wrapper || !odjava) continue;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'naslov-forme__chat';
        btn.setAttribute('aria-label', 'Chat');
        btn.title = 'Chat';
        btn.innerHTML =
          '<svg class="naslov-forme__chat-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>';
        /* Klik obrađuje 0-Chat.js (wireChatIconClicks) – ovdje nema praznog handlera da ne „pregazi” lazy učitavanje. */
        wrapper.insertBefore(btn, odjava);
      }
    } catch (eChat) {}
  }

  /**
   * Mail ikona u .naslov-forme (lijevo od odjave). Jedan klik otvara modal nakon kratke pauze;
   * dvoklik otkida timer i odmah otvara modal (isti modal kao klik).
   */
  function vnlhInjectNaslovPoruke() {
    try {
      var path = window.location.pathname || '';
      if (/Login\.(html|php)/i.test(path)) return;
      if (document.body && document.body.classList.contains('login-win')) return;

      var list = document.querySelectorAll('.naslov-forme');
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.querySelector('.naslov-forme__poruke')) continue;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'naslov-forme__poruke';
        btn.setAttribute('aria-label', 'Poruke');
        btn.title = 'Poruke';

        var span = document.createElement('span');
        span.className = 'poruke-icon--mail';
        span.setAttribute('aria-hidden', 'true');
        btn.appendChild(span);

        var mailKlikTimer = null;
        btn.addEventListener('click', function (e) {
          if (e.detail !== 1) return;
          if (mailKlikTimer) clearTimeout(mailKlikTimer);
          mailKlikTimer = setTimeout(function () {
            mailKlikTimer = null;
            openTestniModal();
          }, 280);
        });
        btn.addEventListener('dblclick', function (e) {
          e.preventDefault();
          if (mailKlikTimer) {
            clearTimeout(mailKlikTimer);
            mailKlikTimer = null;
          }
          openTestniModal();
        });

        var wrapper = el.querySelector('.naslov-forme__ikone');
        if (wrapper) {
          var odjava = wrapper.querySelector('.naslov-forme__odjava');
          if (odjava) {
            wrapper.insertBefore(btn, odjava);
          } else {
            wrapper.appendChild(btn);
          }
        } else {
          el.appendChild(btn);
        }
      }
    } catch (eInj) {}
  }

  /** DOMContentLoaded: mail ikona + interval nepročitanih (mail + refresh u modalu). */
  function porukeInitStranice() {
    var path = window.location.pathname || '';
    if (/Login\.(html|php)/i.test(path)) return;
    if (document.body && document.body.classList.contains('login-win')) return;

    vnlhInjectNaslovChat();
    vnlhInjectNaslovPoruke();
    porukeUcitajChatModulJednom();
    porukeUcitajIntervalPollingaJednom(function () {
      porukeStartGlobalNeprocitanePolling();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !modalOpen) return;
    var popup = id('_popup_korisnici');
    if (popup && popup.style.display !== 'none') {
      testniZatvoriPopup();
      e.stopPropagation();
      return;
    }
    closeTestniModal();
    e.stopPropagation();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', porukeInitStranice);
  } else {
    porukeInitStranice();
  }

  window.vnlhOpenTestniModal = openTestniModal;
  window.vnlhCloseTestniModal = closeTestniModal;
  window.VnlhPorukeOpenModal = openTestniModal;
  window.VnlhPorukeOpenModalFromNew = openTestniModal;
})();
