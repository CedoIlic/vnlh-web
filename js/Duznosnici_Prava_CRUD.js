/* Duznosnici_Prava_CRUD.js – forma prava dužnosnika.
   Zaglavlje panela tablice: labela "Dužnosnik" lijevo od selecta, select dužnosnici, desno ikona reload.
   Reload_Ikona: 1 u konstantama = CommonCRUD dodaje reload tipku u zaglavlje; funkcionalnost = ponovno učitavanje podataka.
   Tablica: A. (checkbox 1/0), Naziv (20%), Opis. Footer: Upis, Izbriši, Povratak.
   API: Duznosnici_CRUD_sve.php (za select), Duznosnici_Prava_CRUD_sve.php, _upis.php, _brisanje.php (kada budu dostupni).
*/
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Duznosnici_Prava_CRUD.html');

  var API_BASE = '../php/';
  /** null = još nije učitano; sadržaj kolone varijabla za sustav_varijable.id = 1001. */
  var cachedSustavVar1001 = null;
  var sustav1001Loading = false;
  var sustav1001PendingCallbacks = [];

  /* --- Zaglavlje tablice ---
     Lijevo: labela "Dužnosnik" + select za odabir dužnosnika.
     Desno: ikona reload (dodaje CommonCRUD.initTablica kad Reload_Ikona === 1).
     Select filtrira podatke – pri promjeni učitavaju se prava za odabranog dužnosnika. */

  // Tablica_Zaglavlje – svaka kolona je objekt sa parametrima:
  // 1) key (string) - Jedinstveni ključ kolone.
  // 2) title (string) - Tekst u zaglavlju kolone (THEAD).
  // 3) SQL_Naziv (string) - Naziv podatka koji vraća PHP. Ako nije upisan = prvi podatak iza id. id = ključ sloga, skriveni podatak u redu tablice.
  // 4) sortable (0 | 1) - 1 = kolona se može sortirati klikom na zaglavlje; 0 = nije sortabilna, hover na zaglavlju te kolone ne radi.
  // 5) sortable_icon (0 | 1) - 1 = iscrtava se sort ikona u zaglavlju (pravila: align L ili C → ikona uz desni rub ćelije; align R → ikona uz lijevi rub kolone). Default: 0.
  // 6) type ("t" | "n" | "d" | "b") - Tip podataka u koloni: "t" = tekst, "n" = broj, "d" = datum, "b" = binarno. Koristi se npr. da se datum sortira kao datum, broj kao broj, ne kao string.
  // 7) width (number) - Širina te kolone: 0 = auto; < 0 = abs(width) % ukupne širine tablice (npr. -20 → 20%); > 0 = fiksno u px (npr. 30 → 30px).
  // 8) suffix (string) - Dodatak uz prikaz podatka (npr. " €", "%", " kom").
  // 9) align ("L" | "C" | "R") - Orijentacija teksta u zaglavlju tablice: L = lijevo, C = centar, R = desno.
  // 10) row_align ("L" | "C" | "R") - Orijentacija sadržaja u redovima tablice: L = lijevo, C = centar, R = desno.
  // 11) mobitel_prikaz (0–255, default 1) - Prikaz kolone na mobilnim uređajima. 0 = ne prikazuje se, 1 = prikazuje se. Primjenjuje se pri sužavanju (npr. kada kolone grida idu jedna iznad druge).
  // 12) cell_readonly (0 | 1) - Za type "b": 1 = checkbox nije klikabilan (samo prikaz). Default: 0.
  //
  const Duznosnici_PravaCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 1,
    CrudCssPrefix: 'duznosnici-prava-crud',
    Tablica_Zaglavlje: [
      { key: 'a', title: 'A.', SQL_Naziv: 'aktivno', sortable: 0, sortable_icon: 0, type: 'b', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 0 },
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: -20, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 0 },
      { key: 'opis', title: 'Opis', SQL_Naziv: 'opis', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var duznosniciLista = [];
  /** Izvorno stanje checkboxova kad su podaci učitani: { meniId: 0|1 } */
  var originalCheckboxState = {};

  CommonCRUD.initTablica('tablicaContainer', Duznosnici_PravaCRUD, {
    getRowId: function (row) { return row && row.length > 3 ? row[3] : (row && row[2]); },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); },
    onReloadClick: osvjeziTablicu
  });

  var selectDuznosnik = document.getElementById('select_duznosnik');
  var tablicaContainerEl = document.getElementById('tablicaContainer');

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return (s == null || typeof s !== 'string') ? '' : s.trim();
  }

  function ucitajSustavVar1001(callback) {
    if (cachedSustavVar1001 !== null) {
      if (callback) callback();
      return;
    }
    if (typeof callback === 'function') sustav1001PendingCallbacks.push(callback);
    if (sustav1001Loading) return;
    sustav1001Loading = true;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'common_sustav_varijable.php?id=1001', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var t = (xhr.responseText || '').trim();
      if (t === '120' || t === '100' || t === '401') cachedSustavVar1001 = '0';
      else cachedSustavVar1001 = t;
      sustav1001Loading = false;
      var cbs = sustav1001PendingCallbacks.slice();
      sustav1001PendingCallbacks = [];
      for (var i = 0; i < cbs.length; i++) try { cbs[i](); } catch (e) {}
    };
    xhr.send();
  }

  function updateFooterSveButton() {
    var btn = document.getElementById('btnSvePrava');
    if (!btn) return;
    var imaDuznosnika = selectDuznosnik && trim(selectDuznosnik.value) !== '';
    var prikazi = imaDuznosnika && cachedSustavVar1001 !== null && String(cachedSustavVar1001).trim() === '1';
    if (prikazi) btn.removeAttribute('hidden');
    else btn.setAttribute('hidden', '');
  }

  /** Ako su svi checkboxovi u prvoj koloni uključeni → isključi sve, inače uključi sve (samo enabled). */
  function toggleSveCheckboxePrvaKolona() {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    var rows = container.querySelectorAll('tbody tr[data-row-id]');
    var list = [];
    for (var i = 0; i < rows.length; i++) {
      var chk = rows[i].querySelector('input.kontrola-checkbox[type="checkbox"]');
      if (chk && !chk.disabled) list.push(chk);
    }
    if (!list.length) return;
    var sviUkljuceni = list.every(function (c) { return c.checked; });
    for (var j = 0; j < list.length; j++) list[j].checked = !sviUkljuceni;
    updateCrudUpisiState();
  }

  function updateEnabledState() {
    var imaDuznosnika = selectDuznosnik && trim(selectDuznosnik.value) !== '';
    var tableWrap = tablicaContainerEl && tablicaContainerEl.closest('.kontrola-tablica');
    if (tableWrap) {
      if (imaDuznosnika) tableWrap.classList.remove('kontrola-tablica--disabled');
      else tableWrap.classList.add('kontrola-tablica--disabled');
    }
    var btnUpisi = document.getElementById('btnUpisi');
    var btnIzbrisi = document.getElementById('btnIzbrisi');
    if (btnUpisi) btnUpisi.disabled = !imaDuznosnika;
    if (btnIzbrisi) btnIzbrisi.disabled = !imaDuznosnika;
    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) { btnPovratak.disabled = false; btnPovratak.removeAttribute('disabled'); }
    if (trim(selectDuznosnik && selectDuznosnik.value) !== '') {
      ucitajSustavVar1001(updateFooterSveButton);
    } else {
      updateFooterSveButton();
    }
  }

  function ucitajDuznosnici(callback) {
    var url = API_BASE + 'Duznosnici_CRUD_sve.php';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) { if (callback) callback([]); return; }
      try {
        var arr = JSON.parse(xhr.responseText);
        duznosniciLista = Array.isArray(arr) ? arr : [];
        var sel = document.getElementById('select_duznosnik');
        if (sel) {
          while (sel.options.length > 1) sel.remove(1);
          for (var i = 0; i < duznosniciLista.length; i++) {
            var opt = document.createElement('option');
            opt.value = String(duznosniciLista[i].id);
            opt.textContent = duznosniciLista[i].naziv != null ? duznosniciLista[i].naziv : '';
            sel.appendChild(opt);
          }
          if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_duznosnik');
        }
        if (callback) callback(duznosniciLista);
      } catch (e) { if (callback) callback([]); }
    };
    xhr.send();
  }

  function ucitajPrava(idDuznosnik, callback) {
    var url = API_BASE + 'Duznosnici_Prava_CRUD_sve.php?id_duznosnik=' + encodeURIComponent(String(idDuznosnik || ''));
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) { if (callback) callback([]); return; }
      try {
        var arr = JSON.parse(xhr.responseText);
        arr = Array.isArray(arr) ? arr : [];
        if (callback) callback(arr);
      } catch (e) { if (callback) callback([]); }
    };
    xhr.send();
  }

  function pretvoriUPodatkeTablica(arr) {
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      var a = (r.aktivno == 1 || r.aktivno === true) ? 1 : 0;
      var naziv = r.naziv != null ? r.naziv : '';
      var opis = r.opis != null ? r.opis : '';
      var id = r.id != null ? r.id : (i + 1);
      rows.push([a, naziv, opis, id]);
    }
    return rows;
  }

  function osvjeziTablicu() {
    if (!tablicaApi || typeof CommonCRUD.setDataTablica !== 'function') return;
    var id = selectDuznosnik ? trim(selectDuznosnik.value) : '';
    if (id === '') {
      originalCheckboxState = {};
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], Duznosnici_PravaCRUD.Tablica_Zaglavlje);
      updateEnabledState();
      updateCrudUpisiState();
      return;
    }
    ucitajPrava(id, function (arr) {
      var rows = pretvoriUPodatkeTablica(arr);
      originalCheckboxState = {};
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var rid = r[3];
        if (rid != null) originalCheckboxState[String(rid)] = r[0] === 1 ? 1 : 0;
      }
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Duznosnici_PravaCRUD.Tablica_Zaglavlje);
      updateEnabledState();
      updateCrudUpisiState();
    });
  }

  onCrudSelectionChange = function () {
    updateCrudUpisiState();
  };

  function getCurrentCheckboxState() {
    var out = {};
    var container = document.getElementById('tablicaContainer');
    if (!container) return out;
    var rows = container.querySelectorAll('tbody tr[data-row-id]');
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      var rid = tr.dataset.rowId;
      if (rid == null) continue;
      var chk = tr.querySelector('input.kontrola-checkbox[type="checkbox"]');
      if (chk) out[rid] = chk.checked ? 1 : 0;
    }
    return out;
  }

  function hasCheckboxChanges() {
    var current = getCurrentCheckboxState();
    if (Object.keys(current).length === 0) return false;
    var keys = Object.keys(originalCheckboxState);
    for (var i = 0; i < keys.length; i++) {
      if ((current[keys[i]] || 0) !== originalCheckboxState[keys[i]]) return true;
    }
    keys = Object.keys(current);
    for (i = 0; i < keys.length; i++) {
      if ((originalCheckboxState[keys[i]] || 0) !== (current[keys[i]] || 0)) return true;
    }
    return false;
  }

  function updateCrudUpisiState() {
    var imaDuznosnika = selectDuznosnik && trim(selectDuznosnik.value) !== '';
    var imaPromjenu = hasCheckboxChanges();
    var btnUpisi = document.getElementById('btnUpisi');
    var btnIzbrisi = document.getElementById('btnIzbrisi');
    if (btnUpisi) btnUpisi.disabled = !imaDuznosnika || !imaPromjenu;
    if (btnIzbrisi) btnIzbrisi.disabled = !imaDuznosnika;
  }

  if (Duznosnici_PravaCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  (function () {
    var btnSve = document.getElementById('btnSvePrava');
    if (btnSve) btnSve.addEventListener('click', toggleSveCheckboxePrvaKolona);
  })();

  if (selectDuznosnik) {
    selectDuznosnik.addEventListener('change', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      osvjeziTablicu();
    });
  }

  (function () {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    container.addEventListener('change', function (e) {
      if (e.target && e.target.matches && e.target.matches('input.kontrola-checkbox[type="checkbox"]')) {
        updateCrudUpisiState();
      }
    });
  })();

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else if (callback) callback('');
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  var btnUpisi = document.getElementById('btnUpisi');
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var idDuznosnik = selectDuznosnik ? trim(selectDuznosnik.value) : '';
      if (!idDuznosnik) return;
      if (!hasCheckboxChanges()) return;
      var current = getCurrentCheckboxState();
      var pravaIds = [];
      for (var k in current) if (current.hasOwnProperty(k) && current[k] === 1) pravaIds.push(k);
      postFormData(API_BASE + 'Duznosnici_Prava_CRUD_upis.php', {
        id_duznosnik: idDuznosnik,
        prava: pravaIds.join(',')
      }, function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          originalCheckboxState = current;
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
            osvjeziTablicu();
            updateCrudUpisiState();
          });
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements || []);
          }
        }
      });
    });
  }
  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var idDuznosnik = selectDuznosnik ? trim(selectDuznosnik.value) : '';
      if (!idDuznosnik) return;
      if (typeof window.showPorukaModal !== 'function') return;
      if (typeof MODAL_MESSAGES === 'undefined' || !MODAL_MESSAGES['122']) return;
      window.showPorukaModal('122', [], function (buttonKey) {
        if (buttonKey !== 'OK') return;
        postFormData(API_BASE + 'Duznosnici_Prava_CRUD_brisanje.php', { id_duznosnik: idDuznosnik }, function (res) {
          res = (res || '').trim();
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
              osvjeziTablicu();
              updateCrudUpisiState();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(p.code, p.replacements || []);
            }
          }
        });
      });
    });
  }

  (function () {
    var btnPovratak = document.getElementById('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) {
        try {
          var u = new URL(ref, window.location.href);
          if (u.origin === window.location.origin) { window.location.href = u.href; return; }
        } catch (e) {}
      }
      if (document.referrer) {
        try {
          var u = new URL(document.referrer);
          if (u.origin === window.location.origin) { window.location.href = u.href; return; }
        } catch (e) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  ucitajSustavVar1001(function () {
    updateFooterSveButton();
  });

  ucitajDuznosnici(function () {
    osvjeziTablicu();
    updateEnabledState();
  });

})();
