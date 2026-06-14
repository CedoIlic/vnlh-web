/* =========================================================
   0-Kontrole.js
   Sav JS vezan za kontrole: tablica (gradnja, skrol, poravnanje,
   sortiranje, selekcija) i iscrtavanje zaglavlja tablice.
   Koristi tokene iz 0-Common.css i stilove iz 0-Kontrole.css.

   JAVNO API (globalne rutine) – sve su na globalu (window):
   --------------------------------------------------------
   • KontroleTablica(container, options)
     Inicijalizira kontrolu tablice. Ponašanje: gradi DOM, sortiranje
     po koloni, selekcija redova (single/multi), getRowId za id sloga.
     Vraća: setData, addRow, removeRow, refresh, build, getData,
     getSelectedIndices(), getSelectedRowIds(), clearSelection(). Traži: "function KontroleTablica".

   • KontroleSetEnabled(root, enabled)
     Enable/disable svih kontrola unutar root-a (document ili element).
     Ponašanje: postavlja disabled na sve edit, select, checkbox, napomena,
     edit-delete; na tablicu dodaje/uklanja --disabled klasu; na tipke
     unutar .kontrola-panel postavlja/uklanja disabled; ažurira labele.
     Traži: "function KontroleSetEnabled".

   • KontroleSetControlEnabled(element, enabled)
     Enable/disable jedne kontrole. Ponašanje: prepoznaje tip kontrole
     (edit, napomena, select, checkbox, edit-delete, tablica, tipka),
     postavlja disabled i ažurira povezanu labelu. Element može biti
     sam input/button ili wrapper koji sadrži kontrolu.
     Traži: "function KontroleSetControlEnabled".

   • KontroleSyncLabelsDisabledState(scope)
     Uskladi klasu kontrola-labela--disabled na labelama s [for] prema
     disabled stanju povezane kontrole. Korisno nakon programskog
     postavljanja disabled izvan KontroleSetEnabled.
     Traži: "function syncLabelsDisabledState".

   • KontroleInitEditDelete(root)
     Inicijalizira ponašanje edit-delete kontrola (X gumb, vidljivost).
     Za čvor s klasom kontrola-edit-delete__input--rich-html (DIV umjesto INPUT-a): briše innerHTML, X vidljiv prema textContent.
     Traži: "function initEditDelete".

   • KontroleInitCustomSelect(root)
     Inicijalizira custom select (otvaranje liste, tipkovnica, tip-ahead).
     Traži: "function initCustomSelect".

   • KontroleInitSlika(root)
     Inicijalizira kontrolu Slika (okvir auto/fix prema tokenu --slika_okvir_ponasanje).
     Traži: "function initSlika".

   • KontroleRefreshScrollbarHoverColor()
     Ponovno primjenjuje tokene scrollbara (npr. nakon promjene teme).

   • showPorukaModal(code, replacements, onClose)
     Zajednički modal poruka za cijelu aplikaciju. Kod iz MODAL_MESSAGES (0-Poruke_Tekstovi.js);
     replacements = niz za zamjenu #1, #2, #3; onClose = callback pri zatvaranju. Modal se kreira pri prvom pozivu.
   • closePorukaModal()
     Zatvara modal poruke.
   ========================================================= */

