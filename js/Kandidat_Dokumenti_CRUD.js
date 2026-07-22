/* =====================================================
   Kandidat_Dokumenti_CRUD.js
   Dokumentacija kandidata. Gornji red: slika člana (SAMO PRIKAZ) + tablica kandidata
   (Država/Regija/Loža + Traži). Ispod: tab „Životopis" (contenteditable) + CRUD.
   Tablica: članovi lože s kandidat=1. Životopis 1:1 po članu (upsert po id_clan).
   Uzor: Clanovi_Loza_CRUD (geo/tablica/slika), Esej_CRUD (contenteditable).
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';

  var API_BASE = '../php/';
  var data = [];                 /* svi članovi lože (filtrirani na kandidat=1) */
  var _zivotopisPostoji = false; /* ima li odabrani kandidat zapis u kandidat_dokumenti_zivotopis */
  var _zivotopisRowId = null;    /* id reda u kandidat_dokumenti_zivotopis (kontekst ID_Zivotopis); null kad nema zapisa */
  var _zivotopisProred = null;   /* kandidat_dokumenti_zivotopis.dokument_prored odabranog; null = nije postavljen */
  var _obrazac001Postoji = false; /* ima li odabrani kandidat zapis u kandidat_dokumenti_001 (Obrazac 001a) */
  var _obrazac001PdfSpreman = false; /* PDF ikona aktivna: zapis postoji + status_pristupa i datum_dokumenta upisani U BAZI */
  var _obrazac001RowId = null;    /* kandidat_dokumenti_001.id (PK) — kontekst ID_Obrazac001 za PDF; null kad nema zapisa */
  var _geoAutoLockedDrzava = false, _geoAutoLockedRegija = false, _geoAutoLockedLoza = false;
  var _pravaCrudUpis = 1, _pravaCrudBrisanje = 1;

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }
  function getApiUrl(path) {
    var p = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + p + '/php/' + path;
  }
  function parseResponseCode(text) {
    if (typeof text !== 'string' || text.trim() === '') return null;
    var parts = text.trim().split('|');
    return { code: parts[0], replacements: parts.slice(1) };
  }
  function poruka(code, repl, cb) {
    if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[code] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal(code, repl || [], cb);
    } else if (typeof cb === 'function') { cb(); }
  }

  /* --- Tablica (Prezime, Ime, St., Spol) — kao Clanovi_Loza_CRUD --- */
  var KandidatCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'prezime', title: 'Prezime', SQL_Naziv: 'prezime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'ime', title: 'Ime', SQL_Naziv: 'ime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'spol', title: 'Spol', SQL_Naziv: 'spol', sortable: 1, sortable_icon: 0, type: 't', width: 70, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 0 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  CommonCRUD.initTablica('tablicaContainer', KandidatCRUD, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  /* --- Pod-tablica: Razgovori kandidata (1:N) — Naslov, Datum, Ispitivač --- */
  var razgovoriApi = null;
  var razgovoriData = [];                 /* svi razgovori odabranog kandidata (puni zapisi) */
  var _ispitivaciData = [];               /* rezultat pretrage članova (aktivni, kandidat=0; max 50) */
  var _ispitivacForced = null;            /* {id, ime} — trenutno odabrani (edit), da ostane u selektu i van prvih 50 */
  var _razgovorEditId = 0;                /* id razgovora u modalu (0 = novi) */
  var RAZGOVORI_TABLICA = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'naslov', title: 'Naslov', SQL_Naziv: 'naslov', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'datum', title: 'Datum', SQL_Naziv: 'datum', sortable: 0, sortable_icon: 0, type: 't', width: 110, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'ispitivac', title: 'Razgovor vodio', SQL_Naziv: 'ispitivac', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 0 }
    ]
  };
  CommonCRUD.initTablica('razgovoriTablicaContainer', RAZGOVORI_TABLICA, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { razgovoriApi = api; },
    onSelectionChange: function () { azurirajRazgovorIkone(); }
  });

  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var editPanel = document.getElementById('edit_panel');
  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  var zivotopisEl = document.getElementById('kandidat_zivotopis');
  var btnPdf = document.getElementById('kandidat_btn_pdf');
  var zivotopisKartica = document.getElementById('kandidatKontrolaTabKart0');
  var razgovoriKartica = document.getElementById('kandidatKontrolaTabKart1');
  var obrazacKartica = document.getElementById('kandidatKontrolaTabKart2');
  var obrazac1bKartica = document.getElementById('kandidatKontrolaTabKart3');
  var skenoviKartica = document.getElementById('kandidatKontrolaTabKart4');
  var zapisniciKartica = document.getElementById('kandidatKontrolaTabKart5');
  var obrPdfBtn = document.getElementById('obr_pdf');
  var obr1bPdfBtn = document.getElementById('obr1b_pdf');   /* PDF ikona na tabu 001b — enable/disable u paru s 001a */
  var kandidatTabRoot = document.getElementById('kandidatKontrolaTab');
  if (btnIzbrisi) { btnIzbrisi.style.display = 'none'; btnIzbrisi.disabled = true; }

  /* --- Obrazac 001a: reference polja (RO prikaz + unos) --- */
  var OBR_RO_IDS = ['obr_ro_ime_prezime', 'obr_ro_spol', 'obr_ro_oib', 'obr_ro_datum_rodjenja',
    'obr_ro_ulica', 'obr_ro_ulica2', 'obr_ro_grad', 'obr_ro_posta', 'obr_ro_drzava', 'obr_ro_telefon'];
  /* Editabilna polja: id → tip ('t' tekst, 'c' checkbox, 's' select, 'd' datum). */
  var OBR_EDIT = [
    { id: 'obr_mjesto_rodjenja',   key: 'mjesto_rodjenja',   t: 't' },
    { id: 'obr_drzava_rodjenja',   key: 'drzava_rodjenja',   t: 't' },
    { id: 'obr_drzavljanstvo',     key: 'drzavljanstvo',     t: 't' },
    { id: 'obr_zvanje',            key: 'zvanje',            t: 't' },
    { id: 'obr_zanimanje',         key: 'zanimanje',         t: 't' },
    { id: 'obr_gradjanski_status', key: 'gradjanski_status', t: 't' },
    { id: 'obr_broj_djece',        key: 'broj_djece',        t: 't' },
    { id: 'obr_poznavanje_jezika', key: 'poznavanje_jezika', t: 't' },
    { id: 'obr_pocasni_naslovi',   key: 'pocasni_naslovi',   t: 't' },
    { id: 'obr_dijete_masona',     key: 'dijete_masona',     t: 'c' },
    { id: 'obr_veza_masoni',       key: 'veza_masoni',       t: 'c' },
    { id: 'obr_zahtjev_druga_loza',key: 'zahtjev_druga_loza',t: 'c' },
    { id: 'obr_status_pristupa', key: 'status_pristupa', t: 's' },
    { id: 'obr_datum_dokumenta',   key: 'datum_dokumenta',   t: 'd' }
  ];

  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  /* ===== Životopis: contenteditable get/set =====
     SPREMANJE: <br> (soft prijelom reda, npr. iz paste-a) → razmak (tekst se „slije" za reflow);
     blok <div>/<p> (Enter = novi odlomak) → \n. U bazi ostaju samo ODLOMCI, bez prijeloma redaka. */
  function zivotopisGetTekst() {
    var el = zivotopisEl;
    if (!el) return null;
    var clone = el.cloneNode(true);
    /* <br> → razmak */
    var brs = clone.querySelectorAll('br');
    for (var bi = 0; bi < brs.length; bi++) {
      var br = brs[bi];
      br.parentNode.insertBefore(document.createTextNode(' '), br);
      br.parentNode.removeChild(br);
    }
    /* Svaki blok (DIV/P) = odlomak; inline/text između blokova = vlastiti odlomak. */
    var paras = [];
    function dodaj(txt) {
      var s = String(txt == null ? '' : txt).replace(/\s+/g, ' ').trim();
      if (s) paras.push(s);
    }
    var buf = '';
    var kids = clone.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 1 && (n.tagName === 'DIV' || n.tagName === 'P')) {
        dodaj(buf); buf = '';          /* zatvori tekući inline odlomak */
        dodaj(n.textContent);          /* blok = svoj odlomak */
      } else {
        buf += (n.textContent || '');  /* inline/text se akumulira u tekući odlomak */
      }
    }
    dodaj(buf);
    return paras.join('\n') || null;
  }
  function zivotopisSetTekst(tekst) {
    var el = zivotopisEl;
    if (!el) return;
    el.innerHTML = '';
    if (!tekst) return;
    var paragraphs = String(tekst).split(/\n+/);
    for (var pi = 0; pi < paragraphs.length; pi++) {
      var pText = paragraphs[pi].trim();
      if (!pText) continue;
      var p = document.createElement('p');
      p.textContent = pText;
      el.appendChild(p);
    }
  }
  function zivotopisSetEnabled(on) {
    if (zivotopisEl) {
      zivotopisEl.contentEditable = on ? 'true' : 'false';
      zivotopisEl.setAttribute('aria-readonly', on ? 'false' : 'true');
    }
    if (zivotopisKartica) zivotopisKartica.disabled = !on;
    if (razgovoriKartica) razgovoriKartica.disabled = !on;
    if (obrazacKartica) obrazacKartica.disabled = !on;
    if (obrazac1bKartica) obrazac1bKartica.disabled = !on;
    if (skenoviKartica) skenoviKartica.disabled = !on;
    if (zapisniciKartica) zapisniciKartica.disabled = !on;
  }

  /* ===== Obrazac 001a: aktivni tab, enable, RO/edit popuna, load, save ===== */
  /* Indeks aktivnog taba (0 Životopis, 1 Razgovori, 2 Obrazac 001a). */
  function getAktivniTabIndex() {
    var akt = kandidatTabRoot ? kandidatTabRoot.querySelector('.kontrola-tab__kartica--aktivna') : null;
    var s = akt ? akt.getAttribute('data-tab-index') : null;
    var n = s != null ? parseInt(s, 10) : 0;
    return isNaN(n) ? 0 : n;
  }
  function jeObrazacTab() { return getAktivniTabIndex() === 2; }

  /* Omogući/onemogući editabilna polja obrasca (RO polja ostaju uvijek readonly). */
  function obrazacSetEnabled(on) {
    for (var i = 0; i < OBR_EDIT.length; i++) {
      var el = document.getElementById(OBR_EDIT[i].id);
      if (!el) continue;
      el.disabled = !on;
      if (OBR_EDIT[i].t === 's' && typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect(OBR_EDIT[i].id);
    }
  }
  /* Popuni RO polja (Osobni + Boravište) iz ro objekta. */
  function obrazacFillRo(ro) {
    ro = ro || {};
    function set(id, v) { var el = document.getElementById(id); if (el) el.value = (v != null ? String(v) : ''); }
    var imePrez = ((ro.prezime != null ? ro.prezime : '') + ' ' + (ro.ime != null ? ro.ime : '')).trim();
    set('obr_ro_ime_prezime', imePrez);
    set('obr_ro_spol', (ro.spol === 1 || ro.spol === '1') ? 'Ženski' : 'Muški');
    set('obr_ro_oib', ro.oib);
    set('obr_ro_datum_rodjenja', formatDatumHr(ro.datum_rodjenja));
    set('obr_ro_ulica', ro.ulica);
    set('obr_ro_ulica2', ro.ulica2);
    set('obr_ro_grad', ro.grad);
    set('obr_ro_posta', ro.posta);
    set('obr_ro_drzava', ro.drzava);
    set('obr_ro_telefon', ro.telefon);
  }
  /* Popuni editabilna polja iz zapisa (o = odgovor jedan.php; prazno kad zapis ne postoji). */
  function obrazacFillEdit(o) {
    o = o || {};
    for (var i = 0; i < OBR_EDIT.length; i++) {
      var f = OBR_EDIT[i], el = document.getElementById(f.id);
      if (!el) continue;
      var v = o[f.key];
      if (f.t === 'c') {
        el.checked = (v === 1 || v === '1' || v === true);
      } else if (f.t === 'd') {
        el.value = isoDatum(v);
      } else if (f.t === 's') {
        el.value = (v != null ? String(v) : '');
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect(f.id);
      } else {
        el.value = (v != null ? String(v) : '');
      }
    }
  }
  /* Očisti sva polja obrasca (RO + edit). */
  function obrazacClear() {
    for (var i = 0; i < OBR_RO_IDS.length; i++) { var r = document.getElementById(OBR_RO_IDS[i]); if (r) r.value = ''; }
    obrazacFillEdit({});
    _obrazac001Postoji = false;
    _obrazac001PdfSpreman = false;
    _obrazac001RowId = null;
  }
  /* Učitaj Obrazac 001a odabranog kandidata (RO + edit; postoji flag). */
  function ucitajObrazac(idClan, cb) {
    _obrazac001Postoji = false;
    obrazacClear();
    if (idClan == null || idClan === '' || typeof fetch !== 'function') { if (cb) cb(); return; }
    fetch(API_BASE + 'Kandidat_Dokumenti_001_CRUD_jedan.php?id_clan=' + encodeURIComponent(idClan))
      .then(function (r) { return r.text(); })
      .then(function (text) {
        text = (text || '').trim();
        if (String(getSelectedRowId()) !== String(idClan)) return;   /* selekcija se promijenila */
        if (text !== '' && text.charAt(0) === '{') {
          try {
            var o = JSON.parse(text);
            obrazacFillRo(o.ro);
            _obrazac001Postoji = !!o.postoji;
            _obrazac001RowId = (o.id != null && o.id !== '') ? o.id : null;   /* PK za kontekst PDF-a */
            /* PDF aktivan samo ako su status_pristupa I datum_dokumenta upisani u bazi. */
            _obrazac001PdfSpreman = !!o.postoji && trim(o.status_pristupa) !== '' && trim(o.datum_dokumenta) !== '';
            if (o.postoji) obrazacFillEdit(o);
          } catch (e) {}
        }
        if (cb) cb();
      }).catch(function () { if (cb) cb(); });
  }
  /* Sastavi payload iz editabilnih polja. */
  function obrazacGetPayload(idClan) {
    var p = { id_clan: String(idClan) };
    for (var i = 0; i < OBR_EDIT.length; i++) {
      var f = OBR_EDIT[i], el = document.getElementById(f.id);
      if (!el) continue;
      if (f.t === 'c') p[f.key] = el.checked ? 1 : 0;
      else p[f.key] = trim(el.value);
    }
    return p;
  }

  /* ===== Slika člana — SAMO PRIKAZ (Clanovi_CRUD_slika.php) ===== */
  function clearSlika() {
    var img = document.getElementById('kandidat_image_preview');
    if (!img) return;
    if (img._prevURL) { try { URL.revokeObjectURL(img._prevURL); } catch (e) {} img._prevURL = null; }
    img.removeAttribute('src');
    img.alt = '';
    img.style.display = 'none';
  }
  function updateSlikaPreview() {
    var img = document.getElementById('kandidat_image_preview');
    if (!img) return;
    var id = getSelectedRowId();
    clearSlika();
    if (id == null || id === '' || typeof fetch !== 'function') return;
    var url = API_BASE + 'Clanovi_CRUD_slika.php?id=' + encodeURIComponent(id) + '&t=' + (Date.now ? Date.now() : 0);
    fetch(url).then(function (r) {
      var ct = (r.headers.get('Content-Type') || '').trim();
      if (ct.indexOf('text/plain') !== -1 || !r.ok) return null;
      return r.blob().then(function (blob) { return blob && blob.size > 0 ? blob : null; });
    }).then(function (blob) {
      if (!blob || String(getSelectedRowId()) !== String(id)) return;
      img._prevURL = URL.createObjectURL(blob);
      img.src = img._prevURL;
      img.alt = 'Slika kandidata';
      img.style.display = '';
    }).catch(function () {});
  }

  /* ===== Logo lože u zaglavlju tablice (Loze_CRUD_slika.php) ===== */
  function updateTablicaHeaderLogo() {
    var img = document.getElementById('kandidat_loza_logo');
    var frame = img && img.closest ? img.closest('.clanovi-loza-crud__tablica-header-logo-frame') : null;
    if (!img || !frame) return;
    var idLoza = selectLoza ? trim(selectLoza.value) : '';
    var ph = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.onload = null; img.onerror = null;
    if (!idLoza) {
      img.hidden = true; img.src = ph;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      return;
    }
    frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    img.hidden = true;
    img.onload = function () {
      if (img.naturalWidth > 0) { img.hidden = false; frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno'); }
      else { img.hidden = true; frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno'); }
    };
    img.onerror = function () { img.hidden = true; img.src = ph; frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno'); };
    img.src = API_BASE + 'Loze_CRUD_slika.php?id=' + encodeURIComponent(idLoza) + '&t=' + String(Date.now());
  }

  /* ===== Zaglavlje prvog panela: logo lože (edit panel nema zaglavlje/labelu) ===== */
  function updateNaslovLozu() {
    updateTablicaHeaderLogo();
  }

  /* Vrati tab kontrolu na prvi tab (Životopis) — na promjenu geo grupe ili selekcije u tablici. */
  function resetTabNaPrvi() {
    if (typeof kontrolaTabPostaviAktivni === 'function') {
      var root = document.getElementById('kandidatKontrolaTab');
      if (root) kontrolaTabPostaviAktivni(root, 0);
    }
  }

  /* ===== Enable / CRUD stanje ===== */
  function updateEnabledState() {
    var imaLozu = selectLoza && trim(selectLoza.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;
    var tableWrap = document.getElementById('tablicaContainer');
    tableWrap = tableWrap && tableWrap.closest ? tableWrap.closest('.kontrola-tablica') : null;
    if (tableWrap) tableWrap.classList.toggle('kontrola-tablica--disabled', !imaLozu);

    zivotopisSetEnabled(imaSelekciju);
    obrazacSetEnabled(imaSelekciju);
    obrazac1bSetEnabled(imaSelekciju);
    skenoviSetEnabled(imaSelekciju);
    zapisniciSetEnabled(imaSelekciju);
    if (editPanel) editPanel.classList.toggle('kontrola-panel--edit-disabled', !imaSelekciju);
    /* Pod-tablica razgovora disabled kad je tab razgovori disabled (nema izabranog kandidata). */
    var razgTablica = document.getElementById('razgovoriTablicaContainer');
    if (razgTablica) razgTablica.classList.toggle('kontrola-tablica--disabled', !imaSelekciju);

    var traziWrap = document.getElementById('kandidat_dok_trazi');
    traziWrap = traziWrap && traziWrap.closest ? traziWrap.closest('.kontrola-edit-delete') : null;
    if (traziWrap && typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(traziWrap, imaLozu);

    if (selectLoza) selectLoza.disabled = _geoAutoLockedLoza || !(selectRegija && trim(selectRegija.value) !== '');
    if (typeof KontroleRefreshCustomSelect === 'function' && selectLoza) KontroleRefreshCustomSelect('select_loza');
    if (btnReloadTablica) btnReloadTablica.disabled = !imaLozu;
    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) btnPovratak.disabled = false;
    updateCrudState();
  }

  function updateCrudState() {
    var imaSelekciju = getSelectedRowId() != null;
    /* Upiši/Izmjeni je akcija za CIJELU formu → „Izmjeni" ako postoji ijedan zapis (životopis ili redak 001),
       „Upis" samo kad ničeg nema. NE ovisi o aktivnom tabu. */
    var naObrazac = jeObrazacTab();
    var naObrazac1b = getAktivniTabIndex() === 3;
    var naSkenovi = getAktivniTabIndex() === 4;
    var naZapisnici = getAktivniTabIndex() === 5;
    var postoji = _zivotopisPostoji || _obrazac001Postoji || _obrazac001bPostoji;
    /* Footer Upis/Izmjeni je akcija MASTER forme (Životopis + Obrazac 001a/001b). Tabovi
       Razgovori/Skenovi/Zapisnici imaju vlastiti upis (add/delete/…) pa footer na njima NIJE vidljiv. */
    var masterUpisTab = getAktivniTabIndex() === 0 || naObrazac || naObrazac1b;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.style.display = masterUpisTab ? '' : 'none';
      var izmjena = imaSelekciju && postoji;
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', izmjena);
      btnUpisiLabel.textContent = izmjena ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', izmjena ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSelekciju || (_pravaCrudUpis !== 1);
    }
    /* Footer brisanje (životopisa) SAMO na tabu Životopis (index 0). Ostali tabovi nemaju footer-brisanje.
       Tipka je VIDLJIVA kad je kandidat izabran i ima prava; ONEMOGUĆENA kad nema životopisa za obrisati. */
    var naDeleteTab = getAktivniTabIndex() === 0;
    var smijeBrisati = naDeleteTab && imaSelekciju && _zivotopisPostoji && _pravaCrudBrisanje === 1;
    if (btnIzbrisi) {
      var prikaziBrisi = naDeleteTab && imaSelekciju && _pravaCrudBrisanje === 1;
      btnIzbrisi.style.display = prikaziBrisi ? '' : 'none';
      btnIzbrisi.disabled = !smijeBrisati;
    }
    updatePdfState();
    obrazacUpdatePdfState();
  }

  /* PDF ikona: omogućena kad je životopis učitan (kontrola ima sadržaj), inače onemogućena. */
  function updatePdfState() {
    if (!btnPdf) return;
    var imaSelekciju = getSelectedRowId() != null;
    btnPdf.disabled = !(imaSelekciju && zivotopisGetTekst() != null);
  }

  /* PDF ikona Obrasca 001a: aktivna kad zapis POSTOJI u bazi i ima upisan status_pristupa I datum_dokumenta.
     PDF ikona 001b prati isti uvjet (enable/disable u paru s 001a). */
  function obrazacUpdatePdfState() {
    var imaSelekciju = getSelectedRowId() != null;
    var spreman = imaSelekciju && _obrazac001PdfSpreman;
    if (obrPdfBtn) obrPdfBtn.disabled = !spreman;
    if (obr1bPdfBtn) obr1bPdfBtn.disabled = !spreman;
  }

  /* ===== Učitavanje životopisa odabranog kandidata ===== */
  function ucitajZivotopis(idClan, cb) {
    _zivotopisPostoji = false;
    _zivotopisRowId = null;
    _zivotopisProred = null;
    zivotopisSetTekst('');
    if (idClan == null || typeof fetch !== 'function') { if (cb) cb(); return; }
    fetch(API_BASE + 'Kandidat_Dokumenti_CRUD_jedan.php?id_clan=' + encodeURIComponent(idClan))
      .then(function (r) { return r.text(); })
      .then(function (text) {
        text = (text || '').trim();
        if (String(getSelectedRowId()) !== String(idClan)) return;   /* selekcija se u međuvremenu promijenila */
        if (text !== '' && text.charAt(0) === '{') {
          try {
            var o = JSON.parse(text);
            _zivotopisPostoji = !!o.postoji;
            _zivotopisRowId = (o.id != null && o.id !== '') ? o.id : null;
            _zivotopisProred = (o.dokument_prored != null && o.dokument_prored !== '') ? o.dokument_prored : null;
            zivotopisSetTekst(o.zivotopis != null ? o.zivotopis : '');
          } catch (e) {}
        }
        if (cb) cb();
      }).catch(function () { if (cb) cb(); });
  }

  onCrudSelectionChange = function () {
    resetTabNaPrvi();
    updateSlikaPreview();
    var id = getSelectedRowId();
    ucitajZivotopis(id, function () { updateCrudState(); });
    ucitajRazgovori(id);
    ucitajObrazac(id, function () { updateCrudState(); });
    ucitajObr1b(id);   /* učitaj 001b (predlagači/glasanja/datumi/časni/VIP); interno očisti + preload mape */
    ucitajSkenovi(id);
    ucitajZapisnici(id);
    updateEnabledState();
  };

  /* ===== Tablica: punjenje (kandidat=1) + filter ===== */
  function podaciURedove(arr) {
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      rows.push({
        id: r.id != null ? r.id : '',
        0: r.prezime != null ? r.prezime : '',
        1: r.ime != null ? r.ime : '',
        2: (r.spol === 1 || r.spol === '1') ? 'Ženski' : 'Muški'
      });
    }
    return rows;
  }
  function primijeniTrazi(lista) {
    var el = document.getElementById('kandidat_dok_trazi');
    var q = el ? trim(el.value).toLowerCase() : '';
    if (!q) return lista.slice();
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      var hay = ((r.prezime || '') + ' ' + (r.ime || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(r);
    }
    return out;
  }
  function osvjeziPrikazTablice() {
    var rows = podaciURedove(primijeniTrazi(data));
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, KandidatCRUD.Tablica_Zaglavlje);
  }
  function ucitajKandidate(idLoza, cb) {
    data = [];
    if (!idLoza) {
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], KandidatCRUD.Tablica_Zaglavlje);
      if (cb) cb(); return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_CRUD_sve.php?id_loza=' + encodeURIComponent(idLoza), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      data = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            if (parseInt(arr[i].kandidat, 10) === 1) data.push(arr[i]);   /* samo kandidati */
          }
        } catch (e) {}
      }
      osvjeziPrikazTablice();
      if (cb) cb();
    };
    xhr.send();
  }
  function osvjeziTablicu(cb) {
    ucitajKandidate(selectLoza ? trim(selectLoza.value) : '', function () { updateCrudState(); if (cb) cb(); });
  }

  /* ===== GEO (Država/Regija/Loža) — uzor Clanovi_Loza_CRUD ===== */
  function popuniSelectIzKeša(sel, arr, placeholder, kontrolaId) {
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = placeholder; sel.appendChild(opt0);
    for (var i = 0; i < arr.length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? String(arr[i].id) : '';
      opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
      sel.appendChild(opt);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) KontroleRefreshCustomSelect(kontrolaId);
  }
  function ucitajPravaGeo(callback) {
    var url = typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
      ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Kandidat_Dokumenti_CRUD.html')
      : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') + '?html_fajl=' + encodeURIComponent('Kandidat_Dokumenti_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = g.drzave || [];
      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');
      _pravaCrudUpis = g.upis_izmjena != null ? parseInt(g.upis_izmjena, 10) : 0;
      _pravaCrudBrisanje = g.brisanje_sloga != null ? parseInt(g.brisanje_sloga, 10) : 0;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(_pravaCrudUpis, _pravaCrudBrisanje);
      if (drz.length === 1 && selectDrzava) {
        selectDrzava.value = String(drz[0].id); selectDrzava.disabled = true; _geoAutoLockedDrzava = true;
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        popuniRegijeIzKeša(selectDrzava.value, callback);
      } else {
        _geoAutoLockedDrzava = false;
        if (selectDrzava) selectDrzava.disabled = false;
        popuniRegijeIzKeša('', function () {});
        if (callback) callback();
      }
    });
  }
  function popuniRegijeIzKeša(idDrzava, callback) {
    _geoAutoLockedRegija = false;
    if (!selectRegija) { if (callback) callback(); return; }
    if (!idDrzava) {
      popuniSelectIzKeša(selectRegija, [], '— Odaberi regiju —', 'select_regija');
      selectRegija.disabled = true;
      popuniLozeIzKeša('', function () {});
      if (callback) callback(); return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var f = typeof window.vnlhGeoFiltrirajRegijePoDrzavi === 'function' ? window.vnlhGeoFiltrirajRegijePoDrzavi(g.regije, idDrzava) : [];
    popuniSelectIzKeša(selectRegija, f, '— Odaberi regiju —', 'select_regija');
    if (f.length === 1) {
      selectRegija.value = String(f[0].id); selectRegija.disabled = true; _geoAutoLockedRegija = true;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_regija');
      popuniLozeIzKeša(selectRegija.value, callback);
    } else {
      selectRegija.disabled = (f.length === 0);
      popuniLozeIzKeša('', function () {});
      if (callback) callback();
    }
  }
  function popuniLozeIzKeša(idRegija, callback) {
    _geoAutoLockedLoza = false;
    if (!selectLoza) { if (callback) callback(); return; }
    if (!idRegija) {
      popuniSelectIzKeša(selectLoza, [], '— Odaberi ložu —', 'select_loza');
      selectLoza.disabled = true; data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], KandidatCRUD.Tablica_Zaglavlje);
      if (callback) callback(); return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var f = typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function' ? window.vnlhGeoFiltrirajLozePoRegiji(g.loze, idRegija) : [];
    popuniSelectIzKeša(selectLoza, f, '— Odaberi ložu —', 'select_loza');
    if (f.length === 1) {
      selectLoza.value = String(f[0].id); selectLoza.disabled = true; _geoAutoLockedLoza = true;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
      osvjeziTablicu(function () { updateNaslovLozu(); updateEnabledState(); if (callback) callback(); });
    } else {
      selectLoza.disabled = (f.length === 0); data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], KandidatCRUD.Tablica_Zaglavlje);
      updateNaslovLozu();
      if (callback) callback();
    }
  }

  /* ===== Event wiring ===== */
  /* Životopis: pri svakoj izmjeni teksta osvježi stanje PDF ikone (učitan/prazan). */
  if (zivotopisEl) zivotopisEl.addEventListener('input', updatePdfState);

  if (selectDrzava) selectDrzava.addEventListener('change', function () {
    resetTabNaPrvi();
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika();
    popuniRegijeIzKeša(trim(this.value), function () { updateEnabledState(); });
  });
  if (selectRegija) selectRegija.addEventListener('change', function () {
    resetTabNaPrvi();
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika();
    popuniLozeIzKeša(trim(this.value), function () { updateEnabledState(); });
  });
  if (selectLoza) selectLoza.addEventListener('change', function () {
    resetTabNaPrvi();
    var tz = document.getElementById('kandidat_dok_trazi'); if (tz) tz.value = '';
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika();
    updateNaslovLozu();
    osvjeziTablicu();
    updateEnabledState();
  });
  if (btnReloadTablica) btnReloadTablica.addEventListener('click', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    osvjeziTablicu();
  });
  (function () {
    var inp = document.getElementById('kandidat_dok_trazi');
    if (!inp) return;
    var deb = null;
    inp.addEventListener('input', function () {
      if (deb) clearTimeout(deb);
      deb = setTimeout(function () {
        deb = null;
        osvjeziPrikazTablice();
        var sid = getSelectedRowId();
        if (sid != null && tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function') tablicaApi.setSelectedRowIds([String(sid)]);
      }, 200);
    });
    var wrap = inp.closest('.kontrola-edit-delete');
    if (wrap) wrap.addEventListener('kontrole-edit-delete-clear', function () { osvjeziPrikazTablice(); });
  })();

  /* Nakon uspješnog upisa/izmjene/brisanja: očisti edit tab i ukloni selekciju iz tablice. */
  function ocistiNakonCrud() {
    if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
    clearSlika();
    _zivotopisPostoji = false;
    zivotopisSetTekst('');
    zivotopisSetEnabled(false);
    obrazacClear();
    obr1bClear();
    updateEnabledState();
  }

  /* Upis / Izmjeni — jedna akcija za CIJELU formu (sve 1:1 tablice): životopis + 001a + 001b.
     Razgovori (1:N) imaju vlastito spremanje (modal), pa nisu dio ovoga. Sekvencijalno da 001a/001b
     (dijele redak) ne ulete u utrku; na potpuni uspjeh: očisti + jedna poruka (Upis/Izmjeni). */
  function _postForma(url, payload) {
    return fetch(API_BASE + url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) { return r.text(); }).then(function (res) {
      res = (res || '').trim();
      if (res === 'OK') return true;
      throw (res || '200');   /* odbij s kodom greške */
    });
  }
  function spremiSve() {
    var id = getSelectedRowId();
    if (id == null) return;
    /* „Izmjeni" ako postoji ijedan zapis forme (životopis ili redak 001); inače „Upis". */
    var jeIzmjena = _zivotopisPostoji || _obrazac001Postoji || _obrazac001bPostoji;
    _postForma('Kandidat_Dokumenti_CRUD_spremi.php', { id_clan: String(id), zivotopis: zivotopisGetTekst() })
      .then(function () { return _postForma('Kandidat_Dokumenti_001_CRUD_spremi.php', obrazacGetPayload(id)); })
      .then(function () { return _postForma('Kandidat_Dokumenti_001b_CRUD_spremi.php', obr1bGetPayload(id)); })
      .then(function () { ocistiNakonCrud(); poruka(jeIzmjena ? '004' : '001', []); })
      .catch(function (err) {
        var p = parseResponseCode(typeof err === 'string' ? err : '200');
        poruka(p ? p.code : '200', p ? p.replacements : []);
      });
  }
  if (btnUpisi) btnUpisi.addEventListener('click', spremiSve);

  /* Izbriši (briše zapis životopisa, ne člana) — uz potvrdu (124). */
  if (btnIzbrisi) btnIzbrisi.addEventListener('click', function () {
    var id = getSelectedRowId();
    if (id == null) return;
    function izvrsiBrisanje() {
      fetch(API_BASE + 'Kandidat_Dokumenti_CRUD_brisanje.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_clan: String(id) })
      }).then(function (r) { return r.text(); }).then(function (res) {
        res = (res || '').trim();
        if (res === 'OK') {
          ocistiNakonCrud();
          poruka('003', []);
        } else {
          var p = parseResponseCode(res);
          poruka(p ? p.code : '200', p ? p.replacements : []);
        }
      }).catch(function () { poruka('200', []); });
    }
    if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['124'] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal('124', [], function (buttonKey) { if (buttonKey === 'OK') izvrsiBrisanje(); });
    } else {
      izvrsiBrisanje();
    }
  });

  /* Povratak */
  var btnPovratak = document.getElementById('btnPovratak');
  if (btnPovratak) btnPovratak.addEventListener('click', function () {
    var params = new URLSearchParams(window.location.search);
    var ref = (params.get('ref') || '').trim();
    if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
    if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e) {} }
    window.location.href = new URL('Meni.php', window.location.href).href;
  });

  /* ===== Sizing slike: visina = visina panela tablice, širina = visina/1,2 (Š:V = 1:1,2) =====
     Uz zaključavanje max-visine kad slika dosegne ~60% širine reda (uzor Clanovi_Loza_CRUD:
     getPanelTablicaMaxHeight + sync60_40MaxHeight) — inače gornji paneli prerastu edit panel. */
  var SLIKA_OMJER_VISINA = 1.2;   /* visina = širina × 1,2 */
  var TOP_ROW_GAP = 16;           /* .clanovi-crud__top-row gap: 1rem */
  var _slikaSizeRaf = null;

  function getPanelTablicaMinHeight() {
    var panel = document.querySelector('.clanovi-crud__panel-tablica');
    if (!panel || typeof getComputedStyle !== 'function') return 400;
    var minH = parseFloat(getComputedStyle(panel).minHeight);
    return (isNaN(minH) || minH <= 0) ? 400 : Math.round(minH);
  }
  /* Max visina tablice: širenje stane kad slika (širina = H/1,2) dosegne 60% širine reda. */
  function getPanelTablicaMaxHeight() {
    var topRow = document.querySelector('.clanovi-crud__top-row');
    if (!topRow) return 9999;
    var rowW = topRow.offsetWidth || 0;
    if (rowW <= 0) return 9999;
    var slikaMaxW = (rowW - TOP_ROW_GAP) * 0.6;
    var maxH = Math.floor(slikaMaxW * SLIKA_OMJER_VISINA);
    var viewportCap = (typeof window !== 'undefined' && window.innerHeight) ? Math.floor(window.innerHeight * 0.9) : 800;
    return Math.min(maxH, viewportCap);
  }
  /* Na granici (slika ≥ ~60% širine reda) zaključaj max-height oba panela → resize ne može preko. */
  function sync60_40MaxHeight() {
    var topRow = document.querySelector('.clanovi-crud__top-row');
    var panelSlika = document.querySelector('.clanovi-crud__panel-slika');
    var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
    if (!topRow || !panelSlika || !panelTablica) return;
    var rowW = topRow.offsetWidth;
    if (rowW <= 0) return;
    if (panelSlika.offsetWidth >= rowW * 0.59) {
      panelSlika.style.maxHeight = panelSlika.offsetHeight + 'px';
      panelTablica.style.maxHeight = panelTablica.offsetHeight + 'px';
    } else {
      panelSlika.style.maxHeight = '';
      panelTablica.style.maxHeight = '';
    }
  }
  function setPanelSlikaSize() {
    var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
    var panelSlika = document.querySelector('.clanovi-crud__panel-slika');
    var topRow = document.querySelector('.clanovi-crud__top-row');
    if (!panelTablica || !panelSlika || !topRow) return;
    var minH = getPanelTablicaMinHeight();
    var maxH = getPanelTablicaMaxHeight();
    var H = panelTablica.offsetHeight || minH;
    H = Math.min(Math.max(H, minH), maxH);
    if (panelTablica.offsetHeight > maxH) panelTablica.style.height = maxH + 'px';
    H = Math.min(H, maxH);
    if (H <= 0) return;
    var slikaW = Math.floor(H / SLIKA_OMJER_VISINA);
    panelSlika.style.width = slikaW + 'px';
    panelSlika.style.height = H + 'px';
    panelSlika.style.minHeight = H + 'px';
    panelSlika.style.aspectRatio = '1/1.2';
    sync60_40MaxHeight();
  }
  function zakaziSlikaSize() {
    if (_slikaSizeRaf) cancelAnimationFrame(_slikaSizeRaf);
    _slikaSizeRaf = requestAnimationFrame(function () { _slikaSizeRaf = null; setPanelSlikaSize(); });
  }

  /* ===== Logo lože: 1:1 kvadrat koji ispuni visinu zaglavlja (uzor Clanovi_Loza_CRUD) ===== */
  var _logoSizeRaf = null;
  function syncTablicaHeaderLogoSize() {
    if (_logoSizeRaf) cancelAnimationFrame(_logoSizeRaf);
    _logoSizeRaf = requestAnimationFrame(function () {
      _logoSizeRaf = null;
      var header = document.querySelector('.clanovi-loza-crud__tablica-header');
      var kontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      var wrap = document.querySelector('.clanovi-loza-crud__tablica-header-logo-wrap');
      if (!header || !kontrole || !wrap) return;
      if (getComputedStyle(wrap).display === 'none') { header.style.removeProperty('--clanovi-loza-logo-side'); return; }
      var h = kontrole.getBoundingClientRect().height;
      if (!(h > 0) || !isFinite(h)) return;
      var csH = getComputedStyle(header);
      var pt = parseFloat(csH.paddingTop) || 0;
      var pb = parseFloat(csH.paddingBottom) || 0;
      var side = Math.floor(pt + h + pb - 2);
      if (side < 1) return;
      var hw = header.getBoundingClientRect().width;
      if (hw > 0 && isFinite(hw)) {
        var maxByHeader = Math.floor(hw * 0.52);
        if (maxByHeader > 0) side = Math.min(side, maxByHeader);
      }
      header.style.setProperty('--clanovi-loza-logo-side', side + 'px');
    });
  }

  /* ===== Init ===== */
  /* ============================================================
   * ▒▒ RAZGOVORI KANDIDATA (tab „Razgovori", 1:N) — pod-tablica + modal CRUD ▒▒
   * ============================================================ */
  var razgovorModal        = document.getElementById('razgovorModal');
  var razgovorModalNaslov  = document.getElementById('razgovorModalNaslov');
  var razgovorNaslovInp    = document.getElementById('razgovor_naslov');
  var razgovorDatumInp     = document.getElementById('razgovor_datum');
  var razgovorIspitivacSel = document.getElementById('razgovor_ispitivac');
  var razgovorIspitivacTraziInp = document.getElementById('razgovor_ispitivac_trazi');
  var razgovorTekstEl      = document.getElementById('razgovor_tekst');
  var btnRazgovorUpisi     = document.getElementById('razgovorUpisi');
  var btnRazgovorUpisiLabel = btnRazgovorUpisi ? btnRazgovorUpisi.querySelector('.kontrola-btn__label') : null;
  var btnRazgovorIzbrisi   = document.getElementById('razgovorIzbrisi');
  var btnRazgovorPovratak  = document.getElementById('razgovorPovratak');
  var btnRazgovorDodaj     = document.getElementById('razgovorDodaj');
  var btnRazgovorUredi     = document.getElementById('razgovorUredi');
  var btnRazgovorObrisi    = document.getElementById('razgovorObrisi');   /* smeće — briše red bez modala */
  var btnRazgovorDeselekt  = document.getElementById('razgovorDeselekt'); /* zvijezdica — makni selekciju */
  var btnRazgovorPdf       = document.getElementById('razgovorPdf');      /* PDF desno od tablice (dokument kasnije) */
  var razgovorDialog       = razgovorModal ? razgovorModal.querySelector('.kandidat-dokumenti-crud__modal-razgovor-dialog') : null;
  var RAZG_MODAL_KEY = 'kandidat-razgovor-modal';   /* localStorage: pozicija + veličina modala */

  function getRazgModalStanje() {
    try { var s = localStorage.getItem(RAZG_MODAL_KEY); if (s) { var o = JSON.parse(s); if (o && typeof o.width === 'number' && typeof o.height === 'number') return o; } } catch (e) {}
    return null;
  }
  function saveRazgModalStanje(left, top, width, height) {
    try { localStorage.setItem(RAZG_MODAL_KEY, JSON.stringify({ left: left, top: top, width: width, height: height })); } catch (e) {}
  }
  /* Na otvaranju: primijeni zapamćeno stanje ili centriraj (CSS default veličina). */
  function primijeniRazgModalStanje() {
    if (!razgovorDialog) return;
    var st = getRazgModalStanje();
    if (st) {
      razgovorDialog.style.left = st.left + 'px';
      razgovorDialog.style.top = st.top + 'px';
      razgovorDialog.style.transform = 'none';
      razgovorDialog.style.width = st.width + 'px';
      razgovorDialog.style.height = st.height + 'px';
    } else {
      razgovorDialog.style.left = '50%';
      razgovorDialog.style.top = '50%';
      razgovorDialog.style.transform = 'translate(-50%, -50%)';
      razgovorDialog.style.width = '';
      razgovorDialog.style.height = '';
    }
  }
  /* Na zatvaranju: zapamti stvarnu poziciju (px) i veličinu. */
  function spremiRazgModalGeom() {
    if (!razgovorDialog) return;
    var r = razgovorDialog.getBoundingClientRect();
    saveRazgModalStanje(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
  }

  function formatDatumHr(iso) {
    if (!iso) return '';
    var p = String(iso).split(/[-/T ]/);
    if (p.length < 3) return String(iso);
    return p[2].slice(0, 2) + '.' + p[1] + '.' + p[0];
  }
  function isoDatum(iso) { if (!iso) return ''; var p = String(iso).split(/[T ]/); return p[0] || ''; }
  /* Labela za „Razgovor vodio": ista loža kao odabrana u geo grupi → samo Prezime Ime;
     druga loža → dopiši „ (Naziv lože, Grad)". c = {prezime, ime, id_loza, loza_naziv, loza_grad}. */
  function ispitivacLabel(c) {
    var ime = ((c && c.prezime != null ? c.prezime : '') + ' ' + (c && c.ime != null ? c.ime : '')).trim();
    var selLoza = selectLoza ? trim(selectLoza.value) : '';
    if (c && c.id_loza != null && c.id_loza !== '' && selLoza !== '' && String(c.id_loza) === String(selLoza)) return ime;
    var dodatak = [c && c.loza_naziv, c && c.loza_grad].filter(Boolean).join(', ');
    return dodatak ? (ime + ' (' + dodatak + ')') : ime;
  }
  function getRazgovorSelId() { return CommonCRUD.getSelectedRowId(razgovoriApi); }
  function razgovorPoId(id) {
    for (var i = 0; i < razgovoriData.length; i++) { if (String(razgovoriData[i].id) === String(id)) return razgovoriData[i]; }
    return null;
  }

  function azurirajRazgovorIkone() {
    var imaKandidat = getSelectedRowId() != null;
    var imaRazgovor = getRazgovorSelId() != null;
    if (btnRazgovorDodaj) btnRazgovorDodaj.disabled = !imaKandidat || (_pravaCrudUpis !== 1);
    if (btnRazgovorUredi) btnRazgovorUredi.disabled = !imaRazgovor;
    if (btnRazgovorObrisi) btnRazgovorObrisi.disabled = !imaRazgovor || (_pravaCrudBrisanje !== 1);
    if (btnRazgovorDeselekt) btnRazgovorDeselekt.disabled = !imaRazgovor;
    if (btnRazgovorPdf) btnRazgovorPdf.disabled = !imaRazgovor;
  }

  /* contenteditable get/set za tekst razgovora — isti obrazac kao životopis (br→razmak, blok→odlomak). */
  function razgovorTekstGet() {
    var el = razgovorTekstEl; if (!el) return null;
    var clone = el.cloneNode(true);
    var brs = clone.querySelectorAll('br');
    for (var bi = 0; bi < brs.length; bi++) { var br = brs[bi]; br.parentNode.insertBefore(document.createTextNode(' '), br); br.parentNode.removeChild(br); }
    var paras = [];
    function dodaj(txt) { var s = String(txt == null ? '' : txt).replace(/\s+/g, ' ').trim(); if (s) paras.push(s); }
    var buf = '', kids = clone.childNodes;
    for (var i = 0; i < kids.length; i++) { var n = kids[i]; if (n.nodeType === 1 && (n.tagName === 'DIV' || n.tagName === 'P')) { dodaj(buf); buf = ''; dodaj(n.textContent); } else { buf += (n.textContent || ''); } }
    dodaj(buf);
    return paras.join('\n') || null;
  }
  function razgovorTekstSet(tekst) {
    var el = razgovorTekstEl; if (!el) return;
    el.innerHTML = '';
    if (!tekst) return;
    var ps = String(tekst).split(/\n+/);
    for (var pi = 0; pi < ps.length; pi++) { var t = ps[pi].trim(); if (!t) continue; var p = document.createElement('p'); p.textContent = t; el.appendChild(p); }
  }

  /* Učitavanje razgovora odabranog kandidata (1:N). */
  function ucitajRazgovori(idClan) {
    razgovoriData = [];
    if (idClan == null || idClan === '' || typeof fetch !== 'function') { renderRazgovoriTablica(); return; }
    fetch(API_BASE + 'Kandidat_Dokumenti_Razgovori_CRUD_sve.php?id_clan=' + encodeURIComponent(idClan))
      .then(function (r) { return r.text(); })
      .then(function (text) {
        text = (text || '').trim();
        if (String(getSelectedRowId()) !== String(idClan)) return;   /* selekcija se promijenila */
        if (text !== '' && text.charAt(0) === '[') { try { razgovoriData = JSON.parse(text); } catch (e) { razgovoriData = []; } }
        renderRazgovoriTablica();
      }).catch(function () { renderRazgovoriTablica(); });
  }
  function renderRazgovoriTablica() {
    var rows = [];
    for (var i = 0; i < razgovoriData.length; i++) {
      var r = razgovoriData[i];
      rows.push({ id: r.id, 0: r.naslov || '', 1: formatDatumHr(r.datum_razgovora), 2: ispitivacLabel({
        prezime: r.ispitivac_prezime, ime: r.ispitivac_ime,
        id_loza: r.ispitivac_loza_id, loza_naziv: r.ispitivac_loza_naziv, loza_grad: r.ispitivac_loza_grad
      }) });
    }
    if (razgovoriApi) CommonCRUD.setDataTablica(razgovoriApi, 'razgovoriTablicaContainer', rows, RAZGOVORI_TABLICA.Tablica_Zaglavlje);
    azurirajRazgovorIkone();
  }

  /* „Razgovor vodio": svi članovi aktivnost=1 & kandidat=0, prvih 50; q = server-side pretraga. */
  function fetchIspitivaci(q, cb) {
    if (typeof fetch !== 'function') { if (cb) cb(); return; }
    var idDrz = (selectDrzava && trim(selectDrzava.value) !== '') ? selectDrzava.value : '-1';   /* država iz geogrupe (-1 = sve) */
    var par = [];
    if (q) par.push('q=' + encodeURIComponent(q));
    par.push('id_drzava=' + encodeURIComponent(idDrz));
    var url = API_BASE + 'Kandidat_Dokumenti_Razgovori_CRUD_ispitivaci.php?' + par.join('&');
    fetch(url).then(function (r) { return r.text(); }).then(function (text) {
      text = (text || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') { try { arr = JSON.parse(text); } catch (e) { arr = []; } }
      _ispitivaciData = arr;
      popuniIspitivacSelect();
      if (cb) cb();
    }).catch(function () { if (cb) cb(); });
  }
  function popuniIspitivacSelect() {
    var sel = razgovorIspitivacSel; if (!sel) return;
    var prev = sel.value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = '— Odaberi —'; sel.appendChild(o0);
    var forcedPresent = false;
    for (var i = 0; i < _ispitivaciData.length; i++) {
      var c = _ispitivaciData[i];
      var o = document.createElement('option');
      o.value = c.id != null ? String(c.id) : '';
      o.textContent = ispitivacLabel(c);
      sel.appendChild(o);
      if (_ispitivacForced && String(_ispitivacForced.id) === o.value) forcedPresent = true;
    }
    /* Trenutno odabrani (edit) mora ostati u listi i kad nije među prvih 50 / rezultatima pretrage. */
    if (_ispitivacForced && _ispitivacForced.id && !forcedPresent) {
      var of = document.createElement('option');
      of.value = String(_ispitivacForced.id);
      of.textContent = ispitivacLabel(_ispitivacForced) || ('#' + _ispitivacForced.id);
      sel.insertBefore(of, o0.nextSibling);
    }
    sel.value = prev;
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('razgovor_ispitivac');
  }

  /* Modal: open (editRow ili null=novi) / close. */
  function otvoriRazgovorModal(editRow) {
    if (getSelectedRowId() == null) return;
    if (razgovorIspitivacTraziInp) razgovorIspitivacTraziInp.value = '';
    var ispitivacVal = '';
    if (editRow) {
      _razgovorEditId = parseInt(editRow.id, 10) || 0;
      _ispitivacForced = (editRow.id_ispitivac != null && editRow.id_ispitivac !== '') ? {
        id: String(editRow.id_ispitivac),
        prezime: editRow.ispitivac_prezime,
        ime: editRow.ispitivac_ime,
        id_loza: editRow.ispitivac_loza_id,
        loza_naziv: editRow.ispitivac_loza_naziv,
        loza_grad: editRow.ispitivac_loza_grad
      } : null;
      ispitivacVal = _ispitivacForced ? _ispitivacForced.id : '';
      if (razgovorNaslovInp) razgovorNaslovInp.value = editRow.naslov != null ? editRow.naslov : '';
      if (razgovorDatumInp) razgovorDatumInp.value = isoDatum(editRow.datum_razgovora);
      razgovorTekstSet(editRow.tekst != null ? editRow.tekst : '');
    } else {
      _razgovorEditId = 0;
      _ispitivacForced = null;
      if (razgovorNaslovInp) razgovorNaslovInp.value = '';
      if (razgovorDatumInp) razgovorDatumInp.value = '';
      razgovorTekstSet('');
    }
    /* Puni „Razgovor vodio" (prvih 50) pa postavi odabranog (edit) preko callbacka. */
    fetchIspitivaci('', function () {
      if (razgovorIspitivacSel) {
        razgovorIspitivacSel.value = ispitivacVal;
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('razgovor_ispitivac');
      }
    });
    var izmjena = _razgovorEditId > 0;
    if (btnRazgovorUpisiLabel) btnRazgovorUpisiLabel.textContent = izmjena ? 'Izmijeni' : 'Upiši';
    if (btnRazgovorUpisi) btnRazgovorUpisi.classList.toggle('kontrola-btn--crud-izmjeni', izmjena);
    if (btnRazgovorIzbrisi) btnRazgovorIzbrisi.style.display = (izmjena && _pravaCrudBrisanje === 1) ? '' : 'none';
    if (razgovorModalNaslov) razgovorModalNaslov.textContent = izmjena ? 'Izmjena razgovora' : 'Novi razgovor';
    primijeniRazgModalStanje();
    if (razgovorModal) { razgovorModal.classList.add('kandidat-dokumenti-crud__modal-razgovor--open'); razgovorModal.setAttribute('aria-hidden', 'false'); }
    if (razgovorNaslovInp) razgovorNaslovInp.focus();
  }
  function zatvoriRazgovorModal() {
    if (!razgovorModal) return;
    if (razgovorModal.classList.contains('kandidat-dokumenti-crud__modal-razgovor--open')) spremiRazgModalGeom();
    razgovorModal.classList.remove('kandidat-dokumenti-crud__modal-razgovor--open');
    razgovorModal.setAttribute('aria-hidden', 'true');
  }

  function spremiRazgovor() {
    var idClan = getSelectedRowId();
    if (idClan == null) return;
    var naslov = razgovorNaslovInp ? trim(razgovorNaslovInp.value) : '';
    var datum = razgovorDatumInp ? trim(razgovorDatumInp.value) : '';
    var idIsp = razgovorIspitivacSel ? trim(razgovorIspitivacSel.value) : '';
    if (naslov === '' || datum === '' || idIsp === '') { poruka('130', []); return; }
    var jeIzmjena = _razgovorEditId > 0;
    var payload = { id: _razgovorEditId, id_clan: String(idClan), id_ispitivac: idIsp, datum_razgovora: datum, naslov: naslov, tekst: razgovorTekstGet() };
    fetch(API_BASE + 'Kandidat_Dokumenti_Razgovori_CRUD_spremi.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) { return r.text(); }).then(function (res) {
      res = (res || '').trim();
      if (res.indexOf('OK') === 0) {
        zatvoriRazgovorModal();
        ucitajRazgovori(idClan);
        poruka(jeIzmjena ? '004' : '001', []);
      } else {
        var p = parseResponseCode(res); poruka(p ? p.code : '200', p ? p.replacements : []);
      }
    }).catch(function () { poruka('200', []); });
  }

  /* Zajednički fetch brisanja razgovora; zatvara modal (ako je otvoren) i osvježava listu. */
  function _obrisiRazgovorFetch(brisiId, idClan) {
    fetch(API_BASE + 'Kandidat_Dokumenti_Razgovori_CRUD_brisanje.php', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: brisiId, id_clan: String(idClan) })
    }).then(function (r) { return r.text(); }).then(function (res) {
      res = (res || '').trim();
      if (res.indexOf('OK') === 0) { zatvoriRazgovorModal(); ucitajRazgovori(idClan); poruka('003', []); }
      else { var p = parseResponseCode(res); poruka(p ? p.code : '200', p ? p.replacements : []); }
    }).catch(function () { poruka('200', []); });
  }
  function _potvrdiPaObrisi(brisiId, idClan) {
    if (idClan == null || !brisiId) return;
    if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['129'] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal('129', [], function (buttonKey) { if (buttonKey === 'OK') _obrisiRazgovorFetch(brisiId, idClan); });
    } else { _obrisiRazgovorFetch(brisiId, idClan); }
  }
  /* Izbriši iz modala (uređivani zapis). */
  function obrisiRazgovor() { _potvrdiPaObrisi(_razgovorEditId, getSelectedRowId()); }
  /* Smeće u traci: briše odabrani red tablice BEZ otvaranja modala. */
  function obrisiRazgovorTablica() { _potvrdiPaObrisi(parseInt(getRazgovorSelId(), 10) || 0, getSelectedRowId()); }
  /* Zvijezdica: makni selekciju s pod-tablice. */
  function deselektRazgovor() {
    if (razgovoriApi && typeof razgovoriApi.clearSelection === 'function') razgovoriApi.clearSelection();
    azurirajRazgovorIkone();
  }

  if (btnRazgovorDodaj) btnRazgovorDodaj.addEventListener('click', function () { otvoriRazgovorModal(null); });
  if (btnRazgovorUredi) btnRazgovorUredi.addEventListener('click', function () { var rec = razgovorPoId(getRazgovorSelId()); if (rec) otvoriRazgovorModal(rec); });
  if (btnRazgovorObrisi) btnRazgovorObrisi.addEventListener('click', obrisiRazgovorTablica);
  if (btnRazgovorDeselekt) btnRazgovorDeselekt.addEventListener('click', deselektRazgovor);
  (function () {
    var cont = document.getElementById('razgovoriTablicaContainer');
    if (cont) cont.addEventListener('dblclick', function () { var rec = razgovorPoId(getRazgovorSelId()); if (rec) otvoriRazgovorModal(rec); });
  }());
  if (btnRazgovorUpisi) btnRazgovorUpisi.addEventListener('click', spremiRazgovor);
  if (btnRazgovorIzbrisi) btnRazgovorIzbrisi.addEventListener('click', obrisiRazgovor);
  if (btnRazgovorPovratak) btnRazgovorPovratak.addEventListener('click', zatvoriRazgovorModal);
  /* Pretraga „Razgovor vodio": server-side filter (debounce), prvih 50 rezultata. */
  if (razgovorIspitivacTraziInp) {
    var _ispTraziT = null;
    razgovorIspitivacTraziInp.addEventListener('input', function () {
      var q = trim(this.value);
      if (_ispTraziT) clearTimeout(_ispTraziT);
      _ispTraziT = setTimeout(function () { fetchIspitivaci(q); }, 250);
    });
    var ispTraziClear = razgovorIspitivacTraziInp.parentNode ? razgovorIspitivacTraziInp.parentNode.querySelector('.kontrola-edit-delete__clear') : null;
    if (ispTraziClear) ispTraziClear.addEventListener('click', function () {
      razgovorIspitivacTraziInp.value = '';
      fetchIspitivaci('');
      razgovorIspitivacTraziInp.focus();
    });
  }
  if (razgovorModal) {
    /* Izlaz iz modala SAMO preko CRUD tipki (Upiši/Izmijeni, Izbriši, Povratak) — bez overlay-klika i Esc. */
    /* Fiksiraj dialog na trenutne px koordinate (iz centriranog stanja) prije drag/resize-a. */
    function razgFiksirajPoziciju() {
      if (!razgovorDialog) return;
      var r = razgovorDialog.getBoundingClientRect();
      razgovorDialog.style.left = Math.round(r.left) + 'px';
      razgovorDialog.style.top = Math.round(r.top) + 'px';
      razgovorDialog.style.transform = 'none';
      return r;
    }
    /* Premještanje: klik-i-povuci po zaglavlju modala. */
    var razgovorHeader = razgovorModal.querySelector('.kandidat-dokumenti-crud__modal-razgovor-header');
    if (razgovorHeader && razgovorDialog) {
      razgovorHeader.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var r = razgFiksirajPoziciju();
        var l0 = r.left, t0 = r.top, x0 = e.clientX, y0 = e.clientY;
        function move(ev) {
          razgovorDialog.style.left = Math.max(0, l0 + ev.clientX - x0) + 'px';
          razgovorDialog.style.top = Math.max(0, t0 + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        e.preventDefault();
      });
    }
    /* Promjena veličine povlačenjem ručke u donjem desnom kutu (raste od gornjeg lijevog kuta). */
    var razgovorResizeKut = document.getElementById('razgovorResizeKut');
    if (razgovorResizeKut && razgovorDialog) {
      razgovorResizeKut.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var r = razgFiksirajPoziciju();
        var w0 = r.width, h0 = r.height, x0 = e.clientX, y0 = e.clientY;
        function move(ev) {
          razgovorDialog.style.width = Math.max(360, w0 + ev.clientX - x0) + 'px';
          razgovorDialog.style.height = Math.max(300, h0 + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        e.preventDefault();
        e.stopPropagation();
      });
    }
  }

  /* ============================================================
   * ▒▒ OBRAZAC 001b (tab „Obrazac 001b") — predlagači + datumi ▒▒
   * Podaci su zasad SAMO klijentski (tablica u bazi + spremanje: kasnije).
   * Pamti se samo id člana (skriven u retku); prikaz (prezime/ime, loža, grad,
   * naziv stupnja) je živi — dolazi iz endpointa pri pretrazi/dodavanju.
   * ============================================================ */
  var btnObr1bDodaj         = document.getElementById('obr1bDodaj');   /* ＋ → modal „Odaberi" (dodaje člana u tablicu) */
  var btnObr1bObrisi        = document.getElementById('obr1bObrisi');  /* smeće → briše selektirani red */
  var obr1bDatumRazmatranja = document.getElementById('obr1b_datum_razmatranja');
  var obr1bDatumOdbijanja   = document.getElementById('obr1b_datum_odbijanja');
  var obr1bRazlog           = document.getElementById('obr1b_razlog_odbijanja');   /* Razlog odbijanja (textarea) — enable samo uz valjan datum odbijanja */
  var obr1bRazlogLabel      = document.querySelector('label[for="obr1b_razlog_odbijanja"]');   /* labela prati disabled stanje textarea */
  var _obr1bEnabled         = false;   /* je li tab 001b trenutno omogućen (za uvjet razloga) */
  /* Matrica glasanja: 3 stupca (1./2./3. glasanje) × 5 polja (datum, glasača, za, protiv, suzdržani). */
  var OBR1B_GLAS_IDS = (function () {
    var out = [], polja = ['datum', 'glasaca', 'za', 'protiv', 'suzdrzani'];
    for (var g = 1; g <= 3; g++) { for (var p = 0; p < polja.length; p++) out.push('obr1b_g' + g + '_' + polja[p]); }
    return out;
  })();
  /* Časni majstor / VIP: RO editi + elipsis → modal „Odaberi" (izbor člana). Pamti se samo id (dataset). */
  var obr1bCasniEdit = document.getElementById('obr1b_casni_majstor');
  var obr1bCasniBtn  = document.getElementById('obr1b_casni_majstor_btn');
  var obr1bVipEdit   = document.getElementById('obr1b_vip');
  var obr1bVipBtn    = document.getElementById('obr1b_vip_btn');
  /* Editi su edit-delete kontrole (RO, X aktivan u edit-modu): X čisti izbor (input + spremljeni id). */
  var obr1bCasniWrap = obr1bCasniEdit ? obr1bCasniEdit.closest('.kontrola-edit-delete') : null;
  var obr1bVipWrap   = obr1bVipEdit ? obr1bVipEdit.closest('.kontrola-edit-delete') : null;
  if (typeof KontroleInitEditDelete === 'function') {
    if (obr1bCasniWrap) KontroleInitEditDelete(obr1bCasniWrap);
    if (obr1bVipWrap) KontroleInitEditDelete(obr1bVipWrap);
  }
  /* Framework (0-Kontrole) očisti sam input i emitira event; ovdje maknemo i spremljeni clanId. */
  if (obr1bCasniWrap) obr1bCasniWrap.addEventListener('kontrole-edit-delete-clear', function () { if (obr1bCasniEdit && obr1bCasniEdit.dataset) delete obr1bCasniEdit.dataset.clanId; });
  if (obr1bVipWrap) obr1bVipWrap.addEventListener('kontrole-edit-delete-clear', function () { if (obr1bVipEdit && obr1bVipEdit.dataset) delete obr1bVipEdit.dataset.clanId; });
  /* Modal „Odaberi": tablica Članovi (1 kolona, 5 vidljivih redova). */
  var odaberiApi = null;
  var ODABERI_TABLICA = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'clan', title: 'Članovi', SQL_Naziv: 'clan', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  CommonCRUD.initTablica('odaberiTablicaContainer', ODABERI_TABLICA, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { odaberiApi = api; },
    onSelectionChange: function () { azurirajOdaberiOk(); }
  });
  var predlagaciApi = null;
  var obr1bPredlagaci = [];    /* [{id, prezime, ime, loza_naziv, loza_grad, id_obred, stupanj, stupanj_broj, stupanj_naziv}] — redovi tablice */
  var _obrazac001bPostoji = false;   /* postoji li redak u parentu kandidat_dokumenti_001 (dijeljen s 001a) → Izmjeni; inače Upis */
  /* Mapa ograničenja stupnjeva po obredu (tip 6) — isti filter kao Lista/Članovi lože:
     stupnjevi viši od dozvoljenog za obred prikazuju se kao najviši dozvoljeni. Lijeni jednokratni dohvat. */
  var _obr1bOgrMap = {};
  var _obr1bOgrLoaded = false;
  var _obr1bOgrReq = null;
  var _obr1bOgrWait = [];
  var PREDLAGACI_TABLICA = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'predlagac', title: 'Braća ili Sestre predlagači', SQL_Naziv: 'predlagac', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  CommonCRUD.initTablica('predlagaciTablicaContainer', PREDLAGACI_TABLICA, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { predlagaciApi = api; },
    onSelectionChange: function () { azurirajObr1bIkone(); }
  });

  /* Jednokratni dohvat mape ograničenja stupnjeva po obredu (kao Lista: ucitajStupnjeviOgranicenjaLista). */
  function ucitajObr1bStupnjeviOgr(done) {
    if (_obr1bOgrLoaded) { if (typeof done === 'function') done(); return; }
    if (typeof done === 'function') _obr1bOgrWait.push(done);
    if (_obr1bOgrReq) return;
    var url = API_BASE + 'duznosnici_ogranicenja_stupnjevi_po_obredu.php';
    if (typeof window.vnlhGeoUrlDodajDuznosnikTest === 'function') url = window.vnlhGeoUrlDodajDuznosnikTest(url);
    var xhr = new XMLHttpRequest();
    _obr1bOgrReq = xhr;
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      _obr1bOgrReq = null; _obr1bOgrLoaded = true;
      var t = (xhr.responseText || '').trim();
      _obr1bOgrMap = {};
      if (t !== '' && t.charAt(0) === '{') { try { _obr1bOgrMap = JSON.parse(t); } catch (e) { _obr1bOgrMap = {}; } }
      var cek = _obr1bOgrWait; _obr1bOgrWait = [];
      for (var i = 0; i < cek.length; i++) { try { if (cek[i]) cek[i](); } catch (e) {} }
    };
    xhr.send();
  }
  /* Prikaz stupnja s primjenom ograničenja (viši od dozvoljenog → najviši dozvoljeni). Vraća {broj, naziv}. */
  function obr1bCapStupanj(c) {
    var brojStr = (c && c.stupanj_broj != null) ? String(c.stupanj_broj) : '';
    var nazivStr = (c && c.stupanj_naziv != null) ? String(c.stupanj_naziv) : '';
    if (typeof window.vnlhFilteriPrimijeniStupnjevaPoOgranicenjima === 'function') {
      var row = {
        id_obred: (c && c.id_obred != null && c.id_obred !== '') ? (parseInt(c.id_obred, 10) || 0) : 0,
        id_stupnj_clan: (c && c.stupanj != null && c.stupanj !== '') ? (parseInt(c.stupanj, 10) || 0) : 0,
        Stupanj: brojStr, StupanjBroj: brojStr, StupanjNaziv: nazivStr
      };
      window.vnlhFilteriPrimijeniStupnjevaPoOgranicenjima(1, [row], _obr1bOgrMap);
      brojStr = row.StupanjBroj != null ? String(row.StupanjBroj) : '';
      nazivStr = row.StupanjNaziv != null ? String(row.StupanjNaziv) : '';
    }
    return { broj: brojStr, naziv: nazivStr };
  }
  /* Redak/opcija: „Prezime Ime, Loža, Grad, Stupanj" (prazni dijelovi se preskaču).
     Stupanj je filtriran po ograničenjima (viši od dozvoljenog → najviši dozvoljeni). */
  function predlagacLabel(c) {
    var ime = (((c && c.prezime) || '') + ' ' + ((c && c.ime) || '')).trim();
    return [ime, c && c.loza_naziv, c && c.loza_grad, obr1bCapStupanj(c).naziv].filter(Boolean).join(', ');
  }
  function getObr1bSelId() { return CommonCRUD.getSelectedRowId(predlagaciApi); }
  function renderPredlagaciTablica() {
    var rows = [];
    for (var i = 0; i < obr1bPredlagaci.length; i++) {
      var r = obr1bPredlagaci[i];
      rows.push({ id: r.id, 0: predlagacLabel(r) });
    }
    if (predlagaciApi) CommonCRUD.setDataTablica(predlagaciApi, 'predlagaciTablicaContainer', rows, PREDLAGACI_TABLICA.Tablica_Zaglavlje);
    azurirajObr1bIkone();
  }
  function azurirajObr1bIkone() {
    var imaKandidat = getSelectedRowId() != null;
    var imaRed = getObr1bSelId() != null;
    if (btnObr1bDodaj) btnObr1bDodaj.disabled = !imaKandidat || (_pravaCrudUpis !== 1);
    if (btnObr1bObrisi) btnObr1bObrisi.disabled = !imaRed || (_pravaCrudUpis !== 1);
  }
  /* Dodaj predlagača iz zapisa člana (rec iz modala „Odaberi"); dupli član se NE dodaje (tiho). */
  function obr1bDodajPredlagacaRec(rec) {
    if (!rec || rec.id == null) return;
    for (var i = 0; i < obr1bPredlagaci.length; i++) { if (String(obr1bPredlagaci[i].id) === String(rec.id)) return; }
    obr1bPredlagaci.push({
      id: rec.id, prezime: rec.prezime, ime: rec.ime, loza_naziv: rec.loza_naziv, loza_grad: rec.loza_grad,
      id_obred: rec.id_obred, stupanj: rec.stupanj, stupanj_broj: rec.stupanj_broj, stupanj_naziv: rec.stupanj_naziv
    });
    /* Osiguraj mapu ograničenja pa re-renderaj (da stupanj bude filtriran i ako map još nije stigao). */
    ucitajObr1bStupnjeviOgr(function () { renderPredlagaciTablica(); });
    renderPredlagaciTablica();
  }
  /* Smeće: briše selektirani red DIREKTNO (bez potvrde). */
  function obr1bObrisiPredlagaca() {
    var id = getObr1bSelId(); if (id == null) return;
    for (var i = 0; i < obr1bPredlagaci.length; i++) {
      if (String(obr1bPredlagaci[i].id) === String(id)) { obr1bPredlagaci.splice(i, 1); break; }
    }
    renderPredlagaciTablica();
  }
  /* Očisti tab 001b (promjena selekcije kandidata / nakon CRUD-a). */
  function obr1bClear() {
    obr1bPredlagaci = [];
    if (obr1bDatumRazmatranja) obr1bDatumRazmatranja.value = '';
    if (obr1bDatumOdbijanja) obr1bDatumOdbijanja.value = '';
    for (var gi = 0; gi < OBR1B_GLAS_IDS.length; gi++) { var ge = document.getElementById(OBR1B_GLAS_IDS[gi]); if (ge) ge.value = ''; }
    obr1bPostaviClanEdit(obr1bCasniEdit, null);
    obr1bPostaviClanEdit(obr1bVipEdit, null);
    if (obr1bRazlog) obr1bRazlog.value = '';
    obr1bAzurirajRazlog();
    _obrazac001bPostoji = false;
    renderPredlagaciTablica();
  }
  /* Postavi RO edit (Časni majstor/VIP) iz objekta člana (ili očisti ako null). */
  function obr1bPostaviClanEdit(edit, clan) {
    if (!edit) return;
    if (clan && clan.id != null) { edit.value = clanRedLabel(clan); edit.dataset.clanId = String(clan.id); }
    else { edit.value = ''; if (edit.dataset) delete edit.dataset.clanId; }
    edit.dispatchEvent(new Event('change', { bubbles: true }));   /* sync vidljivosti X (edit-delete) */
  }
  /* Popuni jedan stupac matrice glasanja iz objekta {datum,glasaca,za,protiv,suzdrzani}. */
  function obr1bPopuniGlasanje(n, g) {
    g = g || {};
    var polja = ['datum', 'glasaca', 'za', 'protiv', 'suzdrzani'];
    for (var i = 0; i < polja.length; i++) {
      var el = document.getElementById('obr1b_g' + n + '_' + polja[i]);
      if (el) el.value = (g[polja[i]] != null ? String(g[polja[i]]) : '');
    }
  }
  /* Učitaj 001b odabranog kandidata (predlagači + glasanja + datumi + časni/VIP). */
  function ucitajObr1b(idClan) {
    obr1bClear();
    if (idClan == null || idClan === '' || typeof fetch !== 'function') return;
    ucitajObr1bStupnjeviOgr(function () {
      fetch(API_BASE + 'Kandidat_Dokumenti_001b_CRUD_jedan.php?id_clan=' + encodeURIComponent(idClan))
        .then(function (r) { return r.text(); })
        .then(function (text) {
          text = (text || '').trim();
          if (String(getSelectedRowId()) !== String(idClan)) return;   /* selekcija se promijenila */
          if (text !== '' && text.charAt(0) === '{') {
            try {
              var o = JSON.parse(text);
              _obrazac001bPostoji = !!o.postoji;
              obr1bPredlagaci = Array.isArray(o.predlagaci) ? o.predlagaci.slice() : [];
              renderPredlagaciTablica();
              obr1bPopuniGlasanje(1, o.glasanje_1);
              obr1bPopuniGlasanje(2, o.glasanje_2);
              obr1bPopuniGlasanje(3, o.glasanje_3);
              if (obr1bDatumRazmatranja) obr1bDatumRazmatranja.value = o.datum_razmatranja || '';
              if (obr1bDatumOdbijanja) obr1bDatumOdbijanja.value = o.datum_odbijanja || '';
              obr1bPostaviClanEdit(obr1bCasniEdit, o.casni);
              obr1bPostaviClanEdit(obr1bVipEdit, o.vip);
              if (obr1bRazlog) obr1bRazlog.value = o.razlog_odbijanja || '';
              obr1bAzurirajRazlog();
            } catch (e) {}
          }
          updateCrudState();
        }).catch(function () { updateCrudState(); });
    });
  }
  /* Sastavi payload za spremanje 001b iz kontrola. */
  function obr1bGetPayload(idClan) {
    function valOf(idr) { var e = document.getElementById(idr); return e ? trim(e.value) : ''; }
    function glas(n) {
      return {
        datum: valOf('obr1b_g' + n + '_datum'), glasaca: valOf('obr1b_g' + n + '_glasaca'),
        za: valOf('obr1b_g' + n + '_za'), protiv: valOf('obr1b_g' + n + '_protiv'), suzdrzani: valOf('obr1b_g' + n + '_suzdrzani')
      };
    }
    var predIds = [];
    for (var i = 0; i < obr1bPredlagaci.length; i++) { if (obr1bPredlagaci[i].id != null) predIds.push(obr1bPredlagaci[i].id); }
    return {
      id_clan: String(idClan),
      predlagaci: predIds,
      glasanje_1: glas(1), glasanje_2: glas(2), glasanje_3: glas(3),
      datum_razmatranja: obr1bDatumRazmatranja ? trim(obr1bDatumRazmatranja.value) : '',
      datum_odbijanja: obr1bDatumOdbijanja ? trim(obr1bDatumOdbijanja.value) : '',
      razlog_odbijanja: obr1bRazlog ? trim(obr1bRazlog.value) : '',
      casni_id: (obr1bCasniEdit && obr1bCasniEdit.dataset.clanId) ? obr1bCasniEdit.dataset.clanId : '',
      vip_id: (obr1bVipEdit && obr1bVipEdit.dataset.clanId) ? obr1bVipEdit.dataset.clanId : ''
    };
  }
  /* Datum odbijanja valjan (YYYY-MM-DD)? Native date input je prazan ili valjan; regex je dodatna zaštita. */
  function obr1bDatumOdbijanjaValjan() {
    var v = obr1bDatumOdbijanja ? trim(obr1bDatumOdbijanja.value) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
  }
  /* „Razlog odbijanja" omogućen/editabilan SAMO kad je tab aktivan I „Datum odbijanja" valjan.
     Samo prebacuje disabled (NE briše — da učitani razlog ne nestane prije nego stigne enable stanje). */
  function obr1bAzurirajRazlog() {
    if (!obr1bRazlog) return;
    var ok = _obr1bEnabled && obr1bDatumOdbijanjaValjan();
    obr1bRazlog.disabled = !ok;
    if (obr1bRazlogLabel) obr1bRazlogLabel.classList.toggle('kontrola-labela--disabled', !ok);   /* labela sivi zajedno s kontrolom */
  }
  /* Korisnička promjena „Datum odbijanja": ako datum više nije valjan, razlog otpada (očisti); pa osvježi enable. */
  function obr1bDatumOdbijanjaPromjena() {
    if (obr1bRazlog && !obr1bDatumOdbijanjaValjan()) obr1bRazlog.value = '';
    obr1bAzurirajRazlog();
  }
  /* Omogući/onemogući kontrole taba 001b. */
  function obrazac1bSetEnabled(on) {
    _obr1bEnabled = !!on;
    if (obr1bDatumRazmatranja) obr1bDatumRazmatranja.disabled = !on;
    if (obr1bDatumOdbijanja) obr1bDatumOdbijanja.disabled = !on;
    for (var gi = 0; gi < OBR1B_GLAS_IDS.length; gi++) { var ge = document.getElementById(OBR1B_GLAS_IDS[gi]); if (ge) ge.disabled = !on; }
    if (obr1bCasniBtn) obr1bCasniBtn.disabled = !on;
    if (obr1bVipBtn) obr1bVipBtn.disabled = !on;
    /* X (edit-delete) aktivan samo u edit-modu; RO ostaje uvijek. */
    if (obr1bCasniWrap) obr1bCasniWrap.classList.toggle('kontrola-edit-delete--x-neaktivan', !on);
    if (obr1bVipWrap) obr1bVipWrap.classList.toggle('kontrola-edit-delete--x-neaktivan', !on);
    obr1bAzurirajRazlog();   /* razlog ovisi i o valjanosti datuma odbijanja */
    var cont = document.getElementById('predlagaciTablicaContainer');
    if (cont) cont.classList.toggle('kontrola-tablica--disabled', !on);
    azurirajObr1bIkone();
  }
  if (btnObr1bDodaj) btnObr1bDodaj.addEventListener('click', function () { otvoriOdaberiModal('predlagac'); });
  if (btnObr1bObrisi) btnObr1bObrisi.addEventListener('click', obr1bObrisiPredlagaca);
  if (obr1bDatumOdbijanja) { obr1bDatumOdbijanja.addEventListener('input', obr1bDatumOdbijanjaPromjena); obr1bDatumOdbijanja.addEventListener('change', obr1bDatumOdbijanjaPromjena); }

  /* ============================================================
   * ▒▒ MODAL „Odaberi" — izbor člana za Časni majstor / VIP ▒▒
   * Pretraga (server-side, debounce) + tablica Članovi (aktivnost=1, kandidat=0, max 50).
   * OK → prenese „Prezime Ime, Loža, Grad" u ciljni edit (+ id u dataset). Odustani → gasi bez akcije.
   * Resizabilan; pozicija+veličina se pamte pri izlasku (localStorage). Podaci klijentski (spremanje kasnije).
   * ============================================================ */
  var odaberiModal    = document.getElementById('odaberiModal');
  var odaberiDialog   = odaberiModal ? odaberiModal.querySelector('.kandidat-dokumenti-crud__modal-razgovor-dialog') : null;
  var odaberiTraziInp = document.getElementById('odaberi_trazi');
  var btnOdaberiOk    = document.getElementById('odaberiOk');
  var btnOdaberiOdustani = document.getElementById('odaberiOdustani');
  var _odaberiTarget  = null;   /* 'casni' | 'vip' — koji edit je otvorio modal */
  var _odaberiData    = [];     /* članovi (rezultat pretrage) */
  var ODABERI_MODAL_KEY = 'kandidat-odaberi-modal';

  function clanRedLabel(c) {
    var ime = (((c && c.prezime) || '') + ' ' + ((c && c.ime) || '')).trim();
    return [ime, c && c.loza_naziv, c && c.loza_grad].filter(Boolean).join(', ');
  }
  function getOdaberiSelId() { return CommonCRUD.getSelectedRowId(odaberiApi); }
  function azurirajOdaberiOk() { if (btnOdaberiOk) btnOdaberiOk.disabled = getOdaberiSelId() == null; }
  function renderOdaberiTablica() {
    var rows = [];
    for (var i = 0; i < _odaberiData.length; i++) { rows.push({ id: _odaberiData[i].id, 0: clanRedLabel(_odaberiData[i]) }); }
    if (odaberiApi) CommonCRUD.setDataTablica(odaberiApi, 'odaberiTablicaContainer', rows, ODABERI_TABLICA.Tablica_Zaglavlje);
    azurirajOdaberiOk();
  }
  function fetchOdaberiClanovi(q) {
    if (typeof fetch !== 'function') return;
    var idDrz = (selectDrzava && trim(selectDrzava.value) !== '') ? selectDrzava.value : '-1';   /* država iz geogrupe (-1 = sve) */
    var par = [];
    if (q) par.push('q=' + encodeURIComponent(q));
    par.push('id_drzava=' + encodeURIComponent(idDrz));
    var url = API_BASE + 'Kandidat_Dokumenti_001b_CRUD_clanovi.php?' + par.join('&');
    fetch(url).then(function (r) { return r.text(); }).then(function (text) {
      text = (text || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') { try { arr = JSON.parse(text); } catch (e) { arr = []; } }
      _odaberiData = arr;
      renderOdaberiTablica();
    }).catch(function () {});
  }
  /* Pozicija + veličina: pamćenje (localStorage), primjena / centriranje (klon razgovor modala). */
  function getOdaberiStanje() {
    try { var s = localStorage.getItem(ODABERI_MODAL_KEY); if (s) { var o = JSON.parse(s); if (o && typeof o.width === 'number' && typeof o.height === 'number') return o; } } catch (e) {}
    return null;
  }
  function saveOdaberiStanje(l, t, w, h) {
    try { localStorage.setItem(ODABERI_MODAL_KEY, JSON.stringify({ left: l, top: t, width: w, height: h })); } catch (e) {}
  }
  function primijeniOdaberiStanje() {
    if (!odaberiDialog) return;
    var st = getOdaberiStanje();
    if (st) {
      odaberiDialog.style.left = st.left + 'px'; odaberiDialog.style.top = st.top + 'px';
      odaberiDialog.style.transform = 'none';
      odaberiDialog.style.width = st.width + 'px'; odaberiDialog.style.height = st.height + 'px';
    } else {
      odaberiDialog.style.left = '50%'; odaberiDialog.style.top = '50%';
      odaberiDialog.style.transform = 'translate(-50%, -50%)';
      odaberiDialog.style.width = ''; odaberiDialog.style.height = '';
    }
  }
  function spremiOdaberiGeom() {
    if (!odaberiDialog) return;
    var r = odaberiDialog.getBoundingClientRect();
    saveOdaberiStanje(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
  }
  function otvoriOdaberiModal(target) {
    if (getSelectedRowId() == null) return;
    _odaberiTarget = target;
    if (odaberiTraziInp) odaberiTraziInp.value = '';
    if (odaberiApi && odaberiApi.clearSelection) odaberiApi.clearSelection();
    _odaberiData = []; renderOdaberiTablica();
    fetchOdaberiClanovi('');
    primijeniOdaberiStanje();
    if (odaberiModal) { odaberiModal.classList.add('kandidat-dokumenti-crud__modal-razgovor--open'); odaberiModal.setAttribute('aria-hidden', 'false'); }
    if (odaberiTraziInp) odaberiTraziInp.focus();
    azurirajOdaberiOk();
  }
  function zatvoriOdaberiModal() {
    if (!odaberiModal) return;
    if (odaberiModal.classList.contains('kandidat-dokumenti-crud__modal-razgovor--open')) spremiOdaberiGeom();
    odaberiModal.classList.remove('kandidat-dokumenti-crud__modal-razgovor--open');
    odaberiModal.setAttribute('aria-hidden', 'true');
  }
  function odaberiPotvrdi() {
    var id = getOdaberiSelId(); if (id == null) return;
    var rec = null;
    for (var i = 0; i < _odaberiData.length; i++) { if (String(_odaberiData[i].id) === String(id)) { rec = _odaberiData[i]; break; } }
    if (rec) {
      if (_odaberiTarget === 'predlagac') {
        obr1bDodajPredlagacaRec(rec);   /* dodaje u tablicu predlagača (dupli se tiho ignorira) */
      } else {
        var edit = _odaberiTarget === 'vip' ? obr1bVipEdit : obr1bCasniEdit;
        obr1bPostaviClanEdit(edit, rec);   /* postavlja value + clanId i sinka vidljivost X */
      }
    }
    zatvoriOdaberiModal();
  }
  if (obr1bCasniBtn) obr1bCasniBtn.addEventListener('click', function () { otvoriOdaberiModal('casni'); });
  if (obr1bVipBtn) obr1bVipBtn.addEventListener('click', function () { otvoriOdaberiModal('vip'); });
  if (btnOdaberiOk) btnOdaberiOk.addEventListener('click', odaberiPotvrdi);
  if (btnOdaberiOdustani) btnOdaberiOdustani.addEventListener('click', zatvoriOdaberiModal);
  (function () { var c = document.getElementById('odaberiTablicaContainer'); if (c) c.addEventListener('dblclick', odaberiPotvrdi); }());
  if (odaberiTraziInp) {
    var _odabTraziT = null;
    odaberiTraziInp.addEventListener('input', function () {
      var q = trim(this.value);
      if (_odabTraziT) clearTimeout(_odabTraziT);
      _odabTraziT = setTimeout(function () { fetchOdaberiClanovi(q); }, 250);
    });
    var odabClear = odaberiTraziInp.parentNode ? odaberiTraziInp.parentNode.querySelector('.kontrola-edit-delete__clear') : null;
    if (odabClear) odabClear.addEventListener('click', function () { odaberiTraziInp.value = ''; fetchOdaberiClanovi(''); odaberiTraziInp.focus(); });
  }
  /* Premještanje (drag zaglavlja) + resize (kut) — klon razgovor modala; izlaz SAMO preko OK/Odustani. */
  if (odaberiModal && odaberiDialog) {
    function odaberiFiksirajPoziciju() {
      var r = odaberiDialog.getBoundingClientRect();
      odaberiDialog.style.left = Math.round(r.left) + 'px';
      odaberiDialog.style.top = Math.round(r.top) + 'px';
      odaberiDialog.style.transform = 'none';
      return r;
    }
    var odaberiHeader = odaberiModal.querySelector('.kandidat-dokumenti-crud__modal-razgovor-header');
    if (odaberiHeader) {
      odaberiHeader.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var r = odaberiFiksirajPoziciju();
        var l0 = r.left, t0 = r.top, x0 = e.clientX, y0 = e.clientY;
        function move(ev) {
          odaberiDialog.style.left = Math.max(0, l0 + ev.clientX - x0) + 'px';
          odaberiDialog.style.top = Math.max(0, t0 + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop);
        e.preventDefault();
      });
    }
    var odaberiResizeKut = document.getElementById('odaberiResizeKut');
    if (odaberiResizeKut) {
      odaberiResizeKut.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var r = odaberiFiksirajPoziciju();
        var w0 = r.width, h0 = r.height, x0 = e.clientX, y0 = e.clientY;
        function move(ev) {
          odaberiDialog.style.width = Math.max(360, w0 + ev.clientX - x0) + 'px';
          odaberiDialog.style.height = Math.max(300, h0 + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop);
        e.preventDefault(); e.stopPropagation();
      });
    }
  }

  function initForma() {
    updateNaslovLozu();
    if (typeof KontroleTabInit === 'function') KontroleTabInit(document.getElementById('kandidatKontrolaTab'));
    /* Prebacivanje taba (klik/tipke) osvježava footer — Upiši/Izmjeni prati aktivni tab. */
    if (kandidatTabRoot && typeof MutationObserver !== 'undefined') {
      try {
        new MutationObserver(function () { updateCrudState(); }).observe(kandidatTabRoot, {
          subtree: true, attributes: true, attributeFilter: ['aria-selected', 'class']
        });
      } catch (e) {}
    }
    /* Broj djece: samo znamenke (postojeći filter iz 0-Common); PHP dodatno klampa 0–255. */
    if (typeof window.initSamoNumerika === 'function') {
      window.initSamoNumerika(document.getElementById('obr_broj_djece'), 3);
      /* Matrica glasanja: brojčana polja (glasača/za/protiv/suzdržani) samo znamenke; datum je date-picker. */
      for (var gi = 0; gi < OBR1B_GLAS_IDS.length; gi++) {
        var gid = OBR1B_GLAS_IDS[gi];
        if (gid.indexOf('_datum') === -1) window.initSamoNumerika(document.getElementById(gid), 4);
      }
    }
    razgovoriData = [];
    renderRazgovoriTablica();
    obr1bPredlagaci = [];
    renderPredlagaciTablica();
    ucitajPravaGeo(function () {
      updateNaslovLozu();
      updateEnabledState();
      zakaziSlikaSize();
      syncTablicaHeaderLogoSize();
    });
    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza) selectLoza.disabled = true;
    data = [];
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], KandidatCRUD.Tablica_Zaglavlje);
    zivotopisSetEnabled(false);
    updateEnabledState();

    /* Slika prati visinu panela tablice (resize trake/window); logo prati visinu zaglavlja. */
    zakaziSlikaSize();
    syncTablicaHeaderLogoSize();
    if (typeof ResizeObserver !== 'undefined') {
      var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
      if (panelTablica) {
        try { new ResizeObserver(function () { zakaziSlikaSize(); }).observe(panelTablica); } catch (e) {}
      }
      var headerKontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      if (headerKontrole) {
        try { new ResizeObserver(function () { syncTablicaHeaderLogoSize(); }).observe(headerKontrole); } catch (e) {}
      }
    }
    window.addEventListener('resize', function () { zakaziSlikaSize(); syncTablicaHeaderLogoSize(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initForma);
  else initForma();

  /* ============================================================
   * PDF modal životopisa: render dokumenta „Životopis kandidata"
   * (kontekst ID_Clan = id_clan, ID_Zivotopis = id reda u kandidat_dokumenti_zivotopis)
   * + uživo podešavanje extra-proreda (kandidat_dokumenti_zivotopis.dokument_prored).
   * Uzor: Esej_CRUD initPdfModal.
   * ============================================================ */
  (function initPdfModal() {
    var ZIV_DOK_NAZIV = 'Životopis kandidata';   /* dokument u pdf_dokument (referenca po nazivu) */
    var PRORED_MIN = 0.80, PRORED_MAX = 2.00, PRORED_KORAK = 0.1, PRORED_DEF = 1.00;
    var MSG_SPREMLJEN = 'Prored spremljen.';

    var modal       = document.getElementById('kandidatModalPdf');
    if (!btnPdf || !modal) return;
    var overlay     = modal.querySelector('.kandidat-dokumenti-crud__modal-pdf-overlay');
    var okvir       = document.getElementById('kandidat_pdf_okvir');
    var info        = document.getElementById('kandidat_pdf_info');
    var inpProred   = document.getElementById('kandidat_pdf_prored');
    var btnGore     = document.getElementById('kandidat_pdf_prored_gore');
    var btnDolje    = document.getElementById('kandidat_pdf_prored_dolje');
    var btnSave     = document.getElementById('kandidat_pdf_save');
    var btnRefresh  = document.getElementById('kandidat_pdf_refresh');
    var btnPovratak = document.getElementById('kandidat_pdf_povratak');
    var spiner      = document.getElementById('kandidat_pdf_spiner');

    var _dokument = null;        /* {dokument, stavke} za „Životopis kandidata" — svjež dohvat pri svakom otvaranju */
    var _proredStilId = null;    /* dokument.dokument_prored_default_stil */
    var _clanIdAktivni = null;   /* id_clan za koji je modal otvoren */
    var _zivIdAktivni = null;    /* id reda životopisa za koji je modal otvoren (ID_Zivotopis) */
    var _zauzet = false;         /* render u tijeku */

    function postJson(url, data, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      xhr.onreadystatechange = function () { if (xhr.readyState === 4 && cb) cb(xhr.responseText, xhr.status); };
      xhr.send(JSON.stringify(data));
    }

    function fmtProred(n) { return n.toFixed(2).replace('.', ','); }
    function parseProred(v) {
      var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
      if (isNaN(n)) n = PRORED_DEF;
      if (n < PRORED_MIN) n = PRORED_MIN;
      if (n > PRORED_MAX) n = PRORED_MAX;
      return Math.round(n * 100) / 100;
    }
    function getProred() { return parseProred(inpProred ? inpProred.value : PRORED_DEF); }
    function setProred(n) { if (inpProred) inpProred.value = fmtProred(parseProred(n)); }
    function postaviInfo(t) { if (info) info.textContent = t || ''; }
    function porukaSpremljenOcisti() { if (info && info.textContent === MSG_SPREMLJEN) postaviInfo(''); }
    function spinerShow() { if (typeof KontroleSpinerShow === 'function') KontroleSpinerShow(spiner); }
    function spinerHide() { if (typeof KontroleSpinerHide === 'function') KontroleSpinerHide(spiner); }
    function krajRendera(poruka) { _zauzet = false; spinerHide(); postaviInfo(poruka || ''); }

    /* Početni „Prored": zapis.dokument_prored → inače prored default-stila dokumenta → inače PRORED_DEF. */
    function postaviPocetniProred() {
      var v;
      if (_zivotopisProred != null && trim(String(_zivotopisProred)) !== '') v = _zivotopisProred;
      else if (_dokument && _dokument.default_stil_prored != null && trim(String(_dokument.default_stil_prored)) !== '') v = _dokument.default_stil_prored;
      else v = PRORED_DEF;
      setProred(v);
    }

    function ocistiIframe() {
      if (okvir) {
        if (okvir._url) { try { URL.revokeObjectURL(okvir._url); } catch (e) {} okvir._url = null; }
        okvir.removeAttribute('src');
      }
    }
    function otvoriModal() {
      modal.classList.add('kandidat-dokumenti-crud__modal-pdf--open');
      modal.setAttribute('aria-hidden', 'false');
    }
    function zatvoriModal() {
      modal.classList.remove('kandidat-dokumenti-crud__modal-pdf--open');
      modal.setAttribute('aria-hidden', 'true');
      ocistiIframe();
      spinerHide();
      postaviInfo('');
      try { btnPdf.focus(); } catch (e) {}
    }

    function ucitajFontove(lista, cb, err) {
      lista = lista || [];
      if (!lista.length) { cb(); return; }
      var preostalo = lista.length, greska = false;
      lista.forEach(function (f) {
        window.PdfRender.Fontovi.osiguraj(f.kljuc, f.porodica,
          function () { if (--preostalo === 0) { greska ? err() : cb(); } },
          function () { greska = true; if (--preostalo === 0) { err(); } });
      });
    }

    /* Resolve stavki (kontekst ID_Clan/ID_Zivotopis) → pdf-render → blob u iframe. */
    function renderiraj() {
      if (_zauzet) return;
      spinerShow();
      if (!window.PdfRender) { krajRendera('PDF biblioteka nije učitana.'); return; }
      if (!_dokument || !_dokument.dokument) { krajRendera('Dokument „' + ZIV_DOK_NAZIV + '" nije pronađen.'); return; }
      if (!_clanIdAktivni) { krajRendera('Životopis nije učitan.'); return; }
      var dok = _dokument.dokument;
      var stavke = _dokument.stavke || [];
      /* Kontekst: ID_Zivotopis → id reda životopisa; svaki drugi ključ (ID_Clan…) → id_clan. */
      var kontekst = {};
      stavke.forEach(function (s) {
        var k = s.kontekst_kljuc != null ? trim(String(s.kontekst_kljuc)) : '';
        if (k === '') return;
        if (k === 'ID_Zivotopis') { if (_zivIdAktivni != null) kontekst[k] = parseInt(_zivIdAktivni, 10); }
        else kontekst[k] = parseInt(_clanIdAktivni, 10);
      });
      var payload = {
        template_id: dok.template_id ? parseInt(dok.template_id, 10) : 0,
        kontekst: kontekst,
        broj_stranice_paragraf_id: dok.broj_stranice_paragraf_id ? parseInt(dok.broj_stranice_paragraf_id, 10) : null,
        stavke: stavke.map(function (s) {
          return {
            redoslijed: s.redoslijed, zona: s.zona, okvir_id: s.okvir_id, vrsta: s.vrsta,
            izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id,
            kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id,
            trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost,
            literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id,
            bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke,
            preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti,
            format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, fiksna_pozicija_y: s.fiksna_pozicija_y, sakrij_ako_prazno: s.sakrij_ako_prazno,
            relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator,
            redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold, podatak_paragraf_id: s.podatak_paragraf_id, tablica_stil_id: s.tablica_stil_id,
            zadrzi_svoj_stil: s.zadrzi_svoj_stil, prijelom_prije: s.prijelom_prije, prijelom_poslije: s.prijelom_poslije,
            prazno_nacin: s.prazno_nacin, skupina: s.skupina, prefiks: s.prefiks, sufiks: s.sufiks
          };
        })
      };
      var proredVrijednost = getProred();
      _zauzet = true;
      postaviInfo('Dohvaćam…');
      postJson(API_BASE + 'PDF_Generator_resolve.php', payload, function (res) {
        var model;
        try { model = JSON.parse(res); } catch (e) { krajRendera('Greška dohvata modela.'); return; }
        if (!model || model.greska) { krajRendera('Greška: ' + ((model && model.greska) || 'nepoznata')); return; }
        postaviInfo('Pripremam slike…');
        window.PdfRender.pripremiSlike(model, function (model) {
          postaviInfo('Gradim PDF…');
          var dd = window.PdfRender.sastaviDocDefinition(model, { proredStilId: _proredStilId, proredVrijednost: proredVrijednost });
          window.PdfRender.Pdf.ucitaj(function () {
            ucitajFontove(model.fontovi, function () {
              try {
                /* data URL (ne blob:) — izbjegava Chrome particioniranje blob URL-ova u iframeu. */
                pdfMake.createPdf(dd).getDataUrl(function (dataUrl) {
                  ocistiIframe();
                  okvir.src = dataUrl;
                  krajRendera('');
                });
              } catch (e) { krajRendera('Greška pri renderu: ' + e); }
            }, function () { krajRendera('Greška pri učitavanju fontova.'); });
          }, function () { krajRendera('Greška pri učitavanju pdfmake biblioteke.'); });
        });
      });
    }

    /* Dohvati dokument „Životopis kandidata" SVAKI put (bez keša) + renderiraj. */
    function ucitajDokumentIRenderiraj(resetProred) {
      spinerShow();
      postaviInfo('Učitavam dokument…');
      var url = API_BASE + 'PDF_Dokument_po_nazivu.php?naziv=' + encodeURIComponent(ZIV_DOK_NAZIV);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var data = null;
        try { data = JSON.parse((xhr.responseText || '').replace(/^﻿/, '').trim()); } catch (e) {}
        if (!data || data.greska || !data.dokument) { krajRendera('Dokument „' + ZIV_DOK_NAZIV + '" nije pronađen.'); return; }
        _dokument = data;
        _proredStilId = data.dokument.dokument_prored_default_stil ? parseInt(data.dokument.dokument_prored_default_stil, 10) : null;
        if (resetProred) postaviPocetniProred();
        renderiraj();
      };
      xhr.send();
    }

    btnPdf.addEventListener('click', function () {
      if (btnPdf.disabled) return;
      var idClan = getSelectedRowId();
      if (idClan == null) return;
      _clanIdAktivni = idClan;
      _zivIdAktivni = _zivotopisRowId;
      otvoriModal();
      ucitajDokumentIRenderiraj(true);
    });

    function korak(d) { setProred(getProred() + d); porukaSpremljenOcisti(); }
    if (btnGore)  btnGore.addEventListener('click', function () { korak(PRORED_KORAK); });
    if (btnDolje) btnDolje.addEventListener('click', function () { korak(-PRORED_KORAK); });
    if (inpProred) {
      inpProred.addEventListener('input', function () {
        var c = inpProred.value.replace(/[^0-9.,]/g, '');
        if (inpProred.value !== c) inpProred.value = c;
        porukaSpremljenOcisti();
      });
      inpProred.addEventListener('blur', function () { setProred(getProred()); });
      inpProred.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); setProred(getProred()); renderiraj(); }
      });
    }

    /* Save: spremi prored u bazu (kandidat_dokumenti_zivotopis.dokument_prored) po id_clan. */
    if (btnSave) {
      btnSave.addEventListener('click', function () {
        if (_clanIdAktivni == null) return;
        var p = getProred();
        setProred(p);
        btnSave.disabled = true;
        postJson(API_BASE + 'Kandidat_Dokumenti_CRUD_prored.php', { id_clan: parseInt(_clanIdAktivni, 10), prored: fmtProred(p) }, function (res, status) {
          btnSave.disabled = false;
          res = (res || '').trim();
          if (status >= 200 && status < 300 && res === 'OK') {
            _zivotopisProred = p;   /* zapamti za sljedeće otvaranje */
            postaviInfo(MSG_SPREMLJEN);
          } else {
            var pk = parseResponseCode(res);
            poruka(pk ? pk.code : '200', pk ? pk.replacements : []);
          }
        });
      });
    }

    if (btnRefresh)  btnRefresh.addEventListener('click', function () { setProred(getProred()); ucitajDokumentIRenderiraj(false); });
    if (btnPovratak) btnPovratak.addEventListener('click', zatvoriModal);
    if (overlay)     overlay.addEventListener('click', zatvoriModal);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && modal.classList.contains('kandidat-dokumenti-crud__modal-pdf--open')) zatvoriModal();
    });
  }());

  /* ============================================================
   * PDF modal RAZGOVORA: render dokumenta „Razgovor sa kandidatom"
   * (kontekst ID_Razgovor = id reda kandidat_dokumenti_razgovori) + prored po razgovoru.
   * Klon životopisnog initPdfModal; zaseban modal razgovorModalPdf (životopis netaknut).
   * ============================================================ */
  (function initRazgovorPdfModal() {
    var RAZG_DOK_NAZIV = 'Razgovor sa kandidatom';
    var PRORED_MIN = 0.80, PRORED_MAX = 2.00, PRORED_KORAK = 0.1, PRORED_DEF = 1.00;
    var MSG_SPREMLJEN = 'Prored spremljen.';

    var modal       = document.getElementById('razgovorModalPdf');
    if (!btnRazgovorPdf || !modal) return;
    var overlay     = modal.querySelector('.kandidat-dokumenti-crud__modal-pdf-overlay');
    var okvir       = document.getElementById('razgovor_pdf_okvir');
    var info        = document.getElementById('razgovor_pdf_info');
    var inpProred   = document.getElementById('razgovor_pdf_prored');
    var btnGore     = document.getElementById('razgovor_pdf_prored_gore');
    var btnDolje    = document.getElementById('razgovor_pdf_prored_dolje');
    var btnSave     = document.getElementById('razgovor_pdf_save');
    var btnRefresh  = document.getElementById('razgovor_pdf_refresh');
    var btnPovratak = document.getElementById('razgovor_pdf_povratak');
    var spiner      = document.getElementById('razgovor_pdf_spiner');

    var _dokument = null;
    var _proredStilId = null;
    var _razgIdAktivni = null;   /* id reda razgovora (kontekst ID_Razgovor) */
    var _zauzet = false;

    function postJson(url, data, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      xhr.onreadystatechange = function () { if (xhr.readyState === 4 && cb) cb(xhr.responseText, xhr.status); };
      xhr.send(JSON.stringify(data));
    }
    function fmtProred(n) { return n.toFixed(2).replace('.', ','); }
    function parseProred(v) {
      var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
      if (isNaN(n)) n = PRORED_DEF;
      if (n < PRORED_MIN) n = PRORED_MIN;
      if (n > PRORED_MAX) n = PRORED_MAX;
      return Math.round(n * 100) / 100;
    }
    function getProred() { return parseProred(inpProred ? inpProred.value : PRORED_DEF); }
    function setProred(n) { if (inpProred) inpProred.value = fmtProred(parseProred(n)); }
    function postaviInfo(t) { if (info) info.textContent = t || ''; }
    function porukaSpremljenOcisti() { if (info && info.textContent === MSG_SPREMLJEN) postaviInfo(''); }
    function spinerShow() { if (typeof KontroleSpinerShow === 'function') KontroleSpinerShow(spiner); }
    function spinerHide() { if (typeof KontroleSpinerHide === 'function') KontroleSpinerHide(spiner); }
    function krajRendera(p) { _zauzet = false; spinerHide(); postaviInfo(p || ''); }

    /* Početni prored: razgovor.dokument_prored → default-stil dokumenta → PRORED_DEF. */
    function postaviPocetniProred() {
      var v, rec = razgovorPoId(_razgIdAktivni);
      if (rec && rec.dokument_prored != null && trim(String(rec.dokument_prored)) !== '') v = rec.dokument_prored;
      else if (_dokument && _dokument.default_stil_prored != null && trim(String(_dokument.default_stil_prored)) !== '') v = _dokument.default_stil_prored;
      else v = PRORED_DEF;
      setProred(v);
    }

    function ocistiIframe() {
      if (okvir) {
        if (okvir._url) { try { URL.revokeObjectURL(okvir._url); } catch (e) {} okvir._url = null; }
        okvir.removeAttribute('src');
      }
    }
    function otvoriModal() { modal.classList.add('kandidat-dokumenti-crud__modal-pdf--open'); modal.setAttribute('aria-hidden', 'false'); }
    function zatvoriModal() {
      modal.classList.remove('kandidat-dokumenti-crud__modal-pdf--open');
      modal.setAttribute('aria-hidden', 'true');
      ocistiIframe(); spinerHide(); postaviInfo('');
      try { btnRazgovorPdf.focus(); } catch (e) {}
    }
    function ucitajFontove(lista, cb, err) {
      lista = lista || [];
      if (!lista.length) { cb(); return; }
      var preostalo = lista.length, greska = false;
      lista.forEach(function (f) {
        window.PdfRender.Fontovi.osiguraj(f.kljuc, f.porodica,
          function () { if (--preostalo === 0) { greska ? err() : cb(); } },
          function () { greska = true; if (--preostalo === 0) { err(); } });
      });
    }

    function renderiraj() {
      if (_zauzet) return;
      spinerShow();
      if (!window.PdfRender) { krajRendera('PDF biblioteka nije učitana.'); return; }
      if (!_dokument || !_dokument.dokument) { krajRendera('Dokument „' + RAZG_DOK_NAZIV + '" nije pronađen.'); return; }
      if (!_razgIdAktivni) { krajRendera('Razgovor nije učitan.'); return; }
      var dok = _dokument.dokument;
      var stavke = _dokument.stavke || [];
      var kontekst = {};
      stavke.forEach(function (s) {
        var k = s.kontekst_kljuc != null ? trim(String(s.kontekst_kljuc)) : '';
        if (k !== '') kontekst[k] = parseInt(_razgIdAktivni, 10);
      });
      var payload = {
        template_id: dok.template_id ? parseInt(dok.template_id, 10) : 0,
        kontekst: kontekst,
        broj_stranice_paragraf_id: dok.broj_stranice_paragraf_id ? parseInt(dok.broj_stranice_paragraf_id, 10) : null,
        stavke: stavke.map(function (s) {
          return {
            redoslijed: s.redoslijed, zona: s.zona, okvir_id: s.okvir_id, vrsta: s.vrsta,
            izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id,
            kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id,
            trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost,
            literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id,
            bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke,
            preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti,
            format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, fiksna_pozicija_y: s.fiksna_pozicija_y, sakrij_ako_prazno: s.sakrij_ako_prazno,
            relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator,
            redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold, podatak_paragraf_id: s.podatak_paragraf_id, tablica_stil_id: s.tablica_stil_id,
            zadrzi_svoj_stil: s.zadrzi_svoj_stil, prijelom_prije: s.prijelom_prije, prijelom_poslije: s.prijelom_poslije,
            prazno_nacin: s.prazno_nacin, skupina: s.skupina, prefiks: s.prefiks, sufiks: s.sufiks
          };
        })
      };
      var proredVrijednost = getProred();
      _zauzet = true;
      postaviInfo('Dohvaćam…');
      postJson(API_BASE + 'PDF_Generator_resolve.php', payload, function (res) {
        var model;
        try { model = JSON.parse(res); } catch (e) { krajRendera('Greška dohvata modela.'); return; }
        if (!model || model.greska) { krajRendera('Greška: ' + ((model && model.greska) || 'nepoznata')); return; }
        postaviInfo('Pripremam slike…');
        window.PdfRender.pripremiSlike(model, function (model) {
          postaviInfo('Gradim PDF…');
          var dd = window.PdfRender.sastaviDocDefinition(model, { proredStilId: _proredStilId, proredVrijednost: proredVrijednost });
          window.PdfRender.Pdf.ucitaj(function () {
            ucitajFontove(model.fontovi, function () {
              try {
                pdfMake.createPdf(dd).getDataUrl(function (dataUrl) { ocistiIframe(); okvir.src = dataUrl; krajRendera(''); });
              } catch (e) { krajRendera('Greška pri renderu: ' + e); }
            }, function () { krajRendera('Greška pri učitavanju fontova.'); });
          }, function () { krajRendera('Greška pri učitavanju pdfmake biblioteke.'); });
        });
      });
    }

    function ucitajDokumentIRenderiraj(resetProred) {
      spinerShow();
      postaviInfo('Učitavam dokument…');
      var url = API_BASE + 'PDF_Dokument_po_nazivu.php?naziv=' + encodeURIComponent(RAZG_DOK_NAZIV);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var data = null;
        try { data = JSON.parse((xhr.responseText || '').replace(/^﻿/, '').trim()); } catch (e) {}
        if (!data || data.greska || !data.dokument) { krajRendera('Dokument „' + RAZG_DOK_NAZIV + '" nije pronađen.'); return; }
        _dokument = data;
        _proredStilId = data.dokument.dokument_prored_default_stil ? parseInt(data.dokument.dokument_prored_default_stil, 10) : null;
        if (resetProred) postaviPocetniProred();
        renderiraj();
      };
      xhr.send();
    }

    btnRazgovorPdf.addEventListener('click', function () {
      if (btnRazgovorPdf.disabled) return;
      var id = getRazgovorSelId();
      if (id == null) return;
      _razgIdAktivni = parseInt(id, 10);
      otvoriModal();
      ucitajDokumentIRenderiraj(true);
    });

    function korak(d) { setProred(getProred() + d); porukaSpremljenOcisti(); }
    if (btnGore)  btnGore.addEventListener('click', function () { korak(PRORED_KORAK); });
    if (btnDolje) btnDolje.addEventListener('click', function () { korak(-PRORED_KORAK); });
    if (inpProred) {
      inpProred.addEventListener('input', function () {
        var c = inpProred.value.replace(/[^0-9.,]/g, '');
        if (inpProred.value !== c) inpProred.value = c;
        porukaSpremljenOcisti();
      });
      inpProred.addEventListener('blur', function () { setProred(getProred()); });
      inpProred.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); setProred(getProred()); renderiraj(); } });
    }
    if (btnSave) {
      btnSave.addEventListener('click', function () {
        if (_razgIdAktivni == null) return;
        var p = getProred();
        setProred(p);
        btnSave.disabled = true;
        postJson(API_BASE + 'Kandidat_Dokumenti_Razgovori_CRUD_prored.php', { id: _razgIdAktivni, prored: fmtProred(p) }, function (res, status) {
          btnSave.disabled = false;
          res = (res || '').trim();
          if (status >= 200 && status < 300 && res === 'OK') {
            var rec = razgovorPoId(_razgIdAktivni); if (rec) rec.dokument_prored = p;   /* zapamti za sljedeće otvaranje */
            postaviInfo(MSG_SPREMLJEN);
          } else { var pk = parseResponseCode(res); poruka(pk ? pk.code : '200', pk ? pk.replacements : []); }
        });
      });
    }
    if (btnRefresh)  btnRefresh.addEventListener('click', function () { setProred(getProred()); ucitajDokumentIRenderiraj(false); });
    if (btnPovratak) btnPovratak.addEventListener('click', zatvoriModal);
    if (overlay)     overlay.addEventListener('click', zatvoriModal);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && modal.classList.contains('kandidat-dokumenti-crud__modal-pdf--open')) zatvoriModal();
    });
  }());

  /* ============================================================
   * PDF Obrasca 001a: klik ikone → render dokumenta „Obrazac 001 a".
   * Kontekst ID_Obrazac001 = kandidat_dokumenti_001.id (_obrazac001RowId). Jednostavni modal (bez proreda).
   * ============================================================ */
  (function initObrazacPdfModal() {
    var modal       = document.getElementById('obrazacModalPdf');
    if (!obrPdfBtn || !modal) return;
    var overlay     = modal.querySelector('.kandidat-dokumenti-crud__modal-pdf-overlay');
    var naslovEl    = modal.querySelector('.kandidat-dokumenti-crud__modal-pdf-naslov');
    var okvir       = document.getElementById('obrazac_pdf_okvir');
    var info        = document.getElementById('obrazac_pdf_info');
    var btnRefresh  = document.getElementById('obrazac_pdf_refresh');
    var btnPovratak = document.getElementById('obrazac_pdf_povratak');
    var spiner      = document.getElementById('obrazac_pdf_spiner');

    var _dokument = null;
    var _proredStilId = null;
    var _idAktivni = null;   /* kandidat_dokumenti_001.id (kontekst ID_Obrazac001) */
    var _zauzet = false;
    var _naziv = 'Obrazac 001 a';   /* dokument u modalu: 001a „Obrazac 001 a" / 001b „Obrazac 001" */
    var _izvorBtn = obrPdfBtn;      /* gumb koji je otvorio modal (fokus na zatvaranju) */

    function postJson(url, data, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      xhr.onreadystatechange = function () { if (xhr.readyState === 4 && cb) cb(xhr.responseText, xhr.status); };
      xhr.send(JSON.stringify(data));
    }
    function postaviInfo(t) { if (info) info.textContent = t || ''; }
    function spinerShow() { if (typeof KontroleSpinerShow === 'function') KontroleSpinerShow(spiner); }
    function spinerHide() { if (typeof KontroleSpinerHide === 'function') KontroleSpinerHide(spiner); }
    function krajRendera(p) { _zauzet = false; spinerHide(); postaviInfo(p || ''); }
    function ocistiIframe() {
      if (okvir) { if (okvir._url) { try { URL.revokeObjectURL(okvir._url); } catch (e) {} okvir._url = null; } okvir.removeAttribute('src'); }
    }
    function otvoriModal() { modal.classList.add('kandidat-dokumenti-crud__modal-pdf--open'); modal.setAttribute('aria-hidden', 'false'); }
    function zatvoriModal() {
      modal.classList.remove('kandidat-dokumenti-crud__modal-pdf--open');
      modal.setAttribute('aria-hidden', 'true');
      ocistiIframe(); spinerHide(); postaviInfo('');
      try { (_izvorBtn || obrPdfBtn).focus(); } catch (e) {}
    }
    function ucitajFontove(lista, cb, err) {
      lista = lista || [];
      if (!lista.length) { cb(); return; }
      var preostalo = lista.length, greska = false;
      lista.forEach(function (f) {
        window.PdfRender.Fontovi.osiguraj(f.kljuc, f.porodica,
          function () { if (--preostalo === 0) { greska ? err() : cb(); } },
          function () { greska = true; if (--preostalo === 0) { err(); } });
      });
    }

    function renderiraj() {
      if (_zauzet) return;
      spinerShow();
      if (!window.PdfRender) { krajRendera('PDF biblioteka nije učitana.'); return; }
      if (!_dokument || !_dokument.dokument) { krajRendera('Dokument „' + _naziv + '" nije pronađen.'); return; }
      if (_idAktivni == null) { krajRendera('Obrazac nije učitan.'); return; }
      var dok = _dokument.dokument;
      var stavke = _dokument.stavke || [];
      var kontekst = {};
      stavke.forEach(function (s) {
        var k = s.kontekst_kljuc != null ? trim(String(s.kontekst_kljuc)) : '';
        if (k !== '') kontekst[k] = parseInt(_idAktivni, 10);
      });
      var payload = {
        template_id: dok.template_id ? parseInt(dok.template_id, 10) : 0,
        kontekst: kontekst,
        broj_stranice_paragraf_id: dok.broj_stranice_paragraf_id ? parseInt(dok.broj_stranice_paragraf_id, 10) : null,
        stavke: stavke.map(function (s) {
          return {
            redoslijed: s.redoslijed, zona: s.zona, okvir_id: s.okvir_id, vrsta: s.vrsta,
            izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id,
            kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id,
            trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost,
            literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id,
            bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke,
            preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti,
            format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, fiksna_pozicija_y: s.fiksna_pozicija_y, sakrij_ako_prazno: s.sakrij_ako_prazno,
            relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator,
            redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold, podatak_paragraf_id: s.podatak_paragraf_id, tablica_stil_id: s.tablica_stil_id,
            zadrzi_svoj_stil: s.zadrzi_svoj_stil, prijelom_prije: s.prijelom_prije, prijelom_poslije: s.prijelom_poslije,
            prazno_nacin: s.prazno_nacin, skupina: s.skupina, prefiks: s.prefiks, sufiks: s.sufiks
          };
        })
      };
      _zauzet = true;
      postaviInfo('Dohvaćam…');
      postJson(API_BASE + 'PDF_Generator_resolve.php', payload, function (res) {
        var model;
        try { model = JSON.parse(res); } catch (e) { krajRendera('Greška dohvata modela.'); return; }
        if (!model || model.greska) { krajRendera('Greška: ' + ((model && model.greska) || 'nepoznata')); return; }
        postaviInfo('Pripremam slike…');
        window.PdfRender.pripremiSlike(model, function (model) {
          postaviInfo('Gradim PDF…');
          var dd = window.PdfRender.sastaviDocDefinition(model, { proredStilId: _proredStilId });
          window.PdfRender.Pdf.ucitaj(function () {
            ucitajFontove(model.fontovi, function () {
              try {
                pdfMake.createPdf(dd).getDataUrl(function (dataUrl) { ocistiIframe(); okvir.src = dataUrl; krajRendera(''); });
              } catch (e) { krajRendera('Greška pri renderu: ' + e); }
            }, function () { krajRendera('Greška pri učitavanju fontova.'); });
          }, function () { krajRendera('Greška pri učitavanju pdfmake biblioteke.'); });
        });
      });
    }

    function ucitajDokumentIRenderiraj() {
      spinerShow();
      postaviInfo('Učitavam dokument…');
      var url = API_BASE + 'PDF_Dokument_po_nazivu.php?naziv=' + encodeURIComponent(_naziv);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var data = null;
        try { data = JSON.parse((xhr.responseText || '').replace(/^﻿/, '').trim()); } catch (e) {}
        if (!data || data.greska || !data.dokument) { krajRendera('Dokument „' + _naziv + '" nije pronađen.'); return; }
        _dokument = data;
        _proredStilId = data.dokument.dokument_prored_default_stil ? parseInt(data.dokument.dokument_prored_default_stil, 10) : null;
        renderiraj();
      };
      xhr.send();
    }

    /* Otvori modal za zadani dokument (001a ili 001) — dijeli iframe; state pamti koji je aktivan. */
    function otvoriZaDokument(naziv, naslov, btn) {
      if (btn && btn.disabled) return;
      if (_obrazac001RowId == null) return;
      _naziv = naziv;
      _izvorBtn = btn;
      if (naslovEl) naslovEl.textContent = naslov;
      _idAktivni = parseInt(_obrazac001RowId, 10);
      otvoriModal();
      ucitajDokumentIRenderiraj();
    }
    obrPdfBtn.addEventListener('click', function () { otvoriZaDokument('Obrazac 001 a', 'PDF Obrasca 001a', obrPdfBtn); });
    if (obr1bPdfBtn) obr1bPdfBtn.addEventListener('click', function () { otvoriZaDokument('Obrazac 001', 'PDF Obrasca 001', obr1bPdfBtn); });
    if (btnRefresh)  btnRefresh.addEventListener('click', function () { ucitajDokumentIRenderiraj(); });
    if (btnPovratak) btnPovratak.addEventListener('click', zatvoriModal);
    if (overlay)     overlay.addEventListener('click', zatvoriModal);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && modal.classList.contains('kandidat-dokumenti-crud__modal-pdf--open')) zatvoriModal();
    });
  }());

  /* ============================================================
   * ▒▒ SKENOVI (tab „Skenovi", 1:N) — BLOB PDF skenovi kandidata ▒▒
   * Lijevo (2/3): tablica postojećih („Tip, bilješka"). Desno (1/3): tip + bilješka + ➕ (file-picker) / 🗑 / ✳ / 📄 pregled.
   * ============================================================ */
  var SKENOVI_TABLICA = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'kandidat-dokumenti-crud',
    Tablica_Zaglavlje: [
      { key: 'sadrzaj', title: 'Postojeći sadržaj', SQL_Naziv: 'sadrzaj', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var skenoviApi = null;
  var _skenoviTipoviUcitani = false;
  var _skenoviEnabled = false;
  var SKEN_MAX_BYTES = 16 * 1024 * 1024;   /* klijentska granica 16 MB */
  var skenTipSel = document.getElementById('sken_tip');
  var _skenTipVal = '';   /* zadnji odabrani tip skena (uhvaćen na 'change' — pouzdaniji od kasnijeg .value) */
  var _skenoviData = [];  /* [{id, id_sken_tip, biljeska}] — za popunu kontrola na selekciju */
  var skenBiljeska = document.getElementById('sken_biljeska');
  var skenFileInp = document.getElementById('sken_file');
  var skenDodajBtn = document.getElementById('skenDodaj');
  var skenUrediBtn = document.getElementById('skenUredi');
  var skenObrisiBtn = document.getElementById('skenObrisi');
  var skenDeselektBtn = document.getElementById('skenDeselekt');
  var skenPdfBtn = document.getElementById('skenPdf');

  CommonCRUD.initTablica('skenoviTablicaContainer', SKENOVI_TABLICA, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },   /* redak = [sadrzaj, id] */
    onReady: function (api) { skenoviApi = api; },
    onSelectionChange: function () { onSkenSelekcija(); }
  });

  function skenSelId() { return skenoviApi ? CommonCRUD.getSelectedRowId(skenoviApi) : null; }
  function skenRedById(id) {
    for (var i = 0; i < _skenoviData.length; i++) { if (String(_skenoviData[i].id) === String(id)) return _skenoviData[i]; }
    return null;
  }
  /* Selekcija retka → puni „Tip" + „Bilješka"; deselekt (rec=null) ih čisti. */
  function postaviSkenKontrole(rec) {
    _skenTipVal = rec && rec.id_sken_tip != null ? String(rec.id_sken_tip) : '';
    if (skenTipSel) {
      skenTipSel.value = _skenTipVal;
      if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('sken_tip'); } catch (e) {} }
    }
    if (skenBiljeska) skenBiljeska.value = rec && rec.biljeska != null ? rec.biljeska : '';
    azurirajSkenDodaj();
  }
  function onSkenSelekcija() {
    var id = skenSelId();
    postaviSkenKontrole(id != null ? skenRedById(id) : null);
    azurirajSkenIkone();
  }
  /* Inline ✏ „Izmijeni": snima tip + bilješku selektiranog skena (_izmjena.php; BLOB se ne dira). */
  function spremiSkenSelektirani() {
    var id = skenSelId(); if (id == null) return;
    var tip = _skenTipVal !== '' ? _skenTipVal : (skenTipSel ? trim(skenTipSel.value) : '');
    if (tip === '') { skenPorukaOk('105'); return; }   /* tip je obavezan */
    var fd = new FormData();
    fd.append('id', String(id));
    fd.append('id_sken_tip', tip);
    fd.append('biljeska', skenBiljeska ? skenBiljeska.value : '');
    fetch(API_BASE + 'Kandidat_Dokumenti_Sken_CRUD_izmjena.php', { method: 'POST', body: fd })
      .then(function (r) { return r.text(); }).then(function (res) {
        if ((res || '').trim() === 'OK') { skenPorukaOk('004'); ucitajSkenovi(getSelectedRowId()); } else skenPorukaKod(res);
      }).catch(function () {});
  }
  function skenPorukaKod(res) {
    var s = (res || '').trim(); if (s === '' || s === 'OK') return;
    var idx = s.indexOf(','); var code = idx < 0 ? s : s.slice(0, idx); var repl = idx < 0 ? [] : [s.slice(idx + 1)];
    if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(code, repl);
  }
  function skenPorukaOk(code) { if (typeof window.showPorukaModal === 'function') window.showPorukaModal(code, []); }

  function azurirajSkenIkone() {
    var imaSel = skenSelId() != null;
    if (skenUrediBtn) skenUrediBtn.disabled = !(_skenoviEnabled && imaSel);
    if (skenObrisiBtn) skenObrisiBtn.disabled = !(_skenoviEnabled && imaSel);
    if (skenDeselektBtn) skenDeselektBtn.disabled = !(_skenoviEnabled && imaSel);
    if (skenPdfBtn) skenPdfBtn.disabled = !imaSel;   /* pregled samo treba selekciju (neovisno o edit-modu) */
  }
  function azurirajSkenDodaj() {
    var tipOk = skenTipSel && trim(skenTipSel.value) !== '';
    if (skenDodajBtn) skenDodajBtn.disabled = !(_skenoviEnabled && tipOk);   /* + aktivan tek kad je izabran tip */
  }

  function popuniSkenTipove(cb) {
    if (_skenoviTipoviUcitani) { if (cb) cb(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Kandidat_Dokumenti_Sken_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var arr = []; var t = (xhr.responseText || '').trim();
      if (t.charAt(0) === '[') { try { arr = JSON.parse(t); } catch (e) { arr = []; } }
      if (skenTipSel) {
        while (skenTipSel.options.length) skenTipSel.remove(0);
        var ph = document.createElement('option'); ph.value = ''; ph.textContent = '— Odaberi tip dokumenta —'; skenTipSel.appendChild(ph);
        arr.forEach(function (o) { var op = document.createElement('option'); op.value = String(o.id); op.textContent = o.naziv != null ? o.naziv : ('#' + o.id); skenTipSel.appendChild(op); });
        skenTipSel.value = ''; _skenTipVal = '';   /* placeholder — ne postavljati na prvi tip */
        if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('sken_tip'); } catch (e) {} }
      }
      _skenoviTipoviUcitani = true;
      azurirajSkenDodaj();
      if (cb) cb();
    };
    xhr.send();
  }

  function ucitajSkenovi(idClan) {
    popuniSkenTipove();
    if (skenoviApi && skenoviApi.clearSelection) skenoviApi.clearSelection();
    if (!idClan) { if (skenoviApi) CommonCRUD.setDataTablica(skenoviApi, 'skenoviTablicaContainer', [], SKENOVI_TABLICA.Tablica_Zaglavlje); azurirajSkenIkone(); return; }
    fetch(API_BASE + 'Kandidat_Dokumenti_Sken_CRUD_sve.php?id_clan=' + encodeURIComponent(idClan))
      .then(function (r) { return r.text(); }).then(function (t) {
        t = (t || '').trim(); var arr = [];
        if (t.charAt(0) === '[') { try { arr = JSON.parse(t); } catch (e) { arr = []; } }
        _skenoviData = arr.map(function (o) { return { id: o.id, id_sken_tip: o.id_sken_tip, biljeska: o.biljeska }; });
        var rows = arr.map(function (o) {
          var tip = o.tip_naziv != null ? o.tip_naziv : '';
          var bil = (o.biljeska != null && trim(o.biljeska) !== '') ? o.biljeska : '';
          return [bil ? (tip + ', ' + bil) : tip, o.id];
        });
        if (skenoviApi) CommonCRUD.setDataTablica(skenoviApi, 'skenoviTablicaContainer', rows, SKENOVI_TABLICA.Tablica_Zaglavlje);
        azurirajSkenIkone();
      }).catch(function () {});
  }

  function skenoviSetEnabled(on) {
    _skenoviEnabled = !!on;
    if (skenTipSel) { skenTipSel.disabled = !on; if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('sken_tip'); } catch (e) {} } }
    if (skenBiljeska) skenBiljeska.disabled = !on;
    /* labele prate svoje kontrole (enable/disable zajedno) */
    var lblTip = document.querySelector('label[for="sken_tip"]');
    var lblBil = document.querySelector('label[for="sken_biljeska"]');
    if (lblTip) lblTip.classList.toggle('kontrola-labela--disabled', !on);
    if (lblBil) lblBil.classList.toggle('kontrola-labela--disabled', !on);
    var cont = document.getElementById('skenoviTablicaContainer');
    if (cont) cont.classList.toggle('kontrola-tablica--disabled', !on);
    azurirajSkenDodaj();   /* + ovisi o on I izabranom tipu */
    azurirajSkenIkone();
  }

  if (skenTipSel) skenTipSel.addEventListener('change', function () { _skenTipVal = trim(skenTipSel.value); azurirajSkenDodaj(); });   /* izbor tipa → capture + + enable/disable */
  if (skenUrediBtn) skenUrediBtn.addEventListener('click', function () {
    if (skenUrediBtn.disabled) return;
    spremiSkenSelektirani();   /* snima tip + bilješku selektiranog skena */
  });
  if (skenDodajBtn) skenDodajBtn.addEventListener('click', function () {
    if (skenDodajBtn.disabled || getSelectedRowId() == null) return;   /* + je disabled dok tip nije izabran */
    if (skenFileInp) { skenFileInp.value = ''; skenFileInp.click(); }
  });

  if (skenFileInp) skenFileInp.addEventListener('change', function () {
    var f = skenFileInp.files && skenFileInp.files[0];
    if (!f) return;
    var idClan = getSelectedRowId();
    if (idClan == null) { skenFileInp.value = ''; return; }
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { skenPorukaOk('038'); skenFileInp.value = ''; return; }   /* nije PDF → obavijest */
    if (f.size > SKEN_MAX_BYTES) { skenPorukaOk('105'); skenFileInp.value = ''; return; }   /* prevelik */
    var fd = new FormData();
    fd.append('id_clan', String(idClan));
    fd.append('id_sken_tip', _skenTipVal !== '' ? _skenTipVal : (skenTipSel ? String(skenTipSel.value) : ''));
    fd.append('biljeska', skenBiljeska ? skenBiljeska.value : '');
    fd.append('podatak', f, f.name);
    if (skenDodajBtn) skenDodajBtn.disabled = true;
    fetch(API_BASE + 'Kandidat_Dokumenti_Sken_CRUD_upis.php', { method: 'POST', body: fd })
      .then(function (r) { return r.text(); }).then(function (res) {
        skenFileInp.value = '';
        if (skenDodajBtn) skenDodajBtn.disabled = !_skenoviEnabled;
        if ((res || '').trim() === 'OK') {
          if (skenBiljeska) skenBiljeska.value = '';
          _skenTipVal = '';
          if (skenTipSel) { skenTipSel.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('sken_tip'); } catch (e) {} } }   /* tip natrag na placeholder */
          azurirajSkenDodaj();   /* → + ponovno disabled dok se ne izabere novi tip */
          skenPorukaOk('001'); ucitajSkenovi(getSelectedRowId());
        }
        else skenPorukaKod(res);
      }).catch(function () { skenFileInp.value = ''; if (skenDodajBtn) skenDodajBtn.disabled = !_skenoviEnabled; });
  });

  if (skenObrisiBtn) skenObrisiBtn.addEventListener('click', function () {
    var id = skenSelId(); if (id == null) return;
    var fd = new FormData(); fd.append('id', String(id));
    fetch(API_BASE + 'Kandidat_Dokumenti_Sken_CRUD_brisanje.php', { method: 'POST', body: fd })
      .then(function (r) { return r.text(); }).then(function (res) {
        if ((res || '').trim() === 'OK') { skenPorukaOk('003'); ucitajSkenovi(getSelectedRowId()); } else skenPorukaKod(res);
      }).catch(function () {});
  });

  if (skenDeselektBtn) skenDeselektBtn.addEventListener('click', function () {
    if (skenoviApi && skenoviApi.clearSelection) skenoviApi.clearSelection();
    onSkenSelekcija();   /* očisti i „Tip" + „Bilješka", ne samo ikone */
  });

  /* Pregled skena: X-Frame-Options DENY (.htaccess) blokira iframe sa servera, pa PDF dohvaćamo kao
     Blob i prikazujemo preko object URL-a (blob: nije podložan X-Frame-Options — kao pdfmake data URL). */
  (function () {
    var modal = document.getElementById('skenModalPdf');
    if (!modal || !skenPdfBtn) return;
    var overlay = modal.querySelector('.kandidat-dokumenti-crud__modal-pdf-overlay');
    var okvir = document.getElementById('sken_pdf_okvir');
    var povratak = document.getElementById('sken_pdf_povratak');
    var _objUrl = null;
    function ocistiUrl() { if (_objUrl) { try { URL.revokeObjectURL(_objUrl); } catch (e) {} _objUrl = null; } }
    function zatvori() {
      modal.classList.remove('kandidat-dokumenti-crud__modal-pdf--open'); modal.setAttribute('aria-hidden', 'true');
      if (okvir) okvir.removeAttribute('src');
      ocistiUrl();
      try { skenPdfBtn.focus(); } catch (e) {}
    }
    skenPdfBtn.addEventListener('click', function () {
      if (skenPdfBtn.disabled) return;
      var id = skenSelId(); if (id == null) return;
      modal.classList.add('kandidat-dokumenti-crud__modal-pdf--open'); modal.setAttribute('aria-hidden', 'false');
      fetch(API_BASE + 'Kandidat_Dokumenti_Sken_CRUD_dokument.php?id=' + encodeURIComponent(id))
        .then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (blob) {
          ocistiUrl();
          if (blob) { _objUrl = URL.createObjectURL(blob); if (okvir) okvir.src = _objUrl; }
          else if (okvir) okvir.removeAttribute('src');
        }).catch(function () {});
    });
    if (povratak) povratak.addEventListener('click', zatvori);
    if (overlay) overlay.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('kandidat-dokumenti-crud__modal-pdf--open')) zatvori(); });
  })();

  skenoviSetEnabled(false);   /* početno stanje (nema izabranog kandidata) */

  /* ============================================================
   * ▒▒ ZAPISNICI (tab „Zapisnici", 1:N) — vezani zapisnici s radova kandidata ▒▒
   * Lijevo (2/3): tablica vezanih. Desno (1/3): tip + bilješka + ➕ (izbor-modal) / 🗑 / ✳ / 📄 pregled.
   * ============================================================ */
  var ZAPISNICI_TABLICA = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'kandidat-dokumenti-crud',
    Tablica_Zaglavlje: [
      { key: 'sadrzaj', title: 'Postojeći zapisnik', SQL_Naziv: 'sadrzaj', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var zapisniciApi = null;
  var _zapisniciTipoviUcitani = false;
  var _zapisniciEnabled = false;
  var _zapisniciData = [];   /* [{id, id_zapisnik}] — mapiranje selekcije retka → id zapisnika (za PDF) */
  var zapisnikTipSel = document.getElementById('zapisnik_tip');
  var _zapisnikTipVal = '';   /* zadnji odabrani tip (uhvaćen na 'change' — pouzdaniji od kasnijeg čitanja .value) */
  var zapisnikBiljeska = document.getElementById('zapisnik_biljeska');
  var zapisnikDodajBtn = document.getElementById('zapisnikDodaj');
  var zapisnikUrediBtn = document.getElementById('zapisnikUredi');
  var zapisnikObrisiBtn = document.getElementById('zapisnikObrisi');
  var zapisnikDeselektBtn = document.getElementById('zapisnikDeselekt');
  var zapisnikPdfBtn = document.getElementById('zapisnikPdf');
  var otvoriZapisnikIzborModal = function () {};   /* postavlja IIFE modala */
  var otvoriZapisnikPdf = function () {};          /* postavlja IIFE PDF-pregleda */

  CommonCRUD.initTablica('zapisniciTablicaContainer', ZAPISNICI_TABLICA, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : null; },   /* redak = [sadrzaj, id] */
    onReady: function (api) { zapisniciApi = api; },
    onSelectionChange: function () { onZapisnikSelekcija(); }
  });

  function zapisnikSelId() { return zapisniciApi ? CommonCRUD.getSelectedRowId(zapisniciApi) : null; }
  /* „Izmjeni" (footer) na tabu Zapisnici: snima tip + bilješku selektiranog reda u tablicu. */
  function spremiZapisnikSelektirani() {
    var id = zapisnikSelId(); if (id == null) return;
    var tip = _zapisnikTipVal !== '' ? _zapisnikTipVal : (zapisnikTipSel ? trim(zapisnikTipSel.value) : '');
    if (tip === '') { zapisnikPorukaOk('105'); return; }   /* tip je obavezan */
    var fd = new FormData();
    fd.append('id', String(id));
    fd.append('id_zapisnik_tip', tip);
    fd.append('biljeska', zapisnikBiljeska ? zapisnikBiljeska.value : '');
    fetch(API_BASE + 'Kandidat_Dokumenti_Zapisnik_CRUD_izmjena.php', { method: 'POST', body: fd })
      .then(function (r) { return r.text(); }).then(function (res) {
        if ((res || '').trim() === 'OK') { zapisnikPorukaOk('004'); ucitajZapisnici(getSelectedRowId()); } else zapisnikPorukaKod(res);
      }).catch(function () {});
  }
  function zapisnikSelZapisnikId() {
    var id = zapisnikSelId(); if (id == null) return null;
    for (var i = 0; i < _zapisniciData.length; i++) { if (String(_zapisniciData[i].id) === String(id)) return _zapisniciData[i].id_zapisnik; }
    return null;
  }
  function zapisnikPorukaKod(res) {
    var s = (res || '').trim(); if (s === '' || s === 'OK') return;
    var idx = s.indexOf(','); var code = idx < 0 ? s : s.slice(0, idx); var repl = idx < 0 ? [] : [s.slice(idx + 1)];
    if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(code, repl);
  }
  function zapisnikPorukaOk(code) { if (typeof window.showPorukaModal === 'function') window.showPorukaModal(code, []); }

  function azurirajZapisnikIkone() {
    var imaSel = zapisnikSelId() != null;
    if (zapisnikUrediBtn) zapisnikUrediBtn.disabled = !(_zapisniciEnabled && imaSel);
    if (zapisnikObrisiBtn) zapisnikObrisiBtn.disabled = !(_zapisniciEnabled && imaSel);
    if (zapisnikDeselektBtn) zapisnikDeselektBtn.disabled = !(_zapisniciEnabled && imaSel);
    if (zapisnikPdfBtn) zapisnikPdfBtn.disabled = !imaSel;   /* pregled treba samo selekciju */
  }
  function azurirajZapisnikDodaj() {
    var tipOk = zapisnikTipSel && trim(zapisnikTipSel.value) !== '';
    if (zapisnikDodajBtn) zapisnikDodajBtn.disabled = !(_zapisniciEnabled && tipOk);   /* + tek kad je izabran tip */
  }

  function zapisnikRedById(id) {
    for (var i = 0; i < _zapisniciData.length; i++) { if (String(_zapisniciData[i].id) === String(id)) return _zapisniciData[i]; }
    return null;
  }
  /* Selekcija retka → puni „Tip zapisnika" + „Bilješka" vrijednostima reda; deselekt (rec=null) ih čisti. */
  function postaviZapisnikKontrole(rec) {
    _zapisnikTipVal = rec && rec.id_zapisnik_tip != null ? String(rec.id_zapisnik_tip) : '';
    if (zapisnikTipSel) {
      zapisnikTipSel.value = _zapisnikTipVal;
      if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('zapisnik_tip'); } catch (e) {} }
    }
    if (zapisnikBiljeska) zapisnikBiljeska.value = rec && rec.biljeska != null ? rec.biljeska : '';
    azurirajZapisnikDodaj();
  }
  function onZapisnikSelekcija() {
    var id = zapisnikSelId();
    postaviZapisnikKontrole(id != null ? zapisnikRedById(id) : null);
    azurirajZapisnikIkone();
    updateCrudState();   /* footer „Upis"/„Izmjeni" ovisi o selekciji zapisnika */
  }

  function popuniZapisnikTipove(cb) {
    if (_zapisniciTipoviUcitani) { if (cb) cb(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Kandidat_Dokumenti_Zapisnik_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var arr = []; var t = (xhr.responseText || '').trim();
      if (t.charAt(0) === '[') { try { arr = JSON.parse(t); } catch (e) { arr = []; } }
      if (zapisnikTipSel) {
        while (zapisnikTipSel.options.length) zapisnikTipSel.remove(0);
        var ph = document.createElement('option'); ph.value = ''; ph.textContent = '— Odaberi tip zapisnika —'; zapisnikTipSel.appendChild(ph);
        arr.forEach(function (o) { var op = document.createElement('option'); op.value = String(o.id); op.textContent = o.naziv != null ? o.naziv : ('#' + o.id); zapisnikTipSel.appendChild(op); });
        zapisnikTipSel.value = ''; _zapisnikTipVal = '';
        if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('zapisnik_tip'); } catch (e) {} }
      }
      _zapisniciTipoviUcitani = true;
      azurirajZapisnikDodaj();
      if (cb) cb();
    };
    xhr.send();
  }

  function fmtDatumZapisnik(d) {
    if (!d) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
    return m ? (m[3] + '.' + m[2] + '.' + m[1]) : String(d);
  }
  /* Redak tab-tablice: „{datum}, {stupanj°}, {stupanj_naziv}, {tip}[, {bilješka}]" (prazna bilješka → bez zadnjeg zareza). */
  function zapisnikRedakTekst(o) {
    var parts = [];
    var datum = fmtDatumZapisnik(o.datum_radova);
    if (datum) parts.push(datum);
    if (o.stupanj_broj != null && o.stupanj_broj !== '') parts.push(String(o.stupanj_broj) + '°');
    if (o.stupanj_naziv) parts.push(o.stupanj_naziv);
    if (o.tip_naziv) parts.push(o.tip_naziv);
    var bil = (o.biljeska != null && trim(o.biljeska) !== '') ? trim(o.biljeska) : '';
    if (bil) parts.push(bil);
    return parts.join(', ');
  }

  function ucitajZapisnici(idClan) {
    popuniZapisnikTipove();
    if (zapisniciApi && zapisniciApi.clearSelection) zapisniciApi.clearSelection();
    _zapisniciData = [];
    if (!idClan) { if (zapisniciApi) CommonCRUD.setDataTablica(zapisniciApi, 'zapisniciTablicaContainer', [], ZAPISNICI_TABLICA.Tablica_Zaglavlje); azurirajZapisnikIkone(); return; }
    fetch(API_BASE + 'Kandidat_Dokumenti_Zapisnik_CRUD_sve.php?id_clan=' + encodeURIComponent(idClan))
      .then(function (r) { return r.text(); }).then(function (t) {
        t = (t || '').trim(); var arr = [];
        if (t.charAt(0) === '[') { try { arr = JSON.parse(t); } catch (e) { arr = []; } }
        _zapisniciData = arr.map(function (o) { return { id: o.id, id_zapisnik: o.id_zapisnik, id_zapisnik_tip: o.id_zapisnik_tip, biljeska: o.biljeska }; });
        var rows = arr.map(function (o) { return [zapisnikRedakTekst(o), o.id]; });
        if (zapisniciApi) CommonCRUD.setDataTablica(zapisniciApi, 'zapisniciTablicaContainer', rows, ZAPISNICI_TABLICA.Tablica_Zaglavlje);
        azurirajZapisnikIkone();
      }).catch(function () {});
  }

  function zapisniciSetEnabled(on) {
    _zapisniciEnabled = !!on;
    if (zapisnikTipSel) { zapisnikTipSel.disabled = !on; if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('zapisnik_tip'); } catch (e) {} } }
    if (zapisnikBiljeska) zapisnikBiljeska.disabled = !on;
    var lblTip = document.querySelector('label[for="zapisnik_tip"]');
    var lblBil = document.querySelector('label[for="zapisnik_biljeska"]');
    if (lblTip) lblTip.classList.toggle('kontrola-labela--disabled', !on);
    if (lblBil) lblBil.classList.toggle('kontrola-labela--disabled', !on);
    var cont = document.getElementById('zapisniciTablicaContainer');
    if (cont) cont.classList.toggle('kontrola-tablica--disabled', !on);
    azurirajZapisnikDodaj();
    azurirajZapisnikIkone();
  }

  if (zapisnikTipSel) zapisnikTipSel.addEventListener('change', function () { _zapisnikTipVal = trim(zapisnikTipSel.value); azurirajZapisnikDodaj(); });

  if (zapisnikDodajBtn) zapisnikDodajBtn.addEventListener('click', function () {
    if (zapisnikDodajBtn.disabled || getSelectedRowId() == null) return;   /* + je disabled dok tip nije izabran */
    otvoriZapisnikIzborModal();
  });

  if (zapisnikObrisiBtn) zapisnikObrisiBtn.addEventListener('click', function () {
    var id = zapisnikSelId(); if (id == null) return;
    var fd = new FormData(); fd.append('id', String(id));
    fetch(API_BASE + 'Kandidat_Dokumenti_Zapisnik_CRUD_brisanje.php', { method: 'POST', body: fd })
      .then(function (r) { return r.text(); }).then(function (res) {
        if ((res || '').trim() === 'OK') { zapisnikPorukaOk('003'); ucitajZapisnici(getSelectedRowId()); } else zapisnikPorukaKod(res);
      }).catch(function () {});
  });

  if (zapisnikUrediBtn) zapisnikUrediBtn.addEventListener('click', function () {
    if (zapisnikUrediBtn.disabled) return;
    spremiZapisnikSelektirani();   /* snima tip + bilješku selektiranog reda (_izmjena.php) */
  });

  if (zapisnikDeselektBtn) zapisnikDeselektBtn.addEventListener('click', function () {
    if (zapisniciApi && zapisniciApi.clearSelection) zapisniciApi.clearSelection();
    onZapisnikSelekcija();   /* očisti i „Tip zapisnika" + „Bilješka", ne samo ikone */
  });

  if (zapisnikPdfBtn) zapisnikPdfBtn.addEventListener('click', function () {
    if (zapisnikPdfBtn.disabled) return;
    var zid = zapisnikSelZapisnikId();
    if (zid != null) otvoriZapisnikPdf(zid);
  });

  /* ===== Izbor-modal „Postojeći zapisnik" (klon zapisnikListaModal; OK/Odustani; per-red PDF + sažetak) =====
     Napuštanje SAMO tipkama OK/Odustani — bez overlay/Escape zatvaranja. */
  (function initZapisnikIzborModal() {
    var modal = document.getElementById('kandidatZapisnikListaModal');
    if (!modal) return;
    var traziInp = document.getElementById('kandidat_zapisnik_lista_trazi');
    var traziClear = modal.querySelector('.kontrola-edit-delete__clear');
    var scrollEl = document.getElementById('kandidat_zapisnik_lista_scroll');
    var tbody = document.getElementById('kandidat_zapisnik_lista_tbody');
    var okBtn = document.getElementById('kandidat_zapisnik_lista_ok');
    var odustaniBtn = document.getElementById('kandidat_zapisnik_lista_odustani');
    var LIMIT = 50;
    var _loading = false, _offset = 0, _hasMore = true, _trazi = '', _selId = null, _traziT = null, _boje = {}, _sazHideT = null, _legBojeUcitane = false;

    function bojaToStyle(c) {
      var s = String(c || '').trim().replace(/^#/, '');
      if (s.length === 8) {
        var r = parseInt(s.slice(0,2),16), g = parseInt(s.slice(2,4),16), b = parseInt(s.slice(4,6),16), a = parseInt(s.slice(6,8),16)/255;
        if (!isNaN(r+g+b+a)) return 'rgba('+r+','+g+','+b+','+a.toFixed(3)+')';
      }
      if (s.length === 6) return '#'+s;
      return '';
    }
    function primijeniLegendBoje() {
      var kv1 = document.getElementById('kandidat_zapisnik_lista_leg_kv1');
      var kv2 = document.getElementById('kandidat_zapisnik_lista_leg_kv2');
      var kv3 = document.getElementById('kandidat_zapisnik_lista_leg_kv3');
      if (kv1 && _boje.kv1) kv1.style.backgroundColor = bojaToStyle(_boje.kv1);
      if (kv2 && _boje.kv2) kv2.style.backgroundColor = bojaToStyle(_boje.kv2);
      if (kv3 && _boje.kv3) kv3.style.backgroundColor = bojaToStyle(_boje.kv3);
    }
    /* Neovisan dohvat boja legende (id 1/2/3) — da legenda bude obojana i kad je tablica prazna.
       Mapiranje kao u referenci: id1→leg_kv2, id2→leg_kv3, id3→leg_kv1 (swatch = stupac `boja`). */
    function ucitajLegendBoje() {
      if (_legBojeUcitane) return;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', API_BASE + 'Zapisnik_Boje_U_Listi_CRUD_sve.php', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var arr = []; var t = (xhr.responseText || '').trim();
        if (t.charAt(0) === '[') { try { arr = JSON.parse(t); } catch (e) { arr = []; } }
        var byId = {}; arr.forEach(function (o) { byId[String(o.id)] = o; });
        var mapa = { kandidat_zapisnik_lista_leg_kv2: byId['1'], kandidat_zapisnik_lista_leg_kv3: byId['2'], kandidat_zapisnik_lista_leg_kv1: byId['3'] };
        var ima = false;
        Object.keys(mapa).forEach(function (elId) {
          var el = document.getElementById(elId); var o = mapa[elId];
          if (el && o && o.boja) { el.style.backgroundColor = bojaToStyle(o.boja); ima = true; }
        });
        if (ima) _legBojeUcitane = true;
      };
      xhr.send();
    }
    function formatRed(row) {
      var parts = [];
      var datum = fmtDatumZapisnik(row.datum_radova);
      if (datum) parts.push(datum);
      if (row.stupanj_broj != null) parts.push(String(row.stupanj_broj) + '°');
      if (row.stupanj_naziv) parts.push(row.stupanj_naziv);
      if (!row.je_domacin && row.nosioc_naziv) parts.push('(Nosioc: ' + row.nosioc_naziv + ')');
      return parts.join(', ');
    }
    function sazetakSakrij() {
      if (_sazHideT) { clearTimeout(_sazHideT); _sazHideT = null; }
      var popup = document.getElementById('kandidatZapisnikSazetakPopup');
      if (popup) popup.hidden = true;
    }
    function sazetakPokazi(tekst, btn) {
      if (_sazHideT) { clearTimeout(_sazHideT); _sazHideT = null; }
      var popup = document.getElementById('kandidatZapisnikSazetakPopup');
      if (!popup) return;
      var t = document.getElementById('kandidat_zapisnik_sazetak_popup_tekst');
      if (t) t.textContent = tekst || '—';
      popup.hidden = false;
      popup.style.left = '-9999px'; popup.style.top = '-9999px';
      var pw = popup.offsetWidth || 280, ph = popup.offsetHeight || 120;
      var rect = btn.getBoundingClientRect();
      var vw = window.innerWidth || 800, vh = window.innerHeight || 600;
      var left = rect.left - pw - 6; if (left < 4) left = rect.right + 6; if (left + pw > vw - 4) left = vw - pw - 4;
      var top = rect.top; if (top + ph > vh - 4) top = vh - ph - 4; if (top < 4) top = 4;
      popup.style.left = left + 'px'; popup.style.top = top + 'px';
    }
    function azurirajOk() { if (okBtn) okBtn.disabled = (_selId == null); }
    function odaberiRed(tr, id) {
      var prev = tbody ? tbody.querySelector('tr.kandidat-dokumenti-crud__lista-red--sel') : null;
      if (prev) prev.classList.remove('kandidat-dokumenti-crud__lista-red--sel');
      if (tr) tr.classList.add('kandidat-dokumenti-crud__lista-red--sel');
      _selId = id;
      azurirajOk();
    }

    function dodajRedove(arr) {
      if (!tbody) return;
      for (var j = 0; j < arr.length; j++) {
        var row = arr[j];
        if (!row || row.id == null) continue;
        var trM = document.createElement('tr');
        var td = document.createElement('td');
        var wrap = document.createElement('div'); wrap.className = 'esej-crud__lista-red-inner';
        var cel = document.createElement('div'); cel.className = 'kontrola-tablica__cell-inner'; cel.setAttribute('tabindex', '0');
        cel.textContent = formatRed(row);
        var bojaFg = '', bojaBg = '';
        if (!+row.ovjera_poslije_casni || !+row.ovjera_poslije_tajnik || !+row.ovjera_poslije_govornik) { bojaFg = bojaToStyle(row.boja_2); bojaBg = bojaToStyle(row.boja_2_bg); }
        if (!+row.ovjera_prije_casni) { bojaFg = bojaToStyle(row.boja_1); bojaBg = bojaToStyle(row.boja_1_bg); }
        if (!row.je_domacin) { bojaFg = bojaToStyle(row.boja_ucesnica); bojaBg = bojaToStyle(row.boja_ucesnica_bg); }
        if (bojaFg) cel.style.color = bojaFg;
        if (bojaBg) td.style.backgroundColor = bojaBg;
        /* PDF ikona — LIJEVO od elipsisa; ista veličina (dijeli klasu elipsis-btn). */
        var btnPdf = document.createElement('button'); btnPdf.type = 'button';
        btnPdf.className = 'esej-crud__lista-elipsis-btn kandidat-dokumenti-crud__lista-pdf-btn';
        btnPdf.setAttribute('aria-label', 'Pregled zapisnika (PDF)'); btnPdf.title = 'Pregled PDF-a';
        btnPdf.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="5" y="14" width="14" height="6" rx="1" fill="currentColor"/><text x="12" y="18.4" font-family="Arial, sans-serif" font-size="3.8" font-weight="bold" fill="white" text-anchor="middle">PDF</text></svg>';
        /* Elipsis sažetak (ostaje kao u referenci). */
        var btnSaz = document.createElement('button'); btnSaz.type = 'button';
        btnSaz.className = 'esej-crud__lista-elipsis-btn'; btnSaz.setAttribute('aria-label', 'Sažetak radova');
        var spSaz = document.createElement('span'); spSaz.className = 'kontrola-icon--ellipsis-horizontal'; spSaz.setAttribute('aria-hidden', 'true');
        btnSaz.appendChild(spSaz);
        if (!row.sazetak) btnSaz.style.visibility = 'hidden';

        wrap.appendChild(cel); wrap.appendChild(btnPdf); wrap.appendChild(btnSaz);
        td.appendChild(wrap); trM.appendChild(td); tbody.appendChild(trM);

        (function (rowRef, trRef, bSaz, bPdf) {
          cel.addEventListener('click', function () { odaberiRed(trRef, rowRef.id); });
          trRef.addEventListener('dblclick', function () { odaberiRed(trRef, rowRef.id); if (okBtn && !okBtn.disabled) okBtn.click(); });
          if (bSaz) {
            bSaz.addEventListener('mouseenter', function () { if (rowRef.sazetak) sazetakPokazi(rowRef.sazetak, bSaz); });
            bSaz.addEventListener('mouseleave', function () { _sazHideT = setTimeout(sazetakSakrij, 150); });
            bSaz.addEventListener('click', function (e) { e.stopPropagation(); if (rowRef.sazetak) sazetakPokazi(rowRef.sazetak, bSaz); });
          }
          bPdf.addEventListener('click', function (e) {
            e.stopPropagation();
            var zid = rowRef.id_zapisnik != null ? rowRef.id_zapisnik : rowRef.id;
            if (zid != null) otvoriZapisnikPdf(zid);
          });
        })(row, trM, btnSaz, btnPdf);
      }
    }

    /* Broj stupnja u pretrazi → egzaktni stupanj: „2", „2.", „2°" (uz razmake) → „2°" (backend traži N°).
       Vrijedi samo za valjane stupnjeve; ostali brojevi (npr. „2222") idu kao obični LIKE (datum i sl.). */
    var STUPNJEVI_VALJANI = [1, 2, 3, 4, 9, 18, 30, 31, 32, 33];
    function normalizirajTrazi(v) {
      var s = trim(v || '');
      var m = /^(\d+)\s*\.?\s*°?\s*$/.exec(s);
      if (m) {
        var n = parseInt(m[1], 10);
        if (STUPNJEVI_VALJANI.indexOf(n) !== -1) return n + '°';
      }
      return s;
    }

    function ucitajRedove(append) {
      if (_loading) return;
      var idLoza = selectLoza ? (selectLoza.value || '') : '';
      if (!idLoza) return;
      _loading = true;
      var traziEff = normalizirajTrazi(_trazi);
      var url = API_BASE + 'Zapisnik_CRUD_lista.php?id_loza=' + encodeURIComponent(idLoza) + '&offset=' + encodeURIComponent(_offset) + '&limit=' + LIMIT;
      if (traziEff) url += '&trazi=' + encodeURIComponent(traziEff);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        _loading = false;
        var arr = [];
        if (xhr.status >= 200 && xhr.status < 300) {
          var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
          if (text.charAt(0) === '[') { try { arr = JSON.parse(text); } catch (e) {} }
          if (!Array.isArray(arr)) arr = [];
        }
        _hasMore = arr.length >= LIMIT;
        if (arr.length > 0) {
          if (arr[0].boja_ucesnica) _boje.kv1 = arr[0].boja_ucesnica;
          if (arr[0].boja_1) _boje.kv2 = arr[0].boja_1;
          if (arr[0].boja_2) _boje.kv3 = arr[0].boja_2;
          primijeniLegendBoje();
        }
        if (!append && tbody) tbody.innerHTML = '';
        dodajRedove(arr);
        _offset += arr.length;
      };
      xhr.send();
    }

    if (scrollEl) scrollEl.addEventListener('scroll', function () {
      sazetakSakrij();
      if (!_hasMore || _loading) return;
      if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 40) ucitajRedove(true);
    });

    function pokreniTrazi() { _offset = 0; _hasMore = true; _selId = null; azurirajOk(); ucitajRedove(false); }
    /* Interakcije pretrage vežemo na PRVO otvaranje (nakon što global init obradi .kontrola-edit-delete),
       kao u referentnom Zapisnik modalu — inače vezanje pri parse-u zna promašiti (X gumb / sync). */
    var _interakcijeVezane = false;
    function veziInterakcije() {
      if (_interakcijeVezane) return;
      _interakcijeVezane = true;
      if (traziInp) {
        traziInp.addEventListener('input', function () {
          _trazi = trim(traziInp.value);
          if (_traziT) clearTimeout(_traziT);
          _traziT = setTimeout(pokreniTrazi, 250);
        });
      }
      var traziWrap = traziInp && traziInp.closest ? traziInp.closest('.kontrola-edit-delete') : null;
      if (traziWrap) {
        if (typeof KontroleInitEditDelete === 'function') { try { KontroleInitEditDelete(traziWrap); } catch (e) {} }
        traziWrap.addEventListener('kontrole-edit-delete-clear', function () { _trazi = ''; pokreniTrazi(); });
        /* Zaglavlje modal-tablice je povlačivo (globalni attachModalTablicaDrag radi preventDefault na mousedown),
           što bi spriječilo fokus na search input. Zaustavi propagaciju da klik u pretragu fokusira/tipka normalno. */
        ['mousedown', 'touchstart'].forEach(function (ev) {
          traziWrap.addEventListener(ev, function (e) { e.stopPropagation(); });
        });
      }
      if (traziClear) traziClear.addEventListener('click', function () { if (traziInp) { traziInp.value = ''; _trazi = ''; pokreniTrazi(); } });
    }

    function zatvori() {
      modal.classList.remove('modal-tablica--open');
      modal.setAttribute('aria-hidden', 'true');
      sazetakSakrij();
      if (tbody) tbody.innerHTML = '';
      _selId = null;
    }
    function otvori() {
      _offset = 0; _hasMore = true; _trazi = ''; _selId = null;
      if (traziInp) traziInp.value = '';
      if (tbody) tbody.innerHTML = '';
      azurirajOk();
      modal.classList.add('modal-tablica--open');
      modal.setAttribute('aria-hidden', 'false');
      veziInterakcije();    /* pretraga: veži na prvom otvaranju */
      ucitajLegendBoje();   /* boje legende neovisno o redovima (i kad je prazno) */
      ucitajRedove(false);
    }
    otvoriZapisnikIzborModal = otvori;

    if (odustaniBtn) odustaniBtn.addEventListener('click', zatvori);
    if (okBtn) okBtn.addEventListener('click', function () {
      if (_selId == null) return;
      var idClan = getSelectedRowId();
      if (idClan == null) return;
      var fd = new FormData();
      fd.append('id_clan', String(idClan));
      fd.append('id_zapisnik_tip', _zapisnikTipVal !== '' ? _zapisnikTipVal : (zapisnikTipSel ? String(zapisnikTipSel.value) : ''));
      fd.append('id_zapisnik', String(_selId));
      fd.append('biljeska', zapisnikBiljeska ? zapisnikBiljeska.value : '');
      okBtn.disabled = true;
      fetch(API_BASE + 'Kandidat_Dokumenti_Zapisnik_CRUD_upis.php', { method: 'POST', body: fd })
        .then(function (r) { return r.text(); }).then(function (res) {
          if ((res || '').trim() === 'OK') {
            if (zapisnikBiljeska) zapisnikBiljeska.value = '';
            _zapisnikTipVal = '';
            if (zapisnikTipSel) { zapisnikTipSel.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('zapisnik_tip'); } catch (e) {} } }
            azurirajZapisnikDodaj();
            zatvori();
            zapisnikPorukaOk('001');
            ucitajZapisnici(getSelectedRowId());
          } else { azurirajOk(); zapisnikPorukaKod(res); }
        }).catch(function () { azurirajOk(); });
    });
  })();

  /* ===== PDF pregled zapisnika (dokument „Zapisnik"; SAMO pregled, bez alata; stog iznad izbor-modala).
     Napuštanje SAMO tipkom „Povratak" — bez overlay/Escape. ===== */
  (function initZapisnikPdfModal() {
    var ZAP_DOK_NAZIV = 'Zapisnik';
    var modal = document.getElementById('kandidatZapisnikPdfModal');
    if (!modal) return;
    var okvir = document.getElementById('kandidat_zapisnik_pdf_okvir');
    var info = document.getElementById('kandidat_zapisnik_pdf_info');
    var spiner = document.getElementById('kandidat_zapisnik_pdf_spiner');
    var povratak = document.getElementById('kandidat_zapisnik_pdf_povratak');
    var _dokument = null, _proredStilId = null, _zapId = null, _zauzet = false;

    function postJson(url, data, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      xhr.onreadystatechange = function () { if (xhr.readyState === 4 && cb) cb(xhr.responseText, xhr.status); };
      xhr.send(JSON.stringify(data));
    }
    function postaviInfo(t) { if (info) info.textContent = t || ''; }
    function spinerShow() { if (typeof KontroleSpinerShow === 'function') KontroleSpinerShow(spiner); }
    function spinerHide() { if (typeof KontroleSpinerHide === 'function') KontroleSpinerHide(spiner); }
    function krajRendera(p) { _zauzet = false; spinerHide(); postaviInfo(p || ''); }
    function ocistiIframe() { if (okvir) { if (okvir._url) { try { URL.revokeObjectURL(okvir._url); } catch (e) {} okvir._url = null; } okvir.removeAttribute('src'); } }
    function zatvoriModal() {
      modal.classList.remove('kandidat-dokumenti-crud__modal-pdf--open');
      modal.setAttribute('aria-hidden', 'true');
      ocistiIframe(); spinerHide(); postaviInfo('');
    }
    function ucitajFontove(lista, cb, err) {
      lista = lista || [];
      if (!lista.length) { cb(); return; }
      var preostalo = lista.length, greska = false;
      lista.forEach(function (f) {
        window.PdfRender.Fontovi.osiguraj(f.kljuc, f.porodica,
          function () { if (--preostalo === 0) { greska ? err() : cb(); } },
          function () { greska = true; if (--preostalo === 0) { err(); } });
      });
    }
    function renderiraj() {
      if (_zauzet) return;
      spinerShow();
      if (!window.PdfRender) { krajRendera('PDF biblioteka nije učitana.'); return; }
      if (!_dokument || !_dokument.dokument) { krajRendera('Dokument „' + ZAP_DOK_NAZIV + '" nije pronađen.'); return; }
      if (_zapId == null) { krajRendera('Zapisnik nije učitan.'); return; }
      var dok = _dokument.dokument;
      var stavke = _dokument.stavke || [];
      var kontekst = {};
      stavke.forEach(function (s) { var k = s.kontekst_kljuc != null ? trim(String(s.kontekst_kljuc)) : ''; if (k !== '') kontekst[k] = parseInt(_zapId, 10); });
      var payload = {
        template_id: dok.template_id ? parseInt(dok.template_id, 10) : 0,
        kontekst: kontekst,
        broj_stranice_paragraf_id: dok.broj_stranice_paragraf_id ? parseInt(dok.broj_stranice_paragraf_id, 10) : null,
        stavke: stavke.map(function (s) {
          return {
            redoslijed: s.redoslijed, zona: s.zona, okvir_id: s.okvir_id, vrsta: s.vrsta,
            izvor_id: s.izvor_id, izvor_tip: s.izvor_tip, izvor_red_id: s.izvor_red_id,
            kontekst_kljuc: s.kontekst_kljuc, test_id: s.test_id,
            trazi_kolona: s.trazi_kolona, trazi_vrijednost: s.trazi_vrijednost,
            literal_tekst: s.literal_tekst, paragraf_id: s.paragraf_id, slika_stil_id: s.slika_stil_id,
            bez_kraja_odlomka: s.bez_kraja_odlomka, naziv_stavke: s.naziv_stavke,
            preko_izvor_id: s.preko_izvor_id, mapa_vrijednosti: s.mapa_vrijednosti,
            format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, fiksna_pozicija_y: s.fiksna_pozicija_y, sakrij_ako_prazno: s.sakrij_ako_prazno,
            relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator,
            redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold, podatak_paragraf_id: s.podatak_paragraf_id, tablica_stil_id: s.tablica_stil_id,
            zadrzi_svoj_stil: s.zadrzi_svoj_stil, prijelom_prije: s.prijelom_prije, prijelom_poslije: s.prijelom_poslije,
            prazno_nacin: s.prazno_nacin, skupina: s.skupina, prefiks: s.prefiks, sufiks: s.sufiks
          };
        })
      };
      _zauzet = true;
      postaviInfo('Dohvaćam…');
      postJson(API_BASE + 'PDF_Generator_resolve.php', payload, function (res) {
        var model;
        try { model = JSON.parse(res); } catch (e) { krajRendera('Greška dohvata modela.'); return; }
        if (!model || model.greska) { krajRendera('Greška: ' + ((model && model.greska) || 'nepoznata')); return; }
        postaviInfo('Pripremam slike…');
        window.PdfRender.pripremiSlike(model, function (model) {
          postaviInfo('Gradim PDF…');
          var dd = window.PdfRender.sastaviDocDefinition(model, { proredStilId: _proredStilId });
          window.PdfRender.Pdf.ucitaj(function () {
            ucitajFontove(model.fontovi, function () {
              try {
                pdfMake.createPdf(dd).getBlob(function (blob) { ocistiIframe(); okvir._url = URL.createObjectURL(blob); okvir.src = okvir._url; krajRendera(''); });
              } catch (e) { krajRendera('Greška pri renderu: ' + e); }
            }, function () { krajRendera('Greška pri učitavanju fontova.'); });
          }, function () { krajRendera('Greška pri učitavanju pdfmake biblioteke.'); });
        });
      });
    }
    function ucitajDokumentIRenderiraj() {
      spinerShow();
      postaviInfo('Učitavam dokument…');
      var xhr = new XMLHttpRequest();
      xhr.open('GET', API_BASE + 'PDF_Dokument_po_nazivu.php?naziv=' + encodeURIComponent(ZAP_DOK_NAZIV), true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var data = null;
        try { data = JSON.parse((xhr.responseText || '').replace(/^﻿/, '').trim()); } catch (e) {}
        if (!data || data.greska || !data.dokument) { krajRendera('Dokument „' + ZAP_DOK_NAZIV + '" nije pronađen.'); return; }
        _dokument = data;
        _proredStilId = data.dokument.dokument_prored_default_stil ? parseInt(data.dokument.dokument_prored_default_stil, 10) : null;
        renderiraj();
      };
      xhr.send();
    }
    otvoriZapisnikPdf = function (zapId) {
      if (zapId == null) return;
      _zapId = parseInt(zapId, 10);
      modal.classList.add('kandidat-dokumenti-crud__modal-pdf--open');
      modal.setAttribute('aria-hidden', 'false');
      ucitajDokumentIRenderiraj();
    };
    if (povratak) povratak.addEventListener('click', zatvoriModal);
  })();

  zapisniciSetEnabled(false);   /* početno stanje (nema izabranog kandidata) */
})();
