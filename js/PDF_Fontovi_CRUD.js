/* PDF_Fontovi_CRUD.js – tablica + edit; tablica: pdf_fontovi.
 * Red u tablici: [ naziv, pdfmake_kljuc, tip, pisma_str, aktivan, id ]; getRowId -> indeks 5.
 * podrzana_pisma: u bazi JSON niz; u formi tekst "latin, cyrillic" (zarezom odvojeno).
 * API: PDF_Fontovi_CRUD_sve.php / _upis.php / _izmjena.php / _brisanje.php
 */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('PDF_Fontovi_CRUD.html');

  const PDF_FontoviCRUD = {
    Broj_Kolona: 5,
    Reload_Ikona: 0,
    CrudCssPrefix: 'pdf-fontovi-crud',
    Tablica_Zaglavlje: [
      { key: 'naziv', title: 'Naziv', SQL_Naziv: 'naziv', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'pdfmake_kljuc', title: 'PDFmake ključ', SQL_Naziv: 'pdfmake_kljuc', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'tip', title: 'Tip', SQL_Naziv: 'tip', sortable: 0, sortable_icon: 0, type: 't', width: 120, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1 },
      { key: 'pisma', title: 'Pisma', SQL_Naziv: 'podrzana_pisma', sortable: 0, sortable_icon: 0, type: 't', width: 160, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'aktivan', title: 'Aktivan', SQL_Naziv: 'aktivan', sortable: 0, sortable_icon: 0, type: 'b', width: 100, suffix: '', align: 'C', row_align: 'C', mobitel_prikaz: 1, cell_readonly: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;

  CommonCRUD.initTablica('tablicaContainer', PDF_FontoviCRUD, {
    getRowId: function (row) {
      return row && row[6] != null ? row[6] : null;
    },
    onReady: function (api) {
      tablicaApi = api;
    },
    onSelectionChange: function () {
      if (onCrudSelectionChange) onCrudSelectionChange();
    }
  });

  var editDostupni = document.getElementById('edit_dostupni_fontovi');
  var editVarijante = document.getElementById('edit_dostupne_varijante');
  var dostupneVarijanteMap = {};
  var dostupniJeziciMap = {};   // porodica -> { "Latin": [jezici], "Cyrillic": [...], ... }
  var trenutniJeziciObj = {};   // trenutno prikazana/spremna struktura
  var editNaziv = document.getElementById('edit_naziv');
  var editKljuc = document.getElementById('edit_pdfmake_kljuc');
  var editTip = document.getElementById('edit_tip');
  var editPisma = document.getElementById('edit_podrzana_pisma');
  var editAktivan = document.getElementById('edit_aktivan');
  var editNapomena = document.getElementById('edit_napomena');
  var editPanel = document.getElementById('edit_panel');

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Normalizira spremljenu vrijednost u grupiranu strukturu { "Latin": [...], ... }. */
  function jeziciIzVrijednosti(val) {
    if (val == null) return {};
    var o = val;
    if (typeof val === 'string') {
      var s = trim(val);
      if (s === '') return {};
      try { o = JSON.parse(s); } catch (e) { return {}; }
    }
    if (o && typeof o === 'object' && !Array.isArray(o)) return o;
    return {};
  }

  /** Za ćeliju tablice: imena pisama (grupa) odvojena zarezom, npr. "Latin, Cyrillic". */
  function pismaToText(val) {
    var o = jeziciIzVrijednosti(val);
    var keys = Object.keys(o);
    if (keys.length) return keys.join(', ');
    // legacy: niz pisama ["latin",...]
    if (typeof val === 'string') {
      try { var a = JSON.parse(trim(val)); if (Array.isArray(a)) return a.join(', '); } catch (e) {}
    } else if (Array.isArray(val)) {
      return val.join(', ');
    }
    return '';
  }

  /** Iscrtava grupiranu strukturu u RO okvir: "<strong>Latin:</strong> hrvatski, ...<br>...". */
  function renderPismaBox(obj) {
    if (!editPisma) return;
    var keys = obj && typeof obj === 'object' ? Object.keys(obj) : [];
    if (!keys.length) { editPisma.innerHTML = ''; return; }
    var html = [];
    for (var i = 0; i < keys.length; i++) {
      var g = keys[i];
      var lista = Array.isArray(obj[g]) ? obj[g] : [];
      html.push('<strong>' + escHtml(g) + ':</strong> ' + escHtml(lista.join(', ')));
    }
    editPisma.innerHTML = html.join('<br>');
  }

  /**
   * Iscrtava prikaz jezika iz trenutniJeziciObj i upravlja disabled stanjem:
   * ako nema sadržaja (font nije izabran i red nije selektiran) -> disabled.
   * Koristi se i pri izboru fonta iz foldera i pri selekciji retka u tablici.
   */
  function azurirajPismaBox() {
    if (!editPisma) return;
    var ima = trenutniJeziciObj && typeof trenutniJeziciObj === 'object' && Object.keys(trenutniJeziciObj).length > 0;
    renderPismaBox(ima ? trenutniJeziciObj : {});
    editPisma.classList.toggle('kontrola-prikaz--disabled', !ima);
    /* aria-disabled da povezana labela (for) prati disabled stanje preko 0-Kontrole mehanizma. */
    editPisma.setAttribute('aria-disabled', ima ? 'false' : 'true');
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
  }

  function refreshTipSelect() {
    if (typeof KontroleRefreshCustomSelect === 'function') {
      try { KontroleRefreshCustomSelect('edit_tip'); } catch (e) {}
    }
  }

  /**
   * Sekundarna polja (ključ, tip, pisma, aktivan, napomena) — disabled dok nema konteksta:
   * odabran red u tablici ILI nešto upisano u Naziv.
   */
  function syncEditPanelDisabledState() {
    var imaSelekciju = getSelectedRowId() != null;
    var imaNazivTekst = editNaziv ? trim(editNaziv.value) !== '' : false;
    var nazivBlokiran = !!(editNaziv && editNaziv.disabled);
    var omoguci = !nazivBlokiran && (imaSelekciju || imaNazivTekst);
    var dis = !omoguci;
    if (editKljuc) editKljuc.disabled = dis;
    if (editTip) { editTip.disabled = dis; refreshTipSelect(); }
    /* editPisma je readonly + automatski iz fonta — ne ulazi u disabled-gating. */
    if (editAktivan) editAktivan.disabled = dis;
    if (editNapomena) editNapomena.disabled = dis;
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
  }

  function clearControlsFromSelection() {
    if (editDostupni) { editDostupni.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect('edit_dostupni_fontovi'); } catch (e) {} } }
    if (editVarijante) { editVarijante.value = ''; editVarijante.disabled = true; }
    if (editNaziv) {
      editNaziv.value = '';
      editNaziv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (editKljuc) editKljuc.value = '';
    if (editTip) { editTip.value = 'sans'; refreshTipSelect(); }
    trenutniJeziciObj = {};
    azurirajPismaBox();
    if (editAktivan) editAktivan.checked = true;
    if (editNapomena) editNapomena.value = '';
    syncEditPanelDisabledState();
  }

  /** Postavi selekt „Dostupni fontovi" + RO varijante iz zadane porodice (ne dira pisma). */
  function postaviDostupniIzReda(por) {
    por = por != null ? String(por) : '';
    if (editDostupni) {
      editDostupni.value = por;
      if (typeof KontroleRefreshCustomSelect === 'function') {
        try { KontroleRefreshCustomSelect('edit_dostupni_fontovi'); } catch (e) {}
      }
    }
    if (editVarijante) {
      var varijante = (por !== '' && dostupneVarijanteMap[por]) ? dostupneVarijanteMap[por] : [];
      if (por !== '' && varijante.length) {
        editVarijante.value = varijante.join(', ');
        editVarijante.disabled = false;
      } else {
        editVarijante.value = '';
        editVarijante.disabled = true;
      }
    }
    if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
  }

  onCrudSelectionChange = function () {
    var id = getSelectedRowId();
    if (id == null) {
      clearControlsFromSelection();
    } else {
      var data = tablicaApi.getData();
      for (var i = 0; i < data.length; i++) {
        if (data[i][6] == id) {
          if (editNaziv) editNaziv.value = data[i][0] != null ? data[i][0] : '';
          if (editKljuc) editKljuc.value = data[i][1] != null ? data[i][1] : '';
          if (editTip) {
            var tipVal = data[i][2];
            editTip.value = (tipVal === 'serif' || tipVal === 'mono') ? tipVal : 'sans';
            refreshTipSelect();
          }
          trenutniJeziciObj = jeziciIzVrijednosti(data[i][7]);
          azurirajPismaBox();
          /* Postavi selekt „Dostupni fontovi" + varijante iz spremljene porodice
             (bez diranja pisma — pisma ostaju iz spremljene vrijednosti retka). */
          postaviDostupniIzReda(data[i][8]);
          if (editAktivan) {
            var a = data[i][4];
            editAktivan.checked = a === 1 || a === true || a === '1';
          }
          if (editNapomena) editNapomena.value = data[i][5] != null ? data[i][5] : '';
          break;
        }
      }
      if (editNaziv) editNaziv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    updateCrudUpisiState();
    syncEditPanelDisabledState();
  };

  /* X (clear) na polju Naziv -> resetira cijeli edit i selekciju. */
  (function () {
    var wrap = editNaziv && editNaziv.closest('.kontrola-edit-delete');
    if (!wrap) return;
    wrap.addEventListener('kontrole-edit-delete-clear', function () {
      /* X briše cijeli edit panel — uključujući selekt „Dostupni fontovi" i selekciju u tablici. */
      if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
      clearControlsFromSelection();
      updateCrudUpisiState();
    });
  })();

  var btnUpisi = document.getElementById('btnUpisi');
  var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
  var btnIzbrisi = document.getElementById('btnIzbrisi');

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var imaNaziv = editNaziv ? trim(editNaziv.value) !== '' : false;
    var imaKljuc = editKljuc ? trim(editKljuc.value) !== '' : false;
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !(imaNaziv && imaKljuc);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;
    syncEditPanelDisabledState();
  }

  if (editNaziv) {
    editNaziv.addEventListener('input', updateCrudUpisiState);
    editNaziv.addEventListener('change', updateCrudUpisiState);
  }
  if (editKljuc) {
    editKljuc.addEventListener('input', updateCrudUpisiState);
    editKljuc.addEventListener('change', updateCrudUpisiState);
  }

  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var naziv = editNaziv ? trim(editNaziv.value) : '';
      var kljuc = editKljuc ? trim(editKljuc.value) : '';
      var tip = editTip ? trim(editTip.value) : '';
      if (naziv === '' || kljuc === '' || (tip !== 'serif' && tip !== 'sans' && tip !== 'mono')) {
        if (typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []);
        return;
      }
      var params = {
        naziv: naziv,
        pdfmake_kljuc: kljuc,
        porodica: editDostupni ? trim(editDostupni.value) : '',
        tip: tip,
        podrzana_pisma: JSON.stringify(trenutniJeziciObj || {}),
        aktivan: editAktivan && editAktivan.checked ? '1' : '0',
        napomena: editNapomena ? trim(editNapomena.value) : ''
      };
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      if (jeIzmjena) {
        var id = getSelectedRowId();
        if (id == null) return;
        params.id = String(id);
        postFormData(API_BASE + 'PDF_Fontovi_CRUD_izmjena.php', params, function (res) {
          obradiOdgovor(res, '004');
        });
      } else {
        postFormData(API_BASE + 'PDF_Fontovi_CRUD_upis.php', params, function (res) {
          obradiOdgovor(res, '001');
        });
      }
    });
  }

  function obradiOdgovor(res, kodUspjeha) {
    if (res === 'OK') {
      if (typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(kodUspjeha, [], function () {
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          clearControlsFromSelection();
          osvjeziTablicu();
        });
      } else {
        clearControlsFromSelection();
        osvjeziTablicu();
      }
      return;
    }
    var p = parseResponseCode(res);
    if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
      window.showPorukaModal(p.code, p.code === '002' ? ['Naziv ili pdfmake ključ'] : p.replacements);
    }
  }

  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      postFormData(API_BASE + 'PDF_Fontovi_CRUD_brisanje.php', { id: String(id) }, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') {
            window.showPorukaModal('003', [], function () {
              if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
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
          if (u.origin === window.location.origin) { window.location.href = u.href; return; }
        } catch (e) {}
      }
      if (document.referrer) {
        try {
          var u2 = new URL(document.referrer);
          if (u2.origin === window.location.origin) { window.location.href = u2.href; return; }
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

  /** JSON o -> red tablice [ naziv, pdfmake_kljuc, tip, pisma_str, aktivan, napomena, id, pisma_raw, porodica ]. */
  function redIzJsonZaTablicu(o) {
    var ak = o.aktivan;
    var bitAk = (ak === 1 || ak === true || ak === '1') ? 1 : 0;
    return [
      o.naziv != null ? o.naziv : '',
      o.pdfmake_kljuc != null ? o.pdfmake_kljuc : '',
      o.tip != null ? o.tip : '',
      pismaToText(o.podrzana_pisma),
      bitAk,
      o.napomena != null ? o.napomena : '',
      o.id != null ? o.id : 0,
      o.podrzana_pisma != null ? o.podrzana_pisma : '',
      o.porodica != null ? o.porodica : ''
    ];
  }

  function ucitajPodatkeTablica(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Fontovi_CRUD_sve.php', true);
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
          for (var j = 0; j < arr.length; j++) rows.push(redIzJsonZaTablicu(arr[j]));
          /* Abecedni red po nazivu (hrvatska abeceda: č, ć, š, ž). */
          rows.sort(function (a, b) {
            return String(a[0]).localeCompare(String(b[0]), 'hr', { sensitivity: 'base' });
          });
        } catch (eT) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function osvjeziTablicu() {
    ucitajPodatkeTablica(function (rows) {
      CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_FontoviCRUD.Tablica_Zaglavlje);
    });
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  ucitajPodatkeTablica(function (rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, PDF_FontoviCRUD.Tablica_Zaglavlje);
  });

  /** Puni select „Dostupni fontovi" porodicama iz foldera; mapira porodica -> varijante. */
  function ucitajDostupneFontove() {
    if (!editDostupni) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'PDF_Fontovi_CRUD_dostupni.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var arr = [];
      if (text.charAt(0) === '[') {
        try { arr = JSON.parse(text); } catch (e) {}
      }
      if (!Array.isArray(arr)) arr = [];
      dostupneVarijanteMap = {};
      dostupniJeziciMap = {};
      while (editDostupni.firstChild) editDostupni.removeChild(editDostupni.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi font —';
      editDostupni.appendChild(opt0);
      for (var i = 0; i < arr.length; i++) {
        var por = arr[i] && arr[i].porodica != null ? String(arr[i].porodica) : '';
        if (por === '') continue;
        dostupneVarijanteMap[por] = (arr[i].varijante && Array.isArray(arr[i].varijante)) ? arr[i].varijante : [];
        dostupniJeziciMap[por] = (arr[i].jezici && typeof arr[i].jezici === 'object') ? arr[i].jezici : {};
        var opt = document.createElement('option');
        opt.value = por;
        opt.textContent = por;
        editDostupni.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') {
        try { KontroleRefreshCustomSelect('edit_dostupni_fontovi'); } catch (e) {}
      }
    };
    xhr.send();
  }
  ucitajDostupneFontove();

  /** Promjena „Dostupni fontovi" -> prikaži varijante odabrane porodice u RO polju. */
  function prikaziVarijanteOdabranog() {
    var por = editDostupni ? trim(editDostupni.value) : '';
    if (editVarijante) {
      var varijante = (por !== '' && dostupneVarijanteMap[por]) ? dostupneVarijanteMap[por] : [];
      if (por !== '' && varijante.length) {
        editVarijante.value = varijante.join(', ');
        editVarijante.disabled = false;
      } else {
        editVarijante.value = '';
        editVarijante.disabled = true;
      }
      /* Labela prati disabled stanje kontrole (standardni 0-Kontrole token mehanizam). */
      if (editPanel && typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
    }
    /* Podržana pisma i jezici (RO) — automatski iz detekcije fonta; prazno -> disabled. */
    trenutniJeziciObj = (por !== '' && dostupniJeziciMap[por]) ? dostupniJeziciMap[por] : {};
    azurirajPismaBox();
  }
  if (editDostupni) {
    editDostupni.addEventListener('change', prikaziVarijanteOdabranog);
  }

  updateCrudUpisiState();
  azurirajPismaBox();
  window.PDF_FontoviCRUD = PDF_FontoviCRUD;
})();
