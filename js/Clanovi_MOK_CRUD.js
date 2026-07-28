/* =====================================================
   Clanovi_MOK_CRUD.js
   MOK — osobni karton člana. Gornji red: slika člana (SAMO PRIKAZ) + tablica članova
   (Država/Regija/Loža + Traži; aktivni puni članovi, bez kandidata).
   Ispod: popis bilješki odabranog člana + tekst bilješke.

   DISKRECIJA (server je mjerodavan, ovo je samo UI):
     • radna razina — vidiš SAMO svoje bilješke, i to zapisane pod dužnošću pod kojom si sada ulogiran,
       i samo dok je član još u loži u kojoj je bio pri upisu;
     • kontrolna razina (sustav_varijable 127) — vidi sve, ali NE mijenja i NE briše;
     • izmjena/brisanje — samo autor, unutar roka (sustav_varijable 128, mjeseci od upisa) i dok mu je vidljiva.
     Kolona „Bilježaka“ u tablici članova broji samo vidljive; ukupan broj vidi jedino kontrolna razina.
   Server uz svaki redak vraća `smijem_mijenjati`; UI po tome gasi kontrole.

   Uzor: Kandidat_Dokumenti_CRUD (geo/tablica/slika/pod-tablica), Esej_CRUD (contenteditable).
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';

  var API_BASE = '../php/';
  var data = [];                  /* članovi odabrane lože */
  var biljeskeData = [];          /* bilješke odabranog člana (puni zapisi sa servera) */
  var _kontrolna = false;         /* ima li ulogirani kontrolni uvid (čita tuđe bilješke) */
  var _rokMjeseci = 0;            /* rok izmjene/brisanja u mjesecima (sustav_varijable 128) */
  var _editId = 0;                /* id bilješke koja se uređuje; 0 = nova */
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

  /* --- Tablica članova (Prezime, Ime, Stupanj, Bilježaka) ---
     „Bilježaka" = broj bilješki vidljivih ULOGIRANOM (server računa po istom pravilu kao popis:
     vlastite u svojoj loži, a za kontrolnu razinu sve bilješke o tom članu). */
  var MokCRUD = {
    Broj_Kolona: 4,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'prezime', title: 'Prezime', SQL_Naziv: 'prezime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'ime', title: 'Ime', SQL_Naziv: 'ime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stupanj', title: 'St.', SQL_Naziv: 'stupanj', sortable: 0, sortable_icon: 0, type: 't', width: 70, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 0 },
      { key: 'biljezaka', title: 'Bilježaka', SQL_Naziv: 'biljezaka', sortable: 0, sortable_icon: 0, type: 't', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 }
    ]
  };
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  CommonCRUD.initTablica('tablicaContainer', MokCRUD, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  /* --- Pod-tablica bilješki (Datum, Autor) — sam tekst se čita u desnoj koloni ---
     Autor je za radnu razinu uvijek ulogirani; stupac je tu radi kontrolne razine (vidi tuđe). */
  var BILJESKE_TABLICA = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'datum', title: 'Datum', SQL_Naziv: 'datum', sortable: 0, sortable_icon: 0, type: 't', width: 110, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'autor', title: 'Autor', SQL_Naziv: 'autor', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };
  var biljeskeApi = null;
  CommonCRUD.initTablica('mokTablicaContainer', BILJESKE_TABLICA, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { biljeskeApi = api; },
    onSelectionChange: function () { naSelekcijuBiljeske(); }
  });

  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var prikazOmot = document.querySelector('.clanovi-mok-crud__scrol-omot');
  var prikazZaglavlje = document.getElementById('mok_prikaz_zaglavlje');
  var prikazDatumAutor = document.getElementById('mok_prikaz_datum_autor');
  var prikazDuznost = document.getElementById('mok_prikaz_duznost');
  var prikazLinija = document.getElementById('mok_prikaz_linija');
  var prikazTekst = document.getElementById('mok_prikaz_tekst');
  var statusEl = document.getElementById('mok_status');
  var btnNova = document.getElementById('mokNova');
  var btnUredi = document.getElementById('mokUredi');
  var btnObrisi = document.getElementById('mokObrisi');
  var btnDeselekt = document.getElementById('mokDeselekt');

  function getSelectedRowId() { return CommonCRUD.getSelectedRowId(tablicaApi); }
  function getSelectedBiljeskaId() { return biljeskeApi ? CommonCRUD.getSelectedRowId(biljeskeApi) : null; }

  /* ===== Prikaz bilješke (desna kolona; uređivanje ide kroz modal) =====
     Zaglavlje: „datum, autor" bold → dužnost autora bold → linija → tekst u odlomcima. */
  function prikazOcisti() {
    if (prikazZaglavlje) prikazZaglavlje.hidden = true;
    if (prikazLinija) prikazLinija.hidden = true;
    if (prikazDatumAutor) prikazDatumAutor.textContent = '';
    if (prikazDuznost) prikazDuznost.textContent = '';
    if (prikazTekst) prikazTekst.innerHTML = '';
  }
  function prikaziBiljesku(b) {
    if (!b) { prikazOcisti(); return; }
    var autor = trim((b.autor_prezime || '') + ' ' + (b.autor_ime || ''));
    var datum = fmtDatum(b.datum_upisa);
    if (prikazDatumAutor) prikazDatumAutor.textContent = datum + (autor ? (', ' + autor) : '');
    if (prikazDuznost) prikazDuznost.textContent = trim(b.autor_duznost || '');
    if (prikazZaglavlje) prikazZaglavlje.hidden = false;
    if (prikazLinija) prikazLinija.hidden = false;
    if (prikazTekst) {
      prikazTekst.innerHTML = '';
      var ps = String(b.tekst == null ? '' : b.tekst).split(/\n+/);
      for (var i = 0; i < ps.length; i++) {
        var t = ps[i].trim();
        if (!t) continue;
        var p = document.createElement('p');
        p.textContent = t;
        prikazTekst.appendChild(p);
      }
    }
  }
  /* ONEMOGUĆENO stanje prikaza (nema odabranog člana / nema selekcije). */
  function prikazSetDisabledIzgled(disabled) {
    if (!prikazOmot) return;
    if (disabled) prikazOmot.classList.add('clanovi-mok-crud__scrol-omot--disabled');
    else prikazOmot.classList.remove('clanovi-mok-crud__scrol-omot--disabled');
  }
  function postaviStatus(t) { if (statusEl) statusEl.textContent = t || ''; }

  /* ===== Pomoćno: formati ===== */
  function fmtDatum(v) {
    var s = trim(v);
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    return m[3] + '.' + m[2] + '.' + m[1] + '.';
  }
  /* Datum do kojeg je izmjena moguća = datum_upisa + rok mjeseci (prikaz u statusu). */
  function datumIsteka(datumUpisa, mjeseci) {
    var s = trim(datumUpisa);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    d.setMonth(d.getMonth() + (parseInt(mjeseci, 10) || 0));
    var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
    var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
    return dd + '.' + mm + '.' + d.getFullYear() + '.';
  }
  /* ===== Bilješke: punjenje pod-tablice ===== */
  function biljeskeURedove(arr) {
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var b = arr[i];
      var autor = trim((b.autor_prezime || '') + ' ' + (b.autor_ime || ''));
      rows.push({
        id: b.id != null ? b.id : '',
        0: fmtDatum(b.datum_upisa),
        1: autor
      });
    }
    return rows;
  }
  function ocistiBiljeske() {
    biljeskeData = [];
    if (biljeskeApi) CommonCRUD.setDataTablica(biljeskeApi, 'mokTablicaContainer', [], BILJESKE_TABLICA.Tablica_Zaglavlje);
    _editId = 0;
    prikazOcisti();
    postaviStatus('');
    azurirajIkone();
  }
  function ucitajBiljeske(idClan, cb) {
    biljeskeData = [];
    if (!idClan) { ocistiBiljeske(); if (cb) cb(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_MOK_CRUD_sve.php?id_clan=' + encodeURIComponent(idClan), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var odg = null;
      if (text !== '' && text.charAt(0) === '{') { try { odg = JSON.parse(text); } catch (e) { odg = null; } }
      if (odg) {
        _kontrolna = !!parseInt(odg.kontrolna, 10);
        _rokMjeseci = parseInt(odg.rok_mjeseci, 10) || 0;
        biljeskeData = odg.redovi || [];
      } else {
        _kontrolna = false; _rokMjeseci = 0; biljeskeData = [];
      }
      if (biljeskeApi) CommonCRUD.setDataTablica(biljeskeApi, 'mokTablicaContainer', biljeskeURedove(biljeskeData), BILJESKE_TABLICA.Tablica_Zaglavlje);
      _editId = 0;
      prikazOcisti();
      postaviStatus('');
      azurirajIkone();
      if (cb) cb();
    };
    xhr.send();
  }
  function biljeskaPoId(id) {
    for (var i = 0; i < biljeskeData.length; i++) {
      if (String(biljeskeData[i].id) === String(id)) return biljeskeData[i];
    }
    return null;
  }

  /* Selekcija retka u popisu: prikaz bilješke desno + status (rok / samo čitanje). */
  function naSelekcijuBiljeske() {
    var id = getSelectedBiljeskaId();
    if (id == null) {
      _editId = 0;
      prikazOcisti();
      postaviStatus('');
      azurirajIkone();
      return;
    }
    var b = biljeskaPoId(id);
    if (!b) { azurirajIkone(); return; }
    _editId = parseInt(b.id, 10) || 0;
    prikaziBiljesku(b);
    var smije = !!parseInt(b.smijem_mijenjati, 10) && _pravaCrudUpis === 1;
    if (smije) {
      var do_ = datumIsteka(b.datum_upisa, _rokMjeseci);
      postaviStatus(do_ ? ('izmjena moguća do ' + do_) : '');
    } else if (!parseInt(b.moja, 10)) {
      postaviStatus('tuđa bilješka — samo čitanje');
    } else {
      postaviStatus('rok za izmjenu je istekao — samo čitanje');
    }
    azurirajIkone();
  }

  /* Enable/disable jedne CommonCRUD tablice (kanonski helper; fallback na klasu). */
  function tablicaSetEnabled(containerId, on) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (typeof KontroleSetControlEnabled === 'function') { KontroleSetControlEnabled(el, !!on); return; }
    if (on) el.classList.remove('kontrola-tablica--disabled');
    else el.classList.add('kontrola-tablica--disabled');
  }

  /* Tablica članova je onemogućena dok loža nije izabrana (bez lože nema što birati).
     Pretraga I reload ikona prate tablicu: bez lože ILI bez ijednog reda su onemogućene. */
  function azurirajTablicuClanova() {
    var imaLozu = !!(selectLoza && trim(selectLoza.value));
    tablicaSetEnabled('tablicaContainer', imaLozu);
    var trazi = document.getElementById('mok_trazi');
    var imaRedova = data && data.length > 0;
    var traziOn = imaLozu && imaRedova;
    if (btnReloadTablica) btnReloadTablica.disabled = !traziOn;
    if (trazi && typeof KontroleSetControlEnabled === 'function') {
      KontroleSetControlEnabled(trazi, traziOn);
    } else if (trazi) {
      trazi.disabled = !traziOn;
      var w = trazi.closest ? trazi.closest('.kontrola-edit-delete') : null;
      if (w) {
        var clr = w.querySelector('.kontrola-edit-delete__clear');
        if (clr) clr.disabled = !traziOn;
        if (traziOn) w.classList.remove('kontrola-edit-delete--disabled');
        else w.classList.add('kontrola-edit-delete--disabled');
      }
    }
    if (!traziOn && trazi) trazi.value = '';
  }

  /* Ikone prate stanje: odabran član, selektirana bilješka, prava, rok.
     Bez odabranog člana CIJELI edit panel je onemogućen (popis bilješki, prikaz, ikone).
     Izmjena je moguća samo za vlastitu bilješku u roku (server ponovno provjerava). */
  function azurirajIkone() {
    var imaClana = getSelectedRowId() != null;
    var id = getSelectedBiljeskaId();
    var b = id != null ? biljeskaPoId(id) : null;
    var smije = !!(b && parseInt(b.smijem_mijenjati, 10));

    tablicaSetEnabled('mokTablicaContainer', imaClana);
    if (!imaClana) postaviStatus('');
    prikazSetDisabledIzgled(!imaClana || id == null);

    if (btnNova) btnNova.disabled = !(imaClana && _pravaCrudUpis === 1);
    if (btnUredi) btnUredi.disabled = !(imaClana && smije && _pravaCrudUpis === 1);
    if (btnObrisi) btnObrisi.disabled = !(imaClana && smije && _pravaCrudBrisanje === 1);
    if (btnDeselekt) btnDeselekt.disabled = !(imaClana && id != null);
  }

  /* ===== Slika člana — SAMO PRIKAZ ===== */
  function clearSlika() {
    var img = document.getElementById('mok_image_preview');
    if (!img) return;
    if (img._prevURL) { try { URL.revokeObjectURL(img._prevURL); } catch (e) {} img._prevURL = null; }
    img.removeAttribute('src');
    img.alt = '';
    img.style.display = 'none';
  }
  function updateSlikaPreview() {
    var img = document.getElementById('mok_image_preview');
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
      img.alt = 'Slika člana';
      img.style.display = '';
    }).catch(function () {});
  }

  /* ===== Sizing slike: visina = visina panela tablice, širina = visina/1,2 (Š:V = 1:1,2) =====
     Uz zaključavanje max-visine kad slika dosegne ~60% širine reda — inače bi razvlačenje
     tablice gurnulo gornje panele preko edit panela. Isti obrazac kao Dokumenti kandidata. */
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

  /* ===== Logo lože u zaglavlju tablice ===== */
  function updateTablicaHeaderLogo() {
    var img = document.getElementById('mok_loza_logo');
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

  /* ===== Logo lože: 1:1 kvadrat koji ispuni CIJELU visinu zaglavlja (uzor Clanovi_Loza_CRUD) =====
     Stranica kvadrata = paddingTop + visina reda kontrola + paddingBottom − 2 (okvir), ograničena
     na 52% širine zaglavlja. CSS ju čita kroz --clanovi-loza-logo-side (wrap je position:absolute,
     pa velik kvadrat ne pomiče donju liniju zaglavlja). */
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

  /* ===== Stupanj prema ograničenjima ulogiranog (tip 6, po obredu) =====
     Isti obrazac kao Lista / Članovi lože / Obrazac 001b: stupanj viši od dozvoljenog za obred
     članove lože prikazuje se kao NAJVIŠI DOZVOLJENI. Mapa se dohvaća jednom, lijeno. */
  var _ogrMap = {};
  var _ogrLoaded = false;
  var _ogrReq = null;
  var _ogrWait = [];
  function ucitajStupnjeviOgr(done) {
    if (_ogrLoaded) { if (typeof done === 'function') done(); return; }
    if (typeof done === 'function') _ogrWait.push(done);
    if (_ogrReq) return;
    var url = API_BASE + 'duznosnici_ogranicenja_stupnjevi_po_obredu.php';
    if (typeof window.vnlhGeoUrlDodajDuznosnikTest === 'function') url = window.vnlhGeoUrlDodajDuznosnikTest(url);
    var xhr = new XMLHttpRequest();
    _ogrReq = xhr;
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      _ogrReq = null; _ogrLoaded = true;
      var t = (xhr.responseText || '').trim();
      _ogrMap = {};
      if (t !== '' && t.charAt(0) === '{') { try { _ogrMap = JSON.parse(t); } catch (e) { _ogrMap = {}; } }
      var cek = _ogrWait; _ogrWait = [];
      for (var i = 0; i < cek.length; i++) { try { if (cek[i]) cek[i](); } catch (e) {} }
    };
    xhr.send();
  }
  /* Prikaz stupnja s primjenom ograničenja. Vraća {broj, naziv}. */
  function capStupanj(c) {
    var brojStr = (c && c.stupanj_broj != null) ? String(c.stupanj_broj) : '';
    var nazivStr = (c && c.stupanj_naziv != null) ? String(c.stupanj_naziv) : '';
    if (typeof window.vnlhFilteriPrimijeniStupnjevaPoOgranicenjima === 'function') {
      var row = {
        id_obred: (c && c.id_obred != null && c.id_obred !== '') ? (parseInt(c.id_obred, 10) || 0) : 0,
        id_stupnj_clan: (c && c.stupanj != null && c.stupanj !== '') ? (parseInt(c.stupanj, 10) || 0) : 0,
        Stupanj: brojStr, StupanjBroj: brojStr, StupanjNaziv: nazivStr
      };
      window.vnlhFilteriPrimijeniStupnjevaPoOgranicenjima(1, [row], _ogrMap);
      brojStr = row.StupanjBroj != null ? String(row.StupanjBroj) : '';
      nazivStr = row.StupanjNaziv != null ? String(row.StupanjNaziv) : '';
    }
    return { broj: brojStr, naziv: nazivStr };
  }

  /* ===== Tablica članova: punjenje + filter ===== */
  function podaciURedove(arr) {
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      rows.push({
        id: r.id != null ? r.id : '',
        0: r.prezime != null ? r.prezime : '',
        1: r.ime != null ? r.ime : '',
        2: capStupanj(r).broj,
        3: r.broj_biljeski != null ? String(r.broj_biljeski) : '0'
      });
    }
    return rows;
  }
  function primijeniTrazi(lista) {
    var el = document.getElementById('mok_trazi');
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
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, MokCRUD.Tablica_Zaglavlje);
  }
  function ucitajClanove(idLoza, cb) {
    data = [];
    if (!idLoza) {
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], MokCRUD.Tablica_Zaglavlje);
      if (cb) cb(); return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_MOK_CRUD_clanovi.php?id_loza=' + encodeURIComponent(idLoza), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      data = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { data = JSON.parse(text) || []; } catch (e) { data = []; }
      }
      /* Stupanj se prikazuje kroz ograničenja ulogiranog — mapa mora biti tu prije crtanja. */
      ucitajStupnjeviOgr(function () {
        osvjeziPrikazTablice();
        if (cb) cb();
      });
    };
    xhr.send();
  }
  function osvjeziTablicu(cb) {
    ucitajClanove(selectLoza ? trim(selectLoza.value) : '', function () {
      azurirajTablicuClanova();
      azurirajIkone();
      if (cb) cb();
    });
  }
  /* Nakon upisa/izmjene/brisanja bilješke mijenja se stupac „Bilježaka" — ponovno učitaj
     članove, ali zadrži selektiranog (inače bi edit panel iskočio iz konteksta). */
  function osvjeziBrojBiljeski() {
    var sel = getSelectedRowId();
    ucitajClanove(selectLoza ? trim(selectLoza.value) : '', function () {
      if (sel != null && tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function') {
        tablicaApi.setSelectedRowIds([String(sel)]);
      }
      azurirajTablicuClanova();
      azurirajIkone();
    });
  }

  /* ===== GEO (Država/Regija/Loža) — uzor Kandidat_Dokumenti_CRUD ===== */
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
      ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Clanovi_MOK_CRUD.html')
      : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') + '?html_fajl=' + encodeURIComponent('Clanovi_MOK_CRUD.html');
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
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], MokCRUD.Tablica_Zaglavlje);
      azurirajTablicuClanova();
      if (callback) callback(); return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var f = typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function' ? window.vnlhGeoFiltrirajLozePoRegiji(g.loze, idRegija) : [];
    popuniSelectIzKeša(selectLoza, f, '— Odaberi ložu —', 'select_loza');
    if (f.length === 1) {
      selectLoza.value = String(f[0].id); selectLoza.disabled = true; _geoAutoLockedLoza = true;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
      osvjeziTablicu(function () { updateTablicaHeaderLogo(); if (callback) callback(); });
    } else {
      selectLoza.disabled = (f.length === 0); data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], MokCRUD.Tablica_Zaglavlje);
      updateTablicaHeaderLogo();
      azurirajTablicuClanova();
      if (callback) callback();
    }
  }

  /* ===== Selekcija člana: slika + bilješke ===== */
  onCrudSelectionChange = function () {
    updateSlikaPreview();
    var id = getSelectedRowId();
    if (id == null) { ocistiBiljeske(); azurirajIkone(); return; }
    ucitajBiljeske(id);
  };

  /* ===== Event wiring ===== */
  if (selectDrzava) selectDrzava.addEventListener('change', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika(); ocistiBiljeske();
    popuniRegijeIzKeša(trim(this.value), function () { azurirajIkone(); });
  });
  if (selectRegija) selectRegija.addEventListener('change', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika(); ocistiBiljeske();
    popuniLozeIzKeša(trim(this.value), function () { azurirajIkone(); });
  });
  if (selectLoza) selectLoza.addEventListener('change', function () {
    var tz = document.getElementById('mok_trazi'); if (tz) tz.value = '';
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika(); ocistiBiljeske();
    updateTablicaHeaderLogo();
    azurirajTablicuClanova();
    osvjeziTablicu();
  });
  if (btnReloadTablica) btnReloadTablica.addEventListener('click', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika(); ocistiBiljeske();
    osvjeziTablicu();
  });
  (function () {
    var inp = document.getElementById('mok_trazi');
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

  /* Nova bilješka / izmjena — oboje kroz modal (＋ i ✏). */
  if (btnNova) btnNova.addEventListener('click', function () {
    if (btnNova.disabled) return;
    otvoriModal(0);
  });
  if (btnUredi) btnUredi.addEventListener('click', function () {
    if (btnUredi.disabled) return;
    var id = getSelectedBiljeskaId();
    if (id == null) return;
    otvoriModal(parseInt(id, 10) || 0);
  });

  /* Deselekt: makni selekciju u popisu bilješki. */
  if (btnDeselekt) btnDeselekt.addEventListener('click', function () {
    if (biljeskeApi && typeof biljeskeApi.clearSelection === 'function') biljeskeApi.clearSelection();
    naSelekcijuBiljeske();
  });

  /* Brisanje: samo vlastita bilješka u roku; potvrda 131, server ponovno provjerava (132). */
  if (btnObrisi) btnObrisi.addEventListener('click', function () {
    if (btnObrisi.disabled) return;
    var id = getSelectedBiljeskaId();
    if (id == null) return;
    function izvrsi() {
      var fd = new FormData();
      fd.append('id', String(id));
      fetch(API_BASE + 'Clanovi_MOK_CRUD_brisanje.php', { method: 'POST', body: fd })
        .then(function (r) { return r.text(); })
        .then(function (res) {
          res = (res || '').trim();
          if (res === 'OK') {
            var idClan = getSelectedRowId();
            ucitajBiljeske(idClan, function () { osvjeziBrojBiljeski(); poruka('003', []); });
          } else {
            var p = parseResponseCode(res);
            poruka(p ? p.code : '200', p ? p.replacements : []);
          }
        }).catch(function () { poruka('200', []); });
    }
    if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['131'] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal('131', [], function (buttonKey) { if (buttonKey === 'OK') izvrsi(); });
    } else {
      izvrsi();
    }
  });

  /* ============================================================
   * ▒▒ MODAL: unos / izmjena bilješke ▒▒
   * ＋ → „Nova bilješka" (tipka Upiši); ✏ → „Izmjena bilješke" (tipka Izmjeni).
   * Odustani zatvara bez ikakve akcije; spremanje osvježava popis lijevo.
   * Premještanje po zaglavlju + resize kut; pozicija i veličina se pamte (localStorage).
   * ============================================================ */
  var mokModal        = document.getElementById('mokModal');
  var mokModalDialog  = mokModal ? mokModal.querySelector('.clanovi-mok-crud__modal-dialog') : null;
  var mokModalNaslov  = document.getElementById('mokModalNaslov');
  var mokModalTekst   = document.getElementById('mok_modal_tekst');
  var mokModalUpisi   = document.getElementById('mokModalUpisi');
  var mokModalUpisiLabel = mokModalUpisi ? mokModalUpisi.querySelector('.kontrola-btn__label') : null;
  var mokModalOdustani = document.getElementById('mokModalOdustani');
  var _modalEditId = 0;   /* 0 = nova bilješka, inače id koji se mijenja */

  var MOK_MODAL_KEY = 'clanovi-mok-modal';   /* localStorage: pozicija + veličina */
  function getModalStanje() {
    try {
      var s = localStorage.getItem(MOK_MODAL_KEY);
      if (s) { var o = JSON.parse(s); if (o && typeof o.width === 'number' && typeof o.height === 'number') return o; }
    } catch (e) {}
    return null;
  }
  function spremiModalStanje(left, top, width, height) {
    try { localStorage.setItem(MOK_MODAL_KEY, JSON.stringify({ left: left, top: top, width: width, height: height })); } catch (e) {}
  }
  /* Na otvaranju: zapamćeno stanje ili centriranje (CSS default veličina). */
  function primijeniModalStanje() {
    if (!mokModalDialog) return;
    var st = getModalStanje();
    if (st) {
      mokModalDialog.style.left = st.left + 'px';
      mokModalDialog.style.top = st.top + 'px';
      mokModalDialog.style.transform = 'none';
      mokModalDialog.style.width = st.width + 'px';
      mokModalDialog.style.height = st.height + 'px';
    } else {
      mokModalDialog.style.left = '50%';
      mokModalDialog.style.top = '50%';
      mokModalDialog.style.transform = 'translate(-50%, -50%)';
      mokModalDialog.style.width = '';
      mokModalDialog.style.height = '';
    }
  }
  /* Pri izlasku: zapamti stvarnu poziciju (px) i veličinu. */
  function spremiModalGeom() {
    if (!mokModalDialog) return;
    var r = mokModalDialog.getBoundingClientRect();
    spremiModalStanje(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
  }

  function otvoriModal(id) {
    if (!mokModal) return;
    _modalEditId = parseInt(id, 10) || 0;
    var jeIzmjena = _modalEditId > 0;
    var b = jeIzmjena ? biljeskaPoId(_modalEditId) : null;
    if (mokModalNaslov) mokModalNaslov.textContent = jeIzmjena ? 'Izmjena bilješke' : 'Nova bilješka';
    if (mokModalUpisiLabel) mokModalUpisiLabel.textContent = jeIzmjena ? 'Izmjeni' : 'Upiši';
    /* Boja tipke prati radnju: kanonska klasa --crud-izmjeni nadjačava --crud-upisi (0-Kontrole). */
    if (mokModalUpisi) mokModalUpisi.classList.toggle('kontrola-btn--crud-izmjeni', jeIzmjena);
    if (mokModalTekst) mokModalTekst.value = (jeIzmjena && b && b.tekst != null) ? String(b.tekst) : '';
    primijeniModalStanje();
    mokModal.classList.add('clanovi-mok-crud__modal--open');
    mokModal.setAttribute('aria-hidden', 'false');
    if (mokModalTekst) { try { mokModalTekst.focus(); } catch (e) {} }
  }
  function zatvoriModal() {
    if (!mokModal) return;
    spremiModalGeom();
    mokModal.classList.remove('clanovi-mok-crud__modal--open');
    mokModal.setAttribute('aria-hidden', 'true');
    _modalEditId = 0;
  }

  /* Spremanje iz modala: upis nove ili izmjena postojeće; nakon uspjeha osvježi popis lijevo. */
  if (mokModalUpisi) mokModalUpisi.addEventListener('click', function () {
    var idClan = getSelectedRowId();
    if (idClan == null) return;
    var tekst = mokModalTekst ? trim(mokModalTekst.value) : '';
    if (!tekst) { poruka('133', []); return; }
    var jeIzmjena = _modalEditId > 0;
    var fd = new FormData();
    fd.append('tekst', tekst);
    if (jeIzmjena) fd.append('id', String(_modalEditId));
    else fd.append('id_clan', String(idClan));
    fetch(API_BASE + (jeIzmjena ? 'Clanovi_MOK_CRUD_izmjena.php' : 'Clanovi_MOK_CRUD_upis.php'), { method: 'POST', body: fd })
      .then(function (r) { return r.text(); })
      .then(function (res) {
        res = (res || '').trim();
        if (res === 'OK' || res.indexOf('OK|') === 0) {
          zatvoriModal();
          ucitajBiljeske(idClan, function () { osvjeziBrojBiljeski(); poruka(jeIzmjena ? '004' : '001', []); });
        } else {
          var p = parseResponseCode(res);
          poruka(p ? p.code : '200', p ? p.replacements : []);
        }
      }).catch(function () { poruka('200', []); });
  });

  /* Odustani: izlaz bez ikakve akcije (veličina i pozicija se svejedno pamte). */
  if (mokModalOdustani) mokModalOdustani.addEventListener('click', zatvoriModal);

  /* Premještanje (klik-povuci po zaglavlju) i promjena veličine (ručka u donjem desnom kutu). */
  (function () {
    if (!mokModalDialog) return;
    function fiksirajPoziciju() {
      var r = mokModalDialog.getBoundingClientRect();
      mokModalDialog.style.left = Math.round(r.left) + 'px';
      mokModalDialog.style.top = Math.round(r.top) + 'px';
      mokModalDialog.style.transform = 'none';
      return r;
    }
    var header = mokModal ? mokModal.querySelector('.clanovi-mok-crud__modal-header') : null;
    if (header) {
      header.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var r = fiksirajPoziciju();
        var l0 = r.left, t0 = r.top, x0 = e.clientX, y0 = e.clientY;
        function move(ev) {
          mokModalDialog.style.left = Math.max(0, l0 + ev.clientX - x0) + 'px';
          mokModalDialog.style.top = Math.max(0, t0 + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        e.preventDefault();
      });
    }
    var kut = document.getElementById('mokModalResizeKut');
    if (kut) {
      kut.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        var r = fiksirajPoziciju();
        var w0 = r.width, h0 = r.height, x0 = e.clientX, y0 = e.clientY;
        function move(ev) {
          mokModalDialog.style.width = Math.max(360, w0 + ev.clientX - x0) + 'px';
          mokModalDialog.style.height = Math.max(260, h0 + ev.clientY - y0) + 'px';
        }
        function stop() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop); }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        e.preventDefault();
        e.stopPropagation();
      });
    }
  })();

  /* Povratak */
  var btnPovratak = document.getElementById('btnPovratak');
  if (btnPovratak) btnPovratak.addEventListener('click', function () {
    var params = new URLSearchParams(window.location.search);
    var ref = (params.get('ref') || '').trim();
    if (ref) { try { var u = new URL(ref, window.location.href); if (u.origin === window.location.origin) { window.location.href = u.href; return; } } catch (e) {} }
    if (document.referrer) { try { var u2 = new URL(document.referrer); if (u2.origin === window.location.origin) { window.location.href = u2.href; return; } } catch (e) {} }
    window.location.href = '../html/Meni.html';
  });

  /* ===== Start ===== */
  function initForma() {
    updateTablicaHeaderLogo();
    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza) selectLoza.disabled = true;
    data = [];
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], MokCRUD.Tablica_Zaglavlje);
    azurirajTablicuClanova();   /* bez izabrane lože tablica članova je onemogućena */
    ocistiBiljeske();
    ucitajPravaGeo(function () {
      updateTablicaHeaderLogo();
      azurirajTablicuClanova();
      azurirajIkone();
      zakaziSlikaSize();
      syncTablicaHeaderLogoSize();
    });

    /* Slika prati visinu panela tablice; logo prati visinu zaglavlja (resize trake / prozora). */
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
}());
