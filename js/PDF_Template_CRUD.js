/* PDF_Template_CRUD.js — tablica + edit (tab kontrola) za pdf_template ("Opis stranice").
 * Edit polja id = 'edit_<stupac>'; logika generička nad FIELDS.
 * Dinamika (disable, ne skrivanje — app pravilo): format=custom→dimenzije; zaglavlje/podnozje/broj_stranice→ovisna polja;
 *           dvostran/vezna_margina uvijek disabled (buduće). Bez naziva sve disable.
 * Pregled: HTML/CSS shema stranice (margine + zone zaglavlja/podnožja + brojač + naslovna).
 * API: PDF_Template_CRUD_sve/_upis/_izmjena/_brisanje.php.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Template_CRUD.html');

  var API_BASE = '../php/';

  var PDF_TemplateCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-template-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv opisa', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  /* Standardni formati papira (mm, uspravno) — za shemu pregleda. */
  var FORMATI = {
    A4: [210, 297], A5: [148, 210], A3: [297, 420],
    Letter: [215.9, 279.4], Legal: [215.9, 355.6]
  };

  var PT_MM = 0.352778;   /* 1 pt u mm */
  var DEMO_PT = 12;       /* veličina demo teksta u pt */
  var LOREM_DEMO = (function () {
    var p = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. ';
    var s = ''; for (var i = 0; i < 14; i++) s += p; return s;
  })();

  var FIELDS = [
    { col: 'naziv', type: 'text' },
    { col: 'format_papira', type: 'select', def: 'A4' },
    { col: 'sirina_mm', type: 'num', def: '' },
    { col: 'visina_mm', type: 'num', def: '' },
    { col: 'orijentacija', type: 'select', def: 'portrait' },
    { col: 'margina_gore_mm', type: 'num', def: '20' },
    { col: 'margina_dolje_mm', type: 'num', def: '20' },
    { col: 'margina_lijevo_mm', type: 'num', def: '20' },
    { col: 'margina_desno_mm', type: 'num', def: '20' },
    { col: 'zaglavlje', type: 'check' },
    { col: 'zaglavlje_visina_mm', type: 'num', def: '0' },
    { col: 'zaglavlje_padding_mm', type: 'num', def: '0' },
    { col: 'zaglavlje_primjena', type: 'select', def: 'svaka' },
    { col: 'podnozje', type: 'check' },
    { col: 'podnozje_visina_mm', type: 'num', def: '0' },
    { col: 'podnozje_padding_mm', type: 'num', def: '0' },
    { col: 'podnozje_od_stranice', type: 'num', def: '1', cijeli: true },
    { col: 'broj_stranice', type: 'check' },
    { col: 'broj_stranice_format', type: 'text', def: '' },   /* prazno → vidi se placeholder; backend upiše 'Stranica #S od #U' */
    { col: 'broj_stranice_zona', type: 'select', def: 'podnozje' },
    { col: 'broj_stranice_poravnanje', type: 'select', def: 'centar' },
    { col: 'naslovna_stranica', type: 'check' },
    { col: 'dvostran', type: 'check' },
    { col: 'vezna_margina_mm', type: 'num', def: '0' },
    { col: 'napomena', type: 'text' }
  ];

  var SELEKTI = ['format_papira', 'orijentacija', 'zaglavlje_primjena', 'broj_stranice_zona', 'broj_stranice_poravnanje'];

  function byId(id) { return document.getElementById(id); }
  function elOf(f) { return byId('edit_' + f.col); }
  function vEdit(col) { var el = byId('edit_' + col); return el ? el.value : ''; }
  function cEdit(col) { var el = byId('edit_' + col); return !!(el && el.checked); }
  function vBroj(col) { return parseFloat(String(vEdit(col)).replace(',', '.')) || 0; }
  function trim(s) { return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : ''); }
  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }
  function refreshSveSelekte() { SELEKTI.forEach(function (c) { refreshSelect('edit_' + c); }); }
  function postFormData(url, params, cb) { if (window.CommonPostFormData) window.CommonPostFormData(url, params, cb); else cb(''); }
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
  function brojNiz(v) { var n = parseFloat(v); return isNaN(n) ? '' : String(n); }
  function normalizirajBroj(el, cijeli) {
    if (!el) return;
    var raw = trim(el.value);
    if (raw === '') return;
    var n = parseFloat(raw.replace(',', '.'));
    if (isNaN(n)) { el.value = ''; return; }
    if (cijeli) n = Math.round(n);
    el.value = String(n);
  }

  /* ===== Pregled: HTML/CSS shema stranice ===== */
  function dimsStranice() {
    var fmt = vEdit('format_papira'), w, h;
    if (fmt === 'custom') { w = vBroj('sirina_mm'); h = vBroj('visina_mm'); }
    else { var d = FORMATI[fmt] || FORMATI.A4; w = d[0]; h = d[1]; }
    if (vEdit('orijentacija') === 'landscape') { var t = w; w = h; h = t; }
    return { w: w, h: h };
  }

  /* Toggle pregleda: 1. ili 2. stranica (da se vidi npr. zaglavlje samo na prvoj). */
  var _stranica = 1;
  var SVG_JEDNA = '<svg viewBox="-3 -3 34 50" width="19" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="0" y="0" width="28" height="44" rx="2" fill="#fff"/><line x1="6" y1="20" x2="22" y2="20"/><line x1="6" y1="27" x2="22" y2="27"/><line x1="6" y1="34" x2="18" y2="34"/></svg>';
  var SVG_VISE = '<svg viewBox="-3 -3 50 60" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="0" y="0" width="30" height="40" rx="2" fill="#fff"/><rect x="7" y="7" width="30" height="40" rx="2" fill="#fff"/><rect x="14" y="14" width="30" height="40" rx="2" fill="#fff"/><line x1="20" y1="26" x2="38" y2="26"/><line x1="20" y1="33" x2="38" y2="33"/><line x1="20" y1="40" x2="32" y2="40"/></svg>';
  function postaviTogleIkonu() {
    var btn = byId('templatePreviewToggle');
    if (!btn) return;
    btn.innerHTML = (_stranica === 1) ? SVG_JEDNA : SVG_VISE;
    btn.setAttribute('aria-label', _stranica === 1 ? 'Prikazana 1. stranica — klik za 2.' : 'Prikazana 2. stranica — klik za 1.');
    btn.title = _stranica === 1 ? '1. stranica' : '2. stranica';
  }

  /* Toggle demo teksta: puni tijelo stranice demo linijama (vizualni prikaz razmaka od zaglavlja/podnožja). */
  var _demoTekst = false;
  var SVG_DEMO_PUNA = '<svg viewBox="-3 -3 34 50" width="19" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M0 0 H18 L28 10 V44 H0 Z" fill="#fff"/><path d="M18 0 V10 H28"/><line x1="6" y1="18" x2="22" y2="18"/><line x1="6" y1="24" x2="22" y2="24"/><line x1="6" y1="30" x2="22" y2="30"/><line x1="6" y1="36" x2="16" y2="36"/></svg>';
  var SVG_DEMO_PRAZNA = '<svg viewBox="-3 -3 34 50" width="19" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M0 0 H18 L28 10 V44 H0 Z" fill="#fff"/><path d="M18 0 V10 H28"/></svg>';
  function postaviDemoIkonu() {
    var btn = byId('templateDemoToggle');
    if (!btn) return;
    btn.innerHTML = _demoTekst ? SVG_DEMO_PUNA : SVG_DEMO_PRAZNA;
    btn.classList.toggle('pdf-template-crud__preview-toggle--aktivan', _demoTekst);
    btn.setAttribute('aria-label', _demoTekst ? 'Ukloni demo tekst' : 'Prikaži demo tekst');
  }
  function omoguciTogle(on) {
    var d1 = byId('templateDemoToggle'), d2 = byId('templatePreviewToggle');
    if (d1) d1.disabled = !on;
    if (d2) d2.disabled = !on;
  }

  function formatBrojaca(stranica) {
    var f = vEdit('broj_stranice_format') || 'Stranica #S od #U';
    return f.replace(/#S/g, String(stranica)).replace(/#U/g, '3');
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function renderPreview() {
    var area = byId('templatePreviewArea');
    var prazno = byId('templatePreviewPrazno');
    if (!area) return;
    var imaNaziv = trim(vEdit('naziv')) !== '';
    var d = dimsStranice();
    if (!imaNaziv || d.w <= 0 || d.h <= 0) {
      area.innerHTML = '';
      if (prazno) { prazno.style.display = ''; prazno.textContent = imaNaziv ? '(upišite dimenzije papira)' : '(upišite naziv opisa)'; }
      omoguciTogle(false);
      return;
    }
    if (prazno) prazno.style.display = 'none';
    omoguciTogle(true);

    var availW = (area.clientWidth || 320) - 32;
    var availH = (area.clientHeight || 420) - 32;
    if (availW < 40) availW = 40;
    if (availH < 40) availH = 40;
    var scale = Math.min(availW / d.w, availH / d.h);
    var Wpx = d.w * scale, Hpx = d.h * scale;

    var mg = vBroj('margina_gore_mm'), md = vBroj('margina_dolje_mm'),
        ml = vBroj('margina_lijevo_mm'), mr = vBroj('margina_desno_mm');
    /* Zone ovise o prikazanoj stranici: zaglavlje (primjena=prva → samo str.1), podnožje (od_stranice). */
    var zaglNaStr = cEdit('zaglavlje') && (_stranica === 1 || vEdit('zaglavlje_primjena') === 'svaka');
    var podnNaStr = cEdit('podnozje') && (_stranica >= (vBroj('podnozje_od_stranice') || 1));
    var zv = zaglNaStr ? vBroj('zaglavlje_visina_mm') : 0;
    var pv = podnNaStr ? vBroj('podnozje_visina_mm') : 0;

    var stranica = el('div', 'pdf-template-crud__stranica');
    stranica.style.width = Wpx + 'px';
    stranica.style.height = Hpx + 'px';

    /* zone zaglavlja/podnožja (pune trake uz gornji/donji rub, unutar lijeve/desne margine) */
    if (zv > 0) {
      var zz = el('div', 'pdf-template-crud__zona');
      zz.style.left = (ml * scale) + 'px';
      zz.style.right = (mr * scale) + 'px';
      zz.style.top = '0px';
      zz.style.height = (zv * scale) + 'px';
      var ozz = el('span', 'pdf-template-crud__zona-oznaka'); ozz.textContent = 'Zaglavlje'; zz.appendChild(ozz);
      stranica.appendChild(zz);
    }
    if (pv > 0) {
      var zp = el('div', 'pdf-template-crud__zona');
      zp.style.left = (ml * scale) + 'px';
      zp.style.right = (mr * scale) + 'px';
      zp.style.bottom = '0px';
      zp.style.height = (pv * scale) + 'px';
      var ozp = el('span', 'pdf-template-crud__zona-oznaka'); ozp.textContent = 'Podnožje'; zp.appendChild(ozp);
      stranica.appendChild(zp);
    }

    /* okvir margina (iscrtkano) — tijelo */
    var marg = el('div', 'pdf-template-crud__margine');
    marg.style.top = (mg * scale) + 'px';
    marg.style.left = (ml * scale) + 'px';
    marg.style.right = (mr * scale) + 'px';
    marg.style.bottom = (md * scale) + 'px';
    stranica.appendChild(marg);

    /* demo tekst: tijelo od (margina gore + razmak zaglavlja) do (margina dolje + razmak podnožja) */
    if (_demoTekst) {
      var zp = vBroj('zaglavlje_padding_mm'), pp = vBroj('podnozje_padding_mm');
      var bt = (mg + (zaglNaStr ? zp : 0)) * scale;
      var bb = Hpx - (md + (podnNaStr ? pp : 0)) * scale;
      if (bb > bt + 2) {
        var dt = el('div', 'pdf-template-crud__demo-tekst');
        dt.style.left = (ml * scale) + 'px';
        dt.style.right = (mr * scale) + 'px';
        dt.style.top = bt + 'px';
        dt.style.height = (bb - bt) + 'px';
        dt.style.fontSize = (DEMO_PT * PT_MM * scale) + 'px';   /* 12 pt skalirano kao stranica */
        dt.style.lineHeight = '1.3';
        dt.textContent = LOREM_DEMO;
        stranica.appendChild(dt);
      }
    }

    /* naslovna oznaka (samo na 1. stranici) */
    if (cEdit('naslovna_stranica') && _stranica === 1) {
      var nas = el('div', 'pdf-template-crud__naslovna-oznaka'); nas.textContent = 'Naslovna';
      stranica.appendChild(nas);
    }

    /* brojač stranica */
    if (cEdit('broj_stranice')) {
      var zona = vEdit('broj_stranice_zona'), por = vEdit('broj_stranice_poravnanje');
      var b = el('div', 'pdf-template-crud__brojac');
      b.textContent = formatBrojaca(_stranica);
      var yMid;
      if (zona === 'zaglavlje') yMid = (zv > 0 ? zv * scale / 2 : mg * scale / 2);
      else yMid = Hpx - (pv > 0 ? pv * scale / 2 : md * scale / 2);
      b.style.top = (yMid - 7) + 'px';
      if (por === 'lijevo') { b.style.left = (ml * scale + 2) + 'px'; }
      else if (por === 'desno') { b.style.right = (mr * scale + 2) + 'px'; }
      else { b.style.left = (ml * scale + (Wpx - (ml + mr) * scale) / 2) + 'px'; b.style.transform = 'translateX(-50%)'; }
      stranica.appendChild(b);
    }

    area.innerHTML = '';
    area.appendChild(stranica);
  }

  /* ---- Tablica ---- */
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var templatePoId = {};

  CommonCRUD.initTablica('tablicaContainer', PDF_TemplateCRUD, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function redIzObjekta(o) {
    return [o.naziv != null ? o.naziv : '', o.id != null ? o.id : 0];
  }

  function ucitajPodatkeTablica(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Template_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      templatePoId = {};
      if (text !== '' && text.charAt(0) !== '[') {
        porukaIzKoda(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) {
            var o = arr[j];
            if (o && o.id != null) templatePoId[String(o.id)] = o;
            rows.push(redIzObjekta(o));
          }
          rows.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'hr', { sensitivity: 'base' }); });
        } catch (e) {}
      }
      azurirajNaslijediSelekt();
      if (cb) cb(rows);
    };
    xhr.send();
  }

  /* „Nasljedi opis" selekt: opcije = svi postojeći; skriven ako je tablica prazna. */
  function azurirajNaslijediSelekt() {
    var sel = byId('edit_naslijedi'); var wrap = byId('naslijediWrap');
    if (!sel || !wrap) return;
    var lista = Object.keys(templatePoId).map(function (id) { return templatePoId[id]; })
      .sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
    while (sel.options.length > 1) sel.remove(1);
    lista.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = String(o.id);
      opt.textContent = o.naziv != null ? o.naziv : ('#' + o.id);
      sel.appendChild(opt);
    });
    sel.value = '';
    wrap.hidden = lista.length === 0;
    refreshSelect('edit_naslijedi');
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_TemplateCRUD.Tablica_Zaglavlje);
      requestAnimationFrame(fiksirajMinVisinuTablice);
    });
  }

  /* Donji pod resizea = PRIRODNA visina (zaglavlje + tablica). Mjeri se s temp height:auto da
     ovisi o sadržaju (npr. kad se pojavi „Nasljedi opis" selekt → zaglavlje naraste), a NE o
     trenutnoj/ručno-resizeanoj visini. Preračunava se i kad se podaci promijene. */
  function fiksirajMinVisinuTablice() {
    var panel = document.querySelector('.pdf-template-crud__panel-tablica');
    if (!panel) return;
    var pH = panel.style.height, pMin = panel.style.minHeight;
    panel.style.height = 'auto';
    panel.style.minHeight = '0';
    var h = Math.round(panel.offsetHeight || 0);
    panel.style.height = pH;
    panel.style.minHeight = pMin;
    if (h > 0) {
      panel.style.minHeight = h + 'px';
      panel.setAttribute('data-resize-min-px', String(h));
    }
  }

  /* ---- Dinamička polja (disable, ne skrivanje) ---- */
  function postaviGrupaDisabled(wrapId, dis) {
    var wrap = byId(wrapId);
    if (!wrap) return;
    if (typeof KontroleSetEnabled === 'function') KontroleSetEnabled(wrap, !dis);
    else {
      var c = wrap.querySelectorAll('input, select, textarea, button');
      Array.prototype.forEach.call(c, function (e) { e.disabled = dis; if (e.tagName === 'SELECT' && e.id) refreshSelect(e.id); });
    }
  }
  function syncLabele() {
    var ep = byId('edit_panel');
    if (ep && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(ep);
  }

  /* Disable pojedinačnih polja po id-u (kad checkbox dijeli red s poljima pa wrapper ne ide). */
  function postaviPoljaDisabled(ids, dis) {
    ids.forEach(function (id) {
      var e = byId(id);
      if (!e) return;
      if (typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(e, !dis);
      else { e.disabled = dis; if (e.tagName === 'SELECT' && e.id) refreshSelect(e.id); }
    });
  }

  function azurirajFormat() { postaviGrupaDisabled('tmpl_custom_red', vEdit('format_papira') !== 'custom'); }
  function azurirajZaglavlje() { postaviPoljaDisabled(['edit_zaglavlje_visina_mm', 'edit_zaglavlje_padding_mm', 'edit_zaglavlje_primjena'], !cEdit('zaglavlje')); }
  function azurirajPodnozje() { postaviPoljaDisabled(['edit_podnozje_visina_mm', 'edit_podnozje_padding_mm', 'edit_podnozje_od_stranice'], !cEdit('podnozje')); }
  function azurirajBrojac() { postaviPoljaDisabled(['edit_broj_stranice_format', 'edit_broj_stranice_zona', 'edit_broj_stranice_poravnanje'], !cEdit('broj_stranice')); }
  function azurirajBuduce() { postaviGrupaDisabled('tmpl_buduce_red', true); }   /* uvijek disabled */

  function primijeniDinamiku() {
    azurirajFormat(); azurirajZaglavlje(); azurirajPodnozje(); azurirajBrojac(); azurirajBuduce();
  }

  /* Bez naziva sve kontrole u tabovima disable; s nazivom enable + dinamika. */
  function azurirajDisableTaba() {
    var nazivEl = byId('edit_naziv');
    var imaNaziv = nazivEl ? trim(nazivEl.value) !== '' : false;
    var tijelo = document.querySelector('.pdf-template-crud__tab .kontrola-tab__tijelo');
    if (tijelo) {
      var kontrole = tijelo.querySelectorAll('input, select, button, textarea');
      Array.prototype.forEach.call(kontrole, function (e) { e.disabled = !imaNaziv; });
    }
    var tabRoot = byId('templateTab');
    if (tabRoot) {
      var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
      Array.prototype.forEach.call(kartice, function (k) { k.disabled = !imaNaziv; });
      if (!imaNaziv && typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabRoot, 0);
    }
    var nap = byId('edit_napomena'); if (nap) nap.disabled = !imaNaziv;
    var nasl = byId('edit_naslijedi'); if (nasl) { nasl.disabled = !imaNaziv; refreshSelect('edit_naslijedi'); }
    if (imaNaziv) primijeniDinamiku();
    refreshSveSelekte();
    syncLabele();
    /* „Margine" labela prati disabled stanje edita margina */
    var mgEl = byId('edit_margina_gore_mm');
    var margNaslov = document.querySelector('.pdf-template-crud__margine-naslov');
    if (margNaslov) margNaslov.classList.toggle('pdf-template-crud__margine-naslov--disabled', !!(mgEl && mgEl.disabled));
  }

  /* ---- Punjenje / čišćenje ---- */
  function popuniIzObjekta(o, skipNaziv) {
    FIELDS.forEach(function (f) {
      if (skipNaziv && f.col === 'naziv') return;
      var e = elOf(f);
      if (!e) return;
      var v = o[f.col];
      if (f.type === 'check') { e.checked = (v === 1 || v === '1' || v === true); }
      else if (f.type === 'num') {
        e.value = (v != null && v !== '')
          ? (f.cijeli ? String(Math.round(parseFloat(v) || 0)) : brojNiz(v))
          : (f.def != null ? f.def : '');
      } else { e.value = (v != null ? String(v) : (f.def || '')); }
    });
    if (!skipNaziv) { var ns = byId('edit_naslijedi'); if (ns) ns.value = ''; }
    refreshSveSelekte();
    azurirajDisableTaba();
    renderPreview();
  }

  function clearForm() {
    FIELDS.forEach(function (f) {
      var e = elOf(f);
      if (!e) return;
      if (f.type === 'check') { e.checked = false; }
      else { e.value = (f.def != null ? f.def : ''); }
    });
    var nazivEl = byId('edit_naziv');
    if (nazivEl) nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
    var ns = byId('edit_naslijedi'); if (ns) ns.value = '';
    refreshSveSelekte();
    azurirajDisableTaba();
    renderPreview();
  }

  function sakupiParams() {
    var p = {};
    FIELDS.forEach(function (f) {
      var e = elOf(f);
      if (!e) { p[f.col] = ''; return; }
      if (f.type === 'check') { p[f.col] = e.checked ? '1' : '0'; }
      else { p[f.col] = trim(e.value); }
    });
    return p;
  }

  /* ---- Selekcija reda ---- */
  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearForm(); }
    else {
      var o = templatePoId[String(id)];
      if (o) popuniIzObjekta(o);
      var nazivEl = byId('edit_naziv');
      if (nazivEl) nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateCrudUpisiState();
  };

  /* X na Naziv -> reset */
  (function () {
    var nazivEl = byId('edit_naziv');
    var wrap = nazivEl && nazivEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      clearForm();
      updateCrudUpisiState();
    });
  })();

  /* ---- Gumbi / stanje ---- */
  var btnUpisi = byId('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = byId('btnIzbrisi');

  function upisiMoguc() {
    if (trim(vEdit('naziv')) === '') return false;
    if (vEdit('format_papira') === 'custom') return vBroj('sirina_mm') > 0 && vBroj('visina_mm') > 0;
    return true;
  }

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !upisiMoguc();
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var nazivEl = byId('edit_naziv');
    if (nazivEl) {
      nazivEl.addEventListener('input', function () { updateCrudUpisiState(); azurirajDisableTaba(); renderPreview(); });
      nazivEl.addEventListener('change', function () { updateCrudUpisiState(); azurirajDisableTaba(); });
    }
    /* uvjetni togglovi */
    var fmtEl = byId('edit_format_papira'); if (fmtEl) fmtEl.addEventListener('change', function () { azurirajFormat(); syncLabele(); updateCrudUpisiState(); });
    var zglEl = byId('edit_zaglavlje'); if (zglEl) zglEl.addEventListener('change', function () { azurirajZaglavlje(); syncLabele(); });
    var pdnEl = byId('edit_podnozje'); if (pdnEl) pdnEl.addEventListener('change', function () { azurirajPodnozje(); syncLabele(); });
    var brEl = byId('edit_broj_stranice'); if (brEl) brEl.addEventListener('change', function () { azurirajBrojac(); syncLabele(); });
    /* custom dimenzije -> Upiši stanje na živo */
    ['sirina_mm', 'visina_mm'].forEach(function (col) {
      var e = byId('edit_' + col); if (e) e.addEventListener('input', updateCrudUpisiState);
    });
    /* num blur normalize */
    FIELDS.forEach(function (f) {
      if (f.type === 'num') { var e = elOf(f); if (e) e.addEventListener('blur', function () { normalizirajBroj(e, f.cijeli); }); }
    });
  })();

  function obradiOdgovor(res, kodUspjeha) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(kodUspjeha, [], function () {
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          clearForm(); osvjeziTablicu();
        });
      } else { clearForm(); osvjeziTablicu(); }
      return;
    }
    porukaIzKoda(res, res.indexOf('002') === 0 ? ['Naziv opisa'] : null);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      if (!upisiMoguc()) { if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []); return; }
      var params = sakupiParams();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        params.id = String(id);
        postFormData(API_BASE + 'PDF_Template_CRUD_izmjena.php', params, function (res) { obradiOdgovor(res, '004'); });
      } else {
        postFormData(API_BASE + 'PDF_Template_CRUD_upis.php', params, function (res) { obradiOdgovor(res, '001'); });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'PDF_Template_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearForm(); osvjeziTablicu();
            });
          }
        } else { porukaIzKoda(res); }
      });
    });
  }

  (function () {
    var btnPovratak = byId('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
      if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e2) {} }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  /* Nasljedi opis: kopiraj sve osim naziva */
  (function () {
    var naslEl = byId('edit_naslijedi');
    if (!naslEl) return;
    naslEl.addEventListener('change', function () {
      var id = naslEl.value; if (!id) return;
      var o = templatePoId[String(id)]; if (!o) return;
      popuniIzObjekta(o, true);
      updateCrudUpisiState();
    });
  })();

  /* ---- Init ---- */
  if (typeof KontroleTabInit === 'function') KontroleTabInit(byId('templateTab'));
  ucitajPodatkeTablica(function (rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_TemplateCRUD.Tablica_Zaglavlje);
    requestAnimationFrame(fiksirajMinVisinuTablice);
  });
  clearForm();
  updateCrudUpisiState();

  /* Pregled: render na promjenu (input/change) + na promjenu veličine prostora pregleda */
  (function () {
    var ep = byId('edit_panel');
    if (ep) { ep.addEventListener('input', renderPreview); ep.addEventListener('change', renderPreview); }
    var tbtn = byId('templatePreviewToggle');
    if (tbtn) tbtn.addEventListener('click', function () { _stranica = (_stranica === 1) ? 2 : 1; postaviTogleIkonu(); renderPreview(); });
    postaviTogleIkonu();
    var dbtn = byId('templateDemoToggle');
    if (dbtn) dbtn.addEventListener('click', function () { _demoTekst = !_demoTekst; postaviDemoIkonu(); renderPreview(); });
    postaviDemoIkonu();
    var area = byId('templatePreviewArea');
    var tmo = null;
    function naResize() { if (tmo) clearTimeout(tmo); tmo = setTimeout(renderPreview, 60); }
    if (window.ResizeObserver && area) { new ResizeObserver(naResize).observe(area); }
    else { window.addEventListener('resize', naResize); }
    if (document.readyState === 'complete') requestAnimationFrame(renderPreview);
    else window.addEventListener('load', function () { requestAnimationFrame(renderPreview); });
  })();

  /* Donji pod resizea panela tablice — postavi pri učitavanju (i preračunava se pri promjeni podataka). */
  if (document.readyState === 'complete') requestAnimationFrame(fiksirajMinVisinuTablice);
  else window.addEventListener('load', function () { requestAnimationFrame(fiksirajMinVisinuTablice); });
})();
