/* 0-Common.js – zajedničke validacije, error handler, poruke u modalima;
   CommonCRUD – zajednička logika za template formu (tablica + jedan edit, CRUD).
   Koristi KontroleTablica iz 0-Kontrole.js (redoslijed: 0-Kontrole.js → 0-Common.js → stranica_CRUD.js). */
   
/* TODO – CSRF zaštita (implementirati kad završi tekući razvoj):
   Trenutna zaštita oslanja se na SameSite=Lax kolačić (blokira cross-site POST iz browsera).
   Za potpunu zaštitu potrebno je uvesti CSRF token:
   - PHP: generirati token u sesiji (npr. $_SESSION['csrf_token']) i slati ga kao meta tag ili
     hidden polje u svakom HTML-u.
   - JS: čitati token iz meta taga i dodavati ga kao header (X-CSRF-Token) na svaki fetch/POST
     zahtjev — centralno ovdje u 0-Common.js (CommonCRUD ili zajednički fetch wrapper).
   - PHP API: svaki require_login_api.php (ili zasebna provjera) verificira header naspram
     $_SESSION['csrf_token']; nepodudaranje → 403.
   Zahvat: sve PHP API skripte + ovaj JS modul (jedan wrapper). */

(function () {
  'use strict';

  // -------------------------------------------------------
  var _h = location.hostname;
  if (_h === 'localhost' || _h === '127.0.0.1' ||
      /^192\.168\./.test(_h) || /^10\./.test(_h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(_h)) {
    document.body.classList.add('env-dev');
  }
  // -------------------------------------------------------

  /**
   * Označi da odlazak s dokumenta nije „zatvaranje kartice” nego unutarnja navigacija ili
   * kontrolirani redirect (npr. Login nakon 401). Inače pagehide + sendBeacon na
   * sesija_zatvori_karticu.php može uništiti PHP sesiju prije nego što preglednik učita sljedeću
   * stranicu — korisnik završi na Loginu iako je navigacija bila namjerna (Povratak, Meni, …).
   * Definirano izvan ping inita da postoji i kad __VNLH_SESIJA_PING__ nije postavljen.
   */
  window.vnlhMarkInternalAppNavigation = function () {
    try {
      window.__vnlhAppNavInternal = true;
    } catch (eMark) {}
  };

  /* --- Blok: Debounce „Traži“ (ms) — sustav_varijable.id = 114; čita Napredovanja_CRUD, Duznosnici_Osobe_CRUD, Lista --- */
  var VNLH_VAR_ID_PRONADJI_STANKA_MS = 114;
  var VNLH_PRONADJI_STANKA_MS_DEFAULT = 1000;

  /**
   * Trenutna stanka (ms) za debounce polja Pronađi/Traži. Postavlja vnlhLoadPronadjiStankaMsFromVar114;
   * dok učitavanje ne završi, ponaša se kao zadano (1000 ms).
   */
  window.vnlhGetPronadjiStankaMs = function () {
    try {
      var x = window.__VNLH_PRONADJI_STANKA_MS;
      if (typeof x === 'number' && !isNaN(x) && x >= 0) {
        return x;
      }
    } catch (eMs) {}
    return VNLH_PRONADJI_STANKA_MS_DEFAULT;
  };

  /**
   * Jednokratno dohvaća varijablu 114 (GET common_sustav_varijable.php). apiBase npr. '../php/'.
   * Nevaljan odgovor ili greška API-ja → __VNLH_PRONADJI_STANKA_MS = 1000.
   */
  window.vnlhLoadPronadjiStankaMsFromVar114 = function (apiBase, callback) {
    var base = apiBase != null && String(apiBase) !== '' ? String(apiBase) : '../php/';
    var url = base.replace(/\/?$/, '/') + 'common_sustav_varijable.php?id=' + VNLH_VAR_ID_PRONADJI_STANKA_MS;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
        return;
      }
      var ms = VNLH_PRONADJI_STANKA_MS_DEFAULT;
      var raw = trim(xhr.responseText || '');
      /* API vraća '100' / '120' pri grešci; uspjeh = sadržaj stupca varijabla (broj ms). */
      if (xhr.status === 200 && raw !== '' && raw !== '100' && raw !== '120') {
        var n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 0) {
          ms = n;
        }
      }
      try {
        window.__VNLH_PRONADJI_STANKA_MS = ms;
      } catch (eSet) {}
      if (typeof callback === 'function') {
        callback(ms);
      }
    };
    xhr.send();
  };

  /* --- Blok: Godina istinske svjetlosti (pretvorba datuma u „budući" kalendar) ---
     Naputak: docs/Izracun_datuma.md. Y_nova = Y + 4000; M_novi = ((M-3+12) mod 12)+1 (ožujak=1); dan ostaje.
     Ulaz: Date objekt, ili string "YYYY-MM-DD" (DB/ISO, uz opc. vrijeme) ili "D.M.YYYY"/"DD.MM.YYYY" (lokalni).
     Izlaz: "D. dan <rimski mjesec> mjeseca Y. godine" (npr. "18. dan IV mjeseca 6026. godine"); nevaljan/prazan ulaz → "". */
  window.Godina_Istinske_Svjetlosti = function (datum) {
    var D, M, Y, m;
    if (datum instanceof Date) {
      if (isNaN(datum.getTime())) return '';
      D = datum.getDate(); M = datum.getMonth() + 1; Y = datum.getFullYear();
    } else if (typeof datum === 'string') {
      var s = trim(datum);
      if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) {        // YYYY-MM-DD (DB/ISO)
        Y = +m[1]; M = +m[2]; D = +m[3];
      } else if ((m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/))) {  // D.M.YYYY / DD.MM.YYYY (lokalni)
        D = +m[1]; M = +m[2]; Y = +m[3];
      } else {
        return '';
      }
    } else {
      return '';
    }
    if (!(Y >= 1) || M < 1 || M > 12 || D < 1 || D > 31) return '';
    var Mnovi = ((M - 3 + 12) % 12) + 1;
    var Ynova = Y + 4000;
    var rim = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    var mjRim = rim[Mnovi] || String(Mnovi);
    return D + '. dan ' + mjRim + ' mjeseca ' + Ynova + '. godine';
  };

  /** Dob/starost iz datuma rođenja → "N godina"/"N godine" (relativno na danas). Prima Date/'YYYY-MM-DD'/'DD.MM.YYYY'.
   *  Hrv. mutacija: završetak 2,3,4 → "godine"; 1,5,6,7,8,9,0 → "godina"; iznimka 11–14 → "godina". */
  window.Izračun_Dobi = function (datum) {
    var D, M, Y, m;
    if (datum instanceof Date) {
      if (isNaN(datum.getTime())) return '';
      D = datum.getDate(); M = datum.getMonth() + 1; Y = datum.getFullYear();
    } else if (typeof datum === 'string') {
      var s = trim(datum);
      if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) { Y = +m[1]; M = +m[2]; D = +m[3]; }
      else if ((m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?$/))) { D = +m[1]; M = +m[2]; Y = +m[3]; }
      else { return ''; }
    } else { return ''; }
    if (!(Y >= 1) || M < 1 || M > 12 || D < 1 || D > 31) return '';
    var sad = new Date();
    var dob = sad.getFullYear() - Y;
    if ((sad.getMonth() + 1) < M || ((sad.getMonth() + 1) === M && sad.getDate() < D)) dob--;
    if (dob < 0) dob = 0;
    var dd = dob % 100, d1 = dob % 10;
    var rijec = (dd >= 11 && dd <= 14) ? 'godina' : ((d1 >= 2 && d1 <= 4) ? 'godine' : 'godina');
    return dob + ' ' + rijec;
  };

  /* --- Blok: Meni – hover kašnjenje: 116 = glavna stavka (prvi dropdown), 115 = podmeni/ugniježđeni (114 = Traži, ne miješati) --- */
  var VNLH_VAR_ID_MENI_MAIN_HOVER_MS = 116;
  var VNLH_VAR_ID_MENI_DROPDOWN_HOVER_MS = 115;
  var MENI_HOVER_OPEN_MS_DEFAULT_MAIN = 300;
  var MENI_HOVER_OPEN_MS_DEFAULT_DROPDOWN = 500;

  /**
   * Glavna stavka trake: ms prije prikaza prvog dropdowna (hover). Varijabla 116 > 0; inače 300.
   */
  window.vnlhGetMeniHoverDelayMainMs = function () {
    try {
      var x = window.__VNLH_MENI_MAIN_HOVER_MS;
      if (typeof x === 'number' && !isNaN(x) && x > 0) {
        return x;
      }
    } catch (eMh) {}
    return MENI_HOVER_OPEN_MS_DEFAULT_MAIN;
  };

  /**
   * Podmeni / ugniježđeni dropdown: ms prije proširenja (hover). Varijabla 115 > 0; inače 500.
   */
  window.vnlhGetMeniHoverDelayPodmeniMs = function () {
    try {
      var x = window.__VNLH_MENI_DROPDOWN_HOVER_MS;
      if (typeof x === 'number' && !isNaN(x) && x > 0) {
        return x;
      }
    } catch (eMh2) {}
    return MENI_HOVER_OPEN_MS_DEFAULT_DROPDOWN;
  };

  /**
   * Dohvat varijabli 116 i 115 (dva GET-a). 0 / greška → zadane vrijednosti kao dosad.
   */
  window.vnlhLoadMeniHoverDelaysFromVar116And115 = function (apiBase, callback) {
    var base = apiBase != null && String(apiBase) !== '' ? String(apiBase) : '../php/';
    var pending = 2;
    function doneOne() {
      pending--;
      if (pending === 0 && typeof callback === 'function') {
        callback();
      }
    }
    function fetchVar(id, windowKey) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', base.replace(/\/?$/, '/') + 'common_sustav_varijable.php?id=' + id, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
          return;
        }
        var raw = trim(xhr.responseText || '');
        if (xhr.status === 200 && raw !== '' && raw !== '100' && raw !== '120') {
          var n = parseInt(raw, 10);
          if (!isNaN(n) && n > 0) {
            try {
              window[windowKey] = n;
            } catch (eSetMh) {}
          }
        }
        doneOne();
      };
      xhr.send();
    }
    fetchVar(VNLH_VAR_ID_MENI_MAIN_HOVER_MS, '__VNLH_MENI_MAIN_HOVER_MS');
    fetchVar(VNLH_VAR_ID_MENI_DROPDOWN_HOVER_MS, '__VNLH_MENI_DROPDOWN_HOVER_MS');
  };

  /** Uklanja vodeće i prateće razmake iz stringa; null/undefined → prazan string. */
  function trim(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  /** Vraća breakpoint (px) iz tokena --page_breakpoint_narrow (0-Common.css); fallback 640. */
  function getPageBreakpointNarrow() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--page_breakpoint_narrow');
      var num = parseInt(String(v || '').replace(/\D/g, ''), 10);
      return isNaN(num) || num < 1 ? 640 : num;
    } catch (e) { return 640; }
  }

  /**
   * Validacija brojeva s min/max: dozvoljava samo brojeve, bez strelica gore/dolje.
   * @param {HTMLElement} input - Input element
   * @param {number} min - Minimalna vrijednost (ako je manje, vraća min)
   * @param {number} max - Maksimalna vrijednost (ako je više, vraća max)
   * @param {boolean} allowEmpty - Dozvoljava li prazan unos (default: true)
   */
  function initNumericValidation(input, min, max, allowEmpty) {
    if (!input || input.tagName !== 'INPUT') return;
    if (allowEmpty === undefined) allowEmpty = true;
    input.type = 'text';
    input.inputMode = 'numeric';
    
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        return;
      }
    });

    input.addEventListener('input', function () {
      var val = this.value;
      if (val === '' && allowEmpty) {
        return;
      }
      var numOnly = val.replace(/\D/g, '');
      if (numOnly === '') {
        this.value = '';
        return;
      }
      var num = parseInt(numOnly, 10);
      if (isNaN(num)) {
        this.value = '';
        return;
      }
      if (num < min) {
        this.value = String(min);
      } else if (num > max) {
        this.value = String(max);
      } else {
        this.value = String(num);
      }
    });

    input.addEventListener('blur', function () {
      var val = this.value.trim();
      if (val === '' && allowEmpty) {
        return;
      }
      var num = parseInt(val, 10);
      if (isNaN(num)) {
        if (allowEmpty) {
          this.value = '';
        } else {
          this.value = String(min);
        }
        return;
      }
      if (num < min) {
        this.value = String(min);
      } else if (num > max) {
        this.value = String(max);
      }
    });
  }

  window.CommonNumericValidation = initNumericValidation;

  /**
   * Upis telefona: + dozvoljen samo na prvom mjestu, ostalo znamenke i najviše 3 razmaka.
   * @param {HTMLInputElement} input - Polje za telefon
   */
  function upis_telefona(input) {
    if (!input || input.tagName !== 'INPUT') return;
    input.addEventListener('input', function () {
      var s = this.value;
      var out = '';
      var plusDone = false;
      var spaceCount = 0;
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (c === '+' && !plusDone && out.length === 0) { out += c; plusDone = true; continue; }
        if (c === ' ') { if (spaceCount < 3) { out += c; spaceCount++; } continue; }
        if (/\d/.test(c)) { out += c; continue; }
      }
      this.value = out;
    });
    input.addEventListener('blur', function () {
      this.value = this.value.replace(/\s+$/g, '');
    });
  }

  /**
   * Upis maila: dozvoljeni samo znakovi u sintaksi e-mail adrese (slova, znamenke, @ . _ % + -).
   * @param {HTMLInputElement} input - Polje za e-mail
   */
  function upis_maila(input) {
    if (!input || input.tagName !== 'INPUT') return;
    input.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9@._%+-]/g, '');
    });
  }

  /**
   * Samo numerika: dozvoljen samo upis znamenki, opcionalno ograničenje duljine.
   * @param {HTMLInputElement} input - Polje
   * @param {number} [maxLength] - Maksimalan broj znamenki (npr. 5 za poštu)
   */
  function initSamoNumerika(input, maxLength) {
    if (!input || input.tagName !== 'INPUT') return;
    input.type = 'text';
    input.inputMode = 'numeric';
    input.addEventListener('input', function () {
      var num = this.value.replace(/\D/g, '');
      if (maxLength != null && num.length > maxLength) num = num.slice(0, maxLength);
      this.value = num;
    });
  }

  window.upis_telefona = upis_telefona;
  window.upis_maila = upis_maila;
  window.initSamoNumerika = initSamoNumerika;

  /** Relativni URL stranice prijave (php/Login.php – GET forma i POST API). */
  function vnlhLoginPageUrl() {
    var p = window.location.pathname || '';
    if (/\/php\//i.test(p)) {
      return new URL('Login.php', window.location.href).href;
    }
    if (/\/html\//i.test(p) || /\/html$/i.test(p)) {
      return new URL('../php/Login.php', window.location.href).href;
    }
    return new URL('php/Login.php', window.location.href).href;
  }

  /**
   * Ukloni pogrešan Windows disk ili punu lokalnu putanju iz polja meni.putanja (npr. D:/VNLH WEB/php/...).
   * Inače vnlhJoinAppRelativePath gradi href s D: u putanji → http://localhost/D:/... (403).
   */
  function vnlhSanitizeMenuPathFromDb(path) {
    var s = trim(String(path != null ? path : '')).replace(/\\/g, '/');
    if (s.indexOf(':') < 0) {
      return s;
    }
    var low = s.toLowerCase();
    var ix = low.indexOf('/php/');
    if (ix >= 0) {
      return s.slice(ix + 1);
    }
    ix = low.indexOf('/html/');
    if (ix >= 0) {
      return s.slice(ix + 1);
    }
    ix = low.indexOf('php/');
    if (ix >= 0) {
      return s.slice(ix);
    }
    ix = low.indexOf('html/');
    if (ix >= 0) {
      return s.slice(ix);
    }
    return s;
  }

  /**
   * Pojednostavi relativnu putanju iz menija: ukloni ./ i riješi .. (vodeći .. padaju – ispod korijena app nema kud).
   * "putanja" ../ ili ../ u spoju s index.php inače daje /baza/../index.php → /index.php (XAMPP).
   */
  function vnlhNormalizeMenuRelPath(path) {
    var s = vnlhSanitizeMenuPathFromDb(path).replace(/^\/+/, '');
    if (!s) return '';
    var parts = s.split('/').filter(function (x) { return x !== '' && x !== '.'; });
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '..') {
        if (out.length) out.pop();
      } else {
        out.push(parts[i]);
      }
    }
    return out.join('/');
  }

  /**
   * Spaja putanja + html_fajl iz tablice meni u jednu putanju relativnu na korijen aplikacije (ne na origin).
   * Vodeći "/" u bazi (npr. putanja "/") inače postaje href="/index.php" → http://localhost/index.php (XAMPP), a ne mapa projekta.
   */
  function vnlhJoinAppRelativePath(putanja, htmlFajl) {
    var p = vnlhNormalizeMenuRelPath(trim(putanja).replace(/\\/g, '/'));
    var f = vnlhNormalizeMenuRelPath(trim(htmlFajl).replace(/\\/g, '/'));
    if (!f) return '';
    var rel;
    if (f.indexOf('/') >= 0) {
      rel = f;
    } else if (!p) {
      rel = f;
    } else {
      rel = (p.slice(-1) === '/' ? p : p + '/') + f;
    }
    return vnlhNormalizeMenuRelPath(rel);
  }

  /**
   * Pathname korijena aplikacije (npr. /vnlh): roditelj mape html/ u URL-u.
   * Bez toga ../index.php s http://localhost/vnlh/php/Meni.php može dati ispravan URL, ali nekad preglednik
   * ili zapis u bazi završi na http://localhost/index.php (XAMPP welcome).
   */
  function vnlhAppBasePathname() {
    if (typeof window.__VNLH_APP_BASE_PATH__ === 'string' && window.__VNLH_APP_BASE_PATH__.length > 0 && window.__VNLH_APP_BASE_PATH__.charAt(0) === '/') {
      return window.__VNLH_APP_BASE_PATH__;
    }
    /* Fallback: izvodi baznu putanju iz window.location.pathname.
       Drive-letter putanje (npr. /D:/VNLH WEB/php/...) valjane su na HTTP serveru
       koji mapira puni Windows path u URL — odbacujemo ih samo za file: protokol. */
    var isFile = window.location.protocol === 'file:';
    var p = (window.location.pathname || '').replace(/\\/g, '/');
    var i = p.indexOf('/html/');
    if (i >= 0) {
      var cHtml = p.slice(0, i);
      if (isFile && cHtml.indexOf(':') >= 0) {
        return '';
      }
      return cHtml;
    }
    if (/\/index\.php$/i.test(p)) {
      var cIdx = p.slice(0, p.length - 10);
      return (isFile && cIdx.indexOf(':') >= 0) ? '' : cIdx;
    }
    if (/\/index\.html$/i.test(p)) {
      var cIdh = p.slice(0, p.length - 11);
      return (isFile && cIdh.indexOf(':') >= 0) ? '' : cIdh;
    }
    var j = p.indexOf('/php/');
    if (j >= 0) {
      var candidate = p.slice(0, j);
      if (isFile && candidate.indexOf(':') >= 0) {
        return '';
      }
      return candidate;
    }
    return '';
  }

  /**
   * Pathname za stavku menija: rel je put relativno na korijen projekta (npr. index.php, php/Meni.php).
   * Vraća npr. /vnlh/index.php – uvijek ispod istog prefiksa kao trenutna stranica.
   */
  function vnlhBuildMenuTargetHref(rel) {
    var r = vnlhNormalizeMenuRelPath(String(rel || '').trim().replace(/\\/g, '/'));
    if (r.indexOf('html/') === 0) {
      r = 'php/' + r.slice(5);
    }
    /* U mapi php/ nema .html datoteka (samo .php wrapperi). Ako je rel npr. php/meni_dohvat_stabla_menija.html
     * (pogreška u građenju ili bazi), pathname mora završiti na .php da povijest ne dobije nepostojeći .html. */
    if (/\.html$/i.test(r) && /(^|\/)php\//.test(r)) {
      r = r.replace(/\.html$/i, '.php');
    }
    if (!r) return '#';
    var base = vnlhAppBasePathname();
    var pathname;
    if (base !== '') {
      pathname = base + '/' + r;
      pathname = pathname.replace(/\/{2,}/g, '/');
      if (pathname.charAt(0) !== '/') pathname = '/' + pathname;
      return pathname;
    }
    try {
      return new URL('../' + r, window.location.href).pathname;
    } catch (e) {
      return '/' + r;
    }
  }

  /**
   * Kao php/vnlh_paths.php::vnlh_html_to_php_url: ime datoteke za stvarni GET (zaštićeni .php wrapper).
   * U JSON-u menija html_fajl ostaje .html; pri gradnji href-a za izvršnu stavku koristi se ova pretvorba.
   */
  function vnlhHtmlToPhpUrl(fajl) {
    var f = trim(String(fajl != null ? fajl : ''));
    if (f === '' || /^login\.html$/i.test(f) || /^login\.php$/i.test(f)) {
      return f;
    }
    if (/\.html$/i.test(f)) {
      return f.replace(/\.html$/i, '.php');
    }
    return f;
  }

  /**
   * Vrijednost za query parametar `ref` pri običnoj navigaciji (klik na stavku menija, gumb, link — ne eksplicitni
   * Povratak koji učitava cilj iz postojećeg ?ref=).
   * Ako trenutna stranica već ima ?ref=, ta se vrijednost prenosi nepromijenjeno (referenca „gdje na kraju stati”
   * ostaje ista kroz cijeli lanac formi).
   * Inače: pathname ove stranice; ako je pathname prazan, optional fallback (npr. /php/Meni.php).
   *
   * @param {string} [fallbackAkoPrazanPathname] – kad nema postojećeg ref i pathname je prazan (rijetko)
   * @returns {string}
   */
  function vnlhRefZaLinkSljedecaStranica(fallbackAkoPrazanPathname) {
    try {
      var params = new URLSearchParams(window.location.search);
      var existing = trim(params.get('ref'));
      if (existing !== '') return existing;
    } catch (e) {}
    var p = window.location.pathname || '';
    if (p !== '') {
      /* Drive-letter putanja (npr. /D:/VNLH WEB/php/Meni.php) valjana je na HTTP serveru
         koji mapira puni Windows path u URL. Odbacujemo je samo za file: protokol gdje
         takva putanja ne funkcionira kao ref za navigaciju između PHP stranica. */
      if (/^\/[A-Za-z]:\//.test(p) && window.location.protocol === 'file:') {
        var fbBad = fallbackAkoPrazanPathname != null ? trim(String(fallbackAkoPrazanPathname)) : '';
        return fbBad !== '' ? fbBad : '/';
      }
      return p;
    }
    var fb = fallbackAkoPrazanPathname != null ? trim(String(fallbackAkoPrazanPathname)) : '';
    return fb !== '' ? fb : '/';
  }

  /** URL skripte za odjavu (html/, korijen ili php/). */
  function vnlhLogoutUrl() {
    var p = window.location.pathname || '';
    if (/\/html\//i.test(p) || /\/html$/i.test(p)) {
      return new URL('../php/Logout.php', window.location.href).href;
    }
    if (/\/php\//i.test(p)) {
      return new URL('Logout.php', window.location.href).href;
    }
    return new URL('php/Logout.php', window.location.href).href;
  }

  /** Ikona odjave u desnoj strani trake naslova (.naslov-forme).
   *  Kreira wrapper .naslov-forme__ikone koji na mobilnom drži
   *  chat (opcionalno), mail i logout u istom redu. 0-Poruke.js ubacuje
   *  chat i mail u isti wrapper. */
  function vnlhInjectNaslovOdjava() {
    try {
      var path = window.location.pathname || '';
      if (/Login\.(html|php)/i.test(path)) return;
      if (document.body && document.body.classList.contains('login-win')) return;
      var list = document.querySelectorAll('.naslov-forme');
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.querySelector('.naslov-forme__odjava')) continue;

        /* Wrapper za ikone (chat + mail + logout) – koristi se za mobilni flex row */
        var wrapper = el.querySelector('.naslov-forme__ikone');
        if (!wrapper) {
          wrapper = document.createElement('div');
          wrapper.className = 'naslov-forme__ikone';
          el.appendChild(wrapper);
        }

        var a = document.createElement('button');
        a.type = 'button';
        a.className = 'naslov-forme__odjava';
        a.setAttribute('aria-label', 'Odjava');
        a.title = 'Odjava';
        var ns = 'http://www.w3.org/2000/svg';
        var svgEl = document.createElementNS(ns, 'svg');
        svgEl.setAttribute('class', 'naslov-forme__logout-icon');
        svgEl.setAttribute('width', '22'); svgEl.setAttribute('height', '22');
        svgEl.setAttribute('viewBox', '0 0 24 24'); svgEl.setAttribute('fill', 'none');
        svgEl.setAttribute('stroke', 'currentColor'); svgEl.setAttribute('stroke-width', '2');
        svgEl.setAttribute('stroke-linecap', 'round'); svgEl.setAttribute('stroke-linejoin', 'round');
        svgEl.setAttribute('aria-hidden', 'true');
        var p1 = document.createElementNS(ns, 'path'); p1.setAttribute('d', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'); svgEl.appendChild(p1);
        var p2 = document.createElementNS(ns, 'path'); p2.setAttribute('d', 'M16 17l5-5-5-5'); svgEl.appendChild(p2);
        var p3 = document.createElementNS(ns, 'path'); p3.setAttribute('d', 'M21 12H9'); svgEl.appendChild(p3);
        a.appendChild(svgEl);
        a.addEventListener('click', function () { window.location.href = vnlhLogoutUrl(); });
        wrapper.appendChild(a);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', vnlhInjectNaslovOdjava);
  } else {
    vnlhInjectNaslovOdjava();
  }

  /** Na 401 ili tijelo "401" od zaštićenog API-ja – preusmjeri na prijavu (pokriva sve XMLHttpRequest pozive, ne samo postFormData). */
  (function installVnlhXhr401Redirect() {
    if (typeof XMLHttpRequest === 'undefined') return;
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function () {
      this._vnlhXhrUrl = arguments[1];
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      if (!xhr._vnlh401Listener) {
        xhr._vnlh401Listener = true;
        xhr.addEventListener('readystatechange', function () {
          if (xhr.readyState !== 4) return;
          var u = String(xhr._vnlhXhrUrl || '');
          if (/Login\.php/i.test(u)) return;
          // responseText je čitljiv samo za responseType '' ili 'text'; binarni odgovori
          // (npr. pdfMake učitava fontove kao 'arraybuffer') inače bacaju InvalidStateError.
          var rt = xhr.responseType;
          if (rt !== '' && rt !== 'text') return;
          var text = (xhr.responseText || '').trim();
          if (xhr.status === 403 && text === 'PASS_CHANGE_REQUIRED') {
            if (typeof window.vnlhMarkInternalAppNavigation === 'function') window.vnlhMarkInternalAppNavigation();
            window.location.href = vnlhLoginPageUrl();
            return;
          }
          if (xhr.status !== 401 && text !== '401') return;
          if (typeof window.vnlhMarkInternalAppNavigation === 'function') window.vnlhMarkInternalAppNavigation();
          window.location.href = vnlhLoginPageUrl();
        });
      }
      return origSend.apply(this, arguments);
    };
  })();

  /** POST na url s params (objekt); callback prima odgovor (trimani string). */
  function postFormData(url, params, callback) {
    var formData = new FormData();
    for (var key in params) if (params.hasOwnProperty(key)) formData.append(key, params[key]);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = xhr.responseText ? xhr.responseText.trim() : '';
      if (xhr.status === 401 || t === '401') {
        if (typeof window.vnlhMarkInternalAppNavigation === 'function') window.vnlhMarkInternalAppNavigation();
        window.location.href = vnlhLoginPageUrl();
        return;
      }
      if (xhr.status === 403 && t === 'PASS_CHANGE_REQUIRED') {
        if (typeof window.vnlhMarkInternalAppNavigation === 'function') window.vnlhMarkInternalAppNavigation();
        window.location.href = vnlhLoginPageUrl();
        return;
      }
      callback(t);
    };
    xhr.send(formData);
  }

  /**
   * CommonCRUD – zajednička inicijalizacija tablice i primjena zaglavlja za template formu.
   * formConfig: Broj_Kolona, Reload_Ikona, Tablica_Zaglavlje; opcionalno CrudCssPrefix (npr. 'obredi-crud').
   * options: onReady(api), onSelectionChange(), onReloadClick() (ako Reload_Ikona === 1).
   */
  var CommonCRUD = {
    /** Vraća id selektiranog reda (prvi iz getSelectedRowIds) ili null. */
    getSelectedRowId: function (tablicaApi) {
      if (!tablicaApi || typeof tablicaApi.getSelectedRowIds !== 'function') return null;
      var ids = tablicaApi.getSelectedRowIds();
      return ids.length ? ids[0] : null;
    },

    /**
     * Inicijalizira tablicu u containerId: header (opcionalno s reload tipkom), KontroleTablica, MutationObserver, blokada sorta za sortable: 0.
     * options: { onReady(api), onSelectionChange(), onReloadClick() }
     */
    initTablica: function (containerId, formConfig, options) {
      options = options || {};
      var container = document.getElementById(containerId);
      if (!container || typeof KontroleTablica !== 'function') return null;
      var cfg = formConfig;
      var prefix = (cfg.CrudCssPrefix != null && cfg.CrudCssPrefix !== '') ? String(cfg.CrudCssPrefix) : 'common-crud';
      var nKolona = cfg.Broj_Kolona;

      if (cfg.Reload_Ikona === 1) {
        var panel = container.closest('.kontrola-panel-tablica');
        var body = container.parentElement;
        if (panel && body) {
          panel.classList.add('kontrola-panel-tablica--has-header');
          var wrap = document.createElement('div');
          wrap.className = prefix + '__reload-wrap';
          wrap.style.marginLeft = 'auto';
          wrap.style.flexShrink = '0';
          var reloadBtn = document.createElement('button');
          reloadBtn.type = 'button';
          reloadBtn.className = prefix + '__reload-btn kontrola-panel-tablica__reload-btn';
          reloadBtn.id = 'btnReloadTablica';
          reloadBtn.setAttribute('aria-label', 'Ponovno učitaj podatke');
          var icon = document.createElement('span');
          icon.className = 'kontrola-icon--arrow-path';
          icon.setAttribute('aria-hidden', 'true');
          reloadBtn.appendChild(icon);
          wrap.appendChild(reloadBtn);
          var existingHeader = panel.firstElementChild && panel.firstElementChild.classList && panel.firstElementChild.classList.contains('kontrola-panel__header') ? panel.firstElementChild : null;
          if (existingHeader) {
            existingHeader.classList.add(prefix + '__tablica-header');
            existingHeader.appendChild(wrap);
          } else {
            var header = document.createElement('div');
            header.className = 'kontrola-panel__header ' + prefix + '__tablica-header';
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'flex-end';
            header.appendChild(wrap);
            panel.insertBefore(header, body);
          }
          if (typeof options.onReloadClick === 'function') {
            reloadBtn.addEventListener('click', options.onReloadClick);
          }
        }
      }

      var zaglavlje = cfg.Tablica_Zaglavlje || [];
      var headerLabels = function (n) {
        var out = [];
        for (var c = 0; c < n && c < zaglavlje.length; c++) out.push(zaglavlje[c].title);
        while (out.length < n) out.push('');
        return out;
      };
      var headerColumns = (function () {
        var out = [];
        for (var c = 0; c < nKolona && c < zaglavlje.length; c++) {
          var col = zaglavlje[c];
          /* type: neovisno o velikom/malom slovu (t/T=tekst, n/N=numerik, d/D=datum, b/B=binarno) */
          /* type: t tekst, n broj, d datum, b binarno, i slika (URL u ćeliji – KontroleTablica iscrtava <img>). */
          var type = (col.type != null && col.type !== '') ? String(col.type).toLowerCase() : 't';
          /* align: neovisno o velikom/malom slovu (c/C, l/L, r/R) */
          var align = (col.align != null && col.align !== '') ? String(col.align).toLowerCase() : 'l';
          var cellReadonly = col.cell_readonly === 1 ? 1 : 0;
          var sortableCol = (col.sortable === 0 || col.sortable === '0') ? 0 : 1;
          out.push({ title: col.title, sortable_icon: col.sortable_icon === 1 ? 1 : 0, align: align, type: type, cell_readonly: cellReadonly, sortable: sortableCol });
        }
        while (out.length < nKolona) out.push({ title: '', sortable_icon: 0, align: 'l', type: 't', cell_readonly: 0, sortable: 1 });
        return out;
      })();

      var getRowId = (typeof options.getRowId === 'function') ? options.getRowId : function (row, index) { return row.length > 1 ? row[1] : index; };
      var onSelectionChange = typeof options.onSelectionChange === 'function' ? options.onSelectionChange : null;

      var tablicaApi = KontroleTablica(container, {
        getBrojKolona: function () { return nKolona; },
        headerLabels: headerLabels,
        headerColumns: headerColumns,
        data: [],
        getRowId: getRowId,
        onSelectionChange: function () { if (onSelectionChange) onSelectionChange(); }
      });

      var syncHeaderOnChange = options.syncHeaderOnChange !== false;
      if (syncHeaderOnChange) {
        requestAnimationFrame(function () {
          var tbody = container.querySelector('.kontrola-tablica__scroll table tbody');
          if (tbody && typeof MutationObserver !== 'undefined') {
            var pendingRaf = null;
            var mo = new MutationObserver(function () {
              if (pendingRaf != null) return;
              pendingRaf = requestAnimationFrame(function () {
                pendingRaf = null;
                CommonCRUD.primijeniTablicaZaglavlje(container, zaglavlje);
              });
            });
            mo.observe(tbody, { childList: true, subtree: true });
          }
        });
      }

      container.addEventListener('click', function (e) {
        var th = e.target && e.target.closest ? e.target.closest('th') : null;
        if (th && container.contains(th) && th.getAttribute('data-sortable') === '0') {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);

      if (typeof options.onReady === 'function') options.onReady(tablicaApi);
      return tablicaApi;
    },

    /**
     * Primjenjuje mobitel_prikaz: na uskom ekranu (--page_breakpoint_narrow) sakriva kolone s mobitel_prikaz === 0 (th/td/col),
     * vidljivim kolonama preračunava širine (B). Kad nije usko, vraća sve kolone i ponovo primjenjuje širine iz zaglavlja.
     */
    primijeniMobitelPrikaz: function (container, zaglavlje) {
      if (!container || !zaglavlje || zaglavlje.length === 0) return;
      var bp = getPageBreakpointNarrow();
      var narrow = typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: ' + bp + 'px)').matches;
      var headerTable = container.querySelector('.kontrola-tablica__header table');
      var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
      var bodyTable = scrollDiv && scrollDiv.querySelector('table');
      var tbody = bodyTable && bodyTable.querySelector('tbody');
      var n = zaglavlje.length;
      var visible = [];
      for (var c = 0; c < n; c++) {
        var val = zaglavlje[c] && zaglavlje[c].mobitel_prikaz;
        if (val === undefined || val === null) val = 1;
        var hide = narrow && (val === 0 || val === '0');
        if (!hide) visible.push(c);
        var display = hide ? 'none' : '';
        if (headerTable && headerTable.rows[0] && headerTable.rows[0].cells[c]) {
          var thEl = headerTable.rows[0].cells[c];
          if (hide) thEl.style.setProperty('display', 'none', 'important');
          else thEl.style.removeProperty('display');
        }
        if (tbody) {
          for (var r = 0; r < tbody.rows.length; r++) {
            var cells = tbody.rows[r].cells;
            if (cells[c]) {
              if (hide) cells[c].style.setProperty('display', 'none', 'important');
              else cells[c].style.removeProperty('display');
            }
          }
        }
      }
      function setColWidth(colEl, wNum) {
        if (!colEl) return;
        if (wNum > 0) {
          var px = wNum + 'px';
          colEl.style.width = px;
          colEl.style.minWidth = px;
          colEl.style.maxWidth = px;
        } else if (wNum < 0) {
          var pct = Math.abs(wNum) + '%';
          colEl.style.width = pct;
          colEl.style.minWidth = '';
          colEl.style.maxWidth = pct;
        } else {
          colEl.style.width = '';
          colEl.style.minWidth = '';
          colEl.style.maxWidth = '';
        }
      }
      function setThTdWidth(el, wNum) {
        if (!el) return;
        if (wNum > 0) {
          var px = wNum + 'px';
          el.style.width = px;
          el.style.minWidth = px;
          el.style.maxWidth = px;
        } else if (wNum < 0) {
          var pct = Math.abs(wNum) + '%';
          el.style.width = pct;
          el.style.minWidth = '';
          el.style.maxWidth = pct;
        } else {
          el.style.width = '';
          el.style.minWidth = '';
          el.style.maxWidth = '';
        }
      }
      var headerColgroup = headerTable && headerTable.querySelector('colgroup');
      var bodyColgroup = bodyTable && bodyTable.querySelector('colgroup');
      var headerRow0 = headerTable && headerTable.rows[0];
      var hasHiddenCols = narrow && visible.length < n;
      if (container) {
        if (hasHiddenCols) container.classList.add('tablica--mob-reduced');
        else container.classList.remove('tablica--mob-reduced');
      }
      if (narrow) {
        if (hasHiddenCols && headerTable) { headerTable.style.minWidth = '0'; headerTable.style.width = '100%'; }
        if (hasHiddenCols && bodyTable) { bodyTable.style.minWidth = '0'; bodyTable.style.width = '100%'; }
        for (c = 0; c < n; c++) {
          var colCfg = zaglavlje[c];
          val = colCfg && colCfg.mobitel_prikaz;
          if (val === undefined || val === null) val = 1;
          hide = val === 0 || val === '0';
          var colHeader = headerColgroup && headerColgroup.children[c];
          var colBody = bodyColgroup && bodyColgroup.children[c];
          var wCol = colCfg && colCfg.width !== undefined && colCfg.width !== null ? Number(colCfg.width) : 0;
          if (hide) {
            if (colHeader) { colHeader.style.width = '0px'; colHeader.style.minWidth = '0px'; colHeader.style.maxWidth = '0px'; colHeader.style.display = 'none'; }
            if (colBody) { colBody.style.width = '0px'; colBody.style.minWidth = '0px'; colBody.style.maxWidth = '0px'; colBody.style.display = 'none'; }
          } else {
            if (colHeader) colHeader.style.display = '';
            if (colBody) colBody.style.display = '';
            var useW = wCol;
            if (hasHiddenCols && wCol === 0) useW = 0;
            setColWidth(colHeader, useW);
            setColWidth(colBody, useW);
          }
          if (!hide) {
            var th = headerRow0 && headerRow0.cells[c];
            var useWCell = wCol;
            if (hasHiddenCols && wCol === 0) useWCell = 0;
            setThTdWidth(th, useWCell);
            if (tbody) {
              for (var r = 0; r < tbody.rows.length; r++) {
                setThTdWidth(tbody.rows[r].cells[c], useWCell);
              }
            }
          }
        }
      } else {
        if (headerTable) { headerTable.style.minWidth = ''; headerTable.style.width = ''; }
        if (bodyTable) { bodyTable.style.minWidth = ''; bodyTable.style.width = ''; }
        for (c = 0; c < n; c++) {
          var colCfgWide = zaglavlje[c];
          var colHeaderWide = headerColgroup && headerColgroup.children[c];
          var colBodyWide = bodyColgroup && bodyColgroup.children[c];
          if (colHeaderWide) { colHeaderWide.style.display = ''; colHeaderWide.style.width = ''; colHeaderWide.style.minWidth = ''; colHeaderWide.style.maxWidth = ''; }
          if (colBodyWide) { colBodyWide.style.display = ''; colBodyWide.style.width = ''; colBodyWide.style.minWidth = ''; colBodyWide.style.maxWidth = ''; }
          var wWide = colCfgWide && colCfgWide.width !== undefined && colCfgWide.width !== null ? Number(colCfgWide.width) : 0;
          setColWidth(colHeaderWide, wWide);
          setColWidth(colBodyWide, wWide);
          var thWide = headerRow0 && headerRow0.cells[c];
          setThTdWidth(thWide, wWide);
          if (tbody) {
            for (var rW = 0; rW < tbody.rows.length; rW++) {
              setThTdWidth(tbody.rows[rW].cells[c], wWide);
            }
          }
        }
      }
    },

    /**
     * Primjenjuje parametre zaglavlja na DOM: th (align, width, sortable), td (row_align, suffix), colgroup/single-col width.
     */
    primijeniTablicaZaglavlje: function (container, zaglavlje) {
      if (!container || !zaglavlje || zaglavlje.length === 0) return;
      container._crudZaglavlje = zaglavlje;
      container.classList.add('kontrola-tablica--crud-zaglavlje');
      var n = zaglavlje.length;
      var headerTable = container.querySelector('.kontrola-tablica__header table');
      var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
      var bodyTable = scrollDiv && scrollDiv.querySelector('table');
      var tbody = bodyTable && bodyTable.querySelector('tbody');

      var singleColPct = (n === 1 && zaglavlje[0] && zaglavlje[0].width !== undefined && zaglavlje[0].width !== null && Number(zaglavlje[0].width) < 0)
        ? Math.abs(Number(zaglavlje[0].width))
        : 0;
      if (singleColPct > 0 && singleColPct <= 100) {
        var pctVal = singleColPct + '%';
        var headerDiv = container.querySelector('.kontrola-tablica__header');
        if (headerDiv) {
          headerDiv.style.width = pctVal;
          headerDiv.style.maxWidth = pctVal;
          headerDiv.style.boxSizing = 'border-box';
        }
        if (headerTable) {
          headerTable.setAttribute('data-width-pct', String(singleColPct));
          headerTable.style.width = '100%';
          headerTable.style.maxWidth = '';
        }
        if (bodyTable) {
          bodyTable.style.width = pctVal;
          bodyTable.style.maxWidth = pctVal;
        }
        function applyTableWidthPct() {
          var hDiv = container.querySelector('.kontrola-tablica__header');
          var h = container.querySelector('.kontrola-tablica__header table');
          var b = container.querySelector('.kontrola-tablica__scroll table');
          if (hDiv) { hDiv.style.width = pctVal; hDiv.style.maxWidth = pctVal; }
          if (h) { h.style.width = '100%'; h.style.maxWidth = ''; }
          if (b) { b.style.width = pctVal; b.style.maxWidth = pctVal; }
        }
        requestAnimationFrame(function () { requestAnimationFrame(applyTableWidthPct); });
      } else {
        var headerDivElse = container.querySelector('.kontrola-tablica__header');
        if (headerDivElse) { headerDivElse.style.width = ''; headerDivElse.style.maxWidth = ''; headerDivElse.style.boxSizing = ''; }
        if (headerTable) {
          headerTable.removeAttribute('data-width-pct');
          headerTable.style.width = '';
          headerTable.style.maxWidth = '';
        }
        if (bodyTable) {
          bodyTable.style.width = '';
          bodyTable.style.maxWidth = '';
        }
        function ensureColgroup(table, numCols) {
          if (!table || numCols < 1) return;
          var cg = table.querySelector('colgroup');
          if (!cg) {
            cg = document.createElement('colgroup');
            table.insertBefore(cg, table.firstChild);
          }
          cg.innerHTML = '';
          for (var i = 0; i < numCols; i++) {
            var col = document.createElement('col');
            var colCfg = zaglavlje[i];
            if (colCfg && (colCfg.mobitel_prikaz === 0 || colCfg.mobitel_prikaz === '0')) col.setAttribute('data-mob-hide', '1');
            else col.removeAttribute('data-mob-hide');
            if (colCfg && colCfg.width !== undefined && colCfg.width !== null) {
              var w = Number(colCfg.width);
              if (w > 0) {
                var px = w + 'px';
                col.style.width = px;
                col.style.minWidth = px;
                col.style.maxWidth = px;
              } else if (w < 0) {
                col.style.width = Math.abs(w) + '%';
                col.style.minWidth = '';
              }
            }
            cg.appendChild(col);
          }
        }
        ensureColgroup(headerTable, n);
        ensureColgroup(bodyTable, n);
      }

      if (headerTable && headerTable.rows[0]) {
        for (var c = 0; c < n && c < headerTable.rows[0].cells.length; c++) {
          var col = zaglavlje[c];
          if (!col) continue;
          var th = headerTable.rows[0].cells[c];
          /* align iz zaglavlja: neovisno o velikom/malom slovu (c/C, l/L, r/R) */
          var align = (col.align != null ? String(col.align).toLowerCase() : 'l');
          if (align !== 'r' && align !== 'c') align = 'l';
          var alignVal = align === 'r' ? 'right' : (align === 'c' ? 'center' : 'left');
          th.style.setProperty('text-align', alignVal, 'important');
          if (col.mobitel_prikaz === 0 || col.mobitel_prikaz === '0') th.setAttribute('data-mob-hide', '1');
          else th.removeAttribute('data-mob-hide');
          var inner = th.querySelector('.kontrola-tablica__th-inner');
          var titleEl = th.querySelector('.kontrola-tablica__th-title');
          if (inner) inner.style.setProperty('text-align', alignVal, 'important');
          if (titleEl) {
            titleEl.style.setProperty('text-align', alignVal, 'important');
            if (align === 'c') {
              titleEl.style.setProperty('flex', '1', 'important');
              titleEl.style.setProperty('min-width', '0', 'important');
            } else {
              titleEl.style.removeProperty('flex');
              titleEl.style.removeProperty('min-width');
            }
          }
          var colWidth = col.width;
          if (colWidth !== undefined && colWidth !== null && Number(colWidth) !== 0) {
            var w = Number(colWidth);
            if (w > 0) {
              var thPx = w + 'px';
              th.style.width = thPx;
              th.style.minWidth = thPx;
              th.style.maxWidth = thPx;
            } else if (w < 0) {
              var pct = Math.abs(w) + '%';
              th.style.width = pct;
              th.style.minWidth = '';
              th.style.maxWidth = pct;
            }
          }
          if (col.sortable === 0) {
            th.classList.add('kontrola-tablica__th--no-sort');
            th.setAttribute('data-sortable', '0');
          } else {
            th.classList.remove('kontrola-tablica__th--no-sort');
            th.removeAttribute('data-sortable');
          }
          /* Tekst zaglavlja postaviti tek nakon orijentacije (align), da ne dođe do vizualnog skoka. */
          var titleText = (col.title != null ? String(col.title) : '');
          if (titleEl) titleEl.textContent = titleText;
          else th.textContent = titleText;
        }
      }
      if (!tbody) return;
      var rows = tbody.rows;
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].cells;
        for (var c = 0; c < n && c < cells.length; c++) {
          var col = zaglavlje[c];
          if (!col) continue;
          var td = cells[c];
          if (col.mobitel_prikaz === 0 || col.mobitel_prikaz === '0') td.setAttribute('data-mob-hide', '1');
          else td.removeAttribute('data-mob-hide');
          /* row_align: neovisno o velikom/malom slovu (l/L, c/C, r/R) */
          var ra = (col.row_align != null ? String(col.row_align).toLowerCase() : 'l');
          if (ra !== 'r' && ra !== 'c') ra = 'l';
          td.style.textAlign = ra === 'r' ? 'right' : (ra === 'c' ? 'center' : 'left');
          var cw = col.width;
          if (cw !== undefined && cw !== null) {
            var wNum = Number(cw);
            if (wNum > 0) {
              var tdPx = wNum + 'px';
              td.style.width = tdPx;
              td.style.minWidth = tdPx;
              td.style.maxWidth = tdPx;
            } else if (wNum < 0) {
              var pct = Math.abs(wNum) + '%';
              td.style.width = pct;
              td.style.minWidth = '';
              td.style.maxWidth = pct;
            }
          }
          if (col.suffix && String(col.type || '').toLowerCase() !== 'i') {
            var target = td.querySelector('.kontrola-tablica__cell-inner') || td;
            var t = (target.textContent || '').trim();
            if (t && !t.endsWith(col.suffix)) target.textContent = t + col.suffix;
          }
          /* Kolona type "b" (binarno) s cell_readonly: prikaz samo, klik ne mijenja checkbox ali propagira na red (selekcija). */
          var colTypeB = (col.type != null && String(col.type).toLowerCase() === 'b');
          if (colTypeB && col.cell_readonly) {
            var chk = td.querySelector('input[type="checkbox"]');
            if (chk) {
              chk.setAttribute('tabindex', '-1');
              chk.addEventListener('click', function (e) { e.preventDefault(); });
            }
          }
        }
      }
      CommonCRUD.primijeniMobitelPrikaz(container, zaglavlje);
    },

    /** Postavi podatke u tablicu i primijeni zaglavlje u sljedećem frame-u. */
    setDataTablica: function (tablicaApi, containerId, rows, zaglavlje) {
      if (tablicaApi && tablicaApi.setData) tablicaApi.setData(rows);
      var container = document.getElementById(containerId);
      if (container && zaglavlje) {
        var z = zaglavlje;
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { CommonCRUD.primijeniTablicaZaglavlje(container, z); });
        });
      }
    }
  };

  /** Resize / matchMedia: primjena mobitel_prikaz na sve tablice s crud zaglavljem (kao Lista.js). */
  function onCrudTablicaResize() {
    document.querySelectorAll('.kontrola-tablica--crud-zaglavlje').forEach(function (container) {
      var z = container._crudZaglavlje;
      if (z) CommonCRUD.primijeniMobitelPrikaz(container, z);
    });
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('resize', onCrudTablicaResize);
    var bp = getPageBreakpointNarrow();
    var mq = typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: ' + bp + 'px)');
    if (mq && mq.addEventListener) mq.addEventListener('change', onCrudTablicaResize);
    if (typeof document.documentElement.addEventListener === 'function') {
      document.documentElement.addEventListener('DOMContentLoaded', function () {
        requestAnimationFrame(function () { requestAnimationFrame(onCrudTablicaResize); });
      });
    }
  }

  /* =========================================================================
   * ▒▒ BLOK: PRAVA CRUD TIPKI ▒▒
   * Zajedničke funkcije za skrivanje/prikazivanje CRUD tipki (Upis/Izmjeni,
   * Izbriši) prema zastavicama upis_izmjena / brisanje_sloga iz
   * common_prava_crud.php.
   *
   * vnlhPrimijeniPravaCrud – primjenjuje hidden + style.display na tipke.
   *   CSS .kontrola-btn { display:inline-block } nadjačava [hidden],
   *   zato se koristi i hidden atribut (semantika) i style.display (garancija).
   *
   * vnlhUcitajPravaCrud – GET na common_prava_crud.php, parse JSON,
   *   bypass logika za Duznosnici_Ogranicenja_CRUD (sustav_varijable id=102),
   *   poziv vnlhPrimijeniPravaCrud, zatim callback.
   *
   * opcije parametar (neobavezan) za oba:
   *   upisiId   (string|null) – HTML id tipke Upis/Izmjeni; default 'btnUpisi'.
   *   izbrisiId (string|null) – HTML id tipke Izbriši; default 'btnIzbrisi'.
   *                             null = ta tipka ne postoji, preskače se.
   * ========================================================================= */

  /** HTML fajl za koji bypass (sustav_varijable id=102) ima efekt. */
  var VNLH_OGR_BYPASS_HTML = 'Duznosnici_Ogranicenja_CRUD.html';

  /**
   * Primjeni upis_izmjena i brisanje_sloga zastavice na CRUD tipke forme.
   * @param {number|string} upisIzmjena  1 = tipka vidljiva, 0 = skrivena
   * @param {number|string} brisanjeSloga  1 = tipka vidljiva, 0 = skrivena
   * @param {Object} [opcije]  { upisiId, izbrisiId } – nestandardni ID-evi
   */
  function vnlhPrimijeniPravaCrud(upisIzmjena, brisanjeSloga, opcije) {
    var opc = opcije || {};
    var upisiId   = opc.upisiId   !== undefined ? opc.upisiId   : 'btnUpisi';
    var izbrisiId = opc.izbrisiId !== undefined ? opc.izbrisiId : 'btnIzbrisi';

    var sakrijUpis    = (parseInt(upisIzmjena, 10) !== 1);
    var sakrijBrisanje = (parseInt(brisanjeSloga, 10) !== 1);

    if (upisiId) {
      var bUpisi = document.getElementById(upisiId);
      if (bUpisi) {
        bUpisi.hidden = sakrijUpis;
        bUpisi.style.display = sakrijUpis ? 'none' : '';
      }
    }
    if (izbrisiId) {
      var bIzbrisi = document.getElementById(izbrisiId);
      if (bIzbrisi) {
        bIzbrisi.hidden = sakrijBrisanje;
        bIzbrisi.style.display = sakrijBrisanje ? 'none' : '';
      }
    }
  }

  /**
   * Dohvati CRUD zastavice s common_prava_crud.php i primijeni ih.
   * Ako je htmlFajl = 'Duznosnici_Ogranicenja_CRUD.html' i ogr_bypass = 1,
   * tipke se NE skrivaju (bypass).
   *
   * @param {string} htmlFajl  ime HTML datoteke forme (mora odgovarati meni.html_fajl)
   * @param {Function} [callback]  callback(upisIzmjena, brisanjeSloga, ogrBypass)
   * @param {Object} [opcije]  { upisiId, izbrisiId }
   */
  function vnlhUcitajPravaCrud(htmlFajl, callback, opcije) {
    var base = vnlhAppBasePathname();
    var url = (base !== '' ? base : '') + '/php/common_prava_crud.php?html_fajl=' + encodeURIComponent(htmlFajl);
    url = url.replace(/\/{2,}/g, '/');
    if (url.charAt(0) !== '/') url = '/' + url;

    // Proslijedi id_duznosnik_test ako postoji u URL-u (Alati_Meni_Test)
    try {
      var sp = new URLSearchParams(window.location.search);
      var idt = sp.get('id_duznosnik_test');
      if (idt && parseInt(idt, 10) > 0) url += '&id_duznosnik_test=' + encodeURIComponent(idt);
    } catch (e) {}

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var obj = null;
      if (text !== '' && text.charAt(0) === '{') {
        try { obj = JSON.parse(text); } catch (e) {}
      }
      if (!obj) obj = { upis_izmjena: 0, brisanje_sloga: 0, ogr_bypass: 0 };

      var ui = obj.upis_izmjena != null ? parseInt(obj.upis_izmjena, 10) : 0;
      var bs = obj.brisanje_sloga != null ? parseInt(obj.brisanje_sloga, 10) : 0;
      var bypass = obj.ogr_bypass != null ? parseInt(obj.ogr_bypass, 10) : 0;

      // Bypass: ako je ova forma Duznosnici_Ogranicenja_CRUD i varijabla 102 = 1,
      // ne skrivamo tipke bez obzira na stanje u tablici ograničenja.
      var jeOgrForma = (htmlFajl === VNLH_OGR_BYPASS_HTML);
      if (!(jeOgrForma && bypass === 1)) {
        vnlhPrimijeniPravaCrud(ui, bs, opcije);
      }

      if (typeof callback === 'function') callback(ui, bs, bypass);
    };
    xhr.send();
  }

  /* =========================================================================
   * ▒▒ KRAJ BLOKA: PRAVA CRUD TIPKI ▒▒
   * ========================================================================= */

  /** Izvoz na window za stranice i testove. */
  window.CommonCRUD = CommonCRUD;
  window.CommonTrim = trim;
  window.CommonPostFormData = postFormData;
  window.vnlhLoginPageUrl = vnlhLoginPageUrl;
  window.vnlhJoinAppRelativePath = vnlhJoinAppRelativePath;
  window.vnlhNormalizeMenuRelPath = vnlhNormalizeMenuRelPath;
  window.vnlhAppBasePathname = vnlhAppBasePathname;
  window.vnlhBuildMenuTargetHref = vnlhBuildMenuTargetHref;
  window.vnlhHtmlToPhpUrl = vnlhHtmlToPhpUrl;
  window.vnlhRefZaLinkSljedecaStranica = vnlhRefZaLinkSljedecaStranica;
  window.vnlhLogoutUrl = vnlhLogoutUrl;
  window.getPageBreakpointNarrow = getPageBreakpointNarrow;
  window.vnlhPrimijeniPravaCrud = vnlhPrimijeniPravaCrud;
  window.vnlhUcitajPravaCrud = vnlhUcitajPravaCrud;

  /**
   * Praćenje sesije: periodički GET sesija_ping.php (putanja iz window.__VNLH_SESIJA_PING_URL__);
   * pagehide + sendBeacon na sesija_zatvori_karticu.php (puna odjava), uz zaštitu od unutarnje navigacije (MPA):
   * isti origin <a href>, gumb .alati-meni-test__meni-izvrsni (Meni), #btnPovratak (i stari #btnCrudPovratak na keširanom Alati_teme), submit forme, F5/Ctrl+R.
   *
   * Važno: pagehide se događa i pri osvježavanju. Bez zaštite bi sendBeacon slao punu odjavu kao pri zatvaranju
   * kartice — ping i dalje vraća ok:true dok je stara stranica u memoriji, a nakon reloada korisnik završi na loginu.
   * Zaštita: keydown (F5, Ctrl/Cmd+R) postavlja __vnlhAppNavInternal prije pagehide; pointerdown (capture)
   * za iste gumbe kao click — neki preglednici / tipkovnički Enter mogu kasniti s clickom u odnosu na
   * pagehide nakon location.href. Gumb „Osvježi“ u adresnoj traci ne šalje keydown u sadržaj stranice.
   */
  (function vnlhSesijaPracenjePingInit() {
    var cfg = window.__VNLH_SESIJA_PING__;
    var pingUrl = window.__VNLH_SESIJA_PING_URL__;
    if (!cfg || typeof cfg.ping_interval_sec !== 'number' || cfg.ping_interval_sec <= 0 || !pingUrl) {
      return;
    }
    var loginUrl = typeof window.__VNLH_LOGIN_URL__ === 'string' ? window.__VNLH_LOGIN_URL__ : 'php/Login.php';
    var intervalMs = Math.max(5000, cfg.ping_interval_sec * 1000);

    function redirectLogin() {
      try {
        if (typeof window.vnlhMarkInternalAppNavigation === 'function') window.vnlhMarkInternalAppNavigation();
        window.location.assign(loginUrl);
      } catch (eR) {}
    }

    function pingOnce() {
      if (typeof window.fetch !== 'function') {
        return;
      }
      fetch(pingUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) {
          if (r.status === 401) {
            redirectLogin();
            return null;
          }
          return r.json();
        })
        .then(function (j) {
          if (j === null) return;
          if (!j) return;
          if (j.ok === true) return;
          if (j.reason === 'expired' || j.reason === 'auth') redirectLogin();
        })
        .catch(function () {});
    }

    pingOnce();
    setInterval(pingOnce, intervalMs);

    window.__vnlhAppNavInternal = false;

    /**
     * Capture: postavi __vnlhAppNavInternal za unutarnju navigaciju.
     * Meni izvršna stavka: <button class="…meni-izvrsni"> + location.href (Meni.js / Alati_Meni_Test.js).
     * Za pointerdown ne diramo <a> (izbjegavamo lažni pozitiv kad korisnik zgrabi link pa odustane).
     */
    function sesijaPracenjeMarkInternalNavFromEvent(ev) {
      var t = ev.target;
      if (!t || typeof t.closest !== 'function') return;
      var izvBtn = t.closest('button.alati-meni-test__meni-izvrsni');
      if (izvBtn) {
        window.__vnlhAppNavInternal = true;
        return;
      }
      if (t.closest('#btnPovratak') || t.closest('#btnCrudPovratak')) {
        window.__vnlhAppNavInternal = true;
        return;
      }
      if (ev.type !== 'click') return;
      var a = t.closest('a[href]');
      if (!a || !a.href) return;
      try {
        var u = new URL(a.href, window.location.href);
        if (u.origin === window.location.origin) {
          window.__vnlhAppNavInternal = true;
        }
      } catch (eC) {}
    }

    document.addEventListener('click', sesijaPracenjeMarkInternalNavFromEvent, true);
    document.addEventListener('pointerdown', sesijaPracenjeMarkInternalNavFromEvent, true);
    document.addEventListener(
      'submit',
      function () {
        window.__vnlhAppNavInternal = true;
      },
      true
    );

    /* Osvježavanje (ne zatvaranje kartice): inače pagehide + sendBeacon uništava cijelu sesiju. */
    document.addEventListener(
      'keydown',
      function (ev) {
        if (!ev) return;
        var k = typeof ev.key === 'string' ? ev.key : '';
        if (k === 'F5' || ev.keyCode === 116) {
          window.__vnlhAppNavInternal = true;
          return;
        }
        if (ev.ctrlKey || ev.metaKey) {
          if (k === 'r' || k === 'R') {
            window.__vnlhAppNavInternal = true;
          }
        }
      },
      true
    );

    window.addEventListener('pagehide', function (ev) {
      if (ev.persisted) return;
      if (window.__vnlhAppNavInternal) return;
      var u = window.__VNLH_SESIJA_TAB_CLOSE_URL__;
      var tok = window.__VNLH_SESIJA_TAB_CLOSE_TOKEN__;
      if (!u || !tok) {
        return;
      }
      if (typeof navigator.sendBeacon !== 'function') {
        return;
      }
      try {
        var fd = new FormData();
        fd.append('token', tok);
        navigator.sendBeacon(u, fd);
      } catch (eB) {}
    });
  })();
})();
