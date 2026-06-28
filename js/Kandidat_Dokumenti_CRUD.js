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

  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');
  var btnReloadTablica = document.getElementById('btn_reload_tablica');
  var editPanel = document.getElementById('edit_panel');
  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  var zivotopisEl = document.getElementById('kandidat_zivotopis');
  var zivotopisKartica = document.getElementById('kandidatKontrolaTabKart0');
  if (btnIzbrisi) { btnIzbrisi.style.display = 'none'; btnIzbrisi.disabled = true; }

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

  /* ===== Enable / CRUD stanje ===== */
  function updateEnabledState() {
    var imaLozu = selectLoza && trim(selectLoza.value) !== '';
    var imaSelekciju = getSelectedRowId() != null;
    var tableWrap = document.getElementById('tablicaContainer');
    tableWrap = tableWrap && tableWrap.closest ? tableWrap.closest('.kontrola-tablica') : null;
    if (tableWrap) tableWrap.classList.toggle('kontrola-tablica--disabled', !imaLozu);

    zivotopisSetEnabled(imaSelekciju);
    if (editPanel) editPanel.classList.toggle('kontrola-panel--edit-disabled', !imaSelekciju);

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
    if (btnUpisi && btnUpisiLabel) {
      var izmjena = imaSelekciju && _zivotopisPostoji;
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', izmjena);
      btnUpisiLabel.textContent = izmjena ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', izmjena ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !imaSelekciju || (_pravaCrudUpis !== 1);
    }
    var smijeBrisati = imaSelekciju && _zivotopisPostoji && _pravaCrudBrisanje === 1;
    if (btnIzbrisi) { btnIzbrisi.style.display = smijeBrisati ? '' : 'none'; btnIzbrisi.disabled = !smijeBrisati; }
  }

  /* ===== Učitavanje životopisa odabranog kandidata ===== */
  function ucitajZivotopis(idClan, cb) {
    _zivotopisPostoji = false;
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
            zivotopisSetTekst(o.zivotopis != null ? o.zivotopis : '');
          } catch (e) {}
        }
        if (cb) cb();
      }).catch(function () { if (cb) cb(); });
  }

  onCrudSelectionChange = function () {
    updateSlikaPreview();
    var id = getSelectedRowId();
    ucitajZivotopis(id, function () { updateCrudState(); });
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
  if (selectDrzava) selectDrzava.addEventListener('change', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika();
    popuniRegijeIzKeša(trim(this.value), function () { updateEnabledState(); });
  });
  if (selectRegija) selectRegija.addEventListener('change', function () {
    if (tablicaApi && tablicaApi.clearSelection) tablicaApi.clearSelection();
    clearSlika();
    popuniLozeIzKeša(trim(this.value), function () { updateEnabledState(); });
  });
  if (selectLoza) selectLoza.addEventListener('change', function () {
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
    updateEnabledState();
  }

  /* Upis / Izmjeni (upsert po id_clan) */
  if (btnUpisi) btnUpisi.addEventListener('click', function () {
    var id = getSelectedRowId();
    if (id == null) return;
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
  function initForma() {
    updateNaslovLozu();
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
})();
