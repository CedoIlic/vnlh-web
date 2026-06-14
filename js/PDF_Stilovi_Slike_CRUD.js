/* PDF_Stilovi_Slike_CRUD.js — tablica + edit (tab kontrola) za pdf_slika_stil.
 * Edit polja imaju id = 'edit_<stupac>'; logika je generička nad listom FIELDS.
 * Boja okvira: edit_okvir_boja (hex, 6-hex) + .kontrola-boja (dijeljena kontrola, alpha off :root).
 * Dinamika: okvir → boja/debljina; pozicioniranje → poravnanja (u_tijeku/usidreno) ili x/y (apsolutno);
 *           potiskuje vidljiv samo kod usidreno/apsolutno.
 * Preview (pdfmake): canvas test-slika sa stilom (dimenzije, skaliranje, okvir, prozirnost). Bez pozicioniranja na stranici.
 * API: PDF_Stilovi_Slike_CRUD_sve/_upis/_izmjena/_brisanje.php.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Stilovi_Slike_CRUD.html');

  var API_BASE = '../php/';

  var PDF_StiloviSlikeCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-stilovi-slike-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv stila', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  /* Lista editabilnih polja. type: text|num|select|check|color. */
  var FIELDS = [
    { col: 'naziv', type: 'text' },
    { col: 'sirina_mm', type: 'num', def: '' },
    { col: 'visina_mm', type: 'num', def: '' },
    { col: 'skaliranje', type: 'select', def: 'uklopi' },
    { col: 'prozirnost', type: 'num', def: '100', cijeli: true },
    { col: 'sloj', type: 'select', def: 'iznad' },
    { col: 'okvir', type: 'check' },
    { col: 'okvir_boja', type: 'color', nullable: false, def: '#000000' },
    { col: 'okvir_debljina_mm', type: 'num', def: '' },
    { col: 'pozicioniranje', type: 'select', def: 'u_tijeku' },
    { col: 'poravnanje_h', type: 'select', def: 'lijevo' },
    { col: 'poravnanje_v', type: 'select', def: 'gore' },
    { col: 'pozicija_x_mm', type: 'num', def: '' },
    { col: 'pozicija_y_mm', type: 'num', def: '' },
    { col: 'potiskuje', type: 'check' },
    { col: 'napomena', type: 'text' }
  ];

  function byId(id) { return document.getElementById(id); }
  function elOf(f) { return byId('edit_' + f.col); }

  /* ===== Lazy učitavanje pdfmake biblioteke ===== */
  var Pdf = {
    _ucitano: false,
    _ucitavanje: false,
    _cekaci: [],
    spreman: function () { return this._ucitano && !!window.pdfMake; },
    ucitaj: function (cb, errCb) {
      if (this.spreman()) { if (cb) cb(); return; }
      if (cb) this._cekaci.push(cb);
      if (this._ucitavanje) return;
      this._ucitavanje = true;
      var self = this;
      var s = document.createElement('script');
      s.src = '../js/vendor/pdfmake.min.js';
      s.async = true;
      s.onload = function () {
        self._ucitano = true; self._ucitavanje = false;
        var red = self._cekaci; self._cekaci = [];
        red.forEach(function (f) { try { f(); } catch (e) {} });
      };
      s.onerror = function () {
        self._ucitavanje = false; self._cekaci = [];
        if (errCb) errCb();
      };
      document.head.appendChild(s);
    }
  };

  /* ===== Fontovi za pdfmake — lazy-load jednog fonta (image-only doc i dalje treba registriran font) ===== */
  var Fontovi = {
    _ucitani: {},
    _uTijeku: {},
    _abBase64: function (buf) {
      var bytes = new Uint8Array(buf), bin = '', chunk = 0x8000, i;
      for (i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      return btoa(bin);
    },
    spreman: function (kljuc) { return !!this._ucitani[kljuc]; },
    osiguraj: function (kljuc, porodica, cb, errCb) {
      if (!window.pdfMake || !kljuc || !porodica) { if (errCb) errCb(); return; }
      if (this._ucitani[kljuc]) { if (cb) cb(); return; }
      if (this._uTijeku[kljuc]) { if (cb) this._uTijeku[kljuc].push(cb); return; }
      this._uTijeku[kljuc] = cb ? [cb] : [];
      var self = this;
      var mapa = { normal: 'Regular', bold: 'Bold', italics: 'Italic', bolditalics: 'BoldItalic' };
      var stilovi = ['normal', 'bold', 'italics', 'bolditalics'];
      var files = {};
      var preostalo = stilovi.length, greska = false;
      pdfMake.vfs = pdfMake.vfs || {};
      function gotovo() {
        if (--preostalo > 0) return;
        var red = self._uTijeku[kljuc] || []; delete self._uTijeku[kljuc];
        if (greska) { if (errCb) errCb(); return; }
        pdfMake.fonts = pdfMake.fonts || {};
        pdfMake.fonts[kljuc] = { normal: files.normal, bold: files.bold, italics: files.italics, bolditalics: files.bolditalics };
        self._ucitani[kljuc] = true;
        red.forEach(function (f) { try { f(); } catch (e) {} });
      }
      stilovi.forEach(function (stil) {
        var file = porodica + '-' + mapa[stil] + '.ttf';
        files[stil] = file;
        if (pdfMake.vfs[file]) { gotovo(); return; }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '../fontovi/' + file, true);
        xhr.responseType = 'arraybuffer';
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            try { pdfMake.vfs[file] = self._abBase64(xhr.response); } catch (e) { greska = true; }
          } else { greska = true; }
          gotovo();
        };
        xhr.send();
      });
    }
  };

  var PREVIEW_FONT = null;   /* { porodica, kljuc } — prvi aktivni font (samo da pdfmake ima registriran font) */

  /* ===== Test-slika: canvas uzorak (nesimetričan 4:3, markeri) — jasno pokaže uklopi/razvuci i prozirnost ===== */
  var _testSlika = null;
  function testSlika() {
    if (_testSlika) return _testSlika;
    var c = document.createElement('canvas');
    c.width = 320; c.height = 240;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 320, 240);
    g.addColorStop(0, '#7bb3e0'); g.addColorStop(1, '#21577f');
    x.fillStyle = g; x.fillRect(0, 0, 320, 240);
    /* dijagonale */
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(320, 240); x.moveTo(320, 0); x.lineTo(0, 240); x.stroke();
    /* kutni markeri */
    x.fillStyle = '#e53935';
    [[14, 14], [306, 14], [14, 226], [306, 226]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 9, 0, 2 * Math.PI); x.fill(); });
    /* strelica „gore" (orijentacija) */
    x.strokeStyle = '#fff'; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(160, 78); x.lineTo(160, 44); x.moveTo(147, 58); x.lineTo(160, 44); x.lineTo(173, 58); x.stroke();
    /* tekst */
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 30px sans-serif'; x.fillText('SLIKA', 160, 120);
    x.font = '16px sans-serif'; x.fillText('320 × 240', 160, 152);
    _testSlika = c.toDataURL('image/png');
    return _testSlika;
  }

  /* ===== Preview (pdfmake → iframe) ===== */
  var _frames = null;
  var _aktivni = 0;
  var _frameUrl = [null, null];

  function vEdit(col) { var el = byId('edit_' + col); return el ? el.value : ''; }
  function cEdit(col) { var el = byId('edit_' + col); return !!(el && el.checked); }
  function vBroj(col) { return parseFloat(String(vEdit(col)).replace(',', '.')) || 0; }

  function _revoke(u) { if (u) { try { URL.revokeObjectURL(u); } catch (e) {} } }

  function ukloniFrames() {
    if (_frames) _frames.forEach(function (f) { if (f && f.parentNode) f.parentNode.removeChild(f); });
    _revoke(_frameUrl[0]); _revoke(_frameUrl[1]);
    _frames = null; _aktivni = 0; _frameUrl = [null, null];
  }

  function osiguramFrames() {
    var sadrzaj = byId('slikePreviewSadrzaj');
    if (!sadrzaj) return null;
    if (_frames) return _frames;
    sadrzaj.textContent = '';
    function mk(skriven) {
      var f = document.createElement('iframe');
      f.className = 'pdf-stilovi-slike-crud__preview-frame';
      f.title = 'Pregled PDF-a';
      if (skriven) f.style.display = 'none';
      sadrzaj.appendChild(f);
      return f;
    }
    _frames = [mk(false), mk(true)];
    _aktivni = 0;
    return _frames;
  }

  /* Dvostruki bafer: novi PDF u skriveni iframe; tek kad je gotov, zamijeni vidljivog → bez bljeskanja. */
  function prikaziUFrame(url) {
    var frames = osiguramFrames();
    if (!frames) { _revoke(url); return; }
    var idx = _aktivni === 0 ? 1 : 0;
    var f = frames[idx];
    if (f._loadingUrl) _revoke(f._loadingUrl);
    f._loadingUrl = url;
    f.onload = function () {
      if (f._loadingUrl !== url) return;
      f.onload = null; f._loadingUrl = null;
      frames[_aktivni].style.display = 'none';
      f.style.display = '';
      _revoke(_frameUrl[_aktivni]);
      _frameUrl[_aktivni] = null;
      _frameUrl[idx] = url;
      _aktivni = idx;
    };
    f.src = url;
  }

  /* docDefinition: test-slika sa stilom. Render normaliziran na ugodnu veličinu (čuva omjere:
     stranica:slika i okvir:slika); okvir čvrsto obavija prikazanu sliku. Bez pozicioniranja na stranici. */
  function sastaviDocDefinition() {
    var wMm = vBroj('sirina_mm'), hMm = vBroj('visina_mm');
    var op = vBroj('prozirnost'); if (op < 0) op = 0; if (op > 100) op = 100;

    var NAT_W = 320, NAT_H = 240;                 /* native veličina test-uzorka */
    var TARGET = 360;                             /* ciljna duljina veće stranice okvira (pt) */
    var sc = TARGET / Math.max(wMm, hMm);
    var boxW = wMm * sc, boxH = hMm * sc;

    var imgW, imgH;
    if (vEdit('skaliranje') === 'razvuci') { imgW = boxW; imgH = boxH; }
    else { var r = Math.min(boxW / NAT_W, boxH / NAT_H); imgW = NAT_W * r; imgH = NAT_H * r; }

    var img = { image: testSlika(), width: imgW, height: imgH, opacity: op / 100 };

    var node = img, bw = 0;
    if (cEdit('okvir')) {
      var bwMm = vBroj('okvir_debljina_mm');
      if (bwMm > 0) {
        bw = bwMm * sc;
        var boja = vEdit('okvir_boja') || '#000000';
        node = {
          table: { widths: ['auto'], body: [[img]] },
          layout: {
            hLineWidth: function () { return bw; },
            vLineWidth: function () { return bw; },
            hLineColor: function () { return boja; },
            vLineColor: function () { return boja; },
            paddingLeft: function () { return 0; },
            paddingRight: function () { return 0; },
            paddingTop: function () { return 0; },
            paddingBottom: function () { return 0; }
          }
        };
      }
    }
    var M = 8;
    var doc = {
      pageSize: { width: imgW + 2 * bw + 2 * M + 2, height: imgH + 2 * bw + 2 * M + 2 },
      pageMargins: [M, M, M, M],
      content: [node]
    };
    if (PREVIEW_FONT && Fontovi.spreman(PREVIEW_FONT.kljuc)) doc.defaultStyle = { font: PREVIEW_FONT.kljuc };
    return doc;
  }

  function postaviPreviewDisabled(dis) {
    var panel = document.querySelector('.pdf-stilovi-slike-crud__preview-panel');
    if (panel) panel.classList.toggle('pdf-stilovi-slike-crud__preview-panel--disabled', dis);
  }

  function azurirajPreviewPlaceholder() {
    var sadrzaj = byId('slikePreviewSadrzaj');
    if (!sadrzaj) return;
    if (!trim(vEdit('naziv'))) { ukloniFrames(); sadrzaj.textContent = '(upišite naziv stila)'; }
    else if (vBroj('sirina_mm') <= 0 || vBroj('visina_mm') <= 0) { ukloniFrames(); sadrzaj.textContent = '(upišite dimenzije slike)'; }
  }

  function renderPreview() {
    var sadrzaj = byId('slikePreviewSadrzaj');
    var spiner = byId('slikePreviewSpiner');
    if (!trim(vEdit('naziv'))) { ukloniFrames(); if (sadrzaj) sadrzaj.textContent = '(upišite naziv stila)'; return; }
    if (vBroj('sirina_mm') <= 0 || vBroj('visina_mm') <= 0) { ukloniFrames(); if (sadrzaj) sadrzaj.textContent = '(upišite dimenzije slike)'; return; }
    var trebaSpiner = !Pdf.spreman() || (PREVIEW_FONT && !Fontovi.spreman(PREVIEW_FONT.kljuc));
    if (trebaSpiner) KontroleSpinerShow(spiner);
    Pdf.ucitaj(function () {
      function doRender() {
        try {
          pdfMake.createPdf(sastaviDocDefinition()).getBlob(function (blob) {
            prikaziUFrame(URL.createObjectURL(blob));
            KontroleSpinerHide(spiner);
          });
        } catch (e) {
          KontroleSpinerHide(spiner);
          if (sadrzaj) sadrzaj.textContent = 'Greška pri renderu pregleda.';
        }
      }
      if (PREVIEW_FONT && PREVIEW_FONT.kljuc) Fontovi.osiguraj(PREVIEW_FONT.kljuc, PREVIEW_FONT.porodica, doRender, doRender);
      else doRender();
    }, function () {
      KontroleSpinerHide(spiner);
      if (sadrzaj) sadrzaj.textContent = 'Greška pri učitavanju pdfmake biblioteke.';
    });
  }

  function trim(s) { return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : ''); }
  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }
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

  /* ---- Tablica ---- */
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var slikePoId = {};

  CommonCRUD.initTablica('tablicaContainer', PDF_StiloviSlikeCRUD, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function brojNiz(v) { var n = parseFloat(v); return isNaN(n) ? '' : String(n); }

  /* Na izlasku iz num polja: zarez→točka, makni suvišne nule. cijeli=true → zaokruži. */
  function normalizirajBroj(el, cijeli) {
    if (!el) return;
    var raw = trim(el.value);
    if (raw === '') return;
    var n = parseFloat(raw.replace(',', '.'));
    if (isNaN(n)) { el.value = ''; return; }
    if (cijeli) n = Math.round(n);
    el.value = String(n);
  }

  function redIzObjekta(o) {
    return [
      o.naziv != null ? o.naziv : '',
      o.id != null ? o.id : 0
    ];
  }

  function ucitajPodatkeTablica(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Stilovi_Slike_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      slikePoId = {};
      if (text !== '' && text.charAt(0) !== '[') {
        porukaIzKoda(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) {
            var o = arr[j];
            if (o && o.id != null) slikePoId[String(o.id)] = o;
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

  /* „Nasljedi stil" selekt: opcije = svi postojeći stilovi; skriven ako je tablica prazna. */
  function azurirajNaslijediSelekt() {
    var sel = byId('edit_naslijedi'); var wrap = byId('naslijediWrap');
    if (!sel || !wrap) return;
    var lista = Object.keys(slikePoId).map(function (id) { return slikePoId[id]; })
      .sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
    while (sel.options.length > 1) sel.remove(1);   /* zadrži placeholder */
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
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_StiloviSlikeCRUD.Tablica_Zaglavlje);
    });
  }

  /* ---- Dinamička polja ----
     App pravilo: ovisne kontrole se DISABLE-aju (ostaju vidljive), ne skrivaju. */
  function postaviGrupaDisabled(wrapId, dis) {
    var wrap = byId(wrapId);
    if (!wrap) return;
    if (typeof KontroleSetEnabled === 'function') {
      KontroleSetEnabled(wrap, !dis);   /* disable + custom select visual + labele (kanonski) */
    } else {
      var ctrls = wrap.querySelectorAll('input, select, textarea, button');
      Array.prototype.forEach.call(ctrls, function (el) { el.disabled = dis; if (el.tagName === 'SELECT' && el.id) refreshSelect(el.id); });
    }
    /* kontrola-boja trigger gumb nije u standardnom skupu KontroleSetEnabled — ručno */
    var trig = wrap.querySelectorAll('.kontrola-boja__trigger');
    Array.prototype.forEach.call(trig, function (b) { b.disabled = dis; });
  }
  function syncLabele() {
    var ep = byId('edit_panel');
    if (ep && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(ep);
  }

  function azurirajOkvir() {
    postaviGrupaDisabled('slike_okvir_polja_red', !cEdit('okvir'));
  }

  function azurirajPozicioniranje() {
    var v = vEdit('pozicioniranje');
    var usidreno = (v === 'usidreno');
    var apsolutno = (v === 'apsolutno');
    postaviGrupaDisabled('slike_poravnanje_h_wrap', apsolutno);            /* vodoravno: u_tijeku/usidreno */
    postaviGrupaDisabled('slike_poravnanje_v_wrap', !usidreno);            /* okomito: samo usidreno */
    postaviGrupaDisabled('slike_apsolutno_red', !apsolutno);              /* x/y: samo apsolutno */
    postaviGrupaDisabled('slike_potiskuje_wrap', !(usidreno || apsolutno)); /* potiskuje: usidreno/apsolutno */
  }

  /* Bez naziva sve kontrole u tabovima disable; s nazivom enable + primijeni dinamiku. */
  function azurirajDisableTaba() {
    var nazivEl = byId('edit_naziv');
    var imaNaziv = nazivEl ? trim(nazivEl.value) !== '' : false;
    var tijelo = document.querySelector('.pdf-stilovi-slike-crud__tab .kontrola-tab__tijelo');
    if (tijelo) {
      var kontrole = tijelo.querySelectorAll('input, select, button, textarea');
      Array.prototype.forEach.call(kontrole, function (el) { el.disabled = !imaNaziv; });
    }
    var tabRoot = byId('slikeTab');
    if (tabRoot) {
      var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
      Array.prototype.forEach.call(kartice, function (k) { k.disabled = !imaNaziv; });
      if (!imaNaziv && typeof kontrolaTabPostaviAktivni === 'function') {
        kontrolaTabPostaviAktivni(tabRoot, 0);
        requestAnimationFrame(prilagodiVisinuEdita);
      }
    }
    var nap = byId('edit_napomena'); if (nap) nap.disabled = !imaNaziv;
    var nasl = byId('edit_naslijedi'); if (nasl) { nasl.disabled = !imaNaziv; refreshSelect('edit_naslijedi'); }
    postaviPreviewDisabled(!imaNaziv);
    if (imaNaziv) { azurirajOkvir(); azurirajPozicioniranje(); }
    else azurirajPreviewPlaceholder();
    refreshSelect('edit_skaliranje');
    refreshSelect('edit_sloj');
    refreshSelect('edit_pozicioniranje');
    refreshSelect('edit_poravnanje_h');
    refreshSelect('edit_poravnanje_v');
    syncLabele();
  }

  /* ---- Punjenje / skupljanje / čišćenje ---- */
  function popuniIzObjekta(o, skipNaziv) {
    FIELDS.forEach(function (f) {
      if (skipNaziv && f.col === 'naziv') return;   /* nasljeđivanje: naziv ostaje korisnikov */
      var el = elOf(f);
      if (!el) return;
      var v = o[f.col];
      if (f.type === 'check') {
        el.checked = (v === 1 || v === '1' || v === true);
      } else if (f.type === 'color') {
        var has = v != null && String(v).trim() !== '';
        el.value = has ? String(v).toUpperCase() : (f.nullable ? '' : (f.def || ''));
        if (window.KontroleBojaRefresh) KontroleBojaRefresh('edit_' + f.col);
      } else if (f.type === 'num') {
        el.value = (v != null && v !== '')
          ? (f.cijeli ? String(Math.round(parseFloat(v) || 0)) : brojNiz(v))
          : (f.def != null ? f.def : '');
      } else { /* text|select */
        el.value = (v != null ? String(v) : (f.def || ''));
      }
    });
    if (!skipNaziv) { var ns = byId('edit_naslijedi'); if (ns) ns.value = ''; }   /* selekcija reda → reset nasljeđivanja */
    refreshSelect('edit_skaliranje');
    refreshSelect('edit_sloj');
    refreshSelect('edit_pozicioniranje');
    refreshSelect('edit_poravnanje_h');
    refreshSelect('edit_poravnanje_v');
    azurirajDisableTaba();
    renderPreview();
  }

  function clearForm() {
    FIELDS.forEach(function (f) {
      var el = elOf(f);
      if (!el) return;
      if (f.type === 'check') { el.checked = false; }
      else if (f.type === 'color') {
        el.value = f.nullable ? '' : (f.def || '#000000');
        if (window.KontroleBojaRefresh) KontroleBojaRefresh('edit_' + f.col);
      } else { el.value = (f.def != null ? f.def : ''); }
    });
    var pot = byId('edit_potiskuje'); if (pot) pot.checked = true;   /* default: gura (schema default 1) */
    var nazivEl = byId('edit_naziv');
    if (nazivEl) nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
    var ns = byId('edit_naslijedi'); if (ns) ns.value = '';   /* × / deselekcija → reset nasljeđivanja */
    refreshSelect('edit_skaliranje');
    refreshSelect('edit_sloj');
    refreshSelect('edit_pozicioniranje');
    refreshSelect('edit_poravnanje_h');
    refreshSelect('edit_poravnanje_v');
    azurirajDisableTaba();
  }

  function sakupiParams() {
    var p = {};
    FIELDS.forEach(function (f) {
      var el = elOf(f);
      if (!el) { p[f.col] = ''; return; }
      if (f.type === 'check') { p[f.col] = el.checked ? '1' : '0'; }
      else if (f.type === 'color') {
        if (f.nullable) { p[f.col] = trim(el.value); }
        else { p[f.col] = trim(el.value) || f.def; }
      } else { p[f.col] = trim(el.value); }
    });
    return p;
  }

  /* ---- Selekcija reda -> punjenje ---- */
  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearForm(); }
    else {
      var o = slikePoId[String(id)];
      if (o) popuniIzObjekta(o);
      var nazivEl = byId('edit_naziv');
      if (nazivEl) nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateCrudUpisiState();
  };

  /* X na Naziv -> reset edita + selekcije */
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

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var imaNaziv = trim(vEdit('naziv')) !== '';
    var imaDim = vBroj('sirina_mm') > 0 && vBroj('visina_mm') > 0;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !(imaNaziv && imaDim);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var nazivEl = byId('edit_naziv');
    if (nazivEl) {
      nazivEl.addEventListener('input', function () { updateCrudUpisiState(); azurirajDisableTaba(); });
      nazivEl.addEventListener('change', function () { updateCrudUpisiState(); azurirajDisableTaba(); });
    }
    var okvirEl = byId('edit_okvir');
    if (okvirEl) okvirEl.addEventListener('change', azurirajOkvir);
    var pozEl = byId('edit_pozicioniranje');
    if (pozEl) pozEl.addEventListener('change', azurirajPozicioniranje);
    /* Nasljedi stil: kopiraj sve osim naziva; ne dira selekciju/mod; selekt ostaje na odabranom. */
    var naslEl = byId('edit_naslijedi');
    if (naslEl) naslEl.addEventListener('change', function () {
      var id = naslEl.value;
      if (!id) return;
      var o = slikePoId[String(id)];
      if (!o) return;
      popuniIzObjekta(o, true);
      updateCrudUpisiState();
    });
    /* dimenzije -> Upiši stanje na živo */
    ['sirina_mm', 'visina_mm'].forEach(function (col) {
      var el = byId('edit_' + col);
      if (el) el.addEventListener('input', updateCrudUpisiState);
    });
    /* prozirnost: samo cijeli broj 0-100 */
    var prozEl = byId('edit_prozirnost');
    if (prozEl) {
      prozEl.addEventListener('input', function () {
        var c = String(prozEl.value).replace(/\D/g, '');
        if (prozEl.value !== c) prozEl.value = c;
      });
      prozEl.addEventListener('blur', function () {
        var n = parseInt(String(prozEl.value).replace(/\D/g, ''), 10);
        if (isNaN(n)) n = 100; if (n < 0) n = 0; if (n > 100) n = 100;
        prozEl.value = String(n);
      });
    }
    /* num blur normalize */
    FIELDS.forEach(function (f) {
      if (f.type === 'num' && f.col !== 'prozirnost') {
        var e = elOf(f);
        if (e) e.addEventListener('blur', function () { normalizirajBroj(e, f.cijeli); });
      }
    });
  })();

  function obradiOdgovor(res, kodUspjeha) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(kodUspjeha, [], function () {
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          clearForm();
          osvjeziTablicu();
        });
      } else { clearForm(); osvjeziTablicu(); }
      return;
    }
    porukaIzKoda(res, res.indexOf('002') === 0 ? ['Naziv stila'] : null);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var imaNaziv = trim(vEdit('naziv')) !== '';
      var imaDim = vBroj('sirina_mm') > 0 && vBroj('visina_mm') > 0;
      if (!imaNaziv || !imaDim) {
        if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []);
        return;
      }
      var params = sakupiParams();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        params.id = String(id);
        postFormData(API_BASE + 'PDF_Stilovi_Slike_CRUD_izmjena.php', params, function (res) { obradiOdgovor(res, '004'); });
      } else {
        postFormData(API_BASE + 'PDF_Stilovi_Slike_CRUD_upis.php', params, function (res) { obradiOdgovor(res, '001'); });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'PDF_Stilovi_Slike_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearForm();
              osvjeziTablicu();
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

  /* ---- Preview font: prvi aktivni iz registra (samo da pdfmake ima font) ---- */
  function ucitajPreviewFont() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Fontovi_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text === '' || text.charAt(0) !== '[') return;
      try {
        var arr = JSON.parse(text || '[]');
        arr = arr.filter(function (o) { return o && (o.aktivan === 1 || o.aktivan === '1' || o.aktivan === true); });
        arr.sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
        if (arr.length) { var o = arr[0]; PREVIEW_FONT = { porodica: o.porodica, kljuc: o.pdfmake_kljuc }; }
      } catch (e) {}
    };
    xhr.send();
  }

  /* ---- Init ---- */
  if (typeof KontroleTabInit === 'function') KontroleTabInit(byId('slikeTab'));
  ucitajPreviewFont();
  ucitajPodatkeTablica(function (rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_StiloviSlikeCRUD.Tablica_Zaglavlje);
  });
  clearForm();
  updateCrudUpisiState();

  /* ---- Preview: auto-render na promjenu bilo koje kontrole (change/blur) ---- */
  (function () {
    var ep = byId('edit_panel');
    if (ep) ep.addEventListener('change', renderPreview);
    renderPreview();
  })();

  /* ---- Visine: edit naraste da svi controls aktivnog taba budu vidljivi; tablica prati. ---- */
  function izmjeriSadrzajEdita() {
    var ep = byId('edit_panel');
    if (!ep) return 0;
    var pAlign = ep.style.alignSelf, pH = ep.style.height, pMin = ep.style.minHeight;
    ep.style.alignSelf = 'flex-start';
    ep.style.height = 'auto';
    ep.style.minHeight = '0';
    var h = Math.ceil(ep.offsetHeight || 0);
    ep.style.alignSelf = pAlign;
    ep.style.height = pH;
    ep.style.minHeight = pMin;
    return h;
  }

  function prilagodiVisinuEdita() {
    var ep = byId('edit_panel');
    var tp = document.querySelector('.pdf-stilovi-slike-crud__panel-tablica');
    if (!ep) return;
    var s = izmjeriSadrzajEdita();
    if (s > 0) {
      ep.style.height = '';
      if (tp) tp.style.height = '';
      ep.style.minHeight = s + 'px';
    }
  }

  function fiksirajMinVisinuTablice() {
    var panel = document.querySelector('.pdf-stilovi-slike-crud__panel-tablica');
    if (!panel) return;
    var h = Math.round(panel.offsetHeight || 0);
    if (h > 0) {
      panel.style.minHeight = h + 'px';
      panel.setAttribute('data-resize-min-px', String(h));
    }
  }

  function inicijalnoVisine() {
    prilagodiVisinuEdita();
    fiksirajMinVisinuTablice();
  }

  (function () {
    var tab = byId('slikeTab');
    if (tab) tab.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.kontrola-tab__kartica')) {
        requestAnimationFrame(prilagodiVisinuEdita);
      }
    });
  })();

  if (document.readyState === 'complete') {
    requestAnimationFrame(inicijalnoVisine);
  } else {
    window.addEventListener('load', function () { requestAnimationFrame(inicijalnoVisine); });
  }
})();
