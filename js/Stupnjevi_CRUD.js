/* =========================================================
   Stupnjevi_CRUD.js
   Nova forma: naslov, panel select Obred, panel tablice, treći panel prazan, CRUD tipke.
   Samo funkcionalnosti za panel 1 (select) i panel 2 (tablica). Kopirano iz _old.
   ========================================================= */
// @ts-nocheck
(function () {
  'use strict';
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Stupnjevi_CRUD.html');

// ========== KONSTANTE ==========
// StupnjeviCRUD – konfiguracija forme (Broj_Kolona, Reload_Ikona, CrudCssPrefix, Tablica_Zaglavlje).
//
// Veza s tablicom:
// - Tablica ima Broj_Kolona kolona.
// - Reload_Ikona = 1: dodaje se header panelu tablice; u headeru desno ikona za reload; 0 = nema headera/ikone.
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
// =============================================================================
  const StupnjeviCRUD = {
    Broj_Kolona: 3,
    Reload_Ikona: 0,
    CrudCssPrefix: 'stupnjevi-crud',
    Tablica_Zaglavlje: [
      { key: "naziv", title: "Naziv", SQL_Naziv: "naziv", sortable: 1, sortable_icon: 0, type: "t", width: 0, suffix: "", align: "L", row_align: "L", mobitel_prikaz: 1 },
      { key: "stupanj", title: "Stupanj", SQL_Naziv: "stupanj", sortable: 1, sortable_icon: 0, type: "n", width: -20, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 1 },
      { key: "ima_sliku", title: "Slika", SQL_Naziv: "ima_sliku", sortable: 0, sortable_icon: 0, type: "b", width: 60, suffix: "", align: "C", row_align: "C", mobitel_prikaz: 0, cell_readonly: 1 }
    ]
  };

  var tablicaApi = null;
  var onCrudSelectionChange = null;
  var data = [];

  CommonCRUD.initTablica('tablicaContainer', StupnjeviCRUD, {
    getRowId: function (row) { return row.length > 0 ? row[row.length - 1] : null; },
    onReady: function (api) { tablicaApi = api; },
    onSelectionChange: function () { if (onCrudSelectionChange) onCrudSelectionChange(); }
  });

  function clearControlsFromSelection() {
    var editNaziv = document.getElementById('edit_naziv');
    var editStupanj = document.getElementById('edit_stupanj');
    if (editNaziv) {
      editNaziv.value = '';
      editNaziv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (editStupanj) editStupanj.value = '';
  }

  /** Uklanja sliku iz kontrole za prikaz (preview): revoke blob URL, briše blob/mime, sakriva img, tipka Obriši. Kontrola i panel ostaju iste veličine. */
  function clearSlikaFromControl() {
    var img = document.getElementById('stupnjevi_image_preview');
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
    var delBtn = document.getElementById('stupnjevi_image_delete_btn');
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
        var editStupanj = document.getElementById('edit_stupanj');
        if (editNaziv) {
          editNaziv.value = found.naziv != null ? found.naziv : '';
          editNaziv.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (editStupanj) editStupanj.value = found.stupanj != null ? String(found.stupanj) : '';
      }
    }
    updateCrudUpisiState();
    updateSlikaPreview();
  };

  function updateCrudUpisiState() {
    var imaSelekciju = getSelectedRowId() != null;
    var selectObred = document.getElementById('select_obred');
    var imaObred = selectObred ? (selectObred.value !== '' && selectObred.value !== '0') : false;
    var editNaziv = document.getElementById('edit_naziv');
    var imaSadrzaj = editNaziv ? trim(editNaziv.value) !== '' : false;
    var editPanel = document.getElementById('edit_panel');

    var enableKontrole = imaObred && imaSadrzaj;

    var tablicaEl = document.getElementById('tablicaContainer');
    if (tablicaEl) {
      if (imaObred) tablicaEl.classList.remove('kontrola-tablica--disabled');
      else tablicaEl.classList.add('kontrola-tablica--disabled');
    }

    if (editPanel && typeof KontroleSetEnabled === 'function') {
      KontroleSetEnabled(editPanel, enableKontrole);
      if (editNaziv) {
        var editDeleteWrap = editNaziv.closest('.kontrola-edit-delete');
        if (editDeleteWrap) {
          var input = editDeleteWrap.querySelector('.kontrola-edit-delete__input');
          var clearBtn = editDeleteWrap.querySelector('.kontrola-edit-delete__clear');
          var trebaEditDeleteEnabled = imaObred;
          if (input) input.disabled = !trebaEditDeleteEnabled;
          if (clearBtn) clearBtn.disabled = !trebaEditDeleteEnabled;
          editDeleteWrap.classList.toggle('kontrola-edit-delete--disabled', !trebaEditDeleteEnabled);
        }
        var labelNaziv = document.querySelector('.kontrola-labela[for="edit_naziv"]');
        if (labelNaziv) {
          if (imaObred) labelNaziv.classList.remove('kontrola-labela--disabled');
          else labelNaziv.classList.add('kontrola-labela--disabled');
        }
      }
      var btnPovratak = document.getElementById('btnPovratak');
      if (btnPovratak) btnPovratak.removeAttribute('disabled');
      if (typeof KontroleSyncLabelsDisabledState === 'function') KontroleSyncLabelsDisabledState(editPanel);
    }

    var btnUpisi = document.getElementById('btnUpisi');
    var btnUpisiLabel = btnUpisi ? btnUpisi.querySelector('.kontrola-btn__label') : null;
    var btnIzbrisi = document.getElementById('btnIzbrisi');
    if (btnUpisi && btnUpisiLabel) {
      btnUpisi.classList.toggle('kontrola-btn--crud-izmjeni', imaSelekciju);
      btnUpisiLabel.textContent = imaSelekciju ? 'Izmjeni' : 'Upis';
      btnUpisi.setAttribute('aria-label', imaSelekciju ? 'Izmjeni' : 'Upis');
      btnUpisi.disabled = !(imaObred && imaSadrzaj);
    }
    if (btnIzbrisi) btnIzbrisi.disabled = !imaSelekciju;

    var imageArea = document.getElementById('stupnjevi_image_area');
    if (imageArea) {
      imageArea.classList.toggle('stupnjevi-crud__edit-image-area--disabled', !enableKontrole);
    }
  }

  (function () {
    var editNaziv = document.getElementById('edit_naziv');
    if (!editNaziv) return;
    editNaziv.addEventListener('input', updateCrudUpisiState);
    editNaziv.addEventListener('change', updateCrudUpisiState);
    var wrap = editNaziv.closest('.kontrola-edit-delete');
    if (wrap) {
      wrap.addEventListener('kontrole-edit-delete-clear', function () {
        var editStupanj = document.getElementById('edit_stupanj');
        if (editStupanj) editStupanj.value = '';
        if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
        clearSlikaFromControl();
        updateCrudUpisiState();
      });
    }
  })();

  /** Tipka Povratak: vraća na formu koja je pozvala (ref u URL-u ili document.referrer); u slučaju greške → Meni.php. */
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
          var u = new URL(document.referrer);
          if (u.origin === window.location.origin) {
            window.location.href = u.href;
            return;
          }
        } catch (e) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  if (StupnjeviCRUD.Reload_Ikona === 1) {
    var btnReloadTablica = document.getElementById('btnReloadTablica');
    if (btnReloadTablica) btnReloadTablica.addEventListener('click', osvjeziTablicu);
  }

  /* --- Debug: true = ne šalji u PHP, log u konzolu (slike = veličina u B/KB/MB) --- */
  var STUPNJEVI_CRUD_DEBUG = false;

  function formatSize(bytes) {
    if (bytes == null || isNaN(bytes) || bytes < 0) return { bytes: 0, text: '0 B' };
    var b = Math.floor(bytes);
    if (b < 1024) return { bytes: b, text: b + ' B' };
    if (b < 1024 * 1024) return { bytes: b, text: (b / 1024).toFixed(1) + ' KB' };
    return { bytes: b, text: (b / (1024 * 1024)).toFixed(1) + ' MB' };
  }

  /** Thumb iz bloba: max širina 64px, omjer zadržan. Izlaz image/jpeg (pouzdano u svim preglednicima). Vraća Promise<{ blob, mime }>. */
  function createThumbFromBlob(blob, maxWidthPx) {
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
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Thumb: učitavanje slike nije uspjelo'));
      };
      img.src = url;
    });
  }

  /* --- Blok: listener na Upis – validacija 008/009/010; izmjena → stupnjeviUpdate, inače stupnjeviAdd; poruke 004/001, clear, osvjezi --- */
  var btnUpisi = document.getElementById('btnUpisi');
  if (btnUpisi) {
    btnUpisi.addEventListener('click', function () {
      var editNaziv = document.getElementById('edit_naziv');
      var editStupanj = document.getElementById('edit_stupanj');
      var naziv = editNaziv ? trim(editNaziv.value) : '';
      if (naziv === '') {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['008'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('008', []);
        if (editNaziv) editNaziv.focus();
        return;
      }
      var stupanjVal = editStupanj ? trim(editStupanj.value) : '';
      if (stupanjVal === '') {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['009'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('009', []);
        if (editStupanj) editStupanj.focus();
        return;
      }
      var stupanj = parseInt(stupanjVal, 10);
      if (isNaN(stupanj) || stupanj < 1 || stupanj > 99) {
        if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['010'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('010', []);
        if (editStupanj) editStupanj.focus();
        return;
      }
      var jeIzmjena = this.classList.contains('kontrola-btn--crud-izmjeni');
      var id = jeIzmjena ? getSelectedRowId() : null;
      if (jeIzmjena && id == null) return;
      var obredId = getSelectedObredId();
      if (!obredId || obredId === '0') return;
      var payload = { obred_id: String(obredId), naziv: naziv, stupanj: stupanj };
      if (jeIzmjena) payload.id = String(id);

      if (STUPNJEVI_CRUD_DEBUG) {
        var img = document.getElementById('stupnjevi_image_preview');
        var logPayload = { obred_id: payload.obred_id, naziv: payload.naziv, stupanj: payload.stupanj };
        if (payload.id) logPayload.id = payload.id;
        var blobForLog = img && img._obradaSlikaBlob;
        if (!blobForLog && img && img.src && img.src.indexOf('blob:') === 0) {
          /* Fallback: slika u kontroli je blob URL ali _obradaSlikaBlob nije zapisan – dohvatimo blob */
          blobForLog = null;
          fetch(img.src).then(function (r) { return r.blob(); }).then(function (b) {
            var sz = formatSize(b.size);
            logPayload.slika = sz.text + ' (' + sz.bytes + ' B)';
            logPayload.slika_mime = (b.type && b.type.indexOf('image/') === 0) ? b.type : null;
            return createThumbFromBlob(b, 64);
          }).then(function (thumb) {
            if (thumb && thumb.blob) {
              var tsz = formatSize(thumb.blob.size);
              logPayload.thumb = tsz.text + ' (' + tsz.bytes + ' B)';
              logPayload.thumb_mime = thumb.mime;
            } else {
              logPayload.thumb = null;
              logPayload.thumb_mime = null;
            }
            console.log('[Stupnjevi CRUD debug] Upiši payload:', logPayload);
          }).catch(function () {
            logPayload.slika = null;
            logPayload.slika_mime = null;
            logPayload.thumb = null;
            logPayload.thumb_mime = null;
            console.log('[Stupnjevi CRUD debug] Upiši payload:', logPayload);
          });
          return;
        }
        if (img && blobForLog) {
          var sz = formatSize(img._obradaSlikaBlob.size);
          logPayload.slika = sz.text + ' (' + sz.bytes + ' B)';
          logPayload.slika_mime = img._obradaSlikaMime || null;
          createThumbFromBlob(img._obradaSlikaBlob, 64).then(function (thumb) {
            if (thumb.blob) {
              var tsz = formatSize(thumb.blob.size);
              logPayload.thumb = tsz.text + ' (' + tsz.bytes + ' B)';
              logPayload.thumb_mime = thumb.mime;
            } else {
              logPayload.thumb = null;
              logPayload.thumb_mime = null;
            }
            console.log('[Stupnjevi CRUD debug] Upiši payload:', logPayload);
          }).catch(function () {
            logPayload.thumb = null;
            logPayload.thumb_mime = null;
            console.log('[Stupnjevi CRUD debug] Upiši payload:', logPayload);
          });
        } else {
          logPayload.slika = null;
          logPayload.slika_mime = null;
          logPayload.thumb = null;
          logPayload.thumb_mime = null;
          console.log('[Stupnjevi CRUD debug] Upiši payload:', logPayload);
        }
        return;
      }

      function doSubmit(postPayload) {
        if (jeIzmjena) {
          stupnjeviUpdate(postPayload, function (res) {
            if (res === 'OK') {
              if (typeof window.showPorukaModal === 'function') window.showPorukaModal('004', [], function () {
                clearSlikaFromControl();
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
                clearControlsFromSelection();
                osvjeziTablicu();
              });
            } else {
              var p = parseResponseCode(res);
              if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements || []);
            }
          });
        } else {
          stupnjeviAdd(postPayload, function (res) {
            if (res === 'OK') {
              if (typeof window.showPorukaModal === 'function') window.showPorukaModal('001', [], function () {
                clearSlikaFromControl();
                if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
                clearControlsFromSelection();
                osvjeziTablicu();
              });
            } else {
              var p = parseResponseCode(res);
              if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') window.showPorukaModal(p.code, p.replacements || []);
            }
          });
        }
      }

      var img = document.getElementById('stupnjevi_image_preview');
      if (img && img._obradaSlikaBlob) {
        createThumbFromBlob(img._obradaSlikaBlob, 64).then(function (thumb) {
          var postPayload = { obred_id: payload.obred_id, naziv: payload.naziv, stupanj: payload.stupanj };
          if (payload.id) postPayload.id = payload.id;
          postPayload.slika = img._obradaSlikaBlob;
          postPayload.slika_mime = img._obradaSlikaMime || 'image/webp';
          if (thumb && thumb.blob) {
            postPayload.thumb = thumb.blob;
            postPayload.thumb_mime = thumb.mime || 'image/jpeg';
          }
          doSubmit(postPayload);
        }).catch(function () {
          var p = parseResponseCode('');
          if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['105'] && typeof window.showPorukaModal === 'function') window.showPorukaModal('105', []);
        });
      } else {
        doSubmit(payload);
      }
    });
  }

  /* --- Klik Izbriši: stupnjeviDelete(id), modal 003 na uspjeh, parseResponseCode na grešku (108, 100, 200). --- */
  var btnIzbrisi = document.getElementById('btnIzbrisi');
  if (btnIzbrisi) {
    btnIzbrisi.addEventListener('click', function () {
      var id = getSelectedRowId();
      if (id == null) return;
      stupnjeviDelete(id, function (res) {
        if (res === 'OK') {
          if (typeof window.showPorukaModal === 'function') window.showPorukaModal('003', [], function () {
            clearSlikaFromControl();
            if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
            clearControlsFromSelection();
            osvjeziTablicu();
          });
        } else {
          var p = parseResponseCode(res);
          if (p && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[p.code] && typeof window.showPorukaModal === 'function') {
            window.showPorukaModal(p.code, p.replacements || []);
          }
        }
      });
    });
  }

  /* ========== API ========== */
  var API_BASE = '../php/';

  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  function ucitajObrediSelect(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Obredi_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      var select = document.getElementById('select_obred');
      if (!select) { if (callback) callback(); return; }
      var opts = []; opts.push('<option value="0">Nije izabran</option>');
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text || '[]');
          for (var i = 0; i < arr.length; i++) {
            var id = arr[i].id != null ? arr[i].id : 0;
            var naziv = arr[i].naziv != null ? arr[i].naziv : '';
            opts.push('<option value="' + String(id) + '">' + escapeHtml(naziv) + '</option>');
          }
        } catch (e) {}
      } else if (text !== '') {
        var parsed = parseResponseCode(text);
        if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
          window.showPorukaModal(parsed.code, parsed.replacements || []);
        }
      }
      select.innerHTML = opts.join('');
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_obred');
      if (callback) callback();
    };
    xhr.send();
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function getSelectedObredId() {
    var select = document.getElementById('select_obred');
    return select ? (select.value || '0') : '0';
  }

  function ucitajPodatkeTablica(obredId, callback) {
    if (!obredId || obredId === '0') { data = []; if (callback) callback([]); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Stupnjevi_CRUD_sve.php?obred_id=' + encodeURIComponent(obredId), true);
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
          data = arr;
          for (var i = 0; i < arr.length; i++) {
            rows.push([
              arr[i].naziv != null ? arr[i].naziv : '',
              arr[i].stupanj != null ? arr[i].stupanj : 0,
              (arr[i].ima_sliku != null && arr[i].ima_sliku !== 0) ? 1 : 0,
              arr[i].id != null ? arr[i].id : 0
            ]);
          }
        } catch (e) {}
      }
      if (callback) callback(rows);
    };
    xhr.send();
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  /** POST FormData s blobovima dodanim s filenameom da PHP popuni $_FILES. */
  function postFormDataWithFiles(url, params, callback) {
    var formData = new FormData();
    var key, val, fn;
    for (key in params) {
      if (!params.hasOwnProperty(key)) continue;
      val = params[key];
      if (val instanceof Blob) {
        fn = key === 'slika' ? (params.slika_mime && params.slika_mime.indexOf('png') !== -1 ? 'slika.png' : 'slika.webp') : 'thumb.jpg';
        formData.append(key, val, fn);
      } else {
        formData.append(key, val);
      }
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      callback(xhr.responseText ? xhr.responseText.trim() : '');
    };
    xhr.send(formData);
  }

  function osvjeziTablicu() {
    var obredId = getSelectedObredId();
    ucitajPodatkeTablica(obredId, function (rows) { setDataTablica(rows); });
  }

  function setDataTablica(rows) {
    CommonCRUD.setDataTablica(tablicaApi, 'tablicaContainer', rows, StupnjeviCRUD.Tablica_Zaglavlje);
  }

  function stupnjeviAdd(payload, callback) {
    var post = (payload.slika instanceof Blob || payload.thumb instanceof Blob) ? postFormDataWithFiles : postFormData;
    post(API_BASE + 'Stupnjevi_CRUD_upis.php', payload, callback);
  }

  function stupnjeviUpdate(payload, callback) {
    var post = (payload.slika instanceof Blob || payload.thumb instanceof Blob) ? postFormDataWithFiles : postFormData;
    post(API_BASE + 'Stupnjevi_CRUD_izmjena.php', payload, callback);
  }

  function stupnjeviDelete(id, callback) {
    postFormData(API_BASE + 'Stupnjevi_CRUD_brisanje.php', { id: String(id) }, callback);
  }

  function getSelectedRowId() {
    return CommonCRUD.getSelectedRowId(tablicaApi);
  }

  /* Resize 60/40 kao Loze_CRUD / Clanovi_CRUD; prag = --page_breakpoint_narrow (0-Common.js) */
  function getOneColBreakPx() {
    return typeof window.getPageBreakpointNarrow === 'function' ? window.getPageBreakpointNarrow() : 640;
  }

  var stupnjeviStackModeMqlRef = null;
  var stupnjeviStackModeMqlInited = false;
  function getStupnjeviStackModeMql() {
    if (stupnjeviStackModeMqlInited) return stupnjeviStackModeMqlRef;
    stupnjeviStackModeMqlInited = true;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    try {
      var bp = getOneColBreakPx();
      stupnjeviStackModeMqlRef = window.matchMedia(
        '(max-width: ' + bp + 'px), ((hover: none) and (pointer: coarse) and (max-width: 1200px))'
      );
    } catch (e) {
      stupnjeviStackModeMqlRef = null;
    }
    return stupnjeviStackModeMqlRef;
  }

  function isStupnjeviWideTwoColLayout() {
    var mql = getStupnjeviStackModeMql();
    if (mql) return !mql.matches;
    var bp = getOneColBreakPx();
    return typeof window !== 'undefined' && window.innerWidth > bp;
  }

  function clearStupnjeviSlikaPanelWideLayoutStyles() {
    var panelSlika = document.querySelector('.stupnjevi-crud__panel-slika');
    if (!panelSlika) return;
    panelSlika.style.width = '';
    panelSlika.style.height = '';
    panelSlika.style.minHeight = '';
    panelSlika.style.maxHeight = '';
    panelSlika.style.aspectRatio = '';
  }

  var STUPNJEVI_ASPECT_HEIGHT = 1.3;
  var savedSlikaW = 0;
  var savedSlikaH = 0;
  var savedMaxTablicaHeightFromWide = 0;

  function getPanelTablicaMinHeight() {
    var panel = document.querySelector('.stupnjevi-crud__panel-tablica');
    if (!panel || typeof getComputedStyle !== 'function') return 400;
    var cs = getComputedStyle(panel);
    var minH = parseFloat(cs.minHeight);
    return (isNaN(minH) || minH <= 0) ? 400 : Math.round(minH);
  }

  function getPanelTablicaMaxHeight() {
    var topRow = document.querySelector('.stupnjevi-crud__top-row');
    if (!topRow) return 9999;
    var rowW = topRow.offsetWidth || 0;
    if (rowW <= 0) return 9999;
    var gap = 16;
    var slikaMaxW = (rowW - gap) * 0.6;
    var maxH = Math.floor(slikaMaxW * STUPNJEVI_ASPECT_HEIGHT);
    var viewportCap = typeof window !== 'undefined' && window.innerHeight ? Math.floor(window.innerHeight * 0.9) : 800;
    return Math.min(maxH, viewportCap);
  }

  function sync60_40MaxHeight() {
    var topRow = document.querySelector('.stupnjevi-crud__top-row');
    var panelSlika = document.querySelector('.stupnjevi-crud__panel-slika');
    var panelTablica = document.querySelector('.stupnjevi-crud__panel-tablica');
    if (!topRow || !panelSlika || !panelTablica) return;
    var isWide = isStupnjeviWideTwoColLayout();
    if (!isWide) {
      clearStupnjeviSlikaPanelWideLayoutStyles();
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
    panelSlika.style.aspectRatio = '1/' + String(STUPNJEVI_ASPECT_HEIGHT);
  }

  function setPanelSlikaSizeFromTablica(initialExpand) {
    var panelTablica = document.querySelector('.stupnjevi-crud__panel-tablica');
    var panelSlika = document.querySelector('.stupnjevi-crud__panel-slika');
    var topRow = document.querySelector('.stupnjevi-crud__top-row');
    if (!panelTablica || !panelSlika || !topRow) return;
    var isWide = isStupnjeviWideTwoColLayout();
    if (!isWide) {
      clearStupnjeviSlikaPanelWideLayoutStyles();
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
    var slikaW = Math.floor(H / STUPNJEVI_ASPECT_HEIGHT);
    if (H <= 0) return;
    panelSlika.style.width = slikaW + 'px';
    panelSlika.style.height = H + 'px';
    panelSlika.style.minHeight = H + 'px';
    panelSlika.style.aspectRatio = '1/' + String(STUPNJEVI_ASPECT_HEIGHT);
    if (panelSlika.offsetWidth > 0) savedMaxTablicaHeightFromWide = panelSlika.offsetWidth;
    sync60_40MaxHeight();
  }

  function initPanelTablicaTouchResize() {
    var panel = document.querySelector('.stupnjevi-crud__panel-tablica');
    if (!panel) return;
    var doc = panel.ownerDocument || document;
    var minH = 120;
    var cs = typeof getComputedStyle !== 'undefined' && getComputedStyle(panel).minHeight;
    if (cs && cs !== 'none' && cs !== 'auto') {
      var px = parseFloat(cs);
      if (!isNaN(px) && px > 0) minH = Math.round(px);
    }
    var isWide = isStupnjeviWideTwoColLayout();
    var maxH = 800;
    if (typeof window !== 'undefined') {
      if (isWide) {
        maxH = getPanelTablicaMaxHeight();
      } else {
        var base = savedMaxTablicaHeightFromWide > 0 ? savedMaxTablicaHeightFromWide : minH;
        maxH = Math.round(base * 2);
      }
    }
    var handle = panel.querySelector('.stupnjevi-crud__resize-handle');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'stupnjevi-crud__resize-handle';
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
        var dynamicMaxH = isStupnjeviWideTwoColLayout() ? getPanelTablicaMaxHeight() : maxH;
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

  function setFrameFillArea() {}
  function setFrameToImage() {
    var img = document.getElementById('stupnjevi_image_preview');
    var delBtn = document.getElementById('stupnjevi_image_delete_btn');
    if (img && img.src && img.style.display !== 'none' && delBtn) delBtn.disabled = false;
  }

  function updateSlikaPreview() {
    var img = document.getElementById('stupnjevi_image_preview');
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
      var btn = document.getElementById('stupnjevi_image_delete_btn');
      if (btn) btn.disabled = true;
      return;
    }
    /* Ako već imamo blob u kontroli (iz modala), ostavi prikaz */
    if (img.src && img.src.indexOf('blob:') === 0) {
      var btnBlob = document.getElementById('stupnjevi_image_delete_btn');
      if (btnBlob) btnBlob.disabled = false;
      img.removeEventListener('load', onSlikaLoad);
      img.addEventListener('load', onSlikaLoad);
      if (img.complete) onSlikaLoad();
      else setFrameFillArea();
      return;
    }
    /* Kad je selektiran red: učitaj sliku s servera, pretvori u blob i prikaži u kontroli (da se može i poslati pri Izmjeni). */
    var url = API_BASE + 'Stupnjevi_CRUD_slika.php?id=' + encodeURIComponent(id) + '&t=' + (Date.now ? Date.now() : 0);
    img._obradaSlikaBlob = null;
    img._obradaSlikaMime = null;
    img.removeAttribute('src');
    img.alt = '';
    img.style.display = 'none';
    var delBtn = document.getElementById('stupnjevi_image_delete_btn');
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
      img.alt = 'Slika stupnja';
      img.style.display = '';
      img.removeEventListener('load', onSlikaLoad);
      img.addEventListener('load', onSlikaLoad);
      if (delBtn) delBtn.disabled = false;
      if (img.complete) onSlikaLoad();
      else setFrameFillArea();
    }).catch(function () {});
  }

  function onSlikaLoad() {
    var btn = document.getElementById('stupnjevi_image_delete_btn');
    if (btn) btn.disabled = false;
    setFrameToImage();
  }

  function trim(s) {
    return window.CommonTrim ? window.CommonTrim(s) : (s != null ? String(s).replace(/^\s+|\s+$/g, '') : '');
  }

  function initForma() {
    var delBtn = document.getElementById('stupnjevi_image_delete_btn');
    var imgPreview = document.getElementById('stupnjevi_image_preview');
    if (delBtn && imgPreview) {
      delBtn.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
      delBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (delBtn.disabled) return;
        clearSlikaFromControl();
      });
    }
    if (typeof window.ObradaSlikaInit === 'function') {
      window.ObradaSlikaInit({
        idPrefix: 'stupnjevi_modal_slika',
        templateUrl: '0-Obrada_Slike.php',
        mountSelector: '#obrada_slika_mount',
        getSelectedId: getSelectedRowId,
        getEditFormRowId: getSelectedRowId,
        apiBase: API_BASE,
        imageUrlPath: 'Stupnjevi_CRUD_slika.php',
        imageAreaId: 'stupnjevi_image_area',
        focusAfterCloseId: 'edit_naziv',
        imageAreaDisabledClass: 'stupnjevi-crud__edit-image-area--disabled',
        imagePreviewElement: document.getElementById('stupnjevi_image_preview'),
        parseResponseCode: parseResponseCode,
        fixedRatioX: 1,
        fixedRatioY: 1.3,
        ratioInputsDisabled: true
      });
    }
    ucitajObrediSelect(function () {
      var select = document.getElementById('select_obred');
      if (select) {
        var wrap = select.closest('.kontrola-select');
        if (wrap) {
          wrap.addEventListener('click', function (e) {
            if (select.options.length <= 1) {
              if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['012'] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('012', []);
              }
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
            }
          }, true);
        } else {
          select.addEventListener('click', function (e) {
            if (select.options.length <= 1) {
              if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['012'] && typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('012', []);
              }
              e.preventDefault();
              e.stopPropagation();
            }
          });
        }
        select.addEventListener('change', function () {
          osvjeziTablicu();
          if (tablicaApi && typeof tablicaApi.clearSelection === 'function') tablicaApi.clearSelection();
          updateCrudUpisiState();
          updateSlikaPreview();
        });
      }
      osvjeziTablicu();
      updateCrudUpisiState();
      updateSlikaPreview();
      setPanelSlikaSizeFromTablica(true);
    });

    if (typeof ResizeObserver !== 'undefined') {
      var panelTablica = document.querySelector('.stupnjevi-crud__panel-tablica');
      if (panelTablica) {
        var ro = new ResizeObserver(function () {
          requestAnimationFrame(function () { setPanelSlikaSizeFromTablica(false); });
        });
        ro.observe(panelTablica);
      }
    }
    var lastWide = isStupnjeviWideTwoColLayout();
    function stupnjeviOnViewportLayoutChange() {
      var nowWide = isStupnjeviWideTwoColLayout();
      if (!nowWide) clearStupnjeviSlikaPanelWideLayoutStyles();
      var panelSlika = document.querySelector('.stupnjevi-crud__panel-slika');
      if (!panelSlika) { lastWide = nowWide; return; }
      if (lastWide && !nowWide) {
        if (panelSlika.offsetWidth > 0) savedMaxTablicaHeightFromWide = panelSlika.offsetWidth;
        applyOneColSlika(panelSlika);
        var panelTablica = document.querySelector('.stupnjevi-crud__panel-tablica');
        if (panelTablica) {
          panelTablica.style.height = '';
          panelTablica.style.maxHeight = '';
        }
      } else if (!lastWide && nowWide) {
        restoreSlikaDimensions(panelSlika);
        var panelTablica = document.querySelector('.stupnjevi-crud__panel-tablica');
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
    }
    window.addEventListener('resize', function () {
      requestAnimationFrame(stupnjeviOnViewportLayoutChange);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { requestAnimationFrame(stupnjeviOnViewportLayoutChange); }, 200);
    });
    var stupnjeviStackMql = getStupnjeviStackModeMql();
    if (stupnjeviStackMql) {
      var onStupnjeviStackMqlChange = function () {
        requestAnimationFrame(stupnjeviOnViewportLayoutChange);
      };
      if (stupnjeviStackMql.addEventListener) stupnjeviStackMql.addEventListener('change', onStupnjeviStackMqlChange);
      else if (stupnjeviStackMql.addListener) stupnjeviStackMql.addListener(onStupnjeviStackMqlChange);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(stupnjeviOnViewportLayoutChange);
    });

    setTimeout(initPanelTablicaTouchResize, 0);
    setTimeout(initPanelTablicaTouchResize, 400);
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

  window.StupnjeviCRUD = StupnjeviCRUD;
})();
