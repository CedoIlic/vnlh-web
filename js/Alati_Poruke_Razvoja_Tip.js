/* Alati_Poruke_Razvoja_Tip.js – (1) paleta Sustav_Odgovori_Razvoja_Boje + color picker;
   (2) poruke Sustav_Odgovori_Razvoja_Poruke + kontrola-select boje (stupac Boja = ID palete; Poruka = tekst; fg/bg na obje ćelije). */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Alati_Poruke_Razvoja_Tip.html');

  // ========== KONSTANTE ==========
  /*
   * Tablica_Zaglavlje — konfiguracija stupaca (CommonCRUD):
   * - key: unikatni ključ polja; title: zaglavlje; SQL_Naziv: ime u bazi;
   * - sortable: 1 = korisnik može sortirati (samo ID); type: n broj / t tekst;
   * - width: širina u px (0 = fleksibilno); align / row_align: C centar;
   * - mobitel_prikaz: 1 = prikaz na uskom ekranu.
   * Vizual (primijeniBojeNaTablicu): stupac „Boja teksta“ = swatch fg; „Boja podloge“ = bg + hex u fg boji.
   */
  const AlatiPorukeRazvojaTip = {
    Broj_Kolona: 4,
    Reload_Ikona: 0,
    CrudCssPrefix: 'alati-poruke-razvoja-tip',
    Tablica_Zaglavlje: [
      { key: 'id', title: 'ID', SQL_Naziv: 'id', sortable: 1, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'redosljed', title: 'Redosljed', SQL_Naziv: 'redosljed', sortable: 0, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'fg_boja', title: 'Boja teksta', SQL_Naziv: 'fg_boja', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'bg_boja', title: 'Boja podloge', SQL_Naziv: 'bg_boja', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  /** Redovi iz API-ja za sinkron panel ↔ tablica */
  var bojeRawData = [];
  /** 'fg' | 'bg' – koji se input puni iz modala pickera */
  var pickerTarget = 'fg';

  CommonCRUD.initTablica('tablicaContainer', AlatiPorukeRazvojaTip, {
    getRowId: function (row) { return row != null && row.length > 0 ? row[0] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); },
    syncHeaderOnChange: false
  });

  /*
   * Druga tablica: Sustav_Odgovori_Razvoja_Poruke (JOIN na Boje za fg/bg).
   * Boja: 100px – prikaz ID sloga palete; Poruka: width 0 = preostali prostor u tablici.
   */
  const AlatiPorukeRazvojaTipPoruke = {
    Broj_Kolona: 5,
    Reload_Ikona: 0,
    CrudCssPrefix: 'alati-poruke-razvoja-tip-poruke',
    Tablica_Zaglavlje: [
      { key: 'id', title: 'ID', SQL_Naziv: 'id', sortable: 1, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'redosljed', title: 'Redosljed', SQL_Naziv: 'redosljed', sortable: 0, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'kod', title: 'Kod', SQL_Naziv: 'kod', sortable: 0, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'boja', title: 'Boja', SQL_Naziv: 'boja', sortable: 0, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'tekst', title: 'Poruka', SQL_Naziv: 'tekst', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'C', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaPorukeApi = null;
  var onCrudPorukeSelectionChange = null;
  /** Redovi poruka iz API-ja (JOIN fg/bg za prikaz) */
  var porukeRawData = [];

  CommonCRUD.initTablica('tablicaPorukeContainer', AlatiPorukeRazvojaTipPoruke, {
    getRowId: function (row) { return row != null && row.length > 0 ? row[0] : null; },
    onReady: function (api) { tablicaPorukeApi = api; },
    onSelectionChange: function () { if (onCrudPorukeSelectionChange) onCrudPorukeSelectionChange(); },
    syncHeaderOnChange: false
  });

  var API_BASE = '../php/';

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function bojaToStorage(hexRgb, alpha255) {
    var hex = (hexRgb || '').replace(/^#/, '');
    if (hex.length !== 6) return '';
    var a = Math.max(0, Math.min(255, parseInt(alpha255, 10) || 255));
    var aa = (a < 16 ? '0' : '') + a.toString(16).toUpperCase();
    return '#' + hex.toUpperCase() + aa;
  }

  function bojaFromStorage(val) {
    try {
      if (val == null || typeof val !== 'string') return { hex: '#000000', alpha: 255 };
      var s = String(val).trim().replace(/^#/, '');
      if (s.length >= 8) {
        var hexPart = s.slice(0, 6);
        if (!/^[0-9A-Fa-f]{6}$/.test(hexPart)) return { hex: '#000000', alpha: 255 };
        var a = parseInt(s.slice(6, 8), 16);
        if (isNaN(a)) a = 255;
        return { hex: '#' + hexPart, alpha: Math.max(0, Math.min(255, a)) };
      }
      if (s.length >= 6 && /^[0-9A-Fa-f]{6}$/.test(s.slice(0, 6))) return { hex: '#' + s.slice(0, 6), alpha: 255 };
    } catch (e) {}
    return { hex: '#000000', alpha: 255 };
  }

  function hexAlphaToRgba(hex, alpha255) {
    try {
      var h = (hex == null ? '' : String(hex)).replace(/^#/, '');
      if (h.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(h)) return 'rgba(0,0,0,1)';
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      if (isNaN(r)) r = 0;
      if (isNaN(g)) g = 0;
      if (isNaN(b)) b = 0;
      var a = Math.max(0, Math.min(1, (alpha255 == null ? 255 : parseInt(alpha255, 10)) / 255));
      if (isNaN(a)) a = 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (e) {}
    return 'rgba(0,0,0,1)';
  }

  /** Puni readonly input + vizual pozadine (jedna boja po polju). */
  function applyBojaToDisplay(displayEl, storageVal) {
    if (!displayEl) return;
    if (!storageVal || trim(storageVal) === '') {
      displayEl.value = '';
      displayEl.style.backgroundColor = '';
      displayEl.style.color = '';
      return;
    }
    var parsed = bojaFromStorage(storageVal);
    displayEl.value = storageVal;
    displayEl.style.backgroundColor = hexAlphaToRgba(parsed.hex, parsed.alpha);
    displayEl.style.color = '';
  }

  /** Stupac „Boja teksta“: cijela ćelija = fg (kao uzorak boje). */
  function applyFgCellStyle(td, storageVal) {
    if (!td) return;
    td.classList.remove('alati-poruke-razvoja-tip__td-bg-kod');
    td.classList.add('alati-poruke-razvoja-tip__td-fg-swatch');
    td.style.backgroundColor = '';
    td.style.color = '';
    td.style.textAlign = '';
    if (!storageVal || trim(String(storageVal)) === '') {
      td.textContent = '';
      td.classList.remove('alati-poruke-razvoja-tip__td-fg-swatch');
      return;
    }
    var parsed = bojaFromStorage(String(storageVal));
    td.style.backgroundColor = hexAlphaToRgba(parsed.hex, parsed.alpha);
    td.textContent = '\u00a0';
  }

  /**
   * Stupac „Boja podloge“: pozadina = bg; po sredini prikaz hex koda u boji teksta (fg) za pregled kontrasta.
   * @param {HTMLElement} td
   * @param {string} fgStorageVal fg iz retka (može biti prazno)
   * @param {string} bgStorageVal bg iz retka
   */
  function applyBgCellStyle(td, fgStorageVal, bgStorageVal) {
    if (!td) return;
    td.classList.remove('alati-poruke-razvoja-tip__td-fg-swatch');
    td.classList.add('alati-poruke-razvoja-tip__td-bg-kod');
    td.style.backgroundColor = '';
    td.style.color = '';
    td.style.textAlign = '';
    if (!bgStorageVal || trim(String(bgStorageVal)) === '') {
      td.textContent = '';
      td.classList.remove('alati-poruke-razvoja-tip__td-bg-kod');
      return;
    }
    var parsedBg = bojaFromStorage(String(bgStorageVal));
    td.style.backgroundColor = hexAlphaToRgba(parsedBg.hex, parsedBg.alpha);
    if (fgStorageVal != null && trim(String(fgStorageVal)) !== '') {
      var parsedFg = bojaFromStorage(String(fgStorageVal));
      td.style.color = hexAlphaToRgba(parsedFg.hex, parsedFg.alpha);
    } else {
      td.style.color = 'var(--text, #111827)';
    }
    td.style.textAlign = 'center';
    td.textContent = trim(String(bgStorageVal)).toUpperCase();
  }

  /** Redosljed iz polja: 0–255 (tinyint). */
  function redosljedIzPolja() {
    var el = document.getElementById('redosljed_edit');
    if (!el) return 0;
    var n = parseInt(el.value, 10);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(255, n));
  }

  function clearControlsFromSelection() {
    var redEl = document.getElementById('redosljed_edit');
    var fgEl = document.getElementById('fg_boja_display');
    var bgEl = document.getElementById('bg_boja_display');
    if (redEl) redEl.value = '0';
    if (fgEl) applyBojaToDisplay(fgEl, '');
    if (bgEl) applyBojaToDisplay(bgEl, '');
  }

  onCrudSelectionChange = function () {
    try {
      var id = getSelectedRowId();
      if (id == null) {
        clearControlsFromSelection();
        updateCrudUpisiState();
        return;
      }
      if (!tablicaApi || typeof tablicaApi.getData !== 'function') return;
      var data = tablicaApi.getData();
      if (!Array.isArray(data)) return;
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!Array.isArray(row) || row[0] != id) continue;
        var raw = null;
        for (var j = 0; j < bojeRawData.length; j++) {
          if (String(bojeRawData[j].id) === String(id)) {
            raw = bojeRawData[j];
            break;
          }
        }
        var redEl = document.getElementById('redosljed_edit');
        var fgEl = document.getElementById('fg_boja_display');
        var bgEl = document.getElementById('bg_boja_display');
        var redVal = raw && raw.redosljed != null ? safeInt(raw.redosljed, 0) : safeInt(row[1], 0);
        if (redEl) redEl.value = String(Math.max(0, Math.min(255, redVal)));
        if (fgEl) applyBojaToDisplay(fgEl, raw && raw.fg_boja != null ? String(raw.fg_boja) : (row[2] != null ? String(row[2]) : ''));
        if (bgEl) applyBojaToDisplay(bgEl, raw && raw.bg_boja != null ? String(raw.bg_boja) : (row[3] != null ? String(row[3]) : ''));
        break;
      }
      updateCrudUpisiState();
    } catch (e) {
      updateCrudUpisiState();
    }
  };

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var fgEl = document.getElementById('fg_boja_display');
    var bgEl = document.getElementById('bg_boja_display');
    var fgVal = fgEl ? trim(fgEl.value) : '';
    var bgVal = bgEl ? trim(bgEl.value) : '';
    var imaBoju = fgVal !== '' || bgVal !== '';

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      /* Novi slog: barem jedna boja; izmjena: uvijek dozvoljeno. */
      btnUpisi.disabled = imaSelekciju ? false : !imaBoju;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  var redosljedEdit = document.getElementById('redosljed_edit');
  if (redosljedEdit) {
    redosljedEdit.addEventListener('input', updateCrudUpisiState);
    redosljedEdit.addEventListener('change', updateCrudUpisiState);
  }

  (function instalirajPickerModal() {
    var fgDisplay = document.getElementById('fg_boja_display');
    var bgDisplay = document.getElementById('bg_boja_display');
    var btnFg = document.getElementById('fg_boja_picker_btn');
    var btnBg = document.getElementById('bg_boja_picker_btn');
    var modal = document.getElementById('boja_picker_modal');
    var pickerColor = document.getElementById('boja_picker_color');
    var pickerAlpha = document.getElementById('boja_picker_alpha');
    var pickerHex = document.getElementById('boja_picker_hex');
    var pickerOk = document.getElementById('boja_picker_ok');
    var pickerCancel = document.getElementById('boja_picker_cancel');
    var pickerPreview = document.getElementById('boja_picker_preview');
    var pickerTitle = document.getElementById('boja_picker_title');

    function getActiveDisplay() {
      return pickerTarget === 'bg' ? bgDisplay : fgDisplay;
    }

    function openPicker() {
      var currentEl = getActiveDisplay();
      var current = (currentEl && currentEl.value) ? currentEl.value.trim() : '';
      var parsed = bojaFromStorage(current);
      if (pickerColor) pickerColor.value = parsed.hex;
      if (pickerAlpha) pickerAlpha.value = String(parsed.alpha);
      if (pickerTitle) pickerTitle.textContent = pickerTarget === 'bg' ? 'Boja podloge' : 'Boja teksta';
      updatePickerHex();
      updatePickerPreview();
      if (modal) { modal.hidden = false; modal.removeAttribute('hidden'); }
      if (pickerOk) pickerOk.focus();
    }

    function closePicker() {
      if (modal) { modal.hidden = true; modal.setAttribute('hidden', ''); }
    }

    function updatePickerHex() {
      var hex = pickerColor ? pickerColor.value : '#000000';
      var a = parseInt(pickerAlpha ? pickerAlpha.value : '255', 10);
      if (isNaN(a)) a = 255;
      var storage = bojaToStorage(hex, a);
      if (pickerHex) pickerHex.textContent = storage || '—';
    }

    function updatePickerPreview() {
      if (!pickerPreview) return;
      var hex = pickerColor ? pickerColor.value : '#000000';
      var a = parseInt(pickerAlpha ? pickerAlpha.value : '255', 10);
      if (isNaN(a)) a = 255;
      pickerPreview.style.backgroundColor = hexAlphaToRgba(hex, a);
    }

    function applyFromPicker() {
      var hex = pickerColor ? pickerColor.value : '#000000';
      var a = parseInt(pickerAlpha ? pickerAlpha.value : '255', 10);
      if (isNaN(a)) a = 255;
      var storage = bojaToStorage(hex, a);
      var el = getActiveDisplay();
      if (el) applyBojaToDisplay(el, storage);
      closePicker();
      updateCrudUpisiState();
    }

    if (btnFg) {
      btnFg.addEventListener('click', function () {
        pickerTarget = 'fg';
        openPicker();
      });
    }
    if (btnBg) {
      btnBg.addEventListener('click', function () {
        pickerTarget = 'bg';
        openPicker();
      });
    }
    if (pickerColor) pickerColor.addEventListener('input', function () { updatePickerHex(); updatePickerPreview(); });
    if (pickerAlpha) pickerAlpha.addEventListener('input', function () { updatePickerHex(); updatePickerPreview(); });
    if (pickerOk) pickerOk.addEventListener('click', applyFromPicker);
    if (pickerCancel) pickerCancel.addEventListener('click', closePicker);
  })();

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var fgEl = document.getElementById('fg_boja_display');
      var bgEl = document.getElementById('bg_boja_display');
      var fgVal = fgEl ? trim(fgEl.value) : '';
      var bgVal = bgEl ? trim(bgEl.value) : '';
      var redVal = redosljedIzPolja();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        porukeRazvojaBojeUpdate(id, fgVal, bgVal, redVal, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      } else {
        if (fgVal === '' && bgVal === '') return;
        porukeRazvojaBojeAdd(fgVal, bgVal, redVal, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
              updateCrudUpisiState();
            });
          } else {
            var p2 = parseResponseCode(res);
            if (p2 && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p2.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p2.code, p2.replacements);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      porukeRazvojaBojeDelete(id, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
            if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
            clearControlsFromSelection();
            osvjeziTablicu();
          });
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
        }
      });
    });
  }

  (function () {
    var btnPovratak = document.getElementById('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var curKey = window.location.pathname + window.location.search;
      function idiAkoJeDrugaStranica(absHref) {
        try {
          var u = new URL(absHref, window.location.href);
          if (u.origin !== window.location.origin) return false;
          if (u.pathname + u.search === curKey) return false;
          window.location.href = u.href;
          return true;
        } catch (eGo) {
          return false;
        }
      }
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref && idiAkoJeDrugaStranica(ref)) return;
      if (document.referrer && idiAkoJeDrugaStranica(document.referrer)) return;
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function porukeRazvojaBojeAdd(fg, bg, redosljed, callback) {
    postFormData(API_BASE + 'Alati_Poruke_Razvoja_Tip_CRUD_upis.php', {
      fg_boja: fg,
      bg_boja: bg,
      redosljed: String(redosljed)
    }, callback);
  }

  function porukeRazvojaBojeUpdate(id, fg, bg, redosljed, callback) {
    postFormData(API_BASE + 'Alati_Poruke_Razvoja_Tip_CRUD_izmjena.php', {
      id: String(id),
      fg_boja: fg,
      bg_boja: bg,
      redosljed: String(redosljed)
    }, callback);
  }

  function porukeRazvojaBojeDelete(id, callback) {
    postFormData(API_BASE + 'Alati_Poruke_Razvoja_Tip_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  function safeInt(v, def) {
    if (v == null) return def;
    var n = parseInt(v, 10);
    return isNaN(n) ? def : n;
  }

  /**
   * Zatvoreni select prikazuje odabranu paletu (bg/fg kao u opcijama); prazno = zadane varijable teme.
   */
  /** Zatvoreni kontrola-select: boja na .kontrola-select__display / boja teksta na __display-inner (nativni select je skriven). */
  function syncPorukeBojaSelectVizual() {
    var sel = document.getElementById('poruke_boja_select');
    if (!sel) return;
    var wrap = sel.closest('.kontrola-select');
    var display = wrap ? wrap.querySelector('.kontrola-select__display') : null;
    var displayInner = wrap ? wrap.querySelector('.kontrola-select__display-inner') : null;
    sel.style.backgroundColor = '';
    sel.style.color = '';
    function ocistiZatvoreniPrikaz() {
      if (display) {
        display.style.backgroundColor = '';
        display.style.background = '';
      }
      if (displayInner) displayInner.style.color = '';
    }
    var v = trim(sel.value);
    if (v === '') {
      ocistiZatvoreniPrikaz();
      return;
    }
    for (var i = 0; i < bojeRawData.length; i++) {
      if (String(bojeRawData[i].id) === v) {
        var fg = bojeRawData[i].fg_boja != null ? String(bojeRawData[i].fg_boja) : '';
        var bg = bojeRawData[i].bg_boja != null ? String(bojeRawData[i].bg_boja) : '';
        var pfg = bojaFromStorage(fg !== '' ? fg : '#000000FF');
        var pbg = bojaFromStorage(bg !== '' ? bg : '#FFFFFFFF');
        if (display) display.style.backgroundColor = hexAlphaToRgba(pbg.hex, pbg.alpha);
        if (displayInner) displayInner.style.color = hexAlphaToRgba(pfg.hex, pfg.alpha);
        return;
      }
    }
    ocistiZatvoreniPrikaz();
  }

  /** Punjenje nativnog selecta: opcije = Boje sortirane po redosljedu; tekst „Poruka“ u fg/bg iz baze. */
  function puniPorukeBojaSelect() {
    var sel = document.getElementById('poruke_boja_select');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '';
    var optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = '— Bez boje —';
    sel.appendChild(optEmpty);
    var arr = bojeRawData.slice();
    arr.sort(function (a, b) {
      var dr = safeInt(a.redosljed, 0) - safeInt(b.redosljed, 0);
      if (dr !== 0) return dr;
      return safeInt(a.id, 0) - safeInt(b.id, 0);
    });
    for (var i = 0; i < arr.length; i++) {
      var b = arr[i];
      var o = document.createElement('option');
      o.value = String(b.id);
      o.textContent = 'Poruka';
      var fg = b.fg_boja != null ? String(b.fg_boja) : '';
      var bg = b.bg_boja != null ? String(b.bg_boja) : '';
      var pfg = bojaFromStorage(fg !== '' ? fg : '#000000FF');
      var pbg = bojaFromStorage(bg !== '' ? bg : '#FFFFFFFF');
      o.style.backgroundColor = hexAlphaToRgba(pbg.hex, pbg.alpha);
      o.style.color = hexAlphaToRgba(pfg.hex, pfg.alpha);
      sel.appendChild(o);
    }
    var found = false;
    for (var j = 0; j < sel.options.length; j++) {
      if (sel.options[j].value === cur) {
        found = true;
        break;
      }
    }
    sel.value = found ? cur : '';
    if (typeof KontroleRefreshCustomSelect === 'function') {
      KontroleRefreshCustomSelect(sel);
    }
    syncPorukeBojaSelectVizual();
  }

  /**
   * Ćelija s paletom (fg/bg) iz JOIN-a; tekst je ID boje u stupcu Boja, ili tekst poruke u stupcu Poruka.
   * Bez valjanih fg/bg (nema odabrane boje / JOIN prazan): zadane boje tablice.
   */
  function applyPorukePaletaCeliju(td, fgStr, bgStr, prikazTekst) {
    if (!td) return;
    td.classList.add('alati-poruke-razvoja-tip__td-poruke-paleta');
    td.textContent = prikazTekst != null ? String(prikazTekst) : '';
    if (fgStr == null || bgStr == null || (trim(String(fgStr)) === '' && trim(String(bgStr)) === '')) {
      td.style.backgroundColor = '';
      td.style.color = '';
      return;
    }
    var pfg = bojaFromStorage(String(fgStr));
    var pbg = bojaFromStorage(String(bgStr));
    td.style.backgroundColor = hexAlphaToRgba(pbg.hex, pbg.alpha);
    td.style.color = hexAlphaToRgba(pfg.hex, pfg.alpha);
  }

  var COL_PORUKE_BOJA = 3;
  var COL_PORUKE_TEKST = 4;

  function primijeniPorukeNaTablicu() {
    try {
      var container = document.getElementById('tablicaPorukeContainer');
      if (!container) return;
      var tbody = container.querySelector('.kontrola-tablica__scroll table tbody');
      if (!tbody) return;
      var trs = tbody.querySelectorAll('tr');
      for (var i = 0; i < trs.length && i < porukeRawData.length; i++) {
        var raw = porukeRawData[i];
        var tdBoja = trs[i].cells[COL_PORUKE_BOJA];
        var tdTekst = trs[i].cells[COL_PORUKE_TEKST];
        var imaBoju = raw.boja != null && String(raw.boja) !== '';
        var tekstBoja = imaBoju ? String(raw.boja) : '—';
        var tekstPoruke = raw.tekst != null ? String(raw.tekst) : '';
        applyPorukePaletaCeliju(tdBoja, raw.fg_boja, raw.bg_boja, tekstBoja);
        applyPorukePaletaCeliju(tdTekst, raw.fg_boja, raw.bg_boja, tekstPoruke);
      }
    } catch (ePor) {}
  }

  function setDataTablicaPoruke(rows) {
    try {
      if (!tablicaPorukeApi) return;
      if (!Array.isArray(rows)) rows = [];
      CommonCRUD.setDataTablica(tablicaPorukeApi, 'tablicaPorukeContainer', rows, AlatiPorukeRazvojaTipPoruke.Tablica_Zaglavlje);
      primijeniPorukeNaTablicu();
    } catch (ePor2) {}
  }

  function ucitajPodatkePoruke(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Alati_Poruke_Razvoja_Tip_Poruke_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      porukeRawData = [];
      try {
        if (text !== '' && text.charAt(0) === '[') {
          var arr = JSON.parse(text);
          if (!Array.isArray(arr)) arr = [];
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r || typeof r !== 'object') continue;
            var rid = safeInt(r.id, 0);
            var rred = safeInt(r.redosljed, 0);
            if (rred < 0) rred = 0;
            if (rred > 255) rred = 255;
            var rkod = safeInt(r.kod, 0);
            var rboja = r.boja != null && String(r.boja) !== '' ? String(r.boja) : '';
            var rtekst = r.tekst != null ? String(r.tekst) : '';
            porukeRawData.push({
              id: rid,
              redosljed: rred,
              kod: rkod,
              boja: r.boja,
              tekst: rtekst,
              fg_boja: r.fg_boja != null ? String(r.fg_boja) : '',
              bg_boja: r.bg_boja != null ? String(r.bg_boja) : ''
            });
            rows.push([rid, rred, rkod, rboja, rtekst]);
          }
        } else if (text !== '' && text.charAt(0) !== '[') {
          var parsedP = parseResponseCode(text);
          if (parsedP && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsedP.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(parsedP.code, parsedP.replacements);
          }
        }
      } catch (eU) {
        rows = [];
        porukeRawData = [];
        console.error('Alati_Poruke_Razvoja_Tip ucitajPodatkePoruke', eU);
      }
      if (typeof callback === 'function') callback(rows);
    };
    try {
      xhr.send();
    } catch (eX) {
      if (typeof callback === 'function') callback([]);
    }
  }

  function osvjeziTablicuPoruke() {
    ucitajPodatkePoruke(function (rows) {
      setDataTablicaPoruke(rows);
    });
  }

  function getSelectedPorukeId() {
    return CommonCRUD.getSelectedRowId(tablicaPorukeApi);
  }

  function redosljedIzPoljaPoruke() {
    var el = document.getElementById('poruke_redosljed_edit');
    if (!el) return 0;
    var n = parseInt(el.value, 10);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(255, n));
  }

  function kodIzPoljaPoruke() {
    var el = document.getElementById('poruke_kod_edit');
    if (!el) return 1;
    var n = parseInt(el.value, 10);
    if (isNaN(n)) return 1;
    return Math.max(1, Math.min(99, n));
  }

  function clearPorukeControlsFromSelection() {
    var rEl = document.getElementById('poruke_redosljed_edit');
    var kEl = document.getElementById('poruke_kod_edit');
    var sEl = document.getElementById('poruke_boja_select');
    var tEl = document.getElementById('poruke_tekst_edit');
    if (rEl) rEl.value = '0';
    if (kEl) kEl.value = '1';
    if (sEl) sEl.value = '';
    if (tEl) tEl.value = '';
    if (typeof KontroleRefreshCustomSelect === 'function') {
      KontroleRefreshCustomSelect('poruke_boja_select');
    }
    syncPorukeBojaSelectVizual();
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Alati_Poruke_Razvoja_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      bojeRawData = [];
      try {
        if (text === '' || text.charAt(0) !== '[') {
          var parsed = parseResponseCode(text);
          if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(parsed.code, parsed.replacements);
          }
        } else {
          var arr = JSON.parse(text);
          if (!Array.isArray(arr)) arr = [];
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r || typeof r !== 'object') continue;
            var id = safeInt(r.id, 0);
            var red = safeInt(r.redosljed, 0);
            if (red < 0) red = 0;
            if (red > 255) red = 255;
            var fg = r.fg_boja != null ? String(r.fg_boja) : '';
            var bg = r.bg_boja != null ? String(r.bg_boja) : '';
            bojeRawData.push({ id: id, redosljed: red, fg_boja: fg, bg_boja: bg });
            rows.push([id, red, fg, bg]);
          }
        }
      } catch (e) {
        rows = [];
        bojeRawData = [];
        console.error('Alati_Poruke_Razvoja_Tip ucitajPodatkeTablica', e);
      }
      if (typeof callback === 'function') callback(rows);
    };
    try {
      xhr.send();
    } catch (e) {
      if (typeof callback === 'function') callback([]);
    }
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
      ucitajPodatkePoruke(function (rowsP) {
        setDataTablicaPoruke(rowsP);
      });
    });
  }

  var COL_FG = 2;
  var COL_BG = 3;

  function setDataTablica(rows) {
    try {
      if (!tablicaApi) return;
      if (!Array.isArray(rows)) rows = [];
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, AlatiPorukeRazvojaTip.Tablica_Zaglavlje);
      primijeniBojeNaTablicu(rows);
      puniPorukeBojaSelect();
    } catch (e) {}
  }

  function primijeniBojeNaTablicu(rows) {
    try {
      var container = document.getElementById('tablicaContainer');
      if (!container) return;
      var tbody = container.querySelector('.kontrola-tablica__scroll table tbody');
      if (!tbody || !Array.isArray(rows)) return;
      var trs = tbody.querySelectorAll('tr');
      for (var i = 0; i < trs.length && i < rows.length; i++) {
        var tdFg = trs[i].cells[COL_FG];
        var tdBg = trs[i].cells[COL_BG];
        applyFgCellStyle(tdFg, rows[i][COL_FG]);
        applyBgCellStyle(tdBg, rows[i][COL_FG], rows[i][COL_BG]);
      }
    } catch (e) {}
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  osvjeziTablicu();

  updateCrudUpisiState();

  var btnPorukeUpisi = document.getElementById('btnPorukeUpisi');
  var btnPorukeUpisiLabel = btnPorukeUpisi ? btnPorukeUpisi.querySelector('.kontrola-btn__label') : null;
  var btnPorukeIzbrisi = document.getElementById('btnPorukeIzbrisi');

  function updatePorukeCrudState() {
    var imaSel = getSelectedPorukeId() != null;
    var kodN = kodIzPoljaPoruke();
    var kodOk = kodN >= 1 && kodN <= 99;
    if (btnPorukeUpisi && btnPorukeUpisiLabel) {
      btnPorukeUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSel);
      btnPorukeUpisiLabel.textContent = imaSel ? 'Izmjeni' : 'Upis';
      btnPorukeUpisi.setAttribute('aria-label', imaSel ? 'Izmjeni' : 'Upis');
      /* Novi slog: kod 1–99; izmjena: uvijek. */
      btnPorukeUpisi.disabled = imaSel ? false : !kodOk;
    }
    if (btnPorukeIzbrisi) btnPorukeIzbrisi.disabled = !imaSel;
  }

  onCrudPorukeSelectionChange = function () {
    try {
      var id = getSelectedPorukeId();
      if (id == null) {
        clearPorukeControlsFromSelection();
        updatePorukeCrudState();
        return;
      }
      if (!tablicaPorukeApi || typeof tablicaPorukeApi.getData !== 'function') return;
      var data = tablicaPorukeApi.getData();
      if (!Array.isArray(data)) return;
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!Array.isArray(row) || row[0] != id) continue;
        var raw = null;
        for (var j = 0; j < porukeRawData.length; j++) {
          if (String(porukeRawData[j].id) === String(id)) {
            raw = porukeRawData[j];
            break;
          }
        }
        var rEl = document.getElementById('poruke_redosljed_edit');
        var kEl = document.getElementById('poruke_kod_edit');
        var sEl = document.getElementById('poruke_boja_select');
        var tEl = document.getElementById('poruke_tekst_edit');
        var redVal = raw && raw.redosljed != null ? safeInt(raw.redosljed, 0) : safeInt(row[1], 0);
        if (rEl) rEl.value = String(Math.max(0, Math.min(255, redVal)));
        var kVal = raw && raw.kod != null ? safeInt(raw.kod, 1) : safeInt(row[2], 1);
        if (kEl) kEl.value = String(Math.max(1, Math.min(99, kVal)));
        if (sEl) {
          var bid = raw && raw.boja != null ? String(raw.boja) : (row[3] != null && String(row[3]) !== '' ? String(row[3]) : '');
          puniPorukeBojaSelect();
          sEl.value = bid;
          syncPorukeBojaSelectVizual();
        }
        if (tEl) tEl.value = raw && raw.tekst != null ? String(raw.tekst) : (row[4] != null ? String(row[4]) : '');
        break;
      }
      updatePorukeCrudState();
    } catch (ePorSel) {
      updatePorukeCrudState();
    }
  };

  function porukeRazvojaPorukeAdd(red, kod, bojaVal, tekst, callback) {
    postFormData(API_BASE + 'Alati_Poruke_Razvoja_Tip_Poruke_CRUD_upis.php', {
      redosljed: String(red),
      kod: String(kod),
      boja: bojaVal,
      tekst: tekst
    }, callback);
  }

  function porukeRazvojaPorukeUpdate(id, red, kod, bojaVal, tekst, callback) {
    postFormData(API_BASE + 'Alati_Poruke_Razvoja_Tip_Poruke_CRUD_izmjena.php', {
      id: String(id),
      redosljed: String(red),
      kod: String(kod),
      boja: bojaVal,
      tekst: tekst
    }, callback);
  }

  function porukeRazvojaPorukeDelete(id, callback) {
    postFormData(API_BASE + 'Alati_Poruke_Razvoja_Tip_Poruke_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  var porukeRedEl = document.getElementById('poruke_redosljed_edit');
  var porukeKodEl = document.getElementById('poruke_kod_edit');
  var porukeBojaEl = document.getElementById('poruke_boja_select');
  var porukeTekstEl = document.getElementById('poruke_tekst_edit');
  if (porukeRedEl) {
    porukeRedEl.addEventListener('input', updatePorukeCrudState);
    porukeRedEl.addEventListener('change', updatePorukeCrudState);
  }
  if (porukeKodEl) {
    porukeKodEl.addEventListener('input', updatePorukeCrudState);
    porukeKodEl.addEventListener('change', updatePorukeCrudState);
  }
  if (porukeBojaEl) {
    porukeBojaEl.addEventListener('change', function () {
      syncPorukeBojaSelectVizual();
      updatePorukeCrudState();
    });
  }
  if (porukeTekstEl) {
    porukeTekstEl.addEventListener('input', updatePorukeCrudState);
  }

  if (btnPorukeUpisi) {
    btnPorukeUpisi.addEventListener('click', function () {
      var redVal = redosljedIzPoljaPoruke();
      var kodVal = kodIzPoljaPoruke();
      var sEl = document.getElementById('poruke_boja_select');
      var tEl = document.getElementById('poruke_tekst_edit');
      var bojaPost = sEl && sEl.value ? trim(sEl.value) : '';
      var tekstVal = tEl ? trim(tEl.value) : '';
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var pid = getSelectedPorukeId();
        if (pid == null) return;
        porukeRazvojaPorukeUpdate(pid, redVal, kodVal, bojaPost, tekstVal, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaPorukeApi && typeof tablicaPorukeApi.clearSelection === 'function') tablicaPorukeApi.clearSelection();
              clearPorukeControlsFromSelection();
              osvjeziTablicuPoruke();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      } else {
        if (kodVal < 1 || kodVal > 99) return;
        porukeRazvojaPorukeAdd(redVal, kodVal, bojaPost, tekstVal, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaPorukeApi && typeof tablicaPorukeApi.clearSelection === 'function') tablicaPorukeApi.clearSelection();
              clearPorukeControlsFromSelection();
              osvjeziTablicuPoruke();
              updatePorukeCrudState();
            });
          } else {
            var p2 = parseResponseCode(res);
            if (p2 && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p2.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p2.code, p2.replacements);
          }
        });
      }
    });
  }

  if (btnPorukeIzbrisi) {
    btnPorukeIzbrisi.addEventListener('click', function () {
      var pid = getSelectedPorukeId();
      if (pid == null) return;
      porukeRazvojaPorukeDelete(pid, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
            if (tablicaPorukeApi && typeof tablicaPorukeApi.clearSelection === 'function') tablicaPorukeApi.clearSelection();
            clearPorukeControlsFromSelection();
            osvjeziTablicuPoruke();
          });
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
        }
      });
    });
  }

  updatePorukeCrudState();
  window.AlatiPorukeRazvojaTip = AlatiPorukeRazvojaTip;
  window.AlatiPorukeRazvojaTipPoruke = AlatiPorukeRazvojaTipPoruke;
})();
