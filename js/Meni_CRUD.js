/* =========================================================
   Meni_CRUD.js
   Tablica stavki menija + edit panel (CRUD). Koristi CommonCRUD,
   0-Kontrole (tablica, edit-delete, custom select), 0-Poruke_Tekstovi (modal).
   API: Meni_CRUD_sve.php, _upis.php, _izmjena.php, _brisanje.php,
        Meni_CRUD_Aktivnost_Change.php, Meni_CRUD_Test_Change.php
   ========================================================= */
// @ts-nocheck
(function () {
    'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Meni_CRUD.html');

  /* --- Blok: Konfiguracija tablice ---
     Broj_Kolona, Reload_Ikona, CrudCssPrefix, Tablica_Zaglavlje (Naziv, HTML, Tip menija, A, T). */
  //
  // Tablica_Zaglavlje – svaka kolona je objekt sa parametrima:
  // 1) key (string) - Jedinstveni ključ kolone.
  // 2) title (string) - Tekst u zaglavlju kolone (THEAD).
  // 3) SQL_Naziv (string) - Naziv podatka koji vraća PHP. Ako nije upisan = prvi podatak iza id. id = ključ sloga, skriveni podatak u redu tablice.
  // 4) sortable (0 | 1) - 1 = kolona se može sortirati klikom na zaglavlje; 0 = nije sortabilna.
  // 5) sortable_icon (0 | 1) - 1 = iscrtava se sort ikona u zaglavlju. Default: 0.
  // 6) type ("t" | "n" | "d" | "b") - Tip podataka u koloni: "t" = tekst, "n" = broj, "d" = datum, "b" = binarno.
  // 7) width (number) - Širina te kolone: 0 = auto; < 0 = abs(width) % ukupne širine; > 0 = fiksno u px.
  // 8) suffix (string) - Dodatak uz prikaz podatka (npr. " €", "%", " kom").
  // 9) align ("L" | "C" | "R") - Orijentacija teksta u zaglavlju tablice: L = lijevo, C = centar, R = desno.
  // 10) row_align ("L" | "C" | "R") - Orijentacija sadržaja u redovima tablice: L = lijevo, C = centar, R = desno.
  // 11) mobitel_prikaz (0–255, default 1) - Prikaz kolone na mobilnim uređajima. 0 = ne prikazuje se, 1 = prikazuje se. Primjenjuje se pri sužavanju (npr. kada kolone grida idu jedna iznad druge).
  // 12) cell_readonly (0 | 1) - Za type "b": 1 = checkbox nije klikabilan (samo prikaz). Default: 0.
  //
  const MeniCRUD = {
    Broj_Kolona: 5,
    Reload_Ikona: 0,
    CrudCssPrefix: 'meni-crud',
    Tablica_Zaglavlje: [
      { key: "naziv", title: "Naziv", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "html_fajl", title: "Stranica / opis", SQL_Naziv: "html_fajl", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 0 },
      { key: "meni_tip_naziv", title: "Tip menija", SQL_Naziv: "meni_tip_naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "aktivno", title: "A", SQL_Naziv: "aktivno", sortable: 1, sortable_icon: 0, type: "b", width: 60, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 0, cell_readonly: 0 },
      { key: "test", title: "T", SQL_Naziv: "test", sortable: 1, sortable_icon: 0, type: "b", width: 60, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 0, cell_readonly: 0 },
    ]
  };

  /* =========================================================
     Blok: Funkcionalnosti
     Glavne CRUD funkcionalnosti: tablica, edit panel, Upis/Izmjeni/Izbriši,
     auto-referenca, selecti, inline toggle, API pozivi.
     ========================================================= */

  /* --- Globalno stanje ---
     tablicaApi, onCrudSelectionChange, data (punjen iz Meni_CRUD_sve.php), lastAutoRef, clearFromXClick. */
  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var data = [];
  var lastAutoRef = null;
  var clearFromXClick = false;

  /* --- Inicijalizacija tablice (CommonCRUD) ---
     getRowId iz zadnjeg elementa reda, onReady/onSelectionChange. */
  CommonCRUD.initTablica('tablicaContainer', MeniCRUD, {
    getRowId: function (row) { return row.length > 0 ? row[row.length - 1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  /* --- Isprazni sve kontrole edit panela ---
     Koristi se pri clear selekcije ili kliku X; fillRoditeljSelect i refresh custom selecta u setTimeout(0). */
  function clearControlsFromSelection() {
    // Dohvati sve DOM elemente kontrola
    var editNaziv = document.getElementById('edit_naziv');
    var editOpis = document.getElementById('edit_opis');
    var editHtmlFajl = document.getElementById('edit_html_fajl');
    var editRef = document.getElementById('edit_ref');
    var editPutanja = document.getElementById('edit_putanja');
    var editRedoslijed = document.getElementById('edit_redoslijed');
    var editNapomena = document.getElementById('edit_napomena');
    var editAktivno = document.getElementById('edit_aktivno');
    var editTest = document.getElementById('edit_test');
    var editMeniTipId = document.getElementById('edit_meni_tip_id');
    var editRoditelj = document.getElementById('edit_roditelj');
    var editDevice = document.getElementById('edit_device');

    // Odmah postavi vrijednosti (brzo) - za edit-delete kontrole dispatchEvent('input') da se pokrene updateCrudUpisiState
    if (editNaziv) { editNaziv.value = ''; editNaziv.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editOpis) editOpis.value = '';
    if (editHtmlFajl) { editHtmlFajl.value = ''; editHtmlFajl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editRef) { editRef.value = ''; editRef.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editPutanja) { editPutanja.value = ''; }
    if (editRedoslijed) { editRedoslijed.value = ''; }
    if (editNapomena) { editNapomena.value = ''; }
    if (editAktivno) editAktivno.checked = false;
    if (editTest) editTest.checked = false;
    if (editMeniTipId) editMeniTipId.value = '0';
    if (editRoditelj) editRoditelj.value = '0';
    if (editDevice) editDevice.value = '0';
    lastAutoRef = null; // Resetiraj auto-referencu
    // Device select: postavi i refresh odmah (prije updateCrudUpisiState koji može disable-ati kontrole)
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('edit_device');
    // Odgodi teške operacije (fillRoditeljSelect i refresh ostalih custom selecta) da ne blokiraju UI
    setTimeout(function () {
      fillRoditeljSelect(null); // Popuni roditelj select sa svim stavkama
      if (typeof KontroleRefreshCustomSelect === 'function') {
        KontroleRefreshCustomSelect('edit_meni_tip_id'); // Refresh custom select za Tip menija
        KontroleRefreshCustomSelect('edit_roditelj'); // Refresh custom select za Roditelj
        primijeniRoditeljOpisBoja();
      }
    }, 0);
  }

  /* --- Kad se promijeni selekcija u tablici ---
     id == null: clearControlsFromSelection (ili skip ako clearFromXClick). Inače popuni formu iz data, fillRoditeljSelect, refresh custom selecta, updateCrudUpisiState. */
  onCrudSelectionChange = function () {
    var id = getSelectedRowId(); // Dohvati ID selektiranog reda
    // Ako nema selekcije (id == null)
    if (id == null) {
      // Ako je clear došao od X klika, samo resetiraj flag (kontrole su već ispražnjene)
      if (clearFromXClick) {
        clearFromXClick = false;
      } else {
        // Inače isprazni sve kontrole
        clearControlsFromSelection();
      }
    } else {
      // Ima selekciju - popuni formu podacima iz data
      var dataRows = tablicaApi.getData(); // Ne koristi se, ali zadržano za kompatibilnost
      var foundRow = data.find(function (r) { return String(r.id) === String(id); }); // Pronađi redak u data nizu
      if (foundRow) {
        // Dohvati sve DOM elemente kontrola
        var editNaziv = document.getElementById('edit_naziv');
        var editOpis = document.getElementById('edit_opis');
        var editHtmlFajl = document.getElementById('edit_html_fajl');
        var editRef = document.getElementById('edit_ref');
        var editPutanja = document.getElementById('edit_putanja');
        var editRedoslijed = document.getElementById('edit_redoslijed');
        var editNapomena = document.getElementById('edit_napomena');
        var editAktivno = document.getElementById('edit_aktivno');
        var editTest = document.getElementById('edit_test');
        var editMeniTipId = document.getElementById('edit_meni_tip_id');
        var editRoditelj = document.getElementById('edit_roditelj');
        var editDevice = document.getElementById('edit_device');

        // Popuni kontrole vrijednostima iz foundRow (dispatchEvent('input') za edit-delete da se pokrene updateCrudUpisiState)
        if (editNaziv) { editNaziv.value = foundRow.naziv != null ? foundRow.naziv : ''; editNaziv.dispatchEvent(new Event('input', { bubbles: true })); }
        if (editOpis) editOpis.value = foundRow.opis != null ? foundRow.opis : '';
        if (editHtmlFajl) { editHtmlFajl.value = foundRow.html_fajl != null ? foundRow.html_fajl : ''; editHtmlFajl.dispatchEvent(new Event('input', { bubbles: true })); }
        if (editRef) { editRef.value = foundRow.ref != null ? foundRow.ref : ''; editRef.dispatchEvent(new Event('input', { bubbles: true })); }
        if (editPutanja) editPutanja.value = foundRow.putanja != null ? foundRow.putanja : '';
        if (editRedoslijed) editRedoslijed.value = foundRow.redoslijed != null ? String(foundRow.redoslijed) : '';
        if (editNapomena) editNapomena.value = foundRow.napomena != null ? foundRow.napomena : '';
        if (editAktivno) editAktivno.checked = foundRow.aktivno == 1;
        if (editTest) editTest.checked = foundRow.test == 1;
        if (editMeniTipId) editMeniTipId.value = foundRow.meni_tip_id != null ? String(foundRow.meni_tip_id) : '0';
        fillRoditeljSelect(id); // Popuni roditelj select (isključi trenutni red)
        if (editRoditelj) editRoditelj.value = foundRow.roditelj != null ? String(foundRow.roditelj) : '0';
        if (editDevice) editDevice.value = foundRow.device != null ? String(foundRow.device) : '0';
        // Refresh custom selecta nakon promjene vrijednosti
        if (typeof KontroleRefreshCustomSelect === 'function') {
          KontroleRefreshCustomSelect('edit_meni_tip_id');
          KontroleRefreshCustomSelect('edit_roditelj');
          KontroleRefreshCustomSelect('edit_device');
          primijeniRoditeljOpisBoja();
        }

        // Postavi lastAutoRef ako je trenutna referenca jednaka auto-generiranoj
        var auto = autoRefFromHtmlValue(editHtmlFajl ? editHtmlFajl.value : '');
        var cur = String(editRef ? editRef.value : '').trim();
        lastAutoRef = (cur !== '' && cur === auto) ? auto : null;
      }
    }
    // Ažuriraj stanje tipki i panela nakon promjene selekcije
    updateCrudUpisiState();
  };

  /* --- Klik X na edit-delete (Naziv) ---
     clearFromXClick = true, clearControlsFromSelection, clearSelection tablice, updateCrudUpisiState. */
  (function () {
    var editEl = document.getElementById('edit_naziv'); // Dohvati input element
    var wrap = editEl && editEl.closest('.kontrola-edit-delete'); // Pronađi wrapper edit-delete kontrole
    if (!wrap) return; // Ako nema wrappera, izađi
    // Slušaj custom event 'kontrole-edit-delete-clear' koji se emituje pri kliku X
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      clearFromXClick = true; // Postavi flag da je clear došao od X klika
      clearControlsFromSelection(); // Isprazni sve kontrole
      // Odmah očisti selekciju i ažuriraj stanje (bez odgode - kontrole su već ispražnjene)
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateCrudUpisiState(); // Ažuriraj stanje tipki i panela
    });
  })();

  /* --- Tipke Upis / Izmjeni / Izbriši i stanje panela ---
     updateCrudUpisiState: enable/disable kontrole po sadržaju Naziv; edit-delete i Povratak uvijek enabled; labela Naziv uvijek enabled. */
  var btnUpisi = document.getElementById('btnUpisi'); // Dohvati tipku Upis/Izmjeni
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null; // Dohvati labelu tipke
  var btnIzbrisi = document.getElementById('btnIzbrisi'); // Dohvati tipku Izbriši

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null; // Provjeri ima li selektiran redak
    var editNaziv = document.getElementById('edit_naziv'); // Dohvati input Naziv
    var imaSadrzaj = editNaziv ? trim(editNaziv.value) !== '' : false; // Provjeri ima li tekst u Naziv
    var editPanel = document.getElementById('edit_panel'); // Dohvati edit panel
    
    // Enable/disable sve kontrole na edit panelu ovisno o tome ima li tekst u edit-delete kontroli
    if (editPanel && typeof KontroleSetEnabled === 'function') {
      KontroleSetEnabled(editPanel, imaSadrzaj); // Enable/disable sve kontrole u panelu
      // Edit-delete i tipka Povratak uvijek enabled (korisnik mora moći očistiti formu i vratiti se)
      if (editNaziv) {
        var editDeleteWrap = editNaziv.closest('.kontrola-edit-delete'); // Pronađi wrapper edit-delete
        if (editDeleteWrap) {
          var input = editDeleteWrap.querySelector('.kontrola-edit-delete__input'); // Dohvati input
          var clearBtn = editDeleteWrap.querySelector('.kontrola-edit-delete__clear'); // Dohvati tipku X
          if (input) input.disabled = false; // Enable input
          if (clearBtn) clearBtn.disabled = false; // Enable tipku X
          editDeleteWrap.classList.remove('kontrola-edit-delete--disabled'); // Ukloni disabled klasu
        }
        var labelNaziv = document.querySelector('.kontrola-labela[for="edit_naziv"]'); // Dohvati labelu Naziv
        if (labelNaziv) labelNaziv.classList.remove('kontrola-labela--disabled'); // Ukloni disabled klasu s labele
      }
      var btnPovratak = document.getElementById('btnPovratak'); // Dohvati tipku Povratak
      if (btnPovratak) btnPovratak.removeAttribute('disabled'); // Enable tipku Povratak
      if (typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel); // Labele u skladu s enabled stanjem
    }

    // Ažuriraj tipku Upis/Izmjeni
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju); // Dodaj/ukloni klasu za izmjenu
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis'; // Promijeni tekst labele
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis'); // Ažuriraj aria-label
      btnUpisi.disabled = !imaSadrzaj; // Enable samo ako ima sadržaj
    }
    // Ažuriraj tipku Izbriši
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju; // Enable samo ako ima selekciju
  }

  /* --- Input/change na Naziv ažurira stanje tipki i panela --- */
  (function () {
    var editNaziv = document.getElementById('edit_naziv'); // Dohvati input Naziv
    if (!editNaziv) return; // Ako ne postoji, izađi
    editNaziv.addEventListener('input', updateCrudUpisiState); // Slušaj input event
    editNaziv.addEventListener('change', updateCrudUpisiState); // Slušaj change event
  })();

  /* --- Reload tablice (ako je Reload_Ikona === 1) --- */
  if (MeniCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica'); // Dohvati tipku Reload
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu); // Dodaj click handler
  }

  /* --- Klik Upis / Izmjeni ---
     Validacija (validacijaMeniForme), payload iz kontrola, meniAdd ili meniUpdate; modal 001/004 na uspjeh, parseResponseCode na grešku. */
  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      // Dohvati sve DOM elemente kontrola
      var editNaziv = document.getElementById('edit_naziv');
      var editOpis = document.getElementById('edit_opis');
      var editHtmlFajl = document.getElementById('edit_html_fajl');
      var editRef = document.getElementById('edit_ref');
      var editPutanja = document.getElementById('edit_putanja');
      var editRedoslijed = document.getElementById('edit_redoslijed');
      var editNapomena = document.getElementById('edit_napomena');
      var editAktivno = document.getElementById('edit_aktivno');
      var editTest = document.getElementById('edit_test');
      var editMeniTipId = document.getElementById('edit_meni_tip_id');
      var editRoditelj = document.getElementById('edit_roditelj');
      var editDevice = document.getElementById('edit_device');

      var naziv = editNaziv ? trim(editNaziv.value) : ''; // Dohvati i trim naziv
      if (naziv === '') return; // Ako nema naziva, izađi

      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni'); // Provjeri je li izmjena
      var id = jeIzmjena ? getSelectedRowId() : null; // Dohvati ID ako je izmjena
      if (jeIzmjena && id == null) return; // Ako je izmjena ali nema ID, izađi

      // Validacija forme
      var valid = validacijaMeniForme(jeIzmjena, id);
      if (!valid.ok) {
        // Ako validacija ne prođe, prikaži modal s greškom
        if (valid.code && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[valid.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(valid.code, valid.replacements || []);
        }
        return;
      }

      // Referenca: ako duplikat, dodaj "-001", "-002" itd.
      var refRaw = editRef ? trim(editRef.value) : '';
      var refUnique = ensureUniqueRef(refRaw, jeIzmjena, id);
      if (refUnique !== refRaw && editRef) {
        editRef.value = refUnique;
        editRef.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Kreiraj payload objekt s podacima iz kontrola
      var payload = {
        naziv: naziv,
        opis: editOpis ? trim(editOpis.value) : '',
        html_fajl: editHtmlFajl ? trim(editHtmlFajl.value) : '',
        ref: refUnique,
        putanja: editPutanja ? trim(editPutanja.value) : '',
        redoslijed: editRedoslijed ? (parseInt(editRedoslijed.value, 10) || 0) : 0,
        meni_tip_id: editMeniTipId ? (editMeniTipId.value || '0') : '0',
        roditelj: editRoditelj ? (editRoditelj.value || '0') : '0',
        napomena: editNapomena ? trim(editNapomena.value) : '',
        device: editDevice ? (editDevice.value || '0') : '0'
      };

      // Dodaj checkbox vrijednosti samo ako su checked
      if (editAktivno && editAktivno.checked) payload.aktivno = 1;
      if (editTest && editTest.checked) payload.test = 1;

      // Ako je izmjena, pozovi meniUpdate
      if (jeIzmjena) {
        payload.id = String(id); // Dodaj ID u payload
        meniUpdate(payload, function (res) {
          if (res === 'OK') {
            // Na uspjeh prikaži modal 004 (Izmjena uspješna)
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            // Na grešku parsiraj odgovor i prikaži modal
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      } else {
        // Ako je upis, pozovi meniAdd
        meniAdd(payload, function (res) {
          if (res === 'OK') {
            // Na uspjeh prikaži modal 001 (Upis uspješan)
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            // Na grešku parsiraj odgovor i prikaži modal
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      }
    });
  }

  /* --- Klik Izbriši ---
     meniDelete(id), modal 003 na uspjeh, parseResponseCode na grešku. */
  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId(); // Dohvati ID selektiranog reda
      if (id == null) return; // Ako nema selekcije, izađi
      meniDelete(id, function (res) {
        if (res === 'OK') {
          // Na uspjeh prikaži modal 003 (Brisanje uspješno)
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
            if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
            clearControlsFromSelection();
            osvjeziTablicu();
          });
        } else {
          // Na grešku parsiraj odgovor i prikaži modal
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
        }
      });
    });
  }

  /* --- Tipka Povratak ---
     ref iz URL-a ili document.referrer (samo same-origin), inače Meni.php. */
  (function () {
    var btnPovratak = document.getElementById('btnPovratak'); // Dohvati tipku Povratak
    if (!btnPovratak) return; // Ako ne postoji, izađi
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search); // Dohvati URL parametre
      var ref = (params.get('ref') || '').trim(); // Dohvati parametar 'ref'
      // Ako postoji ref parametar, pokušaj navigirati na njega (samo same-origin)
      if (ref) {
        try {
          var u = new URL(ref, window.location.href); // Parsiraj URL
          if (u.origin === window.location.origin) { window.location.href = u.href; return; } // Ako je same-origin, navigiraj
        } catch (e) {} // Ako parsiranje ne uspije, ignoriraj
      }
      // Ako postoji document.referrer, pokušaj navigirati na njega (samo same-origin)
      if (document.referrer) {
        try {
          var u = new URL(document.referrer); // Parsiraj referrer URL
          if (u.origin === window.location.origin) { window.location.href = u.href; return; } // Ako je same-origin, navigiraj
        } catch (e) {} // Ako parsiranje ne uspije, ignoriraj
      }
      // Inače navigiraj na Meni.php
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  /* --- API i parsiranje odgovora ---
     API_BASE, parseResponseCode (OK / kod ili kod,replacements), ucitajPodatkeTablica, postFormData, osvjeziTablicu, setDataTablica. */
  var API_BASE = '../php/'; // Bazni put do PHP skripti

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null; // Ako nije string, vrati null
    var s = res.trim(); // Trim vrijednost
    if (s === '' || s === 'OK') return null; // Ako je prazan ili 'OK', vrati null (nema greške)
    var idx = s.indexOf(','); // Pronađi zarez (format: kod,replacement)
    if (idx < 0) return { code: s, replacements: [] }; // Ako nema zareza, samo kod
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] }; // Parsiraj kod i replacement
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest(); // Kreiraj XMLHttpRequest objekt
    xhr.open('GET', API_BASE + 'Meni_CRUD_sve.php', true); // Otvori GET zahtjev
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return; // Čekaj dok se zahtjev ne završi (readyState === 4)
      var text = (xhr.responseText || '').trim(); // Dohvati odgovor
      var rows = []; // Niz redaka za tablicu
      // Ako odgovor nije JSON (počinje s '['), parsiraj kao grešku
      if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text); // Parsiraj grešku
        // Ako postoji kod greške i modal sistem, prikaži modal
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      } else {
        // Ako je JSON, parsiraj i konvertiraj u redove za tablicu
        try {
          var arr = JSON.parse(text || '[]'); // Parsiraj JSON
          data = arr; // Spremi u globalni data niz
          // Konvertiraj svaki redak u format za tablicu
          for (var i = 0; i < arr.length; i++) {
            var htmlOrOpis = (arr[i].html_fajl != null && String(arr[i].html_fajl).trim() !== '')
              ? arr[i].html_fajl
              : (arr[i].opis != null ? arr[i].opis : '');
            rows.push([
              arr[i].naziv != null ? arr[i].naziv : '',
              htmlOrOpis,
              arr[i].meni_tip_naziv != null ? arr[i].meni_tip_naziv : '',
              arr[i].aktivno != null ? arr[i].aktivno : 0,
              arr[i].test != null ? arr[i].test : 0,
              arr[i].id != null ? arr[i].id : 0
            ]);
          }
        } catch (e) {} // Ako parsiranje ne uspije, ignoriraj
      }
      if (callback) callback(rows); // Pozovi callback s redovima
    };
    xhr.send(); // Pošalji zahtjev
  }

  function postFormData(url, params, callback) {
    // Koristi CommonPostFormData ako postoji, inače pozovi callback s praznim stringom
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function osvjeziTablicu() {
    // Učitaj podatke i postavi ih u tablicu
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
      primijeniOpisBoja();
      fillRoditeljSelect(getSelectedRowId());
      if (typeof KontroleRefreshCustomSelect === 'function') {
        KontroleRefreshCustomSelect('edit_roditelj');
        primijeniRoditeljOpisBoja();
      }
    });
  }

  function setDataTablica(rows) {
    // Postavi podatke u tablicu koristeći CommonCRUD
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, MeniCRUD.Tablica_Zaglavlje);
  }

  /** Boja --c-blue-600 za 1., 2., 3. kolonu kad se prikazuje Opis (nema html_fajl). */
  function primijeniOpisBoja() {
    var container = document.getElementById('tablicaContainer');
    if (!container) return;
    var tbody = container.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return;
    var COLS_OPIS = [0, 1, 2]; /* Naziv, HTML ili Opis, Tip menija */
    for (var i = 0; i < tbody.rows.length; i++) {
      var tr = tbody.rows[i];
      var rowId = tr.dataset.rowId;
      if (rowId == null) continue;
      var found = null;
      for (var j = 0; j < data.length; j++) {
        if (String(data[j].id) === String(rowId)) { found = data[j]; break; }
      }
      if (!found) continue;
      var hasHtml = found.html_fajl != null && String(found.html_fajl).trim() !== '';
      for (var k = 0; k < COLS_OPIS.length; k++) {
        var td = tr.cells[COLS_OPIS[k]];
        if (td) {
          if (hasHtml) td.classList.remove('meni-crud__cell--opis');
          else td.classList.add('meni-crud__cell--opis');
        }
      }
    }
  }

  function meniAdd(payload, callback) {
    // Pozovi API za upis nove stavke
    postFormData(API_BASE + 'Meni_CRUD_upis.php', payload, callback);
  }

  function meniUpdate(payload, callback) {
    // Pozovi API za izmjenu postojeće stavke
    postFormData(API_BASE + 'Meni_CRUD_izmjena.php', payload, callback);
  }

  function meniDelete(id, callback) {
    // Pozovi API za brisanje stavke
    postFormData(API_BASE + 'Meni_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  function meniAktivnostChange(id, aktivnoVal, callback) {
    // Pozovi API za promjenu aktivnosti stavke
    postFormData(API_BASE + 'Meni_CRUD_Aktivnost_Change.php', { id: String(id), aktivno: String(aktivnoVal) }, callback);
  }

  function meniTestChange(id, testVal, callback) {
    // Pozovi API za promjenu test flag-a stavke
    postFormData(API_BASE + 'Meni_CRUD_Test_Change.php', { id: String(id), test: String(testVal) }, callback);
  }

  /* --- Auto-referenca iz HTML fajla ---
     Iz vrijednosti HTML fajla izvlači naziv bez putanje i .html; applyAutoRefFromHtml na input/change; lastAutoRef za neprepisivanje ručnog unosa. */
  function autoRefFromHtmlValue(v) {
    var s = String(v || '').trim(); // Konvertiraj u string i trim
    if (!s) return ''; // Ako je prazan, vrati prazan string
    s = s.split(/[\\/]/).pop(); // Uzmi zadnji dio putanje (ime datoteke)
    var lastDot = s.lastIndexOf('.'); // Pronađi zadnju točku
    if (lastDot > 0) s = s.slice(0, lastDot); // Ukloni ekstenziju
    s = s.trim().toLowerCase(); // Trim i pretvori u lowercase
    return s;
  }

  function applyAutoRefFromHtml() {
    var editHtmlFajl = document.getElementById('edit_html_fajl'); // Dohvati input HTML fajl
    var editRef = document.getElementById('edit_ref'); // Dohvati input Referenca
    if (!editHtmlFajl || !editRef) return; // Ako ne postoje, izađi
    var nextAuto = autoRefFromHtmlValue(editHtmlFajl.value); // Generiraj auto-referencu
    var curRef = String(editRef.value || '').trim(); // Dohvati trenutnu referencu
    // Može prepisati samo ako je prazna ili ako je jednaka prethodnoj auto-referenci
    var canOverwrite = (curRef === '') || (lastAutoRef !== null && curRef === lastAutoRef);
    if (!canOverwrite) return; // Ako ne može prepisati, izađi
    editRef.value = nextAuto; // Postavi auto-referencu
    lastAutoRef = nextAuto; // Spremi kao lastAutoRef
  }

  (function () {
    var editHtmlFajl = document.getElementById('edit_html_fajl'); // Dohvati input HTML fajl
    var editRef = document.getElementById('edit_ref'); // Dohvati input Referenca
    // Slušaj promjene HTML fajla i automatski popuni referencu
    if (editHtmlFajl) {
      editHtmlFajl.addEventListener('input', applyAutoRefFromHtml); // Na input
      editHtmlFajl.addEventListener('change', applyAutoRefFromHtml); // Na change
    }
    // Slušaj promjene reference - ako korisnik ručno mijenja, resetiraj lastAutoRef
    if (editRef) {
      editRef.addEventListener('input', function () {
        var cur = String(editRef.value || '').trim(); // Dohvati trenutnu vrijednost
        // Ako korisnik ručno mijenja referencu (različita od lastAutoRef), resetiraj lastAutoRef
        if (cur !== '' && lastAutoRef !== null && cur !== lastAutoRef) {
          lastAutoRef = null;
        }
      });
    }
  })();

  /* --- Slijed (redoslijed) 1–100 ---
     CommonNumericValidation(edit_redoslijed, 1, 100, true). */
  (function () {
    var editRedoslijed = document.getElementById('edit_redoslijed'); // Dohvati input Slijed
    if (!editRedoslijed) return; // Ako ne postoji, izađi
    // Ako postoji CommonNumericValidation funkcija, primijeni validaciju (min: 1, max: 100, allowEmpty: true)
    if (typeof CommonNumericValidation === 'function') {
      CommonNumericValidation(editRedoslijed, 1, 100, true);
    }
  })();

  /* --- Trim sadržaja edit kontrola na blur --- */
  (function () {
    var ids = ['edit_naziv', 'edit_opis', 'edit_html_fajl', 'edit_ref', 'edit_putanja', 'edit_redoslijed', 'edit_napomena']; // Lista ID-ova kontrola
    ids.forEach(function (id) {
      var el = document.getElementById(id); // Dohvati element
      if (!el) return; // Ako ne postoji, preskoči
      el.addEventListener('blur', function () {
        var v = trim(this.value); // Trim vrijednost
        // Ako se vrijednost promijenila nakon trima, ažuriraj i dispatch input event
        if (this.value !== v) {
          this.value = v;
          this.dispatchEvent(new Event('input', { bubbles: true })); // Dispatch event da se pokrene updateCrudUpisiState
        }
      });
    });
  })();

  /* --- Učitavanje selecta Tip menija ---
     GET Meni_Tip_CRUD_sve.php, punjenje edit_meni_tip_id, KontroleRefreshCustomSelect. */
  function loadTip() {
    var editMeniTipId = document.getElementById('edit_meni_tip_id'); // Dohvati select Tip menija
    if (!editMeniTipId) return; // Ako ne postoji, izađi
    var xhr = new XMLHttpRequest(); // Kreiraj XMLHttpRequest objekt
    xhr.open('GET', API_BASE + 'Meni_Tip_CRUD_sve.php', true); // Otvori GET zahtjev
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return; // Čekaj dok se zahtjev ne završi
      var text = (xhr.responseText || '').trim(); // Dohvati odgovor
      editMeniTipId.innerHTML = '<option value="0">Nije izabran</option>'; // Resetiraj select
      // Ako je odgovor JSON (počinje s '['), parsiraj i popuni select
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]'); // Parsiraj JSON
          // Dodaj svaku stavku kao option
          for (var i = 0; i < arr.length; i++) {
            editMeniTipId.innerHTML += '<option value="' + (arr[i].id != null ? arr[i].id : 0) + '">' + (arr[i].naziv != null ? arr[i].naziv : '') + '</option>';
          }
        } catch (e) {} // Ako parsiranje ne uspije, ignoriraj
      }
      // Refresh custom select nakon punjenja
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('edit_meni_tip_id');
    };
    xhr.send(); // Pošalji zahtjev
  }

  /** Boja --c-blue-600 za opcije Roditelj selecta bez html_fajl (cijeli redak). */
  function primijeniRoditeljOpisBoja() {
    var sel = document.getElementById('edit_roditelj');
    if (!sel) return;
    var wrap = sel.closest('.kontrola-select');
    if (!wrap) return;
    var list = wrap.querySelector('.kontrola-select__list');
    if (!list) return;
    var opts = list.querySelectorAll('.kontrola-select__option');
    opts.forEach(function (el) {
      var val = el.dataset.value;
      if (val === '0') { el.classList.remove('meni-crud__roditelj-opt--no-html'); return; }
      var found = null;
      for (var i = 0; i < data.length; i++) {
        if (String(data[i].id) === String(val)) { found = data[i]; break; }
      }
      var noHtml = found && (!found.html_fajl || String(found.html_fajl).trim() === '');
      if (noHtml) el.classList.add('meni-crud__roditelj-opt--no-html');
      else el.classList.remove('meni-crud__roditelj-opt--no-html');
    });
  }

  /**
   * Punjenje selecta Roditelj stavkama iz kolone Naziv (value = id sloga).
   * Samo aktivne stavke (meni, podmeni, html). Upis: sve aktivne. Izmjena: sve aktivne osim selektiranog reda (excludeId).
   */
  function fillRoditeljSelect(excludeId) {
    var editRoditelj = document.getElementById('edit_roditelj'); // Dohvati select Roditelj
    if (!editRoditelj) return; // Ako ne postoji, izađi
    var exId = excludeId != null ? parseInt(excludeId, 10) : null; // Konvertiraj excludeId u broj
    editRoditelj.innerHTML = '<option value="0">Nije izabran</option>'; // Resetiraj select
    // Filtriraj stavke: samo aktivne (aktivno=1), isključi excludeId ako je postavljen
    var candidates = data.filter(function (x) {
      if (x.aktivno != 1 && x.aktivno !== '1') return false; // Samo aktivne
      if (exId !== null && parseInt(x.id || 0, 10) === exId) return false; // Isključi excludeId
      return true;
    });
    // Sortiraj kandidate po abecednom redu naziva
    candidates.sort(function (a, b) {
      return String(a.naziv || '').localeCompare(String(b.naziv || ''), 'hr');
    });
    // Dodaj svakog kandidata kao option: naziv + ", " + html_fajl ako postoji, inače opis
    candidates.forEach(function (x) {
      var naziv = x.naziv != null ? x.naziv : '';
      var suf = (x.html_fajl != null && String(x.html_fajl).trim() !== '')
        ? String(x.html_fajl).trim()
        : (x.opis != null ? String(x.opis).trim() : '');
      var label = suf !== '' ? naziv + ', ' + suf : naziv;
      var opt = document.createElement('option');
      opt.value = x.id != null ? x.id : 0;
      opt.textContent = label;
      editRoditelj.appendChild(opt);
    });
  }

  /* --- Change na Tip menija --- */
  (function () {
    var editMeniTipId = document.getElementById('edit_meni_tip_id'); // Dohvati select Tip menija
    if (!editMeniTipId) return; // Ako ne postoji, izađi
    editMeniTipId.addEventListener('change', function () {
      fillRoditeljSelect(getSelectedRowId()); // Popuni roditelj select (isključi trenutni red)
      var editRoditelj = document.getElementById('edit_roditelj'); // Dohvati select Roditelj
      if (editRoditelj) editRoditelj.value = '0'; // Resetiraj na "Nije izabran"
    });
  })();

  /* --- Inline toggle Aktivno/Test u tablici ---
     change na checkboxu u tablici: colIdx 3 → meniAktivnostChange, colIdx 4 → meniTestChange; na grešku revert checkboxa i modal. */
  (function () {
    var container = document.getElementById('tablicaContainer'); // Dohvati container tablice
    if (!container) return; // Ako ne postoji, izađi
    container.addEventListener('change', function (e) {
      var chk = e.target && e.target.type === 'checkbox' ? e.target : null; // Provjeri je li checkbox
      if (!chk || !container.contains(chk)) return; // Ako nije checkbox ili nije u containeru, izađi
      var tr = chk.closest('tr'); // Pronađi redak
      if (!tr || !tr.dataset.rowId) return; // Ako nema redak ili rowId, izađi
      var rowId = tr.dataset.rowId; // Dohvati ID reda
      var colIdx = -1; // Indeks kolone
      var td = chk.closest('td'); // Pronađi ćeliju
      // Ako postoji ćelija i pripada redu, izračunaj indeks kolone
      if (td && td.parentElement === tr) {
        var tds = Array.prototype.slice.call(tr.querySelectorAll('td')); // Dohvati sve ćelije
        colIdx = tds.indexOf(td); // Pronađi indeks trenutne ćelije
      }
      // Ako je kolona 3 (Aktivno)
      if (colIdx === 3) {
        var aktivnoVal = chk.checked ? 1 : 0; // Konvertiraj checked u 1 ili 0
        meniAktivnostChange(rowId, aktivnoVal, function (res) {
          if (res === 'OK') osvjeziTablicu(); // Na uspjeh osvježi tablicu
          else {
            chk.checked = !chk.checked; // Na grešku revert checkboxa
            var p = parseResponseCode(res); // Parsiraj grešku
            // Ako postoji kod greške i modal sistem, prikaži modal
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      } else if (colIdx === 4) {
        // Ako je kolona 4 (Test)
        var testVal = chk.checked ? 1 : 0; // Konvertiraj checked u 1 ili 0
        meniTestChange(rowId, testVal, function (res) {
          if (res === 'OK') osvjeziTablicu(); // Na uspjeh osvježi tablicu
          else {
            chk.checked = !chk.checked; // Na grešku revert checkboxa
            var p = parseResponseCode(res); // Parsiraj grešku
            // Ako postoji kod greške i modal sistem, prikaži modal
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      }
    });
  })();

  /* --- Početno učitavanje i izvoz ---
     ucitajPodatkeTablica, loadTip, updateCrudUpisiState, window.MeniCRUD. */
  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
    primijeniOpisBoja();
    fillRoditeljSelect(getSelectedRowId());
    if (typeof KontroleRefreshCustomSelect === 'function') {
      KontroleRefreshCustomSelect('edit_roditelj');
      primijeniRoditeljOpisBoja();
    }
  }); // Učitaj podatke i postavi u tablicu
  loadTip(); // Učitaj Tip menija select

  function getSelectedRowId() {
    // Dohvati ID selektiranog reda iz tablice koristeći CommonCRUD
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    // Trim string - koristi CommonTrim ako postoji, inače ručno trim
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  // Postavi početno stanje kontrola na edit panelu (disable sve osim edit-delete)
  updateCrudUpisiState();
  window.MeniCRUD = MeniCRUD; // Izvezi MeniCRUD objekt za debug

  /* =========================================================
     Blok: Razno
     Validacije, filteri unosa, pomoćne funkcije.
     ========================================================= */

  /* --- Pomoć: labela za kontrolu (za modal #1) --- */
  function getLabelForControl(controlId) {
    var lbl = document.querySelector('.kontrola-labela[for="' + controlId + '"]'); // Pronađi labelu za kontrolu
    return lbl ? (lbl.textContent || '').trim() : controlId; // Vrati tekst labele ili controlId ako ne postoji
  }

  /* --- Naziv: dozvoljeni znakovi slova, brojeve, razmak, - i _ --- */
  (function () {
    var editNaziv = document.getElementById('edit_naziv'); // Dohvati input Naziv
    if (!editNaziv) return; // Ako ne postoji, izađi
    editNaziv.addEventListener('input', function () {
      // Ukloni sve znakove osim slova (Unicode), brojeva, razmaka, - i _
      this.value = this.value.replace(/[^\p{L}0-9\s\-_]/gu, '');
    });
  })();

  /* --- HTML fajl: dozvoljeni znakovi za ime datoteke (slova, brojke, . - _ / \) --- */
  var htmlFajlAllowedRe = /[^a-zA-Z0-9._\/\\\-]/g; // Regex za dozvoljene znakove
  (function () {
    var editHtmlFajl = document.getElementById('edit_html_fajl'); // Dohvati input HTML fajl
    if (!editHtmlFajl) return; // Ako ne postoji, izađi
    editHtmlFajl.addEventListener('input', function () {
      // Ukloni sve znakove osim slova, brojeva, ., -, _, /, \
      this.value = this.value.replace(htmlFajlAllowedRe, '');
    });
  })();

  /* --- Referenca: samo ASCII slova i - _ --- */
  var refAllowedRe = /[^a-zA-Z\-_]/g; // Regex za dozvoljene znakove
  (function () {
    var editRef = document.getElementById('edit_ref'); // Dohvati input Referenca
    if (!editRef) return; // Ako ne postoji, izađi
    editRef.addEventListener('input', function () {
      // Ukloni sve znakove osim ASCII slova, - i _
      this.value = this.value.replace(refAllowedRe, '');
    });
  })();

  /* --- Putanja: znakovi dozvoljeni u putanji (npr. ../html), može biti prazna --- */
  (function () {
    var editPutanja = document.getElementById('edit_putanja'); // Dohvati input Putanja
    if (!editPutanja) return; // Ako ne postoji, izađi
    editPutanja.addEventListener('input', function () {
      // Ukloni sve znakove osim slova, brojeva, ., -, _, /, \, razmaka
      this.value = this.value.replace(/[^a-zA-Z0-9._\/\\\- \s]/g, '');
    });
  })();

  /** Vraća jedinstvenu referencu: ako postoji duplikat, dodaje "-001", "-002" itd. */
  function ensureUniqueRef(ref, jeIzmjena, currentId) {
    var r = (ref || '').trim();
    if (r === '') return r;
    var rLower = r.toLowerCase();
    var exists = data.some(function (x) {
      var rf = String(x.ref || '').trim();
      return rf !== '' && rf.toLowerCase() === rLower && (jeIzmjena ? String(x.id) !== String(currentId) : true);
    });
    if (!exists) return r;
    var n = 1;
    var candidate;
    do {
      candidate = r + '-' + ('000' + n).slice(-3);
      var cLower = candidate.toLowerCase();
      exists = data.some(function (x) {
        var rf = String(x.ref || '').trim();
        return rf !== '' && rf.toLowerCase() === cLower && (jeIzmjena ? String(x.id) !== String(currentId) : true);
      });
      n++;
    } while (exists);
    return candidate;
  }

  /* --- Validacija forme prije Upis/Izmjeni ---
     Naziv obavezan. Duplikat dozvoljen samo kad oba (naziv i html_fajl) istovjetna – nema upisa.
     Ako nema html_fajl, može biti više istovjetnih naziva (podmeni). Datoteka mora završavati s .html ili .php (006); ako html_fajl onda ref obavezan (005). */
  function validacijaMeniForme(jeIzmjena, currentId) {
    // Dohvati DOM elemente i vrijednosti
    var editNaziv = document.getElementById('edit_naziv');
    var editHtmlFajl = document.getElementById('edit_html_fajl');
    var editRef = document.getElementById('edit_ref');
    var naziv = editNaziv ? trim(editNaziv.value) : '';
    var htmlFajl = editHtmlFajl ? trim(editHtmlFajl.value) : '';
    var ref = editRef ? trim(editRef.value) : '';

    // Provjeri je li naziv prazan
    if (naziv === '') return { ok: false, code: null };

    // Ako je HTML fajl upisan: provjeri duplikat para (naziv, html_fajl) – oba istovjetna = nema upisa
    if (htmlFajl !== '') {
      // Provjeri završava li s .html ili .php (ulaz u aplikaciju npr. index.php)
      if (!/\.(html|php)$/i.test(htmlFajl)) {
        return { ok: false, code: '006', replacements: [] };
      }
      var nazivLower = naziv.toLowerCase();
      var htmlFajlLower = htmlFajl.toLowerCase();
      var existsPair = data.some(function (r) {
        var rn = String(r.naziv || '').trim().toLowerCase();
        var rh = String(r.html_fajl || '').trim();
        return rh !== '' && rn === nazivLower && rh.toLowerCase() === htmlFajlLower && (jeIzmjena ? String(r.id) !== String(currentId) : true);
      });
      if (existsPair) {
        return { ok: false, code: '002', replacements: [getLabelForControl('edit_naziv') + ' / ' + getLabelForControl('edit_html_fajl')] };
      }
    }

    // Ako je referenca upisana, duplikat se automatski razlikuje s "-001", "-002" itd.

    // Ako je HTML fajl upisan, referenca mora biti upisana
    if (htmlFajl !== '' && ref === '') {
      return { ok: false, code: '005', replacements: [] };
    }

    return { ok: true }; // Sve validacije prošle
  }
})();
