/* Kandidat_Dokumenti_Zapisnik_Tip_CRUD.js – tablica (naziv + redosljed) + edit. Tablica: kandidat_dokumenti_zapisnik_tip. */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Kandidat_Dokumenti_Zapisnik_Tip_CRUD.html');

// ========== KONSTANTE ==========
// Konfiguracija forme. Tablica: naziv + redosljed; id se drži kao skriveni zadnji element retka (ključ selekcije).
// =============================================================================
  const Zapisnik_TipCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'kandidat-dokumenti-zapisnik-tip-crud',
    Tablica_Zaglavlje: [
      { key: "naziv", title: "Tip zapisnika", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "redosljed", title: "Red", SQL_Naziv: "redosljed", sortable: 1, sortable_icon: 0, type: "n", width: 100, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  /* Prijevod zaglavlja tablice (0-Jezik.js sinkron); bez prijevoda vraća originalne naslove. */
  if (window.vnlhTZaglavlje) {
    Zapisnik_TipCRUD.Tablica_Zaglavlje = window.vnlhTZaglavlje('kandidat_dokumenti_zapisnik_tip_crud.tablica.zaglavlje', Zapisnik_TipCRUD.Tablica_Zaglavlje);
  }

  CommonCRUD.initTablica('tablicaContainer', Zapisnik_TipCRUD, {
    /* id je skriveni zadnji element retka ([naziv, redosljed, id]); selekcija ide po njemu. */
    getRowId: function (row) { return row && row[2] != null ? row[2] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  /* Numerički edit (cijeli broj 0–100). */
  var editRedosljed = document.getElementById('edit_redosljed');
  if (editRedosljed && typeof window.CommonNumericValidation === 'function') window.CommonNumericValidation(editRedosljed, 0, 100, true);

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) { editEl.value = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editRedosljed) editRedosljed.value = '';
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearControlsFromSelection(); }
    else {
      var editEl = document.getElementById('edit_naziv');
      var data = tablicaApi.getData();
      for (var i = 0; i < data.length; i++) {
        if (data[i][2] == id) {
          if (editEl) editEl.value = data[i][0] != null ? data[i][0] : '';
          if (editRedosljed) editRedosljed.value = data[i][1] != null ? String(data[i][1]) : '';
          break;
        }
      }
      if (editEl) editEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateCrudUpisiState();
  };

  (function () {
    var editEl = document.getElementById('edit_naziv');
    var wrap = editEl && editEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateCrudUpisiState();
    });
  })();

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var editEl = document.getElementById('edit_naziv');
    var imaSadrzaj = editEl ? trim(editEl.value) !== '' : false;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      var lblUpis = imaSelekciju ? tt('global.gumb.izmijeni', 'Izmjeni') : tt('global.gumb.upis', 'Upis');
      btnUpisiLabel.textContent = lblUpis;
      btnUpisi.setAttribute('aria-label', lblUpis);
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;

    // Redosljed (s labelom): enable kad ima selekcija ILI sadržaj u „Tip zapisnika"; inače disable.
    var kontroleEnabled = imaSelekciju || imaSadrzaj;
    var elRed = document.getElementById('edit_redosljed');
    if (elRed) elRed.disabled = !kontroleEnabled;
    var lblRed = document.querySelector('label[for="edit_redosljed"]');
    if (lblRed) lblRed.classList.toggle('kontrola-labela--disabled', !kontroleEnabled);
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (Zapisnik_TipCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_naziv');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var redosljed = editRedosljed ? trim(editRedosljed.value) : '';
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        zapisnikTipUpdate(id, naziv, redosljed, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            prikaziGresku(res);
          }
        });
      } else {
        zapisnikTipAdd(naziv, redosljed, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            prikaziGresku(res);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      zapisnikTipDelete(id, function (res) {
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

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /** Modal greške iz PHP odgovora. Za 002 (duplikat) #1 = prevedena labela kontrole. */
  function prikaziGresku(res) {
    var p = parseResponseCode(res);
    if (!p || typeof MODAL_MESSAGES === 'undefined' || !MODAL_MESSAGES[p.code] || typeof window.showPorukaModal !== 'function') return;
    var repl = p.replacements;
    if (p.code === '002') {
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      repl = [tt('kandidat_dokumenti_zapisnik_tip_crud.labela.naziv', 'Tip zapisnika')];
    }
    window.showPorukaModal(p.code, repl);
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Kandidat_Dokumenti_Zapisnik_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var id = arr[i].id != null ? arr[i].id : 0;
            rows.push([
              arr[i].naziv != null ? arr[i].naziv : '',
              arr[i].redosljed != null ? arr[i].redosljed : 0,
              id
            ]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Zapisnik_TipCRUD.Tablica_Zaglavlje);
  }

  function zapisnikTipAdd(naziv, redosljed, callback) {
    postFormData(API_BASE + 'Kandidat_Dokumenti_Zapisnik_Tip_CRUD_upis.php', { naziv: naziv, redosljed: redosljed }, callback);
  }

  function zapisnikTipUpdate(id, naziv, redosljed, callback) {
    postFormData(API_BASE + 'Kandidat_Dokumenti_Zapisnik_Tip_CRUD_izmjena.php', { id: String(id), naziv: naziv, redosljed: redosljed }, callback);
  }

  function zapisnikTipDelete(id, callback) {
    postFormData(API_BASE + 'Kandidat_Dokumenti_Zapisnik_Tip_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  updateCrudUpisiState();
  window.Kandidat_Dokumenti_Zapisnik_TipCRUD = Zapisnik_TipCRUD;
})();
