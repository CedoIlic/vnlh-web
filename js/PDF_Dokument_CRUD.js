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
  var tidSeq = 1;              /* client temp-id za stavke */
  var odabranaStavka = null;   /* _tid odabrane stavke */
  var prikaziBlokove = false;   /* toggle: vodilice (margine/zone) u PDF-u */
  var blokStranica = 1;         /* referentna stranica za pravila zona (1 / 2) */
  var _bezAutoPrebacivanja = false;  /* spriječi auto-prebacivanje na tab Podaci pri internim re-selekcijama (▲/▼) */
  /* Lookup mape (id → naziv) za prikaz u tablici stavki */
  var mapaIzvor = {}, mapaIzvorTip = {}, mapaParagraf = {}, mapaSlika = {}, mapaTemplate = {};
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
    var preostalo = 5;
    function gotovo() { if (--preostalo === 0 && cb) cb(); }
    xhrGet(API + 'PDF_Whitelist_CRUD_meta.php', function (t) {
      try { mapaMetaKolone = JSON.parse(t || '{}') || {}; } catch (e) { mapaMetaKolone = {}; }
      gotovo();
    });
    xhrGet(API + 'PDF_Template_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaTemplate[String(o.id)] = o; }); napuniSelekt('edit_template_id', a, null, true); } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Whitelist_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaIzvor[String(o.id)] = o; }); napuniSelekt('st_izvor', a, null, true); } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Stilovi_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaParagraf[String(o.id)] = o; }); napuniSelekt('st_paragraf_id', a, null, true); } catch (e) {}
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
    xhrGet(URL_JEDAN + '?id=' + encodeURIComponent(id), function (t) {
      try {
        var o = JSON.parse(t || '{}');
        if (o.greska) { porukaIzKoda(o.greska); return; }
        popuniDokument(o.dokument, o.stavke || []);
      } catch (e) {}
    });
  }

  /* ---- Tablica stavki ---- */
  var STAVKE_CFG = {
    Broj_Kolona: 7,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-dokument-crud',
    Tablica_Zaglavlje: [
      { key: 'red', title: '#', SQL_Naziv: 'red', sortable: 0, sortable_icon: 0, type: 't', width: 40, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'zona', title: 'Zona', SQL_Naziv: 'zona', sortable: 0, sortable_icon: 0, type: 't', width: 110, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'vrsta', title: 'Vrsta', SQL_Naziv: 'vrsta', sortable: 0, sortable_icon: 0, type: 't', width: 80, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'izvor', title: 'Izvor', SQL_Naziv: 'izvor', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stil', title: 'Stil', SQL_Naziv: 'stil', sortable: 0, sortable_icon: 0, type: 't', width: -28, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'kljuc', title: 'Ključ', SQL_Naziv: 'kljuc', sortable: 0, sortable_icon: 0, type: 't', width: 120, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'test', title: 'Test ID', SQL_Naziv: 'test', sortable: 0, sortable_icon: 0, type: 't', width: 70, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var stavkeApi = null;
  CommonCRUD.initTablica('stavkeTablica', STAVKE_CFG, {
    getRowId: function (row) { return row && row[7] != null ? row[7] : null; },
    onReady: function (api) { stavkeApi = api; },
    onSelectionChange: function () { naStavkaSelekcija(); }
  });

  function stavkaRed(s, idx) {
    var izv = s.izvor_id && mapaIzvor[String(s.izvor_id)] ? mapaIzvor[String(s.izvor_id)].naziv : '';
    var stil = '';
    if (s.vrsta === 'tekst' && s.paragraf_id && mapaParagraf[String(s.paragraf_id)]) stil = mapaParagraf[String(s.paragraf_id)].naziv;
    if (s.vrsta === 'slika' && s.slika_stil_id && mapaSlika[String(s.slika_stil_id)]) stil = mapaSlika[String(s.slika_stil_id)].naziv;
    var kljuc = (s.izvor_tip === 'dinamicki') ? (s.kontekst_kljuc || '') : '';
    var test = (s.izvor_tip === 'dinamicki' && s.test_id) ? String(s.test_id) : '';
    return [String(idx + 1), s.zona || '', s.vrsta || '', izv, stil, kljuc, test, s._tid];
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

  /* ---- Edit stavke (Tab Podaci) ---- */
  var STAVKA_POLJA = ['st_zona', 'st_vrsta', 'st_izvor', 'st_izvor_tip', 'st_izvor_red_id', 'st_kontekst_kljuc', 'st_test_id', 'st_trazi_kolona', 'st_trazi_vrijednost', 'st_literal_tekst', 'st_paragraf_id', 'st_slika_stil_id', 'st_bez_kraja_odlomka'];

  function azurirajVidljivostStavke() {
    var vrsta = val('st_vrsta');
    var tip = val('st_izvor_tip');
    /* Korisnički tekst je samo za tekst-stavke; ako je slika odabrana, vrati na statički. */
    if (vrsta === 'slika' && tip === 'korisnicki') { setVal('st_izvor_tip', 'staticki'); refreshSelect('st_izvor_tip'); tip = 'staticki'; }
    var korisnicki = (tip === 'korisnicki');
    byId('polje_izvor').hidden = korisnicki;                 /* korisnički tekst nema whitelist izvor */
    byId('polje_izvor_red_id').hidden = (tip !== 'staticki');
    byId('polje_kontekst_kljuc').hidden = (tip !== 'dinamicki');
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
    setVal('st_zona', s.zona || 'tijelo'); refreshSelect('st_zona');
    setVal('st_vrsta', s.vrsta || 'tekst'); refreshSelect('st_vrsta');
    setVal('st_izvor', s.izvor_id || ''); refreshSelect('st_izvor');
    setVal('st_izvor_tip', s.izvor_tip || 'staticki'); refreshSelect('st_izvor_tip');
    setVal('st_izvor_red_id', s.izvor_red_id || '');
    setVal('st_kontekst_kljuc', s.kontekst_kljuc || '');
    setVal('st_test_id', s.test_id || '');
    popuniTraziKolonu();   /* opcije ovise o izabranom izvoru — prije postavljanja vrijednosti */
    setVal('st_trazi_kolona', s.trazi_kolona || ''); refreshSelect('st_trazi_kolona');
    setVal('st_trazi_vrijednost', s.trazi_vrijednost != null ? s.trazi_vrijednost : '');
    setVal('st_literal_tekst', s.literal_tekst != null ? s.literal_tekst : '');
    setVal('st_paragraf_id', s.paragraf_id || ''); refreshSelect('st_paragraf_id');
    setVal('st_slika_stil_id', s.slika_stil_id || ''); refreshSelect('st_slika_stil_id');
    var bz = byId('st_bez_kraja_odlomka'); if (bz) bz.checked = (s.bez_kraja_odlomka == 1 || s.bez_kraja_odlomka === '1' || s.bez_kraja_odlomka === true);
    azurirajVidljivostStavke();
  }
  /* Pročitaj sva polja forme (oba stupca) u zadanu stavku. Bez osvježavanja tablice/selekcije. */
  function procitajFormuUStavku(s) {
    if (!s) return;
    s.zona = val('st_zona');
    s.vrsta = val('st_vrsta');
    s.izvor_id = trim(val('st_izvor')) ? parseInt(val('st_izvor'), 10) : null;
    s.izvor_tip = val('st_izvor_tip');
    s.izvor_red_id = trim(val('st_izvor_red_id')) ? parseInt(val('st_izvor_red_id'), 10) : null;
    s.kontekst_kljuc = trim(val('st_kontekst_kljuc')) || null;
    s.test_id = (s.izvor_tip === 'dinamicki' && trim(val('st_test_id'))) ? parseInt(val('st_test_id'), 10) : null;
    s.trazi_kolona = trim(val('st_trazi_kolona')) || null;
    s.trazi_vrijednost = val('st_trazi_vrijednost');
    s.literal_tekst = (s.izvor_tip === 'korisnicki') ? trim(val('st_literal_tekst')) : null;
    s.paragraf_id = trim(val('st_paragraf_id')) ? parseInt(val('st_paragraf_id'), 10) : null;
    s.slika_stil_id = trim(val('st_slika_stil_id')) ? parseInt(val('st_slika_stil_id'), 10) : null;
    var bz = byId('st_bez_kraja_odlomka'); s.bez_kraja_odlomka = (bz && bz.checked && s.vrsta === 'tekst') ? 1 : 0;
  }
  /* Edit stavke + tipka Dodaj/Izmijeni: aktivni dok postoji dokument (naziv). Hint vidljiv kad su disabled. */
  function postaviStavkaEnabled(en) {
    STAVKA_POLJA.forEach(function (id) {
      var e = byId(id);
      if (e && typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(e, en);
      else if (e) { e.disabled = !en; if (e.tagName === 'SELECT') refreshSelect(id); }
    });
    var bu = byId('btnStavkaUpis'); if (bu) bu.disabled = !en;
    azurirajVidljivostStavke();   /* dorefiniraj „Testni ID" + „…" (ovise o dinamički + odabran izvor) */
  }
  /* Obriši/▲/▼ disable bez selekcije; tipka Dodaj/Izmijeni prati selekciju (mod). */
  function azurirajStavkaAkcije() {
    var ima = CommonCRUD.getSelectedRowId(stavkeApi) != null;
    ['btnStavkaObrisi', 'btnStavkaGore', 'btnStavkaDolje'].forEach(function (id) {
      var b = byId(id); if (b) b.disabled = !ima;
    });
    var bu = byId('btnStavkaUpis');
    if (bu) {
      bu.classList.toggle('kontrola-btn--crud-izmjeni', ima);
      var lbl = bu.querySelector('.kontrola-btn__label');
      if (lbl) lbl.textContent = ima ? 'Izmijeni' : 'Dodaj';
    }
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
    if (tid == null) { odabranaStavka = null; azurirajStavkaAkcije(); return; }   /* deselekcija: ne diraj formu */
    var s = stavkaPoTid(tid);
    if (!s) { odabranaStavka = null; azurirajStavkaAkcije(); return; }
    odabranaStavka = s._tid;
    popuniStavkaEdit(s);
    azurirajStavkaAkcije();
    /* odabir reda → prebaci na tab Podaci za uređivanje (osim internih re-selekcija, npr. ▲/▼) */
    if (!_bezAutoPrebacivanja && typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(byId('dokTab'), 0);
  }

  /* Promjene u editu stavke → samo prikaz/skrivanje ovisnih polja (bez live-write u stavku). */
  STAVKA_POLJA.forEach(function (id) {
    var e = byId(id);
    if (!e) return;
    var ev = (e.tagName === 'SELECT' || e.type === 'checkbox') ? 'change' : 'input';
    e.addEventListener(ev, function () {
      if (id === 'st_izvor_tip' || id === 'st_vrsta' || id === 'st_izvor') azurirajVidljivostStavke();
      if (id === 'st_izvor') popuniTraziKolonu();   /* promjena izvora → kolone iz njegove tablice */
    });
  });

  /* ---- Akcije nad stavkama ---- */
  /* Tipka Dodaj/Izmijeni: ako je red selektiran → upiši formu u njega + makni selekciju; inače → dodaj novu. */
  byId('btnStavkaUpis').addEventListener('click', function () {
    if (byId('btnStavkaUpis').disabled) return;
    var tid = CommonCRUD.getSelectedRowId(stavkeApi);
    if (tid != null) {
      var s = stavkaPoTid(tid);
      if (s) { procitajFormuUStavku(s); osvjeziTablicuStavki(); }
      if (stavkeApi && typeof stavkeApi.clearSelection === 'function') { try { stavkeApi.clearSelection(); } catch (e) {} }
      ocistiSrednjiStupac();
    } else {
      var ns = { _tid: tidSeq++, napomena: null };
      procitajFormuUStavku(ns);
      stavke.push(ns);
      osvjeziTablicuStavki();
      ocistiSrednjiStupac();
    }
    odabranaStavka = null;
    azurirajStavkaAkcije();   /* nakon commita nema selekcije → mod Dodaj, Obriši/▲/▼ disable */
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
    /* zadrži selekciju nakon premještanja, ali ne prebacuj na tab Podaci */
    _bezAutoPrebacivanja = true;
    if (stavkeApi && typeof stavkeApi.setSelectedRowId === 'function') { try { stavkeApi.setSelectedRowId(tid); } catch (e) {} }
    setTimeout(function () { _bezAutoPrebacivanja = false; }, 0);
  }
  byId('btnStavkaGore').addEventListener('click', function () { pomakni(-1); });
  byId('btnStavkaDolje').addEventListener('click', function () { pomakni(1); });

  /* ---- Punjenje / čišćenje dokumenta ---- */
  function popuniDokument(dok, lstStavke, samoSadrzaj) {
    if (!samoSadrzaj) {
      tekuciId = dok && dok.id ? parseInt(dok.id, 10) : 0;
      setVal('edit_naziv', dok ? dok.naziv : '');
    }
    setVal('edit_template_id', dok ? dok.template_id : ''); refreshSelect('edit_template_id');
    setVal('edit_opis', dok ? dok.opis : '');
    var ak = byId('edit_aktivan'); if (ak) ak.checked = dok ? (dok.aktivan == 1 || dok.aktivan === '1' || dok.aktivan === true) : true;
    setVal('edit_napomena', dok ? dok.napomena : '');
    stavke = (lstStavke || []).map(function (r) {
      return {
        _tid: tidSeq++,
        zona: r.zona, vrsta: r.vrsta, izvor_id: r.izvor_id ? parseInt(r.izvor_id, 10) : null,
        izvor_tip: r.izvor_tip, izvor_red_id: r.izvor_red_id ? parseInt(r.izvor_red_id, 10) : null,
        kontekst_kljuc: r.kontekst_kljuc, test_id: r.test_id ? parseInt(r.test_id, 10) : null, trazi_kolona: r.trazi_kolona, trazi_vrijednost: r.trazi_vrijednost,
        literal_tekst: r.literal_tekst,
        paragraf_id: r.paragraf_id ? parseInt(r.paragraf_id, 10) : null,
        slika_stil_id: r.slika_stil_id ? parseInt(r.slika_stil_id, 10) : null,
        bez_kraja_odlomka: (r.bez_kraja_odlomka == 1 || r.bez_kraja_odlomka === '1') ? 1 : 0,
        napomena: r.napomena
      };
    });
    osvjeziTablicuStavki();
    ocistiStavkaEdit();
    azurirajSpremiStanje();
  }
  /* Ponovni dohvat selekata stilova (Stil teksta / Stil slike) — npr. stil dodan u drugoj kartici. */
  function ucitajStilSelekte() {
    xhrGet(API + 'PDF_Stilovi_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); mapaParagraf = {}; a.forEach(function (o) { mapaParagraf[String(o.id)] = o; }); napuniSelekt('st_paragraf_id', a, null, true); } catch (e) {}
    });
    xhrGet(API + 'PDF_Stilovi_Slike_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); mapaSlika = {}; a.forEach(function (o) { mapaSlika[String(o.id)] = o; }); napuniSelekt('st_slika_stil_id', a, null, true); } catch (e) {}
    });
  }
  function noviDokument() {
    if (dokApi && typeof dokApi.clearSelection === 'function') { try { dokApi.clearSelection(); } catch (e) {} }
    popuniDokument(null, []);
    ucitajStilSelekte();   /* osvježi stilove (upiši/izmjeni/izbriši/X/čišćenje svi prolaze ovuda) */
  }

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
    if (typeof KontroleSetControlEnabled === 'function') {
      var tpl = byId('edit_template_id'); if (tpl) KontroleSetControlEnabled(tpl, imaDok);
      var opis = byId('edit_opis'); if (opis) KontroleSetControlEnabled(opis, imaDok);
      var nasl = byId('edit_naslijedi_dok'); if (nasl) KontroleSetControlEnabled(nasl, imaDok && docExists);
    }
    postaviStavkaEnabled(imaDok);   /* edit stavke + tipka Dodaj/Izmijeni aktivni samo dok postoji dokument */
    /* PDF tab: enable kad je odabran template (selekt ima vrijednost). */
    var imaTemplate = trim(val('edit_template_id')) !== '';
    var pdfKart = byId('dokTabKart2');
    if (pdfKart) {
      pdfKart.disabled = !imaTemplate;
      if (!imaTemplate && pdfKart.classList.contains('kontrola-tab__kartica--aktivna') && typeof kontrolaTabPostaviAktivni === 'function') {
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
      var mozeVodilice = trim(val('edit_template_id')) !== '';
      bb.disabled = !mozeVodilice;
      if (!mozeVodilice && prikaziBlokove) { prikaziBlokove = false; postaviBlokIkonu(); }
    }
    if (typeof postaviBlokStranicaIkonu === 'function') postaviBlokStranicaIkonu();
  }
  byId('edit_naziv').addEventListener('input', azurirajSpremiStanje);
  byId('edit_template_id').addEventListener('change', azurirajSpremiStanje);

  byId('btnSpremi').addEventListener('click', function () {
    if (trim(val('edit_naziv')) === '' || trim(val('edit_template_id')) === '') { if (window.showPorukaModal) window.showPorukaModal('105', []); return; }
    var payload = {
      id: tekuciId || 0,
      naziv: trim(val('edit_naziv')),
      template_id: parseInt(val('edit_template_id'), 10),
      opis: trim(val('edit_opis')),
      aktivan: byId('edit_aktivan').checked ? 1 : 0,
      napomena: trim(val('edit_napomena')),
      stavke: stavke.map(function (s, i) {
        return { redoslijed: i + 1, zona: s.zona, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id, bez_kraja_odlomka: s.bez_kraja_odlomka, napomena: s.napomena };
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
    info.textContent = 'Dohvaćam…';
    var payload = {
      template_id: parseInt(val('edit_template_id'), 10),
      kontekst: {},
      stavke: stavke.map(function (s) { return { redoslijed: 0, zona: s.zona, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id, bez_kraja_odlomka: s.bez_kraja_odlomka }; })
    };
    postJson(URL_RESOLVE, payload, function (res) {
      var model;
      try { model = JSON.parse(res); } catch (e) { info.textContent = 'Greška dohvata modela.'; return; }
      if (!model || model.greska) { info.textContent = 'Greška: ' + ((model && model.greska) || 'nepoznata'); return; }
      info.textContent = 'Pripremam slike…';
      PdfRender.pripremiSlike(model, function (model) {
        info.textContent = 'Gradim PDF…';
        var dd = PdfRender.sastaviDocDefinition(model, { vodilice: prikaziBlokove, stranica: blokStranica });
        PdfRender.Pdf.ucitaj(function () {
          ucitajFontove(model.fontovi, function () {
            try {
              pdfMake.createPdf(dd).getBlob(function (blob) {
                var ok = byId('previewOkvir');
                if (ok._url) { try { URL.revokeObjectURL(ok._url); } catch (e) {} }
                ok._url = URL.createObjectURL(blob); ok.src = ok._url;
                info.textContent = 'Gotovo. (stavki: ' + (model.stavke || []).length + ')';
              });
            } catch (e) { info.textContent = 'Greška pri renderu: ' + e; }
          }, function () { info.textContent = 'Greška pri učitavanju fontova.'; });
        }, function () { info.textContent = 'Greška pri učitavanju pdfmake biblioteke.'; });
      });
    });
  }
  byId('btnPreview').addEventListener('click', generirajPreview);

  /* ---- Modal „Izbor ID za test" (za dinamičke izvore) ---- */
  var TEST_ID_MODAL_KEY = 'pdf_dok_test_id_modal_pos';
  var testIdModal = null;
  function izgradiTestIdModal() {
    if (testIdModal) return testIdModal;
    var root = document.createElement('div');
    root.className = 'kontrola-modal kontrola-modal--dim';
    root.id = 'modalTestId';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.style.zIndex = '10002';
    var overlay = document.createElement('div'); overlay.className = 'kontrola-modal__overlay';
    var dialog = document.createElement('div'); dialog.className = 'kontrola-modal__dialog';
    var header = document.createElement('div'); header.className = 'kontrola-modal__header'; header.textContent = 'Izbor ID za test';
    var body = document.createElement('div'); body.className = 'kontrola-modal__body kontrola-modal__body--text-only';
    var content = document.createElement('div'); content.className = 'kontrola-modal__content';
    var sel = document.createElement('select'); sel.className = 'kontrola-edit'; sel.setAttribute('aria-label', 'Kolona za pretragu'); sel.style.width = '100%'; sel.style.marginBottom = '.5rem';
    var red = document.createElement('div'); red.style.display = 'flex'; red.style.gap = '.4rem'; red.style.alignItems = 'center';
    var idIn = document.createElement('input'); idIn.type = 'text'; idIn.className = 'kontrola-edit'; idIn.readOnly = true; idIn.placeholder = 'ID'; idIn.setAttribute('aria-label', 'ID'); idIn.style.flex = '0 0 6rem';
    var valIn = document.createElement('input'); valIn.type = 'text'; valIn.className = 'kontrola-edit'; valIn.placeholder = 'Vrijednost'; valIn.setAttribute('aria-label', 'Vrijednost'); valIn.style.flex = '1 1 auto';
    var btnTrazi = document.createElement('button'); btnTrazi.type = 'button'; btnTrazi.className = 'kontrola-btn kontrola-btn--crud-upisi'; btnTrazi.style.flex = '0 0 auto';
    btnTrazi.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">Traži</span></span></span>';
    red.appendChild(idIn); red.appendChild(valIn); red.appendChild(btnTrazi);
    content.appendChild(sel); content.appendChild(red); body.appendChild(content);
    var footer = document.createElement('div'); footer.className = 'kontrola-modal__footer';
    var btnOk = document.createElement('button'); btnOk.type = 'button'; btnOk.className = 'kontrola-btn kontrola-btn--primary'; btnOk.disabled = true;
    btnOk.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">OK</span></span></span>';
    var btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'kontrola-btn kontrola-btn--crud-povratak';
    btnCancel.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">Odustani</span></span></span>';
    footer.appendChild(btnOk); footer.appendChild(btnCancel);
    dialog.appendChild(header); dialog.appendChild(body); dialog.appendChild(footer);
    root.appendChild(overlay); root.appendChild(dialog);
    document.body.appendChild(root);
    if (typeof KontroleModalDrag === 'function') KontroleModalDrag(dialog, header);

    function osvjeziOk() { btnOk.disabled = (trim(idIn.value) === ''); }
    function zatvori() {
      try { if (dialog.style.left) localStorage.setItem(TEST_ID_MODAL_KEY, JSON.stringify({ left: dialog.style.left, top: dialog.style.top })); } catch (e) {}
      root.setAttribute('aria-hidden', 'true');
      root.classList.remove('kontrola-modal--open');
    }
    overlay.addEventListener('click', zatvori);
    btnCancel.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.getAttribute('aria-hidden') === 'false') zatvori(); });
    idIn.addEventListener('input', osvjeziOk);
    btnTrazi.addEventListener('click', function () {
      idIn.value = '';                 /* prvo briše ID */
      osvjeziOk();
      var izvorId = trim(val('st_izvor'));
      var kolona = sel.value;
      if (!izvorId || !kolona) return;
      btnTrazi.disabled = true;
      postJson(URL_TRAZI_ID, { izvor_id: parseInt(izvorId, 10), kolona: kolona, vrijednost: valIn.value }, function (res) {
        btnTrazi.disabled = false;
        var o = null; try { o = JSON.parse(res); } catch (e) {}
        idIn.value = (o && o.id != null) ? String(o.id) : '';
        osvjeziOk();
      });
    });
    btnOk.addEventListener('click', function () {
      if (trim(idIn.value) === '') return;
      setVal('st_test_id', idIn.value);
      zatvori();
    });
    testIdModal = { root: root, dialog: dialog, sel: sel, idIn: idIn, valIn: valIn, btnOk: btnOk };
    return testIdModal;
  }
  function otvoriTestIdModal() {
    var m = izgradiTestIdModal();
    var izvorId = trim(val('st_izvor'));
    var izvor = izvorId ? mapaIzvor[izvorId] : null;
    var tablica = izvor ? izvor.tablica : '';
    var kolone = (tablica && mapaMetaKolone[tablica]) ? mapaMetaKolone[tablica] : [];
    while (m.sel.options.length > 0) m.sel.remove(0);
    kolone.forEach(function (k) { var opt = document.createElement('option'); opt.value = k.kolona; opt.textContent = k.kolona; m.sel.appendChild(opt); });
    m.idIn.value = ''; m.valIn.value = ''; m.btnOk.disabled = true;
    try { var raw = localStorage.getItem(TEST_ID_MODAL_KEY); if (raw) { var p = JSON.parse(raw); if (p && p.left) { m.dialog.style.left = p.left; m.dialog.style.top = p.top; m.dialog.style.transform = 'none'; m.dialog.style.margin = '0'; } } } catch (e) {}
    m.root.setAttribute('aria-hidden', 'false');
    m.root.classList.add('kontrola-modal--open');
    m.valIn.focus();
  }
  var _btnTestIdModal = byId('btnTestIdModal');
  if (_btnTestIdModal) _btnTestIdModal.addEventListener('click', otvoriTestIdModal);

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
    [['stavkeAkcijeHeader', 'dokTabPanel1'], ['pdfAkcijeHeader', 'dokTabPanel2']].forEach(function (par) {
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
