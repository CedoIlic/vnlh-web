/* Drzave_Adrese_CRUD.js – tablica + jedna kontrola. Tablica: drzave_adresa. */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Drzave_Adrese_CRUD.html');

// ========== KONSTANTE ==========
// Drzave_AdreseCRUD – jedinstveni objekt s konfiguracijom forme.
// Prije dodavanja nove konstante treba je iskomentirati (dokumentirati u nastavku reda).
// Sve u jednom objektu da editor ne prijavi "cannot redeclare block-scoped variable".
//
// Veza s tablicom:
// - Tablica ima Broj_Kolona kolona.
// - Reload_Ikona = 1: dodaje se header panelu tablice; u headeru desno ikona za reload; funkcionalnost = ponovno učitavanje podataka iz baze. 0 = nema headera/ikone.
//
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
// =============================================================================
  const Drzave_AdreseCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'drzave-adrese-crud',
    Tablica_Zaglavlje: [
      { key: "naziv", title: "Naziv", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  /* Prijevod zaglavlja tablice iz jednog ključa (naslovi zarezom). 0-Jezik.js je sinkron → vnlhT je spreman ovdje;
     na master jeziku / bez prijevoda vraća originalne naslove. */
  if (window.vnlhTZaglavlje) {
    Drzave_AdreseCRUD.Tablica_Zaglavlje = window.vnlhTZaglavlje('drzave_adrese_crud.tablica.zaglavlje', Drzave_AdreseCRUD.Tablica_Zaglavlje);
  }

  CommonCRUD.initTablica('tablicaContainer', Drzave_AdreseCRUD, {
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) { editEl.value = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearControlsFromSelection(); }
    else {
      var editEl = document.getElementById('edit_naziv');
      if (editEl) {
        var data = tablicaApi.getData();
        for (var i = 0; i < data.length; i++) {
          if (data[i][1] == id) { editEl.value = data[i][0] != null ? data[i][0] : ''; break; }
        }
        editEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    updateCrudUpisiState();
  };

  (function () {
    var editEl = document.getElementById('edit_naziv');
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
    var imaSelekciju = getSelectedRowId() != null;
    var editEl = document.getElementById('edit_naziv');
    var imaSadrzaj = editEl ? trim(editEl.value) !== '' : false;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      var lblUpis = imaSelekciju ? tt('global.gumb.izmijeni', 'Izmjeni') : tt('global.gumb.upis', 'Upis');
      btnUpisiLabel.textContent = lblUpis;
      btnUpisi.setAttribute('aria-label', lblUpis);
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (Drzave_AdreseCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_naziv');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        drzaveAdreseUpdate(id, naziv, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            prikaziGresku(res);
          }
        });
      } else {
        drzaveAdreseAdd(naziv, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            prikaziGresku(res);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      drzaveAdreseDelete(id, function (res) {
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

  var API_BASE = '../php/';

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /** Prikaže modal greške iz PHP odgovora. Za 002 (duplikat) #1 = PREVEDENA labela kontrole koja je izazvala
   *  grešku (labela ima vlastiti i18n ključ → sadržaj #1 se ne prevodi zasebno). */
  function prikaziGresku(res) {
    var p = parseResponseCode(res);
    if (!p || typeof MODAL_MESSAGES === 'undefined' || !MODAL_MESSAGES[p.code] || typeof window.showPorukaModal !== 'function') return;
    var repl = p.replacements;
    if (p.code === '002') {
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      repl = [tt('drzave_adrese_crud.labela.naziv', 'Naziv')];
    }
    window.showPorukaModal(p.code, repl);
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Drzave_Adrese_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (text !== '' && text.charAt(0) !== '[') {
        prikaziGresku(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            rows.push([arr[i].naziv != null ? arr[i].naziv : '', arr[i].id != null ? arr[i].id : 0]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Drzave_AdreseCRUD.Tablica_Zaglavlje);
  }

  function drzaveAdreseAdd(naziv, callback) {
    postFormData(API_BASE + 'Drzave_Adrese_CRUD_upis.php', { naziv: naziv }, callback);
  }

  function drzaveAdreseUpdate(id, naziv, callback) {
    postFormData(API_BASE + 'Drzave_Adrese_CRUD_izmjena.php', { id: String(id), naziv: naziv }, callback);
  }

  function drzaveAdreseDelete(id, callback) {
    postFormData(API_BASE + 'Drzave_Adrese_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  updateCrudUpisiState();
  window.Drzave_AdreseCRUD = Drzave_AdreseCRUD;
})();
