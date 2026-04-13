/* =========================================================
   Duznosnici_Ogranicenja_CRUD.js
   Tablica ograničenja dužnosnika. Zaglavlje: Dužnosnik (select + reload), Država, Regija, Loža (edit + ellipsis).
   Tablica 1: Upis/izmjena (checkbox), Brisanje sloga (checkbox), Funkcionalnost.
   Tablica 2: Prikaz stupnjeva po obredu – Obred, ID dozvoljenih stupnjeva + ellipsis.
   Nacrt: pri ponovnom omogućenju Upisa vraća se zadnje lokalno stanje (edits, čekboxevi, stupnjevi); sessionStorage po dužnosniku; brisanje pri promjeni dužnosnika / reload.
   Upis: omogućen kad je odabran dužnosnik i stanje (geo, checkboxovi tablice 1, stupnjevi) razlikuje se od baselinea — i kad su sva geo polja prazna nakon brisanja „Sve”, da se može spremiti prazni zapis.
   CRUD tipke u podnožju drugog panela.
   API: Duznosnici_CRUD_sve.php (select), duznosnici_ogranicenja_sve.php (čitanje), duznosnici_ogranicenja_upis.php (Upis u bazu – jedini zapis ograničenja), stupnjevi_po_obredu + Obredi (tablica 2). Modal stupnjeva: samo lokalni paket do glavnog Upisa.
   ========================================================= */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Duznosnici_Ogranicenja_CRUD.html');

  /* Prije initPanelResizeBar (0-Kontrole): oba panela bez gornje JS kape po visini ekrana (data-resize-max-vh). */
  (function ensureResizeMaxVhNone() {
    var root = document.querySelector('.page-container.duznosnici-ogranicenja-crud');
    if (!root) return;
    var panels = root.querySelectorAll('.kontrola-panel--resize-y');
    for (var i = 0; i < panels.length; i++) {
      panels[i].setAttribute('data-resize-max-vh', 'none');
    }
  })();

  /* --- Blok: Konfiguracija tablice --- */
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
  const Duznosnici_OgranicenjaCRUD = {
    Broj_Kolona: 3,
    CrudCssPrefix: 'duznosnici-ogranicenja-crud',
    Tablica_Zaglavlje: [
      { key: 'Upi', title: '💾', SQL_Naziv: 'upis_izmjena', sortable: 0, sortable_icon: 0, type: 'b', width: 40, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 0 },
      { key: 'Brisi', title: '🗑️', SQL_Naziv: 'brisanje_sloga', sortable: 0, sortable_icon: 0, type: 'b', width: 40, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 0 },
      { key: 'funkcionalnost', title: 'Funkcionalnost', SQL_Naziv: 'funkcionalnost', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  /* --- Blok: Konfiguracija tablice „Prikaz stupnjeva po obredu“ --- */
  const Duznosnici_Ogranicenja_StupnjeviPoObredu = {
    Broj_Kolona: 2,
    CrudCssPrefix: 'duznosnici-ogranicenja-stupnjevi-po-obredu',
    Tablica_Zaglavlje: [
      { key: 'obred', title: 'Obred', SQL_Naziv: 'naziv', sortable: 0, sortable_icon: 0, type: 't', width: -50, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'id_stupnjeva', title: 'ID dozvoljenih stupnjeva', SQL_Naziv: 'id_stupnjeva', sortable: 0, sortable_icon: 0, type: 't', width: -50, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var tablicaStupnjeviPoObreduApi = null;
  var onCrudSelectionChange = null;
  /** { obredId: { tekst, id_stupnjeva } } – za drugi panel i modal (posljednji dohvat). */
  var stupnjeviPoObreduPaket = {};

  CommonCRUD.initTablica('tablicaContainer', Duznosnici_OgranicenjaCRUD, {
    getRowId: function (row) { return row && row.length > 3 ? row[3] : (row && row[2]); },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  CommonCRUD.initTablica('tablicaContainerStupnjeviPoObredu', Duznosnici_Ogranicenja_StupnjeviPoObredu, {
    getRowId: function (row) { return row && row.length > 2 ? row[2] : null; },
    onReady: function (api) { tablicaStupnjeviPoObreduApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var API_BASE = '../php/';
  /** Isti razdjelnik kao nakon „OK“ u modalima država / regija / loža. */
  var EDIT_POLJA_ID_RAZDJELNIK = ', ';
  /** null = još nije učitano; sadržaj sustav_varijable.id = 1001 (tipka „Sve“ kao Duznosnici_Prava_CRUD). */
  var cachedSustavVar1001Ogr = null;
  var sustav1001LoadingOgr = false;
  var sustav1001PendingCallbacksOgr = [];

  function ucitajSustavVar1001Ogr(callback) {
    if (cachedSustavVar1001Ogr !== null) {
      if (callback) callback();
      return;
    }
    if (typeof callback === 'function') sustav1001PendingCallbacksOgr.push(callback);
    if (sustav1001LoadingOgr) return;
    sustav1001LoadingOgr = true;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'common_sustav_varijable.php?id=1001', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = (xhr.responseText || '').trim();
      if (t === '120' || t === '100' || t === '401') cachedSustavVar1001Ogr = '0';
      else cachedSustavVar1001Ogr = t;
      sustav1001LoadingOgr = false;
      var cbs = sustav1001PendingCallbacksOgr.slice();
      sustav1001PendingCallbacksOgr = [];
      for (var i = 0; i < cbs.length; i++) try { cbs[i](); } catch (e) {}
    };
    xhr.send();
  }

  function updateFooterSveOgranicenja() {
    var btn = document.getElementById('btnSveOgranicenja');
    if (!btn) return;
    var sel = document.getElementById('select_duznosnik');
    var imaDuznosnika = sel && trim(sel.value) !== '';
    var prikazi = imaDuznosnika && cachedSustavVar1001Ogr !== null && String(cachedSustavVar1001Ogr).trim() === '1';
    if (prikazi) btn.removeAttribute('hidden');
    else btn.setAttribute('hidden', '');
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /* --- Modal tablica (samo ova forma): čekbox „Sve“ desno u zaglavlju – bez izmjene 0-Kontrole. --- */
  function ogranicenjaModalPostaviSveRetkeNaTablici(tableEl, sveUkljuceno) {
    if (!tableEl) return;
    var tbody = tableEl.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    var i;
    for (i = 0; i < rows.length; i++) {
      if (sveUkljuceno) rows[i].classList.add('tablica-row-selected');
      else rows[i].classList.remove('tablica-row-selected');
    }
    if (sveUkljuceno && rows.length > 0) tableEl.classList.add('kontrola-tablica--has-selected');
    else tableEl.classList.remove('kontrola-tablica--has-selected');
  }

  function ogranicenjaModalSyncCheckboxSTablicom(chk, tableEl) {
    if (!chk || !tableEl) return;
    var tbody = tableEl.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return;
    var all = tbody.querySelectorAll('tr');
    var n = all.length;
    var sel = tbody.querySelectorAll('tr.tablica-row-selected').length;
    if (n === 0) {
      chk.checked = false;
      chk.indeterminate = false;
      return;
    }
    if (sel === 0) {
      chk.checked = false;
      chk.indeterminate = false;
    } else if (sel === n) {
      chk.checked = true;
      chk.indeterminate = false;
    } else {
      chk.checked = false;
      chk.indeterminate = true;
    }
  }

  function ogranicenjaModalInicijalizirajSveUHeaderu() {
    var root = document.querySelector('.modal-tablica.modal-tablica--open');
    if (!root) return;
    var header = root.querySelector('.modal-tablica__header');
    var tableEl = root.querySelector('.modal-tablica__body .kontrola-tablica');
    if (!header || !tableEl) return;
    var chk = root.querySelector('.duznosnici-ogranicenja-crud__modal-sve-checkbox');
    if (!chk) {
      var frag = document.createDocumentFragment();
      while (header.firstChild) frag.appendChild(header.firstChild);
      var titleWrap = document.createElement('div');
      titleWrap.className = 'duznosnici-ogranicenja-crud__modal-header-title';
      while (frag.firstChild) titleWrap.appendChild(frag.firstChild);
      var sveWrap = document.createElement('div');
      sveWrap.className = 'duznosnici-ogranicenja-crud__modal-sve-wrap';
      sveWrap.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      sveWrap.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      var lbl = document.createElement('label');
      lbl.className = 'duznosnici-ogranicenja-crud__modal-sve-label';
      chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'kontrola-checkbox duznosnici-ogranicenja-crud__modal-sve-checkbox';
      chk.setAttribute('aria-label', 'Odaberi sve retke');
      var span = document.createElement('span');
      span.textContent = 'Sve';
      lbl.appendChild(chk);
      lbl.appendChild(span);
      sveWrap.appendChild(lbl);
      header.classList.add('duznosnici-ogranicenja-crud__modal-header--sve');
      header.appendChild(titleWrap);
      header.appendChild(sveWrap);
      chk.addEventListener('change', function () {
        var r = chk.closest('.modal-tablica');
        var tbl = r && r.querySelector('.modal-tablica__body .kontrola-tablica');
        if (!tbl) return;
        ogranicenjaModalPostaviSveRetkeNaTablici(tbl, chk.checked);
        chk.indeterminate = false;
      });
    }
    ogranicenjaModalSyncCheckboxSTablicom(chk, tableEl);
    if (!tableEl._duznOgranSveSyncBound) {
      tableEl._duznOgranSveSyncBound = true;
      tableEl.addEventListener('click', function () {
        requestAnimationFrame(function () {
          var r = tableEl.closest('.modal-tablica');
          if (!r || !r.classList.contains('modal-tablica--open')) return;
          var c = r.querySelector('.duznosnici-ogranicenja-crud__modal-sve-checkbox');
          if (c) ogranicenjaModalSyncCheckboxSTablicom(c, tableEl);
        });
      }, true);
    }
  }

  function omotajModalTablicaZOgranicenjaSveUHeaderu(api) {
    if (!api || typeof api.open !== 'function') return api;
    var origOpen = api.open;
    api.open = function (config) {
      origOpen.call(api, config);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          ogranicenjaModalInicijalizirajSveUHeaderu();
        });
      });
    };
    return api;
  }

  function ogranicenjaModalPrikupiIdsIzTableDom(tableEl) {
    if (!tableEl) return [];
    var sel = tableEl.querySelectorAll('.kontrola-tablica__scroll tbody tr.tablica-row-selected');
    var out = [];
    var k, id;
    for (k = 0; k < sel.length; k++) {
      id = sel[k].getAttribute('data-row-id');
      if (id != null && String(id).trim() !== '') out.push(String(id).trim());
    }
    return out;
  }

  /** Indeks selektiranih redaka + getData(): stupanj id u [2], država/regija/loža u [1]. */
  function ogranicenjaModalIdsIzPodataka(tablicaApi, idColIndex) {
    if (!tablicaApi || typeof tablicaApi.getSelectedIndices !== 'function' || typeof tablicaApi.getData !== 'function') return [];
    var ix = tablicaApi.getSelectedIndices();
    var rows = tablicaApi.getData();
    var out = [];
    var k, row, v, s;
    for (k = 0; k < ix.length; k++) {
      row = rows[ix[k]];
      if (!row) continue;
      v = row[idColIndex];
      if (v == null) continue;
      s = String(v).trim();
      if (s !== '' && s !== 'null' && s !== 'undefined') out.push(s);
    }
    return out;
  }

  /**
   * ID-jevi označenih redaka u modal-tablica: getSelectedRowIds → snimak s pointerdown na podnožje → DOM po svim otvorenim modalima → getSelectedIndices+getData.
   * idColIndex: 1 za [naziv, id] retke, 2 za modal stupnjeva [stupanj, naziv, id].
   */
  function ogranicenjaModalDohvatiSelektiraneRowIds(tablicaApi, idColIndex) {
    if (idColIndex == null || idColIndex === '') idColIndex = 1;
    var ids = tablicaApi && typeof tablicaApi.getSelectedRowIds === 'function' ? tablicaApi.getSelectedRowIds() : [];
    var out = [];
    var j, r, openList, tableEl, snap;
    if (ids && ids.length > 0) {
      for (j = 0; j < ids.length; j++) {
        var t = ids[j] != null ? String(ids[j]).trim() : '';
        if (t !== '' && t !== 'null' && t !== 'undefined') out.push(t);
      }
      if (out.length > 0) return out;
    }
    openList = document.querySelectorAll('.modal-tablica.modal-tablica--open');
    for (j = 0; j < openList.length; j++) {
      r = openList[j];
      if (r._duznOgranOdaberiSnapshot && r._duznOgranOdaberiSnapshot.length > 0) {
        snap = r._duznOgranOdaberiSnapshot.slice();
        r._duznOgranOdaberiSnapshot = null;
        return snap;
      }
    }
    for (j = 0; j < openList.length; j++) {
      tableEl = openList[j].querySelector('.modal-tablica__body .kontrola-tablica');
      out = ogranicenjaModalPrikupiIdsIzTableDom(tableEl);
      if (out.length > 0) return out;
    }
    return ogranicenjaModalIdsIzPodataka(tablicaApi, idColIndex);
  }

  (function ogranicenjaModalInstalirajSnapshotFooter() {
    function onDown(e) {
      var btn = e.target && e.target.closest && e.target.closest('.modal-tablica__footer button[type="button"]');
      var root = btn && btn.closest('.modal-tablica');
      if (!root || !root.classList.contains('modal-tablica--open')) return;
      root._duznOgranOdaberiSnapshot = ogranicenjaModalPrikupiIdsIzTableDom(root.querySelector('.modal-tablica__body .kontrola-tablica'));
    }
    /** Enter na tipki: često nema pointerdown; ne prepisuj dobar snimak praznim ako je selekcija već skinuta pri fokusu. */
    function onClickCap(e) {
      var btn = e.target && e.target.closest && e.target.closest('.modal-tablica__footer button[type="button"]');
      var root = btn && btn.closest('.modal-tablica');
      if (!root || !root.classList.contains('modal-tablica--open')) return;
      var cur = ogranicenjaModalPrikupiIdsIzTableDom(root.querySelector('.modal-tablica__body .kontrola-tablica'));
      if (cur.length > 0) root._duznOgranOdaberiSnapshot = cur;
    }
    if (typeof document === 'undefined') return;
    document.addEventListener('click', onClickCap, true);
    if (typeof PointerEvent !== 'undefined') {
      document.addEventListener('pointerdown', onDown, true);
    } else {
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('touchstart', onDown, { capture: true, passive: true });
    }
  })();

  /* --- Nacrt forme (država/regija/loža, čekboxevi, stupnjevi) – vraća se kad Upis ponovno postane omogućen --- */
  var NACRT_SESSION_PREFIX = 'duznosnici_ogranicenja_nacrt_v1_';
  var ogranicenjaNacrtMem = {};
  var prevCrudEnabled = false;
  /** Jednokratno: nakon „Sve“ ne vraćati nacrt iz sessiona (transToEn). */
  var ogranicenjaSkipNacrtRestoreOnce = false;
  var snimiNacrtTimer = null;
  /** Nakon učitavanja: JSON snapshot za usporedbu – Upis samo ako se trenutno stanje razlikuje. */
  var ogranicenjaUpisBaselineJson = null;
  var ogranicenjaBaselineSpreman = false;
  /** Broji završetak osvjeziTablicu + osvjeziTablicuStupnjevaPoObredu pri paru. */
  var ogranicenjaDvojniOsvjezAktivan = false;
  var ogranicenjaParLoadRemaining = 0;

  function ogranicenjaPocniDvojniOsvjez() {
    ogranicenjaBaselineSpreman = false;
    ogranicenjaDvojniOsvjezAktivan = true;
    ogranicenjaParLoadRemaining = 2;
  }

  function ogranicenjaZavrsiJedanOdDvaUcitavanja() {
    if (!ogranicenjaDvojniOsvjezAktivan) return;
    ogranicenjaParLoadRemaining -= 1;
    if (ogranicenjaParLoadRemaining > 0) return;
    ogranicenjaDvojniOsvjezAktivan = false;
    ogranicenjaParLoadRemaining = 0;
    postaviBaselineOgranicenja();
    ogranicenjaBaselineSpreman = true;
    azurirajEnabledZaglavlje();
  }

  function obrisiSveNacrteUObrasce() {
    ogranicenjaNacrtMem = {};
    prevCrudEnabled = false;
    ogranicenjaUpisBaselineJson = null;
    ogranicenjaBaselineSpreman = false;
    ogranicenjaDvojniOsvjezAktivan = false;
    ogranicenjaParLoadRemaining = 0;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        var keys = [];
        var i;
        for (i = 0; i < sessionStorage.length; i++) {
          var k = sessionStorage.key(i);
          if (k && k.indexOf(NACRT_SESSION_PREFIX) === 0) keys.push(k);
        }
        for (i = 0; i < keys.length; i++) sessionStorage.removeItem(keys[i]);
      }
    } catch (e) {}
  }

  function klonirajStupnjeviPaket(src) {
    var o = {};
    if (!src || typeof src !== 'object') return o;
    Object.keys(src).forEach(function (k) {
      var v = src[k];
      o[k] = {
        tekst: v && v.tekst != null ? String(v.tekst) : '',
        id_stupnjeva: Array.isArray(v && v.id_stupnjeva) ? v.id_stupnjeva.slice() : []
      };
    });
    return o;
  }

  /** Prva tablica: podaci u memoriji ne prate čekbox u DOM-u – čitamo iz tbody. */
  function dohvatiRedovePrveTabliceZaNacrt() {
    if (!tablicaApi || typeof tablicaApi.getData !== 'function') return [];
    var raw = tablicaApi.getData();
    var container = document.getElementById('tablicaContainer');
    var tbody = container && container.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return raw.map(function (row) { return row.slice(); });
    var out = [];
    var filled = [];
    var trs = tbody.querySelectorAll('tr');
    for (var t = 0; t < trs.length; t++) {
      var tr = trs[t];
      var ri = parseInt(tr.dataset.rowIndex, 10);
      if (isNaN(ri) || ri < 0 || ri >= raw.length) continue;
      var base = raw[ri].slice();
      var cells = tr.cells;
      for (var c = 0; c < cells.length; c++) {
        var chk = cells[c].querySelector('input.kontrola-checkbox[type="checkbox"]');
        if (chk) base[c] = chk.checked ? 1 : 0;
      }
      out[ri] = base;
      filled[ri] = true;
    }
    var merged = [];
    for (var r = 0; r < raw.length; r++) {
      merged.push(filled[r] && out[r] ? out[r] : raw[r].slice());
    }
    return merged;
  }

  /** Tekst (stupanj brojevi) + id_stupnjeva kao nakon PHP duznosnici_ogranicenja_stupnjevi_po_obredu. */
  function sastaviTekstStupnjevaZaPaketOdModala(selectedIds, modalRows) {
    var sel = {};
    for (var i = 0; i < (selectedIds || []).length; i++) sel[String(selectedIds[i])] = true;
    var pairs = [];
    for (var r = 0; r < (modalRows || []).length; r++) {
      var row = modalRows[r];
      if (!row || row.length < 3) continue;
      var rid = String(row[2]);
      if (!sel[rid]) continue;
      var stNum = parseInt(row[0], 10);
      if (isNaN(stNum)) stNum = 0;
      var idNum = parseInt(rid, 10);
      if (isNaN(idNum) || idNum <= 0) continue;
      pairs.push({ id: idNum, stupanj: stNum });
    }
    pairs.sort(function (a, b) {
      if (a.stupanj !== b.stupanj) return a.stupanj - b.stupanj;
      return a.id - b.id;
    });
    return {
      tekst: pairs.map(function (p) { return String(p.stupanj); }).join(', '),
      id_stupnjeva: pairs.map(function (p) { return String(p.id); })
    };
  }

  function osvjeziPrikazTabliceStupnjevaIzPaketa() {
    if (!tablicaStupnjeviPoObreduApi || typeof tablicaStupnjeviPoObreduApi.getData !== 'function') return;
    var cur = tablicaStupnjeviPoObreduApi.getData();
    var rows = [];
    for (var i = 0; i < cur.length; i++) {
      var row = cur[i].slice();
      var oid = row[2] != null ? String(row[2]) : '';
      var pack = oid ? stupnjeviPoObreduPaket[oid] : null;
      row[1] = pack && pack.tekst != null ? String(pack.tekst) : '';
      rows.push(row);
    }
    CommonCRUD.setDataTablica(tablicaStupnjeviPoObreduApi, 'tablicaContainerStupnjeviPoObredu', rows, Duznosnici_Ogranicenja_StupnjeviPoObredu.Tablica_Zaglavlje);
    scheduleUkrasiStupnjeviPoObreduDrugStupac();
  }

  function primijeniNacrtUTablicuStupnjeva(paket) {
    stupnjeviPoObreduPaket = klonirajStupnjeviPaket(paket);
    osvjeziPrikazTabliceStupnjevaIzPaketa();
  }

  function ucitajNacrtZaDuznosnika(idD) {
    if (!idD) return null;
    var key = String(idD);
    if (ogranicenjaNacrtMem[key]) return ogranicenjaNacrtMem[key];
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        var raw = sessionStorage.getItem(NACRT_SESSION_PREFIX + key);
        if (raw) {
          var o = JSON.parse(raw);
          if (o && typeof o === 'object') return o;
        }
      }
    } catch (e2) {}
    return null;
  }

  function snimiNacrtUOdmah(opts) {
    opts = opts || {};
    var idD = (selectDuznosnik && selectDuznosnik.value) ? String(selectDuznosnik.value).trim() : '';
    if (!idD || !tablicaApi) return;
    var ed = document.getElementById('edit_drzava');
    var er = document.getElementById('edit_regija');
    var el = document.getElementById('edit_loza');
    if (!ed || !er || !el) return;
    var geoAny = String(ed.value || '').trim() || String(er.value || '').trim() || String(el.value || '').trim();
    if (opts.requireLoza !== false && !geoAny) return;
    var draft = {
      drzava: ed.value != null ? String(ed.value) : '',
      regija: er.value != null ? String(er.value) : '',
      loza: el.value != null ? String(el.value) : '',
      tab1: dohvatiRedovePrveTabliceZaNacrt(),
      stupnjeviPaket: klonirajStupnjeviPaket(stupnjeviPoObreduPaket)
    };
    ogranicenjaNacrtMem[idD] = draft;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        sessionStorage.setItem(NACRT_SESSION_PREFIX + idD, JSON.stringify(draft));
      }
    } catch (e3) {}
  }

  function scheduleSnimiNacrt() {
    if (snimiNacrtTimer != null) clearTimeout(snimiNacrtTimer);
    snimiNacrtTimer = setTimeout(function () {
      snimiNacrtTimer = null;
      snimiNacrtUOdmah();
    }, 280);
  }

  function prikupiPayloadZaUpisOgranicenja() {
    var idD = (selectDuznosnik && selectDuznosnik.value) ? String(selectDuznosnik.value).trim() : '';
    var idNum = parseInt(idD, 10);
    if (!idD || isNaN(idNum) || idNum <= 0) return null;
    var ed = document.getElementById('edit_drzava');
    var er = document.getElementById('edit_regija');
    var el = document.getElementById('edit_loza');
    function parseIdList(str) {
      return String(str || '').split(',').map(function (s) { return trim(s); }).filter(Boolean).map(function (s) { return parseInt(s, 10); }).filter(function (n) { return !isNaN(n) && n > 0; });
    }
    var pravaRows = dohvatiRedovePrveTabliceZaNacrt();
    var prava = [];
    for (var i = 0; i < pravaRows.length; i++) {
      var row = pravaRows[i];
      var mid = row.length > 3 ? parseInt(row[3], 10) : NaN;
      if (isNaN(mid) || mid <= 0) continue;
      var u = row[0] === 1 || row[0] === true || row[0] === '1' ? 1 : 0;
      var b = row[1] === 1 || row[1] === true || row[1] === '1' ? 1 : 0;
      prava.push({ id: mid, upis_izmjena: u, brisanje_sloga: b });
    }
    var stPo = {};
    if (stupnjeviPoObreduPaket && typeof stupnjeviPoObreduPaket === 'object') {
      Object.keys(stupnjeviPoObreduPaket).forEach(function (k) {
        var p = stupnjeviPoObreduPaket[k];
        var ids = (p && Array.isArray(p.id_stupnjeva)) ? p.id_stupnjeva.map(function (x) { return parseInt(x, 10); }).filter(function (n) { return !isNaN(n) && n > 0; }) : [];
        stPo[k] = ids;
      });
    }
    return {
      id_duznosnik: idNum,
      id_drzave: parseIdList(ed ? ed.value : ''),
      id_regije: parseIdList(er ? er.value : ''),
      id_loze: parseIdList(el ? el.value : ''),
      prava: prava,
      stupnjevi_po_obredu: stPo
    };
  }

  function normalizirajPayloadZaUsporedbu(p) {
    if (!p || typeof p !== 'object') return '';
    function sortNum(a, b) { return a - b; }
    var dr = (p.id_drzave || []).slice().sort(sortNum);
    var re = (p.id_regije || []).slice().sort(sortNum);
    var lo = (p.id_loze || []).slice().sort(sortNum);
    var pr = (p.prava || []).map(function (x) {
      return {
        id: x.id,
        upis_izmjena: x.upis_izmjena ? 1 : 0,
        brisanje_sloga: x.brisanje_sloga ? 1 : 0
      };
    }).sort(function (a, b) { return a.id - b.id; });
    var stSrc = p.stupnjevi_po_obredu && typeof p.stupnjevi_po_obredu === 'object' ? p.stupnjevi_po_obredu : {};
    var stKeys = Object.keys(stSrc).map(function (k) { return String(k); }).sort(function (a, b) {
      return parseInt(a, 10) - parseInt(b, 10);
    });
    var st = {};
    stKeys.forEach(function (k) {
      var ids = (stSrc[k] || []).slice().sort(sortNum);
      st[k] = ids;
    });
    return JSON.stringify({
      id_duznosnik: p.id_duznosnik,
      id_drzave: dr,
      id_regije: re,
      id_loze: lo,
      prava: pr,
      stupnjevi_po_obredu: st
    });
  }

  function postaviBaselineOgranicenja() {
    var pl = prikupiPayloadZaUpisOgranicenja();
    if (!pl) {
      ogranicenjaUpisBaselineJson = null;
      return;
    }
    ogranicenjaUpisBaselineJson = normalizirajPayloadZaUsporedbu(pl);
  }

  /** true ako se stanje razlikuje od izvornog (geo + tablica 1 + stupnjevi u tablici 2). */
  function imaOgranicenjaNespremljenihIzmjena() {
    if (!ogranicenjaBaselineSpreman) return false;
    var pl = prikupiPayloadZaUpisOgranicenja();
    if (!pl || ogranicenjaUpisBaselineJson === null) return false;
    return normalizirajPayloadZaUsporedbu(pl) !== ogranicenjaUpisBaselineJson;
  }

  function primijeniNacrt(draft) {
    if (!draft || typeof draft !== 'object') return;
    var ed = document.getElementById('edit_drzava');
    var er = document.getElementById('edit_regija');
    var el = document.getElementById('edit_loza');
    /**
     * Ne prepisuj Država/Regija/Loža iz nacrta ako polje već ima vrijednost (npr. upravo iz modala).
     * Inače transToEn + stari prazan nacrt iz sessionStorage briše odabir prije nego što korisnik vidi promjenu.
     */
    function primijeniGeoPolje(inp, draftVal) {
      if (!inp || draftVal == null) return;
      if (String(inp.value || '').trim() !== '') return;
      inp.value = String(draftVal);
    }
    primijeniGeoPolje(ed, draft.drzava);
    primijeniGeoPolje(er, draft.regija);
    primijeniGeoPolje(el, draft.loza);
    if (tablicaApi && Array.isArray(draft.tab1) && typeof CommonCRUD.setDataTablica === 'function') {
      var tc = document.getElementById('tablicaContainer');
      var tbody = tc && tc.querySelector('.kontrola-tablica__scroll tbody');
      var rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;
      if (draft.tab1.length > 0 || rowCount === 0) {
        var rows1 = draft.tab1.map(function (row) { return row.slice(); });
        CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows1, Duznosnici_OgranicenjaCRUD.Tablica_Zaglavlje);
      }
    }
    var pak = draft.stupnjeviPaket || {};
    var hasPak = pak && typeof pak === 'object' && Object.keys(pak).length > 0;
    var stc = document.getElementById('tablicaContainerStupnjeviPoObredu');
    var stbody = stc && stc.querySelector('.kontrola-tablica__scroll tbody');
    var stRowCount = stbody ? stbody.querySelectorAll('tr').length : 0;
    if (hasPak || stRowCount === 0) primijeniNacrtUTablicuStupnjeva(pak);
  }

  /* --- Blok: Učitavanje dužnosnika u select --- */
  function ucitajDuznosnici(callback) {
    var API_BASE = '../php/';
    var url = API_BASE + 'Duznosnici_CRUD_sve.php';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) { if (callback) callback([]); return; }
      try {
        var arr = JSON.parse(xhr.responseText);
        arr = Array.isArray(arr) ? arr : [];
        var sel = document.getElementById('select_duznosnik');
        if (sel) {
          while (sel.options.length > 1) sel.remove(1);
          for (var i = 0; i < arr.length; i++) {
            var opt = document.createElement('option');
            opt.value = String(arr[i].id);
            opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
            sel.appendChild(opt);
          }
          if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_duznosnik');
        }
        if (callback) callback(arr);
      } catch (e) { if (callback) callback([]); }
    };
    xhr.send();
  }

  /* --- Blok: Zaglavlje (države/regije/lože iz duznosnici_ogranicenja) + prva tablica (prava) --- */
  function idsZaEditPolje(arr) {
    var list = [];
    if (Array.isArray(arr)) {
      list = arr;
    } else if (arr != null && typeof arr === 'string') {
      list = arr.split(',').map(function (s) { return trim(s); }).filter(Boolean);
    } else {
      return '';
    }
    return list.map(function (x) { return String(x); }).filter(function (s) { return s !== '' && s !== '0'; }).join(EDIT_POLJA_ID_RAZDJELNIK);
  }

  /** Pri promjeni dužnosnika: prvo prazno stanje (bez čekanja XHR), pa zasebno učitavanje za odabrani id. */
  function ocistiPrikazOgranicenjaPrijePromjeneDuznosnika() {
    var ed = document.getElementById('edit_drzava');
    var er = document.getElementById('edit_regija');
    var el = document.getElementById('edit_loza');
    if (ed) {
      ed.value = '';
      ed.dispatchEvent(new Event('input', { bubbles: true }));
      ed.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (er) {
      er.value = '';
      er.dispatchEvent(new Event('input', { bubbles: true }));
      er.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (el) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    stupnjeviPoObreduPaket = {};
    if (tablicaApi && typeof CommonCRUD.setDataTablica === 'function') {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], Duznosnici_OgranicenjaCRUD.Tablica_Zaglavlje);
    }
    if (tablicaStupnjeviPoObreduApi && typeof CommonCRUD.setDataTablica === 'function') {
      CommonCRUD.setDataTablica(tablicaStupnjeviPoObreduApi, 'tablicaContainerStupnjeviPoObredu', [], Duznosnici_Ogranicenja_StupnjeviPoObredu.Tablica_Zaglavlje);
    }
    scheduleUkrasiStupnjeviPoObreduDrugStupac();
    azurirajEnabledZaglavlje();
  }

  function osvjeziTablicu() {
    if (!tablicaApi || typeof CommonCRUD.setDataTablica !== 'function') {
      if (ogranicenjaDvojniOsvjezAktivan) ogranicenjaZavrsiJedanOdDvaUcitavanja();
      return;
    }
    var idDuznosnik = (selectDuznosnik && selectDuznosnik.value) ? String(selectDuznosnik.value).trim() : '';
    if (!idDuznosnik) {
      var ed0 = document.getElementById('edit_drzava');
      var er0 = document.getElementById('edit_regija');
      var el0 = document.getElementById('edit_loza');
      if (ed0) ed0.value = '';
      if (er0) er0.value = '';
      if (el0) el0.value = '';
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], Duznosnici_OgranicenjaCRUD.Tablica_Zaglavlje);
      azurirajEnabledZaglavlje();
      ogranicenjaZavrsiJedanOdDvaUcitavanja();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'duznosnici_ogranicenja_sve.php?id_duznosnik=' + encodeURIComponent(idDuznosnik), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '{') {
        try {
          var obj = JSON.parse(text || '{}');
          var ed = document.getElementById('edit_drzava');
          var er = document.getElementById('edit_regija');
          var el = document.getElementById('edit_loza');
          if (ed) {
            ed.value = idsZaEditPolje(obj.id_drzave);
            ed.dispatchEvent(new Event('input', { bubbles: true }));
            ed.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (er) {
            er.value = idsZaEditPolje(obj.id_regije);
            er.dispatchEvent(new Event('input', { bubbles: true }));
            er.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (el) {
            el.value = idsZaEditPolje(obj.id_loze);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          var arr = Array.isArray(obj.prava) ? obj.prava : [];
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            var u = o.upis_izmjena != null && (o.upis_izmjena === 1 || o.upis_izmjena === '1') ? 1 : 0;
            var b = o.brisanje_sloga != null && (o.brisanje_sloga === 1 || o.brisanje_sloga === '1') ? 1 : 0;
            rows.push([
              u,
              b,
              o.funkcionalnost != null ? o.funkcionalnost : '',
              o.id != null ? o.id : 0
            ]);
          }
        } catch (e) {}
      } else if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          var arrLegacy = JSON.parse(text || '[]');
          for (var j = 0; j < arrLegacy.length; j++) {
            var o2 = arrLegacy[j];
            var u2 = o2.upis_izmjena != null && (o2.upis_izmjena === 1 || o2.upis_izmjena === '1') ? 1 : 0;
            var b2 = o2.brisanje_sloga != null && (o2.brisanje_sloga === 1 || o2.brisanje_sloga === '1') ? 1 : 0;
            rows.push([
              u2,
              b2,
              o2.funkcionalnost != null ? o2.funkcionalnost : '',
              o2.id != null ? o2.id : 0
            ]);
          }
        } catch (e2) {}
      } else if (text !== '' && text.charAt(0) !== '{' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      }
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Duznosnici_OgranicenjaCRUD.Tablica_Zaglavlje);
      azurirajEnabledZaglavlje();
      ogranicenjaZavrsiJedanOdDvaUcitavanja();
      setTimeout(function () {
        var btnU = document.getElementById('btnUpisi');
        if (btnU && !btnU.disabled) snimiNacrtUOdmah();
      }, 0);
    };
    xhr.send();
  }

  /* --- Blok: Tablica stupnjeva po obredu – učitavanje obreda, ellipsis u 2. stupcu (bez izmjene 0-Kontrole) --- */
  function scheduleUkrasiStupnjeviPoObreduDrugStupac() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          ukrasiStupnjeviPoObreduDrugStupac();
        });
      });
    });
  }

  function ukrasiStupnjeviPoObreduDrugStupac() {
    var container = document.getElementById('tablicaContainerStupnjeviPoObredu');
    if (!container) return;
    var tbody = container.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return;
    var trList = tbody.querySelectorAll('tr');
    for (var r = 0; r < trList.length; r++) {
      var tr = trList[r];
      var cells = tr.cells;
      if (!cells || cells.length < 2) continue;
      var td = cells[1];
      var cellInner = td.querySelector('.kontrola-tablica__cell-inner');
      if (!cellInner) continue;
      if (cellInner.querySelector('.duznosnici-ogranicenja-crud__stupnjevi-ids-cell')) continue;
      var idsText = cellInner.textContent != null ? String(cellInner.textContent) : '';
      cellInner.textContent = '';
      var wrap = document.createElement('div');
      wrap.className = 'duznosnici-ogranicenja-crud__stupnjevi-ids-cell';
      var span = document.createElement('span');
      span.className = 'duznosnici-ogranicenja-crud__stupnjevi-ids-text';
      span.textContent = idsText;
      var obredId = tr.dataset.rowId != null ? String(tr.dataset.rowId) : '';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'duznosnici-ogranicenja-crud__stupnjevi-row-ellipsis-btn';
      btn.setAttribute('data-obred-id', obredId);
      btn.setAttribute('aria-label', 'Izbor dozvoljenih stupnjeva za obred');
      btn.setAttribute('title', 'Izbor stupnjeva');
      var icon = document.createElement('span');
      icon.className = 'kontrola-icon--ellipsis-horizontal';
      icon.setAttribute('aria-hidden', 'true');
      btn.appendChild(icon);
      wrap.appendChild(span);
      wrap.appendChild(btn);
      cellInner.appendChild(wrap);
      cellInner.setAttribute('tabindex', '0');
    }
  }

  function osvjeziTablicuStupnjevaPoObredu() {
    if (!tablicaStupnjeviPoObreduApi || typeof CommonCRUD.setDataTablica !== 'function') {
      if (ogranicenjaDvojniOsvjezAktivan) ogranicenjaZavrsiJedanOdDvaUcitavanja();
      return;
    }
    var idDuznosnik = (selectDuznosnik && selectDuznosnik.value) ? String(selectDuznosnik.value).trim() : '';
    if (!idDuznosnik) {
      stupnjeviPoObreduPaket = {};
      CommonCRUD.setDataTablica(tablicaStupnjeviPoObreduApi, 'tablicaContainerStupnjeviPoObredu', [], Duznosnici_Ogranicenja_StupnjeviPoObredu.Tablica_Zaglavlje);
      scheduleUkrasiStupnjeviPoObreduDrugStupac();
      if (ogranicenjaDvojniOsvjezAktivan) {
        ogranicenjaZavrsiJedanOdDvaUcitavanja();
      } else {
        postaviBaselineOgranicenja();
        ogranicenjaBaselineSpreman = true;
        azurirajEnabledZaglavlje();
      }
      return;
    }
    var obrediList = null;
    var stupnjeviMap = null;
    var pending = 2;
    function tryMerge() {
      pending -= 1;
      if (pending > 0) return;
      if (!Array.isArray(obrediList)) obrediList = [];
      if (!stupnjeviMap || typeof stupnjeviMap !== 'object') stupnjeviMap = {};
      stupnjeviPoObreduPaket = stupnjeviMap;
      var rows = [];
      for (var i = 0; i < obrediList.length; i++) {
        var o = obrediList[i];
        var oid = o.id != null ? String(o.id) : '';
        var pack = oid ? stupnjeviMap[oid] : null;
        var cell = pack && pack.tekst != null ? String(pack.tekst) : '';
        rows.push([o.naziv != null ? o.naziv : '', cell, o.id != null ? o.id : 0]);
      }
      CommonCRUD.setDataTablica(tablicaStupnjeviPoObreduApi, 'tablicaContainerStupnjeviPoObredu', rows, Duznosnici_Ogranicenja_StupnjeviPoObredu.Tablica_Zaglavlje);
      scheduleUkrasiStupnjeviPoObreduDrugStupac();
      if (ogranicenjaDvojniOsvjezAktivan) {
        ogranicenjaZavrsiJedanOdDvaUcitavanja();
      } else {
        postaviBaselineOgranicenja();
        ogranicenjaBaselineSpreman = true;
        azurirajEnabledZaglavlje();
      }
      setTimeout(function () {
        var btnU = document.getElementById('btnUpisi');
        if (btnU && !btnU.disabled) snimiNacrtUOdmah();
      }, 0);
    }
    var xhrO = new XMLHttpRequest();
    xhrO.open('GET', API_BASE + 'Obredi_CRUD_sve.php', true);
    xhrO.onreadystatechange = function () {
      if (xhrO.readyState !== 4) return;
      var text = (xhrO.responseText || '').trim();
      obrediList = [];
      if (xhrO.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          obrediList = JSON.parse(text || '[]');
          if (!Array.isArray(obrediList)) obrediList = [];
        } catch (e) { obrediList = []; }
      } else if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      }
      tryMerge();
    };
    xhrO.send();
    var xhrS = new XMLHttpRequest();
    xhrS.open('GET', API_BASE + 'duznosnici_ogranicenja_stupnjevi_po_obredu.php?id_duznosnik=' + encodeURIComponent(idDuznosnik), true);
    xhrS.onreadystatechange = function () {
      if (xhrS.readyState !== 4) return;
      var text = (xhrS.responseText || '').trim();
      stupnjeviMap = {};
      if (xhrS.status === 200 && text !== '' && text.charAt(0) === '{') {
        try {
          stupnjeviMap = JSON.parse(text || '{}');
          if (!stupnjeviMap || typeof stupnjeviMap !== 'object') stupnjeviMap = {};
        } catch (e2) { stupnjeviMap = {}; }
      } else if (text !== '' && text.charAt(0) !== '{') {
        var p2 = parseResponseCode(text);
        if (p2 && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p2.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(p2.code, p2.replacements);
        }
      }
      tryMerge();
    };
    xhrS.send();
  }

  /* Modal: izbor stupnjeva po obredu – lokalno u stupnjeviPoObreduPaket; baza tek glavnom tipkom Upis (duznosnici_ogranicenja_upis.php). */
  var currentDuznosnikStupnjeviModal = { idDuznosnik: null, obredId: null };
  var modalStupnjeviObredZaglavlje = [
    { key: 'stupanj', title: 'Stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
    { key: 'naziv', title: 'Naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];
  var modalStupnjeviObredApi = null;

  function ucitajStupnjeviZaModalDuznosnik(obredId, callback) {
    if (!obredId || trim(String(obredId)) === '') { if (callback) callback([]); return; }
    var url = API_BASE + 'Stupnjevi_CRUD_sve.php?obred_id=' + encodeURIComponent(obredId);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            rows.push([
              o.stupanj != null ? o.stupanj : '',
              o.naziv != null ? o.naziv : '',
              o.id != null ? o.id : 0
            ]);
          }
        } catch (e) {}
      } else if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function otvoriModalStupnjevaZaObred(idDuznosnikStr, obredIdStr) {
    var idD = idDuznosnikStr != null ? String(idDuznosnikStr).trim() : '';
    var idO = obredIdStr != null ? String(obredIdStr).trim() : '';
    if (!idD || !idO) return;
    currentDuznosnikStupnjeviModal.idDuznosnik = parseInt(idD, 10);
    currentDuznosnikStupnjeviModal.obredId = parseInt(idO, 10);
    if (isNaN(currentDuznosnikStupnjeviModal.idDuznosnik) || currentDuznosnikStupnjeviModal.idDuznosnik <= 0) return;
    if (isNaN(currentDuznosnikStupnjeviModal.obredId) || currentDuznosnikStupnjeviModal.obredId <= 0) return;
    var pack = stupnjeviPoObreduPaket[idO];
    var selectedIds = (pack && Array.isArray(pack.id_stupnjeva)) ? pack.id_stupnjeva.slice() : [];
    ucitajStupnjeviZaModalDuznosnik(idO, function (rows) {
      if (modalStupnjeviObredApi) {
        modalStupnjeviObredApi.open({
          zaglavlje: modalStupnjeviObredZaglavlje,
          rows: rows,
          multiSelect: true,
          getRowId: function (row) { return row && row[2] != null ? row[2] : null; },
          selectedRowIds: selectedIds
        });
      }
    });
  }

  if (typeof ModalTablicaInit === 'function') {
    modalStupnjeviObredApi = omotajModalTablicaZOgranicenjaSveUHeaderu(ModalTablicaInit({
      storageKey: 'duznosnici_ogranicenja_stupnjevi_obred',
      headerText: 'Izbor dozvoljenih stupnjeva',
      getButtons: function () {
        return [
          {
            label: 'OK',
            primary: true,
            className: 'kontrola-btn--crud-upisi',
            onClick: function (tablicaApi) {
              var idOb = currentDuznosnikStupnjeviModal.obredId;
              if (idOb == null || idOb <= 0) return;
              var ids = ogranicenjaModalDohvatiSelektiraneRowIds(tablicaApi, 2);
              var rows = tablicaApi && typeof tablicaApi.getData === 'function' ? tablicaApi.getData() : [];
              var idOstr = String(idOb);
              if (!ids || ids.length === 0) {
                delete stupnjeviPoObreduPaket[idOstr];
              } else {
                stupnjeviPoObreduPaket[idOstr] = sastaviTekstStupnjevaZaPaketOdModala(ids, rows);
              }
              if (modalStupnjeviObredApi) modalStupnjeviObredApi.close();
              osvjeziPrikazTabliceStupnjevaIzPaketa();
              azurirajEnabledZaglavlje();
              scheduleSnimiNacrt();
            }
          },
          {
            label: 'Odustani',
            className: 'kontrola-btn--crud-povratak',
            onClick: function () {
              if (modalStupnjeviObredApi) modalStupnjeviObredApi.close();
            }
          }
        ];
      }
    }));
  }

  /* --- Blok: Kaskadno omogućavanje – Dužnosnik → samo Država; Država → Regija; Regija → Loža;
      Upis: odabran dužnosnik + razlika od baselinea (ne zahtijeva crudEnabled — prazan geo nakon „Sve” i dalje je valjana nespremljena izmjena).
      Izbriši: barem jedno od Država / Regija / Loža (ne moraju sva tri).
      Nacrt: prijelaz CRUD isključen → uključen vraća zadnje lokalno stanje (edits, čekboxevi, stupnjevi). --- */
  function azurirajEnabledZaglavlje() {
    var idDuznosnik = (selectDuznosnik && selectDuznosnik.value) ? String(selectDuznosnik.value).trim() : '';
    var editDrzava = document.getElementById('edit_drzava');
    var editRegija = document.getElementById('edit_regija');
    var editLoza = document.getElementById('edit_loza');
    function citajStanje() {
      var hasDrzava = editDrzava && String(editDrzava.value || '').trim().length > 0;
      var hasRegija = editRegija && String(editRegija.value || '').trim().length > 0;
      var hasLoza = editLoza && String(editLoza.value || '').trim().length > 0;
      var drzavaEnabled = idDuznosnik.length > 0;
      var regijaEnabled = drzavaEnabled && hasDrzava;
      var lozaEnabled = regijaEnabled && hasRegija;
      var crudEnabled = drzavaEnabled && (hasDrzava || hasRegija || hasLoza);
      return {
        hasDrzava: hasDrzava,
        hasRegija: hasRegija,
        hasLoza: hasLoza,
        drzavaEnabled: drzavaEnabled,
        regijaEnabled: regijaEnabled,
        lozaEnabled: lozaEnabled,
        crudEnabled: crudEnabled
      };
    }
    function primijeniUI(s) {
      var btnReloadTablica = document.getElementById('btn_reload_tablica');
      var btnIzborDrzave = document.getElementById('btn_izbor_drzave');
      var btnIzborRegije = document.getElementById('btn_izbor_regije');
      var btnIzborLoze = document.getElementById('btn_izbor_loze');
      var btnUpisi = document.getElementById('btnUpisi');
      var btnIzbrisi = document.getElementById('btnIzbrisi');
      var labelDrzava = document.querySelector('label[for="edit_drzava"]');
      var labelRegija = document.querySelector('label[for="edit_regija"]');
      var labelLoza = document.querySelector('label[for="edit_loza"]');
      if (btnReloadTablica) btnReloadTablica.disabled = !s.drzavaEnabled;
      if (editDrzava) editDrzava.disabled = !s.drzavaEnabled;
      if (editRegija) editRegija.disabled = !s.regijaEnabled;
      if (editLoza) editLoza.disabled = !s.lozaEnabled;
      if (btnIzborDrzave) btnIzborDrzave.disabled = !s.drzavaEnabled;
      if (btnIzborRegije) btnIzborRegije.disabled = !s.regijaEnabled;
      if (btnIzborLoze) btnIzborLoze.disabled = !s.lozaEnabled;
      if (btnUpisi) btnUpisi.disabled = !s.drzavaEnabled || !imaOgranicenjaNespremljenihIzmjena();
      if (btnIzbrisi) btnIzbrisi.disabled = !s.crudEnabled;
      if (labelDrzava) labelDrzava.classList.toggle('kontrola-labela--disabled', !s.drzavaEnabled);
      if (labelRegija) labelRegija.classList.toggle('kontrola-labela--disabled', !s.regijaEnabled);
      if (labelLoza) labelLoza.classList.toggle('kontrola-labela--disabled', !s.lozaEnabled);
      var tablicaContainer = document.getElementById('tablicaContainer');
      if (tablicaContainer) tablicaContainer.classList.toggle('kontrola-tablica--disabled', !s.drzavaEnabled);
      var tablicaStupnjevi = document.getElementById('tablicaContainerStupnjeviPoObredu');
      if (tablicaStupnjevi) tablicaStupnjevi.classList.toggle('kontrola-tablica--disabled', !s.drzavaEnabled);
    }
    var s0 = citajStanje();
    primijeniUI(s0);
    var transToEn = s0.crudEnabled && !prevCrudEnabled;
    if (ogranicenjaSkipNacrtRestoreOnce) {
      ogranicenjaSkipNacrtRestoreOnce = false;
      transToEn = false;
    }
    if (transToEn && idDuznosnik) {
      var nacrt = ucitajNacrtZaDuznosnika(idDuznosnik);
      if (nacrt) primijeniNacrt(nacrt);
      s0 = citajStanje();
      primijeniUI(s0);
    }
    if (prevCrudEnabled && !s0.crudEnabled && idDuznosnik) {
      snimiNacrtUOdmah({ requireLoza: false });
    }
    prevCrudEnabled = s0.crudEnabled;
    if (s0.crudEnabled && idDuznosnik) scheduleSnimiNacrt();
    var selFoot = document.getElementById('select_duznosnik');
    if (selFoot && trim(selFoot.value) !== '') {
      ucitajSustavVar1001Ogr(updateFooterSveOgranicenja);
    } else {
      updateFooterSveOgranicenja();
    }
  }

  var selectDuznosnik = document.getElementById('select_duznosnik');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var editDrzava = document.getElementById('edit_drzava');
  var editRegija = document.getElementById('edit_regija');
  var editLoza = document.getElementById('edit_loza');

  /* --- Blok: Modal – Izbor države (otvara se klikom na elipsis Država) --- */
  var modalDrzavaZaglavlje = [
    { key: 'naziv', title: 'Naziv države', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];
  var modalDrzavaApi = null;

  function ucitajDrzaveZaModal(callback) {
    var url = API_BASE + 'Drzave_CRUD_sve.php';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            rows.push([o.naziv != null ? o.naziv : '', o.id != null ? o.id : 0]);
          }
        } catch (e) {}
      } else if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  if (typeof ModalTablicaInit === 'function') {
    modalDrzavaApi = omotajModalTablicaZOgranicenjaSveUHeaderu(ModalTablicaInit({
      storageKey: 'duznosnici_ogranicenja_izbor_drzave',
      headerText: 'Izbor države',
      getButtons: function () {
        return [
          {
            label: 'OK',
            primary: true,
            className: 'kontrola-btn--crud-upisi',
            onClick: function (tablicaApi) {
              var ids = ogranicenjaModalDohvatiSelektiraneRowIds(tablicaApi, 1);
              if (ids.length === 0) return;
              var edDrzava = document.getElementById('edit_drzava');
              var edRegija = document.getElementById('edit_regija');
              var edLoza = document.getElementById('edit_loza');
              if (edDrzava) {
                edDrzava.value = ids.join(EDIT_POLJA_ID_RAZDJELNIK);
                edDrzava.dispatchEvent(new Event('input', { bubbles: true }));
                edDrzava.dispatchEvent(new Event('change', { bubbles: true }));
              }
              if (edRegija) edRegija.value = '';
              if (edLoza) edLoza.value = '';
              if (modalDrzavaApi) modalDrzavaApi.close();
              azurirajEnabledZaglavlje();
            }
          },
          {
            label: 'Odustani',
            className: 'kontrola-btn--crud-povratak',
            onClick: function () {
              if (modalDrzavaApi) modalDrzavaApi.close();
            }
          }
        ];
      }
    }));
  }

  (function () {
    var btnIzborDrzave = document.getElementById('btn_izbor_drzave');
    if (!btnIzborDrzave) return;
    btnIzborDrzave.addEventListener('click', function () {
      if (this.disabled) return;
      ucitajDrzaveZaModal(function (rows) {
        if (modalDrzavaApi) {
          var currentVal = editDrzava && editDrzava.value ? trim(editDrzava.value) : '';
          var selectedIds = currentVal ? currentVal.split(',').map(function (s) { return trim(s); }).filter(Boolean) : [];
          modalDrzavaApi.open({
            zaglavlje: modalDrzavaZaglavlje,
            rows: rows,
            multiSelect: true,
            getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
            selectedRowIds: selectedIds
          });
        }
      });
    });
  })();

  /* --- Blok: Modal – Izbor regija (otvara se klikom na elipsis Regija, ovisno o izabranim državama) --- */
  var modalRegijaZaglavlje = [
    { key: 'naziv', title: 'Regija', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];
  var modalRegijaApi = null;

  function ucitajRegijeZaModal(idDrzavaList, callback) {
    if (!idDrzavaList || String(idDrzavaList).trim() === '') { if (callback) callback([]); return; }
    var idParam = String(idDrzavaList).split(',').map(function (s) { return trim(s); }).filter(Boolean).join(',');
    if (!idParam) { if (callback) callback([]); return; }
    var url = API_BASE + 'Regije_CRUD_sve_drzave.php?id_drzava=' + encodeURIComponent(idParam);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          var multipleDrzave = (idParam.indexOf(',') >= 0);
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            var naziv = o.naziv != null ? o.naziv : '';
            var drzava = o.drzava_naziv != null ? o.drzava_naziv : '';
            var display = (multipleDrzave && drzava) ? naziv + ', ' + drzava : naziv;
            rows.push([display, o.id != null ? o.id : 0]);
          }
        } catch (e) {}
      } else if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  if (typeof ModalTablicaInit === 'function') {
    modalRegijaApi = omotajModalTablicaZOgranicenjaSveUHeaderu(ModalTablicaInit({
      storageKey: 'duznosnici_ogranicenja_izbor_regija',
      headerText: 'Izbor regija',
      getButtons: function () {
        return [
          {
            label: 'OK',
            primary: true,
            className: 'kontrola-btn--crud-upisi',
            onClick: function (tablicaApi) {
              var ids = ogranicenjaModalDohvatiSelektiraneRowIds(tablicaApi, 1);
              if (ids.length === 0) return;
              var edRegija = document.getElementById('edit_regija');
              var edLoza = document.getElementById('edit_loza');
              if (edRegija) {
                edRegija.value = ids.join(EDIT_POLJA_ID_RAZDJELNIK);
                edRegija.dispatchEvent(new Event('input', { bubbles: true }));
                edRegija.dispatchEvent(new Event('change', { bubbles: true }));
              }
              if (edLoza) {
                edLoza.value = '';
                edLoza.dispatchEvent(new Event('input', { bubbles: true }));
                edLoza.dispatchEvent(new Event('change', { bubbles: true }));
              }
              if (modalRegijaApi) modalRegijaApi.close();
              azurirajEnabledZaglavlje();
            }
          },
          {
            label: 'Odustani',
            className: 'kontrola-btn--crud-povratak',
            onClick: function () {
              if (modalRegijaApi) modalRegijaApi.close();
            }
          }
        ];
      }
    }));
  }

  (function () {
    var btnIzborRegije = document.getElementById('btn_izbor_regije');
    if (!btnIzborRegije) return;
    btnIzborRegije.addEventListener('click', function () {
      if (this.disabled) return;
      var idDrzava = editDrzava && editDrzava.value ? trim(editDrzava.value) : '';
      if (!idDrzava) return;
      ucitajRegijeZaModal(idDrzava, function (rows) {
        if (modalRegijaApi) {
          var currentVal = editRegija && editRegija.value ? trim(editRegija.value) : '';
          var selectedIds = currentVal ? currentVal.split(',').map(function (s) { return trim(s); }).filter(Boolean) : [];
          modalRegijaApi.open({
            zaglavlje: modalRegijaZaglavlje,
            rows: rows,
            multiSelect: true,
            getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
            selectedRowIds: selectedIds
          });
        }
      });
    });
  })();

  /* --- Blok: Modal – Izbor loža (otvara se klikom na elipsis Loža, ovisno o izabranim regijama) --- */
  var modalLozaZaglavlje = [
    { key: 'naziv', title: 'Loža', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];
  var modalLozaApi = null;

  function ucitajLozeZaModal(idRegijaList, callback) {
    if (!idRegijaList || String(idRegijaList).trim() === '') { if (callback) callback([]); return; }
    var idParam = String(idRegijaList).split(',').map(function (s) { return trim(s); }).filter(Boolean).join(',');
    if (!idParam) { if (callback) callback([]); return; }
    var url = API_BASE + 'Loze_CRUD_sve_regije.php?id_regija=' + encodeURIComponent(idParam);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          var multipleRegije = (idParam.indexOf(',') >= 0);
          var multipleDrzave = editDrzava && editDrzava.value && String(editDrzava.value).split(',').map(function (s) { return trim(s); }).filter(Boolean).length > 1;
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            var naziv = o.naziv != null ? o.naziv : '';
            var regija = o.regija_naziv != null ? o.regija_naziv : '';
            var drzava = o.drzava_naziv != null ? o.drzava_naziv : '';
            var parts = [naziv];
            if (multipleRegije && regija) parts.push(regija);
            if (multipleDrzave && drzava) parts.push(drzava);
            rows.push([parts.join(', '), o.id != null ? o.id : 0]);
          }
        } catch (e) {}
      } else if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  if (typeof ModalTablicaInit === 'function') {
    modalLozaApi = omotajModalTablicaZOgranicenjaSveUHeaderu(ModalTablicaInit({
      storageKey: 'duznosnici_ogranicenja_izbor_loza',
      headerText: 'Izbor loža',
      getButtons: function () {
        return [
          {
            label: 'OK',
            primary: true,
            className: 'kontrola-btn--crud-upisi',
            onClick: function (tablicaApi) {
              var ids = ogranicenjaModalDohvatiSelektiraneRowIds(tablicaApi, 1);
              if (ids.length === 0) return;
              var edLoza = document.getElementById('edit_loza');
              if (edLoza) {
                edLoza.value = ids.join(EDIT_POLJA_ID_RAZDJELNIK);
                edLoza.dispatchEvent(new Event('input', { bubbles: true }));
                edLoza.dispatchEvent(new Event('change', { bubbles: true }));
              }
              if (modalLozaApi) modalLozaApi.close();
              azurirajEnabledZaglavlje();
            }
          },
          {
            label: 'Odustani',
            className: 'kontrola-btn--crud-povratak',
            onClick: function () {
              if (modalLozaApi) modalLozaApi.close();
            }
          }
        ];
      }
    }));
  }

  (function () {
    var btnIzborLoze = document.getElementById('btn_izbor_loze');
    if (!btnIzborLoze) return;
    btnIzborLoze.addEventListener('click', function () {
      if (this.disabled) return;
      var idRegija = editRegija && editRegija.value ? trim(editRegija.value) : '';
      if (!idRegija) return;
      ucitajLozeZaModal(idRegija, function (rows) {
        if (modalLozaApi) {
          var currentVal = editLoza && editLoza.value ? trim(editLoza.value) : '';
          var selectedIds = currentVal ? currentVal.split(',').map(function (s) { return trim(s); }).filter(Boolean) : [];
          modalLozaApi.open({
            zaglavlje: modalLozaZaglavlje,
            rows: rows,
            multiSelect: true,
            getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
            selectedRowIds: selectedIds
          });
        }
      });
    });
  })();

  /** Lanac: sve države → sve regije (za te države) → sve lože (za te regije), kao ručni odabir u modalima. */
  function popuniSveGeoOgranicenjaOgr(callback) {
    ucitajDrzaveZaModal(function (rows) {
      var ed = document.getElementById('edit_drzava');
      var er = document.getElementById('edit_regija');
      var el = document.getElementById('edit_loza');
      var idsD = [];
      for (var i = 0; i < rows.length; i++) {
        var id = rows[i] && rows[i][1];
        if (id != null && String(id).trim() !== '') idsD.push(String(id).trim());
      }
      if (er) {
        er.value = '';
        er.dispatchEvent(new Event('input', { bubbles: true }));
        er.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (el) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (ed) {
        ed.value = idsD.join(EDIT_POLJA_ID_RAZDJELNIK);
        ed.dispatchEvent(new Event('input', { bubbles: true }));
        ed.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (idsD.length === 0) {
        if (callback) callback();
        return;
      }
      ucitajRegijeZaModal(idsD.join(','), function (rowsR) {
        var idsR = [];
        for (var j = 0; j < rowsR.length; j++) {
          var idr = rowsR[j] && rowsR[j][1];
          if (idr != null && String(idr).trim() !== '') idsR.push(String(idr).trim());
        }
        if (er) {
          er.value = idsR.join(EDIT_POLJA_ID_RAZDJELNIK);
          er.dispatchEvent(new Event('input', { bubbles: true }));
          er.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (el) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (idsR.length === 0) {
          if (callback) callback();
          return;
        }
        ucitajLozeZaModal(idsR.join(','), function (rowsL) {
          var idsL = [];
          for (var k = 0; k < rowsL.length; k++) {
            var idl = rowsL[k] && rowsL[k][1];
            if (idl != null && String(idl).trim() !== '') idsL.push(String(idl).trim());
          }
          if (el) {
            el.value = idsL.join(EDIT_POLJA_ID_RAZDJELNIK);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (callback) callback();
        });
      });
    });
  }

  /** Omogućeni checkboxovi prve tablice (oba stupca). */
  function sveCheckboxePrvaTablicaStanjeOgr() {
    var container = document.getElementById('tablicaContainer');
    var arr = [];
    if (container) {
      var list = container.querySelectorAll('tbody input.kontrola-checkbox[type="checkbox"]');
      for (var i = 0; i < list.length; i++) {
        if (!list[i].disabled) arr.push(list[i]);
      }
    }
    if (!arr.length) {
      return { list: arr, sviUkljuceni: false, nemaCheckboxova: true };
    }
    return {
      list: arr,
      sviUkljuceni: arr.every(function (c) { return c.checked; }),
      nemaCheckboxova: false
    };
  }

  /** Prazni države/regije/lože i paket stupnjeva po obredima (druga tablica). */
  function ocistiGeoIStupnjeveKadSveOdznacenoOgr() {
    var ed = document.getElementById('edit_drzava');
    var er = document.getElementById('edit_regija');
    var el = document.getElementById('edit_loza');
    if (ed) {
      ed.value = '';
      ed.dispatchEvent(new Event('input', { bubbles: true }));
      ed.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (er) {
      er.value = '';
      er.dispatchEvent(new Event('input', { bubbles: true }));
      er.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (el) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    stupnjeviPoObreduPaket = {};
    osvjeziPrikazTabliceStupnjevaIzPaketa();
  }

  /** Ako su svi relevantni checkboxovi u prvoj tablici uključeni → isključi sve, inače uključi sve (oba stupca). */
  function toggleSveCheckboxePrvaTablicaOgranicenja() {
    var st = sveCheckboxePrvaTablicaStanjeOgr();
    if (st.nemaCheckboxova || !st.list.length) return;
    var svi = st.sviUkljuceni;
    for (var j = 0; j < st.list.length; j++) st.list[j].checked = !svi;
  }

  /** Za svaki obred u tablici stupnjeva: paket kao da su u modalu odabrani svi stupnjevi. */
  function primijeniSveStupnjevePoObredimaOgr(callback) {
    if (!tablicaStupnjeviPoObreduApi || typeof tablicaStupnjeviPoObreduApi.getData !== 'function') {
      if (callback) callback();
      return;
    }
    var data = tablicaStupnjeviPoObreduApi.getData();
    var obredIds = [];
    var seen = {};
    for (var r = 0; r < data.length; r++) {
      var oid = data[r] && data[r][2];
      if (oid == null) continue;
      var ks = String(oid).trim();
      if (ks === '' || seen[ks]) continue;
      var n = parseInt(ks, 10);
      if (isNaN(n) || n <= 0) continue;
      seen[ks] = true;
      obredIds.push(ks);
    }
    if (obredIds.length === 0) {
      if (callback) callback();
      return;
    }
    var remaining = obredIds.length;
    function tryDone() {
      remaining -= 1;
      if (remaining <= 0) {
        osvjeziPrikazTabliceStupnjevaIzPaketa();
        if (callback) callback();
      }
    }
    for (var k = 0; k < obredIds.length; k++) {
      (function (oidStr) {
        ucitajStupnjeviZaModalDuznosnik(oidStr, function (modalRows) {
          var allIds = [];
          for (var m = 0; m < modalRows.length; m++) {
            var rid = modalRows[m] && modalRows[m][2];
            if (rid != null && String(rid).trim() !== '') allIds.push(String(rid).trim());
          }
          if (allIds.length === 0) {
            delete stupnjeviPoObreduPaket[oidStr];
          } else {
            stupnjeviPoObreduPaket[oidStr] = sastaviTekstStupnjevaZaPaketOdModala(allIds, modalRows);
          }
          tryDone();
        });
      })(obredIds[k]);
    }
  }

  (function () {
    var btnSve = document.getElementById('btnSveOgranicenja');
    if (!btnSve) return;
    btnSve.addEventListener('click', function () {
      if (btnSve.hasAttribute('hidden')) return;
      var sel = document.getElementById('select_duznosnik');
      if (!sel || trim(sel.value) === '') return;
      var st = sveCheckboxePrvaTablicaStanjeOgr();
      /* Drugi klik „Sve”: svi checkboxovi bili uključeni → odčekiraj sve i očisti geo + stupnjeve. */
      if (!st.nemaCheckboxova && st.sviUkljuceni) {
        toggleSveCheckboxePrvaTablicaOgranicenja();
        ocistiGeoIStupnjeveKadSveOdznacenoOgr();
        ogranicenjaSkipNacrtRestoreOnce = true;
        azurirajEnabledZaglavlje();
        scheduleSnimiNacrt();
        return;
      }
      popuniSveGeoOgranicenjaOgr(function () {
        toggleSveCheckboxePrvaTablicaOgranicenja();
        primijeniSveStupnjevePoObredimaOgr(function () {
          ogranicenjaSkipNacrtRestoreOnce = true;
          azurirajEnabledZaglavlje();
          scheduleSnimiNacrt();
        });
      });
    });
  })();

  onCrudSelectionChange = function () {
    azurirajEnabledZaglavlje();
  };

  if (btnReloadTablica) {
    btnReloadTablica.addEventListener('click', function () {
      ogranicenjaPocniDvojniOsvjez();
      osvjeziTablicu();
      osvjeziTablicuStupnjevaPoObredu();
    });
  }

  (function () {
    var btnUpisi = document.getElementById('btnUpisi');
    if (!btnUpisi) return;
    btnUpisi.addEventListener('click', function () {
      if (this.disabled) return;
      var payload = prikupiPayloadZaUpisOgranicenja();
      if (!payload) return;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + 'duznosnici_ogranicenja_upis.php', true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var res = (xhr.responseText || '').trim();
        if (res === 'OK') {
          obrisiSveNacrteUObrasce();
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', []);
          ogranicenjaPocniDvojniOsvjez();
          osvjeziTablicu();
          osvjeziTablicuStupnjevaPoObredu();
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements);
          }
        }
      };
      xhr.send(JSON.stringify(payload));
    });
  })();

  if (selectDuznosnik) {
    selectDuznosnik.addEventListener('change', function () {
      ocistiPrikazOgranicenjaPrijePromjeneDuznosnika();
      ogranicenjaPocniDvojniOsvjez();
      osvjeziTablicu();
      osvjeziTablicuStupnjevaPoObredu();
    });
  }

  /* --- Blok: Delegacija – ellipsis → modal stupnjeva (kao Loze_Tip) --- */
  (function () {
    var el = document.getElementById('tablicaContainerStupnjeviPoObredu');
    if (!el) return;
    el.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.duznosnici-ogranicenja-crud__stupnjevi-row-ellipsis-btn') : null;
      if (!btn || !el.contains(btn)) return;
      if (el.classList.contains('kontrola-tablica--disabled')) return;
      e.stopPropagation();
      e.preventDefault();
      var idDuznosnik = (selectDuznosnik && selectDuznosnik.value) ? String(selectDuznosnik.value).trim() : '';
      var obredId = btn.getAttribute('data-obred-id');
      otvoriModalStupnjevaZaObred(idDuznosnik, obredId);
    });
  })();
  [editDrzava, editRegija, editLoza].forEach(function (el) {
    if (el) { el.addEventListener('input', azurirajEnabledZaglavlje); el.addEventListener('change', azurirajEnabledZaglavlje); }
  });

  (function () {
    var tc = document.getElementById('tablicaContainer');
    if (!tc) return;
    tc.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.matches || !t.matches('input.kontrola-checkbox[type="checkbox"]')) return;
      if (!tc.contains(t)) return;
      var st = sveCheckboxePrvaTablicaStanjeOgr();
      if (!st.nemaCheckboxova && st.list.length > 0) {
        var sviOdznaceni = st.list.every(function (c) { return !c.checked; });
        if (sviOdznaceni) ocistiGeoIStupnjeveKadSveOdznacenoOgr();
      }
      scheduleSnimiNacrt();
      azurirajEnabledZaglavlje();
    }, true);
  })();

  /* --- Blok: Povratak – referrer ili Meni.php --- */
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

  /* --- Blok: Inicijalizacija – učitaj dužnosnike, prazna tablica, inicijalno disabled stanje --- */
  ucitajSustavVar1001Ogr(updateFooterSveOgranicenja);
  ucitajDuznosnici(function () {
    ogranicenjaPocniDvojniOsvjez();
    osvjeziTablicu();
    osvjeziTablicuStupnjevaPoObredu();
  });

})();
