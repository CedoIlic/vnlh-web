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
  /** Pravo upisa/izmjene iz geo/prava odgovora (1 = smije, 0 = ne smije); koristi esejProvedeUvjeteForma. */
  var _esejPravaUpisIzmjena = 0;
  /** true kad je učitan tuđi (javni) esej — sve kontrole RO, tipke skrivene. */
  var _esejReadOnlyMode = false;
  /** Pravo brisanja iz geo/prava odgovora; koristi se kod učitavanja eseja za edit. */
  var _esejPravaBrisanjeSloga = 0;
  /** ID stupnja koji treba postaviti u select nakon što puniSelectStupanjEseja dovrši XHR (učitavanje eseja). */
  var _esejPendingStupanj = null;

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
    var sel    = document.getElementById('esej_select_stupanj');
    var idLoza = esejIdOdabraneLozISelecta();
    if (!sel) return;
    if (!idLoza) {
      /* Loža nije odabrana — reset na placeholder. */
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi stupanj —';
      sel.appendChild(opt0);
      if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('esej_select_stupanj'); } catch (e) {} }
      return;
    }
    var currentPending = _esejPendingStupanj;
    if (typeof vnlhPuniSelectStupanjNadleznosti !== 'function') return;
    vnlhPuniSelectStupanjNadleznosti(sel, idLoza, {
      getApiUrl:      getApiUrl,
      kontrolaId:     'esej_select_stupanj',
      pendingValue:   currentPending,
      getRaceIdLoza:  esejIdOdabraneLozISelecta,
      onComplete: function () {
        if (currentPending) _esejPendingStupanj = null;
        esejProvedeUvjeteForma();
      }
    });
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
      _esejPravaUpisIzmjena = ui;
      _esejPravaBrisanjeSloga = bs;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(ui, bs);
      esejNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis();
      esejProvedeUvjeteForma();
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

  /* ============================================================
   * Modal za odabir autora eseja
   * ============================================================ */

  /** Svi članovi lože dohvaćeni za trenutno otvoreni modal (izvor za pretragu). */
  var _esejModalAutorSviClanovi = [];
  /** Debounce timer za pretragu unutar modala. */
  var _esejModalAutorFilterT = null;
  var ESEJ_MODAL_AUTOR_DEBOUNCE_MS = 200;

  function esejModalAutorFormatTekst(r) {
    if (!r || typeof r !== 'object') return '';
    var p = trimZ(r.prezime);
    var ix = trimZ(r.ime);
    return (p + (p && ix ? ' ' : '') + ix).trim() || '';
  }

  function esejModalAutorHaystack(r) {
    return esejModalAutorFormatTekst(r).toLowerCase();
  }

  function esejModalAutorNapuniTbody(arr) {
    var tbody = document.getElementById('esej_modal_autor_tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var a = arr || [];
    for (var ri = 0; ri < a.length; ri++) {
      var o = a[ri];
      if (!o || o.id == null) continue;
      var tr = document.createElement('tr');
      tr.dataset.rowId = String(o.id);
      tr.hidden = false;
      var td = document.createElement('td');
      var cel = document.createElement('div');
      cel.className = 'kontrola-tablica__cell-inner';
      cel.setAttribute('tabindex', '0');
      cel.textContent = esejModalAutorFormatTekst(o);
      td.appendChild(cel);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function esejModalAutorPrimijeniFilter() {
    var inp = document.getElementById('esej_modal_autor_trazi');
    var q = inp ? trimZ(inp.value).toLowerCase() : '';
    var tbody = document.getElementById('esej_modal_autor_tbody');
    if (!tbody) return;
    var trs = tbody.querySelectorAll('tr');
    var ti;
    for (ti = 0; ti < trs.length; ti++) {
      var tr = trs[ti];
      if (!q) {
        tr.hidden = false;
      } else {
        var rowId = tr.dataset.rowId;
        var found = false;
        var src = _esejModalAutorSviClanovi;
        var ci;
        for (ci = 0; ci < src.length; ci++) {
          if (src[ci] && String(src[ci].id) === rowId) {
            found = esejModalAutorHaystack(src[ci]).indexOf(q) >= 0;
            break;
          }
        }
        if (!found && tr.classList.contains('tablica-row-selected')) {
          tr.classList.remove('tablica-row-selected');
          esejModalAutorAzurirajOk();
        }
        tr.hidden = !found;
      }
    }
  }

  function esejModalAutorAzurirajOk() {
    var tbody = document.getElementById('esej_modal_autor_tbody');
    var btnOk = document.getElementById('esej_modal_autor_ok');
    if (!btnOk) return;
    var hasSel = tbody ? !!tbody.querySelector('tr.tablica-row-selected:not([hidden])') : false;
    btnOk.disabled = !hasSel;
  }

  function esejModalAutorOtvori() {
    var idLoza = esejIdOdabraneLozISelecta();
    if (!idLoza) return;
    var root = document.getElementById('esejModalAutor');
    if (!root) return;

    /* Postavi poziciju i veličinu (localStorage ili default centrirano). */
    var dialog = root.querySelector('.modal-tablica__dialog');
    if (dialog) {
      var stored = _esejModalAutorGetStorage();
      if (stored) {
        dialog.style.left   = stored.left + 'px';
        dialog.style.top    = stored.top  + 'px';
        dialog.style.width  = Math.max(_ESEJ_MODAL_AUTOR_MIN_W, stored.width)  + 'px';
        dialog.style.height = Math.max(_ESEJ_MODAL_AUTOR_MIN_H, stored.height) + 'px';
      } else {
        var vw = window.innerWidth  || 800;
        var vh = window.innerHeight || 600;
        dialog.style.width  = _ESEJ_MODAL_AUTOR_DEFAULT_W + 'px';
        dialog.style.height = _ESEJ_MODAL_AUTOR_DEFAULT_H + 'px';
        dialog.style.left   = Math.max(0, (vw - _ESEJ_MODAL_AUTOR_DEFAULT_W) / 2) + 'px';
        dialog.style.top    = Math.max(0, (vh - _ESEJ_MODAL_AUTOR_DEFAULT_H) / 2) + 'px';
      }
    }

    root.classList.add('modal-tablica--open');
    root.setAttribute('aria-hidden', 'false');

    var url = getApiUrl('Clanovi_CRUD_sve_loze.php') + '?id_loza=' + encodeURIComponent(idLoza);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var arr = [];
      if (xhr.status >= 200 && xhr.status < 300) {
        var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
        if (text.charAt(0) === '[') { try { arr = JSON.parse(text); } catch (ep) {} }
        if (!Array.isArray(arr)) arr = [];
      }
      arr.sort(function (a, b) { return esejModalAutorFormatTekst(a).localeCompare(esejModalAutorFormatTekst(b), undefined, { sensitivity: 'base' }); });
      _esejModalAutorSviClanovi = arr;
      esejModalAutorNapuniTbody(arr);
      /* Resetiraj pretragu. */
      var inp = document.getElementById('esej_modal_autor_trazi');
      if (inp) inp.value = '';
      /* Predselekcija prethodno odabranog člana. */
      if (esejAutorClanId) {
        var tbody = document.getElementById('esej_modal_autor_tbody');
        var prethodni = tbody ? tbody.querySelector('tr[data-row-id="' + esejAutorClanId + '"]') : null;
        if (prethodni && !prethodni.hidden) prethodni.classList.add('tablica-row-selected');
      }
      esejModalAutorAzurirajOk();
      setTimeout(function () {
        if (inp) try { inp.focus(); } catch (ef) {}
      }, 0);
    };
    xhr.send();
  }

  function esejModalAutorZatvori() {
    var root = document.getElementById('esejModalAutor');
    if (!root) return;
    /* Spremi poziciju i veličinu. */
    var dialog = root.querySelector('.modal-tablica__dialog');
    if (dialog) {
      var left = parseFloat(dialog.style.left);
      var top  = parseFloat(dialog.style.top);
      var w    = dialog.offsetWidth  || parseFloat(dialog.style.width)  || 0;
      var h    = dialog.offsetHeight || parseFloat(dialog.style.height) || 0;
      if (!isNaN(left) && !isNaN(top) && w >= _ESEJ_MODAL_AUTOR_MIN_W && h >= _ESEJ_MODAL_AUTOR_MIN_H) {
        _esejModalAutorSetStorage(left, top, w, h);
      }
    }
    root.classList.remove('modal-tablica--open');
    root.setAttribute('aria-hidden', 'true');
    var btn = document.getElementById('esej_btn_autor_ellipsis');
    if (btn) try { btn.focus(); } catch (ef) {}
  }

  function esejModalAutorPotvrdiOdabir() {
    var tbody = document.getElementById('esej_modal_autor_tbody');
    if (!tbody) return;
    var selTr = tbody.querySelector('tr.tablica-row-selected:not([hidden])');
    if (!selTr) return;
    var cid = selTr.dataset.rowId;
    if (!cid) return;
    /* Pronađi podatke člana i popuni edit-delete polje. */
    var member = null;
    var ci;
    for (ci = 0; ci < _esejModalAutorSviClanovi.length; ci++) {
      if (String(_esejModalAutorSviClanovi[ci].id) === cid) { member = _esejModalAutorSviClanovi[ci]; break; }
    }
    var tekst = member ? esejModalAutorFormatTekst(member) : 'ID ' + cid;
    var autorDiv = document.getElementById('esej_autor');
    var autorWrap = autorDiv ? autorDiv.closest('.esej-crud__autor-edit-delete') : null;
    if (autorDiv) {
      autorDiv.textContent = tekst;
      autorDiv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (autorWrap) autorWrap.dataset.esejClanId = cid;
    esejAutorClanId = cid;
    esejModalAutorZatvori();
    esejProvedeUvjeteForma();
  }

  var _ESEJ_MODAL_AUTOR_STORAGE_KEY = 'esej_crud_autor_modal';
  var _ESEJ_MODAL_AUTOR_DEFAULT_W = 480;
  var _ESEJ_MODAL_AUTOR_DEFAULT_H = 420;
  var _ESEJ_MODAL_AUTOR_MIN_W = _ESEJ_MODAL_AUTOR_DEFAULT_W;
  var _ESEJ_MODAL_AUTOR_MIN_H = _ESEJ_MODAL_AUTOR_DEFAULT_H;
  var _esejModalAutorInterakcijeInit = false;

  function _esejModalAutorGetStorage() {
    try {
      var raw = localStorage.getItem(_ESEJ_MODAL_AUTOR_STORAGE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && typeof o.left === 'number' && typeof o.top === 'number' && typeof o.width === 'number' && typeof o.height === 'number') return o;
    } catch (e) {}
    return null;
  }

  function _esejModalAutorSetStorage(left, top, w, h) {
    try { localStorage.setItem(_ESEJ_MODAL_AUTOR_STORAGE_KEY, JSON.stringify({ left: left, top: top, width: w, height: h })); } catch (e) {}
  }

  function _esejModalAutorInitInterakcije() {
    if (_esejModalAutorInterakcijeInit) return;
    _esejModalAutorInterakcijeInit = true;

    var root = document.getElementById('esejModalAutor');
    var dialog = root ? root.querySelector('.modal-tablica__dialog') : null;
    var header = root ? root.querySelector('.modal-tablica__header') : null;
    var corner = document.getElementById('esej_modal_autor_resize_corner');
    var bar    = document.getElementById('esej_modal_autor_resize_bar');
    if (!root || !dialog) return;

    /* Drag samo po naslovu (ne na search redu unutar headera). */
    var header = root ? root.querySelector('.modal-tablica__header') : null;
    if (header) {
      header.style.cursor = 'move';
      /* stopPropagation na interaktivnim dijelovima headera — mousedown ne stiže do drag handlera. */
      var _stopSels = ['input', 'button', 'select', 'textarea', 'a',
                       '.kontrola-edit-delete', '.esej-crud__modal-autor-trazi-red',
                       '.esej-crud__modal-lista-legenda'];
      _stopSels.forEach(function (sel) {
        var els = header.querySelectorAll(sel);
        for (var si = 0; si < els.length; si++) {
          els[si].addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
        }
      });
      header.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var left0 = parseFloat(dialog.style.left) || 0;
        var top0  = parseFloat(dialog.style.top)  || 0;
        var x0 = e.clientX; var y0 = e.clientY;
        function move(ev) {
          dialog.style.left = (left0 + ev.clientX - x0) + 'px';
          dialog.style.top  = (top0  + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        e.preventDefault();
      });
    }

    /* Resize traka (visina). */
    if (bar) {
      bar.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var h0 = dialog.offsetHeight; var y0 = e.clientY;
        function move(ev) {
          dialog.style.height = Math.max(_ESEJ_MODAL_AUTOR_MIN_H, h0 + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        e.preventDefault();
      });
    }

    /* Pretraga — debounce. */
    var traziInp = document.getElementById('esej_modal_autor_trazi');
    if (traziInp) {
      traziInp.addEventListener('input', function () {
        if (_esejModalAutorFilterT) clearTimeout(_esejModalAutorFilterT);
        _esejModalAutorFilterT = setTimeout(function () { _esejModalAutorFilterT = null; esejModalAutorPrimijeniFilter(); }, ESEJ_MODAL_AUTOR_DEBOUNCE_MS);
      });
    }
    if (traziInp && typeof KontroleInitEditDelete === 'function') {
      var traziWrap = traziInp.closest('.kontrola-edit-delete');
      if (traziWrap) {
        KontroleInitEditDelete(traziWrap);
        traziWrap.addEventListener('kontrole-edit-delete-clear', function () { esejModalAutorPrimijeniFilter(); });
      }
    }

    /* Klik i dvoklik na red. */
    var scroll = document.getElementById('esej_modal_autor_scroll');
    if (scroll) {
      scroll.addEventListener('click', function (ev) {
        if (window.getSelection && window.getSelection().toString().length > 0) return;
        var tr = ev.target && ev.target.closest ? ev.target.closest('tbody tr') : null;
        if (!tr || tr.hidden) return;
        var tbody = document.getElementById('esej_modal_autor_tbody');
        if (tbody) { var sve = tbody.querySelectorAll('tr'); for (var si = 0; si < sve.length; si++) sve[si].classList.remove('tablica-row-selected'); }
        tr.classList.add('tablica-row-selected');
        esejModalAutorAzurirajOk();
        try { scroll.focus({ preventScroll: true }); } catch (ef) {}
      });
      scroll.addEventListener('dblclick', function (ev) {
        var tr = ev.target && ev.target.closest ? ev.target.closest('tbody tr') : null;
        if (!tr || tr.hidden || !tr.classList.contains('tablica-row-selected')) return;
        esejModalAutorPotvrdiOdabir();
      });
    }

    /* OK / Odustani / overlay / Escape. */
    var btnOk = document.getElementById('esej_modal_autor_ok');
    var btnCancel = document.getElementById('esej_modal_autor_cancel');
    var overlay = root ? root.querySelector('.modal-tablica__overlay') : null;
    if (btnOk)    btnOk.addEventListener('click', esejModalAutorPotvrdiOdabir);
    if (btnCancel) btnCancel.addEventListener('click', esejModalAutorZatvori);
    if (overlay)  overlay.addEventListener('click', esejModalAutorZatvori);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      var r = document.getElementById('esejModalAutor');
      if (r && r.classList.contains('modal-tablica--open')) esejModalAutorZatvori();
    });

    /* Izračun minimalne visine: ista formula kao ModalTablicaInit ali s 5 vidljivih redaka
       + visina search reda u zaglavlju. Postavljamo na dialog.style.minHeight da native
       resize: both ne dozvoli smanjivanje ispod tog limita. */
    (function () {
      function tok(name, def) {
        var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
        return isNaN(v) ? def : v;
      }
      var padY       = tok('--modal_tablica_body_padding_y',  16);
      var headH      = tok('--tablica_head_h',                42);
      var rowH       = tok('--tablica_row_h',                 40);
      var extra      = tok('--tablica_extra',                  1);
      var barH       = tok('--panel_resize_bar_height',       28);
      var headerPadY = tok('--modal_tablica_header_padding_y', 12);
      var footerPadY = tok('--modal_tablica_footer_padding_y', 12);
      var btnH       = tok('--button_height',                 36);
      var titleH     = 20;
      var searchRowH = 42;
      var gap        = 8;
      var headerMin  = headerPadY * 2 + titleH + gap + searchRowH;
      var bodyMin    = padY + headH + (rowH * 5) + extra + padY + barH;
      var footerMin  = footerPadY * 2 + btnH;
      var minH = Math.max(240, Math.ceil(headerMin + bodyMin + footerMin));
      _ESEJ_MODAL_AUTOR_MIN_H = minH;
      if (dialog) dialog.style.minHeight = minH + 'px';
    }());

    /* Ellipsis gumb. */
    var btnEllipsis = document.getElementById('esej_btn_autor_ellipsis');
    if (btnEllipsis) {
      btnEllipsis.addEventListener('click', function () {
        if (btnEllipsis.disabled) return;
        esejModalAutorOtvori();
      });
    }
  }

  /* ============================================================
   * Lista modal: odabir postojećeg eseja za editiranje
   * ============================================================ */

  var _esejModalListaBojeCache   = { kv1: null, kv2: null }; // cache boja legende
  var _esejModalListaData        = [];     // svi učitani redci
  var _esejModalListaOffset      = 0;
  var _esejModalListaIsLoading   = false;
  var _esejModalListaHasMore     = true;
  var _esejModalListaTrazi       = '';
  var _ESEJ_MODAL_LISTA_LIMIT = typeof window.VNLH_LIMIT_ZAHVAT === 'number' && window.VNLH_LIMIT_ZAHVAT > 0 ? window.VNLH_LIMIT_ZAHVAT : 50;
  var _ESEJ_MODAL_LISTA_DEBOUNCE = 300;
  var _esejModalListaFilterT     = null;
  var _esejModalListaInitDone    = false;
  var _ESEJ_MODAL_LISTA_KEY      = 'esej_crud_lista_modal';
  var _ESEJ_MODAL_LISTA_DEF_W    = 600;
  var _ESEJ_MODAL_LISTA_DEF_H    = 560;
  var _ESEJ_MODAL_LISTA_MIN_W    = 600;
  var _ESEJ_MODAL_LISTA_MIN_H    = 560;

  /* Popup: ključne riječi */
  var _esejKljucneHideT    = null;
  var _esejKljucneAktivniId = null;

  function _esejModalListaGetStorage() {
    try {
      var raw = localStorage.getItem(_ESEJ_MODAL_LISTA_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && typeof o.left === 'number' && typeof o.top === 'number') return o;
    } catch (e) {}
    return null;
  }
  function _esejModalListaSetStorage(left, top, w, h) {
    try { localStorage.setItem(_ESEJ_MODAL_LISTA_KEY, JSON.stringify({ left: left, top: top, width: w, height: h })); } catch (e) {}
  }

  function _esejModalListaPrimijeniLegendBoje() {
    var kv1 = document.getElementById('esej_modal_lista_leg_kv1');
    var kv2 = document.getElementById('esej_modal_lista_leg_kv2');
    function strip(b) { var s = String(b || '').trim(); return s.length === 9 ? s.substring(0, 7) : s; }
    if (kv1 && _esejModalListaBojeCache.kv1) kv1.style.backgroundColor = strip(_esejModalListaBojeCache.kv1);
    if (kv2 && _esejModalListaBojeCache.kv2) kv2.style.backgroundColor = strip(_esejModalListaBojeCache.kv2);
  }

  function _esejModalListaFormatRed(row) {
    var parts = [];
    var naslov = row.naslov_eseja ? String(row.naslov_eseja).trim() : '';
    if (naslov) parts.push(naslov);
    var autor = [row.autor_prezime, row.autor_ime].filter(Boolean).join(' ');
    if (autor) parts.push(autor);
    if (row.stupanj_broj != null) parts.push(String(row.stupanj_broj) + '°');
    if (row.ista_loza !== 1) {
      var lozaInfo = [row.loza_naziv, row.loza_grad].filter(Boolean).join(', ');
      if (lozaInfo) parts.push(lozaInfo);
    }
    return parts.join(', ');
  }

  function _esejModalListaDodajRedove(arr) {
    var tbody = document.getElementById('esej_modal_lista_tbody');
    if (!tbody) return;
    var i;
    for (i = 0; i < arr.length; i++) {
      var row = arr[i];
      if (!row || row.id == null) continue;
      var tr = document.createElement('tr');
      tr.dataset.esejListaId = String(row.id);

      var td = document.createElement('td');
      var wrap = document.createElement('div');
      wrap.className = 'esej-crud__lista-red-inner';

      var cel = document.createElement('div');
      cel.className = 'kontrola-tablica__cell-inner';
      cel.setAttribute('tabindex', '0');
      cel.textContent = _esejModalListaFormatRed(row);
      /* Boja retka: tuđi javni esej → id=11; vlastiti javni esej → id=10.
         Ako boja nije definirana ostaje '' → primjenjuje se CSS default iz tokena. */
      var bojaFg = null, bojaBg = null;
      if (row.ista_loza !== 1) {
        bojaFg = row.boja_javno_11    || null;
        bojaBg = row.boja_javno_11_bg || null;
      } else if (+row.javno_dostupan === 1) {
        bojaFg = row.boja_javno    || null;
        bojaBg = row.boja_javno_bg || null;
      }
      function bojaToStyle(c) {
        var s = String(c || '').trim().replace(/^#/, '');
        if (s.length === 8) {
          var r = parseInt(s.slice(0,2),16), g = parseInt(s.slice(2,4),16),
              b = parseInt(s.slice(4,6),16), a = parseInt(s.slice(6,8),16) / 255;
          if (!isNaN(r+g+b+a)) return 'rgba('+r+','+g+','+b+','+a.toFixed(3)+')';
        }
        if (s.length === 6) return '#'+s;
        return '';
      }
      cel.style.color = bojaFg ? bojaToStyle(bojaFg) : '';
      tr.style.backgroundColor = bojaBg ? bojaToStyle(bojaBg) : '';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'esej-crud__lista-elipsis-btn';
      btn.setAttribute('aria-label', 'Ključne riječi');
      btn.dataset.esejListaId = String(row.id);
      var spEl = document.createElement('span');
      spEl.className = 'kontrola-icon--ellipsis-horizontal';
      spEl.setAttribute('aria-hidden', 'true');
      btn.appendChild(spEl);

      wrap.appendChild(cel);
      wrap.appendChild(btn);
      td.appendChild(wrap);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function _esejModalListaUcitajRedove(append) {
    if (_esejModalListaIsLoading) return;
    _esejModalListaIsLoading = true;
    var idLoza = esejIdOdabraneLozISelecta();
    var url = getApiUrl('Esej_CRUD_lista.php')
      + '?id_loza=' + encodeURIComponent(idLoza)
      + '&offset='  + encodeURIComponent(_esejModalListaOffset)
      + '&limit='   + _ESEJ_MODAL_LISTA_LIMIT;
    if (_esejModalListaTrazi) url += '&trazi=' + encodeURIComponent(_esejModalListaTrazi);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      _esejModalListaIsLoading = false;
      var arr = [];
      if (xhr.status >= 200 && xhr.status < 300) {
        var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
        if (text.charAt(0) === '[') { try { arr = JSON.parse(text); } catch (ep) {} }
        if (!Array.isArray(arr)) arr = [];
      }
      _esejModalListaHasMore = arr.length >= _ESEJ_MODAL_LISTA_LIMIT;
      /* Cachirati boje legende iz prvog raspoloživog retka. */
      if (arr.length > 0) {
        if (arr[0].boja_javno)    _esejModalListaBojeCache.kv1 = arr[0].boja_javno;
        if (arr[0].boja_javno_11) _esejModalListaBojeCache.kv2 = arr[0].boja_javno_11;
        _esejModalListaPrimijeniLegendBoje();
      }
      if (!append) {
        _esejModalListaData = arr;
        var tbody = document.getElementById('esej_modal_lista_tbody');
        if (tbody) tbody.innerHTML = '';
      } else {
        _esejModalListaData = _esejModalListaData.concat(arr);
      }
      _esejModalListaDodajRedove(arr);
    };
    xhr.send();
  }

  function esejModalListaOtvori() {
    var root = document.getElementById('esejModalLista');
    if (!root) return;
    _esejModalListaInitInterakcije();
    var dialog = root.querySelector('.modal-tablica__dialog');
    if (dialog) {
      var stored = _esejModalListaGetStorage();
      if (stored) {
        dialog.style.left   = stored.left + 'px';
        dialog.style.top    = stored.top  + 'px';
        dialog.style.width  = Math.max(_ESEJ_MODAL_LISTA_MIN_W, stored.width)  + 'px';
        dialog.style.height = Math.max(_ESEJ_MODAL_LISTA_MIN_H, stored.height) + 'px';
      } else {
        var vw = window.innerWidth || 800;
        var vh = window.innerHeight || 600;
        dialog.style.width  = _ESEJ_MODAL_LISTA_DEF_W + 'px';
        dialog.style.height = _ESEJ_MODAL_LISTA_DEF_H + 'px';
        dialog.style.left   = Math.max(0, (vw - _ESEJ_MODAL_LISTA_DEF_W) / 2) + 'px';
        dialog.style.top    = Math.max(0, (vh - _ESEJ_MODAL_LISTA_DEF_H) / 2) + 'px';
      }
    }
    /* Reset i učitaj prvu stranicu. */
    _esejModalListaOffset  = 0;
    _esejModalListaTrazi   = '';
    _esejModalListaHasMore = true;
    var traziInp = document.getElementById('esej_modal_lista_trazi');
    if (traziInp) traziInp.value = '';
    root.classList.add('modal-tablica--open');
    root.setAttribute('aria-hidden', 'false');
    _esejModalListaPrimijeniLegendBoje();
    _esejModalListaUcitajRedove(false);
    setTimeout(function () { if (traziInp) try { traziInp.focus(); } catch (ef) {} }, 0);
  }

  function esejModalListaZatvori() {
    var root = document.getElementById('esejModalLista');
    if (!root) return;
    var dialog = root.querySelector('.modal-tablica__dialog');
    if (dialog) {
      var left = parseFloat(dialog.style.left);
      var top  = parseFloat(dialog.style.top);
      var w    = dialog.offsetWidth  || parseFloat(dialog.style.width)  || 0;
      var h    = dialog.offsetHeight || parseFloat(dialog.style.height) || 0;
      if (!isNaN(left) && !isNaN(top) && w >= _ESEJ_MODAL_LISTA_MIN_W && h >= _ESEJ_MODAL_LISTA_MIN_H) {
        _esejModalListaSetStorage(left, top, w, h);
      }
    }
    /* Počisti tablicu da se pri ponovnom otvaranju ne prikaže stari sadržaj. */
    var tbody = document.getElementById('esej_modal_lista_tbody');
    if (tbody) tbody.innerHTML = '';
    _esejModalListaData = [];
    root.classList.remove('modal-tablica--open');
    root.setAttribute('aria-hidden', 'true');
    _esejKljucnePopupSakrij();
    var btn = document.getElementById('esej_btn_odabir_postojeceg');
    if (btn) try { btn.focus(); } catch (ef) {}
  }

  /* --- Popup: ključne riječi --- */

  function _esejKljucnePopupPokazi(kljucneRijeci, targetBtn) {
    if (_esejKljucneHideT) { clearTimeout(_esejKljucneHideT); _esejKljucneHideT = null; }
    var popup = document.getElementById('esejKljucnePopup');
    if (!popup) return;
    var tekst = document.getElementById('esej_kljucne_popup_tekst');
    if (tekst) tekst.textContent = kljucneRijeci || '—';
    popup.hidden = false;
    /* Pozicija: lijevo od gumba, ili desno ako nema mjesta. */
    popup.style.left = '-9999px';
    popup.style.top  = '-9999px';
    var pw  = popup.offsetWidth  || 280;
    var ph  = popup.offsetHeight || 120;
    var rect = targetBtn.getBoundingClientRect();
    var vw = window.innerWidth  || 800;
    var vh = window.innerHeight || 600;
    var left = rect.left - pw - 6;
    if (left < 4) left = rect.right + 6;
    if (left + pw > vw - 4) left = vw - pw - 4;
    var top = rect.top;
    if (top + ph > vh - 4) top = vh - ph - 4;
    if (top < 4) top = 4;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
  }

  function _esejKljucnePopupSakrij() {
    var popup = document.getElementById('esejKljucnePopup');
    if (popup) popup.hidden = true;
    _esejKljucneAktivniId = null;
  }

  function _esejKljucneNadjiRedak(esejListaId) {
    var i;
    for (i = 0; i < _esejModalListaData.length; i++) {
      if (String(_esejModalListaData[i].id) === String(esejListaId)) return _esejModalListaData[i];
    }
    return null;
  }

  /* --- Učitavanje eseja u formu --- */

  function _esejFormaImaPodatke() {
    if (esejAutorClanId) return true;
    if (esejTrenutniId) return true;
    var inpNaslov = document.getElementById('esej_naslov_eseja');
    if (inpNaslov && trimZ(inpNaslov.value)) return true;
    if (trimZ(esejSadrzajGetTekst() || '')) return true;
    return false;
  }

  function _esejUcitajZaEdit(rowData) {
    if (!rowData) return;
    var isIstaLoza = rowData.ista_loza === 1;
    /* 1. Clear + postavi mod (edit ili RO za tuđi esej). */
    esejOcistiFormu();  /* resetira _esejReadOnlyMode = false */
    if (isIstaLoza) {
      window.mod_upisa_eseja = 1;
      esejTrenutniId = String(rowData.id);
      esejPrimijeniFooterPremaModuUpisa();
      var bBr = document.getElementById('btnIzbrisi');
      if (bBr && _esejPravaBrisanjeSloga > 0) { bBr.hidden = false; bBr.style.removeProperty('display'); }
    } else {
      /* Tuđi javni esej: RO mod — samo pregled; geo grupa ostaje nedotaknuta. */
      _esejReadOnlyMode = true;
      window.mod_upisa_eseja = 0;
      esejTrenutniId = null;
      esejPrimijeniFooterPremaModuUpisa();
    }

    /* 2. Za tuđi esej: geo grupa ostaje nedotaknuta — samo popuni polja i primjeni RO. */
    if (!isIstaLoza) {
      _ucitajPoljaRO();
      esejModalListaZatvori();
      return;
    }

    /* 2b. Vlastiti esej: geo kaskada → loža → enable kontrola → učitaj polja. */
    var idDrzava = String(rowData.id_drzava || '');
    var idRegija = String(rowData.id_regija || '');
    var idLoza   = String(rowData.id_loza   || '');

    function _ucitajPoljaRO() {
      /* Tuđi esej: popuni polja bez geo kaskade, zatim primjeni RO. */
      var autorDiv  = document.getElementById('esej_autor');
      var autorWrap = autorDiv ? autorDiv.closest('.esej-crud__autor-edit-delete') : null;
      esejAutorClanId = String(rowData.id_autor || '');
      if (autorDiv) { autorDiv.textContent = [rowData.autor_prezime, rowData.autor_ime].filter(Boolean).join(' '); autorDiv.dispatchEvent(new Event('input', { bubbles: true })); }
      if (autorWrap && esejAutorClanId) autorWrap.dataset.esejClanId = esejAutorClanId;

      var inpNaslov = document.getElementById('esej_naslov_eseja');
      if (inpNaslov) inpNaslov.value = esejNaslovSreduji(rowData.naslov_eseja || '');

      /* Stupanj: lista se (async) puni SVIM dostupnim stupnjevima u esejProvedeUvjeteForma
         (pozvanog iz esejOcistiFormu, jer je loža dostupna). Filter stupnja = filter izbora eseja
         → esejev stupanj je sigurno u toj listi. Postavljamo ga preko _esejPendingStupanj, koji
         XHR konzumira po završetku (isti mehanizam kao kod vlastitog eseja).
         Brisanje (esejOcistiFormu) → „Nije izabrano", bez micanja opcija. */
      _esejPendingStupanj = String(rowData.id_stupanj || '');
      /* Eksplicitno okini XHR NAKON postavljanja pendinga (esejProvedeUvjeteForma bi u RO
         modu ranije izašao, a XHR iz esejOcistiFormu je uhvatio prazan pending). */
      puniSelectStupanjEseja();

      var cbJavno = document.getElementById('esej_javno_dostupan');
      if (cbJavno) cbJavno.checked = !!(parseInt(rowData.javno_dostupan, 10));

      var inpUpisao = document.getElementById('esej_upisao');
      if (inpUpisao) {
        var uIme2 = [rowData.upisao_prezime, rowData.upisao_ime].filter(Boolean).join(' ');
        var uDat2 = '';
        if (rowData.vrijeme_upisa) { try { var dO2 = new Date(rowData.vrijeme_upisa); uDat2 = dO2.toLocaleDateString('hr-HR') + ' - ' + String(dO2.getHours()).padStart(2,'0') + ':' + String(dO2.getMinutes()).padStart(2,'0') + ':' + String(dO2.getSeconds()).padStart(2,'0'); } catch(ed){} }
        inpUpisao.value = uIme2 ? (uDat2 ? uIme2 + ', ' + uDat2 : uIme2) : uDat2;
      }

      var taKl2 = document.getElementById('esej_kljucne_rijeci');
      if (taKl2) taKl2.value = rowData.kljucne_rijeci || '';
      esejSadrzajSetTekst(rowData.esej || '');
      _esejPrimijeniReadOnly();
    }

    function _ucitajPolja() {
      /* Autor */
      esejAutorClanId = String(rowData.id_autor || '');
      var autorDiv  = document.getElementById('esej_autor');
      var autorWrap = autorDiv ? autorDiv.closest('.esej-crud__autor-edit-delete') : null;
      if (autorDiv) {
        autorDiv.textContent = [rowData.autor_prezime, rowData.autor_ime].filter(Boolean).join(' ');
        autorDiv.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (autorWrap && esejAutorClanId) autorWrap.dataset.esejClanId = esejAutorClanId;

      /* Naslov */
      var inpNaslov = document.getElementById('esej_naslov_eseja');
      if (inpNaslov) inpNaslov.value = esejNaslovSreduji(rowData.naslov_eseja || '');

      /* Stupanj — pending jer XHR mora završiti (async). */
      _esejPendingStupanj = String(rowData.id_stupanj || '');

      /* Javno dostupan */
      var cbJavno = document.getElementById('esej_javno_dostupan');
      if (cbJavno) cbJavno.checked = !!(parseInt(rowData.javno_dostupan, 10));

      /* Upisao (RO display) */
      var inpUpisao = document.getElementById('esej_upisao');
      if (inpUpisao) {
        var uIme = [rowData.upisao_prezime, rowData.upisao_ime].filter(Boolean).join(' ');
        var uDat = '';
        if (rowData.vrijeme_upisa) {
          try {
            var dObj = new Date(rowData.vrijeme_upisa);
            var hh = String(dObj.getHours()).padStart(2, '0');
            var mm = String(dObj.getMinutes()).padStart(2, '0');
            var ss = String(dObj.getSeconds()).padStart(2, '0');
            uDat = dObj.toLocaleDateString('hr-HR') + ' - ' + hh + ':' + mm + ':' + ss;
          } catch (ed) {}
        }
        inpUpisao.value = uIme ? (uDat ? uIme + ', ' + uDat : uIme) : uDat;
      }

      /* Ključne riječi */
      var taKl = document.getElementById('esej_kljucne_rijeci');
      if (taKl) taKl.value = rowData.kljucne_rijeci || '';

      /* Sadržaj */
      esejSadrzajSetTekst(rowData.esej || '');

      esejProvedeUvjeteForma();
    }

    if (selectDrzava && idDrzava) {
      selectDrzava.value = idDrzava;
      setAutoLockedClass(selectDrzava, false);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
    }
    popuniRegijeIzKeša(idDrzava, function () {
      if (selectRegija && idRegija) {
        selectRegija.value = idRegija;
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_regija');
      }
      popuniLozeIzKeša(idRegija, function () {
        if (selectLoza && idLoza) {
          selectLoza.value = idLoza;
          setAutoLockedClass(selectLoza, false);
          if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
        }
        esejUpdateHeaderLogo(idLoza);
        esejSyncHeaderLogoSize();
        esejPostaviKontroleOvisnoLozi(idLoza);
        _ucitajPolja();
      });
    });
  }

  /* --- Inicijalizacija lista modal interakcija (jednom) --- */

  function _esejModalListaInitInterakcije() {
    if (_esejModalListaInitDone) return;
    _esejModalListaInitDone = true;

    var root   = document.getElementById('esejModalLista');
    var dialog = root ? root.querySelector('.modal-tablica__dialog') : null;
    var naslov = root ? root.querySelector('.esej-crud__modal-autor-naslov') : null;
    var bar    = document.getElementById('esej_modal_lista_resize_bar');
    var corner = document.getElementById('esej_modal_lista_resize_corner');
    if (!root || !dialog) return;

    /* Drag — header element, zaobilazi interaktivne kontrole i legendu. */
    var headerLista = root ? root.querySelector('.modal-tablica__header') : null;
    if (headerLista) {
      headerLista.style.cursor = 'move';
      var _stopSelsL = ['input', 'button', 'select', 'textarea', 'a',
                        '.kontrola-edit-delete', '.esej-crud__modal-autor-trazi-red',
                        '.esej-crud__modal-lista-legenda'];
      _stopSelsL.forEach(function (sel) {
        var els = headerLista.querySelectorAll(sel);
        for (var si = 0; si < els.length; si++) {
          els[si].addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
        }
      });
      headerLista.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var l0 = parseFloat(dialog.style.left) || 0;
        var t0 = parseFloat(dialog.style.top)  || 0;
        var x0 = e.clientX; var y0 = e.clientY;
        function mv(ev) { dialog.style.left = (l0 + ev.clientX - x0) + 'px'; dialog.style.top = (t0 + ev.clientY - y0) + 'px'; }
        function st() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', st); }
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', st);
        e.preventDefault();
      });
    }
    /* Resize bar. */
    if (bar) {
      bar.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var h0 = dialog.offsetHeight; var y0 = e.clientY;
        function mv(ev) { dialog.style.height = Math.max(_ESEJ_MODAL_LISTA_MIN_H, h0 + ev.clientY - y0) + 'px'; }
        function st() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', st); }
        document.addEventListener('mousemove', mv); document.addEventListener('mouseup', st);
        e.preventDefault();
      });
    }

    /* Pretraga — debounce. */
    var traziInp = document.getElementById('esej_modal_lista_trazi');
    if (traziInp) {
      traziInp.addEventListener('input', function () {
        if (_esejModalListaFilterT) clearTimeout(_esejModalListaFilterT);
        _esejModalListaFilterT = setTimeout(function () {
          _esejModalListaFilterT = null;
          _esejModalListaTrazi  = trimZ(traziInp.value);
          _esejModalListaOffset = 0;
          _esejModalListaHasMore = true;
          _esejModalListaUcitajRedove(false);
        }, _ESEJ_MODAL_LISTA_DEBOUNCE);
      });
      if (typeof KontroleInitEditDelete === 'function') {
        var tw = traziInp.closest('.kontrola-edit-delete');
        if (tw) {
          KontroleInitEditDelete(tw);
          tw.addEventListener('kontrole-edit-delete-clear', function () {
            _esejModalListaTrazi  = '';
            _esejModalListaOffset = 0;
            _esejModalListaHasMore = true;
            _esejModalListaUcitajRedove(false);
          });
        }
      }
    }

    /* Infinite scroll. */
    var scroll = document.getElementById('esej_modal_lista_scroll');
    if (scroll) {
      scroll.addEventListener('scroll', function () {
        if (_esejModalListaIsLoading || !_esejModalListaHasMore) return;
        if (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100) {
          _esejModalListaOffset += _ESEJ_MODAL_LISTA_LIMIT;
          _esejModalListaUcitajRedove(true);
        }
      });

      /* Klik na redak → odabir eseja. */
      scroll.addEventListener('click', function (ev) {
        if (window.getSelection && window.getSelection().toString().length > 0) return;
        /* Klik na ellipsis — popup, ne selekcija. */
        var btn = ev.target && ev.target.closest ? ev.target.closest('.esej-crud__lista-elipsis-btn') : null;
        if (btn) return;

        var tr = ev.target && ev.target.closest ? ev.target.closest('tbody tr') : null;
        if (!tr) return;
        var esejId = tr.dataset.esejListaId;
        if (!esejId) return;
        var rowData = _esejKljucneNadjiRedak(esejId);
        if (!rowData) return;

        esejModalListaZatvori();
        _esejUcitajZaEdit(rowData);
      });

      /* Ellipsis hover/klik → popup ključne riječi. */
      scroll.addEventListener('mouseover', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.esej-crud__lista-elipsis-btn') : null;
        if (!btn) return;
        if (_esejKljucneHideT) { clearTimeout(_esejKljucneHideT); _esejKljucneHideT = null; }
        var esejId = btn.dataset.esejListaId;
        if (_esejKljucneAktivniId === esejId) return;
        _esejKljucneAktivniId = esejId;
        var row = _esejKljucneNadjiRedak(esejId);
        _esejKljucnePopupPokazi(row ? row.kljucne_rijeci : '', btn);
      });
      scroll.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.esej-crud__lista-elipsis-btn') : null;
        if (!btn) return;
        if (_esejKljucneHideT) { clearTimeout(_esejKljucneHideT); _esejKljucneHideT = null; }
        var esejId = btn.dataset.esejListaId;
        _esejKljucneAktivniId = esejId;
        var row = _esejKljucneNadjiRedak(esejId);
        _esejKljucnePopupPokazi(row ? row.kljucne_rijeci : '', btn);
        ev.stopPropagation();
      });
      scroll.addEventListener('mouseout', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.esej-crud__lista-elipsis-btn') : null;
        if (!btn) return;
        _esejKljucneHideT = setTimeout(function () { _esejKljucneHideT = null; _esejKljucnePopupSakrij(); }, 300);
      });
    }

    /* Popup: mouseover/out i hover-back. */
    var popup = document.getElementById('esejKljucnePopup');
    if (popup) {
      popup.addEventListener('mouseover', function () {
        if (_esejKljucneHideT) { clearTimeout(_esejKljucneHideT); _esejKljucneHideT = null; }
      });
      popup.addEventListener('mouseout', function () {
        _esejKljucneHideT = setTimeout(function () { _esejKljucneHideT = null; _esejKljucnePopupSakrij(); }, 300);
      });
    }
    var popupIzlaz = document.getElementById('esej_kljucne_popup_izlaz');
    if (popupIzlaz) popupIzlaz.addEventListener('click', _esejKljucnePopupSakrij);

    /* Klik van popupa → sakrij. */
    document.addEventListener('click', function (ev) {
      var pop = document.getElementById('esejKljucnePopup');
      if (!pop || pop.hidden) return;
      if (pop.contains(ev.target)) return;
      var scr = document.getElementById('esej_modal_lista_scroll');
      if (scr && scr.contains(ev.target)) return;
      _esejKljucnePopupSakrij();
    });

    /* Zatvori modal. */
    var btnZatvori = document.getElementById('esej_modal_lista_zatvori');
    var overlay = root.querySelector('.modal-tablica__overlay');
    if (btnZatvori) btnZatvori.addEventListener('click', esejModalListaZatvori);
    if (overlay) overlay.addEventListener('click', esejModalListaZatvori);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (root.classList.contains('modal-tablica--open')) esejModalListaZatvori();
    });

    /* Odabir postojećeg gumb u zaglavlju forme. */
    var btnOdabir = document.getElementById('esej_btn_odabir_postojeceg');
    if (btnOdabir) btnOdabir.addEventListener('click', function () {
      if (btnOdabir.disabled) return;
      if (_esejFormaImaPodatke() && typeof window.showPorukaModal === 'function') {
        window.showPorukaModal('028', [], function (odg) {
          if (odg === 'OK') esejModalListaOtvori();
        });
      } else {
        esejModalListaOtvori();
      }
    });

    /* Izračun min visine (isti tokeni kao modal autora). */
    (function () {
      function tok(n, d) { var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n).trim()); return isNaN(v) ? d : v; }
      var padY = tok('--modal_tablica_body_padding_y', 16);
      var headH = tok('--tablica_head_h', 42);
      var rowH  = tok('--tablica_row_h', 40);
      var barH  = tok('--panel_resize_bar_height', 28);
      var headerPadY = tok('--modal_tablica_header_padding_y', 12);
      var footerPadY = tok('--modal_tablica_footer_padding_y', 12);
      var btnH  = tok('--button_height', 36);
      /* 150 = procjena visine header sadržaja: naslov(20) + gap(8) + pretraži(34) + legenda(~88) */
      var minH  = Math.max(400, Math.ceil(headerPadY * 2 + 150 + padY + headH + rowH * 5 + padY + barH + footerPadY * 2 + btnH));
      _ESEJ_MODAL_LISTA_MIN_H = minH;
      if (dialog) dialog.style.minHeight = minH + 'px';
    }());
  }

  /**
   * Primjenjuje/uklanja jedinstveni RO vizual (KontroleSetControlReadonly) na kontrole eseja.
   * Preskače esej_upisao (trajni RO) i autor-ellipsis (ostaje funkcionalno disabled).
   * Posebno: autor edit-delete (X ostaje aktivan) i checkbox-labela (label-for klik ne smije
   * mijenjati vrijednost u RO).
   * @param {boolean} ro
   */
  function _esejPostaviRoVizual(ro) {
    if (typeof KontroleSetControlReadonly !== 'function') return;
    var nodes = document.querySelectorAll(
      '#esejKontrolaTabPanel0 .esej-crud__opci-kontrola, #esejKontrolaTabPanel1 .esej-crud__esej-kontrola'
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el.id === 'esej_upisao' || el.id === 'esej_btn_autor_ellipsis') continue;
      KontroleSetControlReadonly(el, ro);
      /* Napomene su u wrapperu .esej-crud__scrol-omot (on daje vidljivi okvir+pozadinu;
         inner kontrola je transparentna) → RO boje stavi na wrapper. */
      var omot = el.closest && el.closest('.esej-crud__scrol-omot');
      if (omot) omot.classList.toggle('esej-crud__scrol-omot--readonly', ro);
      /* Checkbox: blokiraj i povezanu labelu (label-for klik bi inače mijenjao vrijednost). */
      if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.id) {
        var lbl = document.querySelector('label[for="' + el.id + '"]');
        if (lbl) {
          if (ro) { lbl.style.pointerEvents = 'none'; lbl.style.cursor = 'default'; }
          else { lbl.style.removeProperty('pointer-events'); lbl.style.removeProperty('cursor'); }
        }
      }
    }
    /* Autor edit-delete (rich-html) — RO vizual; X (clear) ostaje aktivan. */
    var autorWrap = document.querySelector('.esej-crud__autor-edit-delete');
    if (autorWrap) KontroleSetControlReadonly(autorWrap, ro);
  }

  /**
   * Primjeni RO ograničenja za tuđi javni esej (jedinstveni RO vizual + funkcionalni lokoti):
   *  – Kontrole: kontrola-*--readonly (plavi RO izgled, vrijednost vidljiva, inertno)
   *  – Autor: X (clear) ostaje aktivan — jedini povratak na init; ellipsis disabled
   *  – Sadržaj eseja: contenteditable=false (helper ne dira contentEditable)
   *  – Tipke Upis/Izmjeni/Izbriši/PDF: skrivene / disabled
   *  – Labele: ostaju normalne (RO ne sivi labele)
   */
  function _esejPrimijeniReadOnly() {
    var lokot = document.getElementById('esej_ro_lokot');
    if (lokot) { lokot.hidden = false; lokot.style.display = 'inline-flex'; }
    _esejPostaviRoVizual(true);
    var sadrzaj = document.getElementById('esej_sadrzaj');
    if (sadrzaj && sadrzaj.hasAttribute('contenteditable')) sadrzaj.contentEditable = 'false';
    var btnAutorEll = document.getElementById('esej_btn_autor_ellipsis');
    if (btnAutorEll) btnAutorEll.disabled = true;
    var bUpis = document.getElementById('btnUpisi');
    if (bUpis) { bUpis.hidden = true; bUpis.style.display = 'none'; bUpis.disabled = true; }
    var bBr = document.getElementById('btnIzbrisi');
    if (bBr)   { bBr.hidden = true; bBr.style.display = 'none'; }
    var btnPdf = document.getElementById('esej_btn_pdf');
    if (btnPdf) btnPdf.disabled = true;
  }

  /**
   * Evaluira uvjete za Upis/Izmjeni (vidljivost) i PDF (disabled).
   * Upis/Izmjeni: vidljiv samo kad su loža + autor + naslov + stupanj postavljeni.
   * PDF: enabled samo kad su loža + autor + naslov + stupanj + sadržaj postavljeni.
   */
  function esejProvedeUvjeteForma() {
    if (_esejReadOnlyMode) { _esejPrimijeniReadOnly(); return; }
    var imaLozu   = !!esejIdOdabraneLozISelecta();
    var imaAutor  = !!esejAutorClanId;
    var naslovEl  = document.getElementById('esej_naslov_eseja');
    var imaNaslov = naslovEl ? !!trimZ(naslovEl.value) : false;
    var stupanjEl = document.getElementById('esej_select_stupanj');
    var imaStupanj = stupanjEl ? !!trimZ(stupanjEl.value) : false;
    var imaSadrzaj = !!trimZ(esejSadrzajGetTekst() || '');

    var mozUpis = imaLozu && imaAutor && imaNaslov && imaStupanj;
    var mozPdf  = mozUpis && imaSadrzaj;

    /* Upis/Izmjeni: hidden dok nisu sva obavezna polja; prava moraju dozvoljavati upis. */
    var bUpis = document.getElementById('btnUpisi');
    if (bUpis && _esejPravaUpisIzmjena > 0) {
      bUpis.hidden = !mozUpis;
      if (mozUpis) {
        bUpis.style.removeProperty('display');
        bUpis.disabled = false;
      } else {
        bUpis.style.display = 'none';
        bUpis.disabled = true;
      }
    }

    /* PDF: disable/enable prema svim obaveznim poljima + sadržaj. */
    var btnPdf = document.getElementById('esej_btn_pdf');
    if (btnPdf) btnPdf.disabled = !mozPdf;
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

    /* Tab Esej: kontrole (textarea → disabled; contenteditable → contentEditable). */
    var esejNodes = document.querySelectorAll('#esejKontrolaTabPanel1 .esej-crud__esej-kontrola');
    var ei;
    for (ei = 0; ei < esejNodes.length; ei++) {
      var elE = esejNodes[ei];
      if (!elE) continue;
      if ('disabled' in elE) {
        elE.disabled = !imaLozu;
      } else if (elE.hasAttribute('contenteditable')) {
        elE.contentEditable = imaLozu ? 'true' : 'false';
      }
    }

    /* Ikone u zaglavlju: disable/enable zajedno s tabovima. */
    var btnOdabir = document.getElementById('esej_btn_odabir_postojeceg');
    if (btnOdabir) btnOdabir.disabled = !imaLozu;
    var btnPdf = document.getElementById('esej_btn_pdf');
    if (btnPdf) btnPdf.disabled = !imaLozu;

    /* Sinkroniziraj izgled labela s disabled stanjem kontrola. */
    if (typeof KontroleSyncLabelsDisabledState === 'function') {
      var tabBody = document.getElementById('esejKontrolaTab');
      if (tabBody) KontroleSyncLabelsDisabledState(tabBody);
    }

    if (_esejReadOnlyMode) { _esejPrimijeniReadOnly(); return; }
    esejProvedeUvjeteForma(imaLozu);
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

  /**
   * Izvuče tekst iz contenteditable diva.
   * Radi na skrivenom tabu (ne koristi innerText koji zahtijeva layout).
   * Klon + zamjena <br> s \n čuva prijelome koje Chrome piše kao <br>
   * unutar <div> pri execCommand('insertText') s \n u tekstu.
   */
  function esejSadrzajGetTekst() {
    var el = document.getElementById('esej_sadrzaj');
    if (!el) return null;
    if (el.tagName === 'TEXTAREA') return trimZ(el.value) || null;
    /* Klon da ne diramo live DOM. */
    var clone = el.cloneNode(true);
    /* Zamijeni <br> s text node '\n' da textContent sačuva prijelom. */
    var brs = clone.querySelectorAll('br');
    var bi;
    for (bi = 0; bi < brs.length; bi++) {
      var br = brs[bi];
      br.parentNode.insertBefore(document.createTextNode('\n'), br);
      br.parentNode.removeChild(br);
    }
    var parts = [];
    var i, n, t;
    for (i = 0; i < clone.childNodes.length; i++) {
      n = clone.childNodes[i];
      t = (n.textContent || '').trim();
      if (t) parts.push(t);
    }
    return parts.join('\n') || null;
  }

  /**
   * Učita tekst u contenteditable div; svaki redak (odlomak) postaje <p> element
   * pa CSS primjenjuje uvlaku i razmak između odlomaka.
   */
  function esejSadrzajSetTekst(tekst) {
    var el = document.getElementById('esej_sadrzaj');
    if (!el) return;
    if (el.tagName === 'TEXTAREA') { el.value = tekst || ''; return; }
    el.innerHTML = '';
    if (!tekst) return;
    var paragraphs = String(tekst).split(/\n+/);
    var pi;
    for (pi = 0; pi < paragraphs.length; pi++) {
      var pText = paragraphs[pi].trim();
      if (!pText) continue;
      var p = document.createElement('p');
      p.textContent = pText;
      el.appendChild(p);
    }
  }

  /**
   * Pretvara string u title case: početak svake riječi veliko, ostalo malo.
   * Tri zasebna prolaza: (1) početak stringa, (2) iza bijelog razmaka, (3) iza navodnika.
   * Tri prolaza rješavaju problem kad je navodnik na samom početku — jedan prolaz s (^|...)
   * bi pojeo navodnik kao “karakter za verzalu” a slovo iza ostalo malo.
   */
  /**
   * Primjeni pravila naslova na gubitak fokusa:
   *  – Riječ u potpunom VERZALU (npr. “HELLO”) → kurent (“hello”)
   *  – Sredina riječi s velikim slovom (npr. “hEllo”, “HELLo”) → malo (“hello”, “Hello”)
   *  – Inicijal + mala (npr. “Hello”) → ostaje nepromijenjeno
   *  – Ne forsira veliko slovo: korisnik sam bira hoće li na početku malo ili veliko.
   */
  function esejNaslovSreduji(s) {
    var str = s ? String(s) : String();
    if (!str.length) return str;
    var result = String();
    var i = 0;
    while (i < str.length) {
      /* Skupi separator (razmaci + navodnici) */
      var sep = String();
      while (i < str.length && /[\s”’«»‚‛””„‟’’]/.test(str[i])) { sep += str[i]; i++; }
      result += sep;
      /* Skupi riječ */
      var word = String();
      while (i < str.length && !/[\s”’«»‚‛””„‟’’]/.test(str[i])) { word += str[i]; i++; }
      if (!word.length) continue;
      /* Cijeli VERZAL → kurent; inače prvi znak ostaje, ostatak na malo */
      if (word === word.toUpperCase() && word !== word.toLowerCase()) {
        result += word.toLowerCase();
      } else {
        result += word[0] + word.slice(1).toLowerCase();
      }
    }
    return result;
  }

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
    var inpNaslov  = document.getElementById('esej_naslov_eseja');
    var selSt      = document.getElementById('esej_select_stupanj');
    var cbJavno    = document.getElementById('esej_javno_dostupan');
    var taKljucne  = document.getElementById('esej_kljucne_rijeci');
    var taSadrzaj  = document.getElementById('esej_sadrzaj');

    return {
      id_loza:        idLoza ? parseInt(idLoza, 10) : null,
      id_autor:       esejAutorClanId ? parseInt(esejAutorClanId, 10) : null,
      naslov_eseja:   inpNaslov ? trimZ(inpNaslov.value) || null : null,
      id_stupanj:     selSt && trimZ(selSt.value) ? parseInt(selSt.value, 10) : null,
      javno_dostupan: cbJavno && cbJavno.checked ? 1 : 0,
      kljucne_rijeci: taKljucne ? trimZ(taKljucne.value) || null : null,
      esej:           esejSadrzajGetTekst()
    };
  }

  /* ============================================================
   * Inicijalizacija (DOMContentLoaded)
   * ============================================================ */

  function esejOcistiFormu() {
    var lokot = document.getElementById('esej_ro_lokot');
    if (lokot) { lokot.hidden = true; lokot.style.display = 'none'; }
    esejTrenutniId = null;
    esejAutorClanId = null;
    _esejReadOnlyMode = false;
    /* Postavi na tab 0 (Opći podaci). */
    var tabRoot = document.getElementById('esejKontrolaTab');
    if (tabRoot && typeof kontrolaTabPostaviAktivni === 'function') {
      kontrolaTabPostaviAktivni(tabRoot, 0);
    }
    /* Vrati na mod 0 (novi upis) i ažuriraj footer. */
    window.mod_upisa_eseja = 0;
    esejPrimijeniFooterPremaModuUpisa();
    esejNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis();

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

    /* Naslov eseja */
    var inpNaslov = document.getElementById('esej_naslov_eseja');
    if (inpNaslov) inpNaslov.value = '';

    /* Ključne riječi i Sadržaj */
    var taKljucne = document.getElementById('esej_kljucne_rijeci');
    if (taKljucne) taKljucne.value = '';
    esejSadrzajSetTekst('');
    /* Re-enable forme bez stupanj XHR-a (izbjegava race condition s _ucitajPolja). */
    (function () {
      var imaLCur = !!esejIdOdabraneLozISelecta();
      /* Skini jedinstveni RO vizual (kontrola-*--readonly) prije re-gatinga. */
      _esejPostaviRoVizual(false);
      var oi, ei;
      var opN = document.querySelectorAll('#esejKontrolaTabPanel0 .esej-crud__opci-kontrola');
      for (oi = 0; oi < opN.length; oi++) {
        var elOC = opN[oi]; if (!elOC) continue;
        if ('disabled' in elOC) elOC.disabled = !imaLCur;
        if ('readOnly' in elOC && elOC.id !== 'esej_upisao') elOC.readOnly = false;
        elOC.style.removeProperty('pointer-events');
        elOC.style.removeProperty('cursor');
        if (elOC.tagName === 'INPUT' && elOC.type === 'checkbox' && elOC.id) {
          var lbl = document.querySelector('label[for="' + elOC.id + '"]');
          if (lbl) { lbl.style.removeProperty('pointer-events'); lbl.style.removeProperty('cursor'); }
        }
        /* Ukloni RO klasu s custom select wrappera. */
        var sw = elOC.tagName === 'SELECT' ? elOC.closest('.kontrola-select') : null;
        if (sw) sw.classList.remove('esej-crud__kontrola-ro');
      }
      var esN = document.querySelectorAll('#esejKontrolaTabPanel1 .esej-crud__esej-kontrola');
      for (ei = 0; ei < esN.length; ei++) {
        var elE = esN[ei]; if (!elE) continue;
        if ('disabled' in elE) elE.disabled = !imaLCur;
        if ('readOnly' in elE) elE.readOnly = false;
        else if (elE.hasAttribute('contenteditable')) elE.contentEditable = imaLCur ? 'true' : 'false';
      }
      var btnEll = document.getElementById('esej_btn_autor_ellipsis');
      if (btnEll) btnEll.disabled = !imaLCur;
      esejSyncGeoLabels();
      esejScheduleMinVisinuResiza();
    }());
    esejProvedeUvjeteForma();
  }

  function esejOnemoguciDragDropNaPanelu() {
    var roots = [];
    var wrap = document.querySelector('.esej-crud__wrap');
    var naslov = document.querySelector('.naslov-forme');
    if (wrap) roots.push(wrap);
    if (naslov) roots.push(naslov);
    var ri;
    for (ri = 0; ri < roots.length; ri++) {
      (function (root) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (evtName) {
          root.addEventListener(evtName, function (ev) { ev.preventDefault(); ev.stopPropagation(); }, false);
        });
      })(roots[ri]);
    }
  }

  /* ============================================================
   * Geo promjena: snapshot + potvrda ako forma ima podatke
   * ============================================================ */

  /** Snimak vrijednosti geo selekta neposredno prije promjene (za Cancel → vraćanje). */
  var _esejGeoSnapshot = { drzava: '', regija: '', loza: '' };

  function _esejGeoSnimiSnapshot() {
    _esejGeoSnapshot.drzava = selectDrzava ? selectDrzava.value : '';
    _esejGeoSnapshot.regija = selectRegija ? selectRegija.value : '';
    _esejGeoSnapshot.loza   = selectLoza   ? selectLoza.value   : '';
  }

  function _esejGeoVratiSnapshot() {
    if (selectDrzava) { selectDrzava.value = _esejGeoSnapshot.drzava; if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('select_drzava'); } catch (e) {} } }
    if (selectRegija) { selectRegija.value = _esejGeoSnapshot.regija; if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('select_regija'); } catch (e) {} } }
    if (selectLoza)   { selectLoza.value   = _esejGeoSnapshot.loza;   if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('select_loza');   } catch (e) {} } }
  }

  /**
   * Ako forma ima podatke, prikaži 028 pa pozovi onOk/onCancel.
   * Inače odmah pozovi onOk.
   */
  function _esejGeoObradaPromjene(onOk, onCancel) {
    if (!_esejFormaImaPodatke()) { onOk(); return; }
    if (typeof window.showPorukaModal !== 'function') { esejOcistiFormu(); onOk(); return; }
    window.showPorukaModal('028', [], function (odg) {
      if (odg !== 'OK') { if (onCancel) onCancel(); return; }
      esejOcistiFormu();
      onOk();
    });
  }

  function onReady() {
    esejPrimijeniFooterPremaModuUpisa();
    esejOnemoguciDragDropNaPanelu();

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

    /* Snapshot geo vrijednosti prije svake potencijalne promjene. */
    var geoKontrole = document.querySelector('.esej-crud__panel-header .clanovi-loza-crud__tablica-header-kontrole');
    if (geoKontrole) geoKontrole.addEventListener('mousedown', _esejGeoSnimiSnapshot, true);
    if (selectDrzava) selectDrzava.addEventListener('focus', _esejGeoSnimiSnapshot);
    if (selectRegija) selectRegija.addEventListener('focus', _esejGeoSnimiSnapshot);
    if (selectLoza)   selectLoza.addEventListener('focus',   _esejGeoSnimiSnapshot);

    if (selectDrzava) {
      selectDrzava.addEventListener('change', function (ev) {
        var idD = trimZ(selectDrzava.value);
        _esejGeoObradaPromjene(
          function () { popuniRegijeIzKeša(idD, function () {}); },
          function () { _esejGeoVratiSnapshot(); }
        );
      });
    }

    if (selectRegija) {
      selectRegija.addEventListener('change', function (ev) {
        var idR = trimZ(selectRegija.value);
        _esejGeoObradaPromjene(
          function () { popuniLozeIzKeša(idR, function () {}); },
          function () { _esejGeoVratiSnapshot(); }
        );
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
        var getIdLoza = idOdmah
          ? function (cb) { cb(idOdmah); }
          : function (cb) { queueMicrotask(function () { cb(esejVrijednostSelektaZaLoz(selEl)); }); };
        getIdLoza(function (idLoza) {
          _esejGeoObradaPromjene(
            function () { promijeniLozuUOsvjezi(idLoza); },
            function () { _esejGeoVratiSnapshot(); }
          );
        });
      });
    }

    /* Autor: inicijalizacija edit-delete + handler za brisanje odabira.
       Listener direktno na wrappu (obrazac svih CRUD formi) — ne na parent panelu
       jer bi bubbled event mogao doseći globalnih handlere i obrisati formu. */
    var autorWrapEl = document.querySelector('.esej-crud__autor-edit-delete');
    if (autorWrapEl) {
      if (typeof KontroleInitEditDelete === 'function') {
        KontroleInitEditDelete(autorWrapEl);
      }
      autorWrapEl.addEventListener('kontrole-edit-delete-clear', function (ev) {
        ev.stopPropagation();
        esejOcistiFormu();
      });
    }

    /* Inicijalizacija modala za odabir autora i liste eseji. */
    _esejModalAutorInitInterakcije();
    _esejModalListaInitInterakcije();

    /* Validacija uvjeta forme: pratimo promjene relevantnih polja. */
    var naslovInp = document.getElementById('esej_naslov_eseja');
    if (naslovInp) {
      var _naslovPasted = false;

      /* Paste: označi flag — transformacija se odgađa do blur-a. */
      naslovInp.addEventListener('paste', function () { _naslovPasted = true; });

      /* Tipkanje: u sredini riječi → odmah na malo; početak → korisnik bira. */
      naslovInp.addEventListener('input', function () {
        if (_naslovPasted) { _naslovPasted = false; esejProvedeUvjeteForma(); return; }
        var pos = naslovInp.selectionStart;
        var val = naslovInp.value;
        if (pos > 0) {
          var ci = pos - 1;
          var ch = val[ci];
          /* Provjeri je li znak velik i nije na početku riječi */
          if (ch !== ch.toLowerCase()) {
            var prev = ci > 0 ? val[ci - 1] : '';
            var naPocetkuRijeci = ci === 0 || /[\s"'«»‚‛""„‟'']/.test(prev);
            if (!naPocetkuRijeci) {
              naslovInp.value = val.substring(0, ci) + ch.toLowerCase() + val.substring(ci + 1);
              try { naslovInp.setSelectionRange(pos, pos); } catch (eS) {}
            }
          }
        }
        esejProvedeUvjeteForma();
      });

      /* Blur: VERZAL → kurent, sredina → malo (pokriva paste i edge-caseove). */
      naslovInp.addEventListener('blur', function () {
        var val = esejNaslovSreduji(naslovInp.value);
        if (val !== naslovInp.value) naslovInp.value = val;
        esejProvedeUvjeteForma();
      });
    }
    var stupanjSel = document.getElementById('esej_select_stupanj');
    if (stupanjSel) stupanjSel.addEventListener('change', esejProvedeUvjeteForma);
    var sadrzajTa = document.getElementById('esej_sadrzaj');
    if (sadrzajTa) {
      sadrzajTa.addEventListener('input', esejProvedeUvjeteForma);
      /* Paste: ulijepiti samo plain tekst bez HTML formatiranja. */
      sadrzajTa.addEventListener('paste', function (e) {
        e.preventDefault();
        var tekst = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
        if (tekst) {
          document.execCommand('insertText', false, tekst);
          /* execCommand ne okida input pouzdano u svim browserima — reevaluiraj uvjete za tipke. */
          setTimeout(esejProvedeUvjeteForma, 0);
        }
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
        btnIzbrisi.disabled = true;
        esejPostJson(getApiUrl('Esej_CRUD_brisanje.php'), { id: esejTrenutniId }, function (res, status) {
          btnIzbrisi.disabled = false;
            if (status >= 200 && status < 300 && res === 'OK') {
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('003', [], function () { esejOcistiFormu(); });
              } else {
                esejOcistiFormu();
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
