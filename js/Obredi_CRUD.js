/* Obredi_CRUD.js – master forma (tablica + jedna kontrola)
 *
 * Blokovi:
 *   KONSTANTE       – ObrediCRUD (Broj_Kolona, Reload_Ikona, Tablica_Zaglavlje)
 *   ISCRTAVANJE     – CommonCRUD.initTablica() (0-Common.js); reload listener u FUNKCIONALNOSTI
 *   FUNKCIONALNOSTI – onCrudSelectionChange, tipke Upis/Izmjeni/Izbriši, reload
 *   CRUD FUNKCIONALNOST – API (ucitajPodatkeTablica, postFormData), osvjeziTablicu, setDataTablica, obrediAdd/Update/Delete
 *   OSTALO          – getSelectedRowId(), trim(), updateCrudUpisiState, window.ObrediCRUD
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Obredi_CRUD.html');

// ========== KONSTANTE ==========
// ObrediCRUD – jedinstveni objekt s konfiguracijom forme.
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
const ObrediCRUD = {
  Broj_Kolona: 1,   // Broj kolona u tablici (1–20). Default: 1
  Reload_Ikona: 0,  // 1 = header panela + ikona reload desno (učitavanje iz baze); 0 = nema. Default: 0
  CrudCssPrefix: 'obredi-crud',  // Prefiks CSS klasa za header/reload (CommonCRUD)
  Tablica_Zaglavlje: [
    { key: "naziv", title: "Naziv obreda", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
  ]
};

// ========== ISCRTAVANJE ==========
// Tablica i zaglavlje: CommonCRUD.initTablica (0-Common.js). tablicaApi se postavlja u onReady.

  /** Referenca na API kontrole tablice (setData, getData, getSelectedRowIds, ...). */
  var tablicaApi = null;

  /** Callback kad korisnik promijeni selekciju u tablici (postavlja se u FUNKCIONALNOSTI). */
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', ObrediCRUD, {
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  // Reload tipka: listener se dodaje u FUNKCIONALNOSTI (osvjeziTablicu je tamo definirana).

