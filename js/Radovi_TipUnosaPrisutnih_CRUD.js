/* Radovi_TipUnosaPrisutnih_CRUD.js – tablica + edit; tablica: radovi_prisustvo_tip.
 * Red u tablici: [ redosljed, naziv, boja_prikaza, svi_clanovi_obedijncije, slobodan_unos, duznosnik_ok, id ]; getRowId → indeks 6.
 * Boja u ćeliji: samo bg (tekst se briše nakon iscrtavanja).
 * API: Radovi_TipUnosaPrisutnih_CRUD_sve.php … Format boje u bazi: #RRGGBBAA (Clanovi_Zastavice_CRUD).
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Radovi_TipUnosaPrisutnih_CRUD.html');

  const Radovi_TipUnosaPrisutnihCRUD = {
    Broj_Kolona: 6,
    Reload_Ikona: 0,
    CrudCssPrefix: 'radovi-tip-unosa-pris-crud',
    /* Tablica_Zaglavlje: key/title/width/type — Red. i Boja fiksne širine; Naziv fleks; checkbox stupci read-only u gridu (Svi, Slob., Duž.). */
    Tablica_Zaglavlje: [
      { key: 'redosljed', title: 'Red.', SQL_Naziv: 'redosljed', sortable: 0, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'boja_prikaza', title: 'Boja', SQL_Naziv: 'boja_prikaza', sortable: 0, sortable_icon: 0, type: 't', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'svi_clanovi_obedijncije', title: 'Svi', SQL_Naziv: 'svi_clanovi_obedijncije', sortable: 0, sortable_icon: 0, type: 'b', width: 80, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 1 },
      /* Slob. — slobodan unos imena / lože / države za tip prisustva (0 ili 1, samo čitanje u gridu). */
      { key: 'slobodan_unos', title: 'Slob.', SQL_Naziv: 'slobodan_unos', sortable: 0, sortable_icon: 0, type: 'b', width: 80, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 1 },
      { key: 'duznosnik_ok', title: 'Duž.', SQL_Naziv: 'duznosnik_ok', sortable: 0, sortable_icon: 0, type: 'b', width: 80, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', Radovi_TipUnosaPrisutnihCRUD, {
    getRowId: function (row) {
      return row && row[6] != null ? row[6] : null;
    },
    onReady: function (api) {
      tablicaApi = api;
    },
    onSelectionChange: function () {
      if (onCrudSelectionChange) onCrudSelectionChange();
    }
  });

  var editRedosljed = document.getElementById('edit_redosljed');
  var editDuznosnikOk = document.getElementById('edit_duznosnik_ok');
  var editSlobodanUnos = document.getElementById('edit_slobodan_unos');
  var editSviClanoviObedijncije = document.getElementById('edit_svi_clanovi_obedijncije');
  var editBojaPrikaza = document.getElementById('edit_boja_prikaza');
  var editPanel = document.getElementById('edit_panel');

  if (editRedosljed && typeof window.CommonNumericValidation === 'function') {
    window.CommonNumericValidation(editRedosljed, 1, 99, true);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /** #RRGGBBAA kao u Clanovi_Zastavice_CRUD.js — zapis u bazu. */
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
    } catch (eB) {}
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
    } catch (eR) {}
    return 'rgba(0,0,0,1)';
  }

  /** Polje „Boja prikaza”: prikaz zapisane vrijednosti + bg pregled boje (read-only). */
  function applyBojaToBojaDisplayField(storageVal) {
    if (!editBojaPrikaza) return;
    if (!storageVal || trim(storageVal) === '') {
      editBojaPrikaza.value = '';
      editBojaPrikaza.style.backgroundColor = '';
      editBojaPrikaza.style.color = '';
      return;
    }
    var parsed = bojaFromStorage(storageVal);
    editBojaPrikaza.value = storageVal;
    editBojaPrikaza.style.backgroundColor = hexAlphaToRgba(parsed.hex, parsed.alpha);
    editBojaPrikaza.style.color = '';
  }

  /** Boja teksta u polju „Naziv” = odabrana boja prikaza (za pregled u formi). */
  function applyFgNazivFromBoja(storageVal) {
    var naz = document.getElementById('edit_naziv');
    if (!naz) return;
    if (!storageVal || trim(storageVal) === '') {
      naz.style.color = '';
      return;
    }
    var p = bojaFromStorage(storageVal);
    naz.style.color = hexAlphaToRgba(p.hex, p.alpha);
  }

  /**
   * Sekundarni editi (#edit_redosljed, boja+paleta, čekboxovi) — disabled dok nema aktivnog konteksta:
   * odabran red u tablici ILI bilo što upisano u naziv (.kontrola-edit-delete #edit_naziv).
   * Sam #edit_naziv se ne blokira ovime (unos omogućava ostala polja pri novom slogu bez selekcije).
   */
  function syncEditPanelDisabledState() {
    var editEl = document.getElementById('edit_naziv');
    var imaSelekciju = getSelectedRowId() != null;
    var imaNazivTekst = editEl ? trim(editEl.value) !== '' : false;
    /** Ako pravila blokiraju polje naziv, i ostatak panela ostaje neaktivan. */
    var nazivJeBlokiranPravima = !!(editEl && editEl.disabled);
    var omoguciSekundarne = !nazivJeBlokiranPravima && (imaSelekciju || imaNazivTekst);
    var dis = !omoguciSekundarne;
    if (editRedosljed) editRedosljed.disabled = dis;
    if (editDuznosnikOk) editDuznosnikOk.disabled = dis;
    if (editSlobodanUnos) editSlobodanUnos.disabled = dis;
    if (editSviClanoviObedijncije) editSviClanoviObedijncije.disabled = dis;
    if (editBojaPrikaza) editBojaPrikaza.disabled = dis;
    var pickerBtn = document.getElementById('radovi_tip_pris_boja_picker_btn');
    if (pickerBtn) pickerBtn.disabled = dis;
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
  }

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) {
      editEl.value = '';
      editEl.style.color = '';
      editEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (editRedosljed) editRedosljed.value = '';
    if (editDuznosnikOk) editDuznosnikOk.checked = false;
    if (editSlobodanUnos) editSlobodanUnos.checked = false;
    if (editSviClanoviObedijncije) editSviClanoviObedijncije.checked = false;
    applyBojaToBojaDisplayField('');
    applyFgNazivFromBoja('');
    syncEditPanelDisabledState();
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
          if (data[i][6] == id) {
            editEl.value = data[i][1] != null ? data[i][1] : '';
            if (editRedosljed) {
              var r = data[i][0];
              editRedosljed.value = (r != null && r !== '' && Number(r) > 0) ? String(r) : '';
            }
            var bojaStr = data[i][2] != null ? String(data[i][2]) : '';
            applyBojaToBojaDisplayField(trim(bojaStr) === '' ? '' : bojaStr);
            applyFgNazivFromBoja(trim(bojaStr) === '' ? '' : bojaStr);
            if (editSviClanoviObedijncije) {
              var sv = data[i][3];
              editSviClanoviObedijncije.checked = sv === 1 || sv === true || sv === '1';
            }
            if (editSlobodanUnos) {
              var sb = data[i][4];
              editSlobodanUnos.checked = sb === 1 || sb === true || sb === '1';
            }
            if (editDuznosnikOk) {
              var d = data[i][5];
              editDuznosnikOk.checked = d === 1 || d === true || d === '1';
            }
            break;
          }
        }
        editEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    updateCrudUpisiState();
    syncEditPanelDisabledState();
  };

  (function () {
    var editEl = document.getElementById('edit_naziv');
    var wrap = editEl && editEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (editRedosljed) editRedosljed.value = '';
      if (editDuznosnikOk) editDuznosnikOk.checked = false;
      if (editSlobodanUnos) editSlobodanUnos.checked = false;
      if (editSviClanoviObedijncije) editSviClanoviObedijncije.checked = false;
      applyBojaToBojaDisplayField('');
      applyFgNazivFromBoja('');
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      syncEditPanelDisabledState();
      updateCrudUpisiState();
    });
  })();

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function duznosnikOkZaPost() {
    return editDuznosnikOk && editDuznosnikOk.checked ? '1' : '0';
  }

  function slobodanUnosZaPost() {
    return editSlobodanUnos && editSlobodanUnos.checked ? '1' : '0';
  }

  function sviClanoviObedijncijeZaPost() {
    return editSviClanoviObedijncije && editSviClanoviObedijncije.checked ? '1' : '0';
  }

  function bojaPrikazaZaPost() {
    return editBojaPrikaza ? trim(editBojaPrikaza.value) : '';
  }

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
    syncEditPanelDisabledState();
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (editDuznosnikOk) {
    editDuznosnikOk.addEventListener('change', updateCrudUpisiState);
  }
  if (editSlobodanUnos) {
    editSlobodanUnos.addEventListener('change', updateCrudUpisiState);
  }
  if (editSviClanoviObedijncije) {
    editSviClanoviObedijncije.addEventListener('change', updateCrudUpisiState);
  }

  /* --- Modal izbor boje (isto ponašanje kao Clanovi_Zastavice_CRUD) --- */
  (function initBojaPickerModal() {
    var pickerBtn = document.getElementById('radovi_tip_pris_boja_picker_btn');
    var modal = document.getElementById('radovi_tip_pris_boja_modal');
    var pickerColor = document.getElementById('radovi_tip_pris_boja_picker_color');
    var pickerAlpha = document.getElementById('radovi_tip_pris_boja_picker_alpha');
    var pickerHex = document.getElementById('radovi_tip_pris_boja_picker_hex');
    var pickerPreview = document.getElementById('radovi_tip_pris_boja_picker_preview');
    var pickerOk = document.getElementById('radovi_tip_pris_boja_picker_ok');
    var pickerCancel = document.getElementById('radovi_tip_pris_boja_picker_cancel');
    if (!pickerBtn || !modal || !pickerColor || !pickerAlpha) return;

    function openPicker() {
      var current = editBojaPrikaza ? trim(editBojaPrikaza.value) : '';
      var parsed = bojaFromStorage(current);
      pickerColor.value = parsed.hex;
      pickerAlpha.value = String(parsed.alpha);
      updatePickerHex();
      updatePickerPreview();
      modal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      if (pickerOk) pickerOk.focus();
    }

    function closePicker() {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
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
      applyBojaToBojaDisplayField(storage);
      applyFgNazivFromBoja(storage);
      closePicker();
    }

    pickerBtn.addEventListener('click', function () {
      if (pickerBtn.disabled) return;
      openPicker();
    });
    if (pickerColor) {
      pickerColor.addEventListener('input', function () {
        updatePickerHex();
        updatePickerPreview();
      });
    }
    if (pickerAlpha) {
      pickerAlpha.addEventListener('input', function () {
        updatePickerHex();
        updatePickerPreview();
      });
    }
    if (pickerOk) pickerOk.addEventListener('click', applyFromPicker);
    if (pickerCancel) pickerCancel.addEventListener('click', closePicker);
    var backdrop = modal.querySelector('.radovi-tip-unosa-pris-picker__backdrop');
    if (backdrop) backdrop.addEventListener('click', closePicker);
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
      var duzOk = duznosnikOkZaPost();
      var slobPost = slobodanUnosZaPost();
      var sviSvc = sviClanoviObedijncijeZaPost();
      var bojaPost = bojaPrikazaZaPost();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        radoviPrisustvoTipUpdate(id, naziv, redosljed, duzOk, slobPost, sviSvc, bojaPost, function (res) {
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
        radoviPrisustvoTipAdd(
          {
            naziv: naziv,
            redosljed: redosljed,
            duznosnik_ok: duzOk,
            slobodan_unos: slobPost,
            svi_clanovi_obedijncije: sviSvc,
            boja_prikaza: bojaPost
          },
          function (res) {
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
      radoviPrisustvoTipDelete(id, function (res) {
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
        } catch (e2) {}
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

  /** [ redosljed, naziv, boja_prikaza, svi_clanovi_obedijncije, slobodan_unos, duznosnik_ok, id ] — stupac Boja za naknadno bojanje ćelije. */
  function redIzJsonZaTablicu(o) {
    var r = o.redosljed;
    var dOk = o.duznosnik_ok;
    var bitD = (dOk === 1 || dOk === true || dOk === '1') ? 1 : 0;
    var sU = o.slobodan_unos;
    var bitSlob = (sU === 1 || sU === true || sU === '1') ? 1 : 0;
    var svc = o.svi_clanovi_obedijncije;
    var bitSvi = (svc === 1 || svc === true || svc === '1') ? 1 : 0;
    var bp = o.boja_prikaza != null && trim(String(o.boja_prikaza)) !== '' ? String(o.boja_prikaza) : '';
    return [
      (r != null && r !== '' && Number(r) > 0) ? r : '',
      o.naziv != null ? o.naziv : '',
      bp,
      bitSvi,
      bitSlob,
      bitD,
      o.id != null ? o.id : 0
    ];
  }

  /** Nakon iscrtavanja: u stupcu „Boja” briše tekst; postavlja background na ćeliji iz row[2]. */
  function primijeniBojaPrikazaUTablici() {
    var container = document.getElementById('tablicaContainer');
    if (!container || !tablicaApi || typeof tablicaApi.getData !== 'function') return;
    var data = tablicaApi.getData();
    var tbody = container.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody || !Array.isArray(data)) return;
    var trs = tbody.querySelectorAll('tr');
    for (var i = 0; i < trs.length && i < data.length; i++) {
      var row = data[i];
      var tr = trs[i];
      var tds = tr.querySelectorAll('td');
      if (tds.length < 6) continue;
      var tdBoja = tds[2];
      var raw = row[2];
      var inner = tdBoja.querySelector('.kontrola-tablica__cell-inner') || tdBoja;
      inner.textContent = '';
      if (raw != null && trim(String(raw)) !== '') {
        var parsed = bojaFromStorage(String(raw));
        tdBoja.style.backgroundColor = hexAlphaToRgba(parsed.hex, parsed.alpha);
      } else {
        tdBoja.style.backgroundColor = '';
      }
    }
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Radovi_TipUnosaPrisutnih_CRUD_sve.php', true);
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
          for (var j = 0; j < arr.length; j++) {
            rows.push(redIzJsonZaTablicu(arr[j]));
          }
        } catch (eT) {}
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
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Radovi_TipUnosaPrisutnihCRUD.Tablica_Zaglavlje);
    requestAnimationFrame(function () {
      requestAnimationFrame(primijeniBojaPrikazaUTablici);
    });
  }

  function radoviPrisustvoTipAdd(params, callback) {
    postFormData(API_BASE + 'Radovi_TipUnosaPrisutnih_CRUD_upis.php', params, callback);
  }

  function radoviPrisustvoTipUpdate(id, naziv, redosljed, duznosnik_ok, slobodan_unos, svi_clanovi_obedijncije, boja_prikaza, callback) {
    postFormData(
      API_BASE + 'Radovi_TipUnosaPrisutnih_CRUD_izmjena.php',
      {
        id: String(id),
        naziv: naziv,
        redosljed: redosljed,
        duznosnik_ok: duznosnik_ok,
        slobodan_unos: slobodan_unos,
        svi_clanovi_obedijncije: svi_clanovi_obedijncije,
        boja_prikaza: boja_prikaza
      },
      callback
    );
  }

  function radoviPrisustvoTipDelete(id, callback) {
    postFormData(API_BASE + 'Radovi_TipUnosaPrisutnih_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
  });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  updateCrudUpisiState();
  window.Radovi_TipUnosaPrisutnihCRUD = Radovi_TipUnosaPrisutnihCRUD;
})();
