/* =========================================================
   Meni.js
   Glavni izbornik – učitavanje menija odmah, navigacija s ref na Meni.php.
   Bez prikaza HTML fajla (hover/dblclick). Bez tipke Povratak.
   API: meni_dohvat_stabla_menija.php?device=0 — puno stablo; razlika desktop/mobitel (meni.device 1/2) u filterMeniTreeZaViewport.
   na uskom viewportu (<640px) ne prikazuju se stavke samo-desktop (device=1).
   Meni.php postavlja window.__VNLH_MENU_DUZNOSNIK_OK__; ako false, stablo se ne dohvaća (dužnosnik ne postoji u bazi).
   Kašnjenje hovera: sustav_varijable 116 = glavna stavka, 115 = podmeni (0-Common.js). Klik na glavni gumb ili podmeni odmah otvara bez čekanja.
   ========================================================= */

(function () {
  'use strict';

  var API_BASE = '../php/';
  var SESSION_KEY = 'meni_data';

  if (typeof window.vnlhLoadMeniHoverDelaysFromVar116And115 === 'function') {
    window.vnlhLoadMeniHoverDelaysFromVar116And115(API_BASE);
  }

  /** 0=sve uređaje, 1=Meni_CRUD „samo desktop”, 2=„samo mobitel”. Nepoznato → 0. */
  function meniParsirajDeviceStupanj(n) {
    if (!n || n.device == null || n.device === '') return 0;
    var x = parseInt(String(n.device), 10);
    return isNaN(x) ? 0 : x;
  }

  /**
   * Filtrirano stablo za trenutačni prikaz: na mobitelu se ne prikazuje device===1,
   * na desktopu ne device===2 (server šalje sve s device=0).
   */
  function filterMeniTreeZaViewport(tree, izvrsniTipId, isMobile) {
    if (!tree || !tree.length) return [];
    var out = [];
    var i;
    for (i = 0; i < tree.length; i++) {
      var node = tree[i];
      var dSt = meniParsirajDeviceStupanj(node);
      if (isMobile) {
        if (dSt === 1) continue;
      } else {
        if (dSt === 2) continue;
      }
      var tid = node.meni_tip_id != null ? parseInt(node.meni_tip_id, 10) : 0;
      var html = (node.html_fajl || '').trim();
      var isIzvrsni = izvrsniTipId != null && tid === izvrsniTipId && html !== '';
      var copy = Object.assign({}, node);
      copy.children = node.children && node.children.length
        ? filterMeniTreeZaViewport(node.children, izvrsniTipId, isMobile)
        : [];
      if (isIzvrsni) {
        out.push(copy);
      } else if (copy.children && copy.children.length > 0) {
        out.push(copy);
      }
    }
    return out;
  }

  /**
   * Pun odgovor API-ja (bez filtra uređaja) — za ponovno iscrtavanje pri promjeni širine bez novog XHR-a.
   */
  var lastMeniRawTree = null;
  /** Prikazano stablo nakon filtera; izvrsniTipId kao u odgovoru servera. */
  var lastMeniData = { tree: null, izvrsniTipId: null };

  /** Ista granica kao traka/hamburger (.alati-meni-test / data-meni-rezolucija): usko = mobitel. */
  function isMeniViewportUsko() {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  function clearMeniState() {
    var container = document.getElementById('meni_container');
    if (container) container.innerHTML = '';
  }

  /** Usklađuje data-meni-rezolucija s matchMedia (640px) – sprječava istovremeni horizontalni + hamburger. */
  function syncMeniTrakaRezolucija() {
    var traka = document.getElementById('traka_h_menija');
    if (!traka || !traka.classList.contains('alati-meni-test__traka')) return;
    traka.setAttribute('data-meni-rezolucija', window.matchMedia('(max-width: 640px)').matches ? 'ushko' : 'siroko');
  }

  /** Pri promjeni širine: ponovi JS filter nad raw stablom (jedan GET; device=0). */
  var reloadMeniBucketT = null;
  function maybeReloadMeniZaPromjenuUređaja() {
    if (reloadMeniBucketT) {
      clearTimeout(reloadMeniBucketT);
      reloadMeniBucketT = null;
    }
    reloadMeniBucketT = setTimeout(function () {
      reloadMeniBucketT = null;
      if (lastMeniRawTree && lastMeniRawTree.length && lastMeniData && lastMeniData.izvrsniTipId != null) {
        ponoviMeniPripremaIzRawStabla();
      } else {
        loadMeni();
      }
    }, 200);
  }

  function ponoviMeniPripremaIzRawStabla() {
    if (typeof window.__VNLH_MENU_DUZNOSNIK_OK__ === 'boolean' && window.__VNLH_MENU_DUZNOSNIK_OK__ === false) return;
    var container = document.getElementById('meni_container');
    if (!container) return;
    var iz = lastMeniData && lastMeniData.izvrsniTipId != null ? lastMeniData.izvrsniTipId : null;
    if (iz == null) return;
    var filtered = filterMeniTreeZaViewport(lastMeniRawTree, iz, isMeniViewportUsko());
    lastMeniData.tree = filtered;
    clearMeniState();
    setupDropdownClose();
    applyMeniTrakaAlign();
    applyMeniTrakaGradient();
    renderMeni(filtered, iz, container);
    syncMeniTrakaRezolucija();
  }

  function wireMeniTrakaRezolucija() {
    var traka = document.getElementById('traka_h_menija');
    if (!traka) return;
    var mq = window.matchMedia('(max-width: 640px)');
    function onChange() {
      syncMeniTrakaRezolucija();
      maybeReloadMeniZaPromjenuUređaja();
    }
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    window.addEventListener('resize', syncMeniTrakaRezolucija);
    syncMeniTrakaRezolucija();
  }

  function getMeniTrakaAlign() {
    var val = (getComputedStyle(document.documentElement).getPropertyValue('--meni_traka_text_align') || '').trim().toUpperCase();
    return val === 'L' ? 'L' : (val === 'C' ? 'C' : 'R');
  }

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
    if (traka) traka.classList.toggle('alati-meni-test__traka--align-l', val === 'L');
    if (drawer) drawer.classList.toggle('alati-meni-test__drawer--from-left', val === 'L');
  }

  function getMeniDropdownWidthMultiplier() {
    var s = (getComputedStyle(document.documentElement).getPropertyValue('--meni_dropdown_width_multiplier') || '1.5').trim();
    var n = parseFloat(s, 10);
    return isNaN(n) || n <= 0 ? 1.5 : n;
  }

  function getMeniDropdownMinWidth() {
    var s = (getComputedStyle(document.documentElement).getPropertyValue('--meni_dropdown_min_width') || '200').trim();
    var n = parseInt(s, 10);
    return isNaN(n) || n < 0 ? 200 : n;
  }

  function applyMeniTrakaGradient() {
    var val = (getComputedStyle(document.documentElement).getPropertyValue('--meni_traka_gradient_direction') || '').trim().toUpperCase();
    var dir = val === 'V' ? 'to bottom' : 'to right';
    var bg = 'linear-gradient(' + dir + ', var(--meni_traka_bg_1), var(--meni_traka_bg_2))';
    var traka = document.getElementById('traka_h_menija');
    if (traka) traka.style.background = bg;
    var drawerHead = document.querySelector('.alati-meni-test__drawer-head');
    if (drawerHead) drawerHead.style.background = bg;
  }

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

  function setPanelWidth(panel, multiplier) {
    if (!panel || multiplier <= 0) return;
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
    }
  }

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

  function setupDropdownClose() {
    if (window._meniDropdownClose) return;
    window._meniDropdownClose = true;
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

  /** Izgradi href za izvršnu stavku (stvarni URL .php). html_fajl iz API-ja je .html; vidi vnlhHtmlToPhpUrl. */
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
      var returnTo = typeof window.vnlhRefZaLinkSljedecaStranica === 'function'
        ? window.vnlhRefZaLinkSljedecaStranica('/php/Meni.php')
        : (window.location.pathname || '/php/Meni.php');
      try {
        var u = new URL(path, window.location.origin);
        u.searchParams.set('ref', returnTo);
        return u.pathname + (u.search || '') + (u.hash || '');
      } catch (e) {}
    }
    return path;
  }

  /** Izvršni gumb – samo naziv, bez prikaza HTML fajla. */
  function createIzvrsniButton(naziv, html, putanja, ref) {
    var izv = document.createElement('button');
    izv.type = 'button';
    izv.className = 'alati-meni-test__meni-izvrsni';
    izv.innerHTML = '<span class="alati-meni-test__meni-izvrsni-naziv">' + (naziv || '') + '</span>';
    izv.dataset.html = html || '';
    izv.dataset.putanja = putanja || '';
    izv.dataset.ref = ref || '';
    izv.addEventListener('click', function () {
      var href = buildIzvrsniHref(putanja, html, true);
      if (href && href !== '#') {
        persistMeniData();
        window.location.href = href;
      }
    });
    return izv;
  }

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
          function expandThisPodmeni() {
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
            hoverTimer = setTimeout(expandThisPodmeni, typeof window.vnlhGetMeniHoverDelayPodmeniMs === 'function' ? window.vnlhGetMeniHoverDelayPodmeniMs() : 500);
          });
          w.addEventListener('mouseleave', function () {
            if (hoverTimer) {
              clearTimeout(hoverTimer);
              hoverTimer = null;
            } else {
              w.classList.remove('alati-meni-test__meni-podmeni--expanded');
              var tijeloEl2 = w.querySelector('.alati-meni-test__meni-podmeni-tijelo');
              if (tijeloEl2) clearPanelWidths(tijeloEl2);
            }
          });
          if (podmeniBtn) {
            podmeniBtn.addEventListener('click', function (e) {
              e.preventDefault();
              if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
              }
              expandThisPodmeni();
            });
          }
        })(wrap, podmeni);
        wrap.appendChild(podmeni);
        wrap.appendChild(tijelo);
        parentEl.appendChild(wrap);
      }
    });
  }

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
      function openThisMainDropdown() {
        openTimer = null;
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
        applyPanelFlipBeforeShow(dropdown, mainItem, w);
        if (w > 0) {
          dropdown.style.width = w + 'px';
          dropdown.style.minWidth = w + 'px';
        }
        dropdown.style.visibility = '';
      }
      mainItem.addEventListener('mouseenter', function () {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        openTimer = setTimeout(openThisMainDropdown, typeof window.vnlhGetMeniHoverDelayMainMs === 'function' ? window.vnlhGetMeniHoverDelayMainMs() : 300);
      });
      mainItem.addEventListener('mouseleave', function () {
        if (openTimer) { clearTimeout(openTimer); openTimer = null; }
        closeTimer = setTimeout(function () {
          closeTimer = null;
          dropdown.classList.remove('alati-meni-test__meni-dropdown--open');
          clearPanelWidths(dropdown);
        }, 300);
      });
      btn.addEventListener('click', function () {
        if (openTimer) {
          clearTimeout(openTimer);
          openTimer = null;
        }
        openThisMainDropdown();
      });
      mainItem.appendChild(btn);
      mainItem.appendChild(dropdown);
      horizontal.appendChild(mainItem);
    });
    container.appendChild(horizontal);
  }

  function persistMeniData() {
    try {
      if (lastMeniData.tree && lastMeniData.izvrsniTipId != null) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(lastMeniData));
      }
    } catch (e) {}
  }

  function restoreMeniData() {
    try {
      var s = sessionStorage.getItem(SESSION_KEY);
      if (s) {
        var d = JSON.parse(s);
        if (d && (d.tree || d.izvrsniTipId != null)) {
          lastMeniData = { tree: d.tree || null, izvrsniTipId: d.izvrsniTipId != null ? d.izvrsniTipId : null };
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  /** Učitaj meni odmah pri load-u. */
  function loadMeni() {
    clearMeniState();
    if (typeof window.__VNLH_MENU_DUZNOSNIK_OK__ === 'boolean' && window.__VNLH_MENU_DUZNOSNIK_OK__ === false) {
      lastMeniData = { tree: null, izvrsniTipId: null };
      lastMeniRawTree = null;
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch (e) {}
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'meni_dohvat_stabla_menija.php?device=' + encodeURIComponent(0) + '&from_meni=1&_=' + Date.now(), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var container = document.getElementById('meni_container');
      if (!container) return;
      if (text.charAt(0) === '{' && text.indexOf('"error"') >= 0) {
        try {
          var err = JSON.parse(text);
          if (err.error && typeof MODAL_MESSAGES !== 'undefined' && typeof window.showPorukaModal === 'function') {
            var res = (err.error || '').trim();
            var idx = res.indexOf(',');
            var code = idx < 0 ? res : res.slice(0, idx).trim();
            var replacements = idx < 0 ? [] : [res.slice(idx + 1).trim()];
            if (MODAL_MESSAGES[code]) window.showPorukaModal(code, replacements);
          }
        } catch (e) {}
        lastMeniRawTree = null;
        return;
      }
      try {
        var data = JSON.parse(text);
        var rawTree = Array.isArray(data) ? data : (data.tree || []);
        lastMeniRawTree = rawTree;
        var izvrsniTipId = (data && data.izvrsniTipId != null) ? parseInt(data.izvrsniTipId, 10) : null;
        if (isNaN(izvrsniTipId)) izvrsniTipId = null;
        var filtered =
          izvrsniTipId != null ? filterMeniTreeZaViewport(rawTree, izvrsniTipId, isMeniViewportUsko()) : rawTree;
        lastMeniData = { tree: filtered, izvrsniTipId: izvrsniTipId };
        setupDropdownClose();
        applyMeniTrakaAlign();
        applyMeniTrakaGradient();
        renderMeni(filtered, izvrsniTipId, container);
        syncMeniTrakaRezolucija();
      } catch (e) {}
    };
    xhr.send();
  }

  function initHamburger() {
    var hamburger = document.getElementById('meni_hamburger');
    var overlay = document.getElementById('meni_overlay');
    var drawer = document.getElementById('meni_drawer');
    var dClose = document.getElementById('meni_drawer_close');
    var dBack = document.getElementById('meni_drawer_back');
    var dTitle = document.getElementById('meni_drawer_title');
    var dList = document.getElementById('meni_drawer_list');
    if (!hamburger || !overlay || !drawer || !dClose || !dBack || !dTitle || !dList) return;

    var stack = [{ title: 'Glavni izbornik', items: null }];

    function esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderDrawerList() {
      var cur = stack[stack.length - 1];
      dTitle.textContent = cur.title;
      dBack.style.visibility = (stack.length > 1) ? 'visible' : 'hidden';

      var items = cur.items;
      if (!items || !items.length) {
        dList.innerHTML = '<p class="alati-meni-test__drawer-empty">Nema stavki u meniju.</p>';
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
          var href = buildIzvrsniHref(putanja, htmlFajl, true);
          html += '<a class="alati-meni-test__drawer-item alati-meni-test__drawer-item--izvrsni" href="' + esc(href) + '">' + esc(node.naziv) + '</a>';
        } else if (hasChildren) {
          html += '<button type="button" class="alati-meni-test__drawer-item" data-open="' + esc(node.naziv) + '"><span>' + esc(node.naziv) + '</span><span class="alati-meni-test__drawer-chev">' + chev + '</span></button>';
        }
      });
      dList.innerHTML = html;

      dList.querySelectorAll('a.alati-meni-test__drawer-item--izvrsni').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var href = a.getAttribute('href') || '#';
          if (href !== '#') {
            e.preventDefault();
            persistMeniData();
            window.location.href = href;
          }
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
      stack = [{ title: 'Glavni izbornik', items: lastMeniData.tree }];
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

    /* Iznad 640px širine: zatvori drawer (bez jaza 640–641 – sve što nije max-width 640). */
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

  function init() {
    wireMeniTrakaRezolucija();
    loadMeni();
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
