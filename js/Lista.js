/* =========================================================
   Lista.js
   Forma "Lista članova" – tablica, select, paginacija, Traži (debounce iz var. 114),
   thumb slike u batchu (Lista_batch_thumbnails.php; prozor stranica var. 117, nav delay 118).
   Učitava se uz 0-Common.js (preusmjerenje na prijavu pri 401 s API-ja).
   ========================================================= */

(function () {
  'use strict';

  /**
   * Tablica_Zaglavlje – konstanta za definiciju kolona zaglavlja.
   * Svaki element niza = jedna kolona. Parametri 1–12:
   *   1. title       – naslov u prvom redu zaglavlja (string)
   *   2. titleRow2   – naslov u drugom redu (string, opcionalno)
   *   3. colspan     – colspan u zaglavlju (number, default 1)
   *   4. rowspan     – rowspan u zaglavlju (number, default 1)
   *   5. align       – poravnanje: 'l'|'c'|'r' (left, center, right)
   *   6. width       – širina kolone: '80px' fiksno, '15%' postotak, 0 dijeli preostali prostor s ostalim kolonama koje imaju 0
   *   7. type        – tip ćelije: 't' tekst, 'n' broj, 'd' datum, 'img' slika+tekst
   *   8. sortable    – 0 ili 1, je li kolona sortabilna
   *   9. minWidth    – minimalna širina (string, opcionalno)
   *  10. maxWidth    – maksimalna širina (string, opcionalno)
   *  11. rezerva     – za buduće proširenje
   *  12. mobitel_prikaz (0–255, default 1) – Prikaz kolone na mobilnim uređajima. 0 = ne prikazuje se, 1 = prikazuje se.
   */
  var Tablica_Zaglavlje = [
    { title: 'Slika', titleRow2: '', colspan: 1, rowspan: 2, align: 'c', width: '65px', type: 'img', sortable: 0, field: 'img', field2: 'line1', mobitel_prikaz: 1 },
    { title: 'Prezime', titleRow2: 'Ime', colspan: 1, rowspan: 1, align: 'l', width: '18%', type: 't', sortable: 1, field: 'Ime', field2: 'Prezime', titleField: 'Prezime', titleRow2Field: 'Ime', sortField: 'Prezime', sortField2: 'Ime', mobitel_prikaz: 1 },
    { title: 'St.', titleRow2: '', colspan: 1, rowspan: 2, align: 'c', width: '60px', type: 't', sortable: 1, field: 'Stupanj', mobitel_prikaz: 1 },
    { title: 'Logo', titleRow2: '', colspan: 1, rowspan: 2, align: 'c', width: '65px', type: 'logo', sortable: 0, field: 'logo', mobitel_prikaz: 0 },
    { title: 'Loža', titleRow2: 'Grad', colspan: 1, rowspan: 1, align: 'l', width: '15%', type: 't', sortable: 1, field: 'Loža', field2: 'Grad', titleField: 'Loža', titleRow2Field: 'Grad', sortField: 'Loža', sortField2: 'Grad', mobitel_prikaz: 0 },
    { title: 'Telefon', titleRow2: 'e-mail', colspan: 1, rowspan: 1, align: 'l', width: '25%', type: 't', sortable: 0, field: 'Telefon', field2: 'Email', titleField: 'Telefon', titleRow2Field: 'Email', mobitel_prikaz: 0 },
    { title: 'Rođendan', titleRow2: 'Spol', colspan: 1, rowspan: 1, align: 'l', width: 0, type: 't', sortable: 1, field: 'Rođendan', field2: 'Spol', titleField: 'Rođendan', titleRow2Field: 'Spol', mobitel_prikaz: 0 }
  ];

  var container = document.getElementById('listaTablicaContainer');
  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');
  var selectBrojRedaka = document.getElementById('select_broj_redaka');
  var editListaTrazi = document.getElementById('edit_lista_trazi');
  var btnBackward = document.getElementById('btn_backward');
  var btnPrev = document.getElementById('btn_prev');
  var btnNext = document.getElementById('btn_next');
  var btnForward = document.getElementById('btn_forward');
  var editSpan = document.getElementById('listaEdit');
  var redovaSpan = document.getElementById('listaRedova');

  var trenutnaStranica = 1;
  var ukupnoStranica = 1;
  var podaci = [];
  var filtriraniPodaci = [];
  var currentLogoUrl = '';
  var sortCol = -1;
  var sortDir = 1;

  var API_BASE = '../php/';
  var LISTA_RELOAD_IKONA = 1;  /* 1 = reload ikona desno od selecta Redaka; 0 = nema */

  /** sustav_varijable: 117 = prozor stranica ±X za batch thumbove; 118 = cooldown navigacije (ms). Ako API ne učita → 300 ms. */
  var LISTA_VAR_BAFER_STRANICA = 117;
  var LISTA_VAR_NAV_DELAY_MS = 118;
  var _listaBaferStranicaX = 3;
  var _listaNavDelayMs = 300;
  var _listaThumbByClanId = {};
  var _listaThumbByLozaId = {};
  var _listaThumbBatchLoading = false;
  var _listaThumbBatchGen = 0;
  var _listaNavLockUntil = 0;
  var _listaKandidatBojaFg = '';
  var _listaKandidatBojaBg = '';

  function listaBojaToStyle(c) {
    var s = String(c || '').trim().replace(/^#/, '');
    if (s.length === 8) {
      var r = parseInt(s.slice(0,2),16), g = parseInt(s.slice(2,4),16),
          b = parseInt(s.slice(4,6),16), a = parseInt(s.slice(6,8),16) / 255;
      if (!isNaN(r+g+b+a)) return 'rgba('+r+','+g+','+b+','+a.toFixed(3)+')';
    }
    if (s.length === 6) return '#'+s;
    return '';
  }

  function listaTrimApiText(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  function listaDataUrlFromMimeB64(mime, b64) {
    if (!mime || !b64) return '';
    return 'data:' + mime + ';base64,' + b64;
  }

  function listaThumbSrcClan(id) {
    if (id == null || id === '') return '';
    var k = String(id);
    return _listaThumbByClanId[k] || '';
  }

  function listaThumbSrcLoza(idLoza) {
    if (idLoza == null || idLoza === '') return '';
    var k = String(idLoza);
    return _listaThumbByLozaId[k] || '';
  }

  function listaJeNavBlokiran() {
    if (_listaThumbBatchLoading) return true;
    try {
      if (Date.now() < _listaNavLockUntil) return true;
    } catch (eNav) {}
    return false;
  }

  function listaTouchNavLock() {
    try {
      _listaNavLockUntil = Date.now() + Math.max(0, _listaNavDelayMs);
    } catch (eL) {}
    osvjeziPaginaciju();
    try {
      setTimeout(function () { osvjeziPaginaciju(); }, _listaNavDelayMs + 10);
    } catch (eT) {}
  }

  function listaOsvjeziNavButtonsStanje() {
    var blok = listaJeNavBlokiran();
    var prazna = filtriraniPodaci.length === 0;
    var atStart = trenutnaStranica <= 1;
    var atEnd = trenutnaStranica >= ukupnoStranica;
    if (btnBackward) btnBackward.disabled = prazna || atStart || blok;
    if (btnPrev) btnPrev.disabled = prazna || atStart || blok;
    if (btnNext) btnNext.disabled = prazna || atEnd || blok;
    if (btnForward) btnForward.disabled = prazna || atEnd || blok;
  }

  /** Jednokratno učitava 117 i 118 (common_sustav_varijable.php). */
  function listaUcitajSustav117118(callback) {
    var left = 2;
    var fin = function () {
      left--;
      if (left <= 0 && typeof callback === 'function') callback();
    };
    var url117 = API_BASE.replace(/\/?$/, '/') + 'common_sustav_varijable.php?id=' + LISTA_VAR_BAFER_STRANICA;
    var xhr1 = new XMLHttpRequest();
    xhr1.open('GET', url117, true);
    xhr1.onreadystatechange = function () {
      if (xhr1.readyState !== 4) return;
      var raw = listaTrimApiText(xhr1.responseText || '');
      if (xhr1.status === 200 && raw !== '' && raw !== '100' && raw !== '120') {
        var n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 0 && n <= 50) _listaBaferStranicaX = n;
      }
      fin();
    };
    xhr1.send();
    var url118 = API_BASE.replace(/\/?$/, '/') + 'common_sustav_varijable.php?id=' + LISTA_VAR_NAV_DELAY_MS;
    var xhr2 = new XMLHttpRequest();
    xhr2.open('GET', url118, true);
    xhr2.onreadystatechange = function () {
      if (xhr2.readyState !== 4) return;
      var raw = listaTrimApiText(xhr2.responseText || '');
      if (xhr2.status === 200 && raw !== '' && raw !== '100' && raw !== '120') {
        var n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 0 && n <= 60000) _listaNavDelayMs = n;
      }
      fin();
    };
    xhr2.send();
  }

  function listaPrimijeniBatchOdgovor(clanovi, loze) {
    var k;
    if (clanovi && typeof clanovi === 'object') {
      for (k in clanovi) {
        if (!Object.prototype.hasOwnProperty.call(clanovi, k)) continue;
        var c = clanovi[k];
        if (!c || !c.b64) continue;
        var du = listaDataUrlFromMimeB64(c.mime || 'image/jpeg', c.b64);
        if (du) _listaThumbByClanId[String(k)] = du;
      }
    }
    if (loze && typeof loze === 'object') {
      for (k in loze) {
        if (!Object.prototype.hasOwnProperty.call(loze, k)) continue;
        var z = loze[k];
        if (!z || !z.b64) continue;
        var duz = listaDataUrlFromMimeB64(z.mime || 'image/jpeg', z.b64);
        if (duz) _listaThumbByLozaId[String(k)] = duz;
      }
    }
  }

  /**
   * Iz filtriranih podataka i trenutne stranice: prozor N±X, eviction članovskog cachea,
   * batch POST ako treba nedostajući thumbovi (bez GET bursta).
   */
  function listaPrefetchThumbsZaProzor() {
    if (!filtriraniPodaci.length) return;

    var myGen = ++_listaThumbBatchGen;
    var br = getBrojRedaka();
    var X = _listaBaferStranicaX;
    var pFrom = Math.max(1, trenutnaStranica - X);
    var pTo = Math.min(ukupnoStranica, trenutnaStranica + X);

    var neededClan = {};
    var neededLoza = {};
    var pi;
    var pj;
    for (pi = pFrom; pi <= pTo; pi++) {
      var start = (pi - 1) * br;
      var end = Math.min(start + br, filtriraniPodaci.length);
      for (pj = start; pj < end; pj++) {
        var row = filtriraniPodaci[pj];
        if (row && row.id != null && row.id !== '') neededClan[String(row.id)] = true;
        if (row && row.loza != null && row.loza !== '') neededLoza[String(row.loza)] = true;
      }
    }

    for (var ck in _listaThumbByClanId) {
      if (!Object.prototype.hasOwnProperty.call(_listaThumbByClanId, ck)) continue;
      if (!neededClan[ck]) delete _listaThumbByClanId[ck];
    }

    var idClanovi = [];
    var idLoze = [];
    for (ck in neededClan) {
      if (!Object.prototype.hasOwnProperty.call(neededClan, ck)) continue;
      if (!_listaThumbByClanId[ck]) {
        var ic = parseInt(ck, 10);
        if (!isNaN(ic) && ic > 0) idClanovi.push(ic);
      }
    }
    for (var lk in neededLoza) {
      if (!Object.prototype.hasOwnProperty.call(neededLoza, lk)) continue;
      if (!_listaThumbByLozaId[lk]) {
        var il = parseInt(lk, 10);
        if (!isNaN(il) && il > 0) idLoze.push(il);
      }
    }

    if (idClanovi.length === 0 && idLoze.length === 0) {
      osvjeziTablicu({ skipThumbPrefetch: true });
      return;
    }

    _listaThumbBatchLoading = true;
    listaOsvjeziNavButtonsStanje();

    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE.replace(/\/?$/, '/') + 'Lista_batch_thumbnails.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      _listaThumbBatchLoading = false;
      listaOsvjeziNavButtonsStanje();

      if (myGen !== _listaThumbBatchGen) {
        listaPrefetchThumbsZaProzor();
        return;
      }

      var text = listaTrimApiText(xhr.responseText || '');
      if (xhr.status !== 200 || !text || text.charAt(0) !== '{') {
        osvjeziTablicu({ skipThumbPrefetch: true });
        return;
      }
      var resp;
      try {
        resp = JSON.parse(text);
      } catch (eJ) {
        osvjeziTablicu({ skipThumbPrefetch: true });
        return;
      }
      if (!resp || !resp.ok) {
        osvjeziTablicu({ skipThumbPrefetch: true });
        return;
      }
      listaPrimijeniBatchOdgovor(resp.clanovi, resp.loze);
      osvjeziTablicu({ skipThumbPrefetch: true });
    };
    try {
      xhr.send(JSON.stringify({ id_clanovi: idClanovi, id_loze: idLoze }));
    } catch (eSend) {
      _listaThumbBatchLoading = false;
      listaOsvjeziNavButtonsStanje();
    }
  }

  function getToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Vraća datum u formatu "ImeDana, dd.mm.yyyy" (npr. "Ponedjeljak, 15.03.1980"). */
  function formatDatumSDanom(isoStr) {
    if (!isoStr) return '';
    var parts = String(isoStr).split(/[-/]/);
    if (parts.length < 3) return String(isoStr);
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var dd = parts[2];
    var mm = parts[1];
    var yyyy = parts[0];
    var datumStr = dd + '.' + mm + '.' + yyyy;
    if (isNaN(y) || isNaN(m) || isNaN(d)) return datumStr;
    var date = new Date(y, m, d);
    var days = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
    var dayName = days[date.getDay()];
    return dayName + ', ' + datumStr;
  }

  function getBrojRedaka() {
    var v = parseInt(selectBrojRedaka.value, 10);
    return isNaN(v) || v < 1 ? 10 : v;
  }

  var TABLICA_HEAD_H = 32.5;
  var TABLICA_ROW_H = 65;
  var TABLICA_EXTRA_VRLO_MALO = 4;
  var TABLICA_EXTRA_MALO = 8;
  var TABLICA_EXTRA_VELIKO = 18;

  function postaviVidljivihRedova(n) {
    if (!container || !container.style) return;
    container.style.setProperty('--tablica_vidljivih_redova', String(n));
    var extra = n <= 5 ? TABLICA_EXTRA_VRLO_MALO : (n <= 10 ? TABLICA_EXTRA_MALO : TABLICA_EXTRA_VELIKO);
    var totalH = TABLICA_HEAD_H * 2 + TABLICA_ROW_H * n + extra;
    var scrollH = TABLICA_ROW_H * n + extra;
    container.style.setProperty('--tablica_ukupna_visina', Math.ceil(totalH) + 'px');
    container.style.setProperty('--tablica_scroll_visina', Math.ceil(scrollH) + 'px');
  }

  function parseColWidth(col) {
    var v = col.width;
    if (v === 0 || v === '0') return null;
    var w = (v || '').toString().trim();
    if (!w) return null;
    if (w.endsWith('px') || w.endsWith('%')) return w;
    return w;
  }

  function iscrtajZaglavlje() {
    var inner = document.createElement('div');
    inner.className = 'lista-tablica__inner';

    var headerDiv = document.createElement('div');
    headerDiv.className = 'lista-tablica__header';

    var table = document.createElement('table');
    var colgroup = document.createElement('colgroup');
    Tablica_Zaglavlje.forEach(function (col, colIdx) {
      var c = document.createElement('col');
      var w = parseColWidth(col);
      if (w) c.style.width = w;
      if ((col.mobitel_prikaz || 1) === 0) c.className = 'lista-tablica__col--mob-hide';
      else if (colIdx === 0 || colIdx === 2) c.classList.add('lista-tablica__col--mob-65');
      colgroup.appendChild(c);
    });
    table.appendChild(colgroup);

    var thead = document.createElement('thead');
    var tr1 = document.createElement('tr');
    var tr2 = document.createElement('tr');
    var colsRow2 = [];

    Tablica_Zaglavlje.forEach(function (col, colIdx) {
      var th = document.createElement('th');
      th.style.textAlign = col.align === 'r' ? 'right' : (col.align === 'c' ? 'center' : 'left');
      th.textContent = col.type === 'logo' ? (col.title || 'Logo') : (col.title || '');
      if ((col.mobitel_prikaz || 1) === 0) th.classList.add('lista-tablica__col--mob-hide');
      else if (colIdx === 0 || colIdx === 2) th.classList.add('lista-tablica__col--mob-65');
      if (col.sortable) {
        th.classList.add('lista-tablica__th--sortable');
        th.dataset.sortField = col.titleField || col.sortField || col.field;
        th.dataset.sortField2 = (col.titleRow2Field || col.sortField2 || col.field2) || '';
      }
      if (col.colspan > 1) th.colSpan = col.colspan;
      if (col.rowspan > 1) {
        th.rowSpan = col.rowspan;
        tr1.appendChild(th);
      } else {
        tr1.appendChild(th);
        var th2 = document.createElement('th');
        th2.textContent = col.titleRow2 || '';
        th2.style.textAlign = col.align === 'r' ? 'right' : (col.align === 'c' ? 'center' : 'left');
        if ((col.mobitel_prikaz || 1) === 0) th2.classList.add('lista-tablica__col--mob-hide');
        if (col.sortable) {
          th2.classList.add('lista-tablica__th--sortable');
          th2.dataset.sortField = col.titleRow2Field || col.sortField2 || col.field2 || col.sortField || col.field;
          th2.dataset.sortField2 = col.titleField || col.sortField || col.field;
        }
        colsRow2.push(th2);
      }
    });

    thead.appendChild(tr1);
    if (colsRow2.length > 0) {
      colsRow2.forEach(function (th) { tr2.appendChild(th); });
      thead.appendChild(tr2);
    }
    table.appendChild(thead);
    headerDiv.appendChild(table);
    inner.appendChild(headerDiv);

    var scrollWrap = document.createElement('div');
    scrollWrap.className = 'lista-tablica__scroll-wrap';
    var scrollDiv = document.createElement('div');
    scrollDiv.className = 'lista-tablica__scroll';
    scrollDiv.setAttribute('tabindex', '0');
    var tableBody = document.createElement('table');
    var colgroupBody = document.createElement('colgroup');
    Tablica_Zaglavlje.forEach(function (col, colIdx) {
      var c = document.createElement('col');
      var w = parseColWidth(col);
      if (w) c.style.width = w;
      if ((col.mobitel_prikaz || 1) === 0) c.className = 'lista-tablica__col--mob-hide';
      else if (colIdx === 0 || colIdx === 2) c.classList.add('lista-tablica__col--mob-65');
      colgroupBody.appendChild(c);
    });
    tableBody.appendChild(colgroupBody);
    var tbody = document.createElement('tbody');
    tableBody.appendChild(tbody);
    scrollDiv.appendChild(tableBody);
    scrollWrap.appendChild(scrollDiv);
    inner.appendChild(scrollWrap);

    container.innerHTML = '';
    container.appendChild(inner);
    return tbody;
  }

  var DETALJI_STORAGE_KEY = 'lista-detalji-panel';
  var LISTA_BROJ_REDAKA_KEY = 'lista-broj-redaka';
  var DETALJI_GRUPE_STORAGE_KEY = 'lista-detalji-grupe';
  var DETALJI_DEFAULT_W = 420;
  var DETALJI_DEFAULT_H = Math.round(DETALJI_DEFAULT_W * 1.5);
  var listaTelefonTipoviData = [];
  var listaEmailTipoviData = [];
  var listaAdreseTipoviData = [];

  function getDetaljiGrupeState() {
    try {
      var s = localStorage.getItem(DETALJI_GRUPE_STORAGE_KEY);
      if (s) {
        var o = JSON.parse(s);
        if (o && typeof o === 'object') return o;
      }
    } catch (e) {}
    return null;
  }

  function saveDetaljiGrupeState(state) {
    try {
      localStorage.setItem(DETALJI_GRUPE_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function getDetaljiPanelState() {
    try {
      var s = localStorage.getItem(DETALJI_STORAGE_KEY);
      if (s) {
        var o = JSON.parse(s);
        if (o && typeof o.left === 'number' && typeof o.top === 'number' && typeof o.width === 'number' && typeof o.height === 'number') {
          return o;
        }
      }
    } catch (e) {}
    return null;
  }

  function saveDetaljiPanelState(left, top, width, height) {
    try {
      localStorage.setItem(DETALJI_STORAGE_KEY, JSON.stringify({ left: left, top: top, width: width, height: height }));
    } catch (e) {}
  }

  function ucitajListaTelefonTipovi(callback) {
    if (listaTelefonTipoviData.length > 0) {
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Telefoni_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { listaTelefonTipoviData = JSON.parse(text); } catch (e) { listaTelefonTipoviData = []; }
      } else {
        listaTelefonTipoviData = [];
      }
      if (callback) callback();
    };
    xhr.send();
  }

  function buildListaTelefonGrupaHtml(telefoni, tipovi) {
    if (!telefoni || telefoni.length === 0) {
      return '<p class="lista-detalji-grupa__red">Nema upisanih telefona u bazi</p>';
    }
    var byTip = {};
    telefoni.forEach(function (t) {
      var idTip = t.id_telefoni_tip != null ? String(t.id_telefoni_tip) : '';
      if (!byTip[idTip]) byTip[idTip] = [];
      byTip[idTip].push(t.telefon != null ? String(t.telefon) : '');
    });
    var tipIds = Object.keys(byTip);
    tipIds.sort(function (a, b) {
      if (a === '1') return -1;
      if (b === '1') return 1;
      return (a || '').localeCompare(b || '');
    });
    var html = '';
    tipIds.forEach(function (idTip) {
      var tipObj = tipovi && tipovi.find(function (tt) { return tt.id != null && String(tt.id) === idTip; });
      var naziv = tipObj && tipObj.naziv != null ? String(tipObj.naziv) : (idTip ? 'Tip ' + idTip : '—');
      html += '<p class="lista-detalji-grupa__red lista-detalji-grupa__red--telefon-tip">' + naziv + '</p>';
      byTip[idTip].forEach(function (broj) {
        if (broj) html += '<p class="lista-detalji-grupa__red lista-detalji-grupa__red--telefon-broj">' + broj + '</p>';
      });
    });
    return html || '<p class="lista-detalji-grupa__red">Nema upisanih telefona u bazi</p>';
  }

  function ucitajListaEmailTipovi(callback) {
    if (listaEmailTipoviData.length > 0) {
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Email_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { listaEmailTipoviData = JSON.parse(text); } catch (e) { listaEmailTipoviData = []; }
      } else {
        listaEmailTipoviData = [];
      }
      if (callback) callback();
    };
    xhr.send();
  }

  function buildListaEmailGrupaHtml(emails, tipovi) {
    if (!emails || emails.length === 0) {
      return '<p class="lista-detalji-grupa__red">Nema upisanih e-mail adresa u bazi</p>';
    }
    var byTip = {};
    emails.forEach(function (e) {
      var idTip = e.id_email_tip != null ? String(e.id_email_tip) : '';
      if (!byTip[idTip]) byTip[idTip] = [];
      byTip[idTip].push(e.email != null ? String(e.email) : '');
    });
    var tipIds = Object.keys(byTip);
    tipIds.sort(function (a, b) {
      if (a === '1') return -1;
      if (b === '1') return 1;
      return (a || '').localeCompare(b || '');
    });
    var html = '';
    tipIds.forEach(function (idTip) {
      var tipObj = tipovi && tipovi.find(function (tt) { return tt.id != null && String(tt.id) === idTip; });
      var naziv = tipObj && tipObj.naziv != null ? String(tipObj.naziv) : (idTip ? 'Tip ' + idTip : '—');
      html += '<p class="lista-detalji-grupa__red lista-detalji-grupa__red--telefon-tip">' + naziv + '</p>';
      byTip[idTip].forEach(function (addr) {
        if (addr) html += '<p class="lista-detalji-grupa__red lista-detalji-grupa__red--email-broj">' + addr + '</p>';
      });
    });
    return html || '<p class="lista-detalji-grupa__red">Nema upisanih e-mail adresa u bazi</p>';
  }

  function ucitajListaAdreseTipovi(callback) {
    if (listaAdreseTipoviData.length > 0) {
      if (callback) callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Adrese_Tip_CRUD_sve.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try { listaAdreseTipoviData = JSON.parse(text); } catch (e) { listaAdreseTipoviData = []; }
      } else {
        listaAdreseTipoviData = [];
      }
      if (callback) callback();
    };
    xhr.send();
  }

  function formatAdresaLine(row) {
    var parts = [];
    if (row.adresa_1) parts.push(row.adresa_1);
    if (row.adresa_2) parts.push(row.adresa_2);
    if (row.grad) parts.push(row.grad);
    if (row.posta) parts.push(row.posta);
    return parts.join(', ') || '—';
  }

  function buildListaAdreseGrupaHtml(adrese, tipovi) {
    if (!adrese || adrese.length === 0) {
      return '<p class="lista-detalji-grupa__red">Nema upisanih adresa u bazi</p>';
    }
    var byTip = {};
    adrese.forEach(function (a) {
      var idTip = a.id_adrese_tip != null ? String(a.id_adrese_tip) : '';
      if (!byTip[idTip]) byTip[idTip] = [];
      byTip[idTip].push(formatAdresaLine(a));
    });
    var tipIds = Object.keys(byTip);
    tipIds.sort(function (a, b) {
      if (a === '1') return -1;
      if (b === '1') return 1;
      return (a || '').localeCompare(b || '');
    });
    var html = '';
    tipIds.forEach(function (idTip) {
      var tipObj = tipovi && tipovi.find(function (tt) { return tt.id != null && String(tt.id) === idTip; });
      var naziv = tipObj && tipObj.naziv != null ? String(tipObj.naziv) : (idTip ? 'Tip ' + idTip : '—');
      html += '<p class="lista-detalji-grupa__red lista-detalji-grupa__red--telefon-tip">' + naziv + '</p>';
      byTip[idTip].forEach(function (line) {
        if (line) html += '<p class="lista-detalji-grupa__red lista-detalji-grupa__red--adresa-broj">' + line + '</p>';
      });
    });
    return html || '<p class="lista-detalji-grupa__red">Nema upisanih adresa u bazi</p>';
  }

  function ensureDetaljiPanel() {
    var modal = document.getElementById('listaDetaljiModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'listaDetaljiModal';
    modal.className = 'lista-detalji-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'listaDetaljiHeader');

    var overlay = document.createElement('div');
    overlay.className = 'lista-detalji-modal__overlay';

    var dialog = document.createElement('div');
    dialog.className = 'lista-detalji-modal__dialog';
    dialog.id = 'listaDetaljiDialog';

    var header = document.createElement('div');
    header.className = 'lista-detalji-dialog__header';
    header.id = 'listaDetaljiHeader';
    header.textContent = 'Detalji o članu';

    var body = document.createElement('div');
    body.className = 'lista-detalji-dialog__body';
    body.id = 'listaDetaljiBody';

    var resizeBar = document.createElement('div');
    resizeBar.className = 'lista-detalji-dialog__resize-bar';
    resizeBar.setAttribute('aria-label', 'Povuci za promjenu visine');

    var footer = document.createElement('div');
    footer.className = 'lista-detalji-dialog__footer';
    var btnPovratak = document.createElement('button');
    btnPovratak.type = 'button';
    btnPovratak.className = 'lista-btn lista-btn--povratak';
    btnPovratak.setAttribute('aria-label', 'Povratak');
    btnPovratak.innerHTML = '<span class="lista-btn__outer"><span class="lista-btn__inner"><span class="lista-btn__label">Povratak</span></span></span>';
    btnPovratak.addEventListener('click', closeDetaljiPanel);

    footer.appendChild(btnPovratak);
    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(resizeBar);
    dialog.appendChild(footer);
    modal.appendChild(overlay);
    modal.appendChild(dialog);

    var state = getDetaljiPanelState();
    var w = state ? state.width : DETALJI_DEFAULT_W;
    var h = state ? state.height : DETALJI_DEFAULT_H;
    if (state) {
      dialog.style.left = state.left + 'px';
      dialog.style.top = state.top + 'px';
      dialog.style.transform = 'none';
    } else {
      dialog.style.left = '50%';
      dialog.style.top = '50%';
      dialog.style.transform = 'translate(-50%, -50%)';
    }
    dialog.style.width = w + 'px';
    dialog.style.height = h + 'px';

    initDetaljiPanelDrag(header, dialog);
    initDetaljiPanelResize(resizeBar, dialog);

    document.body.appendChild(modal);
    return modal;
  }

  function initDetaljiPanelDrag(header, dialog) {
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
        saveDetaljiPanelState(parseFloat(dialog.style.left), parseFloat(dialog.style.top), dialog.offsetWidth, dialog.offsetHeight);
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

  function initDetaljiPanelResize(bar, dialog) {
    var minH = 180;
    function start(e) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      var startY = e.touches ? e.touches[0].clientY : e.clientY;
      var startHeight = dialog.offsetHeight;
      function move(ev) {
        if (ev.cancelable) ev.preventDefault();
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
        saveDetaljiPanelState(parseFloat(dialog.style.left), parseFloat(dialog.style.top), dialog.offsetWidth, dialog.offsetHeight);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', stop);
      document.addEventListener('touchcancel', stop);
    }
    bar.addEventListener('mousedown', start);
    bar.addEventListener('touchstart', start, { passive: false });
  }

  function closeDetaljiPanel() {
    var modal = document.getElementById('listaDetaljiModal');
    var dialog = document.getElementById('listaDetaljiDialog');
    if (modal && dialog) {
      var active = document.activeElement;
      if (active && modal.contains(active)) {
        var fallback = document.getElementById('btnPovratak') || document.querySelector('.lista-panel') || document.body;
        if (fallback && fallback.focus) fallback.focus();
      }
      var left = parseFloat(dialog.style.left);
      var top = parseFloat(dialog.style.top);
      if (dialog.style.transform && dialog.style.transform.indexOf('translate') >= 0) {
        left = (window.innerWidth - dialog.offsetWidth) / 2;
        top = (window.innerHeight - dialog.offsetHeight) / 2;
      }
      saveDetaljiPanelState(left, top, dialog.offsetWidth, dialog.offsetHeight);
      var grupeState = {};
      modal.querySelectorAll('.lista-detalji-grupa').forEach(function (g) {
        var naslovEl = g.querySelector('.lista-detalji-grupa__naslov-text');
        if (naslovEl) grupeState[naslovEl.textContent || ''] = g.classList.contains('lista-detalji-grupa--expanded');
      });
      if (Object.keys(grupeState).length > 0) saveDetaljiGrupeState(grupeState);
      modal.classList.remove('lista-detalji-modal--open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function openDetaljiPanel(row) {
    var modal = ensureDetaljiPanel();
    var body = document.getElementById('listaDetaljiBody');
    if (!body) return;
    var state = getDetaljiPanelState();
    var dialog = document.getElementById('listaDetaljiDialog');
    if (state && dialog) {
      dialog.style.left = state.left + 'px';
      dialog.style.top = state.top + 'px';
      dialog.style.transform = 'none';
      dialog.style.width = state.width + 'px';
      dialog.style.height = state.height + 'px';
    } else if (dialog) {
      dialog.style.left = '50%';
      dialog.style.top = '50%';
      dialog.style.transform = 'translate(-50%, -50%)';
      dialog.style.width = DETALJI_DEFAULT_W + 'px';
      dialog.style.height = DETALJI_DEFAULT_H + 'px';
    }
    body.innerHTML = '';
    if (row) {
      var imgUrl = row.id ? (API_BASE + 'Clanovi_CRUD_slika.php?id=' + encodeURIComponent(row.id) + '&t=' + (Date.now ? Date.now() : 0)) : '';
      var slikaWrap = document.createElement('div');
      slikaWrap.className = 'lista-slika lista-detalji-modal__slika';
      if (imgUrl) {
        var slikaImg = document.createElement('img');
        slikaImg.className = 'lista-slika__img';
        slikaImg.src = imgUrl;
        slikaImg.alt = '';
        slikaImg.draggable = false;
        slikaImg.onerror = function () { this.style.display = 'none'; };
        slikaWrap.appendChild(slikaImg);
      }
      body.appendChild(slikaWrap);

      var dobGodina = '';
      if (row.datum_rodjenja_sort) {
        var today = new Date();
        var parts = String(row.datum_rodjenja_sort).split(/[-/]/);
        if (parts.length >= 3) {
          var y = parseInt(parts[0], 10);
          var m = parseInt(parts[1], 10) - 1;
          var d = parseInt(parts[2], 10);
          if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            var birth = new Date(y, m, d);
            var age = today.getFullYear() - birth.getFullYear();
            if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
            dobGodina = age >= 0 ? String(age) : '';
          }
        }
      }
      var lozaPart = [row['Loža'] || '', row.Grad || '', row.DrzavaLoze || ''].filter(Boolean).join(', ');
      var lozaGradDrzava = lozaPart ? ('C∴L∴ ' + lozaPart) : '—';
      var stupanjRed = (row.StupanjBroj && row.StupanjNaziv) ? (row.StupanjBroj + '°, ' + row.StupanjNaziv) : (row.StupanjNaziv || (row.StupanjBroj ? row.StupanjBroj + '°' : '—'));
      var grupe = [
        { naslov: 'Opći podaci', redci: [
          { label: '', value: (row.Prezime || '') + ' ' + (row.Ime || '') + ', ' + (row.Stupanj || '—') + '°', cls: 'lista-detalji-grupa__red--ime' },
          { label: '', value: lozaGradDrzava },
          { label: 'Dob', value: dobGodina ? (dobGodina + ' godina' + (row['Rođendan'] ? ', ' + row['Rođendan'] : '')) : (row['Rođendan'] || '—') }
        ]},
        { naslov: 'Masonski podaci', redci: [
          { label: 'Iskaznica', value: row.sifra || '—', valueBold: true },
          { label: 'Iniciran', value: row.datum_inicijacije || '—' },
          { label: 'Stupanj', value: stupanjRed },
          { label: 'Datum trenutnog stupnja', value: row.datum_stupnja || '—' },
          { label: 'Mentor', value: row.na_prijedlog || '—' }
        ]},
        { naslov: 'Telefon', redci: [{ label: '', value: 'Učitavanje...', cls: '' }], isTelefon: true },
        { naslov: 'e-mail adrese', redci: [{ label: '', value: 'Učitavanje...', cls: '' }], isEmail: true },
        { naslov: 'Adrese', redci: [{ label: '', value: 'Učitavanje...', cls: '' }], isAdrese: true },
        { naslov: 'Prisustvo na radovima', redci: [{ label: '', value: 'Podaci još ne postoje', cls: '' }] }
      ];
      var grupeState = getDetaljiGrupeState() || {};
      var telefonTijelo = null;
      var emailTijelo = null;
      var adreseTijelo = null;
      grupe.forEach(function (g) {
        var expanded = grupeState[g.naslov] !== false;
        var grupa = document.createElement('div');
        grupa.className = 'lista-detalji-grupa' + (expanded ? ' lista-detalji-grupa--expanded' : '');
        var naslov = document.createElement('button');
        naslov.type = 'button';
        naslov.className = 'lista-detalji-grupa__naslov';
        naslov.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        naslov.innerHTML = '<span class="lista-detalji-grupa__naslov-text">' + (g.naslov || '') + '</span><span class="lista-detalji-grupa__naslov-icon" aria-hidden="true"></span>';
        var tijelo = document.createElement('div');
        tijelo.className = 'lista-detalji-grupa__tijelo';
        if (g.isTelefon) {
          telefonTijelo = tijelo;
          tijelo.innerHTML = '<p class="lista-detalji-grupa__red">Učitavanje...</p>';
        } else if (g.isEmail) {
          emailTijelo = tijelo;
          tijelo.innerHTML = '<p class="lista-detalji-grupa__red">Učitavanje...</p>';
        } else if (g.isAdrese) {
          adreseTijelo = tijelo;
          tijelo.innerHTML = '<p class="lista-detalji-grupa__red">Učitavanje...</p>';
        } else {
          var html = '';
          g.redci.forEach(function (r) {
            var val = r.value || '—';
            var text;
            if (r.valueBold) {
              text = r.label ? (r.label + ': <span class="lista-detalji-grupa__red--bold">' + val + '</span>') : ('<span class="lista-detalji-grupa__red--bold">' + val + '</span>');
            } else {
              text = r.label ? (r.label + ': ' + val) : val;
            }
            var cls = 'lista-detalji-grupa__red' + (r.cls ? ' ' + r.cls : '');
            html += '<p class="' + cls + '">' + text + '</p>';
          });
          tijelo.innerHTML = html;
        }
        naslov.addEventListener('click', function () {
          var expanded = grupa.classList.toggle('lista-detalji-grupa--expanded');
          naslov.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
        grupa.appendChild(naslov);
        grupa.appendChild(tijelo);
        body.appendChild(grupa);
      });
      var idClan = row && row.id ? String(row.id) : '';
      if (telefonTijelo) {
        if (idClan) {
          ucitajListaTelefonTipovi(function () {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', API_BASE + 'Telefoni_CRUD_sve.php?id_clanovi=' + encodeURIComponent(idClan), true);
            xhr.onreadystatechange = function () {
              if (xhr.readyState !== 4) return;
              var text = (xhr.responseText || '').trim();
              var data = [];
              if (text !== '' && text.charAt(0) === '[') {
                try { data = JSON.parse(text); } catch (e) {}
              }
              telefonTijelo.innerHTML = buildListaTelefonGrupaHtml(data, listaTelefonTipoviData);
            };
            xhr.send();
          });
        } else {
          telefonTijelo.innerHTML = '<p class="lista-detalji-grupa__red">Nema upisanih telefona u bazi</p>';
        }
      }
      if (emailTijelo) {
        if (idClan) {
          ucitajListaEmailTipovi(function () {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', API_BASE + 'E_maili_CRUD_sve.php?id_clanovi=' + encodeURIComponent(idClan), true);
            xhr.onreadystatechange = function () {
              if (xhr.readyState !== 4) return;
              var text = (xhr.responseText || '').trim();
              var data = [];
              if (text !== '' && text.charAt(0) === '[') {
                try { data = JSON.parse(text); } catch (e) {}
              }
              emailTijelo.innerHTML = buildListaEmailGrupaHtml(data, listaEmailTipoviData);
            };
            xhr.send();
          });
        } else {
          emailTijelo.innerHTML = '<p class="lista-detalji-grupa__red">Nema upisanih e-mail adresa u bazi</p>';
        }
      }
      if (adreseTijelo) {
        if (idClan) {
          ucitajListaAdreseTipovi(function () {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', API_BASE + 'Adrese_CRUD_sve.php?id_clanovi=' + encodeURIComponent(idClan), true);
            xhr.onreadystatechange = function () {
              if (xhr.readyState !== 4) return;
              var text = (xhr.responseText || '').trim();
              var data = [];
              if (text !== '' && text.charAt(0) === '[') {
                try { data = JSON.parse(text); } catch (e) {}
              }
              adreseTijelo.innerHTML = buildListaAdreseGrupaHtml(data, listaAdreseTipoviData);
            };
            xhr.send();
          });
        } else {
          adreseTijelo.innerHTML = '<p class="lista-detalji-grupa__red">Nema upisanih adresa u bazi</p>';
        }
      }
    }
    modal.classList.add('lista-detalji-modal--open');
    modal.setAttribute('aria-hidden', 'false');
  }

  /**
   * listaInfo(row) – poziva se na klik ikone ili dvoklik na red.
   * Dispatchera custom event 'lista-info' (cancelable); default: otvara panel s detaljima.
   */
  function listaInfo(row) {
    if (!row) return;
    var ev = new CustomEvent('lista-info', { detail: { row: row }, bubbles: true, cancelable: true });
    if (container) container.dispatchEvent(ev);
    if (ev.defaultPrevented) return;
    openDetaljiPanel(row);
  }

  function renderTbody(tbody) {
    if (!tbody) return;
    tbody.innerHTML = '';
    var br = getBrojRedaka();
    var start = (trenutnaStranica - 1) * br;
    var end = Math.min(start + br, filtriraniPodaci.length);
    var pageData = filtriraniPodaci.slice(start, end);

    pageData.forEach(function (row) {
      var tr = document.createElement('tr');
      tr._listaRow = row;
      Tablica_Zaglavlje.forEach(function (col, colIdx) {
        var td = document.createElement('td');
        if ((col.mobitel_prikaz || 1) === 0) td.classList.add('lista-tablica__col--mob-hide');
        td.style.textAlign = col.align === 'r' ? 'right' : (col.align === 'c' ? 'center' : 'left');
        if (row.kandidat) {
          td.style.color           = _listaKandidatBojaFg || 'var(--c-gray-300)';
          td.style.backgroundColor = _listaKandidatBojaBg || 'var(--c-green-500)';
        }
        if (col.type === 'img' || col.type === 'logo') {
          td.className = 'lista-tablica__cell--img';
          var img = document.createElement('img');
          img.className = col.type === 'logo' ? 'lista-tablica__cell-logo' : 'lista-tablica__cell-img';
          var imgSrc = '';
          if (col.type === 'img') {
            imgSrc = listaThumbSrcClan(row.id) || (row.img || '');
          } else {
            imgSrc = listaThumbSrcLoza(row.loza) || (row.logo || '');
          }
          img.src = imgSrc || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
          img.alt = '';
          img.draggable = false;
          if (!imgSrc) img.style.display = 'none';
          img.onerror = function () { this.style.display = 'none'; };
          td.appendChild(img);
        } else if (col.titleRow2 && col.titleField && col.titleRow2Field) {
          var line1 = row[col.titleField] != null ? String(row[col.titleField]) : '';
          var line2 = row[col.titleRow2Field] != null ? String(row[col.titleRow2Field]) : '';
          td.className = 'lista-tablica__cell--two-lines';
          if (col.titleField === 'Rođendan') td.classList.add('lista-tablica__cell--rodendan');
          var wrap = document.createElement('div');
          wrap.className = 'lista-tablica__cell-lines';
          var span1 = document.createElement('div');
          var span1Cls = 'lista-tablica__cell-line';
          if (col.titleField === 'Prezime' || col.titleField === 'Loža') span1Cls += ' lista-tablica__cell-line--bold';
          if (col.titleField === 'Rođendan' && row.rodendanDanas) span1Cls += ' lista-tablica__cell-line--rodendan-danas';
          span1.className = span1Cls;
          span1.textContent = line1;
          var span2 = document.createElement('div');
          span2.className = 'lista-tablica__cell-line';
          span2.textContent = line2;
          wrap.appendChild(span1);
          wrap.appendChild(span2);
          if (col.titleField === 'Rođendan') {
            var outer = document.createElement('div');
            outer.className = 'lista-tablica__cell-rodendan-wrap';
            outer.appendChild(wrap);
            var iconBtn = document.createElement('button');
            iconBtn.type = 'button';
            iconBtn.className = 'lista-tablica__cell-info-icon';
            iconBtn.setAttribute('aria-label', 'Informacije o redku');
            iconBtn.title = 'Informacije';
            iconBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              listaInfo(row);
            });
            var iconImg = document.createElement('img');
            iconImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M12%206.75a.75.75%200%201%201%200-1.5.75.75%200%200%201%200%201.5ZM12%2012.75a.75.75%200%201%201%200-1.5.75.75%200%200%201%200%201.5ZM12%2018.75a.75.75%200%201%201%200-1.5.75.75%200%200%201%200%201.5Z'/%3E%3C/svg%3E";
            iconImg.alt = '';
            iconImg.width = 24;
            iconImg.height = 24;
            iconImg.setAttribute('aria-hidden', 'true');
            iconBtn.appendChild(iconImg);
            outer.appendChild(iconBtn);
            td.appendChild(outer);
          } else {
            td.appendChild(wrap);
          }
        } else if (col.field === 'Stupanj') {
          td.className = 'lista-tablica__cell--stupanj';
          if (row.kandidat) {
            td.textContent = 'K';
          } else {
            var v1 = row[col.field] != null ? String(row[col.field]) : '';
            td.textContent = v1 ? v1 + '\u00B0' : '';
          }
        } else {
          var v1 = row[col.field] != null ? String(row[col.field]) : '';
          var v2 = col.field2 && row[col.field2] != null ? ' ' + String(row[col.field2]) : '';
          td.textContent = v1 + v2;
        }
        if (colIdx === 0 || colIdx === 2) td.classList.add('lista-tablica__col--mob-65');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function sortirajTablicu(f1, f2) {
    var key = (f1 || '') + '|' + (f2 || '');
    if (sortCol === key) sortDir = -sortDir;
    else { sortCol = key; sortDir = 1; }
    var sortField1 = (f1 === 'Rođendan') ? 'datum_rodjenja_sort' : f1;
    filtriraniPodaci.sort(function (a, b) {
      var v1a, v1b, cmp;
      if (f1 === 'Rođendan') {
        v1a = a[sortField1] || '';
        v1b = b[sortField1] || '';
        cmp = v1a.localeCompare(v1b);
      } else if (f1 === 'Stupanj') {
        v1a = parseFloat(a[f1]) || 0;
        v1b = parseFloat(b[f1]) || 0;
        cmp = v1a < v1b ? -1 : (v1a > v1b ? 1 : 0);
      } else {
        v1a = a[f1] != null ? String(a[f1]).toLowerCase() : '';
        v1b = b[f1] != null ? String(b[f1]).toLowerCase() : '';
        cmp = v1a.localeCompare(v1b, 'hr');
      }
      if (cmp !== 0) return sortDir * cmp;
      if (f2) {
        var v2a = a[f2] != null ? String(a[f2]).toLowerCase() : '';
        var v2b = b[f2] != null ? String(b[f2]).toLowerCase() : '';
        return sortDir * v2a.localeCompare(v2b, 'hr');
      }
      return 0;
    });
    trenutnaStranica = 1;
    osvjeziPaginaciju();
    osvjeziTablicu();
  }

  /**
   * Jedan string za pretragu retka (kao formatClanRedakZaTablicu u Duznosnici_Osobe_CRUD —
   * spajanje vidljivih polja; case-insensitive match u primijeniFilterTrazi).
   */
  function trimListaStr(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  function listaClanTekstZaTrazi(r) {
    if (!r) return '';
    var parts = [
      r.line1, r.line2, r.Ime, r.Prezime, r.Stupanj,
      r['Loža'], r.Grad, r.DrzavaLoze,
      r.Telefon, r.Email, r.Rođendan, r.Spol,
      r.sifra, r.datum_inicijacije, r.datum_stupnja, r.na_prijedlog
    ];
    var out = [];
    for (var pi = 0; pi < parts.length; pi++) {
      if (parts[pi] != null && String(parts[pi]) !== '') {
        out.push(String(parts[pi]));
      }
    }
    return out.join(' ');
  }

  /** Ponovi zadnje sortiranje na trenutnom filtriraniPodaci (nakon promjene teksta Traži). */
  function ponoviSortNaFiltriranim() {
    if (sortCol === -1) return;
    var pk = String(sortCol).split('|');
    var f1 = pk[0] || '';
    var f2 = pk.length > 1 ? pk[1] : '';
    var sortField1 = (f1 === 'Rođendan') ? 'datum_rodjenja_sort' : f1;
    filtriraniPodaci.sort(function (a, b) {
      var v1a, v1b, cmp;
      if (f1 === 'Rođendan') {
        v1a = a[sortField1] || '';
        v1b = b[sortField1] || '';
        cmp = v1a.localeCompare(v1b);
      } else if (f1 === 'Stupanj') {
        v1a = parseFloat(a[f1]) || 0;
        v1b = parseFloat(b[f1]) || 0;
        cmp = v1a < v1b ? -1 : (v1a > v1b ? 1 : 0);
      } else {
        v1a = a[f1] != null ? String(a[f1]).toLowerCase() : '';
        v1b = b[f1] != null ? String(b[f1]).toLowerCase() : '';
        cmp = v1a.localeCompare(v1b, 'hr');
      }
      if (cmp !== 0) return sortDir * cmp;
      if (f2) {
        var v2a = a[f2] != null ? String(a[f2]).toLowerCase() : '';
        var v2b = b[f2] != null ? String(b[f2]).toLowerCase() : '';
        return sortDir * v2a.localeCompare(v2b, 'hr');
      }
      return 0;
    });
  }

  /**
   * Traži: uključeno samo kad postoji barem jedan učitani red (podaci.length).
   * Bez podataka: disabled, klasa kontrola-edit-delete--disabled, prazno polje.
   */
  function syncListaTraziEnabled() {
    var wrap = editListaTrazi && editListaTrazi.closest ? editListaTrazi.closest('.kontrola-edit-delete') : null;
    var clearBtn = wrap ? wrap.querySelector('.kontrola-edit-delete__clear') : null;
    var ima = podaci.length > 0;
    if (editListaTrazi) {
      editListaTrazi.disabled = !ima;
    }
    if (wrap) {
      wrap.classList.toggle('kontrola-edit-delete--disabled', !ima);
    }
    if (clearBtn) {
      clearBtn.disabled = !ima;
    }
    if (!ima && editListaTrazi) {
      editListaTrazi.value = '';
    }
  }

  function primijeniFilterTrazi() {
    var txt = trimListaStr(editListaTrazi ? editListaTrazi.value : '');
    if (txt === '') {
      filtriraniPodaci = podaci.slice();
    } else {
      var t = txt.toLowerCase();
      filtriraniPodaci = podaci.filter(function (row) {
        return listaClanTekstZaTrazi(row).toLowerCase().indexOf(t) !== -1;
      });
    }
    ponoviSortNaFiltriranim();
    trenutnaStranica = 1;
    osvjeziPaginaciju();
    osvjeziTablicu();
    syncListaTraziEnabled();
  }

  var MOB_SLIKA_ST = '65px';
  var MOB_STYLE_ID = 'lista-mob-column-widths';

  function injectMobStyles() {
    var existing = document.getElementById(MOB_STYLE_ID);
    if (existing) existing.remove();
    var style = document.createElement('style');
    style.id = MOB_STYLE_ID;
    style.textContent = '@media (max-width: 640px) {' +
      '.lista-tablica .lista-tablica__header table,' +
      '.lista-tablica .lista-tablica__scroll table { table-layout: fixed !important; }' +
      '.lista-tablica col.lista-tablica__col--mob-65,' +
      '.lista-tablica th.lista-tablica__col--mob-65,' +
      '.lista-tablica td.lista-tablica__col--mob-65 {' +
      'width:65px!important;min-width:65px!important;max-width:65px!important}' +
      '}';
    document.head.appendChild(style);
  }

  function setMobWidth(el, w, lock) {
    if (!el) return;
    if (lock) {
      el.style.setProperty('width', w, 'important');
      el.style.setProperty('min-width', w, 'important');
      el.style.setProperty('max-width', w, 'important');
    } else if (w) {
      el.style.setProperty('width', w, 'important');
      el.style.removeProperty('min-width');
      el.style.removeProperty('max-width');
    } else {
      el.style.removeProperty('width');
      el.style.removeProperty('min-width');
      el.style.removeProperty('max-width');
    }
  }

  function primijeniMobitelPrikaz() {
    if (!container) return;
    var narrow = typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    container.classList.toggle('lista-tablica--narrow', narrow);
    var headerTable = container.querySelector('.lista-tablica__header table');
    var bodyTable = container.querySelector('.lista-tablica__scroll table');
    var tbody = bodyTable && bodyTable.querySelector('tbody');
    var n = Tablica_Zaglavlje.length;
    for (var c = 0; c < n; c++) {
      var col = Tablica_Zaglavlje[c];
      var val = col && col.mobitel_prikaz;
      if (val === undefined || val === null) val = 1;
      var hide = narrow && (val === 0);
      var display = hide ? 'none' : '';
      var colWidth = (col && col.width !== 0 && col.width !== '0') ? String(col.width).trim() : '';
      var colLock = false;
      if (narrow && (val === 1)) {
        if (c === 0 || c === 2) {
          colWidth = MOB_SLIKA_ST;
          colLock = true;
        } else if (c === 1) {
          colWidth = 'auto';
        }
      }
      var w = colWidth ? colWidth : '';
      var lock = narrow && (val === 1) && (c === 0 || c === 2);
      if (headerTable) {
        var headerRows = headerTable.querySelectorAll('thead tr');
        var colIdx = c;
        if (headerRows[0]) {
          var cell0 = headerRows[0].cells[colIdx];
          if (cell0) {
            cell0.style.display = display;
            setMobWidth(cell0, w, lock);
          }
        }
        if (headerRows[1]) {
          var row2ColMap = [-1, 0, -1, -1, 1, 2, 3];
          var idx2 = row2ColMap[c];
          if (idx2 >= 0 && headerRows[1].cells[idx2]) {
            var cell2 = headerRows[1].cells[idx2];
            cell2.style.display = display;
            setMobWidth(cell2, w, lock);
          }
        }
      }
      if (tbody) {
        for (var r = 0; r < tbody.rows.length; r++) {
          var cell = tbody.rows[r].cells[c];
          if (cell) {
            cell.style.display = display;
            setMobWidth(cell, w, lock);
          }
        }
      }
      var colgroup = headerTable && headerTable.querySelector('colgroup');
      var colgroupBody = bodyTable && bodyTable.querySelector('colgroup');
      var colEl = colgroup && colgroup.children[c];
      var colBodyEl = colgroupBody && colgroupBody.children[c];
      if (colEl) {
        colEl.style.display = display;
        setMobWidth(colEl, w, lock);
      }
      if (colBodyEl) {
        colBodyEl.style.display = display;
        setMobWidth(colBodyEl, w, lock);
      }
    }
  }

  function osvjeziTablicu(opts) {
    opts = opts || {};
    var tbody = container.querySelector('.lista-tablica__scroll tbody');
    if (!tbody) {
      tbody = iscrtajZaglavlje();
    }
    renderTbody(tbody);
    primijeniMobitelPrikaz();
    if (!opts.skipThumbPrefetch) {
      listaPrefetchThumbsZaProzor();
    }
  }

  function izracunajPaginaciju() {
    var br = getBrojRedaka();
    var total = filtriraniPodaci.length;
    ukupnoStranica = total <= 0 ? 1 : Math.ceil(total / br);
    if (trenutnaStranica > ukupnoStranica) trenutnaStranica = Math.max(1, ukupnoStranica);
  }

  function osvjeziPaginaciju() {
    izracunajPaginaciju();
    var prazna = filtriraniPodaci.length === 0;
    editSpan.textContent = prazna ? '0 / 0' : (trenutnaStranica + ' / ' + ukupnoStranica);
    editSpan.classList.toggle('lista-paginacija__edit--disabled', prazna);
    if (container) container.classList.toggle('lista-tablica--disabled', prazna);
    if (redovaSpan) {
      var brClanova = filtriraniPodaci.filter(function (r) { return !r.kandidat; }).length;
      var brKandidata = filtriraniPodaci.filter(function (r) { return r.kandidat; }).length;
      redovaSpan.textContent = 'Članovi: ' + brClanova + ' : Kandidati: ' + brKandidata;
      redovaSpan.classList.toggle('lista-paginacija__redova--disabled', prazna);
    }
    listaOsvjeziNavButtonsStanje();
  }

  function naPocetak() {
    if (listaJeNavBlokiran()) return;
    if (trenutnaStranica <= 1) return;
    listaTouchNavLock();
    trenutnaStranica = 1;
    osvjeziPaginaciju();
    osvjeziTablicu();
  }

  function stranicaNatrag() {
    if (listaJeNavBlokiran()) return;
    if (trenutnaStranica <= 1) return;
    listaTouchNavLock();
    trenutnaStranica--;
    osvjeziPaginaciju();
    osvjeziTablicu();
  }

  function stranicaNaprijed() {
    if (listaJeNavBlokiran()) return;
    if (trenutnaStranica >= ukupnoStranica) return;
    listaTouchNavLock();
    trenutnaStranica++;
    osvjeziPaginaciju();
    osvjeziTablicu();
  }

  function naKraj() {
    if (listaJeNavBlokiran()) return;
    if (trenutnaStranica >= ukupnoStranica) return;
    listaTouchNavLock();
    trenutnaStranica = ukupnoStranica;
    osvjeziPaginaciju();
    osvjeziTablicu();
  }

  var SVE_DRZAVE = 'sve_drzave';
  var SVE_REGIJE = 'sve_regije';
  var SVE_LOZE = 'sve_loze';

  /* =========================================================================
   * ▒▒ BLOK 1: PRAVA GEO (Lista) ▒▒
   * Dohvat dozvoljenih država / regija / loža iz Duznosnici_Drzave_Regije_Loze_sve.php.
   * Jedan fetch, klijentski keš, kaskadno filtriranje pri promjeni selecta.
   * Podržava "Sve države/regije/lože" opcije ako ima >1 stavka.
   * ========================================================================= */

  /* Geo keš: vnlhGeoOgranicenja* u 0-Filteri_Po_Ogranicenjima.js */

  var _geoAutoLockedDrzava = false;
  var _geoAutoLockedRegija = false;
  var _geoAutoLockedLoza   = false;

  /** Postavi/makni CSS klasu lista-select--auto-locked na wrapperu oko <select> elementa. */
  function setAutoLockedClass(selectEl, locked) {
    if (!selectEl) return;
    var wrapper = selectEl.closest ? selectEl.closest('.lista-select') : null;
    if (!wrapper) return;
    if (locked) wrapper.classList.add('lista-select--auto-locked');
    else wrapper.classList.remove('lista-select--auto-locked');
  }

  /** Postavi/makni disabled izgled labele za dani select. */
  function syncLabelDisabled(selectEl, disabled) {
    if (!selectEl || !selectEl.id) return;
    var lbl = document.querySelector('label[for="' + selectEl.id + '"]');
    if (lbl) lbl.classList.toggle('lista-labela--disabled', disabled);
  }

  /**
   * Dohvat dozvoljenih geo entiteta s PHP-a. Puni keš, popunjava select država,
   * pokreće auto-select kaskadu. CRUD tipke se ne primjenjuju (Lista je read-only).
   */
  function ucitajPravaGeoLista(callback) {
    var geoUrl =
      typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
        ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(API_BASE, 'Lista.html')
        : API_BASE + 'Duznosnici_Drzave_Regije_Loze_sve.php?html_fajl=' + encodeURIComponent('Lista.html');
    window.vnlhGeoOgranicenjaUcitaj(geoUrl, function () {
      puniSelectDrzava();
      if (callback) callback();
    });
  }

  /** Popuni select država iz keša. "Sve države" ako >1. Auto-lock ako točno 1. */
  function puniSelectDrzava() {
    selectDrzava.innerHTML = '<option value="">— Odaberi državu —</option>';
    _geoAutoLockedDrzava = false;
    setAutoLockedClass(selectDrzava, false);

    var g0 = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var arr = g0.drzave || [];
    if (arr.length > 1) {
      var optSve = document.createElement('option');
      optSve.value = SVE_DRZAVE;
      optSve.textContent = 'Sve države';
      selectDrzava.appendChild(optSve);
    }
    for (var i = 0; i < arr.length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? String(arr[i].id) : '';
      opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
      selectDrzava.appendChild(opt);
    }

    if (arr.length === 1) {
      selectDrzava.value = String(arr[0].id);
      selectDrzava.disabled = true;
      _geoAutoLockedDrzava = true;
      setAutoLockedClass(selectDrzava, true);
      syncLabelDisabled(selectDrzava, false);
      rebuildListaSelect(selectDrzava);
      puniSelectRegija(selectDrzava.value);
    } else {
      selectDrzava.disabled = false;
      syncLabelDisabled(selectDrzava, false);
      rebuildListaSelect(selectDrzava);
      puniSelectRegija('');
    }
  }

  /**
   * Popuni select regija iz keša, filtrirano po id_drzava.
   * SVE_DRZAVE → sve regije iz keša. "Sve regije" ako >1. Auto-lock ako 1.
   */
  function puniSelectRegija(idDrzava) {
    selectRegija.innerHTML = '<option value="">— Odaberi regiju —</option>';
    _geoAutoLockedRegija = false;
    setAutoLockedClass(selectRegija, false);

    if (!idDrzava) {
      selectRegija.disabled = true;
      syncLabelDisabled(selectRegija, true);
      rebuildListaSelect(selectRegija);
      puniSelectLoza('');
      return;
    }

    var sveDrzave = (idDrzava === SVE_DRZAVE);
    var g1 = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano =
      typeof window.vnlhGeoFiltrirajRegijeZaDrzavuIliSve === 'function'
        ? window.vnlhGeoFiltrirajRegijeZaDrzavuIliSve(g1.regije, idDrzava, SVE_DRZAVE)
        : [];

    // Mapa država id → naziv za prikaz uz regiju kad je "Sve države"
    var drzaveMap = {};
    if (sveDrzave) {
      var kd = g1.drzave || [];
      for (var d = 0; d < kd.length; d++) {
        drzaveMap[kd[d].id] = kd[d].naziv || '';
      }
    }

    if (filtrirano.length > 1) {
      var optSve = document.createElement('option');
      optSve.value = SVE_REGIJE;
      optSve.textContent = 'Sve regije';
      selectRegija.appendChild(optSve);
    }
    for (var j = 0; j < filtrirano.length; j++) {
      var opt = document.createElement('option');
      opt.value = filtrirano[j].id != null ? String(filtrirano[j].id) : '';
      var naziv = filtrirano[j].naziv || '';
      var drzNaziv = sveDrzave ? (drzaveMap[filtrirano[j].id_drzava] || '') : '';
      opt.textContent = (sveDrzave && drzNaziv) ? naziv + ', ' + drzNaziv : naziv;
      selectRegija.appendChild(opt);
    }

    if (filtrirano.length === 1) {
      selectRegija.value = String(filtrirano[0].id);
      selectRegija.disabled = true;
      _geoAutoLockedRegija = true;
      setAutoLockedClass(selectRegija, true);
      syncLabelDisabled(selectRegija, false);
      rebuildListaSelect(selectRegija);
      puniSelectLoza(selectRegija.value);
    } else if (filtrirano.length === 0) {
      selectRegija.disabled = true;
      syncLabelDisabled(selectRegija, true);
      rebuildListaSelect(selectRegija);
      puniSelectLoza('');
    } else {
      selectRegija.disabled = false;
      syncLabelDisabled(selectRegija, false);
      rebuildListaSelect(selectRegija);
      puniSelectLoza('');
    }
  }

  /**
   * Popuni select loža iz keša, filtrirano po id_regija.
   * SVE_REGIJE → sve lože čija je regija u trenutnim opcijama regija.
   * "Sve lože" ako >1. Auto-lock ako 1.
   */
  function puniSelectLoza(idRegija) {
    selectLoza.innerHTML = '<option value="">— Odaberi ložu —</option>';
    _geoAutoLockedLoza = false;
    setAutoLockedClass(selectLoza, false);

    if (!idRegija) {
      selectLoza.disabled = true;
      syncLabelDisabled(selectLoza, true);
      rebuildListaSelect(selectLoza);
      return;
    }

    var sveRegije = (idRegija === SVE_REGIJE);
    // Mapa dozvoljenih regija za filtriranje loža
    var regijeIdMap = {};
    if (sveRegije) {
      for (var r = 0; r < selectRegija.options.length; r++) {
        var rv = selectRegija.options[r].value;
        if (rv && rv !== SVE_REGIJE) regijeIdMap[rv] = true;
      }
    }

    var g2 = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano;
    if (sveRegije) {
      filtrirano =
        typeof window.vnlhGeoFiltrirajLozePoSkupuRegija === 'function'
          ? window.vnlhGeoFiltrirajLozePoSkupuRegija(g2.loze, regijeIdMap)
          : [];
    } else {
      filtrirano =
        typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function'
          ? window.vnlhGeoFiltrirajLozePoRegiji(g2.loze, idRegija)
          : [];
    }

    // Mape za prikaz naziva regije/države uz ložu
    var showRegija = sveRegije;
    var showDrzava = (selectDrzava && selectDrzava.value === SVE_DRZAVE);
    var regijeMap = {};
    var drzaveMapLoza = {};
    if (showRegija || showDrzava) {
      var kr = g2.regije || [];
      var kd2 = g2.drzave || [];
      for (var ri = 0; ri < kr.length; ri++) {
        regijeMap[kr[ri].id] = kr[ri].naziv || '';
        if (showDrzava) {
          for (var di = 0; di < kd2.length; di++) {
            if (kd2[di].id === kr[ri].id_drzava) {
              drzaveMapLoza[kr[ri].id] = kd2[di].naziv || '';
              break;
            }
          }
        }
      }
    }

    if (filtrirano.length > 1) {
      var optSve = document.createElement('option');
      optSve.value = SVE_LOZE;
      optSve.textContent = 'Sve lože';
      selectLoza.appendChild(optSve);
    }
    for (var j = 0; j < filtrirano.length; j++) {
      var opt = document.createElement('option');
      opt.value = filtrirano[j].id != null ? String(filtrirano[j].id) : '';
      var parts = [filtrirano[j].naziv || ''];
      if (showRegija && regijeMap[filtrirano[j].id_regija]) parts.push(regijeMap[filtrirano[j].id_regija]);
      if (showDrzava && drzaveMapLoza[filtrirano[j].id_regija]) parts.push(drzaveMapLoza[filtrirano[j].id_regija]);
      opt.textContent = parts.join(', ');
      selectLoza.appendChild(opt);
    }

    if (filtrirano.length === 1) {
      selectLoza.value = String(filtrirano[0].id);
      selectLoza.disabled = true;
      _geoAutoLockedLoza = true;
      setAutoLockedClass(selectLoza, true);
      syncLabelDisabled(selectLoza, false);
      rebuildListaSelect(selectLoza);
      // Auto-load tablice za jedinu ložu
      var lozaNaziv = '';
      var optSel = selectLoza.options[selectLoza.selectedIndex];
      if (optSel) lozaNaziv = optSel.textContent || '';
      ucitajClanovi(selectLoza.value, lozaNaziv);
    } else if (filtrirano.length === 0) {
      selectLoza.disabled = true;
      syncLabelDisabled(selectLoza, true);
      rebuildListaSelect(selectLoza);
    } else {
      selectLoza.disabled = false;
      syncLabelDisabled(selectLoza, false);
      rebuildListaSelect(selectLoza);
    }
  }

  /* =========================================================================
   * ▒▒ KRAJ BLOKA 1: PRAVA GEO (Lista) ▒▒
   * ========================================================================= */

  /** Keš: JSON iz duznosnici_ogranicenja_stupnjevi_po_obredu.php (tip 6, dozvoljeni stupnjevi po obredu). */
  var _stupnjeviOgrMap = {};
  var _stupnjeviOgrLoaded = false;
  var _stupnjeviOgrReq = null;
  /** Callbackovi dok traje jedini XHR za stupnjevi (više uzastopnih ucitajClanovi). */
  var _stupnjeviOgrWait = [];

  /**
   * Jednokratni dohvat mape ograničenja stupnjeva po obredu za prijavljenog dužnosnika.
   * Parametar id_duznosnik_test u URL-u (Alati_Meni_Test) prosljeđuje se kao kod geo API-ja.
   * @param {function(): void} [done] — nakon učitavanja ili odmah ako je keš već spreman
   */
  function ucitajStupnjeviOgranicenjaLista(done) {
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
    var url = API_BASE + 'duznosnici_ogranicenja_stupnjevi_po_obredu.php';
    try {
      var sp2 = new URLSearchParams(window.location.search);
      var idt2 = sp2.get('id_duznosnik_test');
      if (idt2 && parseInt(idt2, 10) > 0) {
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'id_duznosnik_test=' + encodeURIComponent(idt2);
      }
    } catch (eTst) {}
    var xhrOgr = new XMLHttpRequest();
    _stupnjeviOgrReq = xhrOgr;
    xhrOgr.open('GET', url, true);
    xhrOgr.onreadystatechange = function () {
      if (xhrOgr.readyState !== 4) return;
      _stupnjeviOgrReq = null;
      _stupnjeviOgrLoaded = true;
      var txtOgr = (xhrOgr.responseText || '').trim();
      if (txtOgr !== '' && txtOgr.charAt(0) === '{') {
        try {
          _stupnjeviOgrMap = JSON.parse(txtOgr);
        } catch (eJo) {
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
        } catch (eW) {}
      }
    };
    xhrOgr.send();
  }

  function ucitajClanovi(idLoza, lozaNaziv) {
    podaci = [];
    _listaThumbByClanId = {};
    var viseLoz = (idLoza === SVE_LOZE);
    var idParam = idLoza;
    if (viseLoz) {
      var ids = [];
      for (var i = 0; i < selectLoza.options.length; i++) {
        var v = selectLoza.options[i].value;
        if (v && v !== SVE_LOZE) ids.push(v);
      }
      idParam = ids.join(',');
    }
    currentLogoUrl = '';
    /* Odmah prazna tablica (i primjena Traži na prazan skup) dok ne stigne odgovor. */
    primijeniFilterTrazi();
    if (!idLoza) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'Clanovi_CRUD_sve_loze.php?id_loza=' + encodeURIComponent(idParam), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = (xhr.responseText || '').trim();
      if (text !== '' && text.charAt(0) === '[') {
        try {
          var arr = JSON.parse(text);
          var seenIds = {};
          for (var i = 0; i < arr.length; i++) {
            var r = arr[i];
            var mid = r.id != null ? r.id : '';
            if (seenIds[mid]) continue;
            var imgUrl = '';
            var datumStr = '';
            var rodendanDanas = false;
            if (r.datum_rodjenja) {
              datumStr = formatDatumSDanom(r.datum_rodjenja);
              var parts = String(r.datum_rodjenja).split(/[-/]/);
              if (parts.length >= 3) {
                var today = new Date();
                var d = parseInt(parts[2], 10);
                var m = parseInt(parts[1], 10);
                if (!isNaN(d) && !isNaN(m) && d === today.getDate() && m === (today.getMonth() + 1)) rodendanDanas = true;
              }
            }
            var spolStr = (r.spol === 1 || r.spol === '1') ? 'Ženski' : 'Muški';
            var lozaNazivClan = viseLoz && r.loza_naziv ? r.loza_naziv : lozaNaziv;
            var logoUrl = '';
            var datumInicStr = formatDatumSDanom(r.datum_inicijacije);
            var datumStupanjStr = formatDatumSDanom(r.datum_stupnja);
            seenIds[mid] = true;
            var idLozaRow = viseLoz ? r.loza : idLoza;
            podaci.push({
              id: r.id,
              loza: idLozaRow != null && idLozaRow !== '' ? idLozaRow : '',
              img: imgUrl,
              logo: logoUrl,
              line1: r.ime || '',
              line2: r.prezime || '',
              Ime: r.ime || '',
              Prezime: r.prezime || '',
              kandidat: parseInt(r.kandidat, 10) === 1,
              Stupanj: r.stupanj_show || '',
              StupanjBroj: r.stupanj_broj != null ? String(r.stupanj_broj) : '',
              StupanjNaziv: r.stupanj_naziv || '',
              id_obred: (function () {
                var io = parseInt(r.id_obred, 10);
                return isNaN(io) ? 0 : io;
              })(),
              id_stupnj_clan: (function () {
                var is = parseInt(r.stupanj, 10);
                return isNaN(is) ? 0 : is;
              })(),
              obred_naziv: r.obred_naziv || '',
              Loža: lozaNazivClan || '',
              Grad: r.loza_grad || '',
              DrzavaLoze: r.drzava_loze || '',
              Telefon: r.telefon_text || '',
              Email: r.email_text || '',
              Rođendan: datumStr,
              datum_rodjenja_sort: r.datum_rodjenja || '',
              Spol: spolStr,
              rodendanDanas: rodendanDanas,
              sifra: r.sifra || '',
              datum_inicijacije: datumInicStr,
              datum_stupnja: datumStupanjStr,
              na_prijedlog: [r.na_prijedlog_prezime, r.na_prijedlog_ime].filter(Boolean).join(' ') || ''
            });
          }
          function nakonOgrStupnjeva() {
            if (typeof window.vnlhFilteriPrimijeniStupnjevaPoOgranicenjima === 'function') {
              window.vnlhFilteriPrimijeniStupnjevaPoOgranicenjima(1, podaci, _stupnjeviOgrMap);
            }
            primijeniFilterTrazi();
          }
          ucitajStupnjeviOgranicenjaLista(nakonOgrStupnjeva);
        } catch (e) {}
      }
    };
    xhr.send();
  }

  function initListaSelect(wrap) {
    if (wrap.dataset.listaSelectInit === '1') return;
    var nativeSel = wrap.querySelector('select');
    if (!nativeSel) return;
    nativeSel.tabIndex = -1;
    wrap.dataset.listaSelectInit = '1';

    var display = document.createElement('div');
    display.className = 'lista-select__display';
    var displayInner = document.createElement('span');
    displayInner.className = 'lista-select__display-inner';
    display.appendChild(displayInner);

    var caret = document.createElement('span');
    caret.className = 'lista-select__caret';
    caret.setAttribute('aria-hidden', 'true');

    var list = document.createElement('div');
    list.className = 'lista-select__list';

    wrap.insertBefore(display, nativeSel);
    wrap.insertBefore(caret, nativeSel);
    wrap.appendChild(list);

    function buildOptions() {
      list.innerHTML = '';
      for (var i = 0; i < nativeSel.options.length; i++) {
        var opt = nativeSel.options[i];
        var optEl = document.createElement('div');
        optEl.className = 'lista-select__option';
        optEl.textContent = opt.textContent;
        optEl.dataset.value = opt.value;
        if (!opt.disabled) {
          optEl.addEventListener('click', function () {
            if (nativeSel.disabled) return;
            nativeSel.value = this.dataset.value;
            wrap.classList.remove('lista-select--open');
            syncFromNative();
            var ev = new Event('change', { bubbles: true });
            nativeSel.dispatchEvent(ev);
          });
        } else {
          optEl.style.opacity = '0.5';
          optEl.style.cursor = 'default';
        }
        list.appendChild(optEl);
      }
    }

    function syncFromNative() {
      var selOpt = nativeSel.options[nativeSel.selectedIndex];
      displayInner.textContent = selOpt ? selOpt.textContent : '';
      if (!nativeSel.value) wrap.classList.add('lista-select--placeholder');
      else wrap.classList.remove('lista-select--placeholder');
      var optEls = list.querySelectorAll('.lista-select__option');
      for (var i = 0; i < optEls.length; i++) {
        var el = optEls[i];
        if (el.dataset.value === nativeSel.value) {
          el.classList.add('lista-select__option--selected');
        } else {
          el.classList.remove('lista-select__option--selected');
        }
      }
    }

    function openList() {
      document.querySelectorAll('.lista-select--open').forEach(function (w) {
        if (w !== wrap) w.classList.remove('lista-select--open');
      });
      buildOptions();
      syncFromNative();
      wrap.classList.add('lista-select--open');
    }

    function closeList() {
      wrap.classList.remove('lista-select--open');
    }

    wrap.addEventListener('click', function (e) {
      if (nativeSel.disabled) return;
      if (list.contains(e.target)) return;
      if (wrap.classList.contains('lista-select--open')) closeList();
      else openList();
    });

    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'combobox');
    wrap.setAttribute('aria-expanded', 'false');
    list.setAttribute('role', 'listbox');

    buildOptions();
    syncFromNative();
  }

  function rebuildListaSelect(sel) {
    var wrap = sel && sel.closest ? sel.closest('.lista-select') : null;
    if (!wrap) return;
    var list = wrap.querySelector('.lista-select__list');
    var displayInner = wrap.querySelector('.lista-select__display-inner');
    var nativeSel = wrap.querySelector('select');
    if (!list || !displayInner || !nativeSel) return;
    list.innerHTML = '';
    for (var i = 0; i < nativeSel.options.length; i++) {
      var opt = nativeSel.options[i];
      var optEl = document.createElement('div');
      optEl.className = 'lista-select__option';
      optEl.textContent = opt.textContent;
      optEl.dataset.value = opt.value;
      if (!opt.disabled) {
        optEl.addEventListener('click', function () {
          if (nativeSel.disabled) return;
          nativeSel.value = this.dataset.value;
          wrap.classList.remove('lista-select--open');
          rebuildListaSelect(nativeSel);
          var ev = new Event('change', { bubbles: true });
          nativeSel.dispatchEvent(ev);
        });
      } else {
        optEl.style.opacity = '0.5';
        optEl.style.cursor = 'default';
      }
      list.appendChild(optEl);
    }
    var selOpt = nativeSel.options[nativeSel.selectedIndex];
    displayInner.textContent = selOpt ? selOpt.textContent : '';
    if (!nativeSel.value) wrap.classList.add('lista-select--placeholder');
    else wrap.classList.remove('lista-select--placeholder');
    var optEls = list.querySelectorAll('.lista-select__option');
    for (var j = 0; j < optEls.length; j++) {
      var el = optEls[j];
      if (el.dataset.value === nativeSel.value) el.classList.add('lista-select__option--selected');
      else el.classList.remove('lista-select__option--selected');
    }
  }

  function init() {
    if (typeof window.vnlhLoadPronadjiStankaMsFromVar114 === 'function') {
      window.vnlhLoadPronadjiStankaMsFromVar114(API_BASE);
    }

    var defaultRedaka = (window.innerWidth && window.innerWidth < 768) ? 8 : 10;
    if (selectBrojRedaka) {
      var saved = localStorage.getItem(LISTA_BROJ_REDAKA_KEY);
      var val = defaultRedaka;
      if (saved) {
        var opt = selectBrojRedaka.querySelector('option[value="' + saved + '"]');
        if (opt) val = parseInt(saved, 10);
      }
      selectBrojRedaka.value = String(val);
      try { localStorage.setItem(LISTA_BROJ_REDAKA_KEY, String(val)); } catch (e) {}
    }
    postaviVidljivihRedova(getBrojRedaka());

    ucitajPravaGeoLista();

    (function () {
      var xhrBoje = new XMLHttpRequest();
      xhrBoje.open('GET', API_BASE + 'Zapisnik_Boje_U_Listi_CRUD_sve.php', true);
      xhrBoje.onreadystatechange = function () {
        if (xhrBoje.readyState !== 4 || xhrBoje.status !== 200) return;
        try {
          var arr = JSON.parse(xhrBoje.responseText || '');
          if (Array.isArray(arr)) {
            for (var i = 0; i < arr.length; i++) {
              if (parseInt(arr[i].id, 10) === 20) {
                _listaKandidatBojaFg = listaBojaToStyle(arr[i].boja   || '') || '';
                _listaKandidatBojaBg = listaBojaToStyle(arr[i].boja_bg || '') || '';
                break;
              }
            }
          }
        } catch (e) {}
      };
      xhrBoje.send();
    }());

    trenutnaStranica = 1;
    injectMobStyles();
    iscrtajZaglavlje();
    listaUcitajSustav117118();
    osvjeziPaginaciju();
    osvjeziTablicu();
    primijeniMobitelPrikaz();

    var mq = window.matchMedia && window.matchMedia('(max-width: 640px)');
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', primijeniMobitelPrikaz);
    }
    window.addEventListener('resize', primijeniMobitelPrikaz);

    syncListaTraziEnabled();

    selectDrzava.addEventListener('change', function () {
      puniSelectRegija(selectDrzava.value);
      ucitajClanovi('', '');
      osvjeziReloadState();
    });

    selectRegija.addEventListener('change', function () {
      puniSelectLoza(selectRegija.value);
      ucitajClanovi('', '');
      osvjeziReloadState();
    });

    selectLoza.addEventListener('change', function () {
      var idLoza = selectLoza.value;
      var lozaNaziv = '';
      var opt = selectLoza.options[selectLoza.selectedIndex];
      if (opt) lozaNaziv = opt.textContent || '';
      ucitajClanovi(idLoza, lozaNaziv);
      osvjeziReloadState();
    });

    selectBrojRedaka.addEventListener('change', function () {
      var br = getBrojRedaka();
      try { localStorage.setItem(LISTA_BROJ_REDAKA_KEY, String(br)); } catch (e) {}
      postaviVidljivihRedova(br);
      izracunajPaginaciju();
      if (trenutnaStranica > ukupnoStranica) trenutnaStranica = ukupnoStranica;
      osvjeziPaginaciju();
      osvjeziTablicu();
    });

    var toListaTrazi = null;
    if (editListaTrazi) {
      editListaTrazi.addEventListener('input', function () {
        if (toListaTrazi) clearTimeout(toListaTrazi);
        toListaTrazi = setTimeout(function () {
          toListaTrazi = null;
          primijeniFilterTrazi();
        }, typeof window.vnlhGetPronadjiStankaMs === 'function' ? window.vnlhGetPronadjiStankaMs() : 1000);
      });
    }
    var wrapListaTrazi = editListaTrazi && editListaTrazi.closest ? editListaTrazi.closest('.kontrola-edit-delete') : null;
    var clearListaTrazi = wrapListaTrazi ? wrapListaTrazi.querySelector('.kontrola-edit-delete__clear') : null;
    if (clearListaTrazi) {
      clearListaTrazi.addEventListener('click', function () {
        if (editListaTrazi) editListaTrazi.value = '';
        primijeniFilterTrazi();
      });
    }

    var btnListaReload = document.getElementById('btn_lista_reload');
    var btnListaReloadMob = document.getElementById('btn_lista_reload_mob');

    function klikListaReload() {
      if (!selectLoza.value) return;
      var lozaNaziv = '';
      var opt = selectLoza.options[selectLoza.selectedIndex];
      if (opt) lozaNaziv = opt.textContent || '';
      ucitajClanovi(selectLoza.value, lozaNaziv);
    }

    [btnListaReload, btnListaReloadMob].forEach(function (btn) {
      if (!btn) return;
      btn.style.display = LISTA_RELOAD_IKONA ? '' : 'none';
      btn.addEventListener('click', klikListaReload);
    });

    function osvjeziReloadState() {
      if (!LISTA_RELOAD_IKONA) return;
      var dis = !selectLoza.value;
      if (btnListaReload) btnListaReload.disabled = dis;
      if (btnListaReloadMob) btnListaReloadMob.disabled = dis;
    }

    btnBackward.addEventListener('click', naPocetak);
    btnPrev.addEventListener('click', stranicaNatrag);
    btnNext.addEventListener('click', stranicaNaprijed);
    btnForward.addEventListener('click', naKraj);

    if (container) {
      container.addEventListener('click', function (e) {
        var th = e.target.closest('.lista-tablica__th--sortable');
        if (th && th.dataset.sortField) {
          var f2 = th.dataset.sortField2 || '';
          sortirajTablicu(th.dataset.sortField, f2);
        }
      });
      container.addEventListener('dblclick', function (e) {
        var tr = e.target.closest('.lista-tablica__scroll tbody tr');
        if (tr && tr._listaRow) {
          e.preventDefault();
          e.stopPropagation();
          listaInfo(tr._listaRow);
        }
      });
    }

    var btnPovratak = document.getElementById('btnPovratak');
    if (btnPovratak) {
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
    }

    if (!document._listaSelectDocClickBound) {
      document._listaSelectDocClickBound = true;
      document.addEventListener('click', function (e) {
        document.querySelectorAll('.lista-select--open').forEach(function (wrap) {
          if (!wrap.contains(e.target)) wrap.classList.remove('lista-select--open');
        });
      });
    }

    document.querySelectorAll('.lista-select').forEach(initListaSelect);
    osvjeziReloadState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
