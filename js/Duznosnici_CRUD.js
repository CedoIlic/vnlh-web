/* Duznosnici_CRUD.js – tablica (Dužnosnik, A., Odgovornost) + edit: naziv, Odgovornost, Aktivnost. Tablica: duznosnici; checkbox u koloni A. odmah se snima; panel šalje aktivnost pri Upis/Izmjeni.
   Odgovornost (0-Razine): Master = VNLH_SESSION_ID_DUZNOSNIK (logirani dužnosnik); povrat_cijelog_seta = 1; ukljuci_mastera = 1 (cijeli skup dužnosnika uključujući Mastera; smjer na serveru se ignorira).
   Ikona strukture u zaglavlju panela tablice: modal-tablica (0-Kontrole) „Struktura dužnosnika“, Povratak u podnožju; stablo iz Duznosnici_CRUD_sve.php (naziv + nositelji_imena iz sustav_korisnici/clanovi). */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Duznosnici_CRUD.html');

// ========== KONSTANTE ==========
// DuznosniciCRUD – konfiguracija forme (Broj_Kolona, Reload_Ikona, CrudCssPrefix, Tablica_Zaglavlje).
//
// Tablica_Zaglavlje – svaka kolona je objekt sa parametrima:
// 1) key (string) - Jedinstveni ključ kolone.
// 2) title (string) - Tekst u zaglavlju kolone (THEAD).
// 3) SQL_Naziv (string) - Naziv podatka koji vraća PHP. Ako nije upisan = prvi podatak iza id. id = ključ sloga, skriveni podatak u redu tablice.
// 4) sortable (0 | 1) - 1 = kolona se može sortirati klikom na zaglavlje; 0 = nije sortabilna.
// 5) sortable_icon (0 | 1) - 1 = iscrtava se sort ikona u zaglavlju. Default: 0.
// 6) type ("t" | "n" | "d" | "b") - Tip podataka u koloni: "t" = tekst, "n" = broj, "d" = datum, "b" = binarno.
// 7) width (number) - Širina te kolone: 0 = auto; < 0 = abs(width) % ukupne širine; > 0 = fiksno u px.
// 8) suffix (string) - Dodatak uz prikaz podatka.
// 9) align ("L" | "C" | "R") - Orijentacija teksta u zaglavlju tablice.
// 10) row_align ("L" | "C" | "R") - Orijentacija sadržaja u redovima tablice.
// 11) mobitel_prikaz (0–255, default 1) - Prikaz kolone na mobilnim uređajima.
// 12) cell_readonly (0 | 1) - Za type "b": 1 = checkbox nije klikabilan. Default: 0.
//
// Red podataka u tablici (KontroleTablica): [ naziv, aktivnost (0|1), nadredjeni_naziv, id ] — četvrti element je skriveni ključ za getRowId.
// Kolona „Dužnosnik”: prikaz naziva dužnosnika (tekst).
// Kolona „A.”: aktivnost 0/1 kao checkbox (točka samo u zaglavlju THEAD, ne uz sam checkbox); promjena u tablici odmah na Duznosnici_CRUD_aktivnost.php; u panelu checkbox „Aktivnost” pri Upis/Izmjeni.
// Kolona „Odgovornost”: tekst nadređenog (nadredjeni_naziv iz JOIN-a).
//
  const DuznosniciCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 1,
    CrudCssPrefix: 'duznosnici-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Dužnosnik', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'aktivnost', title: 'A.', SQL_Naziv: 'aktivnost', sortable: 1, sortable_icon: 0, type: 'b', width: 40, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 0 },
      { key: 'odgovornost', title: 'Odgovornost', SQL_Naziv: 'nadredjeni_naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var duznosniciLista = [];
  /** 1 = opcije selecta Odgovornost već učitane za mod upis (nema odabranog retka); izbjegava ponavljanje GET pri svakom slovu. */
  var upisOdgovornostOpcijeUcitane = false;

  /** ID dužnosti prijavljenog korisnika (PHP umeće u stranicu). Master za API opcija Odgovornosti. */
  function getSessionDuznosnikId() {
    if (typeof window.VNLH_SESSION_ID_DUZNOSNIK === 'undefined') return 0;
    var x = Number(window.VNLH_SESSION_ID_DUZNOSNIK);
    return isNaN(x) || x < 0 ? 0 : x;
  }

  CommonCRUD.initTablica('tablicaContainer', DuznosniciCRUD, {
    getRowId: function (row) { return row && row.length > 3 ? row[3] : (row && row.length > 2 ? row[2] : row && row[1]); },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var selectOdgovornost = document.getElementById('select_odgovornost');
  var chkEditAktivnost = document.getElementById('edit_aktivnost');
  var labelEditAktivnost = document.querySelector('label[for="edit_aktivnost"]');

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) { editEl.value = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (selectOdgovornost) { selectOdgovornost.value = '0'; }
    if (chkEditAktivnost) { chkEditAktivnost.checked = true; }
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      upisOdgovornostOpcijeUcitane = false;
      clearControlsFromSelection();
      puniSelectOdgovornost(0);
      updateCrudUpisiState();
      return;
    }
    var data = tablicaApi.getData();
    var idNadredjeni = 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i][3] == id) {
        var editEl = document.getElementById('edit_naziv');
        if (editEl) { editEl.value = data[i][0] != null ? data[i][0] : ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
        for (var j = 0; j < duznosniciLista.length; j++) {
          if (duznosniciLista[j].id == id) {
            idNadredjeni = duznosniciLista[j].id_nadredjeni != null ? duznosniciLista[j].id_nadredjeni : 0;
            if (chkEditAktivnost) {
              var ak = duznosniciLista[j].aktivnost != null ? Number(duznosniciLista[j].aktivnost) : 1;
              chkEditAktivnost.checked = (ak === 1);
            }
            break;
          }
        }
        upisOdgovornostOpcijeUcitane = false;
        puniSelectOdgovornost(idNadredjeni);
        break;
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

  var labelOdgovornost = document.querySelector('label[for="select_odgovornost"]');

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var editEl = document.getElementById('edit_naziv');
    var imaSadrzaj = editEl ? trim(editEl.value) !== '' : false;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    if (selectOdgovornost) {
      selectOdgovornost.disabled = !imaSadrzaj;
      if (imaSadrzaj) selectOdgovornost.removeAttribute('disabled');
      else selectOdgovornost.setAttribute('disabled', 'disabled');
    }
    if (labelOdgovornost) labelOdgovornost.classList.toggle('kontrola-labela--disabled', !imaSadrzaj);
    if (chkEditAktivnost) {
      chkEditAktivnost.disabled = !imaSadrzaj;
      if (imaSadrzaj) chkEditAktivnost.removeAttribute('disabled');
      else chkEditAktivnost.setAttribute('disabled', 'disabled');
    }
    if (labelEditAktivnost) labelEditAktivnost.classList.toggle('kontrola-labela--disabled', !imaSadrzaj);

    // Upis bez odabranog retka: čim korisnik počne tipkati, jednom se učitaju opcije Odgovornosti (Master iz sesije).
    if (!imaSelekciju) {
      if (imaSadrzaj) {
        var midSes = getSessionDuznosnikId();
        if (midSes > 0 && !upisOdgovornostOpcijeUcitane) {
          var zOdg = selectOdgovornost ? (parseInt(selectOdgovornost.value, 10) || 0) : 0;
          puniSelectOdgovornost(zOdg);
          upisOdgovornostOpcijeUcitane = true;
        }
      } else if (upisOdgovornostOpcijeUcitane) {
        upisOdgovornostOpcijeUcitane = false;
        puniSelectOdgovornost(0);
      }
    }
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  if (chkEditAktivnost) {
    chkEditAktivnost.addEventListener('change', updateCrudUpisiState);
  }

  if (DuznosniciCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_naziv');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var idNadredjeni = selectOdgovornost ? (parseInt(selectOdgovornost.value, 10) || 0) : 0;
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        var aktPanel = chkEditAktivnost && chkEditAktivnost.checked ? 1 : 0;
        duznosniciUpdate(id, naziv, idNadredjeni, aktPanel, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.code === '002' ? ['naziv dužnosnika'] : p.replacements);
          }
        });
      } else {
        var aktNovi = chkEditAktivnost && chkEditAktivnost.checked ? 1 : 0;
        duznosniciAdd(naziv, idNadredjeni, aktNovi, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.code === '002' ? ['naziv dužnosnika'] : p.replacements);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      /** Prije DELETE-a: modal 123 (upozorenje na kaskadu: prava, ograničenja, login ako jedina dužnost). */
      function pokreniBrisanje() {
        duznosniciDelete(id, function (res) {
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
      }
      if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['123']) {
        window.showPorukaModal('123', [], function (buttonKey) {
          if (buttonKey === 'OK') pokreniBrisanje();
        });
      } else {
        pokreniBrisanje();
      }
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

  /**
   * Punjenje „Odgovornost“: Master = id dužnosti iz sesije (logirani dužnosnik); povrat_cijelog_seta = 1; ukljuci_mastera = 1.
   * Na serveru se pri povratu 1 ignorira smjer — lista je cijela tablica dužnosnika uključujući Mastera (vidi 0-Razine.js, Duznosnici_CRUD_opcije_pod_masterom.php).
   * Bez valjanog ID-a u sesiji: samo „Ne odgovara nikome“.
   * @param {number} zeljeniIdNadredjeni željeni odabir nakon učitavanja
   */
  function puniSelectOdgovornost(zeljeniIdNadredjeni) {
    if (!selectOdgovornost) return;
    var mid = getSessionDuznosnikId();
    if (window.VNLHPostivanjeRazine && typeof window.VNLHPostivanjeRazine.ucitajOpcijeDuznosnikaPodMasterom === 'function') {
      window.VNLHPostivanjeRazine.ucitajOpcijeDuznosnikaPodMasterom(
        mid > 0 ? mid : null,
        API_BASE,
        selectOdgovornost,
        zeljeniIdNadredjeni != null ? zeljeniIdNadredjeni : 0,
        null,
        'iznad',
        1,
        undefined,
        1
      );
    } else {
      while (selectOdgovornost.firstChild) selectOdgovornost.removeChild(selectOdgovornost.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '0';
      opt0.textContent = 'Ne odgovara nikome';
      selectOdgovornost.appendChild(opt0);
      selectOdgovornost.value = '0';
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_odgovornost');
    }
  }

  /** Postavlja klasu na retku kad je aktivnost=0 (boja teksta --c-gray-300 u CSS-u). */
  function primijeniStilRetkaAktivnost() {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    var tbody = container.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return;
    var trs = tbody.querySelectorAll('tr');
    for (var i = 0; i < trs.length; i++) {
      var rid = trs[i].dataset.rowId;
      var aktiv = 1;
      for (var j = 0; j < duznosniciLista.length; j++) {
        if (String(duznosniciLista[j].id) === String(rid)) {
          aktiv = duznosniciLista[j].aktivnost != null ? Number(duznosniciLista[j].aktivnost) : 1;
          break;
        }
      }
      trs[i].classList.toggle('duznosnici-crud__row-neaktivan', aktiv === 0);
    }
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Duznosnici_CRUD_sve.php', true);
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
          duznosniciLista = arr;
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            var nadr = r.nadredjeni_naziv != null ? r.nadredjeni_naziv : (r.id_nadredjeni === 0 || !r.id_nadredjeni ? '' : '');
            var akt = r.aktivnost != null ? Number(r.aktivnost) : 1;
            if (akt !== 0 && akt !== 1) akt = 1;
            rows.push([r.naziv != null ? r.naziv : '', akt, nadr, r.id != null ? r.id : 0]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
      upisOdgovornostOpcijeUcitane = false;
      var id = getSelectedRowId();
      var idNadr = 0;
      if (id != null) {
        for (var k = 0; k < duznosniciLista.length; k++) {
          if (duznosniciLista[k].id == id) {
            idNadr = duznosniciLista[k].id_nadredjeni != null ? duznosniciLista[k].id_nadredjeni : 0;
            if (chkEditAktivnost) {
              var ak2 = duznosniciLista[k].aktivnost != null ? Number(duznosniciLista[k].aktivnost) : 1;
              chkEditAktivnost.checked = (ak2 === 1);
            }
            break;
          }
        }
        puniSelectOdgovornost(idNadr);
      } else {
        var editElOs = document.getElementById('edit_naziv');
        var imaUpisTekst = editElOs ? trim(editElOs.value) !== '' : false;
        var midS = getSessionDuznosnikId();
        if (imaUpisTekst && midS > 0) {
          var zOs = selectOdgovornost ? (parseInt(selectOdgovornost.value, 10) || 0) : 0;
          puniSelectOdgovornost(zOs);
          upisOdgovornostOpcijeUcitane = true;
        } else {
          puniSelectOdgovornost(0);
        }
      }
    });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, DuznosniciCRUD.Tablica_Zaglavlje);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        primijeniStilRetkaAktivnost();
      });
    });
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function duznosniciAdd(naziv, id_nadredjeni, aktivnost, callback) {
    var a = aktivnost != null ? Number(aktivnost) : 1;
    if (a !== 0 && a !== 1) a = 1;
    postFormData(API_BASE + 'Duznosnici_CRUD_upis.php', {
      naziv: naziv,
      id_nadredjeni: String(id_nadredjeni || 0),
      aktivnost: String(a)
    }, callback);
  }

  function duznosniciUpdate(id, naziv, id_nadredjeni, aktivnost, callback) {
    var a = aktivnost != null ? Number(aktivnost) : 1;
    if (a !== 0 && a !== 1) a = 1;
    postFormData(API_BASE + 'Duznosnici_CRUD_izmjena.php', {
      id: String(id),
      naziv: naziv,
      id_nadredjeni: String(id_nadredjeni || 0),
      aktivnost: String(a)
    }, callback);
  }

  function duznosniciDelete(id, callback) {
    postFormData(API_BASE + 'Duznosnici_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  (function () {
    var tc = document.getElementById('tablicaContainer');
    if (!tc) return;
    tc.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.type !== 'checkbox' || !t.classList.contains('kontrola-checkbox')) return;
      var tr = t.closest ? t.closest('tr') : null;
      if (!tr || !tc.contains(tr)) return;
      var cells = tr.cells;
      if (!cells || cells.length < 2 || t.parentElement !== cells[1]) return;
      var rowId = tr.dataset.rowId;
      if (rowId == null || rowId === '') return;
      var novi = t.checked ? 1 : 0;
      var prijasnji = novi === 1 ? 0 : 1;
      /* Optimistički ažuriraj listu pa selektiraj red da panel i stil odgovaraju novom stanju prije odgovora servera. */
      for (var o = 0; o < duznosniciLista.length; o++) {
        if (String(duznosniciLista[o].id) === String(rowId)) {
          duznosniciLista[o].aktivnost = novi;
          break;
        }
      }
      if (tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function') {
        tablicaApi.setSelectedRowIds([rowId]);
      }
      primijeniStilRetkaAktivnost();
      postFormData(API_BASE + 'Duznosnici_CRUD_aktivnost.php', { id: String(rowId), aktivnost: String(novi) }, function (res) {
        if (res === 'OK') {
          primijeniStilRetkaAktivnost();
        } else {
          t.checked = prijasnji === 1;
          for (var u = 0; u < duznosniciLista.length; u++) {
            if (String(duznosniciLista[u].id) === String(rowId)) {
              duznosniciLista[u].aktivnost = prijasnji;
              break;
            }
          }
          primijeniStilRetkaAktivnost();
          var selNakonGreske = getSelectedRowId();
          if (chkEditAktivnost && selNakonGreske != null && String(selNakonGreske) === String(rowId)) {
            chkEditAktivnost.checked = (prijasnji === 1);
          }
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements);
          }
        }
      });
    });
  })();

  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
    upisOdgovornostOpcijeUcitane = false;
    puniSelectOdgovornost(0);
  });

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /* --- Blok: Modal hijerarhije (ikona u zaglavlju panela tablice) — modal-tablica kao Transfer_Excel; Povratak u podnožju --- */
  (function instalirajPrikazStruktureHijerarhije() {
    var modalStruktura = document.getElementById('modal_duznosnici_struktura');
    var btnStruktura = document.getElementById('btn_duznosnici_struktura');
    var btnModalPovratak = document.getElementById('btn_modal_duznosnici_struktura_povratak');
    var hijerarhijaOnEsc = null;

    function hijerarhijaZatvori() {
      if (modalStruktura) {
        if (document.activeElement && modalStruktura.contains(document.activeElement)) {
          try {
            document.activeElement.blur();
          } catch (eBl) {}
        }
        modalStruktura.setAttribute('aria-hidden', 'true');
        modalStruktura.classList.remove('modal-tablica--open');
      }
      if (hijerarhijaOnEsc) {
        document.removeEventListener('keydown', hijerarhijaOnEsc);
        hijerarhijaOnEsc = null;
      }
    }

    function hijerarhijaPobratiStablo() {
      var root = document.getElementById('duznosnici_crud_hijerarhija_tree_root');
      if (!root) return;
      while (root.firstChild) root.removeChild(root.firstChild);
    }

    /**
     * Iz ravnog niza (kao duznosniciLista) gradi korijene + djeca; roditelj izvan skupa ili 0 → korijen.
     * Djeca sortirana po nazivu (hr) radi stabilnog prikaza.
     */
    function hijerarhijaIzgradiStablo(flat) {
      var byId = {};
      var i;
      for (i = 0; i < flat.length; i++) {
        var r = flat[i];
        var id = r.id != null ? Number(r.id) : 0;
        if (isNaN(id) || id <= 0) continue;
        var pid = r.id_nadredjeni != null ? Number(r.id_nadredjeni) : 0;
        if (isNaN(pid) || pid < 0) pid = 0;
        var ak = r.aktivnost != null ? Number(r.aktivnost) : 1;
        if (ak !== 0 && ak !== 1) ak = 1;
        var nos = r.nositelji_imena != null ? trim(String(r.nositelji_imena)) : '';
        byId[id] = {
          id: id,
          naziv: r.naziv != null ? String(r.naziv) : '',
          nositelji_imena: nos,
          aktivnost: ak,
          id_nadredjeni: pid,
          children: []
        };
      }
      var roots = [];
      var idStr;
      for (idStr in byId) {
        if (!Object.prototype.hasOwnProperty.call(byId, idStr)) continue;
        var n = byId[idStr];
        var p = n.id_nadredjeni;
        if (p > 0 && byId[p]) {
          byId[p].children.push(n);
        } else {
          roots.push(n);
        }
      }
      function sortRecursive(node) {
        node.children.sort(function (a, b) {
          return String(a.naziv).localeCompare(String(b.naziv), 'hr');
        });
        for (var j = 0; j < node.children.length; j++) sortRecursive(node.children[j]);
      }
      for (i = 0; i < roots.length; i++) sortRecursive(roots[i]);
      roots.sort(function (a, b) {
        return String(a.naziv).localeCompare(String(b.naziv), 'hr');
      });
      return roots;
    }

    function hijerarhijaRenderCvor(node) {
      var li = document.createElement('li');
      li.className = 'duznosnici-crud-hijerarhija__item';
      var span = document.createElement('span');
      span.className = 'duznosnici-crud-hijerarhija__label';
      if (node.aktivnost !== 1) {
        span.classList.add('duznosnici-crud-hijerarhija__label--neaktivan');
      }
      var spanNaziv = document.createElement('span');
      spanNaziv.className = 'duznosnici-crud-hijerarhija__naziv';
      spanNaziv.appendChild(document.createTextNode(node.naziv != null ? String(node.naziv) : ''));
      span.appendChild(spanNaziv);
      /* Jedan vizualni red: dužnost — ⟶ — nositelj(i); U+27F6, razmaci između dijelova preko gap u CSS-u. */
      if (node.nositelji_imena) {
        var spanStrelica = document.createElement('span');
        spanStrelica.className = 'duznosnici-crud-hijerarhija__strelica';
        spanStrelica.setAttribute('aria-hidden', 'true');
        spanStrelica.appendChild(document.createTextNode('\u27f6'));
        span.appendChild(spanStrelica);
        var spanNos = document.createElement('span');
        spanNos.className = 'duznosnici-crud-hijerarhija__nositelji';
        spanNos.appendChild(document.createTextNode(node.nositelji_imena));
        span.appendChild(spanNos);
      }
      li.appendChild(span);
      if (node.children.length > 0) {
        var ul = document.createElement('ul');
        var c;
        for (c = 0; c < node.children.length; c++) {
          ul.appendChild(hijerarhijaRenderCvor(node.children[c]));
        }
        li.appendChild(ul);
      }
      return li;
    }

    function hijerarhijaPopuniTijelo(lista) {
      hijerarhijaPobratiStablo();
      var root = document.getElementById('duznosnici_crud_hijerarhija_tree_root');
      if (!root) return;
      if (!lista || lista.length === 0) {
        var p = document.createElement('p');
        p.textContent = 'Nema učitanih podataka.';
        root.appendChild(p);
        return;
      }
      var stablo = hijerarhijaIzgradiStablo(lista);
      var ul = document.createElement('ul');
      ul.className = 'duznosnici-crud-hijerarhija__tree';
      var r;
      for (r = 0; r < stablo.length; r++) {
        ul.appendChild(hijerarhijaRenderCvor(stablo[r]));
      }
      root.appendChild(ul);
    }

    function hijerarhijaOtvori() {
      if (!modalStruktura) return;
      modalStruktura.setAttribute('aria-hidden', 'false');
      modalStruktura.classList.add('modal-tablica--open');
      hijerarhijaOnEsc = function (e) {
        if (e.key === 'Escape') hijerarhijaZatvori();
      };
      document.addEventListener('keydown', hijerarhijaOnEsc);
    }

    function hijerarhijaOtvoriSNakonPodataka() {
      hijerarhijaPopuniTijelo(duznosniciLista);
      hijerarhijaOtvori();
    }

    function hijerarhijaNaKlikIkone() {
      if (!duznosniciLista || duznosniciLista.length === 0) {
        ucitajPodatkeTablica(function () {
          hijerarhijaOtvoriSNakonPodataka();
        });
      } else {
        hijerarhijaOtvoriSNakonPodataka();
      }
    }

    if (btnStruktura) {
      btnStruktura.addEventListener('click', hijerarhijaNaKlikIkone);
    }
    if (btnModalPovratak) {
      btnModalPovratak.addEventListener('click', hijerarhijaZatvori);
    }
  })();

  updateCrudUpisiState();
  window.DuznosniciCRUD = DuznosniciCRUD;
})();
