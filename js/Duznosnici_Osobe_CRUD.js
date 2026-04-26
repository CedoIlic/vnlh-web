/* =========================================================
   Duznosnici_Osobe_CRUD.js
   Lijevo: dužnosti (Traži + tablica). Desno: aktivni članovi (Traži + tablica), prikaz imena „prezime, ime“.
   Donji panel: readonly Dužnost, Nosioc; CRUD – upis u sustav_korisnici (UPDATE/INSERT po id_korisnik), brisanje retka dodjele.
   Koristi CommonCRUD, 0-Kontrole, 0-Common.
   API: Duznosnici_CRUD_opcije_pod_masterom.php (lijevo: potomci, JSON s razina; 0-Razine: ispod, povrat 0, ukljuci_mastera 0), Clanovi_CRUD_sve_aktivni.php,
   Toggle „Sve“: 1004+1002. Uključeno: GET kao Ogr „Svi“ (povrat_cijelog_seta=1, ukljuci_mastera=1) — cijeli aktivni skup dužnosnika, i bez filtra R. Isključeno: ispod+0+0, uz filtar samo retci s razina>0. Bez togglea: kao dosad samo ispod+0+0, bez R-filtra.
        common_sustav_varijable.php?id=114 (stanka debounce Traži — 0-Common.js), Duznosnici_Osobe_CRUD_dodjele.php (GET master_id — početna mapa),
        Duznosnici_Osobe_CRUD_upis.php, Duznosnici_Osobe_CRUD_brisanje.php,
        Sustav_korisnici_modal_pregled.php (modal ellipsis – dužnost / osoba iz sustav_korisnici).
   ========================================================= */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Duznosnici_Osobe_CRUD.html');

  /* Relativno ../php/ – isto kao Duznosnici_CRUD.js (apsolutni URL iz pathname često daje 404 → HTML → modal 101). */
  var API_BASE = '../php/';

  if (typeof window.vnlhLoadPronadjiStankaMsFromVar114 === 'function') {
    window.vnlhLoadPronadjiStankaMsFromVar114(API_BASE);
  }

  /** null = nije učitano; sadržaj sustav_varijable id 1004 (1 = vidljiv toggle; kao Duznosnici_Ogranicenja_CRUD). */
  var cachedSustavVar1004Osobe = null;
  /** null = nije učitano; tekst retka 1002 (id_korisnik, odvojeno zarezom). */
  var cachedSustavVar1002Osobe = null;
  var sustav10041002LoadingOsobe = false;
  var sustav10041002PendingOsobe = [];

  function parsirajIdKorisnikaIzVar1002TekstaOsobe(t) {
    if (t == null || String(t).trim() === '') return [];
    var s = String(t);
    var seen = {};
    var out = [];
    var re = /\d+/g;
    var m;
    while ((m = re.exec(s)) !== null) {
      var n = parseInt(m[0], 10);
      if (n > 0 && !seen[n]) {
        seen[n] = true;
        out.push(n);
      }
    }
    return out;
  }

  function korisnikJeUVar1002ListiOsobe() {
    var me = typeof window.VNLH_ID_KORISNIK !== 'undefined' ? parseInt(String(window.VNLH_ID_KORISNIK), 10) : 0;
    if (isNaN(me) || me <= 0) return false;
    var ids = parsirajIdKorisnikaIzVar1002TekstaOsobe(cachedSustavVar1002Osobe);
    for (var k = 0; k < ids.length; k++) {
      if (ids[k] === me) return true;
    }
    return false;
  }

  function updateToggleOsobeSrazinomUI() {
    var wrap = document.getElementById('toggle_osobe_s_razinom_wrap');
    var chk = document.getElementById('toggle_osobe_s_razinom');
    if (!wrap || !chk) return;
    var prikazi = cachedSustavVar1004Osobe !== null && String(cachedSustavVar1004Osobe).trim() === '1' && korisnikJeUVar1002ListiOsobe();
    if (prikazi) {
      wrap.removeAttribute('hidden');
      chk.removeAttribute('disabled');
    } else {
      wrap.setAttribute('hidden', '');
      chk.checked = false;
      chk.setAttribute('disabled', '');
    }
  }

  function ucitajSustavVars1004I1002Osobe(callback) {
    if (cachedSustavVar1004Osobe !== null && cachedSustavVar1002Osobe !== null) {
      if (typeof callback === 'function') callback();
      return;
    }
    if (typeof callback === 'function') sustav10041002PendingOsobe.push(callback);
    if (sustav10041002LoadingOsobe) return;
    sustav10041002LoadingOsobe = true;
    var pending = 2;
    function zavrsiJedan() {
      pending--;
      if (pending > 0) return;
      sustav10041002LoadingOsobe = false;
      updateToggleOsobeSrazinomUI();
      var cbs = sustav10041002PendingOsobe.slice();
      sustav10041002PendingOsobe = [];
      for (var i = 0; i < cbs.length; i++) {
        try {
          if (cbs[i]) cbs[i]();
        } catch (e) {}
      }
    }
    var xhr4 = new XMLHttpRequest();
    xhr4.open('GET', API_BASE + 'common_sustav_varijable.php?id=1004', true);
    xhr4.onreadystatechange = function () {
      if (xhr4.readyState !== 4) return;
      var tx4 = (xhr4.responseText || '').trim();
      if (tx4 === '120' || tx4 === '100' || tx4 === '401') cachedSustavVar1004Osobe = '0';
      else cachedSustavVar1004Osobe = tx4;
      zavrsiJedan();
    };
    xhr4.send();
    var xhr2 = new XMLHttpRequest();
    xhr2.open('GET', API_BASE + 'common_sustav_varijable.php?id=1002', true);
    xhr2.onreadystatechange = function () {
      if (xhr2.readyState !== 4) return;
      var tx2 = (xhr2.responseText || '').trim();
      if (tx2 === '120' || tx2 === '100' || tx2 === '401') cachedSustavVar1002Osobe = '';
      else cachedSustavVar1002Osobe = tx2;
      zavrsiJedan();
    };
    xhr2.send();
  }

  /**
   * Isto kao Duznici_Ogranicenja: „Svi“ = cijela tablica (API povrat=1, ukljuci=1; smjer se u PHP ignorira).
   * Samo kad je omot vidljiv i „Sve“ uključeno; inače učitavamo ispod+0+0.
   */
  function nosiociOsobeDohvatiCijeliSetAktivnihDuznosnika() {
    var wrap = document.getElementById('toggle_osobe_s_razinom_wrap');
    var chk = document.getElementById('toggle_osobe_s_razinom');
    if (!wrap || !chk) return false;
    if (wrap.hasAttribute('hidden')) return false;
    return !!chk.checked;
  }

  /**
   * Klijentski filtar stupca R. (samo razina>0): kad je omot vidljiv i „Sve“ isključeno.
   * Kad je „Sve“ uključeno, podaci su već cijeli skup s poslužitelja — R-filtar se ne smije.
   */
  function jeAktivnaFiltarBez0RazinaOsobe() {
    var wrap = document.getElementById('toggle_osobe_s_razinom_wrap');
    var chk = document.getElementById('toggle_osobe_s_razinom');
    if (!wrap || !chk) return false;
    if (wrap.hasAttribute('hidden')) return false;
    return !chk.checked;
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

  /** Prikaz imena u formatu „prezime, ime“. */
  function formatPrezimeIme(prezime, ime) {
    var p = prezime != null ? String(prezime).trim() : '';
    var i = ime != null ? String(ime).trim() : '';
    if (p === '' && i === '') return '';
    if (p === '') return i;
    if (i === '') return p;
    return p + ', ' + i;
  }

  /* --- Blok: Tablica_Zaglavlje – dužnosti --- */
  var DuznosniciOsobe_TablicaDuznost = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'duznosnici-osobe-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Dužnost', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  /* --- Blok: Tablica_Zaglavlje – članovi: jedna kolona „prezime, ime, loža, grad lože“ (samo ne-prazni dijelovi, odvojeni „, „). */
  var DuznosniciOsobe_TablicaOsoba = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'duznosnici-osobe-crud',
    Tablica_Zaglavlje: [
      { key: 'clan', title: 'Član', SQL_Naziv: 'clan', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaDuznostApi = null;
  var tablicaOsobaApi = null;
  var dataDuznosnici = [];
  var dataClanovi = [];
  /** id_duznosnik (string) -> id_clanovi (number); puni se nakon uspješnog upisa, briše nakon brisanja (nema dohvata s poslužitelja). */
  var assignmentClanByDuznost = {};
  var syncingFromDuznosnik = false;

  var editTraziDuznost = document.getElementById('edit_trazi_duznost');
  var editTraziOsobu = document.getElementById('edit_trazi_osobu');
  var editDuznost = document.getElementById('edit_duznost');
  var editNosioc = document.getElementById('edit_nosioc');
  var editPanel = document.getElementById('edit_panel');
  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  var btnPovratak = document.getElementById('btnPovratak');

  CommonCRUD.initTablica('tablicaContainerDuznost', DuznosniciOsobe_TablicaDuznost, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaDuznostApi = api; },
    onSelectionChange: function () { onDuznostSelectionChange(); },
    syncHeaderOnChange: true
  });

  CommonCRUD.initTablica('tablicaContainerOsoba', DuznosniciOsobe_TablicaOsoba, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaOsobaApi = api; },
    onSelectionChange: function () { onOsobaSelectionChange(); },
    syncHeaderOnChange: true
  });

  function tekstLozePolje(v) {
    if (v == null) return '';
    var s = String(v).trim();
    return s;
  }

  /** Jedan prikaz retka: prezime, ime [, loža] [, grad lože] – samo popunjena polja, odvojena „, „. */
  function formatClanRedakZaTablicu(r) {
    if (!r) return '';
    var parts = [];
    var pi = formatPrezimeIme(r.prezime, r.ime);
    if (pi !== '') parts.push(pi);
    var lz = tekstLozePolje(r.loza_naziv);
    if (lz !== '') parts.push(lz);
    var gr = tekstLozePolje(r.loza_grad);
    if (gr !== '') parts.push(gr);
    return parts.join(', ');
  }

  /** Tekst nosioca za id člana (iz punog niza dataClanovi). */
  function getNosiocTekstZaClanId(idClan) {
    if (idClan == null) return '';
    var found = (dataClanovi || []).find(function (r) { return String(r.id) === String(idClan); });
    if (!found) return '';
    return formatPrezimeIme(found.prezime, found.ime);
  }

  /* --- Blok: Filtri tablica --- */
  function primijeniFilterDuznost() {
    if (!tablicaDuznostApi) return;
    var txt = editTraziDuznost ? trim(editTraziDuznost.value) : '';
    var list = dataDuznosnici || [];
    if (jeAktivnaFiltarBez0RazinaOsobe()) {
      list = list.filter(function (r) {
        var rz = r.razina != null ? Number(r.razina) : 0;
        if (isNaN(rz)) rz = 0;
        return rz > 0;
      });
    }
    if (txt !== '') {
      var t = txt.toLowerCase();
      list = list.filter(function (r) {
        var nz = (r.naziv != null ? String(r.naziv) : '').toLowerCase();
        return nz.indexOf(t) !== -1;
      });
    }
    var selPrije = CommonCRUD.getSelectedRowId(tablicaDuznostApi);
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      rows.push({
        id: r.id,
        0: r.naziv != null ? r.naziv : ''
      });
    }
    CommonCRUD.setDataTablica(tablicaDuznostApi, 'tablicaContainerDuznost', rows, DuznosniciOsobe_TablicaDuznost.Tablica_Zaglavlje);
    if (selPrije != null) {
      var j = 0;
      var nadjen = false;
      for (; j < list.length; j++) {
        if (String(list[j].id) === String(selPrije)) {
          nadjen = true;
          break;
        }
      }
      if (nadjen) {
        tablicaDuznostApi.setSelectedRowIds([String(selPrije)]);
      } else if (tablicaDuznostApi.clearSelection) {
        tablicaDuznostApi.clearSelection();
        updateEditAndButtons();
      }
    }
  }

  function primijeniFilterOsoba() {
    if (!tablicaOsobaApi) return;
    var txt = editTraziOsobu ? trim(editTraziOsobu.value) : '';
    var list = dataClanovi || [];
    if (txt !== '') {
      var t = txt.toLowerCase();
      list = list.filter(function (r) {
        return formatClanRedakZaTablicu(r).toLowerCase().indexOf(t) !== -1;
      });
    }
    var rows = [];
    for (var j = 0; j < list.length; j++) {
      var c = list[j];
      rows.push({
        id: c.id,
        0: formatClanRedakZaTablicu(c)
      });
    }
    CommonCRUD.setDataTablica(tablicaOsobaApi, 'tablicaContainerOsoba', rows, DuznosniciOsobe_TablicaOsoba.Tablica_Zaglavlje);
  }

  /* --- Blok: Selekcija lijevo → označi dodijeljenog člana desno --- */
  function onDuznostSelectionChange() {
    if (syncingFromDuznosnik) return;
    var idD = CommonCRUD.getSelectedRowId(tablicaDuznostApi);
    var idAssigned = idD != null ? assignmentClanByDuznost[String(idD)] : null;
    if (idAssigned != null && tablicaOsobaApi) {
      syncingFromDuznosnik = true;
      requestAnimationFrame(function () {
        tablicaOsobaApi.setSelectedRowIds([String(idAssigned)]);
        syncingFromDuznosnik = false;
        updateEditAndButtons();
      });
    } else {
      updateEditAndButtons();
    }
  }

  function onOsobaSelectionChange() {
    if (syncingFromDuznosnik) return;
    updateEditAndButtons();
  }

  /* --- Blok: Edit polja i tipke --- */
  function updateEditAndButtons() {
    var idD = CommonCRUD.getSelectedRowId(tablicaDuznostApi);
    var idC = CommonCRUD.getSelectedRowId(tablicaOsobaApi);
    var dodjelaClan = idD != null ? assignmentClanByDuznost[String(idD)] : null;

    var nazivDuznosti = '';
    if (idD != null && tablicaDuznostApi && typeof tablicaDuznostApi.getData === 'function') {
      var dr = tablicaDuznostApi.getData().find(function (x) { return String(x.id) === String(idD); });
      if (dr) nazivDuznosti = dr[0] != null ? String(dr[0]) : '';
    }

    if (editDuznost) {
      editDuznost.value = nazivDuznosti;
      editDuznost.disabled = idD == null;
    }

    var tekstNosioca = '';
    if (idC != null) {
      tekstNosioca = getNosiocTekstZaClanId(idC);
    } else if (dodjelaClan != null) {
      tekstNosioca = getNosiocTekstZaClanId(dodjelaClan);
    }
    if (editNosioc) {
      editNosioc.value = tekstNosioca;
      editNosioc.disabled = idC == null && dodjelaClan == null;
    }

    var imaDodjelu = dodjelaClan != null;
    var istiClan = imaDodjelu && idC != null && String(dodjelaClan) === String(idC);
    /* Izbriši uključen isto kao kad su oba edita u panelu uključena (Dužnost: odabir dužnosti; Nosioc: odabir člana ili prikaz dodjele). */
    var obaEditPanelaUkljucena = idD != null && (idC != null || dodjelaClan != null);

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaDodjelu);
      btnUpisiLabel.textContent = imaDodjelu ? 'Zamjeni' : 'Upiši';
      btnUpisi.setAttribute('aria-label', imaDodjelu ? 'Zamjeni' : 'Upiši');
      btnUpisi.disabled = idD == null || idC == null || istiClan;
    }
    if (btnIzbrisi) {
      btnIzbrisi.disabled = !obaEditPanelaUkljucena;
    }
    if (btnPovratak) btnPovratak.disabled = false;

    if (editPanel) {
      if (idD == null) editPanel.classList.add('duznosnici-osobe-crud__edit-panel--disabled');
      else editPanel.classList.remove('duznosnici-osobe-crud__edit-panel--disabled');
    }
  }

  /* --- Blok: Učitavanje podataka --- */
  function parseJsonArray(text) {
    var t = (text || '').trim();
    if (t === '' || t.charAt(0) !== '[') return [];
    try {
      return JSON.parse(t);
    } catch (e) {
      return [];
    }
  }

  function showApiError(text) {
    var p = parseResponseCode(text);
    if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal(p.code, p.replacements || []);
    } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal('101', []);
    }
  }

  function ucitajSvePodatke(callback) {
    /* Svako puno učitavanje gradi mapu dodjela s poslužitelja (inače Nosioc ostaje prazan nakon F5). */
    assignmentClanByDuznost = {};
    var keepD = CommonCRUD.getSelectedRowId(tablicaDuznostApi);
    var keepC = CommonCRUD.getSelectedRowId(tablicaOsobaApi);
    var pending = 3;
    var err = false;
    function doneOne() {
      pending--;
      if (pending === 0) {
        /* Lijeva tablica (filtar po toggleu) uvijek — i kad err: inače jedan neuspjeli XHR gasi cijeli blok. */
        primijeniFilterDuznost();
        if (!err) {
          primijeniFilterOsoba();
          syncingFromDuznosnik = true;
          if (keepD != null && tablicaDuznostApi) {
            tablicaDuznostApi.setSelectedRowIds([String(keepD)]);
          }
          var idD2 = CommonCRUD.getSelectedRowId(tablicaDuznostApi);
          var wantC = keepC != null ? keepC : (idD2 != null ? assignmentClanByDuznost[String(idD2)] : null);
          if (wantC != null && tablicaOsobaApi) {
            tablicaOsobaApi.setSelectedRowIds([String(wantC)]);
          }
          syncingFromDuznosnik = false;
        }
        updateEditAndButtons();
        if (callback) callback(!err);
      }
    }

    var masterOsobeId = typeof window.VNLH_OSOBE_MASTER_ID !== 'undefined' ? Number(window.VNLH_OSOBE_MASTER_ID) : 0;
    if (isNaN(masterOsobeId)) masterOsobeId = 0;
    if (window.VNLHPostivanjeRazine && typeof window.VNLHPostivanjeRazine.dohvatiOpcijeDuznosnikaPodMasteromJson === 'function') {
      var cijeliSkup = nosiociOsobeDohvatiCijeliSetAktivnihDuznosnika();
      /* Kao Ogr „Svi“: cijela tablica; inače samo potomci Mastera (Duznosnici_CRUD_opcije_pod_masterom.php). */
      var pCjelog = cijeliSkup ? 1 : 0;
      var uM = cijeliSkup ? 1 : 0;
      window.VNLHPostivanjeRazine.dohvatiOpcijeDuznosnikaPodMasteromJson(
        masterOsobeId,
        API_BASE,
        function (rows, status, text) {
          var t = (text || '').trim();
          if (status !== 200 || (t !== '' && t.charAt(0) !== '[')) {
            err = true;
            showApiError(t || String(status));
          } else {
            dataDuznosnici = (rows || []).map(function (r) {
              var rz = r.razina != null ? Number(r.razina) : 0;
              if (isNaN(rz)) rz = 0;
              return { id: r.id, naziv: r.naziv != null ? String(r.naziv) : '', razina: rz };
            });
          }
          doneOne();
        },
        'ispod',
        pCjelog,
        uM
      );
    } else {
      err = true;
      showApiError('');
      doneOne();
    }

    var xhrC = new XMLHttpRequest();
    xhrC.open('GET', API_BASE + 'Clanovi_CRUD_sve_aktivni.php', true);
    xhrC.onreadystatechange = function () {
      if (xhrC.readyState !== 4) return;
      var t2 = (xhrC.responseText || '').trim();
      if (xhrC.status !== 200 || t2 === '' || t2.charAt(0) !== '[') {
        err = true;
        showApiError(t2 || String(xhrC.status));
      } else {
        dataClanovi = parseJsonArray(t2);
      }
      doneOne();
    };
    xhrC.send();

    var xhrDod = new XMLHttpRequest();
    xhrDod.open('GET', API_BASE + 'Duznosnici_Osobe_CRUD_dodjele.php?master_id=' + encodeURIComponent(String(masterOsobeId)), true);
    xhrDod.onreadystatechange = function () {
      if (xhrDod.readyState !== 4) return;
      var td = (xhrDod.responseText || '').trim();
      if (xhrDod.status === 200 && td !== '' && td.charAt(0) === '[') {
        try {
          var arrDod = JSON.parse(td);
          if (Array.isArray(arrDod)) {
            for (var di = 0; di < arrDod.length; di++) {
              var rowD = arrDod[di];
              if (!rowD || rowD.id_duznosnik == null || rowD.id_korisnik == null) continue;
              var idDD = String(rowD.id_duznosnik);
              if (assignmentClanByDuznost[idDD] == null) {
                assignmentClanByDuznost[idDD] = parseInt(String(rowD.id_korisnik), 10);
              }
            }
          }
        } catch (eDod) {}
      }
      /* Ne postavljaj err — bez dodjela forma i dalje radi za novi upis; samo Nosioc ne bi bio iz baze. */
      doneOne();
    };
    xhrDod.send();
  }

  /* --- Blok: Traži – debounce i clear --- */
  var toD = null;
  if (editTraziDuznost) {
    editTraziDuznost.addEventListener('input', function () {
      if (toD) clearTimeout(toD);
      toD = setTimeout(function () {
        toD = null;
        primijeniFilterDuznost();
        updateEditAndButtons();
      }, typeof window.vnlhGetPronadjiStankaMs === 'function' ? window.vnlhGetPronadjiStankaMs() : 1000);
    });
  }
  /*
   * .poruke__toggle-input ima pointer-events: none (0-Poruke.css) — klik ide na label/slider;
   * u nekim okruženjima change na inputu ne okine. Slušamo change+input+klik na wrapu i
   * odgađamo osvježenje (setTimeout 0) da bude gotov ažuriran checked stanja.
   */
  var nakonSveToggleDebounceTajmer = null;
  function nakonPromjeneToggleSveOsobe() {
    if (nakonSveToggleDebounceTajmer) clearTimeout(nakonSveToggleDebounceTajmer);
    nakonSveToggleDebounceTajmer = setTimeout(function () {
      nakonSveToggleDebounceTajmer = null;
      /* Odmah: checked je već ažuriran, dataDuznosnici su iz zadnjeg učitavanja — tablica reagira i ako XHR zakaže. */
      requestAnimationFrame(function () {
        primijeniFilterDuznost();
        updateEditAndButtons();
        ucitajSvePodatke(null);
      });
    }, 0);
  }
  (function initToggleSveDuznostOsobe() {
    var tglW = document.getElementById('toggle_osobe_s_razinom_wrap');
    var tgl = document.getElementById('toggle_osobe_s_razinom');
    if (!tgl) return;
    tgl.addEventListener('change', nakonPromjeneToggleSveOsobe);
    tgl.addEventListener('input', nakonPromjeneToggleSveOsobe);
    if (tglW) {
      tglW.addEventListener('click', function () {
        if (tglW.hasAttribute('hidden')) return;
        if (tgl.disabled) return;
        nakonPromjeneToggleSveOsobe();
      });
    }
  })();

  var wrapD = editTraziDuznost && editTraziDuznost.closest ? editTraziDuznost.closest('.kontrola-edit-delete') : null;
  var clearD = wrapD ? wrapD.querySelector('.kontrola-edit-delete__clear') : null;
  if (clearD) {
    clearD.addEventListener('click', function () {
      if (editTraziDuznost) editTraziDuznost.value = '';
      primijeniFilterDuznost();
      if (tablicaDuznostApi && tablicaDuznostApi.clearSelection) tablicaDuznostApi.clearSelection();
      updateEditAndButtons();
    });
  }

  var toO = null;
  if (editTraziOsobu) {
    editTraziOsobu.addEventListener('input', function () {
      if (toO) clearTimeout(toO);
      toO = setTimeout(function () {
        toO = null;
        primijeniFilterOsoba();
        updateEditAndButtons();
      }, typeof window.vnlhGetPronadjiStankaMs === 'function' ? window.vnlhGetPronadjiStankaMs() : 1000);
    });
  }
  var wrapO = editTraziOsobu && editTraziOsobu.closest ? editTraziOsobu.closest('.kontrola-edit-delete') : null;
  var clearO = wrapO ? wrapO.querySelector('.kontrola-edit-delete__clear') : null;
  if (clearO) {
    clearO.addEventListener('click', function () {
      if (editTraziOsobu) editTraziOsobu.value = '';
      primijeniFilterOsoba();
      if (tablicaOsobaApi && tablicaOsobaApi.clearSelection) tablicaOsobaApi.clearSelection();
      updateEditAndButtons();
    });
  }

  /* --- Blok: CRUD tipke --- */
  function ocistiTraziEditPanelISelekteTablica() {
    if (editTraziDuznost) editTraziDuznost.value = '';
    if (editTraziOsobu) editTraziOsobu.value = '';
    if (tablicaDuznostApi && tablicaDuznostApi.clearSelection) tablicaDuznostApi.clearSelection();
    if (tablicaOsobaApi && tablicaOsobaApi.clearSelection) tablicaOsobaApi.clearSelection();
    if (editDuznost) editDuznost.value = '';
    if (editNosioc) editNosioc.value = '';
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var idD = CommonCRUD.getSelectedRowId(tablicaDuznostApi);
      var idC = CommonCRUD.getSelectedRowId(tablicaOsobaApi);
      if (idD == null || idC == null) return;
      var jeZamjeni = assignmentClanByDuznost[String(idD)] != null;
      if (typeof window.CommonPostFormData !== 'function') return;
      window.CommonPostFormData(API_BASE + 'Duznosnici_Osobe_CRUD_upis.php', {
        id_duznosnik: String(idD),
        id_clanovi: String(idC)
      }, function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          assignmentClanByDuznost[String(idD)] = parseInt(String(idC), 10);
          ocistiTraziEditPanelISelekteTablica();
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(jeZamjeni ? '004' : '001', []);
          }
          ucitajSvePodatke(null);
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

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var idD = CommonCRUD.getSelectedRowId(tablicaDuznostApi);
      if (idD == null) return;
      var idC = CommonCRUD.getSelectedRowId(tablicaOsobaApi);
      /* Briše se slog u sustav_korisnici za par (odabrana dužnost, odabrani nosioc). Odabir u tablici članova ima prednost; inače dodjela za tu dužnost. */
      var idKorisnikZaBrisanje;
      if (idC != null) {
        idKorisnikZaBrisanje = parseInt(String(idC), 10);
      } else {
        idKorisnikZaBrisanje = assignmentClanByDuznost[String(idD)];
      }
      if (idKorisnikZaBrisanje == null || isNaN(idKorisnikZaBrisanje)) return;
      if (typeof window.CommonPostFormData !== 'function') return;
      window.CommonPostFormData(API_BASE + 'Duznosnici_Osobe_CRUD_brisanje.php', {
        id_duznosnik: String(idD),
        id_clanovi: String(idKorisnikZaBrisanje)
      }, function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          if (String(assignmentClanByDuznost[String(idD)]) === String(idKorisnikZaBrisanje)) {
            delete assignmentClanByDuznost[String(idD)];
          }
          ocistiTraziEditPanelISelekteTablica();
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', []);
          ucitajSvePodatke(null);
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

  if (btnPovratak) {
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
        } catch (e2) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  }

  /* --- Blok: Modal – pregled dužnosti i korisnika (sustav_korisnici), kao ModalTablicaInit u drugim formama --- */
  var modalSustavPregledZaglavlje = [
    { key: 'duznost', title: 'Dužnost', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
    { key: 'osoba', title: 'Osoba', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];
  var modalSustavPregledApi = null;

  function ucitajSustavPregledZaModal(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Sustav_korisnici_modal_pregled.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            var naz = o.duznost_naziv != null ? String(o.duznost_naziv) : '';
            var os = o.osobe_txt != null ? String(o.osobe_txt) : '';
            var idD = o.id_duznosnik != null ? o.id_duznosnik : 0;
            rows.push([naz, os, idD]);
          }
        } catch (e1) {}
      } else if (text !== '' && text.charAt(0) !== '[') {
        showApiError(text);
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  if (typeof ModalTablicaInit === 'function') {
    modalSustavPregledApi = ModalTablicaInit({
      storageKey: 'duznosnici_osobe_sustav_korisnici_pregled',
      headerText: 'Dužnosti i korisnici sustava',
      getButtons: function () {
        return [
          {
            label: 'Zatvori',
            primary: true,
            className: 'kontrola-btn--crud-povratak',
            onClick: function () {
              if (modalSustavPregledApi) modalSustavPregledApi.close();
            }
          }
        ];
      }
    });
  }

  (function instalirajEllipsisModal() {
    var btn = document.getElementById('btn_edit_panel_ellipsis');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!modalSustavPregledApi) return;
      ucitajSustavPregledZaModal(function (rows) {
        modalSustavPregledApi.open({
          zaglavlje: modalSustavPregledZaglavlje,
          rows: rows,
          getRowId: function (row) {
            if (!row || row.length < 3) return null;
            return row[2];
          }
        });
      });
    });
  })();

  /* --- Blok: Visina panela (jednako oba) --- */
  function initPanelsHeightSync() {
    var row = document.querySelector('.duznosnici-osobe-crud__panels-row');
    if (!row) return;
    var panels = row.querySelectorAll('.duznosnici-osobe-crud__panel-tablica');
    if (panels.length < 2) return;
    var h = 0;
    for (var i = 0; i < panels.length; i++) {
      h = Math.max(h, panels[i].offsetHeight);
    }
    if (h > 0) {
      for (var j = 0; j < panels.length; j++) {
        panels[j].style.height = h + 'px';
      }
    }
  }

  /* Prag = @container duznosnici-osobe-panel (max-width: 480px) – viši min-height kad je Traži u dva reda (resize traka se ne siječe). */
  var DUZNOSNICI_PANEL_STACKED_MIN_W = 480;
  var DUZNOSNICI_PANEL_STACKED_MIN_CLASS = 'duznosnici-osobe-crud__panel--stacked-min';
  var duznosniciStackedMinRoTimer = null;
  var duznosniciStackedMinRo = null;

  function duznosniciApplyStackedMinClass(entry) {
    var el = entry.target;
    var w = entry.borderBoxSize && entry.borderBoxSize.length
      ? entry.borderBoxSize[0].inlineSize
      : entry.contentRect.width;
    if (w <= DUZNOSNICI_PANEL_STACKED_MIN_W) {
      el.classList.add(DUZNOSNICI_PANEL_STACKED_MIN_CLASS);
    } else {
      el.classList.remove(DUZNOSNICI_PANEL_STACKED_MIN_CLASS);
    }
  }

  function duznosniciSchedulePanelsHeightSync() {
    if (duznosniciStackedMinRoTimer) clearTimeout(duznosniciStackedMinRoTimer);
    duznosniciStackedMinRoTimer = setTimeout(function () {
      duznosniciStackedMinRoTimer = null;
      initPanelsHeightSync();
    }, 0);
  }

  function initDuznosniciPanelStackedMinObserver() {
    if (typeof ResizeObserver === 'undefined' || duznosniciStackedMinRo) return;
    var row = document.querySelector('.duznosnici-osobe-crud__panels-row');
    if (!row) return;
    var panels = row.querySelectorAll('.duznosnici-osobe-crud__panel-tablica');
    if (!panels.length) return;
    /*
     * Samo CSS klasa stacked-min (viši min-height kad je panel uskok). NE zvati initPanelsHeightSync ovdje:
     * initPanelsHeightSync radi max(offsetHeight) oba panela – nakon što korisnik smanji jedan, drugi je
     * još u jednom kadru veći pa max vraća staru visinu i poništava sinkron s 0-Kontrole (data-resize-sync-group).
     */
    duznosniciStackedMinRo = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        duznosniciApplyStackedMinClass(entries[i]);
      }
    });
    for (var j = 0; j < panels.length; j++) {
      duznosniciStackedMinRo.observe(panels[j]);
    }
    for (var k = 0; k < panels.length; k++) {
      var pw = panels[k].offsetWidth;
      if (pw <= DUZNOSNICI_PANEL_STACKED_MIN_W) {
        panels[k].classList.add(DUZNOSNICI_PANEL_STACKED_MIN_CLASS);
      } else {
        panels[k].classList.remove(DUZNOSNICI_PANEL_STACKED_MIN_CLASS);
      }
    }
    duznosniciSchedulePanelsHeightSync();
  }

  function duznosniciRunPanelLayoutSync() {
    setTimeout(initDuznosniciPanelStackedMinObserver, 0);
    setTimeout(initPanelsHeightSync, 0);
  }

  ucitajSustavVars1004I1002Osobe(function () {
    ucitajSvePodatke(function () {
      duznosniciRunPanelLayoutSync();
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { duznosniciRunPanelLayoutSync(); });
  } else {
    duznosniciRunPanelLayoutSync();
  }
})();
