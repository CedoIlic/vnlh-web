/* Jezici_CRUD.js – tablica (kod, jezik, zadani, aktivan, redoslijed) + edit panel
 * Uzorak: Obredi_CRUD.js / Meni_CRUD.js
 * API: Jezici_CRUD_sve.php, Jezici_CRUD_upis.php, Jezici_CRUD_izmjena.php, Jezici_CRUD_brisanje.php
 * Tablica sustav_jezici. Pravila: zadani = točno jedan (backend usklađuje); zadani je uvijek aktivan
 * i ne može se obrisati ni isključiti.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Jezici_CRUD.html');

  const JeziciCRUD = {
    Broj_Kolona: 7,
    Reload_Ikona: 0,
    CrudCssPrefix: 'jezici-crud',
    Tablica_Zaglavlje: [
      { key: "redoslijed", title: "Rb", SQL_Naziv: "redoslijed", sortable: 1, sortable_icon: 0, type: "n", width: 60, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
      { key: "kod", title: "Šifra", SQL_Naziv: "kod", sortable: 1, sortable_icon: 0, type: "t", width: 70, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "naziv", title: "Jezik", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "naziv_izvorni", title: "Izvorni naziv", SQL_Naziv: "naziv_izvorni", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "zastava", title: "Zastava", SQL_Naziv: "zastava", sortable: 0, sortable_icon: 0, type: "i", width: 90, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
      { key: "zadani", title: "Zadani", SQL_Naziv: "zadani", sortable: 1, sortable_icon: 0, type: "b", width: 80, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1, cell_readonly: 1 },
      { key: "aktivan", title: "Aktivan", SQL_Naziv: "aktivan", sortable: 1, sortable_icon: 0, type: "b", width: 80, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1, cell_readonly: 1 },
    ]
  };

  /** URL zastave: servira php/Jezici_CRUD_Zastava.php iz baze (sustav_slike_tekstovi preko slika_naziv).
   *  Prazno = bez zastave; nema slike u bazi → 404 → prazan okvir (placeholder). */
  function flagUrl(drzavaKod) {
    var k = (drzavaKod != null ? String(drzavaKod) : '').trim().toLowerCase();
    return k !== '' ? '../php/Jezici_CRUD_Zastava.php?kod=' + encodeURIComponent(k) : '';
  }

  /** Indeks skrivenog id-a u redu tablice = broj vidljivih kolona. */
  var ID_IDX = JeziciCRUD.Broj_Kolona;

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  /** Puni zapisi jezika po id (uklj. drzava_kod) iz zadnjeg učitavanja — za popunjavanje selecta zastave. */
  var jeziciById = {};

  CommonCRUD.initTablica('tablicaContainer', JeziciCRUD, {
    /* id je zadnji element reda; bez ovoga CommonCRUD uzima row[1] (=naziv) pa selekcija ne radi. */
    getRowId: function (row) { return (row && row.length > 0) ? row[row.length - 1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  // ---------- helperi za kontrole ----------
  function el(id) { return document.getElementById(id); }
  function val(id) { var e = el(id); return e ? e.value : ''; }
  function setVal(id, v) {
    var e = el(id);
    if (!e) return;
    e.value = (v != null ? String(v) : '');
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function chk(id) { var e = el(id); return !!(e && e.checked); }
  function setChk(id, on) {
    var e = el(id);
    if (!e) return;
    e.checked = !!on;
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  /** Ponuđeni redoslijed za novi unos = max(redoslijed) + 10 (razmak omogućava umetanje između). */
  function nextFreeRedoslijed() {
    var data = tablicaApi ? tablicaApi.getData() : [];
    var max = 0;
    for (var i = 0; i < data.length; i++) {
      var r = toInt(data[i][0]);
      if (r > max) max = r;
    }
    return max + 10;
  }

  /** Cijeli red tablice za trenutno selektirani id (ili null). */
  function getSelectedRow() {
    var id = getSelectedRowId();
    if (id == null) return null;
    var data = tablicaApi ? tablicaApi.getData() : [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][ID_IDX] == id) return data[i];
    }
    return null;
  }

  /** Zadani jezik mora biti aktivan: kad je Zadani označen, Aktivan je prisilno označen. */
  function syncZadaniAktivan() {
    if (chk('edit_zadani')) {
      var akt = el('edit_aktivan');
      if (akt) akt.checked = true;
    }
    applyControlsEnabled();
  }

  /** Enable/disable jedne kontrole preko app-helpera (klase kontrola-edit-delete--disabled,
   *  kontrola-labela--disabled, gašenje clear ×) uz ažuriranje pripadne [for] labele. */
  function setCtrl(id, enabled) {
    var e = el(id);
    if (!e) return;
    if (typeof window.KontroleSetControlEnabled === 'function') {
      window.KontroleSetControlEnabled(e, enabled);
    } else {
      e.disabled = !enabled;
    }
  }

  /** Bez sadržaja u polju Jezik sve ostale kontrole (i njihove labele) su disable; sa sadržajem enable.
   *  Iznimka: Aktivan ostaje zaključan dok je Zadani označen (zadani mora biti aktivan). */
  function applyControlsEnabled() {
    var imaJezik = trim(val('edit_jezik')) !== '';
    setCtrl('edit_kod', imaJezik);
    setCtrl('edit_izvorni', imaJezik);
    setCtrl('edit_redoslijed', imaJezik);
    setCtrl('edit_zadani', imaJezik);
    setCtrl('edit_aktivan', imaJezik && !chk('edit_zadani'));
    setCtrl('edit_drzava', imaJezik);
    var btnDr = el('btnDrzaveModal');
    if (btnDr) btnDr.disabled = !imaJezik;
  }

  function clearControlsFromSelection() {
    setVal('edit_kod', '');
    setVal('edit_jezik', '');
    setVal('edit_izvorni', '');
    setChk('edit_zadani', false);
    setChk('edit_aktivan', true);
    setVal('edit_redoslijed', String(nextFreeRedoslijed()));
    loadDrzaveSelect('');
    syncZadaniAktivan();
  }

  onCrudSelectionChange = function () {
    var row = getSelectedRow();
    if (!row) {
      clearControlsFromSelection();
    } else {
      setVal('edit_redoslijed', row[0] != null ? row[0] : '');
      setVal('edit_kod', row[1] != null ? row[1] : '');
      setVal('edit_jezik', row[2] != null ? row[2] : '');
      setVal('edit_izvorni', row[3] != null ? row[3] : '');
      /* row[4] = URL zastave (prikaz u tablici), ne popunjava se u formu */
      setChk('edit_zadani', toInt(row[5]) === 1);
      setChk('edit_aktivan', toInt(row[6]) === 1);
      var rec = jeziciById[getSelectedRowId()];
      loadDrzaveSelect(rec ? rec.drzava_kod : '');
      syncZadaniAktivan();
    }
    updateCrudUpisiState();
  };

  // Clear gumb (×) na Jezik/Šifra: ukloni selekciju u tablici i počisti SVE kontrole edit panela (povratak u Upis mod).
  ['edit_kod', 'edit_jezik'].forEach(function (id) {
    var e = el(id);
    var wrap = e && e.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      clearControlsFromSelection();
      updateCrudUpisiState();
    });
  });

  var btnUpisi = el('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = el('btnIzbrisi');

  function updateCrudUpisiState() {
    applyControlsEnabled();
    var imaSelekciju = getSelectedRowId() != null;
    var imaSadrzaj = trim(val('edit_kod')) !== '' && trim(val('edit_jezik')) !== '';

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) {
      btnIzbrisi.disabled = !imaSelekciju;
    }
  }

  // Listeneri na poljima za stanje gumba.
  ['edit_kod', 'edit_jezik', 'edit_redoslijed'].forEach(function (id) {
    var e = el(id);
    if (!e) return;
    e.addEventListener('input', updateCrudUpisiState);
    e.addEventListener('change', updateCrudUpisiState);
  });
  (function () {
    var z = el('edit_zadani');
    if (z) z.addEventListener('change', function () { syncZadaniAktivan(); updateCrudUpisiState(); });
  })();

  if (JeziciCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = el('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  function readForm() {
    return {
      kod: trim(val('edit_kod')).toLowerCase(),
      naziv: trim(val('edit_jezik')),
      naziv_izvorni: trim(val('edit_izvorni')),
      drzava_kod: trim(val('edit_drzava')).toLowerCase(),
      zadani: chk('edit_zadani') ? '1' : '0',
      aktivan: chk('edit_aktivan') ? '1' : '0',
      redoslijed: trim(val('edit_redoslijed'))
    };
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var f = readForm();
      if (f.kod === '' || f.naziv === '') return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        jeziciUpdate(id, f, function (res) {
          handleCrudResult(res, '004');
        });
      } else {
        jeziciAdd(f, function (res) {
          handleCrudResult(res, '001');
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      jeziciDelete(id, function (res) {
        handleCrudResult(res, '003');
      });
    });
  }

  /** Uspjeh (OK) → modal uspjeha + reset + reload; inače modal koda greške. */
  function handleCrudResult(res, okCode) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(okCode, [], function () {
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          clearControlsFromSelection();
          osvjeziTablicu();
        });
      } else {
        osvjeziTablicu();
      }
      return;
    }
    var p = parseResponseCode(res);
    if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal(p.code, p.replacements);
    }
  }

  (function () {
    var btnPovratak = el('btnPovratak');
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
          var u2 = new URL(document.referrer);
          if (u2.origin === window.location.origin) { window.location.href = u2.href; return; }
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
    xhr.open('GET', API_BASE + 'Jezici_CRUD_sve.php', true);
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
          jeziciById = {};
          for (var i = 0; i < arr.length; i++) {
            rows.push([
              arr[i].redoslijed != null ? arr[i].redoslijed : 0,
              arr[i].kod != null ? arr[i].kod : '',
              arr[i].naziv != null ? arr[i].naziv : '',
              arr[i].naziv_izvorni != null ? arr[i].naziv_izvorni : '',
              flagUrl(arr[i].drzava_kod),
              arr[i].zadani != null ? arr[i].zadani : 0,
              arr[i].aktivan != null ? arr[i].aktivan : 0,
              arr[i].id != null ? arr[i].id : 0
            ]);
            if (arr[i].id != null) jeziciById[arr[i].id] = arr[i];
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
      if (getSelectedRowId() == null) clearControlsFromSelection();
    });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, JeziciCRUD.Tablica_Zaglavlje);
  }

  function jeziciAdd(f, callback) {
    postFormData(API_BASE + 'Jezici_CRUD_upis.php', f, callback);
  }

  function jeziciUpdate(id, f, callback) {
    postFormData(API_BASE + 'Jezici_CRUD_izmjena.php', {
      id: String(id), kod: f.kod, naziv: f.naziv, naziv_izvorni: f.naziv_izvorni, drzava_kod: f.drzava_kod,
      zadani: f.zadani, aktivan: f.aktivan, redoslijed: f.redoslijed
    }, callback);
  }

  function jeziciDelete(id, callback) {
    postFormData(API_BASE + 'Jezici_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
    clearControlsFromSelection();
  });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  // =========================================================
  // Zastava: select aktivnih država + modal za toggle aktivan
  // =========================================================

  /** Učita aktivne države u #edit_drzava (value=kod, label=naziv) i postavi selectKod.
   *  selectKod se uvijek uključi (ukljuci) makar je deaktiviran — da se izborom ne izgubi. */
  function loadDrzaveSelect(selectKod) {
    var sel = el('edit_drzava');
    if (!sel) return;
    var want = (selectKod != null ? String(selectKod) : '').toLowerCase();
    var url = API_BASE + 'Jezici_CRUD_drzave_aktivne.php' + (want !== '' ? '?ukljuci=' + encodeURIComponent(want) : '');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text.charAt(0) === '[') { try { arr = JSON.parse(text); } catch (e) {} }
      while (sel.options.length) sel.remove(0);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— bez zastave —';
      sel.appendChild(opt0);
      for (var i = 0; i < arr.length; i++) {
        var o = document.createElement('option');
        o.value = arr[i].kod;
        o.textContent = arr[i].naziv;
        sel.appendChild(o);
      }
      sel.value = want;
      if (sel.value !== want) sel.value = '';
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('edit_drzava');
    };
    xhr.send();
  }

  /* Modal s tablicom iz 0-Kontrole (ModalTablicaInit): drag/resize, footer gumb Izlaz (sivi default). */
  var drzaveModal = null;
  var DRZAVE_MODAL_ZAGLAVLJE = [
    { key: 'aktivan', title: 'Aktivan', SQL_Naziv: 'aktivan', sortable: 1, sortable_icon: 0, type: 'b', width: 80, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
    { key: 'kod', title: 'Šifra', SQL_Naziv: 'kod', sortable: 1, sortable_icon: 0, type: 't', width: 60, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
    { key: 'naziv', title: 'Država', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
    { key: 'slika_naziv', title: 'Naziv slike', SQL_Naziv: 'slika_naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];

  function ensureDrzaveModal() {
    if (drzaveModal) return drzaveModal;
    if (typeof window.ModalTablicaInit !== 'function') return null;
    drzaveModal = window.ModalTablicaInit({
      storageKey: 'jezici_drzave_aktiviranje',
      headerText: 'Države — uključi za izbor zastave',
      getButtons: function () {
        return [{ label: 'Izlaz', primary: false, onClick: function () { closeDrzaveModal(); } }];
      }
    });
    return drzaveModal;
  }

  function openDrzaveModal() {
    var m = ensureDrzaveModal();
    if (!m) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Jezici_CRUD_drzave_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text.charAt(0) === '[') { try { arr = JSON.parse(text); } catch (e) {} }
      var rows = [];
      for (var i = 0; i < arr.length; i++) {
        /* [aktivan(b), kod, naziv, slika_naziv, kod=id] — id (zadnji) = ISO šifra za toggle. */
        rows.push([toInt(arr[i].aktivan), arr[i].kod, arr[i].naziv, arr[i].slika_naziv || '', arr[i].kod]);
      }
      m.open({
        zaglavlje: DRZAVE_MODAL_ZAGLAVLJE,
        rows: rows,
        getRowId: function (row) { return row[row.length - 1]; }
      });
    };
    xhr.send();
  }

  function closeDrzaveModal() {
    if (drzaveModal) drzaveModal.close();
    /* reload selekta po izlasku (zadrži trenutni izbor) */
    loadDrzaveSelect(trim(val('edit_drzava')));
  }

  function toggleDrzava(kod, aktivan, cbEl) {
    postFormData(API_BASE + 'Jezici_CRUD_drzave_toggle.php', { kod: kod, aktivan: String(aktivan) }, function (res) {
      if (res === 'OK') return;
      if (cbEl) cbEl.checked = !cbEl.checked; /* revert na grešku */
      var p = parseResponseCode(res);
      if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(p.code, p.replacements);
      }
    });
  }

  /* Ček/unček u modal tablici → odmah toggle aktivan u bazi (event delegation, samo .modal-tablica). */
  document.addEventListener('change', function (e) {
    var cb = e.target;
    if (!cb || !cb.classList || !cb.classList.contains('kontrola-checkbox')) return;
    if (!cb.closest || !cb.closest('.modal-tablica')) return;
    var tr = cb.closest('tr');
    var kod = tr ? tr.dataset.rowId : '';
    if (!kod) return;
    toggleDrzava(kod, cb.checked ? 1 : 0, cb);
  });

  (function wireDrzaveModal() {
    var btn = el('btnDrzaveModal');
    if (btn) btn.addEventListener('click', function () { if (!btn.disabled) openDrzaveModal(); });
  })();

  updateCrudUpisiState();

  window.JeziciCRUD = JeziciCRUD;
})();
