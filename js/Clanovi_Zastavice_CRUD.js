/* Clanovi_Zastavice_CRUD.js – tablica (ID, Naziv zastavice, Boja, Akt) + edit panel. Tablica: clanovi_zastavice. */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Clanovi_Zastavice_CRUD.html');

  const Clanovi_ZastaviceCRUD = {
    Broj_Kolona: 4,
    Reload_Ikona: 1,
    CrudCssPrefix: 'clanovi-zastavice-crud',
    Tablica_Zaglavlje: [
      { key: 'id', title: 'ID', SQL_Naziv: 'id', sortable: 1, sortable_icon: 0, type: 'n', width: 50, suffix: '. ', align: 'R', row_align: 'R', mobitel_prikaz: 1 },
      { key: 'naziv', title: 'Naziv zastavice', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'boja', title: 'Boja', SQL_Naziv: 'boja', sortable: 1, sortable_icon: 0, type: 't', width: 150, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 0 },
      { key: 'aktivnost', title: 'Akt', SQL_Naziv: 'aktivnost', sortable: 1, sortable_icon: 0, type: 'b', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', Clanovi_ZastaviceCRUD, {
    getRowId: function (row) { return row != null && row.length > 0 ? row[0] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); },
    syncHeaderOnChange: false
  });

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

  /** Boja: format #RRGGBBAA (9 znakova). Iz hex stringa bez # i alpha (0-255) sastavi 9-znakovni string. */
  function bojaToStorage(hexRgb, alpha255) {
    var hex = (hexRgb || '').replace(/^#/, '');
    if (hex.length !== 6) return '';
    var a = Math.max(0, Math.min(255, parseInt(alpha255, 10) || 255));
    var aa = (a < 16 ? '0' : '') + a.toString(16).toUpperCase();
    return '#' + hex.toUpperCase() + aa;
  }

  /** Iz 9-znakovnog stringa (#RRGGBBAA) vrati { hex: '#RRGGBB', alpha: 0-255 }. Sigurno za bilo koji ulaz. */
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

  /** hex (#RRGGBB) + alpha 0-255 → "rgba(r,g,b,a)". Sigurno za bilo koji ulaz. */
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

  function clearControlsFromSelection() {
    var idEl = document.getElementById('id_edit');
    var nazivEl = document.getElementById('naziv_edit');
    var opisEl = document.getElementById('opis_edit');
    var bojaDisplay = document.getElementById('boja_display');
    var aktivnostEl = document.getElementById('aktivnost_edit');
    if (idEl) idEl.value = '';
    if (nazivEl) { nazivEl.value = ''; nazivEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (opisEl) opisEl.value = '';
    if (bojaDisplay) applyBojaToDisplay(bojaDisplay, '');
    if (aktivnostEl) aktivnostEl.checked = false;
    resizeOpisToContent();
  }

  function resizeOpisToContent() {
    var ta = document.getElementById('opis_edit');
    var nw = typeof window.getPageBreakpointNarrow === 'function' ? window.getPageBreakpointNarrow() : 640;
    if (!ta || !window.matchMedia || !window.matchMedia('(max-width: ' + nw + 'px)').matches) return;
    var cs = window.getComputedStyle(ta);
    var minH = parseInt(cs.minHeight, 10) || 40;
    var prevMin = ta.style.minHeight;
    ta.style.minHeight = '0';
    ta.style.height = '0';
    var sh = ta.scrollHeight;
    ta.style.height = Math.max(sh, minH) + 'px';
    ta.style.minHeight = prevMin || '';
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
        var idEl = document.getElementById('id_edit');
        var nazivEl = document.getElementById('naziv_edit');
        var opisEl = document.getElementById('opis_edit');
        var bojaDisplay = document.getElementById('boja_display');
        var aktivnostEl = document.getElementById('aktivnost_edit');
        var raw = zastaviceRawData[i];
        if (idEl) idEl.value = String(row[0] != null ? row[0] : '');
        if (nazivEl) {
          nazivEl.value = row[1] != null ? String(row[1]) : '';
          nazivEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (opisEl) opisEl.value = (raw && raw.opis != null) ? String(raw.opis) : '';
        if (bojaDisplay) applyBojaToDisplay(bojaDisplay, (raw && raw.boja != null) ? String(raw.boja) : '');
        if (aktivnostEl) aktivnostEl.checked = (raw && (raw.aktivnost === 1 || raw.aktivnost === true || raw.aktivnost === '1'));
        break;
      }
      requestAnimationFrame(resizeOpisToContent);
      updateCrudUpisiState();
    } catch (e) {
      updateCrudUpisiState();
    }
  };

  var zastaviceRawData = [];

  (function () {
    var nazivEl = document.getElementById('naziv_edit');
    var wrap = nazivEl && nazivEl.closest('.kontrola-edit-delete');
    if (wrap) {
      wrap.addEventListener('kontrole-edit-delete-clear', function () {
        if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
        updateCrudUpisiState();
      });
    }
  })();

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var idEl = document.getElementById('id_edit');
    var nazivEl = document.getElementById('naziv_edit');
    var idVal = idEl ? trim(idEl.value) : '';
    var nazivVal = nazivEl ? trim(nazivEl.value) : '';
    var idOk = idVal !== '0' && /^([1-9]|1[0-6])$/.test(idVal);
    var imaTekstUNazivu = nazivVal !== '';
    var imaSadrzaj = imaTekstUNazivu && (imaSelekciju || idOk);

    var editPanel = document.getElementById('edit_panel');
    if (editPanel && typeof KontroleSetEnabled === 'function') {
      KontroleSetEnabled(editPanel, imaTekstUNazivu);
      var editDeleteWrap = nazivEl ? nazivEl.closest('.kontrola-edit-delete') : null;
      if (editDeleteWrap) {
        var input = editDeleteWrap.querySelector('.kontrola-edit-delete__input');
        var clearBtn = editDeleteWrap.querySelector('.kontrola-edit-delete__clear');
        if (input) input.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
        editDeleteWrap.classList.remove('kontrola-edit-delete--disabled');
      }
      var labelNaziv = document.querySelector('.kontrola-labela[for="naziv_edit"]');
      if (labelNaziv) labelNaziv.classList.remove('kontrola-labela--disabled');
      var btnPovratak = document.getElementById('btnPovratak');
      if (btnPovratak) btnPovratak.removeAttribute('disabled');
      var bojaPickerBtn = document.getElementById('boja_picker_btn');
      if (bojaPickerBtn) bojaPickerBtn.disabled = !imaTekstUNazivu;
      var labelBoja = document.querySelector('.kontrola-labela[for="boja_display"]');
      if (labelBoja) labelBoja.classList.toggle('kontrola-labela--disabled', !imaTekstUNazivu);
      var labelCheckbox = document.querySelector('.clanovi-zastavice-crud__label-checkbox');
      if (labelCheckbox) labelCheckbox.classList.toggle('kontrola-labela--disabled', !imaTekstUNazivu);
      if (typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
    }

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var idEl = document.getElementById('id_edit');
    var nazivEl = document.getElementById('naziv_edit');
    if (idEl) {
      idEl.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
        if (this.value === '0') this.value = '';
        var n = parseInt(this.value, 10);
        if (!isNaN(n) && n > 16) this.value = '16';
        updateCrudUpisiState();
      });
      idEl.addEventListener('change', updateCrudUpisiState);
    }
    if (nazivEl) {
      nazivEl.addEventListener('input', updateCrudUpisiState);
      nazivEl.addEventListener('change', updateCrudUpisiState);
    }
  })();

  if (Clanovi_ZastaviceCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  (function () {
    var bojaDisplay = document.getElementById('boja_display');
    var pickerBtn = document.getElementById('boja_picker_btn');
    var modal = document.getElementById('boja_picker_modal');
    var pickerColor = document.getElementById('boja_picker_color');
    var pickerAlpha = document.getElementById('boja_picker_alpha');
    var pickerHex = document.getElementById('boja_picker_hex');
    var pickerOk = document.getElementById('boja_picker_ok');
    var pickerCancel = document.getElementById('boja_picker_cancel');

    var pickerPreview = document.getElementById('boja_picker_preview');

    function openPicker() {
      var current = (bojaDisplay && bojaDisplay.value) ? bojaDisplay.value.trim() : '';
      var parsed = bojaFromStorage(current);
      if (pickerColor) pickerColor.value = parsed.hex;
      if (pickerAlpha) pickerAlpha.value = String(parsed.alpha);
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
      if (bojaDisplay) applyBojaToDisplay(bojaDisplay, storage);
      closePicker();
    }

    if (pickerBtn) pickerBtn.addEventListener('click', openPicker);
    if (pickerColor) {
      pickerColor.addEventListener('input', function () { updatePickerHex(); updatePickerPreview(); });
    }
    if (pickerAlpha) {
      pickerAlpha.addEventListener('input', function () { updatePickerHex(); updatePickerPreview(); });
    }
    if (pickerOk) pickerOk.addEventListener('click', applyFromPicker);
    if (pickerCancel) pickerCancel.addEventListener('click', closePicker);
  })();

  (function () {
    var opisEl = document.getElementById('opis_edit');
    if (opisEl) opisEl.addEventListener('input', resizeOpisToContent);
  })();

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var idEl = document.getElementById('id_edit');
      var nazivEl = document.getElementById('naziv_edit');
      var opisEl = document.getElementById('opis_edit');
      var bojaDisplay = document.getElementById('boja_display');
      var aktivnostEl = document.getElementById('aktivnost_edit');
      var idVal = idEl ? trim(idEl.value) : '';
      var nazivVal = nazivEl ? trim(nazivEl.value) : '';
      var opisVal = opisEl ? trim(opisEl.value) : '';
      var bojaVal = bojaDisplay ? trim(bojaDisplay.value) : '';
      var aktivnostVal = aktivnostEl && aktivnostEl.checked ? 1 : 0;
      if (nazivVal === '') return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        clanoviZastaviceUpdate(id, nazivVal, opisVal, bojaVal, aktivnostVal, function (res) {
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
        if (idVal === '0' || idVal === '' || !/^([1-9]|1[0-6])$/.test(idVal)) {
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['119'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('119', []);
          return;
        }
        var idNum = parseInt(idVal, 10);
        var postojiId = false;
        var data = tablicaApi.getData();
        for (var i = 0; i < data.length; i++) { if (data[i][0] == idNum) { postojiId = true; break; } }
        if (postojiId) {
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['118'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('118', []);
          return;
        }
        clanoviZastaviceAdd(idNum, nazivVal, opisVal, bojaVal, aktivnostVal, function (res) {
          if (res === 'OK') {
            osvjeziTablicu();
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              updateCrudUpisiState();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      clanoviZastaviceDelete(id, function (res) {
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
          var u = new URL(document.referrer);
          if (u.origin === window.location.origin) { window.location.href = u.href; return; }
        } catch (e) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  var API_BASE = '../php/';

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function safeInt(v, def) {
    if (v == null) return def;
    var n = parseInt(v, 10);
    return isNaN(n) ? def : n;
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_Zastavice_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      zastaviceRawData = [];
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
            var naziv = r.naziv != null ? String(r.naziv) : '';
            var opis = r.opis != null ? String(r.opis) : null;
            var boja = r.boja != null ? String(r.boja) : '';
            var aktivnost = r.aktivnost === 1 || r.aktivnost === true || r.aktivnost === '1' ? 1 : 0;
            zastaviceRawData.push({ id: id, naziv: naziv, opis: opis, boja: boja, aktivnost: aktivnost });
            rows.push([id, naziv, boja, aktivnost]);
          }
        }
      } catch (e) {
        rows = [];
        zastaviceRawData = [];
        console.error('Clanovi_Zastavice_CRUD ucitajPodatkeTablica parse error', e);
      }
      if (typeof callback === 'function') callback(rows);
    };
    try {
      xhr.send();
    } catch (e) {
      if (typeof callback === 'function') callback([]);
      console.error('Clanovi_Zastavice_CRUD ucitajPodatkeTablica xhr.send error', e);
    }
  }

  function ucitajPodatkeTablicaZaKonzolu(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_Zastavice_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      console.log('Clanovi_Zastavice_CRUD [reload] response length:', text.length);
      console.log('Clanovi_Zastavice_CRUD [reload] response (first 800 chars):', text.substring(0, 800));
      var rows = [];
      zastaviceRawData = [];
      try {
        if (text === '' || text.charAt(0) !== '[') {
          console.warn('Clanovi_Zastavice_CRUD [reload] nije JSON (nema [ na početku), raw:', text);
          var parsed = parseResponseCode(text);
          if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(parsed.code, parsed.replacements);
          }
        } else {
          var arr = JSON.parse(text);
          if (!Array.isArray(arr)) {
            console.warn('Clanovi_Zastavice_CRUD [reload] JSON nije niz:', typeof arr, arr);
            arr = [];
          }
          console.log('Clanovi_Zastavice_CRUD [reload] broj redaka iz API-ja:', arr.length);
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r || typeof r !== 'object') {
              console.warn('Clanovi_Zastavice_CRUD [reload] redak ' + i + ' nije objekt:', r);
              continue;
            }
            var id = safeInt(r.id, 0);
            var naziv = r.naziv != null ? String(r.naziv) : '';
            var opis = r.opis != null ? String(r.opis) : null;
            var boja = r.boja != null ? String(r.boja) : '';
            var aktivnost = r.aktivnost === 1 || r.aktivnost === true || r.aktivnost === '1' ? 1 : 0;
            zastaviceRawData.push({ id: id, naziv: naziv, opis: opis, boja: boja, aktivnost: aktivnost });
            rows.push([id, naziv, boja, aktivnost]);
          }
          console.log('Clanovi_Zastavice_CRUD [reload] parsed rows za tablicu:', rows);
          console.log('Clanovi_Zastavice_CRUD [reload] zastaviceRawData:', zastaviceRawData);
        }
      } catch (e) {
        rows = [];
        zastaviceRawData = [];
        console.error('Clanovi_Zastavice_CRUD [reload] parse error', e);
      }
      if (typeof callback === 'function') callback(rows);
    };
    try {
      xhr.send();
    } catch (e) {
      console.error('Clanovi_Zastavice_CRUD [reload] xhr.send error', e);
      if (typeof callback === 'function') callback([]);
    }
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablicaZaKonzolu(function (rows) {
      console.log('Clanovi_Zastavice_CRUD [reload] callback, rows.length=', rows.length);
      try {
        setDataTablica(rows);
        console.log('Clanovi_Zastavice_CRUD [reload] setDataTablica završeno');
      } catch (e) {
        console.error('Clanovi_Zastavice_CRUD [reload] setDataTablica error', e);
      }
    });
  }

  var BOJA_COL_INDEX = 2;

  function setDataTablica(rows) {
    try {
      if (!tablicaApi) return;
      if (!Array.isArray(rows)) rows = [];
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Clanovi_ZastaviceCRUD.Tablica_Zaglavlje);
      primijeniBojaNaTablicu(rows);
    } catch (e) {}
  }

  function primijeniBojaNaTablicu(rows) {
    try {
      var container = document.getElementById('tablicaContainer');
      if (!container) return;
      var tbody = container.querySelector('.kontrola-tablica__scroll table tbody');
      if (!tbody || !Array.isArray(rows)) return;
      var trs = tbody.querySelectorAll('tr');
      for (var i = 0; i < trs.length && i < rows.length; i++) {
        var td = trs[i].cells[BOJA_COL_INDEX];
        if (!td) continue;
        var bojaVal = rows[i][BOJA_COL_INDEX];
        if (bojaVal != null && trim(String(bojaVal)) !== '') {
          var parsed = bojaFromStorage(String(bojaVal));
          td.style.backgroundColor = hexAlphaToRgba(parsed.hex, parsed.alpha);
        } else {
          td.style.backgroundColor = '';
        }
      }
    } catch (e) {}
  }

  function clanoviZastaviceAdd(id, naziv, opis, boja, aktivnost, callback) {
    postFormData(API_BASE + 'Clanovi_Zastavice_CRUD_upis.php', {
      id: String(id),
      naziv: naziv,
      opis: opis,
      boja: boja,
      aktivnost: String(aktivnost)
    }, callback);
  }

  function clanoviZastaviceUpdate(id, naziv, opis, boja, aktivnost, callback) {
    postFormData(API_BASE + 'Clanovi_Zastavice_CRUD_izmjena.php', {
      id: String(id),
      naziv: naziv,
      opis: opis,
      boja: boja,
      aktivnost: String(aktivnost)
    }, callback);
  }

  function clanoviZastaviceDelete(id, callback) {
    postFormData(API_BASE + 'Clanovi_Zastavice_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  (function () {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    container.addEventListener('change', function (e) {
      if (!e.target || !e.target.matches || !e.target.matches('input.kontrola-checkbox[type="checkbox"]')) return;
      var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
      if (!scrollDiv || !scrollDiv.contains(e.target)) return;
      var tbody = scrollDiv.querySelector('tbody');
      if (!tbody || !tbody.contains(e.target)) return;
      var tr = e.target.closest('tr');
      if (!tr || tr.dataset.rowId == null) return;
      var rowId = tr.dataset.rowId;
      var newAktivnost = e.target.checked ? 1 : 0;
      var raw = null;
      for (var i = 0; i < zastaviceRawData.length; i++) {
        if (String(zastaviceRawData[i].id) === String(rowId)) {
          raw = zastaviceRawData[i];
          break;
        }
      }
      if (!raw) return;
      var selectedIdBefore = getSelectedRowId();
      if (String(selectedIdBefore) === String(rowId)) {
        var aktivnostEl = document.getElementById('aktivnost_edit');
        if (aktivnostEl) aktivnostEl.checked = e.target.checked;
      }
      clanoviZastaviceUpdate(raw.id, raw.naziv, raw.opis || '', raw.boja || '', newAktivnost, function (res) {
        var text = (res && res.trim) ? res.trim() : String(res || '');
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
          return;
        }
        ucitajPodatkeTablica(function (rows) {
          setDataTablica(rows);
          if (tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function' && selectedIdBefore != null) {
            tablicaApi.setSelectedRowIds([String(selectedIdBefore)]);
          }
        });
      });
    });
  })();

  /* Učitavanje podataka pri otvaranju stranice (throttle u 0-Common.js sprječava smrzavanje). */
  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
  });

  updateCrudUpisiState();
  window.Clanovi_ZastaviceCRUD = Clanovi_ZastaviceCRUD;
})();
