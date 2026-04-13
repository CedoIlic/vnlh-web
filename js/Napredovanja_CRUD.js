/* =====================================================
   Napredovanja_CRUD.js
   Panel tablice s Država + reload, red Pronađi + edit. Panel panel_stupnjevi: tablica St., Naziv stupnja, Datum; CRUD tipke.
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';
  var DEBUG = false;
  function log(msg) { if (DEBUG && typeof console !== 'undefined' && console.log) console.log('[Napredovanja]', msg); }

  var API_BASE = '../php/';
  var data = [];
  log('script start');

  function getApiUrl(path) {
    var p = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + p + '/php/' + path;
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /** Parsira odgovor API-ja: "OK" ili prazan → null; "kod" ili "kod,replacement" → { code, replacements }. */
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /** Formatira datum za prikaz u tablici (lokalni format). val = YYYY-MM-DD ili sl.; prazan string ako nevaljan ili prazan. */
  function formatDatumZaPrikaz(val) {
    if (val == null || String(val).trim() === '') return '';
    var s = String(val).trim();
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /** Vraća stanku (ms) prije primjene filtra Pronađi – token iz 0-Common.css (--filter_pronadji_stanka_ms). */
  function getFilterPronadjiStankaMs() {
    try {
      var v = document.documentElement && getComputedStyle(document.documentElement).getPropertyValue('--filter_pronadji_stanka_ms');
      if (v != null && v !== '') {
        var n = parseInt(String(v).trim(), 10);
        if (!isNaN(n) && n >= 0) return n;
      }
    } catch (e) {}
    return 1000;
  }

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
  //
  /* Prva tablica (članovi po loži) – Prezime, Ime, St. (bez Spol) */
  var NapredovanjaCRUD_Tablica1 = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'napredovanja-crud',
    Tablica_Zaglavlje: [
      { key: 'prezime', title: 'Prezime', SQL_Naziv: 'prezime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'ime', title: 'Ime', SQL_Naziv: 'ime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stupanj', title: 'St.', SQL_Naziv: 'stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 60, suffix: '°', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  /* Druga tablica (stupnjevi) – St., Naziv stupnja, Datum; ni jedna sortabilna */
  var NapredovanjaCRUD_Stupnjevi = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'napredovanja-crud',
    Tablica_Zaglavlje: [
      { key: 'stupanj', title: 'St.', SQL_Naziv: 'stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 60, suffix: '°', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'naziv', title: 'Naziv stupnja', SQL_Naziv: 'naziv', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'datum', title: 'Datum', SQL_Naziv: 'datum', sortable: 0, sortable_icon: 0, type: 'd', width: 150, suffix: '', align: 'R', row_align: 'R', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var tablicaStupnjeviApi = null;
  var selectDrzava = document.getElementById('select_drzava');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var labelPronadi = document.getElementById('label_pronadi');
  var editPronadi = document.getElementById('edit_pronadi');
  var tablicaContainerEl = document.getElementById('tablicaContainer');
  var tablicaStupnjeviContainerEl = document.getElementById('tablicaStupnjeviContainer');
  var editPanel = document.getElementById('edit_panel');
  var editSt = document.getElementById('edit_st');
  var selectIzborStupnja = document.getElementById('select_izbor_stupnja');
  var selectTipNapredovanja = document.getElementById('select_tip_napredovanja');
  var editDatumStEl = document.getElementById('edit_datum_st');
  var selectLozaNapredovanja = document.getElementById('select_loza_napredovanja');
  var editImeLoze = document.getElementById('edit_ime_loze');
  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  var btnPovratak = document.getElementById('btnPovratak');

  CommonCRUD.initTablica('tablicaContainer', NapredovanjaCRUD_Tablica1, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { updateEditAndStupnjeviState(); },
    syncHeaderOnChange: true
  });

  CommonCRUD.initTablica('tablicaStupnjeviContainer', NapredovanjaCRUD_Stupnjevi, {
    getRowId: function (row, index) { return (row && row.id != null) ? row.id : (row && row.length > 0 ? row[0] : index); },
    onReady: function (api) { tablicaStupnjeviApi = api; },
    onSelectionChange: function () { updateEditAndStupnjeviState(); },
    syncHeaderOnChange: true
  });
  log('initTablica done');

  /* =========================================================================
   * ▒▒ BLOK: PRAVA GEO ▒▒
   * Dohvat dozvoljenih država iz Duznosnici_Drzave_Regije_Loze_sve.php.
   * Jedan fetch vraća dozvoljene države (+ upis_izmjena / brisanje_sloga).
   * Regije i lože iz odgovora se ignoriraju jer forma ima samo select država.
   * Auto-lock: 1 država → auto-select + disabled + auto-locked CSS klasa.
   * ========================================================================= */

  var _geoAutoLockedDrzava = false;

  /** Postavi/makni CSS klasu kontrola-select--auto-locked na wrapperu oko <select>. */
  function setAutoLockedClass(selectEl, locked) {
    if (!selectEl) return;
    var wrapper = selectEl.closest ? selectEl.closest('.kontrola-select') : null;
    if (!wrapper) return;
    if (locked) wrapper.classList.add('kontrola-select--auto-locked');
    else wrapper.classList.remove('kontrola-select--auto-locked');
  }

  /** Punjenje selekta država iz niza dozvoljenih { id, naziv }. "Sve države" ako >1. */
  function popuniSelectDrzave(arr) {
    if (!selectDrzava) return;
    while (selectDrzava.firstChild) selectDrzava.removeChild(selectDrzava.firstChild);
    var opt0 = document.createElement('option');
    opt0.value = ''; opt0.textContent = '— Odaberi državu —';
    selectDrzava.appendChild(opt0);

    if (arr && arr.length > 1) {
      var optSve = document.createElement('option');
      optSve.value = 'sve'; optSve.textContent = 'Sve države';
      selectDrzava.appendChild(optSve);
    }
    for (var j = 0; j < (arr ? arr.length : 0); j++) {
      var o = arr[j];
      var opt = document.createElement('option');
      opt.value = o.id != null ? String(o.id) : '';
      opt.textContent = o.naziv != null ? o.naziv : '';
      selectDrzava.appendChild(opt);
    }
    log('popuniSelectDrzave: before KontroleRefreshCustomSelect select_drzava');
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
    log('popuniSelectDrzave: after KontroleRefreshCustomSelect');
  }

  /**
   * Dohvat dozvoljenih država (+ CRUD zastavica) s Duznosnici_Drzave_Regije_Loze_sve.php.
   * Popuni select, auto-lock ako 1 država, primijeni CRUD prava na tipke.
   * @param {Function} callback – poziva se nakon inicijalne populacije i auto-selecta
   */
  function ucitajPravaGeo(callback) {
    log('ucitajPravaGeo: start');
    if (!selectDrzava) { if (callback) callback(); return; }

    var url = getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') + '?html_fajl=' + encodeURIComponent('Napredovanja_CRUD.html');
    // Proslijedi id_duznosnik_test ako postoji (Alati_Meni_Test)
    try {
      var sp = new URLSearchParams(window.location.search);
      var idt = sp.get('id_duznosnik_test');
      if (idt && parseInt(idt, 10) > 0) url += '&id_duznosnik_test=' + encodeURIComponent(idt);
    } catch (e) {}

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      log('ucitajPravaGeo: xhr done');
      var text = (xhr.responseText || '').trim();
      var obj = null;
      if (text !== '' && text.charAt(0) === '{') {
        try { obj = JSON.parse(text); } catch (e) {}
      }
      if (!obj) obj = { drzave: [], regije: [], loze: [], upis_izmjena: 0, brisanje_sloga: 0 };

      var drzave = obj.drzave || [];

      // Popuni select država iz geo odgovora (već filtrirane po pravima dužnosnika)
      popuniSelectDrzave(drzave);

      // Primijeni CRUD prava na tipke (globalna iz 0-Common.js)
      if (typeof vnlhPrimijeniPravaCrud === 'function') {
        vnlhPrimijeniPravaCrud(obj.upis_izmjena, obj.brisanje_sloga);
      }

      // Auto-lock: ako je točno 1 država, odaberi je i zaključaj select
      _geoAutoLockedDrzava = false;
      if (drzave.length === 1) {
        selectDrzava.value = String(drzave[0].id);
        selectDrzava.disabled = true;
        _geoAutoLockedDrzava = true;
        setAutoLockedClass(selectDrzava, true);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        // Pokreni change da se osvježi tablica
        selectDrzava.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (drzave.length > 1) {
        selectDrzava.disabled = false;
        setAutoLockedClass(selectDrzava, false);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
      } else {
        // 0 država — potpuno ograničen
        selectDrzava.disabled = true;
        setAutoLockedClass(selectDrzava, false);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
      }

      log('ucitajPravaGeo: before callback');
      if (callback) callback();
      log('ucitajPravaGeo: after callback');
    };
    xhr.send();
  }

  /* =========================================================================
   * ▒▒ KRAJ BLOKA: PRAVA GEO ▒▒
   * ========================================================================= */

  function updateEnabledState() {
    var imaDrzavu = selectDrzava && trim(selectDrzava.value) !== '';
    if (labelPronadi) {
      labelPronadi.disabled = !imaDrzavu;
      labelPronadi.classList.toggle('kontrola-labela--disabled', !imaDrzavu);
    }
    if (editPronadi) editPronadi.disabled = !imaDrzavu;
    var pronadiEditDeleteWrap = editPronadi && editPronadi.closest ? editPronadi.closest('.kontrola-edit-delete') : null;
    if (pronadiEditDeleteWrap) pronadiEditDeleteWrap.classList.toggle('kontrola-edit-delete--disabled', !imaDrzavu);
    if (btnReloadTablica) btnReloadTablica.disabled = !imaDrzavu;
    if (tablicaContainerEl) {
      if (imaDrzavu) tablicaContainerEl.classList.remove('kontrola-tablica--disabled');
      else tablicaContainerEl.classList.add('kontrola-tablica--disabled');
    }
  }

  /** Puni select Loža napredovanja: placeholder "— Loža napredovanja —", zatim "Neka druga loža" (value 0), zatim loze za id_drzava. Ako param prazan, samo placeholder i "Neka druga loža". */
  function popuniSelektLozaNapredovanja(param, done) {
    if (!selectLozaNapredovanja) { if (done) done(); return; }
    while (selectLozaNapredovanja.firstChild) selectLozaNapredovanja.removeChild(selectLozaNapredovanja.firstChild);
    var optPlaceholder = document.createElement('option');
    optPlaceholder.value = '';
    optPlaceholder.textContent = '— Loža napredovanja —';
    selectLozaNapredovanja.appendChild(optPlaceholder);
    var optDruga = document.createElement('option');
    optDruga.value = '0';
    optDruga.textContent = 'Neka druga loža';
    selectLozaNapredovanja.appendChild(optDruga);
    if (param === '' || param == null) {
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza_napredovanja');
      syncEditImeLozeState();
      if (done) done();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Loze_CRUD_sve_drzava.php') + '?id_drzava=' + encodeURIComponent(param), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var arr = [];
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { arr = JSON.parse(text); } catch (e) {}
      }
      for (var i = 0; i < arr.length; i++) {
        var o = arr[i];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = o.naziv != null ? o.naziv : '';
        selectLozaNapredovanja.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza_napredovanja');
      syncEditImeLozeState();
      if (done) done();
    };
    xhr.send();
  }

  /** Puni edit panel podacima odabranog napredovanja (red u desnoj tablici). row = objekt s id_stupanj, id_tip_napredovanja, id_loza_napredovanja, datum_napredovanja, loza_napredovanja, stupanj, naziv. */
  function popuniEditPanelIzNapredovanja(row) {
    if (!row) return;
    if (editSt) editSt.value = row.stupanj != null ? String(row.stupanj) + '\u00B0' : '';
    if (selectIzborStupnja) selectIzborStupnja.value = row.id_stupanj != null && row.id_stupanj !== '' ? String(row.id_stupanj) : '';
    if (selectTipNapredovanja) selectTipNapredovanja.value = row.id_tip_napredovanja != null && row.id_tip_napredovanja !== '' ? String(row.id_tip_napredovanja) : '';
    if (editDatumStEl) {
      editDatumStEl.value = row.datum_napredovanja != null && row.datum_napredovanja !== '' ? String(row.datum_napredovanja) : '';
      syncDatumStEmptyClass(editDatumStEl);
    }
    if (selectLozaNapredovanja) {
      selectLozaNapredovanja.value = (row.id_loza_napredovanja != null && row.id_loza_napredovanja !== '') ? String(row.id_loza_napredovanja) : '0';
    }
    if (editImeLoze) editImeLoze.value = row.loza_napredovanja != null ? String(row.loza_napredovanja) : '';
    syncEditImeLozeState();
    if (typeof KontroleRefreshCustomSelect === 'function') {
      if (selectIzborStupnja) KontroleRefreshCustomSelect('select_izbor_stupnja');
      if (selectTipNapredovanja) KontroleRefreshCustomSelect('select_tip_napredovanja');
      if (selectLozaNapredovanja) KontroleRefreshCustomSelect('select_loza_napredovanja');
    }
  }

  /** Briše vrijednosti edit panela za napredovanje (ne dira ostale kontrole). */
  function ocistiEditPanelNapredovanja() {
    log('ocistiEditPanelNapredovanja: start');
    if (editSt) editSt.value = '';
    if (selectIzborStupnja) selectIzborStupnja.value = '';
    if (selectTipNapredovanja) selectTipNapredovanja.value = '';
    if (editDatumStEl) { editDatumStEl.value = ''; syncDatumStEmptyClass(editDatumStEl); }
    if (selectLozaNapredovanja) selectLozaNapredovanja.value = '';
    if (editImeLoze) editImeLoze.value = '';
    syncEditImeLozeState();
    if (typeof KontroleRefreshCustomSelect === 'function') {
      log('ocistiEditPanelNapredovanja: before KontroleRefreshCustomSelect');
      if (selectIzborStupnja) KontroleRefreshCustomSelect('select_izbor_stupnja');
      if (selectTipNapredovanja) KontroleRefreshCustomSelect('select_tip_napredovanja');
      if (selectLozaNapredovanja) KontroleRefreshCustomSelect('select_loza_napredovanja');
      log('ocistiEditPanelNapredovanja: after KontroleRefreshCustomSelect');
    }
    log('ocistiEditPanelNapredovanja: end');
  }

  /** edit_ime_loze: enabled samo kad je u selectu Loža napredovanja izabrana "Neka druga loža" (value 0); inače obriši sadržaj i disable. */
  function syncEditImeLozeState() {
    if (!editImeLoze || !selectLozaNapredovanja) return;
    var jeNekaDruga = selectLozaNapredovanja.value === '0';
    editImeLoze.disabled = !jeNekaDruga;
    if (!jeNekaDruga) editImeLoze.value = '';
    var labelImeLoze = editImeLoze.id ? document.querySelector('label[for="' + editImeLoze.id + '"]') : null;
    if (labelImeLoze) {
      labelImeLoze.disabled = !jeNekaDruga;
      labelImeLoze.classList.toggle('kontrola-labela--disabled', !jeNekaDruga);
    }
  }

  /** Puni select Tip napredovanja iz tablice napredovanja_tip (id, naziv). */
  function popuniSelektTipNapredovanja(done) {
    if (!selectTipNapredovanja) { if (done) done(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Napredovanja_Tip_CRUD_sve.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      while (selectTipNapredovanja.firstChild) selectTipNapredovanja.removeChild(selectTipNapredovanja.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Tip napredovanja —';
      selectTipNapredovanja.appendChild(opt0);
      var arr = [];
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { arr = JSON.parse(text); } catch (e) {}
      }
      for (var j = 0; j < arr.length; j++) {
        var o = arr[j];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = o.naziv != null ? o.naziv : '';
        selectTipNapredovanja.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_tip_napredovanja');
      if (done) done();
    };
    xhr.send();
  }

  /** Za odabranog člana (id_clanovi): učitava napredovanja u desnu tablicu (sortirano po stupanj) i puni select Izbor stupnja stupnjevima s id_obred tog člana. */
  function ucitajNapredovanjaIStupnjeveZaClana(idClan, done) {
    if (!idClan || !tablicaStupnjeviApi || !tablicaStupnjeviContainerEl) {
      if (tablicaStupnjeviApi) CommonCRUD.setDataTablica(tablicaStupnjeviApi, 'tablicaStupnjeviContainer', [], NapredovanjaCRUD_Stupnjevi.Tablica_Zaglavlje);
      if (selectIzborStupnja) {
        while (selectIzborStupnja.firstChild) selectIzborStupnja.removeChild(selectIzborStupnja.firstChild);
        var o0 = document.createElement('option');
        o0.value = '';
        o0.textContent = '— Izbor stupnja —';
        selectIzborStupnja.appendChild(o0);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_izbor_stupnja');
      }
      if (done) done();
      return;
    }
    var clan = (data || []).find(function (r) { return String(r.id) === String(idClan); });
    var idObred = (clan && clan.id_obred != null && clan.id_obred !== '') ? clan.id_obred : null;

    var napredovanjaDone = false;
    var stupnjeviDone = false;
    function checkBoth() {
      if (napredovanjaDone && stupnjeviDone && done) done();
    }

    var xhrNap = new XMLHttpRequest();
    xhrNap.open('GET', getApiUrl('Napredovanja_CRUD_sve.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)), true);
    xhrNap.onreadystatechange = function () {
      if (xhrNap.readyState !== 4) return;
      var arr = [];
      var text = (xhrNap.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { arr = JSON.parse(text); } catch (e) {}
      }
      var rows = arr.map(function (r) {
        var datumVal = r.datum_napredovanja != null ? r.datum_napredovanja : (r.datum != null ? r.datum : '');
        var stupanjPrikaz = r.stupanj != null ? String(r.stupanj) : '';
        return {
          id: r.id,
          id_stupanj: r.id_stupanj,
          id_tip_napredovanja: r.id_tip_napredovanja,
          id_loza_napredovanja: r.id_loza_napredovanja,
          datum_napredovanja: datumVal,
          loza_napredovanja: r.loza_napredovanja != null ? r.loza_napredovanja : '',
          stupanj: r.stupanj,
          naziv: r.naziv,
          0: stupanjPrikaz,
          1: r.naziv != null ? r.naziv : '',
          2: formatDatumZaPrikaz(datumVal)
        };
      });
      CommonCRUD.setDataTablica(tablicaStupnjeviApi, 'tablicaStupnjeviContainer', rows, NapredovanjaCRUD_Stupnjevi.Tablica_Zaglavlje);
      if (tablicaStupnjeviApi.clearSelection) tablicaStupnjeviApi.clearSelection();
      napredovanjaDone = true;
      checkBoth();
    };
    xhrNap.send();

    if (!selectIzborStupnja) {
      stupnjeviDone = true;
      checkBoth();
    } else {
      while (selectIzborStupnja.firstChild) selectIzborStupnja.removeChild(selectIzborStupnja.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Izbor stupnja —';
      selectIzborStupnja.appendChild(opt0);
      if (idObred == null || idObred === '') {
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_izbor_stupnja');
        stupnjeviDone = true;
        checkBoth();
      } else {
        var xhrSt = new XMLHttpRequest();
        xhrSt.open('GET', getApiUrl('Stupnjevi_CRUD_sve.php') + '?obred_id=' + encodeURIComponent(String(idObred)), true);
        xhrSt.onreadystatechange = function () {
          if (xhrSt.readyState !== 4) return;
          var arrSt = [];
          var textSt = (xhrSt.responseText || '').trim();
          if (textSt !== '' && textSt.charAt(0) === '[') {
            try { arrSt = JSON.parse(textSt); } catch (e) {}
          }
          for (var j = 0; j < arrSt.length; j++) {
            var o = arrSt[j];
            var opt = document.createElement('option');
            opt.value = o.id != null ? String(o.id) : '';
            opt.textContent = (o.stupanj != null ? String(o.stupanj) + '\u00B0' + ', ' : '') + (o.naziv != null ? o.naziv : '');
            if (o.stupanj != null) opt.dataset.stupanj = String(o.stupanj);
            selectIzborStupnja.appendChild(opt);
          }
          if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_izbor_stupnja');
          stupnjeviDone = true;
          checkBoth();
        };
        xhrSt.send();
      }
    }
  }

  /** Nakon punjenja tablice: puni select Loža napredovanja (sve loze za odabranu državu/e) i Tip napredovanja. Kad oba gotova, poziva callback. */
  function popuniSelektLozeINapredovanjaTip(callback) {
    var idOrIds = getOdabraniIdDrzaveIliSve();
    var param = idOrIds == null ? '' : (Array.isArray(idOrIds) ? idOrIds.join(',') : String(idOrIds));
    var pending = 2;
    function onDone() {
      pending--;
      if (pending === 0 && callback) callback();
    }
    popuniSelektLozaNapredovanja(param, onDone);
    popuniSelektTipNapredovanja(onDone);
  }

  /** idDrzavaOrIds: jedan id (string) ili niz id-eva. Puni tablicu članovima s tim državama (kolona drzava). Nakon toga puni selekte Loža napredovanja i Tip napredovanja. */
  function ucitajClanovePoDrzavi(idDrzavaOrIds, callback) {
    if (!tablicaApi || !tablicaContainerEl) {
      if (callback) callback();
      return;
    }
    var param = Array.isArray(idDrzavaOrIds) ? idDrzavaOrIds.join(',') : (idDrzavaOrIds == null ? '' : String(idDrzavaOrIds));
    if (param === '') {
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Clanovi_CRUD_sve_drzava.php') + '?id_drzava=' + encodeURIComponent(param), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          arr = JSON.parse(text);
        } catch (e) {}
      }
      data = arr;
      primijeniFilterPronadji();
      if (callback) callback();
      /* Odgodi punjenje selekata da preglednik prvo obradi hover/klik i ne blokira; problem je bio nakon dodavanja punjenja selekata. */
      setTimeout(function () {
        popuniSelektLozeINapredovanjaTip(function () { if (callback) callback(); });
      }, 0);
    };
    xhr.send();
  }

  function getOdabraniIdDrzaveIliSve() {
    if (!selectDrzava) return null;
    var val = trim(selectDrzava.value);
    if (!val) return null;
    if (val === 'sve') {
      var ids = [];
      for (var i = 0; i < selectDrzava.options.length; i++) {
        var v = selectDrzava.options[i].value;
        if (v && v !== 'sve') ids.push(v);
      }
      return ids.length ? ids : null;
    }
    return val;
  }

  function osvjeziTablicu() {
    var idOrIds = getOdabraniIdDrzaveIliSve();
    if (!idOrIds) return;
    ucitajClanovePoDrzavi(idOrIds, function () {});
  }

  /** Filtrira tablicu po trenutnom tekstu u "Pronađi": prikazuje samo redove gdje ime ili prezime sadrži tekst (bez obzira na veliku/malu slova). Koristi globalni niz data. */
  function primijeniFilterPronadji() {
    if (!tablicaApi || !tablicaContainerEl) return;
    var txt = editPronadi ? trim(editPronadi.value) : '';
    var list = data || [];
    if (txt !== '') {
      var t = txt.toLowerCase();
      list = list.filter(function (r) {
        var prezime = (r.prezime != null ? String(r.prezime) : '').toLowerCase();
        var ime = (r.ime != null ? String(r.ime) : '').toLowerCase();
        return prezime.indexOf(t) !== -1 || ime.indexOf(t) !== -1;
      });
    }
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      /* stupanj_show = broj stupnja za prikaz (iz join stupnjevi); stupanj = id stupnja – za prikaz koristimo stupanj_show; suffix ° u Tablica_Zaglavlje */
      var stupanjShow = (r.stupanj_show != null && String(r.stupanj_show).trim() !== '' ? String(r.stupanj_show).replace(/\.$/, '') : (r.stupanj != null ? String(r.stupanj) : ''));
      rows.push({ id: r.id != null ? r.id : '', 0: r.prezime != null ? r.prezime : '', 1: r.ime != null ? r.ime : '', 2: stupanjShow });
    }
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, NapredovanjaCRUD_Tablica1.Tablica_Zaglavlje);
  }

  /** Debounce: nakon stanke dužoj od tokena (--filter_pronadji_stanka_ms) primijeni filter po polju Pronađi. */
  var filterPronadjiTimeout = null;
  if (editPronadi) {
    editPronadi.addEventListener('input', function () {
      if (filterPronadjiTimeout) clearTimeout(filterPronadjiTimeout);
      filterPronadjiTimeout = setTimeout(function () {
        filterPronadjiTimeout = null;
        primijeniFilterPronadji();
        updateEditAndStupnjeviState();
      }, getFilterPronadjiStankaMs());
    });
  }

  /** Tipka X u edit-delete Pronađi: briše sadržaj polja i selekciju u tablici, te osvježava prikaz. */
  var pronadiWrap = editPronadi && editPronadi.closest ? editPronadi.closest('.kontrola-edit-delete') : null;
  var pronadiClearBtn = pronadiWrap ? pronadiWrap.querySelector('.kontrola-edit-delete__clear') : null;
  if (pronadiClearBtn) {
    pronadiClearBtn.addEventListener('click', function () {
      if (editPronadi) editPronadi.value = '';
      primijeniFilterPronadji();
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateEditAndStupnjeviState();
    });
  }

  var lastLoadedClanIdForStupnjevi = null;
  var lastHadRightSelection = false;
  var lastSelectedNapredovanjaId = null;

  /** Tablica stupnjevi: enable samo kad postoji selektiran red u prvoj tablici. Pri selekciji u lijevoj tablici puni desnu tablicu napredovanjima i select Izbor stupnja. edit_ime_loze: enable samo za "Neka druga loža". */
  function updateEditAndStupnjeviState() {
    log('updateEditAndStupnjeviState: start');
    var idClan = CommonCRUD.getSelectedRowId(tablicaApi);
    var imaRedTablica1 = idClan != null;
    var imaRedTablicaStupnjevi = CommonCRUD.getSelectedRowId(tablicaStupnjeviApi) != null;

    if (tablicaStupnjeviContainerEl) {
      if (imaRedTablica1) {
        tablicaStupnjeviContainerEl.classList.remove('kontrola-tablica--disabled');
        if (String(idClan) !== String(lastLoadedClanIdForStupnjevi)) {
          lastLoadedClanIdForStupnjevi = idClan;
          lastSelectedNapredovanjaId = null;
          ucitajNapredovanjaIStupnjeveZaClana(idClan, function () {
            ocistiEditPanelNapredovanja();
            if (typeof KontroleRefreshCustomSelect === 'function' && selectIzborStupnja) KontroleRefreshCustomSelect('select_izbor_stupnja');
          });
        }
      } else {
        lastLoadedClanIdForStupnjevi = null;
        tablicaStupnjeviContainerEl.classList.add('kontrola-tablica--disabled');
        if (tablicaStupnjeviApi && typeof tablicaStupnjeviApi.clearSelection === 'function') tablicaStupnjeviApi.clearSelection();
        if (tablicaStupnjeviApi) CommonCRUD.setDataTablica(tablicaStupnjeviApi, 'tablicaStupnjeviContainer', [], NapredovanjaCRUD_Stupnjevi.Tablica_Zaglavlje);
        if (selectIzborStupnja) {
          while (selectIzborStupnja.firstChild) selectIzborStupnja.removeChild(selectIzborStupnja.firstChild);
          var o0 = document.createElement('option');
          o0.value = '';
          o0.textContent = '— Izbor stupnja —';
          selectIzborStupnja.appendChild(o0);
        }
      }
    }

    var editControlsDisabled = !imaRedTablica1;
    var controls = [editSt, selectIzborStupnja, selectTipNapredovanja, editDatumStEl, selectLozaNapredovanja];
    controls.forEach(function (el) {
      if (el) el.disabled = editControlsDisabled;
    });
    /* Upiši/Zamjeni: bez selekcije u desnoj tablici + izabran stupanj → Upiši enabled; ima selekciju u desnoj → Zamjeni (kao Clanovi_CRUD). */
    var imaIzborStupnja = selectIzborStupnja && trim(selectIzborStupnja.value) !== '';
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaRedTablicaStupnjevi);
      btnUpisiLabel.textContent = imaRedTablicaStupnjevi ? 'Zamjeni' : 'Upiši';
      btnUpisi.setAttribute('aria-label', imaRedTablicaStupnjevi ? 'Zamjeni' : 'Upiši');
      btnUpisi.disabled = editControlsDisabled || (!imaRedTablicaStupnjevi && !imaIzborStupnja);
    }
    /* Izbriši: enable samo ako postoji selekcija u desnoj tablici, inače disable. */
    if (btnIzbrisi) btnIzbrisi.disabled = editControlsDisabled || !imaRedTablicaStupnjevi;
    if (btnPovratak) btnPovratak.disabled = false;
    if (imaRedTablicaStupnjevi && tablicaStupnjeviApi && typeof tablicaStupnjeviApi.getData === 'function') {
      var napredovanjaId = CommonCRUD.getSelectedRowId(tablicaStupnjeviApi);
      /* Popuni panel samo kad korisnik odabere drugi red (promjena selekcije), ne pri svakom updateEditAndStupnjeviState – inače prepisujemo korisnikove izmjene u formi. */
      if (String(napredovanjaId) !== String(lastSelectedNapredovanjaId)) {
        lastSelectedNapredovanjaId = napredovanjaId;
        var napredovanjaRows = tablicaStupnjeviApi.getData();
        var napredovanjaRow = napredovanjaRows && napredovanjaId != null ? napredovanjaRows.find(function (r) { return String(r.id) === String(napredovanjaId); }) : null;
        popuniEditPanelIzNapredovanja(napredovanjaRow);
      }
    } else {
      lastSelectedNapredovanjaId = null;
      /* Čisti panel samo kad korisnik odznači red u desnoj tablici (prije je imao selekciju), ne kad samo bira stupanj za upis. */
      if (lastHadRightSelection) ocistiEditPanelNapredovanja();
    }
    lastHadRightSelection = imaRedTablicaStupnjevi;
    syncEditImeLozeState();
    if (editControlsDisabled && editImeLoze) editImeLoze.disabled = true;

    if (editPanel) {
      if (editControlsDisabled) editPanel.classList.add('napredovanja-crud__edit-panel--disabled');
      else editPanel.classList.remove('napredovanja-crud__edit-panel--disabled');
    }
    if (typeof KontroleRefreshCustomSelect === 'function') {
      log('updateEditAndStupnjeviState: before KontroleRefreshCustomSelect x3');
      if (selectIzborStupnja) KontroleRefreshCustomSelect('select_izbor_stupnja');
      if (selectTipNapredovanja) KontroleRefreshCustomSelect('select_tip_napredovanja');
      if (selectLozaNapredovanja) KontroleRefreshCustomSelect('select_loza_napredovanja');
      log('updateEditAndStupnjeviState: after KontroleRefreshCustomSelect x3');
    }
    log('updateEditAndStupnjeviState: end');
  }

  if (selectDrzava) {
    selectDrzava.addEventListener('change', function () {
      if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
      var idOrIds = getOdabraniIdDrzaveIliSve();
      if (idOrIds) {
        ucitajClanovePoDrzavi(idOrIds, function () { updateEditAndStupnjeviState(); });
      } else {
        data = [];
        if (tablicaContainerEl && tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], NapredovanjaCRUD_Tablica1.Tablica_Zaglavlje);
        popuniSelektLozaNapredovanja('', function () { updateEditAndStupnjeviState(); });
      }
      updateEnabledState();
    });
  }

  if (btnReloadTablica) {
    btnReloadTablica.addEventListener('click', function () {
      osvjeziTablicu();
    });
  }

  /** Kad se u Izbor stupnja odabere stupanj, u edit St upiši brojčanu vrijednost + ° i osvježi stanje tipke Upiši/Zamjeni. */
  if (selectIzborStupnja && editSt) {
    selectIzborStupnja.addEventListener('change', function () {
      var opt = selectIzborStupnja.options[selectIzborStupnja.selectedIndex];
      var stupanj = (opt && opt.value !== '' && opt.dataset.stupanj !== undefined) ? opt.dataset.stupanj : '';
      editSt.value = stupanj !== '' ? stupanj + '\u00B0' : '';
      updateEditAndStupnjeviState();
    });
  }

  if (selectLozaNapredovanja) {
    selectLozaNapredovanja.addEventListener('change', function () {
      syncEditImeLozeState();
    });
  }

  /** Zajednička obrada odgovora upisa/izmjene: prikaži poruku, osvježi desnu tablicu, očisti panel i selekciju. */
  function obradiOdgovorUpisIzmjena(res, idClan, uspjehKod) {
    res = (res || '').trim();
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') window.showPorukaModal(uspjehKod, []);
      ucitajNapredovanjaIStupnjeveZaClana(idClan, function () {
        if (tablicaStupnjeviApi && typeof tablicaStupnjeviApi.clearSelection === 'function') tablicaStupnjeviApi.clearSelection();
        ocistiEditPanelNapredovanja();
        updateEditAndStupnjeviState();
      });
    } else {
      var p = parseResponseCode(res);
      if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(p.code, p.replacements || []);
      } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
        window.showPorukaModal('101', []);
      }
    }
  }

  /** Tipka Upiši/Zamjeni: Upiši = validacija + POST upis; Zamjeni = POST izmjena po id napredovanja. */
  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var jeZamjeni = this.classList.contains('kontrola-btn--crud-izmjeni');
      var idClan = CommonCRUD.getSelectedRowId(tablicaApi);
      var idStupanj = selectIzborStupnja ? trim(selectIzborStupnja.value) : '';
      var idTip = selectTipNapredovanja ? trim(selectTipNapredovanja.value) : '';
      var lozaVal = selectLozaNapredovanja ? trim(selectLozaNapredovanja.value) : '';
      var idLozaNapredovanja = (lozaVal === '' || lozaVal === '0') ? '' : lozaVal;
      var lozaNapredovanjaText = (lozaVal === '0' && editImeLoze) ? trim(editImeLoze.value) : '';
      var datumVal = editDatumStEl ? trim(editDatumStEl.value) : '';

      if (jeZamjeni) {
        var napredovanjaId = CommonCRUD.getSelectedRowId(tablicaStupnjeviApi);
        if (!idClan || !napredovanjaId || !idStupanj) return;
        var rowsZ = tablicaStupnjeviApi && typeof tablicaStupnjeviApi.getData === 'function' ? tablicaStupnjeviApi.getData() : [];
        var vecPostojiZ = rowsZ.some(function (r) { return String(r.id_stupanj) === String(idStupanj) && String(r.id) !== String(napredovanjaId); });
        if (vecPostojiZ) {
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['024'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('024', []);
          }
          return;
        }
        var params = {
          id: String(napredovanjaId),
          id_clanovi: String(idClan),
          id_stupanj: String(idStupanj),
          id_tip_napredovanja: String(idTip),
          id_loza_napredovanja: idLozaNapredovanja,
          loza_napredovanja: lozaNapredovanjaText,
          datum_napredovanja: datumVal
        };
        if (typeof window.CommonPostFormData !== 'function') return;
        window.CommonPostFormData(getApiUrl('Napredovanja_CRUD_izmjena.php'), params, function (res) {
          obradiOdgovorUpisIzmjena(res, idClan, '004');
        });
        return;
      }

      /* Upiši mod */
      if (!idClan || !idStupanj) return;
      var rows = tablicaStupnjeviApi && typeof tablicaStupnjeviApi.getData === 'function' ? tablicaStupnjeviApi.getData() : [];
      var vecPostoji = rows.some(function (r) { return String(r.id_stupanj) === String(idStupanj); });
      if (vecPostoji) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['024'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('024', []);
        }
        return;
      }
      var params = {
        id_clanovi: String(idClan),
        id_stupanj: String(idStupanj),
        id_tip_napredovanja: String(idTip),
        id_loza_napredovanja: idLozaNapredovanja,
        loza_napredovanja: lozaNapredovanjaText,
        datum_napredovanja: datumVal
      };
      if (typeof window.CommonPostFormData !== 'function') return;
      window.CommonPostFormData(getApiUrl('Napredovanja_CRUD_upis.php'), params, function (res) {
        obradiOdgovorUpisIzmjena(res, idClan, '001');
      });
    });
  }

  /** Tipka Izbriši: briše napredovanje po id selektiranom u desnoj tablici. */
  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var idClan = CommonCRUD.getSelectedRowId(tablicaApi);
      var napredovanjaId = CommonCRUD.getSelectedRowId(tablicaStupnjeviApi);
      if (!napredovanjaId) return;
      if (typeof window.CommonPostFormData !== 'function') return;
      window.CommonPostFormData(getApiUrl('Napredovanja_CRUD_brisanje.php'), { id: String(napredovanjaId) }, function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', []);
          if (idClan) {
            ucitajNapredovanjaIStupnjeveZaClana(idClan, function () {
              if (tablicaStupnjeviApi && typeof tablicaStupnjeviApi.clearSelection === 'function') tablicaStupnjeviApi.clearSelection();
              ocistiEditPanelNapredovanja();
              updateEditAndStupnjeviState();
            });
          } else {
            ocistiEditPanelNapredovanja();
            updateEditAndStupnjeviState();
          }
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements || []);
          } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('101', []);
          }
        }
      });
    });
  }

  /** Tipka Povratak: vraća na formu koja je pozvala (ref u URL-u ili document.referrer); inače Meni.php */
  (function () {
    var btn = document.getElementById('btnPovratak');
    if (!btn) return;
    btn.addEventListener('click', function () {
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

  log('before ucitajPravaGeo()');
  ucitajPravaGeo(function () {
    log('ucitajPravaGeo callback: scheduling setTimeout');
    setTimeout(function () {
      log('setTimeout: updateEnabledState start');
      updateEnabledState();
      log('setTimeout: updateEditAndStupnjeviState start');
      updateEditAndStupnjeviState();
      log('setTimeout: done');
    }, 0);
  });
  log('after ucitajPravaGeo() call');

  /* Tablica stupnjevi: početno prazna; setDataTablica primjenjuje zaglavlje */
  var stupnjeviContainer = document.getElementById('tablicaStupnjeviContainer');
  if (tablicaStupnjeviApi && stupnjeviContainer) {
    CommonCRUD.setDataTablica(tablicaStupnjeviApi, 'tablicaStupnjeviContainer', [], NapredovanjaCRUD_Stupnjevi.Tablica_Zaglavlje);
  }

  /* Datum napredovanja: klasa date-empty za boju placeholdera (kao ostale kontrole) */
  var editDatumNapredovanja = document.getElementById('edit_datum_napredovanja');
  function syncDatumNapredovanjaEmptyClass(el) {
    if (!el) return;
    if (el.value === '') el.classList.add('date-empty'); else el.classList.remove('date-empty');
  }
  if (editDatumNapredovanja) {
    syncDatumNapredovanjaEmptyClass(editDatumNapredovanja);
    editDatumNapredovanja.addEventListener('input', function () { syncDatumNapredovanjaEmptyClass(editDatumNapredovanja); });
    editDatumNapredovanja.addEventListener('change', function () { syncDatumNapredovanjaEmptyClass(editDatumNapredovanja); });
  }

  /* Datum st.: klasa date-empty za boju placeholdera (kao ostale kontrole) */
  function syncDatumStEmptyClass(el) {
    if (!el) return;
    if (el.value === '') el.classList.add('date-empty'); else el.classList.remove('date-empty');
  }
  if (editDatumStEl) {
    syncDatumStEmptyClass(editDatumStEl);
    editDatumStEl.addEventListener('input', function () { syncDatumStEmptyClass(editDatumStEl); });
    editDatumStEl.addEventListener('change', function () { syncDatumStEmptyClass(editDatumStEl); });
  }

  /* Početno uskladi visine oba panela (jednokratno). Bez MutationObservera da ne blokira preglednik pri otvaranju selecta i drugim promjenama layouta. */
  function initPanelsHeightSync() {
    log('initPanelsHeightSync: start');
    var row = document.querySelector('.napredovanja-crud__panels-row');
    if (!row) { log('initPanelsHeightSync: no row'); return; }
    var panelTablica = row.querySelector('.napredovanja-crud__panel-tablica');
    var panelStupnjevi = row.querySelector('.napredovanja-crud__panel-stupnjevi');
    if (!panelTablica || !panelStupnjevi) { log('initPanelsHeightSync: no panels'); return; }
    var h1 = panelTablica.offsetHeight;
    var h2 = panelStupnjevi.offsetHeight;
    var h = Math.max(h1, h2);
    if (h > 0) {
      panelTablica.style.height = h + 'px';
      panelStupnjevi.style.height = h + 'px';
    }
    log('initPanelsHeightSync: end');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPanelsHeightSync);
  } else {
    initPanelsHeightSync();
  }
})();
