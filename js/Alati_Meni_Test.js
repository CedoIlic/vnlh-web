/* =========================================================
   Alati_Meni_Test.js
   Test menija – panel uvjeti. Punjenje prvih tri selekta iz Meni_Tip_CRUD_sve.php.
   API menija: meni_dohvat_stabla_menija.php s GET alati_meni_test_puno_stablo=1 (puno stablo kad
   dužnosnik nije odabran) – vidi komentare u tom PHP-u. Meni.js koristi from_meni=1, bez tog parametra.
   Logika trake / drawer-a usklađena je s Meni.js (iste klase alati-meni-test__*, isti ID-jevi u DOM-u).
   Ova skripta ne ide na CRUD stranice (npr. Članovi). Na Alati_Meni_Test.html body ima klasu page-alati-meni-test.
   ========================================================= */

(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Alati_Meni_Test.html');

  var API_BASE = '../php/';
  /** Ista kašnjenja kao Meni.js: var 116 glavna stavka, 115 podmeni (vnlhLoadMeniHoverDelaysFromVar116And115). */
  if (typeof window.vnlhLoadMeniHoverDelaysFromVar116And115 === 'function') {
    window.vnlhLoadMeniHoverDelaysFromVar116And115(API_BASE);
  }
  /** Tri grupe (horizontalni / podmeniji / izvršni meni) omogućene samo ako sustav_varijable id=106 ima varijabla trim === '1'. */
  var meniTipConfigByVar106 = false;

  /** Postavi enable/disable na sve kontrole unutar tri grupe tipa menija (koristi KontroleSetEnabled po podstablu). */
  function applyMeniTipGrupaEnabled(enabled) {
    document.querySelectorAll('.alati-meni-test__grupa--sustav-meni-tip').forEach(function (gr) {
      if (typeof KontroleSetEnabled === 'function') KontroleSetEnabled(gr, enabled);
    });
  }

  /**
   * Dohvat common_sustav_varijable.php?id=106.
   * Nakon što se enable/disable primijeni na grupe, poziva loadMeniTip() (ne serial-parallel s AJAX-om)
   * kako bi punjenje opcija i KontroleRefreshCustomSelect radili uz konačno stanje nativnog selecta.
   */
  function loadSustavVarijabla106ZaMeniTip() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'common_sustav_varijable.php?id=106', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (typeof vnlhRedirectIfUnauthorized === 'function' && vnlhRedirectIfUnauthorized(xhr, text)) return;
      var ok = text !== '120' && text === '1';
      meniTipConfigByVar106 = ok;
      applyMeniTipGrupaEnabled(ok);
      updateUpisiState();
      loadMeniTip();
    };
    xhr.send();
  }

  /** Nakon flipa podmeni-tijela pri širenju (html) na izvršnoj stavci: do ovog vremena (epoch ms) mouseleave na main-item čeka duže prije zatvaranja. */
  var flipIzvrsniHoverGraceUntil = 0;
  var FLIP_IZVRSNI_HOVER_CLOSE_DELAY_MS = 2000;

  function syncMeniTrakaRezolucija() {
    var traka = document.getElementById('traka_h_menija');
    if (!traka || !traka.classList.contains('alati-meni-test__traka')) return;
    traka.setAttribute('data-meni-rezolucija', window.matchMedia('(max-width: 640px)').matches ? 'ushko' : 'siroko');
  }

  function wireMeniTrakaRezolucija() {
    if (!document.getElementById('traka_h_menija')) return;
    var mq = window.matchMedia('(max-width: 640px)');
    function onChange() {
      syncMeniTrakaRezolucija();
    }
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    window.addEventListener('resize', syncMeniTrakaRezolucija);
    syncMeniTrakaRezolucija();
  }

  /** Punjenje selecta opcijama iz arr [{id, naziv}]. */
  function fillSelectOptions(sel, arr) {
    if (!sel) return;
    sel.innerHTML = '<option value="0">Nije izabran</option>';
    if (!arr || !arr.length) return;
    for (var i = 0; i < arr.length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? arr[i].id : 0;
      opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
      sel.appendChild(opt);
    }
  }

  /** Učitaj Meni_Tip_CRUD_sve.php i popuni prva tri selecta. */
  function loadMeniTip() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Meni_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (typeof vnlhRedirectIfUnauthorized === 'function' && vnlhRedirectIfUnauthorized(xhr, text)) return;
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { arr = JSON.parse(text || '[]'); } catch (e) {}
      }
      var sel1 = document.getElementById('select_meni_tip');
      var sel2 = document.getElementById('select_podmeniji');
      var sel3 = document.getElementById('select_izvrsni_meni');
      fillSelectOptions(sel1, arr);
      fillSelectOptions(sel2, arr);
      fillSelectOptions(sel3, arr);
      if (typeof KontroleRefreshCustomSelect === 'function') {
        KontroleRefreshCustomSelect('select_meni_tip');
        KontroleRefreshCustomSelect('select_podmeniji');
        KontroleRefreshCustomSelect('select_izvrsni_meni');
      }
      updateUpisiState();
    };
    xhr.send();
  }

  /** Učitaj Duznosnici_CRUD_sve.php i popuni select_duznosnik. */
  function loadDuznosnici() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Duznosnici_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { arr = JSON.parse(text || '[]'); } catch (e) {}
      }
      var sel = document.getElementById('select_duznosnik');
      fillSelectOptions(sel, arr);
      if (typeof KontroleRefreshCustomSelect === 'function') {
        KontroleRefreshCustomSelect('select_duznosnik');
      }
    };
    xhr.send();
  }

  /** Omogući/onemogući tipku Upiši prema tri prva selecta. */
  function updateUpisiState() {
    var btn = document.getElementById('btnUpisi');
    if (!btn) return;
    var s1 = document.getElementById('select_meni_tip');
    var s2 = document.getElementById('select_podmeniji');
    var s3 = document.getElementById('select_izvrsni_meni');
    var v1 = s1 && s1.value && s1.value !== '0';
    var v2 = s2 && s2.value && s2.value !== '0';
    var v3 = s3 && s3.value && s3.value !== '0';
    btn.disabled = !(v1 && v2 && v3);
  }

  /** Poveži selecte s edit poljima: pri izboru postavi id u pripadajući edit. */
  function bindSelectToEdit() {
    var pairs = [
      ['select_meni_tip', 'edit_glavni_id'],
      ['select_podmeniji', 'edit_podmeniji'],
      ['select_izvrsni_meni', 'edit_izvrsni_meni'],
      ['select_duznosnik', null]
    ];
    pairs.forEach(function (p) {
      var sel = document.getElementById(p[0]);
      var edit = p[1] ? document.getElementById(p[1]) : null;
      if (!sel) return;
      if (p[0] === 'select_duznosnik') {
        sel.addEventListener('change', function () {
          updateUpisiState();
          // Promjena dužnosnika samo briše postojeći meni — korisnik mora kliknuti
          // "Osvježi meni" da bi se meni ponovo iscrtao za novog dužnosnika.
          clearMeniState();
        });
      } else {
        if (!edit) return;
        sel.addEventListener('change', function () {
          edit.value = sel.value != null ? String(sel.value) : '';
          updateUpisiState();
        });
      }
    });
    updateUpisiState();
  }

  /** Parsiraj odgovor API-ja: OK, 100, 105, 200,errno */
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /** Tipka Upiši: spremi edit_glavni_id, edit_podmeniji, edit_izvrsni_meni u sustav_varijable (id 103, 104, 105). */
  function initUpisi() {
    var btn = document.getElementById('btnUpisi');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!meniTipConfigByVar106) return;
      var editGlavni = document.getElementById('edit_glavni_id');
      var editPodmeniji = document.getElementById('edit_podmeniji');
      var editIzvrsni = document.getElementById('edit_izvrsni_meni');
      var glavni = editGlavni ? String(editGlavni.value || '').trim() : '';
      var podmeniji = editPodmeniji ? String(editPodmeniji.value || '').trim() : '';
      var izvrsni = editIzvrsni ? String(editIzvrsni.value || '').trim() : '';
      var params = { glavni_id: glavni, podmeniji: podmeniji, izvrsni_meni: izvrsni };
      if (typeof window.CommonPostFormData !== 'function') return;
      window.CommonPostFormData(API_BASE + 'Alati_Meni_Test_Upis.php', params, function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', []);
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements);
          }
        }
      });
    });
  }

  /** Zadnji učitani podaci menija (za drawer na uskom prikazu). */
  var lastMeniData = { tree: null, izvrsniTipId: null };

  /** Očisti stanje menija. */
  function clearMeniState() {
    var container = document.getElementById('meni_container');
    if (container) container.innerHTML = '';
  }

  /** Vrati vrijednost tokena --meni_traka_text_align (L/R/C). */
  function getMeniTrakaAlign() {
    var val = (getComputedStyle(document.documentElement).getPropertyValue('--meni_traka_text_align') || '').trim().toUpperCase();
    return val === 'L' ? 'L' : (val === 'C' ? 'C' : 'R');
  }

  /** Primijeni poravnanje stavki i end_padding iz tokena --meni_traka_text_align (L/R/C), --meni_traka_end_padding. */
  function applyMeniTrakaAlign() {
    var container = document.getElementById('meni_container');
    var traka = document.getElementById('traka_h_menija');
    var drawer = document.getElementById('meni_drawer');
    if (!container) return;
    var val = getMeniTrakaAlign();
    var justify = val === 'L' ? 'flex-start' : (val === 'C' ? 'center' : 'flex-end');
    container.style.justifyContent = justify;
    var endPad = (getComputedStyle(document.documentElement).getPropertyValue('--meni_traka_end_padding') || '0').trim();
    container.style.paddingLeft = (val === 'L' ? endPad : '0');
    container.style.paddingRight = (val === 'R' ? endPad : '0');
    if (traka) {
      traka.classList.toggle('alati-meni-test__traka--align-l', val === 'L');
    }
    if (drawer) {
      drawer.classList.toggle('alati-meni-test__drawer--from-left', val === 'L');
    }
  }

  /** Vrati multiplier širine dropdowna iz tokena --meni_dropdown_width_multiplier (decimal, npr. 1.5). */
  function getMeniDropdownWidthMultiplier() {
    var s = (getComputedStyle(document.documentElement).getPropertyValue('--meni_dropdown_width_multiplier') || '1.5').trim();
    var n = parseFloat(s, 10);
    return isNaN(n) || n <= 0 ? 1.5 : n;
  }

  /** Vrati minimalnu širinu dropdowna iz tokena --meni_dropdown_min_width (px). */
  function getMeniDropdownMinWidth() {
    var s = (getComputedStyle(document.documentElement).getPropertyValue('--meni_dropdown_min_width') || '200').trim();
    var n = parseInt(s, 10);
    return isNaN(n) || n < 0 ? 200 : n;
  }

  /** Primijeni smjer gradienta iz tokena --meni_traka_gradient_direction (H/V, neovisno o veličini). */
  function applyMeniTrakaGradient() {
    var val = (getComputedStyle(document.documentElement).getPropertyValue('--meni_traka_gradient_direction') || '').trim().toUpperCase();
    var dir = val === 'V' ? 'to bottom' : 'to right';
    var bg = 'linear-gradient(' + dir + ', var(--meni_traka_bg_1), var(--meni_traka_bg_2))';
    var traka = document.getElementById('traka_h_menija');
    if (traka) traka.style.background = bg;
    var drawerHead = document.querySelector('.alati-meni-test__drawer-head');
    if (drawerHead) drawerHead.style.background = bg;
  }

  /** Iscrtaj meni iz stabla. izvrsniTipId = meni_tip_id za izvršni meni. */
  function renderMeni(tree, izvrsniTipId, container) {
    if (!container || !tree || !tree.length) return;
    var horizontal = document.createElement('div');
    horizontal.className = 'alati-meni-test__meni-horizontal';
    tree.forEach(function (node) {
      var mainItem = document.createElement('div');
      mainItem.className = 'alati-meni-test__meni-main-item';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'alati-meni-test__meni-main-btn';
      btn.textContent = node.naziv || '';
      btn.dataset.nodeId = String(node.id);
      var dropdown = document.createElement('div');
      dropdown.className = 'alati-meni-test__meni-dropdown';
      if (node.children && node.children.length > 0) {
        renderChildren(node.children, izvrsniTipId, dropdown);
      }
      var openTimer = null;
      var closeTimer = null;
      function openThisMainDropdownTest() {
        openTimer = null;
        flipIzvrsniHoverGraceUntil = 0;
        var open = document.querySelector('.alati-meni-test__meni-dropdown--open');
        if (open && open !== dropdown) {
          open.classList.remove('alati-meni-test__meni-dropdown--open');
          clearPanelWidths(open);
        }
        dropdown.style.visibility = 'hidden';
        dropdown.classList.add('alati-meni-test__meni-dropdown--open');
        dropdown.style.width = 'max-content';
        dropdown.style.minWidth = '0';
        dropdown.offsetHeight;
        var contentW = dropdown.scrollWidth;
        var mult = getMeniDropdownWidthMultiplier();
        var minW = getMeniDropdownMinWidth();
        var w = contentW > 0 ? Math.round(contentW * mult) : 0;
        if (w < minW) w = minW;
        applyPanelFlipBeforeShow(dropdown, mainItem, w, true);
        if (w > 0) {
          dropdown.style.width = w + 'px';
          dropdown.style.minWidth = w + 'px';
        }
        dropdown.style.visibility = '';
      }
      mainItem.addEventListener('mouseenter', function () {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        flipIzvrsniHoverGraceUntil = 0;
        openTimer = setTimeout(openThisMainDropdownTest, typeof window.vnlhGetMeniHoverDelayMainMs === 'function' ? window.vnlhGetMeniHoverDelayMainMs() : 300);
      });
      mainItem.addEventListener('mouseleave', function () {
        if (openTimer) { clearTimeout(openTimer); openTimer = null; }
        var closeDelay = Date.now() < flipIzvrsniHoverGraceUntil ? FLIP_IZVRSNI_HOVER_CLOSE_DELAY_MS : 300;
        closeTimer = setTimeout(function () {
          closeTimer = null;
          dropdown.classList.remove('alati-meni-test__meni-dropdown--open');
          clearPanelWidths(dropdown);
        }, closeDelay);
      });
      btn.addEventListener('click', function () {
        if (openTimer) {
          clearTimeout(openTimer);
          openTimer = null;
        }
        openThisMainDropdownTest();
      });
      mainItem.appendChild(btn);
      mainItem.appendChild(dropdown);
      horizontal.appendChild(mainItem);
    });
    container.appendChild(horizontal);
  }

  /** Očisti inline širine s panela i svih ugniježđenih – spriječi akumulaciju pri ponovnom otvaranju. */
  function clearPanelWidths(panel) {
    if (!panel) return;
    panel.style.width = '';
    panel.style.minWidth = '';
    var nested = panel.querySelectorAll('.alati-meni-test__meni-dropdown, .alati-meni-test__meni-podmeni-tijelo');
    for (var i = 0; i < nested.length; i++) {
      nested[i].style.width = '';
      nested[i].style.minWidth = '';
    }
  }

  /** Postavi širinu panela. Za podmeni-tijelo / dropdown (izvršni hover) flip u rAF. Grace za zatvaranje mora biti postavljen ODMAH pri fromIzvrsniHover – inače mouseleave nakon reflowa zakuca 300 ms timer prije nego rAF stigne postaviti grace. */
  function setPanelWidth(panel, multiplier, opts) {
    opts = opts || {};
    var fromIzvrsniHover = !!opts.fromIzvrsniHover;
    if (!panel || multiplier <= 0) return;
    if (fromIzvrsniHover) {
      flipIzvrsniHoverGraceUntil = Date.now() + FLIP_IZVRSNI_HOVER_CLOSE_DELAY_MS;
    }
    panel.style.width = 'max-content';
    panel.style.minWidth = '0';
    panel.offsetHeight;
    var contentW = panel.scrollWidth;
    var minW = getMeniDropdownMinWidth();
    var w = contentW > 0 ? Math.round(contentW * multiplier) : 0;
    if (w < minW) w = minW;
    if (w > 0) {
      panel.style.width = w + 'px';
      panel.style.minWidth = w + 'px';
    }
    if (panel.classList.contains('alati-meni-test__meni-podmeni-tijelo')) {
      var wVal = w;
      requestAnimationFrame(function () {
        panel.offsetHeight;
        applyPanelFlipBeforeShow(panel, wVal, false);
      });
    } else if (fromIzvrsniHover && panel.classList.contains('alati-meni-test__meni-dropdown')) {
      var wValDrop = w;
      var mainItemEl = panel.closest('.alati-meni-test__meni-main-item');
      requestAnimationFrame(function () {
        panel.offsetHeight;
        if (mainItemEl) applyPanelFlipBeforeShow(panel, mainItemEl, wValDrop, true);
      });
    }
  }

  /** Odluči flip prije prikaza: isDropdown=true za prvi dropdown (parent=mainItem), false za podmeni (parent=podmeni-wrap). */
  function applyPanelFlipBeforeShow(panel, parentOrWidth, widthOrIsDropdown) {
    var viewportW = window.innerWidth || document.documentElement.clientWidth;
    var margin = 32;
    var panelWidth, parent, isDropdown;

    if (typeof parentOrWidth === 'object') {
      parent = parentOrWidth;
      panelWidth = widthOrIsDropdown;
      isDropdown = true;
    } else {
      panelWidth = parentOrWidth;
      parent = panel.parentElement;
      isDropdown = false;
    }

    if (isDropdown) {
      panel.classList.remove('alati-meni-test__meni-dropdown--open-left');
      if (parent && panelWidth > 0) {
        var pr = parent.getBoundingClientRect();
        var predictedRight = pr.left + panelWidth;
        if (predictedRight > viewportW - margin) {
          panel.classList.add('alati-meni-test__meni-dropdown--open-left');
        }
      }
    } else {
      panel.classList.remove('alati-meni-test__meni-podmeni-tijelo--open-left');
      if (panelWidth > 0) {
        var rootDropdown = panel.closest('.alati-meni-test__meni-dropdown');
        var rootDropdownOpenLeft = rootDropdown && rootDropdown.classList.contains('alati-meni-test__meni-dropdown--open-left');
        var ancestorTijeloOpenLeft = panel.parentElement && panel.parentElement.closest('.alati-meni-test__meni-podmeni-tijelo--open-left');
        var firstTijelo = null;
        if (rootDropdown) {
          if (parent && parent.parentElement === rootDropdown) {
            firstTijelo = panel;
          } else {
            var el = panel.parentElement;
            while (el && el !== rootDropdown) {
              if (el.classList && el.classList.contains('alati-meni-test__meni-podmeni-tijelo')) {
                var wrap = el.parentElement;
                if (wrap && wrap.parentElement === rootDropdown) {
                  firstTijelo = el;
                  break;
                }
              }
              el = el.parentElement;
            }
          }
        }
        var firstTijeloRect = firstTijelo ? firstTijelo.getBoundingClientRect() : null;
        var firstNearRight = firstTijeloRect && firstTijeloRect.right > viewportW - 200;
        var isNested = firstTijelo && firstTijelo !== panel;
        var pr = parent ? parent.getBoundingClientRect() : null;
        var predictedRight = pr ? pr.left + pr.width * 0.5 + panelWidth : 0;
        var predictedLeft = pr ? pr.left + pr.width * 0.5 - panelWidth : 0;
        var overflowsRight = predictedRight > viewportW - margin;
        var fitsLeft = predictedLeft >= margin;
        var shouldFlip = rootDropdownOpenLeft || ancestorTijeloOpenLeft || (isNested && firstNearRight) || (overflowsRight && fitsLeft);
        if (shouldFlip) {
          panel.classList.add('alati-meni-test__meni-podmeni-tijelo--open-left');
        }
      }
    }
  }

  /** Zatvori dropdown kad se klikne izvan. */
  function setupDropdownClose() {
    if (window._alatiMeniDropdownClose) return;
    window._alatiMeniDropdownClose = true;
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.alati-meni-test__meni-main-item')) {
        document.querySelectorAll('.alati-meni-test__meni-dropdown--open').forEach(function (d) {
          d.classList.remove('alati-meni-test__meni-dropdown--open');
          clearPanelWidths(d);
        });
        document.querySelectorAll('.alati-meni-test__meni-podmeni--expanded').forEach(function (w) {
          w.classList.remove('alati-meni-test__meni-podmeni--expanded');
        });
      }
    });
  }

  function createIzvrsniButton(naziv, html, putanja, ref) {
    var izv = document.createElement('button');
    izv.type = 'button';
    izv.className = 'alati-meni-test__meni-izvrsni';
    izv.innerHTML = '<span class="alati-meni-test__meni-izvrsni-naziv">' + (naziv || '') + '</span><span class="alati-meni-test__meni-izvrsni-html" style="display:none"> (' + (html || '') + ')</span>';
    izv.dataset.html = html || '';
    izv.dataset.putanja = putanja || '';
    izv.dataset.ref = ref || '';
    izv.addEventListener('click', function () {
      var href = buildIzvrsniHref(putanja, html, true);
      if (href && href !== '#') {
        window.location.href = href;
      }
    });
    var hoverTimer = null;
    function showIzvrsniHtmlWidthImmediate() {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      var span = izv.querySelector('.alati-meni-test__meni-izvrsni-html');
      var panel = izv.closest('.alati-meni-test__meni-podmeni-tijelo') || izv.closest('.alati-meni-test__meni-dropdown');
      if (span) {
        span.style.display = '';
        span.style.visibility = 'hidden';
      }
      if (panel) setPanelWidth(panel, 1, { fromIzvrsniHover: true });
      if (span) span.style.visibility = '';
    }
    izv.addEventListener('mouseenter', function () {
      hoverTimer = setTimeout(showIzvrsniHtmlWidthImmediate, typeof window.vnlhGetMeniHoverDelayPodmeniMs === 'function' ? window.vnlhGetMeniHoverDelayPodmeniMs() : 500);
    });
    izv.addEventListener('mousedown', function () {
      showIzvrsniHtmlWidthImmediate();
    });
    izv.addEventListener('mouseleave', function () {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      var span = izv.querySelector('.alati-meni-test__meni-izvrsni-html');
      if (span) {
        span.style.display = 'none';
        span.style.visibility = '';
      }
    });
    return izv;
  }

  /** Rekurzivno iscrtaj djecu (izvršni ili podmeni s expand/collapse) na bilo kojoj razini. */
  function renderChildren(children, izvrsniTipId, parentEl) {
    if (!children || !children.length) return;
    children.forEach(function (node) {
      var tid = node.meni_tip_id != null ? parseInt(node.meni_tip_id, 10) : 0;
      var html = (node.html_fajl || '').trim();
      var isIzvrsni = (tid === izvrsniTipId && html !== '');
      var hasChildren = node.children && node.children.length > 0;
      if (isIzvrsni) {
        parentEl.appendChild(createIzvrsniButton(node.naziv, html, node.putanja, node.ref));
      } else if (hasChildren) {
        var wrap = document.createElement('div');
        wrap.className = 'alati-meni-test__meni-podmeni-wrap';
        var podmeni = document.createElement('button');
        podmeni.type = 'button';
        podmeni.className = 'alati-meni-test__meni-podmeni';
        podmeni.innerHTML = '<span>' + (node.naziv || '') + '</span><span class="alati-meni-test__meni-podmeni-arrow" aria-hidden="true"></span>';
        var tijelo = document.createElement('div');
        tijelo.className = 'alati-meni-test__meni-podmeni-tijelo';
        renderChildren(node.children, izvrsniTipId, tijelo);
        (function (w, podmeniBtn) {
          var hoverTimer = null;
          var closeTimerWrap = null;
          function expandThisPodmeniTest() {
            hoverTimer = null;
            var parent = w.parentElement;
            if (parent) {
              for (var i = 0; i < parent.children.length; i++) {
                var sib = parent.children[i];
                if (sib.classList && sib.classList.contains('alati-meni-test__meni-podmeni-wrap') && sib !== w) {
                  sib.classList.remove('alati-meni-test__meni-podmeni--expanded');
                  var sibTijelo = sib.querySelector('.alati-meni-test__meni-podmeni-tijelo');
                  if (sibTijelo) clearPanelWidths(sibTijelo);
                }
              }
            }
            w.classList.add('alati-meni-test__meni-podmeni--expanded');
            var tijeloEl = w.querySelector('.alati-meni-test__meni-podmeni-tijelo');
            if (tijeloEl) setPanelWidth(tijeloEl, getMeniDropdownWidthMultiplier());
          }
          w.addEventListener('mouseenter', function () {
            if (closeTimerWrap) {
              clearTimeout(closeTimerWrap);
              closeTimerWrap = null;
            }
            hoverTimer = setTimeout(expandThisPodmeniTest, typeof window.vnlhGetMeniHoverDelayPodmeniMs === 'function' ? window.vnlhGetMeniHoverDelayPodmeniMs() : 500);
          });
          w.addEventListener('mouseleave', function () {
            if (hoverTimer) {
              clearTimeout(hoverTimer);
              hoverTimer = null;
              return;
            }
            if (closeTimerWrap) {
              clearTimeout(closeTimerWrap);
              closeTimerWrap = null;
            }
            var wrapCloseMs = Date.now() < flipIzvrsniHoverGraceUntil ? FLIP_IZVRSNI_HOVER_CLOSE_DELAY_MS : 200;
            closeTimerWrap = setTimeout(function () {
              closeTimerWrap = null;
              w.classList.remove('alati-meni-test__meni-podmeni--expanded');
              var tijeloEl2 = w.querySelector('.alati-meni-test__meni-podmeni-tijelo');
              if (tijeloEl2) clearPanelWidths(tijeloEl2);
            }, wrapCloseMs);
          });
          if (podmeniBtn) {
            podmeniBtn.addEventListener('click', function (e) {
              e.preventDefault();
              if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
              }
              expandThisPodmeniTest();
            });
          }
        })(wrap, podmeni);
        wrap.appendChild(podmeni);
        wrap.appendChild(tijelo);
        parentEl.appendChild(wrap);
      }
    });
  }

  /** Ispiši nekorištene main, izvršne i podmenije u napomenu. Podmeniji: cijelo stablo s ⟶, odvojeno ", " */
  function prikaziNekoristene(nekoristeni) {
    var napomenaEl = document.getElementById('edit_napomena');
    if (!napomenaEl) return;
    var main = [];
    var izvrsni = [];
    var podmeniji = [];
    if (nekoristeni && typeof nekoristeni === 'object') {
      main = Array.isArray(nekoristeni.main) ? nekoristeni.main : [];
      izvrsni = Array.isArray(nekoristeni.izvrsni) ? nekoristeni.izvrsni : [];
      podmeniji = Array.isArray(nekoristeni.podmeniji) ? nekoristeni.podmeniji : [];
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function row(label, items, usePutanja) {
      var txt = items.map(function (x) {
        var p = usePutanja && x.putanja_stabla != null && String(x.putanja_stabla).trim() !== '' ? x.putanja_stabla : (x.naziv || '');
        return esc(p);
      }).filter(Boolean).join(', ') || '—';
      return '<strong>' + esc(label) + '</strong>\n' + txt;
    }
    napomenaEl.innerHTML = row('Ne korišteni Main meniji', main, false) + '\n\n' +
      row('Ne korišteni izvršni moduli', izvrsni, false) + '\n\n' +
      row('Ne korišteni podmeniji', podmeniji, true);
  }

  /** Tipka Osvježi: očisti stanje, dohvati meni, iscrtaj. */
  function initOsvjezi() {
    var btn = document.getElementById('btnOsvjezi');
    if (!btn) return;
    btn.addEventListener('click', function () {
      clearMeniState();
      var device = 0;
      var selDuznosnik = document.getElementById('select_duznosnik');
      var idDuznosnik = selDuznosnik && selDuznosnik.value ? parseInt(selDuznosnik.value, 10) : 0;
      if (isNaN(idDuznosnik)) idDuznosnik = 0;
      // Bez odabranog dužnosnika ne dohvaćaj meni — server bi koristio sesijskog
      // dužnosnika i vratio menije koji ne pripadaju test kontekstu.
      if (idDuznosnik <= 0) return;
      var url = API_BASE + 'meni_dohvat_stabla_menija.php?device=' + encodeURIComponent(device) + '&alati_meni_test_puno_stablo=1';
      url += '&id_duznosnik=' + encodeURIComponent(idDuznosnik);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var text = (xhr.responseText || '').trim();
        var container = document.getElementById('meni_container');
        if (!container) return;
        if (text.charAt(0) === '{' && text.indexOf('"error"') >= 0) {
          try {
            var err = JSON.parse(text);
            if (err.error && typeof MODAL_MESSAGES !== 'undefined' && typeof window.showPorukaModal === 'function') {
              var p = parseResponseCode(err.error);
              if (p && MODAL_MESSAGES[p.code]) window.showPorukaModal(p.code, p.replacements);
            }
          } catch (e) {}
          return;
        }
        try {
          var data = JSON.parse(text);
          var tree = Array.isArray(data) ? data : (data.tree || []);
          var izvrsniTipId = (data && data.izvrsniTipId != null) ? parseInt(data.izvrsniTipId, 10) : null;
          var podmenijiTipId = (data && data.podmenijiTipId != null) ? parseInt(data.podmenijiTipId, 10) : null;
          if (isNaN(izvrsniTipId)) izvrsniTipId = null;
          if (isNaN(podmenijiTipId)) podmenijiTipId = null;
          lastMeniData = { tree: tree, izvrsniTipId: izvrsniTipId };
          setupDropdownClose();
          applyMeniTrakaAlign();
          applyMeniTrakaGradient();
          renderMeni(tree, izvrsniTipId, container);
          syncMeniTrakaRezolucija();
          prikaziNekoristene(data.nekoristeni);
        } catch (e) {}
      };
      xhr.send();
    });
  }

  /** Izgradi href za izvršnu stavku (stvarni URL .php). html_fajl iz API-ja je .html; vidi vnlhHtmlToPhpUrl u 0-Common.js. */
  function buildIzvrsniHref(putanja, htmlFajl, addRef) {
    if (!htmlFajl) return '#';
    var targetFajl = typeof window.vnlhHtmlToPhpUrl === 'function' ? window.vnlhHtmlToPhpUrl(htmlFajl) : htmlFajl;
    var rel = typeof window.vnlhJoinAppRelativePath === 'function'
      ? window.vnlhJoinAppRelativePath(putanja, targetFajl)
      : '';
    if (!rel) return '#';
    var path = typeof window.vnlhBuildMenuTargetHref === 'function'
      ? window.vnlhBuildMenuTargetHref(rel)
      : ('../' + rel);
    if (!path || path === '#') return '#';
    if (addRef) {
      // Uvijek vrati na OVU stranicu (Alati_Meni_Test), ne propuštaj ref iz lanca.
      // vnlhRefZaLinkSljedecaStranica bi propagirala postojeći ?ref=Meni.php pa bi
      // Povratak na ciljnoj formi završio na Meni umjesto ovdje.
      /* Drive-letter putanja (npr. /D:/VNLH WEB/php/Alati_Meni_Test.php) valjana je na HTTP
         serveru; odbacujemo je samo za file: protokol. */
      var returnTo = window.location.pathname || '/php/Alati_Meni_Test.php';
      if (/^\/[A-Za-z]:\//.test(returnTo) && window.location.protocol === 'file:') returnTo = '/php/Alati_Meni_Test.php';
      try {
        var u = new URL(path, window.location.origin);
        u.searchParams.set('ref', returnTo);
        // Proslijedi odabranog dužnosnika iz "Izbor dužnosnika" selecta —
        // ciljne forme (Lista, Clanovi_CRUD, ...) koriste ovaj parametar
        // da dohvate geo ograničenja testiranog dužnosnika umjesto sesijskog.
        var selDuz = document.getElementById('select_duznosnik');
        var idDuz = selDuz ? parseInt(selDuz.value, 10) : 0;
        if (idDuz > 0) u.searchParams.set('id_duznosnik_test', String(idDuz));
        return u.pathname + (u.search || '') + (u.hash || '');
      } catch (e) {}
    }
    return path;
  }

  // persistMeniData / restoreMeniData uklonjene —
  // meni se crta isključivo klikom na "Osvježi meni",
  // nema sessionStorage restauracije pri ponovnom učitavanju stranice.

  /** Hamburger i drawer za uski prikaz – otvaranje/zatvaranje, render drill-down. */
  function initHamburger() {
    var hamburger = document.getElementById('meni_hamburger');
    var overlay = document.getElementById('meni_overlay');
    var drawer = document.getElementById('meni_drawer');
    var dClose = document.getElementById('meni_drawer_close');
    var dBack = document.getElementById('meni_drawer_back');
    var dTitle = document.getElementById('meni_drawer_title');
    var dList = document.getElementById('meni_drawer_list');
    if (!hamburger || !overlay || !drawer || !dClose || !dBack || !dTitle || !dList) return;

    var stack = [{ title: 'Meni', items: null }];

    function esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderDrawerList() {
      var cur = stack[stack.length - 1];
      dTitle.textContent = cur.title;
      dBack.style.visibility = (stack.length > 1) ? 'visible' : 'hidden';

      var items = cur.items;
      if (!items || !items.length) {
        dList.innerHTML = '<p class="alati-meni-test__drawer-empty">Kliknite Osvježi meni za učitavanje.</p>';
        return;
      }

      var izvrsniTipId = lastMeniData.izvrsniTipId;
      var chev = drawer.classList.contains('alati-meni-test__drawer--from-left') ? '\u203A' : '\u2039';
      var html = '';
      items.forEach(function (node) {
        var tid = node.meni_tip_id != null ? parseInt(node.meni_tip_id, 10) : 0;
        var htmlFajl = (node.html_fajl || '').trim().replace(/\\/g, '/');
        var isIzvrsni = (izvrsniTipId != null && tid === izvrsniTipId && htmlFajl !== '');
        var hasChildren = node.children && node.children.length > 0;

        if (isIzvrsni) {
          var putanja = (node.putanja || '').trim().replace(/\\/g, '/');
          var ref = (node.ref || '').trim();
          var href = buildIzvrsniHref(putanja, htmlFajl, true);
          html += '<a class="alati-meni-test__drawer-item alati-meni-test__drawer-item--izvrsni" href="' + esc(href) + '" data-ref="' + esc(ref) + '" data-html="' + esc(htmlFajl) + '"><span class="alati-meni-test__drawer-item-naziv">' + esc(node.naziv) + '</span><span class="alati-meni-test__drawer-item-filename" style="display:none"> (' + esc(htmlFajl) + ')</span></a>';
        } else if (hasChildren) {
          html += '<button type="button" class="alati-meni-test__drawer-item" data-open="' + esc(node.naziv) + '"><span>' + esc(node.naziv) + '</span><span class="alati-meni-test__drawer-chev">' + chev + '</span></button>';
        }
      });
      dList.innerHTML = html;

      dList.querySelectorAll('a.alati-meni-test__drawer-item--izvrsni').forEach(function (a) {
        function toggleFilename(e) {
          if (e) e.preventDefault();
          var fn = a.querySelector('.alati-meni-test__drawer-item-filename');
          var naziv = a.querySelector('.alati-meni-test__drawer-item-naziv');
          if (fn && naziv) {
            if (fn.style.display === 'none') {
              naziv.style.display = 'none';
              fn.style.display = '';
            } else {
              naziv.style.display = '';
              fn.style.display = 'none';
            }
          }
        }
        a.addEventListener('dblclick', function (e) { toggleFilename(e); });
        var lastTap = 0;
        var lastTapTouch = 0;
        var navTimer = null;
        var justDoubleTapped = false;
        a.addEventListener('touchend', function (e) {
          var now = Date.now();
          if (now - lastTapTouch < 400) {
            e.preventDefault();
            justDoubleTapped = true;
            if (navTimer) { clearTimeout(navTimer); navTimer = null; }
            toggleFilename();
            lastTapTouch = 0;
            return;
          }
          lastTapTouch = now;
        }, { passive: false });
        a.addEventListener('click', function (e) {
          if (justDoubleTapped) {
            e.preventDefault();
            justDoubleTapped = false;
            return;
          }
          var now = Date.now();
          if (now - lastTap < 400) {
            e.preventDefault();
            if (navTimer) { clearTimeout(navTimer); navTimer = null; }
            toggleFilename();
            lastTap = 0;
            return;
          }
          lastTap = now;
          navTimer = setTimeout(function () {
            navTimer = null;
            var href = a.getAttribute('href') || '#';
            if (href !== '#') {
              window.location.href = href;
            }
          }, 350);
          e.preventDefault();
        });
      });

      dList.querySelectorAll('button[data-open]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var label = btn.getAttribute('data-open');
          var cur2 = stack[stack.length - 1];
          var found = null;
          if (cur2.items) {
            for (var i = 0; i < cur2.items.length; i++) {
              if (cur2.items[i].naziv === label) {
                found = cur2.items[i];
                break;
              }
            }
          }
          if (found && found.children && found.children.length > 0) {
            stack.push({ title: found.naziv, items: found.children });
            renderDrawerList();
          }
        });
      });
    }

    function openDrawer() {
      stack = [{ title: 'Meni', items: lastMeniData.tree }];
      drawer.classList.add('open');
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      renderDrawerList();
      dClose.focus();
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', openDrawer);
    dClose.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    dBack.addEventListener('click', function () {
      if (stack.length > 1) {
        stack.pop();
        renderDrawerList();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
    });

    var mqMeniUsko = window.matchMedia('(max-width: 640px)');
    function closeDrawerIfMeniSiroko() {
      if (!mqMeniUsko.matches && drawer.classList.contains('open')) closeDrawer();
    }
    if (typeof mqMeniUsko.addEventListener === 'function') {
      mqMeniUsko.addEventListener('change', closeDrawerIfMeniSiroko);
    } else if (typeof mqMeniUsko.addListener === 'function') {
      mqMeniUsko.addListener(closeDrawerIfMeniSiroko);
    }
    window.addEventListener('resize', closeDrawerIfMeniSiroko);
    closeDrawerIfMeniSiroko();
  }

  /**
   * Tipka Povratak: uvijek navigira na php/Meni.php (glavni meni).
   * Ne oslanjamo se na ?ref= parametar jer pozivna stranica (npr. index.php u root folderu)
   * može biti nedostupna direktnim URL-om ovisno o Apache konfiguraciji (Alias/Directory).
   * Koristimo vnlhBuildMenuTargetHref koji uključuje baznu putanju (npr. /D:/VNLH WEB/).
   */
  function initPovratak() {
    var btn = document.getElementById('btnPovratak');
    if (!btn) return;
    btn.addEventListener('click', function () {
      /* Primarni način: centralna funkcija za izgradnju URL-a (ista koju koristi meni). */
      var meniHref = typeof window.vnlhBuildMenuTargetHref === 'function'
        ? window.vnlhBuildMenuTargetHref('php/Meni.php')
        : '';
      if (meniHref && meniHref !== '#') {
        window.location.href = meniHref;
        return;
      }
      /* Fallback s baznom putanjom aplikacije. */
      var base = typeof window.vnlhAppBasePathname === 'function' ? window.vnlhAppBasePathname() : '';
      if (base) {
        window.location.href = (base + '/php/Meni.php').replace(/\/{2,}/g, '/');
      } else {
        window.location.href = new URL('Meni.php', window.location.href).href;
      }
    });
  }

  function init() {
    wireMeniTrakaRezolucija();
    bindSelectToEdit();
    meniTipConfigByVar106 = false;
    applyMeniTipGrupaEnabled(false);
    loadSustavVarijabla106ZaMeniTip();
    // Nema restauracije menija iz sessionStorage — meni se crta isključivo klikom na "Osvježi meni".
    // Čistimo eventualne stare podatke iz prethodne sesije.
    try { sessionStorage.removeItem('alati_meni_test_data'); } catch (e) {}
    loadDuznosnici();
    initUpisi();
    initOsvjezi();
    initPovratak();
    initHamburger();
    applyMeniTrakaAlign();
    applyMeniTrakaGradient();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
