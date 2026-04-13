/* =========================================================
   0-Poruke.js
   Sustav poruka – globalni modul (IIFE).
   Mail ikona u naslov-forme (lijevo od odjave), polling za nepročitane,
   modal za čitanje/odgovaranje na poruke.
   Koristi: 0-Common.js (postFormData, vnlhAppBasePathname), 0-Kontrole.css (modal klase).
   API: 0-Poruke.php (fragment), 0-Poruke_lista.php, 0-Poruke_poruke.php,
        0-Poruke_neprocitane.php, 0-Poruke_posalji.php, common_sustav_varijable.php?id=101.
   Ne mijenja 0-Kontrole.js ni 0-Common.js.
   ========================================================= */
(function () {
  'use strict';

  /* --- Blok: Pomoćne funkcije --- */

  function trim(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  /**
   * Izračunaj bazni URL za PHP API-je (../php/ iz html/ konteksta, php/ iz korijena).
   * Koristi vnlhAppBasePathname iz 0-Common.js ako je dostupna.
   */
  function resolveApiBase() {
    var p = window.location.pathname || '';
    if (/\/html\//i.test(p) || /\/html$/i.test(p)) return '../php/';
    if (/\/php\//i.test(p)) return '';
    return 'php/';
  }

  /**
   * Razriješi URL za template fragment (0-Poruke.php).
   * Iz js/0-Poruke.js gradi php/0-Poruke.php – isti pattern kao 0-Obrada_Slike.js.
   */
  function resolveTemplateUrl(filename) {
    var u = trim(filename);
    if (!u) return u;
    if (/^https?:\/\//i.test(u) || u.charAt(0) === '/' || /^\.\.?\//.test(u)) return u;
    try {
      var nodes = document.querySelectorAll('script[src*="0-Poruke.js"]');
      var el = nodes.length ? nodes[nodes.length - 1] : null;
      if (el && el.src) {
        var scriptUrl = new URL(el.src);
        var pathname = scriptUrl.pathname;
        var jsDir = pathname.replace(/\/[^/]+$/, '/');
        var phpDir = jsDir.replace(/\/js\/$/i, '/php/');
        return scriptUrl.origin + phpDir + u.replace(/^\.\//, '');
      }
    } catch (e) {}
    return u;
  }

  var API_BASE = resolveApiBase();
  var TEMPLATE_URL = resolveTemplateUrl('0-Poruke.php');
  var ID_PREFIX = 'vnlh_poruke';

  /* --- Blok: Stanje modula --- */
  var modalLoaded = false;       /* HTML fragment učitan i umetnut u DOM */
  var modalOpen = false;         /* modal trenutno prikazan */
  var savedModalState = null;    /* {width, height, left, top} – geometrija pri zatvaranju */
  var selectedPosiljatelj = null; /* id_posiljatelj trenutno selektiranog reda u tablici */
  var pollingIntervalId = null;  /* setInterval ID za polling */
  var pollingIntervalSec = 30;   /* default 30s, prepisuje se iz sustav_varijable 101 */
  var lastKnownNeprocitane = -1; /* zadnji poznati broj nepročitanih (za detekciju novih) */
  var lastFetchTimestamp = 0;    /* timestamp zadnjeg uspješnog dohvata poruka u modalu */
  var listaPosiljatelja = [];    /* keširani podaci liste pošiljatelja */
  /** Snimljena „inicijalna” visina bloka povijesti (px) u izracunajVisinuNapomene; reset na otvaranje/clear. */
  var napomenaPocetnaVisina = 0;

  /**
   * Inicijalne snimke dimenzija modala poruka (px), postavljene pri prvom layoutu nakon openModal.
   * Namjena: kasnija logika (resize, proporcije) zna koliki su „fiksni” dijelovi u odnosu na tijelo.
   *
   * min_povjest        – inicijalna visina edita povijesti (#_napomena, .poruke__napomena-scroll) pri prvoj pojavi modala.
   * min_poruka         – inicijalna visina zone nove poruke (.poruke__input-row: textarea + tipka Pošalji).
   * min_modal_visina   – inicijalna vanjska visina dijaloga (.poruke__dialog).
   * min_modal_sirina   – inicijalna vanjska širina dijaloga (.poruke__dialog).
   * size_diference     – min_modal_visina − min_povjest − min_poruka (preostalo = zaglavlje, podnožje, lijevo, rubovi…).
   *                      Ime varijable namjerno kao u specifikaciji („diference”).
   */
  var min_povjest = 0;
  var min_poruka = 0;
  var min_modal_visina = 0;
  var min_modal_sirina = 0;
  var size_diference = 0;
  /** ResizeObserver na .poruke__dialog (široki ekran): nakon nativnog resizea dijaloga raspodijeli povijest/poruku. */
  var porukeDialogResizeObserver = null;
  /** ResizeObserver na #_napomena i .poruke__input-row – nativni vertikalni resize; usklađuje drugi blok + visinu modala. */
  var porukePovijestPorukaResizeObserver = null;
  /** Nakon prvog snimiInicijalneMinDimenzijeModala: izracunajVisinuNapomene ne prepisuje visine (rješava unutarnji sync). */
  var porukeLayoutInicijalnoSpreman = false;
  /** Sprječava petlju ResizeObservera kad programski postavljamo visine / dialog. */
  var porukeSinkronizacijaUnutarnjihVisinaUTijeku = false;
  /** Zadnje poznate visine (px) za heuristiku „tko se promijenio” u unutarnjem RO. */
  var porukeZadnjaHp = 0;
  var porukeZadnjaHr = 0;
  var porukeInnerRoRafId = 0;

  /* --- Blok: DOM helper --- */
  function id(suffix) {
    return document.getElementById(ID_PREFIX + suffix);
  }

  /**
   * Je li viewport u „širokom” režimu za modal poruka (vertikalni resize, formula visine, snimanje min_*).
   * Breakpoint 768px usklađen s @media (max-width: 768px) u 0-Poruke.css (mobilni layout modala).
   * Kad je false: prikaz i raspored ostaju na CSS-u + openModal postavlja širinu/visinu dijaloga;
   * JS ne smije postavljati inline visine #_napomena niti ažurirati min_povjest/min_poruka/min_modal_visina/min_modal_sirina/size_diference
   * jer bi to moglo utjecati na sljedeće otvaranje na desktopu ili na rubne slučajeve layouta.
   */
  function porukeSirinaJeDesktopZaResize() {
    return typeof window.matchMedia === 'undefined' || !window.matchMedia('(max-width: 768px)').matches;
  }

  /* =========================================================
   * ▒▒ BLOK: MAIL IKONA U NASLOV-FORME ▒▒
   * Injektira mail ikonu lijevo od logout ikone.
   * Dvostruki klik otvara modal poruka.
   * Klasa .naslov-forme__poruke definirana u 0-Poruke.css.
   * ========================================================= */
  function vnlhInjectNaslovPoruke() {
    try {
      var path = window.location.pathname || '';
      /* Ne prikazuj na Login stranici */
      if (/Login\.(html|php)/i.test(path)) return;
      if (document.body && document.body.classList.contains('login-win')) return;

      var list = document.querySelectorAll('.naslov-forme');
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.querySelector('.naslov-forme__poruke')) continue;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'naslov-forme__poruke';
        btn.setAttribute('aria-label', 'Poruke');
        btn.title = 'Poruke (dvostruki klik)';

        var span = document.createElement('span');
        span.className = 'poruke-icon--mail';
        span.setAttribute('aria-hidden', 'true');
        btn.appendChild(span);

        /* Dvostruki klik otvara modal */
        btn.addEventListener('dblclick', function (e) {
          e.preventDefault();
          openModal();
        });

        /* Umetni u wrapper .naslov-forme__ikone ispred logout ikone.
           Wrapper kreira 0-Common.js (vnlhInjectNaslovOdjava). */
        var wrapper = el.querySelector('.naslov-forme__ikone');
        if (wrapper) {
          var odjava = wrapper.querySelector('.naslov-forme__odjava');
          if (odjava) {
            wrapper.insertBefore(btn, odjava);
          } else {
            wrapper.appendChild(btn);
          }
        } else {
          el.appendChild(btn);
        }
      }
    } catch (e) {}
  }

  /**
   * Ažuriraj boju mail ikone na svim .naslov-forme__poruke prema broju nepročitanih.
   * Crvena (--c-red-500) ako neprocitane > 0, inače default boja.
   */
  function updateMailIconColor(neprocitane) {
    var icons = document.querySelectorAll('.naslov-forme__poruke');
    for (var i = 0; i < icons.length; i++) {
      if (neprocitane > 0) {
        icons[i].classList.add('naslov-forme__poruke--neprocitane');
      } else {
        icons[i].classList.remove('naslov-forme__poruke--neprocitane');
      }
    }
  }

  /* =========================================================
   * ▒▒ BLOK: POLLING – PROVJERA NEPROČITANIH PORUKA ▒▒
   * Dohvaća interval iz sustav_varijable id=101, zatim
   * periodično provjerava 0-Poruke_neprocitane.php.
   * ========================================================= */

  /** Dohvati interval pollinga iz sustav_varijable id=101 i pokreni polling. */
  function initPolling() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'common_sustav_varijable.php?id=101', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = trim(xhr.responseText);
      var sec = parseInt(t, 10);
      if (!isNaN(sec) && sec > 0) {
        pollingIntervalSec = sec;
      }
      /* Prva provjera odmah, zatim svaki pollingIntervalSec sekundi */
      pollNeprocitane();
      startPollingTimer();
    };
    xhr.send();
  }

  /** Pokreni setInterval za polling. */
  function startPollingTimer() {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = setInterval(function () {
      /* Pauzira se kad korisnik nije na tabu */
      if (typeof document.hidden !== 'undefined' && document.hidden) return;
      pollNeprocitane();
    }, pollingIntervalSec * 1000);
  }

  /** Lagani GET na 0-Poruke_neprocitane.php – ažuriraj mail ikonu i refresh ikonu u modalu. */
  function pollNeprocitane() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + '0-Poruke_neprocitane.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = trim(xhr.responseText);
      if (!t || t.charAt(0) !== '{') return;
      try {
        var obj = JSON.parse(t);
        var n = typeof obj.neprocitane === 'number' ? obj.neprocitane : 0;

        /* Mail ikona – UVIJEK crvena dok postoje nepročitane */
        updateMailIconColor(n);

        /* Refresh ikona u modalu – crvena ako stigle nove poruke nakon zadnjeg dohvata */
        if (modalOpen && lastKnownNeprocitane >= 0 && n > lastKnownNeprocitane) {
          var refreshBtn = id('_refresh');
          if (refreshBtn) refreshBtn.classList.add('poruke__refresh-btn--nova');
        }

        lastKnownNeprocitane = n;
      } catch (e) {}
    };
    xhr.send();
  }

  /* =========================================================
   * ▒▒ BLOK: UČITAVANJE FRAGMENTA I INICIJALIZACIJA MODALA ▒▒
   * Fetch 0-Poruke.php, zamijeni __ID_PREFIX__, umetni u DOM, postavi handlere.
   * ========================================================= */

  /** Učitaj HTML fragment modala ako nije već učitan, zatim pozovi callback. */
  function ensureModalLoaded(callback) {
    if (modalLoaded) {
      if (typeof callback === 'function') callback();
      return;
    }
    /* Cache-bust: fragment mora slijediti verziju (npr. novi omotač napomene).
       inače modalLoaded ostane true s starim DOM-om do punog reloada stranice. */
    var sep = TEMPLATE_URL.indexOf('?') >= 0 ? '&' : '?';
    var ver = typeof window !== 'undefined' && window.VNLH_VERZIJA ? String(window.VNLH_VERZIJA) : '';
    var fetchUrl = ver ? TEMPLATE_URL + sep + 'v=' + encodeURIComponent(ver) : TEMPLATE_URL;
    fetch(fetchUrl, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (html) {
      /* Zamijeni __ID_PREFIX__ s konkretnim prefiksom */
      var replaced = html.replace(/__ID_PREFIX__/g, ID_PREFIX);
      var mount = document.createElement('div');
      mount.innerHTML = replaced;
      var fragment = mount.firstElementChild;
      if (fragment) {
        document.body.appendChild(fragment);
      }
      modalLoaded = true;
      setupModalHandlers();
      if (typeof callback === 'function') callback();
    }).catch(function (err) {
      /* Tihi neuspjeh – modal se neće prikazati */
    });
  }

  /* =========================================================
   * ▒▒ BLOK: HANDLERI MODALA ▒▒
   * Drag zaglavlja, toggle, refresh, povratak, input, pošalji.
   * ========================================================= */
  function setupModalHandlers() {
    var modal = id('');
    if (!modal) return;
    var dialog = modal.querySelector('.poruke__dialog');

    /* --- Header drag za pomicanje modala --- */
    (function setupHeaderDrag() {
      var header = id('_header');
      if (!header || !dialog) return;
      header.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        e.preventDefault();
        var rect = dialog.getBoundingClientRect();
        var startX = e.clientX;
        var startY = e.clientY;
        var startLeft = rect.left;
        var startTop = rect.top;
        dialog.style.position = 'fixed';
        dialog.style.margin = '0';
        dialog.style.left = startLeft + 'px';
        dialog.style.top = startTop + 'px';
        header.style.userSelect = 'none';
        function move(ev) {
          dialog.style.left = (startLeft + (ev.clientX - startX)) + 'px';
          dialog.style.top = (startTop + (ev.clientY - startY)) + 'px';
        }
        function up() {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          header.style.userSelect = '';
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    })();

    /* --- Toggle switch: promjena filtra, deselektiraj i očisti desnu stranu --- */
    var toggleInput = id('_toggle');
    var toggleText = id('_toggle_text');
    if (toggleInput) {
      toggleInput.addEventListener('change', function () {
        if (toggleText) {
          toggleText.textContent = this.checked ? 'Samo nepročitane' : 'Sve poruke';
        }
        clearSelection();
        fetchLista();
      });
    }

    /* --- Refresh tipka: osvježi listu, deselektiraj, isprazni desnu stranu --- */
    var refreshBtn = id('_refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.classList.remove('poruke__refresh-btn--nova');
        clearSelection();
        fetchLista();
      });
    }

    /* --- Povratak tipka --- */
    var btnPovratak = id('_povratak');
    if (btnPovratak) {
      btnPovratak.addEventListener('click', function () {
        closeModal();
      });
    }

    /* --- Input odgovor: enable/disable tipke Pošalji --- */
    var inputEl = id('_input');
    var btnPosalji = id('_posalji');
    if (inputEl && btnPosalji) {
      inputEl.addEventListener('input', function () {
        btnPosalji.disabled = trim(inputEl.value) === '' || !selectedPosiljatelj;
      });
      /* Enter šalje poruku */
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && !btnPosalji.disabled) {
          e.preventDefault();
          btnPosalji.click();
        }
      });
      /* Tipka Pošalji */
      btnPosalji.addEventListener('click', function () {
        var tekst = trim(inputEl.value);
        if (!tekst || !selectedPosiljatelj) return;
        posaljiOdgovor(selectedPosiljatelj, tekst);
      });
    }

    /* --- Trash tipka: briši razgovor sa selektiranim pošiljateljem --- */
    var btnBrisi = id('_brisi');
    if (btnBrisi) {
      btnBrisi.addEventListener('click', function () {
        if (!selectedPosiljatelj || btnBrisi.disabled) return;
        obrisiRazgovor(selectedPosiljatelj);
      });
    }

    /* --- Tipka + : popup za odabir korisnika za novu poruku --- */
    var btnNova = id('_nova');
    if (btnNova) {
      btnNova.addEventListener('click', function () {
        togglePopupKorisnici();
      });
    }

    /* Klik van popupa zatvara popup */
    document.addEventListener('mousedown', function (e) {
      var popup = id('_popup_korisnici');
      if (!popup || popup.style.display === 'none') return;
      var btnN = id('_nova');
      if (popup.contains(e.target) || (btnN && btnN.contains(e.target))) return;
      zatvoriPopup();
    });

    /* Filter input u popupu – filtrira listu korisnika */
    var popupFilter = id('_popup_filter');
    if (popupFilter) {
      popupFilter.addEventListener('input', function () {
        filtrirajPopup(this.value);
      });
    }

    /* Resize u kutu: povijest, polje poruke, cijeli modal (Pointer Events). */
    setupPorukeVertikalniResize();

    /* --- Escape zatvara modal (i popup ako je otvoren) --- */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var popup = id('_popup_korisnici');
        if (popup && popup.style.display !== 'none') {
          zatvoriPopup();
          e.stopPropagation();
          return;
        }
        if (modalOpen) closeModal();
      }
    });
  }

  /* =========================================================
   * ▒▒ BLOK: OTVARANJE / ZATVARANJE MODALA ▒▒
   * Pamćenje pozicije i veličine pri zatvaranju; primjena pri otvaranju.
   * ========================================================= */
  function openModal() {
    ensureModalLoaded(function () {
      var modal = id('');
      if (!modal) return;
      var dialog = modal.querySelector('.poruke__dialog');
      var smallDevice = typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

      /* Desktop: ukloni min-width/min-height s prethodnog otvaranja prije primjene saved / CSS-a. */
      if (dialog && !smallDevice) {
        dialog.style.minWidth = '';
        dialog.style.minHeight = '';
      }

      /* Mobilno: UVIJEK primijeni default geometriju (ne savedModalState).
         Inače pri drugom otvaranju vraća staru visinu/širinu i CSS/JS promjene
         visine nisu vidljive; povijest ostaje zalijepljena uz podnožje. */
      if (dialog && smallDevice && window.innerWidth > 0) {
        var dialogW = Math.max(300, window.innerWidth * 0.95);
        var dialogH = Math.max(320, window.innerHeight * 0.75 + 40);
        dialog.style.minWidth = '300px';
        dialog.style.width = dialogW + 'px';
        dialog.style.height = dialogH + 'px';
        dialog.style.minHeight = dialogH + 'px';
        dialog.style.position = 'fixed';
        dialog.style.top = '10px';
        dialog.style.left = '0';
        dialog.style.right = '0';
        dialog.style.margin = '0 auto';
      } else if (dialog && savedModalState) {
        /* Desktop / široki ekran: geometrija sa zatvaranja */
        dialog.style.width = savedModalState.width + 'px';
        dialog.style.height = savedModalState.height + 'px';
        dialog.style.right = '';
        dialog.style.minWidth = '';
        dialog.style.minHeight = '';
        if (savedModalState.left != null && savedModalState.top != null) {
          dialog.style.position = 'fixed';
          dialog.style.margin = '0';
          dialog.style.left = savedModalState.left + 'px';
          dialog.style.top = savedModalState.top + 'px';
        }
      }

      modal.style.display = '';
      modal.style.visibility = '';
      var overlayEl = modal.querySelector('.kontrola-modal__overlay');
      if (overlayEl) {
        overlayEl.style.opacity = '';
        overlayEl.style.pointerEvents = '';
      }
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('kontrola-modal--open');
      modalOpen = true;

      /* Blokiraj scroll pozadinske stranice dok je modal otvoren */
      document.body.style.overflow = 'hidden';

      /* Resetiraj toggle na "Sve poruke" pri svakom otvaranju */
      var toggleInput = id('_toggle');
      var toggleText = id('_toggle_text');
      if (toggleInput && toggleInput.checked) {
        toggleInput.checked = false;
      }
      if (toggleText) toggleText.textContent = 'Sve poruke';

      /* Resetiraj selekciju i stanje kontrola */
      clearSelection();

      /* Reset inicijalnih min-dimenzija; ponovno se puni nakon prvog layouta u openModal (rAF). */
      min_povjest = 0;
      min_poruka = 0;
      min_modal_visina = 0;
      min_modal_sirina = 0;
      size_diference = 0;
      porukeLayoutInicijalnoSpreman = false;

      /* Očisti inline visine/flex napomene (nakon zatvaranja ili praznog stanja). */
      var napomenaEl = id('_napomena');
      napomenaPocetnaVisina = 0;
      if (napomenaEl) {
        napomenaEl.style.flex = '';
        napomenaEl.style.height = '';
        napomenaEl.style.minHeight = '';
        napomenaEl.style.maxHeight = '';
      }
      var napomenaOuter = napomenaEl ? napomenaEl.closest('.poruke__napomena-div') : null;
      if (napomenaOuter) napomenaOuter.style.flex = '';
      var inputEl = id('_input');
      if (inputEl) {
        inputEl.style.height = '';
        inputEl.style.minHeight = '';
      }
      var rightOpen = napomenaEl ? napomenaEl.closest('.poruke__right') : null;
      var inputRowOpen = rightOpen ? rightOpen.querySelector('.poruke__input-row') : null;
      if (inputRowOpen) inputRowOpen.style.minHeight = '';

      /* Početni dohvat podataka */
      fetchLista();

      /* Resetiraj refresh ikonu */
      var refreshBtn = id('_refresh');
      if (refreshBtn) refreshBtn.classList.remove('poruke__refresh-btn--nova');

      /* Prvi layout: samo široki ekran – na mobu cijeli ovaj blok preskočiti (flex + CSS @media). */
      requestAnimationFrame(function () {
        if (!smallDevice) {
          izracunajVisinuNapomene();
          snimiInicijalneMinDimenzijeModala();
          porukePoveziUnutarnjiResizeObserver();
          porukePoveziDialogResizeObserver();
        }
      });
    });
  }

  /**
   * Nakon što je modal vidljiv i (na desktopu) izracunajVisinuNapomene postavio visinu povijesti,
   * snimi inicijalne vrijednosti (min_povjest, min_poruka, min_modal_visina, min_modal_sirina, size_diference) za daljnju upotrebu.
   * Na mobilnom funkcija odmah izlazi (ne snima min_*); izracunajVisinuNapomene ionako ne dira inline visine.
   */
  function snimiInicijalneMinDimenzijeModala() {
    if (!porukeSirinaJeDesktopZaResize()) return;
    var modal = id('');
    var dialog = modal && modal.querySelector('.poruke__dialog');
    var napomenaEl = id('_napomena');
    var rightEl = napomenaEl ? napomenaEl.closest('.poruke__right') : null;
    var inputRow = rightEl ? rightEl.querySelector('.poruke__input-row') : null;

    /* Prvi put nakon otvaranja / resetiranja min_*: snimi podove povijesti, poruke, ljusku modala i size_diference.
       Kasnije: samo osvježi vanjske dimenzije modala (širina/visina) – min_povjest, min_poruka i size_diference ostaju
       konstante za formulu modal = povijest + poruka + size_diference (donje granice za resize). */
    if (min_povjest === 0 && min_poruka === 0) {
      min_povjest = napomenaEl ? napomenaEl.offsetHeight : 0;
      min_poruka = inputRow ? inputRow.offsetHeight : 0;
      min_modal_visina = dialog ? dialog.offsetHeight : 0;
      min_modal_sirina = dialog ? dialog.offsetWidth : 0;
      size_diference = min_modal_visina - min_povjest - min_poruka;
      if (size_diference < 0) size_diference = 0;
      porukeLayoutInicijalnoSpreman = min_povjest > 0 || min_poruka > 0;
      porukeZadnjaHp = napomenaEl ? napomenaEl.offsetHeight : 0;
      porukeZadnjaHr = inputRow ? inputRow.offsetHeight : 0;
      porukePrimijeniMinStiloveDialogNaDesktopu();
    }
    /* min_modal_visina / min_modal_sirina ostaju snimljeni pri prvom punjenju – ne smanjuju se pri kasnijim mjerenjima. */
  }

  /** Donja granica visine bloka povijesti (#_napomena), px. */
  function porukeMinVisinaPovijestiPx() {
    var b = napomenaPocetnaVisina > 0 ? napomenaPocetnaVisina : min_povjest;
    return Math.max(48, b || 48);
  }

  /** Donja granica visine retka nove poruke (.poruke__input-row), px. */
  function porukeMinVisinaPorukePx() {
    return Math.max(48, min_poruka || 48);
  }

  /**
   * Minimalna vanjska visina .poruke__dialog koja još zadovoljava formulu:
   * visina_dijaloga = povijest + poruka + size_diference uz donje granice min_povjest / min_poruka.
   * Visina retka poruke u formuli: ako je poznata porukeZadnjaHr (nakon layouta), koristi se (≥ min poruke).
   */
  function porukeMinVisinaDialogaZaFormuluPx() {
    if (size_diference <= 0) return 0;
    var hrB = porukeZadnjaHr > 0
      ? Math.max(porukeMinVisinaPorukePx(), porukeZadnjaHr)
      : porukeMinVisinaPorukePx();
    return Math.round(size_diference + porukeMinVisinaPovijestiPx() + hrB);
  }

  /**
   * Donja granica visine modala pri korisnikovom resizeu: veći od snimljene min_modal_visina i od minimuma po formuli.
   */
  function porukeMinVisinaDialogaZaKorisnickiResizePx() {
    var f = porukeMinVisinaDialogaZaFormuluPx();
    return Math.max(min_modal_visina || 0, f || 0);
  }

  /**
   * Postavi CSS min-width / min-height na .poruke__dialog (desktop) da nativni resize:both ne može ispod
   * snimljene širine/visine modala niti ispod visine koja zadovoljava formulu.
   */
  function porukePrimijeniMinStiloveDialogNaDesktopu() {
    if (!porukeSirinaJeDesktopZaResize()) return;
    if (!porukeLayoutInicijalnoSpreman || min_modal_sirina <= 0) return;
    var modal = id('');
    var dialog = modal && modal.querySelector('.poruke__dialog');
    if (!dialog) return;
    var minH = porukeMinVisinaDialogaZaKorisnickiResizePx();
    dialog.style.minWidth = min_modal_sirina + 'px';
    dialog.style.minHeight = (minH > 0 ? minH : min_modal_visina) + 'px';
  }

  /**
   * Nakon što korisnik vuče rub modala: ne smije ispod min_modal_sirina / min_modal_visina niti ispod visine
   * koja zadovoljava formulu; osvježi min-* CSS na dijalogu.
   */
  function porukeKlamponajDialogNakonKorisnickogResizea(dialog) {
    if (!dialog || min_modal_sirina <= 0) return;
    var minH = porukeMinVisinaDialogaZaKorisnickiResizePx();
    porukeSinkronizacijaUnutarnjihVisinaUTijeku = true;
    try {
      var w0 = dialog.offsetWidth;
      var h0 = dialog.offsetHeight;
      if (w0 < min_modal_sirina) dialog.style.width = min_modal_sirina + 'px';
      if (minH > 0 && h0 < minH) dialog.style.height = minH + 'px';
      porukePrimijeniMinStiloveDialogNaDesktopu();
    } finally {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          porukeSinkronizacijaUnutarnjihVisinaUTijeku = false;
        });
      });
    }
  }

  /** Maksimalna vanjska visina dijaloga prema CSS (90vh). */
  function porukeMaxVisinaDialogaPx(dialog) {
    var vh = typeof window.innerHeight === 'number' ? window.innerHeight : 800;
    return Math.max(320, Math.floor(vh * 0.9));
  }

  function porukeOdspojiUnutarnjiResizeObserver() {
    if (porukePovijestPorukaResizeObserver) {
      try {
        porukePovijestPorukaResizeObserver.disconnect();
      } catch (eI) {}
      porukePovijestPorukaResizeObserver = null;
    }
    if (porukeInnerRoRafId) {
      try {
        cancelAnimationFrame(porukeInnerRoRafId);
      } catch (eC) {}
      porukeInnerRoRafId = 0;
    }
  }

  /**
   * Nakon što korisnik promijeni visinu .poruke__dialog (nativni resize:both):
   * – sav dodatni / umanjeni budžet (visina_dijaloga − size_diference) ide na blok povijesti;
   * – visina retka nove poruke ostaje porukeZadnjaHr (ili trenutna, ≥ min), pa je razmak CSS-a između bloka
   *   povijesti i retka poruke uvijek isti u smislu „poruka se ne rasteže po visini”;
   * – kad povijest dođe do min_povjest, daljnje smanjivanje modala zaustavlja se (visina modala se vrati na minimum).
   * Širina: desni stupac (.poruke__right) u flexu već prati širinu modala – edit povijesti se vizualno širi s modalom.
   */
  function porukeDistribuirajVisinuIzDialoga() {
    if (!porukeLayoutInicijalnoSpreman || size_diference <= 0) return;
    var modal = id('');
    var dialog = modal && modal.querySelector('.poruke__dialog');
    var nap = id('_napomena');
    var right = nap ? nap.closest('.poruke__right') : null;
    var row = right ? right.querySelector('.poruke__input-row') : null;
    if (!dialog || !nap || !row) return;

    var minPv = porukeMinVisinaPovijestiPx();
    var minPr = porukeMinVisinaPorukePx();
    var hrF = Math.max(minPr, porukeZadnjaHr > 0 ? porukeZadnjaHr : row.offsetHeight);

    var D = dialog.offsetHeight;
    var budget = Math.round(D - size_diference);
    var newHp = Math.round(budget - hrF);

    /* Kad je snimljeni size_diference „izaostao” za stvarni layout (npr. nakon širenja modala po širini,
       drugačiji wrap textarea, scrollbar), budget − hrF može dati prevelik hp – red poruke vizualno padne
       ispod podnožja. Ograniči hp na stvarni prostor iznad retka u .poruke__right (mjerenje u pikselima). */
    var maxHpLayout = 999999;
    if (right) {
      try {
        var rr = right.getBoundingClientRect();
        var rt = row.getBoundingClientRect();
        var rs = window.getComputedStyle(right);
        var pt = parseFloat(rs.paddingTop) || 0;
        maxHpLayout = Math.floor(rt.top - rr.top - pt - 2);
      } catch (eCap) {}
    }
    if (maxHpLayout < minPv) maxHpLayout = minPv;
    if (newHp > maxHpLayout) newHp = maxHpLayout;

    if (newHp < minPv) {
      newHp = minPv;
      var minDiag = Math.round(newHp + hrF + size_diference);
      dialog.style.height = minDiag + 'px';
      porukePrimijeniMinStiloveDialogNaDesktopu();
    }

    porukeSinkronizacijaUnutarnjihVisinaUTijeku = true;
    try {
      postaviVisinuBlokaPovijestiPx(newHp);
      postaviVisinuBlokaPorukePx(hrF, null);
      porukeZadnjaHp = nap.offsetHeight;
      porukeZadnjaHr = hrF;
      /* Jednokratno uskladi slack s DOM-om nakon postavljanja visina – sljedeći resize koristi točan ostatk. */
      var syncSl = Math.round(dialog.offsetHeight - nap.offsetHeight - row.offsetHeight);
      if (syncSl >= 0) size_diference = syncSl;
    } finally {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          porukeSinkronizacijaUnutarnjihVisinaUTijeku = false;
        });
      });
    }
  }

  /**
   * ResizeObserver na #_napomena i .poruke__input-row: nativni vertikalni grip.
   * Povijest: korisnik ne smije povećati visinu (samo smanjivanje); poruka nadopunjava budžet pri istoj visini modala.
   * Poruka: modal slijedi visina_modala = povijest + poruka + size_diference (uz min. visinu modala).
   */
  function porukeRasporedNakonUnutarnjegResize() {
    if (!modalOpen || !porukeSirinaJeDesktopZaResize()) return;
    if (porukeSinkronizacijaUnutarnjihVisinaUTijeku) return;
    if (!porukeLayoutInicijalnoSpreman || size_diference <= 0) return;

    var modal = id('');
    var dialog = modal && modal.querySelector('.poruke__dialog');
    var nap = id('_napomena');
    var right = nap ? nap.closest('.poruke__right') : null;
    var row = right ? right.querySelector('.poruke__input-row') : null;
    if (!dialog || !nap || !row) return;

    var hp = nap.offsetHeight;
    var hr = row.offsetHeight;
    var dHp = hp - porukeZadnjaHp;
    var dHr = hr - porukeZadnjaHr;
    var slack = size_diference;
    var minPv = porukeMinVisinaPovijestiPx();
    var minPr = porukeMinVisinaPorukePx();
    var D = dialog.offsetHeight;

    porukeSinkronizacijaUnutarnjihVisinaUTijeku = true;
    try {
      if (Math.abs(dHp) >= 1 && Math.abs(dHr) < 1) {
        /* Korisnik ne smije povećati visinu povijesti (samo smanjivanje). */
        if (dHp > 0) {
          postaviVisinuBlokaPovijestiPx(porukeZadnjaHp);
          porukeZadnjaHp = nap.offsetHeight;
          porukeZadnjaHr = row.offsetHeight;
          return;
        }
        /* Promjena visine bloka povijesti (nativni resize) – ukupna visina modala ostaje, poruka prilagođava. */
        var hr2 = Math.round(D - slack - hp);
        if (hr2 < minPr) {
          hr2 = minPr;
          var hp2 = Math.round(D - slack - hr2);
          hp2 = Math.max(minPv, hp2);
          postaviVisinuBlokaPovijestiPx(hp2);
        }
        postaviVisinuBlokaPorukePx(hr2, null);
      } else if (Math.abs(dHr) >= 1 && Math.abs(dHp) < 1) {
        /* Promjena visine retka nove poruke (textarea) – modal raste/smanjuje s formulu. */
        hp = nap.offsetHeight;
        hr = row.offsetHeight;
        var D2 = Math.round(hp + hr + slack);
        var minD = porukeMinVisinaDialogaZaKorisnickiResizePx();
        if (D2 < minD) D2 = minD;
        var maxD = porukeMaxVisinaDialogaPx(dialog);
        if (D2 > maxD) {
          D2 = maxD;
          var bud = D2 - slack;
          var hr3 = Math.max(minPr, bud - hp);
          var hp3 = bud - hr3;
          hp3 = Math.max(minPv, hp3);
          hr3 = bud - hp3;
          postaviVisinuBlokaPovijestiPx(hp3);
          postaviVisinuBlokaPorukePx(hr3, null);
        }
        dialog.style.height = D2 + 'px';
      } else {
        primijeniVisinuModalaFormulom();
        return;
      }
      porukeZadnjaHp = nap.offsetHeight;
      porukeZadnjaHr = row.offsetHeight;
    } finally {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          porukeSinkronizacijaUnutarnjihVisinaUTijeku = false;
        });
      });
    }
  }

  /** Povezuje RO na povijest + red poruke (jednom po otvaranju desktop modala nakon snimanja min_*). */
  function porukePoveziUnutarnjiResizeObserver() {
    porukeOdspojiUnutarnjiResizeObserver();
    if (!porukeSirinaJeDesktopZaResize() || typeof ResizeObserver === 'undefined') return;
    var nap = id('_napomena');
    var right = nap ? nap.closest('.poruke__right') : null;
    var row = right ? right.querySelector('.poruke__input-row') : null;
    if (!nap || !row) return;

    porukeZadnjaHp = nap.offsetHeight;
    porukeZadnjaHr = row.offsetHeight;

    porukePovijestPorukaResizeObserver = new ResizeObserver(function () {
      if (!modalOpen || !porukeSirinaJeDesktopZaResize()) return;
      if (porukeSinkronizacijaUnutarnjihVisinaUTijeku) return;
      if (porukeInnerRoRafId) cancelAnimationFrame(porukeInnerRoRafId);
      porukeInnerRoRafId = requestAnimationFrame(function () {
        porukeInnerRoRafId = 0;
        porukeRasporedNakonUnutarnjegResize();
      });
    });
    try {
      porukePovijestPorukaResizeObserver.observe(nap);
      porukePovijestPorukaResizeObserver.observe(row);
    } catch (eObs2) {}
  }

  /**
   * Postavi vanjsku visinu .poruke__dialog prema formuli: visina_povijesti + visina_poruke + size_diference.
   * Ako zbroj prelazi 90vh, sužava poruku pa povijest uz poštovanje min_povjest / min_poruka.
   */
  function primijeniVisinuModalaFormulom() {
    if (!modalOpen || !porukeSirinaJeDesktopZaResize()) return;
    if (size_diference <= 0) return;
    var modal = id('');
    var dialog = modal && modal.querySelector('.poruke__dialog');
    var nap = id('_napomena');
    var right = nap ? nap.closest('.poruke__right') : null;
    var row = right ? right.querySelector('.poruke__input-row') : null;
    if (!dialog || !nap || !row) return;

    var hp = nap.offsetHeight;
    var hr = row.offsetHeight;
    var target = Math.round(hp + hr + size_diference);
    var minD = porukeMinVisinaDialogaZaKorisnickiResizePx();
    var maxD = porukeMaxVisinaDialogaPx(dialog);

    porukeSinkronizacijaUnutarnjihVisinaUTijeku = true;
    try {
      if (target < minD) {
        var bud0 = minD - size_diference;
        var minPv0 = porukeMinVisinaPovijestiPx();
        var minPr0 = porukeMinVisinaPorukePx();
        bud0 = Math.max(bud0, minPv0 + minPr0);
        var nhp = Math.max(minPv0, Math.min(hp, bud0 - minPr0));
        var nhr = Math.max(minPr0, bud0 - nhp);
        nhp = bud0 - nhr;
        postaviVisinuBlokaPovijestiPx(nhp);
        postaviVisinuBlokaPorukePx(nhr, null);
        target = minD;
        hp = nap.offsetHeight;
        hr = row.offsetHeight;
      }
      if (target > maxD) {
        var budget = maxD - size_diference;
        var minPv = porukeMinVisinaPovijestiPx();
        var minPr = porukeMinVisinaPorukePx();
        if (budget < minPv + minPr) budget = minPv + minPr;
        var newHr = Math.max(minPr, hr - (target - maxD));
        var newHp = budget - newHr;
        if (newHp < minPv) {
          newHp = minPv;
          newHr = budget - newHp;
        }
        postaviVisinuBlokaPovijestiPx(newHp);
        postaviVisinuBlokaPorukePx(newHr, null);
        target = maxD;
      }
      dialog.style.height = target + 'px';
      porukeZadnjaHp = nap.offsetHeight;
      porukeZadnjaHr = row.offsetHeight;
    } finally {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          porukeSinkronizacijaUnutarnjihVisinaUTijeku = false;
        });
      });
    }
  }

  function porukeOdspojiDialogResizeObserver() {
    if (porukeDialogResizeObserver) {
      try {
        porukeDialogResizeObserver.disconnect();
      } catch (eRO) {}
      porukeDialogResizeObserver = null;
    }
  }

  /** Na desktopu: prati promjenu box-a dijaloga (korisnikov nativni resize ugla). */
  function porukePoveziDialogResizeObserver() {
    porukeOdspojiDialogResizeObserver();
    if (!porukeSirinaJeDesktopZaResize() || typeof ResizeObserver === 'undefined') return;
    var modal = id('');
    var dialog = modal && modal.querySelector('.poruke__dialog');
    if (!dialog) return;
    porukeDialogResizeObserver = new ResizeObserver(function () {
      if (!modalOpen || !porukeSirinaJeDesktopZaResize()) return;
      if (porukeSinkronizacijaUnutarnjihVisinaUTijeku) return;
      if (!porukeLayoutInicijalnoSpreman) {
        izracunajVisinuNapomene();
        snimiInicijalneMinDimenzijeModala();
        return;
      }
      var napEl = id('_napomena');
      var rightEl = napEl ? napEl.closest('.poruke__right') : null;
      var rowEl = rightEl ? rightEl.querySelector('.poruke__input-row') : null;
      if (napEl && rowEl && size_diference > 0) {
        porukeKlamponajDialogNakonKorisnickogResizea(dialog);
        var bud = Math.round(dialog.offsetHeight - size_diference);
        var sum = napEl.offsetHeight + rowEl.offsetHeight;
        /* Već usklađeno s formulom (npr. nakon primijeniVisinuModalaFormulom) – ne diraj unutarnje visine. */
        if (Math.abs(bud - sum) <= 2) {
          snimiInicijalneMinDimenzijeModala();
          return;
        }
      }
      porukeDistribuirajVisinuIzDialoga();
      snimiInicijalneMinDimenzijeModala();
    });
    try {
      porukeDialogResizeObserver.observe(dialog);
    } catch (eObs) {}
  }

  /** Postavi eksplicitnu visinu bloka povijesti (scroll sadržaja ostaje unutra). */
  function postaviVisinuBlokaPovijestiPx(px) {
    var nap = id('_napomena');
    if (!nap) return;
    var h = Math.round(px);
    nap.style.height = h + 'px';
    nap.style.minHeight = h + 'px';
    nap.style.maxHeight = h + 'px';
  }

  /**
   * Postavi visinu retka nove poruke (podesi textarea; tipka Pošalji ostaje align flex-end).
   * @param {number} px – ciljana visina cijelog .poruke__input-row
   * @param {number|null} chromeFiksni – ako je broj, dio retka ispod textarea (gumb, gap); inače izmjeri iz DOM-a
   */
  function postaviVisinuBlokaPorukePx(px, chromeFiksni) {
    var nap = id('_napomena');
    var right = nap ? nap.closest('.poruke__right') : null;
    var row = right ? right.querySelector('.poruke__input-row') : null;
    var inp = id('_input');
    if (!row || !inp) return;
    var rowH = Math.round(px);
    var pad = chromeFiksni != null && !isNaN(chromeFiksni)
      ? Math.max(0, chromeFiksni)
      : Math.max(0, row.offsetHeight - inp.offsetHeight);
    var taH = Math.max(32, rowH - pad);
    inp.style.height = taH + 'px';
    inp.style.minHeight = taH + 'px';
    row.style.minHeight = rowH + 'px';
  }

  /**
   * Registrira tri resize gumba u kutu (Pointer Events): povijest, poruka, cijeli modal.
   * Poziva se jednom iz setupModalHandlers nakon učitavanja fragmenta.
   */
  function setupPorukeVertikalniResize() {
    var modal = id('');
    if (!modal || modal._vnlhPorukeResizeSetup) return;
    modal._vnlhPorukeResizeSetup = true;

    function spremnoZaDrag() {
      return modalOpen && porukeSirinaJeDesktopZaResize() && size_diference >= 0 && min_modal_visina > 0;
    }

    function refDialogNapRow() {
      var dialog = modal.querySelector('.poruke__dialog');
      var nap = id('_napomena');
      var right = nap ? nap.closest('.poruke__right') : null;
      var row = right ? right.querySelector('.poruke__input-row') : null;
      return { dialog: dialog, nap: nap, row: row };
    }

    function dodajVertikalniDrag(el, onDown) {
      if (!el) return;
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (!spremnoZaDrag()) {
          /* Vidljivi gumb ali drag ne krene dok nema mjerenja (npr. modal tek otvoren) ili mobitel. */
          return;
        }
        var R = refDialogNapRow();
        if (!R.dialog || !R.nap || !R.row) return;
        var ctx = onDown(e, R);
        if (!ctx) return;
        try {
          el.setPointerCapture(e.pointerId);
        } catch (ex) {}
        el.classList.add('poruke__resize-corner--dragging');

        function move(ev) {
          if (!modalOpen) return;
          if (typeof ctx.onMove === 'function') ctx.onMove(ev, R, ctx);
        }
        function up() {
          try {
            el.releasePointerCapture(e.pointerId);
          } catch (ex2) {}
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          el.classList.remove('poruke__resize-corner--dragging');
        }
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    }

    /* Kut povijesti: mijenja samo #_napomena; red poruke ostaje; modal = povijest + poruka + slack. */
    dodajVertikalniDrag(id('_resize_povijest'), function (e, R) {
      var startY = e.clientY;
      var startHist = R.nap.offsetHeight;
      var startMsg = R.row.offsetHeight;
      var slack = size_diference;
      var minH = porukeMinVisinaPovijestiPx();
      var minM = porukeMinVisinaPorukePx();
      var maxHist = startHist + startMsg + slack - minM;
      return {
        onMove: function (ev) {
          var dy = ev.clientY - startY;
          var newHist = startHist + dy;
          if (newHist > startHist) newHist = startHist;
          if (newHist < minH) newHist = minH;
          if (newHist > maxHist) newHist = maxHist;
          postaviVisinuBlokaPovijestiPx(newHist);
          /* Visina modala ostaje: poruka se sužava / proširuje suprotno od povijesti (isti razmak u stupcu). */
          var newMsg = Math.round(R.dialog.offsetHeight - slack - newHist);
          if (newMsg < minM) newMsg = minM;
          postaviVisinuBlokaPorukePx(newMsg, null);
          primijeniVisinuModalaFormulom();
        }
      };
    });

    /* Kut poruke: mijenja visinu retka s textarea; povijest ostaje; modal po formuli. */
    dodajVertikalniDrag(id('_resize_poruka'), function (e, R) {
      var inp = id('_input');
      var chromeRow = inp ? Math.max(0, R.row.offsetHeight - inp.offsetHeight) : 8;
      var startY = e.clientY;
      var startHist = R.nap.offsetHeight;
      var startMsg = R.row.offsetHeight;
      var slack = size_diference;
      var minH = porukeMinVisinaPovijestiPx();
      var minM = porukeMinVisinaPorukePx();
      var maxMsg = startHist + startMsg + slack - minH;
      return {
        onMove: function (ev) {
          var dy = ev.clientY - startY;
          var newMsg = startMsg + dy;
          if (newMsg < minM) newMsg = minM;
          if (newMsg > maxMsg) newMsg = maxMsg;
          postaviVisinuBlokaPorukePx(newMsg, chromeRow);
          /* Povijest prilagođava ostatak budžeta pri fiksnoj visini modala tijekom draga. */
          var newHist = Math.round(R.dialog.offsetHeight - slack - newMsg);
          if (newHist < minH) newHist = minH;
          postaviVisinuBlokaPovijestiPx(newHist);
          primijeniVisinuModalaFormulom();
        }
      };
    });

    /* Kut modala: vertikalno skaliranje – sav Δ visine modala ide na povijest; poruka zadržava visinu s početka draga. */
    dodajVertikalniDrag(id('_resize_modal'), function (e, R) {
      var inpM = id('_input');
      var chromeRowM = inpM ? Math.max(0, R.row.offsetHeight - inpM.offsetHeight) : 8;
      var startY = e.clientY;
      var startDialog = R.dialog.offsetHeight;
      var startMsg = R.row.offsetHeight;
      var hrF = Math.max(porukeMinVisinaPorukePx(), startMsg);
      var slack = size_diference;
      var minH = porukeMinVisinaPovijestiPx();
      var minTot = Math.max(min_modal_visina || 0, minH + hrF + slack);
      var maxTot = porukeMaxVisinaDialogaPx(R.dialog);
      return {
        onMove: function (ev) {
          var dy = ev.clientY - startY;
          var newTot = startDialog + dy;
          if (newTot < minTot) newTot = minTot;
          if (newTot > maxTot) newTot = maxTot;
          var budget = newTot - slack;
          var newHist = Math.round(budget - hrF);
          if (newHist < minH) {
            newHist = minH;
            newTot = Math.round(newHist + hrF + slack);
          }
          postaviVisinuBlokaPovijestiPx(newHist);
          postaviVisinuBlokaPorukePx(hrF, chromeRowM);
          R.dialog.style.height = newTot + 'px';
          porukeZadnjaHp = R.nap.offsetHeight;
          porukeZadnjaHr = hrF;
          porukePrimijeniMinStiloveDialogNaDesktopu();
        }
      };
    });
  }

  function closeModal() {
    var modal = id('');
    if (!modal) return;
    var dialog = modal.querySelector('.poruke__dialog');

    porukeOdspojiDialogResizeObserver();
    porukeOdspojiUnutarnjiResizeObserver();

    /* Zatvori popup korisnika ako je otvoren */
    zatvoriPopup();

    /* Spremi geometriju za sljedeće otvaranje (samo desktop).
       Na mobu ne spremamo – inače bi se pri povratku na široki ekran
       primijenile premale dimenzije s mobitela. */
    var smallOnClose = typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    if (dialog && dialog.offsetWidth > 0 && dialog.offsetHeight > 0 && !smallOnClose) {
      var rect = dialog.getBoundingClientRect();
      savedModalState = {
        width: dialog.offsetWidth,
        height: dialog.offsetHeight,
        left: rect.left,
        top: rect.top
      };
      /* Ukloni min-* s dijaloga da sljedeće otvaranje ne nasljeđuje stare granice prije novog snimanja. */
      dialog.style.minWidth = '';
      dialog.style.minHeight = '';
    }

    var overlayEl = modal.querySelector('.kontrola-modal__overlay');
    if (overlayEl) {
      overlayEl.style.opacity = '0';
      overlayEl.style.pointerEvents = 'none';
    }

    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('kontrola-modal--open');
    modalOpen = false;

    /* Vrati scroll na pozadinsku stranicu */
    document.body.style.overflow = '';

    /* Vrati fokus na body */
    if (document.activeElement && modal.contains(document.activeElement)) {
      if (typeof document.activeElement.blur === 'function') document.activeElement.blur();
    }
  }

  /* =========================================================
   * ▒▒ BLOK: DOHVAT LISTE POŠILJATELJA ▒▒
   * GET na 0-Poruke_lista.php, renderira tablicu u modalu.
   * ========================================================= */
  function fetchLista() {
    var toggleInput = id('_toggle');
    var samoNeprocitane = toggleInput && toggleInput.checked ? '1' : '0';
    var url = API_BASE + '0-Poruke_lista.php?samo_neprocitane=' + samoNeprocitane;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = trim(xhr.responseText);
      if (!t || t.charAt(0) !== '[') return;
      try {
        var novaLista = JSON.parse(t);

        /* Ako je selektirani korisnik privremeno dodan (nova poruka, još nema u bazi),
           zadrži ga u listi da ne nestane nakon refresh-a. */
        if (selectedPosiljatelj) {
          var nadjen = false;
          for (var i = 0; i < novaLista.length; i++) {
            if (novaLista[i].id_posiljatelj === selectedPosiljatelj) { nadjen = true; break; }
          }
          if (!nadjen) {
            /* Potraži ga u staroj listi i prenesi */
            for (var j = 0; j < listaPosiljatelja.length; j++) {
              if (listaPosiljatelja[j].id_posiljatelj === selectedPosiljatelj) {
                novaLista.push(listaPosiljatelja[j]);
                break;
              }
            }
          }
        }

        listaPosiljatelja = novaLista;
        renderTablica(listaPosiljatelja);
      } catch (e) {}
    };
    xhr.send();
  }

  /* =========================================================
   * ▒▒ BLOK: RENDER TABLICE POŠILJATELJA ▒▒
   * 3 kolone bez zaglavlja: avatar, ime (dva reda), nepročitane.
   * ========================================================= */
  function renderTablica(data) {
    var tbody = id('_tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    /* Toggle disabled SAMO kad je na "Sve poruke" i nema nijednog razgovora
       (stvarno nema poruka). Ako je na "Samo nepročitane" i lista je prazna,
       toggle MORA ostati enabled da korisnik može prebaciti natrag. */
    var toggleInput = id('_toggle');
    var toggleLabel = id('_toggle_label');
    var imaRazgovora = data && data.length > 0;
    var togChecked = toggleInput && toggleInput.checked;
    var shouldDisable = !imaRazgovora && !togChecked;
    if (toggleInput) toggleInput.disabled = shouldDisable;
    if (toggleLabel) {
      if (shouldDisable) {
        toggleLabel.classList.add('poruke__toggle-label--disabled');
      } else {
        toggleLabel.classList.remove('poruke__toggle-label--disabled');
      }
    }

    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var tr = document.createElement('tr');
      tr._porukePosiljatelj = item.id_posiljatelj;

      /* Zadrži selekciju ako je isti pošiljatelj */
      if (selectedPosiljatelj === item.id_posiljatelj) {
        tr.classList.add('poruke__row--selected');
      }

      /* Kolona 1: avatar – ako slika ne postoji, prikaži sivi krug s "?" */
      var tdImg = document.createElement('td');
      tdImg.className = 'poruke__cell--img';
      var img = document.createElement('img');
      img.className = 'poruke__avatar';
      img.src = API_BASE + 'Clanovi_CRUD_slika_thumb_round.php?id=' + encodeURIComponent(item.id_posiljatelj) + '&t=' + Date.now();
      img.alt = '';
      img.draggable = false;
      img.onerror = function () {
        /* Zamijeni <img> s fallback krugom (sivi krug + "?") */
        var fallback = document.createElement('div');
        fallback.className = 'poruke__avatar-fallback';
        fallback.textContent = '?';
        this.parentNode.replaceChild(fallback, this);
      };
      tdImg.appendChild(img);
      tr.appendChild(tdImg);

      /* Kolona 2: prezime / ime – fallback za nepostojeće korisnike */
      var tdIme = document.createElement('td');
      tdIme.className = 'poruke__cell--ime';
      var prezime = item.prezime || '';
      var ime = item.ime || '';
      if (!prezime && !ime) { prezime = 'Nepoznati'; ime = 'Korisnik'; }
      var muted = item.neprocitane === 0 ? ' poruke__ime-line--muted' : '';
      var line1 = document.createElement('span');
      line1.className = 'poruke__ime-line poruke__ime-line--bold' + muted;
      line1.textContent = prezime;
      var line2 = document.createElement('span');
      line2.className = 'poruke__ime-line' + muted;
      line2.textContent = ime;
      tdIme.appendChild(line1);
      tdIme.appendChild(line2);
      tr.appendChild(tdIme);

      /* Kolona 3: badge nepročitanih (krug 36px, dvocifreni broj, 3+ cifre = "...") */
      var tdCount = document.createElement('td');
      tdCount.className = 'poruke__cell--count';
      if (item.neprocitane > 0) {
        var badge = document.createElement('span');
        badge.className = 'poruke__count-badge';
        badge.textContent = item.neprocitane > 99 ? '...' : String(item.neprocitane);
        tdCount.appendChild(badge);
      }
      tr.appendChild(tdCount);

      /* Klik na red – selektiraj i učitaj poruke */
      (function (idPos) {
        tr.addEventListener('click', function () {
          selectPosiljatelj(idPos);
        });
      })(item.id_posiljatelj);

      tbody.appendChild(tr);
    }
  }

  /**
   * Deselektiraj sve, isprazni poruke i disable textarea/pošalji.
   * Koristi se kod refresh, toggle promjene i otvaranja modala.
   */

  /** Izračunaj raspoloživu visinu za .poruke__napomena-scroll (#_napomena).
   *  Snimljeni min (napomenaPocetnaVisina) ne smije biti manji od inicijalnog layouta; max-height ≥ max(available, init). */
  function izracunajVisinuNapomene() {
    /* Na mobilnom CSS flex raspoređuje prostor – ne postavljaj inline height */
    if (!porukeSirinaJeDesktopZaResize()) return;

    var napomenaEl = id('_napomena');
    var modal = id('');
    if (!napomenaEl || !modal) return;
    var dialog = modal.querySelector('.poruke__dialog');
    if (!dialog) return;

    var header = dialog.querySelector('.poruke__header');
    var footer = dialog.querySelector('.poruke__footer');
    if (!header || !footer) return;

    /* Prostor između headera i footera (tijelo modala) */
    var bodyTop = header.getBoundingClientRect().bottom;
    var bodyBottom = footer.getBoundingClientRect().top;
    var bodyH = bodyBottom - bodyTop;

    /* Oduzmi padding desnog panela */
    var rightEl = napomenaEl.closest('.poruke__right');
    var rightPad = 0;
    if (rightEl) {
      var rs = window.getComputedStyle(rightEl);
      rightPad = (parseFloat(rs.paddingTop) || 0) + (parseFloat(rs.paddingBottom) || 0);
    }

    /* Oduzmi input-row (textarea + pošalji tipka) */
    var inputRow = rightEl ? rightEl.querySelector('.poruke__input-row') : null;
    var inputRowH = inputRow ? inputRow.offsetHeight : 0;

    /* 17px korekcija za bordere zaglavlja/podnožja i subpikselno zaokruživanje.
       Resize ikone su apsolutne u kutu – ne oduzimaju prostor od available. */
    var available = bodyH - rightPad - inputRowH - 17;
    if (available < 48) available = 48;

    if (napomenaPocetnaVisina === 0) {
      napomenaEl.style.minHeight = '';
      napomenaEl.style.maxHeight = available + 'px';
      napomenaEl.style.height = available + 'px';
      napomenaPocetnaVisina = napomenaEl.offsetHeight;
    }

    /* Kad je layout već vezan uz formulu (modal = povijest + poruka + size_diference), ne diraj inline visine
       ovdje – to rade primijeniVisinuModalaFormulom i ResizeObserveri na povijesti/poruci/dijalogu. */
    if (porukeLayoutInicijalnoSpreman) return;

    /* Pravila §6 (obavezna): donja granica = snimljena inicijalna visina, ne „available” kad on padne. */
    var initPx = napomenaPocetnaVisina;
    var maxPx = initPx > 0 ? Math.max(available, initPx) : available;
    napomenaEl.style.minHeight = initPx > 0 ? initPx + 'px' : '';
    napomenaEl.style.maxHeight = maxPx + 'px';

    /* Ispuni prostor desnog stupca, ali nikad ispod snimljenog inicijala. */
    napomenaEl.style.height = (initPx > 0 ? Math.max(initPx, available) : available) + 'px';
  }

  function clearSelection() {
    selectedPosiljatelj = null;

    /* Vizualna deselekcija tablice */
    var tbody = id('_tbody');
    if (tbody) {
      var rows = tbody.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        rows[i].classList.remove('poruke__row--selected');
      }
    }

    /* Isprazni prozor s porukama */
    var napomenaEl = id('_napomena');
    if (napomenaEl) napomenaEl.innerHTML = '';
    napomenaPocetnaVisina = 0;

    /* Disable textarea, pošalji i trash */
    var inputEl = id('_input');
    if (inputEl) { inputEl.value = ''; inputEl.disabled = true; }
    var btnPosalji = id('_posalji');
    if (btnPosalji) btnPosalji.disabled = true;
    var btnBrisi = id('_brisi');
    if (btnBrisi) btnBrisi.disabled = true;

    /* Nakon što je povijest ispražnjena, ponovno izmjeri „inicijal” (min) i visinu – samo desktop. */
    if (modalOpen && porukeSirinaJeDesktopZaResize()) {
      requestAnimationFrame(function () {
        min_povjest = 0;
        min_poruka = 0;
        min_modal_visina = 0;
        min_modal_sirina = 0;
        size_diference = 0;
        porukeLayoutInicijalnoSpreman = false;
        izracunajVisinuNapomene();
        snimiInicijalneMinDimenzijeModala();
        porukePoveziUnutarnjiResizeObserver();
        primijeniVisinuModalaFormulom();
      });
    }
  }

  /** Selektiraj pošiljatelja u tablici, učitaj njegove poruke. */
  function selectPosiljatelj(idPosiljatelj) {
    selectedPosiljatelj = idPosiljatelj;

    /* Vizualna selekcija */
    var tbody = id('_tbody');
    if (tbody) {
      var rows = tbody.querySelectorAll('tr');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i]._porukePosiljatelj === idPosiljatelj) {
          rows[i].classList.add('poruke__row--selected');
        } else {
          rows[i].classList.remove('poruke__row--selected');
        }
      }
    }

    /* Enable textarea i trash kad je pošiljatelj selektiran;
       Pošalji ostaje disabled dok korisnik ne počne pisati */
    var inputEl = id('_input');
    var btnPosalji = id('_posalji');
    if (inputEl) { inputEl.disabled = false; inputEl.value = ''; }
    if (btnPosalji) btnPosalji.disabled = true;
    var btnBrisi = id('_brisi');
    if (btnBrisi) btnBrisi.disabled = false;

    fetchPoruke(idPosiljatelj);
  }

  /* =========================================================
   * ▒▒ BLOK: DOHVAT I PRIKAZ PORUKA ▒▒
   * GET na 0-Poruke_poruke.php, renderira u scrollable div.
   * Poruke grupirane po id_razgovor i datumu.
   * ========================================================= */
  function fetchPoruke(idPosiljatelj) {
    var url = API_BASE + '0-Poruke_poruke.php?id_posiljatelj=' + encodeURIComponent(idPosiljatelj);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = trim(xhr.responseText);
      if (!t || t.charAt(0) !== '[') return;
      try {
        var poruke = JSON.parse(t);
        renderPoruke(poruke);
        lastFetchTimestamp = Date.now();

        /* Osvježi listu (nepročitane su sada 0 za ovog pošiljatelja) */
        fetchLista();
        /* Polling refresh: ažuriraj last known */
        pollNeprocitane();
      } catch (e) {}
    };
    xhr.send();
  }

  /**
   * Renderira poruke u scrollable div.
   * Grupira po datumu (separator), prikazuje autor + tekst + vrijeme.
   * Boja po tipu i statusu pročitanosti.
   */
  function renderPoruke(poruke) {
    var napomena = id('_napomena');
    if (!napomena) return;
    napomena.innerHTML = '';

    if (!poruke || poruke.length === 0) {
      var prazno = document.createElement('div');
      prazno.style.color = 'var(--c-gray-400, #aaa)';
      prazno.style.fontStyle = 'italic';
      prazno.style.padding = '12px 0';
      prazno.textContent = 'Nema poruka.';
      napomena.appendChild(prazno);
      /* Ponovno snimi min. visinu povijesti za trenutni sadržaj – isključivo široki ekran. */
      napomenaPocetnaVisina = 0;
      requestAnimationFrame(function () {
        if (!porukeSirinaJeDesktopZaResize()) return;
        min_povjest = 0;
        min_poruka = 0;
        min_modal_visina = 0;
        min_modal_sirina = 0;
        size_diference = 0;
        porukeLayoutInicijalnoSpreman = false;
        izracunajVisinuNapomene();
        snimiInicijalneMinDimenzijeModala();
        porukePoveziUnutarnjiResizeObserver();
        primijeniVisinuModalaFormulom();
      });
      return;
    }

    var lastDate = '';

    for (var i = 0; i < poruke.length; i++) {
      var p = poruke[i];

      /* Datum separator */
      var datum = extractDate(p.vrijeme_slanja);
      if (datum !== lastDate) {
        var sep = document.createElement('div');
        sep.className = 'poruke__datum-separator';
        sep.textContent = formatDateHR(datum);
        napomena.appendChild(sep);
        lastDate = datum;
      }

      /* Poruka */
      var div = document.createElement('div');
      div.className = 'poruke__msg';

      /* Određivanje CSS klase po smjeru i pročitanosti.
         Backend šalje originalni status (PRIJE update-a) pa vidimo razliku. */
      if (p.smjer === 'odgovor') {
        div.classList.add(p.procitano ? 'poruke__msg--odgovor-procitan' : 'poruke__msg--odgovor');
      } else {
        div.classList.add(p.procitano ? 'poruke__msg--primljena-procitana' : 'poruke__msg--primljena');
      }

      /* Autor */
      var autorSpan = document.createElement('span');
      autorSpan.className = 'poruke__msg-autor';
      autorSpan.textContent = p.smjer === 'odgovor' ? 'Ti:' : nadjiImePosiljatelja(selectedPosiljatelj) + ':';
      div.appendChild(autorSpan);

      /* Tekst poruke */
      var tekstNode = document.createTextNode(p.poruka || '');
      div.appendChild(tekstNode);

      /* Vrijeme + dvostruka kvačica za pročitane poruke */
      var vrSpan = document.createElement('span');
      vrSpan.className = 'poruke__msg-vrijeme';
      vrSpan.textContent = extractTime(p.vrijeme_slanja);
      if (p.procitano) {
        var checkSpan = document.createElement('span');
        checkSpan.className = 'poruke__msg-procitano';
        checkSpan.textContent = ' \u2713\u2713';
        vrSpan.appendChild(checkSpan);
      }
      div.appendChild(vrSpan);

      napomena.appendChild(div);
    }

    /* Auto-scroll na dno */
    napomena.scrollTop = napomena.scrollHeight;

    /* Nakon promjene sadržaja ponovno izmjeri prostor povijesti – samo desktop (mob ostaje na flex/CSS). */
    napomenaPocetnaVisina = 0;
    requestAnimationFrame(function () {
      if (!porukeSirinaJeDesktopZaResize()) return;
      min_povjest = 0;
      min_poruka = 0;
      min_modal_visina = 0;
      min_modal_sirina = 0;
      size_diference = 0;
      porukeLayoutInicijalnoSpreman = false;
      izracunajVisinuNapomene();
      snimiInicijalneMinDimenzijeModala();
      porukePoveziUnutarnjiResizeObserver();
      primijeniVisinuModalaFormulom();
    });
  }

  /** Nađi prezime+ime pošiljatelja iz keširane liste. */
  function nadjiImePosiljatelja(idPos) {
    for (var i = 0; i < listaPosiljatelja.length; i++) {
      if (listaPosiljatelja[i].id_posiljatelj === idPos) {
        var item = listaPosiljatelja[i];
        var p = item.prezime || '';
        var im = item.ime || '';
        if (!p && !im) return 'Nepoznati Korisnik';
        return p + ' ' + im;
      }
    }
    return 'Nepoznati Korisnik';
  }

  /* --- Blok: Pomoćne funkcije za datum/vrijeme --- */

  /** Izvuci samo datum (YYYY-MM-DD) iz datetime stringa. */
  function extractDate(dt) {
    if (!dt) return '';
    return String(dt).substring(0, 10);
  }

  /** Izvuci samo HH:MM iz datetime stringa. */
  function extractTime(dt) {
    if (!dt) return '';
    var s = String(dt);
    var sp = s.indexOf(' ');
    if (sp >= 0 && s.length >= sp + 6) return s.substring(sp + 1, sp + 6);
    var tIdx = s.indexOf('T');
    if (tIdx >= 0 && s.length >= tIdx + 6) return s.substring(tIdx + 1, tIdx + 6);
    return '';
  }

  /** Formatiraj datum (YYYY-MM-DD) u HR format (DD.MM.YYYY). */
  function formatDateHR(dateStr) {
    if (!dateStr || dateStr.length < 10) return dateStr || '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts[2] + '.' + parts[1] + '.' + parts[0] + '.';
  }

  /* =========================================================
   * ▒▒ BLOK: POPUP ZA ODABIR KORISNIKA (NOVA PORUKA) ▒▒
   * Fetch 0-Poruke_korisnici.php, renderaj u popup, filter, odabir.
   * ========================================================= */

  var popupKorisniciData = null; /* keširana lista korisnika iz API-ja */

  /** Otvori/zatvori popup za odabir korisnika. */
  function togglePopupKorisnici() {
    var popup = id('_popup_korisnici');
    if (!popup) return;
    if (popup.style.display !== 'none') {
      zatvoriPopup();
      return;
    }
    /* Dohvati korisnike (keširaj nakon prvog poziva) */
    if (popupKorisniciData) {
      prikaziPopup(popupKorisniciData);
    } else {
      fetchKorisnici(function (data) {
        popupKorisniciData = data;
        prikaziPopup(data);
      });
    }
  }

  /** Fetch korisnika iz sustav_korisnici. */
  function fetchKorisnici(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + '0-Poruke_korisnici.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      try {
        var data = JSON.parse(xhr.responseText);
        if (Array.isArray(data)) callback(data);
      } catch (e) {}
    };
    xhr.send();
  }

  /** Prikaži popup s listom korisnika. */
  function prikaziPopup(data) {
    var popup = id('_popup_korisnici');
    var lista = id('_popup_lista');
    var filterEl = id('_popup_filter');
    if (!popup || !lista) return;

    renderPopupLista(data, lista);
    if (filterEl) { filterEl.value = ''; }
    popup.style.display = '';
    if (filterEl) filterEl.focus();
  }

  /** Zatvori popup. */
  function zatvoriPopup() {
    var popup = id('_popup_korisnici');
    if (popup) popup.style.display = 'none';
  }

  /** Renderaj redove korisnika u popup listu. */
  function renderPopupLista(data, container) {
    container.innerHTML = '';
    if (!data || data.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'poruke__popup-empty';
      empty.textContent = 'Nema korisnika';
      container.appendChild(empty);
      return;
    }
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var div = document.createElement('div');
      div.className = 'poruke__popup-item';
      div._korisnikId = item.id_korisnik;
      var prezime = item.prezime || '';
      var ime = item.ime || '';
      div.textContent = prezime + ' ' + ime;
      div.addEventListener('click', (function (idK) {
        return function () {
          odaberiKorisnikaZaNovuPoruku(idK);
        };
      })(item.id_korisnik));
      container.appendChild(div);
    }
  }

  /** Filter popup liste prema upisanom tekstu. */
  function filtrirajPopup(tekst) {
    var lista = id('_popup_lista');
    if (!lista || !popupKorisniciData) return;
    var t = trim(tekst).toLowerCase();
    if (!t) {
      renderPopupLista(popupKorisniciData, lista);
      return;
    }
    var filtered = [];
    for (var i = 0; i < popupKorisniciData.length; i++) {
      var item = popupKorisniciData[i];
      var full = ((item.prezime || '') + ' ' + (item.ime || '')).toLowerCase();
      if (full.indexOf(t) >= 0) filtered.push(item);
    }
    renderPopupLista(filtered, lista);
  }

  /** Odaberi korisnika iz popupa – pokreni novi razgovor. */
  function odaberiKorisnikaZaNovuPoruku(idKorisnik) {
    zatvoriPopup();

    /* Provjeri je li korisnik već u tablici pošiljatelja */
    var postoji = false;
    for (var i = 0; i < listaPosiljatelja.length; i++) {
      if (listaPosiljatelja[i].id_posiljatelj === idKorisnik) {
        postoji = true;
        break;
      }
    }

    if (postoji) {
      /* Već postoji u listi – samo ga selektiraj */
      selectPosiljatelj(idKorisnik);
    } else {
      /* Novi korisnik: selektiraj ga i otvori prazan razgovor.
         Dodaj ga privremeno u listu i renderaj tablicu, zatim selektiraj. */
      var ime = '', prezime = '';
      if (popupKorisniciData) {
        for (var j = 0; j < popupKorisniciData.length; j++) {
          if (popupKorisniciData[j].id_korisnik === idKorisnik) {
            prezime = popupKorisniciData[j].prezime || '';
            ime = popupKorisniciData[j].ime || '';
            break;
          }
        }
      }
      listaPosiljatelja.push({
        id_posiljatelj: idKorisnik,
        prezime: prezime,
        ime: ime,
        neprocitane: 0
      });
      renderTablica(listaPosiljatelja);
      selectPosiljatelj(idKorisnik);
    }

    /* Fokus na textarea za pisanje */
    var inputEl = id('_input');
    if (inputEl && !inputEl.disabled) inputEl.focus();
  }

  /* =========================================================
   * ▒▒ BLOK: BRISANJE RAZGOVORA ▒▒
   * DELETE svih poruka između logged korisnika i odabranog pošiljatelja.
   * POST na 0-Poruke_brisi.php, zatim clearSelection + fetchLista.
   * ========================================================= */
  function obrisiRazgovor(idPosiljatelj) {
    var btnBrisi = id('_brisi');
    if (btnBrisi) btnBrisi.disabled = true;

    var params = { id_posiljatelj: idPosiljatelj };

    if (typeof window.CommonPostFormData === 'function') {
      window.CommonPostFormData(API_BASE + '0-Poruke_brisi.php', params, function (res) {
        onRazgovorObrisan(res);
      });
    } else {
      var formData = new FormData();
      for (var key in params) {
        if (params.hasOwnProperty(key)) formData.append(key, params[key]);
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '0-Poruke_brisi.php', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        onRazgovorObrisan(trim(xhr.responseText));
      };
      xhr.send(formData);
    }
  }

  /** Callback nakon brisanja razgovora – očisti selekciju, osvježi listu. */
  function onRazgovorObrisan(res) {
    if (res === '-1') {
      clearSelection();
      fetchLista();
    } else {
      if (typeof window.showPorukaModal === 'function') {
        var code = res || '101';
        window.showPorukaModal(code);
      }
      /* Re-enable trash ako je još selektiran razgovor */
      var btnBrisi = id('_brisi');
      if (btnBrisi && selectedPosiljatelj) btnBrisi.disabled = false;
    }
  }

  /* =========================================================
   * ▒▒ BLOK: SLANJE ODGOVORA ▒▒
   * POST na 0-Poruke_posalji.php, zatim refresh napomene.
   * ========================================================= */
  function posaljiOdgovor(idPrimatelj, tekst) {
    var btnPosalji = id('_posalji');
    var inputEl = id('_input');
    if (btnPosalji) btnPosalji.disabled = true;

    var params = {
      id_primatelj: idPrimatelj,
      poruka: tekst,
      id_razgovor: '0'
    };

    /* Koristi CommonPostFormData ako dostupan, inače ručni XHR */
    if (typeof window.CommonPostFormData === 'function') {
      window.CommonPostFormData(API_BASE + '0-Poruke_posalji.php', params, function (res) {
        onOdgovorPoslan(res, inputEl, btnPosalji, idPrimatelj);
      });
    } else {
      var formData = new FormData();
      for (var key in params) {
        if (params.hasOwnProperty(key)) formData.append(key, params[key]);
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '0-Poruke_posalji.php', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        onOdgovorPoslan(trim(xhr.responseText), inputEl, btnPosalji, idPrimatelj);
      };
      xhr.send(formData);
    }
  }

  /** Callback nakon slanja odgovora – refresh napomene i input. */
  function onOdgovorPoslan(res, inputEl, btnPosalji, idPrimatelj) {
    if (res === '-1') {
      /* Uspjeh: očisti input, refresh poruke */
      if (inputEl) inputEl.value = '';
      if (btnPosalji) btnPosalji.disabled = true;
      fetchPoruke(idPrimatelj);
    } else {
      /* Greška: prikaži modal poruke ako je dostupan */
      if (typeof window.showPorukaModal === 'function') {
        var code = res || '101';
        var parts = code.split(',');
        var mainCode = parts[0];
        var replacements = parts.length > 1 ? [parts.slice(1).join(',')] : [];
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[mainCode]) {
          window.showPorukaModal(mainCode, replacements);
        } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101']) {
          window.showPorukaModal('101', []);
        }
      }
      if (btnPosalji) btnPosalji.disabled = false;
    }
  }

  /* =========================================================
   * ▒▒ BLOK: INICIJALIZACIJA ▒▒
   * DOMContentLoaded: injektiraj mail ikonu, pokreni polling.
   * ========================================================= */
  function init() {
    /* Ne pokreći na Login stranici */
    var path = window.location.pathname || '';
    if (/Login\.(html|php)/i.test(path)) return;
    if (document.body && document.body.classList.contains('login-win')) return;

    vnlhInjectNaslovPoruke();
    initPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Eksport za eventualno vanjsko otvaranje modala */
  window.VnlhPorukeOpenModal = openModal;

})();
