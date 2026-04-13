/* =====================================================
   Transfer_Excel_CRUD.js
   Transfer članova iz Excel tablica: panel s master podacima (telefon, email, adresa tip),
   putanja + folder picker, tablica preduvjeta (Ime fajla, Naziv lože, ID lože),
   modal za dodjelu lože (Loze_CRUD_sve.php).
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Transfer_Excel_CRUD.html', null, { upisiId: 'btn_upisi', izbrisiId: null });

  var API_BASE = '../php/';
  var folderHandle = null;
  var folderHandleSlike = null;
  var preconditionsData = [];
  var selectedRowIndex = null;
  var modalTablicaApi = null;

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
  var TransferExcelCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'transfer-excel-crud',
    Tablica_Zaglavlje: [
      // 60% širine za ime fajla
      { key: 'ime_fajla', title: 'Ime fajla', SQL_Naziv: 'ime_fajla', sortable: 1, sortable_icon: 0, type: 't', width: -60, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      // ostatak širine za naziv lože (flex), kasnije se puni iz modala
      { key: 'naziv_loze', title: 'Naziv lože', SQL_Naziv: 'naziv_loze', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      // ID lože: 60 px, centriran header + podaci
      { key: 'id_loze', title: 'ID', SQL_Naziv: 'id_loze', sortable: 1, sortable_icon: 0, type: 't', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };

  /* Tablica rezultata: 18 kolona (uključujući Napomena), nije sortabilna. */
  var TransferExcelRezultat = {
    Broj_Kolona: 18,
    Reload_Ikona: 0,
    CrudCssPrefix: 'transfer-excel-crud',
    Tablica_Zaglavlje: [
      { key: 'rb', title: 'RB', sortable: 0, sortable_icon: 0, type: 't', width: 60, suffix: '', align: 'R', row_align: 'R', mobitel_prikaz: 1 },
      { key: 'lid', title: 'Lid', sortable: 0, sortable_icon: 0, type: 't', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'sifra', title: 'Šifra', sortable: 0, sortable_icon: 0, type: 't', width: 150, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'ime', title: 'Ime', sortable: 0, sortable_icon: 0, type: 't', width: 150, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'prezime', title: 'Prezime', sortable: 0, sortable_icon: 0, type: 't', width: 150, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'slika', title: 'Slika', sortable: 0, sortable_icon: 0, type: 't', width: 300, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'rodjenje', title: 'Rođenje', sortable: 0, sortable_icon: 0, type: 't', width: 120, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'inicijacija', title: 'Inicijacija', sortable: 0, sortable_icon: 0, type: 't', width: 120, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stupanj', title: 'Stupanj', sortable: 0, sortable_icon: 0, type: 't', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'datum_stupnja', title: 'D. stupnja', sortable: 0, sortable_icon: 0, type: 't', width: 120, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'loza_inicijacije', title: 'L. Inic', sortable: 0, sortable_icon: 0, type: 't', width: 180, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'telefon', title: 'Telefon', sortable: 0, sortable_icon: 0, type: 't', width: 200, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'meil', title: 'Meil', sortable: 0, sortable_icon: 0, type: 't', width: 400, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'adresa_1', title: 'Adresa 1', sortable: 0, sortable_icon: 0, type: 't', width: 300, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'adresa_2', title: 'Adresa 2', sortable: 0, sortable_icon: 0, type: 't', width: 100, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'grad', title: 'Grad', sortable: 0, sortable_icon: 0, type: 't', width: 150, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'posta', title: 'Pošta', sortable: 0, sortable_icon: 0, type: 't', width: 100, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'napomena', title: 'Napomena', sortable: 0, sortable_icon: 0, type: 't', width: 400, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var tablicaRezultatApi = null;
  var logEl = null;

  CommonCRUD.initTablica('tablicaContainer', TransferExcelCRUD, {
    getRowId: function (row, index) { return index; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () {}
  });

  CommonCRUD.initTablica('tablicaRezultatContainer', TransferExcelRezultat, {
    getRowId: function (row, index) { return index; },
    onReady: function (api) { tablicaRezultatApi = api; },
    onSelectionChange: function () {}
  });

  /**
   * 1. faza – provjera podataka prije učitavanja rezultata.
   * Provjerava: folder slika, početna kolona, početni red. Ako nešto nedostaje, prikazuje poruku 022 i vraća false.
   * Redoslijed provjere: početna kolona, početni red, folder slika (kako u poruci).
   * @returns {boolean} true ako je sve postavljeno, inače false (poruka prikazana, odustajanje od nastavka)
   */
  function validirajUvjeteUcitavanjaRezultata() {
    var startKolonaEl = document.getElementById('start_kolona');
    var startRedEl = document.getElementById('start_red');
    var startKolona = (startKolonaEl && startKolonaEl.value) ? String(startKolonaEl.value).trim() : '';
    var startRed = (startRedEl && startRedEl.value) ? String(startRedEl.value).trim() : '';
    if (!startKolona || !startRed || !folderHandleSlike) {
      if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined') {
        window.showPorukaModal('022', []);
      }
      return false;
    }
    return true;
  }

  /** Na tablici rezultata postavlja podatke. Osvježava stanje tipki Simuliraj/Upiši. */
  function setRezultatData(rows) {
    if (!tablicaRezultatApi || !tablicaRezultatApi.setData) return;
    CommonCRUD.setDataTablica(tablicaRezultatApi, 'tablicaRezultatContainer', rows || [], TransferExcelRezultat.Tablica_Zaglavlje);
    osvjeziStanjeDrugogPanela();
  }

  /** Briše sav sadržaj log panela. */
  function clearLog() {
    var el = logEl || document.getElementById('transfer_excel_log');
    if (!el) return;
    logEl = el;
    el.innerHTML = '';
  }

  /** Dopisuje jednu liniju u log panel. Ako je element nedostupan, ne radi ništa. */
  function appendLog(msg) {
    var el = logEl || document.getElementById('transfer_excel_log');
    if (!el) return;
    logEl = el;
    var line = document.createElement('div');
    line.className = 'transfer-excel-crud__log-line';
    line.textContent = String(msg);
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  /** Dopisuje naslovnu liniju u log (negativa preko cijelog retka). */
  function appendLogHeader(msg) {
    var el = logEl || document.getElementById('transfer_excel_log');
    if (!el) return;
    logEl = el;
    var line = document.createElement('div');
    line.className = 'transfer-excel-crud__log-line transfer-excel-crud__log-line--header';
    line.textContent = String(msg);
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  /** Dopisuje jednu liniju u log i vraća element (za naknadno dopisivanje teksta). */
  function appendLogLineReturn(msg) {
    var el = logEl || document.getElementById('transfer_excel_log');
    if (!el) return null;
    logEl = el;
    var line = document.createElement('div');
    line.className = 'transfer-excel-crud__log-line';
    line.textContent = msg != null ? String(msg) : '';
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
    return line;
  }

  /** Pomakne radnu tablicu tako da je red na indeksu rowIndex vidljiv (skrol unutar panela). */
  function scrollResultTableToRow(rowIndex) {
    var container = document.getElementById('tablicaRezultatContainer');
    var scrollEl = container && container.parentElement;
    if (!scrollEl || !scrollEl.classList.contains('transfer-excel-crud__rezultat-scroll')) return;
    var tbody = container.querySelector('tbody');
    if (!tbody || rowIndex < 0 || rowIndex >= tbody.rows.length) return;
    var row = tbody.rows[rowIndex];
    var top = 0;
    for (var i = 0; i < rowIndex; i++) top += tbody.rows[i].offsetHeight;
    var rowHeight = row.offsetHeight;
    var scrollTop = top - scrollEl.offsetHeight / 2 + rowHeight / 2;
    scrollEl.scrollTop = Math.max(0, scrollTop);
  }

  /**
   * Provjera podataka radne tablice po grupama (grupa = svi redovi s istim Lidom / isti fajl).
   * Za svaku grupu ispisuje "Provjera sadržaja Excel tablice: " + ime tablice, zatim za svaki red provjerava
   * šifru, ime, prezime, datume, L. inic, telefon, meil, adresu 1, sliku i ispisuje u log pri greškama.
   */
  async function runProvjeraPodataka() {
    if (!tablicaRezultatApi || typeof tablicaRezultatApi.getData !== 'function') return;
    var data = tablicaRezultatApi.getData();
    if (!Array.isArray(data) || data.length === 0) return;

    var allowedNaziviLoze = [];
    var lidToImeFajla = {};
    for (var p = 0; p < preconditionsData.length; p++) {
      var pr = preconditionsData[p];
      var n = pr && pr.naziv_loze != null ? String(pr.naziv_loze).trim() : '';
      if (n !== '') allowedNaziviLoze.push(n);
      var idL = pr && pr.id_loze != null ? String(pr.id_loze) : '';
      var imeF = pr && pr.ime_fajla != null ? String(pr.ime_fajla).trim() : '';
      if (idL !== '' && imeF !== '') lidToImeFajla[idL] = imeF;
    }

    var rowStr = function (row, idx) {
      var v = row && row[idx];
      return v != null ? String(v).trim() : '';
    };

    var regexSifra = /^\d{4}-\d{6}$/;
    /* Jedna ili dvije riječi (npr. ime ili dva prezimena), svaka veliko početno + ostala mala */
    var regexImePrezime = /^[A-ZČĆŽŠĐ][a-zčćžšđ]*(\s+[A-ZČĆŽŠĐ][a-zčćžšđ]*)?$/;
    var regexDatum = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(\.)?$/;
    var regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function isValidDatum(s) {
      if (!s || s.length === 0) return false;
      var m = s.match(regexDatum);
      if (!m) return false;
      var d = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10);
      var y = parseInt(m[3], 10);
      return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100;
    }

    var groups = {};
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      var lid = rowStr(r, 1);
      if (!groups[lid]) groups[lid] = [];
      groups[lid].push(r);
    }

    var sifraToRows = {};
    for (var gid in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, gid)) continue;
      var rws = groups[gid];
      for (var ji = 0; ji < rws.length; ji++) {
        var rw = rws[ji];
        var sval = rowStr(rw, 2);
        if (sval === '') continue;
        if (!sifraToRows[sval]) sifraToRows[sval] = [];
        sifraToRows[sval].push({ rb: rowStr(rw, 0) || String(ji + 1), lid: gid, j: ji });
      }
    }
    var duplicateSifraLogged = {};

    var imeTabliceZa = function (lid) {
      return lidToImeFajla[lid] != null ? lidToImeFajla[lid] : lid || '(nepoznata tablica)';
    };

    for (var lidKey in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, lidKey)) continue;
      var rowsInGroup = groups[lidKey];
      appendLogHeader('Provjera sadržaja Excel tablice: ' + imeTabliceZa(lidKey));

      for (var j = 0; j < rowsInGroup.length; j++) {
        var row = rowsInGroup[j];
        var rb = rowStr(row, 0) || String(j + 1);
        var sifra = rowStr(row, 2);
        var ime = rowStr(row, 3);
        var prezime = rowStr(row, 4);
        var slika = rowStr(row, 5);
        var rodjenje = rowStr(row, 6);
        var inicijacija = rowStr(row, 7);
        var datumStupnja = rowStr(row, 9);
        var lozaInic = rowStr(row, 10);
        var telefon = rowStr(row, 11);
        var meil = rowStr(row, 12);
        var adresa1 = rowStr(row, 13);

        var rbImePrezime = rb + ', ' + ime + ', ' + prezime + ', ';

        if (!regexSifra.test(sifra)) {
          appendLog('U retku broj ' + rbImePrezime + 'krivi format šifre ' + (sifra || '(prazno)'));
        }
        if (sifra !== '' && sifraToRows[sifra] && sifraToRows[sifra].length > 1 && !duplicateSifraLogged[sifra]) {
          var entries = sifraToRows[sifra];
          var otherEntry = null;
          for (var ei = 0; ei < entries.length; ei++) {
            if (entries[ei].lid !== lidKey || entries[ei].j !== j) {
              otherEntry = entries[ei];
              break;
            }
          }
          if (otherEntry) {
            appendLog('U retku ' + rb + ' i u retku ' + otherEntry.rb + ' nalazi se duplikat šifre ' + sifra + '. Duplikati se nalaze u datotekama ' + imeTabliceZa(lidKey) + ', ' + imeTabliceZa(otherEntry.lid) + '.');
            duplicateSifraLogged[sifra] = true;
          }
        }
        if (ime === '') {
          appendLog('Ime u retku ' + rbImePrezime + 'nije upisano.');
        } else if (!regexImePrezime.test(ime)) {
          appendLog('Ime u retku ' + rbImePrezime + 'nepravilno upisano ' + ime);
        }
        if (prezime === '') {
          appendLog('Prezime u retku ' + rbImePrezime + 'nije upisano.');
        } else if (!regexImePrezime.test(prezime)) {
          appendLog('Prezime u retku ' + rbImePrezime + 'nepravilno upisano ' + prezime);
        }

        if (rodjenje !== '' && !isValidDatum(rodjenje)) {
          appendLog('U retku ' + rbImePrezime + 'datum Rođenje ima nedozvoljene znakove ili tekstove ' + rodjenje);
        }
        if (inicijacija !== '' && !isValidDatum(inicijacija)) {
          appendLog('U retku ' + rbImePrezime + 'datum Inicijacija ima nedozvoljene znakove ili tekstove ' + inicijacija);
        }
        if (datumStupnja !== '' && !isValidDatum(datumStupnja)) {
          appendLog('U retku ' + rbImePrezime + 'datum D. stupnja ima nedozvoljene znakove ili tekstove ' + datumStupnja);
        }

        var foundLoza = false;
        if (lozaInic !== '') {
          for (var k = 0; k < allowedNaziviLoze.length; k++) {
            if (allowedNaziviLoze[k] === lozaInic) { foundLoza = true; break; }
          }
        }
        if (!foundLoza) {
          appendLog('U retku ' + rbImePrezime + 'nije upisana loža inicijacije na navedeni stupanj.');
        }

        if (telefon !== '' && telefon.indexOf('+') !== 0) {
          appendLog('U retku ' + rbImePrezime + 'telefon nije ispravno upisan ' + telefon);
        }
        if (meil !== '' && !regexEmail.test(meil)) {
          appendLog('Email adresa u retku broj ' + rbImePrezime + 'nije ispravna. ' + meil);
        }
        if (adresa1 === '') {
          appendLog('Adresa u retku ' + rbImePrezime + 'nije upisana.');
        }

        if (slika === '') {
          appendLog('U retku ' + rb + ' ' + ime + ', ' + prezime + ' nedostaje ime slike.');
        } else if (folderHandleSlike && typeof folderHandleSlike.getFileHandle === 'function') {
          try {
            await folderHandleSlike.getFileHandle(slika);
          } catch (e) {
            appendLog('Slika u retku ' + rbImePrezime + slika + ' nije pronađena u mapi sa slikama.');
          }
        }
      }
    }
  }

  function trim(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  function setPreconditionsTable() {
    var rows = preconditionsData.map(function (d) {
      return [d.ime_fajla != null ? d.ime_fajla : '', d.naziv_loze != null ? d.naziv_loze : '', d.id_loze != null ? String(d.id_loze) : ''];
    });
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, TransferExcelCRUD.Tablica_Zaglavlje);
    osvjeziStanjeDrugogPanela();
  }

  /** Vraća true ako tablica preduvjeta ima bar jedan red i u svakom retku su popunjene kolone Naziv lože i ID. */
  function sviPreduvjetiPopunjeni() {
    if (!preconditionsData || preconditionsData.length === 0) return false;
    for (var i = 0; i < preconditionsData.length; i++) {
      var r = preconditionsData[i];
      if (!trim(r.naziv_loze) || !trim(r.id_loze)) return false;
    }
    return true;
  }

  /** Uključuje ili isključuje kontrole drugog panela ovisno o preduvjetima (Naziv lože + ID u svakom retku prvog panela). Tipka Povratak je uvijek enabled. Tablica koristi tokene iz 0-Common (kontrola-tablica--disabled). Labele u zaglavlju dobivaju/ gube klasu kontrola-labela--disabled. */
  function osvjeziStanjeDrugogPanela() {
    var panel = document.querySelector('.transfer-excel-crud__panel-rezultat');
    var tablicaRezultat = document.getElementById('tablicaRezultatContainer');
    var enabled = sviPreduvjetiPopunjeni();
    var controlIds = ['start_kolona', 'start_red', 'iskljucene_kolone', 'putanja_slike', 'btn_folder_slike', 'btn_reload_slike', 'btn_document_check'];
    for (var i = 0; i < controlIds.length; i++) {
      var el = document.getElementById(controlIds[i]);
      if (el) el.disabled = !enabled;
    }
    var header = panel ? panel.querySelector('.transfer-excel-crud__rezultat-header') : null;
    if (header) {
      var labels = header.querySelectorAll('.kontrola-labela');
      for (var j = 0; j < labels.length; j++) {
        if (enabled) labels[j].classList.remove('kontrola-labela--disabled');
        else labels[j].classList.add('kontrola-labela--disabled');
      }
    }
    if (tablicaRezultat) {
      if (enabled) tablicaRezultat.classList.remove('kontrola-tablica--disabled');
      else tablicaRezultat.classList.add('kontrola-tablica--disabled');
    }
    if (panel) {
      if (enabled) panel.classList.remove('transfer-excel-crud__panel-rezultat--disabled');
      else panel.classList.add('transfer-excel-crud__panel-rezultat--disabled');
    }
    var hasResultRows = tablicaRezultatApi && typeof tablicaRezultatApi.getData === 'function' && tablicaRezultatApi.getData().length > 0;
    var btnS = document.getElementById('btn_simuliraj');
    var btnU = document.getElementById('btn_upisi');
    var chkSifra = document.getElementById('chk_testirati_sifru');
    var footerChkLabel = chkSifra && chkSifra.closest ? chkSifra.closest('label.transfer-excel-crud__footer-checkbox') : null;
    var footerDisabled = !enabled || !hasResultRows;
    if (btnS) btnS.disabled = footerDisabled;
    if (btnU) btnU.disabled = footerDisabled;
    if (chkSifra) chkSifra.disabled = footerDisabled;
    if (footerChkLabel) footerChkLabel.classList.toggle('kontrola-labela--disabled', footerDisabled);
    var logContent = document.getElementById('transfer_excel_log');
    if (logContent) {
      logContent.classList.toggle('transfer-excel-crud__log-content--disabled', !enabled);
      logContent.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }
  }

  function getApiUrl(path) {
    var p = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + p + '/php/' + path;
  }

  /** Normalizacija imena: prvo slovo veliko, ostala mala (kao PHP normalize_name). */
  function normalizeName(s) {
    var x = trim(s);
    if (x === '') return '';
    if (typeof String.prototype.toLocaleLowerCase !== 'undefined' && typeof x.toLocaleUpperCase !== 'undefined') {
      x = x.toLocaleLowerCase('hr');
      return x.replace(/(^|\s)(\S)/g, function (m, g1, g2) { return g1 + g2.toLocaleUpperCase('hr'); });
    }
    x = x.toLowerCase();
    return x.replace(/(^|\s)(\S)/g, function (m, g1, g2) { return g1 + g2.toUpperCase(); });
  }

  /** Konverzija datuma dd.mm.yyyy ili dd.mm.yy u YYYY-MM-DD. Vraća null ako prazan ili nevaljan. */
  function dateToYyyyMmDd(s) {
    var x = trim(s);
    if (x === '') return null;
    var parts = x.split(/[.\-/]/);
    if (parts.length < 3) return null;
    var d = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    if (y >= 0 && y < 100) y += 1900;
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    var mm = String(m).padStart(2, '0');
    var dd = String(d).padStart(2, '0');
    var yyyy = String(y);
    return yyyy + '-' + mm + '-' + dd;
  }

  /**
   * Iz L. Inic teksta i tablice preduvjeta vraća id_loza_napredovanja i loza_napredovanja.
   * Ako se naziv pronađe u Naziv Lože (preconditionsData[].naziv_loze) → id = id_loze tog retka, loza_napredovanja = ''.
   * Ako se ne pronađe → id = 0 (Druga loža), loza_napredovanja = lInicText.
   */
  function resolveNapredovanjaLoza(preconditions, lInicText) {
    var naziv = trim(lInicText);
    if (!preconditions || preconditions.length === 0) {
      return { id_loza_napredovanja: 0, loza_napredovanja: naziv || null };
    }
    var nazivLower = naziv.toLocaleLowerCase ? naziv.toLocaleLowerCase('hr') : naziv.toLowerCase();
    for (var i = 0; i < preconditions.length; i++) {
      var pr = preconditions[i];
      var n = pr && pr.naziv_loze != null ? trim(String(pr.naziv_loze)) : '';
      var nLower = n.toLocaleLowerCase ? n.toLocaleLowerCase('hr') : n.toLowerCase();
      if (nLower === nazivLower) {
        var idStr = pr && pr.id_loze != null ? String(pr.id_loze).trim() : '';
        var id = idStr === '' ? 0 : parseInt(idStr, 10);
        return { id_loza_napredovanja: isNaN(id) ? 0 : id, loza_napredovanja: null };
      }
    }
    return { id_loza_napredovanja: 0, loza_napredovanja: naziv || null };
  }

  /** Dohvat id stupnja za broj stupnja (id_obred=35). Vraća Promise<number|null>. */
  function fetchStupanjId(stupanjNum) {
    var url = getApiUrl('Transfer_Excel_CRUD_dohvat_stupnja.php?stupanj=' + encodeURIComponent(String(stupanjNum)));
    return fetch(url).then(function (r) { return r.json(); }).then(function (o) {
      return o && o.id != null ? (typeof o.id === 'number' ? o.id : parseInt(o.id, 10)) : null;
    }).catch(function () { return null; });
  }

  /**
   * Sastavlja FormData za jedan red radne tablice (član + napredovanja).
   * row = niz 18 elemenata; idStupanj = id iz dohvat_stupnja; napredovanja = { id_loza_napredovanja, loza_napredovanja };
   * datumNapredovanja = YYYY-MM-DD ili null; simuliraj = true za Simuliraj; imageBlobs = { slika, slika_mime, thumb, thumb_mime, thumb_round, thumb_round_mime } ili null.
   */
  function buildFormDataForRow(row, idStupanj, napredovanja, datumNapredovanja, simuliraj, imageBlobs) {
    var fd = new FormData();
    var idLoza = parseInt(String(row[1] || '').trim(), 10);
    if (isNaN(idLoza) || idLoza <= 0) idLoza = 0;
    fd.append('id_loza', String(idLoza));
    fd.append('prezime', normalizeName(row[4]));
    fd.append('ime', normalizeName(row[3]));
    fd.append('sifra', trim(row[2] || ''));
    fd.append('spol', '0');
    var dr = dateToYyyyMmDd(row[6]);
    if (dr != null) fd.append('datum_rodjenja', dr);
    var di = dateToYyyyMmDd(row[7]);
    if (di != null) fd.append('datum_inicijacije', di);
    var ds = dateToYyyyMmDd(row[9]);
    if (ds != null) fd.append('datum_stupnja', ds);
    if (idStupanj != null && idStupanj > 0) fd.append('stupanj', String(idStupanj));
    fd.append('porijeklo', '1');
    fd.append('id_drzava_adrese', '2');
    fd.append('telefon_text', trim(row[11] || ''));
    fd.append('email_text', trim(row[12] || ''));
    fd.append('adresa_1', trim(row[13] || ''));
    fd.append('adresa_2', trim(row[14] || ''));
    fd.append('grad', trim(row[15] || ''));
    fd.append('posta', trim(row[16] || ''));
    fd.append('napomena', trim(row[17] || ''));
    fd.append('aktivnost', '1');
    fd.append('kandidat', '0');
    fd.append('zastavice', '0');
    fd.append('simuliraj', simuliraj ? '1' : '0');
    fd.append('napredovanja_id_stupanj', String(idStupanj != null ? idStupanj : 0));
    fd.append('napredovanja_id_loza', String(napredovanja.id_loza_napredovanja));
    fd.append('napredovanja_loza_text', napredovanja.loza_napredovanja != null ? napredovanja.loza_napredovanja : '');
    fd.append('napredovanja_datum', datumNapredovanja != null ? datumNapredovanja : '');
    if (imageBlobs && imageBlobs.slika) {
      fd.append('slika', imageBlobs.slika, imageBlobs.slika_fn || 'slika.webp');
      fd.append('slika_mime', imageBlobs.slika_mime || 'image/webp');
      if (imageBlobs.thumb) {
        fd.append('thumb', imageBlobs.thumb, 'thumb.jpg');
        fd.append('thumb_mime', imageBlobs.thumb_mime || 'image/jpeg');
      }
      if (imageBlobs.thumb_round) {
        fd.append('thumb_round', imageBlobs.thumb_round, 'thumb_round.webp');
        fd.append('thumb_round_mime', imageBlobs.thumb_round_mime || 'image/webp');
        fd.append('thumb_round_position', String(imageBlobs.thumb_round_position != null ? Math.round(imageBlobs.thumb_round_position) : 0));
      }
    }
    return fd;
  }

  /** Sažimanje blob u WebP: duža stranica max maxPx, kvaliteta quality (0–1). */
  function resizeBlobToWebP(blob, maxPx, quality) {
    maxPx = maxPx || 1024;
    quality = typeof quality !== 'number' || quality < 0 || quality > 1 ? 0.75 : quality;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) { resolve(null); return; }
        var scale = (w > maxPx || h > maxPx) ? (w >= h ? maxPx / w : maxPx / h) : 1;
        var cw = Math.round(w * scale);
        var ch = Math.round(h * scale);
        if (cw < 1 || ch < 1) { resolve(null); return; }
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h, 0, 0, cw, ch);
        canvas.toBlob(function (outBlob) { resolve(outBlob); }, 'image/webp', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }

  /** Pravokutni thumb 64 px, JPEG 0.85 (kao Clanovi_CRUD). */
  function createThumb64Jpeg(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) { resolve(null); return; }
        var maxPx = 64;
        var scale = w > maxPx ? maxPx / w : 1;
        var tw = Math.round(w * scale);
        var th = Math.round(h * scale);
        if (tw < 1 || th < 1) { resolve(null); return; }
        var canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, tw, th);
        canvas.toBlob(function (outBlob) { resolve(outBlob); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Thumb load failed')); };
      img.src = url;
    });
  }

  /** Kružni thumb 64 px, WebP 0.9 (kao Clanovi_CRUD). */
  function createRoundThumb64Webp(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) { resolve(null); return; }
        var sizePx = 64;
        var minSide = Math.min(w, h);
        var sx = (w - minSide) / 2;
        var sy = (h - minSide) / 2;
        var canvas = document.createElement('canvas');
        canvas.width = sizePx;
        canvas.height = sizePx;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.clearRect(0, 0, sizePx, sizePx);
        ctx.beginPath();
        ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, sizePx, sizePx);
        canvas.toBlob(function (outBlob) { resolve(outBlob); }, 'image/webp', 0.9);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Round thumb load failed')); };
      img.src = url;
    });
  }

  /**
   * Učitava sliku iz foldera, sažima na WebP 1024px, pravi thumb i thumb_round.
   * Vraća Promise<{ slika, slika_mime, slika_fn, thumb, thumb_mime, thumb_round, thumb_round_mime }|null>.
   */
  function prepareImageBlobs(folderHandle, fileName) {
    if (!folderHandle || typeof folderHandle.getFileHandle !== 'function' || !fileName || trim(fileName) === '') return Promise.resolve(null);
    return folderHandle.getFileHandle(fileName).then(function (handle) {
      return handle.getFile();
    }).then(function (file) {
      return file.arrayBuffer().then(function (ab) {
        return new Blob([ab], { type: (file && file.type) || 'image/jpeg' });
      });
    }).catch(function () { return null; }).then(function (blob) {
      if (!blob || blob.size === 0) return null;
      return resizeBlobToWebP(blob, 1024, 0.75).then(function (webpBlob) {
        if (!webpBlob) return null;
        var result = { slika: webpBlob, slika_mime: 'image/webp', slika_fn: 'slika.webp' };
        return createThumb64Jpeg(blob).then(function (thumb) {
          result.thumb = thumb;
          result.thumb_mime = 'image/jpeg';
          return createRoundThumb64Webp(blob).then(function (round) {
            result.thumb_round = round;
            result.thumb_round_mime = 'image/webp';
            result.thumb_round_position = 0;
            return result;
          });
        });
      });
    }).catch(function () { return null; });
  }

  function fetchJson(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { callback(JSON.parse(text)); return; } catch (e) {}
      }
      callback([]);
    };
    xhr.send();
  }

  function findTip1(arr) {
    if (!Array.isArray(arr)) return null;
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i];
      if (t && (t.Tip === 1 || t.Tip === '1')) return t;
    }
    return null;
  }

  function loadMasterData() {
    fetchJson(getApiUrl('Telefoni_Tip_CRUD_sve.php'), function (arr) {
      var t = findTip1(arr);
      var idEl = document.getElementById('header_telefon_id');
      var nazEl = document.getElementById('header_telefon_naziv');
      if (idEl) idEl.value = t && t.id != null ? String(t.id) : '';
      if (nazEl) nazEl.value = t && t.naziv != null ? String(t.naziv) : '';
    });
    fetchJson(getApiUrl('Email_Tip_CRUD_sve.php'), function (arr) {
      var t = findTip1(arr);
      var idEl = document.getElementById('header_email_id');
      var nazEl = document.getElementById('header_email_naziv');
      if (idEl) idEl.value = t && t.id != null ? String(t.id) : '';
      if (nazEl) nazEl.value = t && t.naziv != null ? String(t.naziv) : '';
    });
    fetchJson(getApiUrl('Adrese_Tip_CRUD_sve.php'), function (arr) {
      var t = findTip1(arr);
      var idEl = document.getElementById('header_adresa_id');
      var nazEl = document.getElementById('header_adresa_naziv');
      if (idEl) idEl.value = t && t.id != null ? String(t.id) : '';
      if (nazEl) nazEl.value = t && t.naziv != null ? String(t.naziv) : '';
    });
  }

  var btnFolder = document.getElementById('btn_folder_picker');
  var headerPutanja = document.getElementById('header_putanja');

  if (btnFolder && headerPutanja) {
    btnFolder.addEventListener('click', function () {
      if (typeof showDirectoryPicker !== 'function') {
        if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined') {
          window.showPorukaModal('021', []);
        }
        return;
      }
      showDirectoryPicker()
        .then(function (handle) {
          folderHandle = handle;
          headerPutanja.value = handle.name || 'Odabran folder';
        })
        .catch(function () {});
    });
  }

  var btnReload = document.getElementById('btn_reload_tablica');
  if (btnReload) {
    btnReload.addEventListener('click', async function () {
      if (!folderHandle) {
        if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined') {
          window.showPorukaModal('021', []);
        }
        return;
      }
      try {
        var names = [];
        if (typeof folderHandle.entries === 'function') {
          // File System Access API: async iterator
          for await (var _ref of folderHandle.entries()) {
            var name = _ref[0];
            var handle = _ref[1];
            if (handle && handle.kind === 'file') {
              var fname = name != null ? String(name) : (handle.name || '');
              var lower = fname.toLowerCase();
              if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) names.push(fname);
            }
          }
        }
        names.sort();
        preconditionsData = names.map(function (n) { return { ime_fajla: n, naziv_loze: '', id_loze: '' }; });
        setPreconditionsTable();
      } catch (e) {
        if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined') {
          window.showPorukaModal('021', []);
        }
      }
    });
  }

  /* Zaglavlje panela rezultat: start_kolona (1 slovo, uppercase), start_red (1–99, max 2 cifre), iskljucene_kolone (slova i ",", uppercase). */
  var startKolonaEl = document.getElementById('start_kolona');
  if (startKolonaEl) {
    startKolonaEl.addEventListener('input', function () {
      var v = this.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1);
      if (this.value !== v) this.value = v;
    });
  }
  var startRedEl = document.getElementById('start_red');
  if (startRedEl) {
    startRedEl.addEventListener('input', function () {
      var v = this.value.replace(/\D/g, '').slice(0, 2);
      if (this.value !== v) this.value = v;
    });
    startRedEl.addEventListener('blur', function () {
      var n = parseInt(this.value, 10);
      if (this.value !== '' && (isNaN(n) || n < 1 || n > 99)) this.value = '';
    });
  }
  var iskljuceneKoloneEl = document.getElementById('iskljucene_kolone');
  if (iskljuceneKoloneEl) {
    iskljuceneKoloneEl.addEventListener('input', function () {
      var v = this.value.replace(/[^A-Za-z,]/g, '').toUpperCase();
      if (this.value !== v) this.value = v;
    });
  }

  /* Putanja mape sa slikama: folder picker i refresh (samo osvježi prikaz imena). */
  var btnFolderSlike = document.getElementById('btn_folder_slike');
  var putanjaSlikeEl = document.getElementById('putanja_slike');
  if (btnFolderSlike && putanjaSlikeEl) {
    btnFolderSlike.addEventListener('click', function () {
      if (typeof showDirectoryPicker !== 'function') {
        if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined') {
          window.showPorukaModal('021', []);
        }
        return;
      }
      showDirectoryPicker()
        .then(function (handle) {
          folderHandleSlike = handle;
          putanjaSlikeEl.value = handle.name || 'Odabran folder';
        })
        .catch(function () {});
    });
  }
  var btnReloadSlike = document.getElementById('btn_reload_slike');
  if (btnReloadSlike && putanjaSlikeEl) {
    btnReloadSlike.addEventListener('click', async function () {
      if (!validirajUvjeteUcitavanjaRezultata()) return;
      btnReloadSlike.disabled = true;
      try {
        if (folderHandleSlike) {
          putanjaSlikeEl.value = folderHandleSlike.name || 'Odabran folder';
        }
        if (typeof XLSX === 'undefined') {
          if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined') {
            window.showPorukaModal('021', []);
          }
          return;
        }
        setRezultatData([]);
        var iskljuceneKoloneStr = (iskljuceneKoloneEl && iskljuceneKoloneEl.value) ? String(iskljuceneKoloneEl.value).trim() : '';
        var excludedIndices = [];
        if (iskljuceneKoloneStr !== '') {
          var parts = iskljuceneKoloneStr.split(',');
          for (var p = 0; p < parts.length; p++) {
            var letter = String(parts[p]).trim().toUpperCase();
            if (letter === '') continue;
            try {
              var idx = XLSX.utils.decode_col(letter);
              if (excludedIndices.indexOf(idx) < 0) excludedIndices.push(idx);
            } catch (e) {}
          }
        }
        var startKolonaStr = (startKolonaEl && startKolonaEl.value) ? String(startKolonaEl.value).trim().toUpperCase() : '';
        var startRedNum = (startRedEl && startRedEl.value) ? parseInt(startRedEl.value, 10) : 0;
        if (!startKolonaStr || isNaN(startRedNum) || startRedNum < 1 || startRedNum > 99) return;
        var startColIndex = 0;
        try {
          startColIndex = XLSX.utils.decode_col(startKolonaStr);
        } catch (e) {
          return;
        }
        var startRowIndex = startRedNum - 1;
        var resultRows = [];
        var rb = 1;
        if (!folderHandle || typeof folderHandle.entries !== 'function') {
          setRezultatData(resultRows);
          return;
        }
        /* Mapiranje ime fajla -> FileSystemFileHandle iz folderHandle.entries() (getFile() na dir handleu nije uvijek dostupan) */
        var fileHandlesByName = {};
        try {
          for await (var _ref of folderHandle.entries()) {
            var name = _ref[0];
            var h = _ref[1];
            if (h && h.kind === 'file') {
              var fname = name != null ? String(name) : (h.name || '');
              fileHandlesByName[fname] = h;
            }
          }
        } catch (e) {
          setRezultatData(resultRows);
          return;
        }
        for (var i = 0; i < preconditionsData.length; i++) {
          var rowPre = preconditionsData[i];
          var imeFajla = rowPre && rowPre.ime_fajla != null ? String(rowPre.ime_fajla).trim() : '';
          var idLoze = rowPre && rowPre.id_loze != null ? String(rowPre.id_loze) : '';
          if (imeFajla === '') continue;
          var fileHandle = fileHandlesByName[imeFajla];
          if (!fileHandle) continue;
          try {
            var file = await fileHandle.getFile();
            var ab = await file.arrayBuffer();
            var wb = XLSX.read(ab, { type: 'array', cellDates: true });
            if (!wb.SheetNames || wb.SheetNames.length === 0) continue;
            var sheetName = wb.SheetNames[0];
            var sheet = wb.Sheets[sheetName];
            if (!sheet || !sheet['!ref']) continue;
            var range = XLSX.utils.decode_range(sheet['!ref']);
            var rowsAdded = 0;
            var dateValueIndices = { 4: 1, 5: 1, 7: 1 };
            function formatExcelCellValue(cel, valueIndex) {
              if (!cel || cel.v == null) return '';
              if (dateValueIndices[valueIndex] && (cel.t === 'd' || cel.v instanceof Date)) {
                var d = cel.v instanceof Date ? cel.v : new Date(cel.v);
                if (!isNaN(d.getTime())) {
                  var dd = String(d.getDate()).padStart(2, '0');
                  var mm = String(d.getMonth() + 1).padStart(2, '0');
                  var yyyy = d.getFullYear();
                  return dd + '.' + mm + '.' + yyyy;
                }
              }
              if (dateValueIndices[valueIndex] && cel.t === 'n' && typeof cel.v === 'number' && cel.v > 0 && cel.v < 100000) {
                var excelEpoch = new Date(1899, 11, 30);
                var d2 = new Date(excelEpoch.getTime() + cel.v * 86400000);
                if (!isNaN(d2.getTime())) {
                  var dd2 = String(d2.getDate()).padStart(2, '0');
                  var mm2 = String(d2.getMonth() + 1).padStart(2, '0');
                  return dd2 + '.' + mm2 + '.' + d2.getFullYear();
                }
              }
              if (cel.w != null && String(cel.w).trim() !== '') return String(cel.w);
              return String(cel.v);
            }
            for (var rowIdx = startRowIndex; rowIdx <= range.e.r; rowIdx++) {
              var cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: startColIndex });
              var cell = sheet[cellRef];
              var startVal = cell && cell.v != null && String(cell.v).trim() !== '' ? String(cell.v).trim() : '';
              if (startVal === '') break;
              var values = [];
              for (var c = startColIndex; c <= range.e.c && values.length < 16; c++) {
                if (excludedIndices.indexOf(c) >= 0) continue;
                var ref = XLSX.utils.encode_cell({ r: rowIdx, c: c });
                var cel = sheet[ref];
                var v = formatExcelCellValue(cel, values.length);
                values.push(v);
              }
              while (values.length < 16) values.push('');
              resultRows.push([rb + '.', idLoze].concat(values));
              rb++;
              rowsAdded++;
            }
          } catch (err) {}
        }
        setRezultatData(resultRows);
      } finally {
        btnReloadSlike.disabled = !sviPreduvjetiPopunjeni();
      }
    });
  }

  var btnDocumentCheck = document.getElementById('btn_document_check');
  if (btnDocumentCheck) {
    btnDocumentCheck.addEventListener('click', function () {
      clearLog();
      runProvjeraPodataka();
    });
  }

  var tablicaContainerEl = document.getElementById('tablicaContainer');
  if (tablicaContainerEl) {
    tablicaContainerEl.addEventListener('dblclick', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tr') : null;
      if (!tr || !tr.parentNode || tr.parentNode.tagName !== 'TBODY') return;
      e.preventDefault();
      e.stopPropagation();
      var tbody = tr.parentNode;
      var idx = Array.prototype.indexOf.call(tbody.rows, tr);
      if (idx < 0) return;
      selectedRowIndex = idx;
      openModalOdabirLoze();
    });
  }

  var modal = document.getElementById('modal_odabir_loze');
  var modalLozeContainer = document.getElementById('modal_loze_container');
  var modalOk = document.getElementById('modal_ok');
  var modalOdustani = document.getElementById('modal_odustani');

  function openModalOdabirLoze() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('modal-tablica--open');
    if (modalTablicaApi && typeof modalTablicaApi.setData === 'function') {
      modalTablicaApi.setData([]);
    }
    fetchJson(getApiUrl('Transfer_Excel_CRUD_loze.php'), function (arr) {
      if (!modalTablicaApi || typeof modalTablicaApi.setData !== 'function') return;
      var rows = [];
      for (var i = 0; i < arr.length; i++) {
        rows.push([
          arr[i].naziv != null ? arr[i].naziv : '',
          arr[i].id != null ? arr[i].id : ''
        ]);
      }
      modalTablicaApi.setData(rows);
    });
  }

  function closeModalOdabirLoze() {
    if (modal) {
      if (document.activeElement && modal.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('modal-tablica--open');
    }
  }

  /** Primjena odabrane lože u red preduvjeta i zatvaranje modala (zove se na OK ili dvoklik na red). */
  function applyModalSelectionAndClose() {
    if (selectedRowIndex == null || selectedRowIndex < 0 || selectedRowIndex >= preconditionsData.length) {
      closeModalOdabirLoze();
      return;
    }
    if (!modalTablicaApi || typeof modalTablicaApi.getSelectedRowIds !== 'function') {
      closeModalOdabirLoze();
      return;
    }
    var ids = modalTablicaApi.getSelectedRowIds();
    if (!ids || ids.length === 0) {
      closeModalOdabirLoze();
      return;
    }
    var data = modalTablicaApi.getData && modalTablicaApi.getData();
    if (!data) {
      closeModalOdabirLoze();
      return;
    }
    var selId = ids[0];
    var naziv = '';
    var idLoze = '';
    for (var j = 0; j < data.length; j++) {
      if (String(data[j][1]) === String(selId)) {
        naziv = data[j][0] != null ? String(data[j][0]) : '';
        idLoze = String(data[j][1]);
        break;
      }
    }
    preconditionsData[selectedRowIndex].naziv_loze = naziv;
    preconditionsData[selectedRowIndex].id_loze = idLoze;
    setPreconditionsTable();
    selectedRowIndex = null;
    closeModalOdabirLoze();
  }

  function initModalTablica() {
    if (!modalLozeContainer || typeof KontroleTablica !== 'function') return;
    modalTablicaApi = KontroleTablica(modalLozeContainer, {
      getBrojKolona: function () { return 2; },
      headerLabels: ['Naziv lože', 'ID lože'],
      headerColumns: [
        { title: 'Naziv lože', sortable_icon: 0, align: 'l', type: 't' },
        { title: 'ID lože', sortable_icon: 0, align: 'l', type: 't' }
      ],
      data: [],
      getRowId: function (row) { return row && row[1] != null ? row[1] : (row && row[0]); },
      onSelectionChange: function () {}
    });
  }

  if (modalOk) {
    modalOk.addEventListener('click', applyModalSelectionAndClose);
  }

  if (modalOdustani) {
    modalOdustani.addEventListener('click', closeModalOdabirLoze);
  }

  /* Dvoklik na red u modalu = OK (odabir te lože i zatvaranje). */
  if (modalLozeContainer) {
    modalLozeContainer.addEventListener('dblclick', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tr') : null;
      if (!tr || !tr.parentNode || tr.parentNode.tagName !== 'TBODY') return;
      e.preventDefault();
      e.stopPropagation();
      if (!modalTablicaApi) return;
      var rowId = tr.dataset && tr.dataset.rowId;
      if (rowId != null && typeof modalTablicaApi.setSelectedRowIds === 'function') {
        modalTablicaApi.setSelectedRowIds([rowId]);
      }
      applyModalSelectionAndClose();
    });
  }

  /* ========================================================================
     MAPIRANJE PODATAKA RADNE TABLICE NA PHP Clanovi_CRUD_upis.php
     ========================================================================
     Radna tablica (tablica rezultata) svaki red ima 18 elemenata (indeksi 0–17):
       [0] RB (prikazni, npr. "1."),
       [1] Lid (id lože – string, npr. "5"),
       [2] Šifra, [3] Ime, [4] Prezime, [5] Slika (ime datoteke),
       [6] Rođenje, [7] Inicijacija, [8] Stupanj (broj), [9] D. stupnja,
       [10] L. Inic (ne šalje se u PHP),
       [11] Telefon, [12] Meil, [13] Adresa 1, [14] Adresa 2, [15] Grad, [16] Pošta,
       [17] Napomena.
     U PHP šaljemo POST (i opcionalno multipart za slike) prema Clanovi_CRUD_upis.php.
     Ispod je za svaki parametar: odakle dolazi, kako se obrađuje, što se šalje.
     ======================================================================== */

  /**
   * id_loza
   *   Odakle: red radne tablice, kolona Lid – row[1]. String (npr. "5").
   *   Postupak: pretvoriti u cijeli broj (parseInt(row[1], 10)); mora biti > 0.
   *   U PHP: fd.append('id_loza', String(id_loza)).
   */

  /**
   * prezime
   *   Odakle: red radne tablice, kolona Prezime – row[4]. String iz Excel-a.
   *   Postupak: normalizirati – prvo slovo veliko, ostala mala (kao u Clanovi_CRUD: MB_CASE_TITLE ili ucwords(strtolower(trim))). PHP također normalizira; za konzistentnost i ovdje primijeniti istu logiku.
   *   U PHP: fd.append('prezime', trim(normalizirano)). Obavezno polje (PHP 115 ako prazno).
   */

  /**
   * ime
   *   Odakle: red radne tablice, kolona Ime – row[3]. String iz Excel-a.
   *   Postupak: ista normalizacija kao za prezime (prvo veliko, ostalo malo).
   *   U PHP: fd.append('ime', trim(normalizirano)).
   */

  /**
   * sifra
   *   Odakle: red radne tablice, kolona Šifra – row[2]. String.
   *   Postupak: trim; prazno dozvoljeno samo za kandidata (mi šaljemo kandidat=0 pa šifra mora biti neprazna ako provjera to traži).
   *   U PHP: fd.append('sifra', trim(sifra)). PHP za praznu šalje NULL u bazu.
   */

  /**
   * spol
   *   Odakle: fiksno za Transfer Excel – nije u radnoj tablici.
   *   Postupak: za sve slogove postaviti 0 (Muški).
   *   U PHP: fd.append('spol', '0').
   */

  /**
   * datum_rodjenja
   *   Odakle: red radne tablice, kolona Rođenje – row[6]. String (npr. "dd.mm.yyyy" iz Excel-a).
   *   Postupak: ako je prazan – šaljemo null (ne appendati ili PHP očekuje prazan string za null). Ako ima vrijednost – prilagoditi format u YYYY-MM-DD kako PHP očekuje (Clanovi_CRUD_upis koristi trim string).
   *   U PHP: ako null – ne appendati datum_rodjenja ili appendati prazno; PHP postavlja null ako trim === ''.
   */

  /**
   * datum_inicijacije
   *   Odakle: red radne tablice, kolona Inicijacija – row[7]. String (format iz Excel-a).
   *   Postupak: isto kao datum_rodjenja – prazno → null; inače konverzija u YYYY-MM-DD ako je potrebno.
   *   U PHP: fd.append('datum_inicijacije', ...) ili izostaviti ako null.
   */

  /**
   * datum_stupnja
   *   Odakle: red radne tablice, kolona D. stupnja – row[9]. String.
   *   Postupak: ako prazan – null; inače format YYYY-MM-DD za PHP.
   *   U PHP: fd.append('datum_stupnja', ...) ili izostaviti ako null.
   */

  /**
   * stupanj (id u bazi, ne broj stupnja)
   *   Odakle: red radne tablice, kolona Stupanj – row[8] (broj stupnja, npr. 1, 2, 3). ID lože ne dolazi odavde.
   *   Postupak: 1) Pozvati Transfer_Excel_CRUD_dohvat_stupnja.php?stupanj=<row[8]>. 2) Iz JSON odgovora uzeti id (stupnjevi.id gdje stupnjevi.stupanj = row[8] i stupnjevi.id_obred = 35). 3) Ako id je null – za taj red ili preskočiti upis ili logirati grešku (ovisno o specifikaciji).
   *   U PHP: fd.append('stupanj', String(id)). PHP očekuje id iz tablice stupnjevi.
   */

  /**
   * oib
   *   Odakle: nemamo u radnoj tablici.
   *   Postupak: uvijek šaljemo null (ne appendati ili PHP prima prazan string i pretvara u null).
   *   U PHP: ne appendati 'oib' ili appendati prazan string; Clanovi_CRUD_upis za prazan postavlja oib = null.
   */

  /**
   * na_prijedlog
   *   Odakle: nemamo u radnoj tablici.
   *   Postupak: uvijek null.
   *   U PHP: ne appendati ili appendati prazan; PHP postavlja na_prijedlog = null.
   */

  /**
   * porijeklo
   *   Odakle: fiksno za Transfer Excel.
   *   Postupak: za sve slogove 1.
   *   U PHP: fd.append('porijeklo', '1').
   */

  /**
   * id_drzava_adrese
   *   Odakle: fiksno za Transfer Excel.
   *   Postupak: za sve slogove 2.
   *   U PHP: fd.append('id_drzava_adrese', '2').
   */

  /**
   * telefon_text
   *   Odakle: red radne tablice, kolona Telefon – row[11]. String.
   *   Postupak: trim; ako prazan – šaljemo prazan string. PHP na strani servera dohvaća id tipa telefona (telefoni_tip WHERE Tip = 1), kreira novi zapis u tablici telefoni i postavlja clanovi.telefon na taj id.
   *   U PHP: fd.append('telefon_text', trim(telefon)).
   */

  /**
   * email_text
   *   Odakle: red radne tablice, kolona Meil – row[12]. String.
   *   Postupak: trim; prazan ako nema. PHP dohvaća id tipa (email_tip WHERE Tip = 1), INSERT u e_maili, ažurira clanovi.e_mail.
   *   U PHP: fd.append('email_text', trim(meil)).
   */

  /**
   * adresa_1, adresa_2, grad, posta
   *   Odakle: red radne tablice – row[13] Adresa 1, row[14] Adresa 2, row[15] Grad, row[16] Pošta. Stringovi.
   *   Postupak: trim za svako; prazno ako nema. PHP dohvaća id tipa adrese (adrese_tip WHERE Tip = 1), INSERT u adrese s id_drzave_adrese i ovim poljima, ažurira clanovi.adresa.
   *   U PHP: fd.append('adresa_1', ...), fd.append('adresa_2', ...), fd.append('grad', ...), fd.append('posta', ...).
   */

  /**
   * napomena
   *   Odakle: red radne tablice, kolona Napomena – row[17]. String.
   *   Postupak: trim; može biti prazan.
   *   U PHP: fd.append('napomena', napomena).
   */

  /**
   * aktivnost
   *   Odakle: fiksno za Transfer Excel.
   *   Postupak: za sve 1.
   *   U PHP: fd.append('aktivnost', '1').
   */

  /**
   * kandidat
   *   Odakle: fiksno za Transfer Excel.
   *   Postupak: za sve 0.
   *   U PHP: fd.append('kandidat', '0').
   */

  /**
   * zastavice
   *   Odakle: fiksno za Transfer Excel.
   *   Postupak: 0.
   *   U PHP: fd.append('zastavice', '0').
   */

  /**
   * slika, slika_mime, thumb, thumb_mime, thumb_round, thumb_round_mime
   *   Odakle: 1) Folder za slike = handle iz polja "Putanja mape sa slikama" (folderHandleSlike). 2) Ime datoteke = red radne tablice, kolona Slika – row[5]. String (npr. "ime.jpg").
   *   Postupak:
   *     a) Iz foldera dohvatiti datoteku: folderHandleSlike.getFileHandle(row[5]), zatim getFile(), pa arrayBuffer() ili blob.
   *     b) Glavna slika: sažeti na istu rezoluciju i format kao u modalu Clanovi (Obrada slike) – duža stranica max 1024 px (--slika_obrada_compress_max_px), WebP kvaliteta 0.75 (--slika_obrada_compress_quality). Slike u folderu su već 1:1,2 – samo skaliranje i konverzija u WebP.
   *     c) Thumb pravokutni: 64 px max širina, JPEG kvaliteta 0.85 (createThumbFromBlobClanovi(blob, 64) – isto kao u Clanovi_CRUD.js).
   *     d) Thumb kružni: 64×64 px, krug bez pozadine, WebP kvaliteta 0.9 (createRoundThumbFromBlob(blob, 64, 0) – isto kao u Clanovi_CRUD.js).
   *     e) MIME: glavna slika 'image/webp', thumb 'image/jpeg', thumb_round 'image/webp'.
   *   U PHP: fd.append('slika', blob, 'slika.webp'), fd.append('slika_mime', 'image/webp'); fd.append('thumb', thumbBlob, 'thumb.jpg'), fd.append('thumb_mime', 'image/jpeg'); fd.append('thumb_round', roundBlob, 'thumb_round.webp'), fd.append('thumb_round_mime', 'image/webp'). Ako datoteka ne postoji ili kolona Slika prazna – ne appendati slike (PHP će ostaviti NULL).
   */

  /**
   * L. Inic (row[10])
   *   U upis člana (Clanovi_CRUD_upis) ne šalje se. Koristi se za tablicu napredovanja – vidi blok "UPIS U TABLICU NAPREDOVANJA" ispod.
   */

  /* ========================================================================
     UPIS U TABLICU NAPREDOVANJA (jedan red po uspješno upisanom članu)
     ========================================================================
     Nakon uspješnog INSERT-a u clanovi za dani red radne tablice upisuje se
     jedan red u tablicu napredovanja. Struktura tablice: id, id_clanovi,
     id_stupanj, id_tip_napredovanja, id_loza_napredovanja, datum_napredovanja,
     loza_napredovanja (vidi spec baze).
     ======================================================================== */

  /**
   * napredovanja – id_clanovi
   *   Odakle: id novouposlanog člana. Dobiva se nakon INSERT u clanovi (PHP:
   *   $mysqli->insert_id). Bez ovog id-a ne možemo upisati napredovanje.
   *   Postupak: nakon što Clanovi_CRUD_upis.php vrati uspjeh, imamo id člana
   *   (ako PHP ga vrati u odgovoru) ili upis napredovanja obaviti u istom PHP-u
   *   nakon INSERT clanovi, pa id_clanovi = insert_id.
   *   U bazu: INSERT napredovanja (id_clanovi, ...) VALUES (?, ...).
   */

  /**
   * napredovanja – id_stupanj
   *   Odakle: isti id stupnja koji smo već dohvatili za taj red radne tablice
   *   (Transfer_Excel_CRUD_dohvat_stupnja.php?stupanj=row[8], id_obred=35).
   *   Taj id šaljemo i u Clanovi_CRUD_upis kao stupanj. Ne dohvaćamo ga
   *   ponovo – koristimo istu vrijednost.
   *   U bazu: id_stupanj = taj id (int).
   */

  /**
   * napredovanja – id_tip_napredovanja
   *   Odakle: fiksno za Transfer Excel.
   *   Postupak: za sve slogove 1.
   *   U bazu: id_tip_napredovanja = 1.
   */

  /**
   * napredovanja – id_loza_napredovanja i loza_napredovanja (postupak)
   *   Odakle: tekst iz kolone L. Inic radne tablice – row[10] (naziv lože, string).
   *   Referenca za usporedbu: tablica preduvjeta (popis Excel fajlova), 3 kolone:
   *     [0] Ime fajla, [1] Naziv Lože, [2] ID (id lože).
   *   U edit formi postoji selekt s popisom loža i njihovim id-ovima. Prvi
   *   izbor u selektu je "Druga loža" s id = 0 (oznaka za "loža nije u listi").
   *
   *   Postupak:
   *     1) Uzeti sadržaj L. Inic za taj red – trim(row[10]).
   *     2) U tablici preduvjeta (preconditionsData) tražiti red u kojem je
   *        Naziv Lože (2. kolona, odnosno polje naziv_loze) jednak tom nazivu.
   *        Usporedba: po želji normalizirati (trim, ignore case) da se podudaranje
   *        pronađe kad je naziv isti.
   *     3) Ako se pronađe:
   *        – id_loza_napredovanja = id lože iz tog retka (3. kolona, polje id_loze).
   *        – loza_napredovanja = prazno ili NULL (nije potrebno – loža je u listi).
   *     4) Ako se ne pronađe:
   *        – id_loza_napredovanja = 0 (odgovara opciji "Druga loža" u selektu;
   *          u bazi je NOT NULL, 0 je valjana vrijednost ako je "Druga loža"
   *          definiran s id = 0 u listi loža).
   *        – loza_napredovanja = sadržaj stupca L. Inic (row[10]) – upisati
   *          taj string u kolonu loza_napredovanja (varchar(50), NULL dopušten),
   *          da znamo gdje je član napredovao ako loža nije u našem popisu.
   *
   *   U bazu: INSERT napredovanja (..., id_loza_napredovanja, loza_napredovanja)
   *   s ovako izračunatim vrijednostima.
   */

  /**
   * napredovanja – datum_napredovanja
   *   Odakle: red radne tablice, kolona D. stupnja – row[9]. Isti datum koji
   *   šaljemo u Clanovi_CRUD_upis kao datum_stupnja.
   *   Postupak: ako je row[9] prazan – u bazu upisati NULL. Ako ima vrijednost –
   *   konvertirati u format datuma YYYY-MM-DD (isto kao za datum_stupnja člana)
   *   i upisati u kolonu datum_napredovanja (date, NULL dopušten).
   *   U bazu: datum_napredovanja = konvertirani datum ili NULL.
   */

  /* ----- Blok za pripremu i slanje podataka na Clanovi_CRUD_upis.php -----
   * Za svaki red radne tablice: 1) dohvatiti id stupnja (GET Transfer_Excel_CRUD_dohvat_stupnja.php?stupanj=...),
   * 2) normalizirati ime/prezime, konvertirati datume u YYYY-MM-DD ako treba, 3) ako ima sliku – učitati iz folderHandleSlike,
   * sažeti glavnu + napraviti thumb i thumb_round, 4) sastaviti FormData prema gornjim pravilima, 5) fetch POST na Clanovi_CRUD_upis.php.
   * Nakon uspješnog upisa člana: 6) upisati jedan red u tablicu napredovanja prema bloku "UPIS U TABLICU NAPREDOVANJA" iznad
   * (id_clanovi = novi id člana, id_stupanj = već dohvaćeni id, id_loza_napredovanja/loza_napredovanja iz L. Inic + preduvjeti, datum_napredovanja iz D. stupnja).
   * Simuliraj: transakcija s rollback, pozadina retka siva pri uspjehu. Upiši: commit, tekst retka zelen pri uspjehu.
   * ======================================================================== */

  /** Vraća tbody redove tablice rezultata (za postavljanje CSS klasa). */
  function getResultTableBodyRows() {
    var container = document.getElementById('tablicaRezultatContainer');
    var tbody = container && container.querySelector('tbody');
    return tbody ? tbody.rows : [];
  }

  function postFormDataToUpis(fd) {
    return fetch(getApiUrl('Clanovi_CRUD_upis.php'), {
      method: 'POST',
      body: fd
    }).then(function (r) { return r.text(); });
  }

  /**
   * Simuliraj: za svaki red radne tablice dohvat id stupnja, priprema slike (ako ima), FormData s simuliraj=1, POST.
   * Uspjeh → siva pozadina retka. Greška → log i prekid (ne prelazak na Upiši).
   * Log se ne briše; odgovori OK idu u jedan red odvojeni s ", "; tablica se skrola na upravo obrađeni red.
   */
  function runSimuliraj() {
    if (!tablicaRezultatApi || typeof tablicaRezultatApi.getData !== 'function') return;
    var data = tablicaRezultatApi.getData();
    if (!Array.isArray(data) || data.length === 0) return;
    if (!folderHandleSlike && data.some(function (r) { return trim(r[5]); })) {
      appendLog('Putanja mape sa slikama nije odabrana.');
      return;
    }
    var rows = getResultTableBodyRows();
    var btnSimuliraj = document.getElementById('btn_simuliraj');
    var btnUpisi = document.getElementById('btn_upisi');
    var chkSifra = document.getElementById('chk_testirati_sifru');
    var footerChkLabel = chkSifra && chkSifra.closest ? chkSifra.closest('label.transfer-excel-crud__footer-checkbox') : null;
    if (btnSimuliraj) btnSimuliraj.disabled = true;
    if (btnUpisi) btnUpisi.disabled = true;
    if (chkSifra) chkSifra.disabled = true;
    if (footerChkLabel) footerChkLabel.classList.add('kontrola-labela--disabled');
    appendLogHeader('Simulacija upisa (član + napredovanje, rollback)');
    var progressLine = appendLogLineReturn('');
    var index = 0;
    function next() {
      if (index >= data.length) {
        appendLog('Simulacija završena: svi redovi prošli.');
        osvjeziStanjeDrugogPanela();
        return;
      }
      scrollResultTableToRow(index);
      var row = data[index];
      var rb = row[0] != null ? String(row[0]) : String(index + 1);
      var stupanjNum = row[8] != null && String(row[8]).trim() !== '' ? parseInt(String(row[8]).trim(), 10) : null;
      if (stupanjNum == null || isNaN(stupanjNum)) stupanjNum = 0;
      fetchStupanjId(stupanjNum).then(function (idStupanj) {
        var napredovanja = resolveNapredovanjaLoza(preconditionsData, row[10]);
        var datumNapredovanja = dateToYyyyMmDd(row[9]);
        var slikaIme = trim(row[5]);
        var imagePromise = slikaIme && folderHandleSlike ? prepareImageBlobs(folderHandleSlike, slikaIme) : Promise.resolve(null);
        return imagePromise.then(function (imageBlobs) {
          var fd = buildFormDataForRow(row, idStupanj, napredovanja, datumNapredovanja, true, imageBlobs);
          return postFormDataToUpis(fd);
        });
      }).then(function (responseText) {
        if (progressLine) {
          var part = 'Red ' + rb + ' – odgovor PHP: ' + responseText;
          progressLine.textContent = progressLine.textContent ? progressLine.textContent + ', ' + part : part;
          var logContainer = logEl || document.getElementById('transfer_excel_log');
          if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
        }
        var testiratiSifru = document.getElementById('chk_testirati_sifru');
        var ignoriraj114 = testiratiSifru && !testiratiSifru.checked;
        var ok = responseText === 'OK' || responseText === '110' || (ignoriraj114 && responseText === '114');
        if (ok) {
          if (rows[index]) rows[index].classList.add('transfer-excel-crud__row-simuliraj-ok');
          index++;
          next();
        } else {
          appendLog('Red ' + rb + ': greška – ' + responseText);
          osvjeziStanjeDrugogPanela();
        }
      }).catch(function (err) {
        appendLog('Red ' + rb + ': greška – ' + (err && err.message ? err.message : String(err)));
        osvjeziStanjeDrugogPanela();
      });
    }
    next();
  }

  /**
   * Upiši: za svaki red isto kao Simuliraj, ali simuliraj=0 (commit). Uspjeh → zelena boja teksta retka.
   * Log se ne briše; odgovori OK idu u jedan red odvojeni s ", "; tablica se skrola na upravo obrađeni red.
   */
  function runUpisi() {
    if (!tablicaRezultatApi || typeof tablicaRezultatApi.getData !== 'function') return;
    var data = tablicaRezultatApi.getData();
    if (!Array.isArray(data) || data.length === 0) return;
    if (!folderHandleSlike && data.some(function (r) { return trim(r[5]); })) {
      appendLog('Putanja mape sa slikama nije odabrana.');
      return;
    }
    var rows = getResultTableBodyRows();
    var btnSimuliraj = document.getElementById('btn_simuliraj');
    var btnUpisi = document.getElementById('btn_upisi');
    var chkSifraUpisi = document.getElementById('chk_testirati_sifru');
    var footerChkLabelUpisi = chkSifraUpisi && chkSifraUpisi.closest ? chkSifraUpisi.closest('label.transfer-excel-crud__footer-checkbox') : null;
    if (btnSimuliraj) btnSimuliraj.disabled = true;
    if (btnUpisi) btnUpisi.disabled = true;
    if (chkSifraUpisi) chkSifraUpisi.disabled = true;
    if (footerChkLabelUpisi) footerChkLabelUpisi.classList.add('kontrola-labela--disabled');
    appendLogHeader('Upis (član + napredovanje, commit)');
    var progressLine = appendLogLineReturn('');
    var index = 0;
    function next() {
      if (index >= data.length) {
        appendLog('Upis završen.');
        osvjeziStanjeDrugogPanela();
        return;
      }
      scrollResultTableToRow(index);
      var row = data[index];
      var rb = row[0] != null ? String(row[0]) : String(index + 1);
      var stupanjNum = row[8] != null && String(row[8]).trim() !== '' ? parseInt(String(row[8]).trim(), 10) : null;
      if (stupanjNum == null || isNaN(stupanjNum)) stupanjNum = 0;
      fetchStupanjId(stupanjNum).then(function (idStupanj) {
        var napredovanja = resolveNapredovanjaLoza(preconditionsData, row[10]);
        var datumNapredovanja = dateToYyyyMmDd(row[9]);
        var slikaIme = trim(row[5]);
        var imagePromise = slikaIme && folderHandleSlike ? prepareImageBlobs(folderHandleSlike, slikaIme) : Promise.resolve(null);
        return imagePromise.then(function (imageBlobs) {
          var fd = buildFormDataForRow(row, idStupanj, napredovanja, datumNapredovanja, false, imageBlobs);
          return postFormDataToUpis(fd);
        });
      }).then(function (responseText) {
        if (progressLine) {
          var part = 'Red ' + rb + ' – odgovor PHP: ' + responseText;
          progressLine.textContent = progressLine.textContent ? progressLine.textContent + ', ' + part : part;
          var logContainer = logEl || document.getElementById('transfer_excel_log');
          if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
        }
        var testiratiSifru = document.getElementById('chk_testirati_sifru');
        var ignoriraj114 = testiratiSifru && !testiratiSifru.checked;
        var ok = responseText === 'OK' || responseText === '110' || (ignoriraj114 && responseText === '114');
        if (ok) {
          if (rows[index]) rows[index].classList.add('transfer-excel-crud__row-upis-ok');
          index++;
          next();
        } else {
          appendLog('Red ' + rb + ': greška – ' + responseText);
          osvjeziStanjeDrugogPanela();
        }
      }).catch(function (err) {
        appendLog('Red ' + rb + ': greška – ' + (err && err.message ? err.message : String(err)));
        osvjeziStanjeDrugogPanela();
      });
    }
    next();
  }

  var btnSimuliraj = document.getElementById('btn_simuliraj');
  var btnUpisiEl = document.getElementById('btn_upisi');
  if (btnSimuliraj) {
    btnSimuliraj.addEventListener('click', function () {
      if (this.disabled) return;
      runSimuliraj();
    });
  }
  if (btnUpisiEl) {
    btnUpisiEl.addEventListener('click', function () {
      if (this.disabled) return;
      runUpisi();
    });
  }

  var btnPovratak = document.getElementById('btnPovratak');
  if (btnPovratak) {
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
  }

  logEl = document.getElementById('transfer_excel_log');

  loadMasterData();
  setPreconditionsTable();
  setRezultatData([]);
  osvjeziStanjeDrugogPanela(); /* Početno stanje drugog panela (disabled dok preduvjeti nisu ispunjeni) */
  initModalTablica();

  window.TransferExcelCRUD = TransferExcelCRUD;
  window.TransferExcelSetRezultatData = setRezultatData;
  window.TransferExcelValidirajUvjeteUcitavanjaRezultata = validirajUvjeteUcitavanjaRezultata;
  window.TransferExcelAppendLog = appendLog;
})();
