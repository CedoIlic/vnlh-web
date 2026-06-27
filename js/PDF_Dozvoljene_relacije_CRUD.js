/* PDF_Dozvoljene_relacije_CRUD.js — tablica + edit za pdf_dozvoljeni_relacije ("Dozvoljene relacije").
 * Kaskade (information_schema preko PDF_Whitelist_CRUD_meta.php):
 *   - junction_tablica → fk_baza_kolona, link_kolona, sort_kolona, diskriminator_kolona, fallback_kolona
 *   - grupa_tablica    → grupa_label_kolona, grupa_sort_kolona
 *   - ciljni_izvor_id  → (izvori.tablica = ciljna) → suffix_fk_kolona
 * Izvor-dropdowni (ciljni/suffix/suffix_bazni) iz pdf_dozvoljeni_izvori (PDF_Whitelist_CRUD_sve.php).
 * Popis: PDF_Relacije_sve.php. Write: PDF_Dozvoljene_relacije_CRUD_upis/_izmjena/_brisanje.php.
 * Prava CRUD gumba: vnlhUcitajPravaCrud (meni-stavka „PDF Dozvoljene relacije" pod PDF Kompozer);
 * dužnosnik treba prava (tip 4/5) za taj meni.id kao i za ostale PDF forme.
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Dozvoljene_relacije_CRUD.html');

  var API_BASE = '../php/';

  /* Kolone koje se kaskadno pune iz pojedine tablice */
  var JUNCTION_KOLONE = ['fk_baza_kolona', 'link_kolona', 'sort_kolona', 'diskriminator_kolona', 'fallback_kolona'];
  var GRUPA_KOLONE = ['grupa_label_kolona', 'grupa_sort_kolona'];
  var IZVOR_SELEKTI = ['ciljni_izvor_id', 'suffix_izvor_id', 'suffix_bazni_izvor_id'];
  /* Sva polja edita (za sakupljanje / čišćenje / disable) */
  var SVA_POLJA = ['naziv', 'junction_tablica', 'fk_baza_kolona', 'link_kolona', 'ciljni_izvor_id', 'sort_kolona',
    'napomena', 'suffix_fk_kolona', 'suffix_izvor_id', 'suffix_bazni_izvor_id', 'suffix_format',
    'grupa_tablica', 'grupa_label_kolona', 'grupa_sort_kolona', 'diskriminator_kolona', 'fallback_kolona', 'fallback_predlozak'];
  /* Obavezna polja za omogućavanje Upisa */
  var OBAVEZNA = ['naziv', 'junction_tablica', 'fk_baza_kolona', 'link_kolona', 'ciljni_izvor_id'];

  /* Opisi selekta (popup „?"): ključ = polje bez prefiksa edit_. */
  var POMOC = {
    junction_tablica: {
      naslov: 'Spojna (junction) tablica',
      opis: '<p><strong>Spojna tablica</strong> 1-na-više veze — po jedan redak za svaku vezu baznog zapisa s ciljem.</p>'
          + '<p>Npr. <code>zapisnik_sa_radova_loze_ucesnice</code> (jedan redak po loži učesnici jednog zapisnika).</p>'
          + '<p>Određuje iz koje tablice generator čita retke za zadani bazni id iz konteksta.</p>'
    },
    fk_baza_kolona: {
      naslov: 'FK kolona (veže na bazni id)',
      opis: '<p>Kolona <strong>spojne tablice</strong> koja pokazuje na <strong>bazni id iz konteksta</strong> (npr. id zapisnika).</p>'
          + '<p>Po njoj se filtriraju retci: <code>WHERE fk_baza_kolona = {bazni id}</code>. Npr. <code>id_zapisnika</code>.</p>'
    },
    link_kolona: {
      naslov: 'Link kolona (veže na cilj)',
      opis: '<p>Kolona <strong>spojne tablice</strong> koja pokazuje na <strong>ciljni red</strong> (npr. lože ili člana).</p>'
          + '<p>Preko nje se spaja na ciljnu tablicu radi čitanja naziva. Npr. <code>id_loza</code>, <code>id_clana</code>.</p>'
    },
    ciljni_izvor_id: {
      naslov: 'Ciljni izvor (naziv cilja)',
      opis: '<p>Izvor iz <strong>Dozvoljenih izvora</strong> (tablica.kolona) iz kojeg se čita <strong>naziv cilja</strong> po id = link kolona.</p>'
          + '<p>Npr. <code>loze.naziv</code> → ispisuje naziv lože. Kod „relacija redak" služi i kao sidro ciljne tablice (za predložak <code>{c.…}</code>).</p>'
    },
    sort_kolona: {
      naslov: 'Sort kolona',
      opis: '<p>Kolona <strong>spojne tablice</strong> za <code>ORDER BY</code> — poredak redaka u ispisu.</p>'
          + '<p>Neobavezno; prazno = redoslijed po vezi (id). Npr. <code>redoslijed</code>.</p>'
    },
    suffix_fk_kolona: {
      naslov: 'Sufiks: FK kolona cilja',
      opis: '<p>Uvjetni <strong>sufiks iza imena</strong> (npr. „, ime lože") kada se vrijednost cilja razlikuje od bazne.</p>'
          + '<p>FK kolona <strong>ciljne</strong> tablice koja se uspoređuje (npr. <code>clanovi.loza</code>). Prazno = bez sufiksa.</p>'
    },
    suffix_izvor_id: {
      naslov: 'Sufiks: izvor naziva',
      opis: '<p>Izvor (tablica.kolona) iz kojeg se čita <strong>naziv sufiksa</strong>, slijedeći „Sufiks FK kolonu".</p>'
          + '<p>Npr. <code>loze.naziv</code> → ime lože koje se dodaje iza imena člana.</p>'
    },
    suffix_bazni_izvor_id: {
      naslov: 'Sufiks: bazni izvor (usporedba)',
      opis: '<p>Bazna vrijednost (tablica.kolona) s kojom se sufiks <strong>uspoređuje</strong>; čita se po baznom id.</p>'
          + '<p>Sufiks se ispisuje samo kad se vrijednost cilja razlikuje od ove. Npr. <code>zapisnik_sa_radova.id_domacin</code> (loža nosioca).</p>'
    },
    suffix_format: {
      naslov: 'Format sufiksa',
      opis: '<p>Oblik <strong>sufiksa</strong> koji se dodaje iza imena. <code>{v}</code> = naziv (iz „Sufiks: izvor naziva"), <code>^</code> = razmak (čuva rubne razmake).</p>'
          + '<p>Zadano (prazno) = <code>, {v}</code>. Npr. <code>,^{v}</code> → „, ime lože"; <code>^({v})</code> → „ (ime lože)".</p>'
    },
    grupa_tablica: {
      naslov: 'Tablica grupa/tipova',
      opis: '<p>Za <strong>relacija_grupe</strong>: tablica tipova/grupa po kojima se retci grupiraju (npr. <code>radovi_prisustvo_tip</code>).</p>'
          + '<p>Prazno = bez grupiranja (jedan popis).</p>'
    },
    grupa_label_kolona: {
      naslov: 'Kolona labele grupe',
      opis: '<p>Kolona <strong>tablice grupa</strong> s nazivom grupe koji se ispisuje kao naslov skupine (npr. <code>naziv</code>).</p>'
    },
    grupa_sort_kolona: {
      naslov: 'Kolona poretka grupa',
      opis: '<p>Kolona <strong>tablice grupa</strong> za poredak skupina u ispisu (npr. <code>redoslijed</code>).</p>'
          + '<p>Neobavezno; prazno = po id grupe.</p>'
    },
    diskriminator_kolona: {
      naslov: 'Diskriminator (redak → grupa)',
      opis: '<p>Kolona <strong>spojne tablice</strong> koja svaki redak veže na njegovu grupu (= id u tablici grupa).</p>'
          + '<p>Npr. <code>id_prisustvo_tip</code> → svrstava prisutnog u tip prisustva.</p>'
    },
    fallback_kolona: {
      naslov: 'Fallback kolona (gost)',
      opis: '<p>Kolona <strong>spojne tablice</strong> s gotovim nazivom kada ciljni red (npr. član) nije popunjen — gost izvan baze.</p>'
          + '<p>Npr. <code>ime_i_prezime</code>. „Fallback predložak" ima prednost ako je zadan.</p>'
    },
    fallback_predlozak: {
      naslov: 'Fallback predložak (ime gosta)',
      opis: '<p>Predložak imena <strong>gosta</strong> kada ciljni red (npr. član) nije popunjen. Ima prednost pred „Fallback kolonom".</p>'
          + '<p>Placeholderi spojne tablice: <code>{j.kolona}</code>, FK-skok <code>{j.kol->tbl.kol2}</code>, opcionalni blok <code>[..]</code>. Npr. <code>{j.ime_i_prezime}[-{j.loza}]</code>.</p>'
    }
  };
  /* "?" gumbi po ključu (postavlja injekcija) — disable prati disabled svog selekta. */
  var pomocBtns = {};

  var PDF_RelacijeCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-relacije-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: -40, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'junction', title: 'Spojna tablica', SQL_Naziv: 'junction_tablica', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'cilj', title: 'Ciljni izvor', SQL_Naziv: 'cilj', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  function byId(id) { return document.getElementById(id); }
  function vEdit(col) { var el = byId('edit_' + col); return el ? el.value : ''; }
  function trim(s) { return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : ''); }
  function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }
  function postFormData(url, params, cb) { if (window.CommonPostFormData) window.CommonPostFormData(url, params, cb); else cb(''); }
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
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

  /* ===== Meta (tablice + kolone) i izvori ===== */
  var META = {};        /* { tablica: [ { kolona, blob, komentar } ] } */
  var IZVORI_PO_ID = {}; /* { id: { id, naziv, tablica, kolona, ... } } */

  function popuniTablicaSelekt(selId) {
    var sel = byId(selId);
    if (!sel) return;
    var tablice = Object.keys(META).sort(function (a, b) { return a.localeCompare(b, 'hr', { sensitivity: 'base' }); });
    while (sel.options.length > 1) sel.remove(1);
    tablice.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      sel.appendChild(opt);
    });
    refreshSelect(selId);
  }

  function popuniKoloneSelekt(selId, tablica, izabrana) {
    var sel = byId(selId);
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    var lista = (tablica && META[tablica]) ? META[tablica] : [];
    lista.forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = k.kolona; opt.textContent = k.kolona;
      if (k.komentar) opt.title = k.komentar;
      sel.appendChild(opt);
    });
    var ima = izabrana && lista.some(function (k) { return k.kolona === izabrana; });
    sel.value = ima ? izabrana : '';
    refreshSelect(selId);
  }

  function popuniIzvoriSelekt(selId, izabrana) {
    var sel = byId(selId);
    if (!sel) return;
    var ids = Object.keys(IZVORI_PO_ID).sort(function (a, b) {
      return String(IZVORI_PO_ID[a].naziv || '').localeCompare(String(IZVORI_PO_ID[b].naziv || ''), 'hr', { sensitivity: 'base' });
    });
    while (sel.options.length > 1) sel.remove(1);
    ids.forEach(function (id) {
      var o = IZVORI_PO_ID[id];
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = (o.naziv != null ? o.naziv : id) + ' (' + (o.tablica || '') + '.' + (o.kolona || '') + ')';
      sel.appendChild(opt);
    });
    var ima = izabrana != null && IZVORI_PO_ID[String(izabrana)];
    sel.value = ima ? String(izabrana) : '';
    refreshSelect(selId);
  }

  function ciljnaTablicaIzIzvora(izvorId) {
    var o = izvorId != null && izvorId !== '' ? IZVORI_PO_ID[String(izvorId)] : null;
    return o && o.tablica ? o.tablica : '';
  }

  function ucitajMeta(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Whitelist_CRUD_meta.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '{') {
        try { META = JSON.parse(text); } catch (e) { META = {}; }
      } else { porukaIzKoda(text); }
      popuniTablicaSelekt('edit_junction_tablica');
      popuniTablicaSelekt('edit_grupa_tablica');
      if (cb) cb();
    };
    xhr.send();
  }

  function ucitajIzvore(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Whitelist_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      IZVORI_PO_ID = {};
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) { var o = arr[j]; if (o && o.id != null) IZVORI_PO_ID[String(o.id)] = o; }
        } catch (e) {}
      } else { porukaIzKoda(text); }
      IZVOR_SELEKTI.forEach(function (c) { popuniIzvoriSelekt('edit_' + c, ''); });
      if (cb) cb();
    };
    xhr.send();
  }

  /* ===== Tablica (popis relacija) ===== */
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var relacijePoId = {};

  CommonCRUD.initTablica('tablicaContainer', PDF_RelacijeCRUD, {
    getRowId: function (row) { return row && row[3] != null ? row[3] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });
  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }

  function redIzObjekta(o) {
    var cilj = o.ciljni_izvor_id != null && IZVORI_PO_ID[String(o.ciljni_izvor_id)]
      ? (IZVORI_PO_ID[String(o.ciljni_izvor_id)].naziv || ('#' + o.ciljni_izvor_id)) : '';
    return [
      o.naziv != null ? o.naziv : '',
      o.junction_tablica != null ? o.junction_tablica : '',
      cilj,
      o.id != null ? o.id : 0
    ];
  }

  function ucitajPodatkeTablica(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Relacije_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      relacijePoId = {};
      if (text !== '' && text.charAt(0) !== '[') {
        porukaIzKoda(text);
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var j = 0; j < arr.length; j++) {
            var o = arr[j];
            if (o && o.id != null) relacijePoId[String(o.id)] = o;
            rows.push(redIzObjekta(o));
          }
          rows.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'hr', { sensitivity: 'base' }); });
        } catch (e) {}
      }
      if (cb) cb(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_RelacijeCRUD.Tablica_Zaglavlje);
    });
  }

  /* ===== Punjenje / čišćenje ===== */
  function setVal(col, v) { var el = byId('edit_' + col); if (el) el.value = v != null ? String(v) : ''; }

  function popuniIzObjekta(o) {
    /* Tekstualna polja */
    setVal('naziv', o.naziv);
    setVal('napomena', o.napomena);
    setVal('suffix_format', o.suffix_format);
    setVal('fallback_predlozak', o.fallback_predlozak);

    /* Junction tablica + ovisne kolone */
    setVal('junction_tablica', o.junction_tablica); refreshSelect('edit_junction_tablica');
    popuniKoloneSelekt('edit_fk_baza_kolona', o.junction_tablica, o.fk_baza_kolona);
    popuniKoloneSelekt('edit_link_kolona', o.junction_tablica, o.link_kolona);
    popuniKoloneSelekt('edit_sort_kolona', o.junction_tablica, o.sort_kolona);
    popuniKoloneSelekt('edit_diskriminator_kolona', o.junction_tablica, o.diskriminator_kolona);
    popuniKoloneSelekt('edit_fallback_kolona', o.junction_tablica, o.fallback_kolona);

    /* Izvori + sufiks FK iz ciljne tablice */
    popuniIzvoriSelekt('edit_ciljni_izvor_id', o.ciljni_izvor_id);
    popuniIzvoriSelekt('edit_suffix_izvor_id', o.suffix_izvor_id);
    popuniIzvoriSelekt('edit_suffix_bazni_izvor_id', o.suffix_bazni_izvor_id);
    popuniKoloneSelekt('edit_suffix_fk_kolona', ciljnaTablicaIzIzvora(o.ciljni_izvor_id), o.suffix_fk_kolona);

    /* Grupa tablica + ovisne kolone */
    setVal('grupa_tablica', o.grupa_tablica); refreshSelect('edit_grupa_tablica');
    popuniKoloneSelekt('edit_grupa_label_kolona', o.grupa_tablica, o.grupa_label_kolona);
    popuniKoloneSelekt('edit_grupa_sort_kolona', o.grupa_tablica, o.grupa_sort_kolona);
  }

  function clearForm() {
    SVA_POLJA.forEach(function (c) { setVal(c, ''); });
    /* Resetiraj kaskadne kolone na prazno + osvježi selekte */
    JUNCTION_KOLONE.forEach(function (c) { popuniKoloneSelekt('edit_' + c, '', ''); });
    GRUPA_KOLONE.forEach(function (c) { popuniKoloneSelekt('edit_' + c, '', ''); });
    popuniKoloneSelekt('edit_suffix_fk_kolona', '', '');
    IZVOR_SELEKTI.forEach(function (c) { popuniIzvoriSelekt('edit_' + c, ''); });
    refreshSelect('edit_junction_tablica');
    refreshSelect('edit_grupa_tablica');
    var n = byId('edit_naziv'); if (n) n.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function sakupiParams() {
    var p = {};
    SVA_POLJA.forEach(function (c) { p[c] = trim(vEdit(c)); });
    return p;
  }

  /* ===== Selekcija reda ===== */
  onCrudSelectionChange = function () {
    /* Svaka promjena selekcije u tablici → natrag na prvi tab (Osnovno). */
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(byId('relTab'), 0);
    var id = getSelectedRowId();
    if (id == null) { clearForm(); }
    else {
      var o = relacijePoId[String(id)];
      if (o) popuniIzObjekta(o);
      var n = byId('edit_naziv'); if (n) n.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateCrudUpisiState();
  };

  /* X na Naziv -> reset cijele forme + selekcije */
  (function () {
    var n = byId('edit_naziv');
    var wrap = n && n.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      clearForm();
      updateCrudUpisiState();
    });
  })();

  /* ===== Gumbi / stanje ===== */
  var btnUpisi = byId('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = byId('btnIzbrisi');

  function upisiMoguc() {
    return OBAVEZNA.every(function (c) { return trim(vEdit(c)) !== ''; });
  }

  /* Disable kartica kad su SVI editi taba disable (kao Zapisnik_CRUD; CSS „negativ" iz istih tokena).
     Osnovno (kart0) uvijek omogućeno (sadrži Naziv); Sufiks (kart1) i Grupiranje (kart2) disable kad je Naziv prazan. */
  function relPrimijeniDisabledNaKartice(imaNaziv) {
    var map = [
      { id: 'relTabKart0', ok: true },
      { id: 'relTabKart1', ok: !!imaNaziv },
      { id: 'relTabKart2', ok: !!imaNaziv }
    ];
    for (var i = 0; i < map.length; i++) {
      var btn = byId(map[i].id);
      if (!btn) continue;
      if (!map[i].ok) btn.disabled = true; else btn.removeAttribute('disabled');
    }
  }

  /* Ako je aktivna kartica postala disabled, vrati prikaz/fokus na Osnovno (kart0). */
  function relTabVratiNaOsnovnoAkoAktivnaOnemogucena() {
    var root = byId('relTab');
    if (!root) return;
    var akt = root.querySelector('.kontrola-tab__kartica.kontrola-tab__kartica--aktivna');
    if (!akt || !akt.disabled) return;
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(root, 0);
    var k0 = byId('relTabKart0');
    if (k0 && !k0.disabled) { try { k0.focus(); } catch (e) {} }
  }

  /* Capture: 0-Kontrole_Tab.js ne preskače disabled kartice pri strelicama/Home/End — pronađi sljedeću omogućenu. */
  function relTabZaobilaziDisabledTipkovnica(ev, tabRoot) {
    var key = ev.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('kontrola-tab__kartica')) return;
    var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
    var n = kartice.length;
    if (n === 0) return;
    function idx(btn) {
      var s = btn && btn.getAttribute ? btn.getAttribute('data-tab-index') : null;
      if (s != null && s !== '') { var p = parseInt(s, 10); if (!isNaN(p)) return p; }
      for (var j = 0; j < n; j++) if (kartice[j] === btn) return j;
      return 0;
    }
    var cur = idx(t), naive = cur;
    if (key === 'ArrowLeft') naive = (cur - 1 + n) % n;
    else if (key === 'ArrowRight') naive = (cur + 1) % n;
    else if (key === 'Home') naive = 0;
    else if (key === 'End') naive = n - 1;
    if (kartice[naive] && !kartice[naive].disabled) return;
    var next = -1;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      var step = key === 'ArrowRight' ? 1 : -1, tries = 0; next = cur;
      while (tries < n) { next = (next + step + n) % n; if (kartice[next] && !kartice[next].disabled) break; tries++; }
      if (tries >= n) next = cur;
    } else if (key === 'Home') {
      for (var hi = 0; hi < n; hi++) if (kartice[hi] && !kartice[hi].disabled) { next = hi; break; }
    } else {
      for (var ei = n - 1; ei >= 0; ei--) if (kartice[ei] && !kartice[ei].disabled) { next = ei; break; }
    }
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (next < 0 || next === cur) return;
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabRoot, next);
    if (kartice[next]) { try { kartice[next].focus(); } catch (e) {} }
  }

  /* Prazan Naziv → ostale kontrole disable + disable kartica Sufiks/Grupiranje. */
  function azurirajDisable() {
    var imaNaziv = trim(vEdit('naziv')) !== '';
    SVA_POLJA.forEach(function (c) {
      if (c === 'naziv') return;
      var el = byId('edit_' + c);
      if (!el) return;
      if (typeof KontroleSetControlEnabled === 'function') KontroleSetControlEnabled(el, imaNaziv);
      else { el.disabled = !imaNaziv; if (el.tagName === 'SELECT') refreshSelect('edit_' + c); }
    });
    /* "?" ikone prate disabled svog selekta (svi su uz ne-naziv polja → disable kad je Naziv prazan). */
    Object.keys(pomocBtns).forEach(function (k) { var b = pomocBtns[k]; if (b) b.disabled = !imaNaziv; });
    relPrimijeniDisabledNaKartice(imaNaziv);
    relTabVratiNaOsnovnoAkoAktivnaOnemogucena();
  }

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !upisiMoguc();
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  /* ===== Kaskade (change handleri) ===== */
  (function () {
    var n = byId('edit_naziv');
    if (n) {
      n.addEventListener('input', function () { updateCrudUpisiState(); azurirajDisable(); });
      n.addEventListener('change', function () { updateCrudUpisiState(); azurirajDisable(); });
    }
    var jt = byId('edit_junction_tablica');
    if (jt) jt.addEventListener('change', function () {
      JUNCTION_KOLONE.forEach(function (c) { popuniKoloneSelekt('edit_' + c, jt.value, ''); });
      updateCrudUpisiState();
    });
    var gt = byId('edit_grupa_tablica');
    if (gt) gt.addEventListener('change', function () {
      GRUPA_KOLONE.forEach(function (c) { popuniKoloneSelekt('edit_' + c, gt.value, ''); });
      updateCrudUpisiState();
    });
    var ci = byId('edit_ciljni_izvor_id');
    if (ci) ci.addEventListener('change', function () {
      popuniKoloneSelekt('edit_suffix_fk_kolona', ciljnaTablicaIzIzvora(ci.value), '');
      updateCrudUpisiState();
    });
    /* preostali obavezni/izvor selekti samo osvježe stanje gumba */
    ['fk_baza_kolona', 'link_kolona'].forEach(function (c) {
      var el = byId('edit_' + c); if (el) el.addEventListener('change', updateCrudUpisiState);
    });
  })();

  function obradiOdgovor(res, kodUspjeha) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(kodUspjeha, [], function () {
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          clearForm(); osvjeziTablicu();
        });
      } else { clearForm(); osvjeziTablicu(); }
      return;
    }
    porukaIzKoda(res, res.indexOf('002') === 0 ? ['Naziv'] : null);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      if (!upisiMoguc()) { if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []); return; }
      var params = sakupiParams();
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        params.id = String(id);
        postFormData(API_BASE + 'PDF_Dozvoljene_relacije_CRUD_izmjena.php', params, function (res) { obradiOdgovor(res, '004'); });
      } else {
        postFormData(API_BASE + 'PDF_Dozvoljene_relacije_CRUD_upis.php', params, function (res) { obradiOdgovor(res, '001'); });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'PDF_Dozvoljene_relacije_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearForm(); osvjeziTablicu();
            });
          }
        } else { porukaIzKoda(res); }
      });
    });
  }

  (function () {
    var btnPovratak = byId('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
      if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e2) {} }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  /* ===== Popup opisa polja ("?" desno od svakog selekta) ===== */
  (function () {
    var m = byId('relPomocModal');
    if (!m) return;
    var hdr = byId('relPomocModal_header');
    var body = byId('relPomocModal_body');

    function otvori(key) {
      var p = POMOC[key];
      if (!p) return;
      if (hdr) hdr.textContent = p.naslov;
      if (body) body.innerHTML = p.opis;
      var d = m.querySelector('.kontrola-modal__dialog');
      if (d) { d.style.left = ''; d.style.top = ''; d.style.transform = ''; d.style.margin = ''; }   /* reset → centriran + svjež drag */
      m.setAttribute('aria-hidden', 'false');
      m.classList.add('kontrola-modal--open');
    }
    function zatvori() {
      m.setAttribute('aria-hidden', 'true');
      m.classList.remove('kontrola-modal--open');
    }
    var ok = byId('btnRelPomocOk'); if (ok) ok.addEventListener('click', zatvori);
    var ov = byId('relPomocModal_overlay'); if (ov) ov.addEventListener('click', zatvori);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.getAttribute('aria-hidden') === 'false') zatvori(); });
    var dlg = m.querySelector('.kontrola-modal__dialog');
    if (dlg && hdr && typeof KontroleModalDrag === 'function') KontroleModalDrag(dlg, hdr);

    /* "?" gumb desno od kontrole: omota .kontrola-select / .kontrola-edit-delete / .kontrola-napomena + gumb u flex red. */
    Object.keys(POMOC).forEach(function (key) {
      var el = byId('edit_' + key);
      if (!el || !el.closest) return;
      var jeNapomena = false;
      var wrap = el.closest('.kontrola-select') || el.closest('.kontrola-edit-delete');
      if (!wrap && el.classList && el.classList.contains('kontrola-napomena')) { wrap = el; jeNapomena = true; }
      if (!wrap || !wrap.parentNode) return;
      var red = document.createElement('div');
      red.className = 'pdf-relacije-crud__select-red' + (jeNapomena ? ' pdf-relacije-crud__select-red--napomena' : '');
      wrap.parentNode.insertBefore(red, wrap);
      red.appendChild(wrap);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pdf-relacije-crud__pomoc-btn';
      btn.textContent = '?';
      btn.title = 'Opis polja';
      btn.setAttribute('aria-label', 'Opis: ' + POMOC[key].naslov);
      red.appendChild(btn);
      pomocBtns[key] = btn;
      btn.addEventListener('click', function () { otvori(key); });
    });
  })();

  /* ===== Init ===== */
  if (typeof KontroleTabInit === 'function') KontroleTabInit(byId('relTab'));
  (function () {
    var root = byId('relTab');
    var traka = root && root.querySelector('.kontrola-tab__traka');
    if (traka) traka.addEventListener('keydown', function (ev) { relTabZaobilaziDisabledTipkovnica(ev, root); }, true);
  })();
  ucitajMeta(function () {
    ucitajIzvore(function () {
      ucitajPodatkeTablica(function (rows) {
        CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_RelacijeCRUD.Tablica_Zaglavlje);
      });
    });
  });
  clearForm();
  updateCrudUpisiState();
  azurirajDisable();
})();
