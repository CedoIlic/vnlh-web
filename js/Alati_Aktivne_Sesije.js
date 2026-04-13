/* Alati_Aktivne_Sesije.js – tablica sesija (sustav_sesije_aktivne), interval osvježavanja, detaljni panel.
 * API: Alati_Aktivne_Sesije_sve.php
 */
// @ts-nocheck
(function () {
  'use strict';

  var API_BASE = '../php/';

  /**
   * ZAGLAVLJE_TABLICE – konfiguracija stupaca za KontroleTablica / CommonCRUD.
   *
   * Za svaki element u nizu:
   * - key: interni ključ u podatkovnom redu (nije uvijek korišten za prikaz).
   * - title: tekst u TH.
   * - SQL_Naziv: rezervirano za zajedničke CRUD obrasce (ovdje prazno / informativno).
   * - sortable: 0 = klik na zaglavlje ne sortira; 1 = sortabilno (ovdje sve 0).
   * - sortable_icon: 0 = bez ikone sorta u zaglavlju.
   * - type: t = tekst, d = datum/vrijeme (prikaz kao string iz API-ja).
   * - width: negativan broj = postotak širine stupca (npr. -50 = 50%); 0 = automatski.
   * - suffix: sufiks u ćeliji (npr. jedinica); ovdje prazno.
   * - align: poravnanje zaglavlja l|c|r.
   * - row_align: poravnanje ćelija.
   * - mobitel_prikaz: 1 = vidljivo na uskom ekranu; 0 = sakriveno (Login/Aktivnost 0 – vidi se u detaljima iznad povijesti).
   */
  var ZAGLAVLJE_TABLICE = [
    { key: 'korisnik', title: 'Korisnik', SQL_Naziv: '', sortable: 0, sortable_icon: 0, type: 't', width: -50, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
    { key: 'login_vrijeme', title: 'Login', SQL_Naziv: '', sortable: 0, sortable_icon: 0, type: 'd', width: -17, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 0 },
    { key: 'zadnja', title: 'Aktivnost', SQL_Naziv: '', sortable: 0, sortable_icon: 0, type: 'd', width: -17, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 0 },
    { key: 'status', title: 'Status', SQL_Naziv: '', sortable: 0, sortable_icon: 0, type: 't', width: -16, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];

  var AktivneSesije = {
    Broj_Kolona: 4,
    Reload_Ikona: 0,
    CrudCssPrefix: 'alati-aktivne-sesije',
    Tablica_Zaglavlje: ZAGLAVLJE_TABLICE
  };

  var tablicaApi = null;
  var dataIzvor = [];
  var editInterval = document.getElementById('edit_interval');
  /** setTimeout lanac (ne setInterval) – pri promjeni intervala sljedeći osvježaj je točno n sekundi od sada. */
  var refreshTimeout = null;
  /** Trenutni period u ms (za kružni indikator – mora odgovarati preostalom vremenu do nextRefreshAt). */
  var currentPeriodMs = 5000;
  /** Vremenska oznaka sljedećeg automatskog osvježavanja (GET _sve.php). */
  var nextRefreshAt = 0;
  /** Duljina kruga u SVG (r = 15): 2 * pi * 15 – usklađeno s Alati_Aktivne_Sesije.css */
  var COUNTDOWN_RING_LEN = 94.248;

  var countdownRing = document.getElementById('countdown_ring');
  var countdownSecs = document.getElementById('countdown_secs');

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /**
   * Prikaz datuma/vremena iz API-ja (MySQL "Y-m-d H:i:s") u lokalnom formatu preglednika (hr-HR, 24 h).
   * Parsira komponente kao lokalno vrijeme (isti zapis kao u bazi prikazan korisnikovim regionalnim postavkama).
   */
  function formatDateTimeLocalHr(s) {
    if (s == null || s === '') return '';
    var str = trim(s);
    if (str === '') return '';
    var p = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    var d;
    if (p) {
      d = new Date(
        parseInt(p[1], 10),
        parseInt(p[2], 10) - 1,
        parseInt(p[3], 10),
        parseInt(p[4], 10),
        parseInt(p[5], 10),
        parseInt(p[6], 10)
      );
    } else {
      d = new Date(str);
    }
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /** Maks. interval osvježavanja u sekundama (usklađeno s max atributom na #edit_interval). */
  var INTERVAL_OSVJEZI_MAX_SEC = 20;

  /**
   * Fallback ako polje nije valjano (mora odgovarati VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT u php/Alati_Sesije_Aktivne.php).
   * Zadana početna vrijednost dolazi iz sustav_varijable id 109 (PHP u php/Alati_Aktivne_Sesije.php).
   */
  var INTERVAL_OSVJEZI_FALLBACK_SEC = 5;

  /** Normalizira vrijednost iz polja intervala (1 … INTERVAL_OSVJEZI_MAX_SEC). */
  function getIntervalSec() {
    var n = editInterval ? parseInt(editInterval.value, 10) : INTERVAL_OSVJEZI_FALLBACK_SEC;
    if (isNaN(n) || n < 1) n = INTERVAL_OSVJEZI_FALLBACK_SEC;
    if (n > INTERVAL_OSVJEZI_MAX_SEC) n = INTERVAL_OSVJEZI_MAX_SEC;
    if (editInterval && String(editInterval.value) !== String(n)) {
      editInterval.value = String(n);
    }
    return n;
  }

  function clearDetail() {
    var ids = ['det_id', 'det_session_id', 'det_otvorena_stranica', 'det_ip_adresa', 'det_user_agent', 'det_status', 'det_povijest_sesije', 'det_login_vrijeme', 'det_zadnja_aktivnost'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.value = '';
    }
  }

  function fillDetail(o) {
    if (!o) {
      clearDetail();
      return;
    }
    function set(id, v) {
      var el = document.getElementById(id);
      if (el) el.value = v != null ? String(v) : '';
    }
    set('det_id', o.id);
    set('det_session_id', o.session_id);
    set('det_otvorena_stranica', o.otvorena_stranica);
    set('det_login_vrijeme', formatDateTimeLocalHr(o.login_vrijeme));
    set('det_zadnja_aktivnost', formatDateTimeLocalHr(o.zadnja_aktivnost));
    set('det_ip_adresa', o.ip_adresa);
    set('det_user_agent', o.user_agent);
    set('det_status', o.status);
    var ta = document.getElementById('det_povijest_sesije');
    if (ta) ta.value = o.povijest_sesije != null ? String(o.povijest_sesije) : '';
  }

  function findZapisById(id) {
    if (id == null) return null;
    var w = String(id);
    for (var k = 0; k < dataIzvor.length; k++) {
      if (String(dataIzvor[k].id) === w) return dataIzvor[k];
    }
    return null;
  }

  function onSelectionChange() {
    var id = CommonCRUD.getSelectedRowId(tablicaApi);
    fillDetail(findZapisById(id));
  }

  function buildRows() {
    var rows = [];
    for (var i = 0; i < dataIzvor.length; i++) {
      var x = dataIzvor[i];
      rows.push([
        x.korisnik_prikaz != null ? String(x.korisnik_prikaz) : '',
        formatDateTimeLocalHr(x.login_vrijeme),
        formatDateTimeLocalHr(x.zadnja_aktivnost),
        x.status != null ? String(x.status) : ''
      ]);
    }
    return rows;
  }

  function getRowIdFromData(row, index) {
    var o = dataIzvor[index];
    return o ? o.id : index;
  }

  /** Klasa na <tr> za retke čiji status nije „aktivna” (timeout, logout, …) – boja teksta u Alati_Aktivne_Sesije.css. */
  var KLASA_RED_NEAKTIVAN = 'alati-aktivne-sesije__row--neaktivan';

  /**
   * Nakon setData, označava retke prema dataIzvor[].status: sve osim „aktivna” dobiva KLASA_RED_NEAKTIVAN
   * (foreground teksta → var(--c-gray-300) u CSS-u).
   */
  function primijeniNeaktivneRetkeUTablici(container) {
    if (!container) return;
    var tbody = container.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return;
    var trs = tbody.querySelectorAll('tr');
    var n = Math.min(trs.length, dataIzvor.length);
    for (var i = 0; i < n; i++) {
      var o = dataIzvor[i];
      var st = o && o.status != null ? trim(String(o.status)).toLowerCase() : '';
      if (st === 'aktivna') trs[i].classList.remove(KLASA_RED_NEAKTIVAN);
      else trs[i].classList.add(KLASA_RED_NEAKTIVAN);
    }
    for (var j = n; j < trs.length; j++) trs[j].classList.remove(KLASA_RED_NEAKTIVAN);
  }

  CommonCRUD.initTablica('tablicaContainer', AktivneSesije, {
    onReady: function (api) {
      tablicaApi = api;
    },
    onSelectionChange: onSelectionChange,
    getRowId: getRowIdFromData,
    syncHeaderOnChange: true
  });

  function primijeniPodatke() {
    if (!tablicaApi) return;
    var rows = buildRows();
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, AktivneSesije.Tablica_Zaglavlje);
    var c = document.getElementById('tablicaContainer');
    if (c && typeof CommonCRUD.primijeniMobitelPrikaz === 'function') {
      CommonCRUD.primijeniMobitelPrikaz(c, AktivneSesije.Tablica_Zaglavlje);
    }
    primijeniNeaktivneRetkeUTablici(c);
  }

  /** Osvježava broj sekundi i kružni napredak do sljedećeg automatskog učitavanja. */
  function updateCountdownUi() {
    if (!countdownRing || !countdownSecs) return;
    var now = Date.now();
    var rem = Math.max(0, nextRefreshAt - now);
    var remSec = Math.ceil(rem / 1000);
    countdownSecs.textContent = remSec > 0 ? String(remSec) : '0';
    var total = Math.max(1, currentPeriodMs);
    var pctElapsed = 1 - Math.min(1, rem / total);
    countdownRing.style.strokeDashoffset = String(COUNTDOWN_RING_LEN * (1 - pctElapsed));
  }

  function countdownLoop() {
    updateCountdownUi();
    requestAnimationFrame(countdownLoop);
  }

  function scheduleRefresh() {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    currentPeriodMs = getIntervalSec() * 1000;
    nextRefreshAt = Date.now() + currentPeriodMs;
    function tick() {
      ucitajPodatke(true);
      currentPeriodMs = getIntervalSec() * 1000;
      nextRefreshAt = Date.now() + currentPeriodMs;
      refreshTimeout = setTimeout(tick, currentPeriodMs);
    }
    refreshTimeout = setTimeout(tick, currentPeriodMs);
  }

  function ucitajPodatke(isAuto) {
    var keepId = isAuto && tablicaApi ? CommonCRUD.getSelectedRowId(tablicaApi) : null;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Alati_Aktivne_Sesije_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      dataIzvor = [];
      if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      } else {
        try {
          dataIzvor = JSON.parse(text || '[]');
          if (!Array.isArray(dataIzvor)) dataIzvor = [];
        } catch (e) {
          dataIzvor = [];
        }
      }
      primijeniPodatke();
      if (keepId != null && tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function' && findZapisById(keepId)) {
        tablicaApi.setSelectedRowIds([keepId]);
      } else {
        onSelectionChange();
      }
    };
    xhr.send();
  }

  if (editInterval) {
    editInterval.addEventListener('change', function () {
      getIntervalSec();
      scheduleRefresh();
    });
    editInterval.addEventListener('input', function () {
      getIntervalSec();
      scheduleRefresh();
    });
  }

  (function () {
    var btn = document.getElementById('btnPovratak');
    if (!btn) return;
    btn.addEventListener('click', function () {
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

  ucitajPodatke(false);
  scheduleRefresh();
  requestAnimationFrame(countdownLoop);

  window.AktivneSesijeForm = AktivneSesije;
})();
