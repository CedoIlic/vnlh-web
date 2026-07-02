/* =====================================================
   Clanovi_Promjena_Loze_Izlazak_CRUD.js
   Promjena lože / izlazak (pokrivanje). Prvi panel: tablica članova odabrane lože
   (logo + Država/Regija/Loža + Traži). Ispod: edit panel (polja se dodaju kasnije).
   Uzor: Kandidat_Dokumenti_CRUD / Clanovi_Loza_CRUD (geo/logo/tablica).
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';

  var API_BASE = '../php/';
  var data = [];                 /* svi članovi odabrane lože */
  var _tipKljucById = {};        /* mapa id tipa izlaska → njegov ključ (clanovi_izlazak_tip.kljuc) */
  var _tabEnabled = false;       /* je li tab kontrola trenutno omogućena (ima selekcije člana) */
  var _lozeSve = [];             /* sve lože [{id, naziv, id_tip_loze}] za selekte napušta/odlazi */
  var _geoAutoLockedDrzava = false, _geoAutoLockedRegija = false, _geoAutoLockedLoza = false;
  var _pravaCrudUpis = 1, _pravaCrudBrisanje = 1;

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }
  function getApiUrl(path) {
    var p = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + p + '/php/' + path;
  }
  function parseResponseCode(text) {
    if (typeof text !== 'string' || text.trim() === '') return null;
    var parts = text.trim().split('|');
    return { code: parts[0], replacements: parts.slice(1) };
  }
  function poruka(code, repl, cb) {
    if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[code] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal(code, repl || [], cb);
    } else if (typeof cb === 'function') { cb(); }
  }
  function postFormData(url, params, cb) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, cb);
    else if (cb) cb('');
  }

  /* --- Tablica: Prezime, Ime, St. (stupanj) --- */
  var PromjenaLozeCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'prezime', title: 'Prezime', SQL_Naziv: 'prezime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'ime', title: 'Ime', SQL_Naziv: 'ime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stupanj', title: 'St.', SQL_Naziv: 'stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  CommonCRUD.initTablica('tablicaContainer', PromjenaLozeCRUD, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  /* --- Tab 2: tablica zapisa (jedna kolona; sort iz SQL-a: datum_izlaska DESC) --- */
  var ZapisiCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-promjena-loze-izlazak-crud-zapisi',
    Tablica_Zaglavlje: [
      { key: 'tekst', title: 'Popis stavki promjene lože člana ili napuštanje obedijencije te pokrivanja', SQL_Naziv: 'tekst', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var zapisiApi = null;
  CommonCRUD.initTablica('zapisiTablicaContainer', ZapisiCRUD, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { zapisiApi = api; }
  });

  function formatDatumHR(s) {
    if (!s) return '';
    var m = String(s).split('-');
    return (m.length === 3) ? (m[2] + '.' + m[1] + '.' + m[0] + '.') : String(s);
  }

  /* Popuni Tab 2 zapisima iz clanovi_izlazak; tekst retka: „datum, Prezime Ime, tip[, odlaska → dolaska]". */
  function loadZapisi() {
    var idLoza = selectLoza ? trim(selectLoza.value) : '';
    if (!idLoza) {
      if (zapisiApi) CommonCRUD.setDataTablica(zapisiApi, 'zapisiTablicaContainer', [], ZapisiCRUD.Tablica_Zaglavlje);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_Promjena_Loze_Izlazak_CRUD_zapisi.php?id_loza=' + encodeURIComponent(idLoza), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text) || [];
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            var ime = ((r.prezime || '') + ' ' + (r.ime || '')).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            var tekst = formatDatumHR(r.datum_izlaska) + ', ' + ime + ', ' + (r.tip_naziv || '');
            if (String(r.tip_kljuc) === '1') {
              tekst += ', ' + (r.loza_odlaska_naziv || '') + ' → ' + (r.loza_dolaska_naziv || '');
            }
            rows.push({ id: r.id != null ? r.id : '', 0: tekst });
          }
        } catch (e) { rows = []; }
      }
      if (zapisiApi) CommonCRUD.setDataTablica(zapisiApi, 'zapisiTablicaContainer', rows, ZapisiCRUD.Tablica_Zaglavlje);
    };
    xhr.send();
  }

  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var editPanel = document.getElementById('edit_panel');

  /* Kontrole Tab 1 (Promjena Lože - izlazak). */
  var editDatumUlaska = document.getElementById('edit_datum_ulaska');   /* RO: clanovi.datum_ulaska_lozu */
  var editDatumIzlaska = document.getElementById('edit_datum_izlaska'); /* clanovi_izlazak.datum_izlaska */
  var selectIzlazakTip = document.getElementById('select_izlazak_tip'); /* clanovi_izlazak_tip po redosljedu */
  var selectLozaNapusta = document.getElementById('select_loza_napusta'); /* RO: clanovi.loza */
  var selectLozaOdlazi = document.getElementById('select_loza_odlazi');   /* sve lože */
  var editNapomena = document.getElementById('edit_napomena');            /* clanovi_izlazak.napomena */

  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect(id); }

  /* Šifarnik tipova izlaska (po redosljedu). Uz value=id pamti i ključ (data-kljuc + mapa id→kljuc). */
  function loadTipoviIzlaska() {
    if (!selectIzlazakTip) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_Izlazak_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') { try { arr = JSON.parse(text) || []; } catch (e) { arr = []; } }
      _tipKljucById = {};
      while (selectIzlazakTip.firstChild) selectIzlazakTip.removeChild(selectIzlazakTip.firstChild);
      var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '— Odaberi tip —'; opt0.setAttribute('data-kljuc', ''); selectIzlazakTip.appendChild(opt0);
      for (var i = 0; i < arr.length; i++) {
        var o = arr[i];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = o.naziv != null ? o.naziv : '';
        var kljuc = o.kljuc != null ? String(o.kljuc) : '';
        opt.setAttribute('data-kljuc', kljuc);
        if (opt.value !== '') _tipKljucById[opt.value] = kljuc;
        selectIzlazakTip.appendChild(opt);
      }
      refreshSelect('select_izlazak_tip');
    };
    xhr.send();
  }

  /* Ključ trenutno odabranog tipa izlaska (npr. '1' = prelazak, '2' = izlazak); '' ako ništa nije odabrano. */
  function tipIzlaskaKljuc() {
    if (!selectIzlazakTip || selectIzlazakTip.value === '') return '';
    return _tipKljucById[selectIzlazakTip.value] != null ? _tipKljucById[selectIzlazakTip.value] : '';
  }

  /* Loža selekti: „Lože iz koje izlazi" (RO) i „Loža u koju odlazi" enabled SAMO kad je tab enabled
     I odabran je tip s ključem '1' (prelazak). Inače su oba disabled (i labele prigušene). */
  function updateLozaSelekti() {
    var kljuc1 = _tabEnabled && tipIzlaskaKljuc() === '1';
    if (selectLozaNapusta) {
      var napWrap = selectLozaNapusta.closest ? selectLozaNapusta.closest('.kontrola-select') : null;
      selectLozaNapusta.disabled = !kljuc1;                 /* enabled(kljuc1) → RO prikaz; inače disabled */
      refreshSelect('select_loza_napusta');
      if (napWrap) napWrap.classList.toggle('kontrola-select--readonly', kljuc1);
    }
    if (selectLozaOdlazi) { selectLozaOdlazi.disabled = !kljuc1; refreshSelect('select_loza_odlazi'); }
    var lblNap = document.querySelector('label[for="select_loza_napusta"]');
    var lblOdl = document.querySelector('label[for="select_loza_odlazi"]');
    if (lblNap) lblNap.classList.toggle('kontrola-labela--disabled', !kljuc1);
    if (lblOdl) lblOdl.classList.toggle('kontrola-labela--disabled', !kljuc1);
    updateUpisiButton();
  }

  /* Gumb „Upiši" (Izmjeni/Izbriši nema u ovoj formi). Pojavljuje se prema tipu izlaska:
     - ključ 1 (prelazak): kad je upisan ispravan Datum izlaska I odabrana Loža u koju odlazi.
     - ključ 2 (izlazak/pokrivanje): dovoljan je ispravan Datum izlaska.
     - ostali ključevi: (definirat ćemo naknadno) — zasad skriven. */
  function updateUpisiButton() {
    var btn = document.getElementById('btnUpisi');
    if (!btn) return;
    var vidljivo = false;
    if (_tabEnabled) {
      var kljuc = tipIzlaskaKljuc();
      var dv = editDatumIzlaska ? editDatumIzlaska.value : '';
      var datumOk = dv !== '' && !isNaN(new Date(dv).getTime());
      if (kljuc === '1') {
        var lozaOk = selectLozaOdlazi && selectLozaOdlazi.value !== '';
        vidljivo = !!(datumOk && lozaOk);
      } else if (kljuc === '2') {
        vidljivo = datumOk;
      }
    }
    btn.style.display = vidljivo ? '' : 'none';
  }

  /* Popis svih loža → napušta (RO, cijeli popis) + spremi za filtriranje odlazne lože. */
  function loadLoze() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_Promjena_Loze_Izlazak_CRUD_loze.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') { try { arr = JSON.parse(text) || []; } catch (e) { arr = []; } }
      _lozeSve = arr;
      if (selectLozaNapusta) popuniSelectIzKeša(selectLozaNapusta, arr, '—', 'select_loza_napusta');
      popuniOdlaziLoze();
    };
    xhr.send();
  }

  /* „Loža u koju odlazi": samo lože istog id_tip_loze kao izvorna (napušta) loža. */
  function popuniOdlaziLoze() {
    if (!selectLozaOdlazi) return;
    var srcId = selectLozaNapusta ? String(selectLozaNapusta.value || '') : '';
    var srcTip = null;
    for (var i = 0; i < _lozeSve.length; i++) {
      if (String(_lozeSve[i].id) === srcId) { srcTip = _lozeSve[i].id_tip_loze; break; }
    }
    var filtrirane = [];
    if (srcTip != null && String(srcTip) !== '') {
      for (var j = 0; j < _lozeSve.length; j++) {
        /* Isti tip lože, ali NE i sama izvorna (napušta) loža. */
        if (String(_lozeSve[j].id_tip_loze) === String(srcTip) && String(_lozeSve[j].id) !== srcId) filtrirane.push(_lozeSve[j]);
      }
    }
    popuniSelectIzKeša(selectLozaOdlazi, filtrirane, '— Odaberi ložu —', 'select_loza_odlazi');
  }

  /* Enable/disable cijele tab kontrole. Kad je tab DISABLED, sve kontrole u tabu (uklj. RO) i sve
     labele su disabled. Kad je ENABLED: uredive kontrole rade; RO ostaju RO (datum ulaska readonly,
     loža koja se napušta uvijek disabled = prikaz vrijednosti), labele normalne. */
  function setTabEnabled(enabled) {
    _tabEnabled = enabled;
    /* Kartica Tab 1 („Promjena Lože - izlazak") ovisi o selekciji člana; Tab 2 kartica se vodi po loži (updateEnabledState). */
    var cplKart0 = document.getElementById('cplTabKart0');
    if (cplKart0) cplKart0.disabled = !enabled;
    if (editDatumUlaska) editDatumUlaska.disabled = !enabled;   /* RO (readonly); disable samo kad je tab disabled */
    if (editDatumIzlaska) editDatumIzlaska.disabled = !enabled;
    if (selectIzlazakTip) { selectIzlazakTip.disabled = !enabled; refreshSelect('select_izlazak_tip'); }
    if (editNapomena) editNapomena.disabled = !enabled;
    /* Sve labele Tab 1 prate stanje (disabled kad je tab disabled). */
    var panel = document.getElementById('cplTabPanel0');
    if (panel) {
      var labels = panel.querySelectorAll('.kontrola-labela');
      for (var j = 0; j < labels.length; j++) labels[j].classList.toggle('kontrola-labela--disabled', !enabled);
    }
    /* Loža selekti ovise o tabu I ključu odabranog tipa (samo ključ 1 = prelazak → enabled). */
    updateLozaSelekti();
  }

  /* Očisti polja Tab 1 (bez selekcije / nakon akcije). */
  function clearTabFields() {
    if (editDatumUlaska) editDatumUlaska.value = '';
    if (editDatumIzlaska) editDatumIzlaska.value = '';
    if (selectIzlazakTip) { selectIzlazakTip.value = ''; refreshSelect('select_izlazak_tip'); }
    if (selectLozaNapusta) { selectLozaNapusta.value = ''; refreshSelect('select_loza_napusta'); }
    popuniOdlaziLoze(); /* izvor prazan → odlazna loža prazna */
    if (editNapomena) editNapomena.value = '';
  }

  /* ===== Logo lože u zaglavlju tablice (Loze_CRUD_slika.php) ===== */
  function updateTablicaHeaderLogo() {
    var img = document.getElementById('cpl_loza_logo');
    var frame = img && img.closest ? img.closest('.clanovi-loza-crud__tablica-header-logo-frame') : null;
    if (!img || !frame) return;
    var idLoza = selectLoza ? trim(selectLoza.value) : '';
    var ph = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.onload = null; img.onerror = null;
    if (!idLoza) {
      img.hidden = true; img.src = ph;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      return;
    }
    frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    img.hidden = true;
    img.onload = function () {
      if (img.naturalWidth > 0) { img.hidden = false; frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno'); }
      else { img.hidden = true; frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno'); }
    };
    img.onerror = function () { img.hidden = true; img.src = ph; frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno'); };
    img.src = API_BASE + 'Loze_CRUD_slika.php?id=' + encodeURIComponent(idLoza) + '&t=' + String(Date.now());
  }
  function updateNaslovLozu() { updateTablicaHeaderLogo(); }

  /* ===== Enable stanje ===== */
  function updateEnabledState() {
    var imaLozu = selectLoza && trim(selectLoza.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;

    var tableWrap = document.getElementById('tablicaContainer');
    tableWrap = tableWrap && tableWrap.closest ? tableWrap.closest('.kontrola-tablica') : null;
    if (tableWrap) tableWrap.classList.toggle('kontrola-tablica--disabled', !imaLozu);

    if (editPanel) editPanel.classList.toggle('kontrola-panel--edit-disabled', !imaSelekciju);

    var traziWrap = document.getElementById('cpl_trazi');
    traziWrap = traziWrap && traziWrap.closest ? traziWrap.closest('.kontrola-edit-delete') : null;
    if (traziWrap && typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(traziWrap, imaLozu);

    if (selectLoza) selectLoza.disabled = _geoAutoLockedLoza || !(selectRegija && trim(selectRegija.value) !== '');
    if (typeof KontroleRefreshCustomSelect === 'function' && selectLoza) KontroleRefreshCustomSelect('select_loza');
    if (btnReloadTablica) btnReloadTablica.disabled = !imaLozu;
    /* Tab 2 („Zapisi") kartica: enable čim je odabrana loža (neovisno o selekciji člana). */
    var cplKart1 = document.getElementById('cplTabKart1');
    if (cplKart1) cplKart1.disabled = !imaLozu;
    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) btnPovratak.disabled = false;
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearTabFields();
      setTabEnabled(false);
    } else {
      var found = null;
      for (var i = 0; i < data.length; i++) { if (String(data[i].id) === String(id)) { found = data[i]; break; } }
      if (found) {
        /* RO: datum ulaska + loža koja se napušta (iz clanovi). */
        if (editDatumUlaska) editDatumUlaska.value = found.datum_ulaska_lozu != null ? found.datum_ulaska_lozu : '';
        if (selectLozaNapusta) { selectLozaNapusta.value = (found.loza != null && found.loza !== '') ? String(found.loza) : ''; refreshSelect('select_loza_napusta'); }
        /* Novi izlazak: datum izlaska / tip / loža odlaska kreću prazni. */
        if (editDatumIzlaska) editDatumIzlaska.value = '';
        if (selectIzlazakTip) { selectIzlazakTip.value = ''; refreshSelect('select_izlazak_tip'); }
        /* Odlazna loža: filtriraj po tipu izvorne (napušta) lože; kreće prazna. */
        popuniOdlaziLoze();
        if (editNapomena) editNapomena.value = '';
      }
      setTabEnabled(true);
      /* Promjena selekcije: tab kontrola na prvi tab. */
      var cplTab = document.getElementById('cplTab');
      if (cplTab && typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(cplTab, 0);
    }
    updateEnabledState();
  };

  /* ===== Tablica: punjenje + filter ===== */
  function podaciURedove(arr) {
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      var jeKandidat = parseInt(r.kandidat, 10) === 1;
      var stupanjShow = jeKandidat ? 'K' : (r.stupanj_show != null ? String(r.stupanj_show) + '°' : '');
      rows.push({
        id: r.id != null ? r.id : '',
        0: r.prezime != null ? r.prezime : '',
        1: r.ime != null ? r.ime : '',
        2: stupanjShow
      });
    }
    return rows;
  }
  function primijeniTrazi(lista) {
    var el = document.getElementById('cpl_trazi');
    var q = el ? trim(el.value).toLowerCase() : '';
    if (!q) return lista.slice();
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      var st = r.stupanj_show != null ? String(r.stupanj_show) : '';
      var hay = ((r.prezime || '') + ' ' + (r.ime || '') + ' ' + st).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(r);
    }
    return out;
  }
  function osvjeziPrikazTablice() {
    var rows = podaciURedove(primijeniTrazi(data));
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PromjenaLozeCRUD.Tablica_Zaglavlje);
  }
  function ucitajClanove(idLoza, cb) {
    data = [];
    if (!idLoza) {
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], PromjenaLozeCRUD.Tablica_Zaglavlje);
      if (cb) cb(); return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_CRUD_sve.php?id_loza=' + encodeURIComponent(idLoza), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      data = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text) || [];
          for (var i = 0; i < arr.length; i++) {
            /* Samo aktivni članovi: aktivnost=1 i nije kandidat (kandidat≠1). */
            if (parseInt(arr[i].aktivnost, 10) === 1 && parseInt(arr[i].kandidat, 10) !== 1) data.push(arr[i]);
          }
        } catch (e) { data = []; }
      }
      osvjeziPrikazTablice();
      if (cb) cb();
    };
    xhr.send();
  }
  function osvjeziTablicu(cb) {
    ucitajClanove(selectLoza ? trim(selectLoza.value) : '', function () { updateEnabledState(); loadZapisi(); if (cb) cb(); });
  }

  /* ===== GEO (Država/Regija/Loža) — uzor Kandidat_Dokumenti_CRUD ===== */
  function popuniSelectIzKeša(sel, arr, placeholder, kontrolaId) {
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = placeholder; sel.appendChild(opt0);
    for (var i = 0; i < arr.length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? String(arr[i].id) : '';
      opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
      sel.appendChild(opt);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) KontroleRefreshCustomSelect(kontrolaId);
  }
  function ucitajPravaGeo(callback) {
    var url = typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
      ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Clanovi_Promjena_Loze_Izlazak_CRUD.html')
      : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') + '?html_fajl=' + encodeURIComponent('Clanovi_Promjena_Loze_Izlazak_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = g.drzave || [];
      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');
      _pravaCrudUpis = g.upis_izmjena != null ? parseInt(g.upis_izmjena, 10) : 0;
      _pravaCrudBrisanje = g.brisanje_sloga != null ? parseInt(g.brisanje_sloga, 10) : 0;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(_pravaCrudUpis, _pravaCrudBrisanje);
      if (drz.length === 1 && selectDrzava) {
        selectDrzava.value = String(drz[0].id); selectDrzava.disabled = true; _geoAutoLockedDrzava = true;
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        popuniRegijeIzKeša(selectDrzava.value, callback);
      } else {
        _geoAutoLockedDrzava = false;
        if (selectDrzava) selectDrzava.disabled = false;
        popuniRegijeIzKeša('', function () {});
        if (callback) callback();
      }
    });
  }
  function popuniRegijeIzKeša(idDrzava, callback) {
    _geoAutoLockedRegija = false;
    if (!selectRegija) { if (callback) callback(); return; }
    if (!idDrzava) {
      popuniSelectIzKeša(selectRegija, [], '— Odaberi regiju —', 'select_regija');
      selectRegija.disabled = true;
      popuniLozeIzKeša('', function () {});
      if (callback) callback(); return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var f = typeof window.vnlhGeoFiltrirajRegijePoDrzavi === 'function' ? window.vnlhGeoFiltrirajRegijePoDrzavi(g.regije, idDrzava) : [];
    popuniSelectIzKeša(selectRegija, f, '— Odaberi regiju —', 'select_regija');
    if (f.length === 1) {
      selectRegija.value = String(f[0].id); selectRegija.disabled = true; _geoAutoLockedRegija = true;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_regija');
      popuniLozeIzKeša(selectRegija.value, callback);
    } else {
      selectRegija.disabled = (f.length === 0);
      popuniLozeIzKeša('', function () {});
      if (callback) callback();
    }
  }
  function popuniLozeIzKeša(idRegija, callback) {
    _geoAutoLockedLoza = false;
    if (!selectLoza) { if (callback) callback(); return; }
    if (!idRegija) {
      popuniSelectIzKeša(selectLoza, [], '— Odaberi ložu —', 'select_loza');
      selectLoza.disabled = true; data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], PromjenaLozeCRUD.Tablica_Zaglavlje);
      if (callback) callback(); return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var f = typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function' ? window.vnlhGeoFiltrirajLozePoRegiji(g.loze, idRegija) : [];
    popuniSelectIzKeša(selectLoza, f, '— Odaberi ložu —', 'select_loza');
    if (f.length === 1) {
      selectLoza.value = String(f[0].id); selectLoza.disabled = true; _geoAutoLockedLoza = true;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
      osvjeziTablicu(function () { updateNaslovLozu(); updateEnabledState(); if (callback) callback(); });
    } else {
      selectLoza.disabled = (f.length === 0); data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], PromjenaLozeCRUD.Tablica_Zaglavlje);
      updateNaslovLozu();
      if (callback) callback();
    }
  }

  /* ===== Event wiring ===== */
  if (selectDrzava) selectDrzava.addEventListener('change', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    popuniRegijeIzKeša(trim(this.value), function () { updateEnabledState(); });
  });
  if (selectRegija) selectRegija.addEventListener('change', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    popuniLozeIzKeša(trim(this.value), function () { updateEnabledState(); });
  });
  if (selectLoza) selectLoza.addEventListener('change', function () {
    var tz = document.getElementById('cpl_trazi'); if (tz) tz.value = '';
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    updateNaslovLozu();
    osvjeziTablicu();
    updateEnabledState();
  });
  if (btnReloadTablica) btnReloadTablica.addEventListener('click', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    osvjeziTablicu();
  });
  /* Promjena tipa izlaska → osvježi loža selekte (enabled samo na ključ 1) + gumb Upiši. */
  if (selectIzlazakTip) selectIzlazakTip.addEventListener('change', updateLozaSelekti);
  /* Datum izlaska / loža odlaska → osvježi pojavljivanje gumba Upiši. */
  if (editDatumIzlaska) {
    editDatumIzlaska.addEventListener('input', updateUpisiButton);
    editDatumIzlaska.addEventListener('change', updateUpisiButton);
  }
  if (selectLozaOdlazi) selectLozaOdlazi.addEventListener('change', updateUpisiButton);
  /* Otvaranje Tab 2 („Zapisi") → osvježi/prerenderaj tablicu zapisa (i za slučaj hidden-inita). */
  (function () {
    var kart1 = document.getElementById('cplTabKart1');
    if (kart1) kart1.addEventListener('click', loadZapisi);
  })();

  /* Klik „Upiši" — postupak ovisi o ključu (za sada ključ 1 = promjena lože). */
  (function () {
    var btnUpisi = document.getElementById('btnUpisi');
    if (!btnUpisi) return;
    btnUpisi.addEventListener('click', function () {
      if (btnUpisi.style.display === 'none') return;         /* skriven = uvjeti nisu zadovoljeni */
      var idClan = getSelectedRowId();
      if (idClan == null) return;
      var params = {
        id_clan: String(idClan),
        kljuc: tipIzlaskaKljuc(),
        id_izlazak_tip: selectIzlazakTip ? selectIzlazakTip.value : '',
        id_loza_odlaska: selectLozaNapusta ? selectLozaNapusta.value : '',   /* loža iz koje izlazi */
        id_loza_dolaska: selectLozaOdlazi ? selectLozaOdlazi.value : '',     /* loža u koju odlazi */
        datum_ulaska: editDatumUlaska ? editDatumUlaska.value : '',
        datum_izlaska: editDatumIzlaska ? editDatumIzlaska.value : '',
        napomena: editNapomena ? editNapomena.value : ''
      };
      postFormData(API_BASE + 'Clanovi_Promjena_Loze_Izlazak_CRUD_upis.php', params, function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          poruka('001', [], function () {
            /* Čišćenje + povratak na prvi tab + uklanjanje selekcije + refresh tablice. */
            if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();  /* → clearTabFields + setTabEnabled(false) */
            var cplTab = document.getElementById('cplTab');
            if (cplTab && typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(cplTab, 0);
            osvjeziTablicu();   /* osvježi listu članova + Tab 2 zapise */
          });
        } else {
          var p = parseResponseCode(res);
          poruka(p ? p.code : '200', p ? p.replacements : []);
        }
      });
    });
  })();
  (function () {
    var inp = document.getElementById('cpl_trazi');
    if (!inp) return;
    var deb = null;
    inp.addEventListener('input', function () {
      if (deb) clearTimeout(deb);
      deb = setTimeout(function () {
        deb = null;
        osvjeziPrikazTablice();
        var sid = getSelectedRowId();
        if (sid != null && tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function') tablicaApi.setSelectedRowIds([String(sid)]);
      }, 200);
    });
    var wrap = inp.closest('.kontrola-edit-delete');
    if (wrap) wrap.addEventListener('kontrole-edit-delete-clear', function () { osvjeziPrikazTablice(); });
  })();

  /* Povratak */
  var btnPovratak = document.getElementById('btnPovratak');
  if (btnPovratak) btnPovratak.addEventListener('click', function () {
    var params = new URLSearchParams(window.location.search);
    var ref = (params.get('ref') || '').trim();
    if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
    if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e) {} }
    window.location.href = new URL('Meni.php', window.location.href).href;
  });

  /* ===== Logo lože: 1:1 kvadrat koji ispuni visinu zaglavlja (uzor Clanovi_Loza_CRUD) ===== */
  var _logoSizeRaf = null;
  function syncTablicaHeaderLogoSize() {
    if (_logoSizeRaf) cancelAnimationFrame(_logoSizeRaf);
    _logoSizeRaf = requestAnimationFrame(function () {
      _logoSizeRaf = null;
      var header = document.querySelector('.clanovi-loza-crud__tablica-header');
      var kontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      var wrap = document.querySelector('.clanovi-loza-crud__tablica-header-logo-wrap');
      if (!header || !kontrole || !wrap) return;
      if (getComputedStyle(wrap).display === 'none') { header.style.removeProperty('--clanovi-loza-logo-side'); return; }
      var h = kontrole.getBoundingClientRect().height;
      if (!(h > 0) || !isFinite(h)) return;
      var csH = getComputedStyle(header);
      var pt = parseFloat(csH.paddingTop) || 0;
      var pb = parseFloat(csH.paddingBottom) || 0;
      var side = Math.floor(pt + h + pb - 2);
      if (side < 1) return;
      var hw = header.getBoundingClientRect().width;
      if (hw > 0 && isFinite(hw)) {
        var maxByHeader = Math.floor(hw * 0.52);
        if (maxByHeader > 0) side = Math.min(side, maxByHeader);
      }
      header.style.setProperty('--clanovi-loza-logo-side', side + 'px');
    });
  }

  /* ===== Init ===== */
  function initForma() {
    /* Tab kontrola (2 taba) + početni tab. */
    var cplTab = document.getElementById('cplTab');
    if (cplTab && typeof KontroleTabInit === 'function') KontroleTabInit(cplTab);
    if (cplTab && typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(cplTab, 0);
    /* Punjenje selekata Tab 1 (jednom) + zapisa Tab 2. */
    loadTipoviIzlaska();
    loadLoze();
    loadZapisi();
    /* Bez selekcije na startu → tab kontrola disable. */
    setTabEnabled(false);

    updateNaslovLozu();
    ucitajPravaGeo(function () {
      updateNaslovLozu();
      updateEnabledState();
      syncTablicaHeaderLogoSize();
    });
    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza) selectLoza.disabled = true;
    data = [];
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], PromjenaLozeCRUD.Tablica_Zaglavlje);
    updateEnabledState();

    syncTablicaHeaderLogoSize();
    if (typeof ResizeObserver !== 'undefined') {
      var headerKontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      if (headerKontrole) {
        try { new ResizeObserver(function () { syncTablicaHeaderLogoSize(); }).observe(headerKontrole); } catch (e) {}
      }
    }
    window.addEventListener('resize', function () { syncTablicaHeaderLogoSize(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initForma);
  else initForma();
})();
