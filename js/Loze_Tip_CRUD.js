/* Loze_Tip_CRUD.js – tablica + jedna kontrola. Tablica: loze_tip. */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Loze_Tip_CRUD.html');

// ========== KONSTANTE ==========
// Loze_TipCRUD – jedinstveni objekt s konfiguracijom forme.
// Prije dodavanja nove konstante treba je iskomentirati (dokumentirati u nastavku reda).
// Sve u jednom objektu da editor ne prijavi "cannot redeclare block-scoped variable".
//
// Veza s tablicom:
// - Tablica ima Broj_Kolona kolona.
// - Reload_Ikona = 1: dodaje se header panelu tablice; u headeru desno ikona za reload; funkcionalnost = ponovno učitavanje podataka iz baze. 0 = nema headera/ikone.
//
// Tablica_Zaglavlje – svaka kolona je objekt sa parametrima:
// 1) key (string) - Jedinstveni ključ kolone.
// 2) title (string) - Tekst u zaglavlju kolone (THEAD).
// 3) SQL_Naziv (string) - Naziv podatka koji vraća PHP. Ako nije upisan = prvi podatak iza id. id = ključ sloga, skriveni podatak u redu tablice.
// 4) sortable (0 | 1) - 1 = kolona se može sortirati klikom na zaglavlje; 0 = nije sortabilna, hover na zaglavlju te kolone ne radi.
// 5) sortable_icon (0 | 1) - 1 = iscrtava se sort ikona u zaglavlju (pravila: align L ili C → ikona uz desni rub ćelije; align R → ikona uz lijevi rub kolone). Default: 0.
// 6) type ("t" | "n" | "d" | "b") - Tip podataka u koloni: "t" = tekst, "n" = broj, "d" = datum, "b" = binarno. Koristi se npr. da se datum sortira kao datum, broj kao broj, ne kao string.
// 7) width (number) - Širina te kolone: 0 = auto; < 0 = abs(width) % ukupne širine tablice (npr. -20 → 20%); > 0 = fiksno u px (npr. 30 → 30px).
// 8) suffix (string) - Dodatak uz prikaz podatka (npr. " €", "%", " kom").
// 9) align ("L" | "C" | "R") - Orijentacija teksta u zaglavlju tablice: L = lijevo, C = centar, R = desno.
// 10) row_align ("L" | "C" | "R") - Orijentacija sadržaja u redovima tablice: L = lijevo, C = centar, R = desno.
// 11) mobitel_prikaz (0–255, default 1) - Prikaz kolone na mobilnim uređajima. 0 = ne prikazuje se, 1 = prikazuje se. Primjenjuje se pri sužavanju (npr. kada kolone grida idu jedna iznad druge).
// 12) cell_readonly (0 | 1) - Za type "b": 1 = checkbox nije klikabilan (samo prikaz). Default: 0.
// =============================================================================
  const Loze_TipCRUD = {
    Broj_Kolona: 4,
    Reload_Ikona: 1,
    CrudCssPrefix: 'loze-tip-crud',
    Tablica_Zaglavlje: [
      { key: "redosljed", title: "Red", SQL_Naziv: "redosljed", sortable: 0, sortable_icon: 0, type: "n", width: -10, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
      { key: "naziv", title: "Tip lože", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: -40, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "nadleznost", title: "Nadležnost", SQL_Naziv: "nadleznost", sortable: 0, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 0 },
      { key: "pregled", title: "Pregled", SQL_Naziv: "pregled", sortable: 0, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 0 },
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', Loze_TipCRUD, {
    getRowId: function (row) { return row && row[4] != null ? row[4] : (row && row.length > 2 ? row[2] : row && row[1]); },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var editStupnjeviNadleznosti = document.getElementById('edit_stupnjevi_nadleznosti');
  var editStupnjeviPregleda = document.getElementById('edit_stupnjevi_pregleda');
  var btnEllipsisNadleznosti = document.getElementById('btn_stupnjevi_nadleznosti');
  var btnEllipsisPregleda = document.getElementById('btn_stupnjevi_pregleda');
  var editRedosljed = document.getElementById('edit_redosljed');
  var selectObred = document.getElementById('select_obred_loze');
  var editPanel = document.getElementById('edit_panel');
  var tablicaEl = document.getElementById('tablicaContainer');

  if (editRedosljed && typeof window.CommonNumericValidation === 'function') {
    window.CommonNumericValidation(editRedosljed, 1, 99, true);
  }

  function updateStupnjeviEditsState() {
    var editEl = document.getElementById('edit_naziv');
    var imaSadrzaj = editEl ? trim(editEl.value) !== '' : false;
    /* Enable kad „Tip lože" ima tekst (vrijedi i za novi upis i za izmjenu); disable kad je prazan. */
    var enabled = imaSadrzaj;
    if (editStupnjeviNadleznosti) editStupnjeviNadleznosti.disabled = !enabled;
    if (editStupnjeviPregleda) editStupnjeviPregleda.disabled = !enabled;
    /* Elipsis (diže modal izbora stupnjeva) prati isto enable/disable kao RO editi. */
    if (btnEllipsisNadleznosti) btnEllipsisNadleznosti.disabled = !enabled;
    if (btnEllipsisPregleda) btnEllipsisPregleda.disabled = !enabled;
    /* Redosljed (i labela) prati edit-delete: kad je naziv enabled, i Redosljed je enabled */
    if (editRedosljed) editRedosljed.disabled = editEl ? editEl.disabled : true;
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
  }

  function clearControlsFromSelection() {
    var editEl = document.getElementById('edit_naziv');
    if (editEl) { editEl.value = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
    if (editStupnjeviNadleznosti) editStupnjeviNadleznosti.value = '';
    if (editStupnjeviPregleda) editStupnjeviPregleda.value = '';
    if (editRedosljed) editRedosljed.value = '';
    noviStupnjeviNadleznost = [];
    noviStupnjeviPregled = [];
    updateStupnjeviEditsState();
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) { clearControlsFromSelection(); }
    else {
      /* Prelazak na izmjenu postojećeg tipa: held (novi-upis) odabir se odbacuje — prikaz ide iz baze. */
      noviStupnjeviNadleznost = [];
      noviStupnjeviPregled = [];
      var editEl = document.getElementById('edit_naziv');
      if (editEl) {
        var data = tablicaApi.getData();
        for (var i = 0; i < data.length; i++) {
          if (data[i][4] == id) {
            editEl.value = data[i][1] != null ? data[i][1] : '';
            if (editRedosljed) {
              var r = data[i][0];
              editRedosljed.value = (r != null && r !== '' && Number(r) > 0) ? String(r) : '';
            }
            break;
          }
        }
        editEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      osvjeziEditStupnjeviNadleznosti(id);
      osvjeziEditStupnjeviPregleda(id);
    }
    updateCrudUpisiState();
    updateStupnjeviEditsState();
  };

  (function () {
    var editEl = document.getElementById('edit_naziv');
    var wrap = editEl && editEl.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      if (editStupnjeviNadleznosti) editStupnjeviNadleznosti.value = '';
      if (editStupnjeviPregleda) editStupnjeviPregleda.value = '';
      if (editRedosljed) editRedosljed.value = '';
      noviStupnjeviNadleznost = [];
      noviStupnjeviPregled = [];
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      updateStupnjeviEditsState();
      updateCrudUpisiState();
    });
  })();

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var editEl = document.getElementById('edit_naziv');
    var imaSadrzaj = editEl ? trim(editEl.value) !== '' : false;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    updateStupnjeviEditsState();
  }

  (function () {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl) return;
    editEl.addEventListener('input', updateCrudUpisiState);
    editEl.addEventListener('change', updateCrudUpisiState);
  })();

  /* Modal: Izbor stupnjeva nadležnosti – punjenje preko Stupnjevi_CRUD_sve.php (obred_id = selektirani obred); kolone Stupanj, Naziv; skriveni id. */
  var currentModalIdVlasnik = null;
  /* NOVI upis tipa lože: id_vlasnik još ne postoji, pa se odabir stupnjeva drži klijentski
     ([{id, stupanj}]) dok glavni „Upiši" ne upiše tip i (u istom PHP-u) child enum redove.
     U izmjeni (postojeći tip) ostaje staro ponašanje: modal piše odmah u bazu. */
  var noviStupnjeviNadleznost = [];
  var noviStupnjeviPregled = [];
  var zadnjiStupnjeviModalRows = []; /* [stupanj, naziv, id] redovi trenutno otvorenog modala (za map id→broj). */

  /** Iz odabranih id-eva (modal) + redova modala složi [{id, stupanj}] sortirano po broju stupnja. */
  function stupnjeviHeldIzSelekcije(selectedIds, modalRows) {
    var map = {};
    var i;
    for (i = 0; i < (modalRows || []).length; i++) {
      var r = modalRows[i];
      if (r && r[2] != null) map[String(r[2])] = (r[0] != null ? r[0] : '');
    }
    var out = [];
    for (i = 0; i < (selectedIds || []).length; i++) {
      var idS = String(selectedIds[i]);
      out.push({ id: idS, stupanj: (map[idS] != null ? map[idS] : '') });
    }
    out.sort(function (a, b) { return (parseInt(a.stupanj, 10) || 0) - (parseInt(b.stupanj, 10) || 0); });
    return out;
  }

  /** Prikaz held odabira u RO edit polju (brojevi stupnjeva, npr. „1, 2, 3"). */
  function prikaziHeldStupnjevi(editEl, held) {
    if (!editEl) return;
    editEl.value = (held && held.length)
      ? held.map(function (h) { return h.stupanj != null ? String(h.stupanj) : ''; }).join(', ')
      : '';
  }
  var modalStupnjeviNadleznostiZaglavlje = [
    { key: 'stupanj', title: 'Stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
    { key: 'naziv', title: 'Naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];
  var modalStupnjeviNadleznostiApi = null;

  function ucitajStupnjeviZaModal(obredId, callback) {
    if (!obredId || trim(String(obredId)) === '') { if (callback) callback([]); return; }
    var url = API_BASE + 'Stupnjevi_CRUD_sve.php?obred_id=' + encodeURIComponent(obredId);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            rows.push([
              o.stupanj != null ? o.stupanj : '',
              o.naziv != null ? o.naziv : '',
              o.id != null ? o.id : 0
            ]);
          }
        } catch (e) {}
      } else if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  if (typeof ModalTablicaInit === 'function') {
    modalStupnjeviNadleznostiApi = ModalTablicaInit({
      storageKey: 'loze_tip_stupnjevi_nadleznosti',
      headerText: 'Izbor stupnjeva nadležnosti lože',
      getButtons: function () {
        return [
          {
            label: 'Upisi',
            primary: true,
            className: 'kontrola-btn--crud-upisi',
            onClick: function (tablicaApi) {
              var ids = tablicaApi && typeof tablicaApi.getSelectedRowIds === 'function' ? tablicaApi.getSelectedRowIds() : [];
              var idVlasnik = currentModalIdVlasnik;
              if (idVlasnik == null || idVlasnik <= 0) {
                /* NOVI upis: zapamti odabir klijentski + osvježi prikaz; u bazu ide tek na glavni „Upiši". */
                noviStupnjeviNadleznost = stupnjeviHeldIzSelekcije(ids, zadnjiStupnjeviModalRows);
                prikaziHeldStupnjevi(editStupnjeviNadleznosti, noviStupnjeviNadleznost);
                if (modalStupnjeviNadleznostiApi) modalStupnjeviNadleznostiApi.close();
                return;
              }
              var formData = new FormData();
              formData.append('id_vlasnik', idVlasnik);
              formData.append('id_pozicija', 1);
              for (var i = 0; i < (ids || []).length; i++) formData.append('id_stupanj[]', ids[i]);
              var xhr = new XMLHttpRequest();
              xhr.open('POST', API_BASE + 'Loze_Tip_CRUD_enum_stupnjevi_upis.php', true);
              xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                var res = (xhr.responseText || '').trim();
                if (res === 'OK') {
                  if (modalStupnjeviNadleznostiApi) modalStupnjeviNadleznostiApi.close();
                  if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', []);
                  osvjeziEditStupnjeviNadleznosti(idVlasnik);
                  osvjeziTablicu(idVlasnik);
                } else {
                  var p = parseResponseCode(res);
                  if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
                }
              };
              xhr.send(formData);
            }
          },
          {
            label: 'Izbriši',
            className: 'kontrola-btn--crud-izbrisi',
            onClick: function (tablicaApi) {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              var idVlasnik = currentModalIdVlasnik;
              if (idVlasnik == null || idVlasnik <= 0) {
                /* NOVI upis: očisti held odabir + prikaz; zatvori. */
                noviStupnjeviNadleznost = [];
                prikaziHeldStupnjevi(editStupnjeviNadleznosti, noviStupnjeviNadleznost);
                if (modalStupnjeviNadleznostiApi) modalStupnjeviNadleznostiApi.close();
                return;
              }
              var formData = new FormData();
              formData.append('id_vlasnik', idVlasnik);
              formData.append('id_pozicija', 1);
              var xhr = new XMLHttpRequest();
              xhr.open('POST', API_BASE + 'Loze_Tip_CRUD_enum_stupnjevi_upis.php', true);
              xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                var res = (xhr.responseText || '').trim();
                if (res === 'OK') {
                  if (modalStupnjeviNadleznostiApi) modalStupnjeviNadleznostiApi.close();
                  if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', []);
                  osvjeziEditStupnjeviNadleznosti(idVlasnik);
                  osvjeziTablicu(idVlasnik);
                } else {
                  var p = parseResponseCode(res);
                  if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
                }
              };
              xhr.send(formData);
            }
          },
          { label: 'Povratak', className: 'kontrola-btn--crud-povratak', onClick: function () { if (modalStupnjeviNadleznostiApi) modalStupnjeviNadleznostiApi.close(); } }
        ];
      }
    });
  }

  /* Modal: Izbor stupnjeva pregleda – isto kao nadležnosti, id_pozicija = 2 */
  var currentModalIdVlasnikPregleda = null;
  var modalStupnjeviPregledaZaglavlje = [
    { key: 'stupanj', title: 'Stupanj', sortable: 1, sortable_icon: 0, type: 'n', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
    { key: 'naziv', title: 'Naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];
  var modalStupnjeviPregledaApi = null;

  if (typeof ModalTablicaInit === 'function') {
    modalStupnjeviPregledaApi = ModalTablicaInit({
      storageKey: 'loze_tip_stupnjevi_pregleda',
      headerText: 'Izbor stupnjeva pregleda lože',
      getButtons: function () {
        return [
          {
            label: 'Upisi',
            primary: true,
            className: 'kontrola-btn--crud-upisi',
            onClick: function (tablicaApi) {
              var ids = tablicaApi && typeof tablicaApi.getSelectedRowIds === 'function' ? tablicaApi.getSelectedRowIds() : [];
              var idVlasnik = currentModalIdVlasnikPregleda;
              if (idVlasnik == null || idVlasnik <= 0) {
                /* NOVI upis: zapamti odabir klijentski + osvježi prikaz; u bazu ide tek na glavni „Upiši". */
                noviStupnjeviPregled = stupnjeviHeldIzSelekcije(ids, zadnjiStupnjeviModalRows);
                prikaziHeldStupnjevi(editStupnjeviPregleda, noviStupnjeviPregled);
                if (modalStupnjeviPregledaApi) modalStupnjeviPregledaApi.close();
                return;
              }
              var formData = new FormData();
              formData.append('id_vlasnik', idVlasnik);
              formData.append('id_pozicija', 2);
              for (var i = 0; i < (ids || []).length; i++) formData.append('id_stupanj[]', ids[i]);
              var xhr = new XMLHttpRequest();
              xhr.open('POST', API_BASE + 'Loze_Tip_CRUD_enum_stupnjevi_upis.php', true);
              xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                var res = (xhr.responseText || '').trim();
                if (res === 'OK') {
                  if (modalStupnjeviPregledaApi) modalStupnjeviPregledaApi.close();
                  if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', []);
                  osvjeziEditStupnjeviPregleda(idVlasnik);
                  osvjeziTablicu(idVlasnik);
                } else {
                  var p = parseResponseCode(res);
                  if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
                }
              };
              xhr.send(formData);
            }
          },
          {
            label: 'Izbriši',
            className: 'kontrola-btn--crud-izbrisi',
            onClick: function (tablicaApi) {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              var idVlasnik = currentModalIdVlasnikPregleda;
              if (idVlasnik == null || idVlasnik <= 0) {
                /* NOVI upis: očisti held odabir + prikaz; zatvori. */
                noviStupnjeviPregled = [];
                prikaziHeldStupnjevi(editStupnjeviPregleda, noviStupnjeviPregled);
                if (modalStupnjeviPregledaApi) modalStupnjeviPregledaApi.close();
                return;
              }
              var formData = new FormData();
              formData.append('id_vlasnik', idVlasnik);
              formData.append('id_pozicija', 2);
              var xhr = new XMLHttpRequest();
              xhr.open('POST', API_BASE + 'Loze_Tip_CRUD_enum_stupnjevi_upis.php', true);
              xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                var res = (xhr.responseText || '').trim();
                if (res === 'OK') {
                  if (modalStupnjeviPregledaApi) modalStupnjeviPregledaApi.close();
                  if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', []);
                  osvjeziEditStupnjeviPregleda(idVlasnik);
                  osvjeziTablicu(idVlasnik);
                } else {
                  var p = parseResponseCode(res);
                  if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
                }
              };
              xhr.send(formData);
            }
          },
          { label: 'Povratak', className: 'kontrola-btn--crud-povratak', onClick: function () { if (modalStupnjeviPregledaApi) modalStupnjeviPregledaApi.close(); } }
        ];
      }
    });
  }

  /* Modal izbora stupnjeva za pregled — diže ga elipsis (dvoklik na RO edit ne radi jer je RO inertan).
     Postojeći tip (red odabran): pred-odabir iz baze. Novi upis (nema reda): pred-odabir iz held niza. */
  function otvoriModalStupnjeviPregleda() {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl || trim(editEl.value) === '') return;
    var idRetka = getSelectedRowId();
    var obredId = selectObred ? trim(selectObred.value) : '';
    ucitajStupnjeviZaModal(obredId, function (rows) {
      zadnjiStupnjeviModalRows = rows;
      function _open(selectedIds) {
        if (modalStupnjeviPregledaApi) {
          modalStupnjeviPregledaApi.open({
            zaglavlje: modalStupnjeviPregledaZaglavlje,
            rows: rows,
            multiSelect: true,
            getRowId: function (row) { return row && row[2] != null ? row[2] : null; },
            selectedRowIds: selectedIds
          });
        }
      }
      if (idRetka != null) {
        currentModalIdVlasnikPregleda = idRetka;
        ucitajEnumStupnjeviZaVlasnika(idRetka, 2, function (postavljeniStupnjevi) {
          _open((postavljeniStupnjevi || []).map(function (r) { return r && r.id != null ? String(r.id) : null; }).filter(Boolean));
        });
      } else {
        currentModalIdVlasnikPregleda = null;
        _open(noviStupnjeviPregled.map(function (h) { return String(h.id); }));
      }
    });
  }
  if (btnEllipsisPregleda) btnEllipsisPregleda.addEventListener('click', otvoriModalStupnjeviPregleda);

  /* Modal izbora stupnjeva nadležnosti — diže ga elipsis.
     Postojeći tip (red odabran): pred-odabir iz baze. Novi upis (nema reda): pred-odabir iz held niza. */
  function otvoriModalStupnjeviNadleznosti() {
    var editEl = document.getElementById('edit_naziv');
    if (!editEl || trim(editEl.value) === '') return;
    var idRetka = getSelectedRowId();
    var obredId = selectObred ? trim(selectObred.value) : '';
    ucitajStupnjeviZaModal(obredId, function (rows) {
      zadnjiStupnjeviModalRows = rows;
      function _open(selectedIds) {
        if (modalStupnjeviNadleznostiApi) {
          modalStupnjeviNadleznostiApi.open({
            zaglavlje: modalStupnjeviNadleznostiZaglavlje,
            rows: rows,
            multiSelect: true,
            getRowId: function (row) { return row && row[2] != null ? row[2] : null; },
            selectedRowIds: selectedIds
          });
        }
      }
      if (idRetka != null) {
        currentModalIdVlasnik = idRetka;
        ucitajStupnjeviNadleznostiZaVlasnika(idRetka, function (postavljeniStupnjevi) {
          _open((postavljeniStupnjevi || []).map(function (r) { return r && r.id != null ? String(r.id) : null; }).filter(Boolean));
        });
      } else {
        currentModalIdVlasnik = null;
        _open(noviStupnjeviNadleznost.map(function (h) { return String(h.id); }));
      }
    });
  }
  if (btnEllipsisNadleznosti) btnEllipsisNadleznosti.addEventListener('click', otvoriModalStupnjeviNadleznosti);

  if (Loze_TipCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editEl = document.getElementById('edit_naziv');
      var naziv = editEl ? trim(editEl.value) : '';
      if (naziv === '') return;
      var redosljedEl = document.getElementById('edit_redosljed');
      var redosljedStr = redosljedEl ? trim(redosljedEl.value) : '';
      var redosljedNum = redosljedStr === '' ? 0 : parseInt(redosljedStr, 10);
      if (redosljedStr !== '' && (isNaN(redosljedNum) || redosljedNum < 1 || redosljedNum > 99)) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['014'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('014', [1, 99]);
        return;
      }
      var redosljed = redosljedStr === '' ? '' : String(redosljedNum);
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        lozeTipUpdate(id, naziv, redosljed, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      } else {
        var obredId = selectObred ? trim(selectObred.value) : '';
        if (!obredId) return;
        lozeTipAdd({
          naziv: naziv,
          id_obred: obredId,
          redosljed: redosljed,
          stupnjevi_nadleznost: noviStupnjeviNadleznost.map(function (h) { return h.id; }).join(','),
          stupnjevi_pregled: noviStupnjeviPregled.map(function (h) { return h.id; }).join(',')
        }, function (res) {
          if (res === 'OK') {
            if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
              clearControlsFromSelection();
              osvjeziTablicu();
            });
          } else {
            var p = parseResponseCode(res);
            if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
          }
        });
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      lozeTipDelete(id, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
            if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
            clearControlsFromSelection();
            osvjeziTablicu();
          });
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements);
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

  var API_BASE = '../php/';

  /** URL za Obredi_CRUD_sve.php – apsolutni put iz trenutne stranice (npr. .../php/Loze_Tip_CRUD.php → .../php/Obredi_CRUD_sve.php). */
  function getObrediSveUrl() {
    var path = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + path + '/php/Obredi_CRUD_sve.php';
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function ucitajEnumStupnjeviZaVlasnika(idVlasnik, idPozicija, callback) {
    if (!idVlasnik || idVlasnik <= 0) { if (callback) callback([]); return; }
    var pos = (idPozicija != null && idPozicija >= 0) ? parseInt(idPozicija, 10) : 1;
    if (isNaN(pos)) pos = 1;
    var url = API_BASE + 'Loze_Tip_CRUD_enum_stupnjevi_sve.php?id_vlasnik=' + encodeURIComponent(idVlasnik) + '&id_pozicija=' + pos;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (xhr.status === 200 && text !== '' && text.charAt(0) === '[') {
        try { rows = JSON.parse(text) || []; } catch (e) {}
      } else if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(parsed.code, parsed.replacements);
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function ucitajStupnjeviNadleznostiZaVlasnika(idVlasnik, callback) {
    ucitajEnumStupnjeviZaVlasnika(idVlasnik, 1, callback);
  }

  function osvjeziEditStupnjeviNadleznosti(idVlasnik) {
    if (!editStupnjeviNadleznosti) return;
    ucitajEnumStupnjeviZaVlasnika(idVlasnik, 1, function (rows) {
      editStupnjeviNadleznosti.value = (rows && rows.length > 0)
        ? rows.map(function (r) { return (r && r.stupanj != null) ? String(r.stupanj) : ''; }).join(', ')
        : '';
      if (editStupnjeviNadleznosti.setSelectionRange) editStupnjeviNadleznosti.setSelectionRange(0, 0);
      editStupnjeviNadleznosti.blur();
    });
  }

  function osvjeziEditStupnjeviPregleda(idVlasnik) {
    if (!editStupnjeviPregleda) return;
    ucitajEnumStupnjeviZaVlasnika(idVlasnik, 2, function (rows) {
      editStupnjeviPregleda.value = (rows && rows.length > 0)
        ? rows.map(function (r) { return (r && r.stupanj != null) ? String(r.stupanj) : ''; }).join(', ')
        : '';
      if (editStupnjeviPregleda.setSelectionRange) editStupnjeviPregleda.setSelectionRange(0, 0);
      editStupnjeviPregleda.blur();
    });
  }

  function ucitajPodatkeTablica(callback) {
    var obredId = selectObred ? trim(selectObred.value) : '';
    if (!obredId) { if (callback) callback([]); return; }
    var url = API_BASE + 'Loze_Tip_CRUD_sve.php?obred_id=' + encodeURIComponent(obredId);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var rows = [];
      if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
      } else {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i].redosljed;
            rows.push([
              (r != null && r !== '' && Number(r) > 0) ? r : '',
              arr[i].naziv != null ? arr[i].naziv : '',
              (arr[i].nadleznost != null && arr[i].nadleznost !== '') ? arr[i].nadleznost : '',
              (arr[i].pregled != null && arr[i].pregled !== '') ? arr[i].pregled : '',
              arr[i].id != null ? arr[i].id : 0
            ]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function ucitajObrede(selectEl, callback) {
    var sel = selectEl || selectObred;
    if (!sel) {
      if (callback) callback();
      return;
    }
    var url = getObrediSveUrl();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (xhr.status !== 200) {
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        var opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'Nije izabran';
        sel.appendChild(opt0);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_obred_loze');
        if (callback) callback();
        return;
      }
      if (text !== '' && text.charAt(0) !== '[') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements);
        }
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        var optEmpty = document.createElement('option');
        optEmpty.value = '';
        optEmpty.textContent = 'Nije izabran';
        sel.appendChild(optEmpty);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_obred_loze');
        if (callback) callback();
        return;
      }
      var options = [];
      try {
        options = JSON.parse(text || '[]') || [];
      } catch (e) { options = []; }

      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var optEmpty = document.createElement('option');
      optEmpty.value = '';
      optEmpty.textContent = 'Nije izabran';
      sel.appendChild(optEmpty);

      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = o.naziv != null ? String(o.naziv) : '';
        sel.appendChild(opt);
      }

      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_obred_loze');
      if (callback) callback();
    };
    xhr.send();
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function osvjeziTablicu(restoreSelectionId) {
    ucitajPodatkeTablica(function (rows) {
      setDataTablica(rows);
      if (restoreSelectionId != null && tablicaApi && typeof tablicaApi.setSelectedRowIds === 'function') {
        tablicaApi.setSelectedRowIds([restoreSelectionId]);
      }
    });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, Loze_TipCRUD.Tablica_Zaglavlje);
  }

  function updateStateBySelectedObred() {
    var obredId = selectObred ? trim(selectObred.value) : '';

    if (!tablicaEl || !editPanel) {
      if (obredId) {
        osvjeziTablicu();
      }
      return;
    }

    if (!obredId) {
      if (typeof CommonCRUD !== 'undefined' && tablicaApi && typeof CommonCRUD.setDataTablica === 'function') {
        setDataTablica([]);
        if (typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      }
      clearControlsFromSelection();
      if (typeof KontroleSetEnabled === 'function') {
        KontroleSetEnabled(editPanel, false);
      }
      if (tablicaEl.classList) tablicaEl.classList.add('kontrola-tablica--disabled');
    } else {
      if (typeof KontroleSetEnabled === 'function') {
        KontroleSetEnabled(editPanel, true);
      }
      if (tablicaEl.classList) tablicaEl.classList.remove('kontrola-tablica--disabled');
      osvjeziTablicu();
    }

    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) btnPovratak.removeAttribute('disabled');

    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') {
      KontroleSyncLabelsDisabledState(editPanel);
    }

    updateCrudUpisiState();
  }

  function lozeTipAdd(params, callback) {
    postFormData(API_BASE + 'Loze_Tip_CRUD_upis.php', params, callback);
  }

  function lozeTipUpdate(id, naziv, redosljed, callback) {
    postFormData(API_BASE + 'Loze_Tip_CRUD_izmjena.php', { id: String(id), naziv: naziv, redosljed: redosljed }, callback);
  }

  function lozeTipDelete(id, callback) {
    postFormData(API_BASE + 'Loze_Tip_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  function initStranica() {
    var sel = document.getElementById('select_obred_loze');
    if (sel) {
      selectObred = sel;
      sel.addEventListener('change', updateStateBySelectedObred);
      ucitajObrede(sel, function () {
        updateStateBySelectedObred();
      });
    } else {
      ucitajPodatkeTablica(function (rows) { setDataTablica(rows); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStranica);
  } else {
    initStranica();
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  updateCrudUpisiState();
  updateStupnjeviEditsState();
  window.Loze_TipCRUD = Loze_TipCRUD;
})();
