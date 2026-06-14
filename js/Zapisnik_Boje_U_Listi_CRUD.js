/* Zapisnik_Boje_U_Listi_CRUD.js – tablica (ID, Naziv, Boja) + edit panel. Tablica: zapisnik_boje_u_listi. */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Zapisnik_Boje_U_Listi_CRUD.html');

  const ZapisnikBojeCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 1,
    CrudCssPrefix: 'zapisnik-boje-u-listi-crud',
    Tablica_Zaglavlje: [
      { key: 'id',    title: 'ID',    SQL_Naziv: 'id',    sortable: 1, sortable_icon: 0, type: 'n', width: 50,  suffix: '. ', align: 'R', row_align: 'R', mobitel_prikaz: 1 },
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0,   suffix: '',   align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'boja',  title: 'Boja',  SQL_Naziv: 'boja',  sortable: 1, sortable_icon: 0, type: 't', width: 150, suffix: '',   align: 'C', row_align: 'C', mobitel_prikaz: 0 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', ZapisnikBojeCRUD, {
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
      if (isNaN(r)) r = 0; if (isNaN(g)) g = 0; if (isNaN(b)) b = 0;
      var a = Math.max(0, Math.min(1, (alpha255 == null ? 255 : parseInt(alpha255, 10)) / 255));
      if (isNaN(a)) a = 1;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (e) {}
    return 'rgba(0,0,0,1)';
  }

  /* Konverzije dijeljeni picker (kontrola-boja: 6-hex opaque / 8-hex prozirno) ↔ pohrana (#RRGGBBAA). */
  function storageToKb(storageVal) {
    if (!storageVal || trim(storageVal) === '') return '';
    var p = bojaFromStorage(storageVal);
    if (p.alpha >= 255) return p.hex.toUpperCase();
    var aa = (p.alpha < 16 ? '0' : '') + p.alpha.toString(16).toUpperCase();
    return (p.hex + aa).toUpperCase();
  }
  function kbToStorage(kbVal) {
    if (!kbVal || trim(kbVal) === '') return '';
    var p = bojaFromStorage(kbVal);
    return bojaToStorage(p.hex, p.alpha);
  }
  function setKbBoja(targetId, kbVal) {
    var el = document.getElementById(targetId);
    if (!el) return;
    el.value = kbVal || '';
    if (window.KontroleBojaRefresh) KontroleBojaRefresh(targetId);
  }

  function clearControlsFromSelection() {
    var idEl    = document.getElementById('id_edit');
    var nazivEl = document.getElementById('naziv_edit');
    var opisEl  = document.getElementById('opis_edit');
    if (idEl) idEl.value = '';
    if (nazivEl) { nazivEl.value = ''; nazivEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (opisEl) opisEl.value = '';
    setKbBoja('boja_kb', '');
    setKbBoja('boja_bg_kb', '');
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

  var bojeRawData = [];

  onCrudSelectionChange = function () {
    try {
      var id = getSelectedRowId();
      if (id == null) { clearControlsFromSelection(); updateCrudUpisiState(); return; }
      if (!tablicaApi || typeof tablicaApi.getData !== 'function') return;
      var data = tablicaApi.getData();
      if (!Array.isArray(data)) return;
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!Array.isArray(row) || row[0] != id) continue;
        var raw = bojeRawData[i];
        var idEl    = document.getElementById('id_edit');
        var nazivEl = document.getElementById('naziv_edit');
        var opisEl  = document.getElementById('opis_edit');
        if (idEl) idEl.value = String(row[0] != null ? row[0] : '');
        if (nazivEl) { nazivEl.value = row[1] != null ? String(row[1]) : ''; nazivEl.dispatchEvent(new Event('input', { bubbles: true })); }
        if (opisEl) opisEl.value = (raw && raw.opis != null) ? String(raw.opis) : '';
        setKbBoja('boja_kb', storageToKb((raw && raw.boja != null) ? String(raw.boja) : ''));
        setKbBoja('boja_bg_kb', storageToKb((raw && raw.boja_bg != null) ? String(raw.boja_bg) : ''));
        break;
      }
      requestAnimationFrame(resizeOpisToContent);
      updateCrudUpisiState();
    } catch (e) { updateCrudUpisiState(); }
  };

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
    var idEl    = document.getElementById('id_edit');
    var nazivEl = document.getElementById('naziv_edit');
    var idVal   = idEl ? trim(idEl.value) : '';
    var nazivVal = nazivEl ? trim(nazivEl.value) : '';
    var n = parseInt(idVal, 10);
    var idOk = !isNaN(n) && n >= 1 && n <= 99;
    var imaSadrzaj = nazivVal !== '' && (imaSelekciju || idOk);

    var editPanel = document.getElementById('edit_panel');
    if (editPanel && typeof KontroleSetEnabled === 'function') {
      KontroleSetEnabled(editPanel, nazivVal !== '');
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
      var bojaPickerBtn = document.getElementById('boja_kb_trigger');
      if (bojaPickerBtn) bojaPickerBtn.disabled = !(nazivVal !== '');
      var labelBoja = document.querySelector('.kontrola-labela[for="boja_kb"]');
      if (labelBoja) labelBoja.classList.toggle('kontrola-labela--disabled', !(nazivVal !== ''));
      var bojaPodlogePickerBtn = document.getElementById('boja_bg_kb_trigger');
      if (bojaPodlogePickerBtn) bojaPodlogePickerBtn.disabled = !(nazivVal !== '');
      var labelBojaPodloge = document.querySelector('.kontrola-labela[for="boja_bg_kb"]');
      if (labelBojaPodloge) labelBojaPodloge.classList.toggle('kontrola-labela--disabled', !(nazivVal !== ''));
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
    var idEl    = document.getElementById('id_edit');
    var nazivEl = document.getElementById('naziv_edit');
    if (idEl) {
      idEl.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '');
        if (this.value === '0') this.value = '';
        var n = parseInt(this.value, 10);
        if (!isNaN(n) && n > 99) this.value = '99';
        updateCrudUpisiState();
      });
      idEl.addEventListener('change', updateCrudUpisiState);
    }
    if (nazivEl) {
      nazivEl.addEventListener('input', updateCrudUpisiState);
      nazivEl.addEventListener('change', updateCrudUpisiState);
    }
  })();


  (function () {
    var opisEl = document.getElementById('opis_edit');
    if (opisEl) opisEl.addEventListener('input', resizeOpisToContent);
  })();

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var idEl    = document.getElementById('id_edit');
      var nazivEl = document.getElementById('naziv_edit');
      var opisEl  = document.getElementById('opis_edit');
      var kbEl = document.getElementById('boja_kb');
      var kbBgEl = document.getElementById('boja_bg_kb');
      var idVal    = idEl ? trim(idEl.value) : '';
      var nazivVal = nazivEl ? trim(nazivEl.value) : '';
      var opisVal  = opisEl ? trim(opisEl.value) : '';
      var bojaVal  = kbToStorage(kbEl ? kbEl.value : '');
      var bojaPodlogeVal  = kbToStorage(kbBgEl ? kbBgEl.value : '');
      if (nazivVal === '') return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        bojeUpdate(id, nazivVal, opisVal, bojaVal, bojaPodlogeVal, function (res) {
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
        var n = parseInt(idVal, 10);
        if (isNaN(n) || n < 1 || n > 99) {
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['119'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('119', []);
          return;
        }
        var data = tablicaApi ? tablicaApi.getData() : [];
        for (var i = 0; i < (data || []).length; i++) { if (data[i][0] == n) { if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['118'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('118', []); return; } }
        bojeAdd(n, nazivVal, opisVal, bojaVal, bojaPodlogeVal, function (res) {
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
      bojeDelete(id, function (res) {
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
      function idiAko(absHref) {
        try { var u = new URL(absHref, window.location.href); if (u.origin !== window.location.origin) return false; if (u.pathname + u.search === curKey) return false; window.location.href = u.href; return true; } catch (e) { return false; }
      }
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref && idiAko(ref)) return;
      if (document.referrer && idiAko(document.referrer)) return;
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  var API_BASE = '../php/';

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function safeInt(v, def) { var n = parseInt(v, 10); return isNaN(n) ? def : n; }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Zapisnik_Boje_U_Listi_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      bojeRawData = [];
      try {
        if (text === '' || text.charAt(0) !== '[') {
          var parsed = parseResponseCode(text);
          if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(parsed.code, parsed.replacements);
        } else {
          var arr = JSON.parse(text);
          if (!Array.isArray(arr)) arr = [];
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r || typeof r !== 'object') continue;
            var id    = safeInt(r.id, 0);
            var naziv = r.naziv != null ? String(r.naziv) : '';
            var opis  = r.opis  != null ? String(r.opis)  : null;
            var boja  = r.boja  != null ? String(r.boja)  : '';
            var boja_bg = r.boja_bg != null ? String(r.boja_bg) : null;
            bojeRawData.push({ id: id, naziv: naziv, opis: opis, boja: boja, boja_bg: boja_bg });
            rows.push([id, naziv, boja]);
          }
        }
      } catch (e) { rows = []; bojeRawData = []; }
      if (typeof callback === 'function') callback(rows);
    };
    try { xhr.send(); } catch (e) { if (typeof callback === 'function') callback([]); }
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });
  }

  var BOJA_COL_INDEX = 2;

  function setDataTablica(rows) {
    if (!tablicaApi) return;
    if (!Array.isArray(rows)) rows = [];
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, ZapisnikBojeCRUD.Tablica_Zaglavlje);
    primijeniBojaNaTablicu(rows);
  }

  /** Primjenjuje boja (fg) i boja_bg (bg) na sve ćelije retka tablice. */
  function primijeniBojaNaTablicu(rows) {
    try {
      var container = document.getElementById('tablicaContainer');
      if (!container) return;
      var tbody = container.querySelector('.kontrola-tablica__scroll table tbody');
      if (!tbody || !Array.isArray(rows)) return;
      var trs = tbody.querySelectorAll('tr');
      for (var i = 0; i < trs.length && i < rows.length; i++) {
        var raw = bojeRawData[i] || {};
        var fgVal = raw.boja  ? trim(String(raw.boja))    : '';
        var bgVal = raw.boja_bg ? trim(String(raw.boja_bg)) : '';
        var rgbaFg = fgVal ? hexAlphaToRgba(bojaFromStorage(fgVal).hex, bojaFromStorage(fgVal).alpha) : '';
        var rgbaBg = bgVal ? hexAlphaToRgba(bojaFromStorage(bgVal).hex, bojaFromStorage(bgVal).alpha) : '';
        var cells = trs[i].cells;
        for (var c = 0; c < cells.length; c++) {
          cells[c].style.color           = rgbaFg;
          cells[c].style.backgroundColor = rgbaBg;
        }
      }
    } catch (e) {}
  }

  function bojeAdd(id, naziv, opis, boja, boja_bg, callback) {
    postFormData(API_BASE + 'Zapisnik_Boje_U_Listi_CRUD_upis.php', { id: String(id), naziv: naziv, opis: opis, boja: boja, boja_bg: boja_bg }, callback);
  }

  function bojeUpdate(id, naziv, opis, boja, boja_bg, callback) {
    postFormData(API_BASE + 'Zapisnik_Boje_U_Listi_CRUD_izmjena.php', { id: String(id), naziv: naziv, opis: opis, boja: boja, boja_bg: boja_bg }, callback);
  }

  function bojeDelete(id, callback) {
    postFormData(API_BASE + 'Zapisnik_Boje_U_Listi_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });
  updateCrudUpisiState();
  window.ZapisnikBojeCRUD = ZapisnikBojeCRUD;
})();
