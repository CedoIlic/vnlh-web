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
    { id: 'obr_primljen_iniciran', key: 'primljen_iniciran', t: 's' },
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
  /* Spremi Obrazac 001a (upsert po id_clan). */
  function spremiObrazac() {
    var id = getSelectedRowId();
    if (id == null) return;
    var jeIzmjena = _obrazac001Postoji;
    fetch(API_BASE + 'Kandidat_Dokumenti_001_CRUD_spremi.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obrazacGetPayload(id))
    }).then(function (r) { return r.text(); }).then(function (res) {
      res = (res || '').trim();
      if (res === 'OK') {
        ocistiNakonCrud();
        poruka(jeIzmjena ? '004' : '001', []);
      } else {
        var pk = parseResponseCode(res);
        poruka(pk ? pk.code : '200', pk ? pk.replacements : []);
      }
    }).catch(function () { poruka('200', []); });
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
    /* Footer Upiši/Izmjeni prati AKTIVNI tab: Obrazac 001a → kandidat_dokumenti_001; inače životopis. */
    var naObrazac = jeObrazacTab();
    var postoji = naObrazac ? _obrazac001Postoji : _zivotopisPostoji;
    if (btnUpisi && btnUpisiLabel) {
      var izmjena = imaSelekciju && postoji;
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', izmjena);
      btnUpisiLabel.textContent = izmjena ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', izmjena ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSelekciju || (_pravaCrudUpis !== 1);
    }
    /* Brisanje: samo na tabu Životopis (Obrazac 001a nema brisanje). */
    var smijeBrisati = !naObrazac && imaSelekciju && _zivotopisPostoji && _pravaCrudBrisanje === 1;
    if (btnIzbrisi) { btnIzbrisi.style.display = smijeBrisati ? '' : 'none'; btnIzbrisi.disabled = !smijeBrisati; }
    updatePdfState();
  }

  /* PDF ikona: omogućena kad je životopis učitan (kontrola ima sadržaj), inače onemogućena. */
  function updatePdfState() {
    if (!btnPdf) return;
    var imaSelekciju = getSelectedRowId() != null;
    btnPdf.disabled = !(imaSelekciju && zivotopisGetTekst() != null);
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
    updateEnabledState();
  }

  /* Upis / Izmjeni (upsert po id_clan) */
  if (btnUpisi) btnUpisi.addEventListener('click', function () {
    var id = getSelectedRowId();
    if (id == null) return;
    /* Footer dijeljen s tabovima: na Obrascu 001a spremi obrazac, inače životopis. */
    if (jeObrazacTab()) { spremiObrazac(); return; }
    var tekst = zivotopisGetTekst();
    var payload = { id_clan: String(id), zivotopis: tekst };
    var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
    fetch(API_BASE + 'Kandidat_Dokumenti_CRUD_spremi.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.text(); }).then(function (res) {
      res = (res || '').trim();
      if (res === 'OK') {
        ocistiNakonCrud();
        poruka(jeIzmjena ? '004' : '001', []);
      } else {
        var p = parseResponseCode(res);
        poruka(p ? p.code : '200', p ? p.replacements : []);
      }
    }).catch(function () { poruka('200', []); });
  });

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
    var url = API_BASE + 'Kandidat_Dokumenti_Razgovori_CRUD_ispitivaci.php' + (q ? ('?q=' + encodeURIComponent(q)) : '');
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
    razgovoriData = [];
    renderRazgovoriTablica();
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
            format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, sakrij_ako_prazno: s.sakrij_ako_prazno,
            relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator,
            redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold
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
            format_datuma: s.format_datuma, fiksna_pozicija: s.fiksna_pozicija, sakrij_ako_prazno: s.sakrij_ako_prazno,
            relacija_id: s.relacija_id, lista_nacin: s.lista_nacin, lista_separator: s.lista_separator,
            redak_predlozak: s.redak_predlozak, labela_bold: s.labela_bold
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
})();
