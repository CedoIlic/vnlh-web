/* PDF_Whitelist_CRUD.js — tablica + edit za pdf_dozvoljeni_izvori ("Dozvoljeni izvori").
 * Tablica i kolona biraju se kaskadno iz baze (meta endpoint → information_schema):
 * odabir tablice puni kolone te tablice; odabir kolone predlaže tip_podatka (BLOB→slika).
 * API: PDF_Whitelist_CRUD_meta/_sve/_upis/_izmjena/_brisanje.php.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Whitelist_CRUD.html');

  var API_BASE = '../php/';

  var PDF_WhitelistCRUD = {
    Broj_Kolona: 4,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-whitelist-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: -30, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'tablica', title: 'Tablica', SQL_Naziv: 'tablica', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'kolona', title: 'Kolona', SQL_Naziv: 'kolona', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'tip_podatka', title: 'Tip', SQL_Naziv: 'tip_podatka', sortable: 1, sortable_icon: 0, type: 't', width: 90, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  function byId(id) { return document.getElementById(id); }
  function vEdit(col) { var el = byId('edit_' + col); return el ? el.value : ''; }
  function trim(s) { return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : ''); }
  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }
  function postFormData(url, params, cb) { if (window.CommonPostFormData) window.CommonPostFormData(url, params, cb); else cb(''); }
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

  /* ===== Meta (tablice + kolone iz baze) ===== */
  var META = {};   /* { tablica: [ { kolona, blob } ] } */

  function popuniTablicaSelekt() {
    var sel = byId('edit_tablica');
    if (!sel) return;
    var tablice = Object.keys(META).sort(function (a, b) { return a.localeCompare(b, 'hr', { sensitivity: 'base' }); });
    while (sel.options.length > 1) sel.remove(1);
    tablice.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
    refreshSelect('edit_tablica');
  }

  function popuniKolone(tablica, izabrana) {
    var sel = byId('edit_kolona');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    var lista = META[tablica] || [];
    lista.forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = k.kolona; opt.textContent = k.kolona;
      if (k.komentar) opt.title = k.komentar;   /* SQL COMMENT → tooltip na hover opcije */
      sel.appendChild(opt);
    });
    var ima = izabrana && lista.some(function (k) { return k.kolona === izabrana; });
    sel.value = ima ? izabrana : '';
    refreshSelect('edit_kolona');
  }

  function blobZaKolonu(tablica, kolona) {
    var lista = META[tablica] || [];
    for (var i = 0; i < lista.length; i++) if (lista[i].kolona === kolona) return !!lista[i].blob;
    return false;
  }

  function ucitajMeta(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Whitelist_CRUD_meta.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '{') {
        try { META = JSON.parse(text); } catch (e) { META = {}; }
      } else { porukaIzKoda(text); }
      popuniTablicaSelekt();
      if (cb) cb();
    };
    xhr.send();
  }

  /* ===== Tablica ===== */
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var izvoriPoId = {};

  CommonCRUD.initTablica('tablicaContainer', PDF_WhitelistCRUD, {
    getRowId: function (row) { return row && row[4] != null ? row[4] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function redIzObjekta(o) {
    return [
      o.naziv != null ? o.naziv : '',
      o.tablica != null ? o.tablica : '',
      o.kolona != null ? o.kolona : '',
      o.tip_podatka != null ? o.tip_podatka : '',
      o.id != null ? o.id : 0
    ];
  }

  function ucitajPodatkeTablica(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Whitelist_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      izvoriPoId = {};
      if (text !== '' && text.charAt(0) !== '[') {
        porukaIzKoda(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) {
            var o = arr[j];
            if (o && o.id != null) izvoriPoId[String(o.id)] = o;
            rows.push(redIzObjekta(o));
          }
          rows.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'hr', { sensitivity: 'base' }); });
        } catch (e) {}
      }
      if (cb) cb(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_WhitelistCRUD.Tablica_Zaglavlje);
    });
  }

  /* ===== Punjenje / čišćenje ===== */
  function popuniIzObjekta(o) {
    var n = byId('edit_naziv'); if (n) n.value = o.naziv != null ? String(o.naziv) : '';
    var t = byId('edit_tablica'); if (t) { t.value = o.tablica != null ? String(o.tablica) : ''; refreshSelect('edit_tablica'); }
    popuniKolone(o.tablica, o.kolona);
    var tip = byId('edit_tip_podatka'); if (tip) { tip.value = (o.tip_podatka === 'slika') ? 'slika' : 'tekst'; refreshSelect('edit_tip_podatka'); }
    var nap = byId('edit_napomena'); if (nap) nap.value = o.napomena != null ? String(o.napomena) : '';
  }

  function clearForm() {
    var n = byId('edit_naziv'); if (n) n.value = '';
    var t = byId('edit_tablica'); if (t) { t.value = ''; refreshSelect('edit_tablica'); }
    popuniKolone('', '');
    var tip = byId('edit_tip_podatka'); if (tip) { tip.value = 'tekst'; refreshSelect('edit_tip_podatka'); }
    var nap = byId('edit_napomena'); if (nap) nap.value = '';
    if (n) n.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function sakupiParams() {
    return {
      naziv: trim(vEdit('naziv')),
      tablica: trim(vEdit('tablica')),
      kolona: trim(vEdit('kolona')),
      tip_podatka: trim(vEdit('tip_podatka')) || 'tekst',
      napomena: trim(vEdit('napomena'))
    };
  }

  /* ===== Selekcija reda ===== */
  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearForm(); }
    else {
      var o = izvoriPoId[String(id)];
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

  /* ===== Gumbi / stanje ===== */
  var btnUpisi = byId('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = byId('btnIzbrisi');

  function upisiMoguc() {
    return trim(vEdit('naziv')) !== '' && trim(vEdit('tablica')) !== '' && trim(vEdit('kolona')) !== '';
  }

  /* Prazan Naziv → ostale kontrole disable. */
  function azurirajDisable() {
    var imaNaziv = trim(vEdit('naziv')) !== '';
    ['edit_tablica', 'edit_kolona', 'edit_tip_podatka', 'edit_napomena'].forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      if (typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(el, imaNaziv);
      else { el.disabled = !imaNaziv; if (el.tagName === 'SELECT') refreshSelect(id); }
    });
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
    var t = byId('edit_tablica');
    if (t) t.addEventListener('change', function () { popuniKolone(t.value, ''); updateCrudUpisiState(); });
    var k = byId('edit_kolona');
    if (k) k.addEventListener('change', function () {
      /* predloži tip iz tipa kolone (BLOB → slika) */
      var tab = vEdit('tablica');
      if (tab && k.value) {
        var tip = byId('edit_tip_podatka');
        if (tip) { tip.value = blobZaKolonu(tab, k.value) ? 'slika' : 'tekst'; refreshSelect('edit_tip_podatka'); }
      }
      updateCrudUpisiState();
    });
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

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      if (!upisiMoguc()) { if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []); return; }
      var params = sakupiParams();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        params.id = String(id);
        postFormData(API_BASE + 'PDF_Whitelist_CRUD_izmjena.php', params, function (res) { obradiOdgovor(res, '004'); });
      } else {
        postFormData(API_BASE + 'PDF_Whitelist_CRUD_upis.php', params, function (res) { obradiOdgovor(res, '001'); });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'PDF_Whitelist_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearForm(); osvjeziTablicu();
            });
          }
        } else { porukaIzKoda(res); }
      });
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

  /* ===== Init ===== */
  ucitajMeta(function () {
    ucitajPodatkeTablica(function (rows) {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_WhitelistCRUD.Tablica_Zaglavlje);
    });
  });
  clearForm();
  updateCrudUpisiState();
  azurirajDisable();
})();
