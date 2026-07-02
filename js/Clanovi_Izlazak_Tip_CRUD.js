/* Clanovi_Izlazak_Tip_CRUD.js – tablica (ID + naziv) + jedna kontrola. Tablica: clanovi_izlazak_tip. */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Clanovi_Izlazak_Tip_CRUD.html');

// ========== KONSTANTE ==========
// Clanovi_Izlazak_TipCRUD – jedinstveni objekt s konfiguracijom forme.
// Veza s tablicom:
// - Tablica ima Broj_Kolona kolona (ID + naziv). id se dodatno drži kao skriveni zadnji element retka (ključ selekcije).
// - Reload_Ikona = 1: header panelu tablice s reload ikonom. 0 = nema.
// Tablica_Zaglavlje – parametri kolone: key, title, SQL_Naziv, sortable, sortable_icon, type, width, suffix, align, row_align, mobitel_prikaz, cell_readonly.
// =============================================================================
  const Clanovi_Izlazak_TipCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-izlazak-tip-crud',
    Tablica_Zaglavlje: [
      { key: "naziv", title: "Tip izlaska iz lože", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "redosljed", title: "Red", SQL_Naziv: "redosljed", sortable: 1, sortable_icon: 0, type: "n", width: 100, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
      { key: "kljuc", title: "Ključ", SQL_Naziv: "kljuc", sortable: 1, sortable_icon: 0, type: "n", width: 100, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  /* Prijevod zaglavlja tablice iz jednog ključa (naslovi zarezom). 0-Jezik.js je sinkron → vnlhT je spreman ovdje;
     na master jeziku / bez prijevoda vraća originalne naslove. */
  if (window.vnlhTZaglavlje) {
    Clanovi_Izlazak_TipCRUD.Tablica_Zaglavlje = window.vnlhTZaglavlje('clanovi_izlazak_tip_crud.tablica.zaglavlje', Clanovi_Izlazak_TipCRUD.Tablica_Zaglavlje);
  }

  CommonCRUD.initTablica('tablicaContainer', Clanovi_Izlazak_TipCRUD, {
    /* id je skriveni zadnji element retka ([naziv, redosljed, kljuc, id]); selekcija ide po njemu. */
    getRowId: function (row) { return row && row[3] != null ? row[3] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  /* Numerički editi (cijeli broj 0–100). */
  var editRedosljed = document.getElementById('edit_redosljed');
  var editKljuc = document.getElementById('edit_kljuc');
  if (editRedosljed && typeof window.CommonNumericValidation === 'function') window.CommonNumericValidation(editRedosljed, 0, 100, true);
  if (editKljuc && typeof window.CommonNumericValidation === 'function') window.CommonNumericValidation(editKljuc, 0, 100, true);

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) { editEl.value = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editRedosljed) editRedosljed.value = '';
    if (editKljuc) editKljuc.value = '';
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearControlsFromSelection(); }
    else {
      var editEl = document.getElementById('edit_naziv');
      var data = tablicaApi.getData();
      for (var i = 0; i < data.length; i++) {
        if (data[i][3] == id) {
          if (editEl) editEl.value = data[i][0] != null ? data[i][0] : '';
          if (editRedosljed) editRedosljed.value = data[i][1] != null ? String(data[i][1]) : '';
          if (editKljuc) editKljuc.value = data[i][2] != null ? String(data[i][2]) : '';
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

    // Redosljed + Ključ (s labelama): enable kad ima selekcija ILI sadržaj u „Tip izlaska"; inače disable.
    var kontroleEnabled = imaSelekciju || imaSadrzaj;
    var elRed = document.getElementById('edit_redosljed');
    var elKljuc = document.getElementById('edit_kljuc');
    if (elRed) elRed.disabled = !kontroleEnabled;
    if (elKljuc) elKljuc.disabled = !kontroleEnabled;
    var btnKljucPomoc = document.getElementById('btnKljucPomoc');
    if (btnKljucPomoc) btnKljucPomoc.disabled = !kontroleEnabled; // help ikona prati Ključ edit
    var lblRed = document.querySelector('label[for="edit_redosljed"]');
    var lblKljuc = document.querySelector('label[for="edit_kljuc"]');
    if (lblRed) lblRed.classList.toggle('kontrola-labela--disabled', !kontroleEnabled);
    if (lblKljuc) lblKljuc.classList.toggle('kontrola-labela--disabled', !kontroleEnabled);
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (Clanovi_Izlazak_TipCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_naziv');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var redosljed = editRedosljed ? trim(editRedosljed.value) : '';
      var kljuc = editKljuc ? trim(editKljuc.value) : '';
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        clanoviIzlazakTipUpdate(id, naziv, redosljed, kljuc, function (res) {
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
        clanoviIzlazakTipAdd(naziv, redosljed, kljuc, function (res) {
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
      clanoviIzlazakTipDelete(id, function (res) {
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

  /** Prikaže modal greške iz PHP odgovora. Za 002 (duplikat) #1 = PREVEDENA labela kontrole koja je izazvala
   *  grešku (labela ima vlastiti i18n ključ → sadržaj #1 se ne prevodi zasebno). */
  function prikaziGresku(res) {
    var p = parseResponseCode(res);
    if (!p || typeof MODAL_MESSAGES === 'undefined' || !MODAL_MESSAGES[p.code] || typeof window.showPorukaModal !== 'function') return;
    var repl = p.replacements;
    if (p.code === '002') {
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      repl = [tt('clanovi_izlazak_tip_crud.labela.naziv', 'Tip izlaska iz lože')];
    }
    window.showPorukaModal(p.code, repl);
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_Izlazak_Tip_CRUD_sve.php', true);
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
              arr[i].kljuc != null ? arr[i].kljuc : 0,
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
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Clanovi_Izlazak_TipCRUD.Tablica_Zaglavlje);
  }

  function clanoviIzlazakTipAdd(naziv, redosljed, kljuc, callback) {
    postFormData(API_BASE + 'Clanovi_Izlazak_Tip_CRUD_upis.php', { naziv: naziv, redosljed: redosljed, kljuc: kljuc }, callback);
  }

  function clanoviIzlazakTipUpdate(id, naziv, redosljed, kljuc, callback) {
    postFormData(API_BASE + 'Clanovi_Izlazak_Tip_CRUD_izmjena.php', { id: String(id), naziv: naziv, redosljed: redosljed, kljuc: kljuc }, callback);
  }

  function clanoviIzlazakTipDelete(id, callback) {
    postFormData(API_BASE + 'Clanovi_Izlazak_Tip_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /* Popup uputa za Ključeve (uzor: PDF_Dokument_CRUD help modal). */
  (function () {
    var m = document.getElementById('kljucPomocModal');
    if (!m) return;
    function otvori() { m.setAttribute('aria-hidden', 'false'); m.classList.add('kontrola-modal--open'); }
    function zatvori() { m.setAttribute('aria-hidden', 'true'); m.classList.remove('kontrola-modal--open'); }
    var bp = document.getElementById('btnKljucPomoc'); if (bp) bp.addEventListener('click', otvori);
    var ok = document.getElementById('btnKljucPomocOk'); if (ok) ok.addEventListener('click', zatvori);
    var ov = document.getElementById('kljucPomocModal_overlay'); if (ov) ov.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('aria-hidden') === 'false') zatvori(); });
    var dlg = m.querySelector('.kontrola-modal__dialog'), hdr = document.getElementById('kljucPomocModal_header');
    if (dlg && hdr && typeof KontroleModalDrag === 'function') KontroleModalDrag(dlg, hdr);
  })();

  updateCrudUpisiState();
  window.Clanovi_Izlazak_TipCRUD = Clanovi_Izlazak_TipCRUD;
})();
