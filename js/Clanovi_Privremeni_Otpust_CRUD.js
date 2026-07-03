/* =====================================================
   Clanovi_Privremeni_Otpust_CRUD.js  (1.g.II)
   Privremeni otpust člana. Panel-tablica: logo + Država/Regija/Loža + Traži; tablica = članovi
   odabrane lože s TRENUTNO aktivnim otpustom (Prezime/Ime/St.). Edit panel: Član (select) +
   Datum od + Datum do + Napomena + audit (RO); CRUD podnožje (Upiši→Izmijeni / Izbriši / Povratak).
   Uzor: Clanovi_Promjena_Loze_Izlazak_CRUD (geo/logo/tablica).
   API: _sve.php (grid), _upis.php, _izmjena.php, _brisanje.php; Član-select iz Clanovi_CRUD_sve.php.
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';

  var API_BASE = '../php/';
  var dataOtpust = [];           /* grid: članovi lože s aktivnim otpustom (redak = jedan otpust) */
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
  function refreshSelect(id) {
    if (typeof KontroleRefreshCustomSelect === 'function' && id) KontroleRefreshCustomSelect(id);
  }
  function formatDatumHR(s) {
    if (!s) return '';
    var m = String(s).split(' ')[0].split('-');
    return (m.length === 3) ? (m[2] + '.' + m[1] + '.' + m[0] + '.') : String(s);
  }
  function formatDateTimeHR(s) {
    if (!s) return '';
    var parts = String(s).split(/[ T]/);
    var d = formatDatumHR(parts[0]);
    var t = parts[1] ? parts[1].substring(0, 5) : '';
    return t ? (d + ' ' + t) : d;
  }
  /* Broj mjeseci: kalkulativno mjesec = 30 dana. Ukupan broj dana / 30, ostatak ≤ 15 dana → dolje,
     ostatak ≥ 16 dana → gore (npr. 3mj+15d = 3; 3mj+16d = 4). Realizirano: floor((dani + 14) / 30). */
  function mjeseciIzmedju(odStr, doStr) {
    if (!odStr || !doStr) return '';
    var od = new Date(odStr), doo = new Date(doStr);
    if (isNaN(od.getTime()) || isNaN(doo.getTime())) return '';
    var dani = Math.round((doo.getTime() - od.getTime()) / 86400000);
    if (dani < 0) dani = 0;
    return String(Math.floor((dani + 14) / 30));
  }

  /* --- Element refs --- */
  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');
  var selectClan = document.getElementById('select_clan');
  var editDatumOd = document.getElementById('edit_datum_od');
  var editDatumDo = document.getElementById('edit_datum_do');
  var editNapomena = document.getElementById('edit_napomena');
  var roPrviUpis = document.getElementById('ro_prvi_upis');
  var roUpisao = document.getElementById('ro_upisao');
  var roZadnjaIzmjena = document.getElementById('ro_zadnja_izmjena');
  var roIzmijenio = document.getElementById('ro_izmijenio');
  var editPanel = document.getElementById('edit_panel');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var chkPrikaziSve = document.getElementById('cpo_prikazi_sve');
  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  /* --- Tablica: Prezime, Ime, St. (kao uzorak) --- */
  var OtpustCRUD = {
    Broj_Kolona: 6,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'prezime', title: 'Prezime', SQL_Naziv: 'prezime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'ime', title: 'Ime', SQL_Naziv: 'ime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stupanj', title: 'St.', SQL_Naziv: 'stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      /* Datumi u HR formatu (formatDatumHR) → sort isključen (sortable:0) jer HR string ne parsira kao datum. */
      { key: 'od_dana', title: 'Od dana', SQL_Naziv: 'datum_od', sortable: 0, sortable_icon: 0, type: 't', width: 150, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'do_dana', title: 'Do dana', SQL_Naziv: 'datum_do', sortable: 0, sortable_icon: 0, type: 't', width: 150, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'mjeseci', title: 'Mjeseci', SQL_Naziv: '', sortable: 1, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  CommonCRUD.initTablica('tablicaContainer', OtpustCRUD, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  /* ===== Grid (aktivni otpust odabrane lože) ===== */
  function podaciURedove(arr) {
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      var jeKandidat = parseInt(r.kandidat, 10) === 1;
      var stupanjShow = jeKandidat ? 'K' : (r.stupanj_show != null && r.stupanj_show !== '' ? String(r.stupanj_show) + '°' : '');
      rows.push({
        id: r.id_otpust != null ? r.id_otpust : '',
        0: r.prezime != null ? r.prezime : '',
        1: r.ime != null ? r.ime : '',
        2: stupanjShow,
        3: formatDatumHR(r.datum_od),
        4: formatDatumHR(r.datum_do),
        5: mjeseciIzmedju(r.datum_od, r.datum_do)
      });
    }
    return rows;
  }
  function primijeniTrazi(lista) {
    var el = document.getElementById('cpo_trazi');
    var q = el ? trim(el.value).toLowerCase() : '';
    if (!q) return lista.slice();
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      var st = r.stupanj_show != null ? String(r.stupanj_show) : '';
      var hay = ((r.prezime || '') + ' ' + (r.ime || '') + ' ' + st + ' ' + formatDatumHR(r.datum_od) + ' ' + formatDatumHR(r.datum_do)).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(r);
    }
    return out;
  }
  function osvjeziPrikazTablice() {
    var rows = podaciURedove(primijeniTrazi(dataOtpust));
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, OtpustCRUD.Tablica_Zaglavlje);
    primijeniNeaktivneRedove();
  }

  /* Sivi redovi za otpuste koji NISU trenutno aktivni (aktivan=0 iz PHP-a; vidljivi kad je „Prikaži sve"). */
  function aktivanZaRowId(rowId) {
    for (var i = 0; i < dataOtpust.length; i++) {
      if (String(dataOtpust[i].id_otpust) === String(rowId)) return parseInt(dataOtpust[i].aktivan, 10) === 1;
    }
    return true;
  }
  function primijeniNeaktivneRedove() {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    var trs = container.querySelectorAll('.kontrola-tablica__scroll tbody tr');
    for (var i = 0; i < trs.length; i++) {
      trs[i].classList.toggle('clanovi-privremeni-otpust-crud__row--neaktivan', !aktivanZaRowId(trs[i].dataset.rowId));
    }
  }
  /* Re-primjeni sive redove nakon re-rendera tbody (client sort po Prezime/Ime/St./Mjeseci). childList bez subtree → bez petlje. */
  (function () {
    requestAnimationFrame(function () {
      var tbody = document.querySelector('#tablicaContainer .kontrola-tablica__scroll table tbody');
      if (!tbody || typeof MutationObserver === 'undefined') return;
      var pending = null;
      var mo = new MutationObserver(function () {
        if (pending != null) return;
        pending = requestAnimationFrame(function () { pending = null; primijeniNeaktivneRedove(); });
      });
      mo.observe(tbody, { childList: true });
    });
  })();
  function ucitajOtpust(idLoza, cb) {
    dataOtpust = [];
    if (!idLoza) {
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], OtpustCRUD.Tablica_Zaglavlje);
      if (cb) cb(); return;
    }
    var sveParam = (chkPrikaziSve && chkPrikaziSve.checked) ? '&sve=1' : '';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_Privremeni_Otpust_CRUD_sve.php?id_loza=' + encodeURIComponent(idLoza) + sveParam, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      dataOtpust = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { dataOtpust = JSON.parse(text) || []; } catch (e) { dataOtpust = []; }
      }
      osvjeziPrikazTablice();
      if (cb) cb();
    };
    xhr.send();
  }

  /* ===== Član select (aktivni članovi odabrane lože; za novi unos) ===== */
  function ucitajClanoveZaSelect(idLoza, cb) {
    if (!selectClan) { if (cb) cb(); return; }
    if (!idLoza) { popuniSelectClan([]); if (cb) cb(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_CRUD_sve.php?id_loza=' + encodeURIComponent(idLoza), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var raw = JSON.parse(text) || [];
          for (var i = 0; i < raw.length; i++) {
            if (parseInt(raw[i].aktivnost, 10) === 1 && parseInt(raw[i].kandidat, 10) !== 1) arr.push(raw[i]);
          }
        } catch (e) { arr = []; }
      }
      popuniSelectClan(arr);
      if (cb) cb();
    };
    xhr.send();
  }
  function popuniSelectClan(arr) {
    if (!selectClan) return;
    while (selectClan.firstChild) selectClan.removeChild(selectClan.firstChild);
    var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '— Odaberi člana —'; selectClan.appendChild(opt0);
    for (var i = 0; i < arr.length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? String(arr[i].id) : '';
      opt.textContent = ((arr[i].prezime || '') + ' ' + (arr[i].ime || '')).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
      selectClan.appendChild(opt);
    }
    refreshSelect('select_clan');
  }

  /* ===== Logo lože u zaglavlju tablice ===== */
  function updateTablicaHeaderLogo() {
    var img = document.getElementById('cpo_loza_logo');
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

  /* Stanje jednog uređivačkog polja: normalno / RO (vidljivo, ne uređuje se) / disabled (prigušeno). */
  function primijeniPoljeStanje(el, enabled, ro) {
    if (!el) return;
    if (typeof KontroleSetControlReadonly === 'function') KontroleSetControlReadonly(el, false);
    el.disabled = !enabled;
    if (enabled && ro && typeof KontroleSetControlReadonly === 'function') KontroleSetControlReadonly(el, true);
  }

  /* ===== Enable stanje ===== */
  function updateEnabledState() {
    var imaLozu = selectLoza && trim(selectLoza.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;

    var tableWrap = document.getElementById('tablicaContainer');
    tableWrap = tableWrap && tableWrap.closest ? tableWrap.closest('.kontrola-tablica') : null;
    if (tableWrap) tableWrap.classList.toggle('kontrola-tablica--disabled', !imaLozu);

    /* Edit panel je aktivan kad je odabrana loža (novi unos) ili je selektiran redak (izmjena). */
    if (editPanel) editPanel.classList.toggle('kontrola-panel--edit-disabled', !imaLozu);

    var traziWrap = document.getElementById('cpo_trazi');
    traziWrap = traziWrap && traziWrap.closest ? traziWrap.closest('.kontrola-edit-delete') : null;
    if (traziWrap && typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(traziWrap, imaLozu);

    if (selectLoza) selectLoza.disabled = _geoAutoLockedLoza || !(selectRegija && trim(selectRegija.value) !== '');
    refreshSelect('select_loza');
    if (btnReloadTablica) btnReloadTablica.disabled = !imaLozu;
    if (chkPrikaziSve) chkPrikaziSve.disabled = !imaLozu;   /* enable tek kad je odabrana loža */

    /* --- Edit panel stanje (spec):
       • selekcija u tablici → Član DISABLED; Datum od/do/Napomena ENABLED, osim ako je otpust NEAKTIVAN
         (now izvan raspona) → tada RO;
       • bez selekcije + Član NIJE izabran → sve osim Član DISABLED;
       • bez selekcije + Član izabran → sve ENABLED. */
    var clanIzabran = selectClan && trim(selectClan.value) !== '';
    var selektiraniAktivan = imaSelekciju ? aktivanZaRowId(getSelectedRowId()) : true;
    if (selectClan) { selectClan.disabled = !imaLozu || imaSelekciju; refreshSelect('select_clan'); }
    var poljaEnabled, poljaRO;
    if (!imaLozu) { poljaEnabled = false; poljaRO = false; }
    else if (imaSelekciju) { poljaEnabled = true; poljaRO = !selektiraniAktivan; }
    else { poljaEnabled = clanIzabran; poljaRO = false; }
    primijeniPoljeStanje(editDatumOd, poljaEnabled, poljaRO);
    primijeniPoljeStanje(editDatumDo, poljaEnabled, poljaRO);
    primijeniPoljeStanje(editNapomena, poljaEnabled, poljaRO);

    /* Desni stupac (audit, uvijek RO) prati isto enable stanje kao Datum od/do (poljaEnabled). */
    [roPrviUpis, roUpisao, roZadnjaIzmjena, roIzmijenio].forEach(function (el) { if (el) el.disabled = !poljaEnabled; });

    updateCrudButtons();
    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) btnPovratak.disabled = false;
  }

  function updateCrudButtons() {
    var imaLozu = selectLoza && trim(selectLoza.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;
    var selektiraniAktivan = imaSelekciju ? aktivanZaRowId(getSelectedRowId()) : true;
    var clanOk = imaSelekciju || (selectClan && trim(selectClan.value) !== '');
    var datumiOk = editDatumOd && trim(editDatumOd.value) !== '' && editDatumDo && trim(editDatumDo.value) !== '';

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmijeni' : 'Upiši';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmijeni' : 'Upiši');
      var moze = imaLozu && clanOk && datumiOk && _pravaCrudUpis === 1;
      if (imaSelekciju && !selektiraniAktivan) moze = false;   /* neaktivan otpust je RO → nema izmjene */
      btnUpisi.disabled = !moze;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !(imaSelekciju && _pravaCrudBrisanje === 1);
  }

  /* ===== Selekcija reda → učitaj otpust u edit; bez selekcije → čisto za novi unos ===== */
  function clearEditFields() {
    if (selectClan) { selectClan.value = ''; refreshSelect('select_clan'); }
    if (editDatumOd) editDatumOd.value = '';
    if (editDatumDo) editDatumDo.value = '';
    if (editNapomena) editNapomena.value = '';
    if (roPrviUpis) roPrviUpis.value = '';
    if (roUpisao) roUpisao.value = '';
    if (roZadnjaIzmjena) roZadnjaIzmjena.value = '';
    if (roIzmijenio) roIzmijenio.value = '';
  }
  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearEditFields();
    } else {
      var found = null;
      for (var i = 0; i < dataOtpust.length; i++) { if (String(dataOtpust[i].id_otpust) === String(id)) { found = dataOtpust[i]; break; } }
      if (found) {
        if (selectClan) { selectClan.value = found.id_clan != null ? String(found.id_clan) : ''; refreshSelect('select_clan'); }
        if (editDatumOd) editDatumOd.value = found.datum_od != null ? found.datum_od : '';
        if (editDatumDo) editDatumDo.value = found.datum_do != null ? found.datum_do : '';
        if (editNapomena) editNapomena.value = found.napomena != null ? found.napomena : '';
        if (roPrviUpis) roPrviUpis.value = formatDateTimeHR(found.prvi_upis);
        if (roUpisao) roUpisao.value = found.autor_upis != null ? found.autor_upis : '';
        if (roZadnjaIzmjena) roZadnjaIzmjena.value = formatDateTimeHR(found.zadnja_izmjena);
        if (roIzmijenio) roIzmijenio.value = found.autor_izmjena != null ? found.autor_izmjena : '';
      }
    }
    updateEnabledState();
  };

  function osvjeziTablicu(cb) {
    ucitajOtpust(selectLoza ? trim(selectLoza.value) : '', function () { updateEnabledState(); if (cb) cb(); });
  }

  /* ===== GEO (Država/Regija/Loža) — uzor Clanovi_Promjena_Loze_Izlazak_CRUD ===== */
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
    refreshSelect(kontrolaId);
  }
  function ucitajPravaGeo(callback) {
    var url = typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
      ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Clanovi_Privremeni_Otpust_CRUD.html')
      : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') + '?html_fajl=' + encodeURIComponent('Clanovi_Privremeni_Otpust_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = g.drzave || [];
      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');
      _pravaCrudUpis = g.upis_izmjena != null ? parseInt(g.upis_izmjena, 10) : 0;
      _pravaCrudBrisanje = g.brisanje_sloga != null ? parseInt(g.brisanje_sloga, 10) : 0;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(_pravaCrudUpis, _pravaCrudBrisanje);
      if (drz.length === 1 && selectDrzava) {
        selectDrzava.value = String(drz[0].id); selectDrzava.disabled = true; _geoAutoLockedDrzava = true;
        refreshSelect('select_drzava');
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
      refreshSelect('select_regija');
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
      selectLoza.disabled = true; dataOtpust = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], OtpustCRUD.Tablica_Zaglavlje);
      popuniSelectClan([]);
      if (callback) callback(); return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var f = typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function' ? window.vnlhGeoFiltrirajLozePoRegiji(g.loze, idRegija) : [];
    popuniSelectIzKeša(selectLoza, f, '— Odaberi ložu —', 'select_loza');
    if (f.length === 1) {
      selectLoza.value = String(f[0].id); selectLoza.disabled = true; _geoAutoLockedLoza = true;
      refreshSelect('select_loza');
      ucitajClanoveZaSelect(selectLoza.value);
      osvjeziTablicu(function () { updateTablicaHeaderLogo(); updateEnabledState(); if (callback) callback(); });
    } else {
      selectLoza.disabled = (f.length === 0); dataOtpust = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], OtpustCRUD.Tablica_Zaglavlje);
      popuniSelectClan([]);
      updateTablicaHeaderLogo();
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
    var tz = document.getElementById('cpo_trazi'); if (tz) tz.value = '';
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    updateTablicaHeaderLogo();
    ucitajClanoveZaSelect(trim(this.value));
    osvjeziTablicu();
    updateEnabledState();
  });
  if (btnReloadTablica) btnReloadTablica.addEventListener('click', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearEditFields();   /* počisti sve edite + Član select na „nije izabrano" */
    ucitajClanoveZaSelect(selectLoza ? trim(selectLoza.value) : '');
    osvjeziTablicu();
  });
  /* „Prikaži sve privremene otpuste": refresh tablice na svaku promjenu (1 = svi, 0 = samo trenutno aktivni). */
  if (chkPrikaziSve) chkPrikaziSve.addEventListener('change', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    osvjeziTablicu();
  });
  if (selectClan) selectClan.addEventListener('change', function () {
    /* Bez selekcije u tablici: promjena člana briše ostala polja (novi unos ispočetka). */
    if (getSelectedRowId() == null) {
      if (editDatumOd) editDatumOd.value = '';
      if (editDatumDo) editDatumDo.value = '';
      if (editNapomena) editNapomena.value = '';
    }
    updateEnabledState();
  });
  if (editDatumOd) { editDatumOd.addEventListener('input', updateCrudButtons); editDatumOd.addEventListener('change', updateCrudButtons); }
  if (editDatumDo) { editDatumDo.addEventListener('input', updateCrudButtons); editDatumDo.addEventListener('change', updateCrudButtons); }

  /* Traži (debounce) */
  (function () {
    var inp = document.getElementById('cpo_trazi');
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

  /* ===== CRUD ===== */
  function datumiValidni() {
    var od = editDatumOd ? trim(editDatumOd.value) : '';
    var doo = editDatumDo ? trim(editDatumDo.value) : '';
    if (od === '' || doo === '') return false;
    if (new Date(doo).getTime() < new Date(od).getTime()) return false;
    return true;
  }
  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      if (btnUpisi.disabled) return;
      if (!datumiValidni()) { poruka('105', []); return; }
      var od = trim(editDatumOd.value), doo = trim(editDatumDo.value);
      var nap = editNapomena ? editNapomena.value : '';
      var id = getSelectedRowId();
      if (id != null) {
        /* Izmjena postojećeg otpusta (član se ne mijenja). */
        postFormData(API_BASE + 'Clanovi_Privremeni_Otpust_CRUD_izmjena.php',
          { id: String(id), datum_od: od, datum_do: doo, napomena: nap }, crudCallback);
      } else {
        var idClan = selectClan ? trim(selectClan.value) : '';
        if (idClan === '') { poruka('105', []); return; }
        postFormData(API_BASE + 'Clanovi_Privremeni_Otpust_CRUD_upis.php',
          { id_clan: idClan, datum_od: od, datum_do: doo, napomena: nap }, crudCallback);
      }
    });
  }
  function crudCallback(res) {
    res = (res || '').trim();
    if (res === 'OK') {
      poruka('001', [], function () {
        if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
        clearEditFields();
        osvjeziTablicu();
      });
    } else {
      var p = parseResponseCode(res);
      poruka(p ? p.code : '200', p ? p.replacements : []);
    }
  }
  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      if (btnIzbrisi.disabled) return;
      var id = getSelectedRowId();
      if (id == null) return;
      poruka('128', [], function (buttonKey) {
        if (buttonKey !== 'OK') return;
        postFormData(API_BASE + 'Clanovi_Privremeni_Otpust_CRUD_brisanje.php', { id: String(id) }, function (res) {
          res = (res || '').trim();
          if (res === 'OK') {
            poruka('003', [], function () {
              if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
              clearEditFields();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            poruka(p ? p.code : '200', p ? p.replacements : []);
          }
        });
      });
    });
  }

  /* Povratak */
  var btnPovratak = document.getElementById('btnPovratak');
  if (btnPovratak) btnPovratak.addEventListener('click', function () {
    var params = new URLSearchParams(window.location.search);
    var ref = (params.get('ref') || '').trim();
    if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
    if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e2) {} }
    window.location.href = new URL('Meni.php', window.location.href).href;
  });

  /* ===== Logo: 1:1 kvadrat koji ispuni visinu zaglavlja (uzor Clanovi_Loza_CRUD) ===== */
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
    updateTablicaHeaderLogo();
    ucitajPravaGeo(function () {
      updateTablicaHeaderLogo();
      updateEnabledState();
      syncTablicaHeaderLogoSize();
    });
    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza) selectLoza.disabled = true;
    dataOtpust = [];
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], OtpustCRUD.Tablica_Zaglavlje);
    clearEditFields();
    updateEnabledState();

    syncTablicaHeaderLogoSize();
    if (typeof ResizeObserver !== 'undefined') {
      var headerKontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      if (headerKontrole) { try { new ResizeObserver(function () { syncTablicaHeaderLogoSize(); }).observe(headerKontrole); } catch (e) {} }
    }
    window.addEventListener('resize', function () { syncTablicaHeaderLogoSize(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initForma);
  else initForma();
})();
