/* Alati_Poruke_Razvoja_Odgovori.js – pregled poruka tipa „Poruka razvoju“ (sustav_sesije_poruke).
 *
 * Način rada (CRUD):
 * - U tablici se ne dodaju novi slogovi (nema tipke Upis / nema kontrola-edit-delete za novi red).
 * - Tipka Izmjeni (lijevo u podnožju): vidljiva prema upis_izmjena; omogućena kad je u tablici odabran red.
 *   Tekst poruke, padajući predložak i checkbox aktivni su samo uz odabir retka (puni se tekstom retka).
 * - Primjena predloška: POST Alati_Poruke_Razvoja_Odgovori_CRUD_primjena.php (sufiks #kod*tekst# na poruku).
 * - Tipka „Ukloni sve odgovore“ (id btnIzbrisi): POST Alati_Poruke_Razvoja_Odgovori_CRUD_ukloni_odgovore.php —
 *   skida sve sufiksne odgovore s polja poruka i snima bazu; red u tablici se ne briše (brisano ostaje 0).
 */
// @ts-nocheck
(function () {
  'use strict';

  /** Zastavica iz common_prava_crud (upis_izmjena); 1 = smije se prikazati Izmjeni kad je predložak odabran. */
  var pravaUpisIzmjena = 0;

  if (typeof vnlhUcitajPravaCrud === 'function') {
    vnlhUcitajPravaCrud(
      'Alati_Poruke_Razvoja_Odgovori.html',
      function (upisIzmjena) {
        pravaUpisIzmjena = upisIzmjena != null ? parseInt(String(upisIzmjena), 10) : 0;
        if (isNaN(pravaUpisIzmjena)) pravaUpisIzmjena = 0;
        updateFooterButtons();
      },
      { upisiId: 'btnOdgovoriIzmjeni', izbrisiId: 'btnIzbrisi' }
    );
  }

  // ========== KONSTANTE ==========
  /*
   * Tablica_Zaglavlje — četiri vidljiva stupca (Broj_Kolona = 4); u retku je na indeksu ROW_COL_ID slog id (ne iscrtava se).
   *
   * Za svaki stupac (CommonCRUD / KontroleTablica):
   * - key: logičko ime polja (dokumentacija).
   * - title: tekst u th.
   * - SQL_Naziv: mapiranje na backend (dokumentacija).
   * - sortable: 0 = klik na zaglavlje ne sortira (CommonCRUD postavlja data-sortable=0); 1 = sort dozvoljen.
   * - sortable_icon: 1 = ikona strelica u zaglavlju; 0 = bez ikone.
   * - type: t = tekst (localeCompare), n = broj (Number); u ćeliji za Datum držimo negativni Date.getTime()
   *   da prvi klik sorta (uzlazno) da najnovije poruke gore, u skladu s KontroleTablica (prvi klik = sortAsc true).
   * - width, suffix, align (th), row_align (td), mobitel_prikaz: kao u ostalim CRUD tablicama.
   *
   * Prikaz datuma: u podatkovnom retku col0 je broj (neg. ms), ne formatirani string — nakon svakog iscrtaja tbody
   * zamjenjuje se tekst u prvoj ćeliji funkcijom primijeniPrikazDatumaUOdgovoriTablici();
   * stupac S.: pozadina/tekst iz API polja s_fg_boja / s_bg_boja (zadnji kod odgovora).
   */
  var ROW_COL_ID = 4;

  const AlatiPorukeRazvojaOdgovori = {
    Broj_Kolona: 4,
    Reload_Ikona: 1,
    CrudCssPrefix: 'alati-poruke-razvoja-odgovori',
    Tablica_Zaglavlje: [
      { key: 'vrijeme_slanja', title: 'Datum', SQL_Naziv: 'vrijeme_slanja', sortable: 1, sortable_icon: 1, type: 'n', width: 170, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'posiljatelj', title: 'Šalje', SQL_Naziv: 'id_posiljatelj', sortable: 1, sortable_icon: 1, type: 't', width: 176, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'poruka', title: 'Tekst poruke', SQL_Naziv: 'poruka', sortable: 1, sortable_icon: 1, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 's_rez', title: 'S.', SQL_Naziv: 's', sortable: 0, sortable_icon: 0, type: 't', width: 50, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  /** Redovi sesijskih poruka (isti poredak kao učitana tablica) */
  var odgovoriRawData = [];
  /** Šifran sustav_odgovori_razvoja_poruke (+ fg/bg iz JOIN-a) za padajući predložak */
  var predlozakPorukeRawData = [];

  /** MutationObserver na tbody — nakon sorta KontroleTablica ponovo iscrtava ćelije; vratimo format datuma u col0. */
  var odgovoriTbodyMutationObserver = null;
  var odgovoriTbodyObservedEl = null;

  CommonCRUD.initTablica('tablicaContainer', AlatiPorukeRazvojaOdgovori, {
    getRowId: function (row) {
      return row != null && row.length > ROW_COL_ID ? row[ROW_COL_ID] : null;
    },
    onReady: function (api) {
      tablicaApi = api;
      var cont = document.getElementById('tablicaContainer');
      if (!cont || typeof MutationObserver === 'undefined') return;
      function attachTbodyObserver() {
        var tbody = cont.querySelector('.kontrola-tablica__scroll table tbody');
        if (!tbody || tbody === odgovoriTbodyObservedEl) return;
        if (odgovoriTbodyMutationObserver) {
          try {
            odgovoriTbodyMutationObserver.disconnect();
          } catch (e1) {}
          odgovoriTbodyMutationObserver = null;
        }
        odgovoriTbodyObservedEl = tbody;
        odgovoriTbodyMutationObserver = new MutationObserver(function () {
          requestAnimationFrame(function () {
            primijeniPrikazDatumaUOdgovoriTablici();
            primijeniPrikazStupcaSTablici();
          });
        });
        odgovoriTbodyMutationObserver.observe(tbody, { childList: true, subtree: false });
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          attachTbodyObserver();
          primijeniPrikazDatumaUOdgovoriTablici();
          primijeniPrikazStupcaSTablici();
        });
      });
    },
    onReloadClick: function () {
      osvjeziTablicu();
    },
    onSelectionChange: function () {
      if (onCrudSelectionChange) onCrudSelectionChange();
    },
    syncHeaderOnChange: false
  });

  var API_BASE = '../php/';

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  function safeInt(v, def) {
    var n = parseInt(v, 10);
    return isNaN(n) ? def : n;
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function pad2(n) {
    var x = Math.floor(Number(n));
    if (isNaN(x)) return '00';
    return (x < 10 ? '0' : '') + x;
  }

  /**
   * MySQL datetime → "DD.MM.GGGG - HH:MM" (24 h).
   */
  function formatDatumLokalno(mysqlDt) {
    if (mysqlDt == null || String(mysqlDt).trim() === '') return '';
    var s0 = String(mysqlDt).trim();
    var m = s0.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) {
      return pad2(m[3]) + '.' + pad2(m[2]) + '.' + m[1] + ' - ' + m[4] + ':' + m[5];
    }
    var d = new Date(s0.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s0;
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear() + ' - ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /**
   * MySQL datetime → negativni broj ms za sort stupca „Datum“ (tip n).
   * KontroleTablica pri prvom kliku sortira uzlazno (sortAsc true); uzlazni poredak negativnih vremena
   * daje najnovije vrijeme prvo (manji broj = veći izvorni timestamp).
   */
  function vrijemeZaSortNegativniMs(mysqlDt) {
    if (mysqlDt == null || String(mysqlDt).trim() === '') return '';
    var s0 = String(mysqlDt).trim().replace(' ', 'T');
    var t = new Date(s0).getTime();
    if (isNaN(t)) return '';
    return -t;
  }

  /** Zamjenjuje sirovi broj u prvoj ćeliji s formatiranim datumom iz odgovoriRawData (prema data-row-id). */
  function primijeniPrikazDatumaUOdgovoriTablici() {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    var tbody = container.querySelector('.kontrola-tablica__scroll table tbody');
    if (!tbody) return;
    var trs = tbody.rows;
    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i];
      var rid = tr.getAttribute('data-row-id');
      var raw = null;
      for (var j = 0; j < odgovoriRawData.length; j++) {
        if (String(odgovoriRawData[j].id) === String(rid)) {
          raw = odgovoriRawData[j];
          break;
        }
      }
      var c0 = tr.cells[0];
      var cellInner = c0 && c0.querySelector('.kontrola-tablica__cell-inner');
      if (!cellInner) continue;
      if (raw) cellInner.textContent = formatDatumLokalno(raw.vrijeme_slanja);
      else cellInner.textContent = '';
    }
  }

  /** Stupac S.: bg/fg prema zadnjem kodu odgovora (ćelija indeks 3). */
  function primijeniPrikazStupcaSTablici() {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    var tbody = container.querySelector('.kontrola-tablica__scroll table tbody');
    if (!tbody) return;
    var trs = tbody.rows;
    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i];
      var rid = tr.getAttribute('data-row-id');
      var raw = null;
      for (var j = 0; j < odgovoriRawData.length; j++) {
        if (String(odgovoriRawData[j].id) === String(rid)) {
          raw = odgovoriRawData[j];
          break;
        }
      }
      var td = tr.cells[3];
      var cellInner = td && td.querySelector('.kontrola-tablica__cell-inner');
      if (!cellInner) continue;
      cellInner.textContent = raw && raw.kod_zadnji != null && String(raw.kod_zadnji) !== '' ? '\u2022' : '';
      if (!raw || raw.s_bg_boja == null || String(raw.s_bg_boja).trim() === '') {
        td.style.backgroundColor = '';
        td.style.color = '';
        cellInner.style.color = '';
        continue;
      }
      var pbg = bojaFromStorage(raw.s_bg_boja);
      var pfg = bojaFromStorage(raw.s_fg_boja != null && String(raw.s_fg_boja).trim() !== '' ? raw.s_fg_boja : '#000000FF');
      td.style.backgroundColor = hexAlphaToRgba(pbg.hex, pbg.alpha);
      cellInner.style.color = hexAlphaToRgba(pfg.hex, pfg.alpha);
    }
  }

  /**
   * Isti algoritam kao php/poruke_razvoj_odgovor_parse.php — uklanja sufiksne blokove #kod*tekst# s kraja.
   */
  function razvojIzdvojiBazuIzPunePoruke(poruka) {
    var s = poruka != null ? String(poruka) : '';
    var m;
    while ((m = s.match(/^([\s\S]*)#(\d+)\*([^#]*)#$/))) {
      s = m[1];
    }
    return s;
  }

  function formatPosiljatelj(prezime, ime) {
    var p = trim(prezime);
    var i = trim(ime);
    if (!p && !i) return '—';
    if (!p) return i;
    if (!i) return p;
    return p + ' ' + i;
  }

  /* --- Boje za opcije / kontrola-select (isti model kao Alati_Poruke_Razvoja_Tip) --- */
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
    } catch (e) {}
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
    } catch (e) {}
    return 'rgba(0,0,0,1)';
  }

  /** Zatvoreni kontrola-select: bg na displayu, fg na unutrašnjem tekstu (opcije s inline bojama iz buildOptions). */
  function syncPredlozakSelectVizual() {
    var sel = document.getElementById('odgovori_predlozak_select');
    if (!sel) return;
    var wrap = sel.closest('.kontrola-select');
    var display = wrap ? wrap.querySelector('.kontrola-select__display') : null;
    var displayInner = wrap ? wrap.querySelector('.kontrola-select__display-inner') : null;
    sel.style.backgroundColor = '';
    sel.style.color = '';
    function ocisti() {
      if (display) {
        display.style.backgroundColor = '';
        display.style.background = '';
      }
      if (displayInner) displayInner.style.color = '';
    }
    var v = trim(sel.value);
    if (v === '') {
      ocisti();
      return;
    }
    for (var i = 0; i < predlozakPorukeRawData.length; i++) {
      if (String(predlozakPorukeRawData[i].id) === v) {
        var raw = predlozakPorukeRawData[i];
        var fg = raw.fg_boja != null ? String(raw.fg_boja) : '';
        var bg = raw.bg_boja != null ? String(raw.bg_boja) : '';
        var pfg = bojaFromStorage(fg !== '' ? fg : '#000000FF');
        var pbg = bojaFromStorage(bg !== '' ? bg : '#FFFFFFFF');
        if (display) display.style.backgroundColor = hexAlphaToRgba(pbg.hex, pbg.alpha);
        if (displayInner) displayInner.style.color = hexAlphaToRgba(pfg.hex, pfg.alpha);
        return;
      }
    }
    ocisti();
  }

  /** Punjenje selecta iz Alati_Poruke_Razvoja_Tip_Poruke_CRUD_sve.php (redosljed, id). */
  function puniPredlozakSelect() {
    var sel = document.getElementById('odgovori_predlozak_select');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '';
    var optEmpty = document.createElement('option');
    optEmpty.value = '';
    optEmpty.textContent = '—';
    sel.appendChild(optEmpty);
    var arr = predlozakPorukeRawData.slice();
    arr.sort(function (a, b) {
      var dr = safeInt(a.redosljed, 0) - safeInt(b.redosljed, 0);
      if (dr !== 0) return dr;
      return safeInt(a.id, 0) - safeInt(b.id, 0);
    });
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      var o = document.createElement('option');
      o.value = String(p.id);
      var tx = p.tekst != null ? String(p.tekst) : '';
      o.textContent = tx !== '' ? tx : '—';
      var fg = p.fg_boja != null ? String(p.fg_boja) : '';
      var bg = p.bg_boja != null ? String(p.bg_boja) : '';
      var pfg = bojaFromStorage(fg !== '' ? fg : '#000000FF');
      var pbg = bojaFromStorage(bg !== '' ? bg : '#FFFFFFFF');
      o.style.backgroundColor = hexAlphaToRgba(pbg.hex, pbg.alpha);
      o.style.color = hexAlphaToRgba(pfg.hex, pfg.alpha);
      sel.appendChild(o);
    }
    var found = false;
    for (var j = 0; j < sel.options.length; j++) {
      if (sel.options[j].value === cur) {
        found = true;
        break;
      }
    }
    sel.value = found ? cur : '';
    if (typeof KontroleRefreshCustomSelect === 'function') {
      KontroleRefreshCustomSelect('odgovori_predlozak_select');
    }
    syncPredlozakSelectVizual();
    updateFooterButtons();
  }

  function ucitajPredlozakPoruke(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Alati_Poruke_Razvoja_Tip_Poruke_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      predlozakPorukeRawData = [];
      try {
        if (text !== '' && text.charAt(0) !== '[' && text.charAt(0) !== '{') {
          var parsed = parseResponseCode(text);
          if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(parsed.code, parsed.replacements);
          }
        } else {
          var rawO = JSON.parse(text || '[]');
          predlozakPorukeRawData = Array.isArray(rawO) ? rawO : (rawO && Array.isArray(rawO.rows) ? rawO.rows : []);
        }
      } catch (e) {
        predlozakPorukeRawData = [];
        console.error('Alati_Poruke_Razvoja_Odgovori ucitajPredlozakPoruke', e);
      }
      puniPredlozakSelect();
      updateFooterButtons();
      if (typeof callback === 'function') callback();
    };
    try {
      xhr.send();
    } catch (e) {
      predlozakPorukeRawData = [];
      puniPredlozakSelect();
      updateFooterButtons();
      if (typeof callback === 'function') callback();
    }
  }

  /** Čisti polja vezana uz odabrani red tablice (nakon uklanjanja selekcije). */
  function clearControlsFromSelection() {
    var pEl = document.getElementById('odgovori_poruka_edit');
    var chk = document.getElementById('odgovori_brisi_stare_poruke');
    if (pEl) pEl.value = '';
    if (chk) chk.checked = false;
  }

  /**
   * Nakon uspješnog snimanja u bazu (primjena predloška): ukloni selekciju retka, isprazni edit,
   * predložak na „—“, checkbox isključen, osvježi tablicu.
   */
  function odgovoriResetirajPanelNakonSnimanja() {
    if (tablicaApi && typeof tablicaApi.clearSelection === 'function') {
      tablicaApi.clearSelection();
    }
    clearControlsFromSelection();
    var sel = document.getElementById('odgovori_predlozak_select');
    if (sel) {
      sel.value = '';
      if (typeof KontroleRefreshCustomSelect === 'function') {
        KontroleRefreshCustomSelect('odgovori_predlozak_select');
      }
    }
    syncPredlozakSelectVizual();
    osvjeziTablicu();
    updateFooterButtons();
  }

  /**
   * Tekst poruke, predložak (select) i checkbox „Brisanje starih…“: disabled dok nema retka u tablici.
   * Nakon promjene disabled na selectu osvježava kontrola-select (prikaz).
   */
  function postaviEditKontroleAktivne(imaRed) {
    var ima = !!imaRed;
    var pEl = document.getElementById('odgovori_poruka_edit');
    var sel = document.getElementById('odgovori_predlozak_select');
    var chk = document.getElementById('odgovori_brisi_stare_poruke');
    if (pEl) pEl.disabled = !ima;
    if (sel) {
      sel.disabled = !ima;
      if (typeof KontroleRefreshCustomSelect === 'function') {
        KontroleRefreshCustomSelect('odgovori_predlozak_select');
      }
    }
    if (chk) chk.disabled = !ima;
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function updateFooterButtons() {
    var imaRed = getSelectedRowId() != null;
    var btnIzbrisi = document.getElementById('btnIzbrisi');
    if (btnIzbrisi && !btnIzbrisi.hidden) btnIzbrisi.disabled = !imaRed;

    var btnIzm = document.getElementById('btnOdgovoriIzmjeni');
    /* Vidljivost Izmjeni: isključivo common_prava_crud (vnlhPrimijeniPravaCrud). Omogućen samo uz odabran red. */
    if (btnIzm && pravaUpisIzmjena === 1 && !btnIzm.hidden) {
      btnIzm.disabled = !imaRed;
    }

    postaviEditKontroleAktivne(imaRed);
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
      updateFooterButtons();
      return;
    }
    var raw = null;
    for (var j = 0; j < odgovoriRawData.length; j++) {
      if (String(odgovoriRawData[j].id) === String(id)) {
        raw = odgovoriRawData[j];
        break;
      }
    }
    var pEl = document.getElementById('odgovori_poruka_edit');
    if (!raw) {
      if (pEl) pEl.value = '';
      updateFooterButtons();
      return;
    }
    /* U editu samo baza poruke (bez sufiksnih odgovora #kod*tekst#). */
    if (pEl) {
      var baza =
        raw.poruka_baza != null
          ? String(raw.poruka_baza)
          : razvojIzdvojiBazuIzPunePoruke(raw.poruka != null ? String(raw.poruka) : '');
      pEl.value = baza;
    }
    updateFooterButtons();
  };

  function ucitajPodatke(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Alati_Poruke_Razvoja_Odgovori_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      odgovoriRawData = [];
      try {
        if (text === '' || text.charAt(0) !== '[') {
          var parsed = parseResponseCode(text);
          if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(parsed.code, parsed.replacements);
          }
        } else {
          var arr = JSON.parse(text);
          if (!Array.isArray(arr)) arr = [];
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            if (!r || typeof r !== 'object') continue;
            var rid = parseInt(r.id, 10);
            if (isNaN(rid) || rid <= 0) continue;
            odgovoriRawData.push(r);
            var sortDatum = vrijemeZaSortNegativniMs(r.vrijeme_slanja);
            var saljeStr = formatPosiljatelj(r.clan_prezime, r.clan_ime);
            var porukaZaTablicu =
              r.poruka_baza != null ? String(r.poruka_baza) : r.poruka != null ? String(r.poruka) : '';
            rows.push([sortDatum, saljeStr, porukaZaTablicu, '', rid]);
          }
        }
      } catch (e) {
        rows = [];
        odgovoriRawData = [];
        console.error('Alati_Poruke_Razvoja_Odgovori ucitajPodatke', e);
      }
      if (typeof callback === 'function') callback(rows);
    };
    try {
      xhr.send();
    } catch (e) {
      if (typeof callback === 'function') callback([]);
    }
  }

  function setDataTablica(rows) {
    try {
      if (!tablicaApi) return;
      if (!Array.isArray(rows)) rows = [];
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, AlatiPorukeRazvojaOdgovori.Tablica_Zaglavlje);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          primijeniPrikazDatumaUOdgovoriTablici();
          primijeniPrikazStupcaSTablici();
        });
      });
    } catch (e) {}
  }

  function osvjeziTablicu() {
    ucitajPodatke(function (rows) {
      setDataTablica(rows);
    });
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  /**
   * Akcija gumba „Ukloni sve odgovore“: skida sve sufiksne blokove (#kod*tekst#) s poruke i snima UPDATE;
   * red u sustav_sesije_poruke ostaje (nema logičkog brisanja retka).
   */
  function ukloniSveOdgovorePoruke(id, callback) {
    postFormData(API_BASE + 'Alati_Poruke_Razvoja_Odgovori_CRUD_ukloni_odgovore.php', { id: String(id) }, callback);
  }

  var selPredlozak = document.getElementById('odgovori_predlozak_select');
  if (selPredlozak) {
    selPredlozak.addEventListener('change', function () {
      syncPredlozakSelectVizual();
      updateFooterButtons();
    });
  }

  osvjeziTablicu();
  ucitajPredlozakPoruke();
  updateFooterButtons();

  var btnOdgovoriIzmjeni = document.getElementById('btnOdgovoriIzmjeni');
  if (btnOdgovoriIzmjeni) {
    btnOdgovoriIzmjeni.addEventListener('click', function () {
      if (btnOdgovoriIzmjeni.hidden || btnOdgovoriIzmjeni.disabled) return;
      var s = document.getElementById('odgovori_predlozak_select');
      if (!s || trim(s.value) === '') return;
      var idPoruke = getSelectedRowId();
      if (idPoruke == null) return;
      var chk = document.getElementById('odgovori_brisi_stare_poruke');
      var brisi = chk && chk.checked ? '1' : '0';
      btnOdgovoriIzmjeni.disabled = true;
      postFormData(
        API_BASE + 'Alati_Poruke_Razvoja_Odgovori_CRUD_primjena.php',
        {
          id: String(idPoruke),
          id_predlozak: String(trim(s.value)),
          brisi_stare: brisi
        },
        function (res) {
          btnOdgovoriIzmjeni.disabled = false;
          if (res === 'OK') {
            odgovoriResetirajPanelNakonSnimanja();
            return;
          }
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements);
          }
          updateFooterButtons();
        }
      );
    });
  }

  var btnIzbrisi = document.getElementById('btnIzbrisi');
  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      ukloniSveOdgovorePoruke(id, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('156', [], function () {
              odgovoriResetirajPanelNakonSnimanja();
            });
          } else {
            odgovoriResetirajPanelNakonSnimanja();
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
          var u2 = new URL(document.referrer);
          if (u2.origin === window.location.origin) {
            window.location.href = u2.href;
            return;
          }
        } catch (e2) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();
})();
