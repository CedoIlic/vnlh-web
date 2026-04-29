/* Radovi_Drzave_Gostiju_CRUD.js – tablica + edit (Naziv, Redosljed). Tablica: radovi_drzave_gostiju.
 * API: Radovi_Drzave_Gostiju_CRUD_sve.php … _upis, _izmjena, _brisanje
 * Red podataka: [ redosljed, naziv, id ] → getRowId indeks 2.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Radovi_Drzave_Gostiju_CRUD.html');

// ========== KONSTANTE ==========
// Radovi_DrzaveGostijuCRUD – jedinstveni objekt s konfiguracijom forme.
//
// Veza s tablicom radovi_drzave_gostiju:
// - Broj_Kolona = stupaca za prikaz u gridu.
// - Reload_Ikona = 1: ikona ponovnog učitavanja u headeru; 0 = nema.

// Tablica_Zaglavlje – parametri po stupcu:
// 1) key – interni ključ kolone.
// 2) title – tekst u THEAD-u.
// 3) SQL_Naziv – polje iz JSON/API-ja (id ostaje kao treći element retka podataka).
// 4) sortable – 1 = sort klikom, 0 = ne.
// 5) sortable_icon – ikona za sort gdje vrijede pravila zajedničkih kontrola (0 ili 1).
// 6) type – "t" tekst | "n" broj | "d" datum | "b" binarno.
// 7) width – 0 automatski, < 0 postotak (< -20 ⇒ 20 %), > 0 px.
// 8) suffix – dodatak za prikaz (npr. " €").
// 9) align – L/C/R za zaglavlje stupca.
// 10) row_align – L/C/R za ćelije u redku.
// 11) mobitel_prikaz – 0 sakrij na uskom viewportu; 1 prikaži.
// 12) cell_readonly – za type "b": 1 = checkbox read-only.
// =============================================================================
  const Radovi_DrzaveGostijuCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'radovi-drzave-gostiju-crud',
    Tablica_Zaglavlje: [
      { key: 'redosljed', title: 'R.', SQL_Naziv: 'redosljed', sortable: 0, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', Radovi_DrzaveGostijuCRUD, {
    getRowId: function (row) {
      return row && row[2] != null ? row[2] : null;
    },
    onReady: function (api) {
      tablicaApi = api;
    },
    onSelectionChange: function () {
      if (onCrudSelectionChange) onCrudSelectionChange();
    }
  });

  var editRedosljed = document.getElementById('edit_redosljed');
  var editPanel = document.getElementById('edit_panel');

  if (editRedosljed && typeof window.CommonNumericValidation === 'function') {
    window.CommonNumericValidation(editRedosljed, 1, 99, true);
  }

  function updateRedosljedDisabled() {
    var editEl = document.getElementById('edit_naziv');
    if (editRedosljed) editRedosljed.disabled = editEl ? editEl.disabled : true;
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
  }

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) {
      editEl.value = '';
      editEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (editRedosljed) editRedosljed.value = '';
    updateRedosljedDisabled();
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
    } else {
      var editEl = document.getElementById('edit_naziv');
      if (editEl) {
        var data = tablicaApi.getData();
        for (var i = 0; i < data.length; i++) {
          if (data[i][2] == id) {
            editEl.value = data[i][1] != null ? data[i][1] : '';
            if (editRedosljed) {
              var r = data[i][0];
              editRedosljed.value = (r != null && r !== '' && Number(r) > 0) ? String(r) : '';
            }
            break;
          }
        }
        editEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    updateCrudUpisiState();
    updateRedosljedDisabled();
  };

  (function () {
    var editEl = document.getElementById('edit_naziv');
    var wrap = editEl && editEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (editRedosljed) editRedosljed.value = '';
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateRedosljedDisabled();
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
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    updateRedosljedDisabled();
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_naziv');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['105'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('105', []);
        }
        return;
      }
      var redosljedStr = editRedosljed ? trim(editRedosljed.value) : '';
      var redosljedNum = redosljedStr === '' ? 0 : parseInt(redosljedStr, 10);
      if (redosljedStr !== '' && (isNaN(redosljedNum) || redosljedNum < 1 || redosljedNum > 99)) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['014'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('014', [1, 99]);
        }
        return;
      }
      var redosljed = redosljedStr === '' ? '' : String(redosljedNum);
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        radoviDrzaveGostijuUpdate(id, naziv, redosljed, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('004', [], function () {
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
                clearControlsFromSelection();
                osvjeziTablicu();
              });
            }
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(p.code, p.code === '002' ? ['Naziv'] : p.replacements);
            }
          }
        });
      } else {
        radoviDrzaveGostijuAdd({ naziv: naziv, redosljed: redosljed }, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('001', [], function () {
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
                clearControlsFromSelection();
                osvjeziTablicu();
              });
            }
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(p.code, p.code === '002' ? ['Naziv'] : p.replacements);
            }
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      radoviDrzaveGostijuDelete(id, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          }
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements);
          }
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
          if (u.origin === window.location.origin) {
            window.location.href = u.href;
            return;
          }
        } catch (e) {}
      }
      if (document.referrer) {
        try {
          var u = new URL(document.referrer);
          if (u.origin === window.location.origin) {
            window.location.href = u.href;
            return;
          }
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

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Radovi_Drzave_Gostiju_CRUD_sve.php', true);
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
            var r = arr[i].redosljed;
            rows.push([
              (r != null && r !== '' && Number(r) > 0) ? r : '',
              arr[i].naziv != null ? arr[i].naziv : '',
              arr[i].id != null ? arr[i].id : 0
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
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
    });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Radovi_DrzaveGostijuCRUD.Tablica_Zaglavlje);
  }

  function radoviDrzaveGostijuAdd(params, callback) {
    postFormData(API_BASE + 'Radovi_Drzave_Gostiju_CRUD_upis.php', params, callback);
  }

  function radoviDrzaveGostijuUpdate(id, naziv, redosljed, callback) {
    postFormData(API_BASE + 'Radovi_Drzave_Gostiju_CRUD_izmjena.php', { id: String(id), naziv: naziv, redosljed: redosljed }, callback);
  }

  function radoviDrzaveGostijuDelete(id, callback) {
    postFormData(API_BASE + 'Radovi_Drzave_Gostiju_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
  });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  updateCrudUpisiState();
  window.Radovi_DrzaveGostijuCRUD = Radovi_DrzaveGostijuCRUD;
})();
