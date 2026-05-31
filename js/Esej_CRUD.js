/* Esej_CRUD.js – Eseji (geo-blok, logo lože, tab Opći podaci + tab Esej, CRUD tipke). */
// @ts-nocheck
(function () {
  'use strict';

  var API_BASE = '../php/';

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

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /* Geo selekti — rana referenca da custom select u event ticku ne zakasni. */
  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza   = document.getElementById('select_loza');

  /** ID trenutno učitanog/upisanog eseja (mod 1); null u modu 0. */
  var esejTrenutniId = null;
  /** ID odabranog autora (clanovi.id); null ako nije odabran. */
  var esejAutorClanId = null;

  /* ============================================================
   * Mod upisa: 0 = novi esej, 1 = izmjena postojećeg
   * ============================================================ */

  function esejInicijalizirajModUpisaIzUrla() {
    var v = 0;
    try {
      var sp = new URLSearchParams(window.location.search || '');
      var raw = sp.get('mod_upisa_eseja');
      if (raw !== null && raw !== '') v = parseInt(raw, 10) === 1 ? 1 : 0;
    } catch (eM) {}
    window.mod_upisa_eseja = v;
  }
  esejInicijalizirajModUpisaIzUrla();

  function esejJeModKorekcije() {
    return window.mod_upisa_eseja === 1;
  }

  function esejPrimijeniFooterPremaModuUpisa() {
    var bUpis = document.getElementById('btnUpisi');
    var lab = bUpis ? bUpis.querySelector('.kontrola-btn__label') : null;
    if (bUpis && lab) {
      if (esejJeModKorekcije()) {
        bUpis.classList.add('kontrola-btn--crud-izmjeni');
        lab.textContent = 'Izmjeni';
        bUpis.setAttribute('aria-label', 'Izmjeni');
      } else {
        bUpis.classList.remove('kontrola-btn--crud-izmjeni');
        lab.textContent = 'Upis';
        bUpis.setAttribute('aria-label', 'Upis');
      }
    }
    var bBr = document.getElementById('btnIzbrisi');
    if (!bBr) return;
    if (!esejJeModKorekcije()) {
      bBr.hidden = true;
      bBr.style.display = 'none';
    }
  }

  function esejNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis() {
    if (esejJeModKorekcije()) return;
    var bBr = document.getElementById('btnIzbrisi');
    if (bBr) {
      bBr.hidden = true;
      bBr.style.display = 'none';
    }
  }

  /* ============================================================
   * Geo kaskada: Država → Regija → Loža
   * ============================================================ */

  function esejVrijednostSelektaZaLoz(sel) {
    if (!sel || sel.tagName !== 'SELECT') return '';
    var vx;
    try {
      var sos = sel.selectedOptions;
      var i;
      if (sos && sos.length) {
        for (i = 0; i < sos.length; i++) {
          vx = trimZ(sos[i].value);
          if (vx) return vx;
        }
      }
    } catch (eSo) {}
    vx = trimZ(sel.value);
    if (vx) return vx;
    var si = sel.selectedIndex;
    if (si >= 0 && sel.options && sel.options[si]) {
      vx = trimZ(sel.options[si].value);
      if (vx) return vx;
    }
    return '';
  }

  function esejIdOdabraneLozISelecta() {
    return selectLoza ? esejVrijednostSelektaZaLoz(selectLoza) : '';
  }

  function esejSyncGeoLabels() {
    var parovi = [
      { el: selectDrzava, forId: 'select_drzava' },
      { el: selectRegija, forId: 'select_regija' },
      { el: selectLoza,   forId: 'select_loza' }
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
    if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) {
      KontroleRefreshCustomSelect(kontrolaId);
    }
  }

  function popuniLozeIzKeša(idRegija, callback) {
    setAutoLockedClass(selectLoza, false);
    function finishLoza(idZaFormu) {
      esejOsvjeziLoziGrupeIFormu(idZaFormu);
      esejSyncHeaderLogoSize();
      if (typeof callback === 'function') callback();
    }
    if (!selectLoza) { finishLoza(); return; }
    if (!idRegija) {
      popuniSelectIzKeša(selectLoza, [], '— Odaberi ložu —', 'select_loza');
      selectLoza.disabled = true;
      esejUpdateHeaderLogo('');
      finishLoza();
      return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano = typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function'
      ? window.vnlhGeoFiltrirajLozePoRegiji(g.loze, idRegija) : [];
    popuniSelectIzKeša(selectLoza, filtrirano, '— Odaberi ložu —', 'select_loza');
    if (filtrirano.length === 1) {
      selectLoza.value = String(filtrirano[0].id);
      selectLoza.disabled = true;
      setAutoLockedClass(selectLoza, true);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
      var jedinaLozaId = String(filtrirano[0].id);
      esejUpdateHeaderLogo(jedinaLozaId);
      finishLoza(jedinaLozaId);
    } else {
      selectLoza.disabled = filtrirano.length === 0;
      esejUpdateHeaderLogo('');
      finishLoza();
    }
  }

  function popuniRegijeIzKeša(idDrzava, callback) {
    setAutoLockedClass(selectRegija, false);
    if (!selectRegija) {
      esejOsvjeziLoziGrupeIFormu();
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
    var filtrirano = typeof window.vnlhGeoFiltrirajRegijePoDrzavi === 'function'
      ? window.vnlhGeoFiltrirajRegijePoDrzavi(g.regije, idDrzava) : [];
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

  /* ============================================================
   * Stupanj select: puni se iz Stupnjevi_CRUD_sve.php?id_loza=
   * ============================================================ */

  function puniSelectStupanjEseja() {
    setTimeout(puniSelectStupanjEsejaOdmah, 0);
  }

  function puniSelectStupanjEsejaOdmah() {
    var sel = document.getElementById('esej_select_stupanj');
    if (!sel) return;

    function resetStupanj() {
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi stupanj —';
      sel.appendChild(opt0);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('esej_select_stupanj');
    }

    var idLoza = esejIdOdabraneLozISelecta();
    if (!idLoza) { resetStupanj(); return; }

    var url = getApiUrl('Stupnjevi_CRUD_sve.php') + '?id_loza=' + encodeURIComponent(idLoza);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      /* Ignorirati odgovor ako se loža promijenila za vrijeme zahtjeva. */
      if (esejIdOdabraneLozISelecta() !== idLoza) return;
      if (xhr.status < 200 || xhr.status >= 300) { resetStupanj(); return; }
      var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
      /* Tekstualne greške servera (nisu JSON). */
      if (text === '105' || text.indexOf('200,') === 0) { resetStupanj(); return; }
      var arr = [];
      try { arr = JSON.parse(text); } catch (ep) {}
      if (!Array.isArray(arr)) arr = [];
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi stupanj —';
      sel.appendChild(opt0);
      var j;
      for (j = 0; j < arr.length; j++) {
        var o = arr[j];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = (o.stupanj != null ? String(o.stupanj) + '°, ' : '') + (o.naziv != null ? o.naziv : '');
        if (o.stupanj != null) opt.dataset.stupanj = String(o.stupanj);
        sel.appendChild(opt);
      }
      if (arr.length === 1 && arr[0].id != null) sel.value = String(arr[0].id);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('esej_select_stupanj');
    };
    xhr.send();
  }

  function ucitajPravaGeo(callback) {
    if (typeof window.vnlhGeoOgranicenjaUcitaj !== 'function') {
      esejOsvjeziLoziGrupeIFormu();
      if (callback) callback();
      esejNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis();
      return;
    }
    var url = typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
      ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Esej_CRUD.html')
      : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') + '?html_fajl=' + encodeURIComponent('Esej_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = g.drzave || [];
      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');
      var ui = g.upis_izmjena != null ? parseInt(g.upis_izmjena, 10) : 0;
      var bs = g.brisanje_sloga != null ? parseInt(g.brisanje_sloga, 10) : 0;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(ui, bs);
      esejNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis();
      esejPrimijeniUvjeteUpisGumba();
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

  /* ============================================================
   * Logo lože u zaglavlju
   * ============================================================ */

  function esejUpdateHeaderLogo(idLozaForced) {
    var img = document.getElementById('clanovi_loza_tablica_logo');
    var frame = img && img.closest ? img.closest('.clanovi-loza-crud__tablica-header-logo-frame') : null;
    if (!img || !frame) return;
    var idLoza = typeof idLozaForced !== 'undefined'
      ? trimZ(idLozaForced !== null ? String(idLozaForced) : '')
      : esejIdOdabraneLozISelecta();
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
        requestAnimationFrame(function () { esejSyncHeaderLogoSize(); });
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
    img.src = getApiUrl('Loze_CRUD_slika.php') + '?id=' + encodeURIComponent(idLoza) + '&t=' + String(Date.now());
  }

  var _esejLogoSyncRaf = null;

  function esejSyncHeaderLogoSize() {
    if (_esejLogoSyncRaf) cancelAnimationFrame(_esejLogoSyncRaf);
    _esejLogoSyncRaf = requestAnimationFrame(function () {
      _esejLogoSyncRaf = null;
      var header = document.querySelector('.clanovi-loza-crud__tablica-header');
      var kontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      var wrap = document.querySelector('.clanovi-loza-crud__tablica-header-logo-wrap');
      if (!header || !kontrole || !wrap) return;
      var csW = getComputedStyle(wrap);
      if (csW.display === 'none') { header.style.removeProperty('--clanovi-loza-logo-side'); return; }
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
    });
  }

  /* ============================================================
   * Stanje kontrola ovisno o loži i taba
   * ============================================================ */

  function esejPrimijeniDisabledNaKartice(imaLozu) {
    var map = [
      { id: 'esejKontrolaTabKart0', ok: !!imaLozu },
      { id: 'esejKontrolaTabKart1', ok: !!imaLozu }
    ];
    var i;
    for (i = 0; i < map.length; i++) {
      var btn = document.getElementById(map[i].id);
      if (!btn) continue;
      if (!map[i].ok) btn.disabled = true;
      else btn.removeAttribute('disabled');
    }
  }

  function esejTabVratiNaOpstiAkoAktivnaOnemogucena(tabRoot) {
    if (!tabRoot) return;
    var akt = tabRoot.querySelector('.kontrola-tab__kartica.kontrola-tab__kartica--aktivna');
    if (!akt || !akt.disabled) return;
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabRoot, 0);
    var k0 = document.getElementById('esejKontrolaTabKart0');
    if (k0 && !k0.disabled) { try { k0.focus(); } catch (ef) {} }
  }

  function esejPrimijeniUvjeteUpisGumba(imaLozuParam) {
    var imaLozu = typeof imaLozuParam !== 'undefined' ? !!imaLozuParam : !!esejIdOdabraneLozISelecta();
    var bUpis = document.getElementById('btnUpisi');
    if (bUpis && !bUpis.hidden) bUpis.disabled = !imaLozu;
  }

  /**
   * Dok nije odabrana loža: tab, tekstualna polja i ikone su disabled. Povratak ostaje aktivan.
   * @param {string} [idLozaZaFormu]
   */
  function esejPostaviKontroleOvisnoLozi(idLozaZaFormu) {
    var imaLozu = typeof idLozaZaFormu !== 'undefined'
      ? trimZ(idLozaZaFormu !== null ? String(idLozaZaFormu) : '') !== ''
      : !!esejIdOdabraneLozISelecta();

    var tabRoot = document.getElementById('esejKontrolaTab');
    if (tabRoot) {
      tabRoot.classList.toggle('esej-crud__tab--onemogucen', !imaLozu);
      esejPrimijeniDisabledNaKartice(imaLozu);
      esejTabVratiNaOpstiAkoAktivnaOnemogucena(tabRoot);
    }

    /* Tab Opći podaci: native kontrole (select, checkbox, textarea, ellipsis). */
    var opciNodes = document.querySelectorAll('#esejKontrolaTabPanel0 .esej-crud__opci-kontrola');
    var oi;
    for (oi = 0; oi < opciNodes.length; oi++) {
      var elO = opciNodes[oi];
      if (elO && 'disabled' in elO) elO.disabled = !imaLozu;
    }
    /* Autor edit-delete wrapper: enable/disable cijeli blok (clear gumb unutar). */
    var autorWrap = document.querySelector('.esej-crud__autor-edit-delete');
    if (typeof KontroleSetControlEnabled === 'function' && autorWrap) {
      KontroleSetControlEnabled(autorWrap, imaLozu);
    }
    /* Stupanj: puni se kada loža postaje dostupna, prazni kada nije. */
    if (imaLozu) {
      puniSelectStupanjEseja();
    } else {
      var selStReset = document.getElementById('esej_select_stupanj');
      if (selStReset) {
        while (selStReset.firstChild) selStReset.removeChild(selStReset.firstChild);
        var optStReset = document.createElement('option');
        optStReset.value = '';
        optStReset.textContent = '— Odaberi stupanj —';
        selStReset.appendChild(optStReset);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('esej_select_stupanj');
      }
    }

    /* Tab Esej: textarea kontrole. */
    var esejNodes = document.querySelectorAll('#esejKontrolaTabPanel1 .esej-crud__esej-kontrola');
    var ei;
    for (ei = 0; ei < esejNodes.length; ei++) {
      var elE = esejNodes[ei];
      if (elE && 'disabled' in elE) elE.disabled = !imaLozu;
    }

    /* Ikone u zaglavlju. */
    var btnOdabir = document.getElementById('esej_btn_odabir_postojeceg');
    if (btnOdabir) btnOdabir.disabled = !imaLozu;
    var btnPdf = document.getElementById('esej_btn_pdf');
    if (btnPdf) btnPdf.disabled = !imaLozu;

    /* Sinkroniziraj izgled labela s disabled stanjem kontrola. */
    if (typeof KontroleSyncLabelsDisabledState === 'function') {
      var tabBody = document.getElementById('esejKontrolaTab');
      if (tabBody) KontroleSyncLabelsDisabledState(tabBody);
    }

    esejPrimijeniUvjeteUpisGumba(imaLozu);
    var bBr = document.getElementById('btnIzbrisi');
    if (bBr && !bBr.hidden) bBr.disabled = !imaLozu;
  }

  function esejOsvjeziLoziGrupeIFormu(idLozaZaFormu) {
    esejSyncGeoLabels();
    esejPostaviKontroleOvisnoLozi(idLozaZaFormu);
    esejScheduleMinVisinuResiza();
  }

  /* ============================================================
   * Tipkovnica: zaobilaženje disabled kartica
   * ============================================================ */

  function esejKontrolaTabZaobilaziDisabledTipkovnica(ev, tabRoot) {
    var key = ev.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('kontrola-tab__kartica')) return;
    var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
    var n = kartice.length;
    if (n === 0) return;

    function indeks(btn) {
      var s = btn && btn.getAttribute ? btn.getAttribute('data-tab-index') : null;
      if (s != null && s !== '') { var p = parseInt(s, 10); if (!isNaN(p)) return p; }
      for (var j = 0; j < kartice.length; j++) { if (kartice[j] === btn) return j; }
      return 0;
    }

    var cur = indeks(t);
    var naiveNext = cur;
    if (key === 'ArrowLeft') naiveNext = (cur - 1 + n) % n;
    else if (key === 'ArrowRight') naiveNext = (cur + 1) % n;
    else if (key === 'Home') naiveNext = 0;
    else if (key === 'End') naiveNext = n - 1;

    if (kartice[naiveNext] && !kartice[naiveNext].disabled) return;

    var next = cur;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      var step = key === 'ArrowRight' ? 1 : -1;
      var tries = 0;
      while (tries < n) {
        next = (next + step + n) % n;
        if (kartice[next] && !kartice[next].disabled) break;
        tries++;
      }
      if (tries >= n) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    } else {
      var hi;
      next = -1;
      if (key === 'Home') { for (hi = 0; hi < n; hi++) { if (kartice[hi] && !kartice[hi].disabled) { next = hi; break; } } }
      else { for (hi = n - 1; hi >= 0; hi--) { if (kartice[hi] && !kartice[hi].disabled) { next = hi; break; } } }
      if (next < 0) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    }

    if (next === cur) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabRoot, next);
    if (kartice[next]) { try { kartice[next].focus(); } catch (eFc) {} }
    setTimeout(function () { esejScheduleMinVisinuResiza(); }, 0);
  }

  /* ============================================================
   * Minimalna visina panela za traku (data-resize-min-px)
   * ============================================================ */

  var _esejMinHVisRaf = null;
  var _esejMinHResizeT = null;
  var _esejPocetnaVisinaPostavljena = false;
  var ESEJ_MIN_VIS_DODATNO_PX = 33;

  function esejIzracunajMinVisinuVanjskogPanelaPx() {
    var panel   = document.getElementById('esejPanel');
    var tabRoot = document.getElementById('esejKontrolaTab');
    if (!panel || !tabRoot) return 0;
    var tij = tabRoot.querySelector('.kontrola-tab__tijelo');
    var p0  = document.getElementById('esejKontrolaTabPanel0');
    if (!tij || !p0) return 0;

    /* Privremeno izmjeri Tab 0 izvan flex lanca da dobijemo prirodnu visinu sadržaja. */
    var csT = getComputedStyle(tij);
    var pl = parseFloat(csT.paddingLeft) || 0;
    var pr = parseFloat(csT.paddingRight) || 0;
    var contentW = Math.max(120, Math.round(tij.getBoundingClientRect().width) - pl - pr);

    var activeIdx = 0;
    var karts = tabRoot.querySelectorAll('.kontrola-tab__kartica');
    var a;
    for (a = 0; a < karts.length; a++) {
      if (karts[a].classList.contains('kontrola-tab__kartica--aktivna')) { activeIdx = a; break; }
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
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabRoot, activeIdx);

    if (!(hPanel0 > 0) || !isFinite(hPanel0)) return 0;

    var pt = parseFloat(csT.paddingTop) || 0;
    var pb = parseFloat(csT.paddingBottom) || 0;
    var hTij    = pt + hPanel0 + pb;
    var trk     = tabRoot.querySelector('.kontrola-tab__traka');
    var head    = panel.querySelector('.esej-crud__panel-header');
    var foot    = panel.querySelector('.kontrola-panel__footer');
    var bar     = panel.querySelector('.kontrola-panel__resize-bar');
    var hTraka  = trk  ? trk.offsetHeight  : 0;
    var hHead   = head ? head.offsetHeight  : 0;
    var hFooter = foot ? foot.offsetHeight  : 0;
    var hBar    = bar && bar.offsetHeight > 0 ? bar.offsetHeight : 28;

    var total = hHead + hTraka + hTij + hBar + hFooter + ESEJ_MIN_VIS_DODATNO_PX;
    return Math.max(280, Math.ceil(total));
  }

  function esejPostaviPocetnuVisinuPanela(el, hPx) {
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

  function esejPrimijeniMinVisinuResiza() {
    var el = document.getElementById('esejPanel');
    if (!el) return;
    var px = esejIzracunajMinVisinuVanjskogPanelaPx();
    if (px < 1) return;
    var hPx = Math.max(280, px);
    el.setAttribute('data-resize-min-px', String(hPx));
    if (!_esejPocetnaVisinaPostavljena) {
      esejPostaviPocetnuVisinuPanela(el, hPx);
      _esejPocetnaVisinaPostavljena = true;
    }
  }

  function esejScheduleMinVisinuResiza() {
    if (_esejMinHVisRaf) cancelAnimationFrame(_esejMinHVisRaf);
    _esejMinHVisRaf = requestAnimationFrame(function () {
      _esejMinHVisRaf = null;
      esejPrimijeniMinVisinuResiza();
    });
  }

  /* ============================================================
   * HTTP pomoćna funkcija
   * ============================================================ */

  function esejPostJson(url, data, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (cb) cb(xhr.responseText, xhr.status);
    };
    xhr.send(JSON.stringify(data));
  }

  /* ============================================================
   * Payload (podaci za slanje na server)
   * ============================================================ */

  function esejSakupiPayload() {
    var idLoza     = esejIdOdabraneLozISelecta();
    var selSt      = document.getElementById('esej_select_stupanj');
    var cbJavno    = document.getElementById('esej_javno_dostupan');
    var taKljucne  = document.getElementById('esej_kljucne_rijeci');
    var taSadrzaj  = document.getElementById('esej_sadrzaj');

    return {
      id_loza:        idLoza ? parseInt(idLoza, 10) : null,
      id_autor:       esejAutorClanId ? parseInt(esejAutorClanId, 10) : null,
      id_stupanj:     selSt && trimZ(selSt.value) ? parseInt(selSt.value, 10) : null,
      javno_dostupan: cbJavno && cbJavno.checked ? 1 : 0,
      kljucne_rijeci: taKljucne ? trimZ(taKljucne.value) || null : null,
      esej:           taSadrzaj ? trimZ(taSadrzaj.value) || null : null
    };
  }

  /* ============================================================
   * Inicijalizacija (DOMContentLoaded)
   * ============================================================ */

  function esejOcistiFormu() {
    esejTrenutniId = null;
    esejAutorClanId = null;

    /* Autor edit-delete */
    var autorDiv = document.getElementById('esej_autor');
    if (autorDiv) autorDiv.innerHTML = '';
    var autorWrapClear = document.querySelector('.esej-crud__autor-edit-delete');
    if (autorWrapClear) delete autorWrapClear.dataset.esejClanId;

    /* Stupanj */
    var selSt = document.getElementById('esej_select_stupanj');
    if (selSt) { selSt.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('esej_select_stupanj'); }

    /* Javno dostupan */
    var cbJavno = document.getElementById('esej_javno_dostupan');
    if (cbJavno) cbJavno.checked = false;

    /* Upisao */
    var inpUpisao = document.getElementById('esej_upisao');
    if (inpUpisao) inpUpisao.value = '';

    /* Ključne riječi i Sadržaj */
    var taKljucne = document.getElementById('esej_kljucne_rijeci');
    var taSadrzaj = document.getElementById('esej_sadrzaj');
    if (taKljucne) taKljucne.value = '';
    if (taSadrzaj) taSadrzaj.value = '';
  }

  function onReady() {
    esejPrimijeniFooterPremaModuUpisa();

    var tabRoot = document.getElementById('esejKontrolaTab');
    if (tabRoot) {
      if (typeof KontroleTabInit === 'function') KontroleTabInit(tabRoot);
      tabRoot.addEventListener('keydown', function (ev) {
        esejKontrolaTabZaobilaziDisabledTipkovnica(ev, tabRoot);
      }, true);
      tabRoot.addEventListener('kontrola-tab-changed', function () {
        setTimeout(function () { esejScheduleMinVisinuResiza(); }, 0);
      });
    }

    if (selectDrzava) {
      selectDrzava.addEventListener('change', function () {
        var idD = trimZ(selectDrzava.value);
        popuniRegijeIzKeša(idD, function () {});
      });
    }

    if (selectRegija) {
      selectRegija.addEventListener('change', function () {
        var idR = trimZ(selectRegija.value);
        popuniLozeIzKeša(idR, function () {});
      });
    }

    if (selectLoza) {
      selectLoza.addEventListener('change', function (ev) {
        var selEl = ev.currentTarget && ev.currentTarget.tagName === 'SELECT' ? ev.currentTarget : selectLoza;
        function promijeniLozuUOsvjezi(idLoza) {
          esejUpdateHeaderLogo(idLoza);
          esejSyncHeaderLogoSize();
          esejOsvjeziLoziGrupeIFormu(idLoza);
        }
        var idOdmah = esejVrijednostSelektaZaLoz(selEl);
        if (idOdmah) { promijeniLozuUOsvjezi(idOdmah); return; }
        queueMicrotask(function () { promijeniLozuUOsvjezi(esejVrijednostSelektaZaLoz(selEl)); });
      });
    }

    /* Autor: inicijalizacija edit-delete + handler za brisanje odabira. */
    if (typeof KontroleInitEditDelete === 'function') {
      KontroleInitEditDelete(document.getElementById('esejKontrolaTabPanel0') || document);
    }
    var autorPanel = document.getElementById('esejKontrolaTabPanel0');
    if (autorPanel) {
      autorPanel.addEventListener('kontrole-edit-delete-clear', function (ev) {
        var wrap = ev.target && ev.target.closest ? ev.target.closest('.esej-crud__autor-edit-delete') : null;
        if (!wrap) return;
        esejAutorClanId = null;
        delete wrap.dataset.esejClanId;
      });
    }

    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza)   selectLoza.disabled   = true;

    ucitajPravaGeo(function () {
      esejUpdateHeaderLogo();
      esejSyncHeaderLogoSize();
    });

    /* Logo resize. */
    if (typeof ResizeObserver !== 'undefined') {
      var kH = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      if (kH) {
        var roE = new ResizeObserver(function () { esejSyncHeaderLogoSize(); });
        roE.observe(kH);
      }
    }
    esejSyncHeaderLogoSize();
    setTimeout(function () { esejSyncHeaderLogoSize(); }, 0);
    setTimeout(function () { esejSyncHeaderLogoSize(); }, 200);

    setTimeout(esejScheduleMinVisinuResiza, 0);
    setTimeout(esejScheduleMinVisinuResiza, 150);
    setTimeout(esejScheduleMinVisinuResiza, 500);

    window.addEventListener('load', function () {
      esejSyncHeaderLogoSize();
      esejScheduleMinVisinuResiza();
    });
    window.addEventListener('resize', function () {
      if (_esejMinHResizeT) clearTimeout(_esejMinHResizeT);
      _esejMinHResizeT = setTimeout(function () {
        _esejMinHResizeT = null;
        esejSyncHeaderLogoSize();
        esejScheduleMinVisinuResiza();
      }, 200);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        esejSyncHeaderLogoSize();
        esejScheduleMinVisinuResiza();
      }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  /* ============================================================
   * CRUD tipke: Upis / Izmjeni, Izbriši, Povratak
   * ============================================================ */

  (function initUpisIzbrisHandleri() {
    var btnUpisi  = document.getElementById('btnUpisi');
    var btnIzbrisi = document.getElementById('btnIzbrisi');

    if (btnUpisi) {
      btnUpisi.addEventListener('click', function () {
        if (!esejIdOdabraneLozISelecta()) return;
        var jeMod1 = esejJeModKorekcije();
        var payload = esejSakupiPayload();
        if (jeMod1) payload.id = esejTrenutniId;
        var url = jeMod1
          ? getApiUrl('Esej_CRUD_izmjena.php')
          : getApiUrl('Esej_CRUD_upis.php');
        btnUpisi.disabled = true;
        esejPostJson(url, payload, function (res, status) {
          btnUpisi.disabled = false;
          if (status >= 200 && status < 300 && (res === 'OK' || /^\d+$/.test(res))) {
            var kodPoruke = (!jeMod1 && /^\d+$/.test(res)) ? '001' : '004';
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(kodPoruke, [], function () { esejOcistiFormu(); });
            } else {
              esejOcistiFormu();
            }
          } else {
            var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
            var kod = p && p.code ? p.code : (res || '200');
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[kod] ? kod : '200', p ? p.replacements || [] : [res]);
            }
          }
        });
      });
    }

    if (btnIzbrisi) {
      btnIzbrisi.addEventListener('click', function () {
        if (!esejTrenutniId) return;
        if (typeof window.showPorukaModal !== 'function') return;
        window.showPorukaModal('126', [], function (odgovor) {
          if (odgovor !== 'OK') return;
          btnIzbrisi.disabled = true;
          esejPostJson(getApiUrl('Esej_CRUD_brisanje.php'), { id: esejTrenutniId }, function (res, status) {
            btnIzbrisi.disabled = false;
            if (status >= 200 && status < 300 && res === 'OK') {
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('003', [], function () {
                  window.location.href = new URL('Meni.php', window.location.href).href;
                });
              } else {
                window.location.href = new URL('Meni.php', window.location.href).href;
              }
            } else {
              var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
              var kod = p && p.code ? p.code : '200';
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[kod] ? kod : '200', p ? p.replacements || [] : [res]);
              }
            }
          });
        });
      });
    }
  }());

  (function initPovratak() {
    var btnPovratak = document.getElementById('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) {
        try {
          var u = new URL(ref, window.location.href);
          if (u.origin === window.location.origin) { window.location.href = u.href; return; }
        } catch (e) {}
      }
      if (document.referrer) {
        try {
          var u2 = new URL(document.referrer);
          if (u2.origin === window.location.origin) { window.location.href = u2.href; return; }
        } catch (e2) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  }());

})();
