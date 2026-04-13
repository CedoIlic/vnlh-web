/* =========================================================
   00-Testni_modal.js
   Testni modal – učitavanje fragmenta, otvaranje globalnom funkcijom (dvoklik na mail u 0-Poruke.js),
   zatvaranje tipkom Povratak ili Escape.
   Ovisnosti: 0-Poruke.css (tablica, toggle, gumb Povratak, overlay), 0-Common po želji.
   Geometrija dijaloga (px) pamti se pri izlasku na desktopu i obnavlja pri sljedećem otvaranju.
   Lijevo: lista pošiljatelja (GET 0-Poruke_lista.php) – ista logika prikaza kao u 0-Poruke.js, bez učitavanja
   poruka u desni dio (klik na red samo označava red).
   Desno: #vnlh_testni_modal_edit_povijest (gornji), #vnlh_testni_modal_edit_poruka (donji).
   ========================================================= */
(function () {
  'use strict';

  function trim(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  function resolveApiBase() {
    var p = window.location.pathname || '';
    if (/\/html\//i.test(p) || /\/html$/i.test(p)) return '../php/';
    if (/\/php\//i.test(p)) return '';
    return 'php/';
  }

  /**
   * URL do 00-Testni_modal.php iz pozicije ove skripte (isti obrazac kao 0-Poruke.js).
   */
  function resolveTemplateUrl(filename) {
    var u = trim(filename);
    if (!u) return u;
    if (/^https?:\/\//i.test(u) || u.charAt(0) === '/' || /^\.\.?\//.test(u)) return u;
    try {
      var nodes = document.querySelectorAll('script[src*="00-Testni_modal.js"]');
      var el = nodes.length ? nodes[nodes.length - 1] : null;
      if (el && el.src) {
        var scriptUrl = new URL(el.src);
        var pathname = scriptUrl.pathname;
        var jsDir = pathname.replace(/\/[^/]+$/, '/');
        var phpDir = jsDir.replace(/\/js\/$/i, '/php/');
        return scriptUrl.origin + phpDir + u.replace(/^\.\//, '');
      }
    } catch (e0) {}
    return u;
  }

  var API_BASE = resolveApiBase();
  var TEMPLATE_URL = resolveTemplateUrl('00-Testni_modal.php');
  var ID_PREFIX = 'vnlh_testni_modal_';

  /**
   * Minimalne dimenzije dijaloga na desktopu (usklađeno s 00-Testni_modal.css).
   * Spremljena geometrija i nativni resize ne smiju biti manji od ovoga.
   */
  var TESTNI_MODAL_MIN_DIALOG_W = 720;
  var TESTNI_MODAL_MIN_DIALOG_H = 400;

  /**
   * ZAGLAVLJE_TABLICE_TESTNI (konceptualno – nema <thead> u DOM-u; stupci se iscrtavaju redom u <tr>).
   * Isti model kao renderTablica u 0-Poruke.js.
   *
   * | key          | tdClass            | Uloga | Moguće vrijednosti / napomena |
   * |--------------|--------------------|-------|--------------------------------|
   * | avatar       | poruke__cell--img  | Slika | img src = API Clanovi_CRUD_slika_thumb_round.php?id=id_posiljatelj; onerror → .poruke__avatar-fallback |
   * | ime          | poruke__cell--ime  | Tekst | prezime (bold), ime; prazno → „Nepoznati”/„Korisnik”; muted ako neprocitane===0 |
   * | neprocitane  | poruke__cell--count| Badge | 0 = prazno; 1–99 broj; 100+ → „...” |
   */
  var ZAGLAVLJE_TABLICE_TESTNI = [
    { key: 'avatar', tdClass: 'poruke__cell--img' },
    { key: 'ime', tdClass: 'poruke__cell--ime' },
    { key: 'neprocitane', tdClass: 'poruke__cell--count' }
  ];

  /** Keš liste s 0-Poruke_lista.php (isti JSON kao modal Poruke). */
  var testniListaPosiljatelja = [];
  /** id_posiljatelj označenog reda (vizualno); ne otvara se povijest poruka u ovom modalu. */
  var testniOdabraniPosiljatelj = null;

  var modalLoaded = false;
  var modalOpen = false;

  var spremljenaGeometrijaTestnogModala = null;

  function id(suffix) {
    return document.getElementById(ID_PREFIX + suffix);
  }

  /** Prazni oznaku retka u tablici testnog modala (bez API poziva). */
  function testniOdznaciListu() {
    testniOdabraniPosiljatelj = null;
    var tbody = id('_tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('poruke__row--selected');
    }
  }

  /**
   * Jedna ćelija retka tablice prema ključu iz ZAGLAVLJE_TABLICE_TESTNI.
   * @param {string} key avatar | ime | neprocitane
   * @param {object} item element liste s 0-Poruke_lista.php
   * @returns {HTMLTableCellElement|null}
   */
  function testniGraditeljCelije(key, item) {
    if (key === 'avatar') {
      var tdImg = document.createElement('td');
      tdImg.className = 'poruke__cell--img';
      var img = document.createElement('img');
      img.className = 'poruke__avatar';
      img.src =
        API_BASE +
        'Clanovi_CRUD_slika_thumb_round.php?id=' +
        encodeURIComponent(item.id_posiljatelj) +
        '&t=' +
        Date.now();
      img.alt = '';
      img.draggable = false;
      img.onerror = function () {
        var fallback = document.createElement('div');
        fallback.className = 'poruke__avatar-fallback';
        fallback.textContent = '?';
        this.parentNode.replaceChild(fallback, this);
      };
      tdImg.appendChild(img);
      return tdImg;
    }
    if (key === 'ime') {
      var tdIme = document.createElement('td');
      tdIme.className = 'poruke__cell--ime';
      var prezime = item.prezime || '';
      var ime = item.ime || '';
      if (!prezime && !ime) {
        prezime = 'Nepoznati';
        ime = 'Korisnik';
      }
      var muted = item.neprocitane === 0 ? ' poruke__ime-line--muted' : '';
      var line1 = document.createElement('span');
      line1.className = 'poruke__ime-line poruke__ime-line--bold' + muted;
      line1.textContent = prezime;
      var line2 = document.createElement('span');
      line2.className = 'poruke__ime-line' + muted;
      line2.textContent = ime;
      tdIme.appendChild(line1);
      tdIme.appendChild(line2);
      return tdIme;
    }
    if (key === 'neprocitane') {
      var tdCount = document.createElement('td');
      tdCount.className = 'poruke__cell--count';
      if (item.neprocitane > 0) {
        var badge = document.createElement('span');
        badge.className = 'poruke__count-badge';
        badge.textContent = item.neprocitane > 99 ? '...' : String(item.neprocitane);
        tdCount.appendChild(badge);
      }
      return tdCount;
    }
    return null;
  }

  /**
   * Iscrtaj tbody iz keša; disable toggle kao u 0-Poruke.js kad nema razgovora i filter je „sve”.
   */
  function renderTestniTablica(data) {
    var tbody = id('_tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var toggleInput = id('_toggle');
    var toggleLabel = id('_toggle_label');
    var imaRazgovora = data && data.length > 0;
    var togChecked = toggleInput && toggleInput.checked;
    var shouldDisable = !imaRazgovora && !togChecked;
    if (toggleInput) toggleInput.disabled = shouldDisable;
    if (toggleLabel) {
      if (shouldDisable) toggleLabel.classList.add('poruke__toggle-label--disabled');
      else toggleLabel.classList.remove('poruke__toggle-label--disabled');
    }

    for (var i = 0; i < (data || []).length; i++) {
      var item = data[i];
      var tr = document.createElement('tr');
      tr._porukePosiljatelj = item.id_posiljatelj;
      if (testniOdabraniPosiljatelj === item.id_posiljatelj) {
        tr.classList.add('poruke__row--selected');
      }
      for (var c = 0; c < ZAGLAVLJE_TABLICE_TESTNI.length; c++) {
        var col = ZAGLAVLJE_TABLICE_TESTNI[c];
        var td = testniGraditeljCelije(col.key, item);
        if (td) tr.appendChild(td);
      }
      (function (idPos) {
        tr.addEventListener('click', function () {
          testniOdabraniPosiljatelj = idPos;
          var all = tbody.querySelectorAll('tr');
          for (var r = 0; r < all.length; r++) {
            if (all[r]._porukePosiljatelj === idPos) all[r].classList.add('poruke__row--selected');
            else all[r].classList.remove('poruke__row--selected');
          }
        });
      })(item.id_posiljatelj);
      tbody.appendChild(tr);
    }
  }

  /** GET 0-Poruke_lista.php – isti parametar samo_neprocitane kao modal Poruke. */
  function fetchTestniLista() {
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
        if (testniOdabraniPosiljatelj) {
          var nadjen = false;
          for (var i = 0; i < novaLista.length; i++) {
            if (novaLista[i].id_posiljatelj === testniOdabraniPosiljatelj) {
              nadjen = true;
              break;
            }
          }
          if (!nadjen) {
            for (var j = 0; j < testniListaPosiljatelja.length; j++) {
              if (testniListaPosiljatelja[j].id_posiljatelj === testniOdabraniPosiljatelj) {
                novaLista.push(testniListaPosiljatelja[j]);
                break;
              }
            }
          }
        }
        testniListaPosiljatelja = novaLista;
        renderTestniTablica(testniListaPosiljatelja);
      } catch (e1) {}
    };
    xhr.send();
  }

  function ensureModalLoaded(cb) {
    if (modalLoaded) {
      if (typeof cb === 'function') cb();
      return;
    }
    var sep = TEMPLATE_URL.indexOf('?') >= 0 ? '&' : '?';
    var ver = typeof window !== 'undefined' && window.VNLH_VERZIJA ? String(window.VNLH_VERZIJA) : '';
    var fetchUrl = ver ? TEMPLATE_URL + sep + 'v=' + encodeURIComponent(ver) : TEMPLATE_URL;
    fetch(fetchUrl, { cache: 'no-store' })
      .then(function (r) {
        return r.text();
      })
      .then(function (html) {
        var replaced = html.replace(/__ID_PREFIX__/g, ID_PREFIX);
        var mount = document.createElement('div');
        mount.innerHTML = replaced;
        var fragment = mount.firstElementChild;
        if (fragment) document.body.appendChild(fragment);
        modalLoaded = true;
        setupHandlers();
        if (typeof cb === 'function') cb();
      })
      .catch(function () {});
  }

  /**
   * Dijalog je unutar flex-centriranog overlaya – bez ovoga nativni resize:both često mijenja
   * širinu/visinu simetrično oko središta. fixed + eksplicitni left/top/width/height sidre gornji
   * lijevi kut pa se širenje vuče u smjeru povlačenja (donji desni grip).
   */
  function anchorDialogZaResize(dialog) {
    if (!dialog) return;
    var r = dialog.getBoundingClientRect();
    dialog.style.position = 'fixed';
    dialog.style.margin = '0';
    dialog.style.left = Math.round(r.left) + 'px';
    dialog.style.top = Math.round(r.top) + 'px';
    dialog.style.width = Math.round(r.width) + 'px';
    dialog.style.height = Math.round(r.height) + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
  }

  function resetDialogGeometriju(dialog) {
    if (!dialog) return;
    dialog.style.position = '';
    dialog.style.left = '';
    dialog.style.top = '';
    dialog.style.width = '';
    dialog.style.height = '';
    dialog.style.margin = '';
    dialog.style.right = '';
    dialog.style.bottom = '';
    dialog.style.minWidth = '';
    dialog.style.minHeight = '';
  }

  function jeMobitelZaTestniModal() {
    return typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  function primijeniGeometrijuDijalogaNakonOtvaranja(dialog) {
    if (!dialog || !modalOpen) return;
    var mob = jeMobitelZaTestniModal();
    if (mob && window.innerWidth > 0) {
      resetDialogGeometriju(dialog);
      var dialogW = Math.max(280, window.innerWidth * 0.95);
      var dialogH = Math.max(200, Math.min(window.innerHeight * 0.75, window.innerHeight - 24));
      dialog.style.position = 'fixed';
      dialog.style.margin = '10px auto 0';
      dialog.style.left = '0';
      dialog.style.right = '0';
      dialog.style.top = '10px';
      dialog.style.width = dialogW + 'px';
      dialog.style.height = dialogH + 'px';
      dialog.style.minWidth = '260px';
      dialog.style.minHeight = '160px';
      return;
    }
    if (spremljenaGeometrijaTestnogModala && !mob) {
      dialog.style.position = 'fixed';
      dialog.style.margin = '0';
      dialog.style.right = 'auto';
      dialog.style.bottom = 'auto';
      var wSp = Math.round(spremljenaGeometrijaTestnogModala.width);
      var hSp = Math.round(spremljenaGeometrijaTestnogModala.height);
      dialog.style.width = Math.max(TESTNI_MODAL_MIN_DIALOG_W, wSp) + 'px';
      dialog.style.height = Math.max(TESTNI_MODAL_MIN_DIALOG_H, hSp) + 'px';
      dialog.style.left = Math.round(spremljenaGeometrijaTestnogModala.left) + 'px';
      dialog.style.top = Math.round(spremljenaGeometrijaTestnogModala.top) + 'px';
      return;
    }
    anchorDialogZaResize(dialog);
  }

  function setupHandlers() {
    var modal = id('');
    if (!modal) return;
    var dialog = modal.querySelector('.testni-modal__dialog');
    var header = id('_header');

    if (header && dialog) {
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
        if (!dialog.style.width) dialog.style.width = Math.round(rect.width) + 'px';
        if (!dialog.style.height) dialog.style.height = Math.round(rect.height) + 'px';
        header.style.userSelect = 'none';
        function move(ev) {
          dialog.style.left = Math.round(startLeft + (ev.clientX - startX)) + 'px';
          dialog.style.top = Math.round(startTop + (ev.clientY - startY)) + 'px';
        }
        function up() {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          header.style.userSelect = '';
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }

    var btnRef = id('_refresh');
    if (btnRef) {
      btnRef.addEventListener('click', function () {
        if (typeof window.vnlhTestniModalRefresh === 'function') {
          try {
            window.vnlhTestniModalRefresh();
          } catch (eRef) {}
        }
        btnRef.classList.remove('poruke__refresh-btn--nova');
        testniOdznaciListu();
        fetchTestniLista();
      });
    }

    var toggleInput = id('_toggle');
    var toggleText = id('_toggle_text');
    if (toggleInput) {
      toggleInput.addEventListener('change', function () {
        if (toggleText) {
          toggleText.textContent = this.checked ? 'Samo nepročitane' : 'Sve poruke';
        }
        testniOdznaciListu();
        fetchTestniLista();
      });
    }

    var btnPov = id('_povratak');
    if (btnPov) {
      btnPov.addEventListener('click', function () {
        closeTestniModal();
      });
    }
  }

  function openTestniModal() {
    ensureModalLoaded(function () {
      var modal = id('');
      if (!modal) return;
      var dialog = modal.querySelector('.testni-modal__dialog');
      var overlayEl = modal.querySelector('.kontrola-modal__overlay');
      if (overlayEl) {
        overlayEl.style.opacity = '';
        overlayEl.style.pointerEvents = '';
      }
      modal.style.display = '';
      modal.style.visibility = '';
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.remove('kontrola-modal--open');
      modal.classList.add('testni-modal--pending-layout');
      modalOpen = true;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () {
        if (!modalOpen || !dialog) return;
        try {
          primijeniGeometrijuDijalogaNakonOtvaranja(dialog);
        } finally {
          modal.classList.remove('testni-modal--pending-layout');
          modal.classList.add('kontrola-modal--open');
        }
        /* Lista pošiljatelja: reset toggle i dohvat (kao openModal u 0-Poruke.js, bez desnog panela poruka). */
        var ti = id('_toggle');
        var tt = id('_toggle_text');
        if (ti && ti.checked) ti.checked = false;
        if (tt) tt.textContent = 'Sve poruke';
        testniOdznaciListu();
        fetchTestniLista();
      });
    });
  }

  function closeTestniModal() {
    var modal = id('');
    if (!modal) return;
    var dialog = modal.querySelector('.testni-modal__dialog');
    var mobZatvori = jeMobitelZaTestniModal();
    if (dialog && dialog.offsetWidth > 0 && dialog.offsetHeight > 0 && !mobZatvori) {
      var rect = dialog.getBoundingClientRect();
      spremljenaGeometrijaTestnogModala = {
        width: dialog.offsetWidth,
        height: dialog.offsetHeight,
        left: rect.left,
        top: rect.top
      };
    }
    resetDialogGeometriju(dialog);
    var overlayEl = modal.querySelector('.kontrola-modal__overlay');
    if (overlayEl) {
      overlayEl.style.opacity = '0';
      overlayEl.style.pointerEvents = 'none';
    }
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('kontrola-modal--open', 'testni-modal--pending-layout');
    modalOpen = false;
    document.body.style.overflow = '';
    if (document.activeElement && modal.contains(document.activeElement)) {
      if (typeof document.activeElement.blur === 'function') document.activeElement.blur();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !modalOpen) return;
    closeTestniModal();
    e.stopPropagation();
  });

  window.vnlhOpenTestniModal = openTestniModal;
  window.vnlhCloseTestniModal = closeTestniModal;
})();
