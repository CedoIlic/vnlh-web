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
    var preostalo = 4;
    function gotovo() { if (--preostalo === 0 && cb) cb(); }
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
    /* prazna baza → trajno disable; inače enable */
    if (typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(sel, lista.length > 0);
    else sel.disabled = lista.length === 0;
    refreshSelect('edit_naslijedi_dok');
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
    Broj_Kolona: 5,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-dokument-crud',
    Tablica_Zaglavlje: [
      { key: 'red', title: '#', SQL_Naziv: 'red', sortable: 0, sortable_icon: 0, type: 't', width: 40, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'zona', title: 'Zona', SQL_Naziv: 'zona', sortable: 0, sortable_icon: 0, type: 't', width: 110, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'vrsta', title: 'Vrsta', SQL_Naziv: 'vrsta', sortable: 0, sortable_icon: 0, type: 't', width: 80, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'izvor', title: 'Izvor', SQL_Naziv: 'izvor', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stil', title: 'Stil', SQL_Naziv: 'stil', sortable: 0, sortable_icon: 0, type: 't', width: -28, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var stavkeApi = null;
  CommonCRUD.initTablica('stavkeTablica', STAVKE_CFG, {
    getRowId: function (row) { return row && row[5] != null ? row[5] : null; },
    onReady: function (api) { stavkeApi = api; },
    onSelectionChange: function () { naStavkaSelekcija(); }
  });

  function stavkaRed(s, idx) {
    var izv = s.izvor_id && mapaIzvor[String(s.izvor_id)] ? mapaIzvor[String(s.izvor_id)].naziv : '';
    var stil = '';
    if (s.vrsta === 'tekst' && s.paragraf_id && mapaParagraf[String(s.paragraf_id)]) stil = mapaParagraf[String(s.paragraf_id)].naziv;
    if (s.vrsta === 'slika' && s.slika_stil_id && mapaSlika[String(s.slika_stil_id)]) stil = mapaSlika[String(s.slika_stil_id)].naziv;
    return [String(idx + 1), s.zona || '', s.vrsta || '', izv, stil, s._tid];
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
  var STAVKA_POLJA = ['st_zona', 'st_vrsta', 'st_izvor', 'st_izvor_tip', 'st_izvor_red_id', 'st_kontekst_kljuc', 'st_trazi_kolona', 'st_trazi_vrijednost', 'st_paragraf_id', 'st_slika_stil_id'];

  function azurirajVidljivostStavke() {
    var tip = val('st_izvor_tip');
    byId('polje_izvor_red_id').hidden = (tip !== 'staticki');
    byId('polje_kontekst_kljuc').hidden = (tip !== 'dinamicki');
    byId('polje_trazi_kolona').hidden = (tip !== 'po_vrijednosti');
    byId('polje_trazi_vrijednost').hidden = (tip !== 'po_vrijednosti');
    var vrsta = val('st_vrsta');
    byId('polje_paragraf').hidden = (vrsta !== 'tekst');
    byId('polje_slika_stil').hidden = (vrsta !== 'slika');
  }

  function popuniStavkaEdit(s) {
    setVal('st_zona', s.zona || 'tijelo'); refreshSelect('st_zona');
    setVal('st_vrsta', s.vrsta || 'tekst'); refreshSelect('st_vrsta');
    setVal('st_izvor', s.izvor_id || ''); refreshSelect('st_izvor');
    setVal('st_izvor_tip', s.izvor_tip || 'staticki'); refreshSelect('st_izvor_tip');
    setVal('st_izvor_red_id', s.izvor_red_id || '');
    setVal('st_kontekst_kljuc', s.kontekst_kljuc || '');
    setVal('st_trazi_kolona', s.trazi_kolona || '');
    setVal('st_trazi_vrijednost', s.trazi_vrijednost != null ? s.trazi_vrijednost : '');
    setVal('st_paragraf_id', s.paragraf_id || ''); refreshSelect('st_paragraf_id');
    setVal('st_slika_stil_id', s.slika_stil_id || ''); refreshSelect('st_slika_stil_id');
    azurirajVidljivostStavke();
    var hint = byId('stavkaHint'); if (hint) hint.hidden = true;
    postaviStavkaEnabled(true);
  }
  function citajStavkaUObjekt() {
    var s = odabranaStavka != null ? stavkaPoTid(odabranaStavka) : null;
    if (!s) return;
    s.zona = val('st_zona');
    s.vrsta = val('st_vrsta');
    s.izvor_id = trim(val('st_izvor')) ? parseInt(val('st_izvor'), 10) : null;
    s.izvor_tip = val('st_izvor_tip');
    s.izvor_red_id = trim(val('st_izvor_red_id')) ? parseInt(val('st_izvor_red_id'), 10) : null;
    s.kontekst_kljuc = trim(val('st_kontekst_kljuc')) || null;
    s.trazi_kolona = trim(val('st_trazi_kolona')) || null;
    s.trazi_vrijednost = val('st_trazi_vrijednost');
    s.paragraf_id = trim(val('st_paragraf_id')) ? parseInt(val('st_paragraf_id'), 10) : null;
    s.slika_stil_id = trim(val('st_slika_stil_id')) ? parseInt(val('st_slika_stil_id'), 10) : null;
    osvjeziTablicuStavki();
    if (stavkeApi && typeof stavkeApi.setSelectedRowId === 'function') { try { stavkeApi.setSelectedRowId(s._tid); } catch (e) {} }
  }
  function postaviStavkaEnabled(en) {
    STAVKA_POLJA.forEach(function (id) {
      var e = byId(id);
      if (e && typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(e, en);
      else if (e) { e.disabled = !en; if (e.tagName === 'SELECT') refreshSelect(id); }
    });
    if (!en) { var hint = byId('stavkaHint'); if (hint) hint.hidden = false; }
  }
  function ocistiStavkaEdit() {
    odabranaStavka = null;
    STAVKA_POLJA.forEach(function (id) { var e = byId(id); if (e) { if (e.tagName === 'SELECT') { e.selectedIndex = 0; refreshSelect(id); } else e.value = ''; } });
    azurirajVidljivostStavke();
    postaviStavkaEnabled(false);
  }

  function naStavkaSelekcija() {
    var tid = CommonCRUD.getSelectedRowId(stavkeApi);
    if (tid == null) { ocistiStavkaEdit(); return; }
    var s = stavkaPoTid(tid);
    if (!s) { ocistiStavkaEdit(); return; }
    odabranaStavka = s._tid;
    popuniStavkaEdit(s);
  }

  /* Promjene u editu stavke → upiši u objekt + osvježi tablicu */
  STAVKA_POLJA.forEach(function (id) {
    var e = byId(id);
    if (!e) return;
    var ev = (e.tagName === 'SELECT' || e.type === 'checkbox') ? 'change' : 'input';
    e.addEventListener(ev, function () {
      if (id === 'st_izvor_tip' || id === 'st_vrsta') azurirajVidljivostStavke();
      citajStavkaUObjekt();
    });
  });

  /* ---- Akcije nad stavkama ---- */
  byId('btnStavkaDodaj').addEventListener('click', function () {
    var s = { _tid: tidSeq++, zona: 'tijelo', vrsta: 'tekst', izvor_id: null, izvor_tip: 'staticki', izvor_red_id: null, kontekst_kljuc: null, trazi_kolona: null, trazi_vrijednost: '', paragraf_id: null, slika_stil_id: null, napomena: null };
    stavke.push(s);
    osvjeziTablicuStavki();
    if (stavkeApi && typeof stavkeApi.setSelectedRowId === 'function') { try { stavkeApi.setSelectedRowId(s._tid); } catch (e) {} }
    naStavkaSelekcija();
    /* prebaci na tab Podaci za uređivanje */
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(byId('dokTab'), 0);
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
    if (stavkeApi && typeof stavkeApi.setSelectedRowId === 'function') { try { stavkeApi.setSelectedRowId(tid); } catch (e) {} }
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
        kontekst_kljuc: r.kontekst_kljuc, trazi_kolona: r.trazi_kolona, trazi_vrijednost: r.trazi_vrijednost,
        paragraf_id: r.paragraf_id ? parseInt(r.paragraf_id, 10) : null,
        slika_stil_id: r.slika_stil_id ? parseInt(r.slika_stil_id, 10) : null,
        napomena: r.napomena
      };
    });
    osvjeziTablicuStavki();
    ocistiStavkaEdit();
    azurirajSpremiStanje();
  }
  function noviDokument() {
    if (dokApi && typeof dokApi.clearSelection === 'function') { try { dokApi.clearSelection(); } catch (e) {} }
    popuniDokument(null, []);
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
          naslEl.value = ''; refreshSelect('edit_naslijedi_dok');
          azurirajSpremiStanje();
        } catch (e) {}
      });
    });
  })();

  /* ---- Spremi / Izbriši ---- */
  function azurirajSpremiStanje() {
    var ok = trim(val('edit_naziv')) !== '' && trim(val('edit_template_id')) !== '';
    /* Selekt Stranica (template): disabled bez izabranog dokumenta (nema naziva). */
    var imaDok = trim(val('edit_naziv')) !== '';
    var tpl = byId('edit_template_id');
    if (tpl && typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(tpl, imaDok);
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
        return { redoslijed: i + 1, zona: s.zona, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id, napomena: s.napomena };
      })
    };
    postJson(URL_SPREMI, payload, function (res) {
      if (res.indexOf('OK') === 0) {
        var noviId = 0; var c = res.indexOf(','); if (c >= 0) noviId = parseInt(res.slice(c + 1), 10) || 0;
        if (window.showPorukaModal) {
          window.showPorukaModal(tekuciId > 0 ? '004' : '001', [], function () {
            ucitajDokumente(function () { if (noviId && dokApi && typeof dokApi.setSelectedRowId === 'function') { try { dokApi.setSelectedRowId(noviId); } catch (e) {} naDokSelekcija(); } });
          });
        } else { ucitajDokumente(); }
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
      stavke: stavke.map(function (s) { return { redoslijed: 0, zona: s.zona, vrsta: s.vrsta, izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id, kontekst_kljuc: s.kontekst_kljuc, trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id }; })
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

  /* Akcije stavki u zaglavlju: vidljive samo dok je tab Dokument (panel 1) aktivan. */
  (function () {
    var grupa = byId('stavkeAkcijeHeader');
    var panel1 = byId('dokTabPanel1');
    if (!grupa || !panel1) return;
    function osvjezi() { grupa.hidden = panel1.hasAttribute('hidden'); }
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(osvjezi).observe(panel1, { attributes: true, attributeFilter: ['hidden'] });
    }
    osvjezi();
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
