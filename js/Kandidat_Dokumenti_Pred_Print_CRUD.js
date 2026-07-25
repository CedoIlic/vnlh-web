/* Kandidat_Dokumenti_Pred_Print_CRUD.js — šifarnik dokumenata za pred-print.
   Tablica: kandidat_dokumenti_pred_print. Redak veže PDF dokument (pdf_dokument) na izvornu
   tablicu; forma kandidata kasnije prosljeđuje generatoru tekući id te tablice.
   Izvor se bira SAMO s bijele liste (pdf_dozvoljeni_izvori_dokumenata); pri izboru dokumenta
   izvor se predlaže iz razvoj_tablica/razvoj_kolona tog dokumenta (spriječi krivi par). */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Kandidat_Dokumenti_Pred_Print_CRUD.html');

// ========== KONSTANTE ==========
// Tablica: Red, Naziv u tablici, Dokument, Izvor tablica, Aktivan (checkbox, samo prikaz);
// id je skriveni zadnji element retka.
// =============================================================================
  const Pred_PrintCRUD = {
    Broj_Kolona: 5,
    Reload_Ikona: 0,
    CrudCssPrefix: 'kandidat-dokumenti-pred-print-crud',
    Tablica_Zaglavlje: [
      { key: "redosljed", title: "Red", SQL_Naziv: "redosljed", sortable: 1, sortable_icon: 0, type: "n", width: 70, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
      { key: "naziv", title: "Naziv u tablici", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "dokument", title: "Dokument", SQL_Naziv: "dokument_naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "izvor_tablica", title: "Izvor tablica", SQL_Naziv: "izvor_tablica", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 0 },
      { key: "aktivan", title: "Aktivan", SQL_Naziv: "aktivan", sortable: 1, sortable_icon: 0, type: "b", width: 100, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1, cell_readonly: 1 },
    ]
  };

  var API_BASE = '../php/';
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var zapisiPoId = {};        /* id retka → cijeli zapis iz baze (edit panel treba i polja izvan tablice) */
  var dokumentiPoId = {};     /* id dokumenta → { razvoj_tablica, razvoj_kolona } — za prefill izvora */
  var izvoriDozvoljeni = {};  /* naziv tablice → 1 (bijela lista) */
  var kolonePoTablici = {};   /* naziv tablice → [kolone] (keš, da se ne dohvaća pri svakoj selekciji) */

  if (window.vnlhTZaglavlje) {
    Pred_PrintCRUD.Tablica_Zaglavlje = window.vnlhTZaglavlje('kandidat_dokumenti_pred_print_crud.tablica.zaglavlje', Pred_PrintCRUD.Tablica_Zaglavlje);
  }

  CommonCRUD.initTablica('tablicaContainer', Pred_PrintCRUD, {
    /* id je skriveni zadnji element retka; selekcija ide po njemu. */
    getRowId: function (row) { return row && row[5] != null ? row[5] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var elDokument    = document.getElementById('edit_dokument');
  var elNaziv       = document.getElementById('edit_naziv');
  var elRedosljed   = document.getElementById('edit_redosljed');
  var elAktivan     = document.getElementById('edit_aktivan');
  var elIzvorTab    = document.getElementById('edit_izvor_tablica');
  var elIzvorKol    = document.getElementById('edit_izvor_kolona');
  var elNapomena    = document.getElementById('edit_napomena');

  var btnUpisi      = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi    = document.getElementById('btnIzbrisi');

  /* Numerički edit (cijeli broj 0–100). */
  if (elRedosljed && typeof window.CommonNumericValidation === 'function') window.CommonNumericValidation(elRedosljed, 0, 100, true);

  /* ===== Padajući izbornici ===== */

  function osvjeziSelect(el) {
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect(el);
  }

  function puniSelect(el, opcije, placeholder) {
    if (!el) return;
    var cur = el.value;
    while (el.firstChild) el.removeChild(el.firstChild);
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    el.appendChild(opt0);
    for (var i = 0; i < opcije.length; i++) {
      var o = document.createElement('option');
      o.value = opcije[i].value;
      o.textContent = opcije[i].text;
      el.appendChild(o);
    }
    el.value = cur;
    if (el.value !== cur) el.value = '';
    osvjeziSelect(el);
  }

  function ucitajDokumente(callback) {
    var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Kandidat_Dokumenti_Pred_Print_CRUD_dokumenti.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var opcije = [];
      dokumentiPoId = {};
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            var id = arr[i].id != null ? String(arr[i].id) : '';
            if (id === '') continue;
            opcije.push({ value: id, text: arr[i].naziv != null ? arr[i].naziv : '' });
            dokumentiPoId[id] = {
              razvoj_tablica: arr[i].razvoj_tablica != null ? arr[i].razvoj_tablica : '',
              razvoj_kolona: arr[i].razvoj_kolona != null ? arr[i].razvoj_kolona : ''
            };
          }
        } catch (e) {}
      } else {
        prikaziGresku(text);
      }
      puniSelect(elDokument, opcije, tt('kandidat_dokumenti_pred_print_crud.opcija.dokument', '— odaberi dokument —'));
      if (callback) callback();
    };
    xhr.send();
  }

  function ucitajIzvore(callback) {
    var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Kandidat_Dokumenti_Pred_Print_CRUD_izvori.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var opcije = [];
      izvoriDozvoljeni = {};
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            var t = arr[i].tablica != null ? String(arr[i].tablica) : '';
            if (t === '') continue;
            opcije.push({ value: t, text: t });
            izvoriDozvoljeni[t] = 1;
          }
        } catch (e) {}
      } else {
        prikaziGresku(text);
      }
      puniSelect(elIzvorTab, opcije, tt('kandidat_dokumenti_pred_print_crud.opcija.izvor', '— odaberi izvor —'));
      if (callback) callback();
    };
    xhr.send();
  }

  /* Kolone izabrane izvorne tablice (stvarne kolone iz information_schema) → „Izvor kolona".
     zeljena = vrijednost koju treba postaviti (iz zapisa); ako je nema, uzima se 'id'. */
  function ucitajKolone(tablica, zeljena, callback) {
    var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
    var placeholder = tt('kandidat_dokumenti_pred_print_crud.opcija.kolona', '— odaberi kolonu —');

    function postavi(kolone) {
      var opcije = [];
      for (var i = 0; i < kolone.length; i++) opcije.push({ value: kolone[i], text: kolone[i] });
      puniSelect(elIzvorKol, opcije, placeholder);
      if (!elIzvorKol) { if (callback) callback(); return; }
      var zeli = zeljena != null ? String(zeljena) : '';
      if (zeli !== '' && kolone.indexOf(zeli) < 0) zeli = '';
      if (zeli === '' && kolone.indexOf('id') >= 0) zeli = 'id';   /* ključ je po konvenciji id */
      elIzvorKol.value = zeli;
      osvjeziSelect(elIzvorKol);
      if (callback) callback();
    }

    if (tablica === '') { postavi([]); return; }
    if (kolonePoTablici[tablica]) { postavi(kolonePoTablici[tablica]); return; }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Dozvoljeni_izvori_dokumenata_CRUD_kolone_tablice.php?tablica=' + encodeURIComponent(tablica), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var kolone = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { kolone = JSON.parse(text) || []; } catch (e) { kolone = []; }
      }
      kolonePoTablici[tablica] = kolone;
      postavi(kolone);
    };
    xhr.send();
  }

  /* ===== Edit panel ===== */

  function ocistiKontrole() {
    if (elDokument) { elDokument.value = ''; osvjeziSelect(elDokument); }
    if (elNaziv) { elNaziv.value = ''; elNaziv.dispatchEvent(new Event('input', { bubbles: true })); }
    if (elRedosljed) elRedosljed.value = '';
    if (elAktivan) elAktivan.checked = true;
    if (elIzvorTab) { elIzvorTab.value = ''; osvjeziSelect(elIzvorTab); }
    ucitajKolone('', '');
    if (elNapomena) elNapomena.value = '';
  }

  function popuniIzZapisa(z) {
    if (!z) return;
    if (elDokument) { elDokument.value = z.id_dokument != null ? String(z.id_dokument) : ''; osvjeziSelect(elDokument); }
    if (elNaziv) { elNaziv.value = z.naziv != null ? z.naziv : ''; elNaziv.dispatchEvent(new Event('input', { bubbles: true })); }
    if (elRedosljed) elRedosljed.value = z.redosljed != null ? String(z.redosljed) : '';
    if (elAktivan) elAktivan.checked = String(z.aktivan) === '1';
    if (elIzvorTab) { elIzvorTab.value = z.izvor_tablica != null ? z.izvor_tablica : ''; osvjeziSelect(elIzvorTab); }
    ucitajKolone(z.izvor_tablica != null ? z.izvor_tablica : '', z.izvor_kolona, updateCrudUpisiState);
    if (elNapomena) elNapomena.value = z.napomena != null ? z.napomena : '';
  }

  /* Prijedlog izvorne tablice iz razvojnog konteksta dokumenta — samo u prazno polje.
     Dokument je razvijan nad tim slogom, pa je to gotovo uvijek točan par.
     Kolona se NE preuzima iz razvoj_kolona (ondje je to kolona za pretragu testnog sloga,
     npr. naslov_eseja) — ključ je po konvenciji id, što ucitajKolone i predlaže. */
  function predloziIzvorIzDokumenta() {
    var id = elDokument ? trim(elDokument.value) : '';
    if (id === '') return;
    var d = dokumentiPoId[id];
    if (!d) return;
    if (elIzvorTab && trim(elIzvorTab.value) === '' && d.razvoj_tablica && izvoriDozvoljeni[d.razvoj_tablica]) {
      elIzvorTab.value = d.razvoj_tablica;
      osvjeziSelect(elIzvorTab);
      ucitajKolone(d.razvoj_tablica, '', updateCrudUpisiState);
    }
  }

  function postaviLabeluDisabled(forId, disabled) {
    var lbl = document.querySelector('label[for="' + forId + '"]');
    if (lbl) lbl.classList.toggle('kontrola-labela--disabled', !!disabled);
  }

  /* Disable pojedine kontrole. Kod edit-delete nije dovoljno ugasiti input: wrapper nosi
     vizual (--disabled) i tipka × ostaje klikabilna — zato oboje ide ovdje. */
  function postaviKontroluDisabled(el, disabled) {
    if (!el) return;
    el.disabled = !!disabled;
    var wrap = el.closest ? el.closest('.kontrola-edit-delete') : null;
    if (!wrap) return;
    var clearBtn = wrap.querySelector('.kontrola-edit-delete__clear');
    if (clearBtn) clearBtn.disabled = !!disabled;
    wrap.classList.toggle('kontrola-edit-delete--disabled', !!disabled);
  }

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var imaNaziv     = elNaziv ? trim(elNaziv.value) !== '' : false;
    var imaDokument  = elDokument ? trim(elDokument.value) !== '' : false;
    var imaIzvor     = elIzvorTab ? trim(elIzvorTab.value) !== '' : false;

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      var lbl = imaSelekciju ? tt('global.gumb.izmijeni', 'Izmjeni') : tt('global.gumb.upis', 'Upis');
      btnUpisiLabel.textContent = lbl;
      btnUpisi.setAttribute('aria-label', lbl);
      /* Obavezno: naziv + dokument + izvorna tablica. */
      btnUpisi.disabled = !(imaNaziv && imaDokument && imaIzvor);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;

    /* Naziv je vodeća kontrola: ostalo se otvara tek kad je upisan (ili je redak selektiran). */
    var omoguceno = imaSelekciju || imaNaziv;
    var kontrole = [
      { el: elDokument, id: 'edit_dokument' },
      { el: elRedosljed, id: 'edit_redosljed' },
      { el: elAktivan, id: 'edit_aktivan' },
      { el: elIzvorTab, id: 'edit_izvor_tablica' },
      { el: elIzvorKol, id: 'edit_izvor_kolona' },
      { el: elNapomena, id: 'edit_napomena' }
    ];
    for (var i = 0; i < kontrole.length; i++) {
      postaviKontroluDisabled(kontrole[i].el, !omoguceno);
      postaviLabeluDisabled(kontrole[i].id, !omoguceno);
    }
    if (elDokument) osvjeziSelect(elDokument);
    if (elIzvorTab) osvjeziSelect(elIzvorTab);
    if (elIzvorKol) osvjeziSelect(elIzvorKol);
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) ocistiKontrole();
    else popuniIzZapisa(zapisiPoId[String(id)]);
    updateCrudUpisiState();
  };

  if (elDokument) {
    elDokument.addEventListener('change', function () {
      predloziIzvorIzDokumenta();
      updateCrudUpisiState();
    });
  }
  if (elIzvorTab) {
    elIzvorTab.addEventListener('change', function () {
      /* Ponuda kolona uvijek prati izabranu tablicu; ključ se predlaže kao id. */
      ucitajKolone(trim(elIzvorTab.value), '', updateCrudUpisiState);
      updateCrudUpisiState();
    });
  }
  if (elNaziv) {
    elNaziv.addEventListener('input', updateCrudUpisiState);
    elNaziv.addEventListener('change', updateCrudUpisiState);
  }
  if (elIzvorKol) elIzvorKol.addEventListener('change', updateCrudUpisiState);

  /* × na „Naziv" = izlaz iz izmjene: pušta selekciju retka i vraća panel na novi unos. */
  (function () {
    var wrap = elNaziv && elNaziv.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      ocistiKontrole();
      updateCrudUpisiState();
    });
  })();

  /* ===== CRUD tipke ===== */

  function skupiPodatke() {
    return {
      id_dokument: elDokument ? trim(elDokument.value) : '',
      naziv: elNaziv ? trim(elNaziv.value) : '',
      izvor_tablica: elIzvorTab ? trim(elIzvorTab.value) : '',
      izvor_kolona: elIzvorKol ? trim(elIzvorKol.value) : '',
      redosljed: elRedosljed ? trim(elRedosljed.value) : '',
      aktivan: (elAktivan && elAktivan.checked) ? '1' : '0',
      napomena: elNapomena ? trim(elNapomena.value) : ''
    };
  }

  function nakonUspjeha(kod) {
    if (typeof window.showPorukaModal !== 'function') { osvjeziTablicu(); return; }
    window.showPorukaModal(kod, [], function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      ocistiKontrole();
      updateCrudUpisiState();
      osvjeziTablicu();
    });
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var p = skupiPodatke();
      if (p.id_dokument === '' || p.izvor_tablica === '') return;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        p.id = String(id);
        postFormData(API_BASE + 'Kandidat_Dokumenti_Pred_Print_CRUD_izmjena.php', p, function (res) {
          if (res === 'OK') nakonUspjeha('004'); else prikaziGresku(res);
        });
      } else {
        postFormData(API_BASE + 'Kandidat_Dokumenti_Pred_Print_CRUD_upis.php', p, function (res) {
          if (res === 'OK') nakonUspjeha('001'); else prikaziGresku(res);
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'Kandidat_Dokumenti_Pred_Print_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') nakonUspjeha('003'); else prikaziGresku(res);
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
          var u2 = new URL(document.referrer);
          if (u2.origin === window.location.origin) { window.location.href = u2.href; return; }
        } catch (e) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  /* ===== Pomoćne ===== */

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /** Modal greške iz PHP odgovora. Za 002 (duplikat) #1 = prevedena labela kontrole. */
  function prikaziGresku(res) {
    var p = parseResponseCode(res);
    if (!p || typeof MODAL_MESSAGES === 'undefined' || !MODAL_MESSAGES[p.code] || typeof window.showPorukaModal !== 'function') return;
    var repl = p.replacements;
    if (p.code === '002') {
      var tt = window.vnlhT || function (k, f) { return f != null ? f : k; };
      repl = [tt('kandidat_dokumenti_pred_print_crud.labela.dokument', 'Dokument')];
    }
    window.showPorukaModal(p.code, repl);
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Kandidat_Dokumenti_Pred_Print_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      zapisiPoId = {};
      if (text !== '' && text.charAt(0) !== '[') {
        prikaziGresku(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var z = arr[i];
            var id = z.id != null ? z.id : 0;
            zapisiPoId[String(id)] = z;
            rows.push([
              z.redosljed != null ? z.redosljed : 0,
              z.naziv != null ? z.naziv : '',
              z.dokument_naziv != null ? z.dokument_naziv : '',
              z.izvor_tablica != null ? z.izvor_tablica : '',
              String(z.aktivan) === '1' ? 1 : 0,
              id
            ]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Pred_PrintCRUD.Tablica_Zaglavlje);
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /* Selekti prije tablice — popuna edit panela pri selekciji retka traži gotove opcije. */
  ucitajDokumente(function () {
    ucitajIzvore(function () {
      osvjeziTablicu();
      updateCrudUpisiState();
    });
  });

  window.Kandidat_Dokumenti_Pred_PrintCRUD = Pred_PrintCRUD;
})();
