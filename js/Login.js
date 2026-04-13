/* Login.js – prijava i obvezna promjena lozinke (pass_status = 1); POST Login.php (putanje iz login_stranica_get ili ../php/) */
// @ts-nocheck
(function () {
  'use strict';

  /** Usklađeno s php/vnlh_password_policy.php */
  var PASSWORD_SPECIALS = '!@#$%^&*-_';

  var userEl = document.getElementById('login_user');
  var newUserEl = document.getElementById('login_new_user');
  var newUserRow = document.getElementById('login_new_user_row');
  var passEl = document.getElementById('login_pass');
  var passConfirmEl = document.getElementById('login_pass_confirm');
  var confirmRow = document.getElementById('login_pass_confirm_row');
  var hintsEl = document.getElementById('login_pass_hints');
  var hintTextEl = document.getElementById('login_pass_hint_text');
  var titleEl = document.getElementById('login_panel_title');
  var btnSubmit = document.getElementById('btn_login_submit');
  var btnSubmitLabel = document.getElementById('btn_login_submit_label');
  var btnOdustani = document.getElementById('btn_login_odustani');
  var btnToggle = document.getElementById('login_toggle_pass');
  var btnToggleConfirm = document.getElementById('login_toggle_pass_confirm');

  var passChangeMode = false;

  /**
   * Apsolutna pathname putanja od PHP-a (npr. /vnlh/php/Meni.php) – pouzdana kad location.pathname nema /php/.
   * Fallback: relativna putanja u odnosu na trenutni URL.
   */
  function vnlhUrlFromInjectedPath(absolutePath, fallbackRelative) {
    if (typeof absolutePath === 'string' && absolutePath.length > 0 && absolutePath.charAt(0) === '/') {
      try {
        return new URL(absolutePath, window.location.origin).href;
      } catch (e1) {}
    }
    try {
      return new URL(fallbackRelative, window.location.href).href;
    } catch (e2) {
      return fallbackRelative;
    }
  }

  var API_LOGIN = vnlhUrlFromInjectedPath(window.__VNLH_LOGIN_API_PATH__, '../php/Login.php');
  var API_PASS_PROMJENA = vnlhUrlFromInjectedPath(window.__VNLH_PASS_PROMJENA_PATH__, '../php/Login_pass_promjena.php');
  var LOGOUT_URL = vnlhUrlFromInjectedPath(window.__VNLH_LOGOUT_PATH__, '../php/Logout.php');

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /** Trim + ukloni BOM (UTF-8) da se 'OK' pouzdano prepozna */
  function normalizeOdgovorServera(s) {
    return trim(String(s != null ? s : '').replace(/^\uFEFF/, ''));
  }

  function meniUrl() {
    return vnlhUrlFromInjectedPath(window.__VNLH_MENI_PATH__, 'Meni.php');
  }

  /** Popup: window.close(). Inače history.back() ili Meni.php (close() ne radi na običnom tabu). */
  function zatvoriLoginProzor() {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.focus();
      } catch (e1) {}
    }
    window.close();
    window.setTimeout(function () {
      if (document.visibilityState !== 'visible') return;
      try {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = meniUrl();
        }
      } catch (e2) {
        window.location.href = meniUrl();
      }
    }, 150);
  }

  /**
   * Nakon uspješne prijave ili uspješne promjene lozinke: ista sesija, prijelaz na glavni izbornik.
   * Popup: prvo meni u openeru; ako se prozor ne zatvori, nakon kratke pauze isti URL u ovom prozoru.
   */
  function nakonUspjeha() {
    var url = meniUrl();
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.location.replace(url);
      } catch (e1) {}
      try {
        window.close();
      } catch (e2) {}
      window.setTimeout(function () {
        if (document.visibilityState === 'visible') {
          window.location.replace(url);
        }
      }, 280);
    } else {
      window.location.replace(url);
    }
  }

  function ocistiPoljaIFokus() {
    if (userEl) {
      userEl.value = '';
      userEl.focus();
    }
    if (passEl) passEl.value = '';
    if (passConfirmEl) passConfirmEl.value = '';
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function vnlhPasswordMeetsPolicy(pass) {
    if (pass == null || String(pass).length < 8) return false;
    if (/[čćđšžČĆĐŠŽ]/.test(pass)) return false;
    if (!/[A-Z]/.test(pass)) return false;
    if (!/[0-9]/.test(pass)) return false;
    var hasSpecial = false;
    for (var i = 0; i < PASSWORD_SPECIALS.length; i++) {
      if (pass.indexOf(PASSWORD_SPECIALS.charAt(i)) !== -1) {
        hasSpecial = true;
        break;
      }
    }
    if (!hasSpecial) return false;
    for (var j = 0; j < pass.length; j++) {
      var ch = pass.charAt(j);
      var o = ch.charCodeAt(0);
      var asciiLetter = (o >= 65 && o <= 90) || (o >= 97 && o <= 122);
      var digit = o >= 48 && o <= 57;
      if (asciiLetter || digit) continue;
      if (PASSWORD_SPECIALS.indexOf(ch) !== -1) continue;
      return false;
    }
    return true;
  }

  function show025() {
    if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['025']) {
      window.showPorukaModal('025', []);
    }
  }

  /** Blokada (026): modal, zatim ponovno učitavanje stranice prijave. */
  function prikaziBlokiran() {
    var loginUrl = vnlhUrlFromInjectedPath(window.__VNLH_LOGIN_API_PATH__, 'Login.php');
    if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['026']) {
      window.showPorukaModal('026', [], function () {
        window.location.href = loginUrl;
      });
    } else {
      window.location.href = loginUrl;
    }
    ocistiPoljaIFokus();
  }

  function wireToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', function () {
      var jeText = input.getAttribute('type') === 'text';
      input.setAttribute('type', jeText ? 'password' : 'text');
      btn.setAttribute('aria-label', jeText ? 'Prikaži lozinku' : 'Sakrij lozinku');
      btn.setAttribute('aria-pressed', jeText ? 'false' : 'true');
    });
  }

  wireToggle(btnToggle, passEl);
  wireToggle(btnToggleConfirm, passConfirmEl);

  /** Isti tekst kao php/vnlh_password_policy.php (kad PHP ne ubaci __VNLH_PASS_HINT__). */
  function buildPassHintText() {
    var parts = [];
    for (var i = 0; i < PASSWORD_SPECIALS.length; i++) {
      parts.push(PASSWORD_SPECIALS.charAt(i));
    }
    var popis = parts.join(' ');
    return 'Lozinka mora sadržavati bar osam znakova od kojih bar jedno veliko slovo (A–Z), bar jednu numeričku cifru i bar jedan specijalni znak: '
      + popis + ', ne koristiti čćđšž znakove.';
  }

  function setHintText() {
    if (!hintTextEl) return;
    var h = window.__VNLH_PASS_HINT__;
    if (h == null || typeof h !== 'string' || trim(h) === '') {
      h = buildPassHintText();
    }
    hintTextEl.textContent = h;
  }

  function enterPassChangeMode(fromServerPage) {
    passChangeMode = true;
    if (titleEl) titleEl.textContent = 'Promjena lozinke';
    if (btnSubmitLabel) btnSubmitLabel.textContent = 'Spremi';
    if (userEl) {
      userEl.readOnly = true;
      if (fromServerPage && typeof window.__VNLH_LOGIN_LOGIN__ === 'string' && window.__VNLH_LOGIN_LOGIN__) {
        userEl.value = window.__VNLH_LOGIN_LOGIN__;
      }
    }
    /* Polje za novo korisničko ime — vidljivo samo u pass_change modu */
    if (newUserRow) newUserRow.removeAttribute('hidden');
    if (newUserEl) newUserEl.value = '';
    if (passEl) {
      passEl.value = '';
      passEl.setAttribute('autocomplete', 'new-password');
    }
    if (passConfirmEl) {
      passConfirmEl.value = '';
      passConfirmEl.setAttribute('autocomplete', 'new-password');
    }
    setHintText();
    if (confirmRow) {
      confirmRow.removeAttribute('hidden');
    }
    if (hintsEl) {
      hintsEl.removeAttribute('hidden');
    }
    if (passEl) passEl.focus();
  }

  /** Poruka 027 — korisničko ime već postoji; fokus na novo korisničko ime */
  function show027() {
    if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['027']) {
      window.showPorukaModal('027', [], function () {
        if (newUserEl) newUserEl.focus();
      });
    } else {
      if (newUserEl) newUserEl.focus();
    }
  }

  function pokreniPromjenuLozinke() {
    var p1 = passEl ? String(passEl.value) : '';
    var p2 = passConfirmEl ? String(passConfirmEl.value) : '';
    if (p1 !== p2 || trim(p1) === '') {
      show025();
      return;
    }
    if (!vnlhPasswordMeetsPolicy(p1)) {
      show025();
      return;
    }
    var loginNew = newUserEl ? trim(newUserEl.value) : '';
    var params = { pass_new: p1, pass_confirm: p2 };
    if (loginNew !== '') params.login_new = loginNew;
    postFormData(API_PASS_PROMJENA, params, function (res) {
      res = trim(res || '');
      if (res === 'OK') {
        nakonUspjeha();
      } else if (res === '027') {
        show027();
      } else if (res === '025') {
        show025();
      } else {
        ocistiPoljaIFokus();
      }
    });
  }

  function pokreniLogin() {
    if (passChangeMode) {
      pokreniPromjenuLozinke();
      return;
    }
    var login = userEl ? trim(userEl.value) : '';
    var pass = passEl ? String(passEl.value) : '';
    postFormData(API_LOGIN, { login: login, pass: pass }, function (res) {
      res = normalizeOdgovorServera(res);
      if (res === 'OK') {
        nakonUspjeha();
      } else if (res === 'PASS_CHANGE') {
        enterPassChangeMode(false);
      } else if (res === '026') {
        prikaziBlokiran();
      } else {
        ocistiPoljaIFokus();
      }
    });
  }

  if (btnOdustani) {
    btnOdustani.addEventListener('click', function () {
      if (passChangeMode) {
        window.location.href = LOGOUT_URL;
        return;
      }
      zatvoriLoginProzor();
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener('click', function () {
      pokreniLogin();
    });
  }

  if (passEl) {
    passEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') pokreniLogin();
    });
  }
  if (passConfirmEl) {
    passConfirmEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') pokreniLogin();
    });
  }
  if (userEl) {
    userEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (passChangeMode && newUserEl) {
          newUserEl.focus();
        } else if (passEl) passEl.focus();
      }
    });
  }
  if (newUserEl) {
    newUserEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && passEl) passEl.focus();
    });
  }

  if (typeof window.__VNLH_LOGIN_PASS_CHANGE__ !== 'undefined' && window.__VNLH_LOGIN_PASS_CHANGE__) {
    enterPassChangeMode(true);
  } else if (userEl) {
    userEl.focus();
  }
})();
