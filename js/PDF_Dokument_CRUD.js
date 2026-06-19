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
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaIzvor[String(o.id)] = o; }); napuniSelekt('st_izvor', a, null, true); napuniSelekt('st_preko_izvor', a, null, true); } catch (e) {}
      gotovo();
    });
    xhrGet(API + 'PDF_Stilovi_CRUD_sve.php', function (t) {
      try { var a = JSON.parse(t || '[]'); a.forEach(function (o) { mapaParagraf[String(o.id)] = o; }); napuniSelekt('st_paragraf_id', a, null, true); napuniSelekt('edit_broj_stranice_paragraf_id', a, null, true); } catch (e) {}
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
    return [String(idx + 1), s.naziv_stavke || '', status, s.zona || '', s.vrsta || '', izv, stil, kljuc, test, s._tid];
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
    var TIP = { staticki: 'Statički (fiksni ID)', dinamicki: 'Dinamički (iz konteksta)', po_vrijednosti: 'Po vrijednosti', korisnicki: 'Korisnički tekst' };
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
    content.appendChild(popupRed('Zona', s.zona));
    content.appendChild(popupRed('Vrsta', s.vrsta));
    content.appendChild(popupRed('Način dohvata', TIP[s.izvor_tip] || s.izvor_tip));
    /* potpis ispod „Način dohvata" (uvučeno); uvijek prisutno, „—" kad nema izvora (npr. korisnički tekst) */
    content.appendChild(popupRed('Tablica', izvor ? izvor.tablica : '', true));
    content.appendChild(popupRed('Whitelist', izvor ? izvor.naziv : '', true));
    content.appendChild(popupRed('ID retka', s.izvor_red_id));
    content.appendChild(popupRed('Ključ konteksta', s.kontekst_kljuc));
    var preko = s.preko_izvor_id && mapaIzvor[String(s.preko_izvor_id)] ? mapaIzvor[String(s.preko_izvor_id)] : null;
    content.appendChild(popupRed('Veza (preko)', preko ? (preko.tablica + '.' + preko.kolona + ' — ' + preko.naziv) : ''));
    content.appendChild(popupRed('Testni ID', s.test_id));
    content.appendChild(popupRed('Traži kolonu', s.trazi_kolona));
    content.appendChild(popupRed('Tražena vrijednost', s.trazi_vrijednost));
    content.appendChild(popupRed('Mapa vrijednosti', s.mapa_vrijednosti));
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
  var STAVKA_POLJA = ['st_naziv_stavke', 'st_zona', 'st_vrsta', 'st_izvor', 'st_izvor_tip', 'st_izvor_red_id', 'st_kontekst_kljuc', 'st_test_id', 'st_preko_izvor', 'st_mapa_vrijednosti', 'st_trazi_kolona', 'st_trazi_vrijednost', 'st_literal_tekst', 'st_paragraf_id', 'st_slika_stil_id', 'st_bez_kraja_odlomka', 'st_novi_red_odlomka'];

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
    byId('polje_preko_izvor').hidden = (tip !== 'dinamicki');   /* indirektni ključ samo za dinamički */
    byId('polje_mapa').hidden = korisnicki;                      /* mapiranje vrijednosti za sve osim korisničkog */
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
    setVal('st_zona', s.zona || 'tijelo'); refreshSelect('st_zona');
    setVal('st_vrsta', s.vrsta || 'tekst'); refreshSelect('st_vrsta');
    setVal('st_izvor', s.izvor_id || ''); refreshSelect('st_izvor');
    setVal('st_izvor_tip', s.izvor_tip || 'staticki'); refreshSelect('st_izvor_tip');
    setVal('st_izvor_red_id', s.izvor_red_id || '');
    setVal('st_kontekst_kljuc', s.kontekst_kljuc || '');
    setVal('st_test_id', s.test_id || '');
    setVal('st_preko_izvor', s.preko_izvor_id || ''); refreshSelect('st_preko_izvor');
    setVal('st_mapa_vrijednosti', s.mapa_vrijednosti != null ? s.mapa_vrijednosti : '');
    popuniTraziKolonu();   /* opcije ovise o izabranom izvoru — prije postavljanja vrijednosti */
    setVal('st_trazi_kolona', s.trazi_kolona || ''); refreshSelect('st_trazi_kolona');
    setVal('st_trazi_vrijednost', s.trazi_vrijednost != null ? s.trazi_vrijednost : '');
    setVal('st_literal_tekst', s.literal_tekst != null ? s.literal_tekst : '');
    setVal('st_paragraf_id', s.paragraf_id || ''); refreshSelect('st_paragraf_id');
    setVal('st_slika_stil_id', s.slika_stil_id || ''); refreshSelect('st_slika_stil_id');
    var bkv = parseInt(s.bez_kraja_odlomka, 10) || 0;
    var bz = byId('st_bez_kraja_odlomka'); if (bz) bz.checked = (bkv === 1);
    var nr = byId('st_novi_red_odlomka'); if (nr) nr.checked = (bkv === 2);
    azurirajVidljivostStavke();
  }
  /* Pročitaj sva polja forme (oba stupca) u zadanu stavku. Bez osvježavanja tablice/selekcije. */
  function procitajFormuUStavku(s) {
    if (!s) return;
    s.naziv_stavke = trim(val('st_naziv_stavke')) || null;
    s.zona = val('st_zona');
    s.vrsta = val('st_vrsta');
    s.izvor_id = trim(val('st_izvor')) ? parseInt(val('st_izvor'), 10) : null;
    s.izvor_tip = val('st_izvor_tip');
    s.izvor_red_id = trim(val('st_izvor_red_id')) ? parseInt(val('st_izvor_red_id'), 10) : null;
    s.kontekst_kljuc = trim(val('st_kontekst_kljuc')) || null;
    s.test_id = (s.izvor_tip === 'dinamicki' && trim(val('st_test_id'))) ? parseInt(val('st_test_id'), 10) : null;
    s.preko_izvor_id = (s.izvor_tip === 'dinamicki' && trim(val('st_preko_izvor'))) ? parseInt(val('st_preko_izvor'), 10) : null;
    s.mapa_vrijednosti = (s.izvor_tip !== 'korisnicki') ? (trim(val('st_mapa_vrijednosti')) || null) : null;
    s.trazi_kolona = trim(val('st_trazi_kolona')) || null;
    s.trazi_vrijednost = val('st_trazi_vrijednost');
    s.literal_tekst = (s.izvor_tip === 'korisnicki') ? trim(val('st_literal_tekst')) : null;
    s.paragraf_id = trim(val('st_paragraf_id')) ? parseInt(val('st_paragraf_id'), 10) : null;
    s.slika_stil_id = trim(val('st_slika_stil_id')) ? parseInt(val('st_slika_stil_id'), 10) : null;
    var bz = byId('st_bez_kraja_odlomka'); var nr = byId('st_novi_red_odlomka');
    s.bez_kraja_odlomka = (s.vrsta !== 'tekst') ? 0 : ((bz && bz.checked) ? 1 : ((nr && nr.checked) ? 2 : 0));
  }
  /* Edit stavke + tipka Dodaj/Izmijeni: aktivni dok postoji dokument (naziv). Hint vidljiv kad su disabled. */
  function postaviStavkaEnabled(en) {
    /* Editor je u modalu; ovdje gatamo samo „Dodaj" (treba postojeći dokument). Uredi/Obriši/… ovise o selekciji. */
    var bd = byId('btnStavkaDodaj'); if (bd) bd.disabled = !en;
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
      if (id === 'st_izvor_tip' || id === 'st_vrsta' || id === 'st_izvor') azurirajVidljivostStavke();
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
    var ok = byId('btnMapaPomocOk'); if (ok) ok.addEventListener('click', zatvori);
    var ov = byId('mapaPomocModal_overlay'); if (ov) ov.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('aria-hidden') === 'false') zatvori(); });
    var dlg = m.querySelector('.kontrola-modal__dialog'), hdr = byId('mapaPomocModal_header');
    if (dlg && hdr && typeof KontroleModalDrag === 'function') KontroleModalDrag(dlg, hdr);
  })();

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
    setVal('edit_broj_stranice_paragraf_id', (dok && dok.broj_stranice_paragraf_id) ? dok.broj_stranice_paragraf_id : ''); refreshSelect('edit_broj_stranice_paragraf_id');
    stavke = (lstStavke || []).map(function (r) {
      return {
        _tid: tidSeq++,
        zona: r.zona, vrsta: r.vrsta, izvor_id: r.izvor_id ? parseInt(r.izvor_id, 10) : null,
        izvor_tip: r.izvor_tip, izvor_red_id: r.izvor_red_id ? parseInt(r.izvor_red_id, 10) : null,
        kontekst_kljuc: r.kontekst_kljuc, test_id: r.test_id ? parseInt(r.test_id, 10) : null, trazi_kolona: r.trazi_kolona, trazi_vrijednost: r.trazi_vrijednost,
        literal_tekst: r.literal_tekst,
        paragraf_id: r.paragraf_id ? parseInt(r.paragraf_id, 10) : null,
        slika_stil_id: r.slika_stil_id ? parseInt(r.slika_stil_id, 10) : null,
        bez_kraja_odlomka: (parseInt(r.bez_kraja_odlomka, 10) === 2) ? 2 : ((parseInt(r.bez_kraja_odlomka, 10) === 1) ? 1 : 0),
        naziv_stavke: r.naziv_stavke,
        preko_izvor_id: r.preko_izvor_id ? parseInt(r.preko_izvor_id, 10) : null,
        mapa_vrijednosti: r.mapa_vrijednosti
      };
    });
    osvjeziTablicuStavki();
    ocistiStavkaEdit();
    azurirajSpremiStanje();
  }
  /* Ponovni dohvat selekata stilova (Stil teksta / Stil slike) — npr. stil dodan u drugoj kartici. */
  /* Osvježi editor-selekte (whitelist izvori + meta kolone + stilovi teksta/slike) — bez template-a.
     Zove se kod add/edit/delete (preko noviDokument) i kod selekcije reda (dokument/stavka), da se vide
     stavke dodane u drugoj instanci bez hard refresha. cb() kad su svi xhr-ovi gotovi. */
  function osvjeziEditSelekte(cb) {
    var preostalo = 4;
    function gotovo() { if (--preostalo === 0 && cb) cb(); }
    xhrGet(API + 'PDF_Whitelist_CRUD_meta.php', function (t) {
      try { mapaMetaKolone = JSON.parse(t || '{}') || {}; } catch (e) { mapaMetaKolone = {}; }
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
        var v3 = val('st_paragraf_id'), v4 = val('edit_broj_stranice_paragraf_id');
        napuniSelekt('st_paragraf_id', a, null, true); napuniSelekt('edit_broj_stranice_paragraf_id', a, null, true);
        setVal('st_paragraf_id', v3); refreshSelect('st_paragraf_id'); setVal('edit_broj_stranice_paragraf_id', v4); refreshSelect('edit_broj_stranice_paragraf_id');
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
    if (typeof KontroleSetControlEnabled === 'function') {
      var tpl = byId('edit_template_id'); if (tpl) KontroleSetControlEnabled(tpl, imaDok);
      var opis = byId('edit_opis'); if (opis) KontroleSetControlEnabled(opis, imaDok);
      var brSel = byId('edit_broj_stranice_paragraf_id'); if (brSel) KontroleSetControlEnabled(brSel, imaDok);
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

  /* Razvojna sekcija: tekst uz čekbox ovisi o stanju (čekiran = u razvoju; inače dostupan u app). */
  (function () {
    var cb = byId('edit_u_razvoju'), txt = byId('edit_u_razvoju_tekst');
    if (!cb || !txt) return;
    function osvjeziRazvojTekst() { txt.textContent = cb.checked ? 'Dokument je u razvoju' : 'Dokument je dostupan u app'; }
    cb.addEventListener('change', osvjeziRazvojTekst);
    osvjeziRazvojTekst();
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
      stavke: stavke.map(function (s, i) {
        return { redoslijed: i + 1, zona: s.zona, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id, bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke, preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti };
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
    info.textContent = 'Dohvaćam…';
    /* ===== DEBUG (privremeno — ukloniti nakon testiranja) =====
       Za test indirektnog ključa: id eseja se čita iz polja „Napomena" (edit_napomena)
       i šalje kao kontekst ID_Esej pri svakom osvježavanju PDF-a. */
    var kontekstDebug = {};
    var _debugEsejId = parseInt(trim(val('edit_napomena')), 10);
    if (_debugEsejId > 0) kontekstDebug.ID_Esej = _debugEsejId;
    /* ===== /DEBUG ===== */
    var payload = {
      template_id: parseInt(val('edit_template_id'), 10),
      kontekst: kontekstDebug,
      broj_stranice_paragraf_id: trim(val('edit_broj_stranice_paragraf_id')) ? parseInt(val('edit_broj_stranice_paragraf_id'), 10) : null,
      stavke: stavke.map(function (s) { return { redoslijed: 0, zona: s.zona, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id, bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke, preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti }; })
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
    try { var raw = localStorage.getItem(TEST_ID_MODAL_KEY); if (raw) { var p = JSON.parse(raw); if (p && p.left) { dialog.style.left = p.left; dialog.style.top = p.top; dialog.style.transform = 'none'; dialog.style.margin = '0'; } } } catch (e) {}
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
