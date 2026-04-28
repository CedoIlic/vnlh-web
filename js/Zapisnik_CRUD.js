/* Zapisnik_CRUD.js – inicijalizacija stranice Zapisnik (prava, tab, zaglavlje, CRUD; stupnjevi id_loza; dok nema lože: tab, Upis/Izbriši, polja disabled; geo labele: .kontrola-labela--disabled). */
// @ts-nocheck
(function () {
  'use strict';
  /* Prava na tipkama (Upis / Izbriši): Duznosnici_Drzave_Regije_Loze_sve.php?html_fajl=Zapisnik_CRUD.html (geo), ne common_prava_crud — isto kao Clanovi_Loza_CRUD. */

  var API_BASE = '../php/';

  /**
   * URL do php/ ispod app korijena (npr. /app/html/… → /app/php/…).
   * Dvostruki pathname.replace(…/…$) pogađa krivi php/ kad je struktura drugačija — new URL('./../php/' + f, href) slijedi uobičajeni MPA raspored.
   * @param {string} file — npr. Duznosnici_Drzave_Regije_Loze_sve.php
   * @returns {string}
   */
  function getApiUrl(file) {
    var f = String(file || '').replace(/^\//, '');
    try {
      return new URL('./../php/' + f, window.location.href).href;
    } catch (e) {
      var p = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
      return window.location.origin + p + '/php/' + f;
    }
  }

  function trimZ(s) {
    return s == null ? '' : String(s).replace(/^\s+|\s+$/g, '');
  }

  /** Puni URL za Stupnjevi_CRUD_sve.php s id_loza (baza: loze → id_obred + id_tip_loze; stupnjevi ograničeni enumom tipa ako je id_tip_loze postavljen) – ne spaja query u getApiPath kao jedan string. */
  function zapisnikStupnjeviUrlZaIdLozu(idLoza) {
    var idS = idLoza != null ? String(idLoza).replace(/^\s+|\s+$/g, '') : '';
    if (!idS) return '';
    try {
      var u = new URL('../php/Stupnjevi_CRUD_sve.php', window.location.href);
      u.searchParams.set('id_loza', idS);
      return u.href;
    } catch (e) {
      return getApiUrl('Stupnjevi_CRUD_sve.php') + '?id_loza=' + encodeURIComponent(idS);
    }
  }

  /** Očitaj id lože: value, inače odabrana <option> (nakon programskog .value ponekad kratko nije u syncu). */
  function zapisnikIdOdabraneLozISelecta() {
    if (!selectLoza) return '';
    var v = trimZ(selectLoza.value);
    if (v) return v;
    var si = selectLoza.selectedIndex;
    if (si > 0 && selectLoza.options[si]) {
      v = trimZ(selectLoza.options[si].value);
      if (v) return v;
    }
    return '';
  }

  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');

  /* Geo keš: window.vnlhGeo* u 0-Filteri_Po_Ogranicenjima.js. Kaskada: Država → Regija → Loža, bez tablice. */

  /**
   * Labele u zaglavlju (for= Država / Regija / Loža) – klasa .kontrola-labela--disabled (0-Kontrole.css) u skladu s disabled na <select>.
   */
  function zapisnikSyncGeoLabels() {
    var parovi = [
      { el: selectDrzava, forId: 'select_drzava' },
      { el: selectRegija, forId: 'select_regija' },
      { el: selectLoza, forId: 'select_loza' }
    ];
    var k;
    for (k = 0; k < parovi.length; k++) {
      var p = parovi[k];
      if (!p.el) continue;
      var lab = document.querySelector('label[for="' + p.forId + '"]');
      if (!lab) continue;
      if (p.el.disabled) lab.classList.add('kontrola-labela--disabled');
      else lab.classList.remove('kontrola-labela--disabled');
    }
  }

  /**
   * Dok nije odabrana loža: tab (kartice), polja u prvom tabu, Upis / Izbriši su disabled. Povratak ostaje aktivan.
   * Prava zastavice: vnlhPrimijeniPravaCrud i dalje upravlja vidljivošću (hidden); ovdje samo disabled za vidljive gumbe.
   * Min. visina vanjskog panela s trakom: data-resize-min-px postavlja zapisnikScheduleMinVisinuResiza (sadržaj + 12px u tabu).
   */
  function zapisnikPostaviKontroleOvisnoLozi() {
    var imaLozu = !!zapisnikIdOdabraneLozISelecta();
    var tabRoot = document.getElementById('zapisnikKontrolaTab');
    if (tabRoot) {
      /* Vizual: Zapisnik_CRUD.css .zapisnik-crud__tab--onemogucen (sjene, boje labela, ugniježdeni panel). */
      tabRoot.classList.toggle('zapisnik-crud__tab--onemogucen', !imaLozu);
      var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
      var a;
      for (a = 0; a < kartice.length; a++) {
        kartice[a].disabled = !imaLozu;
      }
    }
    var inpD = document.getElementById('zapisnik_datum_radova');
    if (inpD) inpD.disabled = !imaLozu;
    var selS = document.getElementById('zapisnik_select_stupanj_radova');
    if (selS) {
      selS.disabled = !imaLozu;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_stupanj_radova');
    }
    var selT = document.getElementById('zapisnik_select_tip_radova');
    if (selT) {
      selT.disabled = !imaLozu;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_tip_radova');
    }
    var taLoza = document.getElementById('zapisnik_loza_ucesnici');
    if (taLoza) taLoza.disabled = !imaLozu;
    var bTipEllipsis = document.getElementById('zapisnik_btn_tip_ellipsis');
    if (bTipEllipsis) bTipEllipsis.disabled = !imaLozu;
    /* Ovjera zapisnika: čekboxi u drugom ugniježdenom panelu. */
    var ovrCbIds = [
      'zapisnik_cb_ovjera_prije_casni_majstor',
      'zapisnik_cb_ovjera_prije_odg_inspektor',
      'zapisnik_cb_ovjera_nakon_casni_majstor',
      'zapisnik_cb_ovjera_nakon_tajnik',
      'zapisnik_cb_ovjera_nakon_govornik'
    ];
    for (var oi = 0; oi < ovrCbIds.length; oi++) {
      var cb = document.getElementById(ovrCbIds[oi]);
      if (cb) cb.disabled = !imaLozu;
    }
    var bUpis = document.getElementById('btnUpisi');
    var bBr = document.getElementById('btnIzbrisi');
    if (bUpis && !bUpis.hidden) bUpis.disabled = !imaLozu;
    if (bBr && !bBr.hidden) bBr.disabled = !imaLozu;
  }

  function zapisnikOsvjeziLoziGrupeIFormu() {
    zapisnikSyncGeoLabels();
    zapisnikPostaviKontroleOvisnoLozi();
    zapisnikScheduleMinVisinuResiza();
  }

  /* --- Minimalna visina #zapisnikPanel za traku (0-Kontrole: data-resize-min-px, getLimits) --- */

  var _zapisnikMinHVisRaf = null;
  var _zapisnikMinHResizeT = null;
  /** Jednokratno: postavi inline visinu=proračun (kao i min); ne dirati nakon toga (korisnik trakom). */
  var _zapisnikPocetnaVisinaPostavljena = false;

  /** Dodatni razmak na izračunatoj min. visini (15 + 12 + 6 px: traka, zaobljenja, subpixel, UI) – uz zbroj ostatka. */
  var ZAPISNIK_MIN_VIS_DODATNO_PX = 33;

  /**
   * Mjeri min. visinu vanjskog panela: zaglavlje (Država/…) + traka taba (kartice) + sadržaj prvog taba
   * (#zapisnikKontrolaTabPanel0: oba ugniježdena panela + padding-bottom 12px u .kontrola-tab__panel) + traka resiza
   * u tijelu + podnožje + ZAPISNIK_MIN_VIS_DODATNO_PX (15+12+6). Tijelo taba mora uvijek imati mjesta za oba unutarnja panela i 12px ispod donjeg – ne ovisi
   * o ostalim tabovima (kratki zaslonski odlomci). Panel se privremeno izmjeri izvan flex-lanca (body, fixed, isti
   * sadržajni prsten kao u .kontrola-tab__tijelo) da flex rastezanje ne iskrivi očitanje.
   * @returns {number} Pixels, zaokruženo gore, ili 0 ako nema elemenata.
   */
  function zapisnikIzracunajMinVisinuVanjskogPanelaPx() {
    var z = document.getElementById('zapisnikPanel');
    var tabR = document.getElementById('zapisnikKontrolaTab');
    if (!z || !tabR) return 0;
    var tij = tabR.querySelector('.kontrola-tab__tijelo');
    if (!tij) return 0;
    var p0 = document.getElementById('zapisnikKontrolaTabPanel0');
    if (!p0) return 0;

    var karts = tabR.querySelectorAll('.kontrola-tab__kartica');
    var a;
    var activeIdx = 0;
    for (a = 0; a < karts.length; a++) {
      if (karts[a].classList.contains('kontrola-tab__kartica--aktivna')) {
        activeIdx = a;
        break;
      }
    }

    var csT = getComputedStyle(tij);
    var pl = parseFloat(csT.paddingLeft) || 0;
    var pr = parseFloat(csT.paddingRight) || 0;
    var pt = parseFloat(csT.paddingTop) || 0;
    var pb = parseFloat(csT.paddingBottom) || 0;
    var contentW = Math.max(0, Math.round(tij.getBoundingClientRect().width) - pl - pr);
    if (contentW < 120) {
      contentW = Math.max(120, Math.round((tij.parentElement && tij.parentElement.getBoundingClientRect().width) || window.innerWidth || 320) - 32);
    }

    var parent = p0.parentNode;
    var nxt = p0.nextSibling;
    if (!parent) return 0;
    parent.removeChild(p0);
    p0.removeAttribute('hidden');
    p0.setAttribute('style', 'box-sizing:border-box;visibility:hidden;position:fixed;left:-40000px;top:0;width:' + contentW + 'px;');
    document.body.appendChild(p0);
    var hPanel0 = p0.offsetHeight;
    document.body.removeChild(p0);
    p0.removeAttribute('style');
    if (nxt) parent.insertBefore(p0, nxt);
    else parent.appendChild(p0);
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabR, activeIdx);

    if (!(hPanel0 > 0) || !isFinite(hPanel0)) return 0;
    var maxP = hPanel0;

    var trk = tabR.querySelector('.kontrola-tab__traka');
    var hTraka = trk ? trk.offsetHeight : 0;
    var hTij = pt + maxP + pb;
    var bar = z.querySelector('.kontrola-panel__resize-bar');
    var hBar = bar && bar.offsetHeight > 0 ? bar.offsetHeight : 28;
    var head = z.querySelector('.zapisnik-crud__panel-header');
    var foot = z.querySelector('.kontrola-panel__footer');
    var hHead = head ? head.offsetHeight : 0;
    var hFooter = foot ? foot.offsetHeight : 0;
    var total = hHead + hTraka + hTij + hBar + hFooter + ZAPISNIK_MIN_VIS_DODATNO_PX;
    if (!(total > 0) || !isFinite(total)) return 0;
    return Math.ceil(total);
  }

  /**
   * Postavi #zapisnikPanel na zadanu visinu (px) – ista shema kao applyPanelResizeHeight u 0-Kontrole.js (stubac flex).
   * @param {HTMLElement} el
   * @param {number} hPx
   */
  function zapisnikPostaviPocetnuVisinuPanela(el, hPx) {
    if (!el || !(hPx > 0) || !isFinite(hPx)) return;
    el.style.height = Math.round(hPx) + 'px';
    var pr = el.parentElement;
    if (pr && pr.nodeType === 1 && typeof getComputedStyle !== 'undefined') {
      var pds = getComputedStyle(pr);
      if (pds && pds.display === 'flex' && (pds.flexDirection === 'column' || pds.flexDirection === 'column-reverse')) {
        el.style.flex = '0 0 ' + Math.round(hPx) + 'px';
      } else {
        el.style.flex = '';
      }
    } else {
      el.style.flex = '';
    }
  }

  /**
   * Ažurira data-resize-min-px na #zapisnikPanel; pri prvom uspješnom proračunu postavlja i inicijalnu visinu (isto kao min).
   * Donja granična vrijednost 280 px; korisnički resize trakom poslije ne prepisujemo.
   */
  function zapisnikPrimijeniMinVisinuResiza() {
    var el = document.getElementById('zapisnikPanel');
    if (!el) return;
    var px = zapisnikIzracunajMinVisinuVanjskogPanelaPx();
    if (px < 1) return;
    var hPx = Math.max(280, px);
    el.setAttribute('data-resize-min-px', String(hPx));
    if (!_zapisnikPocetnaVisinaPostavljena) {
      zapisnikPostaviPocetnuVisinuPanela(el, hPx);
      _zapisnikPocetnaVisinaPostavljena = true;
    }
  }

  function zapisnikScheduleMinVisinuResiza() {
    if (_zapisnikMinHVisRaf) cancelAnimationFrame(_zapisnikMinHVisRaf);
    _zapisnikMinHVisRaf = requestAnimationFrame(function () {
      _zapisnikMinHVisRaf = null;
      zapisnikPrimijeniMinVisinuResiza();
    });
  }

  /** Postavi/makni CSS klasu kontrola-select--auto-locked na wrapperu oko <select> (jedna dozvoljena opcija). */
  function setAutoLockedClass(selectEl, locked) {
    if (!selectEl) return;
    var wrapper = selectEl.closest ? selectEl.closest('.kontrola-select') : null;
    if (!wrapper) return;
    if (locked) wrapper.classList.add('kontrola-select--auto-locked');
    else wrapper.classList.remove('kontrola-select--auto-locked');
  }

  function popuniSelectIzKeša(sel, arr, placeholder, kontrolaId) {
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    sel.appendChild(opt0);
    for (var i = 0; i < (arr || []).length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? String(arr[i].id) : '';
      opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
      sel.appendChild(opt);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) KontroleRefreshCustomSelect(kontrolaId);
  }

  function popuniRegijeIzKeša(idDrzava, callback) {
    setAutoLockedClass(selectRegija, false);
    if (!selectRegija) {
      zapisnikOsvjeziLoziGrupeIFormu();
      if (callback) callback();
      return;
    }
    if (!idDrzava) {
      popuniSelectIzKeša(selectRegija, [], '— Odaberi regiju —', 'select_regija');
      selectRegija.disabled = true;
      popuniLozeIzKeša('', function () {});
      if (callback) callback();
      return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano =
      typeof window.vnlhGeoFiltrirajRegijePoDrzavi === 'function' ? window.vnlhGeoFiltrirajRegijePoDrzavi(g.regije, idDrzava) : [];
    popuniSelectIzKeša(selectRegija, filtrirano, '— Odaberi regiju —', 'select_regija');

    if (filtrirano.length === 1) {
      selectRegija.value = String(filtrirano[0].id);
      selectRegija.disabled = true;
      setAutoLockedClass(selectRegija, true);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_regija');
      popuniLozeIzKeša(selectRegija.value, callback);
    } else {
      selectRegija.disabled = filtrirano.length === 0;
      popuniLozeIzKeša('', function () {});
      if (callback) callback();
    }
  }

  function popuniLozeIzKeša(idRegija, callback) {
    setAutoLockedClass(selectLoza, false);
    function finishLoza() {
      zapisnikOsvjeziLoziGrupeIFormu();
      if (typeof callback === 'function') callback();
    }
    if (!selectLoza) {
      finishLoza();
      return;
    }
    if (!idRegija) {
      popuniSelectIzKeša(selectLoza, [], '— Odaberi ložu —', 'select_loza');
      selectLoza.disabled = true;
      zapisnikUpdateHeaderLogo();
      puniSelectStupanjRadovaZapisnik();
      finishLoza();
      return;
    }
    var g2 = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano =
      typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function' ? window.vnlhGeoFiltrirajLozePoRegiji(g2.loze, idRegija) : [];
    popuniSelectIzKeša(selectLoza, filtrirano, '— Odaberi ložu —', 'select_loza');

    if (filtrirano.length === 1) {
      selectLoza.value = String(filtrirano[0].id);
      selectLoza.disabled = true;
      setAutoLockedClass(selectLoza, true);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
      zapisnikUpdateHeaderLogo();
      puniSelectStupanjRadovaZapisnik();
      finishLoza();
    } else {
      selectLoza.disabled = filtrirano.length === 0;
      zapisnikUpdateHeaderLogo();
      puniSelectStupanjRadovaZapisnik();
      finishLoza();
    }
  }

  /**
   * Jedan GET Duznosnici_Drzave_Regije_Loze_sve (html_fajl=Zapisnik_CRUD.html); puni Država i kaskadu.
   * upis_izmjena / brisanje_sloga primjenjuju se na vnlhPrimijeniPravaCrud.
   */
  function ucitajPravaGeo(callback) {
    if (typeof window.vnlhGeoOgranicenjaUcitaj !== 'function') {
      zapisnikOsvjeziLoziGrupeIFormu();
      if (callback) callback();
      return;
    }
    var url =
      typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
        ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Zapisnik_CRUD.html')
        : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') +
            '?html_fajl=' +
            encodeURIComponent('Zapisnik_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = g.drzave || [];

      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');

      var ui = g.upis_izmjena != null ? parseInt(g.upis_izmjena, 10) : 0;
      var bs = g.brisanje_sloga != null ? parseInt(g.brisanje_sloga, 10) : 0;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(ui, bs);

      if (drz.length === 1 && selectDrzava) {
        selectDrzava.value = String(drz[0].id);
        selectDrzava.disabled = true;
        setAutoLockedClass(selectDrzava, true);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        popuniRegijeIzKeša(selectDrzava.value, callback);
      } else {
        setAutoLockedClass(selectDrzava, false);
        if (selectDrzava) selectDrzava.disabled = false;
        popuniRegijeIzKeša('', function () {});
        if (callback) callback();
      }
    });
  }

  /**
   * Logo u zaglavlju: Loze_CRUD_slika.php (kao clanoviLozaUpdateTablicaHeaderLogo u Clanovi_Loza_CRUD).
   * Zajednički id #clanovi_loza_tablica_logo radi iste CSS klase okvira.
   */
  function zapisnikUpdateHeaderLogo() {
    var img = document.getElementById('clanovi_loza_tablica_logo');
    var frame = img && img.closest ? img.closest('.clanovi-loza-crud__tablica-header-logo-frame') : null;
    if (!img || !frame) return;
    var idLoza = selectLoza ? trimZ(selectLoza.value) : '';
    var placeholderSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.onload = null;
    img.onerror = null;
    if (!idLoza) {
      img.hidden = true;
      img.src = placeholderSrc;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      return;
    }
    frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    img.hidden = true;
    img.onload = function () {
      if (img.naturalWidth > 0) {
        img.hidden = false;
        frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      } else {
        img.hidden = true;
        frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      }
    };
    img.onerror = function () {
      img.hidden = true;
      img.src = placeholderSrc;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    };
    img.src = API_BASE + 'Loze_CRUD_slika.php?id=' + encodeURIComponent(idLoza) + '&t=' + String(Date.now());
  }

  var _zapisnikLogoSyncRaf = null;

  /** Isti algoritam kao clanoviLozaSyncTablicaHeaderLogoSize: --clanovi-loza-logo-side na .clanovi-loza-crud__tablica-header. */
  function zapisnikSyncHeaderLogoSize() {
    if (_zapisnikLogoSyncRaf) cancelAnimationFrame(_zapisnikLogoSyncRaf);
    _zapisnikLogoSyncRaf = requestAnimationFrame(function () {
      _zapisnikLogoSyncRaf = null;
      try {
        var root = document.getElementById('zapisnikPanel');
        if (!root) return;
        var header = root.querySelector('.clanovi-loza-crud__tablica-header');
        var kontrole = root.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
        var wrap = root.querySelector('.clanovi-loza-crud__tablica-header-logo-wrap');
        if (!header || !kontrole || !wrap) return;
        var csW = getComputedStyle(wrap);
        if (csW.display === 'none') {
          header.style.removeProperty('--clanovi-loza-logo-side');
          return;
        }
        var h = kontrole.getBoundingClientRect().height;
        if (!(h > 0) || !isFinite(h)) return;
        var csH = getComputedStyle(header);
        var pt = parseFloat(csH.paddingTop) || 0;
        var pb = parseFloat(csH.paddingBottom) || 0;
        var side = Math.floor(pt + h + pb - 2);
        if (side < 1) return;
        var hw = header.getBoundingClientRect().width;
        if (hw > 0 && isFinite(hw)) {
          var maxByHeader = Math.floor(hw * 0.52);
          if (maxByHeader > 0) side = Math.min(side, maxByHeader);
        }
        header.style.setProperty('--clanovi-loza-logo-side', side + 'px');
      } finally {
        zapisnikScheduleMinVisinuResiza();
      }
    });
  }

  /**
   * Puni #zapisnik_select_stupanj_radova: Stupnjevi_CRUD_sve.php?id_loza= (vrijednost #select_loza).
   * Na serveru: loze → id_obred i id_tip_loze; ako je tip postavljen, samo stupnjevi iz loze_tip_stupanj_enum (nadležnost, pozicija 1).
   */
  function puniSelectStupanjRadovaZapisnik() {
    setTimeout(puniSelectStupanjRadovaZapisnikOdmah, 0);
  }

  function puniSelectStupanjRadovaZapisnikOdmah() {
    var sel = document.getElementById('zapisnik_select_stupanj_radova');
    if (!sel) return;

    function resetSamoPrazanSelect() {
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi stupanj —';
      sel.appendChild(opt0);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_stupanj_radova');
    }

    var idLozaZaZahtjev = zapisnikIdOdabraneLozISelecta();
    if (!idLozaZaZahtjev) {
      resetSamoPrazanSelect();
      zapisnikScheduleMinVisinuResiza();
      return;
    }

    var stupUrl = zapisnikStupnjeviUrlZaIdLozu(idLozaZaZahtjev);
    if (!stupUrl) {
      resetSamoPrazanSelect();
      zapisnikScheduleMinVisinuResiza();
      return;
    }

    var xhrS = new XMLHttpRequest();
    xhrS.open('GET', stupUrl, true);
    xhrS.onreadystatechange = function () {
      if (xhrS.readyState !== 4) return;
      if (zapisnikIdOdabraneLozISelecta() !== idLozaZaZahtjev) {
        return;
      }
      if (xhrS.status < 200 || xhrS.status >= 300) {
        return;
      }
      var textS = (xhrS.responseText || '').replace(/^\uFEFF/, '').trim();
      if (textS === '105' || textS.indexOf('200,') === 0) {
        resetSamoPrazanSelect();
        zapisnikScheduleMinVisinuResiza();
        return;
      }
      var arrSt = [];
      if (textS !== '') {
        if (textS.charAt(0) === '[') {
          try {
            arrSt = JSON.parse(textS);
          } catch (eS) {}
        } else {
          try {
            var parsed = JSON.parse(textS);
            if (Array.isArray(parsed)) {
              arrSt = parsed;
            }
          } catch (e2) {}
        }
      }
      if (!Array.isArray(arrSt)) {
        arrSt = [];
      }
      var niz = arrSt && arrSt.length ? arrSt : [];
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0b = document.createElement('option');
      opt0b.value = '';
      opt0b.textContent = '— Odaberi stupanj —';
      sel.appendChild(opt0b);
      var j;
      for (j = 0; j < niz.length; j++) {
        var o = niz[j];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = (o.stupanj != null ? String(o.stupanj) + '\u00B0, ' : '') + (o.naziv != null ? o.naziv : '');
        if (o.stupanj != null) opt.dataset.stupanj = String(o.stupanj);
        sel.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_stupanj_radova');
      zapisnikScheduleMinVisinuResiza();
    };
    xhrS.send();
  }

  /**
   * Puni #zapisnik_select_tip_radova iz Radovi_Tip_CRUD_sve.php (jednom pri učitavanju stranice; nije vezano za ložu).
   */
  function puniSelectTipRadovaZapisnik() {
    var sel = document.getElementById('zapisnik_select_tip_radova');
    if (!sel) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Radovi_Tip_CRUD_sve.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || xhr.status < 200 || xhr.status >= 300) return;
      var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
      var arr = [];
      try { arr = JSON.parse(text); } catch (e) {}
      if (!Array.isArray(arr)) arr = [];
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi tip —';
      sel.appendChild(opt0);
      for (var i = 0; i < arr.length; i++) {
        var opt = document.createElement('option');
        opt.value = arr[i].id != null ? String(arr[i].id) : '';
        opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
        sel.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_tip_radova');
      zapisnikScheduleMinVisinuResiza();
    };
    xhr.send();
  }

  /**
   * Prazan <input type="date">: klasa date-empty; WebKit učitava „placeholder” u datetime-edit, ne ::placeholder.
   * Boja u CSS-u: var(--select_placeholder) kao .kontrola-select--placeholder (0-Kontrole.css).
   */
  function syncZapisnikDatumRadovaEmptyClass(el) {
    if (!el || el.type !== 'date') return;
    if (el.value === '') el.classList.add('date-empty');
    else el.classList.remove('date-empty');
  }

  function onReady() {
    var root = document.getElementById('zapisnikKontrolaTab');
    if (typeof KontroleTabInit === 'function') {
      KontroleTabInit(root);
    }
    if (root) {
      /* Tab promjena: sadržaj se mijenja (drugi tab) → ponovno izračunaj min. visinu za traku. */
      root.addEventListener('click', function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('.kontrola-tab__kartica')) {
          zapisnikScheduleMinVisinuResiza();
        }
      });
      root.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight' && ev.key !== 'Home' && ev.key !== 'End') return;
        if (!ev.target || !ev.target.closest || !ev.target.closest('.kontrola-tab__traka')) return;
        setTimeout(function () {
          zapisnikScheduleMinVisinuResiza();
        }, 0);
      });
    }
    puniSelectStupanjRadovaZapisnik();

    puniSelectTipRadovaZapisnik();

    var inpDatumRadova = document.getElementById('zapisnik_datum_radova');
    if (inpDatumRadova) {
      syncZapisnikDatumRadovaEmptyClass(inpDatumRadova);
      inpDatumRadova.addEventListener('change', function () {
        syncZapisnikDatumRadovaEmptyClass(inpDatumRadova);
      });
      inpDatumRadova.addEventListener('input', function () {
        syncZapisnikDatumRadovaEmptyClass(inpDatumRadova);
      });
    }

    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza) selectLoza.disabled = true;
    zapisnikOsvjeziLoziGrupeIFormu();

    if (selectDrzava) {
      selectDrzava.addEventListener('change', function () {
        var id = trimZ(this.value);
        popuniRegijeIzKeša(id, function () {
          zapisnikUpdateHeaderLogo();
          zapisnikSyncHeaderLogoSize();
        });
      });
    }
    if (selectRegija) {
      selectRegija.addEventListener('change', function () {
        var id = trimZ(this.value);
        popuniLozeIzKeša(id, function () {
          zapisnikUpdateHeaderLogo();
          zapisnikSyncHeaderLogoSize();
        });
      });
    }
    if (selectLoza) {
      selectLoza.addEventListener('change', function () {
        zapisnikUpdateHeaderLogo();
        zapisnikSyncHeaderLogoSize();
        puniSelectStupanjRadovaZapisnik();
        zapisnikOsvjeziLoziGrupeIFormu();
      });
    }

    ucitajPravaGeo(function () {
      zapisnikUpdateHeaderLogo();
      zapisnikSyncHeaderLogoSize();
      puniSelectStupanjRadovaZapisnik();
    });

    if (typeof ResizeObserver !== 'undefined') {
      var kH = document.querySelector('#zapisnikPanel .clanovi-loza-crud__tablica-header-kontrole');
      if (kH) {
        var roZ = new ResizeObserver(function () {
          zapisnikSyncHeaderLogoSize();
        });
        roZ.observe(kH);
      }
    }
    zapisnikSyncHeaderLogoSize();
    setTimeout(function () {
      zapisnikSyncHeaderLogoSize();
    }, 0);
    setTimeout(function () {
      zapisnikSyncHeaderLogoSize();
    }, 200);
    setTimeout(zapisnikScheduleMinVisinuResiza, 0);
    setTimeout(zapisnikScheduleMinVisinuResiza, 150);
    setTimeout(zapisnikScheduleMinVisinuResiza, 500);
    window.addEventListener('load', function () {
      zapisnikScheduleMinVisinuResiza();
    });
    window.addEventListener('resize', function () {
      if (_zapisnikMinHResizeT) clearTimeout(_zapisnikMinHResizeT);
      _zapisnikMinHResizeT = setTimeout(function () {
        _zapisnikMinHResizeT = null;
        zapisnikScheduleMinVisinuResiza();
      }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  /** Povratak: isti obrazac kao drugi CRUD (ref → referrer → Meni). Upis / Izbriši – logika s backendom kasnije. */
  (function initPovratak() {
    var btnPovratak = document.getElementById('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) {
        try {
          var u = new URL(ref, window.location.href);
          if (u.origin === window.location.origin) {
            window.location.href = u.href;
            return;
          }
        } catch (e) {}
      }
      if (document.referrer) {
        try {
          var u2 = new URL(document.referrer);
          if (u2.origin === window.location.origin) {
            window.location.href = u2.href;
            return;
          }
        } catch (e2) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();
})();
