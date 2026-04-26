/* =====================================================
   Clanovi_Loza_CRUD.js
   Panel slike (1:1,2), panel tablice: logo + Država/Regija/Loža + Traži (lokalni edit-delete, ne Lista); tablica kao Clanovi_CRUD (klik na Spol = toggle).
   Logo u zaglavlju = Loze_CRUD_slika. Edit u dva stupca, modal obrade slike na dvoklik.
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';

  /**
   * Jedinstveni naslov stranice: document.title + h2 u prvom .naslov-forme.
   * Drugi blok .naslov-forme (npr. „Glavni Izbornik“ s Menija) ponekad se pojavi u DOM-u nakon
   * prvog prolaska skripte (asinkrono, BFCache, kasni umetak). Zato: ukloni sve osim prvog,
   * ponovi na DOMContentLoaded / pageshow / MutationObserver, i na kraju osiguraj h2.
   * Napomena: Glavni izbornik i Alati_Meni_Test dijele horizontalnu traku (alati-meni-test__* u Meni.html),
   * ali ovaj CRUD ne učitava Meni.js niti Alati_Meni_Test.js/CSS — dupli naslov nije „miješanje“ s Alati
   * formom u istom dokumentu, nego ostatak navigacije/keša; dedupe ipak čisti DOM.
   * Isti keš ponekad ubaci i #traka_h_menija / #meni_overlay / #meni_drawer (Meni ili Alati) — uklanjaju se ovdje.
   */
  function dedupeClanoviNaslovForme() {
    try {
      document.title = 'Članovi';
      var naslovi = document.querySelectorAll('.naslov-forme');
      if (naslovi.length <= 1) {
        var h2one = document.querySelector('.naslov-forme h2');
        if (h2one) {
          h2one.textContent = 'Članovi';
        }
        return;
      }
      // Više blokova: ne zadržavaj slijepo [0] – keš ponekad ubaci prazan duplikat ispred pravog naslova
      // (bez h2), pa bi nestao naslov i badge verzije (00-Version.js). Preferiraj blok s .vnlh-verzija-badge,
      // zatim prvi s nepraznim h2, inače [0].
      var keeperIdx = -1;
      var i;
      for (i = 0; i < naslovi.length; i++) {
        if (naslovi[i].querySelector && naslovi[i].querySelector('.vnlh-verzija-badge')) {
          keeperIdx = i;
          break;
        }
      }
      if (keeperIdx < 0) {
        for (i = 0; i < naslovi.length; i++) {
          var hx = naslovi[i].querySelector('h2');
          if (hx && String(hx.textContent || '').trim() !== '') {
            keeperIdx = i;
            break;
          }
        }
      }
      if (keeperIdx < 0) {
        keeperIdx = 0;
      }
      for (var n = 0; n < naslovi.length; n++) {
        if (n === keeperIdx) {
          continue;
        }
        var dupl = naslovi[n];
        if (dupl && dupl.parentNode) {
          dupl.parentNode.removeChild(dupl);
        }
      }
      var h2 = document.querySelector('.naslov-forme h2');
      if (h2) {
        h2.textContent = 'Članovi';
      }
    } catch (e) {}
  }

  /** Ukloni ostatke horizontalnog menija (isti ID-jevi u Meni.html i Alati_Meni_Test.html) ako su u DOM-u bez tih skripti. */
  function removeClanoviMeniTrakaOstatke() {
    try {
      ['traka_h_menija', 'meni_overlay', 'meni_drawer'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    } catch (e) {}
  }

  function sanitizeClanoviKešOstatke() {
    dedupeClanoviNaslovForme();
    removeClanoviMeniTrakaOstatke();
  }

  sanitizeClanoviKešOstatke();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      sanitizeClanoviKešOstatke();
    });
  } else {
    sanitizeClanoviKešOstatke();
  }
  window.addEventListener('pageshow', function () {
    sanitizeClanoviKešOstatke();
  });
  setTimeout(function () {
    sanitizeClanoviKešOstatke();
  }, 0);
  if (typeof MutationObserver !== 'undefined' && document.body) {
    try {
      var moNaslov = new MutationObserver(function () {
        // Dok je otvoren modal promjene verzije (00-Version.js), ne zovi sanitize – inače se u istom
        // trenutku mogu poklopiti umetanje overlaya i dedupe naslova, što može ostaviti prazan .naslov-forme.
        if (document.querySelector('.vnlh-verzija-modal-overlay')) {
          return;
        }
        if (
          document.querySelectorAll('.naslov-forme').length > 1 ||
          document.getElementById('traka_h_menija') ||
          document.getElementById('meni_overlay') ||
          document.getElementById('meni_drawer')
        ) {
          sanitizeClanoviKešOstatke();
        }
      });
      moNaslov.observe(document.body, { childList: true, subtree: true });
    } catch (eMo) {}
  }

  var API_BASE = '../php/';
  var data = [];
  var lozeData = [];

  /* Geo keš: window.vnlhGeoOgranicenja* u 0-Filteri_Po_Ogranicenjima.js (jedan GET, zajednički filtri). */

  /* Zastavice: true ako je select automatski zaključan (samo 1 opcija).
     updateEnabledState poštuje ove zastavice i ne otključava select. */
  var _geoAutoLockedDrzava = false;
  var _geoAutoLockedRegija = false;
  var _geoAutoLockedLoza   = false;

  /** Keš: JSON iz duznosnici_ogranicenja_stupnjevi_po_obredu.php (tip 6) za filtriranje selecta stupnjeva. */
  var _stupnjeviOgrMap = {};
  var _stupnjeviOgrLoaded = false;
  var _stupnjeviOgrReq = null;
  var _stupnjeviOgrWait = [];

  /** Postavi/makni CSS klasu kontrola-select--auto-locked na wrapperu oko <select> elementa. */
  function setAutoLockedClass(selectEl, locked) {
    if (!selectEl) return;
    var wrapper = selectEl.closest ? selectEl.closest('.kontrola-select') : null;
    if (!wrapper) return;
    if (locked) wrapper.classList.add('kontrola-select--auto-locked');
    else wrapper.classList.remove('kontrola-select--auto-locked');
  }

  // Tablica_Zaglavlje – svaka kolona je objekt sa parametrima:
  // 1) key (string) - Jedinstveni ključ kolone.
  // 2) title (string) - Tekst u zaglavlju kolone (THEAD).
  // 3) SQL_Naziv (string) - Naziv podatka koji vraća PHP. Ako nije upisan = prvi podatak iza id. id = ključ sloga, skriveni podatak u redu tablice.
  // 4) sortable (0 | 1) - 1 = kolona se može sortirati klikom na zaglavlje; 0 = nije sortabilna, hover na zaglavlju te kolone ne radi.
  // 5) sortable_icon (0 | 1) - 1 = iscrtava se sort ikona u zaglavlju (pravila: align L ili C → ikona uz desni rub ćelije; align R → ikona uz lijevi rub kolone). Default: 0.
  // 6) type ("t" | "n" | "d" | "b") - Tip podataka u koloni: "t" = tekst, "n" = broj, "d" = datum, "b" = binarno. (Isto kao Clanovi_CRUD.js.)
  // 7) width (number) - Širina te kolone: 0 = auto; < 0 = abs(width) % ukupne širine tablice (npr. -20 → 20%); > 0 = fiksno u px (npr. 30 → 30px).
  // 8) suffix (string) - Dodatak uz prikaz podatka (npr. " €", "%", " kom").
  // 9) align ("L" | "C" | "R") - Orijentacija teksta u zaglavlju tablice: L = lijevo, C = centar, R = desno.
  // 10) row_align ("L" | "C" | "R") - Orijentacija sadržaja u redovima tablice: L = lijevo, C = centar, R = desno.
  // 11) mobitel_prikaz (0–255, default 1) - Prikaz kolone na mobilnim uređajima. 0 = ne prikazuje se, 1 = prikazuje se. Primjenjuje se pri sužavanju (npr. kada kolone grida idu jedna iznad druge).
  // 12) cell_readonly (0 | 1) - Za type "b": 1 = checkbox nije klikabilan (samo prikaz). Default: 0.
  //
  /* Glavna tablica: ista konfiguracija kolona kao Clanovi_CRUD.js (Prezime, Ime, St., Spol). */
  var ClanoviLozaCRUD = {
    Broj_Kolona: 4,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-crud',
    Tablica_Zaglavlje: [
      { key: 'prezime', title: 'Prezime', SQL_Naziv: 'prezime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'ime', title: 'Ime', SQL_Naziv: 'ime', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'stupanj', title: 'St.', SQL_Naziv: 'stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 60, suffix: '°', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'spol', title: 'Spol', SQL_Naziv: 'spol', sortable: 1, sortable_icon: 0, type: 't', width: 70, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 0 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', ClanoviLozaCRUD, {
    getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var editPanel = document.getElementById('edit_panel');
  var tablicaContainerEl = document.getElementById('tablicaContainer');

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  /** Vrijeme upisa u format DD. MM. YYYY.  HH:MM:SS (prihvaća ISO, SQL datetime ili timestamp). */
  function formatVrijemeUpisa(val) {
    if (val == null || String(val).replace(/^\s+|\s+$/g, '') === '') return '';
    var d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    var ss = String(d.getSeconds()).padStart(2, '0');
    return dd + '. ' + mm + '. ' + yyyy + '.  ' + hh + ':' + min + ':' + ss;
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
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

  function syncDatumEmptyClass(el) {
    if (!el || el.type !== 'date') return;
    if (el.value === '') el.classList.add('date-empty'); else el.classList.remove('date-empty');
  }

  function clearControlsFromSelection() {
    var ids = ['edit_prezime', 'edit_ime', 'edit_datum_rodjenja', 'edit_oib', 'edit_telefon', 'edit_email', 'edit_adresa_1', 'edit_adresa_2', 'edit_grad', 'edit_posta', 'edit_napomena'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) { el.value = ''; if (ids[i] === 'edit_prezime') el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    syncDatumEmptyClass(document.getElementById('edit_datum_rodjenja'));
    if (selectSpol) selectSpol.value = '0';
    if (selectPorijeklo) selectPorijeklo.value = '';
    if (selectNaPrijedlog) selectNaPrijedlog.value = '';
    if (selectDrzavaAdrese) selectDrzavaAdrese.value = '';
    if (typeof KontroleRefreshCustomSelect === 'function') {
      if (selectSpol) KontroleRefreshCustomSelect('select_spol');
      if (selectPorijeklo) KontroleRefreshCustomSelect('select_porijeklo');
      if (selectNaPrijedlog) KontroleRefreshCustomSelect('select_na_prijedlog');
      if (selectDrzavaAdrese) KontroleRefreshCustomSelect('select_drzava_adrese');
    }
  }

  function clearSlikaFromControl() {
    var img = document.getElementById('clanovi_image_preview');
    if (!img) return;
    if (img._obradaSlikaPrevURL) {
      try { URL.revokeObjectURL(img._obradaSlikaPrevURL); } catch (err) {}
      img._obradaSlikaPrevURL = null;
    }
    img._obradaSlikaBlob = null;
    img._obradaSlikaRoundActive = false;
    img._obradaSlikaRoundOffset = 0;
    img._obradaSlikaRoundOffsetPx = undefined;
    img._obradaSlikaRoundOffsetHeight = undefined;
    img._obradaSlikaMime = null;
    img.removeAttribute('src');
    img.alt = '';
    img.style.display = 'none';
    var delBtn = document.getElementById('clanovi_image_delete_btn');
    if (delBtn) delBtn.disabled = true;
  }

  var selectSpol = document.getElementById('select_spol');
  var selectPorijeklo = document.getElementById('select_porijeklo');
  var selectIzborStupnja = document.getElementById('select_izbor_stupnja');
  var selectNaPrijedlog = document.getElementById('select_na_prijedlog');
  var selectDrzavaAdrese = document.getElementById('select_drzava_adrese');

  function populateNaPrijedlog(excludeId) {
    if (!selectNaPrijedlog) return;
    while (selectNaPrijedlog.firstChild) selectNaPrijedlog.removeChild(selectNaPrijedlog.firstChild);
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Odaberi —';
    selectNaPrijedlog.appendChild(opt0);
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (excludeId != null && String(r.id) === String(excludeId)) continue;
      var o = document.createElement('option');
      o.value = r.id != null ? String(r.id) : '';
      o.textContent = (r.prezime != null ? r.prezime : '') + ', ' + (r.ime != null ? r.ime : '');
      selectNaPrijedlog.appendChild(o);
    }
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_na_prijedlog');
  }

  onCrudSelectionChange = function () {
    var img = document.getElementById('clanovi_image_preview');
    if (img) {
      img._obradaSlikaRoundActive = false;
      img._obradaSlikaRoundOffset = 0;
      img._obradaSlikaRoundOffsetPx = undefined;
      img._obradaSlikaRoundOffsetHeight = undefined;
    }
    clearSlikaFromControl();
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
      populateNaPrijedlog(null);
    } else {
      var found = data.find(function (r) { return String(r.id) === String(id); });
      if (found) {
        var editPrezime = document.getElementById('edit_prezime');
        if (editPrezime) { editPrezime.value = found.prezime != null ? found.prezime : ''; editPrezime.dispatchEvent(new Event('input', { bubbles: true })); }
        var editIme = document.getElementById('edit_ime');
        if (editIme) editIme.value = found.ime != null ? found.ime : '';
        if (selectSpol) selectSpol.value = (found.spol === 1 || found.spol === '1') ? '1' : '0';
        var editDatumRodjenja = document.getElementById('edit_datum_rodjenja');
        if (editDatumRodjenja) { editDatumRodjenja.value = found.datum_rodjenja != null ? found.datum_rodjenja : ''; syncDatumEmptyClass(editDatumRodjenja); }
        if (selectPorijeklo) selectPorijeklo.value = (found.porijeklo != null && found.porijeklo !== '') ? String(found.porijeklo) : '';
        populateNaPrijedlog(id);
        if (selectNaPrijedlog) selectNaPrijedlog.value = (found.na_prijedlog != null && found.na_prijedlog !== '') ? String(found.na_prijedlog) : '';
        var editTelefon = document.getElementById('edit_telefon');
        if (editTelefon) editTelefon.value = found.telefon_text != null ? found.telefon_text : '';
        var editEmail = document.getElementById('edit_email');
        if (editEmail) editEmail.value = found.email_text != null ? found.email_text : '';
        var editAdresa1 = document.getElementById('edit_adresa_1');
        if (editAdresa1) editAdresa1.value = found.adresa_1 != null ? found.adresa_1 : '';
        var editAdresa2 = document.getElementById('edit_adresa_2');
        if (editAdresa2) editAdresa2.value = found.adresa_2 != null ? found.adresa_2 : '';
        var editGrad = document.getElementById('edit_grad');
        if (editGrad) editGrad.value = found.adresa_grad != null ? found.adresa_grad : '';
        var editPosta = document.getElementById('edit_posta');
        if (editPosta) editPosta.value = found.adresa_posta != null ? found.adresa_posta : '';
        if (selectDrzavaAdrese) selectDrzavaAdrese.value = (found.id_drzava_adrese != null && found.id_drzava_adrese !== '') ? String(found.id_drzava_adrese) : '';
        var editNapomena = document.getElementById('edit_napomena');
        if (editNapomena) editNapomena.value = found.napomena != null ? found.napomena : '';
        if (typeof KontroleRefreshCustomSelect === 'function') {
          KontroleRefreshCustomSelect('select_spol');
          KontroleRefreshCustomSelect('select_porijeklo');
          KontroleRefreshCustomSelect('select_na_prijedlog');
          KontroleRefreshCustomSelect('select_drzava_adrese');
        }
      }
    }
    updateCrudUpisiState();
    updateSlikaPreview();
  };

  function updateSlikaPreview() {
    var img = document.getElementById('clanovi_image_preview');
    if (!img) return;
    var id = getSelectedRowId();
    if (id == null || id === '') {
      if (img._obradaSlikaPrevURL) {
        try { URL.revokeObjectURL(img._obradaSlikaPrevURL); } catch (err) {}
        img._obradaSlikaPrevURL = null;
      }
      img._obradaSlikaBlob = null;
      img._obradaSlikaMime = null;
      img.removeAttribute('src');
      img.alt = '';
      img.style.display = 'none';
      var btn = document.getElementById('clanovi_image_delete_btn');
      if (btn) btn.disabled = true;
      return;
    }
    if (img.src && img.src.indexOf('blob:') === 0) {
      var btnBlob = document.getElementById('clanovi_image_delete_btn');
      if (btnBlob) btnBlob.disabled = false;
      return;
    }
    var url = API_BASE + 'Clanovi_CRUD_slika.php?id=' + encodeURIComponent(id) + '&t=' + (Date.now ? Date.now() : 0);
    img._obradaSlikaBlob = null;
    img._obradaSlikaMime = null;
    img.removeAttribute('src');
    img.alt = '';
    img.style.display = 'none';
    var delBtn = document.getElementById('clanovi_image_delete_btn');
    if (delBtn) delBtn.disabled = true;
    if (typeof fetch !== 'function') return;
    fetch(url).then(function (r) {
      var ct = (r.headers.get('Content-Type') || '').trim();
      if (ct.indexOf('text/plain') !== -1) {
        return r.text().then(function (text) {
          var parsed = parseResponseCode(text);
          if (parsed && parsed.code === '108' && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['108'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('108', parsed.replacements || []);
          }
          return null;
        });
      }
      if (!r.ok) return null;
      return r.blob().then(function (blob) {
        if (blob.size === 0) return null;
        var mime = (r.headers.get('Content-Type') || '').trim();
        if (!mime || mime.indexOf('image/') !== 0) mime = 'image/jpeg';
        return { blob: blob, mime: mime };
      });
    }).then(function (result) {
      if (!result || !result.blob) return;
      if (img._obradaSlikaPrevURL) {
        try { URL.revokeObjectURL(img._obradaSlikaPrevURL); } catch (err) {}
        img._obradaSlikaPrevURL = null;
      }
      img._obradaSlikaBlob = result.blob;
      img._obradaSlikaMime = result.mime;
      img._obradaSlikaPrevURL = URL.createObjectURL(result.blob);
      img.src = img._obradaSlikaPrevURL;
      img.alt = 'Slika člana';
      img.style.display = '';
      var row = (data || []).find(function (r) { return String(r.id) === String(id); });
      var posPx = row && row.slika_thumb_round_position != null && !isNaN(parseInt(row.slika_thumb_round_position, 10)) ? parseInt(row.slika_thumb_round_position, 10) : null;
      if (posPx != null) {
        img._obradaSlikaRoundOffsetPx = posPx;
        img._obradaSlikaRoundOffsetHeight = 200;
        img._obradaSlikaRoundActive = true;
      } else {
        img._obradaSlikaRoundOffsetPx = undefined;
        img._obradaSlikaRoundOffsetHeight = undefined;
        img._obradaSlikaRoundActive = false;
      }
      if (delBtn) delBtn.disabled = false;
    });
  }

  function updateEnabledState() {
    var imaRegiju = selectRegija && trim(selectRegija.value) !== '';
    var imaLozu = selectLoza && trim(selectLoza.value) !== '';
    var editPrezime = document.getElementById('edit_prezime');
    var imaSadrzaj = editPrezime ? trim(editPrezime.value) !== '' : false;
    var editDeleteWrap = editPrezime && editPrezime.closest ? editPrezime.closest('.kontrola-edit-delete') : null;
    var tableWrap = tablicaContainerEl && tablicaContainerEl.closest('.kontrola-tablica');
    if (tableWrap) {
      if (imaLozu) tableWrap.classList.remove('kontrola-tablica--disabled');
      else tableWrap.classList.add('kontrola-tablica--disabled');
    }
    // 1) Osnovno pravilo za cijeli edit panel:
    //    sve kontrole (osim edit-delete) enable-a se tek kada postoji tekst u edit-delete
    //    i odabrana je loža.
    if (editPanel && typeof KontroleSetEnabled === 'function') {
      var trebaPanelEnabled = imaLozu && imaSadrzaj;
      KontroleSetEnabled(editPanel, trebaPanelEnabled);
    }
    if (editPanel) editPanel.classList.toggle('kontrola-panel--edit-disabled', !(imaLozu && imaSadrzaj));
    // 2) Edit-delete kontrola (Prezime) je posebna:
    //    postaje enable već samim izborom lože, da korisnik može unijeti prvi tekst.
    if (editDeleteWrap && typeof KontroleSetControlEnabled === 'function') {
      KontroleSetControlEnabled(editDeleteWrap, imaLozu);
    }
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
    var panelTablica = selectLoza && selectLoza.closest ? selectLoza.closest('.clanovi-crud__panel-tablica') : null;
    if (panelTablica && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(panelTablica);

    // Auto-locked selekti: KontroleSyncLabelsDisabledState ih vidi kao disabled pa labeli stavlja
    // kontrola-labela--disabled – ovdje to poništavamo jer je sadržaj odabran i čitljiv.
    if (_geoAutoLockedDrzava) {
      var lblDrzava = document.querySelector('label[for="select_drzava"]');
      if (lblDrzava) lblDrzava.classList.remove('kontrola-labela--disabled');
    }
    if (_geoAutoLockedRegija) {
      var lblRegija = document.querySelector('label[for="select_regija"]');
      if (lblRegija) lblRegija.classList.remove('kontrola-labela--disabled');
    }

    if (selectLoza) selectLoza.disabled = _geoAutoLockedLoza || !imaRegiju;
    if (typeof KontroleRefreshCustomSelect === 'function' && selectLoza) KontroleRefreshCustomSelect('select_loza');
    var lblLoza = document.querySelector('label[for="select_loza"]');
    if (lblLoza) lblLoza.classList.toggle('kontrola-labela--disabled', !(_geoAutoLockedLoza || imaRegiju));
    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) { btnPovratak.disabled = false; btnPovratak.removeAttribute('disabled'); }
    var imageArea = document.getElementById('clanovi_image_area');
    var imageFrame = document.getElementById('clanovi_image_frame');
    // Kontrola slike: enable kada postoji sadržaj u edit-delete (kao i ostale kontrole).
    if (imageArea) imageArea.classList.toggle('clanovi-crud__edit-image-area--disabled', !imaSadrzaj);
    if (imageFrame) imageFrame.classList.toggle('kontrola-slika--disabled', !imaSadrzaj);
    if (btnReloadTablica) btnReloadTablica.disabled = !imaLozu;

    var traziLozaInput = document.getElementById('clanovi_loza_trazi');
    var traziLozaWrap = traziLozaInput && traziLozaInput.closest ? traziLozaInput.closest('.kontrola-edit-delete') : null;
    if (traziLozaWrap && typeof KontroleSetControlEnabled === 'function') {
      KontroleSetControlEnabled(traziLozaWrap, imaLozu);
    }

    // Tipka Izbriši: može biti enable isključivo kada postoji selekcija u tablici.
    var imaSelekciju = getSelectedRowId() != null;
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;

    // Ikone ellipsis uz Telefon, E-mail, Adresa: enable samo kod selekcije (izmjena) – pri dodavanju novog nema id.
    var editTelefon = document.getElementById('edit_telefon');
    var editEmail = document.getElementById('edit_email');
    var editAdresa1 = document.getElementById('edit_adresa_1');
    var btnTelefonEllipsis = document.getElementById('btn_telefon_ellipsis');
    var btnEmailEllipsis = document.getElementById('btn_email_ellipsis');
    var btnAdresaEllipsis = document.getElementById('btn_adresa_ellipsis');
    if (btnTelefonEllipsis) btnTelefonEllipsis.disabled = !imaSelekciju || (editTelefon && editTelefon.disabled);
    if (btnEmailEllipsis) btnEmailEllipsis.disabled = !imaSelekciju || (editEmail && editEmail.disabled);
    if (btnAdresaEllipsis) btnAdresaEllipsis.disabled = !imaSelekciju || (editAdresa1 && editAdresa1.disabled);
  }

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  if (btnIzbrisi) btnIzbrisi.disabled = true; // Bez selekcije na tablici tipka Izbriši je uvijek disabled.

  function isValidEmailClan(s) {
    if (typeof s !== 'string' || trim(s) === '') return false;
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(trim(s));
  }

  function createThumbFromBlobClanovi(blob, maxWidthPx) {
    maxWidthPx = maxWidthPx || 64;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) { resolve({ blob: null, mime: 'image/jpeg' }); return; }
        var scale = w > maxWidthPx ? maxWidthPx / w : 1;
        var tw = Math.round(w * scale);
        var th = Math.round(h * scale);
        if (tw < 1 || th < 1) { resolve({ blob: null, mime: 'image/jpeg' }); return; }
        var canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve({ blob: null, mime: 'image/jpeg' }); return; }
        ctx.drawImage(img, 0, 0, tw, th);
        canvas.toBlob(function (outBlob) {
          resolve({ blob: outBlob, mime: outBlob ? 'image/jpeg' : 'image/jpeg' });
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Thumb load failed')); };
      img.src = url;
    });
  }

  function createRoundThumbFromBlob(blob, sizePx, offsetFraction) {
    sizePx = sizePx || 64;
    if (typeof offsetFraction !== 'number') offsetFraction = 0;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) { resolve({ blob: null, mime: 'image/webp' }); return; }
        var minSide = Math.min(w, h);
        var sx = (w - minSide) / 2;
        var maxSy = h - minSide;
        var baseSy = maxSy / 2;
        var sy = baseSy + offsetFraction * baseSy;
        if (sy < 0) sy = 0;
        if (sy > maxSy) sy = maxSy;
        var canvas = document.createElement('canvas');
        canvas.width = sizePx;
        canvas.height = sizePx;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve({ blob: null, mime: 'image/webp' }); return; }
        ctx.clearRect(0, 0, sizePx, sizePx);
        ctx.save();
        ctx.beginPath();
        ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, sizePx, sizePx);
        ctx.restore();
        canvas.toBlob(function (outBlob) {
          resolve({ blob: outBlob, mime: 'image/webp' });
        }, 'image/webp', 0.9);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Round thumb load failed')); };
      img.src = url;
    });
  }

  /**
   * FormData za POST. Kod izmjene šaljemo i prazne nullable ključeve da PHP može u bazi postaviti NULL
   * kad korisnik obriše datum, OIB ili vrati select na „nije odabrano“. Kod upisa i dalje šaljemo samo popunjena polja.
   */
  function buildClanoviFormData(payload, jeIzmjena) {
    var fd = new FormData();
    if (jeIzmjena && payload.id != null) fd.append('id', String(payload.id));
    if (payload.id_drzava != null && String(payload.id_drzava) !== '') fd.append('id_drzava', String(payload.id_drzava));
    fd.append('id_loza', payload.id_loza);
    fd.append('prezime', payload.prezime);
    fd.append('ime', payload.ime);
    fd.append('spol', payload.spol);
    if (jeIzmjena) {
      fd.append('datum_rodjenja', payload.datum_rodjenja != null && String(payload.datum_rodjenja) !== '' ? String(payload.datum_rodjenja) : '');
      fd.append('oib', payload.oib != null && String(payload.oib) !== '' ? String(payload.oib) : '');
      fd.append('porijeklo', payload.porijeklo != null && String(payload.porijeklo) !== '' ? String(payload.porijeklo) : '');
      fd.append('na_prijedlog', payload.na_prijedlog != null && String(payload.na_prijedlog) !== '' ? String(payload.na_prijedlog) : '');
      fd.append('id_drzava_adrese', payload.id_drzava_adrese != null && String(payload.id_drzava_adrese) !== '' ? String(payload.id_drzava_adrese) : '');
    } else {
      if (payload.datum_rodjenja != null) fd.append('datum_rodjenja', payload.datum_rodjenja);
      if (payload.oib != null) fd.append('oib', payload.oib);
      if (payload.porijeklo != null) fd.append('porijeklo', payload.porijeklo);
      if (payload.na_prijedlog != null) fd.append('na_prijedlog', payload.na_prijedlog);
      if (payload.id_drzava_adrese != null) fd.append('id_drzava_adrese', payload.id_drzava_adrese);
    }
    fd.append('telefon_text', payload.telefon_text);
    fd.append('email_text', payload.email_text);
    fd.append('adresa_1', payload.adresa_1);
    fd.append('adresa_2', payload.adresa_2);
    fd.append('grad', payload.grad);
    fd.append('posta', payload.posta);
    fd.append('napomena', payload.napomena);
    return fd;
  }

  function updateCrudUpisiState() {
    var imaLozu = selectLoza && trim(selectLoza.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;
    var editPrezime = document.getElementById('edit_prezime');
    var imaSadrzaj = editPrezime ? trim(editPrezime.value) !== '' : false;

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaLozu || (!imaSelekciju && !imaSadrzaj);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    /* Drugi red naslova edit panela – isto stanje kao gumb (enable/disable, Upis vs Izmjeni). */
    clanoviLozaUpdateNaslovPodnaslovClana();
  }

  (function () {
    var editPrezime = document.getElementById('edit_prezime');
    if (!editPrezime) return;
    function handleEditPrezimeChange() {
      updateCrudUpisiState();
      updateEnabledState();
    }
    editPrezime.addEventListener('input', handleEditPrezimeChange);
    editPrezime.addEventListener('change', handleEditPrezimeChange);
    var wrap = editPrezime.closest('.kontrola-edit-delete');
    if (wrap) {
      wrap.addEventListener('kontrole-edit-delete-clear', function () {
        if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
        clearSlikaFromControl();
        handleEditPrezimeChange();
      });
    }
  })();

  /* =========================================================================
   * ▒▒ BLOK 1: PRAVA GEO ▒▒
   * Dohvat dozvoljenih država / regija / loža iz Duznosnici_Drzave_Regije_Loze_sve.php.
   * Zamjenjuje stari mehanizam sustav_varijable id=102 + zasebne Drzave_CRUD_sve /
   * Regije_CRUD_sve / Loze_CRUD_sve pozive. Sada jedan fetch vraća sve dozvoljene
   * entitete (kaskadno filtrirane na serveru), a klijent samo filtrira keš pri
   * promjeni selecta.
   *
   * Geo keš / XHR / filtri država–regija–loža: 0-Filteri_Po_Ogranicenjima.js (vnlhGeo*).
   * Za novi modul: uključi taj .js, pozovi vnlhGeoOgranicenjaUcitaj s odgovarajućim html_fajl,
   * zatim popuni selecte iz vnlhGeoOgranicenjaDohvatiKeš + vnlhGeoFiltriraj* kao ovdje.
   * ========================================================================= */

  /**
   * Dohvat dozvoljenih geo entiteta (+ upis/brisanje zastavice) s PHP-a.
   * Keš i XHR: vnlhGeoOgranicenjaUcitaj u 0-Filteri_Po_Ogranicenjima.js.
   * Popunjava select država, pokreće auto-select kaskadu; primijeniPravaCrud() (Blok 2).
   * @param {Function} callback – poziva se nakon inicijalne populacije selecta (i auto-selecta ako ga ima)
   */
  function ucitajPravaGeo(callback) {
    var url =
      typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
        ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Clanovi_Loza_CRUD.html')
        : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') +
          '?html_fajl=' +
          encodeURIComponent('Clanovi_Loza_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = g.drzave || [];

      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');

      _pravaCrudUpis = g.upis_izmjena != null ? parseInt(g.upis_izmjena, 10) : 0;
      _pravaCrudBrisanje = g.brisanje_sloga != null ? parseInt(g.brisanje_sloga, 10) : 0;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(_pravaCrudUpis, _pravaCrudBrisanje);

      if (drz.length === 1 && selectDrzava) {
        selectDrzava.value = String(drz[0].id);
        selectDrzava.disabled = true;
        _geoAutoLockedDrzava = true;
        setAutoLockedClass(selectDrzava, true);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        popuniRegijeIzKeša(selectDrzava.value, callback);
      } else {
        _geoAutoLockedDrzava = false;
        setAutoLockedClass(selectDrzava, false);
        if (selectDrzava) selectDrzava.disabled = false;
        popuniRegijeIzKeša('', function () {});
        if (callback) callback();
      }
    });
  }

  /**
   * Pomoćna: popuni <select> iz niza objekata { id, naziv }.
   * @param {HTMLSelectElement} sel
   * @param {Array} arr – [{ id, naziv }, ...]
   * @param {string} placeholder – tekst prazne opcije (npr. '— Odaberi državu —')
   * @param {string} kontrolaId – HTML id za KontroleRefreshCustomSelect
   */
  function popuniSelectIzKeša(sel, arr, placeholder, kontrolaId) {
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    sel.appendChild(opt0);
    for (var i = 0; i < arr.length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? String(arr[i].id) : '';
      opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
      sel.appendChild(opt);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) KontroleRefreshCustomSelect(kontrolaId);
  }

  /**
   * Filtrira keširan niz regija po id_drzava, popuni select regija.
   * Ako postoji samo 1 regija → auto-select, zaključaj select, kaskada na lože.
   * Ako više → enable select, čisti lože.
   */
  function popuniRegijeIzKeša(idDrzava, callback) {
    _geoAutoLockedRegija = false;
    setAutoLockedClass(selectRegija, false);
    if (!selectRegija) { if (callback) callback(); return; }
    if (!idDrzava) {
      popuniSelectIzKeša(selectRegija, [], '— Odaberi regiju —', 'select_regija');
      selectRegija.disabled = true;
      popuniLozeIzKeša('', function () {});
      lozeData = [];
      data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], ClanoviLozaCRUD.Tablica_Zaglavlje);
      scrollTablicaClanoviToTop();
      if (callback) callback();
      return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano =
      typeof window.vnlhGeoFiltrirajRegijePoDrzavi === 'function'
        ? window.vnlhGeoFiltrirajRegijePoDrzavi(g.regije, idDrzava)
        : [];
    popuniSelectIzKeša(selectRegija, filtrirano, '— Odaberi regiju —', 'select_regija');

    if (filtrirano.length === 1) {
      selectRegija.value = String(filtrirano[0].id);
      selectRegija.disabled = true;
      _geoAutoLockedRegija = true;
      setAutoLockedClass(selectRegija, true);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_regija');
      popuniLozeIzKeša(selectRegija.value, callback);
    } else {
      selectRegija.disabled = (filtrirano.length === 0);
      popuniLozeIzKeša('', function () {});
      if (callback) callback();
    }
  }

  /**
   * Filtrira keširan niz loža po id_regija, popuni select loža i lozeData.
   * Ako postoji samo 1 loža → auto-select, zaključaj select, osvježi tablicu.
   * Ako više → enable select, čisti tablicu.
   */
  function popuniLozeIzKeša(idRegija, callback) {
    _geoAutoLockedLoza = false;
    setAutoLockedClass(selectLoza, false);
    if (!selectLoza) { if (callback) callback(); return; }
    if (!idRegija) {
      popuniSelectIzKeša(selectLoza, [], '— Odaberi ložu —', 'select_loza');
      selectLoza.disabled = true;
      lozeData = [];
      data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], ClanoviLozaCRUD.Tablica_Zaglavlje);
      scrollTablicaClanoviToTop();
      if (callback) callback();
      return;
    }
    var g2 = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano =
      typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function'
        ? window.vnlhGeoFiltrirajLozePoRegiji(g2.loze, idRegija)
        : [];
    popuniSelectIzKeša(selectLoza, filtrirano, '— Odaberi ložu —', 'select_loza');

    // Ažuriraj lozeData – ostale funkcije (osvjeziTablicu, ucitajStupnjeve) ovise o njemu
    lozeData = [];
    for (var j = 0; j < filtrirano.length; j++) {
      lozeData.push({
        id: filtrirano[j].id,
        naziv: filtrirano[j].naziv,
        id_obred: filtrirano[j].id_obred != null ? filtrirano[j].id_obred : null
      });
    }

    if (filtrirano.length === 1) {
      selectLoza.value = String(filtrirano[0].id);
      selectLoza.disabled = true;
      _geoAutoLockedLoza = true;
      setAutoLockedClass(selectLoza, true);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
      osvjeziTablicu(function () {
        clanoviLozaUpdateNaslovLozu();
        updateEnabledState();
        updateCrudUpisiState();
        if (callback) callback();
      });
    } else {
      selectLoza.disabled = (filtrirano.length === 0);
      data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], ClanoviLozaCRUD.Tablica_Zaglavlje);
      scrollTablicaClanoviToTop();
      clanoviLozaUpdateNaslovLozu();
      if (callback) callback();
    }
  }

  /* =========================================================================
   * ▒▒ KRAJ BLOKA 1: PRAVA GEO ▒▒
   * ========================================================================= */

  /* =========================================================================
   * ▒▒ BLOK 2: PRAVA CRUD ▒▒
   * Sakriva tipke Upis/Izmjeni i Izbriši ako dužnosnik nema odgovarajuće pravo.
   * Koristi globalnu vnlhPrimijeniPravaCrud iz 0-Common.js umjesto lokalne kopije.
   * Modul-level varijable _pravaCrudUpis / _pravaCrudBrisanje služe za primjenu
   * istih prava na ellipsis modale (telefon / e-mail / adresa).
   * ========================================================================= */

  /** Spremljene CRUD zastavice (iz geo odgovora); koriste se i za ellipsis modale. */
  var _pravaCrudUpis = 1;
  var _pravaCrudBrisanje = 1;

  /* =========================================================================
   * ▒▒ KRAJ BLOKA 2: PRAVA CRUD ▒▒
   * ========================================================================= */

  /**
   * Filtriranje podataka za tablicu prema polju #clanovi_loza_trazi (prezime, ime, stupanj, šifra, upisano, spol).
   * Ne koristi Lista.js niti lista-trazi klase – samo čitanje vrijednosti inputa.
   */
  function clanoviLozaPrimijeniTraži(lista) {
    var el = document.getElementById('clanovi_loza_trazi');
    var q = el ? trim(el.value).toLowerCase() : '';
    if (!q) return lista.slice();
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      var sif = r.sifra != null ? String(r.sifra) : '';
      var st = r.stupanj_show != null ? String(r.stupanj_show) : '';
      var stNum = r.stupanj != null ? String(r.stupanj) : '';
      var vu = r.upisano != null ? String(r.upisano) : '';
      var spolTxt = (r.spol === 1 || r.spol === '1') ? 'ženski' : 'muški';
      var hay = ((r.prezime || '') + ' ' + (r.ime || '') + ' ' + st + ' ' + stNum + ' ' + sif + ' ' + vu + ' ' + spolTxt).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(r);
    }
    return out;
  }

  /** Iz niza zapisa gradi retke za CommonCRUD – isti redoslijed kao Clanovi_CRUD.js (ucitajClanove). */
  function clanoviLozaPodaciURedove(arr) {
    var rows = [];
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      var jeKandidat = parseInt(r.kandidat, 10) === 1;
      var stupanjShow = jeKandidat ? 'K' : (r.stupanj_show != null ? String(r.stupanj_show) : '');
      var spolDisplay = (r.spol === 1 || r.spol === '1') ? 'Ženski' : 'Muški';
      rows.push({
        id: r.id != null ? r.id : '',
        0: r.prezime != null ? r.prezime : '',
        1: r.ime != null ? r.ime : '',
        2: stupanjShow,
        3: spolDisplay,
        _kandidat: jeKandidat
      });
    }
    return rows;
  }

  /** Primijeni boje na retke kandidata (kandidat=1): sivi tekst retka, zeleni bg na koloni St. */
  function clanoviLozaPrimijenKandidatStil(rows) {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    var trs = container.querySelectorAll('.kontrola-tablica__scroll tbody tr');
    for (var i = 0; i < trs.length; i++) {
      if (!rows[i] || !rows[i]._kandidat) continue;
      trs[i].style.color = 'var(--c-gray-300)';
      var tds = trs[i].querySelectorAll('td');
      if (tds[2]) tds[2].style.backgroundColor = 'var(--c-green-500)';
    }
  }

  /** Fiksno broj vidljivih redaka u scroll području (bez UI odabira – kao bivših 10). */
  var CLANOVI_LOZA_TABLICA_VIDLJIVIH_REDAKA = 10;

  /**
   * Postavlja --tablica_vidljivih_redova na kontejneru tablice (jedini parametar koji 0-Kontrole.css
   * stvarno koristi za visinu skrola). Uklonjeno: --tablica_ukupna_visina / --tablica_scroll_visina
   * (to je bilo vezano uz Lista.css, ovdje ne radi ništa i moglo je zbunjivati layout).
   */
  function clanoviLozaPostaviVidljivihRedova() {
    var container = document.getElementById('tablicaContainer');
    if (!container || !container.style) return;
    container.style.setProperty('--tablica_vidljivih_redova', String(CLANOVI_LOZA_TABLICA_VIDLJIVIH_REDAKA));
  }

  function clanoviLozaOsvjeziPrikazTablice() {
    var rows = clanoviLozaPodaciURedove(clanoviLozaPrimijeniTraži(data));
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, ClanoviLozaCRUD.Tablica_Zaglavlje);
    clanoviLozaPrimijenKandidatStil(rows);
    clanoviLozaPostaviVidljivihRedova();
    scrollTablicaClanoviToTop();
    /* Nakon filtera ponekad je thead/layout još u tranziciji – ponovno primijeni zaglavlje u idućem okviru. */
    var tc = document.getElementById('tablicaContainer');
    if (tc && ClanoviLozaCRUD.Tablica_Zaglavlje && typeof CommonCRUD !== 'undefined' && CommonCRUD.primijeniTablicaZaglavlje) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          CommonCRUD.primijeniTablicaZaglavlje(tc, ClanoviLozaCRUD.Tablica_Zaglavlje);
        });
      });
    }
  }

  function ucitajClanove(idLoza, callback) {
    if (!idLoza) {
      data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], ClanoviLozaCRUD.Tablica_Zaglavlje);
      scrollTablicaClanoviToTop();
      populateNaPrijedlog(null);
      if (callback) callback();
      return;
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
            data.push(arr[i]);
          }
        } catch (e) {}
      }
      clanoviLozaOsvjeziPrikazTablice();
      populateNaPrijedlog(getSelectedRowId());
      if (callback) callback();
    };
    xhr.send();
  }

  /**
   * Jednokratni dohvat mape ograničenja stupnjeva po obredu (sesija = id_duznosnik).
   * id_duznosnik_test u URL-u (Alati_Meni_Test) kao kod ucitajPravaGeo.
   * @param {function(): void} [done]
   */
  function ucitajStupnjeviOgranicenjaZaClanoviCrud(done) {
    if (_stupnjeviOgrLoaded) {
      if (typeof done === 'function') done();
      return;
    }
    if (typeof done === 'function') {
      _stupnjeviOgrWait.push(done);
    }
    if (_stupnjeviOgrReq) {
      return;
    }
    var url = getApiUrl('duznosnici_ogranicenja_stupnjevi_po_obredu.php');
    try {
      var spO = new URLSearchParams(window.location.search);
      var idtO = spO.get('id_duznosnik_test');
      if (idtO && parseInt(idtO, 10) > 0) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'id_duznosnik_test=' + encodeURIComponent(idtO);
      }
    } catch (eOgrUrl) {}
    var xhrOgr = new XMLHttpRequest();
    _stupnjeviOgrReq = xhrOgr;
    xhrOgr.open('GET', url, true);
    xhrOgr.onreadystatechange = function () {
      if (xhrOgr.readyState !== 4) return;
      _stupnjeviOgrReq = null;
      _stupnjeviOgrLoaded = true;
      var txtO = (xhrOgr.responseText || '').trim();
      if (txtO !== '' && txtO.charAt(0) === '{') {
        try {
          _stupnjeviOgrMap = JSON.parse(txtO);
        } catch (eOgrParse) {
          _stupnjeviOgrMap = {};
        }
      } else {
        _stupnjeviOgrMap = {};
      }
      var cek = _stupnjeviOgrWait;
      _stupnjeviOgrWait = [];
      for (var wi = 0; wi < cek.length; wi++) {
        try {
          if (cek[wi]) cek[wi]();
        } catch (eOgrCb) {}
      }
    };
    xhrOgr.send();
  }

  function ucitajStupnjeve(obredId, callback) {
    if (!selectIzborStupnja) { if (callback) callback(); return; }
    if (!obredId || obredId <= 0) {
      while (selectIzborStupnja.firstChild) selectIzborStupnja.removeChild(selectIzborStupnja.firstChild);
      var o = document.createElement('option');
      o.value = ''; o.textContent = '— Odaberi stupanj —';
      selectIzborStupnja.appendChild(o);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_izbor_stupnja');
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Stupnjevi_CRUD_sve.php') + '?obred_id=' + encodeURIComponent(obredId), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          arr = JSON.parse(text);
        } catch (e) {}
      }
      function puniSelectIzNiza(niz) {
        while (selectIzborStupnja.firstChild) selectIzborStupnja.removeChild(selectIzborStupnja.firstChild);
        var opt0 = document.createElement('option');
        opt0.value = ''; opt0.textContent = '— Odaberi stupanj —';
        selectIzborStupnja.appendChild(opt0);
        for (var i = 0; i < niz.length; i++) {
          var op = document.createElement('option');
          op.value = niz[i].id != null ? String(niz[i].id) : '';
          op.textContent = (niz[i].stupanj != null ? String(niz[i].stupanj) + '\u00B0' : '') + ', ' + (niz[i].naziv != null ? niz[i].naziv : '');
          selectIzborStupnja.appendChild(op);
        }
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_izbor_stupnja');
        if (callback) callback();
      }
      function nakonMapeOgr() {
        var zaPrikaz = arr;
        if (typeof window.vnlhFilteriStupnjeviPoOgranicenjimaZaSelekt === 'function') {
          zaPrikaz = window.vnlhFilteriStupnjeviPoOgranicenjimaZaSelekt(arr, obredId, _stupnjeviOgrMap);
        }
        puniSelectIzNiza(zaPrikaz && zaPrikaz.length ? zaPrikaz : []);
      }
      ucitajStupnjeviOgranicenjaZaClanoviCrud(nakonMapeOgr);
    };
    xhr.send();
  }

  /** Skrol tablice članova na vrh (kad se promijeni loža ili se tablica očisti). */
  function scrollTablicaClanoviToTop() {
    var container = document.getElementById('tablicaContainer');
    var scrollEl = container && container.querySelector('.kontrola-tablica__scroll');
    if (scrollEl) scrollEl.scrollTop = 0;
  }

  function osvjeziTablicu(callback) {
    var idLoza = selectLoza ? trim(selectLoza.value) : '';
    ucitajClanove(idLoza, function () {
      updateCrudUpisiState();
      if (typeof callback === 'function') callback();
    });
  }

  if (selectDrzava) {
    selectDrzava.addEventListener('change', function () {
      var id = trim(this.value);
      if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
      clearControlsFromSelection();
      clearSlikaFromControl();
      // popuniRegijeIzKeša interno čisti i lože (kaskada)
      popuniRegijeIzKeša(id, function () {
        updateEnabledState();
        updateCrudUpisiState();
      });
    });
  }

  if (selectRegija) {
    selectRegija.addEventListener('change', function () {
      var id = trim(this.value);
      if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
      clearControlsFromSelection();
      clearSlikaFromControl();
      popuniLozeIzKeša(id, function () {
        updateEnabledState();
        updateCrudUpisiState();
      });
    });
  }

  /**
   * Prvi red zaglavlja edit panela: „C ∴ L ∴“ + naziv odabrane lože (Unicode U+2234 = therefore ∴).
   * Dok nije odabrana loža u select_loza — prazan red (bez C ∴ L ∴).
   */
  function clanoviLozaUpdateNaslovLozu() {
    var el = document.getElementById('edit_loza_naslov_line1');
    var sel = document.getElementById('select_loza');
    if (!el || !sel) return;
    if (!trim(sel.value)) {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.textContent = '';
      clanoviLozaUpdateTablicaHeaderLogo();
      return;
    }
    var opt = sel.options[sel.selectedIndex];
    var t = opt && opt.textContent ? trim(opt.textContent) : '';
    var lozeNaziv = (t && sel.value !== '') ? t : '';
    /* C ∴ L ∴ + naziv lože (spanovi za ∴: pouzdan font). */
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(document.createTextNode('C '));
    var s1 = document.createElement('span');
    s1.className = 'clanovi-loza-crud__edit-loza-therefore';
    s1.setAttribute('aria-hidden', 'true');
    s1.textContent = '\u2234';
    el.appendChild(s1);
    el.appendChild(document.createTextNode(' L '));
    var s2 = document.createElement('span');
    s2.className = 'clanovi-loza-crud__edit-loza-therefore';
    s2.setAttribute('aria-hidden', 'true');
    s2.textContent = '\u2234';
    el.appendChild(s2);
    if (lozeNaziv) el.appendChild(document.createTextNode(' ' + lozeNaziv));
    clanoviLozaUpdateTablicaHeaderLogo();
  }

  /**
   * Drugi red zaglavlja edit panela – usklađen s tipkom Upis/Izmjeni (updateCrudUpisiState).
   * Gumb disabled → prazan red.
   * Gumb enabled + Upis (nema retka u tablici, ali ima teksta u Prezime) → fiksni tekst za novog kandidata.
   * Gumb enabled + Izmjeni (odabran red):
   *   – aktivnost 0 i kandidat 1 (iz Clanovi_CRUD_sve.php): „Korekcija podataka kandidata: prezime, ime“ (bez šifre).
   *   – inače: „Korekcija podataka člana: prezime, ime, šifra“.
   */
  function clanoviLozaUpdateNaslovPodnaslovClana() {
    var el2 = document.getElementById('edit_loza_naslov_line2');
    if (!el2) return;
    if (!btnUpisi || btnUpisi.disabled) {
      el2.textContent = '';
      return;
    }
    var imaSelekciju = getSelectedRowId() != null;
    if (!imaSelekciju) {
      el2.textContent = 'Dodavanje novog kandidata u bazu';
      return;
    }
    var id = getSelectedRowId();
    var found = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i] && String(data[i].id) === String(id)) {
        found = data[i];
        break;
      }
    }
    if (!found) {
      el2.textContent = '';
      return;
    }
    var p = found.prezime != null ? String(found.prezime) : '';
    var im = found.ime != null ? String(found.ime) : '';
    var brojIskaznice = found.sifra != null ? String(found.sifra) : '';
    var aktivnostNum = found.aktivnost != null && String(found.aktivnost).replace(/^\s+|\s+$/g, '') !== ''
      ? parseInt(String(found.aktivnost), 10)
      : NaN;
    var kandidatNum = found.kandidat != null && String(found.kandidat).replace(/^\s+|\s+$/g, '') !== ''
      ? parseInt(String(found.kandidat), 10)
      : NaN;
    if (aktivnostNum === 0 && kandidatNum === 1) {
      el2.textContent = 'Korekcija podataka kandidata: ' + p + ', ' + im;
      return;
    }
    el2.textContent = 'Korekcija podataka člana: ' + p + ', ' + im + ', ' + brojIskaznice;
  }

  /**
   * Logo lože u zaglavlju panela tablice: lijevo, kvadrat unutar fiksnog okvira (Loze_CRUD_slika.php – glavna slika, ne thumb).
   * Bez odabrane lože ili bez slike / greška učitavanja: samo sivi okvir (placeholder).
   */
  function clanoviLozaUpdateTablicaHeaderLogo() {
    var img = document.getElementById('clanovi_loza_tablica_logo');
    var frame = img && img.closest ? img.closest('.clanovi-loza-crud__tablica-header-logo-frame') : null;
    if (!img || !frame) return;
    var idLoza = selectLoza ? trim(selectLoza.value) : '';
    var placeholderSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.onload = null;
    img.onerror = null;
    if (!idLoza) {
      img.hidden = true;
      img.src = placeholderSrc;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      return;
    }
    frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    img.hidden = true;
    img.onload = function () {
      if (img.naturalWidth > 0) {
        img.hidden = false;
        frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      } else {
        img.hidden = true;
        frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      }
    };
    img.onerror = function () {
      img.hidden = true;
      img.src = placeholderSrc;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    };
    img.src = API_BASE + 'Loze_CRUD_slika.php?id=' + encodeURIComponent(idLoza) + '&t=' + String(Date.now());
  }

  var _clanoviLozaLogoSyncRaf = null;

  /**
   * Veličina kvadrata loga u zaglavlju tablice (samo ova forma).
   * Zaglavlje (.kontrola-panel__header) ima padding – logo se u CSS-u gura marginama za 1 px od ruba.
   * Stranica kvadrata = paddingTop + visina(stupca kontrola) + paddingBottom − 2 (1 px od gornjeg i donjeg ruba
   * padding boxa zaglavlja). Logo je u CSS-u position:absolute pa ne povećava flex-visinu zaglavlja.
   * Ograničenje širine: da desni stupac ne nestane.
   * Postavlja --clanovi-loza-logo-side (px) na .tablica-header.
   */
  function clanoviLozaSyncTablicaHeaderLogoSize() {
    if (_clanoviLozaLogoSyncRaf) cancelAnimationFrame(_clanoviLozaLogoSyncRaf);
    _clanoviLozaLogoSyncRaf = requestAnimationFrame(function () {
      _clanoviLozaLogoSyncRaf = null;
      var header = document.querySelector('.clanovi-loza-crud__tablica-header');
      var kontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      var wrap = document.querySelector('.clanovi-loza-crud__tablica-header-logo-wrap');
      if (!header || !kontrole || !wrap) return;
      var csW = getComputedStyle(wrap);
      if (csW.display === 'none') {
        header.style.removeProperty('--clanovi-loza-logo-side');
        return;
      }
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

  if (selectLoza) {
    selectLoza.addEventListener('change', function () {
      var tz = document.getElementById('clanovi_loza_trazi');
      if (tz) tz.value = '';
      if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
      clearControlsFromSelection();
      clearSlikaFromControl();
      clanoviLozaUpdateNaslovLozu();
      osvjeziTablicu();
      updateEnabledState();
      updateCrudUpisiState();
    });
  }

  (function clanoviLozaInitTraziTablica() {
    var inpTrazi = document.getElementById('clanovi_loza_trazi');
    if (!inpTrazi) return;
    var _traziDebounce = null;
    inpTrazi.addEventListener('input', function () {
      if (_traziDebounce) clearTimeout(_traziDebounce);
      _traziDebounce = setTimeout(function () {
        _traziDebounce = null;
        clanoviLozaOsvjeziPrikazTablice();
        var sid = getSelectedRowId();
        if (sid != null && tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function') {
          tablicaApi.setSelectedRowIds([String(sid)]);
        }
      }, 200);
    });
    var traziEd = inpTrazi.closest('.kontrola-edit-delete');
    if (traziEd) {
      traziEd.addEventListener('kontrole-edit-delete-clear', function () {
        clanoviLozaOsvjeziPrikazTablice();
      });
    }
  })();

  if (btnReloadTablica) {
    btnReloadTablica.addEventListener('click', function () {
      osvjeziTablicu();
    });
  }

  var CLANOVI_ELLIPSIS_STORAGE_PREFIX = 'clanovi_ellipsis_modal_';
  var CLANOVI_ELLIPSIS_DEFAULT_W = 400;
  var CLANOVI_ELLIPSIS_DEFAULT_H = 360;

  function parseCssVarPx(el, prop) {
    var v = (el ? getComputedStyle(el) : getComputedStyle(document.documentElement)).getPropertyValue(prop).trim();
    return v ? parseFloat(v) || 0 : 0;
  }

  function getClanoviEllipsisTelefonMinH() {
    var root = document.documentElement;
    var phy = parseCssVarPx(root, '--panel_header_padding_y');
    var phx = parseCssVarPx(root, '--panel_header_padding_x');
    var pby = parseCssVarPx(root, '--panel_body_padding_y');
    var editH = parseCssVarPx(root, '--edit_height');
    var th = parseCssVarPx(root, '--tablica_head_h');
    var tr = parseCssVarPx(root, '--tablica_row_h');
    var te = parseCssVarPx(root, '--tablica_extra');
    var resizeH = parseCssVarPx(root, '--panel_resize_bar_height');
    var vidljivihRedova = parseCssVarPx(root, '--tablica_vidljivih_redova') || 5;
    var tableH = th + (tr * vidljivihRedova) + te;
    var header = 2 * phy + editH;
    var body = pby + phx + tableH + phx + 16 + editH + 16 + editH + 16 + pby;
    var footer = 2 * pby + editH;
    return Math.ceil(header + body + resizeH + footer);
  }

  function getClanoviEllipsisAdresaMinH() {
    var base = getClanoviEllipsisTelefonMinH();
    var editH = parseCssVarPx(document.documentElement, '--edit_height');
    return base + Math.ceil(3 * (editH + 16));
  }

  function getClanoviEllipsisModalState(type) {
    try {
      var s = localStorage.getItem(CLANOVI_ELLIPSIS_STORAGE_PREFIX + type + '_state');
      if (s) {
        var o = JSON.parse(s);
        if (o && typeof o.left === 'number' && typeof o.top === 'number' && typeof o.width === 'number' && typeof o.height === 'number') {
          return o;
        }
      }
    } catch (e) {}
    return null;
  }

  function saveClanoviEllipsisModalState(type, left, top, width, height) {
    try {
      localStorage.setItem(CLANOVI_ELLIPSIS_STORAGE_PREFIX + type + '_state', JSON.stringify({ left: left, top: top, width: width, height: height }));
    } catch (e) {}
  }

  function initClanoviEllipsisModalDrag(header, dialog, type) {
    var startX, startY, startLeft, startTop;
    function start(e) {
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      var leftVal = parseFloat(dialog.style.left);
      var topVal = parseFloat(dialog.style.top);
      if (dialog.style.transform && dialog.style.transform.indexOf('translate') >= 0 || isNaN(leftVal) || isNaN(topVal)) {
        startLeft = (window.innerWidth - dialog.offsetWidth) / 2;
        startTop = (window.innerHeight - dialog.offsetHeight) / 2;
        dialog.style.left = startLeft + 'px';
        dialog.style.top = startTop + 'px';
        dialog.style.transform = 'none';
      } else {
        startLeft = leftVal;
        startTop = topVal;
      }
      function move(ev) {
        var x = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var y = ev.touches ? ev.touches[0].clientY : ev.clientY;
        dialog.style.left = Math.max(0, startLeft + x - startX) + 'px';
        dialog.style.top = Math.max(0, startTop + y - startY) + 'px';
      }
      function stop() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', move, { passive: false });
        document.removeEventListener('touchend', stop);
        saveClanoviEllipsisModalState(type, parseFloat(dialog.style.left), parseFloat(dialog.style.top), dialog.offsetWidth, dialog.offsetHeight);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', stop);
      if (e.cancelable) e.preventDefault();
    }
    header.addEventListener('mousedown', start);
    header.addEventListener('touchstart', start, { passive: false });
  }

  function initClanoviEllipsisModalResize(bar, dialog, type) {
    function getMinH() {
      if (type === 'adresa') return getClanoviEllipsisAdresaMinH();
      if (type === 'telefon' || type === 'email') return getClanoviEllipsisTelefonMinH();
      return 180;
    }
    function startResize(e) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      var startY = e.touches ? e.touches[0].clientY : e.clientY;
      var startHeight = dialog.offsetHeight;
      if (dialog.style.transform && dialog.style.transform.indexOf('translate') >= 0) {
        dialog.style.left = (window.innerWidth - dialog.offsetWidth) / 2 + 'px';
        dialog.style.top = (window.innerHeight - startHeight) / 2 + 'px';
        dialog.style.transform = 'none';
      }
      function move(ev) {
        if (ev.cancelable) ev.preventDefault();
        var minH = getMinH();
        var maxH = Math.max(minH, window.innerHeight - 40);
        var y = ev.touches ? ev.touches[0].clientY : ev.clientY;
        var delta = y - startY;
        var newH = Math.max(minH, Math.min(maxH, startHeight + delta));
        dialog.style.height = newH + 'px';
      }
      function stop() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', move, { passive: false });
        document.removeEventListener('touchend', stop);
        document.removeEventListener('touchcancel', stop);
        saveClanoviEllipsisModalState(type, parseFloat(dialog.style.left), parseFloat(dialog.style.top), dialog.offsetWidth, dialog.offsetHeight);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', stop);
      document.addEventListener('touchcancel', stop);
    }
    bar.addEventListener('mousedown', startResize);
    bar.addEventListener('touchstart', startResize, { passive: false });
  }

  function initClanoviEllipsisModalMinDimensions(dialog, type) {
    if (window.innerWidth <= 768) return;
    var minH = (type === 'adresa') ? getClanoviEllipsisAdresaMinH() : (type === 'telefon' || type === 'email') ? getClanoviEllipsisTelefonMinH() : 180;
    dialog.style.minWidth = minH + 'px';
    dialog.style.minHeight = minH + 'px';
  }

  var ClanoviEllipsisTelefonCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-ellipsis-telefon',
    Tablica_Zaglavlje: [
      { key: 'tip', title: 'Tip', SQL_Naziv: 'tip', sortable: 0, sortable_icon: 0, type: 'b', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 1 },
      { key: 'telefon', title: 'Telefoni', SQL_Naziv: 'telefon', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var clanoviEllipsisTelefonTablicaApi = null;
  var clanoviEllipsisTelefonTipoviData = [];

  function buildTelefonModalBody(body) {
    body.innerHTML = '';
    body.className = 'clanovi-ellipsis-modal__body clanovi-ellipsis-modal__body--telefon';

    var tablicaWrap = document.createElement('div');
    tablicaWrap.className = 'clanovi-ellipsis-modal__tablica-wrap';
    var shadowWrap = document.createElement('div');
    shadowWrap.className = 'clanovi-ellipsis-modal__tablica-shadow-wrap';
    var tablicaContainer = document.createElement('div');
    tablicaContainer.id = 'clanovi_ellipsis_modal_telefon_tablica';
    tablicaContainer.className = 'kontrola-tablica';
    shadowWrap.appendChild(tablicaContainer);
    tablicaWrap.appendChild(shadowWrap);
    body.appendChild(tablicaWrap);

    var controlsWrap = document.createElement('div');
    controlsWrap.className = 'clanovi-ellipsis-modal__controls-wrap';

    var rowTip = document.createElement('div');
    rowTip.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblTip = document.createElement('label');
    lblTip.className = 'kontrola-labela mb-0';
    lblTip.htmlFor = 'clanovi_ellipsis_modal_telefon_select_tip';
    lblTip.textContent = 'Tip telefona';
    var selectWrap = document.createElement('div');
    selectWrap.className = 'kontrola-select';
    var select = document.createElement('select');
    select.id = 'clanovi_ellipsis_modal_telefon_select_tip';
    select.setAttribute('aria-label', 'Tip telefona');
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Odaberi tip —';
    select.appendChild(opt0);
    selectWrap.appendChild(select);
    rowTip.appendChild(lblTip);
    rowTip.appendChild(selectWrap);
    controlsWrap.appendChild(rowTip);

    var rowBroj = document.createElement('div');
    rowBroj.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblBroj = document.createElement('label');
    lblBroj.className = 'kontrola-labela mb-0';
    lblBroj.htmlFor = 'clanovi_ellipsis_modal_telefon_edit_broj';
    lblBroj.textContent = 'Broj telefona';
    var editDeleteWrap = document.createElement('div');
    editDeleteWrap.className = 'kontrola-edit-delete';
    var inputBroj = document.createElement('input');
    inputBroj.id = 'clanovi_ellipsis_modal_telefon_edit_broj';
    inputBroj.type = 'text';
    inputBroj.className = 'kontrola-edit-delete__input';
    inputBroj.placeholder = '+385 1 999 9999';
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'kontrola-edit-delete__clear';
    clearBtn.setAttribute('aria-label', 'Obriši sadržaj');
    clearBtn.textContent = '×';
    editDeleteWrap.appendChild(inputBroj);
    editDeleteWrap.appendChild(clearBtn);
    rowBroj.appendChild(lblBroj);
    rowBroj.appendChild(editDeleteWrap);
    controlsWrap.appendChild(rowBroj);
    body.appendChild(controlsWrap);

    if (typeof KontroleInitEditDelete === 'function') KontroleInitEditDelete(body);
    if (typeof KontroleInitCustomSelect === 'function') KontroleInitCustomSelect(body);
    if (typeof window.upis_telefona === 'function') window.upis_telefona(inputBroj);
  }

  var ClanoviEllipsisEmailCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-ellipsis-email',
    Tablica_Zaglavlje: [
      { key: 'tip', title: 'Tip', SQL_Naziv: 'tip', sortable: 0, sortable_icon: 0, type: 'b', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 1 },
      { key: 'email', title: 'E-mail adrese', SQL_Naziv: 'email', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var clanoviEllipsisEmailTablicaApi = null;
  var clanoviEllipsisEmailTipoviData = [];

  function buildEmailModalBody(body) {
    body.innerHTML = '';
    body.className = 'clanovi-ellipsis-modal__body clanovi-ellipsis-modal__body--email';

    var tablicaWrap = document.createElement('div');
    tablicaWrap.className = 'clanovi-ellipsis-modal__tablica-wrap';
    var shadowWrap = document.createElement('div');
    shadowWrap.className = 'clanovi-ellipsis-modal__tablica-shadow-wrap';
    var tablicaContainer = document.createElement('div');
    tablicaContainer.id = 'clanovi_ellipsis_modal_email_tablica';
    tablicaContainer.className = 'kontrola-tablica';
    shadowWrap.appendChild(tablicaContainer);
    tablicaWrap.appendChild(shadowWrap);
    body.appendChild(tablicaWrap);

    var controlsWrap = document.createElement('div');
    controlsWrap.className = 'clanovi-ellipsis-modal__controls-wrap';

    var rowTip = document.createElement('div');
    rowTip.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblTip = document.createElement('label');
    lblTip.className = 'kontrola-labela mb-0';
    lblTip.htmlFor = 'clanovi_ellipsis_modal_email_select_tip';
    lblTip.textContent = 'Tip e-maila';
    var selectWrap = document.createElement('div');
    selectWrap.className = 'kontrola-select';
    var select = document.createElement('select');
    select.id = 'clanovi_ellipsis_modal_email_select_tip';
    select.setAttribute('aria-label', 'Tip e-maila');
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Odaberi tip —';
    select.appendChild(opt0);
    selectWrap.appendChild(select);
    rowTip.appendChild(lblTip);
    rowTip.appendChild(selectWrap);
    controlsWrap.appendChild(rowTip);

    var rowEmail = document.createElement('div');
    rowEmail.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblEmail = document.createElement('label');
    lblEmail.className = 'kontrola-labela mb-0';
    lblEmail.htmlFor = 'clanovi_ellipsis_modal_email_edit_adresa';
    lblEmail.textContent = 'e-mail';
    var editDeleteWrap = document.createElement('div');
    editDeleteWrap.className = 'kontrola-edit-delete';
    var inputEmail = document.createElement('input');
    inputEmail.id = 'clanovi_ellipsis_modal_email_edit_adresa';
    inputEmail.type = 'email';
    inputEmail.className = 'kontrola-edit-delete__input';
    inputEmail.placeholder = 'pero.peric@vnlh.eu';
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'kontrola-edit-delete__clear';
    clearBtn.setAttribute('aria-label', 'Obriši sadržaj');
    clearBtn.textContent = '×';
    editDeleteWrap.appendChild(inputEmail);
    editDeleteWrap.appendChild(clearBtn);
    rowEmail.appendChild(lblEmail);
    rowEmail.appendChild(editDeleteWrap);
    controlsWrap.appendChild(rowEmail);
    body.appendChild(controlsWrap);

    if (typeof KontroleInitEditDelete === 'function') KontroleInitEditDelete(body);
    if (typeof KontroleInitCustomSelect === 'function') KontroleInitCustomSelect(body);
  }

  var ClanoviEllipsisAdresaCRUD = {
    Broj_Kolona: 2,
    Reload_Ikona: 0,
    CrudCssPrefix: 'clanovi-ellipsis-adresa',
    Tablica_Zaglavlje: [
      { key: 'tip', title: 'Tip', SQL_Naziv: 'tip', sortable: 0, sortable_icon: 0, type: 'b', width: 60, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 1 },
      { key: 'adresa', title: 'Adresa', SQL_Naziv: 'adresa', sortable: 0, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var clanoviEllipsisAdresaTablicaApi = null;
  var clanoviEllipsisAdresaTipoviData = [];
  var clanoviEllipsisAdresaDrzaveData = [];

  function buildAdresaModalBody(body) {
    body.innerHTML = '';
    body.className = 'clanovi-ellipsis-modal__body clanovi-ellipsis-modal__body--adresa';

    var tablicaWrap = document.createElement('div');
    tablicaWrap.className = 'clanovi-ellipsis-modal__tablica-wrap';
    var shadowWrap = document.createElement('div');
    shadowWrap.className = 'clanovi-ellipsis-modal__tablica-shadow-wrap';
    var tablicaContainer = document.createElement('div');
    tablicaContainer.id = 'clanovi_ellipsis_modal_adresa_tablica';
    tablicaContainer.className = 'kontrola-tablica';
    shadowWrap.appendChild(tablicaContainer);
    tablicaWrap.appendChild(shadowWrap);

    var controlsWrap = document.createElement('div');
    controlsWrap.className = 'clanovi-ellipsis-modal__controls-wrap';

    var rowTip = document.createElement('div');
    rowTip.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblTip = document.createElement('label');
    lblTip.className = 'kontrola-labela mb-0';
    lblTip.htmlFor = 'clanovi_ellipsis_modal_adresa_select_tip';
    lblTip.textContent = 'Tip adrese';
    var selectWrap = document.createElement('div');
    selectWrap.className = 'kontrola-select';
    var selectTip = document.createElement('select');
    selectTip.id = 'clanovi_ellipsis_modal_adresa_select_tip';
    selectTip.setAttribute('aria-label', 'Tip adrese');
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Odaberi tip —';
    selectTip.appendChild(opt0);
    selectWrap.appendChild(selectTip);
    rowTip.appendChild(lblTip);
    rowTip.appendChild(selectWrap);
    controlsWrap.appendChild(rowTip);

    var rowAdresa1 = document.createElement('div');
    rowAdresa1.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblAdresa1 = document.createElement('label');
    lblAdresa1.className = 'kontrola-labela mb-0';
    lblAdresa1.htmlFor = 'clanovi_ellipsis_modal_adresa_edit_1';
    lblAdresa1.textContent = 'Adresa';
    var editDeleteWrap1 = document.createElement('div');
    editDeleteWrap1.className = 'kontrola-edit-delete';
    var inputAdresa1 = document.createElement('input');
    inputAdresa1.id = 'clanovi_ellipsis_modal_adresa_edit_1';
    inputAdresa1.type = 'text';
    inputAdresa1.className = 'kontrola-edit-delete__input';
    inputAdresa1.placeholder = 'Ulica, kućni broj...';
    var clearBtn1 = document.createElement('button');
    clearBtn1.type = 'button';
    clearBtn1.className = 'kontrola-edit-delete__clear';
    clearBtn1.setAttribute('aria-label', 'Obriši sadržaj');
    clearBtn1.textContent = '×';
    editDeleteWrap1.appendChild(inputAdresa1);
    editDeleteWrap1.appendChild(clearBtn1);
    rowAdresa1.appendChild(lblAdresa1);
    rowAdresa1.appendChild(editDeleteWrap1);
    controlsWrap.appendChild(rowAdresa1);

    var rowAdresa2 = document.createElement('div');
    rowAdresa2.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblAdresa2 = document.createElement('label');
    lblAdresa2.className = 'kontrola-labela mb-0';
    lblAdresa2.htmlFor = 'clanovi_ellipsis_modal_adresa_edit_2';
    lblAdresa2.textContent = 'Adresa 1';
    var inputAdresa2 = document.createElement('input');
    inputAdresa2.id = 'clanovi_ellipsis_modal_adresa_edit_2';
    inputAdresa2.type = 'text';
    inputAdresa2.className = 'kontrola-edit';
    inputAdresa2.placeholder = 'Dodatak adresi...';
    rowAdresa2.appendChild(lblAdresa2);
    rowAdresa2.appendChild(inputAdresa2);
    controlsWrap.appendChild(rowAdresa2);

    var rowGradPosta = document.createElement('div');
    rowGradPosta.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--grad-posta';
    var gradWrap = document.createElement('div');
    gradWrap.className = 'clanovi-ellipsis-modal__edit-cell clanovi-ellipsis-modal__edit-cell--inline';
    var lblGrad = document.createElement('label');
    lblGrad.className = 'kontrola-labela mb-0';
    lblGrad.htmlFor = 'clanovi_ellipsis_modal_adresa_edit_grad';
    lblGrad.textContent = 'Grad';
    var inputGrad = document.createElement('input');
    inputGrad.id = 'clanovi_ellipsis_modal_adresa_edit_grad';
    inputGrad.type = 'text';
    inputGrad.className = 'kontrola-edit';
    inputGrad.placeholder = 'Grad';
    gradWrap.appendChild(lblGrad);
    gradWrap.appendChild(inputGrad);
    var postaWrap = document.createElement('div');
    postaWrap.className = 'clanovi-ellipsis-modal__edit-cell clanovi-ellipsis-modal__edit-cell--inline clanovi-ellipsis-modal__edit-cell--posta';
    var lblPosta = document.createElement('label');
    lblPosta.className = 'kontrola-labela mb-0';
    lblPosta.htmlFor = 'clanovi_ellipsis_modal_adresa_edit_posta';
    lblPosta.textContent = 'Broj pošte';
    var inputPosta = document.createElement('input');
    inputPosta.id = 'clanovi_ellipsis_modal_adresa_edit_posta';
    inputPosta.type = 'text';
    inputPosta.className = 'kontrola-edit clanovi-ellipsis-modal__input-posta';
    inputPosta.placeholder = 'Broj pošte';
    inputPosta.inputMode = 'numeric';
    inputPosta.maxLength = 10;
    postaWrap.appendChild(lblPosta);
    postaWrap.appendChild(inputPosta);
    rowGradPosta.appendChild(gradWrap);
    rowGradPosta.appendChild(postaWrap);
    controlsWrap.appendChild(rowGradPosta);

    var rowDrzava = document.createElement('div');
    rowDrzava.className = 'clanovi-ellipsis-modal__edit-row clanovi-ellipsis-modal__edit-row--inline';
    var lblDrzava = document.createElement('label');
    lblDrzava.className = 'kontrola-labela mb-0';
    lblDrzava.htmlFor = 'clanovi_ellipsis_modal_adresa_select_drzava';
    lblDrzava.textContent = 'Država';
    var selectDrzavaWrap = document.createElement('div');
    selectDrzavaWrap.className = 'kontrola-select';
    var selectDrzava = document.createElement('select');
    selectDrzava.id = 'clanovi_ellipsis_modal_adresa_select_drzava';
    selectDrzava.setAttribute('aria-label', 'Država adrese');
    var optDrz0 = document.createElement('option');
    optDrz0.value = '';
    optDrz0.textContent = '— Odaberi državu —';
    selectDrzava.appendChild(optDrz0);
    selectDrzavaWrap.appendChild(selectDrzava);
    rowDrzava.appendChild(lblDrzava);
    rowDrzava.appendChild(selectDrzavaWrap);
    controlsWrap.appendChild(rowDrzava);
    body.appendChild(tablicaWrap);
    body.appendChild(controlsWrap);

    if (typeof KontroleInitEditDelete === 'function') KontroleInitEditDelete(body);
    if (typeof KontroleInitCustomSelect === 'function') KontroleInitCustomSelect(body);
  }

  function ensureClanoviEllipsisModal(type) {
    var id = 'clanovi_ellipsis_modal_' + type;
    var modal = document.getElementById(id);
    if (modal) return modal;
    var titles = {
      telefon: 'Upis dodatnih telefona',
      email: 'Upis dodatnih e-mail adresa',
      adresa: 'Upis dodatnih adresa'
    };
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'clanovi-ellipsis-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', id + '_header');
    var overlay = document.createElement('div');
    overlay.className = 'clanovi-ellipsis-modal__overlay';
    var dialog = document.createElement('div');
    dialog.className = 'clanovi-ellipsis-modal__dialog';
    var header = document.createElement('div');
    header.className = 'clanovi-ellipsis-modal__header clanovi-ellipsis-modal__header--draggable';
    header.id = id + '_header';
    header.textContent = titles[type] || type;
    var body = document.createElement('div');
    body.className = 'clanovi-ellipsis-modal__body';
    if (type === 'telefon') {
      buildTelefonModalBody(body);
    } else if (type === 'email') {
      buildEmailModalBody(body);
    } else if (type === 'adresa') {
      buildAdresaModalBody(body);
    } else {
      body.textContent = 'Sadržaj modala bit će razrađen u nastavku.';
    }
    var resizeBar = document.createElement('div');
    resizeBar.className = 'clanovi-ellipsis-modal__resize-bar';
    resizeBar.setAttribute('aria-label', 'Povuci za promjenu visine');
    var footer = document.createElement('div');
    footer.className = 'clanovi-ellipsis-modal__footer clanovi-ellipsis-modal__footer--crud';
    var footerLeft = document.createElement('div');
    footerLeft.className = 'clanovi-ellipsis-modal__footer-left';
    var btnUpisi = document.createElement('button');
    btnUpisi.type = 'button';
    btnUpisi.className = 'kontrola-btn kontrola-btn--crud-upisi';
    btnUpisi.setAttribute('aria-label', 'Upis');
    btnUpisi.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">Upis</span></span></span>';
    var btnIzbrisi = document.createElement('button');
    btnIzbrisi.type = 'button';
    btnIzbrisi.className = 'kontrola-btn kontrola-btn--crud-izbrisi';
    btnIzbrisi.setAttribute('aria-label', 'Izbriši');
    btnIzbrisi.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">Izbriši</span></span></span>';
    var footerRight = document.createElement('div');
    footerRight.className = 'clanovi-ellipsis-modal__footer-right';
    var btnPovratak = document.createElement('button');
    btnPovratak.type = 'button';
    btnPovratak.className = 'kontrola-btn kontrola-btn--crud-povratak';
    btnPovratak.setAttribute('aria-label', 'Povratak');
    btnPovratak.innerHTML = '<span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">Povratak</span></span></span>';
    btnPovratak.addEventListener('click', function () { closeClanoviEllipsisModal(type); });
    footerLeft.appendChild(btnUpisi);
    footerLeft.appendChild(btnIzbrisi);
    footerRight.appendChild(btnPovratak);
    footer.appendChild(footerLeft);
    footer.appendChild(footerRight);
    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(resizeBar);
    dialog.appendChild(footer);
    modal.appendChild(overlay);
    modal.appendChild(dialog);

    var state = getClanoviEllipsisModalState(type);
    var w = state ? state.width : CLANOVI_ELLIPSIS_DEFAULT_W;
    var h = state ? state.height : ((type === 'telefon' || type === 'email') ? getClanoviEllipsisTelefonMinH() : (type === 'adresa' ? getClanoviEllipsisAdresaMinH() : CLANOVI_ELLIPSIS_DEFAULT_H));
    if (type === 'telefon' || type === 'email') { var minH = getClanoviEllipsisTelefonMinH(); if (h < minH) h = minH; }
    if (type === 'adresa') { var minH = getClanoviEllipsisAdresaMinH(); if (h < minH) h = minH; }
    if (state) {
      dialog.style.left = state.left + 'px';
      dialog.style.top = state.top + 'px';
      dialog.style.transform = 'none';
    } else {
      dialog.style.left = Math.max(0, (window.innerWidth - w) / 2) + 'px';
      dialog.style.top = Math.max(0, (window.innerHeight - h) / 2) + 'px';
      dialog.style.transform = 'none';
    }
    dialog.style.width = w + 'px';
    dialog.style.height = h + 'px';

    initClanoviEllipsisModalDrag(header, dialog, type);
    initClanoviEllipsisModalResize(resizeBar, dialog, type);
    initClanoviEllipsisModalMinDimensions(dialog, type);

    document.body.appendChild(modal);

    if (type === 'telefon') {
      clanoviEllipsisTelefonTablicaApi = CommonCRUD.initTablica('clanovi_ellipsis_modal_telefon_tablica', ClanoviEllipsisTelefonCRUD, {
        getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
        onReady: function (api) { clanoviEllipsisTelefonTablicaApi = api; },
        onSelectionChange: function () {
          populateClanoviEllipsisTelefonEditFromSelection();
          updateClanoviEllipsisTelefonCrudState(modal);
        }
      });
      var editBrojWrap = modal.querySelector('.kontrola-edit-delete');
      if (editBrojWrap) {
        editBrojWrap.addEventListener('kontrole-edit-delete-clear', function () {
          ocistiClanoviEllipsisTelefonEdit();
          updateClanoviEllipsisTelefonCrudState(modal);
        });
      }
      var inputBroj = document.getElementById('clanovi_ellipsis_modal_telefon_edit_broj');
      var selectTip = document.getElementById('clanovi_ellipsis_modal_telefon_select_tip');
      if (inputBroj) {
        inputBroj.addEventListener('input', function () { updateClanoviEllipsisTelefonCrudState(modal); });
        inputBroj.addEventListener('change', function () { updateClanoviEllipsisTelefonCrudState(modal); });
      }
      if (selectTip) selectTip.addEventListener('change', function () { updateClanoviEllipsisTelefonCrudState(modal); });
      var footerBtnUpisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-upisi');
      var footerBtnIzbrisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-izbrisi');
      if (footerBtnUpisi) {
        footerBtnUpisi.addEventListener('click', function () {
          var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
          var idClan = getSelectedRowId();
          var selectTip = document.getElementById('clanovi_ellipsis_modal_telefon_select_tip');
          var inputBroj = document.getElementById('clanovi_ellipsis_modal_telefon_edit_broj');
          var idTip = selectTip ? trim(selectTip.value) : '';
          var telefonVal = inputBroj ? trim(inputBroj.value) : '';
          if (!idClan || idTip === '' || idTip === '0' || telefonVal === '') return;
          if (telefonVal !== '' && telefonVal.charAt(0) !== '+') {
            if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['018'] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('018', [], function () { if (inputBroj && inputBroj.focus) inputBroj.focus(); });
            }
            return;
          }
          if (typeof window.CommonPostFormData !== 'function') return;
          var params = { id_clanovi: String(idClan), id_telefoni_tip: idTip, telefon: telefonVal };
          var url;
          var jeIzmjenaOperacija = jeIzmjena;
          if (jeIzmjena) {
            var telefonId = clanoviEllipsisTelefonTablicaApi && clanoviEllipsisTelefonTablicaApi.getSelectedRowIds && clanoviEllipsisTelefonTablicaApi.getSelectedRowIds()[0];
            if (!telefonId) return;
            params.id = String(telefonId);
            url = getApiUrl('Telefoni_CRUD_izmjena.php');
          } else {
            var tipObj = clanoviEllipsisTelefonTipoviData && clanoviEllipsisTelefonTipoviData.find(function (t) { return t.id != null && String(t.id) === String(idTip); });
            var jeTip1 = tipObj && (tipObj.Tip === 1 || tipObj.tip === 1);
            var postojecaTip1Id = null;
            if (jeTip1 && clanoviEllipsisTelefonTablicaApi && typeof clanoviEllipsisTelefonTablicaApi.getData === 'function') {
              var data = clanoviEllipsisTelefonTablicaApi.getData();
              for (var di = 0; di < (data || []).length; di++) {
                var r = data[di];
                var rt = clanoviEllipsisTelefonTipoviData && clanoviEllipsisTelefonTipoviData.find(function (t) { return t.id != null && String(t.id) === String(r.id_telefoni_tip); });
                if (rt && (rt.Tip === 1 || rt.tip === 1)) {
                  postojecaTip1Id = r.id;
                  break;
                }
              }
            }
            if (postojecaTip1Id != null) {
              params.id = String(postojecaTip1Id);
              url = getApiUrl('Telefoni_CRUD_izmjena.php');
              jeIzmjenaOperacija = true;
            } else {
              url = getApiUrl('Telefoni_CRUD_upis.php');
            }
          }
          window.CommonPostFormData(url, params, function (res) {
            res = (res || '').trim();
            if (res === 'OK') {
              var onSuccess = function () {
                ocistiClanoviEllipsisTelefonEdit();
                osvjeziClanoviEllipsisTelefonTablica(modal, function () { updateClanoviEllipsisTelefonCrudState(modal); });
              };
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(jeIzmjenaOperacija ? '004' : '001', [], onSuccess);
              } else {
                onSuccess();
              }
            } else {
              var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
              if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(p.code, p.replacements || []);
              } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('101', []);
              }
            }
          });
        });
      }
      if (footerBtnIzbrisi) {
        footerBtnIzbrisi.addEventListener('click', function () {
          if (!clanoviEllipsisTelefonTablicaApi || !clanoviEllipsisTelefonTablicaApi.getSelectedRowIds) return;
          var ids = clanoviEllipsisTelefonTablicaApi.getSelectedRowIds();
          if (!ids || ids.length === 0) return;
          if (typeof window.CommonPostFormData !== 'function') return;
          var idx = 0;
          function deleteNext() {
            if (idx >= ids.length) {
              var onDelSuccess = function () {
                ocistiClanoviEllipsisTelefonEdit();
                osvjeziClanoviEllipsisTelefonTablica(modal, function () { updateClanoviEllipsisTelefonCrudState(modal); });
              };
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('003', [], onDelSuccess);
              } else {
                onDelSuccess();
              }
              return;
            }
            window.CommonPostFormData(getApiUrl('Telefoni_CRUD_brisanje.php'), { id: String(ids[idx]) }, function (res) {
              res = (res || '').trim();
              if (res === 'OK') {
                idx++;
                deleteNext();
              } else {
                var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
                if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
                  window.showPorukaModal(p.code, p.replacements || []);
                } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
                  window.showPorukaModal('101', []);
                }
              }
            });
          }
          deleteNext();
        });
      }
    }

    if (type === 'email') {
      clanoviEllipsisEmailTablicaApi = CommonCRUD.initTablica('clanovi_ellipsis_modal_email_tablica', ClanoviEllipsisEmailCRUD, {
        getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
        onReady: function (api) { clanoviEllipsisEmailTablicaApi = api; },
        onSelectionChange: function () {
          populateClanoviEllipsisEmailEditFromSelection();
          updateClanoviEllipsisEmailCrudState(modal);
        }
      });
      var editEmailWrap = modal.querySelector('.kontrola-edit-delete');
      if (editEmailWrap) {
        editEmailWrap.addEventListener('kontrole-edit-delete-clear', function () {
          ocistiClanoviEllipsisEmailEdit();
          updateClanoviEllipsisEmailCrudState(modal);
        });
      }
      var inputEmail = document.getElementById('clanovi_ellipsis_modal_email_edit_adresa');
      var selectTip = document.getElementById('clanovi_ellipsis_modal_email_select_tip');
      if (inputEmail) {
        inputEmail.addEventListener('input', function () { updateClanoviEllipsisEmailCrudState(modal); });
        inputEmail.addEventListener('change', function () { updateClanoviEllipsisEmailCrudState(modal); });
      }
      if (selectTip) selectTip.addEventListener('change', function () { updateClanoviEllipsisEmailCrudState(modal); });
      var footerBtnUpisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-upisi');
      var footerBtnIzbrisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-izbrisi');
      if (footerBtnUpisi) {
        footerBtnUpisi.addEventListener('click', function () {
          var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
          var idClan = getSelectedRowId();
          var selectTip = document.getElementById('clanovi_ellipsis_modal_email_select_tip');
          var inputEmail = document.getElementById('clanovi_ellipsis_modal_email_edit_adresa');
          var idTip = selectTip ? trim(selectTip.value) : '';
          var emailVal = inputEmail ? trim(inputEmail.value) : '';
          if (!idClan || idTip === '' || idTip === '0' || emailVal === '') return;
          if (emailVal !== '' && !isValidEmailClan(emailVal)) {
            if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['019'] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('019', [], function () { if (inputEmail && inputEmail.focus) inputEmail.focus(); });
            }
            return;
          }
          if (typeof window.CommonPostFormData !== 'function') return;
          var params = { id_clanovi: String(idClan), id_email_tip: idTip, email: emailVal };
          var url;
          var jeIzmjenaOperacija = jeIzmjena;
          if (jeIzmjena) {
            var emailId = clanoviEllipsisEmailTablicaApi && clanoviEllipsisEmailTablicaApi.getSelectedRowIds && clanoviEllipsisEmailTablicaApi.getSelectedRowIds()[0];
            if (!emailId) return;
            params.id = String(emailId);
            url = getApiUrl('E_maili_CRUD_izmjena.php');
          } else {
            url = getApiUrl('E_maili_CRUD_upis.php');
          }
          window.CommonPostFormData(url, params, function (res) {
            res = (res || '').trim();
            if (res === 'OK') {
              var onSuccess = function () {
                ocistiClanoviEllipsisEmailEdit();
                osvjeziClanoviEllipsisEmailTablica(modal, function () { updateClanoviEllipsisEmailCrudState(modal); });
              };
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(jeIzmjenaOperacija ? '004' : '001', [], onSuccess);
              } else {
                onSuccess();
              }
            } else {
              var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
              if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(p.code, p.replacements || []);
              } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('101', []);
              }
            }
          });
        });
      }
      if (footerBtnIzbrisi) {
        footerBtnIzbrisi.addEventListener('click', function () {
          if (!clanoviEllipsisEmailTablicaApi || !clanoviEllipsisEmailTablicaApi.getSelectedRowIds) return;
          var ids = clanoviEllipsisEmailTablicaApi.getSelectedRowIds();
          if (!ids || ids.length === 0) return;
          if (typeof window.CommonPostFormData !== 'function') return;
          var idx = 0;
          function deleteNext() {
            if (idx >= ids.length) {
              var onDelSuccess = function () {
                ocistiClanoviEllipsisEmailEdit();
                osvjeziClanoviEllipsisEmailTablica(modal, function () { updateClanoviEllipsisEmailCrudState(modal); });
              };
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('003', [], onDelSuccess);
              } else {
                onDelSuccess();
              }
              return;
            }
            window.CommonPostFormData(getApiUrl('E_maili_CRUD_brisanje.php'), { id: String(ids[idx]) }, function (res) {
              res = (res || '').trim();
              if (res === 'OK') {
                idx++;
                deleteNext();
              } else {
                var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
                if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
                  window.showPorukaModal(p.code, p.replacements || []);
                } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
                  window.showPorukaModal('101', []);
                }
              }
            });
          }
          deleteNext();
        });
      }
    }

    if (type === 'adresa') {
      clanoviEllipsisAdresaTablicaApi = CommonCRUD.initTablica('clanovi_ellipsis_modal_adresa_tablica', ClanoviEllipsisAdresaCRUD, {
        getRowId: function (row) { return (row && row.id != null) ? row.id : null; },
        onReady: function (api) { clanoviEllipsisAdresaTablicaApi = api; },
        onSelectionChange: function () {
          populateClanoviEllipsisAdresaEditFromSelection();
          updateClanoviEllipsisAdresaCrudState(modal);
        }
      });
      var editAdresa1Wrap = modal.querySelector('.kontrola-edit-delete');
      if (editAdresa1Wrap) {
        editAdresa1Wrap.addEventListener('kontrole-edit-delete-clear', function () {
          ocistiClanoviEllipsisAdresaEdit();
          updateClanoviEllipsisAdresaCrudState(modal);
        });
      }
      var inputAdresa1 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_1');
      var inputAdresa2 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_2');
      var inputGrad = document.getElementById('clanovi_ellipsis_modal_adresa_edit_grad');
      var inputPosta = document.getElementById('clanovi_ellipsis_modal_adresa_edit_posta');
      var selectTip = document.getElementById('clanovi_ellipsis_modal_adresa_select_tip');
      function adresaInputHandler() { updateClanoviEllipsisAdresaCrudState(modal); }
      if (inputAdresa1) { inputAdresa1.addEventListener('input', adresaInputHandler); inputAdresa1.addEventListener('change', adresaInputHandler); }
      if (inputAdresa2) { inputAdresa2.addEventListener('input', adresaInputHandler); inputAdresa2.addEventListener('change', adresaInputHandler); }
      if (inputGrad) { inputGrad.addEventListener('input', adresaInputHandler); inputGrad.addEventListener('change', adresaInputHandler); }
      if (inputPosta) { inputPosta.addEventListener('input', adresaInputHandler); inputPosta.addEventListener('change', adresaInputHandler); }
      if (selectTip) selectTip.addEventListener('change', adresaInputHandler);
      var footerBtnUpisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-upisi');
      var footerBtnIzbrisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-izbrisi');
      if (footerBtnUpisi) {
        footerBtnUpisi.addEventListener('click', function () {
          var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
          var idClan = getSelectedRowId();
          var selectTip = document.getElementById('clanovi_ellipsis_modal_adresa_select_tip');
          var inputAdresa1 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_1');
          var inputAdresa2 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_2');
          var inputGrad = document.getElementById('clanovi_ellipsis_modal_adresa_edit_grad');
          var inputPosta = document.getElementById('clanovi_ellipsis_modal_adresa_edit_posta');
          var selectDrzava = document.getElementById('clanovi_ellipsis_modal_adresa_select_drzava');
          var idTip = selectTip ? trim(selectTip.value) : '';
          var adresa1 = inputAdresa1 ? trim(inputAdresa1.value) : '';
          var adresa2 = inputAdresa2 ? trim(inputAdresa2.value) : '';
          var grad = inputGrad ? trim(inputGrad.value) : '';
          var posta = inputPosta ? trim(inputPosta.value) : '';
          var idDrzava = selectDrzava ? trim(selectDrzava.value) : '';
          if (!idClan || idTip === '' || idTip === '0') return;
          var imaSadrzaj = adresa1 !== '' || adresa2 !== '' || grad !== '' || posta !== '';
          if (!imaSadrzaj) return;
          if (typeof window.CommonPostFormData !== 'function') return;
          var params = { id_clanovi: String(idClan), id_adrese_tip: idTip, adresa_1: adresa1, adresa_2: adresa2, grad: grad, posta: posta };
          if (idDrzava !== '' && idDrzava !== '0') params.id_drzave_adrese = idDrzava;
          var url;
          var jeIzmjenaOperacija = jeIzmjena;
          if (jeIzmjena) {
            var adresaId = clanoviEllipsisAdresaTablicaApi && clanoviEllipsisAdresaTablicaApi.getSelectedRowIds && clanoviEllipsisAdresaTablicaApi.getSelectedRowIds()[0];
            if (!adresaId) return;
            params.id = String(adresaId);
            url = getApiUrl('Adrese_CRUD_izmjena.php');
          } else {
            var tipObj = clanoviEllipsisAdresaTipoviData && clanoviEllipsisAdresaTipoviData.find(function (t) { return t.id != null && String(t.id) === String(idTip); });
            var jeTip1 = tipObj && (tipObj.Tip === 1 || tipObj.tip === 1);
            var postojecaTip1Id = null;
            if (jeTip1 && clanoviEllipsisAdresaTablicaApi && typeof clanoviEllipsisAdresaTablicaApi.getData === 'function') {
              var data = clanoviEllipsisAdresaTablicaApi.getData();
              for (var di = 0; di < (data || []).length; di++) {
                var r = data[di];
                var rt = clanoviEllipsisAdresaTipoviData && clanoviEllipsisAdresaTipoviData.find(function (t) { return t.id != null && String(t.id) === String(r.id_adrese_tip); });
                if (rt && (rt.Tip === 1 || rt.tip === 1)) {
                  postojecaTip1Id = r.id;
                  break;
                }
              }
            }
            if (postojecaTip1Id != null) {
              params.id = String(postojecaTip1Id);
              url = getApiUrl('Adrese_CRUD_izmjena.php');
              jeIzmjenaOperacija = true;
            } else {
              url = getApiUrl('Adrese_CRUD_upis.php');
            }
          }
          window.CommonPostFormData(url, params, function (res) {
            res = (res || '').trim();
            if (res === 'OK') {
              var onSuccess = function () {
                ocistiClanoviEllipsisAdresaEdit();
                osvjeziClanoviEllipsisAdresaTablica(modal, function () { updateClanoviEllipsisAdresaCrudState(modal); });
              };
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(jeIzmjenaOperacija ? '004' : '001', [], onSuccess);
              } else {
                onSuccess();
              }
            } else {
              var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
              if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(p.code, p.replacements || []);
              } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('101', []);
              }
            }
          });
        });
      }
      if (footerBtnIzbrisi) {
        footerBtnIzbrisi.addEventListener('click', function () {
          if (!clanoviEllipsisAdresaTablicaApi || !clanoviEllipsisAdresaTablicaApi.getSelectedRowIds) return;
          var ids = clanoviEllipsisAdresaTablicaApi.getSelectedRowIds();
          if (!ids || ids.length === 0) return;
          if (typeof window.CommonPostFormData !== 'function') return;
          var idx = 0;
          function deleteNext() {
            if (idx >= ids.length) {
              var onDelSuccess = function () {
                ocistiClanoviEllipsisAdresaEdit();
                osvjeziClanoviEllipsisAdresaTablica(modal, function () { updateClanoviEllipsisAdresaCrudState(modal); });
              };
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('003', [], onDelSuccess);
              } else {
                onDelSuccess();
              }
              return;
            }
            window.CommonPostFormData(getApiUrl('Adrese_CRUD_brisanje.php'), { id: String(ids[idx]) }, function (res) {
              res = (res || '').trim();
              if (res === 'OK') {
                idx++;
                deleteNext();
              } else {
                var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
                if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
                  window.showPorukaModal(p.code, p.replacements || []);
                } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
                  window.showPorukaModal('101', []);
                }
              }
            });
          }
          deleteNext();
        });
      }
    }

    return modal;
  }

  function populateClanoviEllipsisTelefonEditFromSelection() {
    var selectTip = document.getElementById('clanovi_ellipsis_modal_telefon_select_tip');
    var inputBroj = document.getElementById('clanovi_ellipsis_modal_telefon_edit_broj');
    var id = clanoviEllipsisTelefonTablicaApi && clanoviEllipsisTelefonTablicaApi.getSelectedRowIds && clanoviEllipsisTelefonTablicaApi.getSelectedRowIds().length > 0
      ? clanoviEllipsisTelefonTablicaApi.getSelectedRowIds()[0] : null;
    if (!id || !clanoviEllipsisTelefonTablicaApi || typeof clanoviEllipsisTelefonTablicaApi.getData !== 'function') {
      if (selectTip) selectTip.value = '';
      if (inputBroj) inputBroj.value = '';
      if (typeof KontroleRefreshCustomSelect === 'function' && selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_telefon_select_tip');
      return;
    }
    var data = clanoviEllipsisTelefonTablicaApi.getData();
    var row = data ? data.find(function (r) { return String(r.id) === String(id); }) : null;
    if (row) {
      if (selectTip) selectTip.value = row.id_telefoni_tip != null ? String(row.id_telefoni_tip) : '';
      if (inputBroj) {
        inputBroj.value = (row._telefon != null ? String(row._telefon) : (row.telefon != null ? String(row.telefon) : ''));
        inputBroj.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (typeof KontroleRefreshCustomSelect === 'function' && selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_telefon_select_tip');
    }
  }

  function ocistiClanoviEllipsisTelefonEdit() {
    var selectTip = document.getElementById('clanovi_ellipsis_modal_telefon_select_tip');
    var inputBroj = document.getElementById('clanovi_ellipsis_modal_telefon_edit_broj');
    if (selectTip) selectTip.value = '';
    if (inputBroj) inputBroj.value = '';
    if (typeof KontroleRefreshCustomSelect === 'function' && selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_telefon_select_tip');
    if (clanoviEllipsisTelefonTablicaApi && typeof clanoviEllipsisTelefonTablicaApi.clearSelection === 'function') clanoviEllipsisTelefonTablicaApi.clearSelection();
  }

  function transformClanoviEllipsisTelefonData(rawData) {
    return (rawData || []).map(function (row) {
      var tipObj = clanoviEllipsisTelefonTipoviData.find(function (t) { return t.id != null && String(t.id) === String(row.id_telefoni_tip); });
      var naziv = tipObj && tipObj.naziv != null ? String(tipObj.naziv) : '';
      var telefonDisplay = (naziv ? naziv + ', ' : '') + (row.telefon != null ? String(row.telefon) : '');
      var tip = row.tip;
      var telefon = telefonDisplay;
      var arr = [tip, telefon];
      arr.id = row.id;
      arr.id_telefoni_tip = row.id_telefoni_tip;
      arr._telefon = row.telefon != null ? String(row.telefon) : '';
      return arr;
    });
  }

  function osvjeziClanoviEllipsisTelefonTablica(modal, callback) {
    var idClan = getSelectedRowId();
    if (idClan == null || idClan === '') {
      if (clanoviEllipsisTelefonTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisTelefonTablicaApi, 'clanovi_ellipsis_modal_telefon_tablica', [], ClanoviEllipsisTelefonCRUD.Tablica_Zaglavlje);
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Telefoni_CRUD_sve.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var data = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { data = JSON.parse(text); } catch (e) {}
      }
      data = transformClanoviEllipsisTelefonData(data);
      if (clanoviEllipsisTelefonTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisTelefonTablicaApi, 'clanovi_ellipsis_modal_telefon_tablica', data, ClanoviEllipsisTelefonCRUD.Tablica_Zaglavlje);
      if (callback) callback();
      if (modal) updateClanoviEllipsisTelefonCrudState(modal);
    };
    xhr.send();
  }

  function updateClanoviEllipsisTelefonCrudState(modal) {
    if (!modal) return;
    var btnUpisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-upisi');
    var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
    var btnIzbrisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-izbrisi');
    var imaSelekciju = clanoviEllipsisTelefonTablicaApi && clanoviEllipsisTelefonTablicaApi.getSelectedRowIds && clanoviEllipsisTelefonTablicaApi.getSelectedRowIds().length > 0;
    var selectTip = document.getElementById('clanovi_ellipsis_modal_telefon_select_tip');
    var inputBroj = document.getElementById('clanovi_ellipsis_modal_telefon_edit_broj');
    var imaTip = selectTip && trim(selectTip.value) !== '';
    var imaBroj = inputBroj && trim(inputBroj.value) !== '';
    var imaSadrzaj = imaTip && imaBroj;
    var selectTipEnabled = imaSelekciju || imaBroj;
    if (typeof KontroleSetControlEnabled === 'function' && selectTip) KontroleSetControlEnabled(selectTip, selectTipEnabled);
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upiši';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upiši');
      btnUpisi.disabled = !(imaSelekciju || imaSadrzaj);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    // Primjena CRUD prava na modalne tipke (hidden + display kao na glavnoj formi)
    var sakrijUpis = (_pravaCrudUpis !== 1);
    var sakrijBrisanje = (_pravaCrudBrisanje !== 1);
    if (btnUpisi)   { btnUpisi.hidden = sakrijUpis;     btnUpisi.style.display = sakrijUpis ? 'none' : ''; }
    if (btnIzbrisi) { btnIzbrisi.hidden = sakrijBrisanje; btnIzbrisi.style.display = sakrijBrisanje ? 'none' : ''; }
  }

  function ucitajClanoviEllipsisTelefonTipovi(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Telefoni_Tip_CRUD_sve.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try {
          clanoviEllipsisTelefonTipoviData = JSON.parse(text);
        } catch (e) { clanoviEllipsisTelefonTipoviData = []; }
      } else {
        clanoviEllipsisTelefonTipoviData = [];
      }
      if (callback) callback();
    };
    xhr.send();
  }

  function populateClanoviEllipsisTelefonSelect() {
    var select = document.getElementById('clanovi_ellipsis_modal_telefon_select_tip');
    if (!select) return;
    while (select.options.length > 1) select.removeChild(select.options[1]);
    for (var i = 0; i < clanoviEllipsisTelefonTipoviData.length; i++) {
      var r = clanoviEllipsisTelefonTipoviData[i];
      var o = document.createElement('option');
      o.value = r.id != null ? String(r.id) : '';
      o.textContent = r.naziv != null ? r.naziv : '';
      select.appendChild(o);
    }
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('clanovi_ellipsis_modal_telefon_select_tip');
  }

  function populateClanoviEllipsisEmailEditFromSelection() {
    var selectTip = document.getElementById('clanovi_ellipsis_modal_email_select_tip');
    var inputEmail = document.getElementById('clanovi_ellipsis_modal_email_edit_adresa');
    var id = clanoviEllipsisEmailTablicaApi && clanoviEllipsisEmailTablicaApi.getSelectedRowIds && clanoviEllipsisEmailTablicaApi.getSelectedRowIds().length > 0
      ? clanoviEllipsisEmailTablicaApi.getSelectedRowIds()[0] : null;
    if (!id || !clanoviEllipsisEmailTablicaApi || typeof clanoviEllipsisEmailTablicaApi.getData !== 'function') {
      if (selectTip) selectTip.value = '';
      if (inputEmail) inputEmail.value = '';
      if (typeof KontroleRefreshCustomSelect === 'function' && selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_email_select_tip');
      return;
    }
    var data = clanoviEllipsisEmailTablicaApi.getData();
    var row = data ? data.find(function (r) { return String(r.id) === String(id); }) : null;
    if (row) {
      if (selectTip) selectTip.value = row.id_email_tip != null ? String(row.id_email_tip) : '';
      if (inputEmail) {
        inputEmail.value = (row._email != null ? String(row._email) : (row.email != null ? String(row.email) : ''));
        inputEmail.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (typeof KontroleRefreshCustomSelect === 'function' && selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_email_select_tip');
    }
  }

  function ocistiClanoviEllipsisEmailEdit() {
    var selectTip = document.getElementById('clanovi_ellipsis_modal_email_select_tip');
    var inputEmail = document.getElementById('clanovi_ellipsis_modal_email_edit_adresa');
    if (selectTip) selectTip.value = '';
    if (inputEmail) inputEmail.value = '';
    if (typeof KontroleRefreshCustomSelect === 'function' && selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_email_select_tip');
    if (clanoviEllipsisEmailTablicaApi && typeof clanoviEllipsisEmailTablicaApi.clearSelection === 'function') clanoviEllipsisEmailTablicaApi.clearSelection();
  }

  function transformClanoviEllipsisEmailData(rawData) {
    return (rawData || []).map(function (row) {
      var tipObj = clanoviEllipsisEmailTipoviData.find(function (t) { return t.id != null && String(t.id) === String(row.id_email_tip); });
      var naziv = tipObj && tipObj.naziv != null ? String(tipObj.naziv) : '';
      var emailDisplay = (naziv ? naziv + ', ' : '') + (row.email != null ? String(row.email) : '');
      var tip = row.tip;
      var email = emailDisplay;
      var arr = [tip, email];
      arr.id = row.id;
      arr.id_email_tip = row.id_email_tip;
      arr._email = row.email != null ? String(row.email) : '';
      return arr;
    });
  }

  function osvjeziClanoviEllipsisEmailTablica(modal, callback) {
    var idClan = getSelectedRowId();
    if (idClan == null || idClan === '') {
      if (clanoviEllipsisEmailTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisEmailTablicaApi, 'clanovi_ellipsis_modal_email_tablica', [], ClanoviEllipsisEmailCRUD.Tablica_Zaglavlje);
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('E_maili_CRUD_sve.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var data = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { data = JSON.parse(text); } catch (e) {}
      }
      data = transformClanoviEllipsisEmailData(data);
      if (clanoviEllipsisEmailTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisEmailTablicaApi, 'clanovi_ellipsis_modal_email_tablica', data, ClanoviEllipsisEmailCRUD.Tablica_Zaglavlje);
      if (callback) callback();
      if (modal) updateClanoviEllipsisEmailCrudState(modal);
    };
    xhr.send();
  }

  function updateClanoviEllipsisEmailCrudState(modal) {
    if (!modal) return;
    var btnUpisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-upisi');
    var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
    var btnIzbrisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-izbrisi');
    var imaSelekciju = clanoviEllipsisEmailTablicaApi && clanoviEllipsisEmailTablicaApi.getSelectedRowIds && clanoviEllipsisEmailTablicaApi.getSelectedRowIds().length > 0;
    var selectTip = document.getElementById('clanovi_ellipsis_modal_email_select_tip');
    var inputEmail = document.getElementById('clanovi_ellipsis_modal_email_edit_adresa');
    var imaTip = selectTip && trim(selectTip.value) !== '';
    var imaEmail = inputEmail && trim(inputEmail.value) !== '';
    var imaSadrzaj = imaTip && imaEmail;
    var selectTipEnabled = imaSelekciju || imaEmail;
    if (typeof KontroleSetControlEnabled === 'function' && selectTip) KontroleSetControlEnabled(selectTip, selectTipEnabled);
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upiši';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upiši');
      btnUpisi.disabled = !(imaSelekciju || imaSadrzaj);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    // Primjena CRUD prava na modalne tipke (hidden + display kao na glavnoj formi)
    var sakrijUpis = (_pravaCrudUpis !== 1);
    var sakrijBrisanje = (_pravaCrudBrisanje !== 1);
    if (btnUpisi)   { btnUpisi.hidden = sakrijUpis;     btnUpisi.style.display = sakrijUpis ? 'none' : ''; }
    if (btnIzbrisi) { btnIzbrisi.hidden = sakrijBrisanje; btnIzbrisi.style.display = sakrijBrisanje ? 'none' : ''; }
  }

  function ucitajClanoviEllipsisEmailTipovi(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Email_Tip_CRUD_sve.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try {
          clanoviEllipsisEmailTipoviData = JSON.parse(text);
        } catch (e) { clanoviEllipsisEmailTipoviData = []; }
      } else {
        clanoviEllipsisEmailTipoviData = [];
      }
      if (callback) callback();
    };
    xhr.send();
  }

  function populateClanoviEllipsisEmailSelect() {
    var select = document.getElementById('clanovi_ellipsis_modal_email_select_tip');
    if (!select) return;
    while (select.options.length > 1) select.removeChild(select.options[1]);
    for (var i = 0; i < clanoviEllipsisEmailTipoviData.length; i++) {
      var r = clanoviEllipsisEmailTipoviData[i];
      var o = document.createElement('option');
      o.value = r.id != null ? String(r.id) : '';
      o.textContent = r.naziv != null ? r.naziv : '';
      select.appendChild(o);
    }
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('clanovi_ellipsis_modal_email_select_tip');
  }

  function transformClanoviEllipsisAdresaData(rawData) {
    return (rawData || []).map(function (row) {
      var tipObj = clanoviEllipsisAdresaTipoviData.find(function (t) { return t.id != null && String(t.id) === String(row.id_adrese_tip); });
      var naziv = tipObj && tipObj.naziv != null ? String(tipObj.naziv) : '';
      var parts = [];
      if (row.adresa_1) parts.push(row.adresa_1);
      if (row.adresa_2) parts.push(row.adresa_2);
      if (row.grad) parts.push(row.grad);
      if (row.posta) parts.push(row.posta);
      var adresaDisplay = (naziv ? naziv + ', ' : '') + parts.join(', ');
      var tip = row.tip;
      var arr = [tip, adresaDisplay];
      arr.id = row.id;
      arr.id_adrese_tip = row.id_adrese_tip;
      arr._adresa_1 = row.adresa_1 != null ? String(row.adresa_1) : '';
      arr._adresa_2 = row.adresa_2 != null ? String(row.adresa_2) : '';
      arr._grad = row.grad != null ? String(row.grad) : '';
      arr._posta = row.posta != null ? String(row.posta) : '';
      arr._id_drzave_adrese = row.id_drzave_adrese != null ? row.id_drzave_adrese : null;
      return arr;
    });
  }

  function osvjeziClanoviEllipsisAdresaTablica(modal, callback) {
    var idClan = getSelectedRowId();
    if (idClan == null || idClan === '') {
      if (clanoviEllipsisAdresaTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisAdresaTablicaApi, 'clanovi_ellipsis_modal_adresa_tablica', [], ClanoviEllipsisAdresaCRUD.Tablica_Zaglavlje);
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Adrese_CRUD_sve.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var data = [];
      if (text !== '' && text.charAt(0) === '[') {
        try { data = JSON.parse(text); } catch (e) {}
      }
      data = transformClanoviEllipsisAdresaData(data);
      if (clanoviEllipsisAdresaTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisAdresaTablicaApi, 'clanovi_ellipsis_modal_adresa_tablica', data, ClanoviEllipsisAdresaCRUD.Tablica_Zaglavlje);
      if (callback) callback();
      if (modal) updateClanoviEllipsisAdresaCrudState(modal);
    };
    xhr.send();
  }

  function updateClanoviEllipsisAdresaCrudState(modal) {
    if (!modal) return;
    var btnUpisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-upisi');
    var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
    var btnIzbrisi = modal.querySelector('.clanovi-ellipsis-modal__footer-left .kontrola-btn--crud-izbrisi');
    var imaSelekciju = clanoviEllipsisAdresaTablicaApi && clanoviEllipsisAdresaTablicaApi.getSelectedRowIds && clanoviEllipsisAdresaTablicaApi.getSelectedRowIds().length > 0;
    var selectTip = document.getElementById('clanovi_ellipsis_modal_adresa_select_tip');
    var inputAdresa1 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_1');
    var inputAdresa2 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_2');
    var inputGrad = document.getElementById('clanovi_ellipsis_modal_adresa_edit_grad');
    var inputPosta = document.getElementById('clanovi_ellipsis_modal_adresa_edit_posta');
    var selectDrzava = document.getElementById('clanovi_ellipsis_modal_adresa_select_drzava');
    var imaTip = selectTip && trim(selectTip.value) !== '';
    var imaAdresa1 = inputAdresa1 && trim(inputAdresa1.value) !== '';
    var imaAdresa2 = inputAdresa2 && trim(inputAdresa2.value) !== '';
    var imaGrad = inputGrad && trim(inputGrad.value) !== '';
    var imaPosta = inputPosta && trim(inputPosta.value) !== '';
    var imaSadrzaj = imaTip && (imaAdresa1 || imaAdresa2 || imaGrad || imaPosta);
    var selectTipEnabled = imaSelekciju || imaAdresa1 || imaAdresa2 || imaGrad || imaPosta;
    if (typeof KontroleSetControlEnabled === 'function' && selectTip) KontroleSetControlEnabled(selectTip, selectTipEnabled);
    if (typeof KontroleSetControlEnabled === 'function') {
      if (inputAdresa1) KontroleSetControlEnabled(inputAdresa1, true);
      if (inputAdresa2) KontroleSetControlEnabled(inputAdresa2, imaTip);
      if (inputGrad) KontroleSetControlEnabled(inputGrad, imaTip);
      if (inputPosta) KontroleSetControlEnabled(inputPosta, imaTip);
      if (selectDrzava) KontroleSetControlEnabled(selectDrzava, imaTip);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && selectDrzava) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_drzava');
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upiši';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upiši');
      btnUpisi.disabled = !(imaSelekciju || imaSadrzaj);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    // Primjena CRUD prava na modalne tipke (hidden + display kao na glavnoj formi)
    var sakrijUpis = (_pravaCrudUpis !== 1);
    var sakrijBrisanje = (_pravaCrudBrisanje !== 1);
    if (btnUpisi)   { btnUpisi.hidden = sakrijUpis;     btnUpisi.style.display = sakrijUpis ? 'none' : ''; }
    if (btnIzbrisi) { btnIzbrisi.hidden = sakrijBrisanje; btnIzbrisi.style.display = sakrijBrisanje ? 'none' : ''; }
  }

  function ucitajClanoviEllipsisAdresaTipovi(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Adrese_Tip_CRUD_sve.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try {
          clanoviEllipsisAdresaTipoviData = JSON.parse(text);
        } catch (e) { clanoviEllipsisAdresaTipoviData = []; }
      } else {
        clanoviEllipsisAdresaTipoviData = [];
      }
      if (callback) callback();
    };
    xhr.send();
  }

  function ucitajClanoviEllipsisAdresaDrzave(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Drzave_Adrese_CRUD_sve.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try {
          clanoviEllipsisAdresaDrzaveData = JSON.parse(text);
        } catch (e) { clanoviEllipsisAdresaDrzaveData = []; }
      } else {
        clanoviEllipsisAdresaDrzaveData = [];
      }
      if (callback) callback();
    };
    xhr.send();
  }

  function populateClanoviEllipsisAdresaSelect() {
    var select = document.getElementById('clanovi_ellipsis_modal_adresa_select_tip');
    if (!select) return;
    while (select.options.length > 1) select.removeChild(select.options[1]);
    for (var i = 0; i < clanoviEllipsisAdresaTipoviData.length; i++) {
      var r = clanoviEllipsisAdresaTipoviData[i];
      var o = document.createElement('option');
      o.value = r.id != null ? String(r.id) : '';
      o.textContent = r.naziv != null ? r.naziv : '';
      select.appendChild(o);
    }
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_tip');
  }

  function populateClanoviEllipsisAdresaSelectDrzava() {
    var select = document.getElementById('clanovi_ellipsis_modal_adresa_select_drzava');
    if (!select) return;
    while (select.options.length > 1) select.removeChild(select.options[1]);
    for (var i = 0; i < clanoviEllipsisAdresaDrzaveData.length; i++) {
      var r = clanoviEllipsisAdresaDrzaveData[i];
      var o = document.createElement('option');
      o.value = r.id != null ? String(r.id) : '';
      o.textContent = r.naziv != null ? r.naziv : '';
      select.appendChild(o);
    }
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_drzava');
  }

  function populateClanoviEllipsisAdresaEditFromSelection() {
    var selectTip = document.getElementById('clanovi_ellipsis_modal_adresa_select_tip');
    var inputAdresa1 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_1');
    var inputAdresa2 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_2');
    var inputGrad = document.getElementById('clanovi_ellipsis_modal_adresa_edit_grad');
    var inputPosta = document.getElementById('clanovi_ellipsis_modal_adresa_edit_posta');
    var selectDrzava = document.getElementById('clanovi_ellipsis_modal_adresa_select_drzava');
    var id = clanoviEllipsisAdresaTablicaApi && clanoviEllipsisAdresaTablicaApi.getSelectedRowIds && clanoviEllipsisAdresaTablicaApi.getSelectedRowIds().length > 0
      ? clanoviEllipsisAdresaTablicaApi.getSelectedRowIds()[0] : null;
    if (!id || !clanoviEllipsisAdresaTablicaApi || typeof clanoviEllipsisAdresaTablicaApi.getData !== 'function') {
      if (selectTip) selectTip.value = '';
      if (inputAdresa1) inputAdresa1.value = '';
      if (inputAdresa2) inputAdresa2.value = '';
      if (inputGrad) inputGrad.value = '';
      if (inputPosta) inputPosta.value = '';
      if (selectDrzava) selectDrzava.value = '';
      if (typeof KontroleRefreshCustomSelect === 'function') {
        if (selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_tip');
        if (selectDrzava) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_drzava');
      }
      return;
    }
    var data = clanoviEllipsisAdresaTablicaApi.getData();
    var row = data ? data.find(function (r) { return String(r.id) === String(id); }) : null;
    if (row) {
      if (selectTip) selectTip.value = row.id_adrese_tip != null ? String(row.id_adrese_tip) : '';
      if (inputAdresa1) inputAdresa1.value = row._adresa_1 != null ? String(row._adresa_1) : '';
      if (inputAdresa2) inputAdresa2.value = row._adresa_2 != null ? String(row._adresa_2) : '';
      if (inputGrad) inputGrad.value = row._grad != null ? String(row._grad) : '';
      if (inputPosta) inputPosta.value = row._posta != null ? String(row._posta) : '';
      if (selectDrzava) selectDrzava.value = row._id_drzave_adrese != null ? String(row._id_drzave_adrese) : '';
      if (typeof KontroleRefreshCustomSelect === 'function') {
        if (selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_tip');
        if (selectDrzava) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_drzava');
      }
    }
  }

  function ocistiClanoviEllipsisAdresaEdit() {
    var selectTip = document.getElementById('clanovi_ellipsis_modal_adresa_select_tip');
    var inputAdresa1 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_1');
    var inputAdresa2 = document.getElementById('clanovi_ellipsis_modal_adresa_edit_2');
    var inputGrad = document.getElementById('clanovi_ellipsis_modal_adresa_edit_grad');
    var inputPosta = document.getElementById('clanovi_ellipsis_modal_adresa_edit_posta');
    var selectDrzava = document.getElementById('clanovi_ellipsis_modal_adresa_select_drzava');
    if (selectTip) selectTip.value = '';
    if (inputAdresa1) inputAdresa1.value = '';
    if (inputAdresa2) inputAdresa2.value = '';
    if (inputGrad) inputGrad.value = '';
    if (inputPosta) inputPosta.value = '';
    if (selectDrzava) selectDrzava.value = '';
    if (typeof KontroleRefreshCustomSelect === 'function') {
      if (selectTip) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_tip');
      if (selectDrzava) KontroleRefreshCustomSelect('clanovi_ellipsis_modal_adresa_select_drzava');
    }
    if (clanoviEllipsisAdresaTablicaApi && typeof clanoviEllipsisAdresaTablicaApi.clearSelection === 'function') clanoviEllipsisAdresaTablicaApi.clearSelection();
  }

  function openClanoviEllipsisModal(type, triggerEl) {
    var modal = ensureClanoviEllipsisModal(type);
    modal._clanoviEllipsisTrigger = triggerEl;
    var dialog = modal.querySelector('.clanovi-ellipsis-modal__dialog');
    var state = getClanoviEllipsisModalState(type);
    if (state && dialog) {
      var h = state.height;
      if (type === 'telefon' || type === 'email') {
        var minH = getClanoviEllipsisTelefonMinH();
        if (h < minH) h = minH;
      }
      if (type === 'adresa') {
        var minH = getClanoviEllipsisAdresaMinH();
        if (h < minH) h = minH;
      }
      dialog.style.left = state.left + 'px';
      dialog.style.top = state.top + 'px';
      dialog.style.transform = 'none';
      dialog.style.width = state.width + 'px';
      dialog.style.height = h + 'px';
    } else if (dialog) {
      var w = CLANOVI_ELLIPSIS_DEFAULT_W;
      var h = (type === 'telefon' || type === 'email') ? getClanoviEllipsisTelefonMinH() : (type === 'adresa' ? getClanoviEllipsisAdresaMinH() : CLANOVI_ELLIPSIS_DEFAULT_H);
      dialog.style.left = Math.max(0, (window.innerWidth - w) / 2) + 'px';
      dialog.style.top = Math.max(0, (window.innerHeight - h) / 2) + 'px';
      dialog.style.transform = 'none';
      dialog.style.width = w + 'px';
      dialog.style.height = h + 'px';
    }
    if (type === 'telefon') {
      var idClan = getSelectedRowId();
      ocistiClanoviEllipsisTelefonEdit();
      ucitajClanoviEllipsisTelefonTipovi(function () {
        populateClanoviEllipsisTelefonSelect();
        if (idClan != null && idClan !== '') {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', getApiUrl('Telefoni_CRUD_sve.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)), true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            var text = (xhr.responseText || '').trim();
            var data = [];
            if (text !== '' && text.charAt(0) === '[') {
              try { data = JSON.parse(text); } catch (e) {}
            }
            data = transformClanoviEllipsisTelefonData(data);
            if (clanoviEllipsisTelefonTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisTelefonTablicaApi, 'clanovi_ellipsis_modal_telefon_tablica', data, ClanoviEllipsisTelefonCRUD.Tablica_Zaglavlje);
            updateClanoviEllipsisTelefonCrudState(modal);
          };
          xhr.send();
        } else {
          if (clanoviEllipsisTelefonTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisTelefonTablicaApi, 'clanovi_ellipsis_modal_telefon_tablica', [], ClanoviEllipsisTelefonCRUD.Tablica_Zaglavlje);
          updateClanoviEllipsisTelefonCrudState(modal);
        }
      });
    }
    if (type === 'email') {
      var idClan = getSelectedRowId();
      ocistiClanoviEllipsisEmailEdit();
      ucitajClanoviEllipsisEmailTipovi(function () {
        populateClanoviEllipsisEmailSelect();
        if (idClan != null && idClan !== '') {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', getApiUrl('E_maili_CRUD_sve.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)), true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            var text = (xhr.responseText || '').trim();
            var data = [];
            if (text !== '' && text.charAt(0) === '[') {
              try { data = JSON.parse(text); } catch (e) {}
            }
            data = transformClanoviEllipsisEmailData(data);
            if (clanoviEllipsisEmailTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisEmailTablicaApi, 'clanovi_ellipsis_modal_email_tablica', data, ClanoviEllipsisEmailCRUD.Tablica_Zaglavlje);
            updateClanoviEllipsisEmailCrudState(modal);
          };
          xhr.send();
        } else {
          if (clanoviEllipsisEmailTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisEmailTablicaApi, 'clanovi_ellipsis_modal_email_tablica', [], ClanoviEllipsisEmailCRUD.Tablica_Zaglavlje);
          updateClanoviEllipsisEmailCrudState(modal);
        }
      });
    }
    if (type === 'adresa') {
      var idClan = getSelectedRowId();
      ocistiClanoviEllipsisAdresaEdit();
      ucitajClanoviEllipsisAdresaTipovi(function () {
        populateClanoviEllipsisAdresaSelect();
        ucitajClanoviEllipsisAdresaDrzave(function () {
          populateClanoviEllipsisAdresaSelectDrzava();
          if (idClan != null && idClan !== '') {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', getApiUrl('Adrese_CRUD_sve.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)), true);
            xhr.onreadystatechange = function () {
              if (xhr.readyState !== 4) return;
              var text = (xhr.responseText || '').trim();
              var data = [];
              if (text !== '' && text.charAt(0) === '[') {
                try { data = JSON.parse(text); } catch (e) {}
              }
              data = transformClanoviEllipsisAdresaData(data);
              if (clanoviEllipsisAdresaTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisAdresaTablicaApi, 'clanovi_ellipsis_modal_adresa_tablica', data, ClanoviEllipsisAdresaCRUD.Tablica_Zaglavlje);
              updateClanoviEllipsisAdresaCrudState(modal);
            };
            xhr.send();
          } else {
            if (clanoviEllipsisAdresaTablicaApi) CommonCRUD.setDataTablica(clanoviEllipsisAdresaTablicaApi, 'clanovi_ellipsis_modal_adresa_tablica', [], ClanoviEllipsisAdresaCRUD.Tablica_Zaglavlje);
            updateClanoviEllipsisAdresaCrudState(modal);
          }
        });
      });
    }
    if (dialog && window.innerWidth > 768) {
      var minH = (type === 'telefon' || type === 'email') ? getClanoviEllipsisTelefonMinH() : (type === 'adresa' ? getClanoviEllipsisAdresaMinH() : 180);
      dialog.style.minWidth = minH + 'px';
      dialog.style.minHeight = minH + 'px';
    }
    modal.classList.add('clanovi-ellipsis-modal--open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeClanoviEllipsisModal(type) {
    var modal = document.getElementById('clanovi_ellipsis_modal_' + type);
    if (modal) {
      var dialog = modal.querySelector('.clanovi-ellipsis-modal__dialog');
      if (dialog) {
        var left = parseFloat(dialog.style.left);
        var top = parseFloat(dialog.style.top);
        var w = dialog.offsetWidth;
        var h = dialog.offsetHeight;
        if (type === 'telefon' || type === 'email') { if (h < getClanoviEllipsisTelefonMinH()) h = getClanoviEllipsisTelefonMinH(); }
        if (type === 'adresa') { if (h < getClanoviEllipsisAdresaMinH()) h = getClanoviEllipsisAdresaMinH(); }
        if (dialog.style.transform && dialog.style.transform.indexOf('translate') >= 0) {
          left = (window.innerWidth - w) / 2;
          top = (window.innerHeight - h) / 2;
        }
        saveClanoviEllipsisModalState(type, left, top, w, h);
      }
      var trigger = modal._clanoviEllipsisTrigger;
      modal.classList.remove('clanovi-ellipsis-modal--open');
      modal.setAttribute('aria-hidden', 'true');
      if (trigger && trigger.focus) trigger.focus();
      if (type === 'telefon') {
        var idClan = getSelectedRowId();
        if (idClan != null && idClan !== '' && typeof fetch === 'function') {
          fetch(getApiUrl('Telefoni_CRUD_tip1.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)))
            .then(function (r) { return r.text(); })
            .then(function (text) {
              var editTelefon = document.getElementById('edit_telefon');
              if (editTelefon) editTelefon.value = (text || '').trim();
            })
            .catch(function () {});
        }
      }
      if (type === 'email') {
        var idClan = getSelectedRowId();
        if (idClan != null && idClan !== '' && typeof fetch === 'function') {
          fetch(getApiUrl('E_maili_CRUD_tip1.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)))
            .then(function (r) { return r.text(); })
            .then(function (text) {
              var editEmail = document.getElementById('edit_email');
              if (editEmail) editEmail.value = (text || '').trim();
            })
            .catch(function () {});
        }
      }
      if (type === 'adresa') {
        var idClan = getSelectedRowId();
        if (idClan != null && idClan !== '' && typeof fetch === 'function') {
          fetch(getApiUrl('Adrese_CRUD_tip1.php') + '?id_clanovi=' + encodeURIComponent(String(idClan)))
            .then(function (r) { return r.json ? r.json() : r.text().then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } }); })
            .then(function (obj) {
              var editAdresa1 = document.getElementById('edit_adresa_1');
              var editAdresa2 = document.getElementById('edit_adresa_2');
              var editGrad = document.getElementById('edit_grad');
              var editPosta = document.getElementById('edit_posta');
              var selectDrzavaAdrese = document.getElementById('select_drzava_adrese');
              if (editAdresa1) editAdresa1.value = (obj && obj.adresa_1 != null) ? String(obj.adresa_1) : '';
              if (editAdresa2) editAdresa2.value = (obj && obj.adresa_2 != null) ? String(obj.adresa_2) : '';
              if (editGrad) editGrad.value = (obj && obj.grad != null) ? String(obj.grad) : '';
              if (editPosta) editPosta.value = (obj && obj.posta != null) ? String(obj.posta) : '';
              if (selectDrzavaAdrese) selectDrzavaAdrese.value = (obj && obj.id_drzava_adrese != null) ? String(obj.id_drzava_adrese) : '';
              if (typeof KontroleRefreshCustomSelect === 'function' && selectDrzavaAdrese) KontroleRefreshCustomSelect('select_drzava_adrese');
            })
            .catch(function () {});
        }
      }
    }
  }

  var btnTelefonEllipsis = document.getElementById('btn_telefon_ellipsis');
  var btnEmailEllipsis = document.getElementById('btn_email_ellipsis');
  var btnAdresaEllipsis = document.getElementById('btn_adresa_ellipsis');
  if (btnTelefonEllipsis) btnTelefonEllipsis.addEventListener('click', function () { if (this.disabled) return; openClanoviEllipsisModal('telefon', this); });
  if (btnEmailEllipsis) btnEmailEllipsis.addEventListener('click', function () { if (this.disabled) return; openClanoviEllipsisModal('email', this); });
  if (btnAdresaEllipsis) btnAdresaEllipsis.addEventListener('click', function () { if (this.disabled) return; openClanoviEllipsisModal('adresa', this); });

  (function () {
    var dateIds = ['edit_datum_rodjenja'];
    for (var d = 0; d < dateIds.length; d++) {
      var el = document.getElementById(dateIds[d]);
      if (el) {
        el.classList.add('edit-datum-empty');
        syncDatumEmptyClass(el);
        el.addEventListener('change', function () { syncDatumEmptyClass(this); });
        el.addEventListener('input', function () { syncDatumEmptyClass(this); });
      }
    }
    var editOib = document.getElementById('edit_oib');
    if (editOib && typeof initSamoNumerika === 'function') initSamoNumerika(editOib, 11);
    var editPosta = document.getElementById('edit_posta');
    if (editPosta && typeof initSamoNumerika === 'function') initSamoNumerika(editPosta, 5);
    var editTelefon = document.getElementById('edit_telefon');
    if (editTelefon && typeof upis_telefona === 'function') upis_telefona(editTelefon);
    var editEmail = document.getElementById('edit_email');
    if (editEmail && typeof upis_maila === 'function') upis_maila(editEmail);
  })();

  if (tablicaContainerEl) {
    /* Bubble faza: ne hvataj klik prije KontroleTablica (capture je uzrokovao nestabilan layout / nestanak zaglavlja). */
    tablicaContainerEl.addEventListener('click', function (e) {
      var td = e.target && e.target.tagName === 'TD' ? e.target : (e.target && e.target.closest ? e.target.closest('td') : null);
      if (!td) return;
      var tr = td.parentNode;
      if (!tr || tr.tagName !== 'TR' || !tr.parentNode || tr.parentNode.tagName !== 'TBODY') return;
      /* Četvrta kolona = Spol (isti indeks kao u Clanovi_CRUD.js). */
      if (td.cellIndex !== 3) return;
      var rowId = tr.dataset && tr.dataset.rowId;
      if (rowId == null) return;
      // Dozvoli promjenu spola samo na trenutno selektiranom retku.
      var currentSelectedId = getSelectedRowId();
      if (currentSelectedId == null) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (String(currentSelectedId) !== String(rowId)) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      var rec = data.find(function (r) { return String(r.id) === String(rowId); });
      if (!rec) return;
      var newSpol = (rec.spol === 1 || rec.spol === '1') ? 0 : 1;
      if (typeof window.CommonPostFormData !== 'function') return;
      var keepId = rowId;
      window.CommonPostFormData(API_BASE + 'Clanovi_CRUD_spol.php', { id: rowId, spol: String(newSpol) }, function (res) {
        if (res === 'OK') {
          // Lokalno ažuriraj spol u podacima (data) i u podacima tablice (da sort ne vrati staru vrijednost).
          var recAfter = data.find(function (r) { return String(r.id) === String(keepId); });
          if (recAfter) {
            recAfter.spol = newSpol;
          }
          var newSpolDisplay = (newSpol === 1 || newSpol === '1') ? 'Ženski' : 'Muški';
          if (tablicaApi && typeof tablicaApi.getData === 'function' && typeof tablicaApi.setData === 'function') {
            var tableRows = tablicaApi.getData();
            for (var ri = 0; ri < tableRows.length; ri++) {
              if (String(tableRows[ri].id) === String(keepId)) {
                tableRows[ri][3] = newSpolDisplay;
                break;
              }
            }
            CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', tableRows, ClanoviLozaCRUD.Tablica_Zaglavlje);
            // Vrati selekciju na isti red nakon re-rendera i fokus na tablicu da strelice rade
            if (typeof tablicaApi.setSelectedRowIds === 'function') {
              tablicaApi.setSelectedRowIds([String(keepId)]);
            }
            var tablicaContainer = document.getElementById('tablicaContainer');
            var scrollEl = tablicaContainer && tablicaContainer.querySelector('.kontrola-tablica__scroll');
            if (scrollEl) scrollEl.focus();
          }
          // Ažuriraj select za spol u edit panelu
          if (selectSpol) {
            selectSpol.value = String(newSpol);
            if (typeof KontroleRefreshCustomSelect === 'function') {
              KontroleRefreshCustomSelect('select_spol');
            }
          }
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements || []);
          }
        }
      });
    });
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var idLoza = selectLoza ? trim(selectLoza.value) : '';
      var editPrezime = document.getElementById('edit_prezime');
      var editIme = document.getElementById('edit_ime');
      var editTelefon = document.getElementById('edit_telefon');
      var editEmail = document.getElementById('edit_email');
      var editAdresa1 = document.getElementById('edit_adresa_1');
      var editAdresa2 = document.getElementById('edit_adresa_2');
      var editGrad = document.getElementById('edit_grad');
      var editPosta = document.getElementById('edit_posta');
      var editNapomena = document.getElementById('edit_napomena');
      var editDatumRodjenja = document.getElementById('edit_datum_rodjenja');

      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      var id = jeIzmjena ? getSelectedRowId() : null;
      if (!idLoza) return;
      var idDrzavaVal = selectDrzava ? trim(selectDrzava.value) : '';
      if (!idDrzavaVal) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['105'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('105', []);
        }
        return;
      }
      if (jeIzmjena && id == null) return;

      function normName(s) {
        s = trim(s || '');
        if (!s) return '';
        return s.split(/\s+/).map(function (part) {
          if (!part) return '';
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join(' ');
      }

      var prezime = editPrezime ? normName(editPrezime.value) : '';
      var ime = editIme ? normName(editIme.value) : '';

      if (prezime === '') {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['115'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('115', [], function () { if (editPrezime && editPrezime.focus) editPrezime.focus(); });
        }
        return;
      }

      var telefonVal = editTelefon ? trim(editTelefon.value) : '';
      var emailVal = editEmail ? trim(editEmail.value) : '';

      if (telefonVal !== '' && telefonVal.indexOf('+') !== 0) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['018'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('018', [], function () { if (editTelefon && editTelefon.focus) editTelefon.focus(); });
        }
        return;
      }
      if (emailVal !== '' && !isValidEmailClan(emailVal)) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['019'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('019', [], function () { if (editEmail && editEmail.focus) editEmail.focus(); });
        }
        return;
      }

      var datumRodjenjaVal = editDatumRodjenja && editDatumRodjenja.value ? trim(editDatumRodjenja.value) : null;

      var idPorijeklo = selectPorijeklo ? trim(selectPorijeklo.value) : '';
      var idNaPrijedlog = selectNaPrijedlog ? trim(selectNaPrijedlog.value) : '';
      var idDrzavaAdreseVal = selectDrzavaAdrese ? trim(selectDrzavaAdrese.value) : '';

      var editOib = document.getElementById('edit_oib');
      var oibVal = editOib ? trim(editOib.value) : '';
      if (oibVal !== '' && !/^\d{1,11}$/.test(oibVal)) oibVal = (oibVal.replace(/\D/g, '')).slice(0, 11);

      /* Šifra, stupanj, aktivnost, kandidat, zastavice – ne šalju se; datum inicijacije/stupnja – ne šalju se (ostaju u bazi kakvi jesu). PHP za Loza postavlja defaulte pri upisu / ne dira pri izmjeni. */
      var payload = {
        id: jeIzmjena ? String(id) : null,
        id_drzava: idDrzavaVal,
        id_loza: idLoza,
        prezime: prezime,
        ime: ime,
        spol: selectSpol ? trim(selectSpol.value) : '0',
        datum_rodjenja: datumRodjenjaVal,
        oib: oibVal !== '' ? oibVal : null,
        porijeklo: idPorijeklo !== '' ? idPorijeklo : null,
        na_prijedlog: idNaPrijedlog !== '' ? idNaPrijedlog : null,
        id_drzava_adrese: idDrzavaAdreseVal !== '' ? idDrzavaAdreseVal : null,
        telefon_text: telefonVal,
        email_text: emailVal,
        adresa_1: editAdresa1 ? trim(editAdresa1.value) : '',
        adresa_2: editAdresa2 ? trim(editAdresa2.value) : '',
        grad: editGrad ? trim(editGrad.value) : '',
        posta: editPosta ? trim(editPosta.value) : '',
        napomena: editNapomena ? trim(editNapomena.value) : ''
      };

      var imgPrev = document.getElementById('clanovi_image_preview');
      var hasSlika = imgPrev && imgPrev._obradaSlikaBlob;
      var roundActive = imgPrev && imgPrev._obradaSlikaRoundActive;
      var roundOffset;
      if (imgPrev && typeof imgPrev._obradaSlikaRoundOffsetPx === 'number' && imgPrev._obradaSlikaRoundOffsetHeight > 0) {
        roundOffset = -2 * imgPrev._obradaSlikaRoundOffsetPx / imgPrev._obradaSlikaRoundOffsetHeight;
        roundOffset = Math.max(-1, Math.min(1, roundOffset));
      } else {
        roundOffset = imgPrev && typeof imgPrev._obradaSlikaRoundOffset === 'number' ? imgPrev._obradaSlikaRoundOffset : 0;
      }
      var url = API_BASE + (jeIzmjena ? 'Clanovi_Loza_CRUD_izmjena.php' : 'Clanovi_Loza_CRUD_upis.php');

      function onSuccess() {
        if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
        clearControlsFromSelection();
        clearSlikaFromControl();
        osvjeziTablicu();
      }

      function sendRequest(fd) {
        fetch(url, { method: 'POST', body: fd })
          .then(function (r) { return r.text(); })
          .then(function (res) {
          res = (res || '').trim();
          if (res === 'OK') {
            onSuccess();
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(jeIzmjena ? '004' : '001', []);
            }
            return;
          }
          var parsed = parseResponseCode(res);
          var code = parsed && parsed.code ? parsed.code : res;
          if (code === '110') {
            // Informativna poruka: predlagač više ne postoji, ali upis je napravljen.
            onSuccess();
            if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['110'] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('110', parsed && parsed.replacements ? parsed.replacements : []);
            }
            return;
          }
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(code, parsed && parsed.replacements ? parsed.replacements : []);
          } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('101', []);
          }
        })
        .catch(function () {
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['100'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('100', []);
          }
        });
      }

      if (hasSlika) {
        createThumbFromBlobClanovi(imgPrev._obradaSlikaBlob, 64).then(function (thumbRect) {
          var thumbRoundPromise = roundActive ? createRoundThumbFromBlob(imgPrev._obradaSlikaBlob, 64, roundOffset) : Promise.resolve({ blob: null, mime: null });
          thumbRoundPromise.then(function (thumbRound) {
            var fd = buildClanoviFormData(payload, jeIzmjena);
            // osnovna slika
            if (imgPrev._obradaSlikaBlob) {
              var slikaMime = imgPrev._obradaSlikaMime && imgPrev._obradaSlikaMime.indexOf('image/') === 0 ? imgPrev._obradaSlikaMime : 'image/webp';
              var slikaFn = slikaMime.indexOf('png') !== -1 ? 'slika.png' : 'slika.webp';
              fd.append('slika', imgPrev._obradaSlikaBlob, slikaFn);
              fd.append('slika_mime', slikaMime);
            }
            // pravokutni thumb
            if (thumbRect && thumbRect.blob) {
              fd.append('thumb', thumbRect.blob, 'thumb.jpg');
              fd.append('thumb_mime', thumbRect.mime || 'image/jpeg');
            }
            // kružni thumb
            if (thumbRound && thumbRound.blob) {
              fd.append('thumb_round', thumbRound.blob, 'thumb_round.webp');
              fd.append('thumb_round_mime', thumbRound.mime || 'image/webp');
            }
            if (hasSlika) {
              fd.append('thumb_round_position', roundActive && typeof imgPrev._obradaSlikaRoundOffsetPx === 'number' ? String(Math.round(imgPrev._obradaSlikaRoundOffsetPx)) : '');
            }
            sendRequest(fd);
          }).catch(function () {
            var fd = buildClanoviFormData(payload, jeIzmjena);
            sendRequest(fd);
          });
        }).catch(function () {
          var fd = buildClanoviFormData(payload, jeIzmjena);
          sendRequest(fd);
        });
      } else {
        var fd = buildClanoviFormData(payload, jeIzmjena);
        sendRequest(fd);
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      if (typeof window.CommonPostFormData !== 'function') return;

      function izvrsiBrisanje() {
        window.CommonPostFormData(API_BASE + 'Clanovi_CRUD_brisanje.php', { id: String(id) }, function (res) {
          res = (res || '').trim();
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('003', [], function () {
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
                clearControlsFromSelection();
                clearSlikaFromControl();
                osvjeziTablicu();
              });
            } else {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              clearSlikaFromControl();
              osvjeziTablicu();
            }
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(p.code, p.replacements || []);
            }
          }
        });
      }

      window.CommonPostFormData(API_BASE + 'Clanovi_CRUD_ima_vezane.php', { id: String(id) }, function (res) {
        res = (res || '').trim();
        if (res === '1') {
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['023'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('023', [], function (buttonKey) {
              if (buttonKey === 'OK') izvrsiBrisanje();
            });
          } else {
            izvrsiBrisanje();
          }
        } else if (res === '0') {
          /* Bez vezanih podataka: opća potvrda (124). S vezanim: 023 iznad – dovoljno jedno upozorenje. */
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['124'] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('124', [], function (buttonKey) {
              if (buttonKey === 'OK') izvrsiBrisanje();
            });
          } else {
            izvrsiBrisanje();
          }
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements || []);
          }
        }
      });
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

  function getOneColBreakPx() {
    return typeof window.getPageBreakpointNarrow === 'function' ? window.getPageBreakpointNarrow() : 640;
  }

  /** Jedan MQL kao Clanovi_CRUD.css (max-width Npx ILI touch + do 1200px). */
  var clanoviStackModeMqlRef = null;
  var clanoviStackModeMqlInited = false;
  function getClanoviStackModeMql() {
    if (clanoviStackModeMqlInited) return clanoviStackModeMqlRef;
    clanoviStackModeMqlInited = true;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    try {
      var bp = getOneColBreakPx();
      clanoviStackModeMqlRef = window.matchMedia(
        '(max-width: ' + bp + 'px), ((hover: none) and (pointer: coarse) and (max-width: 1200px))'
      );
    } catch (e) {
      clanoviStackModeMqlRef = null;
    }
    return clanoviStackModeMqlRef;
  }

  /**
   * Široki raspored (slika | tablica): mora točno pratiti CSS @media u Clanovi_CRUD.css.
   */
  function isClanoviWideTwoColLayout() {
    var mql = getClanoviStackModeMql();
    if (mql) return !mql.matches;
    var bp = getOneColBreakPx();
    return typeof window !== 'undefined' && window.innerWidth > bp;
  }

  function clearSlikaPanelWideLayoutStyles() {
    var panelSlika = document.querySelector('.clanovi-crud__panel-slika');
    if (!panelSlika) return;
    panelSlika.style.width = '';
    panelSlika.style.height = '';
    panelSlika.style.minHeight = '';
    panelSlika.style.maxHeight = '';
    panelSlika.style.aspectRatio = '';
  }
  var CLANOVI_ASPECT_HEIGHT = 1.2;
  var savedSlikaW = 0;
  var savedSlikaH = 0;
  /** U širokom modu: širina panela slike kad je na granici; u 640 modu koristi se za max visinu panela tablice. */
  var savedMaxTablicaHeightFromWide = 0;

  /** Min. visina panela tablice (pet vidljivih redova + zaglavlje + resize). */
  function getPanelTablicaMinHeight() {
    var panel = document.querySelector('.clanovi-crud__panel-tablica');
    if (!panel || typeof getComputedStyle !== 'function') return 400;
    var cs = getComputedStyle(panel);
    var minH = parseFloat(cs.minHeight);
    return (isNaN(minH) || minH <= 0) ? 400 : Math.round(minH);
  }

  /** Max visina panela tablice u modu 40/60: širenje stane kad panel slike dosegne 60% širine reda (slikaW = H/1.2 <= 60% rowW). */
  function getPanelTablicaMaxHeight() {
    var topRow = document.querySelector('.clanovi-crud__top-row');
    if (!topRow) return 9999;
    var rowW = topRow.offsetWidth || 0;
    if (rowW <= 0) return 9999;
    var gap = 16;
    var slikaMaxW = (rowW - gap) * 0.6;
    var maxH = Math.floor(slikaMaxW * CLANOVI_ASPECT_HEIGHT);
    var viewportCap = typeof window !== 'undefined' && window.innerHeight ? Math.floor(window.innerHeight * 0.9) : 800;
    return Math.min(maxH, viewportCap);
  }

  /** Kad je panel slike na 60% širine reda, zaključaj max-height oba panela (kao u Loze_CRUD). */
  function sync60_40MaxHeight() {
    var topRow = document.querySelector('.clanovi-crud__top-row');
    var panelSlika = document.querySelector('.clanovi-crud__panel-slika');
    var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
    if (!topRow || !panelSlika || !panelTablica) return;
    var isWide = isClanoviWideTwoColLayout();
    if (!isWide) {
      clearSlikaPanelWideLayoutStyles();
      panelTablica.style.maxHeight = '';
      return;
    }
    var rowW = topRow.offsetWidth;
    if (rowW <= 0) return;
    var slikaW = panelSlika.offsetWidth;
    var atLimit = slikaW >= rowW * 0.59;
    if (atLimit) {
      panelSlika.style.maxHeight = panelSlika.offsetHeight + 'px';
      panelTablica.style.maxHeight = panelTablica.offsetHeight + 'px';
    } else {
      panelSlika.style.maxHeight = '';
      panelTablica.style.maxHeight = '';
    }
  }

  function applyOneColSlika(panelSlika) {
    if (!panelSlika) return;
    savedSlikaW = panelSlika.offsetWidth || 0;
    savedSlikaH = panelSlika.offsetHeight || 0;
    panelSlika.style.width = '';
    panelSlika.style.height = '';
    panelSlika.style.minHeight = '';
    panelSlika.style.aspectRatio = '';
  }

  function restoreSlikaDimensions(panelSlika) {
    if (!panelSlika || (savedSlikaW <= 0 && savedSlikaH <= 0)) return;
    if (savedSlikaW > 0) panelSlika.style.width = savedSlikaW + 'px';
    if (savedSlikaH > 0) {
      panelSlika.style.height = savedSlikaH + 'px';
      panelSlika.style.minHeight = savedSlikaH + 'px';
    }
    panelSlika.style.aspectRatio = '1/1.2';
  }

  /**
   * Kontrola slike u omjeru 1:1,2. Oba panela iste visine.
   * Panel tablice smije se širiti prema dolje dok panel slike ne dosegne 60% širine prostora; na toj granici širenje stane (sync60_40MaxHeight).
   * initialExpand === true: inicijalno visina = min-height (5 redova).
   */
  function setPanelSlikaSizeFromTablica(initialExpand) {
    var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
    var panelSlika = document.querySelector('.clanovi-crud__panel-slika');
    var topRow = document.querySelector('.clanovi-crud__top-row');
    if (!panelTablica || !panelSlika || !topRow) return;
    var isWide = isClanoviWideTwoColLayout();
    if (!isWide) {
      clearSlikaPanelWideLayoutStyles();
      return;
    }

    var minH = getPanelTablicaMinHeight();
    var maxH = getPanelTablicaMaxHeight();
    var H = panelTablica.offsetHeight || minH;
    if (initialExpand) {
      H = minH;
      panelTablica.style.height = H + 'px';
    } else {
      H = Math.min(Math.max(H, minH), maxH);
      if (panelTablica.offsetHeight > maxH) panelTablica.style.height = maxH + 'px';
    }
    H = Math.min(H, maxH);
    var slikaW = Math.floor(H / CLANOVI_ASPECT_HEIGHT);
    if (H <= 0) return;
    panelSlika.style.width = slikaW + 'px';
    panelSlika.style.height = H + 'px';
    panelSlika.style.minHeight = H + 'px';
    panelSlika.style.aspectRatio = '1/1.2';
    if (panelSlika.offsetWidth > 0) savedMaxTablicaHeightFromWide = panelSlika.offsetWidth;
    sync60_40MaxHeight();
  }

  function initForma() {
    /* Odmah iscrtaj C ∴ L ∴ (ne čekaj ucitajPravaGeo – inače je prvi red prazan dok keš ne stigne). */
    clanoviLozaUpdateNaslovLozu();
    ucitajPravaGeo(function () {
      clanoviLozaUpdateNaslovLozu();
      clanoviLozaPostaviVidljivihRedova();
      updateEnabledState();
      setPanelSlikaSizeFromTablica(true);
    });
    var xhrPorijeklo = new XMLHttpRequest();
    xhrPorijeklo.open('GET', getApiUrl('Clanovi_Porijeklo_CRUD_sve.php'), true);
    xhrPorijeklo.onreadystatechange = function () {
      if (xhrPorijeklo.readyState !== 4) return;
      var text = (xhrPorijeklo.responseText || '').trim();
      if (!selectPorijeklo) return;
      while (selectPorijeklo.firstChild) selectPorijeklo.removeChild(selectPorijeklo.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = ''; opt0.textContent = '— Odaberi porijeklo —';
      selectPorijeklo.appendChild(opt0);
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            var o = document.createElement('option');
            o.value = arr[i].id != null ? String(arr[i].id) : '';
            o.textContent = arr[i].naziv != null ? arr[i].naziv : '';
            selectPorijeklo.appendChild(o);
          }
        } catch (e) {}
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_porijeklo');
    };
    xhrPorijeklo.send();

    var xhrDrzaveAdrese = new XMLHttpRequest();
    xhrDrzaveAdrese.open('GET', getApiUrl('Drzave_Adrese_CRUD_sve.php'), true);
    xhrDrzaveAdrese.onreadystatechange = function () {
      if (xhrDrzaveAdrese.readyState !== 4) return;
      var text = (xhrDrzaveAdrese.responseText || '').trim();
      if (!selectDrzavaAdrese) return;
      while (selectDrzavaAdrese.firstChild) selectDrzavaAdrese.removeChild(selectDrzavaAdrese.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = ''; opt0.textContent = '— Odaberi državu adrese —';
      selectDrzavaAdrese.appendChild(opt0);
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            var o = document.createElement('option');
            o.value = arr[i].id != null ? String(arr[i].id) : '';
            o.textContent = arr[i].naziv != null ? arr[i].naziv : '';
            selectDrzavaAdrese.appendChild(o);
          }
        } catch (e) {}
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava_adrese');
    };
    xhrDrzaveAdrese.send();

    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza) selectLoza.disabled = true;
    data = [];
    if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], ClanoviLozaCRUD.Tablica_Zaglavlje);
    updateEnabledState();
    updateCrudUpisiState();

    var delBtn = document.getElementById('clanovi_image_delete_btn');
    var imgPreview = document.getElementById('clanovi_image_preview');
    if (delBtn && imgPreview) {
      delBtn.addEventListener('dblclick', function (e) { e.preventDefault(); e.stopPropagation(); });
      delBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (delBtn.disabled) return;
        clearSlikaFromControl();
      });
    }

    if (typeof window.ObradaSlikaInit === 'function') {
      window.ObradaSlikaInit({
        idPrefix: 'clanovi_modal_slika',
        templateUrl: '0-Obrada_Slike.php',
        mountSelector: '#obrada_slika_mount',
        getSelectedId: getSelectedRowId,
        getEditFormRowId: getSelectedRowId,
        apiBase: API_BASE,
        imageUrlPath: 'Clanovi_CRUD_slika.php',
        imageAreaId: 'clanovi_image_area',
        focusAfterCloseId: 'edit_prezime',
        imageAreaDisabledClass: 'clanovi-crud__edit-image-area--disabled',
        imagePreviewElement: document.getElementById('clanovi_image_preview'),
        parseResponseCode: parseResponseCode,
        fixedRatioX: 1,
        fixedRatioY: 1.2,
        ratioInputsDisabled: true,
        enableRoundThumb: true
      });
    }

    if (typeof ResizeObserver !== 'undefined') {
      var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
      if (panelTablica) {
        var ro = new ResizeObserver(function () {
          requestAnimationFrame(function () { setPanelSlikaSizeFromTablica(false); });
        });
        ro.observe(panelTablica);
      }
      var kontroleHeader = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      if (kontroleHeader) {
        var roLogo = new ResizeObserver(function () {
          clanoviLozaSyncTablicaHeaderLogoSize();
        });
        roLogo.observe(kontroleHeader);
      }
    }
    clanoviLozaSyncTablicaHeaderLogoSize();
    setTimeout(function () { clanoviLozaSyncTablicaHeaderLogoSize(); }, 0);
    setTimeout(function () { clanoviLozaSyncTablicaHeaderLogoSize(); }, 200);
    var lastWide = isClanoviWideTwoColLayout();
    function clanoviOnViewportLayoutChange() {
      var nowWide = isClanoviWideTwoColLayout();
      if (!nowWide) clearSlikaPanelWideLayoutStyles();
      var panelSlika = document.querySelector('.clanovi-crud__panel-slika');
      if (!panelSlika) { lastWide = nowWide; return; }
      if (lastWide && !nowWide) {
        if (panelSlika.offsetWidth > 0) savedMaxTablicaHeightFromWide = panelSlika.offsetWidth;
        applyOneColSlika(panelSlika);
        var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
        if (panelTablica) {
          panelTablica.style.height = '';
          panelTablica.style.maxHeight = '';
        }
      } else if (!lastWide && nowWide) {
        restoreSlikaDimensions(panelSlika);
        var panelTablica = document.querySelector('.clanovi-crud__panel-tablica');
        if (panelTablica && panelSlika && panelSlika.offsetWidth > 0) {
          var maxH = getPanelTablicaMaxHeight();
          if (panelTablica.offsetHeight > maxH) {
            panelTablica.style.height = maxH + 'px';
            requestAnimationFrame(function () { setPanelSlikaSizeFromTablica(false); });
          }
        }
      }
      lastWide = nowWide;
      requestAnimationFrame(sync60_40MaxHeight);
      clanoviLozaSyncTablicaHeaderLogoSize();
    }
    window.addEventListener('resize', function () {
      requestAnimationFrame(clanoviOnViewportLayoutChange);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { requestAnimationFrame(clanoviOnViewportLayoutChange); }, 200);
    });
    var stackMql = getClanoviStackModeMql();
    if (stackMql) {
      var onStackMqlChange = function () {
        requestAnimationFrame(clanoviOnViewportLayoutChange);
      };
      if (stackMql.addEventListener) stackMql.addEventListener('change', onStackMqlChange);
      else if (stackMql.addListener) stackMql.addListener(onStackMqlChange);
    }
    /* Nakon prvog layouta (mobitel): uskladi lastWide i inline stilove s CSS @media. */
    requestAnimationFrame(function () {
      requestAnimationFrame(clanoviOnViewportLayoutChange);
    });

    setTimeout(initPanelTablicaTouchResize, 0);
    setTimeout(initPanelTablicaTouchResize, 400);
  }

  function initPanelTablicaTouchResize() {
    var panel = document.querySelector('.clanovi-crud__panel-tablica');
    if (!panel) return;
    var doc = panel.ownerDocument || document;
    var minH = 120;
    var cs = typeof getComputedStyle !== 'undefined' && getComputedStyle(panel).minHeight;
    if (cs && cs !== 'none' && cs !== 'auto') {
      var px = parseFloat(cs);
      if (!isNaN(px) && px > 0) minH = Math.round(px);
    }
    var isWide = isClanoviWideTwoColLayout();
    var maxH = 800;
    if (typeof window !== 'undefined') {
      if (isWide) {
        maxH = getPanelTablicaMaxHeight();
      } else {
        var base = savedMaxTablicaHeightFromWide > 0 ? savedMaxTablicaHeightFromWide : minH;
        maxH = Math.round(base * 2);
      }
    }
    var handle = panel.querySelector('.clanovi-crud__resize-handle');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'clanovi-crud__resize-handle';
      handle.setAttribute('aria-label', 'Povuci za promjenu visine panela');
      panel.appendChild(handle);

      function getY(e) {
        if (e.touches && e.touches.length) return e.touches[0].clientY;
        return e.clientY;
      }
      var handleHeight = 48;
      function startResize(e) {
        var startY = getY(e);
        var startHeight = panel.offsetHeight;
        var panelMin = minH;
        var cs2 = getComputedStyle(panel).minHeight;
        if (cs2 && cs2 !== 'none' && cs2 !== 'auto') {
          var px2 = parseFloat(cs2);
          if (!isNaN(px2) && px2 > 0) panelMin = Math.round(px2);
        }
        var minWithHandle = panelMin + handleHeight;
        var dynamicMaxH = isClanoviWideTwoColLayout() ? getPanelTablicaMaxHeight() : maxH;
        dynamicMaxH = Math.max(dynamicMaxH, minWithHandle);
        function move(ev) {
          var y = getY(ev);
          var delta = y - startY;
          var newH = Math.max(minWithHandle, Math.min(dynamicMaxH, startHeight + delta));
          panel.style.height = newH + 'px';
          if (ev.cancelable) ev.preventDefault();
        }
        function stop() {
          doc.removeEventListener('touchmove', move, { passive: false });
          doc.removeEventListener('touchend', stop);
          doc.removeEventListener('touchcancel', stop);
          doc.removeEventListener('mousemove', move);
          doc.removeEventListener('mouseup', stop);
        }
        doc.addEventListener('touchmove', move, { passive: false });
        doc.addEventListener('touchend', stop);
        doc.addEventListener('touchcancel', stop);
        doc.addEventListener('mousemove', move);
        doc.addEventListener('mouseup', stop);
        if (e.cancelable) e.preventDefault();
      }
      handle.addEventListener('touchstart', startResize, { passive: false });
      handle.addEventListener('mousedown', startResize);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForma);
    window.addEventListener('load', function () {
      setPanelSlikaSizeFromTablica(true);
      setTimeout(function () { setPanelSlikaSizeFromTablica(true); }, 100);
    });
  } else {
    initForma();
  }

  window.ClanoviLozaCRUD = ClanoviLozaCRUD;
})();
