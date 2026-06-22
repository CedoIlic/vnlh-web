/* PDF_Dozvoljeni_izvori_dokumenata_CRUD.js — tablica + edit za pdf_dozvoljeni_izvori_dokumenata.
 * Panel-tablica = uključene tablice; edit = selekt „Tablica" (puni se tablicama koje imaju `id`
 * i još nisu uključene) + „Napomena". Footer: Upis / Izbriši / Povratak (Upis→Izmjeni na selekciji).
 * API: PDF_Dozvoljeni_izvori_dokumenata_CRUD_slobodne/_sve/_upis/_izmjena/_brisanje.php.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Dozvoljeni_izvori_dokumenata_CRUD.html');

  var API_BASE = '../php/';

  var PDF_IzvDokCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-izvdok-crud',
    Tablica_Zaglavlje: [
      { key: 'tablica', title: 'Tablica', SQL_Naziv: 'tablica', sortable: 1, sortable_icon: 0, type: 't', width: -40, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'napomena', title: 'Napomena', SQL_Naziv: 'napomena', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
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

  /* ===== Slobodne tablice (za selekt) ===== */
  var SLOBODNE = [];   /* niz naziva tablica koje se mogu dodati */

  function popuniSlobodneSelekt() {
    var sel = byId('edit_tablica');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    SLOBODNE.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
    sel.value = '';
    sel.disabled = false;
    refreshSelect('edit_tablica');
  }

  /* Kod selekcije postojećeg reda: selekt prikazuje TU tablicu (nije u slobodnima) i zaključan je. */
  function prikaziFiksnuTablicu(tablica) {
    var sel = byId('edit_tablica');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    var opt = document.createElement('option');
    opt.value = tablica; opt.textContent = tablica;
    sel.appendChild(opt);
    sel.value = tablica;
    sel.disabled = true;
    refreshSelect('edit_tablica');
  }

  function ucitajSlobodne(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Dozvoljeni_izvori_dokumenata_CRUD_slobodne.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { SLOBODNE = JSON.parse(text); } catch (e) { SLOBODNE = []; }
      } else { SLOBODNE = []; porukaIzKoda(text); }
      if (cb) cb();
    };
    xhr.send();
  }

  /* ===== Tablica ===== */
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var redoviPoId = {};

  CommonCRUD.initTablica('tablicaContainer', PDF_IzvDokCRUD, {
    getRowId: function (row) { return row && row[2] != null ? row[2] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function redIzObjekta(o) {
    return [
      o.tablica != null ? o.tablica : '',
      o.napomena != null ? o.napomena : '',
      o.id != null ? o.id : 0
    ];
  }

  function ucitajPodatkeTablica(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Dozvoljeni_izvori_dokumenata_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      redoviPoId = {};
      if (text !== '' && text.charAt(0) !== '[') {
        porukaIzKoda(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) {
            var o = arr[j];
            if (o && o.id != null) redoviPoId[String(o.id)] = o;
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
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_IzvDokCRUD.Tablica_Zaglavlje);
    });
  }

  /* Nakon dodavanja/brisanja se mijenja popis slobodnih → osvježi i njega pa tablicu. */
  function osvjeziSve() {
    ucitajSlobodne(function () {
      osvjeziTablicu();
    });
  }

  /* ===== Punjenje / čišćenje ===== */
  function popuniIzObjekta(o) {
    prikaziFiksnuTablicu(o.tablica != null ? String(o.tablica) : '');
    var nap = byId('edit_napomena'); if (nap) nap.value = o.napomena != null ? String(o.napomena) : '';
  }

  function clearForm() {
    popuniSlobodneSelekt();
    var nap = byId('edit_napomena'); if (nap) nap.value = '';
  }

  /* ===== Selekcija reda ===== */
  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearForm(); }
    else {
      var o = redoviPoId[String(id)];
      if (o) popuniIzObjekta(o);
    }
    updateCrudUpisiState();
    azurirajDisable();
  };

  /* ===== Gumbi / stanje ===== */
  var btnUpisi = byId('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = byId('btnIzbrisi');

  function upisiMoguc() {
    return trim(vEdit('tablica')) !== '';
  }

  /* Napomena je editabilna tek kad je tablica odabrana (novi unos) ili je red selektiran. */
  function azurirajDisable() {
    var imaTablicu = trim(vEdit('tablica')) !== '';
    var nap = byId('edit_napomena');
    if (nap) {
      if (typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(nap, imaTablicu);
      else nap.disabled = !imaTablicu;
    }
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
    var t = byId('edit_tablica');
    if (t) t.addEventListener('change', function () { updateCrudUpisiState(); azurirajDisable(); });
    var nap = byId('edit_napomena');
    if (nap) nap.addEventListener('input', function () { updateCrudUpisiState(); });
  })();

  function sakupiParams() {
    return {
      tablica: trim(vEdit('tablica')),
      napomena: trim(vEdit('napomena'))
    };
  }

  function obradiOdgovor(res, kodUspjeha) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(kodUspjeha, [], function () {
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          clearForm(); osvjeziSve(); updateCrudUpisiState(); azurirajDisable();
        });
      } else { clearForm(); osvjeziSve(); updateCrudUpisiState(); azurirajDisable(); }
      return;
    }
    porukaIzKoda(res, res.indexOf('002') === 0 ? ['Tablica'] : null);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      if (!upisiMoguc()) { if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []); return; }
      var params = sakupiParams();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        postFormData(API_BASE + 'PDF_Dozvoljeni_izvori_dokumenata_CRUD_izmjena.php', { id: String(id), napomena: params.napomena }, function (res) { obradiOdgovor(res, '004'); });
      } else {
        postFormData(API_BASE + 'PDF_Dozvoljeni_izvori_dokumenata_CRUD_upis.php', params, function (res) { obradiOdgovor(res, '001'); });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'PDF_Dozvoljeni_izvori_dokumenata_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearForm(); osvjeziSve(); updateCrudUpisiState(); azurirajDisable();
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
  ucitajSlobodne(function () {
    popuniSlobodneSelekt();
    ucitajPodatkeTablica(function (rows) {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_IzvDokCRUD.Tablica_Zaglavlje);
    });
  });
  clearForm();
  updateCrudUpisiState();
  azurirajDisable();
})();
