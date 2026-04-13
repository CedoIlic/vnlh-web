/* Duznosnici_CRUD.js – tablica (Dužnosnik, Odgovornost) + edit: naziv + select Odgovornost (id_nadredjeni). Tablica: duznosnici. */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Duznosnici_CRUD.html');

// ========== KONSTANTE ==========
// DuznosniciCRUD – konfiguracija forme (Broj_Kolona, Reload_Ikona, CrudCssPrefix, Tablica_Zaglavlje).
//
// Tablica_Zaglavlje – svaka kolona je objekt sa parametrima:
// 1) key (string) - Jedinstveni ključ kolone.
// 2) title (string) - Tekst u zaglavlju kolone (THEAD).
// 3) SQL_Naziv (string) - Naziv podatka koji vraća PHP. Ako nije upisan = prvi podatak iza id. id = ključ sloga, skriveni podatak u redu tablice.
// 4) sortable (0 | 1) - 1 = kolona se može sortirati klikom na zaglavlje; 0 = nije sortabilna.
// 5) sortable_icon (0 | 1) - 1 = iscrtava se sort ikona u zaglavlju. Default: 0.
// 6) type ("t" | "n" | "d" | "b") - Tip podataka u koloni: "t" = tekst, "n" = broj, "d" = datum, "b" = binarno.
// 7) width (number) - Širina te kolone: 0 = auto; < 0 = abs(width) % ukupne širine; > 0 = fiksno u px.
// 8) suffix (string) - Dodatak uz prikaz podatka.
// 9) align ("L" | "C" | "R") - Orijentacija teksta u zaglavlju tablice.
// 10) row_align ("L" | "C" | "R") - Orijentacija sadržaja u redovima tablice.
// 11) mobitel_prikaz (0–255, default 1) - Prikaz kolone na mobilnim uređajima.
// 12) cell_readonly (0 | 1) - Za type "b": 1 = checkbox nije klikabilan. Default: 0.
//
  const DuznosniciCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 1,
    CrudCssPrefix: 'duznosnici-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Dužnosnik', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'odgovornost', title: 'Odgovornost', SQL_Naziv: 'nadredjeni_naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var duznosniciLista = [];

  CommonCRUD.initTablica('tablicaContainer', DuznosniciCRUD, {
    getRowId: function (row) { return row && row.length > 2 ? row[2] : (row && row[1]); },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var selectOdgovornost = document.getElementById('select_odgovornost');

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) { editEl.value = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (selectOdgovornost) { selectOdgovornost.value = '0'; }
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
      var listaZaSelect = [];
      for (var j = 0; j < duznosniciLista.length; j++) listaZaSelect.push({ id: duznosniciLista[j].id, naziv: duznosniciLista[j].naziv });
      puniSelectOdgovornost(listaZaSelect, null);
      updateCrudUpisiState();
      return;
    }
    var data = tablicaApi.getData();
    var idNadredjeni = 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i][2] == id) {
        var editEl = document.getElementById('edit_naziv');
        if (editEl) { editEl.value = data[i][0] != null ? data[i][0] : ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
        for (var j = 0; j < duznosniciLista.length; j++) {
          if (duznosniciLista[j].id == id) { idNadredjeni = duznosniciLista[j].id_nadredjeni != null ? duznosniciLista[j].id_nadredjeni : 0; break; }
        }
        var listaZaSelect = [];
        for (var k = 0; k < duznosniciLista.length; k++) listaZaSelect.push({ id: duznosniciLista[k].id, naziv: duznosniciLista[k].naziv });
        puniSelectOdgovornost(listaZaSelect, id);
        if (selectOdgovornost) {
          selectOdgovornost.value = String(idNadredjeni);
          if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_odgovornost');
        }
        break;
      }
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

  var labelOdgovornost = document.querySelector('label[for="select_odgovornost"]');

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
    if (selectOdgovornost) {
      selectOdgovornost.disabled = !imaSadrzaj;
      if (imaSadrzaj) selectOdgovornost.removeAttribute('disabled');
      else selectOdgovornost.setAttribute('disabled', 'disabled');
    }
    if (labelOdgovornost) labelOdgovornost.classList.toggle('kontrola-labela--disabled', !imaSadrzaj);
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (DuznosniciCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_naziv');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var idNadredjeni = selectOdgovornost ? (parseInt(selectOdgovornost.value, 10) || 0) : 0;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        duznosniciUpdate(id, naziv, idNadredjeni, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.code === '002' ? ['naziv dužnosnika'] : p.replacements);
          }
        });
      } else {
        duznosniciAdd(naziv, idNadredjeni, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.code === '002' ? ['naziv dužnosnika'] : p.replacements);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      duznosniciDelete(id, function (res) {
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

  function puniSelectOdgovornost(lista, currentId) {
    if (!selectOdgovornost) return;
    while (selectOdgovornost.firstChild) selectOdgovornost.removeChild(selectOdgovornost.firstChild);
    var opt0 = document.createElement('option');
    opt0.value = '0';
    opt0.textContent = 'Ne odgovara nikome';
    selectOdgovornost.appendChild(opt0);
    for (var i = 0; i < lista.length; i++) {
      var o = lista[i];
      var idVal = o.id != null ? o.id : 0;
      if (currentId != null && idVal === currentId) continue;
      var opt = document.createElement('option');
      opt.value = String(idVal);
      opt.textContent = o.naziv != null ? String(o.naziv) : '';
      selectOdgovornost.appendChild(opt);
    }
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_odgovornost');
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Duznosnici_CRUD_sve.php', true);
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
          duznosniciLista = arr;
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            var nadr = r.nadredjeni_naziv != null ? r.nadredjeni_naziv : (r.id_nadredjeni === 0 || !r.id_nadredjeni ? '' : '');
            rows.push([r.naziv != null ? r.naziv : '', nadr, r.id != null ? r.id : 0]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
      var id = getSelectedRowId();
      var listaZaSelect = [];
      for (var j = 0; j < duznosniciLista.length; j++) listaZaSelect.push({ id: duznosniciLista[j].id, naziv: duznosniciLista[j].naziv });
      puniSelectOdgovornost(listaZaSelect, id);
      if (id != null) {
        for (var k = 0; k < duznosniciLista.length; k++) {
          if (duznosniciLista[k].id == id) {
            selectOdgovornost.value = String(duznosniciLista[k].id_nadredjeni != null ? duznosniciLista[k].id_nadredjeni : 0);
            break;
          }
        }
      }
    });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, DuznosniciCRUD.Tablica_Zaglavlje);
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function duznosniciAdd(naziv, id_nadredjeni, callback) {
    postFormData(API_BASE + 'Duznosnici_CRUD_upis.php', { naziv: naziv, id_nadredjeni: String(id_nadredjeni || 0) }, callback);
  }

  function duznosniciUpdate(id, naziv, id_nadredjeni, callback) {
    postFormData(API_BASE + 'Duznosnici_CRUD_izmjena.php', { id: String(id), naziv: naziv, id_nadredjeni: String(id_nadredjeni || 0) }, callback);
  }

  function duznosniciDelete(id, callback) {
    postFormData(API_BASE + 'Duznosnici_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
    var listaZaSelect = [];
    for (var j = 0; j < duznosniciLista.length; j++) listaZaSelect.push({ id: duznosniciLista[j].id, naziv: duznosniciLista[j].naziv });
    puniSelectOdgovornost(listaZaSelect, null);
  });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  updateCrudUpisiState();
  window.DuznosniciCRUD = DuznosniciCRUD;
})();
