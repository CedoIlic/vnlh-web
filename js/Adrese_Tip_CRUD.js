/* Adrese_Tip_CRUD.js – tablica + jedna kontrola (naziv)
 * API: Adrese_Tip_CRUD_sve.php, _upis.php, _izmjena.php, _brisanje.php
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Adrese_Tip_CRUD.html');

// ========== KONSTANTE ==========
// Adrese_TipCRUD – jedinstveni objekt s konfiguracijom forme.
// Prije dodavanja nove konstante treba je iskomentirati (dokumentirati u nastavku reda).
// Sve u jednom objektu da editor ne prijavi "cannot redeclare block-scoped variable".
//
// Veza s tablicom:
// - Tablica ima Broj_Kolona kolona.
// - Reload_Ikona = 1: dodaje se header panelu tablice; u headeru desno ikona za reload; funkcionalnost = ponovno učitavanje podataka iz baze. 0 = nema headera/ikone.
//
// Tablica_Zaglavlje – svaka kolona je objekt sa parametrima:
// 1) key (string) - Jedinstveni ključ kolone.
// 2) title (string) - Tekst u zaglavlju kolone (THEAD).
// 3) SQL_Naziv (string) - Naziv podatka koji vraća PHP. Ako nije upisan = prvi podatak iza id. id = ključ sloga, skriveni podatak u redu tablice.
// 4) sortable (0 | 1) - 1 = kolona se može sortirati klikom na zaglavlje; 0 = nije sortabilna, hover na zaglavlju te kolone ne radi.
// 5) sortable_icon (0 | 1) - 1 = iscrtava se sort ikona u zaglavlju (pravila: align L ili C → ikona uz desni rub ćelije; align R → ikona uz lijevi rub kolone). Default: 0.
// 6) type ("t" | "n" | "d" | "b") - Tip podataka u koloni: "t" = tekst, "n" = broj, "d" = datum, "b" = binarno. Koristi se npr. da se datum sortira kao datum, broj kao broj, ne kao string.
// 7) width (number) - Širina te kolone: 0 = auto; < 0 = abs(width) % ukupne širine tablice (npr. -20 → 20%); > 0 = fiksno u px (npr. 30 → 30px).
// 8) suffix (string) - Dodatak uz prikaz podatka (npr. " €", "%", " kom").
// 9) align ("L" | "C" | "R") - Orijentacija teksta u zaglavlju tablice: L = lijevo, C = centar, R = desno.
// 10) row_align ("L" | "C" | "R") - Orijentacija sadržaja u redovima tablice: L = lijevo, C = centar, R = desno.
// 11) mobitel_prikaz (0–255, default 1) - Prikaz kolone na mobilnim uređajima. 0 = ne prikazuje se, 1 = prikazuje se. Primjenjuje se pri sužavanju (npr. kada kolone grida idu jedna iznad druge).
// 12) cell_readonly (0 | 1) - Za type "b": 1 = checkbox nije klikabilan (samo prikaz). Default: 0.
// =============================================================================
  const Adrese_TipCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'adrese-Tip-crud',
    Tablica_Zaglavlje: [
      { key: "naziv", title: "Tip adrese", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "Tip", title: "Tip", SQL_Naziv: "Tip", sortable: 1, sortable_icon: 0, type: "b", width: 100, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var selectedTipValue = 0;

  /* Prijevod zaglavlja tablice iz jednog ključa (naslovi zarezom: "Tip adrese, Tip"). 0-Jezik.js je sinkron →
     vnlhT je spreman ovdje; na master jeziku / bez prijevoda vraća originalne naslove. */
  if (window.vnlhTZaglavlje) {
    Adrese_TipCRUD.Tablica_Zaglavlje = window.vnlhTZaglavlje('adrese_tip_crud.tablica.zaglavlje', Adrese_TipCRUD.Tablica_Zaglavlje);
  }

  CommonCRUD.initTablica('tablicaContainer', Adrese_TipCRUD, {
    getRowId: function (row) { return row.length > 0 ? row[row.length - 1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_tip_adrese');
    if (editEl) { editEl.value = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
    selectedTipValue = 0;
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearControlsFromSelection(); }
    else {
      var data = tablicaApi.getData();
      for (var i = 0; i < data.length; i++) {
        if (data[i][2] == id) {
          var editEl = document.getElementById('edit_tip_adrese');
          if (editEl) { editEl.value = data[i][0] != null ? data[i][0] : ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
          selectedTipValue = data[i][1] === 1 || data[i][1] === true || data[i][1] === '1' ? 1 : 0;
          break;
        }
      }
    }
    updateCrudUpisiState();
  };

  (function () {
    var editEl = document.getElementById('edit_tip_adrese');
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
    var editEl = document.getElementById('edit_tip_adrese');
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
  }

  (function () {
    var editEl = document.getElementById('edit_tip_adrese');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (Adrese_TipCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_tip_adrese');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      var data = tablicaApi && typeof tablicaApi.getData === 'function' ? tablicaApi.getData() : [];
      var tipVal = jeIzmjena ? selectedTipValue : (data.length === 0 ? 1 : 0);
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        adrese_TipUpdate(id, naziv, tipVal, function (res) {
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
        adrese_TipAdd(naziv, tipVal, function (res) {
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
      var data = tablicaApi && typeof tablicaApi.getData === 'function' ? tablicaApi.getData() : [];
      var rowsWithTip1 = data.filter(function (row) { return row[1] === 1 || row[1] === true || row[1] === '1'; });
      var deletedRowHadTip1 = rowsWithTip1.length === 1 && String(rowsWithTip1[0][2]) === String(id);
      var otherId = null;
      if (deletedRowHadTip1 && data.length > 1) {
        for (var i = 0; i < data.length; i++) {
          if (String(data[i][2]) !== String(id)) { otherId = data[i][2]; break; }
        }
      }
      function doDelete() {
        adrese_TipDelete(id, function (res) {
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
      }
      if (otherId != null) {
        adrese_TipChange(otherId, 1, function (res) {
          if (res === 'OK') doDelete();
          else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      } else {
        doDelete();
      }
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

  /** Prikaže modal greške iz PHP odgovora. Za 002 (duplikat) #1 = PREVEDENA labela kontrole koja je izazvala
   *  grešku (labela ima vlastiti i18n ključ → sadržaj #1 se ne prevodi zasebno). */
  function prikaziGresku(res) {
    var p = parseResponseCode(res);
    if (!p || typeof MODAL_MESSAGES === 'undefined' || !MODAL_MESSAGES[p.code] || typeof window.showPorukaModal !== 'function') return;
    var repl = p.replacements;
    if (p.code === '002') {
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      repl = [tt('adrese_tip_crud.labela.naziv', 'Tip adrese')];
    }
    window.showPorukaModal(p.code, repl);
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Adrese_Tip_CRUD_sve.php', true);
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
            rows.push([
              arr[i].naziv != null ? arr[i].naziv : '',
              arr[i].Tip != null ? arr[i].Tip : 0,
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

  function osvjeziTablicu(afterSetData) {
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
      if (typeof afterSetData === 'function') {
        requestAnimationFrame(function () { requestAnimationFrame(afterSetData); });
      }
    });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Adrese_TipCRUD.Tablica_Zaglavlje);
  }

  function adrese_TipAdd(naziv, tipVal, callback) {
    postFormData(API_BASE + 'Adrese_Tip_CRUD_upis.php', { naziv: naziv, Tip: String(tipVal) }, callback);
  }

  function adrese_TipUpdate(id, naziv, tipVal, callback) {
    postFormData(API_BASE + 'Adrese_Tip_CRUD_izmjena.php', { id: String(id), naziv: naziv, Tip: String(tipVal) }, callback);
  }

  function adrese_TipDelete(id, callback) {
    postFormData(API_BASE + 'Adrese_Tip_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  function adrese_TipChange(id, tipVal, callback) {
    postFormData(API_BASE + 'Adrese_Tip_CRUD_Tip_Change.php', { id: String(id), Tip: String(tipVal) }, callback);
  }

  (function () {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    container.addEventListener('change', function (e) {
      var chk = e.target && e.target.type === 'checkbox' ? e.target : null;
      if (!chk || !container.contains(chk)) return;
      var tr = chk.closest('tr');
      if (!tr || !tr.dataset.rowId) return;
      var rowId = tr.dataset.rowId;
      var tipVal = chk.checked ? 1 : 0;
      var previousChecked = !chk.checked;
      var data = tablicaApi && typeof tablicaApi.getData === 'function' ? tablicaApi.getData() : [];

      if (tipVal === 0) {
        if (data.length <= 1) {
          chk.checked = true;
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['013'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('013', []);
          }
          return;
        }
        var rowsWithTip1 = data.filter(function (row) { return row[1] === 1 || row[1] === true || row[1] === '1'; });
        var thisRowIsOnlyTip1 = (rowsWithTip1.length === 1 && String(rowsWithTip1[0][2]) === String(rowId));
        if (thisRowIsOnlyTip1) {
          var otherId = null;
          for (var i = 0; i < data.length; i++) {
            if (String(data[i][2]) !== String(rowId)) { otherId = data[i][2]; break; }
          }
          if (otherId == null) {
            chk.checked = true;
            return;
          }
          adrese_TipChange(otherId, 1, function (res1) {
            if (res1 !== 'OK') {
              chk.checked = true;
              var p = parseResponseCode(res1);
              if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
              return;
            }
            adrese_TipChange(rowId, 0, function (res2) {
              if (res2 === 'OK') {
                osvjeziTablicu(function () {
                  var row = container.querySelector('.kontrola-tablica__scroll tbody tr[data-row-id="' + CSS.escape(String(rowId)) + '"]');
                  if (row) {
                    row.classList.add('tablica-row-selected');
                    container.classList.add('kontrola-tablica--has-selected');
                    if (onCrudSelectionChange) onCrudSelectionChange();
                  }
                });
              } else {
                chk.checked = true;
                var p = parseResponseCode(res2);
                if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
              }
            });
          });
          return;
        }
      }

      adrese_TipChange(rowId, tipVal, function (res) {
        if (res === 'OK') {
          osvjeziTablicu(function () {
            var row = container.querySelector('.kontrola-tablica__scroll tbody tr[data-row-id="' + CSS.escape(String(rowId)) + '"]');
            if (row) {
              row.classList.add('tablica-row-selected');
              container.classList.add('kontrola-tablica--has-selected');
              if (onCrudSelectionChange) onCrudSelectionChange();
            }
          });
        } else {
          chk.checked = previousChecked;
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
        }
      });
    });
  })();

  ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  updateCrudUpisiState();
  window.Adrese_TipCRUD = Adrese_TipCRUD;
})();