(function (global) {
  function getToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  var STYLE_ID_SCROLLBAR_HOVER = 'kontrole-scrollbar-hover';

  /** Postavlja vrijednosti tokena scrollbara na scroll element (iz :root) da pseudo-elementi naslijede naše boje, ne nasljeđene. */
  function syncScrollbarTokensToElement(scrollDiv) {
    if (!scrollDiv || !scrollDiv.classList || !scrollDiv.classList.contains('kontrola-tablica__scroll')) return;
    var bg = getToken('--tablica_scroll_bg');
    var klizac = getToken('--tablica_scroll_klizac');
    var hover = getToken('--tablica_scroll_klizac_hover');
    if (bg) scrollDiv.style.setProperty('--tablica_scroll_bg', bg);
    if (klizac) scrollDiv.style.setProperty('--tablica_scroll_klizac', klizac);
    if (hover) scrollDiv.style.setProperty('--tablica_scroll_klizac_hover', hover);
  }

  /** Svi scroll kontejneri tablice – ažuriraj tokene scrollbara (poštuje temu). */
  function syncAllScrollbarTokens() {
    document.querySelectorAll('.kontrola-tablica__scroll').forEach(syncScrollbarTokensToElement);
  }

  /** Backup za WebKit: ako pseudo-element i dalje ne nasljeđuje var() s elementa, ubrizgaj pravilo iz tokena (bez fallbacka). */
  function injectScrollbarHoverStyle() {
    var value = getToken('--tablica_scroll_klizac_hover');
    if (!value) return;
    var el = document.getElementById(STYLE_ID_SCROLLBAR_HOVER);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID_SCROLLBAR_HOVER;
      document.head.appendChild(el);
    }
    var safe = value.replace(/[\\'"<>]/g, '');
    el.textContent = '.kontrola-tablica__scroll::-webkit-scrollbar-thumb:hover, .kontrola-select__list::-webkit-scrollbar-thumb:hover, .kontrola-prikaz::-webkit-scrollbar-thumb:hover, .kontrola-napomena::-webkit-scrollbar-thumb:hover { background: ' + safe + ' !important; }';
  }

  function applyTokenClasses(container) {
    container.classList.remove('tablica--podaci-h-linije', 'tablica--podaci-v-linije', 'tablica--zaglavlje-v-linije', 'tablica--striped', 'tablica--multi-select');
    if (getToken('--tablica_podaci_h_linije') === 'true') container.classList.add('tablica--podaci-h-linije');
    if (getToken('--tablica_podaci_v_linije') === 'true') container.classList.add('tablica--podaci-v-linije');
    if (getToken('--tablica_zaglavlje_v_linije') === 'true') container.classList.add('tablica--zaglavlje-v-linije');
    if (getToken('--tablica_podaci_striped') === 'true') container.classList.add('tablica--striped');
    if (getToken('--tablica_selekcija_više_redova') === 'true') container.classList.add('tablica--multi-select');
  }

  function syncTableWidths(container) {
    if (!container) return;
    var headerTable = container.querySelector('.kontrola-tablica__header table');
    var tableBody = container.querySelector('.kontrola-tablica__scroll table');
    var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
    var headerDiv = container.querySelector('.kontrola-tablica__header');
    var inner = container.querySelector('.kontrola-tablica__inner');
    if (!headerTable || !tableBody) return;

    /* Primarna širina = zaglavlje. Pri brzom osvježavanju tbody (npr. filter Traži) layout ponekad još
     * nije izračunat pa je offsetWidth 0 – tada uzmi širinu roditelja (scroll / panel) da tablica podataka
     * ne ostane na 0 px (nestane zaglavlje/stupci). */
    var w = headerTable.offsetWidth;
    if (!w || w < 2) {
      if (headerDiv && headerDiv.clientWidth >= 2) w = headerDiv.clientWidth;
    }
    if (!w || w < 2) {
      if (scrollDiv && scrollDiv.clientWidth >= 2) w = scrollDiv.clientWidth;
    }
    if (!w || w < 2) {
      if (inner && inner.clientWidth >= 2) w = inner.clientWidth;
    }
    if (!w || w < 2) {
      if (container.clientWidth >= 2) w = container.clientWidth;
    }
    /* Zadnja uspješna širina (npr. pri kliku/selekciji layout kratko vrati 0 – ne „gubi” zaglavlje). */
    if ((!w || w < 2) && container._vnlhLastGoodTablicaBodyW >= 2) {
      w = container._vnlhLastGoodTablicaBodyW;
    }

    if (!w || w < 2) {
      var n = (container._vnlhSyncTableWidthsAttempts || 0) + 1;
      if (n <= 6) {
        container._vnlhSyncTableWidthsAttempts = n;
        requestAnimationFrame(function () {
          syncTableWidths(container);
        });
      } else {
        container._vnlhSyncTableWidthsAttempts = 0;
        if (container._vnlhLastGoodTablicaBodyW >= 2) {
          w = container._vnlhLastGoodTablicaBodyW;
          tableBody.style.width = w + 'px';
          tableBody.style.minWidth = w + 'px';
        }
      }
      return;
    }
    container._vnlhSyncTableWidthsAttempts = 0;
    container._vnlhLastGoodTablicaBodyW = w;
    tableBody.style.width = w + 'px';
    tableBody.style.minWidth = w + 'px';
  }

  function applyScrollbarRule(container, scrollDiv) {
    syncScrollbarTokensToElement(scrollDiv);
    var table = scrollDiv.querySelector('table');
    if (!table || !table.tBodies[0]) return;
    var rowHeight = parseInt(getToken('--tablica_row_h'), 10) || 40;
    var totalRows = table.tBodies[0].rows.length;
    var contentHeight = totalRows * rowHeight;
    var viewportH = scrollDiv.clientHeight;
    /* Kad je visina scroll područja još 0 (fokus/klik prije reflowa), ne diraj inline širine zaglavlja – inače „nestane” cijeli red zaglavlja. */
    if (viewportH <= 0) {
      var deferN = (container._vnlhApplyScrollbarDefer || 0) + 1;
      if (deferN <= 10) {
        container._vnlhApplyScrollbarDefer = deferN;
        requestAnimationFrame(function () {
          var sd = container.querySelector('.kontrola-tablica__scroll');
          if (sd) applyScrollbarRule(container, sd);
        });
      } else {
        container._vnlhApplyScrollbarDefer = 0;
      }
      return;
    }
    container._vnlhApplyScrollbarDefer = 0;
    var threshold = 0.1 * rowHeight;
    /* Skrol (i linija lijevo od njega) samo kad stvarno postoji skrol – scrollHeight > clientHeight; inače pri otvaranju modala clientHeight može biti 0 pa bi linija bila vidljiva krivo */
    var skrolVidljiv = viewportH > 0 && scrollDiv.scrollHeight > viewportH && (scrollDiv.scrollHeight - viewportH) > threshold;
    if (skrolVidljiv) {
      scrollDiv.style.overflowX = 'hidden';
      scrollDiv.style.overflowY = 'auto';
    } else {
      scrollDiv.style.overflowX = 'hidden';
      scrollDiv.style.overflowY = 'hidden';
    }
    var headerDiv = container.querySelector('.kontrola-tablica__header');
    var headerTable = headerDiv ? headerDiv.querySelector('table') : null;
    if (headerDiv) {
      if (skrolVidljiv) {
        headerDiv.classList.add('kontrola-tablica__header--skrol-vidljiv');
      } else {
        headerDiv.classList.remove('kontrola-tablica__header--skrol-vidljiv');
        /* Ne skidaj inline širinu zaglavlja dok viewport scrolla nema visine (0) – inače sljedeći
         * syncTableWidths čita offsetWidth 0 i „nestane” zaglavlje (npr. klik u ćeliju pri tranziciji layouta). */
        if (viewportH > 0 && headerTable && !headerTable.getAttribute('data-width-pct')) headerTable.style.width = '';
      }
    }
    if (skrolVidljiv) {
      scrollDiv.classList.add('kontrola-tablica__scroll--skrol-vidljiv');
      var scrollWrap = scrollDiv.parentElement;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (scrollWrap) {
            var linija = scrollWrap.querySelector('.kontrola-tablica__scroll-linija');
            if (!linija) {
              linija = document.createElement('div');
              linija.className = 'kontrola-tablica__scroll-linija';
              scrollWrap.appendChild(linija);
            }
            var sbW = parseInt(getToken('--tablica_sirina_scrol_bara'), 10) || 12;
            var lineW = parseInt(getToken('--tablica_grid_v_line_debljina'), 10) || 1;
            var leftPx = Math.round(scrollWrap.clientWidth - sbW - lineW);
            linija.style.left = leftPx + 'px';
            linija.style.right = '';
            linija.style.display = '';
          }
          /* Zaglavlje: tablica = širina područja za sadržaj (bez scrollbara); preskoči ako forma drži postotak (data-width-pct). */
          if (headerTable && skrolVidljiv && !headerTable.getAttribute('data-width-pct')) {
            var contentW = scrollDiv.clientWidth;
            /* Premali broj (npr. 1–2 px u tranziciji) zna zgnječiti thead. */
            if (contentW >= 8) headerTable.style.width = contentW + 'px';
          }
          syncTableWidths(container);
        });
      });
    } else {
      scrollDiv.classList.remove('kontrola-tablica__scroll--skrol-vidljiv');
      var scrollWrap = scrollDiv.parentElement;
      var linija = scrollWrap ? scrollWrap.querySelector('.kontrola-tablica__scroll-linija') : null;
      if (linija) linija.remove();
      /* Dvostruki frame kao kod skrol-vidljiv grane – nakon uklanjanja širine zaglavlja layout mora sjesti. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          syncTableWidths(container);
        });
      });
    }
  }

  function applyStripedRows(container) {
    if (getToken('--tablica_podaci_striped') !== 'true') return;
    var rows = container.querySelectorAll('.kontrola-tablica__scroll tbody tr');
    rows.forEach(function (tr, i) {
      if (i % 2 === 1) tr.classList.add('tablica-row-striped');
      else tr.classList.remove('tablica-row-striped');
    });
  }

  /**
   * Iscrtava zaglavlje tablice (blok .kontrola-tablica__header + tablica s thead).
   * headerData: niz stringova (naslovi) ili niz objekata { title, sortable_icon?, align? }.
   * Ako je sortable_icon === 1, u ćeliju se dodaje ikona .kontrola-icon--arrows-up-down
   * (align L/C → ikona desno, align R → ikona lijevo).
   */
  function iscrtajZaglavljeTablice(container, n, headerData, onSortClick) {
    var headerDiv = document.createElement('div');
    headerDiv.className = 'kontrola-tablica__header';
    var tableHeader = document.createElement('table');
    var thead = document.createElement('thead');
    var trHead = document.createElement('tr');
    for (var c = 0; c < n; c++) {
      var raw = (headerData && headerData[c]) != null ? headerData[c] : null;
      var sortableIcon = (raw && typeof raw === 'object' && raw.sortable_icon === 1);
      /* align: neovisno o velikom/malom slovu (c/C, l/L, r/R) */
      var alignRaw = (raw && typeof raw === 'object' && raw.align != null) ? String(raw.align).toLowerCase() : 'l';
      var align = (alignRaw === 'r' || alignRaw === 'c' || alignRaw === 'l') ? alignRaw : 'l';
      var alignVal = align === 'r' ? 'right' : (align === 'c' ? 'center' : 'left');

      var th = document.createElement('th');
      th.dataset.col = c;
      th.style.textAlign = alignVal;
      if (sortableIcon) {
        th.classList.add('kontrola-tablica__th--align-' + align.toUpperCase());
        var inner = document.createElement('span');
        inner.className = 'kontrola-tablica__th-inner';
        inner.style.textAlign = alignVal;
        var titleSpan = document.createElement('span');
        titleSpan.className = 'kontrola-tablica__th-title';
        titleSpan.style.textAlign = alignVal;
        titleSpan.textContent = typeof raw === 'string' ? raw : (raw && raw.title != null ? String(raw.title) : '');
        inner.appendChild(titleSpan);
        var iconSpan = document.createElement('span');
        iconSpan.className = 'kontrola-icon--arrows-up-down kontrola-tablica__th-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        inner.appendChild(iconSpan);
        th.appendChild(inner);
      } else {
        th.textContent = typeof raw === 'string' ? raw : (raw && raw.title != null ? String(raw.title) : '');
      }
      th.addEventListener('click', function () {
        if (typeof onSortClick === 'function') onSortClick(parseInt(this.dataset.col, 10));
      });
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);
    tableHeader.appendChild(thead);
    headerDiv.appendChild(tableHeader);
    container.appendChild(headerDiv);
  }

  /**
   * Inicijalizira kontrolu tablice na danom kontejneru.
   * Ponašanje: gradi header i scroll tablicu, iscrtava redove iz options.data; na klik reda
   * dodaje/uklanja selekciju (single ili multi ako je tablica--multi-select); poziva
   * options.onSelectionChange nakon promjene; getRowId(row, index) opcionalno postavlja
   * data-row-id na tr (inače indeks). Sortiranje po zaglavlju kolone.
   * headerColumns[].type "i" = ćelija sa <img> (row[c] = URL); headerColumns[].sortable 0 = bez sorta na klik TH.
   * @param {HTMLElement} container - Element s klasom .kontrola-tablica
   * @param {Object} options - getBrojKolona(): number, headerLabels: string[] ili function(n), data?: array redova, getRowId?(row, index): any, onSelectionChange?(): void
   * @returns {Object} setData, addRow, removeRow, refresh, build, getData, getSelectedIndices(), getSelectedRowIds()
   */
  function KontroleTablica(container, options) {
    options = options || {};
    var getBrojKolona = options.getBrojKolona || function () { return 5; };
    var headerLabels = options.headerLabels || function (n) {
      var arr = [];
      for (var c = 0; c < n; c++) arr.push('');
      return arr;
    };
    var headerColumns = options.headerColumns || null;

    var getRowId = typeof options.getRowId === 'function' ? options.getRowId : null;

    var podaci = options.data ? options.data.slice() : [];
    var sortColumn = -1;
    var sortAsc = true;

    function getN() {
      var n = typeof getBrojKolona === 'function' ? getBrojKolona() : getBrojKolona;
      n = parseInt(n, 10);
      if (isNaN(n) || n < 1) return 1;
      if (n > 20) return 20;
      return n;
    }

    function sortData() {
      if (sortColumn < 0) return;
      /* type kolone: neovisno o velikom/malom (t/T, n/N, d/D, b/B) */
      var colType = (Array.isArray(headerColumns) && headerColumns[sortColumn] && headerColumns[sortColumn].type) ? String(headerColumns[sortColumn].type).toLowerCase() : 't';
      podaci.sort(function (a, b) {
        var va = a[sortColumn];
        var vb = b[sortColumn];
        var cmp = 0;
        if (colType === 'n' || colType === 'b') {
          var na = va !== '' && va != null ? Number(va) : NaN;
          var nb = vb !== '' && vb != null ? Number(vb) : NaN;
          if (isNaN(na) && isNaN(nb)) cmp = 0;
          else if (isNaN(na)) cmp = 1;
          else if (isNaN(nb)) cmp = -1;
          else cmp = na < nb ? -1 : (na > nb ? 1 : 0);
        } else if (colType === 'd') {
          var ta = va !== '' && va != null ? new Date(va).getTime() : NaN;
          var tb = vb !== '' && vb != null ? new Date(vb).getTime() : NaN;
          if (isNaN(ta) && isNaN(tb)) cmp = 0;
          else if (isNaN(ta)) cmp = 1;
          else if (isNaN(tb)) cmp = -1;
          else cmp = ta < tb ? -1 : (ta > tb ? 1 : 0);
        } else if (colType === 'i') {
          /* Slika: sortiranje po id retka (stabilno), ne po URL-u. */
          var ida = (a && a.id != null) ? Number(a.id) : 0;
          var idb = (b && b.id != null) ? Number(b.id) : 0;
          if (isNaN(ida)) ida = 0;
          if (isNaN(idb)) idb = 0;
          cmp = ida < idb ? -1 : (ida > idb ? 1 : 0);
        } else {
          var vs = va != null ? String(va) : '';
          var vbs = vb != null ? String(vb) : '';
          cmp = vs.localeCompare(vbs, undefined, { numeric: false });
        }
        return sortAsc ? cmp : -cmp;
      });
    }

    function updateTableSelectedState() {
      var hasSelected = !!container.querySelector('.tablica-row-selected');
      if (hasSelected) container.classList.add('kontrola-tablica--has-selected');
      else container.classList.remove('kontrola-tablica--has-selected');
    }

    function renderTbody(tbodyEl) {
      var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
      var tableBody = scrollDiv && scrollDiv.querySelector('table');
      var tbody = tbodyEl || (tableBody && tableBody.querySelector('tbody'));
      if (!tbody) return;
      var hadSelection = tbody.querySelectorAll('tr.tablica-row-selected').length > 0;
      tbody.innerHTML = '';
      var n = getN();
      for (var r = 0; r < podaci.length; r++) {
        var row = podaci[r];
        var tr = document.createElement('tr');
        tr.dataset.rowIndex = r;
        var rid = getRowId ? getRowId(row, r) : r;
        tr.dataset.rowId = String(rid);
        tr.addEventListener('click', function (e) {
          if (container._cellShortTapScroll) { container._cellShortTapScroll = false; return; }
          if ((container.classList.contains('kontrola-tablica--disabled') || container.classList.contains('kontrola-tablica--readonly'))) return;
          var multi = (options.multiSelect === true) || container.classList.contains('tablica--multi-select');
          var shift = e && (e.shiftKey === true);
          var ctrl = e && (e.ctrlKey === true || e.metaKey === true);
          var isTouch = e && (e.pointerType === 'touch' || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents));
          var currentIdx = parseInt(this.dataset.rowIndex, 10);
          if (isNaN(currentIdx)) currentIdx = 0;

          if (multi && shift) {
            var lastIdx = container._tablicaLastClickedIndex;
            if (lastIdx == null || isNaN(lastIdx)) lastIdx = currentIdx;
            var from = Math.min(lastIdx, currentIdx);
            var to = Math.max(lastIdx, currentIdx);
            var allRows = tbody.querySelectorAll('tr');
            for (var i = 0; i < allRows.length; i++) {
              var idx = parseInt(allRows[i].dataset.rowIndex, 10);
              if (idx >= from && idx <= to) allRows[i].classList.add('tablica-row-selected');
              else allRows[i].classList.remove('tablica-row-selected');
            }
            container._tablicaLastClickedIndex = currentIdx;
          } else if (multi && isTouch) {
            /* Na touch: jednostruki tap = promjena selekcije (nakon 500 ms); dvostruki tap = dodaj red u selekciju (ne dira ostale). */
            if (container._tablicaTapPending) {
              clearTimeout(container._tablicaTapPending);
              container._tablicaTapPending = null;
            }
            var now = Date.now();
            var sameRow = (container._tablicaLastTapRowIndex === currentIdx);
            var recent = (now - (container._tablicaLastTapTime || 0)) < 500;
            if (sameRow && recent) {
              /* Dvostruki tap: samo dodaj ovaj red u selekciju, prethodnu selekciju ne diraj. */
              this.classList.add('tablica-row-selected');
              container._tablicaLastClickedIndex = currentIdx;
              container._tablicaLastTapTime = 0;
              container._tablicaLastTapRowIndex = -1;
            } else {
              container._tablicaLastTapTime = now;
              container._tablicaLastTapRowIndex = currentIdx;
              var trEl = this;
              container._tablicaTapPending = setTimeout(function () {
                container._tablicaTapPending = null;
                var sel = container.querySelectorAll('.tablica-row-selected');
                sel.forEach(function (el) { el.classList.remove('tablica-row-selected'); });
                trEl.classList.add('tablica-row-selected');
                container._tablicaLastClickedIndex = currentIdx;
                updateTableSelectedState();
                var sd = container.querySelector('.kontrola-tablica__scroll');
                if (sd) sd.focus({ preventScroll: true });
                if (options.onSelectionChange) {
                  var cb = options.onSelectionChange;
                  requestAnimationFrame(function () { cb(); });
                }
              }, 500);
            }
          } else if (multi && ctrl) {
            this.classList.toggle('tablica-row-selected');
            container._tablicaLastClickedIndex = currentIdx;
          } else {
            var selected = container.querySelectorAll('.tablica-row-selected');
            selected.forEach(function (el) { el.classList.remove('tablica-row-selected'); });
            this.classList.add('tablica-row-selected');
            container._tablicaLastClickedIndex = currentIdx;
          }

          updateTableSelectedState();
          var scrollDivForFocus = container.querySelector('.kontrola-tablica__scroll');
          if (scrollDivForFocus) scrollDivForFocus.focus({ preventScroll: true });
          if (options.onSelectionChange) {
            var cb = options.onSelectionChange;
            requestAnimationFrame(function () { cb(); });
          }
        });
        for (var c = 0; c < n; c++) {
          var td = document.createElement('td');
          /* type kolone: neovisno o velikom/malom (t/T, n/N, d/D, b/B) */
          var colType = (Array.isArray(headerColumns) && headerColumns[c] && headerColumns[c].type) ? String(headerColumns[c].type).toLowerCase() : 't';
          if (colType === 'b') {
            var chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'kontrola-checkbox';
            chk.checked = row[c] === 1 || row[c] === true || row[c] === '1';
            var colReadonly = (Array.isArray(headerColumns) && headerColumns[c] && headerColumns[c].cell_readonly === 1);
            chk.addEventListener('click', function (e) {
              if (colReadonly) e.preventDefault();
              else e.stopPropagation();
            });
            td.appendChild(chk);
          } else if (colType === 'i') {
            /* Kolona slike: row[c] = puni URL do slike (GET endpoint); prazno = placeholder bez <img>. */
            var cellImg = document.createElement('div');
            cellImg.className = 'kontrola-tablica__cell-inner kontrola-tablica__cell-inner--slika';
            cellImg.setAttribute('tabindex', '0');
            var urlSlika = row[c] != null ? String(row[c]).trim() : '';
            if (urlSlika) {
              var im = document.createElement('img');
              im.className = 'kontrola-tablica__cell-img';
              im.setAttribute('alt', '');
              im.setAttribute('width', '48');
              im.setAttribute('height', '48');
              im.setAttribute('loading', 'lazy');
              im.setAttribute('decoding', 'async');
              im.src = urlSlika;
              im.addEventListener('error', function () {
                cellImg.classList.add('kontrola-tablica__cell-inner--slika-prazno');
                if (im.parentNode) im.parentNode.removeChild(im);
              });
              cellImg.appendChild(im);
            } else {
              cellImg.classList.add('kontrola-tablica__cell-inner--slika-prazno');
            }
            td.appendChild(cellImg);
          } else {
            var cellInner = document.createElement('div');
            cellInner.className = 'kontrola-tablica__cell-inner';
            cellInner.setAttribute('tabindex', '0');
            cellInner.textContent = row[c] != null ? row[c] : '';
            td.appendChild(cellInner);
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      applyStripedRows(container);
      updateTableSelectedState();
      if (hadSelection && options.onSelectionChange) {
        var cb = options.onSelectionChange;
        requestAnimationFrame(function () { cb(); });
      }
      requestAnimationFrame(function () {
        syncTableWidths(container);
      });
    }

    function build() {
      var n = getN();
      applyTokenClasses(container);
      container.innerHTML = '';

      var inner = document.createElement('div');
      inner.className = 'kontrola-tablica__inner';

      var headerData = (Array.isArray(headerColumns) && headerColumns.length >= n)
        ? headerColumns.slice(0, n)
        : (typeof headerLabels === 'function' ? headerLabels(n) : headerLabels);
      iscrtajZaglavljeTablice(inner, n, headerData, function (col) {
        var hc = headerColumns && headerColumns[col];
        if (hc && hc.sortable === 0) return;
        if (sortColumn === col) sortAsc = !sortAsc;
        else sortAsc = true;
        sortColumn = col;
        sortData();
        renderTbody();
      });

      var scrollWrap = document.createElement('div');
      scrollWrap.className = 'kontrola-tablica__scroll-wrap';
      var scrollDiv = document.createElement('div');
      scrollDiv.className = 'kontrola-tablica__scroll';
      scrollDiv.setAttribute('tabindex', '0');
      scrollDiv.setAttribute('aria-label', 'Tablica podataka – strelice gore/dolje za selekciju ili skrol');
      var tableBody = document.createElement('table');
      var tbody = document.createElement('tbody');
      tableBody.appendChild(tbody);
      scrollDiv.appendChild(tableBody);
      scrollWrap.appendChild(scrollDiv);
      inner.appendChild(scrollWrap);
      container.appendChild(inner);

      renderTbody(tbody);
      applyStripedRows(container);
      syncScrollbarTokensToElement(scrollDiv);
      applyScrollbarRule(container, scrollDiv);

      /* Hover nad ćelijom: skrol do kraja; brzina (px/s) iz tokena – trajanje = udaljenost / brzina, neovisno o dužini teksta. */
      (function () {
        var enabled = (getToken('--tablica_cell_hover_scroll') === '1' || getToken('--tablica_cell_hover_scroll') === 'true');
        var speedPxPerSec = parseInt(getToken('--tablica_cell_hover_scroll_speed'), 10) || 150;
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var minMs = 200;
        var maxMs = 2500;

        function durationFromDistance(px) {
          if (speedPxPerSec <= 0) return minMs;
          var ms = Math.round((Math.abs(px) / speedPxPerSec) * 1000);
          return Math.max(minMs, Math.min(maxMs, ms));
        }

        function animateScrollLeft(inner, toVal, ms, onDone) {
          if (inner._cellScrollAnimId) cancelAnimationFrame(inner._cellScrollAnimId);
          var startVal = inner.scrollLeft;
          var startTime = null;
          inner.classList.add('kontrola-hover-scroll-active');
          function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var elapsed = timestamp - startTime;
            var progress = Math.min(1, elapsed / ms);
            inner.scrollLeft = startVal + (toVal - startVal) * progress;
            if (progress < 1) {
              inner._cellScrollAnimId = requestAnimationFrame(step);
            } else {
              inner._cellScrollAnimId = null;
              if (toVal === 0) inner.classList.remove('kontrola-hover-scroll-active');
              if (onDone) onDone();
            }
          }
          inner._cellScrollAnimId = requestAnimationFrame(step);
        }

        scrollDiv.addEventListener('mouseover', function (e) {
          if (!enabled) return;
          var td = e.target && e.target.closest ? e.target.closest('td') : null;
          if (!td) return;
          var inner = td.querySelector('.kontrola-tablica__cell-inner');
          if (!inner || inner.scrollWidth <= inner.clientWidth) return;
          var end = inner.scrollWidth - inner.clientWidth;
          if (reduceMotion) {
            inner.classList.add('kontrola-hover-scroll-active');
            inner.scrollLeft = end;
          } else {
            animateScrollLeft(inner, end, durationFromDistance(end));
          }
        });

        scrollDiv.addEventListener('mouseout', function (e) {
          if (!enabled) return;
          var td = e.target && e.target.closest ? e.target.closest('td') : null;
          if (!td) return;
          var related = e.relatedTarget;
          if (related && td.contains(related)) return;
          var inner = td.querySelector('.kontrola-tablica__cell-inner');
          if (!inner || inner.scrollLeft === 0) return;
          var distance = inner.scrollLeft;
          if (reduceMotion) {
            inner.scrollLeft = 0;
            inner.classList.remove('kontrola-hover-scroll-active');
          } else {
            animateScrollLeft(inner, 0, durationFromDistance(distance));
          }
        });

        var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
        var CELL_SCROLL_RETURN_MS = 1000;

        /* Na mobu: kratki tap = samo skrol (focus), dugi tap = selekcija reda. Na phone: nakon 1 s skrol se sam vraća. */
        scrollDiv.addEventListener('focusin', function (e) {
          if (!enabled) return;
          var inner = e.target && e.target.classList && e.target.classList.contains('kontrola-tablica__cell-inner') ? e.target : null;
          /* Skini ellipsis (kontrola-hover-scroll-active) s ostalih ćelija kad fokus pređe na drugu */
          var others = scrollDiv.querySelectorAll('.kontrola-tablica__cell-inner.kontrola-hover-scroll-active');
          for (var i = 0; i < others.length; i++) {
            if (others[i] !== inner) others[i].classList.remove('kontrola-hover-scroll-active');
          }
          if (!inner) return;
          /* Dodaj klasu prvo da ellipsis nestane PRIJE početka skrola */
          inner.classList.add('kontrola-hover-scroll-active');
          inner.offsetHeight; /* reflow */
          if (inner.scrollWidth <= inner.clientWidth) {
            inner.classList.remove('kontrola-hover-scroll-active');
            return;
          }
          if (container._cellScrollReturnTimer) {
            clearTimeout(container._cellScrollReturnTimer);
            container._cellScrollReturnTimer = null;
            container._cellScrollReturnInner = null;
          }
          var end = inner.scrollWidth - inner.clientWidth;
          function doScroll() {
            if (reduceMotion) {
              inner.scrollLeft = end;
            } else {
              animateScrollLeft(inner, end, durationFromDistance(end));
            }
          }
          if (reduceMotion) {
            requestAnimationFrame(function () { requestAnimationFrame(doScroll); });
          } else {
            /* Čekaj 2 frame-a da browser repaint-a stanje bez ellipsisa prije animacije */
            requestAnimationFrame(function () {
              requestAnimationFrame(doScroll);
            });
          }
          if (isTouchDevice) {
            container._cellScrollReturnInner = inner;
            container._cellScrollReturnTimerSetAt = Date.now();
            container._cellScrollReturnTimer = setTimeout(function () {
              container._cellScrollReturnTimer = null;
              container._cellScrollReturnTimerSetAt = undefined;
              var el = container._cellScrollReturnInner;
              container._cellScrollReturnInner = null;
              if (el && el.scrollLeft !== 0) {
                if (reduceMotion) {
                  el.scrollLeft = 0;
                  el.classList.remove('kontrola-hover-scroll-active');
                  el.blur();
                } else {
                  animateScrollLeft(el, 0, durationFromDistance(el.scrollLeft), function () {
                    el.classList.remove('kontrola-hover-scroll-active');
                    el.blur();
                  });
                }
              }
            }, CELL_SCROLL_RETURN_MS);
          }
        });
        var CELL_SCROLL_GRACE_MS = 600;
        scrollDiv.addEventListener('focusout', function (e) {
          if (!enabled) return;
          var inner = e.target && e.target.classList && e.target.classList.contains('kontrola-tablica__cell-inner') ? e.target : null;
          if (inner && container._cellScrollReturnInner === inner && container._cellScrollReturnTimer && isTouchDevice) {
            var setAt = container._cellScrollReturnTimerSetAt || 0;
            if ((Date.now() - setAt) < CELL_SCROLL_GRACE_MS) return;
            clearTimeout(container._cellScrollReturnTimer);
            container._cellScrollReturnTimer = null;
            container._cellScrollReturnInner = null;
          } else if (inner && container._cellScrollReturnInner === inner && container._cellScrollReturnTimer) {
            clearTimeout(container._cellScrollReturnTimer);
            container._cellScrollReturnTimer = null;
            container._cellScrollReturnInner = null;
          }
          if (!inner || inner.scrollLeft === 0) return;
          var distance = inner.scrollLeft;
          function doneScrollBack() {
            if (!scrollDiv.contains(document.activeElement)) inner.classList.remove('kontrola-hover-scroll-active');
          }
          if (reduceMotion) {
            inner.scrollLeft = 0;
            doneScrollBack();
          } else {
            animateScrollLeft(inner, 0, durationFromDistance(distance), doneScrollBack);
          }
        });

        var SHORT_TAP_MS = 400;
        function recordTapStart(e) {
          var td = e.target && e.target.closest ? e.target.closest('td') : null;
          container._cellTapStart = Date.now();
          container._cellTapTarget = td;
          container._cellTapActualDuration = undefined;
        }
        scrollDiv.addEventListener('mousedown', recordTapStart);
        scrollDiv.addEventListener('touchstart', recordTapStart, { passive: true });
        scrollDiv.addEventListener('touchend', function (e) {
          if (container._cellTapTarget) container._cellTapActualDuration = Date.now() - (container._cellTapStart || 0);
        }, { passive: true });

        scrollDiv.addEventListener('click', function (e) {
          var td = container._cellTapTarget;
          container._cellTapTarget = null;
          var actualDuration = container._cellTapActualDuration;
          container._cellTapActualDuration = undefined;
          if (!td || !enabled) return;
          var duration = (actualDuration != null) ? actualDuration : (Date.now() - (container._cellTapStart || 0));
          var inner = td.querySelector('.kontrola-tablica__cell-inner');
          var animating = inner && inner._cellScrollAnimId;
          var isShortTap = duration < SHORT_TAP_MS;
          var hasOverflow = false;
          if (inner && !animating) {
            inner.classList.add('kontrola-hover-scroll-active');
            hasOverflow = inner.scrollWidth > inner.clientWidth;
            if (!hasOverflow) inner.classList.remove('kontrola-hover-scroll-active');
          }
          if (isShortTap && hasOverflow) {
            e.preventDefault();
            e.stopPropagation();
            container._cellShortTapScroll = true;
            inner.focus();
          if (isTouchDevice) {
            if (container._cellScrollReturnTimer) clearTimeout(container._cellScrollReturnTimer);
            container._cellScrollReturnInner = inner;
            container._cellScrollReturnTimerSetAt = Date.now();
            container._cellScrollReturnTimer = setTimeout(function () {
                container._cellScrollReturnTimer = null;
                container._cellScrollReturnTimerSetAt = undefined;
                var el = container._cellScrollReturnInner;
                container._cellScrollReturnInner = null;
                if (el && el.scrollLeft !== 0) {
                  if (reduceMotion) {
                    el.scrollLeft = 0;
                    el.classList.remove('kontrola-hover-scroll-active');
                    el.blur();
                  } else {
                    animateScrollLeft(el, 0, durationFromDistance(el.scrollLeft), function () {
                      el.classList.remove('kontrola-hover-scroll-active');
                      el.blur();
                    });
                  }
                }
              }, CELL_SCROLL_RETURN_MS);
            }
          }
        }, true);
      })();

      var panel = container.closest && container.closest('.kontrola-panel-tablica');
      
      container.addEventListener('mousedown', function (e) {
        if ((container.classList.contains('kontrola-tablica--disabled') || container.classList.contains('kontrola-tablica--readonly'))) return;
        if (container.contains(e.target)) {
          scrollDiv.focus({ preventScroll: true });
        }
      });

      container.addEventListener('click', function (e) {
        if ((container.classList.contains('kontrola-tablica--disabled') || container.classList.contains('kontrola-tablica--readonly'))) return;
        if (container.contains(e.target) && !e.target.closest('.kontrola-btn')) {
          scrollDiv.focus({ preventScroll: true });
        }
      });

      if (panel) {
        panel.addEventListener('mousedown', function (e) {
          if ((container.classList.contains('kontrola-tablica--disabled') || container.classList.contains('kontrola-tablica--readonly'))) return;
          if (panel.contains(e.target) && !e.target.closest('.kontrola-btn') && !e.target.closest('.kontrola-panel__header')) {
            scrollDiv.focus({ preventScroll: true });
          }
        });
      }

      var tableKeydownHandler = function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        if ((container.classList.contains('kontrola-tablica--disabled') || container.classList.contains('kontrola-tablica--readonly'))) return;
        var activeEl = document.activeElement;
        var isInPanel = panel && panel.contains(activeEl);
        var isInTable = container.contains(activeEl) || activeEl === scrollDiv;
        if (!isInTable && !isInPanel) return;
        e.preventDefault();
        e.stopPropagation();
        var rows = scrollDiv.querySelectorAll('tbody tr');
        var selectedTr = scrollDiv.querySelector('tbody tr.tablica-row-selected');
        if (selectedTr && rows.length > 0) {
          var idx = parseInt(selectedTr.dataset.rowIndex, 10);
          if (!isNaN(idx)) {
            var nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, rows.length - 1) : Math.max(idx - 1, 0);
            selectedTr.classList.remove('tablica-row-selected');
            rows[nextIdx].classList.add('tablica-row-selected');
            updateTableSelectedState();
            rows[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            if (options.onSelectionChange) {
              var cb = options.onSelectionChange;
              requestAnimationFrame(function () { cb(); });
            }
          }
        } else {
          if (activeEl !== scrollDiv) scrollDiv.focus();
          var rowH = parseInt(getToken('--tablica_row_h'), 10) || 40;
          var step = rowH;
          if (e.key === 'ArrowDown') scrollDiv.scrollTop = Math.min(scrollDiv.scrollTop + step, scrollDiv.scrollHeight - scrollDiv.clientHeight);
          else scrollDiv.scrollTop = Math.max(scrollDiv.scrollTop - step, 0);
        }
      };

      if (panel) {
        panel.addEventListener('keydown', tableKeydownHandler);
      }
      container.addEventListener('keydown', tableKeydownHandler);
      container._tableKeydownHandler = tableKeydownHandler;

      requestAnimationFrame(function () {
        syncTableWidths(container);
      });
    }

    function setupResize() {
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () {
          syncTableWidths(container);
          var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
          if (scrollDiv) applyScrollbarRule(container, scrollDiv);
        });
        ro.observe(container);
      }
      window.addEventListener('resize', function () {
        syncTableWidths(container);
        var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
        if (scrollDiv) applyScrollbarRule(container, scrollDiv);
      });
    }

    function setupPanelResizeClamp() {
      var panel = container.closest && container.closest('.kontrola-panel-tablica');
      if (!panel || typeof ResizeObserver === 'undefined') return;
      var body = panel.querySelector && panel.querySelector('.kontrola-panel__body');
      if (!body) return;
      
      function applyClamp() {
        var headH = parseInt(getToken('--tablica_head_h'), 10) || 42;
        var rowH = parseInt(getToken('--tablica_row_h'), 10) || 40;
        var extra = parseInt(getToken('--tablica_extra'), 10) || 1;
        var padY = parseFloat(getToken('--panel_body_padding_y')) || 16;
        /* --tablica_vidljivih_redova na panelu (npr. 3/4 u uskom) – ne :root (5). ResizeObserver svaki put ponovno čita (prijelaz širine panela). */
        function floorFromTableBody() {
          var vs = typeof getComputedStyle !== 'undefined' && panel ? getComputedStyle(panel).getPropertyValue('--tablica_vidljivih_redova').trim() : '';
          var v = parseInt(vs, 10);
          if (isNaN(v) || v < 1) v = parseInt(getToken('--tablica_vidljivih_redova'), 10) || 5;
          var tMin = headH + (rowH * v) + extra;
          var f = padY * 2 + tMin + 5;
          if (body.querySelector && body.querySelector('.kontrola-panel__resize-bar')) {
            var bStr = getToken('--panel_resize_bar_height');
            var bH = bStr ? parseFloat(bStr) : 28;
            if (!isNaN(bH) && bH > 0) f += bH;
          }
          return f;
        }
        var ro = new ResizeObserver(function () {
          var h = panel.offsetHeight;
          var floor = floorFromTableBody();
          var cs = panel.ownerDocument && getComputedStyle(panel).minHeight;
          if (cs && cs !== 'none' && cs !== 'auto') {
            var px = parseFloat(cs);
            if (!isNaN(px) && px > 0) floor = Math.max(floor, Math.round(px));
          }
          if (h < floor) panel.style.height = floor + 'px';
        });
        ro.observe(panel);
      }
      
      // Ako resize bar već postoji, primijeni odmah
      if (body.querySelector && body.querySelector('.kontrola-panel__resize-bar')) {
        applyClamp();
        return;
      }
      
      // Ako resize bar ne postoji, čekaj dok se ne doda pomoću MutationObserver
      if (typeof MutationObserver !== 'undefined') {
        var mo = new MutationObserver(function (mutations) {
          if (body.querySelector && body.querySelector('.kontrola-panel__resize-bar')) {
            mo.disconnect();
            // Koristi requestAnimationFrame da osiguraš da je DOM potpuno ažuriran
            requestAnimationFrame(function () {
              requestAnimationFrame(applyClamp);
            });
          }
        });
        mo.observe(body, { childList: true, subtree: true });
        
        // Fallback: ako MutationObserver ne detektira promjenu unutar 1 sekunde, primijeni bez resize bara
        setTimeout(function () {
          if (!body.querySelector || !body.querySelector('.kontrola-panel__resize-bar')) {
            mo.disconnect();
            applyClamp();
          }
        }, 1000);
      } else {
        // Fallback ako MutationObserver nije dostupan: čekaj kratko pa provjeri ponovno
        setTimeout(function () {
          applyClamp();
        }, 100);
      }
    }

    build();
    setupResize();
    setupPanelResizeClamp();

    return {
      setData: function (data) {
        podaci = data ? data.slice() : [];
        renderTbody();
        var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
        if (scrollDiv) applyScrollbarRule(container, scrollDiv);
      },
      getData: function () {
        return podaci.slice();
      },
      addRow: function (row) {
        podaci.push(row);
        renderTbody();
        var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
        if (scrollDiv) applyScrollbarRule(container, scrollDiv);
      },
      removeRow: function (index) {
        if (index < 0 || index >= podaci.length) return;
        podaci.splice(index, 1);
        renderTbody();
        var scrollDiv = container.querySelector('.kontrola-tablica__scroll');
        if (scrollDiv) applyScrollbarRule(container, scrollDiv);
      },
      refresh: function () {
        build();
      },
      build: build,
      getSelectedIndices: function () {
        var sel = container.querySelectorAll('.kontrola-tablica__scroll tbody tr.tablica-row-selected');
        var out = [];
        sel.forEach(function (tr) {
          var i = parseInt(tr.dataset.rowIndex, 10);
          if (!isNaN(i)) out.push(i);
        });
        return out;
      },
      getSelectedRowIds: function () {
        var sel = container.querySelectorAll('.kontrola-tablica__scroll tbody tr.tablica-row-selected');
        var out = [];
        sel.forEach(function (tr) {
          if (tr.dataset.rowId != null) out.push(tr.dataset.rowId);
        });
        return out;
      },
      setSelectedRowIds: function (ids) {
        var tbody = container.querySelector('.kontrola-tablica__scroll tbody');
        if (!tbody) return;
        var idSet = {};
        if (Array.isArray(ids)) for (var i = 0; i < ids.length; i++) idSet[String(ids[i])] = true;
        var allRows = tbody.querySelectorAll('tr');
        for (var j = 0; j < allRows.length; j++) {
          var tr = allRows[j];
          if (idSet[tr.dataset.rowId]) tr.classList.add('tablica-row-selected');
          else tr.classList.remove('tablica-row-selected');
        }
        updateTableSelectedState();
        if (options.onSelectionChange) {
          var cb = options.onSelectionChange;
          requestAnimationFrame(function () { cb(); });
        }
      },
      clearSelection: function () {
        var sel = container.querySelectorAll('.kontrola-tablica__scroll tbody tr.tablica-row-selected');
        sel.forEach(function (tr) { tr.classList.remove('tablica-row-selected'); });
        updateTableSelectedState();
        if (sel.length > 0 && options.onSelectionChange) {
          var cb = options.onSelectionChange;
          requestAnimationFrame(function () { cb(); });
        }
      }
    };
  }

  /* =====================================================
     KONTROLE – zajednički helperi (enable/disable, edit-delete)
     ===================================================== */

  /**
   * KONTROLA SELECT – custom select (display + lista) na temelju nativnog <select>-a.
   * Faza 1: samo klik mišem (bez tipkovnice).
   * @param {HTMLElement|Document} root
   */
  var _customSelectOptionIdCounter = 0;

  /**
   * Postavlja max-height liste selecta prema slobodnom prostoru ispod kontrole
   * (do donjeg ruba tijela panela – isključujući footer – ili viewport); ne prelazi --select_max_rows.
   * Ako lista ide preko granica panela (overflow: visible), koristi --select_rows redaka.
   */
  function applySelectListMaxHeight(wrap, listEl) {
    if (!wrap || !listEl) return;
    var rowH = parseInt(getToken('--tablica_row_h'), 10) || 40;
    var maxRows = parseInt(getToken('--select_max_rows'), 10) || 10;
    var selectRows = parseInt(getToken('--select_rows'), 10) || 5; // Broj redaka kad lista ide preko granica panela
    var maxFromToken = maxRows * rowH;
    var wrapRect = wrap.getBoundingClientRect();
    var marginBelow = 8;
    var spaceBelow;
    var panel = wrap.closest && wrap.closest('.kontrola-panel');
    
    // Provjeri da li lista ide preko granica panela (panel ima overflow: visible kad je select otvoren)
    var isOpen = wrap.classList.contains('kontrola-select--open');
    var listGoesOverPanel = isOpen && panel !== null;
    
    if (panel) {
      var panelBody = panel.querySelector('.kontrola-panel__body');
      var limitRect = panelBody ? panelBody.getBoundingClientRect() : panel.getBoundingClientRect();
      spaceBelow = limitRect.bottom - wrapRect.bottom - marginBelow;
    } else {
      spaceBelow = (window.innerHeight || document.documentElement.clientHeight) - wrapRect.bottom - marginBelow;
    }
    
    // Ako lista ide preko granica panela, koristi --select_rows redaka
    if (listGoesOverPanel) {
      var maxH = selectRows * rowH;
      listEl.style.maxHeight = maxH + 'px';
      return;
    }
    
    if (spaceBelow < rowH) spaceBelow = rowH;
    var maxH = Math.min(maxFromToken, Math.max(rowH, spaceBelow));
    listEl.style.maxHeight = maxH + 'px';
  }

  function initCustomSelect(root) {
    if (typeof document === 'undefined') return;
    var scope = root || document;

    // Jednokratni globalni handler za zatvaranje svih otvorenih selecta na klik izvan.
    if (!document._kontrolaSelectDocClickBound) {
      document.addEventListener('click', function (e) {
        var wraps = document.querySelectorAll('.kontrola-select.kontrola-select--open');
        wraps.forEach(function (wrap) {
          if (!wrap.contains(e.target)) {
            wrap.classList.remove('kontrola-select--open');
            wrap.setAttribute('aria-expanded', 'false');
            wrap.removeAttribute('aria-activedescendant');
            var listEl = wrap.querySelector('.kontrola-select__list');
            if (listEl) listEl.querySelectorAll('.kontrola-select__option--highlighted').forEach(function (o) { o.classList.remove('kontrola-select__option--highlighted'); });
          }
        });
      });
      document._kontrolaSelectDocClickBound = true;
    }

    var wrappers = scope.querySelectorAll('.kontrola-select');
    wrappers.forEach(function (wrap) {
      if (wrap.dataset.customSelectInit === '1') return;
      var nativeSel = wrap.querySelector('select');
      if (!nativeSel) return;
      // Nativni <select> koristimo samo kao model vrijednosti – makni ga iz tab redoslijeda,
      // fokus ide na wrapper (.kontrola-select) koji ima tabindex=0 i ARIA atribute.
      nativeSel.tabIndex = -1;
      wrap.dataset.customSelectInit = '1';

      var list = wrap.querySelector('.kontrola-select__list');
      var display = wrap.querySelector('.kontrola-select__display');
      var caret = wrap.querySelector('.kontrola-select__caret');
      if (!display) {
        display = document.createElement('div');
        display.className = 'kontrola-select__display';
        wrap.appendChild(display);
      }
      if (!caret) {
        caret = document.createElement('div');
        caret.className = 'kontrola-select__caret';
        caret.setAttribute('aria-hidden', 'true');
        wrap.appendChild(caret);
      }
      if (!caret.querySelector('.kontrola-icon--chevron-down')) {
        caret.innerHTML = '';
        var caretIcon = document.createElement('span');
        caretIcon.className = 'kontrola-icon--chevron-down';
        caretIcon.setAttribute('aria-hidden', 'true');
        caret.appendChild(caretIcon);
      }
      if (!list) {
        list = document.createElement('div');
        list.className = 'kontrola-select__list';
        wrap.appendChild(list);
      }
      // Unutarnji span za tekst (da eventualni budući scroll ne \"jede\" padding)
      var displayInner = display.querySelector('.kontrola-select__display-inner');
      if (!displayInner) {
        displayInner = document.createElement('span');
        displayInner.className = 'kontrola-select__display-inner';
        while (display.firstChild) {
          displayInner.appendChild(display.firstChild);
        }
        display.appendChild(displayInner);
      }
      // Scroll kontejner bez paddinga – skrolamo ga da lijevi padding na displayu ostane vidljiv
      var displayScroll = display.querySelector('.kontrola-select__display-scroll');
      if (!displayScroll) {
        displayScroll = document.createElement('div');
        displayScroll.className = 'kontrola-select__display-scroll';
        display.insertBefore(displayScroll, displayInner);
        displayScroll.appendChild(displayInner);
      }

      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('role', 'combobox');
      wrap.setAttribute('aria-expanded', 'false');
      wrap.setAttribute('aria-haspopup', 'listbox');
      list.setAttribute('role', 'listbox');

      var highlightedIndex = -1;

      function setHighlighted(idx) {
        highlightedIndex = idx;
        var optionEls = list.querySelectorAll('.kontrola-select__option');
        optionEls.forEach(function (el, i) {
          if (i === idx) {
            wrap.setAttribute('aria-activedescendant', el.id || '');
            el.classList.add('kontrola-select__option--highlighted');
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } else {
            el.classList.remove('kontrola-select__option--highlighted');
          }
        });
        if (idx < 0) wrap.removeAttribute('aria-activedescendant');
      }

      function buildOptions() {
        list.innerHTML = '';
        Array.prototype.forEach.call(nativeSel.options, function (opt, idx) {
          var optEl = document.createElement('div');
          optEl.className = 'kontrola-select__option';
          optEl.id = 'kontrola-select-opt-' + (++_customSelectOptionIdCounter);
          optEl.textContent = opt.textContent;
          optEl.dataset.value = opt.value;
          optEl.setAttribute('role', 'option');
          optEl.setAttribute('aria-selected', opt.value === nativeSel.value ? 'true' : 'false');
          /* Inline boja na <option> (npr. paleta u Alati_Poruke_Razvoja_Tip) – prikaži u padajućoj listi. */
          if (opt.style && opt.style.backgroundColor) optEl.style.backgroundColor = opt.style.backgroundColor;
          if (opt.style && opt.style.color) optEl.style.color = opt.style.color;
          if (opt.disabled) {
            optEl.style.opacity = '0.5';
            optEl.style.cursor = 'default';
          } else {
            optEl.addEventListener('click', function () {
              if (nativeSel.disabled) return;
              nativeSel.value = opt.value;
              var ev = new Event('change', { bubbles: true });
              nativeSel.dispatchEvent(ev);
              wrap.classList.remove('kontrola-select--open');
              wrap.setAttribute('aria-expanded', 'false');
              setHighlighted(-1);
            });
          }
          list.appendChild(optEl);
        });
      }

      function syncFromNative() {
        var value = nativeSel.value;
        var selectedOpt = nativeSel.options[nativeSel.selectedIndex];
        var displayInner = display.querySelector('.kontrola-select__display-inner') || display;
        displayInner.textContent = selectedOpt ? selectedOpt.textContent : '';

        if (!value) wrap.classList.add('kontrola-select--placeholder');
        else wrap.classList.remove('kontrola-select--placeholder');

        var optionEls = list.querySelectorAll('.kontrola-select__option');
        optionEls.forEach(function (el) {
          if (el.dataset.value === value) {
            el.classList.add('kontrola-select__option--selected');
            el.setAttribute('aria-selected', 'true');
          } else {
            el.classList.remove('kontrola-select__option--selected');
            el.setAttribute('aria-selected', 'false');
          }
        });
      }

      function openList() {
        if (wrap.classList.contains('kontrola-select--readonly')) return; /* readonly: lista se ne otvara */
        document.querySelectorAll('.kontrola-select.kontrola-select--open').forEach(function (w) {
          if (w !== wrap) w.classList.remove('kontrola-select--open');
        });
        wrap.classList.add('kontrola-select--open');
        wrap.setAttribute('aria-expanded', 'true');
        var selIdx = nativeSel.selectedIndex;
        if (selIdx < 0) selIdx = 0;
        setHighlighted(selIdx);
        /* Prilagodi max-height liste slobodnom prostoru ispod kontrole (panel/viewport) */
        applySelectListMaxHeight(wrap, list);
      }

      function closeList() {
        wrap.classList.remove('kontrola-select--open');
        wrap.setAttribute('aria-expanded', 'false');
        setHighlighted(-1);
        list.style.maxHeight = '';
      }

      // Klik na cijeli wrapper (osim liste) otvara/zatvara select
      wrap.addEventListener('click', function (e) {
        if (nativeSel.disabled) return;
        // klik na listu – ne diraj open/close
        if (list.contains(e.target)) return;
        var isOpen = wrap.classList.contains('kontrola-select--open');
        if (isOpen) closeList();
        else openList();
      });

      var typeAheadText = '';
      var lastTypeTime = 0;

      wrap.addEventListener('keydown', function (e) {
        if (nativeSel.disabled) return;
        var isOpen = wrap.classList.contains('kontrola-select--open');
        var options = nativeSel.options;
        var len = options.length;
        var optEls = list.querySelectorAll('.kontrola-select__option');

        if (e.key === 'Escape' || e.key === 'Tab') {
          if (e.key === 'Escape') e.preventDefault();
          if (isOpen) closeList();
          return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isOpen) {
            if (highlightedIndex >= 0 && highlightedIndex < len && !options[highlightedIndex].disabled) {
              nativeSel.value = options[highlightedIndex].value;
              var ev = new Event('change', { bubbles: true });
              nativeSel.dispatchEvent(ev);
            }
            closeList();
          } else {
            openList();
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!isOpen) {
            openList();
            return;
          }
          var next = highlightedIndex + 1;
          while (next < len && options[next].disabled) next++;
          if (next < len) setHighlighted(next);
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!isOpen) {
            openList();
            return;
          }
          var prev = highlightedIndex - 1;
          while (prev >= 0 && options[prev].disabled) prev--;
          if (prev >= 0) setHighlighted(prev);
          return;
        }

        // Tipkanje po slovu – type-ahead pretraga po tekstu opcija
        if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          var ch = e.key;
          // Preskoči razmak jer ga već koristimo kao „otvori/zatvori“
          if (ch === ' ') return;

          var now = Date.now();
          if (now - lastTypeTime > 700) {
            typeAheadText = '';
          }
          lastTypeTime = now;
          typeAheadText += ch.toLowerCase();

          function findMatch(startIndex) {
            for (var i = startIndex; i < len; i++) {
              if (options[i].disabled) continue;
              var text = options[i].textContent || options[i].label || options[i].text || '';
              if (text.toLowerCase().indexOf(typeAheadText) === 0) return i;
            }
            return -1;
          }

          var start = highlightedIndex >= 0 ? highlightedIndex + 1 : 0;
          var idx = findMatch(start);
          if (idx < 0) idx = findMatch(0);
          if (idx >= 0) {
            if (!isOpen) openList();
            setHighlighted(idx);
          }
        }
      });

      nativeSel.addEventListener('change', syncFromNative);

      /** Poziv nakon dinamičkog dodavanja/uklanjanja opcija u nativni select – osvježi listu i prikaz. */
      wrap._kontrolaSelectRefresh = function () {
        buildOptions();
        syncFromNative();
      };

      buildOptions();
      syncFromNative();
    });
  }

  /**
   * Osvježi custom select nakon promjene opcija u nativnom &lt;select&gt; (npr. nakon AJAX učitavanja).
   * @param {string|HTMLSelectElement} selectIdOrElement - ID nativnog selecta ili element
   */
  function KontroleRefreshCustomSelect(selectIdOrElement) {
    var sel = typeof selectIdOrElement === 'string' ? document.getElementById(selectIdOrElement) : selectIdOrElement;
    if (!sel || sel.tagName !== 'SELECT') return;
    var wrap = sel.closest('.kontrola-select');
    if (wrap && typeof wrap._kontrolaSelectRefresh === 'function') wrap._kontrolaSelectRefresh();
  }

  /**
   * Na hover, ako je tekst skriven (ellipsis), skrolaj ulijevo do kraja; na mouseleave vrati na početak.
   * Brzina uvijek po tokenu: trajanje = udaljenost / HOVER_SCROLL_SPEED_PX_PER_SEC (bez min/max).
   */
  var HOVER_SCROLL_SPEED_PX_PER_SEC = 48; /* ista brzina za edit, edit-delete i select */

  /**
   * Animira scrollLeft s mogućnošću otkazivanja (na mouseleave/blur).
   * durationMs: ako nije dan, računa se iz udaljenosti i HOVER_SCROLL_SPEED_PX_PER_SEC.
   */
  function animateScrollLeft(el, to, done, durationMs) {
    if (!el) {
      if (done) done();
      return;
    }
    if (el._hoverScrollFrame) {
      cancelAnimationFrame(el._hoverScrollFrame);
      el._hoverScrollFrame = null;
    }
    var start = el.scrollLeft;
    if (start === to) {
      if (done) done();
      return;
    }
    var distance = Math.abs(to - start);
    if (durationMs == null) {
      durationMs = (distance / HOVER_SCROLL_SPEED_PX_PER_SEC) * 1000;
    }
    var startTime = null;
    el._hoverScrollCancel = false;

    function step(t) {
      if (el._hoverScrollCancel) {
        el._hoverScrollFrame = null;
        el._hoverScrollCancel = false;
        if (done) done();
        return;
      }
      if (!startTime) startTime = t;
      var elapsed = t - startTime;
      var progress = elapsed >= durationMs ? 1 : (elapsed / durationMs); /* linearno = konstantna brzina px/s */
      el.scrollLeft = start + (to - start) * progress;
      if (progress < 1) {
        el._hoverScrollFrame = requestAnimationFrame(step);
      } else {
        el._hoverScrollFrame = null;
        if (done) done();
      }
    }

    el._hoverScrollFrame = requestAnimationFrame(step);
  }

  function initHoverScrollToEnd(root) {
    if (typeof document === 'undefined') return;
    var scope = root || document;
    // Hover-scroll primjenjujemo na edit, edit-delete i select display
    var selector = '.kontrola-edit, .kontrola-edit-delete__input, .kontrola-select__display';
    scope.querySelectorAll(selector).forEach(function (el) {
      if (el.dataset.hoverScrollInit === '1') return;
      el.dataset.hoverScrollInit = '1';
      el.addEventListener('mouseenter', function () {
        if (
          el.disabled ||
          el.getAttribute('aria-disabled') === 'true' ||
          (el.closest && el.closest('.kontrola-select') && el.closest('.kontrola-select').querySelector('select').disabled)
        ) {
          return;
        }
        var scrollEl = el;
        if (el.classList.contains('kontrola-select__display')) {
          el.classList.add('kontrola-hover-scroll-active');
          scrollEl = el.querySelector('.kontrola-select__display-scroll') || el;
          el._hoverScrollScrollEl = scrollEl;
          scrollEl.offsetHeight; /* reflow */
        }
        if (scrollEl.scrollWidth <= scrollEl.clientWidth) {
          if (el.classList.contains('kontrola-select__display')) el.classList.remove('kontrola-hover-scroll-active');
          return;
        }
        if (!el.classList.contains('kontrola-select__display')) el.classList.add('kontrola-hover-scroll-active');
        var to = scrollEl.scrollWidth - scrollEl.clientWidth;
        animateScrollLeft(scrollEl, to);
      });
      function cancelHoverScroll() {
        var scrollEl = el._hoverScrollScrollEl || el;
        scrollEl._hoverScrollCancel = true;
        scrollEl.scrollLeft = 0;
        el.classList.remove('kontrola-hover-scroll-active');
      }
      el.addEventListener('mouseleave', cancelHoverScroll);
      el.addEventListener('blur', cancelHoverScroll);

      // Fokus na edit / edit-delete: kursor na kraj i trenutni pomak tako da je vidljiv
      if (el.tagName === 'INPUT' && (el.classList.contains('kontrola-edit') || el.classList.contains('kontrola-edit-delete__input'))) {
        el.addEventListener('focus', function () {
          var value = el.value != null ? String(el.value) : '';
          var len = value.length;
          try {
            el.setSelectionRange(len, len);
          } catch (e) {
            // npr. stariji browseri – sigurno ignoriramo
          }
          if (el.scrollWidth > el.clientWidth) {
            el.scrollLeft = el.scrollWidth;
          } else {
            el.scrollLeft = 0;
          }
        });
      } else if (el.classList.contains('kontrola-edit-delete__input--rich-html')) {
        /* DIV kao „input”: pomak pri kraju teksta (bez setSelectionRange). */
        el.addEventListener('focus', function () {
          if (el.scrollWidth > el.clientWidth) {
            el.scrollLeft = el.scrollWidth;
          } else {
            el.scrollLeft = 0;
          }
        });
      }
    });
  }

  /**
   * KONTROLA EDIT-DELETE – inicijalizacija (X gumb briše vrijednost).
   * @param {HTMLElement|Document} root - korijenski element za traženje kontrola.
   */
  function initEditDelete(root) {
    if (typeof document === 'undefined') return;
    var scope = root || document;
    var wrappers = scope.querySelectorAll('.kontrola-edit-delete');
    wrappers.forEach(function (wrap) {
      var input = wrap.querySelector('.kontrola-edit-delete__input');
      var clearBtn = wrap.querySelector('.kontrola-edit-delete__clear');
      if (!input || !clearBtn) return;
      var richHtml = input.classList && input.classList.contains('kontrola-edit-delete__input--rich-html');
      function syncVisibility() {
        var hasValue;
        if (richHtml) {
          var rawTc = input.textContent != null ? String(input.textContent) : '';
          hasValue = !!(rawTc.replace(/^\s+|\s+$/g, '').length);
        } else {
          hasValue = !!(input.value && String(input.value).length);
        }
        // X gumb je vidljiv samo kad ima vrijednosti, neovisno o disable stanju
        clearBtn.style.display = hasValue ? 'flex' : 'none';
      }

      // Sprijeci gomilanje handlera pri svakom KontroleSetEnabled/initEditDelete pozivu.
      if (wrap.dataset.editDeleteInit === '1') {
        syncVisibility();
        return;
      }
      wrap.dataset.editDeleteInit = '1';

      if (!clearBtn.querySelector('.kontrola-icon--x-mark')) {
        clearBtn.innerHTML = '';
        var icon = document.createElement('span');
        icon.className = 'kontrola-icon--x-mark';
        icon.setAttribute('aria-hidden', 'true');
        clearBtn.appendChild(icon);
      }
      clearBtn.tabIndex = -1;

      clearBtn.addEventListener('click', function () {
        var wrapBlocking = wrap.classList.contains('kontrola-edit-delete--disabled');
        if (wrapBlocking || clearBtn.disabled) return;
        if (!richHtml && input.disabled) return;
        if (richHtml) input.innerHTML = '';
        else input.value = '';
        var ev = new Event('input', { bubbles: true });
        input.dispatchEvent(ev);
        syncVisibility();
        // Obavijesti stranice da mogu ukloniti selekciju tablice itd.
        wrap.dispatchEvent(new CustomEvent('kontrole-edit-delete-clear', { bubbles: true }));
      });

      input.addEventListener('input', syncVisibility);
      // Pri programskom postavljanju value (npr. nakon selekcije reda) X mora postati vidljiv
      input.addEventListener('change', syncVisibility);
      syncVisibility();
    });
  }

  /* =====================================================
     KONTROLA SLIKA – prikaz slike (funkcionalnosti i ponašanje)
     U ovom bloku: inicijalizacija, postavljanje slike, ažuriranje okvira (auto/fix).
     ===================================================== */

  /**
   * Inicijalizacija kontrole Slika unutar zadanog root-a.
   * Traži .kontrola-slika; postavlja klasu --auto ili --fix prema tokenu --slika_okvir_ponasanje.
   * Funkcionalnosti prikaza slike (postavljanje src, prazan prikaz) dodaju se u ovaj blok.
   * @param {HTMLElement|Document} root - korijenski element za traženje kontrola
   */
  function initSlika(root) {
    if (typeof document === 'undefined') return;
    var scope = root || document;
    var containers = scope.querySelectorAll && scope.querySelectorAll('.kontrola-slika');
    if (!containers || !containers.length) return;
    var ponasanje = (getComputedStyle(document.documentElement).getPropertyValue('--slika_okvir_ponasanje') || 'auto').trim().toLowerCase();
    containers.forEach(function (el) {
      el.classList.remove('kontrola-slika--auto', 'kontrola-slika--fix');
      if (ponasanje === 'fix') {
        el.classList.add('kontrola-slika--fix');
      } else {
        el.classList.add('kontrola-slika--auto');
      }
    });
  }

  /**
   * Ažurira klasu kontrola-labela--disabled na svim labelama unutar scope prema disabled stanju
   * povezane kontrole (element s id = label.getAttribute('for')).
   * @param {HTMLElement|Document} scope - document ili element unutar kojeg se traže labele
   */
  function syncLabelsDisabledState(scope) {
    if (typeof document === 'undefined' || !scope) return;
    scope.querySelectorAll('.kontrola-labela[for]').forEach(function (lbl) {
      var id = lbl.getAttribute('for');
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) {
        lbl.classList.remove('kontrola-labela--disabled');
        return;
      }
      var wrapEd = target.closest && target.closest('.kontrola-edit-delete');
      var wrapDis = wrapEd && wrapEd.classList.contains('kontrola-edit-delete--disabled');
      var ariaDis = target.getAttribute && target.getAttribute('aria-disabled') === 'true';
      if (target.disabled || ariaDis || wrapDis) {
        lbl.classList.add('kontrola-labela--disabled');
      } else {
        lbl.classList.remove('kontrola-labela--disabled');
      }
    });
  }

  /**
   * Enable/disable jedne kontrole (edit, select, checkbox, napomena, edit-delete, tablica, tipka).
   * Ponašanje: prepoznaje tip kontrole po klasama/tagu; postavlja disabled na nativni element
   * (ili na input/clear unutar edit-delete); za tablicu dodaje/uklanja klasu kontrola-tablica--disabled;
   * za select pri disable zatvara otvorenu listu; traži labelu s [for] i dodaje/uklanja kontrola-labela--disabled.
   * Ako je element wrapper (npr. div), traži unutar njega prvu kontrolu i na nju primjenjuje.
   * @param {HTMLElement} element - Kontrola (ili njen input/select/button ili wrapper)
   * @param {boolean} enabled - true = uključeno, false = isključeno
   */
  function KontroleSetControlEnabled(element, enabled) {
    if (!element || typeof document === 'undefined') return;
    var disable = !enabled;
    var el = element;

    var controlEl = el;
    if (el.querySelector && !el.classList.contains('kontrola-edit') && !el.classList.contains('kontrola-napomena') && !el.classList.contains('kontrola-btn') && !el.classList.contains('kontrola-tablica') && !el.classList.contains('kontrola-edit-delete') && (!el.closest || !el.closest('.kontrola-select'))) {
      var one = el.querySelector('.kontrola-edit, .kontrola-napomena, .kontrola-select select, input.kontrola-checkbox, .kontrola-edit-delete, .kontrola-tablica, .kontrola-btn');
      if (one) controlEl = one;
    }

    el = controlEl;
    var wrap = el.closest && (el.closest('.kontrola-edit-delete') || el.closest('.kontrola-select'));

    if (el.classList && (el.classList.contains('kontrola-edit') || el.classList.contains('kontrola-napomena'))) {
      el.disabled = disable;
    } else if (el.tagName === 'SELECT' && el.closest && el.closest('.kontrola-select')) {
      el.disabled = disable;
      if (disable && wrap) wrap.classList.remove('kontrola-select--open');
    } else if (el.type === 'checkbox' && el.classList && el.classList.contains('kontrola-checkbox')) {
      el.disabled = disable;
    } else if ((wrap && wrap.classList.contains('kontrola-edit-delete')) || (el.classList && el.classList.contains('kontrola-edit-delete'))) {
      var edWrap = wrap || el;
      var input = edWrap.querySelector('.kontrola-edit-delete__input');
      var clearBtn = edWrap.querySelector('.kontrola-edit-delete__clear');
      var richHtml = input && input.classList && input.classList.contains('kontrola-edit-delete__input--rich-html');
      if (input) {
        if (richHtml) {
          if (disable) {
            input.setAttribute('aria-disabled', 'true');
            input.tabIndex = -1;
          } else {
            input.removeAttribute('aria-disabled');
            input.tabIndex = 0;
          }
        } else {
          input.disabled = disable;
        }
      }
      if (clearBtn) clearBtn.disabled = disable;
      if (disable) edWrap.classList.add('kontrola-edit-delete--disabled');
      else edWrap.classList.remove('kontrola-edit-delete--disabled');
    } else if (el.classList && el.classList.contains('kontrola-tablica')) {
      if (disable) el.classList.add('kontrola-tablica--disabled');
      else el.classList.remove('kontrola-tablica--disabled');
    } else if (el.classList && el.classList.contains('kontrola-btn')) {
      if (disable) el.setAttribute('disabled', 'disabled');
      else el.removeAttribute('disabled');
    }

    var controlId = el.id || (el.querySelector && el.querySelector('input, select, textarea') && el.querySelector('input, select, textarea').id);
    var target = (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') ? el : ((wrap && wrap.querySelector('input, select, textarea')) || (el.querySelector && el.querySelector('input, select, textarea')));
    if (controlId) {
      var label = document.querySelector('.kontrola-labela[for="' + controlId + '"]');
      if (label) {
        var t = target || document.getElementById(controlId);
        var wrapLbl = t && t.closest && t.closest('.kontrola-edit-delete');
        var wrapLblDis = wrapLbl && wrapLbl.classList.contains('kontrola-edit-delete--disabled');
        var ariaDisLbl = t && t.getAttribute && t.getAttribute('aria-disabled') === 'true';
        if ((t && t.disabled) || ariaDisLbl || wrapLblDis) {
          label.classList.add('kontrola-labela--disabled');
        } else {
          label.classList.remove('kontrola-labela--disabled');
        }
      }
    }

    var scope = el.closest && el.closest('body') || document;
    initEditDelete(scope);
    initCustomSelect(scope);
  }

  /**
   * Enable/disable svih kontrola unutar zadanog root-a (scope).
   * Ponašanje: u root-u traži sve .kontrola-edit, .kontrola-napomena, .kontrola-select select,
   * input.kontrola-checkbox, .kontrola-edit-delete, .kontrola-tablica i .kontrola-panel .kontrola-btn;
   * postavlja disabled (ili klasu --disabled na tablicu/edit-delete); zatvara otvorene select liste;
   * za labele s [for] ažurira klasu kontrola-labela--disabled prema stanju povezane kontrole.
   * Povratak (#btnPovratak / #btnCrudPovratak) se ne gasi: korisnik mora uvijek moći napustiti formu čak kad
   * su ostale tipke u panelu onemogućene (npr. prazan naziv); inače bi nakon initEditDelete ili drugog
   * ciklusa Povratak mogao ostati disabled ako se removeAttribute u modulu propusti.
   * Nakon toga poziva initEditDelete i initCustomSelect na scope.
   * @param {HTMLElement|Document} root - document ili element unutar kojeg se traže kontrole
   * @param {boolean} enabled - true = uključeno, false = isključeno
   */
  function KontroleSetEnabled(root, enabled) {
    if (typeof document === 'undefined') return;
    var scope = root || document;
    var disable = !enabled;

    // Edit + napomena (textarea)
    scope.querySelectorAll('.kontrola-edit, .kontrola-napomena').forEach(function (el) {
      el.disabled = disable;
    });

    // Select – nativni element unutar wrappera; kad disable, zatvori otvorene custom liste
    scope.querySelectorAll('.kontrola-select select').forEach(function (sel) {
      sel.disabled = disable;
      if (disable) {
        var wrap = sel.closest('.kontrola-select');
        if (wrap) wrap.classList.remove('kontrola-select--open');
      }
    });

    // Checkbox
    scope.querySelectorAll('input.kontrola-checkbox[type="checkbox"]').forEach(function (cb) {
      cb.disabled = disable;
    });

    // Edit-delete
    scope.querySelectorAll('.kontrola-edit-delete').forEach(function (wrap) {
      var input = wrap.querySelector('.kontrola-edit-delete__input');
      var clearBtn = wrap.querySelector('.kontrola-edit-delete__clear');
      var richHtml = input && input.classList && input.classList.contains('kontrola-edit-delete__input--rich-html');
      if (input) {
        if (richHtml) {
          if (disable) {
            input.setAttribute('aria-disabled', 'true');
            input.tabIndex = -1;
          } else {
            input.removeAttribute('aria-disabled');
            input.tabIndex = 0;
          }
        } else {
          input.disabled = disable;
        }
      }
      if (clearBtn) clearBtn.disabled = disable;
      if (disable) wrap.classList.add('kontrola-edit-delete--disabled');
      else wrap.classList.remove('kontrola-edit-delete--disabled');
    });

    // Prikaz (RO div kontrola) – disabled preko klase + aria-disabled (da povezana labela posivi)
    scope.querySelectorAll('.kontrola-prikaz').forEach(function (el) {
      if (disable) {
        el.classList.add('kontrola-prikaz--disabled');
        el.setAttribute('aria-disabled', 'true');
      } else {
        el.classList.remove('kontrola-prikaz--disabled');
        el.removeAttribute('aria-disabled');
      }
    });

    // Tablica – dodaj/ukloni disabled klasu na wrapperu
    scope.querySelectorAll('.kontrola-tablica').forEach(function (tbl) {
      if (disable) tbl.classList.add('kontrola-tablica--disabled');
      else tbl.classList.remove('kontrola-tablica--disabled');
    });

    // Tipke – Enable/Disable samo unutar panela (npr. CRUD gumbi u panelima);
    // tipku za prekidač Aktivno-Neaktivno ne diramo da korisnik uvijek može vratiti stanje.
    scope.querySelectorAll('.kontrola-panel .kontrola-btn').forEach(function (btn) {
      if (btn.id === 'btnToggleEnable') return;
      if (btn.id === 'btnPovratak' || btn.id === 'btnCrudPovratak') return;
      if (disable) btn.setAttribute('disabled', 'disabled');
      else btn.removeAttribute('disabled');
    });

    // Labele – uskladi s disabled stanjem povezanih kontrola
    syncLabelsDisabledState(scope);

    // Nakon promjene enable/disable, refreshiraj edit-delete vidljivost X-a i custom select
    initEditDelete(scope);
    initCustomSelect(scope);
  }

  /**
   * Postavlja/uklanja readonly stanje POJEDINE kontrole (vizual + inertnost).
   * Podržava: edit, napomena, prikaz, checkbox, select (wrapper ili inner select),
   * edit-delete (wrapper ili inner element). RO modifikator-klasa nosi vizual +
   * pointer-events:none; uz to: aria-readonly, tabindex=-1 (blok fokusa) i — za
   * native input/textarea — atribut readonly (semantika). Za select zatvara listu.
   * RO NE sivi povezanu labelu (labela reagira samo na disabled/aria-disabled).
   * @param {HTMLElement} el - kontrola ili njen wrapper
   * @param {boolean} ro - true = readonly, false = normalno
   */
  function KontroleSetControlReadonly(el, ro) {
    if (!el || typeof document === 'undefined') return;
    ro = !!ro;

    /* Tablica — RO je samo klasa na kontejneru; interakciju (selekt/klik/hover)
       blokiraju JS guardovi, scroll ostaje nativan. Bez tabindex/readonly atributa.
       Pri ulasku u RO uklanja se selekcija retka (vizual + has-selected stanje). */
    if (el.classList.contains('kontrola-tablica')) {
      el.classList.toggle('kontrola-tablica--readonly', ro);
      if (ro) {
        el.setAttribute('aria-readonly', 'true');
        el.querySelectorAll('.kontrola-tablica__scroll tbody tr.tablica-row-selected').forEach(function (tr) {
          tr.classList.remove('tablica-row-selected');
        });
        el.classList.remove('kontrola-tablica--has-selected');
      } else {
        el.removeAttribute('aria-readonly');
      }
      return;
    }

    var wrap, cls, focusables;

    if (el.classList.contains('kontrola-select') || (el.tagName === 'SELECT' && el.closest('.kontrola-select'))) {
      wrap = el.classList.contains('kontrola-select') ? el : el.closest('.kontrola-select');
      cls = 'kontrola-select--readonly';
      focusables = wrap.querySelectorAll('select, [tabindex]');
      if (ro) wrap.classList.remove('kontrola-select--open');
    } else if (el.classList.contains('kontrola-edit-delete') || (el.closest && el.closest('.kontrola-edit-delete'))) {
      wrap = el.classList.contains('kontrola-edit-delete') ? el : el.closest('.kontrola-edit-delete');
      cls = 'kontrola-edit-delete--readonly';
      focusables = wrap.querySelectorAll('input, button, [tabindex]');
    } else if (el.classList.contains('kontrola-napomena')) {
      wrap = el; cls = 'kontrola-napomena--readonly'; focusables = [el];
    } else if (el.classList.contains('kontrola-prikaz')) {
      wrap = el; cls = 'kontrola-prikaz--readonly'; focusables = [el];
    } else if (el.classList.contains('kontrola-checkbox')) {
      wrap = el; cls = 'kontrola-checkbox--readonly'; focusables = [el];
    } else if (el.classList.contains('kontrola-edit')) {
      wrap = el; cls = 'kontrola-edit--readonly'; focusables = [el];
    } else {
      return;
    }

    if (ro) wrap.classList.add(cls); else wrap.classList.remove(cls);
    if (ro) wrap.setAttribute('aria-readonly', 'true'); else wrap.removeAttribute('aria-readonly');

    Array.prototype.forEach.call(focusables || [], function (f) {
      if (!f) return;
      var isTextField = (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') && f.type !== 'checkbox';
      if (ro) {
        if (f.getAttribute('data-ro-tabindex') == null) {
          f.setAttribute('data-ro-tabindex', f.hasAttribute('tabindex') ? f.getAttribute('tabindex') : '');
        }
        f.tabIndex = -1;
        if (isTextField) f.readOnly = true;
      } else {
        var prev = f.getAttribute('data-ro-tabindex');
        if (prev != null) {
          if (prev === '') f.removeAttribute('tabindex'); else f.setAttribute('tabindex', prev);
          f.removeAttribute('data-ro-tabindex');
        }
        if (isTextField) f.readOnly = false;
      }
    });
  }

  global.KontroleTablica = KontroleTablica;
  global.KontroleSetEnabled = KontroleSetEnabled;
  global.KontroleSetControlEnabled = KontroleSetControlEnabled;
  global.KontroleSetControlReadonly = KontroleSetControlReadonly;
  global.KontroleSyncLabelsDisabledState = syncLabelsDisabledState;
  global.KontroleInitEditDelete = initEditDelete;
  global.KontroleInitCustomSelect = initCustomSelect;
  global.KontroleInitSlika = initSlika;
  global.KontroleRefreshCustomSelect = KontroleRefreshCustomSelect;

  var MODAL_TABLICA_STORAGE_PREFIX = 'modal_tablica_';
  var MODAL_TABLICA_MIN_W = 320;
  var MODAL_TABLICA_MIN_H = 240;
  var MODAL_TABLICA_DEFAULT_W = 480;
  var MODAL_TABLICA_DEFAULT_H = 360;

  function getModalTablicaStoredState(storageKey) {
    try {
      var raw = typeof localStorage !== 'undefined' && localStorage.getItem(MODAL_TABLICA_STORAGE_PREFIX + storageKey);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && typeof o.left === 'number' && typeof o.top === 'number' && typeof o.width === 'number' && typeof o.height === 'number') return o;
    } catch (e) {}
    return null;
  }
  function setModalTablicaStoredState(storageKey, left, top, width, height) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(MODAL_TABLICA_STORAGE_PREFIX + storageKey, JSON.stringify({ left: left, top: top, width: width, height: height }));
    } catch (e) {}
  }

  /**
   * Postavlja left/top dijaloga prema trenutnom vizualnom položaju (ishodište = padding edge roota).
   * Koristi se kad se statički modal otvori da ima eksplicitnu poziciju kao kod ModalTablicaInit.open().
   */
  function setModalTablicaDialogPositionFromRect(root) {
    if (!root) return;
    var dialog = root.querySelector('.modal-tablica__dialog');
    if (!dialog) return;
    var rootRect = root.getBoundingClientRect();
    var borderL = 0;
    var borderT = 0;
    if (typeof getComputedStyle !== 'undefined') {
      var cs = getComputedStyle(root);
      borderL = parseFloat(cs.borderLeftWidth) || 0;
      borderT = parseFloat(cs.borderTopWidth) || 0;
    }
    var rect = dialog.getBoundingClientRect();
    dialog.style.left = (rect.left - rootRect.left - borderL) + 'px';
    dialog.style.top = (rect.top - rootRect.top - borderT) + 'px';
  }

  /**
   * Pri otvaranju statičkog modala: primijeni spremljenu poziciju/veličinu ili centriraj s default veličinom.
   * Pri zatvaranju: spremi poziciju i veličinu (OK ili Odustani).
   */
  function applyModalTablicaStoredOrDefault(root) {
    if (!root) return;
    var dialog = root.querySelector('.modal-tablica__dialog');
    if (!dialog) return;
    var storageKey = (root.id && String(root.id).trim()) || root.getAttribute('data-modal-storage-key') || 'static';
    var stored = getModalTablicaStoredState(storageKey);
    var vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    var vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    if (stored && stored.width >= MODAL_TABLICA_MIN_W && stored.height >= MODAL_TABLICA_MIN_H) {
      dialog.style.left = stored.left + 'px';
      dialog.style.top = stored.top + 'px';
      dialog.style.width = Math.max(MODAL_TABLICA_MIN_W, stored.width) + 'px';
      dialog.style.height = Math.max(MODAL_TABLICA_MIN_H, stored.height) + 'px';
    } else {
      var w = MODAL_TABLICA_DEFAULT_W;
      var h = Math.max(MODAL_TABLICA_DEFAULT_H, MODAL_TABLICA_MIN_H);
      dialog.style.width = w + 'px';
      dialog.style.height = h + 'px';
      dialog.style.left = Math.max(0, (vw - w) / 2) + 'px';
      dialog.style.top = Math.max(0, (vh - h) / 2) + 'px';
    }
  }
  function saveModalTablicaStateOnClose(root) {
    if (!root) return;
    var dialog = root.querySelector('.modal-tablica__dialog');
    if (!dialog) return;
    var left = parseFloat(dialog.style.left);
    var top = parseFloat(dialog.style.top);
    /* Kad je root već display:none, offsetWidth/offsetHeight su 0 – čitamo iz style koji ostaje postavljen */
    var w = parseFloat(dialog.style.width) || dialog.offsetWidth;
    var h = parseFloat(dialog.style.height) || dialog.offsetHeight;
    if (!isNaN(left) && !isNaN(top) && w >= MODAL_TABLICA_MIN_W && h >= MODAL_TABLICA_MIN_H) {
      var storageKey = (root.id && String(root.id).trim()) || root.getAttribute('data-modal-storage-key') || 'static';
      setModalTablicaStoredState(storageKey, left, top, w, h);
    }
  }

  /**
   * Omogućuje premještanje modala povlačenjem zaglavlja. Ista logika kao u ModalTablicaInit (Loze_Tip_CRUD):
   * dijalog uvijek ima left/top (postavlja ih open() ili setModalTablicaDialogPositionFromRect pri otvaranju), pomicanje = delta.
   */
  function attachModalTablicaDrag(dialog, headerEl) {
    if (!dialog || !headerEl) return;
    var root = dialog.parentElement;
    if (!root || !root.classList || !root.classList.contains('modal-tablica')) root = dialog.closest ? dialog.closest('.modal-tablica') : null;
    function start(e) {
      if (e.button !== 0 && !e.touches) return;
      var startX = e.touches ? e.touches[0].clientX : e.clientX;
      var startY = e.touches ? e.touches[0].clientY : e.clientY;
      var left = parseFloat(dialog.style.left);
      var top = parseFloat(dialog.style.top);
      if (isNaN(left) || isNaN(top)) {
        setModalTablicaDialogPositionFromRect(root);
        left = parseFloat(dialog.style.left);
        top = parseFloat(dialog.style.top);
      }
      function move(ev) {
        var x = ev.touches ? ev.touches[0].clientX : ev.clientX;
        var y = ev.touches ? ev.touches[0].clientY : ev.clientY;
        dialog.style.left = (left + (x - startX)) + 'px';
        dialog.style.top = (top + (y - startY)) + 'px';
      }
      function stop() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', move, { passive: false });
        document.removeEventListener('touchend', stop);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', stop);
      if (e.cancelable) e.preventDefault();
    }
    headerEl.addEventListener('mousedown', start);
    headerEl.addEventListener('touchstart', start, { passive: false });
  }

  /**
   * Modal tablica: modal s tablicom, zaglavlje (drag), tijelo (tablica + resize traka), podnožje (tipke).
   * Resize: donji desni kut (širina i visina modala), vertikalna traka ispod tablice (visina tijela).
   * Pozicija i veličina se pamte u localStorage po storageKey.
   * @param {Object} options - storageKey (string), mountSelector? (string), headerText? (string), headerIcon? (HTML string ili element), getButtons(): Array<{ label, primary?, className?, onClick(tablicaApi) }>
   * @returns {Object} { open(config), close() } - config: zaglavlje (Tablica_Zaglavlje), rows (array), getRowId?(row, index),
   *   rowDoubleClickLikePrimary? (boolean): dvoklik na tbody redak poziva istu akciju kao primarni gumb (npr. OK) —
   *   prije poziva postavlja selekciju na samo taj redak (getRowId / dataset.rowId), pogodno za multi-select modal.
   */
  function ModalTablicaInit(options) {
    if (!options || !options.storageKey || typeof options.getButtons !== 'function') return null;
    var storageKey = String(options.storageKey).trim() || 'modal_tablica';
    var mountSelector = options.mountSelector != null ? String(options.mountSelector).trim() : '';
    var headerText = options.headerText != null ? String(options.headerText) : '';
    var headerIcon = options.headerIcon;
    var getButtons = options.getButtons;

    var root = null;
    var overlay = null;
    var dialog = null;
    var headerEl = null;
    var bodyEl = null;
    var tableWrap = null;
    var tableContainer = null;
    var resizeBar = null;
    var footerEl = null;
    var resizeCorner = null;
    var tablicaApi = null;
    var containerId = 'modal_tablica_table_' + Math.random().toString(36).slice(2, 10);

    var STORAGE_PREFIX = 'modal_tablica_';
    var MIN_W = 320;
    var MIN_H = 240;

    function getStoredState() {
      try {
        var raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_PREFIX + storageKey);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (o && typeof o.left === 'number' && typeof o.top === 'number' && typeof o.width === 'number' && typeof o.height === 'number') return o;
      } catch (e) {}
      return null;
    }
    function setStoredState(left, top, width, height) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify({ left: left, top: top, width: width, height: height }));
      } catch (e) {}
    }

    function ensureDOM() {
      if (root) return;
      root = document.createElement('div');
      root.className = 'modal-tablica';
      root.setAttribute('aria-hidden', 'true');
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      overlay = document.createElement('div');
      overlay.className = 'modal-tablica__overlay';
      dialog = document.createElement('div');
      dialog.className = 'modal-tablica__dialog';
      headerEl = document.createElement('div');
      headerEl.className = 'modal-tablica__header';
      if (headerIcon) {
        var iconWrap = document.createElement('span');
        iconWrap.className = 'modal-tablica__header-icon';
        if (typeof headerIcon === 'string') iconWrap.innerHTML = headerIcon;
        else if (headerIcon && headerIcon.nodeType === 1) iconWrap.appendChild(headerIcon);
        headerEl.appendChild(iconWrap);
      }
      headerEl.appendChild(document.createTextNode(headerText));
      bodyEl = document.createElement('div');
      bodyEl.className = 'modal-tablica__body';
      tableWrap = document.createElement('div');
      tableWrap.className = 'modal-tablica__body-table-wrap';
      tableContainer = document.createElement('div');
      tableContainer.id = containerId;
      tableContainer.className = 'kontrola-tablica';
      tableWrap.appendChild(tableContainer);
      resizeBar = document.createElement('div');
      resizeBar.className = 'kontrola-panel__resize-bar';
      resizeBar.setAttribute('aria-label', 'Povuci za promjenu visine');
      bodyEl.appendChild(tableWrap);
      bodyEl.appendChild(resizeBar);
      footerEl = document.createElement('div');
      footerEl.className = 'modal-tablica__footer';
      resizeCorner = document.createElement('div');
      resizeCorner.className = 'modal-tablica__resize-corner';
      resizeCorner.setAttribute('aria-label', 'Povuci za promjenu veličine');
      var resizeCornerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      resizeCornerSvg.setAttribute('class', 'modal-tablica__resize-corner-icon');
      resizeCornerSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      resizeCornerSvg.setAttribute('fill', 'none');
      resizeCornerSvg.setAttribute('viewBox', '0 0 24 24');
      resizeCornerSvg.setAttribute('stroke', 'currentColor');
      resizeCornerSvg.setAttribute('stroke-width', '2.5');
      resizeCornerSvg.setAttribute('stroke-linecap', 'round');
      resizeCornerSvg.setAttribute('stroke-linejoin', 'round');
      resizeCornerSvg.setAttribute('aria-hidden', 'true');
      var resizeCornerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      resizeCornerPath.setAttribute('d', 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7');
      resizeCornerSvg.appendChild(resizeCornerPath);
      resizeCorner.appendChild(resizeCornerSvg);
      dialog.appendChild(headerEl);
      dialog.appendChild(bodyEl);
      dialog.appendChild(footerEl);
      dialog.appendChild(resizeCorner);
      root.appendChild(overlay);
      root.appendChild(dialog);

      var mount = mountSelector ? document.querySelector(mountSelector) : null;
      if (mount) mount.appendChild(root);
      else document.body.appendChild(root);

      initDragHeader();
      initResizeCorner();
      initResizeBar();
    }

    function initDragHeader() {
      attachModalTablicaDrag(dialog, headerEl);
    }

    function initResizeCorner() {
      function start(e) {
        if (e.button !== 0 && !e.touches) return;
        var startX = e.touches ? e.touches[0].clientX : e.clientX;
        var startY = e.touches ? e.touches[0].clientY : e.clientY;
        var startW = dialog.offsetWidth;
        var startH = dialog.offsetHeight;
        var startLeft = parseFloat(dialog.style.left) || 0;
        var startTop = parseFloat(dialog.style.top) || 0;
        function move(ev) {
          var x = ev.touches ? ev.touches[0].clientX : ev.clientX;
          var y = ev.touches ? ev.touches[0].clientY : ev.clientY;
          var dw = x - startX;
          var dh = y - startY;
          var newW = Math.max(MIN_W, startW + dw);
          var newH = Math.max(MIN_H, startH + dh);
          dialog.style.width = newW + 'px';
          dialog.style.height = newH + 'px';
        }
        function stop() {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', stop);
          document.removeEventListener('touchmove', move, { passive: false });
          document.removeEventListener('touchend', stop);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', stop);
        if (e.cancelable) e.preventDefault();
      }
      resizeCorner.addEventListener('mousedown', start);
      resizeCorner.addEventListener('touchstart', start, { passive: false });
    }

    function initResizeBar() {
      var barH = 28;
      if (typeof getComputedStyle !== 'undefined' && resizeBar) {
        var cs = getComputedStyle(resizeBar);
        if (cs && cs.height) {
          var px = parseFloat(cs.height);
          if (!isNaN(px) && px > 0) barH = Math.round(px);
        }
      }
      function start(e) {
        if (e.button !== 0 && !e.touches) return;
        var startY = e.touches ? e.touches[0].clientY : e.clientY;
        var startHeight = dialog.offsetHeight;
        function move(ev) {
          var y = ev.touches ? ev.touches[0].clientY : ev.clientY;
          var delta = y - startY;
          var newH = Math.max(MIN_H, startHeight + delta);
          dialog.style.height = newH + 'px';
        }
        function stop() {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', stop);
          document.removeEventListener('touchmove', move, { passive: false });
          document.removeEventListener('touchend', stop);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', stop);
        if (e.cancelable) e.preventDefault();
      }
      resizeBar.addEventListener('mousedown', start);
      resizeBar.addEventListener('touchstart', start, { passive: false });
    }

    function open(config) {
      config = config || {};
      var zaglavlje = config.zaglavlje;
      var rows = config.rows ? config.rows.slice() : [];
      var getRowId = typeof config.getRowId === 'function' ? config.getRowId : null;
      if (!zaglavlje || !Array.isArray(zaglavlje) || zaglavlje.length === 0) return;

      ensureDOM();
      root._returnFocusTo = typeof document !== 'undefined' && document.activeElement ? document.activeElement : null;

      tableContainer.innerHTML = '';
      if (config.multiSelect === true) tableContainer.classList.add('tablica--multi-select');
      else tableContainer.classList.remove('tablica--multi-select');
      var nCols = zaglavlje.length;
      var headerColumns = zaglavlje;
      var getBrojKolona = function () { return nCols; };
      var tableOptions = {
        getBrojKolona: getBrojKolona,
        headerColumns: headerColumns,
        data: rows,
        getRowId: getRowId,
        onSelectionChange: config.onSelectionChange || null,
        multiSelect: config.multiSelect === true
      };
      tablicaApi = KontroleTablica(tableContainer, tableOptions);
      tablicaApi.build();
      if (typeof window.CommonCRUD !== 'undefined' && window.CommonCRUD.primijeniTablicaZaglavlje && tableContainer && zaglavlje) {
        window.CommonCRUD.primijeniTablicaZaglavlje(tableContainer, zaglavlje);
      }
      if (config.selectedRowIds && Array.isArray(config.selectedRowIds) && typeof tablicaApi.setSelectedRowIds === 'function') {
        tablicaApi.setSelectedRowIds(config.selectedRowIds);
      }

      footerEl.innerHTML = '';
      /* Primarni onClick (OK): opcija rowDoubleClickLikePrimary ga ponovno koristi na dvoklik retka. */
      var primaryOnClick = null;
      var buttons = getButtons();
      if (buttons && buttons.length) {
        buttons.forEach(function (b) {
          if (b.primary && typeof b.onClick === 'function') primaryOnClick = b.onClick;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'kontrola-btn';
          if (b.primary) btn.classList.add('kontrola-btn--primary');
          if (b.className) btn.className = btn.className + ' ' + String(b.className).trim();
          var outer = document.createElement('span');
          outer.className = 'kontrola-btn__outer';
          var inner = document.createElement('span');
          inner.className = 'kontrola-btn__inner';
          var label = document.createElement('span');
          label.className = 'kontrola-btn__label';
          label.textContent = b.label != null ? String(b.label) : '';
          inner.appendChild(label);
          outer.appendChild(inner);
          btn.appendChild(outer);
          btn.addEventListener('click', function () {
            if (typeof b.onClick === 'function') b.onClick(tablicaApi);
          });
          footerEl.appendChild(btn);
        });
      }

      /* Svako open() gradi novu tablicu — ukloni stari dvoklik listener da se ne stapaju pozivi. */
      if (tableContainer._modalTablicaRowDblClickHandler) {
        tableContainer.removeEventListener('dblclick', tableContainer._modalTablicaRowDblClickHandler);
        tableContainer._modalTablicaRowDblClickHandler = null;
      }
      if (config.rowDoubleClickLikePrimary === true && typeof primaryOnClick === 'function' && tablicaApi) {
        tableContainer._modalTablicaRowDblClickHandler = function (ev) {
          var tr = ev.target && ev.target.closest ? ev.target.closest('tbody tr') : null;
          if (!tr || !tableContainer.contains(tr)) return;
          if ((tableContainer.classList.contains('kontrola-tablica--disabled') || tableContainer.classList.contains('kontrola-tablica--readonly'))) return;
          var rid = tr.dataset.rowId;
          if (rid == null || String(rid).trim() === '') return;
          ev.preventDefault();
          tablicaApi.setSelectedRowIds([rid]);
          primaryOnClick(tablicaApi);
        };
        tableContainer.addEventListener('dblclick', tableContainer._modalTablicaRowDblClickHandler);
      }

      /* Isti izračun kao kontrola panel tablica: body = 2*padY + head + (row*vidljivih) + extra + bar. */
      function computeMinDialogHeight() {
        var padY = parseFloat(getToken('--modal_tablica_body_padding_y')) || 16;
        var headH = parseInt(getToken('--tablica_head_h'), 10) || 42;
        var rowH = parseInt(getToken('--tablica_row_h'), 10) || 40;
        var vidljivih = parseInt(getToken('--modal_tablica_vidljivih_redova'), 10) || 3;
        var extra = parseInt(getToken('--tablica_extra'), 10) || 1;
        var barH = parseFloat(getToken('--panel_resize_bar_height')) || 28;
        var headerPadY = parseFloat(getToken('--modal_tablica_header_padding_y')) || 12;
        var footerPadY = parseFloat(getToken('--modal_tablica_footer_padding_y')) || 12;
        var btnH = parseFloat(getToken('--button_height')) || 36;
        var bodyMin = padY + headH + (rowH * vidljivih) + extra + padY + barH;
        var headerMin = headerPadY * 2 + 20;
        var footerMin = footerPadY * 2 + btnH;
        return Math.ceil(headerMin + bodyMin + footerMin);
      }
      MIN_H = Math.max(240, computeMinDialogHeight());
      dialog.style.minWidth = MIN_W + 'px';
      dialog.style.minHeight = MIN_H + 'px';

      var stored = getStoredState();
      var defaultW = 480;
      var defaultH = 360;
      if (stored) {
        dialog.style.left = stored.left + 'px';
        dialog.style.top = stored.top + 'px';
        dialog.style.width = Math.max(MIN_W, stored.width) + 'px';
        dialog.style.height = Math.max(MIN_H, stored.height) + 'px';
      } else {
        dialog.style.width = defaultW + 'px';
        dialog.style.height = Math.max(defaultH, MIN_H) + 'px';
        var vw = typeof window !== 'undefined' ? window.innerWidth : 800;
        var vh = typeof window !== 'undefined' ? window.innerHeight : 600;
        var initH = Math.max(defaultH, MIN_H);
        dialog.style.left = Math.max(0, (vw - defaultW) / 2) + 'px';
        dialog.style.top = Math.max(0, (vh - initH) / 2) + 'px';
      }

      root.classList.add('modal-tablica--open');
      root.setAttribute('aria-hidden', 'false');
    }

    function close() {
      if (!root) return;
      var left = parseFloat(dialog.style.left);
      var top = parseFloat(dialog.style.top);
      var w = dialog.offsetWidth;
      var h = dialog.offsetHeight;
      if (!isNaN(left) && !isNaN(top) && w >= MIN_W && h >= MIN_H) setStoredState(left, top, w, h);
      var returnFocusTo = root._returnFocusTo;
      if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus();
      root.setAttribute('aria-hidden', 'true');
      root.classList.remove('modal-tablica--open');
    }

    return { open: open, close: close };
  }

  global.ModalTablicaInit = ModalTablicaInit;

  if (typeof document !== 'undefined') {
    /* Modal tablica: premještanje povlačenjem zaglavlja – za sve modal-tablica u dokumentu (statičke u HTML-u) */
    function initModalTablicaDragAll() {
      document.querySelectorAll('.modal-tablica').forEach(function (root) {
        var dialog = root.querySelector('.modal-tablica__dialog');
        var header = root.querySelector('.modal-tablica__header');
        if (!dialog || !header) return;
        if (header._modalTablicaDragAttached) return;
        header._modalTablicaDragAttached = true;
        attachModalTablicaDrag(dialog, header);
      });
    }
    /* Kad se statički modal otvori: primijeni spremljenu poziciju/veličinu ili centriraj s default veličinom. Kad se zatvori (OK ili Odustani): spremi poziciju i veličinu. */
    function observeModalTablicaOpen() {
      document.querySelectorAll('.modal-tablica').forEach(function (root) {
        if (root._modalTablicaOpenObserved) return;
        root._modalTablicaOpenObserved = true;
        var observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            var hadOpen = mutation.oldValue && mutation.oldValue.indexOf('modal-tablica--open') >= 0;
            var hasOpen = root.classList.contains('modal-tablica--open');
            if (hasOpen) {
              var requestDone = false;
              function applyPosition() {
                if (requestDone) return;
                requestDone = true;
                applyModalTablicaStoredOrDefault(root);
              }
              requestAnimationFrame(applyPosition);
              setTimeout(applyPosition, 0);
            } else if (hadOpen) {
              saveModalTablicaStateOnClose(root);
            }
          });
        });
        observer.observe(root, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
      });
    }
    function runModalTablicaInit() {
      initModalTablicaDragAll();
      observeModalTablicaOpen();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runModalTablicaInit);
    } else {
      runModalTablicaInit();
    }

    // KONTROLA CHECKBOX – omogućiti promjenu stanja tipkom Enter (uz postojeći Space)
    document.addEventListener('keydown', function (e) {
      var target = e.target;
      if (!target || !target.matches || !target.matches('input.kontrola-checkbox[type=\"checkbox\"]')) return;
      if (target.disabled) return;
      /* Zapisnik Ovjera: red .zapisnik-crud__ovjera-cb-red--samoprikaz — izgled aktivnog čekboxa, bez mijene mišem/tipkom. */
      if (target.closest && target.closest('.zapisnik-crud__ovjera-cb-red--samoprikaz')) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        target.checked = !target.checked;
        var ev = new Event('change', { bubbles: true });
        target.dispatchEvent(ev);
      }
    });

    function runScrollbarStyles() {
      requestAnimationFrame(function () {
        syncAllScrollbarTokens();
        injectScrollbarHoverStyle();
      });
    }
    function initPanelTablicaFooterRows(scope) {
      var panels = (scope || document).querySelectorAll('.kontrola-panel-tablica--has-footer');
      var CLASS_TWO_ROWS = 'kontrola-panel-tablica--footer-two-rows';
      function getOneRowHeightPx() {
        var root = document.documentElement;
        var s = getComputedStyle(root);
        var py = parseFloat(s.getPropertyValue('--panel_footer_padding_y')) || 12;
        var eh = parseFloat(s.getPropertyValue('--edit_height')) || 36;
        return 2 * py + eh + 2;
      }
      panels.forEach(function (panel) {
        var footer = panel.querySelector('.kontrola-panel__footer');
        if (!footer) return;
        function updateFooterClass() {
          var threshold = getOneRowHeightPx();
          var twoRows = footer.scrollHeight > threshold + 2;
          panel.classList.toggle(CLASS_TWO_ROWS, twoRows);
        }
        updateFooterClass();
        if (typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(updateFooterClass).observe(footer);
        } else {
          window.addEventListener('resize', updateFooterClass);
        }
      });
    }

    function initButtonTouchFeedback(scope) {
      if (!('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0))) return;
      var doc = (scope && scope.ownerDocument) ? scope.ownerDocument : document;
      var root = scope || doc;
      var activeBtn = null;
      function clearActive() {
        if (activeBtn) {
          activeBtn.classList.remove('kontrola-btn--touch-active');
          activeBtn = null;
        }
        doc.removeEventListener('touchend', clearActive);
        doc.removeEventListener('touchcancel', clearActive);
      }
      root.addEventListener('touchstart', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('.kontrola-btn');
        if (!btn || btn.hasAttribute('disabled')) return;
        clearActive();
        activeBtn = btn;
        btn.classList.add('kontrola-btn--touch-active');
        doc.addEventListener('touchend', clearActive);
        doc.addEventListener('touchcancel', clearActive);
      }, { passive: true });
    }

    /**
     * U svako tijelo panela s vertikalnim (ili both) resizeom dodaje .kontrola-panel__resize-bar ako već ne postoji.
     *
     * HTML ne smije ručno sadržavati tu traku – jedan izvor istine ovdje (0-Kontrole.js), uz 0-Kontrole.css za vidljivost.
     * Na panelu dovoljno: klase .kontrola-panel + .kontrola-panel--resize-y ili --resize-both (i po potrebi tablica-modifikatori).
     *
     * Na desktopu: .kontrola-panel-tablica, .kontrola-panel--traka-desktop i data-resize-sync-group koriste traku (CSS),
     * ne nativni resize kuta; sync-group još i usklađuje visinu više panela pri dragu.
     */
    function initPanelResizeBar(scope) {
      /* Samo izravno dijete korena s --resize-y / --resize-both: ugniježdeni .kontrola-panel (npr. Zapisnik_CRUD) ne smije dobiti vlastitu traku. */
      var panels = (scope || document).querySelectorAll('.kontrola-panel--resize-y > .kontrola-panel__body, .kontrola-panel--resize-both > .kontrola-panel__body');
      panels.forEach(function (body) {
        if (body.querySelector('.kontrola-panel__resize-bar')) return;
        var panel = body.closest('.kontrola-panel');
        if (!panel) return;
        var bar = document.createElement('div');
        bar.className = 'kontrola-panel__resize-bar';
        bar.setAttribute('aria-label', 'Povuci za promjenu visine panela');
        body.appendChild(bar);
        var minH = 120;
        var cs = typeof getComputedStyle !== 'undefined' && panel.ownerDocument && getComputedStyle(panel).minHeight;
        if (cs && cs !== 'none' && cs !== 'auto') {
          var px = parseFloat(cs);
          if (!isNaN(px) && px > 0) minH = Math.round(px);
        }
        var barH = 28;
        if (typeof getComputedStyle !== 'undefined') {
          var barStyle = getComputedStyle(bar);
          if (barStyle && barStyle.height) {
            var barPx = parseFloat(barStyle.height);
            if (!isNaN(barPx) && barPx > 0) barH = Math.round(barPx);
          }
        }
        minH = minH + barH;
        /**
         * Min / max visina za proizvoljni .kontrola-panel (isti proračun kao za panel u kojem je resize traka).
         * Potrebno za data-resize-sync-group: paneli u grupi mogu imati različit CSS min-height (npr. jedan u
         * .panel--stacked-min) pa pri smanjivanju treba zajednički pod (max svih minimuma), inače drugi panel
         * ostane na min-u dok se prvi smanjuje.
         */
        function getLimitsForPanelEl(panEl) {
          var panelMin = 120;
          if (panEl && typeof getComputedStyle !== 'undefined' && panEl.ownerDocument) {
            var csEl = getComputedStyle(panEl).minHeight;
            if (csEl && csEl !== 'none' && csEl !== 'auto') {
              var pxEl = parseFloat(csEl);
              /* 0px (npr. privremeno u Zapisnik_CRUD) – ne vraćati zastarjeli pod; px>0 je kriv za 0. */
              if (!isNaN(pxEl) && isFinite(pxEl)) panelMin = pxEl <= 0 ? 120 : Math.round(pxEl);
            }
          }
          var vhEl = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800;
          var maxHEl = Math.round(vhEl * 0.9);
          var maxVhEl = panEl && panEl.getAttribute && panEl.getAttribute('data-resize-max-vh');
          if (maxVhEl != null) maxVhEl = String(maxVhEl).trim();
          if (maxVhEl === 'none' || maxVhEl === 'full') {
            maxHEl = Infinity;
          } else if (maxVhEl) {
            var pctEl = parseFloat(maxVhEl, 10);
            if (!isNaN(pctEl) && pctEl > 0) {
              maxHEl = Math.round(vhEl * (pctEl / 100));
            }
          }
          if (typeof maxHEl === 'number' && isFinite(maxHEl) && panelMin > maxHEl) {
            maxHEl = panelMin + Math.round(vhEl);
          }
          return { panelMin: panelMin, maxH: maxHEl };
        }
        function getLimitsForPanelResize() {
          /* Donja granica s elementa; ne koristiti closure minH (inicijalno min+traka) kad je min-height 0px. */
          var panelMin = 120;
          var cs = typeof getComputedStyle !== 'undefined' && panel.ownerDocument && getComputedStyle(panel).minHeight;
          if (cs && cs !== 'none' && cs !== 'auto') {
            var px = parseFloat(cs);
            if (!isNaN(px) && isFinite(px)) panelMin = px <= 0 ? 120 : Math.round(px);
          }
          /* npr. Zapisnik: min-height:0 (flex) + donja točka u px; inače flex min-content = cijela forma i traka ne smanjuje. */
          var dMinAttr = panel.getAttribute && panel.getAttribute('data-resize-min-px');
          if (dMinAttr != null && String(dMinAttr).replace(/^\s+|\s+$/g, '') !== '') {
            var dPx2 = parseInt(String(dMinAttr).trim(), 10);
            if (!isNaN(dPx2) && dPx2 > 0) panelMin = Math.max(panelMin, dPx2);
          }
          var vhNow = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800;
          var maxH = Math.round(vhNow * 0.9);
          var maxVhAttr = panel.getAttribute && panel.getAttribute('data-resize-max-vh');
          if (maxVhAttr != null) maxVhAttr = String(maxVhAttr).trim();
          if (maxVhAttr === 'none' || maxVhAttr === 'full') {
            maxH = Infinity;
          } else if (maxVhAttr) {
            var pct = parseFloat(maxVhAttr, 10);
            if (!isNaN(pct) && pct > 0) {
              maxH = Math.round(vhNow * (pct / 100));
            }
          }
          if (typeof maxH === 'number' && isFinite(maxH) && panelMin > maxH) {
            maxH = panelMin + Math.round(vhNow);
          }
          return { panelMin: panelMin, maxH: maxH };
        }
        /** Za sync grupu: zajednički pod = max(panelMin), strop = min(maxH) – da oba panela mogu istu visinu. */
        function getEffectiveLimitsForDrag() {
          var limLocal = getLimitsForPanelResize();
          var syncGroup = panel.getAttribute && panel.getAttribute('data-resize-sync-group');
          if (!syncGroup) return limLocal;
          var nodes = (panel.ownerDocument || document).querySelectorAll('.kontrola-panel[data-resize-sync-group="' + syncGroup + '"]');
          if (!nodes || !nodes.length) return limLocal;
          var floor = limLocal.panelMin;
          var cap = limLocal.maxH;
          var idx;
          for (idx = 0; idx < nodes.length; idx++) {
            var lj = getLimitsForPanelEl(nodes[idx]);
            if (lj.panelMin > floor) floor = lj.panelMin;
            if (typeof lj.maxH === 'number' && isFinite(lj.maxH) && lj.maxH < cap) cap = lj.maxH;
          }
          if (typeof cap === 'number' && isFinite(cap) && floor > cap) {
            cap = floor + Math.round(typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800);
          }
          return { panelMin: floor, maxH: cap };
        }
        function applyPanelResizeHeight(newH) {
          var eff = getEffectiveLimitsForDrag();
          var target =
            typeof eff.maxH === 'number' && isFinite(eff.maxH)
              ? Math.max(eff.panelMin, Math.min(eff.maxH, newH))
              : Math.max(eff.panelMin, newH);
          /**
           * U stubcu (flex-direction: column) flex-stavka s flex-grow: 1 nakon pomicanja učita preostali prostor
           * u roditelja i ponašanje je kao da inline visina nije pogođena (npr. Zapisnik, jedno dijete u .zapisnik-crud__wrap).
           * 0 0 <target> fiksira glavnu os kako resizana visina stvarno ostane; u redu (row) ovo ne smijemo
           * postaviti – tu bi flex-basis bio širina, ne visina.
           */
          function setPanelResizedSize(el) {
            el.style.height = target + 'px';
            var pr = el.parentElement;
            if (pr && pr.nodeType === 1 && typeof getComputedStyle !== 'undefined') {
              var pds = getComputedStyle(pr);
              if (pds && pds.display === 'flex' && (pds.flexDirection === 'column' || pds.flexDirection === 'column-reverse')) {
                el.style.flex = '0 0 ' + target + 'px';
              } else {
                el.style.flex = '';
              }
            } else {
              el.style.flex = '';
            }
          }
          var syncGroup = panel.getAttribute && panel.getAttribute('data-resize-sync-group');
          if (syncGroup) {
            var allSync = (panel.ownerDocument || document).querySelectorAll('.kontrola-panel[data-resize-sync-group="' + syncGroup + '"]');
            for (var i = 0; i < allSync.length; i++) {
              setPanelResizedSize(allSync[i]);
            }
          } else {
            setPanelResizedSize(panel);
          }
        }
        function clientYFromTouchLike(ev) {
          if (ev.touches && ev.touches.length) return ev.touches[0].clientY;
          if (ev.changedTouches && ev.changedTouches.length) return ev.changedTouches[0].clientY;
          return ev.clientY;
        }
        /** Za data-resize-sync-group: početna visina mora biti max(svi u grupi), inače drag s „nižeg” panela postavlja oba na njegov offsetHeight i veći panel se stišne (npr. Transfer Excel log + rezultat). */
        function getSyncGroupStartHeightPx() {
          var h = panel.offsetHeight;
          var sg = panel.getAttribute && panel.getAttribute('data-resize-sync-group');
          if (!sg) return h;
          var peers = (panel.ownerDocument || document).querySelectorAll('.kontrola-panel[data-resize-sync-group="' + sg + '"]');
          var i, oh;
          for (i = 0; i < peers.length; i++) {
            oh = peers[i].offsetHeight;
            if (oh > h) h = oh;
          }
          return h;
        }
        function startLegacyDrag(e) {
          var lim = getEffectiveLimitsForDrag();
          var startY = clientYFromTouchLike(e);
          var startHeight = getSyncGroupStartHeightPx();
          function move(ev) {
            if (ev.cancelable && ev.type === 'touchmove') ev.preventDefault();
            var y = clientYFromTouchLike(ev);
            var nh = startHeight + (y - startY);
            var newH = (typeof lim.maxH === 'number' && isFinite(lim.maxH)) ? Math.max(lim.panelMin, Math.min(lim.maxH, nh)) : Math.max(lim.panelMin, nh);
            applyPanelResizeHeight(newH);
          }
          function stop() {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', stop);
            document.removeEventListener('touchmove', move, { passive: false, capture: true });
            document.removeEventListener('touchend', stop);
            document.removeEventListener('touchcancel', stop);
          }
          document.addEventListener('mousemove', move);
          document.addEventListener('mouseup', stop);
          document.addEventListener('touchmove', move, { passive: false, capture: true });
          document.addEventListener('touchend', stop);
          document.addEventListener('touchcancel', stop);
          if (e.cancelable) e.preventDefault();
        }
        function startPointerDrag(e) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          var lim = getEffectiveLimitsForDrag();
          var pid = e.pointerId;
          var startY = e.clientY;
          var startHeight = getSyncGroupStartHeightPx();
          function pmove(ev) {
            if (ev.pointerId !== pid) return;
            if (ev.cancelable) ev.preventDefault();
            var nh = startHeight + (ev.clientY - startY);
            var newH = (typeof lim.maxH === 'number' && isFinite(lim.maxH)) ? Math.max(lim.panelMin, Math.min(lim.maxH, nh)) : Math.max(lim.panelMin, nh);
            applyPanelResizeHeight(newH);
          }
          function pend(ev) {
            if (ev.pointerId !== pid) return;
            bar.removeEventListener('pointermove', pmove);
            bar.removeEventListener('pointerup', pend);
            bar.removeEventListener('pointercancel', pend);
            try { bar.releasePointerCapture(pid); } catch (err) { /* IE / stari WebKit */ }
          }
          try { bar.setPointerCapture(pid); } catch (err2) { /* */ }
          bar.addEventListener('pointermove', pmove);
          bar.addEventListener('pointerup', pend);
          bar.addEventListener('pointercancel', pend);
          if (e.cancelable) e.preventDefault();
        }
        if (typeof window.PointerEvent !== 'undefined') {
          bar.addEventListener('pointerdown', startPointerDrag);
        } else {
          bar.addEventListener('mousedown', startLegacyDrag);
          bar.addEventListener('touchstart', startLegacyDrag, { passive: false });
        }
      });
    }

    /* ========== KONTROLA BOJA (picker s modalom; dijeljeno za sva polja boje) ==========
       Markup po polju: <div class="kontrola-boja" data-boja-za="<id_inputa>" data-boja-nullable="0|1">
                          <button class="kontrola-boja__trigger">…paleta ikona…</button>
                          (opcionalno RO hex) <span class="kontrola-boja__swatch"></span></div>
       Modal #bojaModal gradi se jednom u JS-u i dodaje u <body>. Alpha klizač tokenom --kontrola_boja_alpha
       (1=enable, 0=red disable). API: KontroleBojaInit(root), KontroleBojaRefresh(targetId). */
    (function () {
      function byId(id) { return document.getElementById(id); }
      function jeHex6(s) { return /^#[0-9A-Fa-f]{6}$/.test(String(s || '')); }
      function jeHex8(s) { return /^#[0-9A-Fa-f]{8}$/.test(String(s || '')); }
      function normHex(s) { return String(s == null ? '' : s).trim().toUpperCase(); }
      function bojaUCss(val) {
        val = normHex(val);
        if (jeHex8(val)) {
          var r = parseInt(val.substr(1, 2), 16), g = parseInt(val.substr(3, 2), 16),
              b = parseInt(val.substr(5, 2), 16), a = parseInt(val.substr(7, 2), 16) / 255;
          return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
        }
        return val;
      }
      function refreshSelect(id) { if (typeof KontroleRefreshCustomSelect === 'function') { try { KontroleRefreshCustomSelect(id); } catch (e) {} } }

      var MODAL_HTML = [
        '<div class="kontrola-boja-modal__overlay" data-boja-zatvori></div>',
        '<div class="kontrola-boja-modal__dialog" role="dialog" aria-modal="true" aria-label="Izbor boje">',
        '<div class="kontrola-boja-modal__zaglavlje">',
        '<span class="kontrola-boja-modal__naslov">Boje</span>',
        '<div class="kontrola-select kontrola-boja-modal__nacin"><select id="bojaModalNacin" aria-label="Način izbora boje">',
        '<option value="paleta">Paleta boja</option><option value="korisnik">Korisnička boja</option>',
        '</select></div>',
        '</div>',
        '<div class="kontrola-boja-modal__body">',
        '<div class="kontrola-boja-modal__paleta" id="bojaModalPaleta" role="listbox" aria-label="Paleta boja"></div>',
        '<div class="kontrola-boja-modal__korisnik" id="bojaModalKorisnik" hidden>',
        '<div class="kontrola-boja-modal__kor-unos">',
        '<button type="button" id="bojaModalNativTrigger" class="kontrola-boja__trigger kontrola-boja-modal__nativ-trigger" aria-label="Sistemski izbor boje"><span class="kontrola-icon--paleta" aria-hidden="true"></span></button>',
        '<input type="text" id="bojaModalKorHex" class="kontrola-edit kontrola-edit--readonly kontrola-boja-modal__hex" maxlength="9" placeholder="#000000" readonly tabindex="-1" aria-readonly="true" aria-label="Kod boje (hex)">',
        '<input type="color" id="bojaModalNativ" class="kontrola-boja-modal__nativ-skriven" value="#000000" tabindex="-1" aria-hidden="true">',
        '</div>',
        '<span id="bojaModalKorPuna" class="kontrola-boja-modal__kor-puna" aria-hidden="true"></span>',
        '<div class="kontrola-boja-modal__red" id="bojaModalKorAlphaRed">',
        '<label class="kontrola-labela mb-0" for="bojaModalKorAlpha">Prozirnost</label>',
        '<input type="range" id="bojaModalKorAlpha" min="0" max="255" value="255" class="kontrola-boja-modal__alpha" aria-label="Prozirnost (alpha)">',
        '<span id="bojaModalKorAlphaVal" class="kontrola-boja-modal__alpha-val">100%</span>',
        '</div>',
        '<span class="kontrola-boja-modal__kor-pregled-okvir"><span id="bojaModalKorPregled" class="kontrola-boja-modal__kor-pregled" aria-hidden="true"></span></span>',
        '</div>',
        '<div class="kontrola-boja-modal__red kontrola-boja-modal__red--pregled" id="bojaModalPregledRed">',
        '<span class="kontrola-boja-modal__pregled-okvir"><span id="bojaModalPregled" class="kontrola-boja-modal__pregled"></span></span>',
        '<input type="text" id="bojaModalHex" class="kontrola-edit kontrola-edit--readonly kontrola-boja-modal__hex" maxlength="9" placeholder="#000000" readonly tabindex="-1" aria-readonly="true" aria-label="Kod boje (hex)">',
        '</div>',
        '<div class="kontrola-boja-modal__red" id="bojaModalAlphaRed">',
        '<label class="kontrola-labela mb-0" for="bojaModalAlpha">Prozirnost</label>',
        '<input type="range" id="bojaModalAlpha" min="0" max="255" value="255" class="kontrola-boja-modal__alpha" aria-label="Prozirnost (alpha)">',
        '<span id="bojaModalAlphaVal" class="kontrola-boja-modal__alpha-val">255</span>',
        '</div>',
        '</div>',
        '<div class="kontrola-boja-modal__footer">',
        '<button type="button" id="bojaModalOk" class="kontrola-btn kontrola-btn--crud-upisi"><span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">OK</span></span></span></button>',
        '<button type="button" id="bojaModalOdustani" class="kontrola-btn kontrola-btn--crud-povratak" data-boja-zatvori><span class="kontrola-btn__outer"><span class="kontrola-btn__inner"><span class="kontrola-btn__label">Odustani</span></span></span></button>',
        '</div>',
        '</div>'
      ].join('');

      var KB = {
        _built: false,
        modal: null, nacin: null, paleta: null, korisnik: null, nativ: null, hexInp: null,
        alphaRed: null, alpha: null, alphaVal: null, pregled: null, pregledRed: null,
        nativTrigger: null, korHex: null, korPuna: null, korAlphaRed: null, korAlpha: null, korAlphaVal: null, korPregled: null,
        alphaOn: false, targetId: null, nullable: false,
        rgb: '#000000', a: 255, bezBoje: false,
        BOJE: [
          ['Crna', '#000000'], ['Bijela', '#FFFFFF'],
          ['Siva 1', '#404040'], ['Siva 2', '#808080'], ['Siva 3', '#BFBFBF'], ['Siva 4', '#E0E0E0'],
          ['Crvena', '#E53935'], ['Tamnocrvena', '#B71C1C'],
          ['Roza', '#D81B60'], ['Ljubičasta', '#8E24AA'], ['Indigo', '#3949AB'],
          ['Plava', '#1E88E5'], ['Tamnoplava', '#1565C0'], ['Svijetloplava', '#039BE5'],
          ['Cijan', '#00ACC1'], ['Tirkizna', '#00897B'],
          ['Zelena', '#43A047'], ['Tamnozelena', '#2E7D32'], ['Limeta', '#C0CA33'],
          ['Žuta', '#FDD835'], ['Jantar', '#FFB300'],
          ['Narančasta', '#FB8C00'], ['Tamnonarančasta', '#F4511E'],
          ['Smeđa', '#6D4C41'], ['Plavosiva', '#546E7A'], ['Tamnoljubičasta', '#5E35B1']
        ],
        osvjeziSwatch: function (targetId) {
          var wrap = document.querySelector('.kontrola-boja[data-boja-za="' + targetId + '"]');
          if (!wrap) return;
          var sw = wrap.querySelector('.kontrola-boja__swatch');
          var inp = byId(targetId);
          var val = inp ? normHex(inp.value) : '';
          if (!sw) return;
          if (val === '') { sw.style.background = ''; sw.classList.add('kontrola-boja__swatch--prazno'); }
          else { sw.classList.remove('kontrola-boja__swatch--prazno'); sw.style.background = bojaUCss(val); }
        },
        napuniPaletu: function () {
          if (!this.paleta) return;
          var html = '';
          if (this.nullable) html += '<button type="button" class="kontrola-boja-modal__swatch kontrola-boja__swatch--prazno" data-bez="1" title="Bez boje (sistemska)" aria-label="Bez boje"></button>';
          this.BOJE.forEach(function (b, i) {
            html += '<button type="button" class="kontrola-boja-modal__swatch" data-hex="' + b[1] + '" title="' + b[0] + '" aria-label="' + b[0] + '" style="background:' + b[1] + '"></button>';
            if (i === 1) html += '<span class="kontrola-boja-modal__placeholder" aria-hidden="true"></span>';
          });
          this.paleta.innerHTML = html;
        },
        sastaviHex: function () {
          var rgb = jeHex6(normHex(this.rgb)) ? normHex(this.rgb) : '#000000';
          if (this.alphaOn && this.a < 255) { var aa = ((this.a | 0)).toString(16).toUpperCase(); if (aa.length < 2) aa = '0' + aa; return rgb + aa; }
          return rgb;
        },
        cssBoja: function () {
          var rgb = jeHex6(normHex(this.rgb)) ? normHex(this.rgb) : '#000000';
          if (this.alphaOn) {
            var r = parseInt(rgb.substr(1, 2), 16), g = parseInt(rgb.substr(3, 2), 16), b = parseInt(rgb.substr(5, 2), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + (this.a / 255).toFixed(3) + ')';
          }
          return rgb;
        },
        _bojaSwatch: function (el, prozirno) {
          if (!el) return;
          if (this.bezBoje) { el.style.background = ''; el.classList.add('kontrola-boja__swatch--prazno'); return; }
          el.classList.remove('kontrola-boja__swatch--prazno');
          el.style.background = prozirno ? this.cssBoja() : (jeHex6(normHex(this.rgb)) ? normHex(this.rgb) : '#000000');
        },
        prikaziSve: function () {
          var hex = this.bezBoje ? '' : this.sastaviHex();
          if (this.hexInp) this.hexInp.value = hex;
          if (this.korHex) this.korHex.value = hex;
          this._bojaSwatch(this.pregled, true);
          this._bojaSwatch(this.korPregled, true);
          this._bojaSwatch(this.korPuna, false);
          var pct = Math.round(this.a / 255 * 100) + '%';
          if (this.alpha) this.alpha.value = this.a;
          if (this.korAlpha) this.korAlpha.value = this.a;
          if (this.alphaVal) this.alphaVal.textContent = pct;
          if (this.korAlphaVal) this.korAlphaVal.textContent = pct;
          if (this.nativ && !this.bezBoje && jeHex6(normHex(this.rgb))) this.nativ.value = normHex(this.rgb);
          if (this.paleta) {
            var sel = this.bezBoje ? '[data-bez]' : '[data-hex="' + normHex(this.rgb) + '"]';
            Array.prototype.forEach.call(this.paleta.querySelectorAll('.kontrola-boja-modal__swatch'), function (el) {
              el.classList.toggle('kontrola-boja-modal__swatch--odabran', el.matches(sel));
            });
          }
        },
        odaberiHex: function (hex) { this.bezBoje = false; this.rgb = normHex(hex); this.prikaziSve(); },
        odaberiBez: function () { this.bezBoje = true; this.prikaziSve(); },
        izNativ: function () { this.bezBoje = false; this.rgb = normHex(this.nativ ? this.nativ.value : '#000000'); this.prikaziSve(); },
        izHex: function () {
          var v = normHex(this.hexInp ? this.hexInp.value : '');
          if (jeHex6(v) || jeHex8(v)) {
            this.bezBoje = false; this.rgb = '#' + v.substr(1, 6);
            if (this.alphaOn) this.a = jeHex8(v) ? parseInt(v.substr(7, 2), 16) : 255;
            this.prikaziSve();
          }
        },
        izAlpha: function (el) { var src = el || this.alpha; if (src) this.a = parseInt(src.value, 10) || 0; if (this.bezBoje) this.bezBoje = false; this.prikaziSve(); },
        postaviNacin: function (n) {
          if (this.nacin) this.nacin.value = n;
          var paleta = (n === 'paleta');
          if (this.paleta) this.paleta.hidden = !paleta;
          if (this.korisnik) this.korisnik.hidden = paleta;
          if (this.pregledRed) this.pregledRed.hidden = !paleta;
          if (this.alphaRed) this.alphaRed.hidden = !paleta;
          refreshSelect('bojaModalNacin');
          this.prikaziSve();
        },
        primijeniAlphaStanje: function () {
          var off = !this.alphaOn;
          [[this.alphaRed, this.alpha], [this.korAlphaRed, this.korAlpha]].forEach(function (par) {
            if (par[0]) par[0].classList.toggle('kontrola-boja-modal__red--disabled', off);
            if (par[1]) par[1].disabled = off;
          });
        },
        otvori: function (targetId, nullable) {
          this.ensureModal();
          if (!this.modal) return;
          this.targetId = targetId; this.nullable = !!nullable;
          this.napuniPaletu();
          var inp = byId(targetId); var cur = inp ? normHex(inp.value) : '';
          if (cur === '' && this.nullable) { this.bezBoje = true; this.rgb = '#000000'; this.a = 255; }
          else {
            this.bezBoje = false;
            var base = (jeHex6(cur) || jeHex8(cur)) ? cur : '#000000';
            this.rgb = '#' + base.substr(1, 6);
            this.a = (this.alphaOn && jeHex8(base)) ? parseInt(base.substr(7, 2), 16) : 255;
          }
          this.postaviNacin('paleta');
          this.prikaziSve();
          this.modal.classList.add('kontrola-boja-modal--open');
          this.modal.setAttribute('aria-hidden', 'false');
        },
        zatvori: function () {
          if (!this.modal) return;
          this.modal.classList.remove('kontrola-boja-modal--open');
          this.modal.setAttribute('aria-hidden', 'true');
          this.targetId = null;
        },
        jeOtvoren: function () { return this.modal && this.modal.classList.contains('kontrola-boja-modal--open'); },
        potvrdi: function () {
          if (!this.targetId) { this.zatvori(); return; }
          var inp = byId(this.targetId);
          var val = this.bezBoje ? '' : this.sastaviHex();
          if (inp) {
            inp.value = val;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          }
          this.osvjeziSwatch(this.targetId);
          this.zatvori();
        },
        ensureModal: function () {
          if (this._built) return;
          var self = this;
          var m = document.createElement('div');
          m.className = 'kontrola-boja-modal';
          m.id = 'bojaModal';
          m.setAttribute('aria-hidden', 'true');
          m.innerHTML = MODAL_HTML;
          document.body.appendChild(m);
          this._built = true;
          this.modal = m;
          this.nacin = byId('bojaModalNacin');
          this.paleta = byId('bojaModalPaleta');
          this.korisnik = byId('bojaModalKorisnik');
          this.nativ = byId('bojaModalNativ');
          this.hexInp = byId('bojaModalHex');
          this.alphaRed = byId('bojaModalAlphaRed');
          this.alpha = byId('bojaModalAlpha');
          this.alphaVal = byId('bojaModalAlphaVal');
          this.pregled = byId('bojaModalPregled');
          this.pregledRed = byId('bojaModalPregledRed');
          this.nativTrigger = byId('bojaModalNativTrigger');
          this.korHex = byId('bojaModalKorHex');
          this.korPuna = byId('bojaModalKorPuna');
          this.korAlphaRed = byId('bojaModalKorAlphaRed');
          this.korAlpha = byId('bojaModalKorAlpha');
          this.korAlphaVal = byId('bojaModalKorAlphaVal');
          this.korPregled = byId('bojaModalKorPregled');
          if (typeof initCustomSelect === 'function') initCustomSelect(m);
          this.alphaOn = (getComputedStyle(document.documentElement).getPropertyValue('--kontrola_boja_alpha').trim() === '1');
          this.primijeniAlphaStanje();
          if (this.nacin) this.nacin.addEventListener('change', function () { self.postaviNacin(self.nacin.value); });
          if (this.nativTrigger) this.nativTrigger.addEventListener('click', function () { if (self.nativ) self.nativ.click(); });
          if (this.nativ) this.nativ.addEventListener('input', function () { self.izNativ(); });
          if (this.hexInp) this.hexInp.addEventListener('input', function () { self.izHex(); });
          if (this.alpha) this.alpha.addEventListener('input', function () { self.izAlpha(self.alpha); });
          if (this.korAlpha) this.korAlpha.addEventListener('input', function () { self.izAlpha(self.korAlpha); });
          if (this.paleta) this.paleta.addEventListener('click', function (e) {
            var sw = e.target && e.target.closest ? e.target.closest('.kontrola-boja-modal__swatch') : null;
            if (!sw) return;
            if (sw.getAttribute('data-bez')) self.odaberiBez(); else self.odaberiHex(sw.getAttribute('data-hex'));
          });
          var okB = byId('bojaModalOk'); if (okB) okB.addEventListener('click', function () { self.potvrdi(); });
          Array.prototype.forEach.call(m.querySelectorAll('[data-boja-zatvori]'), function (el) { el.addEventListener('click', function () { self.zatvori(); }); });
          document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && self.jeOtvoren()) self.zatvori(); });
        },
        initWrappers: function (root) {
          var self = this;
          var wraps = (root || document).querySelectorAll('.kontrola-boja');
          if (!wraps.length) return; /* nema polja boje na stranici → ne gradi modal */
          this.ensureModal();
          Array.prototype.forEach.call(wraps, function (wrap) {
            if (wrap.dataset.bojaInit === '1') return;
            wrap.dataset.bojaInit = '1';
            var btn = wrap.querySelector('.kontrola-boja__trigger');
            var targetId = wrap.getAttribute('data-boja-za');
            var nullable = wrap.getAttribute('data-boja-nullable') === '1';
            if (btn) btn.addEventListener('click', function () { if (btn.disabled) return; self.otvori(targetId, nullable); });
            self.osvjeziSwatch(targetId);
          });
        }
      };

      global.KontroleBojaInit = function (root) { KB.initWrappers(root || document); };
      global.KontroleBojaRefresh = function (targetId) { KB.osvjeziSwatch(targetId); };
    })();

    /* ========== SPINER (kontrola; dijeljeno) ==========
       Gradi segmente/točkice iz tokena (--spiner_broj_segmenata, --spiner_segment_omjer,
       --spiner_promjer, --spiner_brzina). Varijanta po klasi: --segment ili --dot.
       API: KontroleSpinerInit(el), KontroleSpinerInitAll(root), KontroleSpinerShow/Hide(overlay). */
    function KontroleSpinerInit(el) {
      if (!el || el.dataset.spinerInit === '1') return;
      el.dataset.spinerInit = '1';
      var cs = getComputedStyle(el);
      var n = parseInt(cs.getPropertyValue('--spiner_broj_segmenata'), 10) || 12;
      var promjer = parseFloat(cs.getPropertyValue('--spiner_promjer')) || 40;
      var omjer = parseFloat(cs.getPropertyValue('--spiner_segment_omjer')) || 0.26;
      var brzina = parseFloat(cs.getPropertyValue('--spiner_brzina')) || 1.1; /* sekunde */
      var jeDot = el.classList.contains('kontrola-spiner--dot');
      var ang = 360 / n;
      /* dot je 50% manji od segment omjera (faktor 0.5 mora se podudarati s CSS-om) → vanjski rub do ruba kruga */
      var R = (promjer - promjer * omjer * 0.5) / 2;
      el.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var s = document.createElement('span');
        s.className = 'kontrola-spiner__dio';
        s.style.animationDelay = ((i / n) * brzina).toFixed(3) + 's';
        if (jeDot) s.style.transform = 'rotate(' + (i * ang) + 'deg) translateY(-' + R.toFixed(2) + 'px)';
        else s.style.transform = 'rotate(' + (i * ang) + 'deg)';
        el.appendChild(s);
      }
    }
    function KontroleSpinerInitAll(root) {
      Array.prototype.forEach.call((root || document).querySelectorAll('.kontrola-spiner'), KontroleSpinerInit);
    }
    function KontroleSpinerShow(overlay) { if (overlay) overlay.classList.add('kontrola-spiner-overlay--vidljiv'); }
    function KontroleSpinerHide(overlay) { if (overlay) overlay.classList.remove('kontrola-spiner-overlay--vidljiv'); }
    global.KontroleSpinerInit = KontroleSpinerInit;
    global.KontroleSpinerInitAll = KontroleSpinerInitAll;
    global.KontroleSpinerShow = KontroleSpinerShow;
    global.KontroleSpinerHide = KontroleSpinerHide;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        runScrollbarStyles();
        initEditDelete(document);
        initCustomSelect(document);
        initSlika(document);
        initHoverScrollToEnd(document);
        initPanelTablicaFooterRows(document);
        initPanelResizeBar(document);
        initButtonTouchFeedback(document);
        syncLabelsDisabledState(document);
        KontroleBojaInit(document);
        KontroleSpinerInitAll(document);
      });
    } else {
      runScrollbarStyles();
      initEditDelete(document);
      initCustomSelect(document);
      initSlika(document);
      initHoverScrollToEnd(document);
      initPanelTablicaFooterRows(document);
      initPanelResizeBar(document);
      initButtonTouchFeedback(document);
      syncLabelsDisabledState(document);
      KontroleBojaInit(document);
      KontroleSpinerInitAll(document);
    }
    window.addEventListener('load', runScrollbarStyles);
    global.KontroleRefreshScrollbarHoverColor = function () {
      syncAllScrollbarTokens();
      injectScrollbarHoverStyle();
    };

    /* ========== MODAL PORUKE (zajednički za cijelu aplikaciju; MODAL_MESSAGES iz 0-Poruke_Tekstovi.js) ========== */
    (function () {
      var modalEl = null;
      var headerEl = null;
      var imageEl = null;
      var contentEl = null;
      var footerEl = null;
      var porukaModalKeydownHandler = null;

      function ensureModal() {
        if (modalEl) return;
        modalEl = document.createElement('div');
        modalEl.id = 'kontrola-modal-poruke';
        modalEl.className = 'kontrola-modal kontrola-modal--dim';
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        var overlay = document.createElement('div');
        overlay.className = 'kontrola-modal__overlay';
        var dialog = document.createElement('div');
        dialog.className = 'kontrola-modal__dialog';
        headerEl = document.createElement('div');
        headerEl.className = 'kontrola-modal__header';
        headerEl.id = 'kontrola-modal-poruke-header';
        modalEl.setAttribute('aria-labelledby', headerEl.id);
        var body = document.createElement('div');
        body.className = 'kontrola-modal__body';
        imageEl = document.createElement('div');
        imageEl.className = 'kontrola-modal__image';
        imageEl.setAttribute('aria-hidden', 'true');
        contentEl = document.createElement('div');
        contentEl.className = 'kontrola-modal__content';
        body.appendChild(imageEl);
        body.appendChild(contentEl);
        footerEl = document.createElement('div');
        footerEl.className = 'kontrola-modal__footer';
        dialog.appendChild(headerEl);
        dialog.appendChild(body);
        dialog.appendChild(footerEl);
        modalEl.appendChild(overlay);
        modalEl.appendChild(dialog);
        document.body.appendChild(modalEl);
      }

      /* --- Blok: Modal – URL PNG ikone (korijen aplikacije + /slike/; pouzdanije od CSS var u ::before) --- */
      function modalIconSrcForStanje(stanje) {
        var s = String(stanje || '').toLowerCase();
        var fileByStanje = {
          ok: 'Check.png',
          error: 'Error.png',
          forbidden: 'Forbidden.png',
          information: 'information.png',
          warning: 'Warning.png'
        };
        var name = fileByStanje[s] || fileByStanje.information;
        if (typeof window.vnlhAppBasePathname === 'function') {
          var base = window.vnlhAppBasePathname();
          if (base !== '') {
            var pathname = base.replace(/\/$/, '') + '/slike/' + name;
            pathname = pathname.replace(/\/{2,}/g, '/');
            if (pathname.charAt(0) !== '/') pathname = '/' + pathname;
            return pathname;
          }
        }
        try {
          return new URL('../slike/' + name, window.location.href).href;
        } catch (e) {
          return '../slike/' + name;
        }
      }

      function parseModalMessage(raw) {
        if (raw == null) raw = '';
        var parts = String(raw).split('|');
        var id = (parts[0] || '').trim();
        var origin = (parts[1] || '').trim();
        var tipke = (parts[2] || '').trim();
        var stanje = (parts[3] || '').trim() || 'information';
        var boja_okvira = (parts[4] || '').trim();
        var tekst_poruke = parts.slice(5).join('|').trim() || '—';
        var buttons = [];
        if (tipke) {
          tipke.split(',').forEach(function (s) {
            var t = s.trim();
            if (!t) return;
            var def = t.indexOf('(') === 0 && t.indexOf(')') === t.length - 1;
            var key = def ? t.slice(1, -1).trim() : t;
            buttons.push({ key: key, default: def });
          });
        }
        return { id: id, origin: origin, tipke: tipke, stanje: stanje, boja_okvira: boja_okvira, tekst_poruke: tekst_poruke, buttons: buttons };
      }

      var porukaModalPreviousFocus = null;

      function closePorukaModal() {
        if (!modalEl) return;
        var toFocus = porukaModalPreviousFocus && porukaModalPreviousFocus.nodeType === 1 && document.contains(porukaModalPreviousFocus) && !modalEl.contains(porukaModalPreviousFocus) ? porukaModalPreviousFocus : document.body;
        if (toFocus && toFocus === document.body && !document.body.hasAttribute('tabindex')) document.body.setAttribute('tabindex', '-1');
        if (toFocus && typeof toFocus.focus === 'function') toFocus.focus();
        porukaModalPreviousFocus = null;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.classList.remove('kontrola-modal--open');
        ['ok', 'error', 'forbidden', 'information', 'warning'].forEach(function (s) {
          modalEl.classList.remove('kontrola-modal--' + s);
        });
        if (porukaModalKeydownHandler) {
          document.removeEventListener('keydown', porukaModalKeydownHandler);
          porukaModalKeydownHandler = null;
        }
      }

      function showPorukaModal(code, replacements, onClose) {
        ensureModal();
        if (!headerEl || !imageEl || !contentEl || !footerEl) return;
        porukaModalPreviousFocus = document.activeElement;
        var raw = typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[code];
        if (!raw) return;
        var msg = parseModalMessage(raw);
        var tekst = msg.tekst_poruke || '—';
        if (replacements && replacements.length) {
          [1, 2, 3].forEach(function (i) {
            if (replacements[i - 1] != null) tekst = tekst.replace(new RegExp('#' + i, 'g'), replacements[i - 1]);
          });
        }
        headerEl.textContent = msg.origin || '—';
        contentEl.textContent = tekst;

        imageEl.setAttribute('aria-hidden', 'false');
        imageEl.className =
          'kontrola-modal__image kontrola-modal__image--' + msg.stanje + ' kontrola-modal__image--has-png';
        imageEl.innerHTML = '';
        var imgPng = document.createElement('img');
        imgPng.className = 'kontrola-modal__image-png';
        imgPng.alt = '';
        imgPng.src = modalIconSrcForStanje(msg.stanje);
        imageEl.appendChild(imgPng);
        ['ok', 'error', 'forbidden', 'information', 'warning'].forEach(function (s) {
          modalEl.classList.remove('kontrola-modal--' + s);
        });
        modalEl.classList.add('kontrola-modal--' + msg.stanje);

        footerEl.innerHTML = '';
        var captions = typeof MODAL_BUTTON_CAPTIONS !== 'undefined' ? MODAL_BUTTON_CAPTIONS : {};
        if (msg.buttons.length > 0) {
          msg.buttons.forEach(function (b) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kontrola-btn';
            btn.textContent = captions[b.key] != null ? captions[b.key] : b.key;
            if (b.default) btn.classList.add('kontrola-btn--primary');
            (function (btnKey) {
              btn.addEventListener('click', function () {
                closePorukaModal();
                if (typeof onClose === 'function') onClose(btnKey);
              });
            })(b.key);
            var outer = document.createElement('span');
            outer.className = 'kontrola-btn__outer';
            var inner = document.createElement('span');
            inner.className = 'kontrola-btn__inner';
            var label = document.createElement('span');
            label.className = 'kontrola-btn__label';
            label.textContent = btn.textContent;
            btn.textContent = '';
            inner.appendChild(label);
            outer.appendChild(inner);
            btn.appendChild(outer);
            footerEl.appendChild(btn);
          });
        } else {
          var autoCloseMs = 3000;
          var root = document.documentElement;
          if (root && typeof getComputedStyle === 'function') {
            var v = getComputedStyle(root).getPropertyValue('--modal_auto_close_ms').trim();
            if (v) autoCloseMs = parseInt(v, 10) || 3000;
          }
          setTimeout(function () {
            closePorukaModal();
            if (typeof onClose === 'function') onClose();
          }, autoCloseMs);
        }

        modalEl.setAttribute('aria-hidden', 'false');
        modalEl.classList.add('kontrola-modal--open');

        if (porukaModalKeydownHandler) {
          document.removeEventListener('keydown', porukaModalKeydownHandler);
        }
        porukaModalKeydownHandler = function (e) {
          if (!modalEl || modalEl.getAttribute('aria-hidden') === 'true') return;
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            var defaultBtn = footerEl.querySelector('.kontrola-btn--primary');
            if (defaultBtn) {
              e.preventDefault();
              defaultBtn.click();
            }
          }
        };
        document.addEventListener('keydown', porukaModalKeydownHandler);
      }

      global.showPorukaModal = showPorukaModal;
      global.closePorukaModal = closePorukaModal;
    })();
  }
})(typeof window !== 'undefined' ? window : this);
