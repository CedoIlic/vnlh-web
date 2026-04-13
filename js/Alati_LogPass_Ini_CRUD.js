/* Alati_LogPass_Ini_CRUD.js – sustav_korisnici: prikaz, login, pass, pass_status, login_neuspjesni_pokusaji (Log faill u formi)
 * Red tablice: [0] prikaz, [1] id_korisnik, [2] login, [3] pass, [4] pass_status, [5] ime, [6] prezime (skriveno od prikaza)
 * API: Alati_LogPass_Ini_CRUD_sve.php, _izmjena.php, _brisanje.php
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Alati_LogPass_Ini_CRUD.html');

  var API_BASE = '../php/';

  var LogPassIniCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'alati-logpass-ini-crud',
    Tablica_Zaglavlje: [
      { key: 'prikaz', title: 'Korisnik / dužnost', SQL_Naziv: 'prikaz', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var dataIzvor = [];

  var editTrazi = document.getElementById('edit_trazi');
  var editLogin = document.getElementById('edit_login');
  var editPass = document.getElementById('edit_pass');
  var editPassStatus = document.getElementById('edit_pass_status');
  var editLogFail = document.getElementById('edit_log_fail');
  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  var btnGenPass = document.getElementById('btn_gen_pass');
  var editPanel = document.getElementById('edit_panel');

  var DULJINA_POCETNE_LOZINKE = 12;

  /** Slučajna početna lozinka (A–Z, a–z, 0–9), kriptografski ako je dostupan crypto.getRandomValues. */
  function generirajPocetniPass() {
    var n = DULJINA_POCETNE_LOZINKE;
    var skup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var len = skup.length;
    var bytes = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (var j = 0; j < n; j++) {
      out += skup.charAt(bytes[j] % len);
    }
    return out;
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  CommonCRUD.initTablica('tablicaContainer', LogPassIniCRUD, {
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: onCrudSelectionChange,
    syncHeaderOnChange: true
  });

  function normalizirajLoginZaPrikaz(v) {
    var s = trim(v);
    if (s.toUpperCase() === 'NULL') return '';
    return s;
  }

  function tekstPassStatus(ps) {
    if (ps == null || ps === '') return '';
    return String(ps);
  }

  /** Hrvatska slova → ascii (čćšž→csz, đ→dj, dž→dz), zatim NFD bez dijakritika. */
  function hrAsciiLower(s) {
    if (s == null) return '';
    var t = String(s).toLowerCase();
    t = t.replace(/dž/g, 'dz');
    t = t.replace(/đ/g, 'dj');
    t = t.replace(/ž/g, 'z');
    t = t.replace(/š/g, 's');
    t = t.replace(/č/g, 'c');
    t = t.replace(/ć/g, 'c');
    try {
      t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {}
    return t;
  }

  /** Prvo slovo imena + cijelo prezime, samo a–z (mala). */
  function predloziLogin(ime, prezime) {
    var i = hrAsciiLower(trim(ime));
    var p = hrAsciiLower(trim(prezime));
    var first = (i.charAt(0) || '').replace(/[^a-z]/g, '');
    var rest = p.replace(/[^a-z]/g, '');
    if (first === '' && rest === '') return '';
    return (first + rest).toLowerCase();
  }

  function getIzvorZapis(idKorisnik) {
    if (idKorisnik == null) return null;
    var want = String(idKorisnik);
    for (var k = 0; k < dataIzvor.length; k++) {
      if (String(dataIzvor[k].id_korisnik) === want) return dataIzvor[k];
    }
    return null;
  }

  /** Postavi Status i Log faill u formi; ps null ili prazno = prazno polje statusa. */
  function postaviStatusILogFailPolja(ps, lf) {
    if (editPassStatus) {
      var st = ps == null || ps === '' ? '' : String(ps).trim();
      editPassStatus.value = /^[0-9]$/.test(st) ? st : '';
      editPassStatus.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (editLogFail) {
      var lfNum = lf == null || lf === '' ? 0 : parseInt(String(lf), 10);
      if (isNaN(lfNum)) lfNum = 0;
      if (lfNum < 0) lfNum = 0;
      if (lfNum > 255) lfNum = 255;
      editLogFail.value = String(lfNum);
      editLogFail.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /** Svježe pass_status i login_neuspjesni_pokusaji iz baze za trenutno odabranog korisnika (ne samo keš pri učitavanju). */
  function dohvatiStavIzBazeZaSelekciju(idKorisnik) {
    if (idKorisnik == null) return;
    var kadSel = String(idKorisnik);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Alati_LogPass_Ini_CRUD_jedan.php?id_korisnik=' + encodeURIComponent(kadSel), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (String(getSelectedRowId()) !== kadSel) return;
      var text = (xhr.responseText || '').trim();
      if (text === '' || text.charAt(0) !== '{') return;
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return;
      }
      if (String(getSelectedRowId()) !== kadSel) return;
      var ps = data.pass_status;
      var lf = data.login_neuspjesni_pokusaji;
      for (var k = 0; k < dataIzvor.length; k++) {
        if (String(dataIzvor[k].id_korisnik) === kadSel) {
          dataIzvor[k].pass_status = ps == null ? null : ps;
          dataIzvor[k].login_neuspjesni_pokusaji = lf != null ? lf : 0;
          break;
        }
      }
      postaviStatusILogFailPolja(ps, lf);
      updateCrudButtons();
    };
    xhr.send();
  }

  function normalizirajPassZaPrikaz(v) {
    if (v == null) return '';
    var s = String(v);
    if (trim(s).toUpperCase() === 'NULL') return '';
    return s;
  }

  function setEditPoljaLocked(on) {
    var dis = !!on;
    [editLogin, editPass, editPassStatus, editLogFail].forEach(function (el) {
      if (!el) return;
      el.disabled = dis;
    });
    if (btnGenPass) {
      btnGenPass.disabled = dis;
      btnGenPass.setAttribute('aria-disabled', dis ? 'true' : 'false');
    }
    if (editPanel) {
      editPanel.classList.toggle('kontrola-panel--edit-locked', dis);
      editPanel.querySelectorAll('.kontrola-edit-delete').forEach(function (wrap) {
        wrap.classList.toggle('kontrola-edit-delete--disabled', dis);
      });
      editPanel.querySelectorAll('.kontrola-edit-delete__clear').forEach(function (btn) {
        btn.disabled = dis;
        btn.setAttribute('aria-disabled', dis ? 'true' : 'false');
      });
      if (typeof window.KontroleSyncLabelsDisabledState === 'function') {
        window.KontroleSyncLabelsDisabledState(editPanel);
      }
    }
  }

  function primijeniFilter() {
    if (!tablicaApi) return;
    var txt = editTrazi ? trim(editTrazi.value).toLowerCase() : '';
    var list = dataIzvor || [];
    if (txt !== '') {
      list = list.filter(function (r) {
        var p = (r.prikaz != null ? String(r.prikaz) : '').toLowerCase();
        var l = normalizirajLoginZaPrikaz(r.login).toLowerCase();
        var st = tekstPassStatus(r.pass_status).toLowerCase();
        var pw = normalizirajPassZaPrikaz(r.pass).toLowerCase();
        return p.indexOf(txt) !== -1 || l.indexOf(txt) !== -1 || st.indexOf(txt) !== -1 || pw.indexOf(txt) !== -1;
      });
    }
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      var id = x.id_korisnik != null ? x.id_korisnik : 0;
      rows.push([
        x.prikaz != null ? x.prikaz : '',
        id,
        normalizirajLoginZaPrikaz(x.login),
        normalizirajPassZaPrikaz(x.pass),
        tekstPassStatus(x.pass_status),
        x.ime != null ? String(x.ime) : '',
        x.prezime != null ? String(x.prezime) : ''
      ]);
    }
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, LogPassIniCRUD.Tablica_Zaglavlje);
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function getSelectedRow() {
    if (!tablicaApi) return null;
    var id = getSelectedRowId();
    if (id == null) return null;
    var data = tablicaApi.getData();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][1]) === String(id)) return data[i];
    }
    return null;
  }

  function clearEditPolja() {
    if (editLogin) { editLogin.value = ''; editLogin.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editPass) { editPass.value = ''; editPass.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editPassStatus) { editPassStatus.value = ''; editPassStatus.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editLogFail) { editLogFail.value = ''; editLogFail.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  function onCrudSelectionChange() {
    var row = getSelectedRow();
    if (!row) {
      clearEditPolja();
      setEditPoljaLocked(true);
    } else {
      setEditPoljaLocked(false);
      var src = getIzvorZapis(row[1]);
      var loginDb = src ? normalizirajLoginZaPrikaz(src.login) : (row[2] != null ? String(row[2]) : '');
      var loginVal = loginDb !== '' ? loginDb : predloziLogin(src ? src.ime : row[5], src ? src.prezime : row[6]);
      if (editLogin) {
        editLogin.value = loginVal;
        editLogin.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var passDb = src ? normalizirajPassZaPrikaz(src.pass) : normalizirajPassZaPrikaz(row[3]);
      if (editPass) {
        editPass.value = trim(passDb) !== '' ? passDb : '';
        editPass.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var stInit = row[4] != null ? String(row[4]).trim() : '';
      var lfInit = src && src.login_neuspjesni_pokusaji != null ? src.login_neuspjesni_pokusaji : null;
      postaviStatusILogFailPolja(stInit === '' ? null : stInit, lfInit);
      dohvatiStavIzBazeZaSelekciju(row[1]);
    }
    updateCrudButtons();
  }

  if (btnGenPass) {
    btnGenPass.addEventListener('click', function () {
      if (this.disabled) return;
      if (editPass) {
        editPass.value = generirajPocetniPass();
        editPass.focus();
        try {
          editPass.select();
        } catch (e) {}
        editPass.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  (function () {
    var wrap = editTrazi && editTrazi.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateCrudButtons();
    });
  })();

  /** Upis/Izmjeni: treba selekcija + neprazan login, neprazan pass, točno jedna znamenka statusa, log fail 0–255. */
  function logFailJeValjan() {
    var s = editLogFail ? trim(editLogFail.value) : '';
    if (s === '') return true;
    if (!/^[0-9]+$/.test(s)) return false;
    var n = parseInt(s, 10);
    return n >= 0 && n <= 255;
  }

  function svaTriPoljaPopunjena() {
    var loginOk = editLogin && trim(editLogin.value) !== '';
    var passOk = editPass && trim(editPass.value) !== '';
    var st = editPassStatus ? trim(editPassStatus.value) : '';
    var statusOk = /^[0-9]$/.test(st);
    return !!(loginOk && passOk && statusOk && logFailJeValjan());
  }

  function updateCrudButtons() {
    var imaSel = getSelectedRowId() != null;
    var mozeUpisati = imaSel && svaTriPoljaPopunjena();
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSel);
      btnUpisiLabel.textContent = imaSel ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSel ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !mozeUpisati;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSel;
  }

  function onLoginPassChange() {
    updateCrudButtons();
  }

  function statusJeValjan() {
    var s = editPassStatus ? trim(editPassStatus.value) : '';
    return s === '' || /^[0-9]$/.test(s);
  }

  /** Jedna znamenka 0–9 ili prazno. Zadnja znamenka u vrijednosti (npr. nakon tipkanja preko postojeće) – bez maxlength u HTML-u jer maxlength=1 sprječava zamjenu jedine znamenke. */
  function onStatusInput(e) {
    var el = editPassStatus;
    if (!el) return;
    var v = el.value;
    var out = '';
    for (var i = v.length - 1; i >= 0; i--) {
      var ch = v.charAt(i);
      if (ch >= '0' && ch <= '9') {
        out = ch;
        break;
      }
    }
    if (v !== out) el.value = out;
    updateCrudButtons();
  }

  if (editPassStatus) {
    editPassStatus.addEventListener('input', onStatusInput);
    editPassStatus.addEventListener('change', onLoginPassChange);
    editPassStatus.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && (e.key < '0' || e.key > '9')) e.preventDefault();
    });
    editPassStatus.addEventListener('paste', function (e) {
      var t = e.clipboardData && e.clipboardData.getData('text');
      if (t != null && t !== '' && !/[0-9]/.test(String(t))) e.preventDefault();
    });
  }

  function onLogFailInput() {
    var el = editLogFail;
    if (!el) return;
    var v = el.value;
    var out = '';
    for (var i = 0; i < v.length; i++) {
      var ch = v.charAt(i);
      if (ch >= '0' && ch <= '9') out += ch;
    }
    if (out.length > 3) out = out.slice(0, 3);
    if (out !== '' && parseInt(out, 10) > 255) out = '255';
    if (v !== out) el.value = out;
    updateCrudButtons();
  }

  [editLogin, editPass].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', onLoginPassChange);
    el.addEventListener('change', onLoginPassChange);
  });

  if (editLogFail) {
    editLogFail.addEventListener('input', onLogFailInput);
    editLogFail.addEventListener('change', onLoginPassChange);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      if (this.disabled) return;
      var id = getSelectedRowId();
      if (id == null) return;
      if (!statusJeValjan()) {
        if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []);
        return;
      }
      if (!logFailJeValjan()) {
        if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []);
        return;
      }
      var login = editLogin ? trim(editLogin.value) : '';
      var pass = editPass ? String(editPass.value) : '';
      var st = editPassStatus ? trim(editPassStatus.value) : '';
      var logFailStr = editLogFail ? trim(editLogFail.value) : '';
      postFormData(API_BASE + 'Alati_LogPass_Ini_CRUD_izmjena.php', {
        id_korisnik: String(id),
        login: login,
        pass: pass,
        pass_status: st,
        login_neuspjesni_pokusaji: logFailStr === '' ? '0' : logFailStr
      }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearEditPolja();
              setEditPoljaLocked(true);
              osvjeziTablicu(function () {
                updateCrudButtons();
              });
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

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'Alati_LogPass_Ini_CRUD_brisanje.php', { id_korisnik: String(id) }, function (res) {
        if (res === 'OK') {
          var idStr = String(id);
          for (var di = 0; di < dataIzvor.length; di++) {
            if (String(dataIzvor[di].id_korisnik) === idStr) {
              dataIzvor[di].login = '';
              dataIzvor[di].pass = '';
              dataIzvor[di].pass_status = null;
              dataIzvor[di].login_neuspjesni_pokusaji = 0;
              break;
            }
          }
          function nakonBrisanjaSloga() {
            if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
            clearEditPolja();
            setEditPoljaLocked(true);
            primijeniFilter();
            updateCrudButtons();
            osvjeziTablicu();
          }
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('004', [], nakonBrisanjaSloga);
          } else {
            nakonBrisanjaSloga();
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

  function ucitajPodatke(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Alati_LogPass_Ini_CRUD_sve.php', true);
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
      primijeniFilter();
      if (callback) callback();
    };
    xhr.send();
  }

  function osvjeziTablicu(callback) {
    ucitajPodatke(callback);
  }

  if (editTrazi) {
    editTrazi.addEventListener('input', primijeniFilter);
    editTrazi.addEventListener('change', primijeniFilter);
  }

  ucitajPodatke();
  setEditPoljaLocked(true);
  updateCrudButtons();

  window.LogPassIniCRUD = LogPassIniCRUD;
})();
