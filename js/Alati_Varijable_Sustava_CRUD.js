/* =========================================================
   Alati_Varijable_Sustava_CRUD.js
   Tablica sustav_varijable: Varijabla (id, centrirano), Vrijednost (stupac varijabla), Naziv, Opis.
   Edit panel: Varijabla = edit-delete → stupac id (ključ / gate), unos samo znamenki, max 5 znamenki (readOnly prikaz retka bez ograničenja duljine); Vrijednost = običan edit → stupac varijabla; Naziv; Opis.
   primijeniEditPanelGate: Vrijednost / Naziv / Opis disabled dok Varijabla (ID) nema teksta; pri izmjeni ID je readOnly (PK).
   Upis/Izmjeni (updateCrudUpisiState): ista logika kao Drzave_CRUD – gumb omogućen kad edit-delete (Varijabla) ima ne-prazan sadržaj; validacija svih obaveznih polja ostaje u handleru klika.
   Ne pozivati KontroleSetEnabled na cijeli #edit_panel – ugasio bi i .kontrola-edit-delete.
   Koristi CommonCRUD, 0-Kontrole, 0-Common, 0-Poruke_Tekstovi.
   API: Alati_Varijable_Sustava_CRUD_sve.php, _upis.php, _izmjena.php, _brisanje.php.
   Klijentska validacija: pri upisu isti PK (polje Varijabla = id u bazi) ne smije postojati u dataIzvor (002). Stupac varijabla (Vrijednost) — bez klijentskog duplikata; PHP upis/izmjena ne provjeravaju jedinstvenost teksta stupca varijabla.
   Režim Razvoj: vidi/koristi samo korisnik čiji je id_korisnik u retku sustav_varijable.id=1002 (stupac varijabla). GET/POST razvoj=1 samo dok je kliznik uključen u ovoj sesiji stranice; pri svakom učitavanju stranice kliznik je isključen (bez sessionStorage / trajnog pamćenja).
   ========================================================= */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') {
    vnlhUcitajPravaCrud('Alati_Varijable_Sustava_CRUD.html');
  }

  // ========== KONSTANTE ==========
  // Tablica_Zaglavlje – dokumentacija parametara kolone: vidi Obredi_CRUD.js / pravila projekta.
  //
  // Red tablice za setData: [ id_prikaz, vrijednost, naziv, opis, id_kljuc ]; id_kljuc = zadnji element (getRowId).
  //
  // 1) key – jedinstveni ključ kolone.
  // 2) title – tekst u THEAD (usklađen s labelama u edit panelu).
  // 3) SQL_Naziv – logički naziv u dokumentaciji reda.
  // 4) sortable – 1 = sortiranje klikom na zaglavlje.
  // 5) sortable_icon – 0 = bez ikone sorta.
  // 6) type – "n" za ID (brojčano sortiranje), "t" za tekst.
  // 7) width – negativno = postotak; 0 = auto.
  // 8) suffix – prazan.
  // 9) align / 10) row_align – L | C | R (zaglavlje / ćelija).
  // 11) mobitel_prikaz – 1 = vidljivo na uskom ekranu.
  // =============================================================================
  const VarijableSustavaCRUD = {
    Broj_Kolona: 4,
    Reload_Ikona: 0,
    CrudCssPrefix: 'alati-var-sust-crud',
    Tablica_Zaglavlje: [
      {
        key: 'id_sloga',
        title: 'Varijabla',
        SQL_Naziv: 'id',
        sortable: 1,
        sortable_icon: 0,
        type: 'n',
        width: -12,
        suffix: '',
        align: 'C',
        row_align: 'C',
        mobitel_prikaz: 1
      },
      {
        key: 'vrijednost',
        title: 'Vrijednost',
        SQL_Naziv: 'varijabla',
        sortable: 1,
        sortable_icon: 0,
        type: 't',
        width: -22,
        suffix: '',
        align: 'L',
        row_align: 'L',
        mobitel_prikaz: 1
      },
      {
        key: 'naziv',
        title: 'Naziv',
        SQL_Naziv: 'naziv',
        sortable: 1,
        sortable_icon: 0,
        type: 't',
        width: -28,
        suffix: '',
        align: 'L',
        row_align: 'L',
        mobitel_prikaz: 1
      },
      {
        key: 'opis',
        title: 'Opis',
        SQL_Naziv: 'opis',
        sortable: 1,
        sortable_icon: 0,
        type: 't',
        width: 0,
        suffix: '',
        align: 'L',
        row_align: 'L',
        mobitel_prikaz: 0
      }
    ]
  };

  var tablicaApi = null;
  /** Izvorni zapisi iz baze (id, varijabla, naziv, opis) – filtrirano prema režimu Razvoj. */
  var dataIzvor = [];
  /** Server: korisnik smije vidjeti toggle (lista u retku id 1002). */
  var mozeRazvojToggle = false;
  /** Korisnik je uključio Razvoj (sve varijable) — samo u memoriji dok je ova stranica otvorena; nakon ponovnog učitavanja uvijek false. */
  var razvojUkljucen = false;
  /** Najveći id u „ograničenom“ načinu (bez uključenog Razvoja). */
  var RAZVOJ_MAX_ID = 999;

  function razvojEfektivnoUkljucen() {
    return mozeRazvojToggle === true && razvojUkljucen === true;
  }

  /** Ograničen prikaz i unos na id 0–999 (toggle Razvoj isključen ili korisnik nije admin). */
  function ogranicenBrojDo999() {
    return !razvojEfektivnoUkljucen();
  }

  /** GET parametar razvoj: isključivo trenutačno stanje kliznika (ne čita sessionStorage). */
  function razvojZahtjevZaGet() {
    return razvojUkljucen ? '1' : '0';
  }

  /** Max znamenaka u edit-delete za novi unos id-a (ne readOnly): 3 ili 5. */
  function maxZnamenkiZaNoviUnosId() {
    return ogranicenBrojDo999() ? 3 : 5;
  }

  /**
   * Predloženi sljedeći slobodni id za praznjenje modala.
   * U ograničenom načinu: prvi slobodan 1..RAZVOJ_MAX_ID iz trenutnog dataIzvor; inače MAX(id)+1 nad cijelim učitanim skupom.
   */
  function izracunajSljedeciIdZaUpis() {
    if (ogranicenBrojDo999()) {
      var used = {};
      var i;
      for (i = 0; i < dataIzvor.length; i++) {
        var k = parseInt(String(dataIzvor[i].id), 10);
        if (!isNaN(k) && k >= 0 && k <= RAZVOJ_MAX_ID) {
          used[k] = true;
        }
      }
      var j;
      for (j = 1; j <= RAZVOJ_MAX_ID; j++) {
        if (!used[j]) {
          return j;
        }
      }
      return RAZVOJ_MAX_ID;
    }
    var m = 0;
    for (i = 0; i < dataIzvor.length; i++) {
      var n = parseInt(String(dataIzvor[i].id), 10);
      if (!isNaN(n) && n > m) {
        m = n;
      }
    }
    return m + 1;
  }

  /**
   * Konflikt PK-a: polje „Varijabla” u UI-ju = stupac **id** u bazi. Ako taj broj već postoji u dataIzvor → modal 002 pri upisu.
   * Polje „Vrijednost” = stupac **varijabla** u bazi — ovdje se ne provjerava duplikat.
   *
   * @param {string} brojTekst – sadržaj polja Varijabla (PK kao tekst)
   * @returns {boolean} true ako PK već postoji u učitanom skupu
   */
  function postojiKonfliktPkVarijablaNaDrugomSlogu(brojTekst) {
    var u = trim(brojTekst);
    if (u === '') return false;
    var n = parseInt(u, 10);
    if (isNaN(n)) return false;
    for (var i = 0; i < dataIzvor.length; i++) {
      var rid = parseInt(String(dataIzvor[i].id), 10);
      if (!isNaN(rid) && rid === n) return true;
    }
    return false;
  }

  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', VarijableSustavaCRUD, {
    onReady: function (api) {
      tablicaApi = api;
    },
    onSelectionChange: function () {
      if (onCrudSelectionChange) onCrudSelectionChange();
    },
    getRowId: function (row) {
      return row && row.length > 0 ? row[row.length - 1] : null;
    }
  });

  /**
   * Pri odabranom retku: RO (novi mehanizam — plavi izgled, polje inertno) + skini maxlength
   * (PK iz baze može biti dugačak). Bez retka: enable + maxlength 3 (ograničeni način) ili 5 (Razvoj).
   * „×" NAMJERNO ostaje aktivan i u RO (X aktivan scenarij): klik briše polje i poništava selekciju
   * retka (odustani od izmjene / novi upis). KontroleSetControlReadonly postavlja native `readOnly`
   * na inputu, pa ostala logika (maxlength, input filtar) i dalje radi.
   */
  function primijeniRezimInputIdVarijabla(imaSelekcijuRetka) {
    var g = document.getElementById('edit_varijabla');
    if (!g) return;
    var ro = !!imaSelekcijuRetka;
    if (typeof KontroleSetControlReadonly === 'function') {
      KontroleSetControlReadonly(g, ro);
    } else {
      g.readOnly = ro;
    }
    if (ro) {
      g.removeAttribute('maxlength');
    } else {
      g.setAttribute('maxlength', String(maxZnamenkiZaNoviUnosId()));
    }
  }

  /**
   * Prazni polja forme; opcionalno upiše predloženi sljedeći id u Varijabla polje.
   * @param {boolean} [bezPredloskaId=false] – true: prazan id (nema odabranog retka, X, osvježavanje tablice).
   *   false / izostavljeno: nakon uspješnog CRUD modala – predloženi MAX(id)+1 za sljedeći upis.
   */
  function clearControlsFromSelection(bezPredloskaId) {
    var gateVar = document.getElementById('edit_varijabla');
    var vr = document.getElementById('edit_vrijednost');
    var nv = document.getElementById('edit_naziv');
    var op = document.getElementById('edit_opis');
    primijeniRezimInputIdVarijabla(false);
    if (gateVar) {
      if (bezPredloskaId === true) {
        gateVar.value = '';
      } else {
        var next = String(izracunajSljedeciIdZaUpis());
        gateVar.value = next;
        var maxZ = maxZnamenkiZaNoviUnosId();
        if (next.length > maxZ) {
          gateVar.removeAttribute('maxlength');
        } else {
          gateVar.setAttribute('maxlength', String(maxZ));
        }
      }
      gateVar.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (vr) {
      vr.value = '';
      vr.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (nv) {
      nv.value = '';
      nv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (op) {
      op.value = '';
      op.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      // Bez odabranog retka: nikad automatski MAX(id)+1 (X, klik izvan retka, osvježavanje tablice ne smiju „same“ vratiti 1003).
      clearControlsFromSelection(true);
    } else {
      primijeniRezimInputIdVarijabla(true);
      var found = null;
      for (var i = 0; i < dataIzvor.length; i++) {
        if (String(dataIzvor[i].id) === String(id)) {
          found = dataIzvor[i];
          break;
        }
      }
      var gateVar = document.getElementById('edit_varijabla');
      var nv = document.getElementById('edit_naziv');
      var op = document.getElementById('edit_opis');
      var vr = document.getElementById('edit_vrijednost');
      if (found) {
        if (gateVar) {
          gateVar.value = found.id != null ? String(found.id) : '';
          gateVar.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (vr) {
          vr.value = found.varijabla != null ? String(found.varijabla) : '';
          vr.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (nv) {
          nv.value = found.naziv != null ? String(found.naziv) : '';
          nv.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (op) {
          op.value = found.opis != null ? String(found.opis) : '';
          op.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
    updateCrudUpisiState();
  };

  /**
   * Omogućuje / onemogućuje Vrijednost, Naziv i Opis ovisno o tome ima li u edit-delete upisan ID (Varijabla = stupac id).
   * Polje u edit-delete ostaje omogućeno; readOnly / maxlength za id: primijeniRezimInputIdVarijabla (updateCrudUpisiState + onCrud).
   */
  function primijeniEditPanelGate() {
    var gateVar = document.getElementById('edit_varijabla');
    var gate = gateVar && trim(gateVar.value) !== '';
    var vr = document.getElementById('edit_vrijednost');
    var nv = document.getElementById('edit_naziv');
    var op = document.getElementById('edit_opis');
    if (vr) {
      vr.disabled = !gate;
    }
    if (nv) {
      nv.disabled = !gate;
    }
    if (op) {
      op.disabled = !gate;
    }
    if (gateVar) {
      gateVar.disabled = false;
      var wrapV = gateVar.closest('.kontrola-edit-delete');
      if (wrapV) {
        wrapV.classList.remove('kontrola-edit-delete--disabled');
        var clearV = wrapV.querySelector('.kontrola-edit-delete__clear');
        if (clearV) {
          clearV.disabled = false;
          clearV.removeAttribute('disabled');
        }
      }
    }
    var panel = document.getElementById('edit_panel');
    if (panel && typeof KontroleSyncLabelsDisabledState === 'function') {
      KontroleSyncLabelsDisabledState(panel);
    }
  }

  /**
   * X na Varijabla (edit-delete): 0-Kontrole.js već briše input; ukloni selekciju tablice.
   * Ako tablica ne javi promjenu selekcije, ručno očisti ostala polja (isti kao onCrud bez retka).
   */
  (function () {
    var el = document.getElementById('edit_varijabla');
    var wrap = el && el.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') {
        tablicaApi.clearSelection();
      }
      if (getSelectedRowId() == null) {
        clearControlsFromSelection(true);
      }
      updateCrudUpisiState();
    });
  })();

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    primijeniEditPanelGate();
    var imaSelekciju = getSelectedRowId() != null;
    primijeniRezimInputIdVarijabla(imaSelekciju);
    var gateVar = document.getElementById('edit_varijabla');
    // Drzave_CRUD.js: imaSadrzaj = trim(edit_naziv) !== ''; ovdje je jedina edit-delete kontrola Varijabla (id).
    var imaSadrzaj = gateVar ? trim(gateVar.value) !== '' : false;

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) {
      btnIzbrisi.disabled = !imaSelekciju;
    }
    primijeniMaxDuljinuIdPolja();
  }

  /** Nakon promjene režima Razvoj: skrati ručno upisani id na dopušteni broj znamenki. */
  function primijeniMaxDuljinuIdPolja() {
    var g = document.getElementById('edit_varijabla');
    if (!g || g.readOnly) {
      return;
    }
    var lim = maxZnamenkiZaNoviUnosId();
    var t = String(g.value || '')
      .replace(/\D/g, '')
      .slice(0, lim);
    if (g.value !== t) {
      g.value = t;
      g.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /** Varijabla (id): samo znamenke; max duljina ovisi o režimu Razvoj (3 ili 5) kad nije readOnly. */
  (function () {
    var el = document.getElementById('edit_varijabla');
    if (!el) return;
    el.addEventListener('input', function () {
      if (!el.readOnly) {
        var lim = maxZnamenkiZaNoviUnosId();
        var cleaned = String(el.value || '').replace(/\D/g, '').slice(0, lim);
        if (el.value !== cleaned) {
          el.value = cleaned;
        }
      }
      updateCrudUpisiState();
    });
    el.addEventListener('change', updateCrudUpisiState);
  })();

  (function () {
    ['edit_vrijednost', 'edit_naziv', 'edit_opis'].forEach(function (id) {
      var el2 = document.getElementById(id);
      if (!el2) return;
      el2.addEventListener('input', updateCrudUpisiState);
      el2.addEventListener('change', updateCrudUpisiState);
    });
  })();

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var gateVar = document.getElementById('edit_varijabla');
      var vr = document.getElementById('edit_vrijednost');
      var nv = document.getElementById('edit_naziv');
      var op = document.getElementById('edit_opis');
      var idTekst = gateVar ? trim(gateVar.value) : '';
      var varijabla = vr ? trim(vr.value) : '';
      var naziv = nv ? trim(nv.value) : '';
      var opis = op ? trim(op.value) : '';
      if (idTekst === '' || varijabla === '' || naziv === '') return;

      /* Način rada: selekcija retka u tablici (ne samo CSS klasa gumba — izbjegava Upis s postojećim PK i lažni 002). */
      var idSelekcija = getSelectedRowId();
      var jeIzmjena = idSelekcija != null;
      if (jeIzmjena) {
        varijableUpdate(idSelekcija, varijabla, naziv, opis, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('004', [], function () {
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') {
                  tablicaApi.clearSelection();
                }
                clearControlsFromSelection();
                osvjeziTablicu();
              });
            }
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(p.code, p.replacements);
            }
          }
        });
      } else {
        if (ogranicenBrojDo999()) {
          var nidUp = parseInt(idTekst, 10);
          if (isNaN(nidUp) || nidUp < 0 || nidUp > RAZVOJ_MAX_ID) {
            if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['014']) {
              window.showPorukaModal('014', ['0', String(RAZVOJ_MAX_ID)]);
            }
            return;
          }
        }
        if (postojiKonfliktPkVarijablaNaDrugomSlogu(idTekst)) {
          if (typeof window.showPorukaModal === 'function' && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['002']) {
            window.showPorukaModal('002', ['Varijabla']);
          }
          return;
        }
        varijableAdd(idTekst, varijabla, naziv, opis, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal('001', [], function () {
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') {
                  tablicaApi.clearSelection();
                }
                clearControlsFromSelection();
                osvjeziTablicu();
              });
            }
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(p.code, p.replacements);
            }
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      varijableDelete(id, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') {
                tablicaApi.clearSelection();
              }
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          }
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements);
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
          if (u.origin === window.location.origin) {
            window.location.href = u.href;
            return;
          }
        } catch (e) {}
      }
      if (document.referrer) {
        try {
          var u2 = new URL(document.referrer);
          if (u2.origin === window.location.origin) {
            window.location.href = u2.href;
            return;
          }
        } catch (e2) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  var API_BASE = '../php/';

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    var q = razvojZahtjevZaGet();
    xhr.open('GET', API_BASE + 'Alati_Varijable_Sustava_CRUD_sve.php?razvoj=' + encodeURIComponent(q), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      dataIzvor = [];
      if (text !== '' && text.charAt(0) !== '[' && text.charAt(0) !== '{') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      } else {
        try {
          var raw = JSON.parse(text || '[]');
          var arr;
          if (Array.isArray(raw)) {
            arr = raw;
            mozeRazvojToggle = false;
          } else if (raw && Array.isArray(raw.rows)) {
            arr = raw.rows;
            mozeRazvojToggle = !!raw.mozeRazvojToggle;
          } else {
            arr = [];
            mozeRazvojToggle = false;
          }
          if (!mozeRazvojToggle) {
            razvojUkljucen = false;
          }
          var wrapTr = document.getElementById('wrapToggleRazvoj');
          var tgl = document.getElementById('toggleRazvoj');
          if (wrapTr) {
            wrapTr.hidden = !mozeRazvojToggle;
          }
          if (tgl && mozeRazvojToggle) {
            tgl.checked = razvojUkljucen;
          }
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            var rid = r.id != null ? r.id : 0;
            dataIzvor.push({
              id: rid,
              varijabla: r.varijabla != null ? r.varijabla : '',
              naziv: r.naziv != null ? r.naziv : '',
              opis: r.opis != null ? r.opis : ''
            });
            rows.push([
              String(rid),
              r.varijabla != null ? String(r.varijabla) : '',
              r.naziv != null ? String(r.naziv) : '',
              r.opis != null ? String(r.opis) : '',
              rid
            ]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
      updateCrudUpisiState();
    });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, VarijableSustavaCRUD.Tablica_Zaglavlje);
  }

  function varijableAdd(id, varijabla, naziv, opis, callback) {
    var body = {
      id: String(id),
      varijabla: varijabla,
      naziv: naziv,
      opis: opis,
      razvoj: razvojEfektivnoUkljucen() ? '1' : '0'
    };
    postFormData(API_BASE + 'Alati_Varijable_Sustava_CRUD_upis.php', body, callback);
  }

  function varijableUpdate(id, varijabla, naziv, opis, callback) {
    postFormData(API_BASE + 'Alati_Varijable_Sustava_CRUD_izmjena.php', {
      id: String(id),
      varijabla: varijabla,
      naziv: naziv,
      opis: opis,
      razvoj: razvojEfektivnoUkljucen() ? '1' : '0'
    }, callback);
  }

  function varijableDelete(id, callback) {
    postFormData(API_BASE + 'Alati_Varijable_Sustava_CRUD_brisanje.php', {
      id: String(id),
      razvoj: razvojEfektivnoUkljucen() ? '1' : '0'
    }, callback);
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  (function () {
    var tgl = document.getElementById('toggleRazvoj');
    if (!tgl) return;
    tgl.addEventListener('change', function () {
      if (!mozeRazvojToggle) {
        return;
      }
      razvojUkljucen = !!tgl.checked;
      if (!razvojUkljucen && tablicaApi && typeof getSelectedRowId === 'function') {
        var sid = getSelectedRowId();
        if (sid != null && parseInt(String(sid), 10) > RAZVOJ_MAX_ID) {
          if (typeof tablicaApi.clearSelection === 'function') {
            tablicaApi.clearSelection();
          }
        }
      }
      osvjeziTablicu();
    });
  })();

  ucitajPodatkeTablica(function (rows) {
    setDataTablica(rows);
    updateCrudUpisiState();
  });

  window.VarijableSustavaCRUD = VarijableSustavaCRUD;
})();
