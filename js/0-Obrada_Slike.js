/* =========================================================
   0-Obrada_Slike.js
   Modal za obradu slike: učitaj, selekcija, crop, undo, kompresija, spremi.
   Uključiti samo u formama koje koriste obradu slike.
   Init: ObradaSlikaInit({ idPrefix, getSelectedId, apiBase, imageUrlPath, uploadPath, imageAreaId, imageAreaDisabledClass, onUploadSuccess [, parseResponseCode] })
   imagePreviewElement: referenca na <img> u edit formi (okvir za sliku); pri Spremi slika se prenosi u njega.
   Ako želiš učitati markup iz datoteke: templateUrl, mountSelector.
   Kratko ime (npr. 0-Obrada_Slike.php) automatski se mapira na php/ preko putanje ove skripte.
   ========================================================= */
(function () {
  'use strict';

  function trim(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  /**
   * fetch('0-Obrada_Slike.php') s html/*.html pogađa nepostojeći html/0-Obrada_Slike.php.
   * Iz .../js/0-Obrada_Slike.js gradi .../php/0-Obrada_Slike.php. Eksplicitni ../php/ ili URL ostaju.
   */
  function resolveObradaSlikaTemplateUrl(url) {
    var u = trim(url);
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.charAt(0) === '/') return u;
    if (/^\.\.?\//.test(u)) return u;
    try {
      var nodes = document.querySelectorAll('script[src*="0-Obrada_Slike.js"]');
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

  window.ObradaSlikaInit = function (options) {
    if (!options || !options.idPrefix) return;
    var idPrefix = options.idPrefix;
    var getSelectedId = typeof options.getSelectedId === 'function' ? options.getSelectedId : function () { return null; };
    var apiBase = options.apiBase != null ? String(options.apiBase) : '';
    var imageUrlPath = options.imageUrlPath != null ? String(options.imageUrlPath) : '';
    var uploadPath = options.uploadPath != null ? String(options.uploadPath) : '';
    var imageAreaId = options.imageAreaId || '';
    var imageAreaDisabledClass = options.imageAreaDisabledClass || '';
    var onUploadSuccess = typeof options.onUploadSuccess === 'function' ? options.onUploadSuccess : function () {};
    var parseResponseCode = typeof options.parseResponseCode === 'function' ? options.parseResponseCode : function () { return null; };
    var imagePreviewElement = options.imagePreviewElement && options.imagePreviewElement.nodeName === 'IMG' ? options.imagePreviewElement : null;
    var getEditFormRowId = typeof options.getEditFormRowId === 'function' ? options.getEditFormRowId : null;
    var focusAfterCloseId = options.focusAfterCloseId != null ? String(options.focusAfterCloseId) : '';
    var templateUrl = options.templateUrl != null ? String(options.templateUrl) : '';
    templateUrl = resolveObradaSlikaTemplateUrl(templateUrl);
    var mountSelector = options.mountSelector || '';
    var fixedRatioX = options.fixedRatioX != null ? parseFloat(options.fixedRatioX) : NaN;
    var fixedRatioY = options.fixedRatioY != null ? parseFloat(options.fixedRatioY) : NaN;
    var ratioInputsDisabled = options.ratioInputsDisabled === true;
    var enableRoundThumb = options.enableRoundThumb === true;
    /* Dozvoljeni format(i) pri učitavanju: funkcija → 'jpg'|'png'|'webp' ili niz; bez nje = staro ponašanje (jpg+png). */
    var dozvoljeniFormatiFn = typeof options.dozvoljeniFormati === 'function' ? options.dozvoljeniFormati : null;
    var porukaFormatKod = options.porukaFormatKod != null ? String(options.porukaFormatKod) : '011';
    /* Bez ograničenja veličine: Spremi se ne gasi zbog KB, nema "preko" indikatora (npr. SST forma – o veličini brine admin). */
    var neogranicenaVelicina = options.neogranicenaVelicina === true;

    /* Tablica podržanih formata: accept (file picker), mime varijante i provjera magic bytes. */
    var OBRADA_FORMATI = {
      jpg:  { accept: 'image/jpeg,.jpg,.jpeg', mimes: ['image/jpeg', 'image/jpg'],
              magic: function (b) { return b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF; } },
      png:  { accept: 'image/png,.png', mimes: ['image/png'],
              magic: function (b) { return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A; } },
      webp: { accept: 'image/webp,.webp', mimes: ['image/webp'],
              magic: function (b) { return b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; } }
    };
    function obradaDozvoljeniFormati() {
      var r = null;
      if (dozvoljeniFormatiFn) { try { r = dozvoljeniFormatiFn(); } catch (e) { r = null; } }
      if (typeof r === 'string') r = [r];
      if (!r || !r.length) r = ['jpg', 'png'];
      return r.filter(function (k) { return OBRADA_FORMATI[k]; });
    }
    function obradaPostaviAccept(inp) {
      if (!inp || !dozvoljeniFormatiFn) return;   /* accept mijenjamo samo ako je format eksplicitno zadan */
      var acc = obradaDozvoljeniFormati().map(function (k) { return OBRADA_FORMATI[k].accept; }).join(',');
      if (acc) inp.accept = acc;
    }
    function obradaMimeOk(mime) {
      mime = (mime || '').toLowerCase();
      return obradaDozvoljeniFormati().some(function (k) { return OBRADA_FORMATI[k].mimes.indexOf(mime) >= 0; });
    }
    function obradaMagicOk(bytes) {
      return obradaDozvoljeniFormati().some(function (k) { return OBRADA_FORMATI[k].magic(bytes); });
    }
    function obradaPrikaziGreskuFormat() {
      if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[porukaFormatKod] && typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(porukaFormatKod, [], null);
      }
    }

    function doInit() {
    function id(suffix) { return document.getElementById(idPrefix + suffix); }

    var lastValidRatioX = 1;
    var lastValidRatioY = 1;
      var RATIO_MAX = 5;
      var savedModalState = null;
      var selection = null;
      var undoState = null;
      var roundEnabled = false;
      var roundActive = false;
      var roundOffset = 0; /* -1..1, vertikalni pomak kružnog isječka */
      var roundRadiusPct = 50; /* radijus kruga u % širine kontrole */

    function formatFileSize(bytes) {
      if (bytes == null || isNaN(bytes) || bytes < 0) return '';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function fileTypeToExtension(type) {
      if (!type || typeof type !== 'string') return '';
      var t = type.toLowerCase();
      if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg';
      if (t === 'image/png') return 'png';
      if (t === 'image/gif') return 'gif';
      if (t === 'image/webp') return 'webp';
      if (t.indexOf('image/') === 0) return t.slice(6);
      return '';
    }

    function getMaxKb() {
      if (neogranicenaVelicina) return Infinity;
      var val = null;
      try { val = getComputedStyle(document.documentElement).getPropertyValue('--slika_obrada_max_kb'); } catch (e) {}
      val = val != null ? trim(val) : '';
      var num = parseInt(val, 10);
      return isNaN(num) || num < 0 ? 200 : num;
    }

    function getCompressMaxPx() {
      var val = null;
      try { val = getComputedStyle(document.documentElement).getPropertyValue('--slika_obrada_compress_max_px'); } catch (e) {}
      val = val != null ? trim(val) : '';
      var num = parseInt(val, 10);
      return isNaN(num) || num < 1 ? 1024 : num;
    }

    function getCompressQuality() {
      var val = null;
      try { val = getComputedStyle(document.documentElement).getPropertyValue('--slika_obrada_compress_quality'); } catch (e) {}
      val = val != null ? trim(val) : '';
      var num = parseFloat(val);
      return isNaN(num) || num < 0 || num > 1 ? 0.75 : num;
    }

    function parseRatioValue(val) {
      if (val == null || typeof val !== 'string') return NaN;
      return parseFloat(String(val).trim().replace(',', '.'));
    }

    function updateFileinfo(file) {
      var el = id('_fileinfo');
      if (el) el.textContent = file && file.name != null ? file.name : '';
    }

    function updateTipVelicina(file) {
      var elTip = id('_tip');
      var elVelicina = id('_velicina');
      var metaEl = id('_header_meta');
      if (!file) {
        if (elTip) elTip.textContent = '';
        if (elVelicina) {
          elVelicina.textContent = '';
          elVelicina.classList.remove('obrada-slika__velicina--preko');
        }
        if (metaEl) metaEl.setAttribute('aria-hidden', 'true');
        updateSpremiButton(null);
        roundEnabled = false;
        roundActive = false;
        updateRoundButton();
        return;
      }
      if (metaEl) metaEl.setAttribute('aria-hidden', 'false');
      var tip = fileTypeToExtension(file.type) || (file.name ? file.name.split('.').pop() : '');
      if (elTip) elTip.textContent = tip;
      if (elVelicina) {
        elVelicina.textContent = formatFileSize(file.size);
        var maxBytes = getMaxKb() * 1024;
        elVelicina.classList.toggle('obrada-slika__velicina--preko', file.size > maxBytes);
      }
      updateSpremiButton(file);
      var maxBytes2 = getMaxKb() * 1024;
      roundEnabled = !!(file && typeof file.size === 'number' && file.size <= maxBytes2);
      if (!roundEnabled) {
        roundActive = false;
      }
      updateRoundButton();
    }

    /** Selekcija i Obriši: disable ako nema slike u modalu, enable kada postoji slika. */
    function updateToolbarSlikaDependentButtons() {
      var img = id('_img');
      var btnSelekcija = id('_ikona_selekcija');
      var btnObrisi = id('_ikona_obrisi');
      var hasImage = !!(img && img.src && img.src.length > 0);
      if (btnSelekcija) btnSelekcija.disabled = !hasImage;
      if (btnObrisi) btnObrisi.disabled = !hasImage;
    }

    function updateRoundButton() {
      var btn = id('_ikona_round');
      if (!btn) return;
      if (!enableRoundThumb) {
        btn.disabled = true;
        return;
      }
      btn.disabled = !roundEnabled;
      btn.classList.toggle('obrada-slika__toolbar-btn--active', !!roundActive);
    }

    function updateSpremiButton(file) {
      var btn = id('_spremi');
      if (!btn) return;
      if (!file) {
        var img = id('_img');
        var hasImage = img && img.src && img.src.length > 0;
        btn.disabled = !hasImage;
        return;
      }
      btn.disabled = file.size > getMaxKb() * 1024;
    }

    function applyRatio() {
      var wrap = id('_preview_wrap');
      var inputX = id('_ratio_x');
      var inputY = id('_ratio_y');
      if (!wrap || !inputX || !inputY) return;
      var x = parseRatioValue(inputX.value);
      var y = parseRatioValue(inputY.value);
      if (isNaN(x) || isNaN(y) || x <= 0 || y <= 0) {
        inputX.value = String(lastValidRatioX);
        inputY.value = String(lastValidRatioY);
        wrap.style.aspectRatio = lastValidRatioX + ' / ' + lastValidRatioY;
        return;
      }
      var ratio = x / y;
      if (ratio < 1 / RATIO_MAX || ratio > RATIO_MAX) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['007'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('007', [], null);
        }
        inputX.value = String(lastValidRatioX);
        inputY.value = String(lastValidRatioY);
        wrap.style.aspectRatio = lastValidRatioX + ' / ' + lastValidRatioY;
        return;
      }
      lastValidRatioX = x;
      lastValidRatioY = y;
      wrap.style.aspectRatio = x + ' / ' + y;
    }

    function hideSelectionOverlay() {
      var overlay = id('_selection_overlay');
      if (overlay) overlay.setAttribute('aria-hidden', 'true');
      updateCropButton();
    }

    function showSelectionOverlay() {
      var overlay = id('_selection_overlay');
      var box = id('_selection_box');
      if (!overlay || !box) return;
      var size = 0.8;
      var left = (1 - size) / 2;
      var top = (1 - size) / 2;
      selection = { left: left, top: top, width: size, height: size };
      applySelectionBox();
      overlay.setAttribute('aria-hidden', 'false');
      updateCropButton();
    }

    var SELECTION_MAX = 0.99;

    function applySelectionBox() {
      var box = id('_selection_box');
      var overlay = id('_selection_overlay');
      if (!box || !selection) return;
      var l = selection.left, t = selection.top, w = selection.width, h = selection.height;
      w = Math.min(w, SELECTION_MAX);
      h = Math.min(h, SELECTION_MAX);
      if (l + w > 1) l = 1 - w;
      if (t + h > 1) t = 1 - h;
      l = Math.max(0, l);
      t = Math.max(0, t);
      box.style.left = (l * 100) + '%';
      box.style.top = (t * 100) + '%';
      box.style.width = (w * 100) + '%';
      box.style.height = (h * 100) + '%';
      var dimTop = id('_selection_dim_top');
      var dimLeft = id('_selection_dim_left');
      var dimRight = id('_selection_dim_right');
      var dimBottom = id('_selection_dim_bottom');
      if (dimTop && dimLeft && dimRight && dimBottom) {
        dimTop.style.left = '0'; dimTop.style.top = '0'; dimTop.style.width = '100%'; dimTop.style.height = (t * 100) + '%';
        dimBottom.style.left = '0'; dimBottom.style.top = ((t + h) * 100) + '%'; dimBottom.style.width = '100%'; dimBottom.style.height = ((1 - t - h) * 100) + '%';
        dimLeft.style.left = '0'; dimLeft.style.top = (t * 100) + '%'; dimLeft.style.width = (l * 100) + '%'; dimLeft.style.height = (h * 100) + '%';
        dimRight.style.left = ((l + w) * 100) + '%'; dimRight.style.top = (t * 100) + '%'; dimRight.style.width = ((1 - l - w) * 100) + '%'; dimRight.style.height = (h * 100) + '%';
      }
    }

    function updateUndoButton() {
      var btn = id('_ikona_undo');
      if (btn) btn.disabled = !undoState;
    }

    function updateCompressButton(enable) {
      var btn = id('_ikona_compress');
      if (btn) btn.disabled = !enable;
    }

    function updateCropButton() {
      var btn = id('_ikona_crop');
      if (!btn) return;
      var img = id('_img');
      var ov = id('_selection_overlay');
      var hasImage = img && img.src;
      var hasSelection = ov && ov.getAttribute('aria-hidden') === 'false' && selection;
      btn.disabled = !hasImage || !hasSelection;
    }

    function saveUndoState() {
      var modalImg = id('_img');
      var fileInput = id('_file');
      if (!modalImg || !modalImg.src) {
        if (undoState && undoState.objectURL) URL.revokeObjectURL(undoState.objectURL);
        undoState = null;
        updateUndoButton();
        return;
      }
      if (undoState && undoState.objectURL) URL.revokeObjectURL(undoState.objectURL);
      var file = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
      undoState = { src: modalImg.src, objectURL: modalImg._slikaObradaObjectURL || null, mimeType: modalImg._slikaObradaMimeType || null, file: file };
      updateUndoButton();
    }

    function openModal() {
      var modal = id('');
      var sadrzaj = id('_sadrzaj');
      var modalImg = id('_img');
      var fileInput = id('_file');
      var btnSpremi = id('_spremi');
      if (!modal || !sadrzaj || !modalImg || !fileInput || !btnSpremi) return;
      var dialog = modal.querySelector('.obrada-slika__dialog');
      var inputX = id('_ratio_x');
      var inputY = id('_ratio_y');
      if (dialog && savedModalState) {
        dialog.style.width = savedModalState.width + 'px';
        dialog.style.height = savedModalState.height + 'px';
        if (savedModalState.left != null && savedModalState.top != null) {
          dialog.style.position = 'fixed';
          dialog.style.margin = '0';
          dialog.style.left = savedModalState.left + 'px';
          dialog.style.top = savedModalState.top + 'px';
        }
      }
      if (inputX && inputY) {
        if (!isNaN(fixedRatioX) && !isNaN(fixedRatioY) && fixedRatioX > 0 && fixedRatioY > 0) {
          lastValidRatioX = fixedRatioX;
          lastValidRatioY = fixedRatioY;
          inputX.value = String(fixedRatioX);
          inputY.value = String(fixedRatioY);
          if (ratioInputsDisabled) {
            /* Zaključani omjer → jedinstveni RO mehanizam (plavi izgled + inertno + native readonly). */
            if (typeof KontroleSetControlReadonly === 'function') {
              KontroleSetControlReadonly(inputX, true);
              KontroleSetControlReadonly(inputY, true);
            } else {
              inputX.readOnly = true;
              inputY.readOnly = true;
              inputX.setAttribute('readonly', 'readonly');
              inputY.setAttribute('readonly', 'readonly');
            }
          }
        } else if (savedModalState && savedModalState.ratioX != null && savedModalState.ratioY != null) {
          inputX.value = savedModalState.ratioX;
          inputY.value = savedModalState.ratioY;
          var sx = parseRatioValue(savedModalState.ratioX);
          var sy = parseRatioValue(savedModalState.ratioY);
          if (!isNaN(sx) && !isNaN(sy) && sx > 0 && sy > 0) {
            var r = sx / sy;
            if (r >= 1 / RATIO_MAX && r <= RATIO_MAX) { lastValidRatioX = sx; lastValidRatioY = sy; }
          }
        } else {
          inputX.value = '1'; inputY.value = '1';
          lastValidRatioX = 1; lastValidRatioY = 1;
        }
      }
      if (modalImg._slikaObradaObjectURL) {
        URL.revokeObjectURL(modalImg._slikaObradaObjectURL);
        modalImg._slikaObradaObjectURL = null;
      }
      modalImg.style.clipPath = '';
      modalImg.style.borderRadius = '';
      roundEnabled = false;
      roundActive = false;
      /* roundOffset: čitaj iz px formata (_obradaSlikaRoundOffsetPx + _obradaSlikaRoundOffsetHeight) ili stari fraction format. px > 0 = iznad sredine, px < 0 = ispod */
      var px = imagePreviewElement && typeof imagePreviewElement._obradaSlikaRoundOffsetPx === 'number' ? imagePreviewElement._obradaSlikaRoundOffsetPx : null;
      var hAtSave = imagePreviewElement && typeof imagePreviewElement._obradaSlikaRoundOffsetHeight === 'number' ? imagePreviewElement._obradaSlikaRoundOffsetHeight : 0;
      if (px != null && hAtSave > 0) {
        roundOffset = -2 * px / hAtSave;
        roundOffset = Math.max(-1, Math.min(1, roundOffset));
      } else {
        roundOffset = (imagePreviewElement && typeof imagePreviewElement._obradaSlikaRoundOffset === 'number') ? imagePreviewElement._obradaSlikaRoundOffset : 0;
      }
      if (imagePreviewElement) {
        roundActive = !!imagePreviewElement._obradaSlikaRoundActive;
      }
      updateRoundButton();
      updateFileinfo(null);
      updateTipVelicina(null);
      fileInput.value = '';
      /* Prvo pojavljivanje: na malom uređaju 10px uži od prostora, centrirano; inače fiksna veličina */
      if (!savedModalState && dialog) {
        var smallDevice = typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
        if (smallDevice && typeof window !== 'undefined' && window.innerWidth > 0) {
          var availW = window.innerWidth - 10;
          var availH = window.innerHeight - 40;
          var w = Math.max(280, availW);
          var h = Math.max(480, Math.min(availH, 600));
          dialog.style.minWidth = '280px';
          dialog.style.width = w + 'px';
          dialog.style.height = h + 'px';
          dialog.style.position = 'fixed';
          dialog.style.margin = '0';
          dialog.style.left = '5px';
          dialog.style.top = (Math.max(0, (window.innerHeight - h) / 2)) + 'px';
        } else {
          dialog.style.width = '420px';
          dialog.style.height = '500px';
        }
      }
      /* Modal puni se samo iz okvira u formi (imagePreviewElement), ne s servera */
      modalImg.onerror = function () {
        modalImg.removeAttribute('src');
        modalImg.alt = '';
        modalImg.onerror = null;
        btnSpremi.disabled = true;
        updateFileinfo(null);
        updateTipVelicina(null);
        updateCompressButton(false);
        updateToolbarSlikaDependentButtons();
      };
      if (imagePreviewElement && imagePreviewElement.src) {
        modalImg.src = imagePreviewElement.src;
        modalImg.alt = imagePreviewElement.alt || '';
        btnSpremi.disabled = false;
        updateCompressButton(true);
        /* Tip i veličina fajla (KB/MB): za blob dohvatimo blob.size i blob.type */
        var src = imagePreviewElement.src;
        if (src && src.indexOf('blob:') === 0 && typeof fetch === 'function') {
          fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
            if (blob && typeof blob.size === 'number') {
              updateTipVelicina({ type: blob.type || '', size: blob.size });
            } else {
              var metaEl = id('_header_meta');
              if (metaEl) metaEl.setAttribute('aria-hidden', 'false');
            }
          }).catch(function () {
            var metaEl = id('_header_meta');
            if (metaEl) metaEl.setAttribute('aria-hidden', 'false');
          });
        } else {
          var metaEl = id('_header_meta');
          if (metaEl) metaEl.setAttribute('aria-hidden', 'false');
        }
      } else {
        modalImg.removeAttribute('src');
        modalImg.alt = '';
        btnSpremi.disabled = true;
        updateCompressButton(false);
      }
      updateToolbarSlikaDependentButtons();
      applyRatio();
      hideSelectionOverlay();
      undoState = null;
      updateUndoButton();
      if (modal._obradaSlikaKeyHandler) {
        document.removeEventListener('keydown', modal._obradaSlikaKeyHandler);
        modal._obradaSlikaKeyHandler = null;
      }
      modal._obradaSlikaKeyHandler = null;
      modal.style.display = '';
      modal.style.visibility = '';
      var overlayEl = modal.querySelector('.kontrola-modal__overlay');
      if (overlayEl) {
        overlayEl.style.opacity = '';
        overlayEl.style.pointerEvents = '';
      }
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('kontrola-modal--open');
      /* Ako je roundActive vraćen iz imagePreviewElement, primijeni clip nakon layouta */
      if (enableRoundThumb && roundActive) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            var img = id('_img');
            var wrap = id('_preview_wrap');
            if (img && wrap && wrap.getBoundingClientRect) {
              var rect = wrap.getBoundingClientRect();
              var w = rect.width || 1;
              var h = rect.height || 1;
              var radiusPx = Math.min(w, h) / 2;
              var radiusPct = (radiusPx / Math.max(w, h)) * 100;
              roundRadiusPct = radiusPct;
              var minCy = (radiusPx / h) * 100;
              var maxCy = 100 - minCy;
              var midCy = (minCy + maxCy) / 2;
              var cyBase = midCy + roundOffset * ((maxCy - minCy) / 2);
              var cy = Math.max(minCy, Math.min(maxCy, cyBase));
              img.style.clipPath = 'circle(' + radiusPct + '% at 50% ' + cy + '%)';
              img.style.borderRadius = '';
            }
            updateRoundButton();
          });
        });
      }
    }

    function closeModal() {
      var modal = id('');
      if (!modal) return;
      var overlayEl = modal ? modal.querySelector('.kontrola-modal__overlay') : null;
      if (overlayEl) {
        overlayEl.style.opacity = '0';
        overlayEl.style.pointerEvents = 'none';
      }
      hideSelectionOverlay();
      var dialog = modal.querySelector('.obrada-slika__dialog');
      var inputX = id('_ratio_x');
      var inputY = id('_ratio_y');
      /* Snimi samo ako je modal još vidljiv – inače je već spremljeno u onSpremiClick (prije display:none) */
      if (dialog && dialog.offsetWidth > 0 && dialog.offsetHeight > 0) {
        var rect = dialog.getBoundingClientRect();
        savedModalState = {
          width: dialog.offsetWidth,
          height: dialog.offsetHeight,
          ratioX: inputX && inputX.value != null ? String(inputX.value).trim() : String(lastValidRatioX),
          ratioY: inputY && inputY.value != null ? String(inputY.value).trim() : String(lastValidRatioY),
          left: rect.left,
          top: rect.top
        };
      }
      if (modal._obradaSlikaKeyHandler) {
        document.removeEventListener('keydown', modal._obradaSlikaKeyHandler);
        modal._obradaSlikaKeyHandler = null;
      }
      var modalImg = id('_img');
      if (modalImg && modalImg._slikaObradaObjectURL) {
        URL.revokeObjectURL(modalImg._slikaObradaObjectURL);
        modalImg._slikaObradaObjectURL = null;
      }
      if (undoState && undoState.objectURL) {
        URL.revokeObjectURL(undoState.objectURL);
        undoState = null;
      }
      /* Prebaci fokus na kontrolu u formi da blur nestane */
      var focusTarget = focusAfterCloseId ? document.getElementById(focusAfterCloseId) : null;
      if (document.activeElement && modal.contains(document.activeElement)) {
        if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
        else if (typeof document.activeElement.blur === 'function') document.activeElement.blur();
      }
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('kontrola-modal--open');
    }

    function setupSelectionBoxDrag() {
      var box = id('_selection_box');
      var resizeHandle = id('_selection_resize');
      var overlay = id('_selection_overlay');
      var wrap = id('_preview_wrap');
      if (!box || !overlay || !wrap) return;
      var startX = 0, startY = 0, startSel = null;
      var minSize = 0.05;

      function getClientXY(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
      }
      function moveDragWithXY(clientX, clientY) {
        if (!startSel || !selection) return;
        var r = wrap.getBoundingClientRect();
        var dx = (clientX - startX) / r.width;
        var dy = (clientY - startY) / r.height;
        var l = Math.max(0, Math.min(1 - startSel.width, startSel.left + dx));
        var t = Math.max(0, Math.min(1 - startSel.height, startSel.top + dy));
        selection = { left: l, top: t, width: startSel.width, height: startSel.height };
        applySelectionBox();
      }
      function moveDrag(e) {
        var xy = getClientXY(e);
        moveDragWithXY(xy.x, xy.y);
      }
      function resizeDrag(e) {
        if (!startSel || !selection) return;
        var r = wrap.getBoundingClientRect();
        var xy = getClientXY(e);
        var px = (xy.x - r.left) / r.width;
        var py = (xy.y - r.top) / r.height;
        var w = Math.max(minSize, Math.min(1 - startSel.left, px - startSel.left));
        var h = Math.max(minSize, Math.min(1 - startSel.top, py - startSel.top));
        var size = Math.max(minSize, Math.min(1 - startSel.left, 1 - startSel.top, Math.min(w, h)));
        selection = { left: startSel.left, top: startSel.top, width: size, height: size };
        applySelectionBox();
      }
      function up() {
        document.removeEventListener('mousemove', moveDrag);
        document.removeEventListener('mousemove', resizeDrag);
        document.removeEventListener('mouseup', up);
      }

      box.addEventListener('mousedown', function (e) {
        if (e.target === resizeHandle) return;
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startSel = selection ? { left: selection.left, top: selection.top, width: selection.width, height: selection.height } : null;
        if (!startSel) return;
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('mouseup', up);
      });
      if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', function (e) {
          e.preventDefault();
          e.stopPropagation();
          startSel = selection ? { left: selection.left, top: selection.top, width: selection.width, height: selection.height } : null;
          if (!startSel) return;
          document.addEventListener('mousemove', resizeDrag);
          document.addEventListener('mouseup', up);
        });
      }

      /* Touch: jedan prst = pomicanje selekcije, dva prsta = pinch resize (omjer se zadržava) */
      function touchDistance(touches) {
        if (!touches || touches.length < 2) return 0;
        var a = touches[0], b = touches[1];
        return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      }
      function touchCenter(touches) {
        if (!touches || touches.length < 2) return { x: 0, y: 0 };
        return { x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 };
      }
      var pinchStartDist = 0, pinchStartSel = null;

      overlay.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2 && selection) e.preventDefault();
        if (e.touches.length === 1) {
          if (!selection) return;
          startSel = { left: selection.left, top: selection.top, width: selection.width, height: selection.height };
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          function onTouchMove(ev) {
            if (ev.touches.length !== 1) return;
            ev.preventDefault();
            moveDragWithXY(ev.touches[0].clientX, ev.touches[0].clientY);
          }
          function onTouchEnd() {
            document.removeEventListener('touchmove', onTouchMove, { capture: true });
            document.removeEventListener('touchend', onTouchEnd);
            document.removeEventListener('touchcancel', onTouchEnd);
          }
          document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
          document.addEventListener('touchend', onTouchEnd);
          document.addEventListener('touchcancel', onTouchEnd);
        } else if (e.touches.length === 2 && selection) {
          e.preventDefault();
          pinchStartDist = touchDistance(e.touches);
          pinchStartSel = { left: selection.left, top: selection.top, width: selection.width, height: selection.height };
          function onPinchMove(ev) {
            if (ev.touches.length !== 2) return;
            ev.preventDefault();
            var dist = touchDistance(ev.touches);
            if (pinchStartDist <= 0) return;
            var scale = dist / pinchStartDist;
            var cx = pinchStartSel.left + pinchStartSel.width / 2;
            var cy = pinchStartSel.top + pinchStartSel.height / 2;
            var newSize = Math.max(minSize, Math.min(1, pinchStartSel.width * scale));
            var left = cx - newSize / 2;
            var top = cy - newSize / 2;
            left = Math.max(0, Math.min(1 - newSize, left));
            top = Math.max(0, Math.min(1 - newSize, top));
            selection = { left: left, top: top, width: newSize, height: newSize };
            applySelectionBox();
          }
          function onPinchEnd() {
            document.removeEventListener('touchmove', onPinchMove, { passive: false, capture: true });
            document.removeEventListener('touchend', onPinchEnd);
            document.removeEventListener('touchcancel', onPinchEnd);
          }
          document.addEventListener('touchmove', onPinchMove, { passive: false, capture: true });
          document.addEventListener('touchend', onPinchEnd);
          document.addEventListener('touchcancel', onPinchEnd);
        }
      }, { passive: false });
    }

    function baseNameWithoutSuffix(fileName) {
      var name = (fileName || 'image').replace(/\.[^.]+$/, '');
      return name.replace(/(_crop|_compress)+$/, '') || 'image';
    }

    function applyCompressResult(modalImg, fileInput, blob, mime) {
      var ext = (mime === 'image/webp') ? 'webp' : (mime === 'image/jpeg' || mime === 'image/jpg') ? 'jpg' : 'png';
      var baseName = baseNameWithoutSuffix(fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0].name : null);
      var file = new File([blob], baseName + '_compress.' + ext, { type: mime });
      var url = URL.createObjectURL(blob);
      modalImg._slikaObradaObjectURL = url;
      modalImg._slikaObradaMimeType = mime;
      modalImg.src = url;
      modalImg.alt = 'Pregled slike';
      modalImg.style.objectFit = 'contain';
      var dt = new DataTransfer();
      dt.items.add(file);
      if (fileInput) fileInput.files = dt.files;
      updateFileinfo(file);
      updateTipVelicina(file);
      hideSelectionOverlay();
      updateCompressButton(false);
      updateToolbarSlikaDependentButtons();
      if (enableRoundThumb) {
        roundEnabled = true;
        roundActive = false;
        if (imagePreviewElement) imagePreviewElement._obradaSlikaRoundActive = false;
        updateRoundButton();
      }
    }

    var modal = id('');
    if (!modal) return;

    (function setupHeaderDrag() {
      var header = id('_header');
      var dialog = modal.querySelector('.obrada-slika__dialog');
      if (!header || !dialog) return;
      header.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
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
        function move(e) {
          dialog.style.left = (startLeft + (e.clientX - startX)) + 'px';
          dialog.style.top = (startTop + (e.clientY - startY)) + 'px';
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

    (function setupResizeHandle() {
      var handle = id('_resize_handle');
      var dialog = modal.querySelector('.obrada-slika__dialog');
      if (!handle || !dialog) return;
      var minW = 320, minH = 200;
      var maxW = Math.min(window.innerWidth * 0.9, 800);
      var maxH = Math.min(window.innerHeight * 0.9, 600);
      function startResize(clientX, clientY) {
        var startX = clientX, startY = clientY;
        var startW = dialog.offsetWidth, startH = dialog.offsetHeight;
        function move(cx, cy) {
          var dw = cx - startX, dh = cy - startY;
          var newW = Math.max(minW, Math.min(maxW, startW + dw));
          var newH = Math.max(minH, Math.min(maxH, startH + dh));
          dialog.style.width = newW + 'px';
          dialog.style.height = newH + 'px';
        }
        function onMouseMove(e) {
          move(e.clientX, e.clientY);
        }
        function onMouseUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
      function onTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        var startX = e.touches[0].clientX, startY = e.touches[0].clientY;
        var startW = dialog.offsetWidth, startH = dialog.offsetHeight;
        function onTouchMove(ev) {
          if (ev.touches.length !== 1) return;
          ev.preventDefault();
          var cx = ev.touches[0].clientX, cy = ev.touches[0].clientY;
          var dw = cx - startX, dh = cy - startY;
          var newW = Math.max(minW, Math.min(maxW, startW + dw));
          var newH = Math.max(minH, Math.min(maxH, startH + dh));
          dialog.style.width = newW + 'px';
          dialog.style.height = newH + 'px';
        }
        function onTouchEnd() {
          document.removeEventListener('touchmove', onTouchMove, { passive: false });
          document.removeEventListener('touchend', onTouchEnd);
          document.removeEventListener('touchcancel', onTouchEnd);
        }
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
        document.addEventListener('touchcancel', onTouchEnd);
      }
      handle.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        startResize(e.clientX, e.clientY);
      });
      handle.addEventListener('touchstart', onTouchStart, { passive: false });
    })();

    if (imageAreaId) {
      var imageArea = document.getElementById(imageAreaId);
      if (imageArea) {
        imageArea.addEventListener('dblclick', function () {
          if (imageAreaDisabledClass && imageArea.classList.contains(imageAreaDisabledClass)) return;
          openModal();
        });
      }
    }

    var btnOdustani = id('_odustani');
    if (btnOdustani) btnOdustani.addEventListener('click', closeModal);

    var fileInput = id('_file');
    var modalImg = id('_img');

    var ikonaUcitaj = id('_ikona_ucitaj');
    if (ikonaUcitaj && fileInput) ikonaUcitaj.addEventListener('click', function () { obradaPostaviAccept(fileInput); fileInput.click(); });

    var ikonaObrisi = id('_ikona_obrisi');
    if (ikonaObrisi && modalImg && fileInput) {
      ikonaObrisi.addEventListener('click', function () {
        if (modalImg._slikaObradaObjectURL) {
          URL.revokeObjectURL(modalImg._slikaObradaObjectURL);
          modalImg._slikaObradaObjectURL = null;
        }
        if (undoState && undoState.objectURL) {
          URL.revokeObjectURL(undoState.objectURL);
          undoState = null;
        }
        undoState = null;
        updateUndoButton();
        modalImg.removeAttribute('src');
        modalImg.alt = '';
        fileInput.value = '';
        updateFileinfo(null);
        updateTipVelicina(null);
        hideSelectionOverlay();
        updateCompressButton(false);
        updateToolbarSlikaDependentButtons();
        var idVal = getSelectedId();
        if (idVal != null && idVal !== '') {
          var sep = (imageUrlPath.indexOf('?') >= 0) ? '&' : '?';
          modalImg.src = apiBase + imageUrlPath + sep + 'id=' + encodeURIComponent(idVal) + '&t=' + (Date.now ? Date.now() : 0);
          modalImg.alt = 'Pregled slike';
          modalImg.style.objectFit = 'contain';
        }
        updateToolbarSlikaDependentButtons();
      });
    }

    var ikonaSelekcija = id('_ikona_selekcija');
    setupSelectionBoxDrag();
    if (ikonaSelekcija) {
      ikonaSelekcija.addEventListener('click', function () {
        var img = id('_img');
        var ov = id('_selection_overlay');
        if (!img || !img.src) return;
        if (ov && ov.getAttribute('aria-hidden') === 'false') { hideSelectionOverlay(); return; }
        showSelectionOverlay();
      });
    }

    /** Preslikaj selekciju (wrap 0–1) u piksel koordinate slike. Wrap ima object-fit:contain pa slika ne ispunjava cijeli wrap. */
    function selectionToImagePixels(wrap, img, s) {
      var nw = img.naturalWidth, nh = img.naturalHeight;
      if (!wrap || !nw || !nh) return null;
      var r = wrap.getBoundingClientRect();
      var W = r.width, H = r.height;
      if (W <= 0 || H <= 0) return null;
      var scale = Math.min(W / nw, H / nh);
      var dw = nw * scale, dh = nh * scale;
      var imgLeft = (W - dw) / (2 * W), imgTop = (H - dh) / (2 * H), imgW = dw / W, imgH = dh / H;
      var selLeft = (s.left - imgLeft) / imgW;
      var selTop = (s.top - imgTop) / imgH;
      var selW = s.width / imgW;
      var selH = s.height / imgH;
      selLeft = Math.max(0, Math.min(1, selLeft));
      selTop = Math.max(0, Math.min(1, selTop));
      selW = Math.max(0, Math.min(1 - selLeft, selW));
      selH = Math.max(0, Math.min(1 - selTop, selH));
      return {
        sx: Math.floor(selLeft * nw),
        sy: Math.floor(selTop * nh),
        sw: Math.max(1, Math.floor(selW * nw)),
        sh: Math.max(1, Math.floor(selH * nh))
      };
    }

    var ikonaCrop = id('_ikona_crop');
    if (ikonaCrop && modalImg) {
      ikonaCrop.addEventListener('click', function () {
        var ov = id('_selection_overlay');
        if (!ov || ov.getAttribute('aria-hidden') !== 'false') return;
        var img = id('_img');
        var fin = id('_file');
        if (!img || !img.src || !img.complete || !selection) return;
        saveUndoState();
        var nw = img.naturalWidth, nh = img.naturalHeight;
        if (!nw || !nh) return;
        var wrap = id('_preview_wrap');
        var pix = selectionToImagePixels(wrap, img, selection);
        if (!pix) return;
        var sx = pix.sx, sy = pix.sy, sw = pix.sw, sh = pix.sh;
        var targetRatio = lastValidRatioX / lastValidRatioY;
        var selRatio = sw / sh;
        var canvas = document.createElement('canvas');
        var cw, ch;
        if (Math.abs(selRatio - targetRatio) < 0.001) {
          cw = Math.round(sw); ch = Math.round(sh);
        } else if (selRatio > targetRatio) {
          ch = Math.round(sh); cw = Math.round(ch * targetRatio);
          cw = Math.min(cw, sw);
          sx = Math.max(0, Math.min(nw - cw, sx + (sw - cw) / 2));
          sw = cw;
        } else {
          cw = Math.round(sw); ch = Math.round(cw / targetRatio);
          ch = Math.min(ch, sh);
          sy = Math.max(0, Math.min(nh - ch, sy + (sh - ch) / 2));
          sh = ch;
        }
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), sw, sh, 0, 0, cw, ch);

        // Crop: samo izrez – bez dodatne kompresije/resize; zadrži postojeći format što je više moguće
        var origMime = (img._slikaObradaMimeType || (fin && fin.files && fin.files[0] && fin.files[0].type) || 'image/png');
        var mime = (typeof origMime === 'string' && origMime) ? origMime.toLowerCase() : 'image/png';
        var isJpegMime = (mime === 'image/jpeg' || mime === 'image/jpg');
        var targetMime = isJpegMime ? 'image/jpeg' : mime;
        var targetQuality = isJpegMime ? 1.0 : undefined; // JPEG: maksimalna kvaliteta; ostali formati ignoriraju quality

        canvas.toBlob(function (blob) {
          if (!blob) {
            // Fallback na JPEG s default kvalitetom preglednika
            canvas.toBlob(function (jpegBlob) {
              if (jpegBlob) {
                var ext = 'jpg';
                var baseName = baseNameWithoutSuffix(fin && fin.files && fin.files[0] ? fin.files[0].name : null);
                var file = new File([jpegBlob], baseName + '_crop.' + ext, { type: 'image/jpeg' });
                var url = URL.createObjectURL(jpegBlob);
                img._slikaObradaObjectURL = url;
                img._slikaObradaMimeType = 'image/jpeg';
                img.src = url;
                img.alt = 'Pregled odabrane slike';
                var dt = new DataTransfer();
                dt.items.add(file);
                if (fin) fin.files = dt.files;
                updateFileinfo(file);
                updateTipVelicina(file);
                hideSelectionOverlay();
                var cropRatio = cw / ch, wrapRatio = lastValidRatioX / lastValidRatioY;
                img.style.objectFit = (Math.abs(cropRatio - wrapRatio) < 0.001) ? 'fill' : 'contain';
              }
            }, 'image/jpeg');
            return;
          }
          var outMime = (blob.type && typeof blob.type === 'string') ? blob.type.toLowerCase() : targetMime;
          var ext = (outMime === 'image/jpeg' || outMime === 'image/jpg') ? 'jpg'
            : (outMime === 'image/png') ? 'png'
            : (outMime === 'image/webp') ? 'webp'
            : fileTypeToExtension(outMime) || 'png';
          var baseName = baseNameWithoutSuffix(fin && fin.files && fin.files[0] ? fin.files[0].name : null);
          var file = new File([blob], baseName + '_crop.' + ext, { type: outMime });
          var url = URL.createObjectURL(blob);
          img._slikaObradaObjectURL = url;
          img._slikaObradaMimeType = outMime;
          img.src = url;
          img.alt = 'Pregled odabrane slike';
          var dt = new DataTransfer();
          dt.items.add(file);
          if (fin) fin.files = dt.files;
          updateFileinfo(file);
          updateTipVelicina(file);
          hideSelectionOverlay();
          var cropRatio = cw / ch, wrapRatio = lastValidRatioX / lastValidRatioY;
          img.style.objectFit = (Math.abs(cropRatio - wrapRatio) < 0.001) ? 'fill' : 'contain';
        }, targetMime, targetQuality);
      });
    }

    var ikonaUndo = id('_ikona_undo');
    if (ikonaUndo) {
      ikonaUndo.addEventListener('click', function () {
        if (!undoState) return;
        var img = id('_img');
        var fin = id('_file');
        if (!img) return;
        if (img._slikaObradaObjectURL) {
          URL.revokeObjectURL(img._slikaObradaObjectURL);
          img._slikaObradaObjectURL = null;
        }
        if (undoState.objectURL) {
          img._slikaObradaObjectURL = undoState.objectURL;
          img._slikaObradaMimeType = undoState.mimeType;
          img.src = undoState.src;
        } else {
          img.src = undoState.src;
        }
        img.alt = 'Pregled slike';
        img.style.objectFit = 'contain';
        if (fin) {
          if (undoState.file) {
            var dt = new DataTransfer();
            dt.items.add(undoState.file);
            fin.files = dt.files;
            updateFileinfo(undoState.file);
            updateTipVelicina(undoState.file);
          } else {
            fin.value = '';
            updateFileinfo(null);
            updateTipVelicina(null);
          }
        }
        undoState = null;
        updateUndoButton();
        updateCompressButton(true);
        hideSelectionOverlay();
        updateToolbarSlikaDependentButtons();
      });
    }

    var ikonaCompress = id('_ikona_compress');
    if (ikonaCompress && modalImg) {
      ikonaCompress.addEventListener('click', function () {
        var img = id('_img');
        var fin = id('_file');
        if (!img || !img.src || !img.complete) return;
        saveUndoState();
        var nw = img.naturalWidth, nh = img.naturalHeight;
        if (!nw || !nh) return;
        var maxPx = getCompressMaxPx();
        var quality = getCompressQuality();
        var scale = (nw > maxPx || nh > maxPx) ? (nw >= nh ? maxPx / nw : maxPx / nh) : 1;
        var cw = Math.round(nw * scale), ch = Math.round(nh * scale);
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, nw, nh, 0, 0, cw, ch);
        canvas.toBlob(function (blob) {
          if (!blob) {
            canvas.toBlob(function (jpegBlob) {
              if (jpegBlob) applyCompressResult(img, fin, jpegBlob, 'image/jpeg');
            }, 'image/jpeg', quality);
            return;
          }
          applyCompressResult(img, fin, blob, 'image/webp');
        }, 'image/webp', quality);
      });
    }

    var ikonaRound = id('_ikona_round');
    if (ikonaRound && modalImg) {
      if (!enableRoundThumb) {
        ikonaRound.disabled = true;
      }
      ikonaRound.addEventListener('click', function () {
        if (!enableRoundThumb || !roundEnabled) return;
        roundActive = !roundActive;
        var img = id('_img');
        if (img) {
          if (roundActive) {
            var wrap = id('_preview_wrap');
            if (wrap && wrap.getBoundingClientRect) {
              var rect = wrap.getBoundingClientRect();
              var w = rect.width || 1;
              var h = rect.height || 1;
              var radiusPx = Math.min(w, h) / 2;
              // radijus kao postotak širine, ali temeljen na većoj dimenziji da sigurno stane u visinu
              var radiusPct = (radiusPx / Math.max(w, h)) * 100;
              roundRadiusPct = radiusPct;
              // ograničenja centra po visini da krug ne izađe iz slike
              var minCy = (radiusPx / h) * 100;
              var maxCy = 100 - minCy;
              var midCy = (minCy + maxCy) / 2;
              var cyBase = midCy + roundOffset * ((maxCy - minCy) / 2);
              var cy = Math.max(minCy, Math.min(maxCy, cyBase));
              img.style.clipPath = 'circle(' + roundRadiusPct + '% at 50% ' + cy + '%)';
            } else {
              img.style.clipPath = 'circle(50% at 50% 50%)';
            }
            img.style.borderRadius = '';
          } else {
            img.style.clipPath = '';
            img.style.borderRadius = '';
          }
        }
        if (imagePreviewElement) {
          imagePreviewElement._obradaSlikaRoundActive = !!roundActive;
          var wrap = id('_preview_wrap');
          var wrapH = wrap && wrap.getBoundingClientRect ? wrap.getBoundingClientRect().height : 0;
          if (wrapH > 0) {
            imagePreviewElement._obradaSlikaRoundOffsetPx = -roundOffset * (wrapH / 2);
            imagePreviewElement._obradaSlikaRoundOffsetHeight = wrapH;
          }
          imagePreviewElement._obradaSlikaRoundOffset = roundOffset;
        }
        updateRoundButton();
      });
    }

    /* Povlačenje mišem / dodirom za pomicanje kružnog isječka gore/dolje */
    if (enableRoundThumb && modalImg) {
      var dragActive = false;
      var dragStartY = 0;
      var dragStartOffset = 0;

      function applyRoundClipFromDrag() {
        if (!roundActive) return;
        var img = id('_img');
        if (!img) return;
        var wrap = id('_preview_wrap');
        if (!wrap || !wrap.getBoundingClientRect) return;
        var rect = wrap.getBoundingClientRect();
        var w = rect.width || 1;
        var h = rect.height || 1;
        var radiusPx = Math.min(w, h) / 2;
        var radiusPct = (radiusPx / Math.max(w, h)) * 100;
        roundRadiusPct = radiusPct;
        var minCy = (radiusPx / h) * 100;
        var maxCy = 100 - minCy;
        var midCy = (minCy + maxCy) / 2;
        var cyBase = midCy + roundOffset * ((maxCy - minCy) / 2);
        var cy = Math.max(minCy, Math.min(maxCy, cyBase));
        img.style.clipPath = 'circle(' + roundRadiusPct + '% at 50% ' + cy + '%)';
      }

      function startDrag(clientY) {
        if (!roundEnabled) return;
        dragActive = true;
        dragStartY = clientY;
        dragStartOffset = roundOffset;
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', endDrag);
        document.addEventListener('touchcancel', endDrag);
      }

      function endDrag() {
        if (!dragActive) return;
        dragActive = false;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', endDrag);
        document.removeEventListener('touchcancel', endDrag);
        if (imagePreviewElement) {
          var wrap = id('_preview_wrap');
          var wrapH = wrap && wrap.getBoundingClientRect ? wrap.getBoundingClientRect().height : 0;
          if (wrapH > 0) {
            imagePreviewElement._obradaSlikaRoundOffsetPx = -roundOffset * (wrapH / 2);
            imagePreviewElement._obradaSlikaRoundOffsetHeight = wrapH;
          }
          imagePreviewElement._obradaSlikaRoundOffset = roundOffset;
        }
      }

      function onDragMove(e) {
        if (!dragActive) return;
        var wrap = id('_preview_wrap');
        if (!wrap || !wrap.getBoundingClientRect) return;
        var rect = wrap.getBoundingClientRect();
        var halfH = rect.height / 2 || 1;
        var dy = e.clientY - dragStartY;
        var delta = dy / halfH;
        roundOffset = Math.max(-1, Math.min(1, dragStartOffset + delta));
        applyRoundClipFromDrag();
      }

      function onTouchMove(e) {
        if (!dragActive || !e.touches || !e.touches.length) return;
        e.preventDefault();
        var touch = e.touches[0];
        var wrap = id('_preview_wrap');
        if (!wrap || !wrap.getBoundingClientRect) return;
        var rect = wrap.getBoundingClientRect();
        var halfH = rect.height / 2 || 1;
        var dy = touch.clientY - dragStartY;
        var delta = dy / halfH;
        roundOffset = Math.max(-1, Math.min(1, dragStartOffset + delta));
        applyRoundClipFromDrag();
      }

      modalImg.addEventListener('dragstart', function (e) { e.preventDefault(); });
      modalImg.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        startDrag(e.clientY);
      });
      modalImg.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches.length) return;
        e.preventDefault();
        startDrag(e.touches[0].clientY);
      }, { passive: false });
    }

    if (fileInput && modalImg) {
      fileInput.addEventListener('change', function () {
        var files = this.files;
        saveUndoState();
        if (modalImg._slikaObradaObjectURL) {
          URL.revokeObjectURL(modalImg._slikaObradaObjectURL);
          modalImg._slikaObradaObjectURL = null;
        }
        if (!files || files.length === 0) {
          updateFileinfo(null);
          updateTipVelicina(null);
          var idVal = getSelectedId();
          if (idVal != null && idVal !== '') {
            var sep = (imageUrlPath.indexOf('?') >= 0) ? '&' : '?';
            modalImg.src = apiBase + imageUrlPath + sep + 'id=' + encodeURIComponent(idVal) + '&t=' + (Date.now ? Date.now() : 0);
            modalImg.style.objectFit = 'contain';
          } else {
            modalImg.removeAttribute('src');
            modalImg.alt = '';
          }
          updateToolbarSlikaDependentButtons();
          return;
        }
        var file = files[0];
        if (!obradaMimeOk(file.type)) {
          fileInput.value = '';
          obradaPrikaziGreskuFormat();
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var buf = reader.result;
          if (!(buf instanceof ArrayBuffer)) {
            fileInput.value = '';
            obradaPrikaziGreskuFormat();
            return;
          }
          var bytes = new Uint8Array(buf);
          if (!obradaMagicOk(bytes)) {
            fileInput.value = '';
            obradaPrikaziGreskuFormat();
            return;
          }
          updateFileinfo(file);
          updateTipVelicina(file);
          hideSelectionOverlay();
          updateCompressButton(true);
          var url = URL.createObjectURL(file);
          modalImg._slikaObradaObjectURL = url;
          modalImg._slikaObradaMimeType = (file.type || '').toLowerCase();
          modalImg.src = url;
          modalImg.alt = 'Pregled odabrane slike';
          modalImg.style.objectFit = 'contain';
          updateToolbarSlikaDependentButtons();
        };
        reader.readAsArrayBuffer(file.slice(0, 12));
      });
    }

    var ratioX = id('_ratio_x');
    var ratioY = id('_ratio_y');
    if (ratioX && ratioY && !ratioInputsDisabled) {
      function onRatioInput() { applyRatio(); }
      ratioX.addEventListener('input', onRatioInput);
      ratioX.addEventListener('change', onRatioInput);
      ratioY.addEventListener('input', onRatioInput);
      ratioY.addEventListener('change', onRatioInput);
    }
    if (ratioX && ratioY && !isNaN(fixedRatioX) && !isNaN(fixedRatioY) && fixedRatioX > 0 && fixedRatioY > 0) {
      lastValidRatioX = fixedRatioX;
      lastValidRatioY = fixedRatioY;
      ratioX.value = String(fixedRatioX);
      ratioY.value = String(fixedRatioY);
      /* Fiksni omjer = zaključano → jedinstveni RO mehanizam (plavi izgled + inertno + native readonly). */
      if (typeof KontroleSetControlReadonly === 'function') {
        KontroleSetControlReadonly(ratioX, true);
        KontroleSetControlReadonly(ratioY, true);
      } else {
        ratioX.readOnly = true;
        ratioY.readOnly = true;
        if (ratioInputsDisabled) {
          ratioX.setAttribute('readonly', 'readonly');
          ratioY.setAttribute('readonly', 'readonly');
        }
      }
    }

    function onSpremiClick(e) {
      var targetModal = document.getElementById(idPrefix);
      if (!targetModal || targetModal.getAttribute('aria-hidden') === 'true') return;
      var btn = e.target && e.target.closest ? e.target.closest('[data-obrada-slika="spremi"]') : null;
      if (!btn || !targetModal.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      /* Snimi veličinu, poziciju i omjer prije skrivanja */
      var dialog = targetModal.querySelector('.obrada-slika__dialog');
      var inputX = document.getElementById(idPrefix + '_ratio_x');
      var inputY = document.getElementById(idPrefix + '_ratio_y');
      if (dialog) {
        var rect = dialog.getBoundingClientRect();
        savedModalState = {
          width: dialog.offsetWidth,
          height: dialog.offsetHeight,
          ratioX: inputX && inputX.value != null ? String(inputX.value).trim() : String(lastValidRatioX),
          ratioY: inputY && inputY.value != null ? String(inputY.value).trim() : String(lastValidRatioY),
          left: rect.left,
          top: rect.top
        };
      }
      targetModal.style.display = 'none';
      targetModal.style.visibility = 'hidden';
      var modalImgEl = document.getElementById(idPrefix + '_img');
      var fileInputEl = document.getElementById(idPrefix + '_file');
      if (btn.disabled && !(modalImgEl && modalImgEl.src)) return;
      var files = fileInputEl && fileInputEl.files ? fileInputEl.files : null;
      var file = files && files.length > 0 ? files[0] : null;
      if (file && (!file.type || file.type.indexOf('image/') !== 0)) file = null;

      /* Prenesi sliku iz modala u okvir u formi; modal ne poziva server. Na element zapisujemo blob i mime. */
      if (!imagePreviewElement) {
        closeModal();
        return;
      }
      var altToSet = modalImgEl && modalImgEl.alt ? modalImgEl.alt : 'Slika stupnja';
      var el = imagePreviewElement;
      if (file) {
        if (el._obradaSlikaPrevURL) {
          URL.revokeObjectURL(el._obradaSlikaPrevURL);
          el._obradaSlikaPrevURL = null;
        }
        el._obradaSlikaBlob = file;
        el._obradaSlikaMime = (file.type && file.type.indexOf('image/') === 0) ? file.type : 'image/webp';
        el._obradaSlikaPrevURL = URL.createObjectURL(file);
        closeModal();
        function applyPreview() {
          el.src = el._obradaSlikaPrevURL;
          el.alt = altToSet;
          el.style.display = '';
          onUploadSuccess();
        }
        setTimeout(applyPreview, 250);
      } else if (modalImgEl && modalImgEl.src && modalImgEl.src.indexOf('blob:') === 0) {
        fetch(modalImgEl.src).then(function (r) { return r.blob(); }).then(function (blob) {
          if (el._obradaSlikaPrevURL) {
            URL.revokeObjectURL(el._obradaSlikaPrevURL);
            el._obradaSlikaPrevURL = null;
          }
          el._obradaSlikaBlob = blob;
          el._obradaSlikaMime = (blob.type && blob.type.indexOf('image/') === 0) ? blob.type : (modalImgEl._slikaObradaMimeType || 'image/webp');
          el._obradaSlikaPrevURL = URL.createObjectURL(blob);
          closeModal();
          setTimeout(function () {
            el.src = el._obradaSlikaPrevURL;
            el.alt = altToSet;
            el.style.display = '';
            onUploadSuccess();
          }, 250);
        }).catch(function () {
          closeModal();
        });
      } else {
        /* Modal nije poslao blob (npr. slika je s servera) – ne kopiramo; u kontroli je samo blob koji modal pošalje (obrađena slika). */
        closeModal();
      }
    }
    document.body.addEventListener('click', onSpremiClick, true);
    }

    if (templateUrl) {
      var mount = mountSelector ? document.querySelector(mountSelector) : document.body;
      if (!mount) mount = document.body;
      fetch(templateUrl, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) return Promise.reject(new Error('HTTP ' + r.status));
        return r.text();
      }).then(function (html) {
        var resolved = html.split('__ID_PREFIX__').join(idPrefix);
        mount.insertAdjacentHTML('beforeend', resolved);
        doInit();
      }).catch(function (err) {
        try {
          console.warn('ObradaSlikaInit: učitavanje šablona neuspješno', templateUrl, err);
        } catch (e) {}
      });
    } else {
      doInit();
    }
  };
})();
