/* PDF_Stilovi_Tablice_CRUD.js — CRUD pdf_tablica_stil (+ pdf_tablica_stil_kolona).
 * Edit polja: id = 'edit_<stupac>' (generička FIELDS logika). Stupci: pod-tablica (kolonState, uzor okviri).
 * Boje: .kontrola-boja (alpha off). Pregled: pdfmake uzorak tablice (PdfRender.Pdf/Fontovi).
 * API: PDF_Stilovi_Tablice_CRUD_sve/_upis/_izmjena/_brisanje.php; fontovi: PDF_Fontovi_CRUD_sve.php.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Stilovi_Tablice_CRUD.html');

  var API_BASE = '../php/';

  var TablicaStilCRUD = {
    Broj_Kolona: 1, Reload_Ikona: 0, CrudCssPrefix: 'pdf-stilovi-tablice-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv stila', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var KOLONE_TABLICA = {
    Broj_Kolona: 1, Reload_Ikona: 0, CrudCssPrefix: 'pdf-stilovi-tablice-crud',
    Tablica_Zaglavlje: [
      { key: 'opis', title: 'Stupci (redom)', SQL_Naziv: 'opis', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  /* type: text|num|select|check|color. Sva polja stila (osim id + stupci). */
  var FIELDS = [
    { col: 'naziv', type: 'text' },
    { col: 'napomena', type: 'text' },
    { col: 'zaglavlje_font_id', type: 'select', def: '' },
    { col: 'zaglavlje_velicina_pt', type: 'num', def: '' },
    { col: 'zaglavlje_bold', type: 'check' },
    { col: 'zaglavlje_italic', type: 'check' },
    { col: 'zaglavlje_podcrtano', type: 'check' },
    { col: 'zaglavlje_boja', type: 'color', nullable: true, def: '' },
    { col: 'podaci_font_id', type: 'select', def: '' },
    { col: 'podaci_velicina_pt', type: 'num', def: '' },
    { col: 'podaci_bold', type: 'check' },
    { col: 'podaci_italic', type: 'check' },
    { col: 'podaci_podcrtano', type: 'check' },
    { col: 'podaci_boja', type: 'color', nullable: true, def: '' },
    { col: 'okvir_debljina_mm', type: 'num', def: '' },
    { col: 'okvir_boja', type: 'color', nullable: true, def: '' },
    { col: 'zaglavlje_linija_debljina_mm', type: 'num', def: '' },
    { col: 'zaglavlje_linija_boja', type: 'color', nullable: true, def: '' },
    { col: 'linija_vert_debljina_mm', type: 'num', def: '' },
    { col: 'linija_vert_boja', type: 'color', nullable: true, def: '' },
    { col: 'linija_red_debljina_mm', type: 'num', def: '' },
    { col: 'linija_red_boja', type: 'color', nullable: true, def: '' },
    { col: 'zaglavlje_pozadina', type: 'check' },
    { col: 'zaglavlje_pozadina_boja', type: 'color', nullable: true, def: '' },
    { col: 'zebra', type: 'check' },
    { col: 'zebra_boja', type: 'color', nullable: true, def: '' },
    { col: 'zaglavlje_padding_gore_mm', type: 'num', def: '' },
    { col: 'zaglavlje_padding_dolje_mm', type: 'num', def: '' },
    { col: 'podaci_padding_gore_mm', type: 'num', def: '' },
    { col: 'podaci_padding_dolje_mm', type: 'num', def: '' },
    { col: 'razdvajac', type: 'text', def: '|' },
    { col: 'prikazi_zaglavlje', type: 'check' },
    { col: 'zaglavlje_ponavljanje', type: 'select', def: 'prva' },
    { col: 'ne_lomi_red', type: 'check' },
    { col: 'razmak_prije_mm', type: 'num', def: '' },
    { col: 'razmak_poslije_mm', type: 'num', def: '' },
    { col: 'pozicioniranje', type: 'select', def: 'u_tijeku' },
    { col: 'poravnanje', type: 'select', def: 'lijevo' },
    { col: 'pozicija_x_mm', type: 'num', def: '' },
    { col: 'pozicija_y_mm', type: 'num', def: '' }
  ];

  /* Stupci stila (edit fields kol_<naziv>). */
  var KOL_FIELDS = ['naziv', 'zaglavlje', 'sirina_tip', 'sirina_mm', 'zag_orijentacija', 'zag_padding_lijevo_mm', 'zag_padding_desno_mm', 'zag_prefix', 'zag_sufiks', 'pod_orijentacija', 'pod_padding_lijevo_mm', 'pod_padding_desno_mm', 'pod_prefix', 'pod_sufiks'];

  function byId(id) { return document.getElementById(id); }
  function elOf(f) { return byId('edit_' + f.col); }
  function trim(s) { return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : ''); }
  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }
  function postFormData(url, params, cb) { if (window.CommonPostFormData) window.CommonPostFormData(url, params, cb); else cb(''); }
  function vEdit(col) { var el = byId('edit_' + col); return el ? el.value : ''; }
  function cEdit(col) { var el = byId('edit_' + col); return !!(el && el.checked); }
  function vBroj(col) { return parseFloat(String(vEdit(col)).replace(',', '.')) || 0; }
  function brojNiz(v) { var n = parseFloat(v); return isNaN(n) ? '' : String(n); }
  function MM(n) { return (parseFloat(String(n).replace(',', '.')) || 0) * 2.83465; }
  function normalizirajBroj(el) {
    if (!el) return;
    var raw = trim(el.value); if (raw === '') return;
    var n = parseFloat(raw.replace(',', '.'));
    el.value = isNaN(n) ? '' : String(n);
  }
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }
  function porukaIzKoda(res, repl) {
    var p = parseResponseCode(res);
    if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal(p.code, repl || p.replacements);
    }
  }

  /* ===== Fontovi (registar: id → {porodica, pdfmake_kljuc}); puni selekte + preview ===== */
  var fontPoId = {};
  var PREVIEW_FONT = null;
  function ucitajFontoveRegistar(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Fontovi_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var lista = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          arr.forEach(function (o) {
            if (!o || o.id == null) return;
            if (!(o.aktivan === 1 || o.aktivan === '1' || o.aktivan === true)) return;
            fontPoId[String(o.id)] = o;
            lista.push(o);
          });
        } catch (e) {}
      }
      lista.sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
      ['edit_zaglavlje_font_id', 'edit_podaci_font_id'].forEach(function (selId) {
        var sel = byId(selId); if (!sel) return;
        while (sel.options.length > 1) sel.remove(1);
        lista.forEach(function (o) { var op = document.createElement('option'); op.value = String(o.id); op.textContent = o.naziv != null ? o.naziv : ('#' + o.id); sel.appendChild(op); });
        refreshSelect(selId);
      });
      if (lista.length) PREVIEW_FONT = { porodica: lista[0].porodica, kljuc: lista[0].pdfmake_kljuc };
      if (cb) cb();
    };
    xhr.send();
  }
  function fontZa(selId) {
    var id = byId(selId) ? byId(selId).value : '';
    var o = id ? fontPoId[String(id)] : null;
    return o ? { porodica: o.porodica, kljuc: o.pdfmake_kljuc } : (PREVIEW_FONT || null);
  }

  /* ===== Glavna tablica stilova ===== */
  var tablicaApi = null, onCrudSelectionChange = null, stilPoId = {};
  CommonCRUD.initTablica('tablicaContainer', TablicaStilCRUD, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function redIzObjekta(o) { return [o.naziv != null ? o.naziv : '', o.id != null ? o.id : 0]; }

  function ucitajPodatkeTablica(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Stilovi_Tablice_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = []; stilPoId = {};
      if (text !== '' && text.charAt(0) !== '[') { porukaIzKoda(text); }
      else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) { var o = arr[j]; if (o && o.id != null) stilPoId[String(o.id)] = o; rows.push(redIzObjekta(o)); }
          rows.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'hr', { sensitivity: 'base' }); });
        } catch (e) {}
      }
      azurirajNaslijediSelekt();
      if (cb) cb(rows);
    };
    xhr.send();
  }
  function azurirajNaslijediSelekt() {
    var sel = byId('edit_naslijedi'), wrap = byId('naslijediWrap');
    if (!sel || !wrap) return;
    var lista = Object.keys(stilPoId).map(function (id) { return stilPoId[id]; }).sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
    while (sel.options.length > 1) sel.remove(1);
    lista.forEach(function (o) { var op = document.createElement('option'); op.value = String(o.id); op.textContent = o.naziv != null ? o.naziv : ('#' + o.id); sel.appendChild(op); });
    sel.value = ''; wrap.hidden = lista.length === 0; refreshSelect('edit_naslijedi');
  }
  function osvjeziTablicu() { ucitajPodatkeTablica(function (rows) { CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, TablicaStilCRUD.Tablica_Zaglavlje); }); }

  /* ===== Stupci (pod-tablica) — uzor okviri ===== */
  var kolonState = [], kolSel = -1, koloneApi = null, kolProgSel = false;
  CommonCRUD.initTablica('koloneTablicaContainer', KOLONE_TABLICA, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
    onReady: function (api) { koloneApi = api; },
    onSelectionChange: function () {
      if (kolProgSel) return;
      kolSel = (koloneApi && CommonCRUD.getSelectedRowId(koloneApi) != null) ? parseInt(CommonCRUD.getSelectedRowId(koloneApi), 10) : -1;
      popuniKolEdit(); azurirajKolTraka();
    }
  });
  function kolLabel(o, i) {
    var z = trim(o.zaglavlje || ''), n = trim(o.naziv || '');
    return (i + 1) + '. ' + (z || n || '(stupac)');
  }
  function renderKoloneTablica() {
    if (!koloneApi) return;
    var rows = kolonState.map(function (o, i) { return [kolLabel(o, i), i]; });
    kolProgSel = true;
    CommonCRUD.setDataTablica(koloneApi, 'koloneTablicaContainer', rows, KOLONE_TABLICA.Tablica_Zaglavlje);
    if (kolSel >= 0 && kolSel < kolonState.length && koloneApi.setSelectedRowIds) koloneApi.setSelectedRowIds([kolSel]);
    else if (koloneApi.clearSelection) koloneApi.clearSelection();
    kolProgSel = false;
  }
  function popuniKolEdit() {
    var o = (kolSel >= 0 && kolSel < kolonState.length) ? kolonState[kolSel] : null;
    KOL_FIELDS.forEach(function (k) {
      var el = byId('kol_' + k); if (!el) return;
      el.value = o ? (o[k] != null ? String(o[k]) : '') : '';
    });
    var st = byId('kol_sirina_tip'); if (st && !o) st.value = 'popuni';
    refreshSelect('kol_sirina_tip'); refreshSelect('kol_zag_orijentacija'); refreshSelect('kol_pod_orijentacija');
    azurirajKolSirina();
    postaviGrupaDisabled('kolEditWrap', !o);
  }
  function citajKolEditUStanje() {
    if (kolSel < 0 || kolSel >= kolonState.length) return;
    var o = kolonState[kolSel];
    KOL_FIELDS.forEach(function (k) { var el = byId('kol_' + k); if (el) o[k] = el.value; });
    azurirajLabelaReda();
  }
  function azurirajLabelaReda() {
    if (kolSel < 0) return;
    var cont = byId('koloneTablicaContainer');
    var tr = cont && cont.querySelector('.kontrola-tablica__scroll tbody tr[data-row-id="' + kolSel + '"]');
    var td = tr && tr.querySelector('td');
    if (td) td.textContent = kolLabel(kolonState[kolSel], kolSel);
  }
  function dodajKolona() {
    kolonState.push({ id: 0, naziv: '', zaglavlje: '', sirina_tip: 'popuni', sirina_mm: '', zag_orijentacija: 'lijevo', zag_padding_lijevo_mm: '', zag_padding_desno_mm: '', zag_prefix: '', zag_sufiks: '', pod_orijentacija: 'lijevo', pod_padding_lijevo_mm: '', pod_padding_desno_mm: '', pod_prefix: '', pod_sufiks: '' });
    kolSel = kolonState.length - 1;
    renderKoloneTablica(); popuniKolEdit(); azurirajKolTraka(); renderPreview();
  }
  function obrisiKolona() {
    if (kolSel < 0 || kolSel >= kolonState.length) return;
    kolonState.splice(kolSel, 1);
    if (kolSel >= kolonState.length) kolSel = kolonState.length - 1;
    renderKoloneTablica(); popuniKolEdit(); azurirajKolTraka(); renderPreview();
  }
  function pomakniKolona(delta) {
    var j = kolSel + delta;
    if (kolSel < 0 || j < 0 || j >= kolonState.length) return;
    var t = kolonState[kolSel]; kolonState[kolSel] = kolonState[j]; kolonState[j] = t;
    kolSel = j;
    renderKoloneTablica(); popuniKolEdit(); azurirajKolTraka(); renderPreview();
  }
  function azurirajKolTraka() {
    var ima = kolSel >= 0 && kolSel < kolonState.length;
    var b;
    if ((b = byId('kolObrisi'))) b.disabled = !ima;
    if ((b = byId('kolGore'))) b.disabled = !(ima && kolSel > 0);
    if ((b = byId('kolDolje'))) b.disabled = !(ima && kolSel < kolonState.length - 1);
  }
  function azurirajKolSirina() {
    var st = byId('kol_sirina_tip');
    var wrap = byId('kol_sirina_mm_wrap');
    if (wrap) wrap.hidden = !(st && st.value === 'fiksna');
  }
  function ucitajKolone(arr) {
    kolonState = Array.isArray(arr) ? arr.map(function (o) {
      return {
        id: (o.id != null && o.id !== '') ? parseInt(o.id, 10) : 0,
        naziv: o.naziv != null ? String(o.naziv) : '',
        zaglavlje: o.zaglavlje != null ? String(o.zaglavlje) : '',
        sirina_tip: (o.sirina_tip === 'fiksna') ? 'fiksna' : 'popuni',
        sirina_mm: (o.sirina_mm != null && o.sirina_mm !== '') ? brojNiz(o.sirina_mm) : '',
        zag_orijentacija: o.zag_orijentacija || 'lijevo',
        zag_padding_lijevo_mm: (o.zag_padding_lijevo_mm != null) ? brojNiz(o.zag_padding_lijevo_mm) : '',
        zag_padding_desno_mm: (o.zag_padding_desno_mm != null) ? brojNiz(o.zag_padding_desno_mm) : '',
        zag_prefix: o.zag_prefix != null ? String(o.zag_prefix) : '',
        zag_sufiks: o.zag_sufiks != null ? String(o.zag_sufiks) : '',
        pod_orijentacija: o.pod_orijentacija || 'lijevo',
        pod_padding_lijevo_mm: (o.pod_padding_lijevo_mm != null) ? brojNiz(o.pod_padding_lijevo_mm) : '',
        pod_padding_desno_mm: (o.pod_padding_desno_mm != null) ? brojNiz(o.pod_padding_desno_mm) : '',
        pod_prefix: o.pod_prefix != null ? String(o.pod_prefix) : '',
        pod_sufiks: o.pod_sufiks != null ? String(o.pod_sufiks) : ''
      };
    }) : [];
    kolSel = -1;
    renderKoloneTablica(); popuniKolEdit(); azurirajKolTraka();
  }
  function kolonePayload() {
    return JSON.stringify(kolonState.map(function (o, i) {
      return {
        id: o.id || 0, redoslijed: i + 1, naziv: trim(o.naziv || ''), zaglavlje: trim(o.zaglavlje || ''),
        sirina_tip: (o.sirina_tip === 'fiksna') ? 'fiksna' : 'popuni', sirina_mm: brojNiz(o.sirina_mm),
        zag_orijentacija: o.zag_orijentacija || 'lijevo', zag_padding_lijevo_mm: brojNiz(o.zag_padding_lijevo_mm) || '0', zag_padding_desno_mm: brojNiz(o.zag_padding_desno_mm) || '0', zag_prefix: o.zag_prefix || '', zag_sufiks: o.zag_sufiks || '',
        pod_orijentacija: o.pod_orijentacija || 'lijevo', pod_padding_lijevo_mm: brojNiz(o.pod_padding_lijevo_mm) || '0', pod_padding_desno_mm: brojNiz(o.pod_padding_desno_mm) || '0', pod_prefix: o.pod_prefix || '', pod_sufiks: o.pod_sufiks || ''
      };
    }));
  }
  /* Kolone edit: live u stanje */
  KOL_FIELDS.forEach(function (k) {
    var el = byId('kol_' + k); if (!el) return;
    var ev = (el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(ev, function () { citajKolEditUStanje(); if (k === 'sirina_tip') azurirajKolSirina(); renderPreview(); });
  });
  (function () {
    var b;
    if ((b = byId('kolDodaj'))) b.addEventListener('click', dodajKolona);
    if ((b = byId('kolObrisi'))) b.addEventListener('click', obrisiKolona);
    if ((b = byId('kolGore'))) b.addEventListener('click', function () { pomakniKolona(-1); });
    if ((b = byId('kolDolje'))) b.addEventListener('click', function () { pomakniKolona(1); });
  })();

  /* ===== Dinamička polja ===== */
  function postaviGrupaDisabled(wrapId, dis) {
    var wrap = byId(wrapId); if (!wrap) return;
    if (typeof KontroleSetEnabled === 'function') KontroleSetEnabled(wrap, !dis);
    else { Array.prototype.forEach.call(wrap.querySelectorAll('input, select, textarea, button'), function (el) { el.disabled = dis; if (el.tagName === 'SELECT' && el.id) refreshSelect(el.id); }); }
    Array.prototype.forEach.call(wrap.querySelectorAll('.kontrola-boja__trigger'), function (b) { b.disabled = dis; });
  }
  function syncLabele() { var ep = byId('edit_panel'); if (ep && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(ep); }
  function postaviBojaEnabled(cbId, bojaId) {
    var on = cEdit(cbId);
    var w = byId(bojaId); w = w && w.closest ? w.closest('.kontrola-boja') : null;
    if (w) { var t = w.querySelector('.kontrola-boja__trigger'); if (t) t.disabled = !on; var hx = w.querySelector('.kontrola-boja__hex'); if (hx) hx.classList.toggle('kontrola-edit--disabled', !on); }
  }
  function azurirajGrafikaDinamiku() {
    postaviBojaEnabled('zaglavlje_pozadina', 'edit_zaglavlje_pozadina_boja');
    postaviBojaEnabled('zebra', 'edit_zebra_boja');
  }
  function azurirajOstaloDinamiku() {
    var aps = vEdit('pozicioniranje') === 'apsolutno';
    var xy = byId('ostalo_xy_wrap'); if (xy) xy.hidden = !aps;
    postaviGrupaDisabled('ostalo_poravnanje_wrap', aps);
    postaviGrupaDisabled('ostalo_ponavljanje_wrap', !cEdit('prikazi_zaglavlje'));
  }

  function azurirajDisable() {
    var imaNaziv = trim(vEdit('naziv')) !== '';
    var tijelo = document.querySelector('.pdf-stilovi-tablice-crud__tab .kontrola-tab__tijelo');
    if (tijelo) Array.prototype.forEach.call(tijelo.querySelectorAll('input, select, button, textarea'), function (el) { el.disabled = !imaNaziv; });
    var tabRoot = byId('tablicaTab');
    if (tabRoot) Array.prototype.forEach.call(tabRoot.querySelectorAll('.kontrola-tab__kartica'), function (k) { k.disabled = !imaNaziv; });
    var nap = byId('edit_napomena'); if (nap) nap.disabled = !imaNaziv;
    var nasl = byId('edit_naslijedi'); if (nasl) { nasl.disabled = !imaNaziv; refreshSelect('edit_naslijedi'); }
    if (imaNaziv) { azurirajGrafikaDinamiku(); azurirajOstaloDinamiku(); azurirajKolTraka(); if (kolSel < 0) postaviGrupaDisabled('kolEditWrap', true); }
    ['zaglavlje_font_id', 'podaci_font_id', 'zaglavlje_ponavljanje', 'pozicioniranje', 'poravnanje'].forEach(function (c) { refreshSelect('edit_' + c); });
    postaviPreviewDisabled(!imaNaziv);
    syncLabele();
  }
  function postaviPreviewDisabled(dis) {
    var p = document.querySelector('.pdf-stilovi-tablice-crud__preview-panel');
    if (p) p.classList.toggle('pdf-stilovi-tablice-crud__preview-panel--disabled', dis);
  }

  /* ===== Punjenje / skupljanje / čišćenje ===== */
  function popuniIzObjekta(o, skipNaziv) {
    FIELDS.forEach(function (f) {
      if (skipNaziv && f.col === 'naziv') return;
      var el = elOf(f); if (!el) return;
      var v = o[f.col];
      if (f.type === 'check') el.checked = (v === 1 || v === '1' || v === true);
      else if (f.type === 'color') { var has = v != null && String(v).trim() !== ''; el.value = has ? String(v).toUpperCase() : ''; if (window.KontroleBojaRefresh) KontroleBojaRefresh('edit_' + f.col); }
      else if (f.type === 'num') el.value = (v != null && v !== '') ? brojNiz(v) : (f.def != null ? f.def : '');
      else el.value = (v != null ? String(v) : (f.def || ''));
    });
    if (!skipNaziv) { var ns = byId('edit_naslijedi'); if (ns) ns.value = ''; ucitajKolone(o.kolone || []); }
    else ucitajKolone(o.kolone || []);
    refreshSelectiSvih();
    azurirajDisable(); renderPreview();
  }
  function clearForm() {
    FIELDS.forEach(function (f) {
      var el = elOf(f); if (!el) return;
      if (f.type === 'check') el.checked = (f.col === 'prikazi_zaglavlje');   /* default prikazi_zaglavlje=1 */
      else if (f.type === 'color') { el.value = ''; if (window.KontroleBojaRefresh) KontroleBojaRefresh('edit_' + f.col); }
      else el.value = (f.def != null ? f.def : '');
    });
    ucitajKolone([]);
    var nazivEl = byId('edit_naziv'); if (nazivEl) nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
    var ns = byId('edit_naslijedi'); if (ns) ns.value = '';
    refreshSelectiSvih();
    azurirajDisable();
  }
  function refreshSelectiSvih() {
    ['zaglavlje_font_id', 'podaci_font_id', 'zaglavlje_ponavljanje', 'pozicioniranje', 'poravnanje'].forEach(function (c) { refreshSelect('edit_' + c); });
  }
  function sakupiParams() {
    var p = {};
    FIELDS.forEach(function (f) {
      var el = elOf(f);
      if (!el) { p[f.col] = ''; return; }
      if (f.type === 'check') p[f.col] = el.checked ? '1' : '0';
      else if (f.type === 'color') p[f.col] = trim(el.value);
      else p[f.col] = trim(el.value);
    });
    p.kolone = kolonePayload();
    return p;
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) clearForm();
    else { var o = stilPoId[String(id)]; if (o) popuniIzObjekta(o); var n = byId('edit_naziv'); if (n) n.dispatchEvent(new Event('input', { bubbles: true })); }
    updateCrudUpisiState();
  };

  (function () {
    var nazivEl = byId('edit_naziv');
    var wrap = nazivEl && nazivEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
      clearForm(); updateCrudUpisiState();
    });
  })();

  /* ===== Gumbi ===== */
  var btnUpisi = byId('btnUpisi'), btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null, btnIzbrisi = byId('btnIzbrisi');
  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var imaNaziv = trim(vEdit('naziv')) !== '';
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.disabled = !imaNaziv;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var nazivEl = byId('edit_naziv');
    if (nazivEl) { nazivEl.addEventListener('input', function () { updateCrudUpisiState(); azurirajDisable(); }); }
    var b;
    if ((b = byId('edit_zaglavlje_pozadina'))) b.addEventListener('change', function () { azurirajGrafikaDinamiku(); renderPreview(); });
    if ((b = byId('edit_zebra'))) b.addEventListener('change', function () { azurirajGrafikaDinamiku(); renderPreview(); });
    if ((b = byId('edit_pozicioniranje'))) b.addEventListener('change', azurirajOstaloDinamiku);
    if ((b = byId('edit_prikazi_zaglavlje'))) b.addEventListener('change', function () { azurirajOstaloDinamiku(); renderPreview(); });
    if ((b = byId('kol_sirina_tip'))) b.addEventListener('change', azurirajKolSirina);
    var naslEl = byId('edit_naslijedi');
    if (naslEl) naslEl.addEventListener('change', function () { var id = naslEl.value; if (!id) return; var o = stilPoId[String(id)]; if (!o) return; popuniIzObjekta(o, true); updateCrudUpisiState(); });
    FIELDS.forEach(function (f) { if (f.type === 'num') { var e = elOf(f); if (e) e.addEventListener('blur', function () { normalizirajBroj(e); }); } });
  })();

  function obradiOdgovor(res, kod) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') window.showPorukaModal(kod, [], function () { if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection(); clearForm(); osvjeziTablicu(); });
      else { clearForm(); osvjeziTablicu(); }
      return;
    }
    porukaIzKoda(res, res.indexOf('002') === 0 ? ['Naziv stila'] : null);
  }
  if (btnUpisi) btnUpisi.addEventListener('click', function () {
    if (trim(vEdit('naziv')) === '') { if (window.showPorukaModal) window.showPorukaModal('105', []); return; }
    var params = sakupiParams();
    if (this.classList.contains('kontrola-btn--crud-izmjeni')) {
      var id = getSelectedRowId(); if (id == null) return; params.id = String(id);
      postFormData(API_BASE + 'PDF_Stilovi_Tablice_CRUD_izmjena.php', params, function (res) { obradiOdgovor(res, '004'); });
    } else postFormData(API_BASE + 'PDF_Stilovi_Tablice_CRUD_upis.php', params, function (res) { obradiOdgovor(res, '001'); });
  });
  if (btnIzbrisi) btnIzbrisi.addEventListener('click', function () {
    var id = getSelectedRowId(); if (id == null) return;
    postFormData(API_BASE + 'PDF_Stilovi_Tablice_CRUD_brisanje.php', { id: String(id) }, function (res) {
      if (res === 'OK') { if (window.showPorukaModal) window.showPorukaModal('003', [], function () { if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection(); clearForm(); osvjeziTablicu(); }); }
      else porukaIzKoda(res);
    });
  });
  (function () {
    var b = byId('btnPovratak'); if (!b) return;
    b.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
      if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e2) {} }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  /* ===== pdfmake pregled uzorka tablice ===== */
  function postaviFrame(dataUrl) {
    var f = byId('tablicaPreviewOkvir'); if (!f) return;
    f.src = dataUrl;   /* data: URL (ne blob:) — izbjegava Chrome particioniranje blob URL-ova */
  }
  function celStil(reg) {
    var f = fontZa('edit_' + reg + '_font_id');
    var st = { fontSize: vBroj(reg + '_velicina_pt') || 10, color: vEdit(reg + '_boja') || '#000000' };
    if (f && f.kljuc) st.font = f.kljuc;
    if (cEdit(reg + '_bold')) st.bold = true;
    if (cEdit(reg + '_italic')) st.italics = true;
    if (cEdit(reg + '_podcrtano')) st.decoration = 'underline';
    return st;
  }
  function uzorakStupci() {
    if (kolonState.length) return kolonState;
    return [
      { zaglavlje: 'Stupac 1', sirina_tip: 'popuni', pod_orijentacija: 'lijevo', zag_orijentacija: 'lijevo' },
      { zaglavlje: 'Stupac 2', sirina_tip: 'popuni', pod_orijentacija: 'lijevo', zag_orijentacija: 'lijevo' },
      { zaglavlje: 'Stupac 3', sirina_tip: 'popuni', pod_orijentacija: 'desno', zag_orijentacija: 'desno' }
    ];
  }
  function sastaviDocDefinition() {
    var stupci = uzorakStupci();
    var imaZag = cEdit('prikazi_zaglavlje');
    var zagStil = celStil('zaglavlje'), podStil = celStil('podaci');
    var zPadG = MM(vBroj('zaglavlje_padding_gore_mm')), zPadD = MM(vBroj('zaglavlje_padding_dolje_mm'));
    var pPadG = MM(vBroj('podaci_padding_gore_mm')), pPadD = MM(vBroj('podaci_padding_dolje_mm'));

    var widths = stupci.map(function (s) { return (s.sirina_tip === 'fiksna' && vBrojX(s.sirina_mm) > 0) ? MM(s.sirina_mm) : '*'; });
    var body = [];
    if (imaZag) {
      body.push(stupci.map(function (s) {
        var t = trim(s.zag_prefix || '') + trim(s.zaglavlje || '') + trim(s.zag_sufiks || '');
        var c = Object.assign({ text: t || ' ', alignment: s.zag_orijentacija || 'lijevo' }, zagStil);
        return c;
      }));
    }
    for (var r = 0; r < 3; r++) {
      body.push(stupci.map(function (s, ci) {
        var t = trim(s.pod_prefix || '') + 'Podatak ' + (ci + 1) + trim(s.pod_sufiks || '');
        var c = Object.assign({ text: t, alignment: s.pod_orijentacija || 'lijevo' }, podStil);
        return c;
      }));
    }

    var okvirD = MM(vBroj('okvir_debljina_mm')), okvirB = vEdit('okvir_boja') || '#000000';
    var zagLinD = MM(vBroj('zaglavlje_linija_debljina_mm')), zagLinB = vEdit('zaglavlje_linija_boja') || '#000000';
    var vertD = MM(vBroj('linija_vert_debljina_mm')), vertB = vEdit('linija_vert_boja') || '#000000';
    var redD = MM(vBroj('linija_red_debljina_mm')), redB = vEdit('linija_red_boja') || '#000000';
    var brR = body.length;
    var zagPoz = cEdit('zaglavlje_pozadina') ? (vEdit('zaglavlje_pozadina_boja') || null) : null;
    var zebra = cEdit('zebra') ? (vEdit('zebra_boja') || null) : null;

    var tablica = {
      table: {
        headerRows: (imaZag && vEdit('zaglavlje_ponavljanje') === 'svaka') ? 1 : 0,
        dontBreakRows: cEdit('ne_lomi_red'),
        widths: widths,
        body: body
      },
      layout: {
        hLineWidth: function (i, node) {
          if (i === 0 || i === node.table.body.length) return okvirD;
          if (imaZag && i === 1) return zagLinD;
          return redD;
        },
        vLineWidth: function (i, node) { return (i === 0 || i === node.table.widths.length) ? okvirD : vertD; },
        hLineColor: function (i, node) { if (i === 0 || i === node.table.body.length) return okvirB; if (imaZag && i === 1) return zagLinB; return redB; },
        vLineColor: function (i, node) { return (i === 0 || i === node.table.widths.length) ? okvirB : vertB; },
        fillColor: function (rowIndex) {
          if (imaZag && rowIndex === 0) return zagPoz;
          var dataIdx = imaZag ? rowIndex - 1 : rowIndex;
          return (zebra && dataIdx >= 0 && dataIdx % 2 === 1) ? zebra : null;
        },
        paddingLeft: function (i) { return MM(vBrojX((stupci[i] || {})[(imaZag ? 'zag' : 'pod') + '_padding_lijevo_mm'])) || 2; },
        paddingRight: function (i) { return MM(vBrojX((stupci[i] || {})[(imaZag ? 'zag' : 'pod') + '_padding_desno_mm'])) || 2; },
        paddingTop: function (i, node) { return 0; },
        paddingBottom: function (i, node) { return 0; }
      },
      margin: [0, 0, 0, 0]
    };
    /* Vert. padding po retku (zaglavlje vs podaci) preko paddingTop/Bottom koji znaju red. */
    tablica.layout.paddingTop = function (rowIndex) { return (imaZag && rowIndex === 0) ? zPadG : pPadG; };
    tablica.layout.paddingBottom = function (rowIndex) { return (imaZag && rowIndex === 0) ? zPadD : pPadD; };
    /* Horizontalni padding po stupcu (uzmi iz regije zaglavlja ako ima, inače podaci). */
    tablica.layout.paddingLeft = function (ci) { var s = stupci[ci] || {}; return MM(vBrojX(s.pod_padding_lijevo_mm)) || MM(vBrojX(s.zag_padding_lijevo_mm)) || 2; };
    tablica.layout.paddingRight = function (ci) { var s = stupci[ci] || {}; return MM(vBrojX(s.pod_padding_desno_mm)) || MM(vBrojX(s.zag_padding_desno_mm)) || 2; };

    var por = vEdit('poravnanje');
    var content;
    if (vEdit('pozicioniranje') !== 'apsolutno' && (por === 'centar' || por === 'desno')) {
      content = [{ columns: (por === 'centar') ? [{ width: '*', text: '' }, Object.assign({ width: 'auto' }, tablica), { width: '*', text: '' }] : [{ width: '*', text: '' }, Object.assign({ width: 'auto' }, tablica)] }];
    } else content = [tablica];

    return {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 20],
      content: content,
      defaultStyle: (podStil.font ? { font: podStil.font } : undefined)
    };
  }
  function vBrojX(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }

  function renderPreview() {
    var spiner = byId('tablicaPreviewSpiner');
    if (trim(vEdit('naziv')) === '') { return; }
    if (!window.PdfRender || !window.PdfRender.Pdf) return;
    if (spiner) KontroleSpinerShow(spiner);
    var fz = fontZa('edit_zaglavlje_font_id'), fp = fontZa('edit_podaci_font_id');
    window.PdfRender.Pdf.ucitaj(function () {
      var trebaju = [];
      if (fz && fz.kljuc) trebaju.push(fz);
      if (fp && fp.kljuc && (!fz || fp.kljuc !== fz.kljuc)) trebaju.push(fp);
      var preostalo = trebaju.length;
      function dalje() {
        try {
          pdfMake.createPdf(sastaviDocDefinition()).getDataUrl(function (dataUrl) { postaviFrame(dataUrl); if (spiner) KontroleSpinerHide(spiner); });
        } catch (e) { if (spiner) KontroleSpinerHide(spiner); }
      }
      if (!preostalo) { dalje(); return; }
      trebaju.forEach(function (f) { window.PdfRender.Fontovi.osiguraj(f.kljuc, f.porodica, function () { if (--preostalo === 0) dalje(); }, function () { if (--preostalo === 0) dalje(); }); });
    }, function () { if (spiner) KontroleSpinerHide(spiner); });
  }

  /* ===== Init ===== */
  if (typeof KontroleTabInit === 'function') KontroleTabInit(byId('tablicaTab'));
  ucitajFontoveRegistar(function () {
    ucitajPodatkeTablica(function (rows) { CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, TablicaStilCRUD.Tablica_Zaglavlje); });
    clearForm();
    updateCrudUpisiState();
    renderPreview();
  });

  (function () { var ep = byId('edit_panel'); if (ep) ep.addEventListener('change', renderPreview); })();
})();
