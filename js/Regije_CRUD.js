/* =====================================================
   Regije_CRUD.js
   CRUD logika za Regije_CRUD.html: tablica regija po državi, edit-delete kontrola (naziv).
   =====================================================
   - Tablica: CommonCRUD.initTablica, podaci iz Regije_CRUD_sve.php?id_drzava=...
   - Države: select puni se iz Drzave_CRUD_sve.php (getDrzaveSveUrl).
   - Upis: POST Regije_CRUD_upis.php (id_drzava, naziv). Odgovori: OK | 100 | 105 | 109 | 200,<kod>
   - Izmjena: POST Regije_CRUD_izmjena.php (id, naziv). Odgovori: OK | 100 | 105 | 109 | 200,<kod>
   - Brisanje: POST Regije_CRUD_brisanje.php (id). Odgovori: OK | 100 | 105 | 106,<errno> | 200,<kod>
   - Poruke: parseResponseCode(res) + MODAL_MESSAGES (0-Poruke_Tekstovi.js), showPorukaModal (0-Kontrole.js).
   Ovisnosti: 0-Kontrole.js, 0-Common.js, 0-Poruke_Tekstovi.js (MODAL_MESSAGES, showPorukaModal); CommonCRUD.
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Regije_CRUD.html');

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
  const RegijeCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'regije-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Regija', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  /* Prijevod zaglavlja tablice iz jednog ključa (naslovi zarezom). 0-Jezik.js je sinkron → vnlhT je spreman ovdje;
     na master jeziku / bez prijevoda vraća originalne naslove. */
  if (window.vnlhTZaglavlje) {
    RegijeCRUD.Tablica_Zaglavlje = window.vnlhTZaglavlje('regije_crud.tablica.zaglavlje', RegijeCRUD.Tablica_Zaglavlje);
  }

  /** Prijevod teksta prazne opcije selecta države ("— Odaberi državu —"). */
  function tekstPraznaOpcija() {
    var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
    return tt('regije_crud.opcija.odaberi', '— Odaberi državu —');
  }

  CommonCRUD.initTablica('tablicaContainer', RegijeCRUD, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : (row && row[0]); },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var selectDrzava = document.getElementById('select_drzava');
  var editPanel = document.getElementById('edit_panel');
  var tablicaContainerEl = document.getElementById('tablicaContainer');

  /** Kad država nije izabrana: disable tablica, edit-delete i labela. Kad je izabrana: enable. Tipka Povratak nikad ne smije biti disabled. */
  function updateEnabledState() {
    var imaDrzavu = selectDrzava && trim(selectDrzava.value) !== '';
    var tableWrap = tablicaContainerEl && tablicaContainerEl.closest('.kontrola-tablica');
    if (tableWrap) {
      if (imaDrzavu) tableWrap.classList.remove('kontrola-tablica--disabled');
      else tableWrap.classList.add('kontrola-tablica--disabled');
    }
    if (editPanel && typeof KontroleSetEnabled === 'function') KontroleSetEnabled(editPanel, imaDrzavu);
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) { btnPovratak.disabled = false; btnPovratak.removeAttribute('disabled'); }
  }

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_regija');
    if (editEl) {
      editEl.value = '';
      editEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
    } else {
      var editEl = document.getElementById('edit_regija');
      if (editEl) {
        var data = tablicaApi.getData();
        for (var i = 0; i < data.length; i++) {
          if (data[i][1] == id) {
            editEl.value = data[i][0] != null ? data[i][0] : '';
            break;
          }
        }
        editEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    updateCrudUpisiState();
  };

  (function () {
    var editEl = document.getElementById('edit_regija');
    var wrap = editEl && editEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateCrudUpisiState();
    });
  })();

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    var imaDrzavu = selectDrzava && trim(selectDrzava.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;
    var editEl = document.getElementById('edit_regija');
    var imaSadrzaj = editEl ? trim(editEl.value) !== '' : false;

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      var lblUpis = imaSelekciju ? tt('global.gumb.izmijeni', 'Izmjeni') : tt('global.gumb.upis', 'Upis');
      btnUpisiLabel.textContent = lblUpis;
      btnUpisi.setAttribute('aria-label', lblUpis);
      btnUpisi.disabled = !imaDrzavu || !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var editEl = document.getElementById('edit_regija');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  var API_BASE = '../php/';

  /** URL za Drzave_CRUD_sve.php – apsolutni put (kao getObrediSveUrl u Loze_Tip_CRUD). */
  function getDrzaveSveUrl() {
    var path = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + path + '/php/Drzave_CRUD_sve.php';
  }

  /** URL za Regije_CRUD_sve.php – apsolutni put. */
  function getRegijeSveUrl() {
    var path = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + path + '/php/Regije_CRUD_sve.php';
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, RegijeCRUD.Tablica_Zaglavlje);
  }

  /** Punjenje selecta države – način kao u Loze_Tip_CRUD (ucitajObrede): apsolutni URL, XHR, refresh custom selecta. */
  function ucitajDrzave(selectEl, callback) {
    var sel = selectEl || selectDrzava;
    if (!sel) {
      if (callback) callback();
      return;
    }
    var url = getDrzaveSveUrl();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (xhr.status !== 200) {
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        var opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = tekstPraznaOpcija();
        sel.appendChild(opt0);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        if (callback) callback();
        return;
      }
      if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        var optEmpty = document.createElement('option');
        optEmpty.value = '';
        optEmpty.textContent = tekstPraznaOpcija();
        sel.appendChild(optEmpty);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        if (callback) callback();
        return;
      }
      var options = [];
      try {
        options = JSON.parse(text || '[]') || [];
      } catch (e) { options = []; }

      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var optEmpty = document.createElement('option');
      optEmpty.value = '';
      optEmpty.textContent = tekstPraznaOpcija();
      sel.appendChild(optEmpty);

      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = o.naziv != null ? String(o.naziv) : '';
        sel.appendChild(opt);
      }

      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
      if (callback) callback();
    };
    xhr.send();
  }

  function ucitajPodatkeTablica(idDrzava, callback) {
    if (!idDrzava) { if (callback) callback([]); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getRegijeSveUrl() + '?id_drzava=' + encodeURIComponent(idDrzava), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            rows.push([arr[i].naziv != null ? arr[i].naziv : '', arr[i].id != null ? arr[i].id : 0]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    var idDrzava = selectDrzava ? trim(selectDrzava.value) : '';
    ucitajPodatkeTablica(idDrzava, function (rows) {
      setDataTablica(rows);
    });
  }

  if (selectDrzava) {
    selectDrzava.addEventListener('change', function () {
      updateEnabledState();
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      clearControlsFromSelection();
      osvjeziTablicu();
      updateCrudUpisiState();
    });
    /** Pri kliku na select (ili wrapper kod custom selecta): ako nema niti jedne države, prikaži poruku 016. */
    function onSelectDrzavaClick() {
      if (selectDrzava.options.length <= 1 && typeof window.showPorukaModal === 'function') {
        window.showPorukaModal('016', []);
      }
    }
    selectDrzava.addEventListener('click', onSelectDrzavaClick);
    var selectWrap = selectDrzava.closest('.kontrola-select');
    if (selectWrap) selectWrap.addEventListener('click', onSelectDrzavaClick);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_regija');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var idDrzava = selectDrzava ? trim(selectDrzava.value) : '';
      if (!idDrzava) return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        postFormData(API_BASE + 'Regije_CRUD_izmjena.php', { id: String(id), naziv: naziv }, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      } else {
        postFormData(API_BASE + 'Regije_CRUD_upis.php', { id_drzava: idDrzava, naziv: naziv }, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'Regije_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
            if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
            clearControlsFromSelection();
            osvjeziTablicu();
          });
        } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
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

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  ucitajDrzave(selectDrzava, function () {
    updateEnabledState();
  });
  setDataTablica([]);
  updateEnabledState();
  updateCrudUpisiState();

  window.RegijeCRUD = RegijeCRUD;
})();
