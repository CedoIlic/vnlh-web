/* PDF_Stilovi_CRUD.js — tablica + edit (tab kontrola) za pdf_paragraf.
 * Edit polja imaju id = 'edit_<stupac>'; logika je generička nad listom FIELDS.
 * Boje: edit_<col> (hex, source of truth) + .kontrola-boja trigger/swatch; modal picker (KB) iz gotovih boja/native/hex; alpha gated tokenom --kontrola_boja_alpha (off za ovu formu). "Bez boje" -> prazno/NULL (nullable polja).
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
      if (cb) cb(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_StiloviCRUD.Tablica_Zaglavlje);
    });
  }

  /* ---- Kontrola boja (picker s modalom) ---- */
  function jeHex6(s) { return /^#[0-9A-Fa-f]{6}$/.test(String(s || '')); }
  function jeHex8(s) { return /^#[0-9A-Fa-f]{8}$/.test(String(s || '')); }
  function normHex(s) { return String(s == null ? '' : s).trim().toUpperCase(); }
  function bojaUCss(val) {
    val = normHex(val);
    if (jeHex8(val)) {
      var r = parseInt(val.substr(1, 2), 16), g = parseInt(val.substr(3, 2), 16),
          b = parseInt(val.substr(5, 2), 16), a = parseInt(val.substr(7, 2), 16) / 255;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
    }
    return val;
  }

  var KB = {
    modal: null, nacin: null, paleta: null, korisnik: null, nativ: null, hexInp: null,
    alphaRed: null, alpha: null, alphaVal: null, pregled: null, pregledRed: null,
    nativTrigger: null, korHex: null, korPuna: null, korAlphaRed: null, korAlpha: null, korAlphaVal: null, korPregled: null,
    alphaOn: false, targetId: null, nullable: false,
    rgb: '#000000', a: 255, bezBoje: false,
    BOJE: [
      ['Crna', '#000000'], ['Bijela', '#FFFFFF'],
      ['Siva 1', '#404040'], ['Siva 2', '#808080'], ['Siva 3', '#BFBFBF'], ['Siva 4', '#E0E0E0'],
      ['Crvena', '#E53935'], ['Tamnocrvena', '#B71C1C'],
      ['Roza', '#D81B60'], ['Ljubičasta', '#8E24AA'], ['Indigo', '#3949AB'],
      ['Plava', '#1E88E5'], ['Tamnoplava', '#1565C0'], ['Svijetloplava', '#039BE5'],
      ['Cijan', '#00ACC1'], ['Tirkizna', '#00897B'],
      ['Zelena', '#43A047'], ['Tamnozelena', '#2E7D32'], ['Limeta', '#C0CA33'],
      ['Žuta', '#FDD835'], ['Jantar', '#FFB300'],
      ['Narančasta', '#FB8C00'], ['Tamnonarančasta', '#F4511E'],
      ['Smeđa', '#6D4C41'], ['Plavosiva', '#546E7A'], ['Tamnoljubičasta', '#5E35B1']
    ],
    osvjeziSwatch: function (targetId) {
      var wrap = document.querySelector('.kontrola-boja[data-boja-za="' + targetId + '"]');
      if (!wrap) return;
      var sw = wrap.querySelector('.kontrola-boja__swatch');
      var inp = byId(targetId);
      var val = inp ? normHex(inp.value) : '';
      if (!sw) return;
      if (val === '') { sw.style.background = ''; sw.classList.add('kontrola-boja__swatch--prazno'); }
      else { sw.classList.remove('kontrola-boja__swatch--prazno'); sw.style.background = bojaUCss(val); }
    },
    napuniPaletu: function () {
      if (!this.paleta) return;
      var html = '';
      if (this.nullable) html += '<button type="button" class="kontrola-boja-modal__swatch kontrola-boja__swatch--prazno" data-bez="1" title="Bez boje (sistemska)" aria-label="Bez boje"></button>';
      this.BOJE.forEach(function (b, i) {
        html += '<button type="button" class="kontrola-boja-modal__swatch" data-hex="' + b[1] + '" title="' + b[0] + '" aria-label="' + b[0] + '" style="background:' + b[1] + '"></button>';
        if (i === 1) html += '<span class="kontrola-boja-modal__placeholder" aria-hidden="true"></span>'; /* prazan prostor iza Bijele */
      });
      this.paleta.innerHTML = html;
    },
    sastaviHex: function () {
      var rgb = jeHex6(normHex(this.rgb)) ? normHex(this.rgb) : '#000000';
      /* 8-hex (s alpha) samo kad je stvarno prozirno; opakno (a=255) ostaje 6-hex da se normalno sprema. */
      if (this.alphaOn && this.a < 255) { var aa = ((this.a | 0)).toString(16).toUpperCase(); if (aa.length < 2) aa = '0' + aa; return rgb + aa; }
      return rgb;
    },
    cssBoja: function () {
      var rgb = jeHex6(normHex(this.rgb)) ? normHex(this.rgb) : '#000000';
      if (this.alphaOn) {
        var r = parseInt(rgb.substr(1, 2), 16), g = parseInt(rgb.substr(3, 2), 16), b = parseInt(rgb.substr(5, 2), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + (this.a / 255).toFixed(3) + ')';
      }
      return rgb;
    },
    _bojaSwatch: function (el, prozirno) {
      if (!el) return;
      if (this.bezBoje) { el.style.background = ''; el.classList.add('kontrola-boja__swatch--prazno'); return; }
      el.classList.remove('kontrola-boja__swatch--prazno');
      el.style.background = prozirno ? this.cssBoja() : (jeHex6(normHex(this.rgb)) ? normHex(this.rgb) : '#000000');
    },
    prikaziSve: function () {
      var hex = this.bezBoje ? '' : this.sastaviHex();
      if (this.hexInp) this.hexInp.value = hex;
      if (this.korHex) this.korHex.value = hex;
      this._bojaSwatch(this.pregled, true);      /* paleta mod: mali pregled (s prozirnošću) */
      this._bojaSwatch(this.korPregled, true);   /* korisnik mod: 4. red — boja s prozirnošću */
      this._bojaSwatch(this.korPuna, false);     /* korisnik mod: 2. red — odabrana boja neprozirno */
      var pct = Math.round(this.a / 255 * 100) + '%';
      if (this.alpha) this.alpha.value = this.a;
      if (this.korAlpha) this.korAlpha.value = this.a;
      if (this.alphaVal) this.alphaVal.textContent = pct;
      if (this.korAlphaVal) this.korAlphaVal.textContent = pct;
      if (this.nativ && !this.bezBoje && jeHex6(normHex(this.rgb))) this.nativ.value = normHex(this.rgb);
      if (this.paleta) {
        var sel = this.bezBoje ? '[data-bez]' : '[data-hex="' + normHex(this.rgb) + '"]';
        Array.prototype.forEach.call(this.paleta.querySelectorAll('.kontrola-boja-modal__swatch'), function (el) {
          el.classList.toggle('kontrola-boja-modal__swatch--odabran', el.matches(sel));
        });
      }
    },
    odaberiHex: function (hex) { this.bezBoje = false; this.rgb = normHex(hex); this.prikaziSve(); },
    odaberiBez: function () { this.bezBoje = true; this.prikaziSve(); },
    izNativ: function () { this.bezBoje = false; this.rgb = normHex(this.nativ ? this.nativ.value : '#000000'); this.prikaziSve(); },
    izHex: function () {
      var v = normHex(this.hexInp ? this.hexInp.value : '');
      if (jeHex6(v) || jeHex8(v)) {
        this.bezBoje = false; this.rgb = '#' + v.substr(1, 6);
        if (this.alphaOn) this.a = jeHex8(v) ? parseInt(v.substr(7, 2), 16) : 255;
        this.prikaziSve();
      }
    },
    izAlpha: function (el) { var src = el || this.alpha; if (src) this.a = parseInt(src.value, 10) || 0; if (this.bezBoje) this.bezBoje = false; this.prikaziSve(); },
    postaviNacin: function (n) {
      if (this.nacin) this.nacin.value = n;
      var paleta = (n === 'paleta');
      if (this.paleta) this.paleta.hidden = !paleta;
      if (this.korisnik) this.korisnik.hidden = paleta;
      /* Zajednički redovi (mali pregled+hex, alpha) pripadaju Paleta modu; Korisnik mod ima vlastite (korAlphaRed je u korisnik kontejneru) */
      if (this.pregledRed) this.pregledRed.hidden = !paleta;
      if (this.alphaRed) this.alphaRed.hidden = !paleta;
      refreshSelect('bojaModalNacin');
      this.prikaziSve();
    },
    /* Token --kontrola_boja_alpha=0 ne skriva red, nego ga disable-a (slajder inert + label/vrijednost zasivljeni) */
    primijeniAlphaStanje: function () {
      var off = !this.alphaOn;
      [[this.alphaRed, this.alpha], [this.korAlphaRed, this.korAlpha]].forEach(function (par) {
        if (par[0]) par[0].classList.toggle('kontrola-boja-modal__red--disabled', off);
        if (par[1]) par[1].disabled = off;
      });
    },
    otvori: function (targetId, nullable) {
      if (!this.modal) return;
      this.targetId = targetId; this.nullable = !!nullable;
      this.napuniPaletu();
      var inp = byId(targetId); var cur = inp ? normHex(inp.value) : '';
      if (cur === '' && this.nullable) { this.bezBoje = true; this.rgb = '#000000'; this.a = 255; }
      else {
        this.bezBoje = false;
        var base = (jeHex6(cur) || jeHex8(cur)) ? cur : '#000000';
        this.rgb = '#' + base.substr(1, 6);
        this.a = (this.alphaOn && jeHex8(base)) ? parseInt(base.substr(7, 2), 16) : 255;
      }
      this.postaviNacin('paleta');
      this.prikaziSve();
      this.modal.classList.add('kontrola-boja-modal--open');
      this.modal.setAttribute('aria-hidden', 'false');
    },
    zatvori: function () {
      if (!this.modal) return;
      this.modal.classList.remove('kontrola-boja-modal--open');
      this.modal.setAttribute('aria-hidden', 'true');
      this.targetId = null;
    },
    jeOtvoren: function () { return this.modal && this.modal.classList.contains('kontrola-boja-modal--open'); },
    potvrdi: function () {
      if (!this.targetId) { this.zatvori(); return; }
      var inp = byId(this.targetId);
      var val = this.bezBoje ? '' : this.sastaviHex();
      if (inp) {
        inp.value = val;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
      this.osvjeziSwatch(this.targetId);
      this.zatvori();
    },
    init: function () {
      var self = this;
      this.modal = byId('bojaModal');
      if (!this.modal) return;
      this.nacin = byId('bojaModalNacin');
      this.paleta = byId('bojaModalPaleta');
      this.korisnik = byId('bojaModalKorisnik');
      this.nativ = byId('bojaModalNativ');
      this.hexInp = byId('bojaModalHex');
      this.alphaRed = byId('bojaModalAlphaRed');
      this.alpha = byId('bojaModalAlpha');
      this.alphaVal = byId('bojaModalAlphaVal');
      this.pregled = byId('bojaModalPregled');
      this.pregledRed = byId('bojaModalPregledRed');
      this.nativTrigger = byId('bojaModalNativTrigger');
      this.korHex = byId('bojaModalKorHex');
      this.korPuna = byId('bojaModalKorPuna');
      this.korAlphaRed = byId('bojaModalKorAlphaRed');
      this.korAlpha = byId('bojaModalKorAlpha');
      this.korAlphaVal = byId('bojaModalKorAlphaVal');
      this.korPregled = byId('bojaModalKorPregled');
      this.alphaOn = (getComputedStyle(document.documentElement).getPropertyValue('--kontrola_boja_alpha').trim() === '1');
      this.primijeniAlphaStanje();
      if (this.nacin) this.nacin.addEventListener('change', function () { self.postaviNacin(self.nacin.value); });
      if (this.nativTrigger) this.nativTrigger.addEventListener('click', function () { if (self.nativ) self.nativ.click(); });
      if (this.nativ) this.nativ.addEventListener('input', function () { self.izNativ(); });
      if (this.hexInp) this.hexInp.addEventListener('input', function () { self.izHex(); });
      if (this.alpha) this.alpha.addEventListener('input', function () { self.izAlpha(self.alpha); });
      if (this.korAlpha) this.korAlpha.addEventListener('input', function () { self.izAlpha(self.korAlpha); });
      if (this.paleta) this.paleta.addEventListener('click', function (e) {
        var sw = e.target && e.target.closest ? e.target.closest('.kontrola-boja-modal__swatch') : null;
        if (!sw) return;
        if (sw.getAttribute('data-bez')) self.odaberiBez(); else self.odaberiHex(sw.getAttribute('data-hex'));
      });
      var okB = byId('bojaModalOk'); if (okB) okB.addEventListener('click', function () { self.potvrdi(); });
      Array.prototype.forEach.call(this.modal.querySelectorAll('[data-boja-zatvori]'), function (el) { el.addEventListener('click', function () { self.zatvori(); }); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && self.jeOtvoren()) self.zatvori(); });
      Array.prototype.forEach.call(document.querySelectorAll('.kontrola-boja'), function (wrap) {
        var btn = wrap.querySelector('.kontrola-boja__trigger');
        var targetId = wrap.getAttribute('data-boja-za');
        var nullable = wrap.getAttribute('data-boja-nullable') === '1';
        if (btn) btn.addEventListener('click', function () { if (btn.disabled) return; self.otvori(targetId, nullable); });
        self.osvjeziSwatch(targetId);
      });
    }
  };

  /* ---- Okvir dominira nad pozadinom (vizualni signal + onemogući pozadinu) ---- */
  var POZADINA_IDS = ['edit_boja_pozadine', 'edit_boja_pozadine_trigger',
    'edit_pozadina_cijeli_red', 'edit_traka_padding_gore_mm', 'edit_traka_padding_dolje_mm',
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
    var panel = byId('stiloviTabPanel2');
    if (panel) panel.classList.toggle('pdf-stilovi-crud__polje--priguseno', akt);
    var hint = byId('pozadina_okvir_hint'); if (hint) hint.hidden = !akt;
  }

  /* Bez odabranog fonta sve ostale kontrole u tabovima nemaju smisla → disable (font select ostaje aktivan).
     Kad font postoji: enable sve, pa primijeni pod-pravila (nullable boje, okvir⇄pozadina). */
  function azurirajDisableTaba() {
    var fontEl = byId('edit_font_id');
    var imaFont = fontEl ? trim(fontEl.value) !== '' : false;
    var tijelo = document.querySelector('.pdf-stilovi-crud__tab .kontrola-tab__tijelo');
    if (tijelo) {
      var kontrole = tijelo.querySelectorAll('input, select, button, textarea');
      Array.prototype.forEach.call(kontrole, function (el) {
        if (el.id === 'edit_font_id') return; /* font ostaje aktivan */
        el.disabled = !imaFont;
      });
    }
    /* Kartice tabova: bez fonta disable sve osim „Font" (index 0); aktivni se vraća na Font. */
    var tabRoot = byId('stiloviTab');
    if (tabRoot) {
      var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
      Array.prototype.forEach.call(kartice, function (k, i) { k.disabled = (!imaFont && i !== 0); });
      if (!imaFont && typeof kontrolaTabPostaviAktivni === 'function') {
        kontrolaTabPostaviAktivni(tabRoot, 0);
        requestAnimationFrame(prilagodiVisinuEdita);
      }
    }
    refreshSelect('edit_poravnanje');
    if (imaFont) {
      azurirajOkvirPozadina();
    }
    var ep = byId('edit_panel');
    if (ep && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(ep);
  }

  /* ---- Punjenje / skupljanje / čišćenje ---- */
  function popuniIzObjekta(o) {
    FIELDS.forEach(function (f) {
      var el = elOf(f);
      if (!el) return;
      var v = o[f.col];
      if (f.type === 'check') {
        el.checked = (v === 1 || v === '1' || v === true);
      } else if (f.type === 'color') {
        var has = v != null && String(v).trim() !== '';
        el.value = has ? String(v).toUpperCase() : (f.nullable ? '' : (f.def || ''));
        KB.osvjeziSwatch('edit_' + f.col);
      } else if (f.type === 'num') {
        el.value = (v != null && v !== '')
          ? (f.cijeli ? String(Math.round(parseFloat(v) || 0)) : brojNiz(v))
          : (f.def != null ? f.def : '');
      } else { /* text|select */
        el.value = (v != null ? String(v) : (f.def || ''));
      }
    });
    refreshSelect('edit_font_id');
    refreshSelect('edit_poravnanje');
    azurirajDisableTaba();
  }

  function clearForm() {
    FIELDS.forEach(function (f) {
      var el = elOf(f);
      if (!el) return;
      if (f.type === 'check') { el.checked = false; }
      else if (f.type === 'color') {
        el.value = f.nullable ? '' : (f.def || '#000000');
        KB.osvjeziSwatch('edit_' + f.col);
      } else { el.value = (f.def != null ? f.def : ''); }
    });
    var nazivEl = byId('edit_naziv');
    if (nazivEl) nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
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
    if (nazivEl) { nazivEl.addEventListener('input', updateCrudUpisiState); nazivEl.addEventListener('change', updateCrudUpisiState); }
    var fontEl = byId('edit_font_id');
    if (fontEl) fontEl.addEventListener('change', function () { azurirajDisableTaba(); updateCrudUpisiState(); onFormPromjena(); });
    var porEl = byId('edit_poravnanje');
    if (porEl) porEl.addEventListener('change', onFormPromjena);
    /* okvir debljina -> osvježi zasivljenje pozadine */
    ['gore', 'dolje', 'lijevo', 'desno'].forEach(function (s) {
      var el = byId('edit_okvir_debljina_' + s + '_mm');
      if (el) el.addEventListener('input', function () { azurirajOkvirPozadina(); onFormPromjena(); });
    });
    /* generički hook na sve num/check za preview (korak 4) */
    FIELDS.forEach(function (f) {
      if (f.type === 'num') { var e = elOf(f); if (e) e.addEventListener('input', onFormPromjena); }
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
        });
        refreshSelect('edit_font_id');
      } catch (e) {}
    };
    xhr.send();
  }

  /* ---- Init ---- */
  if (typeof KontroleTabInit === 'function') KontroleTabInit(byId('stiloviTab'));
  KB.init();
  ucitajFontove();
  ucitajPodatkeTablica(function (rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_StiloviCRUD.Tablica_Zaglavlje);
  });
  clearForm();
  updateCrudUpisiState();

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