// ========== FUNKCIONALNOSTI ==========
// Reakcija na korisnika: promjena selekcije u tablici (onCrudSelectionChange), stanje tipki Upis/Izmjeni,
// reload tablice, klik na Upis (dodaj ili izmjena), klik na Izbriši. Koristi getSelectedRowId, updateCrudUpisiState.

  /** Kad tablica izgubi selekciju, obrišu se sadržaji svih kontrola popunjenih iz reda. */
  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_obred');
    if (editEl) {
      editEl.value = '';
      editEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /** Blok: onCrudSelectionChange – puni ili briše kontrole prema selektiranom redu; ažurira stanje tipki. */
  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
    } else {
      var editEl = document.getElementById('edit_obred');
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

  /** Klik na X (edit-delete clear): ukloni selekciju u tablici i ažuriraj stanje tipki. */
  (function () {
    var editEl = document.getElementById('edit_obred');
    var wrap = editEl && editEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateCrudUpisiState();
    });
  })();

  /** Referenca na tipku Upis (Izmjeni). */
  var btnUpisi = document.getElementById('btnUpisi');
  /** Label unutar tipke (tekst "Upis" / "Izmjeni"). */
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  /** Referenca na tipku Izbriši. */
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  /** Ažurira stanje tipki Upis i Izbriši: label/klasa Upis te disabled za obje (Izbriši = bez selektiranog reda, Upis = bez sadržaja u edit-delete). */
  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var editEl = document.getElementById('edit_obred');
    var imaSadrzaj = editEl ? trim(editEl.value) !== '' : false;

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      var lblUpis = imaSelekciju ? tt('global.gumb.izmijeni', 'Izmjeni') : tt('global.gumb.upis', 'Upis');
      btnUpisiLabel.textContent = lblUpis;
      btnUpisi.setAttribute('aria-label', lblUpis);
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) {
      btnIzbrisi.disabled = !imaSelekciju;
    }
  }

  /** Kad korisnik mijenja sadržaj edit-delete, ažuriraj disabled stanje tipke Upis. */
  (function () {
    var editEl = document.getElementById('edit_obred');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  /** Blok: Reload_Ikona = 1 – poveži klik na reload tipku s osvjeziTablicu. */
  if (ObrediCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  /** Blok: listener na Upis – validacija praznog naziva; ako je izmjena → obrediUpdate, inače obrediAdd; nakon OK prikaže poruku (004/001) i osvježi; inače prikaže modal greške. */
  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_obred');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        obrediUpdate(id, naziv, function (res) {
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
        obrediAdd(naziv, function (res) {
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

  /** Blok: listener na Izbriši – briše selektirani red; nakon OK prikaže poruku 003 i osvježi; inače prikaže modal greške. */
  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      obrediDelete(id, function (res) {
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

  /** Tipka Povratak: vraća na formu koja je pozvala (ref u URL-u ili document.referrer); u slučaju greške → Meni.php. */
  (function () {
    var btnPovratak = document.getElementById('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) {
        try {
          var u = new URL(ref, window.location.href);
          if (u.origin === window.location.origin) {
            window.location.href = u.href;
            return;
          }
        } catch (e) {}
      }
      if (document.referrer) {
        try {
          var u = new URL(document.referrer);
          if (u.origin === window.location.origin) {
            window.location.href = u.href;
            return;
          }
        } catch (e) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

// ========== CRUD FUNKCIONALNOST ==========
// Pristup bazi preko PHP skripti: ucitajPodatkeTablica (GET), postFormData (POST), osvjeziTablicu,
// setDataTablica (CommonCRUD.setDataTablica), obrediAdd, obrediUpdate, obrediDelete.
// Inicijalno učitavanje podataka pri učitavanju stranice na kraju bloka.

  /** Bazni path za PHP skripte (GET/POST). */
  var API_BASE = '../php/';

  /** Parsira odgovor PHP-a: "OK" | "100" | "106,1451" → { code, replacements } ili null ako nije kod. */
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '') return null;
    if (s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /** Blok: ucitajPodatkeTablica – GET Obredi_CRUD_sve.php, parsira JSON, vraća redove [ naziv, id ]; ako odgovor nije JSON (npr. 100, 200,123), prikaže modal i callback s praznim nizom. */
  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Obredi_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
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

  /** POST na url s params – koristi CommonPostFormData (0-Common.js). */
  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  /** Osvježi tablicu: učitaj podatke i postavi ih u tablicu (setDataTablica). */
  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
    });
  }

  /** Postavi podatke u tablicu i primijeni zaglavlje (CommonCRUD). */
  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, ObrediCRUD.Tablica_Zaglavlje);
  }

  /** Dodaj novi obred (POST Obredi_CRUD_upis.php, naziv). */
  function obrediAdd(naziv, callback) {
    postFormData(API_BASE + 'Obredi_CRUD_upis.php', { naziv: naziv }, callback);
  }

  /** Izmjena obreda (POST Obredi_CRUD_izmjena.php, id + naziv). */
  function obrediUpdate(id, naziv, callback) {
    postFormData(API_BASE + 'Obredi_CRUD_izmjena.php', { id: String(id), naziv: naziv }, callback);
  }

  /** Brisanje obreda (POST Obredi_CRUD_brisanje.php, id). */
  function obrediDelete(id, callback) {
    postFormData(API_BASE + 'Obredi_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  /** Blok: inicijalno učitavanje – učitaj podatke pri učitavanju stranice i postavi u tablicu. */
  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
  });

// ========== OSTALO ==========
// Pomoćne funkcije: getSelectedRowId (id selektiranog reda iz tablice), trim (uklanjanje razmaka).
// Na kraju: updateCrudUpisiState(), izvoz ObrediCRUD na window.

  /** Vraća id selektiranog reda (prvi iz getSelectedRowIds) ili null. */
  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  /** Alias za zajednički trim (0-Common.js). */
  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /** Jednokratno ažuriranje stanja tipki nakon učitavanja. */
  updateCrudUpisiState();
  /* Ponovi nakon DOMContentLoaded — tada je 0-Jezik.js (defer) već definirao window.vnlhT,
     pa dinamička labela (Upis/Izmjeni) dobije prijevod na ne-master jeziku. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCrudUpisiState);
  }

  /** Izvoz konfiguracije na window (npr. za testove ili druge skripte). */
  window.ObrediCRUD = ObrediCRUD;
})();
