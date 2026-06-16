/* Alati_Sustav_Slike_Tekstovi_CRUD.js — CRUD sustav_slike_tekstovi.
 * Sadržaj po tip_podatka: Slika (0-Obrada_Slike → multipart $_FILES) ili Tekst/PDF blok (textarea).
 * Pretraga po nazivu (klijentski filter) u zaglavlju panela tablice.
 * API: _meta? ne; _sve/_upis/_izmjena/_brisanje/_podatak.php.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Alati_Sustav_Slike_Tekstovi_CRUD.html');

  var API_BASE = '../php/';
  var URL_SVE = API_BASE + 'Alati_Sustav_Slike_Tekstovi_CRUD_sve.php';
  var URL_UPIS = API_BASE + 'Alati_Sustav_Slike_Tekstovi_CRUD_upis.php';
  var URL_IZMJENA = API_BASE + 'Alati_Sustav_Slike_Tekstovi_CRUD_izmjena.php';
  var URL_BRISANJE = API_BASE + 'Alati_Sustav_Slike_Tekstovi_CRUD_brisanje.php';
  var URL_PODATAK = API_BASE + 'Alati_Sustav_Slike_Tekstovi_CRUD_podatak.php';

  var SST = {
    Broj_Kolona: 3,
    Reload_Ikona: 1,
    CrudCssPrefix: 'alati-sst-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: -35, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'tip_podatka', title: 'Tip', SQL_Naziv: 'tip_podatka', sortable: 1, sortable_icon: 0, type: 't', width: 140, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'napomena', title: 'Napomena', SQL_Naziv: 'napomena', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  function byId(id) { return document.getElementById(id); }
  function vEdit(col) { var el = byId('edit_' + col); return el ? el.value : ''; }
  function trim(s) { return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : ''); }
  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }
  function porukaIzKoda(res, repl) {
    var p = parseResponseCode(res);
    if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal(p.code, repl || p.replacements);
    }
  }

  var SLIKE_TIPOVI = ['Slika JPG', 'Slika PNG', 'Slika WEBP'];
  function jeSlika(tip) { return SLIKE_TIPOVI.indexOf(tip) >= 0; }
  function tipIzMime(m) {
    m = (m || '').toLowerCase();
    if (m.indexOf('png') >= 0) return 'Slika PNG';
    if (m.indexOf('webp') >= 0) return 'Slika WEBP';
    if (m.indexOf('jpeg') >= 0 || m.indexOf('jpg') >= 0) return 'Slika JPG';
    return 'Slika WEBP';
  }
  function formatIzTipa(tip) {
    if (tip === 'Slika PNG') return 'png';
    if (tip === 'Slika WEBP') return 'webp';
    if (tip === 'Slika JPG') return 'jpg';
    return null;
  }

  var imgEl = byId('sst_image_preview');
  var slikaArea = byId('sst_image_area');
  var slikaWrap = byId('sst_sadrzaj_slika');
  var _imaPostojecuSliku = false;

  /* Okvir slike: prazno → puni stupac (CSS fill); slika učitana → preuzme omjer slike, centriran. */
  function slikaFillMode() {
    if (!slikaArea) return;
    slikaArea.style.flex = '';
    slikaArea.style.width = '';
    slikaArea.style.height = '';
    slikaArea.style.minHeight = '';
    slikaArea.style.margin = '';
  }
  function prilagodiSlici() {
    if (!slikaArea || !slikaWrap) return;
    if (!imgEl || imgEl.style.display === 'none' || !imgEl.naturalWidth || !imgEl.naturalHeight) { slikaFillMode(); return; }
    var R = imgEl.naturalWidth / imgEl.naturalHeight;
    var cs = getComputedStyle(slikaWrap);
    var lbl = slikaWrap.querySelector('label');
    var gap = parseFloat(cs.rowGap || cs.gap) || 0;
    var availW = slikaWrap.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var availH = slikaWrap.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - (lbl ? lbl.offsetHeight + gap : 0);
    if (availW <= 0 || availH <= 0) return;
    var w, h;
    if (availW / availH > R) { h = availH; w = h * R; } else { w = availW; h = w / R; }
    slikaArea.style.flex = '0 0 auto';
    slikaArea.style.minHeight = '0';
    slikaArea.style.width = Math.floor(w) + 'px';
    slikaArea.style.height = Math.floor(h) + 'px';
    slikaArea.style.margin = 'auto';
  }

  function clearImg() {
    if (!imgEl) return;
    if (imgEl._obradaSlikaPrevURL) { try { URL.revokeObjectURL(imgEl._obradaSlikaPrevURL); } catch (e) {} imgEl._obradaSlikaPrevURL = null; }
    imgEl.src = '';
    imgEl.style.display = 'none';
    imgEl._obradaSlikaBlob = null;
    imgEl._obradaSlikaMime = null;
    slikaFillMode();
  }
  function imaSliku() { return _imaPostojecuSliku || !!(imgEl && imgEl._obradaSlikaBlob); }

  if (imgEl) imgEl.addEventListener('load', prilagodiSlici);
  if (typeof ResizeObserver !== 'undefined' && slikaWrap) {
    try { new ResizeObserver(function () { prilagodiSlici(); }).observe(slikaWrap); } catch (e) {}
  }

  /* Sadržaj: prikaži slika-area ili textarea po tipu */
  function azurirajSadrzaj() {
    var tip = vEdit('tip_podatka');
    var slika = jeSlika(tip);
    var sS = byId('sst_sadrzaj_slika'), sT = byId('sst_sadrzaj_tekst');
    if (sS) sS.hidden = !slika;
    if (sT) sT.hidden = slika;
    if (slika) prilagodiSlici();
  }

  /* ---- Tablica + pretraga ---- */
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var sstPoId = {};
  var sviObjekti = [];

  CommonCRUD.initTablica('tablicaContainer', SST, {
    getRowId: function (row) { return row && row[3] != null ? row[3] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); },
    onReloadClick: function () { osvjeziTablicu(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function redIzObjekta(o) {
    return [
      o.naziv != null ? o.naziv : '',
      o.tip_podatka != null ? o.tip_podatka : '',
      o.napomena != null ? o.napomena : '',
      o.id != null ? o.id : 0
    ];
  }

  function primijeniFilter() {
    var q = trim(byId('sst_pretraga') ? byId('sst_pretraga').value : '').toLowerCase();
    var lista = sviObjekti.filter(function (o) { return q === '' || String(o.naziv || '').toLowerCase().indexOf(q) >= 0; });
    var rows = lista.map(redIzObjekta);
    rows.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'hr', { sensitivity: 'base' }); });
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, SST.Tablica_Zaglavlje);
  }

  function ucitajPodatkeTablica(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', URL_SVE, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      sstPoId = {}; sviObjekti = [];
      if (text !== '' && text.charAt(0) !== '[') {
        porukaIzKoda(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) {
            var o = arr[j];
            if (o && o.id != null) sstPoId[String(o.id)] = o;
            sviObjekti.push(o);
          }
        } catch (e) {}
      }
      if (cb) cb();
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function () { primijeniFilter(); });
  }

  /* ---- Punjenje / čišćenje ---- */
  function popuniIzObjekta(o) {
    var n = byId('edit_naziv'); if (n) n.value = o.naziv != null ? String(o.naziv) : '';
    var tip = byId('edit_tip_podatka'); if (tip) { tip.value = o.tip_podatka != null ? String(o.tip_podatka) : 'Slika JPG'; refreshSelect('edit_tip_podatka'); }
    var nap = byId('edit_napomena'); if (nap) nap.value = o.napomena != null ? String(o.napomena) : '';
    var ta = byId('edit_podatak_tekst');
    azurirajSadrzaj();
    clearImg();
    _imaPostojecuSliku = false;
    if (jeSlika(o.tip_podatka)) {
      if (ta) ta.value = '';
      if (o.ima_podatak && imgEl) {
        imgEl.src = URL_PODATAK + '?id=' + encodeURIComponent(o.id) + '&t=' + (Date.now ? Date.now() : 0);
        imgEl.style.display = '';
        _imaPostojecuSliku = true;
      }
    } else {
      if (o.ima_podatak) {
        fetch(URL_PODATAK + '?id=' + encodeURIComponent(o.id)).then(function (r) { return r.text(); }).then(function (t) {
          if (ta && getSelectedRowId() == o.id) ta.value = t;
        }).catch(function () {});
      } else if (ta) { ta.value = ''; }
    }
  }

  function clearForm() {
    var n = byId('edit_naziv'); if (n) n.value = '';
    var tip = byId('edit_tip_podatka'); if (tip) { tip.value = 'Slika JPG'; refreshSelect('edit_tip_podatka'); }
    var nap = byId('edit_napomena'); if (nap) nap.value = '';
    var ta = byId('edit_podatak_tekst'); if (ta) ta.value = '';
    clearImg();
    _imaPostojecuSliku = false;
    azurirajSadrzaj();
    if (n) n.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---- Gating: prazan naziv → kontrole disable ---- */
  function azurirajDisable() {
    var imaNaziv = trim(vEdit('naziv')) !== '';
    ['edit_tip_podatka', 'edit_podatak_tekst', 'edit_napomena'].forEach(function (id) {
      var el = byId(id);
      if (el && typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(el, imaNaziv);
      else if (el) { el.disabled = !imaNaziv; if (el.tagName === 'SELECT') refreshSelect(id); }
    });
    var area = byId('sst_image_area'); if (area) area.classList.toggle('kontrola-slika--disabled', !imaNaziv);
    var slikaLbl = byId('sst_slika_labela'); if (slikaLbl) slikaLbl.classList.toggle('kontrola-labela--disabled', !imaNaziv);
    var delBtn = byId('sst_image_delete_btn'); if (delBtn) delBtn.disabled = !imaNaziv || !imaSliku();
  }

  /* ---- Selekcija ---- */
  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearForm(); }
    else {
      var o = sstPoId[String(id)];
      if (o) popuniIzObjekta(o);
      var n = byId('edit_naziv'); if (n) n.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateCrudUpisiState();
  };

  /* X na Naziv -> reset */
  (function () {
    var n = byId('edit_naziv');
    var wrap = n && n.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      clearForm();
      updateCrudUpisiState();
    });
  })();

  /* Brisanje slike u kontroli */
  (function () {
    var b = byId('sst_image_delete_btn');
    if (!b) return;
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (b.disabled) return;
      clearImg();
      _imaPostojecuSliku = false;
      updateCrudUpisiState();
      azurirajDisable();
    });
  })();

  /* ---- Gumbi / stanje ---- */
  var btnUpisi = byId('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = byId('btnIzbrisi');

  function upisiMoguc() {
    if (trim(vEdit('naziv')) === '') return false;
    return jeSlika(vEdit('tip_podatka')) ? imaSliku() : true;
  }

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !upisiMoguc();
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var n = byId('edit_naziv');
    if (n) {
      n.addEventListener('input', function () { updateCrudUpisiState(); azurirajDisable(); });
      n.addEventListener('change', function () { updateCrudUpisiState(); azurirajDisable(); });
    }
    var tip = byId('edit_tip_podatka');
    if (tip) tip.addEventListener('change', function () { azurirajSadrzaj(); updateCrudUpisiState(); azurirajDisable(); });
  })();

  function obradiOdgovor(res, kodUspjeha) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(kodUspjeha, [], function () {
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          clearForm(); osvjeziTablicu();
        });
      } else { clearForm(); osvjeziTablicu(); }
      return;
    }
    porukaIzKoda(res, res.indexOf('002') === 0 ? ['Naziv'] : null);
  }

  function posaljiFormu(jeIzmjena) {
    var tip = vEdit('tip_podatka');
    var fd = new FormData();
    fd.append('naziv', trim(vEdit('naziv')));
    fd.append('napomena', trim(vEdit('napomena')));
    if (jeSlika(tip)) {
      if (imgEl && imgEl._obradaSlikaBlob) {
        tip = tipIzMime(imgEl._obradaSlikaMime);   /* auto-uskladi tip s rezultatom obrade */
        var t = byId('edit_tip_podatka'); if (t) { t.value = tip; refreshSelect('edit_tip_podatka'); }
        var ext = tip === 'Slika PNG' ? 'png' : (tip === 'Slika WEBP' ? 'webp' : 'jpg');
        fd.append('podatak', imgEl._obradaSlikaBlob, 'slika.' + ext);
        fd.append('mime', imgEl._obradaSlikaMime || 'image/webp');
      }
      /* slika bez nove datoteke → backend zadrži postojeću (izmjena) */
    } else {
      var ta = byId('edit_podatak_tekst');
      fd.append('podatak_tekst', ta ? ta.value : '');
    }
    fd.append('tip_podatka', tip);
    if (jeIzmjena) fd.append('id', String(getSelectedRowId()));
    fetch(jeIzmjena ? URL_IZMJENA : URL_UPIS, { method: 'POST', body: fd })
      .then(function (r) { return r.text(); })
      .then(function (res) { obradiOdgovor((res || '').trim(), jeIzmjena ? '004' : '001'); })
      .catch(function () { porukaIzKoda('200,0'); });
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      if (!upisiMoguc()) { if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []); return; }
      posaljiFormu(this.classList.contains('kontrola-btn--crud-izmjeni'));
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      var fd = new FormData(); fd.append('id', String(id));
      fetch(URL_BRISANJE, { method: 'POST', body: fd }).then(function (r) { return r.text(); }).then(function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearForm(); osvjeziTablicu();
            });
          }
        } else { porukaIzKoda(res); }
      }).catch(function () { porukaIzKoda('200,0'); });
    });
  }

  (function () {
    var btnPovratak = byId('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
      if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e2) {} }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  /* ---- Pretraga (debounce = sustav_varijable 114, default 1000 ms; „×" filtrira odmah) ---- */
  (function () {
    if (typeof window.vnlhLoadPronadjiStankaMsFromVar114 === 'function') window.vnlhLoadPronadjiStankaMsFromVar114(API_BASE);
    var p = byId('sst_pretraga');
    var tmo = null;
    function naInput() {
      if (tmo) clearTimeout(tmo);
      var ms = (typeof window.vnlhGetPronadjiStankaMs === 'function') ? window.vnlhGetPronadjiStankaMs() : 1000;
      tmo = setTimeout(function () { tmo = null; primijeniFilter(); }, ms);
    }
    if (p) p.addEventListener('input', naInput);
    var wrap = p && p.closest('.kontrola-edit-delete');
    if (wrap) wrap.addEventListener('kontrole-edit-delete-clear', function () { if (tmo) { clearTimeout(tmo); tmo = null; } primijeniFilter(); });
  })();

  /* ---- Obrada slike (0-Obrada_Slike) ---- */
  if (typeof window.ObradaSlikaInit === 'function') {
    window.ObradaSlikaInit({
      idPrefix: 'sst_modal_slika',
      templateUrl: '0-Obrada_Slike.php',
      mountSelector: '#obrada_slika_mount',
      getSelectedId: getSelectedRowId,
      getEditFormRowId: getSelectedRowId,
      apiBase: API_BASE,
      imageUrlPath: 'Alati_Sustav_Slike_Tekstovi_CRUD_podatak.php',
      imageAreaId: 'sst_image_area',
      focusAfterCloseId: 'edit_naziv',
      imageAreaDisabledClass: 'kontrola-slika--disabled',
      imagePreviewElement: imgEl,
      parseResponseCode: parseResponseCode,
      dozvoljeniFormati: function () { return formatIzTipa(vEdit('tip_podatka')); },
      porukaFormatKod: '030',
      neogranicenaVelicina: true,
      onUploadSuccess: function () {
        _imaPostojecuSliku = false;
        /* Opcija 2: tip selekta prati stvarni format rezultata (npr. JPG sažet u WEBP → "Slika WEBP"). */
        if (imgEl && imgEl._obradaSlikaMime) {
          var noviTip = tipIzMime(imgEl._obradaSlikaMime);
          var t = byId('edit_tip_podatka');
          if (t && noviTip && t.value !== noviTip) { t.value = noviTip; refreshSelect('edit_tip_podatka'); azurirajSadrzaj(); }
        }
        updateCrudUpisiState();
        azurirajDisable();
      }
    });
  }

  /* ---- Init ---- */
  ucitajPodatkeTablica(function () { primijeniFilter(); });
  clearForm();
  updateCrudUpisiState();
  azurirajDisable();
})();
