/* PDF_Stilovi_CRUD.js — tablica + edit (tab kontrola) za pdf_paragraf.
 * Edit polja imaju id = 'edit_<stupac>'; logika je generička nad listom FIELDS.
 * Boje: edit_<col> (hex, source of truth) + .kontrola-boja[data-boja-za][data-boja-nullable] trigger/swatch. Picker je dijeljena kontrola u 0-Kontrole (KontroleBojaInit auto-init; KontroleBojaRefresh za osvježavanje swatcha). Alpha tokenom --kontrola_boja_alpha (off za ovu formu, :root override). "Bez boje" -> prazno/NULL (nullable polja).
 * API: PDF_Stilovi_CRUD_sve/_upis/_izmjena/_brisanje.php; fontovi: PDF_Fontovi_CRUD_sve.php (aktivni).
 * Preview (pdfmake) dolazi u koraku 4.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Stilovi_CRUD.html');

  var API_BASE = '../php/';

  var PDF_StiloviCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-stilovi-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv stila', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  /* Lista editabilnih polja (redoslijed nebitan). type: text|num|select|check|color. */
  var FIELDS = [
    { col: 'naziv', type: 'text' },
    { col: 'font_id', type: 'select' },
    { col: 'velicina_pt', type: 'num', def: '12', cijeli: true },
    { col: 'bold', type: 'check' },
    { col: 'italic', type: 'check' },
    { col: 'podcrtano', type: 'check' },
    { col: 'boja', type: 'color', nullable: false, def: '#000000' },
    { col: 'boja_pozadine', type: 'color', nullable: true },
    { col: 'pozadina_cijeli_red', type: 'check' },
    { col: 'pozadina_popuni_razmak', type: 'check' },
    { col: 'traka_padding_gore_mm', type: 'num', def: '0' },
    { col: 'traka_padding_dolje_mm', type: 'num', def: '0' },
    { col: 'traka_padding_lijevo_mm', type: 'num', def: '0' },
    { col: 'traka_padding_desno_mm', type: 'num', def: '0' },
    { col: 'poravnanje', type: 'select', def: 'left' },
    { col: 'prored', type: 'num', def: '1' },
    { col: 'razmak_prije_mm', type: 'num', def: '0' },
    { col: 'razmak_poslije_mm', type: 'num', def: '0' },
    { col: 'uvlaka_lijevo_mm', type: 'num', def: '0' },
    { col: 'uvlaka_desno_mm', type: 'num', def: '0' },
    { col: 'uvlaka_prvi_red_mm', type: 'num', def: '0' },
    { col: 'okvir_debljina_gore_mm', type: 'num', def: '0' },
    { col: 'okvir_debljina_dolje_mm', type: 'num', def: '0' },
    { col: 'okvir_debljina_lijevo_mm', type: 'num', def: '0' },
    { col: 'okvir_debljina_desno_mm', type: 'num', def: '0' },
    { col: 'okvir_padding_gore_mm', type: 'num', def: '0' },
    { col: 'okvir_padding_dolje_mm', type: 'num', def: '0' },
    { col: 'okvir_padding_lijevo_mm', type: 'num', def: '0' },
    { col: 'okvir_padding_desno_mm', type: 'num', def: '0' },
    { col: 'okvir_boja', type: 'color', nullable: false, def: '#000000' },
    { col: 'okvir_boja_podloge', type: 'color', nullable: true },
    { col: 'okvir_do_lijeve_margine', type: 'check' },
    { col: 'okvir_do_desne_margine', type: 'check' },
    { col: 'okvir_postuj_uvlaku', type: 'check' },
    { col: 'napomena', type: 'text' }
  ];

  function byId(id) { return document.getElementById(id); }
  function elOf(f) { return byId('edit_' + f.col); }

  /* ===== Lazy učitavanje pdfmake biblioteke (js/vendor/pdfmake.min.js) =====
     Učita se jednom, na prvi zahtjev; svi pozivi prije završetka čekaju u redu. */
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

  /* ===== Fontovi za pdfmake — lazy-load (porodica → 4×.ttf → vfs/fonts, keš) ===== */
  var FONT_MAP = {};   /* font_id → { porodica, kljuc, tip } (puni ga ucitajFontove) */

  var Fontovi = {
    _ucitani: {},      /* pdfmake_kljuc → true */
    _uTijeku: {},      /* pdfmake_kljuc → [cb...] */
    _abBase64: function (buf) {
      var bytes = new Uint8Array(buf), bin = '', chunk = 0x8000, i;
      for (i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      return btoa(bin);
    },
    spreman: function (kljuc) { return !!this._ucitani[kljuc]; },
    /* Osigura da je font (kljuc/porodica) registriran u pdfMake.vfs/.fonts; cb() kad spreman. */
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

  /* ===== Preview (pdfmake → iframe) ===== */
  var LOREM_1 = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
  /* Dva manja odlomka (mod „odlomak") — da se vidi razmak između odlomaka. */
  var LOREM_A = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
  var LOREM_B = 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.';
  var MM_PT = 2.83465;             /* mm → pt */
  var _brojRedaka = 5;             /* toggle: 1 ili 5 redaka */
  var _frames = null;              /* dvostruki bafer iframe-ova [a, b] */
  var _aktivni = 0;                /* indeks vidljivog */
  var _frameUrl = [null, null];    /* blob URL po iframeu */

  function vEdit(col) { var el = byId('edit_' + col); return el ? el.value : ''; }
  function cEdit(col) { var el = byId('edit_' + col); return !!(el && el.checked); }
  function vBroj(col) { return parseFloat(String(vEdit(col)).replace(',', '.')) || 0; }  /* podnosi i decimalni zarez */
  function mmPt(col) { return vBroj(col) * MM_PT; }
  function okvirImaLiniju() {
    return ['gore', 'dolje', 'lijevo', 'desno'].some(function (s) {
      return vBroj('okvir_debljina_' + s + '_mm') > 0;
    });
  }

  function _revoke(u) { if (u) { try { URL.revokeObjectURL(u); } catch (e) {} } }

  function ukloniFrames() {
    if (_frames) _frames.forEach(function (f) { if (f && f.parentNode) f.parentNode.removeChild(f); });
    _revoke(_frameUrl[0]); _revoke(_frameUrl[1]);
    _frames = null; _aktivni = 0; _frameUrl = [null, null];
  }

  function osiguramFrames() {
    var sadrzaj = byId('stiloviPreviewSadrzaj');
    if (!sadrzaj) return null;
    if (_frames) return _frames;
    sadrzaj.textContent = '';
    function mk(skriven) {
      var f = document.createElement('iframe');
      f.className = 'pdf-stilovi-crud__preview-frame';
      f.title = 'Pregled PDF-a';
      if (skriven) f.style.display = 'none';
      sadrzaj.appendChild(f);
      return f;
    }
    _frames = [mk(false), mk(true)];
    _aktivni = 0;
    return _frames;
  }

  /* Dvostruki bafer: novi PDF se učita u skriveni iframe; tek kad je gotov, zamijeni vidljivog
     (stari ostaje vidljiv do tada) → nema bljeskanja na svaku izmjenu. */
  function prikaziUFrame(url) {
    var frames = osiguramFrames();
    if (!frames) { _revoke(url); return; }
    var idx = _aktivni === 0 ? 1 : 0;
    var f = frames[idx];
    if (f._loadingUrl) _revoke(f._loadingUrl);   /* zamijenjen prije završetka */
    f._loadingUrl = url;
    f.onload = function () {
      if (f._loadingUrl !== url) return;         /* zastarjeli load */
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

  /* Jedan odlomak (s margin = razmaci/uvlake; okvir ili pozadina ga omotaju u tablicu).
     opts.fillGapBelow: ispuna pozadine produžena prema dolje da popuni razmak do sljedećeg odlomka (gornji dominira).
     opts.noGapAbove: gornji razmak preuzeo prethodni odlomak (popunio ga svojom pozadinom) → ovaj nema gornju marginu. */
  function sastaviOdlomak(kljuc, tekst, opts) {
    opts = opts || {};
    var par = {
      text: tekst,
      font: kljuc,
      fontSize: vBroj('velicina_pt') || 12,
      bold: cEdit('bold'),
      italics: cEdit('italic'),
      lineHeight: vBroj('prored') || 1,
      alignment: vEdit('poravnanje') || 'left',
      color: vEdit('boja') || '#000000'
    };
    if (cEdit('podcrtano')) par.decoration = 'underline';
    var uvlPrvi = mmPt('uvlaka_prvi_red_mm'); if (uvlPrvi) par.leadingIndent = uvlPrvi;  /* uvlaka prvog retka */

    var mL = mmPt('uvlaka_lijevo_mm'), mR = mmPt('uvlaka_desno_mm');
    var mT = mmPt('razmak_prije_mm'), mB = mmPt('razmak_poslije_mm');
    var marT = opts.noGapAbove ? 0 : mT;     /* gornji razmak (0 ako ga je popunio prethodni) */
    var marB = opts.fillGapBelow ? 0 : mB;   /* donji razmak (0 ako ispuna preuzima razmak) */

    if (okvirImaLiniju()) {
      /* Okvir dominira: tablica s 1 ćelijom (border po stranama, podloga = okvir_boja_podloge, padding okvira). */
      var oG = mmPt('okvir_debljina_gore_mm'), oD = mmPt('okvir_debljina_dolje_mm'),
          oL = mmPt('okvir_debljina_lijevo_mm'), oR = mmPt('okvir_debljina_desno_mm');
      var oBoja = vEdit('okvir_boja') || '#000000';
      var podloga = vEdit('okvir_boja_podloge') || null;
      if (podloga) par.fillColor = podloga;
      return {
        table: { widths: ['*'], body: [[par]] },
        layout: {
          hLineWidth: function (i) { return i === 0 ? oG : oD; },
          vLineWidth: function (i) { return i === 0 ? oL : oR; },
          hLineColor: function () { return oBoja; },
          vLineColor: function () { return oBoja; },
          paddingLeft: function () { return mmPt('okvir_padding_lijevo_mm'); },
          paddingRight: function () { return mmPt('okvir_padding_desno_mm'); },
          paddingTop: function () { return mmPt('okvir_padding_gore_mm'); },
          paddingBottom: function () { return mmPt('okvir_padding_dolje_mm'); }
        },
        margin: [cEdit('okvir_do_lijeve_margine') ? 0 : mL, marT, cEdit('okvir_do_desne_margine') ? 0 : mR, marB]
      };
    }
    if (vEdit('boja_pozadine')) {
      /* Pozadina retka: tablica s 1 ćelijom (fill = boja_pozadine, padding trake; puna traka = '*').
         fillGapBelow → ispunu produžimo prema dolje za (razmak poslije + razmak prije sljedećeg) i nemamo donju marginu. */
      par.fillColor = vEdit('boja_pozadine');
      var puna = cEdit('pozadina_cijeli_red');
      var dodatakDolje = opts.fillGapBelow ? (mT + mB) : 0;
      return {
        table: { widths: [puna ? '*' : 'auto'], body: [[par]] },
        layout: {
          hLineWidth: function () { return 0; },
          vLineWidth: function () { return 0; },
          paddingLeft: function () { return mmPt('traka_padding_lijevo_mm'); },
          paddingRight: function () { return mmPt('traka_padding_desno_mm'); },
          paddingTop: function () { return mmPt('traka_padding_gore_mm'); },
          paddingBottom: function () { return mmPt('traka_padding_dolje_mm') + dodatakDolje; }
        },
        margin: [mL, marT, mR, marB]
      };
    }
    par.margin = [mL, marT, mR, marB];
    return par;
  }

  function sastaviDocDefinition(kljuc) {
    var content;
    if (_brojRedaka === 1) {
      content = [sastaviOdlomak(kljuc, LOREM_1, {})];
    } else {
      /* Dva odlomka istog tipa. Ako je „Popuni razmak pozadinom" + pozadina aktivna (ne okvir):
         prvi popuni razmak do drugog svojom pozadinom (dominira gornji), drugi (zadnji u nizu) se ISPOD ne puni. */
      var popuni = cEdit('pozadina_popuni_razmak') && !!vEdit('boja_pozadine') && !okvirImaLiniju();
      content = [
        sastaviOdlomak(kljuc, LOREM_A, popuni ? { fillGapBelow: true } : {}),
        sastaviOdlomak(kljuc, LOREM_B, popuni ? { noGapAbove: true } : {})
      ];
    }
    return {
      pageSize: { width: 210 * MM_PT, height: 300 },   /* širina A4 (210 mm) — realniji odnosi */
      pageMargins: [32, 24, 32, 24],
      content: content
    };
  }

  function postaviPreviewDisabled(dis) {
    var toggle = byId('stiloviPreviewToggle');
    if (toggle) toggle.disabled = dis;
    var panel = document.querySelector('.pdf-stilovi-crud__preview-panel');
    if (panel) panel.classList.toggle('pdf-stilovi-crud__preview-panel--disabled', dis);
  }

  /* Lagano osvježavanje samo placeholder teksta (bez PDF rendera) — za promjenu naziva. */
  function azurirajPreviewPlaceholder() {
    var sadrzaj = byId('stiloviPreviewSadrzaj');
    if (!sadrzaj) return;
    var imaNaziv = !!trim(vEdit('naziv'));
    var fontId = trim(vEdit('font_id'));
    if (!imaNaziv) {
      ukloniFrames();
      sadrzaj.textContent = '(upišite naziv stila)';
    } else if (!fontId || !FONT_MAP[fontId]) {
      ukloniFrames();
      sadrzaj.textContent = '(odaberite font za pregled)';
    }
    /* naziv + font → ne diramo (render ide kroz change/popuni) */
  }

  function renderPreview() {
    var sadrzaj = byId('stiloviPreviewSadrzaj');
    var spiner = byId('stiloviPreviewSpiner');
    if (!trim(vEdit('naziv'))) {
      ukloniFrames();
      if (sadrzaj) sadrzaj.textContent = '(upišite naziv stila)';
      return;
    }
    var fontId = trim(vEdit('font_id'));
    if (!fontId || !FONT_MAP[fontId]) {
      ukloniFrames();
      if (sadrzaj) sadrzaj.textContent = '(odaberite font za pregled)';
      return;
    }
    var fm = FONT_MAP[fontId];
    var trebaSpiner = !Pdf.spreman() || !Fontovi.spreman(fm.kljuc);
    if (trebaSpiner) KontroleSpinerShow(spiner);
    Pdf.ucitaj(function () {
      Fontovi.osiguraj(fm.kljuc, fm.porodica, function () {
        try {
          pdfMake.createPdf(sastaviDocDefinition(fm.kljuc)).getBlob(function (blob) {
            prikaziUFrame(URL.createObjectURL(blob));
            KontroleSpinerHide(spiner);
          });
        } catch (e) {
          KontroleSpinerHide(spiner);
          if (sadrzaj) sadrzaj.textContent = 'Greška pri renderu pregleda.';
        }
      }, function () {
        KontroleSpinerHide(spiner);
        if (sadrzaj) sadrzaj.textContent = 'Greška pri učitavanju fonta.';
      });
    }, function () {
      KontroleSpinerHide(spiner);
      if (sadrzaj) sadrzaj.textContent = 'Greška pri učitavanju pdfmake biblioteke.';
    });
  }

  function postaviBrojRedaka(n) {
    _brojRedaka = (n === 1) ? 1 : 5;
    var btn = byId('stiloviPreviewToggle');
    var ic = btn ? btn.querySelector('span') : null;
    if (ic) ic.className = (_brojRedaka === 1) ? 'kontrola-icon--jedan-redak' : 'kontrola-icon--vise-redaka';
    if (btn) btn.setAttribute('aria-label', _brojRedaka === 1 ? 'Prikaži više redaka' : 'Prikaži jedan redak');
    renderPreview();
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
  var stiloviPoId = {}; /* id -> cijeli JSON objekt sloga (za punjenje edita). */

  CommonCRUD.initTablica('tablicaContainer', PDF_StiloviCRUD, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function brojNiz(v) { var n = parseFloat(v); return isNaN(n) ? '' : String(n); }

  /* Na izlasku iz num polja očisti format: zarez→točka, makni vodeće/prateće nule
     ("00,3"→"0.3", "3,00"→"3"). Prazno ostavi. cijeli=true → zaokruži na cijeli broj. */
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
    xhr.open('GET', API_BASE + 'PDF_Stilovi_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      stiloviPoId = {};
      if (text !== '' && text.charAt(0) !== '[') {
        porukaIzKoda(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) {
            var o = arr[j];
            if (o && o.id != null) stiloviPoId[String(o.id)] = o;
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
    var lista = Object.keys(stiloviPoId).map(function (id) { return stiloviPoId[id]; })
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
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_StiloviCRUD.Tablica_Zaglavlje);
    });
  }


  /* ---- Okvir dominira nad pozadinom (vizualni signal + onemogući pozadinu) ---- */
  var POZADINA_IDS = ['edit_boja_pozadine', 'edit_boja_pozadine_trigger',
    'edit_pozadina_cijeli_red', 'edit_pozadina_popuni_razmak',
    'edit_traka_padding_gore_mm', 'edit_traka_padding_dolje_mm',
    'edit_traka_padding_lijevo_mm', 'edit_traka_padding_desno_mm'];

  function okvirAktivan() {
    var strane = ['gore', 'dolje', 'lijevo', 'desno'];
    for (var i = 0; i < strane.length; i++) {
      var el = byId('edit_okvir_debljina_' + strane[i] + '_mm');
      if (el && parseFloat(el.value || '0') > 0) return true;
    }
    return false;
  }

  function azurirajOkvirPozadina() {
    var akt = okvirAktivan();
    POZADINA_IDS.forEach(function (id) { var el = byId(id); if (el) el.disabled = akt; });
    var panel = byId('pozadina_sekcija');
    if (panel) panel.classList.toggle('pdf-stilovi-crud__polje--priguseno', akt);
    var hint = byId('pozadina_okvir_hint'); if (hint) hint.hidden = !akt;
  }

  /* Bez odabranog fonta sve ostale kontrole u tabovima nemaju smisla → disable (font select ostaje aktivan).
     Kad font postoji: enable sve, pa primijeni pod-pravila (nullable boje, okvir⇄pozadina). */
  function azurirajDisableTaba() {
    var nazivEl = byId('edit_naziv');
    var imaNaziv = nazivEl ? trim(nazivEl.value) !== '' : false;
    var fontEl = byId('edit_font_id');
    var imaFont = fontEl ? trim(fontEl.value) !== '' : false;
    /* Tab kontrole: bez naziva SVE disable; s nazivom font ostaje aktivan, ostalo gated na font. */
    var tijelo = document.querySelector('.pdf-stilovi-crud__tab .kontrola-tab__tijelo');
    if (tijelo) {
      var kontrole = tijelo.querySelectorAll('input, select, button, textarea');
      Array.prototype.forEach.call(kontrole, function (el) {
        if (!imaNaziv) { el.disabled = true; return; }
        if (el.id === 'edit_font_id') { el.disabled = false; return; } /* font ostaje aktivan */
        el.disabled = !imaFont;
      });
    }
    /* Kartice tabova: bez naziva sve disable; s nazivom bez fonta samo „Font" (index 0). */
    var tabRoot = byId('stiloviTab');
    if (tabRoot) {
      var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
      Array.prototype.forEach.call(kartice, function (k, i) { k.disabled = !imaNaziv || (!imaFont && i !== 0); });
      if ((!imaNaziv || !imaFont) && typeof kontrolaTabPostaviAktivni === 'function') {
        kontrolaTabPostaviAktivni(tabRoot, 0);
        requestAnimationFrame(prilagodiVisinuEdita);
      }
    }
    /* Napomena i pregled: gated na naziv. */
    var nap = byId('edit_napomena'); if (nap) nap.disabled = !imaNaziv;
    var nasl = byId('edit_naslijedi'); if (nasl) { nasl.disabled = !imaNaziv; refreshSelect('edit_naslijedi'); }
    postaviPreviewDisabled(!imaNaziv);
    azurirajPreviewPlaceholder();
    refreshSelect('edit_poravnanje');
    if (imaNaziv && imaFont) azurirajOkvirPozadina();
    var ep = byId('edit_panel');
    if (ep && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(ep);
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
    refreshSelect('edit_font_id');
    refreshSelect('edit_poravnanje');
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
    var nazivEl = byId('edit_naziv');
    if (nazivEl) nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
    var ns = byId('edit_naslijedi'); if (ns) ns.value = '';   /* × / deselekcija → reset nasljeđivanja */
    refreshSelect('edit_font_id');
    refreshSelect('edit_poravnanje');
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
      var o = stiloviPoId[String(id)];
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

  function onFormPromjena() { /* hook za preview (korak 4) */ }

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var nazivEl = byId('edit_naziv');
    var fontEl = byId('edit_font_id');
    var imaNaziv = nazivEl ? trim(nazivEl.value) !== '' : false;
    var imaFont = fontEl ? trim(fontEl.value) !== '' : false;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !(imaNaziv && imaFont);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var nazivEl = byId('edit_naziv');
    if (nazivEl) {
      nazivEl.addEventListener('input', function () { updateCrudUpisiState(); azurirajDisableTaba(); });
      nazivEl.addEventListener('change', function () { updateCrudUpisiState(); azurirajDisableTaba(); });
    }
    var fontEl = byId('edit_font_id');
    if (fontEl) fontEl.addEventListener('change', function () { azurirajDisableTaba(); updateCrudUpisiState(); onFormPromjena(); });
    var porEl = byId('edit_poravnanje');
    if (porEl) porEl.addEventListener('change', onFormPromjena);
    var naslEl = byId('edit_naslijedi');
    if (naslEl) naslEl.addEventListener('change', function () {
      var id = naslEl.value;
      if (!id) return;
      var o = stiloviPoId[String(id)];
      if (!o) return;
      popuniIzObjekta(o, true);   /* sve osim naziva; ne dira selekciju/mod; selekt ostaje na odabranom */
      updateCrudUpisiState();
    });
    /* okvir debljina -> osvježi zasivljenje pozadine */
    ['gore', 'dolje', 'lijevo', 'desno'].forEach(function (s) {
      var el = byId('edit_okvir_debljina_' + s + '_mm');
      if (el) el.addEventListener('input', function () { azurirajOkvirPozadina(); onFormPromjena(); });
    });
    /* generički hook na sve num/check za preview (korak 4) */
    FIELDS.forEach(function (f) {
      if (f.type === 'num') {
        var e = elOf(f);
        if (e) {
          e.addEventListener('input', onFormPromjena);
          e.addEventListener('blur', function () { normalizirajBroj(e, f.cijeli); });
        }
      }
      if (f.type === 'check') { var c = elOf(f); if (c) c.addEventListener('change', onFormPromjena); }
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
      var nazivEl = byId('edit_naziv');
      var fontEl = byId('edit_font_id');
      if (!nazivEl || trim(nazivEl.value) === '' || !fontEl || trim(fontEl.value) === '') {
        if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []);
        return;
      }
      var params = sakupiParams();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        params.id = String(id);
        postFormData(API_BASE + 'PDF_Stilovi_CRUD_izmjena.php', params, function (res) { obradiOdgovor(res, '004'); });
      } else {
        postFormData(API_BASE + 'PDF_Stilovi_CRUD_upis.php', params, function (res) { obradiOdgovor(res, '001'); });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'PDF_Stilovi_CRUD_brisanje.php', { id: String(id) }, function (res) {
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

  /* Veličina pt: cjelobrojni unos + stepper strelice ±1 (klamp 1..999). */
  (function () {
    var inp = byId('edit_velicina_pt');
    if (!inp) return;
    function cijeliIz(v) { var n = parseInt(String(v).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; }
    inp.addEventListener('input', function () {
      var c = String(inp.value).replace(/\D/g, '');
      if (inp.value !== c) inp.value = c;
    });
    function korak(d) {
      var n = cijeliIz(inp.value) + d;
      if (n < 1) n = 1;
      if (n > 999) n = 999;
      inp.value = String(n);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));   /* okida preview render */
    }
    var g = byId('velicina_pt_gore'), dlj = byId('velicina_pt_dolje');
    if (g) g.addEventListener('click', function () { korak(1); });
    if (dlj) dlj.addEventListener('click', function () { korak(-1); });
  })();

  /* ---- Font select (aktivni iz pdf_fontovi) ---- */
  function ucitajFontove() {
    var sel = byId('edit_font_id');
    if (!sel) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Fontovi_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text === '' || text.charAt(0) !== '[') { porukaIzKoda(text); return; }
      try {
        var arr = JSON.parse(text || '[]');
        arr = arr.filter(function (o) { return o && (o.aktivan === 1 || o.aktivan === '1' || o.aktivan === true); });
        arr.sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
        while (sel.options.length > 1) sel.remove(1);
        arr.forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = String(o.id);
          opt.textContent = o.naziv != null ? o.naziv : ('#' + o.id);
          sel.appendChild(opt);
          FONT_MAP[String(o.id)] = { porodica: o.porodica, kljuc: o.pdfmake_kljuc, tip: o.tip };
        });
        refreshSelect('edit_font_id');
      } catch (e) {}
    };
    xhr.send();
  }

  /* ---- Init ---- */
  if (typeof KontroleTabInit === 'function') KontroleTabInit(byId('stiloviTab'));
  ucitajFontove();
  ucitajPodatkeTablica(function (rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_StiloviCRUD.Tablica_Zaglavlje);
  });
  clearForm();
  updateCrudUpisiState();

  /* ---- Preview: auto-render na promjenu bilo koje kontrole (change/blur, bez debouncea) ---- */
  (function () {
    var ep = byId('edit_panel');
    if (ep) ep.addEventListener('change', renderPreview);   /* delegirano: select/checkbox/boja odmah, text/num na blur */
    var toggle = byId('stiloviPreviewToggle');
    if (toggle) toggle.addEventListener('click', function () { postaviBrojRedaka(_brojRedaka === 1 ? 5 : 1); });
    renderPreview();
  })();

  /* ---- Visine: edit naraste da svi controls aktivnog taba budu vidljivi; tablica prati; pod = inicijalna. ---- */

  /* Stvarna visina SADRŽAJA edit-panela (bez stretcha): privremeno align-self:flex-start + height:auto. */
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

  /* Edit min-height = visina sadržaja aktivnog taba → panel nikad ne reže kontrole; tablica ga prati (stretch).
     Čistimo eksplicitne visine (od prethodnog manualnog resizea) da stretch ponovo izjednači oba panela. */
  function prilagodiVisinuEdita() {
    var ep = byId('edit_panel');
    var tp = document.querySelector('.pdf-stilovi-crud__panel-tablica');
    if (!ep) return;
    var s = izmjeriSadrzajEdita();
    if (s > 0) {
      ep.style.height = '';
      if (tp) tp.style.height = '';
      ep.style.minHeight = s + 'px';
    }
  }

  /* Donji pod resizea = inicijalna (učitana) visina tablica-panela — nikad ispod nje. */
  function fiksirajMinVisinuTablice() {
    var panel = document.querySelector('.pdf-stilovi-crud__panel-tablica');
    if (!panel) return;
    var h = Math.round(panel.offsetHeight || 0);
    if (h > 0) {
      panel.style.minHeight = h + 'px';
      panel.setAttribute('data-resize-min-px', String(h));
    }
  }

  function inicijalnoVisine() {
    prilagodiVisinuEdita();      /* edit min = sadržaj početnog (Font) taba */
    fiksirajMinVisinuTablice();  /* tablica min = njena (stretched) inicijalna visina */
  }

  /* Na promjenu taba: edit min = sadržaj novog taba (raste ako treba, pada do inicijalnog poda). */
  (function () {
    var tab = byId('stiloviTab');
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
