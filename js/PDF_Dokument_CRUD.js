/* PDF_Dokument_CRUD.js — forma „Dokumenti".
 * Tab Podaci: edit odabrane stavke. Tab Dokument: zaglavlje + popis stavki (dodaj/obriši/gore/dolje).
 * Tab PDF: živi preview (PDF_Generator_resolve.php → pdf-render.js → iframe).
 * Stavke se drže u memoriji; spremaju se cijele kroz PDF_Dokument_spremi.php.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Dokument_CRUD.html');

  var API = '../php/';
  var URL_SVE = API + 'PDF_Dokument_sve.php';
  var URL_JEDAN = API + 'PDF_Dokument_jedan.php';
  var URL_SPREMI = API + 'PDF_Dokument_spremi.php';
  var URL_BRISANJE = API + 'PDF_Dokument_brisanje.php';
  var URL_RESOLVE = API + 'PDF_Generator_resolve.php';
  var URL_TRAZI_ID = API + 'PDF_Dokument_trazi_id.php';
  var URL_OKVIRI = API + 'PDF_Dokument_okviri.php';

  function byId(id) { return document.getElementById(id); }
  function val(id) { var e = byId(id); return e ? e.value : ''; }
  function setVal(id, v) { var e = byId(id); if (e) e.value = (v == null ? '' : String(v)); }
  function trim(s) { return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : ''); }
  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK' || s.indexOf('OK,') === 0) return null;
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
  function xhrGet(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onreadystatechange = function () { if (x.readyState === 4) cb((x.responseText || '').trim(), x.status); };
    x.send();
  }
  function postJson(url, obj, cb) {
    var x = new XMLHttpRequest();
    x.open('POST', url, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function () { if (x.readyState === 4) cb((x.responseText || '').trim(), x.status); };
    x.send(JSON.stringify(obj));
  }

  /* ---- Stanje ---- */
  var docPoId = {};            /* id → dokument zaglavlje */
  var tekuciId = 0;            /* 0 = novi */
  var stavke = [];             /* niz stavki u memoriji */
  var dokOkviri = [];          /* vezani tekst blokovi templatea dokumenta [{id,naziv,redoslijed}] */
  var dokOkviriPoId = {};      /* id → okvir */
  var tidSeq = 1;              /* client temp-id za stavke */
  var odabranaStavka = null;   /* _tid odabrane stavke */
  var prikaziBlokove = false;   /* toggle: vodilice (margine/zone) u PDF-u */
  var blokStranica = 1;         /* referentna stranica za pravila zona (1 / 2) */
  /* Lookup mape (id → naziv) za prikaz u tablici stavki */
  var mapaIzvor = {}, mapaIzvorTip = {}, mapaParagraf = {}, mapaSlika = {}, mapaTemplate = {}, mapaRelacija = {};
  var mapaMetaKolone = {};   /* { tablica: [ {kolona, blob, komentar}, ... ] } iz information_schema (za selekt Traži kolonu) */

  /* ---- Selekti (template / izvor / stilovi) ---- */
  function napuniSelekt(selId, arr, mapa, opcijaPrazno) {
    var sel = byId(selId);
    if (!sel) return;
    while (sel.options.length > (opcijaPrazno ? 1 : 0)) sel.remove(sel.options.length - 1);
    arr.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = String(o.id);
      opt.textContent = o.naziv != null ? o.naziv : ('#' + o.id);
      sel.appendChild(opt);
      if (mapa) mapa[String(o.id)] = o;
    });
    refreshSelect(selId);
  }
  function ucitajSveSelekte(cb) {
    var preostalo = 6;
    function gotovo() { if (--preostalo === 0 && cb) cb(); }
    xhrGet(API + 'PDF_Relacije_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); mapaRelacija = {}; napuniSelekt('st_relacija', a, mapaRelacija, true); } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Whitelist_CRUD_meta.php', function (t) {
      try { mapaMetaKolone = JSON.parse(t || '{}') || {}; } catch (e) { mapaMetaKolone = {}; }
      gotovo();
    });
    xhrGet(API + 'PDF_Template_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaTemplate[String(o.id)] = o; }); napuniSelekt('edit_template_id', a, null, true); } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Whitelist_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaIzvor[String(o.id)] = o; }); napuniSelekt('st_izvor', a, null, true); napuniSelekt('st_preko_izvor', a, null, true); } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Stilovi_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaParagraf[String(o.id)] = o; }); napuniSelekt('st_paragraf_id', a, null, true); napuniSelekt('edit_broj_stranice_paragraf_id', a, null, true); napuniSelekt('edit_extra_prored_paragraf_id', a, null, true); } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Stilovi_Slike_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaSlika[String(o.id)] = o; }); napuniSelekt('st_slika_stil_id', a, null, true); } catch (e) {}
      gotovo();
    });
  }

  /* ---- Tablica dokumenata + „Nasljedi dokument" ---- */
  var DOK_CFG = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-dokument-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Dokument', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var dokApi = null;
  CommonCRUD.initTablica('dokTablica', DOK_CFG, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },
    onReady: function (api) { dokApi = api; },
    onSelectionChange: function () { naDokSelekcija(); }
  });

  function napuniNasljediSelekt() {
    var sel = byId('edit_naslijedi_dok');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    var lista = Object.keys(docPoId).map(function (k) { return docPoId[k]; })
      .sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
    lista.forEach(function (o) { var opt = document.createElement('option'); opt.value = String(o.id); opt.textContent = o.naziv != null ? o.naziv : ('#' + o.id); sel.appendChild(opt); });
    sel.value = '';
    refreshSelect('edit_naslijedi_dok');
    azurirajSpremiStanje();   /* enable/disable nasljedi+template+opis prema nazivu i postojanju dokumenata */
  }

  function ucitajDokumente(cb) {
    xhrGet(URL_SVE, function (t) {
      docPoId = {};
      var rows = [];
      if (t.charAt(0) === '[') {
        try {
          var arr = JSON.parse(t || '[]');
          arr.sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
          arr.forEach(function (o) { docPoId[String(o.id)] = o; rows.push([o.naziv != null ? o.naziv : ('#' + o.id), o.id]); });
        } catch (e) {}
      } else { porukaIzKoda(t); }
      CommonCRUD.setDataTablica(dokApi, 'dokTablica', rows, DOK_CFG.Tablica_Zaglavlje);
      napuniNasljediSelekt();
      if (cb) cb();
    });
  }

  function naDokSelekcija() {
    var id = CommonCRUD.getSelectedRowId(dokApi);
    if (id == null) return;   /* deselekcija → novi dokument preko gumba „Novi" */
    osvjeziEditSelekte(function () {   /* osvježi selekte (whitelist/stilovi) prije punjenja — vidi nove iz druge instance */
      xhrGet(URL_JEDAN + '?id=' + encodeURIComponent(id), function (t) {
        try {
          var o = JSON.parse(t || '{}');
          if (o.greska) { porukaIzKoda(o.greska); return; }
          popuniDokument(o.dokument, o.stavke || []);
        } catch (e) {}
      });
    });
  }

  /* ---- Tablica stavki ---- */
  var STAVKE_CFG = {
    Broj_Kolona: 9,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-dokument-crud',
    Tablica_Zaglavlje: [
      { key: 'red', title: '#', SQL_Naziv: 'red', sortable: 0, sortable_icon: 0, type: 't', width: 40, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'naziv', title: 'Naziv stavke', SQL_Naziv: 'naziv', sortable: 0, sortable_icon: 0, type: 't', width: 280, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'status', title: '', SQL_Naziv: 'status', sortable: 0, sortable_icon: 0, type: 't', width: 30, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'zona', title: 'Zona', SQL_Naziv: 'zona', sortable: 0, sortable_icon: 0, type: 't', width: 110, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'vrsta', title: 'Vrsta', SQL_Naziv: 'vrsta', sortable: 0, sortable_icon: 0, type: 't', width: 80, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'izvor', title: 'Izvor', SQL_Naziv: 'izvor', sortable: 0, sortable_icon: 0, type: 't', width: -24, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stil', title: 'Stil', SQL_Naziv: 'stil', sortable: 0, sortable_icon: 0, type: 't', width: -20, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'kljuc', title: 'Ključ', SQL_Naziv: 'kljuc', sortable: 0, sortable_icon: 0, type: 't', width: 90, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'test', title: 'Test ID', SQL_Naziv: 'test', sortable: 0, sortable_icon: 0, type: 't', width: 70, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var stavkeApi = null;
  CommonCRUD.initTablica('stavkeTablica', STAVKE_CFG, {
    getRowId: function (row) { return row && row[9] != null ? row[9] : null; },
    onReady: function (api) { stavkeApi = api; },
    onSelectionChange: function () { naStavkaSelekcija(); }
  });

  /* ---- Vezani tekst blokovi (okviri templatea) ---- */
  function zonaLabel(s) {
    if (s && s.okvir_id) {
      var o = dokOkviriPoId[String(s.okvir_id)];
      return 'Blok: ' + (o && o.naziv ? o.naziv : ('#' + s.okvir_id));
    }
    var ZONE = { tijelo: 'Tijelo', zaglavlje: 'Zaglavlje', podnozje: 'Podnožje', naslovna: 'Naslovna' };
    return (s && ZONE[s.zona]) || (s && s.zona) || '';
  }
  /* Ponovo izgradi „zona" select: 4 osnovne zone + „Blok: <naziv>" po okviru templatea. */
  function popuniZonaSelect() {
    var sel = byId('st_zona');
    if (!sel) return;
    var trenutno = sel.value;
    while (sel.options.length) sel.remove(0);
    [['tijelo', 'Tijelo'], ['zaglavlje', 'Zaglavlje'], ['podnozje', 'Podnožje'], ['naslovna', 'Naslovna']].forEach(function (z) {
      var o = document.createElement('option'); o.value = z[0]; o.textContent = z[1]; sel.appendChild(o);
    });
    dokOkviri.forEach(function (ok) {
      var o = document.createElement('option'); o.value = 'okvir:' + ok.id; o.textContent = 'Blok: ' + (ok.naziv || ('#' + ok.id)); sel.appendChild(o);
    });
    sel.value = trenutno;
    if (sel.value !== trenutno) sel.value = 'tijelo';
    refreshSelect('st_zona');
  }
  /* Dohvati okvire za template dokumenta; rebuild zona selecta; cb na kraju. */
  function ucitajOkvire(templateId, cb) {
    templateId = parseInt(templateId, 10) || 0;
    if (!templateId) { dokOkviri = []; dokOkviriPoId = {}; popuniZonaSelect(); if (cb) cb(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', URL_OKVIRI + '?template_id=' + encodeURIComponent(templateId), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      dokOkviri = []; dokOkviriPoId = {};
      var text = (xhr.responseText || '').trim();
      if (text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) { dokOkviri.push(arr[i]); dokOkviriPoId[String(arr[i].id)] = arr[i]; }
        } catch (e) {}
      }
      popuniZonaSelect();
      if (cb) cb();
    };
    xhr.send();
  }

  function stavkaRed(s, idx) {
    var izv = s.izvor_id && mapaIzvor[String(s.izvor_id)] ? mapaIzvor[String(s.izvor_id)].tablica : '';
    var stil = '';
    if (s.vrsta === 'tekst' && s.paragraf_id && mapaParagraf[String(s.paragraf_id)]) stil = mapaParagraf[String(s.paragraf_id)].naziv;
    if (s.vrsta === 'slika' && s.slika_stil_id && mapaSlika[String(s.slika_stil_id)]) stil = mapaSlika[String(s.slika_stil_id)].naziv;
    var kljuc = (s.izvor_tip === 'dinamicki') ? (s.kontekst_kljuc || '') : '';
    var test = (s.izvor_tip === 'dinamicki' && s.test_id) ? String(s.test_id) : '';
    /* Status odlomka (samo za tekst; za slike nema smisla): ⁋ kraj odlomka; ⇥ spoj u isti red; ⮐ novi red, isti odlomak. */
    var bkv = parseInt(s.bez_kraja_odlomka, 10) || 0;
    var status = (s.vrsta !== 'tekst') ? '' : ((bkv === 1) ? '⇥' : ((bkv === 2) ? '⮐' : '⁋'));
    return [String(idx + 1), s.naziv_stavke || '', status, zonaLabel(s), s.vrsta || '', izv, stil, kljuc, test, s._tid];
  }
  function osvjeziTablicuStavki() {
    var rows = stavke.map(stavkaRed);
    CommonCRUD.setDataTablica(stavkeApi, 'stavkeTablica', rows, STAVKE_CFG.Tablica_Zaglavlje);
  }
  function stavkaPoTid(tid) {
    for (var i = 0; i < stavke.length; i++) if (String(stavke[i]._tid) === String(tid)) return stavke[i];
    return null;
  }
  function indexPoTid(tid) {
    for (var i = 0; i < stavke.length; i++) if (String(stavke[i]._tid) === String(tid)) return i;
    return -1;
  }

  /* ---- Popup „sve postavke stavke" (dvoklik na red tablice; klik van zatvara) ----
     Koristi kanonsku .kontrola-modal strukturu (overlay/dialog/header/body/content) kao ostali modali u app. */
  function zatvoriStavkaPopup() {
    var p = document.getElementById('stavkaPopup');
    if (p && p.parentNode) p.parentNode.removeChild(p);
  }
  function popupRed(label, val, pod) {
    var row = document.createElement('div');
    row.className = 'pdf-dokument-crud__popup-red' + (pod ? ' pdf-dokument-crud__popup-red--pod' : '');
    var l = document.createElement('span'); l.className = 'pdf-dokument-crud__popup-labela'; l.textContent = label;
    var v = document.createElement('span'); v.className = 'pdf-dokument-crud__popup-vrijednost';
    v.textContent = (val == null || String(val).trim() === '') ? '—' : String(val);
    row.appendChild(l); row.appendChild(v);
    return row;
  }
  function prikaziStavkaPopup(s) {
    zatvoriStavkaPopup();
    var TIP = { staticki: 'Statički (fiksni ID)', dinamicki: 'Dinamički (iz konteksta)', po_vrijednosti: 'Po vrijednosti', korisnicki: 'Korisnički tekst', relacija_broj: 'Relacija — broj (mapa)', relacija_lista: 'Relacija — lista naziva', relacija_redak: 'Relacija — redak (predložak)', relacija_grupe: 'Relacija — grupe (po tipu)' };
    var SPOJ = { 0: 'Kraj odlomka', 1: 'Spoji u isti red', 2: 'Spoji u novi red (isti odlomak)' };
    var izvor = s.izvor_id && mapaIzvor[String(s.izvor_id)] ? mapaIzvor[String(s.izvor_id)] : null;
    var stil = '';
    if (s.vrsta === 'tekst' && s.paragraf_id && mapaParagraf[String(s.paragraf_id)]) stil = mapaParagraf[String(s.paragraf_id)].naziv;
    if (s.vrsta === 'slika' && s.slika_stil_id && mapaSlika[String(s.slika_stil_id)]) stil = mapaSlika[String(s.slika_stil_id)].naziv;

    var modal = document.createElement('div');
    modal.id = 'stavkaPopup';
    modal.className = 'kontrola-modal kontrola-modal--dim kontrola-modal--open';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.zIndex = '10002';
    var overlay = document.createElement('div'); overlay.className = 'kontrola-modal__overlay';
    var dialog = document.createElement('div'); dialog.className = 'kontrola-modal__dialog pdf-dokument-crud__popup-modal';
    var header = document.createElement('div'); header.className = 'kontrola-modal__header';
    var redni = indexPoTid(s._tid) + 1;   /* pozicija stavke u dokumentu (kao „#" u tablici) */
    var hs = document.createElement('span'); hs.textContent = 'Stavka (' + redni + ')' + (s.naziv_stavke ? ' — ' + s.naziv_stavke : ''); header.appendChild(hs);
    var body = document.createElement('div'); body.className = 'kontrola-modal__body kontrola-modal__body--text-only';
    var content = document.createElement('div'); content.className = 'kontrola-modal__content';
    content.appendChild(popupRed('Naziv stavke', s.naziv_stavke));
    content.appendChild(popupRed('Zona', zonaLabel(s)));
    content.appendChild(popupRed('Vrsta', s.vrsta));
    content.appendChild(popupRed('Način dohvata', TIP[s.izvor_tip] || s.izvor_tip));
    /* potpis ispod „Način dohvata" (uvučeno); uvijek prisutno, „—" kad nema izvora (npr. korisnički tekst) */
    content.appendChild(popupRed('Tablica', izvor ? izvor.tablica : '', true));
    content.appendChild(popupRed('Whitelist', izvor ? izvor.naziv : '', true));
    content.appendChild(popupRed('ID retka', s.izvor_red_id));
    content.appendChild(popupRed('Ključ konteksta', s.kontekst_kljuc));
    var preko = s.preko_izvor_id && mapaIzvor[String(s.preko_izvor_id)] ? mapaIzvor[String(s.preko_izvor_id)] : null;
    content.appendChild(popupRed('Veza (preko)', preko ? (preko.tablica + '.' + preko.kolona + ' — ' + preko.naziv) : ''));
    var rel = s.relacija_id && mapaRelacija[String(s.relacija_id)] ? mapaRelacija[String(s.relacija_id)] : null;
    content.appendChild(popupRed('Relacija', rel ? rel.naziv : (s.relacija_id ? ('#' + s.relacija_id) : '')));
    var NAC = { zarez: 'Zarez (isti red)', novi_red: 'Novi red (isti odlomak)', novi_odlomak: 'Novi odlomak' };
    content.appendChild(popupRed('Spajanje liste', s.lista_nacin ? (NAC[s.lista_nacin] || s.lista_nacin) : ''));
    content.appendChild(popupRed('Redak-predložak', s.redak_predlozak));
    if (s.izvor_tip === 'relacija_grupe') content.appendChild(popupRed('Labela podebljana', parseInt(s.labela_bold, 10) ? 'da' : 'ne'));
    content.appendChild(popupRed('Testni ID', s.test_id));
    content.appendChild(popupRed('Traži kolonu', s.trazi_kolona));
    content.appendChild(popupRed('Tražena vrijednost', s.trazi_vrijednost));
    content.appendChild(popupRed('Mapa vrijednosti', s.mapa_vrijednosti));
    content.appendChild(popupRed('Format datuma', s.format_datuma));
    content.appendChild(popupRed('Fiksna pozicija (X)', s.fiksna_pozicija != null ? (s.fiksna_pozicija + ' mm') : ''));
    content.appendChild(popupRed('Apsolutni Y', s.fiksna_pozicija_y != null ? (s.fiksna_pozicija_y + ' mm') : ''));
    content.appendChild(popupRed('Korisnički tekst', s.literal_tekst));
    content.appendChild(popupRed(s.vrsta === 'slika' ? 'Stil slike' : 'Stil teksta', stil));
    content.appendChild(popupRed('Spajanje', SPOJ[parseInt(s.bez_kraja_odlomka, 10) || 0]));
    body.appendChild(content);
    dialog.appendChild(header); dialog.appendChild(body);
    modal.appendChild(overlay); modal.appendChild(dialog);
    modal.addEventListener('click', function (e) { if (!dialog.contains(e.target)) zatvoriStavkaPopup(); });   /* klik van dijaloga (overlay) zatvara */
    document.body.appendChild(modal);
    if (typeof KontroleModalDrag === 'function') KontroleModalDrag(dialog, header);   /* premještanje povlačenjem zaglavlja */
  }
  (function () {
    var cont = byId('stavkeTablica');
    if (!cont) return;
    cont.addEventListener('dblclick', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tr') : null;
      if (!tr || tr.dataset.rowId == null) return;
      var s = stavkaPoTid(tr.dataset.rowId);
      if (s) prikaziStavkaPopup(s);
    });
  })();

  /* ---- Edit stavke (Tab Podaci) ---- */
  var STAVKA_POLJA = ['st_naziv_stavke', 'st_zona', 'st_vrsta', 'st_izvor', 'st_izvor_tip', 'st_izvor_red_id', 'st_kontekst_kljuc', 'st_test_id', 'st_preko_izvor', 'st_relacija', 'st_lista_nacin', 'st_lista_separator', 'st_redak_predlozak', 'st_labela_bold', 'st_mapa_vrijednosti', 'st_format_datuma', 'st_fiksna_pozicija', 'st_fiksna_pozicija_y', 'st_trazi_kolona', 'st_trazi_vrijednost', 'st_literal_tekst', 'st_paragraf_id', 'st_slika_stil_id', 'st_bez_kraja_odlomka', 'st_novi_red_odlomka', 'st_sakrij_ako_prazno'];

  function azurirajVidljivostStavke() {
    var vrsta = val('st_vrsta');
    var tip = val('st_izvor_tip');
    /* Korisnički tekst i relacija su samo za tekst-stavke; ako je slika odabrana, vrati na statički. */
    if (vrsta === 'slika' && (tip === 'korisnicki' || tip === 'relacija_broj' || tip === 'relacija_lista' || tip === 'relacija_redak' || tip === 'relacija_grupe')) { setVal('st_izvor_tip', 'staticki'); refreshSelect('st_izvor_tip'); tip = 'staticki'; }
    var korisnicki = (tip === 'korisnicki');
    var relacija = (tip === 'relacija_broj' || tip === 'relacija_lista' || tip === 'relacija_redak' || tip === 'relacija_grupe');
    var relacijaLista = (tip === 'relacija_lista');
    var relacijaRedak = (tip === 'relacija_redak');
    var relacijaGrupe = (tip === 'relacija_grupe');
    var predlozakVidljiv = (relacijaRedak || relacijaGrupe);   /* redak-predložak / predložak imena */
    byId('polje_izvor').hidden = korisnicki || relacija;     /* korisnički tekst i relacija nemaju whitelist izvor */
    byId('polje_izvor_red_id').hidden = (tip !== 'staticki');
    byId('polje_kontekst_kljuc').hidden = (tip !== 'dinamicki' && !relacija);   /* dinamicki I relacija trebaju ključ konteksta */
    byId('polje_test_id').hidden = (tip !== 'dinamicki');
    /* Testni ID + "…" gumb: omogućeni samo kad je dinamički i odabran whitelist izvor. */
    var testOmoguci = (tip === 'dinamicki' && trim(val('st_izvor')) !== '');
    var tEl = byId('st_test_id'), tBtn = byId('btnTestIdModal');
    if (tEl) { if (typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(tEl, testOmoguci); else tEl.disabled = !testOmoguci; }
    if (tBtn) tBtn.disabled = !testOmoguci;
    byId('polje_trazi_kolona').hidden = (tip !== 'po_vrijednosti');
    byId('polje_trazi_vrijednost').hidden = (tip !== 'po_vrijednosti');
    byId('polje_literal_tekst').hidden = !korisnicki;
    byId('polje_paragraf').hidden = (vrsta !== 'tekst');
    byId('polje_slika_stil').hidden = (vrsta !== 'slika');
    byId('polje_bez_kraja').hidden = (vrsta !== 'tekst');
    byId('polje_preko_izvor').hidden = (tip !== 'dinamicki');   /* indirektni ključ samo za dinamički */
    byId('polje_relacija').hidden = !relacija;                   /* whitelist relacije (1-na-više) */
    byId('polje_lista_nacin').hidden = !relacijaLista;           /* način spajanja samo za relacija-lista */
    byId('polje_lista_separator').hidden = !(relacijaLista && val('st_lista_nacin') === 'zarez');   /* separator samo za „zarez" */
    byId('polje_redak_predlozak').hidden = !predlozakVidljiv;    /* predložak retka (redak) / predložak imena (grupe) */
    if (byId('polje_labela_bold')) byId('polje_labela_bold').hidden = !relacijaGrupe;   /* bold labele samo za grupe */
    byId('polje_mapa').hidden = korisnicki || relacijaLista || relacijaRedak;   /* mapa: ne za korisnički/listu/redak; relacija_grupe je koristi za labelu po broju (bez grupe) */
    byId('polje_format_datuma').hidden = (vrsta !== 'tekst');    /* format datuma za sve tekst stavke */
    byId('polje_fiks_red').hidden = (vrsta !== 'tekst');  /* X + apsolutni Y (isti red) za sve tekst stavke */
  }

  /* Selekt „Traži kolonu": kolone tablice izabranog whitelist izvora (zadrži vrijednost ako još postoji). */
  function popuniTraziKolonu() {
    var sel = byId('st_trazi_kolona');
    if (!sel) return;
    var izvorId = trim(val('st_izvor'));
    var izvor = izvorId ? mapaIzvor[izvorId] : null;
    var tablica = izvor ? izvor.tablica : '';
    var kolone = (tablica && mapaMetaKolone[tablica]) ? mapaMetaKolone[tablica] : [];
    var trenutno = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    kolone.forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = k.kolona; opt.textContent = k.kolona;
      sel.appendChild(opt);
    });
    sel.value = trenutno;
    if (sel.value !== trenutno) sel.value = '';   /* prijašnja kolona ne postoji u novoj tablici */
    refreshSelect('st_trazi_kolona');
  }

  function popuniStavkaEdit(s) {
    setVal('st_naziv_stavke', s.naziv_stavke != null ? s.naziv_stavke : '');
    setVal('st_zona', (s.okvir_id ? ('okvir:' + s.okvir_id) : (s.zona || 'tijelo'))); refreshSelect('st_zona');
    setVal('st_vrsta', s.vrsta || 'tekst'); refreshSelect('st_vrsta');
    setVal('st_izvor', s.izvor_id || ''); refreshSelect('st_izvor');
    setVal('st_izvor_tip', s.izvor_tip || 'staticki'); refreshSelect('st_izvor_tip');
    setVal('st_izvor_red_id', s.izvor_red_id || '');
    setVal('st_kontekst_kljuc', s.kontekst_kljuc || '');
    setVal('st_test_id', s.test_id || '');
    setVal('st_preko_izvor', s.preko_izvor_id || ''); refreshSelect('st_preko_izvor');
    setVal('st_relacija', s.relacija_id || ''); refreshSelect('st_relacija');
    setVal('st_lista_nacin', s.lista_nacin || 'zarez'); refreshSelect('st_lista_nacin');
    setVal('st_lista_separator', s.lista_separator != null ? s.lista_separator : '');
    setVal('st_redak_predlozak', s.redak_predlozak != null ? s.redak_predlozak : '');
    var lb = byId('st_labela_bold'); if (lb) lb.checked = !!(parseInt(s.labela_bold, 10));
    setVal('st_mapa_vrijednosti', s.mapa_vrijednosti != null ? s.mapa_vrijednosti : '');
    setVal('st_format_datuma', s.format_datuma != null ? s.format_datuma : '');
    setVal('st_fiksna_pozicija', s.fiksna_pozicija != null ? s.fiksna_pozicija : '');
    setVal('st_fiksna_pozicija_y', s.fiksna_pozicija_y != null ? s.fiksna_pozicija_y : '');
    popuniTraziKolonu();   /* opcije ovise o izabranom izvoru — prije postavljanja vrijednosti */
    setVal('st_trazi_kolona', s.trazi_kolona || ''); refreshSelect('st_trazi_kolona');
    setVal('st_trazi_vrijednost', s.trazi_vrijednost != null ? s.trazi_vrijednost : '');
    setVal('st_literal_tekst', s.literal_tekst != null ? s.literal_tekst : '');
    setVal('st_paragraf_id', s.paragraf_id || ''); refreshSelect('st_paragraf_id');
    setVal('st_slika_stil_id', s.slika_stil_id || ''); refreshSelect('st_slika_stil_id');
    var bkv = parseInt(s.bez_kraja_odlomka, 10) || 0;
    var bz = byId('st_bez_kraja_odlomka'); if (bz) bz.checked = (bkv === 1);
    var nr = byId('st_novi_red_odlomka'); if (nr) nr.checked = (bkv === 2);
    var sp = byId('st_sakrij_ako_prazno'); if (sp) sp.checked = !!(parseInt(s.sakrij_ako_prazno, 10));
    azurirajVidljivostStavke();
  }
  /* Pročitaj sva polja forme (oba stupca) u zadanu stavku. Bez osvježavanja tablice/selekcije. */
  function procitajFormuUStavku(s) {
    if (!s) return;
    s.naziv_stavke = trim(val('st_naziv_stavke')) || null;
    var zonaVal = val('st_zona');
    if (zonaVal.indexOf('okvir:') === 0) { s.okvir_id = parseInt(zonaVal.slice(6), 10) || null; s.zona = 'tijelo'; }
    else { s.zona = zonaVal; s.okvir_id = null; }
    s.vrsta = val('st_vrsta');
    s.izvor_id = trim(val('st_izvor')) ? parseInt(val('st_izvor'), 10) : null;
    s.izvor_tip = val('st_izvor_tip');
    s.izvor_red_id = trim(val('st_izvor_red_id')) ? parseInt(val('st_izvor_red_id'), 10) : null;
    s.kontekst_kljuc = trim(val('st_kontekst_kljuc')) || null;
    s.test_id = (s.izvor_tip === 'dinamicki' && trim(val('st_test_id'))) ? parseInt(val('st_test_id'), 10) : null;
    s.preko_izvor_id = (s.izvor_tip === 'dinamicki' && trim(val('st_preko_izvor'))) ? parseInt(val('st_preko_izvor'), 10) : null;
    var jeRelacija = (s.izvor_tip === 'relacija_broj' || s.izvor_tip === 'relacija_lista' || s.izvor_tip === 'relacija_redak' || s.izvor_tip === 'relacija_grupe');
    s.relacija_id = (jeRelacija && trim(val('st_relacija'))) ? parseInt(val('st_relacija'), 10) : null;
    s.lista_nacin = (s.izvor_tip === 'relacija_lista') ? (val('st_lista_nacin') || 'zarez') : null;
    s.lista_separator = (s.izvor_tip === 'relacija_lista') ? (trim(val('st_lista_separator')) || null) : null;
    s.redak_predlozak = (s.izvor_tip === 'relacija_redak' || s.izvor_tip === 'relacija_grupe') ? (trim(val('st_redak_predlozak')) || null) : null;
    var lbEl = byId('st_labela_bold'); s.labela_bold = (s.izvor_tip === 'relacija_grupe' && lbEl && lbEl.checked) ? 1 : 0;
    /* mapa: null za korisnicki/relacija_lista/relacija_redak; inače (staticki/dinamicki/po_vrijednosti/relacija_broj) iz polja */
    s.mapa_vrijednosti = (s.izvor_tip === 'korisnicki' || s.izvor_tip === 'relacija_lista' || s.izvor_tip === 'relacija_redak') ? null : (trim(val('st_mapa_vrijednosti')) || null);
    s.format_datuma = (s.vrsta === 'tekst') ? (trim(val('st_format_datuma')) || null) : null;
    var fpRaw = trim(val('st_fiksna_pozicija')).replace(',', '.');
    var fpNum = fpRaw !== '' ? parseFloat(fpRaw) : NaN;
    s.fiksna_pozicija = (s.vrsta === 'tekst' && !isNaN(fpNum) && fpNum > 0) ? fpNum : null;
    /* Apsolutni Y: prazno → null (tok); inače broj kakav jest (−1 = tok; druga vrijednost = apsolutno). */
    var fpyRaw = trim(val('st_fiksna_pozicija_y')).replace(',', '.');
    var fpyNum = fpyRaw !== '' ? parseFloat(fpyRaw) : NaN;
    s.fiksna_pozicija_y = (s.vrsta === 'tekst' && !isNaN(fpyNum)) ? fpyNum : null;
    s.trazi_kolona = trim(val('st_trazi_kolona')) || null;
    s.trazi_vrijednost = val('st_trazi_vrijednost');
    s.literal_tekst = (s.izvor_tip === 'korisnicki') ? trim(val('st_literal_tekst')) : null;
    s.paragraf_id = trim(val('st_paragraf_id')) ? parseInt(val('st_paragraf_id'), 10) : null;
    s.slika_stil_id = trim(val('st_slika_stil_id')) ? parseInt(val('st_slika_stil_id'), 10) : null;
    var bz = byId('st_bez_kraja_odlomka'); var nr = byId('st_novi_red_odlomka');
    s.bez_kraja_odlomka = (s.vrsta !== 'tekst') ? 0 : ((bz && bz.checked) ? 1 : ((nr && nr.checked) ? 2 : 0));
    var sp = byId('st_sakrij_ako_prazno'); s.sakrij_ako_prazno = (sp && sp.checked) ? 1 : 0;
  }
  /* Edit stavke + tipka Dodaj/Izmijeni: aktivni dok postoji dokument (naziv). Hint vidljiv kad su disabled. */
  function postaviStavkaEnabled(en) {
    /* Editor je u modalu; ovdje gatamo „Dodaj" i „Clone" (oboje dodaju stavku → treba postojeći dokument).
       Uredi/Obriši/… ovise o selekciji. */
    var bd = byId('btnStavkaDodaj'); if (bd) bd.disabled = !en;
    var bc = byId('btnStavkaClone'); if (bc) bc.disabled = !en;
    azurirajStavkaAkcije();
  }
  /* Uredi/Obriši/▲/▼/Deselekt disable bez selekcije reda u tablici stavki. */
  function azurirajStavkaAkcije() {
    var ima = CommonCRUD.getSelectedRowId(stavkeApi) != null;
    ['btnStavkaUredi', 'btnStavkaInfo', 'btnStavkaDeselekt', 'btnStavkaObrisi', 'btnStavkaGore', 'btnStavkaDolje'].forEach(function (id) {
      var b = byId(id); if (b) b.disabled = !ima;
    });
  }

  /* Puno čišćenje forme stavke (na učitavanje/„novi"/brisanje). */
  function ocistiStavkaEdit() {
    odabranaStavka = null;
    STAVKA_POLJA.forEach(function (id) { var e = byId(id); if (e) { if (e.tagName === 'SELECT') { e.selectedIndex = 0; refreshSelect(id); } else if (e.type === 'checkbox') e.checked = false; else e.value = ''; } });
    popuniTraziKolonu();
    azurirajVidljivostStavke();
    azurirajStavkaAkcije();
  }
  /* Čišćenje definicije retka (sva stavka-polja u srednjem stupcu) nakon Dodaj/Izmijeni. */
  function ocistiSrednjiStupac() {
    STAVKA_POLJA.forEach(function (id) {
      var e = byId(id); if (!e) return;
      if (e.tagName === 'SELECT') { e.selectedIndex = 0; refreshSelect(id); } else if (e.type === 'checkbox') e.checked = false; else e.value = '';
    });
    popuniTraziKolonu();
    azurirajVidljivostStavke();
  }

  function naStavkaSelekcija() {
    var tid = CommonCRUD.getSelectedRowId(stavkeApi);
    odabranaStavka = (tid != null) ? tid : null;   /* editor je u modalu (Uredi); selekcija upravlja samo toolbarom */
    azurirajStavkaAkcije();
  }

  /* Promjene u editu stavke → samo prikaz/skrivanje ovisnih polja (bez live-write u stavku). */
  STAVKA_POLJA.forEach(function (id) {
    var e = byId(id);
    if (!e) return;
    var ev = (e.tagName === 'SELECT' || e.type === 'checkbox') ? 'change' : 'input';
    e.addEventListener(ev, function () {
      if (id === 'st_izvor_tip' || id === 'st_vrsta' || id === 'st_izvor' || id === 'st_lista_nacin') azurirajVidljivostStavke();
      if (id === 'st_izvor') popuniTraziKolonu();   /* promjena izvora → kolone iz njegove tablice */
      azurirajStavkaModalStanje();                  /* live: „Spremi/Dodaj" enable kad je validno */
    });
  });
  /* Kombinirani „Vrsta stavke" → sinkroniziraj skrivene vrsta/način + vidljivost + validacija. */
  (function () {
    var ts = byId('st_tip_stavke');
    if (ts) ts.addEventListener('change', function () { sinkVrstaIzTipa(); azurirajStavkaModalStanje(); });
  })();

  /* ---- Akcije nad stavkama ---- */
  /* Tipka Dodaj/Izmijeni: ako je red selektiran → upiši formu u njega + makni selekciju; inače → dodaj novu. */
  byId('btnStavkaUpis').addEventListener('click', function () {
    if (byId('btnStavkaUpis').disabled) return;
    if (modalEditTid != null) {                       /* Uredi: upiši u postojeću */
      var s = stavkaPoTid(modalEditTid);
      if (s) { procitajFormuUStavku(s); osvjeziTablicuStavki(); }
    } else {                                           /* Dodaj: nova stavka */
      var ns = { _tid: tidSeq++, naziv_stavke: null };
      procitajFormuUStavku(ns);
      stavke.push(ns);
      osvjeziTablicuStavki();
    }
    zatvoriStavkaModal();
    azurirajStavkaAkcije();
  });
  byId('btnStavkaObrisi').addEventListener('click', function () {
    var tid = CommonCRUD.getSelectedRowId(stavkeApi);
    if (tid == null) return;
    var idx = indexPoTid(tid);
    if (idx < 0) return;
    stavke.splice(idx, 1);
    osvjeziTablicuStavki();
    ocistiStavkaEdit();
  });
  function pomakni(delta) {
    var tid = CommonCRUD.getSelectedRowId(stavkeApi);
    if (tid == null) return;
    var i = indexPoTid(tid);
    var j = i + delta;
    if (i < 0 || j < 0 || j >= stavke.length) return;
    var tmp = stavke[i]; stavke[i] = stavke[j]; stavke[j] = tmp;
    osvjeziTablicuStavki();
    /* zadrži selekciju nakon premještanja (API ima setSelectedRowIds — množina) */
    if (stavkeApi && typeof stavkeApi.setSelectedRowIds === 'function') { try { stavkeApi.setSelectedRowIds([tid]); } catch (e) {} }
  }
  byId('btnStavkaGore').addEventListener('click', function () { pomakni(-1); });
  byId('btnStavkaDolje').addEventListener('click', function () { pomakni(1); });

  /* ---- Clone modal: dodaj stavku iz DRUGOG dokumenta u tekući (na kraj liste) ---- */
  (function initCloneModal() {
    var btn = byId('btnStavkaClone');
    var modal = byId('cloneModal');
    if (!btn || !modal) return;
    var selDok = byId('clone_dokument');
    var selStavka = byId('clone_stavka');
    var info = byId('clone_info');
    var overlay = byId('cloneModal_overlay');
    var btnZatvori = byId('clone_zatvori');
    var _rows = [];   /* stavke odabranog (izvornog) dokumenta — DB redci */

    function postaviInfo(t) { if (info) info.textContent = t || ''; }
    function setStavkaEnabled(en) {
      if (typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(selStavka, en);
      else if (selStavka) selStavka.disabled = !en;
    }
    function resetStavkaSelekt(enable) {
      _rows = [];
      napuniSelekt('clone_stavka', [], null, true);
      setVal('clone_stavka', ''); refreshSelect('clone_stavka');
      setStavkaEnabled(enable);
    }
    function zatvori() { modal.setAttribute('aria-hidden', 'true'); modal.classList.remove('kontrola-modal--open'); }
    function otvori() {
      if (btn.disabled) return;
      postaviInfo('');
      napuniSelekt('clone_dokument', [], null, true); setVal('clone_dokument', ''); refreshSelect('clone_dokument');
      resetStavkaSelekt(false);
      xhrGet(URL_SVE, function (t) {
        var arr = [];
        if (t.charAt(0) === '[') { try { arr = JSON.parse(t || '[]'); } catch (e) {} }
        arr.sort(function (a, b) { return String(a.naziv).localeCompare(String(b.naziv), 'hr', { sensitivity: 'base' }); });
        napuniSelekt('clone_dokument', arr, null, true);
      });
      var dlg = byId('cloneModal_dialog');
      if (dlg) { dlg.style.left = ''; dlg.style.top = ''; dlg.style.transform = ''; dlg.style.margin = ''; }
      modal.setAttribute('aria-hidden', 'false'); modal.classList.add('kontrola-modal--open');
    }

    btn.addEventListener('click', otvori);
    if (btnZatvori) btnZatvori.addEventListener('click', zatvori);
    if (overlay) overlay.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && modal.classList.contains('kontrola-modal--open')) zatvori();
    });

    /* Odabir izvornog dokumenta → napuni selekt stavki „(redni broj) Ime stavke". */
    if (selDok) selDok.addEventListener('change', function () {
      var id = trim(val('clone_dokument'));
      postaviInfo('');
      resetStavkaSelekt(false);
      if (!id) return;
      xhrGet(URL_JEDAN + '?id=' + encodeURIComponent(id), function (t) {
        var o = {};
        try { o = JSON.parse(t || '{}'); } catch (e) {}
        _rows = (o && o.stavke) ? o.stavke : [];
        var arr = _rows.map(function (r, i) {
          var nazivS = (r.naziv_stavke != null && String(r.naziv_stavke).trim() !== '') ? String(r.naziv_stavke) : '(bez naziva)';
          return { id: i, naziv: '(' + (r.redoslijed != null ? r.redoslijed : (i + 1)) + ') ' + nazivS };
        });
        napuniSelekt('clone_stavka', arr, null, true);
        setStavkaEnabled(arr.length > 0);
        if (arr.length === 0) postaviInfo('Dokument nema stavki.');
      });
    });

    /* Odabir stavke → klon na kraj liste tekućeg dokumenta (redni broj diktira tekući dokument). */
    if (selStavka) selStavka.addEventListener('change', function () {
      var v = trim(val('clone_stavka'));
      if (v === '') return;
      var idx = parseInt(v, 10);
      if (isNaN(idx) || idx < 0 || idx >= _rows.length) return;
      var nova = stavkaIzReda(_rows[idx]);
      stavke.push(nova);
      osvjeziTablicuStavki();
      azurirajStavkaAkcije();
      var nazivN = (nova.naziv_stavke != null && String(nova.naziv_stavke).trim() !== '') ? String(nova.naziv_stavke) : '(bez naziva)';
      postaviInfo('Dodano na kraj: ' + nazivN);
      /* reset (omogući ponovni odabir iste stavke) */
      setVal('clone_stavka', ''); refreshSelect('clone_stavka');
    });
  })();
  byId('btnStavkaDeselekt').addEventListener('click', function () {
    if (stavkeApi && typeof stavkeApi.clearSelection === 'function') { try { stavkeApi.clearSelection(); } catch (e) {} }
  });

  /* ---- Modal editor stavke (Dodaj/Uredi) ---- */
  var modalEditTid = null;   /* _tid stavke koja se uređuje; null = dodavanje nove */
  /* Kombinirani „Vrsta stavke" → skriveni vrsta/način (i obrnuto). */
  function sinkVrstaIzTipa() {
    var ts = byId('st_tip_stavke'); if (!ts) return;
    var p = String(ts.value || 'tekst|staticki').split('|');
    setVal('st_vrsta', p[0] || 'tekst'); refreshSelect('st_vrsta');
    setVal('st_izvor_tip', p[1] || 'staticki'); refreshSelect('st_izvor_tip');
    azurirajVidljivostStavke();
    popuniTraziKolonu();
  }
  function sinkTipIzVrste() {
    var ts = byId('st_tip_stavke'); if (!ts) return;
    setVal('st_tip_stavke', (val('st_vrsta') || 'tekst') + '|' + (val('st_izvor_tip') || 'staticki'));
    refreshSelect('st_tip_stavke');
  }
  /* „Spremi/Dodaj" enable tek kad je trenutna forma valjana stavka. */
  function azurirajStavkaModalStanje() {
    var temp = { _tid: -1 };
    procitajFormuUStavku(temp);
    var ok = validirajStavke([temp]).length === 0;
    var bu = byId('btnStavkaUpis');
    if (bu) {
      bu.disabled = !ok;
      var lbl = bu.querySelector('.kontrola-btn__label');
      if (lbl) lbl.textContent = (modalEditTid != null) ? 'Spremi' : 'Dodaj';
    }
  }
  /* „Na temelju stavke" — predložak za novu stavku: popis postojećih stavki (od zadnje prema prvoj),
     tekst „(broj) naziv" (ili „(broj)" bez naziva); vrijednost opcije = _tid. */
  function napuniNaTemeljuSelekt() {
    var sel = byId('st_na_temelju');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    for (var i = stavke.length - 1; i >= 0; i--) {
      var s = stavke[i];
      var naziv = (s.naziv_stavke != null && trim(s.naziv_stavke) !== '') ? (' ' + trim(s.naziv_stavke)) : '';
      var opt = document.createElement('option');
      opt.value = String(s._tid);
      opt.textContent = '(' + (i + 1) + ')' + naziv;
      sel.appendChild(opt);
    }
    sel.value = '';
    refreshSelect('st_na_temelju');
  }
  function otvoriStavkaModal(tid) {
    modalEditTid = (tid != null) ? tid : null;
    var nas = byId('stavkaModalNaslov'); if (nas) nas.textContent = (modalEditTid != null) ? 'Uredi stavku' : 'Nova stavka';
    /* „Na temelju stavke" samo pri dodavanju nove stavke (predložak); pri uređivanju skriveno. */
    var nt = byId('polje_na_temelju');
    if (nt) { if (modalEditTid == null) { napuniNaTemeljuSelekt(); nt.hidden = false; } else { nt.hidden = true; } }
    osvjeziEditSelekte(function () {
      if (modalEditTid != null) { var s = stavkaPoTid(modalEditTid); if (s) popuniStavkaEdit(s); }
      else { ocistiSrednjiStupac(); setVal('st_tip_stavke', 'tekst|staticki'); refreshSelect('st_tip_stavke'); sinkVrstaIzTipa(); }
      sinkTipIzVrste();
      azurirajStavkaModalStanje();
    });
    var m = byId('stavkaModal');
    if (m) {
      var dlg = m.querySelector('.kontrola-modal__dialog');
      if (dlg) { dlg.style.left = ''; dlg.style.top = ''; dlg.style.transform = ''; dlg.style.margin = ''; }   /* reset → centriran + svjež drag */
      m.setAttribute('aria-hidden', 'false'); m.classList.add('kontrola-modal--open');
    }
  }
  function zatvoriStavkaModal() {
    var m = byId('stavkaModal'); if (m) { m.setAttribute('aria-hidden', 'true'); m.classList.remove('kontrola-modal--open'); }
    modalEditTid = null;
  }
  (function () {
    var bd = byId('btnStavkaDodaj'); if (bd) bd.addEventListener('click', function () { if (!bd.disabled) otvoriStavkaModal(null); });
    var bu2 = byId('btnStavkaUredi'); if (bu2) bu2.addEventListener('click', function () { if (bu2.disabled) return; var tid = CommonCRUD.getSelectedRowId(stavkeApi); if (tid != null) otvoriStavkaModal(tid); });
    var bi = byId('btnStavkaInfo'); if (bi) bi.addEventListener('click', function () { if (bi.disabled) return; var tid = CommonCRUD.getSelectedRowId(stavkeApi); var s = (tid != null) ? stavkaPoTid(tid) : null; if (s) prikaziStavkaPopup(s); });
    /* „Na temelju stavke" → popuni formu vrijednostima izabrane stavke (naziv se NE kopira). */
    var nt = byId('st_na_temelju');
    if (nt) nt.addEventListener('change', function () {
      var tid = trim(nt.value);
      if (tid) {
        var s = stavkaPoTid(tid);
        if (s) {
          popuniStavkaEdit(s);
          setVal('st_naziv_stavke', '');   /* naziv ostaje prazan */
          sinkTipIzVrste();
          azurirajStavkaModalStanje();
        }
      }
      nt.value = ''; refreshSelect('st_na_temelju');   /* jednokratna akcija — vrati na „— odaberi —" */
    });
    var bo = byId('btnStavkaOdustani'); if (bo) bo.addEventListener('click', zatvoriStavkaModal);
    var ov = byId('stavkaModal_overlay'); if (ov) ov.addEventListener('click', zatvoriStavkaModal);
    document.addEventListener('keydown', function (e) { var m = byId('stavkaModal'); if (e.key === 'Escape' && m && m.getAttribute('aria-hidden') === 'false') zatvoriStavkaModal(); });
    /* Premještanje modala povlačenjem zaglavlja (isti helper kao modal „Izbor ID"). */
    var sm = byId('stavkaModal');
    if (sm && typeof KontroleModalDrag === 'function') {
      var dlg = sm.querySelector('.kontrola-modal__dialog');
      var hdr = sm.querySelector('.kontrola-modal__header');
      if (dlg && hdr) KontroleModalDrag(dlg, hdr);
    }
  })();

  /* ---- Popup uputa za „Mapa vrijednosti" (sadržaj se dopunjava u radu) ---- */
  (function () {
    var m = byId('mapaPomocModal'); if (!m) return;
    function otvori() {
      var d = m.querySelector('.kontrola-modal__dialog');
      if (d) { d.style.left = ''; d.style.top = ''; d.style.transform = ''; d.style.margin = ''; }   /* reset → centriran + svjež drag */
      m.setAttribute('aria-hidden', 'false'); m.classList.add('kontrola-modal--open');
    }
    function zatvori() { m.setAttribute('aria-hidden', 'true'); m.classList.remove('kontrola-modal--open'); }
    var bp = byId('btnMapaPomoc'); if (bp) bp.addEventListener('click', otvori);
    var bpl = byId('btnLiteralPomoc'); if (bpl) bpl.addEventListener('click', otvori);
    var ok = byId('btnMapaPomocOk'); if (ok) ok.addEventListener('click', zatvori);
    var ov = byId('mapaPomocModal_overlay'); if (ov) ov.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('aria-hidden') === 'false') zatvori(); });
    var dlg = m.querySelector('.kontrola-modal__dialog'), hdr = byId('mapaPomocModal_header');
    if (dlg && hdr && typeof KontroleModalDrag === 'function') KontroleModalDrag(dlg, hdr);
  })();

  /* ---- Popup uputa za „Format datuma" ---- */
  (function () {
    var m = byId('formatPomocModal'); if (!m) return;
    function otvori() { m.setAttribute('aria-hidden', 'false'); m.classList.add('kontrola-modal--open'); }
    function zatvori() { m.setAttribute('aria-hidden', 'true'); m.classList.remove('kontrola-modal--open'); }
    var bp = byId('btnFormatPomoc'); if (bp) bp.addEventListener('click', otvori);
    var ok = byId('btnFormatPomocOk'); if (ok) ok.addEventListener('click', zatvori);
    var ov = byId('formatPomocModal_overlay'); if (ov) ov.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('aria-hidden') === 'false') zatvori(); });
    var dlg = m.querySelector('.kontrola-modal__dialog'), hdr = byId('formatPomocModal_header');
    if (dlg && hdr && typeof KontroleModalDrag === 'function') KontroleModalDrag(dlg, hdr);
  })();

  /* ---- Popup uputa za „Fiksna pozicija stavke (X) / Apsolutni Y" ---- */
  (function () {
    var m = byId('fiksPomocModal'); if (!m) return;
    function otvori() { m.setAttribute('aria-hidden', 'false'); m.classList.add('kontrola-modal--open'); }
    function zatvori() { m.setAttribute('aria-hidden', 'true'); m.classList.remove('kontrola-modal--open'); }
    var bp = byId('btnFiksPomoc'); if (bp) bp.addEventListener('click', otvori);
    var ok = byId('btnFiksPomocOk'); if (ok) ok.addEventListener('click', zatvori);
    var ov = byId('fiksPomocModal_overlay'); if (ov) ov.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('aria-hidden') === 'false') zatvori(); });
    var dlg = m.querySelector('.kontrola-modal__dialog'), hdr = byId('fiksPomocModal_header');
    if (dlg && hdr && typeof KontroleModalDrag === 'function') KontroleModalDrag(dlg, hdr);
  })();

  /* ---- Popup uputa za „Redak-predložak" (relacija_redak) ---- */
  (function () {
    var m = byId('redakPomocModal'); if (!m) return;
    function otvori() { m.setAttribute('aria-hidden', 'false'); m.classList.add('kontrola-modal--open'); }
    function zatvori() { m.setAttribute('aria-hidden', 'true'); m.classList.remove('kontrola-modal--open'); }
    var bp = byId('btnRedakPomoc'); if (bp) bp.addEventListener('click', otvori);
    var ok = byId('btnRedakPomocOk'); if (ok) ok.addEventListener('click', zatvori);
    var ov = byId('redakPomocModal_overlay'); if (ov) ov.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('aria-hidden') === 'false') zatvori(); });
    var dlg = m.querySelector('.kontrola-modal__dialog'), hdr = byId('redakPomocModal_header');
    if (dlg && hdr && typeof KontroleModalDrag === 'function') KontroleModalDrag(dlg, hdr);
  })();

  /* Reset razvojne (testni kontekst) sekcije — poziva se pri učitavanju/novom dokumentu.
     U Fazi 2 razvojni podaci nisu perzistirani, pa se uvijek vraćaju na prazno + „dostupan u app". */
  function resetRazvojSekciju() {
    var cb = byId('edit_u_razvoju'); if (cb) cb.checked = false;
    var txt = byId('edit_u_razvoju_tekst'); if (txt) txt.textContent = 'Dokument je dostupan u app';
    setVal('razvoj_tablica', ''); refreshSelect('razvoj_tablica');
    napuniSelekt('razvoj_kolona', [], null, true); setVal('razvoj_kolona', ''); refreshSelect('razvoj_kolona');
    napuniSelekt('razvoj_vrijednost', [], null, true); setVal('razvoj_vrijednost', ''); refreshSelect('razvoj_vrijednost');
    setVal('razvoj_trazi', '');
    setVal('razvoj_izabrani_id', '');
  }

  /* ---- Punjenje / čišćenje dokumenta ---- */
  /* DB redak stavke → in-memory stavka (novi _tid). Koristi učitavanje dokumenta i kloniranje. */
  function stavkaIzReda(r) {
    return {
      _tid: tidSeq++,
      zona: r.zona, okvir_id: r.okvir_id ? parseInt(r.okvir_id, 10) : null, vrsta: r.vrsta, izvor_id: r.izvor_id ? parseInt(r.izvor_id, 10) : null,
      izvor_tip: r.izvor_tip, izvor_red_id: r.izvor_red_id ? parseInt(r.izvor_red_id, 10) : null,
      kontekst_kljuc: r.kontekst_kljuc, test_id: r.test_id ? parseInt(r.test_id, 10) : null, trazi_kolona: r.trazi_kolona, trazi_vrijednost: r.trazi_vrijednost,
      literal_tekst: r.literal_tekst,
      paragraf_id: r.paragraf_id ? parseInt(r.paragraf_id, 10) : null,
      slika_stil_id: r.slika_stil_id ? parseInt(r.slika_stil_id, 10) : null,
      bez_kraja_odlomka: (parseInt(r.bez_kraja_odlomka, 10) === 2) ? 2 : ((parseInt(r.bez_kraja_odlomka, 10) === 1) ? 1 : 0),
      naziv_stavke: r.naziv_stavke,
      preko_izvor_id: r.preko_izvor_id ? parseInt(r.preko_izvor_id, 10) : null,
      mapa_vrijednosti: r.mapa_vrijednosti,
      format_datuma: r.format_datuma,
      fiksna_pozicija: (r.fiksna_pozicija != null && r.fiksna_pozicija !== '') ? parseFloat(r.fiksna_pozicija) : null,
      fiksna_pozicija_y: (r.fiksna_pozicija_y != null && r.fiksna_pozicija_y !== '') ? parseFloat(r.fiksna_pozicija_y) : null,
      sakrij_ako_prazno: (parseInt(r.sakrij_ako_prazno, 10) === 1) ? 1 : 0,
      relacija_id: r.relacija_id ? parseInt(r.relacija_id, 10) : null,
      lista_nacin: r.lista_nacin || null,
      lista_separator: (r.lista_separator != null && r.lista_separator !== '') ? r.lista_separator : null,
      redak_predlozak: (r.redak_predlozak != null && r.redak_predlozak !== '') ? r.redak_predlozak : null,
      labela_bold: (parseInt(r.labela_bold, 10) === 1) ? 1 : 0
    };
  }

  function popuniDokument(dok, lstStavke, samoSadrzaj) {
    if (!samoSadrzaj) {
      tekuciId = dok && dok.id ? parseInt(dok.id, 10) : 0;
      setVal('edit_naziv', dok ? dok.naziv : '');
    }
    setVal('edit_template_id', dok ? dok.template_id : ''); refreshSelect('edit_template_id');
    setVal('edit_opis', dok ? dok.opis : '');
    var ak = byId('edit_aktivan'); if (ak) ak.checked = dok ? (dok.aktivan == 1 || dok.aktivan === '1' || dok.aktivan === true) : true;
    setVal('edit_napomena', dok ? dok.napomena : '');
    setVal('edit_broj_stranice_paragraf_id', (dok && dok.broj_stranice_paragraf_id) ? dok.broj_stranice_paragraf_id : ''); refreshSelect('edit_broj_stranice_paragraf_id');
    setVal('edit_extra_prored_paragraf_id', (dok && dok.dokument_prored_default_stil) ? dok.dokument_prored_default_stil : ''); refreshSelect('edit_extra_prored_paragraf_id');
    if (!samoSadrzaj) { if (typeof restoreRazvoj === 'function') restoreRazvoj(dok); else resetRazvojSekciju(); }
    stavke = (lstStavke || []).map(stavkaIzReda);
    osvjeziTablicuStavki();
    ucitajOkvire(dok ? dok.template_id : '', osvjeziTablicuStavki);   /* okviri templatea → zona select + oznake bloka u tablici */
    ocistiStavkaEdit();
    azurirajSpremiStanje();
  }
  /* Ponovni dohvat selekata stilova (Stil teksta / Stil slike) — npr. stil dodan u drugoj kartici. */
  /* Osvježi editor-selekte (whitelist izvori + meta kolone + stilovi teksta/slike) — bez template-a.
     Zove se kod add/edit/delete (preko noviDokument) i kod selekcije reda (dokument/stavka), da se vide
     stavke dodane u drugoj instanci bez hard refresha. cb() kad su svi xhr-ovi gotovi. */
  function osvjeziEditSelekte(cb) {
    var preostalo = 5;
    function gotovo() { if (--preostalo === 0 && cb) cb(); }
    xhrGet(API + 'PDF_Whitelist_CRUD_meta.php', function (t) {
      try { mapaMetaKolone = JSON.parse(t || '{}') || {}; } catch (e) { mapaMetaKolone = {}; }
      gotovo();
    });
    xhrGet(API + 'PDF_Relacije_sve.php', function (t) {
      try {
        var a = JSON.parse(t || '[]'); mapaRelacija = {};
        var vr = val('st_relacija');
        napuniSelekt('st_relacija', a, mapaRelacija, true);
        setVal('st_relacija', vr); refreshSelect('st_relacija');
      } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Whitelist_CRUD_sve.php', function (t) {
      try {
        var a = JSON.parse(t || '[]'); mapaIzvor = {}; a.forEach(function (o) { mapaIzvor[String(o.id)] = o; });
        var v1 = val('st_izvor'), v2 = val('st_preko_izvor');
        napuniSelekt('st_izvor', a, null, true); napuniSelekt('st_preko_izvor', a, null, true);
        setVal('st_izvor', v1); refreshSelect('st_izvor'); setVal('st_preko_izvor', v2); refreshSelect('st_preko_izvor');
      } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Stilovi_CRUD_sve.php', function (t) {
      try {
        var a = JSON.parse(t || '[]'); mapaParagraf = {}; a.forEach(function (o) { mapaParagraf[String(o.id)] = o; });
        var v3 = val('st_paragraf_id'), v4 = val('edit_broj_stranice_paragraf_id'), v5 = val('edit_extra_prored_paragraf_id');
        napuniSelekt('st_paragraf_id', a, null, true); napuniSelekt('edit_broj_stranice_paragraf_id', a, null, true); napuniSelekt('edit_extra_prored_paragraf_id', a, null, true);
        setVal('st_paragraf_id', v3); refreshSelect('st_paragraf_id'); setVal('edit_broj_stranice_paragraf_id', v4); refreshSelect('edit_broj_stranice_paragraf_id'); setVal('edit_extra_prored_paragraf_id', v5); refreshSelect('edit_extra_prored_paragraf_id');
      } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Stilovi_Slike_CRUD_sve.php', function (t) {
      try {
        var a = JSON.parse(t || '[]'); mapaSlika = {}; a.forEach(function (o) { mapaSlika[String(o.id)] = o; });
        var v5 = val('st_slika_stil_id');
        napuniSelekt('st_slika_stil_id', a, null, true);
        setVal('st_slika_stil_id', v5); refreshSelect('st_slika_stil_id');
      } catch (e) {}
      gotovo();
    });
  }
  function noviDokument() {
    if (dokApi && typeof dokApi.clearSelection === 'function') { try { dokApi.clearSelection(); } catch (e) {} }
    popuniDokument(null, []);
    osvjeziEditSelekte();   /* osvježi whitelist+stilove (upiši/izmjeni/izbriši/X/čišćenje svi prolaze ovuda) */
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(byId('dokTab'), 0);   /* povratak na prvi tab (Podaci) */
  }

  /* „Isti red" i „novi red" su isključivi (simulacija radija): čekiranje jednog odčekira drugi. */
  (function () {
    var bz = byId('st_bez_kraja_odlomka'), nr = byId('st_novi_red_odlomka');
    if (bz) bz.addEventListener('change', function () { if (bz.checked && nr) nr.checked = false; });
    if (nr) nr.addEventListener('change', function () { if (nr.checked && bz) bz.checked = false; });
  })();

  /* X na „Naziv dokumenta" → novi (čisti polja + deselektira tablicu) = upis mod. */
  (function () {
    var n = byId('edit_naziv');
    var wrap = n && n.closest('.kontrola-edit-delete');
    if (wrap) wrap.addEventListener('kontrole-edit-delete-clear', noviDokument);
  })();

  /* Nasljedi dokument: popuni polja (OSIM naziva) + stavke iz postojećeg; mod ostaje (upis ili izmjena). */
  (function () {
    var naslEl = byId('edit_naslijedi_dok');
    if (!naslEl) return;
    naslEl.addEventListener('change', function () {
      var id = trim(this.value);
      if (!id) return;
      xhrGet(URL_JEDAN + '?id=' + encodeURIComponent(id), function (t) {
        try {
          var o = JSON.parse(t || '{}');
          if (o.greska) return;
          popuniDokument(o.dokument, o.stavke || [], true);   /* samoSadrzaj: zadrži naziv + tekući mod */
          azurirajSpremiStanje();                              /* selekt ostaje na izabranom dokumentu */
        } catch (e) {}
      });
    });
  })();

  /* ---- Spremi / Izbriši ---- */
  function azurirajSpremiStanje() {
    var ok = trim(val('edit_naziv')) !== '' && trim(val('edit_template_id')) !== '';
    /* Nasljedi / Stranica (template) / Opis: disabled dok nema sadržaja u nazivu (edit-delete).
       Nasljedi dodatno traži da postoje dokumenti u bazi. */
    var imaDok = trim(val('edit_naziv')) !== '';
    var docExists = Object.keys(docPoId).length > 0;
    var uRazvoju = !!(byId('edit_u_razvoju') && byId('edit_u_razvoju').checked);
    if (typeof KontroleSetControlEnabled === 'function') {
      var tpl = byId('edit_template_id'); if (tpl) KontroleSetControlEnabled(tpl, imaDok);
      var opis = byId('edit_opis'); if (opis) KontroleSetControlEnabled(opis, imaDok);
      var brSel = byId('edit_broj_stranice_paragraf_id'); if (brSel) KontroleSetControlEnabled(brSel, imaDok);
      var epSel = byId('edit_extra_prored_paragraf_id'); if (epSel) KontroleSetControlEnabled(epSel, imaDok);
      var nasl = byId('edit_naslijedi_dok'); if (nasl) KontroleSetControlEnabled(nasl, imaDok && docExists);
      /* Razvojni lanac: čekbox kad postoji dokument; tablica tek kad je „u razvoju" (inače nema smisla);
         kolona kad je tablica; traži/vrijednost kad je kolona. Izabrani ID: disabled dok nema vrijednosti
         iznad njega, nakon izbora → RO (naš RO vizual, kao na drugim kontrolama). */
      var imaTab = trim(val('razvoj_tablica')) !== '';
      var imaKol = trim(val('razvoj_kolona')) !== '';
      var rRaz = byId('edit_u_razvoju'); if (rRaz) KontroleSetControlEnabled(rRaz, imaDok);
      var rTab = byId('razvoj_tablica'); if (rTab) KontroleSetControlEnabled(rTab, imaDok && uRazvoju);
      var rKol = byId('razvoj_kolona'); if (rKol) KontroleSetControlEnabled(rKol, imaDok && uRazvoju && imaTab);
      var rTrazi = byId('razvoj_trazi'); if (rTrazi) KontroleSetControlEnabled(rTrazi, imaDok && uRazvoju && imaKol);
      var rVrij = byId('razvoj_vrijednost'); if (rVrij) KontroleSetControlEnabled(rVrij, imaDok && uRazvoju && imaKol);
      var rIz = byId('razvoj_izabrani_id');
      if (rIz) {
        /* RO (aktivan) samo dok je „u razvoju" i ima izabranu vrijednost; inače disabled. */
        var imaIzVrij = uRazvoju && parseInt(trim(val('razvoj_izabrani_id')), 10) > 0;
        KontroleSetControlEnabled(rIz, imaIzVrij);
        if (typeof KontroleSetControlReadonly === 'function') KontroleSetControlReadonly(rIz, imaIzVrij);
      }
    }
    postaviStavkaEnabled(imaDok);   /* edit stavke + tipka Dodaj/Izmijeni aktivni samo dok postoji dokument */
    /* PDF tab + vodilice: pregled je moguć samo dok je dokument U RAZVOJU i ima izabran testni ID.
       Kad nije u razvoju, ID dolazi iz aplikacije pri izvođenju → u formi nema pregleda. */
    var imaTemplate = trim(val('edit_template_id')) !== '';
    var imaIzId = parseInt(trim(val('razvoj_izabrani_id')), 10) > 0;
    var mozePreview = imaTemplate && uRazvoju && imaIzId;
    var pdfKart = byId('dokTabKart2');
    if (pdfKart) {
      pdfKart.disabled = !mozePreview;
      if (!mozePreview && pdfKart.classList.contains('kontrola-tab__kartica--aktivna') && typeof kontrolaTabPostaviAktivni === 'function') {
        kontrolaTabPostaviAktivni(byId('dokTab'), 0);
      }
    }
    var b = byId('btnSpremi');
    if (b) {
      var jeIzmjena = tekuciId > 0;
      b.classList.toggle('kontrola-btn--crud-izmjeni', jeIzmjena);
      var lbl = b.querySelector('.kontrola-btn__label');
      if (lbl) lbl.textContent = jeIzmjena ? 'Izmijeni' : 'Upis';
      b.disabled = !ok;
    }
    var bi = byId('btnIzbrisi'); if (bi) bi.disabled = tekuciId <= 0;
    /* Vodilice: dostupne samo kad postoji dokument (template) za preview. */
    var bb = byId('btnBlokovi');
    if (bb) {
      bb.disabled = !mozePreview;
      if (!mozePreview && prikaziBlokove) { prikaziBlokove = false; postaviBlokIkonu(); }
    }
    if (typeof postaviBlokStranicaIkonu === 'function') postaviBlokStranicaIkonu();
  }
  byId('edit_naziv').addEventListener('input', azurirajSpremiStanje);
  byId('edit_template_id').addEventListener('change', azurirajSpremiStanje);
  byId('edit_template_id').addEventListener('change', function () { ucitajOkvire(val('edit_template_id')); });   /* novi template → osvježi ponudu blokova */

  /* Razvojna sekcija: tekst uz čekbox ovisi o stanju (čekiran = u razvoju; inače dostupan u app).
     Promjena čekboxa utječe i na gating PDF taba (pregled samo kad je u razvoju). */
  (function () {
    var cb = byId('edit_u_razvoju'), txt = byId('edit_u_razvoju_tekst');
    if (!cb || !txt) return;
    function osvjeziRazvojTekst() { txt.textContent = cb.checked ? 'Dokument je u razvoju' : 'Dokument je dostupan u app'; }
    cb.addEventListener('change', function () { osvjeziRazvojTekst(); azurirajSpremiStanje(); });
    osvjeziRazvojTekst();
  })();

  /* Rekonstrukcija razvojne sekcije iz dokumenta — postavlja je lanac-IIFE niže (asinkrono). */
  var restoreRazvoj = null;

  /* Razvojni lanac: Tablica → Kolona → (Pretraži) → Vrijednost → Izabrani ID (RO).
     Vrijednosti se filtriraju debounceom = sustav_varijable #114. „Izabrani ID" puni se isključivo
     izborom iz Vrijednosti (option.value = id sloga); admin nema direktan upis. */
  (function () {
    var selTab = byId('razvoj_tablica'), selKol = byId('razvoj_kolona'),
        selVri = byId('razvoj_vrijednost'), inpTrazi = byId('razvoj_trazi'), izId = byId('razvoj_izabrani_id');
    if (!selTab || !selKol || !selVri || !inpTrazi || !izId) return;
    var traziTimer = null;

    function jsonNiz(t) { var a; try { a = JSON.parse(t || '[]'); } catch (e) { a = []; } return Array.isArray(a) ? a : []; }
    function kaoOpcije(niz) { return niz.map(function (n) { return { id: n, naziv: n }; }); }
    function postaviIzId(v) { izId.value = (v == null ? '' : String(v)); azurirajSpremiStanje(); }
    function resetSelekt(id) { napuniSelekt(id, [], null, true); setVal(id, ''); refreshSelect(id); }
    function selektImaOpciju(id, vrijednost) {
      var s = byId(id); if (!s) return false;
      for (var i = 0; i < s.options.length; i++) if (s.options[i].value === vrijednost) return true;
      return false;
    }

    /* Tablice — jednom pri inicijalizaciji. */
    xhrGet(API + 'PDF_Dokument_razvoj.php?sto=tablice', function (t) {
      napuniSelekt('razvoj_tablica', kaoOpcije(jsonNiz(t)), null, true);
    });
    /* Var #114 (debounce Traži) — jednokratni dohvat. */
    if (typeof window.vnlhLoadPronadjiStankaMsFromVar114 === 'function') window.vnlhLoadPronadjiStankaMsFromVar114(API);

    function ucitajKolone() {
      resetSelekt('razvoj_kolona'); resetSelekt('razvoj_vrijednost'); postaviIzId('');
      var tablica = trim(val('razvoj_tablica'));
      if (!tablica) return;
      xhrGet(API + 'PDF_Dokument_razvoj.php?sto=kolone&tablica=' + encodeURIComponent(tablica), function (t) {
        napuniSelekt('razvoj_kolona', kaoOpcije(jsonNiz(t)), null, true);
      });
    }
    function ucitajVrijednosti() {
      resetSelekt('razvoj_vrijednost'); postaviIzId('');
      var tablica = trim(val('razvoj_tablica')), kolona = trim(val('razvoj_kolona'));
      if (!tablica || !kolona) return;
      var url = API + 'PDF_Dokument_razvoj.php?sto=vrijednosti&tablica=' + encodeURIComponent(tablica) +
                '&kolona=' + encodeURIComponent(kolona) + '&trazi=' + encodeURIComponent(trim(val('razvoj_trazi')));
      xhrGet(url, function (t) { napuniSelekt('razvoj_vrijednost', mapVrij(jsonNiz(t)), null, true); });
    }
    /* option.value = id sloga; tekst = vrijednost kolone (prazno → oznaka s id-em). */
    function mapVrij(arr) {
      return arr.map(function (o) {
        return { id: o.id, naziv: (o.v == null || String(o.v) === '') ? ('(bez vrijednosti) #' + o.id) : String(o.v) };
      });
    }

    /* Rekonstrukcija razvojne sekcije iz spremljenog dokumenta (ili prazno za novi).
       Asinkrono: tablica → (kolone) kolona → (vrijednosti) izabrani ID. */
    restoreRazvoj = function (dok) {
      var aktivan = !!(dok && (dok.razvoj_aktivan == 1 || dok.razvoj_aktivan === '1' || dok.razvoj_aktivan === true));
      var cb = byId('edit_u_razvoju'); if (cb) cb.checked = aktivan;
      var txt = byId('edit_u_razvoju_tekst'); if (txt) txt.textContent = aktivan ? 'Dokument je u razvoju' : 'Dokument je dostupan u app';
      resetSelekt('razvoj_kolona'); resetSelekt('razvoj_vrijednost');
      setVal('razvoj_trazi', ''); izId.value = '';
      var tablica = (dok && dok.razvoj_tablica) ? String(dok.razvoj_tablica) : '';
      var kolona = (dok && dok.razvoj_kolona) ? String(dok.razvoj_kolona) : '';
      var testId = (dok && dok.razvoj_izabrani_id) ? parseInt(dok.razvoj_izabrani_id, 10) : 0;
      /* Spremljena tablica koja više nije dozvoljena (nije među opcijama whitelista) → očisti cijeli lanac. */
      if (tablica && !selektImaOpciju('razvoj_tablica', tablica)) { tablica = ''; kolona = ''; testId = 0; }
      setVal('razvoj_tablica', tablica); refreshSelect('razvoj_tablica');
      if (!tablica) { azurirajSpremiStanje(); return; }
      xhrGet(API + 'PDF_Dokument_razvoj.php?sto=kolone&tablica=' + encodeURIComponent(tablica), function (t) {
        var dozvoljeneKolone = jsonNiz(t);
        napuniSelekt('razvoj_kolona', kaoOpcije(dozvoljeneKolone), null, true);
        /* Spremljena kolona koja više nije dozvoljena → očisti kolonu i ostatak lanca. */
        if (kolona && dozvoljeneKolone.indexOf(kolona) < 0) { kolona = ''; testId = 0; }
        setVal('razvoj_kolona', kolona); refreshSelect('razvoj_kolona');
        if (!kolona) { azurirajSpremiStanje(); return; }
        var url = API + 'PDF_Dokument_razvoj.php?sto=vrijednosti&tablica=' + encodeURIComponent(tablica) +
                  '&kolona=' + encodeURIComponent(kolona) + '&trazi=';
        xhrGet(url, function (t2) {
          napuniSelekt('razvoj_vrijednost', mapVrij(jsonNiz(t2)), null, true);
          if (testId > 0) { setVal('razvoj_vrijednost', String(testId)); refreshSelect('razvoj_vrijednost'); izId.value = String(testId); }
          azurirajSpremiStanje();
        });
      });
    };

    selTab.addEventListener('change', function () { ucitajKolone(); azurirajSpremiStanje(); });
    selKol.addEventListener('change', function () { setVal('razvoj_trazi', ''); ucitajVrijednosti(); azurirajSpremiStanje(); });
    selVri.addEventListener('change', function () { postaviIzId(trim(val('razvoj_vrijednost'))); });
    inpTrazi.addEventListener('input', function () {
      if (traziTimer) clearTimeout(traziTimer);
      var ms = (typeof window.vnlhGetPronadjiStankaMs === 'function') ? window.vnlhGetPronadjiStankaMs() : 1000;
      traziTimer = setTimeout(ucitajVrijednosti, ms);
    });
  })();

  /* Provjera stavki prije slanja — preslikava CHECK chk_prikaz_po_vrsti + chk_izvor_po_tipu (samo obavezna
     polja; „prazno mora biti" PHP ionako sam nullira). Vraća niz {tid, tekst}; prazan niz = sve OK. */
  function validirajStavke(lista) {
    var out = [];
    (lista || []).forEach(function (s, i) {
      var manjka = [];
      if (s.vrsta === 'tekst') {
        if (!(parseInt(s.paragraf_id, 10) > 0)) manjka.push('Stil teksta');
      } else if (s.vrsta === 'slika') {
        if (!(parseInt(s.slika_stil_id, 10) > 0)) manjka.push('Stil slike');
      } else {
        manjka.push('Vrsta');
      }
      var tip = s.izvor_tip;
      if (tip === 'staticki') {
        if (!(parseInt(s.izvor_id, 10) > 0)) manjka.push('Izvor');
        if (!(parseInt(s.izvor_red_id, 10) > 0)) manjka.push('ID retka');
      } else if (tip === 'dinamicki') {
        if (!(parseInt(s.izvor_id, 10) > 0)) manjka.push('Izvor');
        if (!trim(s.kontekst_kljuc || '')) manjka.push('Ključ konteksta');
      } else if (tip === 'po_vrijednosti') {
        if (!(parseInt(s.izvor_id, 10) > 0)) manjka.push('Izvor');
        if (!trim(s.trazi_kolona || '')) manjka.push('Traži kolonu');
        if (!trim(String(s.trazi_vrijednost == null ? '' : s.trazi_vrijednost))) manjka.push('Tražena vrijednost');
      } else if (tip === 'korisnicki') {
        if (s.vrsta !== 'tekst') manjka.push('Korisnički tekst je dozvoljen samo za tekst');
        if (!trim(s.literal_tekst || '')) manjka.push('Korisnički tekst');
      } else if (tip === 'relacija_broj' || tip === 'relacija_lista') {
        if (s.vrsta !== 'tekst') manjka.push('Relacija je dozvoljena samo za tekst');
        if (!(parseInt(s.relacija_id, 10) > 0)) manjka.push('Relacija');
        if (!trim(s.kontekst_kljuc || '')) manjka.push('Ključ konteksta');
      } else if (tip === 'relacija_redak' || tip === 'relacija_grupe') {
        if (s.vrsta !== 'tekst') manjka.push('Relacija je dozvoljena samo za tekst');
        if (!(parseInt(s.relacija_id, 10) > 0)) manjka.push('Relacija');
        if (!trim(s.kontekst_kljuc || '')) manjka.push('Ključ konteksta');
        if (!trim(s.redak_predlozak || '')) manjka.push(tip === 'relacija_grupe' ? 'Predložak imena' : 'Redak-predložak');
      } else {
        manjka.push('Način dohvata');
      }
      var naz = (s.naziv_stavke != null && trim(s.naziv_stavke) !== '') ? (' „' + trim(s.naziv_stavke) + '"') : '';
      if (manjka.length) {
        out.push({ tid: s._tid, tekst: 'Stavka ' + (i + 1) + naz + ': nedostaje ' + manjka.join(', ') });
      }
      var mapa = trim(String(s.mapa_vrijednosti == null ? '' : s.mapa_vrijednosti));
      if (mapa && mapa.split(/[;\r\n]+/).some(function (par) { par = trim(par); return par !== '' && par.indexOf(':') < 0; })) {
        out.push({ tid: s._tid, tekst: 'Stavka ' + (i + 1) + naz + ': neispravan format mape (očekivano v:tekst;v:tekst)' });
      }
    });
    return out;
  }

  byId('btnSpremi').addEventListener('click', function () {
    if (trim(val('edit_naziv')) === '' || trim(val('edit_template_id')) === '') { if (window.showPorukaModal) window.showPorukaModal('105', []); return; }
    var greske = validirajStavke(stavke);
    if (greske.length) {
      var prviTid = greske[0].tid;
      var popis = greske.map(function (g) { return g.tekst; }).join('; ');
      var skok = function () {
        var kart = document.querySelector('#dokTab .kontrola-tab__kartica[data-tab-index="1"]');
        if (kart) kart.click();   /* skok na tab „Lista stavki" */
        if (prviTid != null && stavkeApi && typeof stavkeApi.setSelectedRowIds === 'function') {
          try { stavkeApi.setSelectedRowIds([prviTid]); } catch (e) {}   /* označi problematičnu (korisnik → „Uredi") */
        }
      };
      if (window.showPorukaModal) window.showPorukaModal('031', [popis], skok);
      else skok();
      return;
    }
    var payload = {
      id: tekuciId || 0,
      naziv: trim(val('edit_naziv')),
      template_id: parseInt(val('edit_template_id'), 10),
      opis: trim(val('edit_opis')),
      aktivan: byId('edit_aktivan').checked ? 1 : 0,
      napomena: trim(val('edit_napomena')),
      broj_stranice_paragraf_id: trim(val('edit_broj_stranice_paragraf_id')) ? parseInt(val('edit_broj_stranice_paragraf_id'), 10) : null,
      dokument_prored_default_stil: trim(val('edit_extra_prored_paragraf_id')) ? parseInt(val('edit_extra_prored_paragraf_id'), 10) : null,
      razvoj_aktivan: (byId('edit_u_razvoju') && byId('edit_u_razvoju').checked) ? 1 : 0,
      razvoj_tablica: trim(val('razvoj_tablica')) || null,
      razvoj_kolona: trim(val('razvoj_kolona')) || null,
      razvoj_izabrani_id: trim(val('razvoj_izabrani_id')) ? parseInt(val('razvoj_izabrani_id'), 10) : null,
      stavke: stavke.map(function (s, i) {
        return { redoslijed: i + 1, zona: s.zona, okvir_id: s.okvir_id, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id, bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke, preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti, format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, fiksna_pozicija_y: s.fiksna_pozicija_y, sakrij_ako_prazno: s.sakrij_ako_prazno, relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator, redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold };
      })
    };
    postJson(URL_SPREMI, payload, function (res) {
      if (res.indexOf('OK') === 0) {
        /* nakon upisa/izmjene: osvježi listu pa očisti formu (kao klik na X). */
        if (window.showPorukaModal) {
          window.showPorukaModal(tekuciId > 0 ? '004' : '001', [], function () {
            ucitajDokumente(function () { noviDokument(); });
          });
        } else { ucitajDokumente(function () { noviDokument(); }); }
      } else { porukaIzKoda(res, res.indexOf('002') === 0 ? ['Naziv'] : null); }
    });
  });

  byId('btnIzbrisi').addEventListener('click', function () {
    if (tekuciId <= 0) return;
    function obrisiDokument() {
      var x = new XMLHttpRequest();
      x.open('POST', URL_BRISANJE, true);
      x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        var res = (x.responseText || '').trim();
        if (res === 'OK') {
          if (window.showPorukaModal) window.showPorukaModal('003', [], function () { noviDokument(); ucitajDokumente(); });
          else { noviDokument(); ucitajDokumente(); }
        } else { porukaIzKoda(res); }
      };
      x.send('id=' + encodeURIComponent(tekuciId));
    }
    /* Potvrda prije brisanja (kaskadno briše i stavke); OK briše, Odustani prekida. */
    if (window.showPorukaModal) window.showPorukaModal('032', [], function (buttonKey) { if (buttonKey === 'OK') obrisiDokument(); });
    else obrisiDokument();
  });

  /* ---- Preview (Tab PDF) ---- */
  function ucitajFontove(lista, cb, err) {
    lista = lista || [];
    if (!lista.length) { cb(); return; }
    var preostalo = lista.length, greska = false;
    lista.forEach(function (f) {
      PdfRender.Fontovi.osiguraj(f.kljuc, f.porodica,
        function () { if (--preostalo === 0) { greska ? err() : cb(); } },
        function () { greska = true; if (--preostalo === 0) { err(); } });
    });
  }
  function generirajPreview() {
    var info = byId('previewInfo');
    if (trim(val('edit_template_id')) === '') { info.textContent = 'Odaberi template (tab Dokument).'; return; }
    /* Osigurač: pregled (testni kontekst) radi SAMO dok je dokument „u razvoju". Kad je „dostupan u app"
       (čekbox 0), id dolazi iz aplikacije pri izvođenju — testni Izabrani ID se NE smije koristiti (zbrka). */
    var uRazvoju = !!(byId('edit_u_razvoju') && byId('edit_u_razvoju').checked);
    if (!uRazvoju) { info.textContent = 'Dokument nije u razvoju — pregled koristi podatke iz aplikacije.'; return; }
    info.textContent = 'Dohvaćam…';
    /* Testni kontekst: „Izabrani ID" (desni stupac) → svaki distinct kontekst_kljuc iz stavki dokumenta.
       Za esej-dokument to daje { ID_Esej: <izabrani id> }. */
    var kontekst = {};
    var testniId = uRazvoju ? parseInt(trim(val('razvoj_izabrani_id')), 10) : 0;
    if (testniId > 0) {
      stavke.forEach(function (s) {
        var k = s.kontekst_kljuc != null ? trim(String(s.kontekst_kljuc)) : '';
        if (k !== '') kontekst[k] = testniId;
      });
    }
    var payload = {
      template_id: parseInt(val('edit_template_id'), 10),
      kontekst: kontekst,
      broj_stranice_paragraf_id: trim(val('edit_broj_stranice_paragraf_id')) ? parseInt(val('edit_broj_stranice_paragraf_id'), 10) : null,
      stavke: stavke.map(function (s) { return { redoslijed: 0, zona: s.zona, okvir_id: s.okvir_id, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id, bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke, preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti, format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, fiksna_pozicija_y: s.fiksna_pozicija_y, sakrij_ako_prazno: s.sakrij_ako_prazno, relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator, redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold }; })
    };
    postJson(URL_RESOLVE, payload, function (res) {
      var model;
      try { model = JSON.parse(res); } catch (e) { info.textContent = 'Greška dohvata modela.'; return; }
      if (!model || model.greska) { info.textContent = 'Greška: ' + ((model && model.greska) || 'nepoznata'); return; }
      info.textContent = 'Pripremam slike…';
      PdfRender.pripremiSlike(model, function (model) {
        info.textContent = 'Gradim PDF…';
        var brStavki = (model.stavke || []).length;

        /* Jedan render: simuliraj=null → vjeran (stvarne stranice); simuliraj=1/2 → forsirana stranica
           (samo jednostranični dokument). cbOk(blob, pageCount). */
        function izradiPdf(simuliraj, cbOk, cbErr) {
          var pc = { n: 1 };
          var dd = PdfRender.sastaviDocDefinition(model, {
            vodilice: prikaziBlokove,
            simuliraj: simuliraj,
            onPageCount: function (n) { pc.n = n; }
          });
          PdfRender.Pdf.ucitaj(function () {
            ucitajFontove(model.fontovi, function () {
              try {
                pdfMake.createPdf(dd).getBlob(function (blob) { cbOk(blob, pc.n); });
              } catch (e) { cbErr('Greška pri renderu: ' + e); }
            }, function () { cbErr('Greška pri učitavanju fontova.'); });
          }, function () { cbErr('Greška pri učitavanju pdfmake biblioteke.'); });
        }
        function prikaziBlob(blob, frag) {
          var ok = byId('previewOkvir');
          if (ok._url) { try { URL.revokeObjectURL(ok._url); } catch (e) {} }
          ok._url = URL.createObjectURL(blob);
          ok.src = ok._url + (frag || '');
          info.textContent = 'Gotovo. (stavki: ' + brStavki + ')';
        }
        function greska(msg) { info.textContent = msg; }

        /* 1. prolaz: vjeran render (stvarne stranice; zaglavlje samo gdje template kaže). */
        izradiPdf(null, function (blob, pageCount) {
          if (prikaziBlokove && blokStranica === 2 && pageCount === 1) {
            /* Jednostranični + odabrana 2. strana → 2. prolaz: simulacija izgleda 2. stranice. */
            izradiPdf(2, function (blob2) { prikaziBlob(blob2, ''); }, greska);
          } else {
            /* Višestranični (ili 1. strana): navigiraj pregled na stvarnu stranicu. */
            var frag = (prikaziBlokove && blokStranica === 2 && pageCount >= 2) ? '#page=2' : '';
            prikaziBlob(blob, frag);
          }
        }, greska);
      });
    });
  }
  byId('btnPreview').addEventListener('click', generirajPreview);

  /* ---- Modal „Izbor ID za test" (za dinamičke izvore) — markup je statički u HTML-u ---- */
  var TEST_ID_MODAL_KEY = 'pdf_dok_test_id_modal_pos';
  var tmInit = false;
  function initTestIdModal() {
    if (tmInit) return;
    var root = byId('modalTestId'); if (!root) return;
    tmInit = true;
    var dialog = byId('modalTestId_dialog'), header = byId('modalTestId_header'), overlay = byId('modalTestId_overlay');
    /* Naše kontrole unutar modala */
    if (typeof KontroleInitCustomSelect === 'function') KontroleInitCustomSelect(root);
    if (typeof KontroleInitEditDelete === 'function') KontroleInitEditDelete(root);
    var idIn = byId('tm_id'); if (idIn && typeof KontroleSetControlReadonly === 'function') KontroleSetControlReadonly(idIn, true);
    if (dialog && header && typeof KontroleModalDrag === 'function') KontroleModalDrag(dialog, header);

    function osvjeziOk() { byId('tm_ok').disabled = (trim(byId('tm_id').value) === ''); }
    function ocistiNadjeno() { var n = byId('tm_nadjeno'); if (n) n.textContent = ''; }
    function zatvori() {
      try { if (dialog.style.left) localStorage.setItem(TEST_ID_MODAL_KEY, JSON.stringify({ left: dialog.style.left, top: dialog.style.top })); } catch (e) {}
      root.setAttribute('aria-hidden', 'true');
      root.classList.remove('kontrola-modal--open');
    }
    root._tmZatvori = zatvori;
    /* X u „Traženi niz" (kontrola-edit-delete) uz brisanje sadržaja čisti i ID + zaglavnu labelu. */
    var clearBtn = root.querySelector('.kontrola-edit-delete__clear');
    if (clearBtn) clearBtn.addEventListener('click', function () { byId('tm_id').value = ''; ocistiNadjeno(); osvjeziOk(); });
    overlay.addEventListener('click', zatvori);
    byId('tm_odustani').addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.getAttribute('aria-hidden') === 'false') zatvori(); });
    byId('tm_trazi').addEventListener('click', function () {
      byId('tm_id').value = '';        /* prvo briše ID i zaglavnu labelu */
      ocistiNadjeno();
      osvjeziOk();
      var izvorId = trim(val('st_izvor'));
      var kolona = byId('tm_kolona').value;
      if (!izvorId || !kolona) return;
      var btn = byId('tm_trazi'); btn.disabled = true;
      postJson(URL_TRAZI_ID, {
        izvor_id: parseInt(izvorId, 10), kolona: kolona,
        vrijednost: byId('tm_vrijednost').value, djelomicno: byId('tm_djelomicno').checked ? 1 : 0
      }, function (res) {
        btn.disabled = false;
        var o = null; try { o = JSON.parse(res); } catch (e) {}
        var id = (o && o.id != null) ? o.id : null;
        var broj = (o && o.broj) ? o.broj : 0;
        byId('tm_id').value = (id != null) ? String(id) : '';
        var n = byId('tm_nadjeno'); if (n) n.textContent = (broj > 1) ? ('Pronađeno ' + broj + ' izdvojen prvi') : '';
        osvjeziOk();
      });
    });
    byId('tm_ok').addEventListener('click', function () {
      if (trim(byId('tm_id').value) === '') return;
      setVal('st_test_id', byId('tm_id').value);
      zatvori();
    });
  }
  function otvoriTestIdModal() {
    initTestIdModal();
    var root = byId('modalTestId'); if (!root) return;
    var dialog = byId('modalTestId_dialog');
    var izvorId = trim(val('st_izvor'));
    var izvor = izvorId ? mapaIzvor[izvorId] : null;
    var tablica = izvor ? izvor.tablica : '';
    var kolone = (tablica && mapaMetaKolone[tablica]) ? mapaMetaKolone[tablica] : [];
    var sel = byId('tm_kolona');
    while (sel.options.length > 0) sel.remove(0);
    kolone.forEach(function (k) { var opt = document.createElement('option'); opt.value = k.kolona; opt.textContent = k.kolona; sel.appendChild(opt); });
    byId('tm_id').value = ''; byId('tm_vrijednost').value = '';
    var dj = byId('tm_djelomicno'); if (dj) dj.checked = false;
    var n = byId('tm_nadjeno'); if (n) n.textContent = '';
    byId('tm_ok').disabled = true;
    /* Vrati spremljenu drag-poziciju SAMO ako je unutar vidljivog ekrana (inače ostaje centrirano — da zaglavlje ne padne van). */
    try {
      var raw = localStorage.getItem(TEST_ID_MODAL_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        var topPx = p ? parseFloat(p.top) : NaN, leftPx = p ? parseFloat(p.left) : NaN;
        var maxTop = (window.innerHeight || 800) - 60, maxLeft = (window.innerWidth || 1000) - 60;
        if (p && p.left && topPx >= 0 && topPx <= maxTop && leftPx >= 0 && leftPx <= maxLeft) {
          dialog.style.left = p.left; dialog.style.top = p.top; dialog.style.transform = 'none'; dialog.style.margin = '0';
        }
      }
    } catch (e) {}
    root.setAttribute('aria-hidden', 'false');
    root.classList.add('kontrola-modal--open');
    if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('tm_kolona'); } catch (e) {} }
    var v = byId('tm_vrijednost'); if (v) v.focus();
  }
  var _btnTestIdModal = byId('btnTestIdModal');
  if (_btnTestIdModal) _btnTestIdModal.addEventListener('click', otvoriTestIdModal);
  /* „Testni ID" je RO — vrijednost se postavlja samo kroz modal („…"). */
  (function () { var t = byId('st_test_id'); if (t && typeof KontroleSetControlReadonly === 'function') KontroleSetControlReadonly(t, true); })();

  /* auto-render pri ulasku na tab PDF */
  (function () {
    var tab = byId('dokTab');
    if (tab) tab.addEventListener('click', function (e) {
      var k = e.target && e.target.closest ? e.target.closest('.kontrola-tab__kartica') : null;
      if (k && k.getAttribute('data-tab-index') === '2') generirajPreview();
    });
  })();

  /* ---- Vodilice u PDF-u (margine + zone; toggle ponovno renderira) ---- */
  var SVG_BLOK =
    '<svg viewBox="-2 -2 28 32" width="18" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="0" y="0" width="24" height="28" rx="2" fill="none"/>' +
    '<rect x="0" y="0" width="24" height="5" fill="currentColor" opacity="0.25" stroke="none"/>' +
    '<rect x="0" y="23" width="24" height="5" fill="currentColor" opacity="0.25" stroke="none"/>' +
    '<rect x="4" y="8" width="16" height="12" stroke-dasharray="2 2" stroke-width="1.4"/>' +
    '</svg>';
  /* Ikone 1./2. stranice — kopirano iz PDF_Template_CRUD (prikaz pravila zona po stranici). */
  var SVG_STR1 = '<svg viewBox="-3 -3 34 50" width="19" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="0" y="0" width="28" height="44" rx="2" fill="#fff"/><line x1="6" y1="20" x2="22" y2="20"/><line x1="6" y1="27" x2="22" y2="27"/><line x1="6" y1="34" x2="18" y2="34"/></svg>';
  var SVG_STR2 = '<svg viewBox="-3 -3 50 60" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="0" y="0" width="30" height="40" rx="2" fill="#fff"/><rect x="7" y="7" width="30" height="40" rx="2" fill="#fff"/><rect x="14" y="14" width="30" height="40" rx="2" fill="#fff"/><line x1="20" y1="26" x2="38" y2="26"/><line x1="20" y1="33" x2="38" y2="33"/><line x1="20" y1="40" x2="32" y2="40"/></svg>';
  function postaviBlokIkonu() {
    var btn = byId('btnBlokovi');
    if (!btn) return;
    if (btn.innerHTML.indexOf('<svg') === -1) btn.innerHTML = SVG_BLOK;
    btn.classList.toggle('pdf-dokument-crud__blok-toggle--aktivan', prikaziBlokove);
    btn.setAttribute('aria-pressed', prikaziBlokove ? 'true' : 'false');
    btn.setAttribute('aria-label', prikaziBlokove ? 'Sakrij vodilice stranice' : 'Prikaži vodilice stranice (margine, zaglavlje, podnožje)');
    postaviBlokStranicaIkonu();
  }
  function postaviBlokStranicaIkonu() {
    var btn = byId('btnBlokStranica');
    if (!btn) return;
    btn.innerHTML = (blokStranica === 1) ? SVG_STR1 : SVG_STR2;
    btn.disabled = !prikaziBlokove || trim(val('edit_template_id')) === '';
    btn.setAttribute('aria-label', blokStranica === 1 ? 'Pravila za 1. stranicu — klik za 2.' : 'Pravila za 2. stranicu — klik za 1.');
    btn.title = blokStranica === 1 ? '1. stranica' : '2. stranica';
  }
  postaviBlokIkonu();
  byId('btnBlokovi').addEventListener('click', function () {
    prikaziBlokove = !prikaziBlokove;
    postaviBlokIkonu();
    generirajPreview();
  });
  byId('btnBlokStranica').addEventListener('click', function () {
    if (!prikaziBlokove) return;
    blokStranica = (blokStranica === 1) ? 2 : 1;
    postaviBlokStranicaIkonu();
    generirajPreview();
  });

  /* ---- Povratak ---- */
  byId('btnPovratak').addEventListener('click', function () {
    var params = new URLSearchParams(window.location.search);
    var ref = (params.get('ref') || '').trim();
    if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
    if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e2) {} }
    window.location.href = new URL('Meni.php', window.location.href).href;
  });

  /* ---- Visina tabova: svi tabovi visine prvog (Podaci) ---- */
  var _mjerimVisinu = false;
  function uskladiVisinuTabova() {
    if (_mjerimVisinu) return;
    var tab = byId('dokTab');
    if (!tab) return;
    var tijelo = tab.querySelector('.kontrola-tab__tijelo');
    var panel0 = byId('dokTabPanel0');
    if (!tijelo || !panel0 || panel0.hasAttribute('hidden')) return;   /* mjeri samo dok je tab Podaci aktivan */
    _mjerimVisinu = true;
    var prev = tijelo.style.height;
    tijelo.style.height = 'auto';                                       /* prirodna visina taba Podaci */
    var h = tijelo.offsetHeight;
    tijelo.style.height = (h > 0 ? h + 'px' : prev);
    _mjerimVisinu = false;
  }

  /* Akcije u zaglavlju taba: svaka grupa vidljiva samo dok je njezin panel aktivan. */
  (function () {
    [['stavkeAkcijeHeader', 'dokTabPanel1'], ['pdfAkcijeHeader', 'dokTabPanel2'], ['previewInfo', 'dokTabPanel2']].forEach(function (par) {
      var grupa = byId(par[0]), panel = byId(par[1]);
      if (!grupa || !panel) return;
      function osvjezi() { grupa.hidden = panel.hasAttribute('hidden'); }
      if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(osvjezi).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
      }
      osvjezi();
    });
  })();

  /* ---- Init ---- */
  if (typeof KontroleTabInit === 'function') KontroleTabInit(byId('dokTab'));
  ucitajSveSelekte(function () {
    ucitajDokumente(function () { noviDokument(); uskladiVisinuTabova(); });
  });
  /* Osvježi visinu kad se promijeni sadržaj taba Podaci (npr. resize tablice dokumenata) ili prozor. */
  (function () {
    var podaci = byId('dokTabPanel0') ? byId('dokTabPanel0').querySelector('.pdf-dokument-crud__podaci') : null;
    if (podaci && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { uskladiVisinuTabova(); }).observe(podaci);
    }
    window.addEventListener('resize', uskladiVisinuTabova);
  })();
})();
