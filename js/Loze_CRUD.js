/* =====================================================
   Loze_CRUD.js
   Panel slika (1:1, širina = visina panela tablice), panel tablice: Država/Regija iz geo prava (Duznosnici_Drzave_Regije_Loze_sve.php),
   panel edit, obrada slike (dvoklik). Konstanta LOZE_CRUD_PANEL_SLIKA_WIDTH_PX = 0: širina panela slike inicijalno = visina panela tablice.
   ===================================================== */
// @ts-nocheck
(function () {
  'use strict';
  /* CRUD prava (upis/brisanje) dolaze iz odgovora Duznosnici_Drzave_Regije_Loze_sve.php u ucitajPravaGeo – bez zasebnog vnlhUcitajPravaCrud. */

  var LOZE_CRUD_PANEL_SLIKA_WIDTH_PX = 0;

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
  //
  var LozeCRUD = {
    Broj_Kolona: 1,
    Reload_Ikona: 0,
    CrudCssPrefix: 'loze-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Loža', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var data = [];

  CommonCRUD.initTablica('tablicaContainer', LozeCRUD, {
    getRowId: function (row) { return row && row[1] != null ? row[1] : (row && row[0]); },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectObred = document.getElementById('select_obred');
  var selectTipLoze = document.getElementById('select_tip_loze');
  var selectDrzavaAdrese = document.getElementById('select_drzava_adrese');
  var editPanel = document.getElementById('edit_panel');
  var tablicaContainerEl = document.getElementById('tablicaContainer');

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  function syncDatumEmptyClass(el) {
    if (!el || el.type !== 'date') return;
    if (el.value === '') el.classList.add('date-empty'); else el.classList.remove('date-empty');
  }

  function syncTipLozeDisabledState() {
    if (!selectTipLoze) return;
    var imaObred = trim(selectObred ? selectObred.value : '') !== '';
    selectTipLoze.disabled = !imaObred;
    if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_tip_loze');
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
  }

  function clearControlsFromSelection() {
    var ids = ['edit_naziv', 'edit_orjent', 'edit_adresa_1', 'edit_adresa_2', 'edit_grad', 'edit_posta', 'edit_telefon', 'edit_email', 'edit_datum', 'edit_napomena'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) { el.value = ''; if (ids[i] === 'edit_naziv') el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    syncDatumEmptyClass(document.getElementById('edit_datum'));
    if (selectObred) { selectObred.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_obred'); }
    if (selectTipLoze) { selectTipLoze.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_tip_loze'); }
    if (selectDrzavaAdrese) { selectDrzavaAdrese.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava_adrese'); }
    var chkAktivnost = document.getElementById('edit_aktivnost');
    if (chkAktivnost) chkAktivnost.checked = true;
    var chkGenerirajThumb = document.getElementById('edit_generiraj_thumb');
    if (chkGenerirajThumb) chkGenerirajThumb.checked = false;
  }

  function clearSlikaFromControl() {
    var img = document.getElementById('loze_image_preview');
    if (!img) return;
    if (img._obradaSlikaPrevURL) {
      try { URL.revokeObjectURL(img._obradaSlikaPrevURL); } catch (err) {}
      img._obradaSlikaPrevURL = null;
    }
    img._obradaSlikaBlob = null;
    img._obradaSlikaMime = null;
    img.removeAttribute('src');
    img.alt = '';
    img.style.display = 'none';
    var delBtn = document.getElementById('loze_image_delete_btn');
    if (delBtn) delBtn.disabled = true;
  }

  onCrudSelectionChange = function () {
    clearSlikaFromControl();
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
    } else {
      var found = data.find(function (r) { return String(r.id) === String(id); });
      if (found) {
        var editNaziv = document.getElementById('edit_naziv');
        if (editNaziv) { editNaziv.value = found.naziv != null ? found.naziv : ''; editNaziv.dispatchEvent(new Event('input', { bubbles: true })); }
        var editOrjent = document.getElementById('edit_orjent');
        if (editOrjent) editOrjent.value = found.orjent != null ? found.orjent : '';
        var editAdresa1 = document.getElementById('edit_adresa_1');
        if (editAdresa1) editAdresa1.value = found.adresa_loze_1 != null ? found.adresa_loze_1 : '';
        var editAdresa2 = document.getElementById('edit_adresa_2');
        if (editAdresa2) editAdresa2.value = found.adresa_loze_2 != null ? found.adresa_loze_2 : '';
        var editGrad = document.getElementById('edit_grad');
        if (editGrad) editGrad.value = found.grad != null ? found.grad : '';
        var editPosta = document.getElementById('edit_posta');
        if (editPosta) editPosta.value = found.posta != null ? found.posta : '';
        var editTelefon = document.getElementById('edit_telefon');
        if (editTelefon) editTelefon.value = found.telefon_loze != null ? found.telefon_loze : '';
        var editEmail = document.getElementById('edit_email');
        if (editEmail) editEmail.value = found.meil_loze != null ? found.meil_loze : '';
        var editDatum = document.getElementById('edit_datum');
        if (editDatum) { editDatum.value = found.datum_nastanka != null ? found.datum_nastanka : ''; syncDatumEmptyClass(editDatum); }
        var editNapomena = document.getElementById('edit_napomena');
        if (editNapomena) editNapomena.value = found.napomena != null ? found.napomena : '';
        if (selectDrzavaAdrese) selectDrzavaAdrese.value = (found.id_drzava_adrese != null && found.id_drzava_adrese !== '') ? String(found.id_drzava_adrese) : '';
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava_adrese');
        if (selectObred) selectObred.value = (found.id_obred != null && found.id_obred !== '') ? String(found.id_obred) : '';
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_obred');
        ucitajTipoveLoze(found.id_obred != null ? found.id_obred : 0, function () {
          if (selectTipLoze) selectTipLoze.value = (found.id_tip_loze != null && found.id_tip_loze !== '') ? String(found.id_tip_loze) : '';
          if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_tip_loze');
          syncTipLozeDisabledState();
        });
        var chkAktivnost = document.getElementById('edit_aktivnost');
        if (chkAktivnost) chkAktivnost.checked = (found.aktivnost === 1 || found.aktivnost === '1');
      }
    }
    updateCrudUpisiState();
    updateSlikaPreview();
    syncTipLozeDisabledState();
  };

  function updateSlikaPreview() {
    var img = document.getElementById('loze_image_preview');
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
      var btn = document.getElementById('loze_image_delete_btn');
      if (btn) btn.disabled = true;
      return;
    }
    if (img.src && img.src.indexOf('blob:') === 0) {
      var btnBlob = document.getElementById('loze_image_delete_btn');
      if (btnBlob) btnBlob.disabled = false;
      return;
    }
    var url = API_BASE + 'Loze_CRUD_slika.php?id=' + encodeURIComponent(id) + '&t=' + (Date.now ? Date.now() : 0);
    img._obradaSlikaBlob = null;
    img._obradaSlikaMime = null;
    img.removeAttribute('src');
    img.alt = '';
    img.style.display = 'none';
    var delBtn = document.getElementById('loze_image_delete_btn');
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
      img.alt = 'Slika lože';
      img.style.display = '';
      img._userChangedImage = false;
      if (delBtn) delBtn.disabled = false;
    });
  }

  function updateEnabledState() {
    var imaRegiju = selectRegija && trim(selectRegija.value) !== '';
    var tableWrap = tablicaContainerEl && tablicaContainerEl.closest('.kontrola-tablica');
    if (tableWrap) {
      if (imaRegiju) tableWrap.classList.remove('kontrola-tablica--disabled');
      else tableWrap.classList.add('kontrola-tablica--disabled');
    }
    if (editPanel && typeof KontroleSetEnabled === 'function') KontroleSetEnabled(editPanel, imaRegiju);
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
    var panelTablica = selectRegija && selectRegija.closest ? selectRegija.closest('.loze-crud__panel-tablica') : null;
    if (panelTablica && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(panelTablica);
    /* Auto-locked geo selekti: labela ostaje čitljiva (kao Clanovi_CRUD). */
    if (_geoAutoLockedDrzava) {
      var lblDrzava = document.querySelector('label[for="select_drzava"]');
      if (lblDrzava) lblDrzava.classList.remove('kontrola-labela--disabled');
    }
    if (_geoAutoLockedRegija) {
      var lblRegija = document.querySelector('label[for="select_regija"]');
      if (lblRegija) lblRegija.classList.remove('kontrola-labela--disabled');
    }
    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) { btnPovratak.disabled = false; btnPovratak.removeAttribute('disabled'); }
    var imageArea = document.getElementById('loze_image_area');
    var imageFrame = document.getElementById('loze_image_frame');
    if (imageArea) imageArea.classList.toggle('loze-crud__edit-image-area--disabled', !imaRegiju);
    if (imageFrame) imageFrame.classList.toggle('kontrola-slika--disabled', !imaRegiju);
  }

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    var imaRegiju = selectRegija && trim(selectRegija.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;
    var editNaziv = document.getElementById('edit_naziv');
    var imaSadrzaj = editNaziv ? trim(editNaziv.value) !== '' : false;

    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaRegiju || !imaSadrzaj;
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
  }

  (function () {
    var editNaziv = document.getElementById('edit_naziv');
    if (!editNaziv) return;
    editNaziv.addEventListener('input', updateCrudUpisiState);
    editNaziv.addEventListener('change', updateCrudUpisiState);
    var wrap = editNaziv.closest('.kontrola-edit-delete');
    if (wrap) {
      wrap.addEventListener('kontrole-edit-delete-clear', function () {
        if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
        clearSlikaFromControl();
        updateCrudUpisiState();
      });
    }
  })();

  var API_BASE = '../php/';

  function getApiUrl(path) {
    var p = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + p + '/php/' + path;
  }

  /* --- Geo prava (Država → Regija); keš u 0-Filteri_Po_Ogranicenjima.js --- */
  var _geoAutoLockedDrzava = false;
  var _geoAutoLockedRegija = false;

  function setAutoLockedClass(selectEl, locked) {
    if (!selectEl) return;
    var wrapper = selectEl.closest ? selectEl.closest('.kontrola-select') : null;
    if (!wrapper) return;
    if (locked) wrapper.classList.add('kontrola-select--auto-locked');
    else wrapper.classList.remove('kontrola-select--auto-locked');
  }

  function popuniSelectIzKeša(sel, arr, placeholder, kontrolaId) {
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    sel.appendChild(opt0);
    for (var gi = 0; gi < (arr || []).length; gi++) {
      var opt = document.createElement('option');
      opt.value = arr[gi].id != null ? String(arr[gi].id) : '';
      opt.textContent = arr[gi].naziv != null ? arr[gi].naziv : '';
      sel.appendChild(opt);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) KontroleRefreshCustomSelect(kontrolaId);
  }

  /**
   * Regije za odabranu državu iz keša. Jedna regija → auto-select + učitavanje tablice loža.
   */
  function popuniRegijeIzKeša(idDrzava, callback) {
    _geoAutoLockedRegija = false;
    setAutoLockedClass(selectRegija, false);
    if (!selectRegija) { if (callback) callback(); return; }
    if (!idDrzava) {
      popuniSelectIzKeša(selectRegija, [], '— Odaberi regiju —', 'select_regija');
      selectRegija.disabled = true;
      data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], LozeCRUD.Tablica_Zaglavlje);
      var panelTab0 = selectRegija.closest ? selectRegija.closest('.loze-crud__panel-tablica') : null;
      if (panelTab0 && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(panelTab0);
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
      ucitajLoze(selectRegija.value, function () {
        if (callback) callback();
      });
    } else {
      selectRegija.disabled = (filtrirano.length === 0);
      data = [];
      if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], LozeCRUD.Tablica_Zaglavlje);
      var panelTab1 = selectRegija.closest ? selectRegija.closest('.loze-crud__panel-tablica') : null;
      if (panelTab1 && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(panelTab1);
      if (callback) callback();
    }
  }

  /**
   * Jedan GET: dozvoljene države/regije + upis_izmjena / brisanje_sloga za Loze_CRUD.html.
   */
  function ucitajPravaGeo(callback) {
    if (!selectDrzava) { if (callback) callback(); return; }
    var url =
      typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
        ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Loze_CRUD.html')
        : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') +
          '?html_fajl=' +
          encodeURIComponent('Loze_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var obj = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = obj.drzave || [];

      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');

      if (typeof vnlhPrimijeniPravaCrud === 'function') {
        vnlhPrimijeniPravaCrud(obj.upis_izmjena, obj.brisanje_sloga);
      }

      _geoAutoLockedDrzava = false;
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
        if (selectDrzava) selectDrzava.disabled = (drz.length === 0);
        popuniRegijeIzKeša('', function () {});
        if (callback) callback();
      }
    });
  }

  function getDrzaveAdreseSveUrl() {
    var path = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + path + '/php/Drzave_Adrese_CRUD_sve.php';
  }

  function getObrediSveUrl() {
    var path = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + path + '/php/Obredi_CRUD_sve.php';
  }

  function getLozeCRUDTipSveUrl() {
    var path = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
    return window.location.origin + path + '/php/Loze_CRUD_loze_tip_sve.php';
  }

  function ucitajObrede(callback) {
    if (!selectObred) { if (callback) callback(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getObrediSveUrl(), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      while (selectObred.firstChild) selectObred.removeChild(selectObred.firstChild);
      var optEmpty = document.createElement('option');
      optEmpty.value = ''; optEmpty.textContent = '— Odaberi obred —';
      selectObred.appendChild(optEmpty);
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            var opt = document.createElement('option');
            opt.value = arr[i].id != null ? String(arr[i].id) : '';
            opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
            selectObred.appendChild(opt);
          }
        } catch (e) {}
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_obred');
      if (callback) callback();
    };
    xhr.send();
  }

  function ucitajTipoveLoze(obredId, callback) {
    if (!selectTipLoze) { if (callback) callback(); return; }
    if (!obredId || obredId <= 0) {
      while (selectTipLoze.firstChild) selectTipLoze.removeChild(selectTipLoze.firstChild);
      var o = document.createElement('option');
      o.value = ''; o.textContent = '— Odaberi tip lože —';
      selectTipLoze.appendChild(o);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_tip_loze');
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getLozeCRUDTipSveUrl() + '?id_obred=' + encodeURIComponent(obredId), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      while (selectTipLoze.firstChild) selectTipLoze.removeChild(selectTipLoze.firstChild);
      var optEmpty = document.createElement('option');
      optEmpty.value = ''; optEmpty.textContent = '— Odaberi tip lože —';
      selectTipLoze.appendChild(optEmpty);
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          for (var i = 0; i < arr.length; i++) {
            var opt = document.createElement('option');
            opt.value = arr[i].id != null ? String(arr[i].id) : '';
            opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
            selectTipLoze.appendChild(opt);
          }
        } catch (e) {}
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_tip_loze');
      if (callback) callback();
    };
    xhr.send();
  }

  function ucitajDrzaveAdrese(callback) {
    var sel = selectDrzavaAdrese;
    if (!sel) { if (callback) callback(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getDrzaveAdreseSveUrl(), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) !== '[') {
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        var optE = document.createElement('option');
        optE.value = ''; optE.textContent = '— Odaberi državu adrese —';
        sel.appendChild(optE);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava_adrese');
        if (callback) callback();
        return;
      }
      var options = [];
      try { options = JSON.parse(text || '[]') || []; } catch (e) {}
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var optEmpty = document.createElement('option');
      optEmpty.value = ''; optEmpty.textContent = '— Odaberi državu adrese —';
      sel.appendChild(optEmpty);
      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = o.naziv != null ? String(o.naziv) : '';
        sel.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava_adrese');
      if (callback) callback();
    };
    xhr.send();
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function ucitajLoze(idRegija, callback) {
    if (!idRegija) { data = []; if (tablicaApi) CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', [], LozeCRUD.Tablica_Zaglavlje); if (callback) callback(); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Loze_CRUD_sve.php?id_regija=' + encodeURIComponent(idRegija), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      data = [];
      var rows = [];
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          data = arr;
          for (var i = 0; i < arr.length; i++) {
            rows.push([arr[i].naziv != null ? arr[i].naziv : '', arr[i].id != null ? arr[i].id : 0]);
          }
        } catch (e) {}
      }
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, LozeCRUD.Tablica_Zaglavlje);
      if (callback) callback();
    };
    xhr.send();
  }

  function osvjeziTablicu() {
    var idRegija = selectRegija ? trim(selectRegija.value) : '';
    ucitajLoze(idRegija, function () {
      updateCrudUpisiState();
    });
  }

  if (selectDrzava) {
    selectDrzava.addEventListener('change', function () {
      var id = trim(this.value);
      popuniRegijeIzKeša(id, function () {
        if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
        clearControlsFromSelection();
        clearSlikaFromControl();
        updateEnabledState();
        updateCrudUpisiState();
      });
    });
  }

  if (selectRegija) {
    selectRegija.addEventListener('change', function () {
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      clearControlsFromSelection();
      clearSlikaFromControl();
      osvjeziTablicu();
      updateEnabledState();
      updateCrudUpisiState();
    });
  }

  if (selectObred) {
    selectObred.addEventListener('change', function () {
      var idObred = trim(selectObred.value);
      if (!idObred) {
        ucitajTipoveLoze(0, syncTipLozeDisabledState);
        return;
      }
      ucitajTipoveLoze(idObred, syncTipLozeDisabledState);
    });
  }

  (function () {
    var editDatum = document.getElementById('edit_datum');
    if (editDatum) {
      syncDatumEmptyClass(editDatum);
      editDatum.addEventListener('change', function () { syncDatumEmptyClass(editDatum); });
      editDatum.addEventListener('input', function () { syncDatumEmptyClass(editDatum); });
    }
    var editPosta = document.getElementById('edit_posta');
    if (editPosta && typeof initSamoNumerika === 'function') initSamoNumerika(editPosta, 5);
    var editTelefon = document.getElementById('edit_telefon');
    if (editTelefon && typeof upis_telefona === 'function') upis_telefona(editTelefon);
    var editEmail = document.getElementById('edit_email');
    if (editEmail && typeof upis_maila === 'function') upis_maila(editEmail);
  })();

  function createThumbFromBlob(blob, maxWidthPx) {
    maxWidthPx = maxWidthPx || 64;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) { resolve({ blob: null, mime: 'image/png' }); return; }
        var scale = w > maxWidthPx ? maxWidthPx / w : 1;
        var tw = Math.round(w * scale);
        var th = Math.round(h * scale);
        if (tw < 1 || th < 1) { resolve({ blob: null, mime: 'image/png' }); return; }
        var canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve({ blob: null, mime: 'image/png' }); return; }
        ctx.drawImage(img, 0, 0, tw, th);
        canvas.toBlob(function (outBlob) {
          resolve({ blob: outBlob, mime: outBlob ? 'image/png' : 'image/png' });
        }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Thumb load failed')); };
      img.src = url;
    });
  }

  function isValidEmail(s) {
    if (typeof s !== 'string' || trim(s) === '') return false;
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(trim(s));
  }

  function buildLozeFormData(payload, jeIzmjena, img, thumb) {
    var fd = new FormData();
    fd.append('id_regija', payload.id_regija);
    if (payload.id_drzava !== '' && payload.id_drzava != null) fd.append('id_drzava', payload.id_drzava);
    fd.append('naziv', payload.naziv);
    fd.append('orjent', payload.orjent != null ? payload.orjent : '');
    if (payload.id_obred !== '' && payload.id_obred != null) fd.append('id_obred', payload.id_obred);
    if (payload.id_tip_loze !== '' && payload.id_tip_loze != null) fd.append('id_tip_loze', payload.id_tip_loze);
    if (payload.id_drzava_adrese !== '' && payload.id_drzava_adrese != null) fd.append('id_drzava_adrese', payload.id_drzava_adrese);
    fd.append('adresa_loze_1', payload.adresa_loze_1);
    fd.append('adresa_loze_2', payload.adresa_loze_2);
    fd.append('grad', payload.grad);
    fd.append('posta', payload.posta);
    fd.append('telefon_loze', payload.telefon_loze);
    fd.append('meil_loze', payload.meil_loze);
    fd.append('datum_nastanka', payload.datum_nastanka != null ? payload.datum_nastanka : '');
    fd.append('napomena', payload.napomena);
    fd.append('aktivnost', payload.aktivnost);
    if (jeIzmjena) fd.append('id', payload.id);
    if (img && img._obradaSlikaBlob) {
      var slikaFn = (img._obradaSlikaMime && img._obradaSlikaMime.indexOf('png') !== -1) ? 'slika.png' : 'slika.webp';
      fd.append('slika', img._obradaSlikaBlob, slikaFn);
      fd.append('slika_mime', img._obradaSlikaMime || 'image/webp');
    }
    if (thumb && thumb.blob) {
      fd.append('thumb', thumb.blob, 'thumb.webp');
      fd.append('thumb_mime', thumb.mime || 'image/webp');
    }
    return fd;
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editNaziv = document.getElementById('edit_naziv');
      var editTelefon = document.getElementById('edit_telefon');
      var editEmail = document.getElementById('edit_email');
      var naziv = editNaziv ? trim(editNaziv.value) : '';
      var idRegija = selectRegija ? trim(selectRegija.value) : '';
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      var id = jeIzmjena ? getSelectedRowId() : null;
      if (!idRegija) return;
      if (jeIzmjena && id == null) return;

      var nazivLower = naziv.toLowerCase();
      var duplicate = data.some(function (row) {
        var rowNaziv = (row.naziv != null ? String(row.naziv) : '').toLowerCase();
        if (rowNaziv !== nazivLower) return false;
        if (jeIzmjena && String(row.id) === String(id)) return false;
        return true;
      });
      if (duplicate) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['020'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('020', [], function () {
            if (editNaziv && typeof editNaziv.focus === 'function') editNaziv.focus();
          });
        }
        return;
      }

      if (naziv === '') {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['017'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('017', [], function () { if (editNaziv && editNaziv.focus) editNaziv.focus(); });
        }
        return;
      }

      var telefonVal = editTelefon ? trim(editTelefon.value) : '';
      var meilVal = editEmail ? trim(editEmail.value) : '';
      if (telefonVal !== '' && telefonVal.indexOf('+') !== 0) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['018'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('018', [], function () { if (editTelefon && editTelefon.focus) editTelefon.focus(); });
        }
        return;
      }
      if (meilVal !== '' && !isValidEmail(meilVal)) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['019'] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal('019', [], function () { if (editEmail && editEmail.focus) editEmail.focus(); });
        }
        return;
      }

      var idDrzavaVal = selectDrzava ? trim(selectDrzava.value) : '';

      var editDatum = document.getElementById('edit_datum');
      var datumVal = editDatum && editDatum.value ? trim(editDatum.value) : '';
      var payload = {
        id_regija: idRegija,
        id_drzava: idDrzavaVal !== '' ? idDrzavaVal : null,
        naziv: naziv,
        orjent: document.getElementById('edit_orjent') ? trim(document.getElementById('edit_orjent').value) : '',
        id_obred: selectObred ? trim(selectObred.value) : '',
        id_tip_loze: selectTipLoze ? trim(selectTipLoze.value) : '',
        id_drzava_adrese: selectDrzavaAdrese ? trim(selectDrzavaAdrese.value) : '',
        adresa_loze_1: document.getElementById('edit_adresa_1') ? trim(document.getElementById('edit_adresa_1').value) : '',
        adresa_loze_2: document.getElementById('edit_adresa_2') ? trim(document.getElementById('edit_adresa_2').value) : '',
        grad: document.getElementById('edit_grad') ? trim(document.getElementById('edit_grad').value) : '',
        posta: document.getElementById('edit_posta') ? (document.getElementById('edit_posta').value || '') : '',
        telefon_loze: telefonVal,
        meil_loze: meilVal,
        datum_nastanka: datumVal !== '' ? datumVal : null,
        napomena: document.getElementById('edit_napomena') ? trim(document.getElementById('edit_napomena').value) : '',
        aktivnost: (function () { var chk = document.getElementById('edit_aktivnost'); return chk && chk.checked ? 1 : 0; })()
      };
      if (jeIzmjena) payload.id = String(id);

      var img = document.getElementById('loze_image_preview');
      function doSubmit(fd) {
        var url = jeIzmjena ? API_BASE + 'Loze_CRUD_izmjena.php' : API_BASE + 'Loze_CRUD_upis.php';
        fetch(url, { method: 'POST', body: fd })
          .then(function (r) { return r.text(); })
          .then(function (res) {
            if (res === 'OK') {
              var onSuccess = function () {
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
                clearControlsFromSelection();
                clearSlikaFromControl();
                osvjeziTablicu();
              };
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(jeIzmjena ? '004' : '001', [], onSuccess);
              } else {
                onSuccess();
              }
            } else {
              var p = parseResponseCode(res);
              var code = p && p.code ? p.code : '101';
              if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[code] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(code, (p && p.replacements) ? p.replacements : []);
              } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101'] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('101', []);
              }
            }
          })
          .catch(function () {
            if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['100'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('100', []);
          });
      }

      var chkGenerirajThumb = document.getElementById('edit_generiraj_thumb');
      var generirajThumbChecked = chkGenerirajThumb && chkGenerirajThumb.checked;
      var userChangedImage = img && img._userChangedImage === true;
      function doThumbAndSubmit(blob, imgForFormData) {
        if (!blob) {
          doSubmit(buildLozeFormData(payload, jeIzmjena, imgForFormData || null, null));
          return;
        }
        createThumbFromBlob(blob, 64).then(function (thumb) {
          doSubmit(buildLozeFormData(payload, jeIzmjena, imgForFormData || null, thumb));
        }).catch(function () {
          doSubmit(buildLozeFormData(payload, jeIzmjena, imgForFormData || null, null));
        });
      }
      if (img && img._obradaSlikaBlob && userChangedImage) {
        doThumbAndSubmit(img._obradaSlikaBlob, img);
      } else if (img && img._obradaSlikaBlob && generirajThumbChecked) {
        doThumbAndSubmit(img._obradaSlikaBlob, null);
      } else if (generirajThumbChecked && jeIzmjena && img && img.src && img.src.indexOf('blob:') === 0) {
        fetch(img.src).then(function (r) { return r.blob(); }).then(function (blob) {
          doThumbAndSubmit(blob, null);
        }).catch(function () {
          doSubmit(buildLozeFormData(payload, jeIzmjena, null, null));
        });
      } else {
        doSubmit(buildLozeFormData(payload, jeIzmjena, null, null));
      }
    });
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'Loze_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
            if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
            clearControlsFromSelection();
            clearSlikaFromControl();
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

  function getOneColBreakPx() {
    return typeof window.getPageBreakpointNarrow === 'function' ? window.getPageBreakpointNarrow() : 640;
  }

  var lozeStackModeMqlRef = null;
  var lozeStackModeMqlInited = false;
  function getLozeStackModeMql() {
    if (lozeStackModeMqlInited) return lozeStackModeMqlRef;
    lozeStackModeMqlInited = true;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    try {
      var bp = getOneColBreakPx();
      lozeStackModeMqlRef = window.matchMedia(
        '(max-width: ' + bp + 'px), ((hover: none) and (pointer: coarse) and (max-width: 1200px))'
      );
    } catch (e) {
      lozeStackModeMqlRef = null;
    }
    return lozeStackModeMqlRef;
  }

  function isLozeWideTwoColLayout() {
    var mql = getLozeStackModeMql();
    if (mql) return !mql.matches;
    var bp = getOneColBreakPx();
    return typeof window !== 'undefined' && window.innerWidth > bp;
  }

  function clearLozeSlikaPanelWideLayoutStyles() {
    var panelSlika = document.querySelector('.loze-crud__panel-slika');
    if (!panelSlika) return;
    panelSlika.style.width = '';
    panelSlika.style.height = '';
    panelSlika.style.minHeight = '';
    panelSlika.style.maxHeight = '';
    panelSlika.style.aspectRatio = '';
  }

  var savedSlikaW = 0;
  var savedSlikaH = 0;
  /** Maks. visina panela tablice u 640 modu = širina panela slike u širokom modu kad je na 60% */
  var savedMaxTablicaHeightFromWide = 0;

  function setPanelSlikaSizeFromTablica() {
    var panelTablica = document.querySelector('.loze-crud__panel-tablica');
    var panelSlika = document.querySelector('.loze-crud__panel-slika');
    if (!panelTablica || !panelSlika) return;
    var isWide = isLozeWideTwoColLayout();
    if (!isWide) {
      clearLozeSlikaPanelWideLayoutStyles();
      return;
    }
    var h = panelTablica.offsetHeight || 0;
    if (LOZE_CRUD_PANEL_SLIKA_WIDTH_PX === 0 && h > 0) {
      panelSlika.style.width = h + 'px';
      panelSlika.style.height = h + 'px';
      panelSlika.style.minHeight = h + 'px';
      panelSlika.style.aspectRatio = '1/1';
    }
    if (panelSlika.offsetWidth > 0) savedMaxTablicaHeightFromWide = panelSlika.offsetWidth;
    sync60_40MaxHeight();
  }

  function sync60_40MaxHeight() {
    var topRow = document.querySelector('.loze-crud__top-row');
    var panelSlika = document.querySelector('.loze-crud__panel-slika');
    var panelTablica = document.querySelector('.loze-crud__panel-tablica');
    if (!topRow || !panelSlika || !panelTablica) return;
    var isWide = isLozeWideTwoColLayout();
    if (!isWide) {
      clearLozeSlikaPanelWideLayoutStyles();
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
    panelSlika.style.aspectRatio = '1/1';
  }

  function initForma() {
    ucitajPravaGeo(function () {
      updateEnabledState();
      updateCrudUpisiState();
      setPanelSlikaSizeFromTablica();
    });
    ucitajDrzaveAdrese();
    ucitajObrede();
    syncTipLozeDisabledState();
    updateEnabledState();
    updateCrudUpisiState();

    var delBtn = document.getElementById('loze_image_delete_btn');
    var imgPreview = document.getElementById('loze_image_preview');
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
        idPrefix: 'loze_modal_slika',
        templateUrl: '0-Obrada_Slike.php',
        mountSelector: '#obrada_slika_mount',
        getSelectedId: getSelectedRowId,
        getEditFormRowId: getSelectedRowId,
        apiBase: API_BASE,
        imageUrlPath: 'Loze_CRUD_slika.php',
        imageAreaId: 'loze_image_area',
        focusAfterCloseId: 'edit_naziv',
        imageAreaDisabledClass: 'loze-crud__edit-image-area--disabled',
        imagePreviewElement: document.getElementById('loze_image_preview'),
        parseResponseCode: parseResponseCode,
        fixedRatioX: 1,
        fixedRatioY: 1,
        ratioInputsDisabled: true,
        onUploadSuccess: function () {
          var img = document.getElementById('loze_image_preview');
          if (img) img._userChangedImage = true;
        }
      });
    }

    if (typeof ResizeObserver !== 'undefined') {
      var panelTablica = document.querySelector('.loze-crud__panel-tablica');
      if (panelTablica) {
        var ro = new ResizeObserver(function () {
          requestAnimationFrame(setPanelSlikaSizeFromTablica);
        });
        ro.observe(panelTablica);
      }
    }
    var lastWide = isLozeWideTwoColLayout();
    function lozeOnViewportLayoutChange() {
      var nowWide = isLozeWideTwoColLayout();
      if (!nowWide) clearLozeSlikaPanelWideLayoutStyles();
      var panelSlika = document.querySelector('.loze-crud__panel-slika');
      if (!panelSlika) { lastWide = nowWide; return; }
      if (lastWide && !nowWide) {
        if (panelSlika.offsetWidth > 0) savedMaxTablicaHeightFromWide = panelSlika.offsetWidth;
        applyOneColSlika(panelSlika);
        var panelTablica = document.querySelector('.loze-crud__panel-tablica');
        if (panelTablica) {
          panelTablica.style.height = '';
          panelTablica.style.maxHeight = '';
        }
      } else if (!lastWide && nowWide) {
        restoreSlikaDimensions(panelSlika);
        var panelTablica = document.querySelector('.loze-crud__panel-tablica');
        if (panelTablica && panelSlika && panelSlika.offsetWidth > 0) {
          var maxH = panelSlika.offsetWidth;
          if (panelTablica.offsetHeight > maxH) {
            panelTablica.style.height = maxH + 'px';
            requestAnimationFrame(setPanelSlikaSizeFromTablica);
          }
        }
      }
      lastWide = nowWide;
      requestAnimationFrame(sync60_40MaxHeight);
    }
    window.addEventListener('resize', function () {
      requestAnimationFrame(lozeOnViewportLayoutChange);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { requestAnimationFrame(lozeOnViewportLayoutChange); }, 200);
    });
    var lozeStackMql = getLozeStackModeMql();
    if (lozeStackMql) {
      var onLozeStackMqlChange = function () {
        requestAnimationFrame(lozeOnViewportLayoutChange);
      };
      if (lozeStackMql.addEventListener) lozeStackMql.addEventListener('change', onLozeStackMqlChange);
      else if (lozeStackMql.addListener) lozeStackMql.addListener(onLozeStackMqlChange);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(lozeOnViewportLayoutChange);
    });

    setTimeout(initPanelTablicaTouchResize, 0);
    setTimeout(initPanelTablicaTouchResize, 400);
  }

  function initPanelTablicaTouchResize() {
    var panel = document.querySelector('.loze-crud__panel-tablica');
    if (!panel) return;
    var doc = panel.ownerDocument || document;
    var minH = 120;
    var cs = typeof getComputedStyle !== 'undefined' && getComputedStyle(panel).minHeight;
    if (cs && cs !== 'none' && cs !== 'auto') {
      var px = parseFloat(cs);
      if (!isNaN(px) && px > 0) minH = Math.round(px);
    }
    var isWide = isLozeWideTwoColLayout();
    var maxH = 800;
    if (typeof window !== 'undefined') {
      if (isWide) {
        maxH = window.innerHeight ? Math.round(window.innerHeight * 0.9) : 800;
      } else {
        var base = savedMaxTablicaHeightFromWide > 0 ? savedMaxTablicaHeightFromWide : minH;
        maxH = Math.round(base * 2);
      }
    }

    var handle = panel.querySelector('.loze-crud__resize-handle');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'loze-crud__resize-handle';
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
        function move(ev) {
          var y = getY(ev);
          var delta = y - startY;
          var newH = Math.max(minWithHandle, Math.min(maxH, startHeight + delta));
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
      setPanelSlikaSizeFromTablica();
      setTimeout(setPanelSlikaSizeFromTablica, 100);
    });
  } else {
    initForma();
  }

  window.LozeCRUD = LozeCRUD;
})();
