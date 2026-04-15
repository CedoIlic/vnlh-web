/* ========== ALATI TEME (Podešavanje Teme)
   Tablica + kontrole; tipke, edit, početni podaci i vezivanje na KontroleTablica API.
   ========================================== */

(function () {
  if (typeof vnlhUcitajPravaCrud === 'function') vnlhUcitajPravaCrud('Alati_teme.html', null, { upisiId: 'btnCrudUpisi', izbrisiId: 'btnCrudIzbrisi' });
  var container = document.getElementById('tablicaContainer');
  var editBrojKolona = document.getElementById('alatiTemeN');
  var btnDodajRed = document.getElementById('btnDodajRed');
  var btnObrisiRandom = document.getElementById('btnObrisiRandom');
  var btnRefresh = document.getElementById('btnRefresh');
  var btnToggleEnable = document.getElementById('btnToggleEnable');

  function getBrojKolona() {
    if (!editBrojKolona) return 5;
    var n = parseInt(editBrojKolona.value, 10);
    if (isNaN(n) || n < 1) return 1;
    if (n > 20) return 20;
    return n;
  }

  function setBrojKolona(n) {
    if (editBrojKolona) editBrojKolona.value = Math.max(1, Math.min(20, n));
  }

  function randomText() {
    var words = ['Test', 'Podatak', 'Vrijednost', 'A', 'B', 'C', 'Red', 'Stupac', 'Foo', 'Bar'];
    return words[Math.floor(Math.random() * words.length)] + ' ' + Math.floor(Math.random() * 1000);
  }

  function initSampleData() {
    var n = getBrojKolona();
    var data = [];
    for (var i = 0; i < 3; i++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push('Red ' + (i + 1) + ' – ' + (c + 1));
      data.push(row);
    }
    return data;
  }

  var btnCrudUpisi = document.getElementById('btnCrudUpisi');
  var crudUpisiLabel = btnCrudUpisi && btnCrudUpisi.querySelector('.kontrola-btn__label');

  function getSelectedRowId() {
    if (!tablica) return null;
    if (typeof tablica.getSelectedRowIds === 'function') {
      var ids = tablica.getSelectedRowIds();
      return ids.length ? ids[0] : null;
    }
    var indices = tablica.getSelectedIndices();
    return indices.length ? indices[0] : null;
  }

  function updateCrudUpisiState() {
    if (!btnCrudUpisi || !crudUpisiLabel) return;
    var rowId = getSelectedRowId();
    var isIzmjeni = rowId != null;
    btnCrudUpisi.classList.toggle('kontrola-btn--crud-izmjeni', isIzmjeni);
    crudUpisiLabel.textContent = isIzmjeni ? 'Izmjeni' : 'Upiši';
    btnCrudUpisi.setAttribute('aria-label', isIzmjeni ? 'Izmjeni' : 'Upiši');
  }

  var tablica = KontroleTablica(container, {
    getBrojKolona: getBrojKolona,
    headerLabels: function (n) {
      var arr = [];
      for (var c = 0; c < n; c++) arr.push('Kolona ' + (c + 1));
      return arr;
    },
    data: initSampleData(),
    onSelectionChange: updateCrudUpisiState
  });

  updateCrudUpisiState();

  /* CRUD akcije: Upiši -> add ili update(rowId), Izbriši -> delete(rowId) */
  var btnCrudIzbrisi = document.getElementById('btnCrudIzbrisi');
  var crudEventName = 'kontrola-crud-action';

  function dispatchCrudAction(action, rowId) {
    var e = new CustomEvent(crudEventName, {
      bubbles: true,
      detail: { action: action, rowId: rowId != null ? rowId : null }
    });
    document.dispatchEvent(e);
  }

  if (btnCrudUpisi) {
    btnCrudUpisi.addEventListener('click', function () {
      var rowId = getSelectedRowId();
      if (rowId == null) {
        dispatchCrudAction('add', null);
      } else {
        dispatchCrudAction('update', rowId);
      }
    });
  }

  if (btnCrudIzbrisi) {
    btnCrudIzbrisi.addEventListener('click', function () {
      var rowId = getSelectedRowId();
      if (rowId != null) {
        dispatchCrudAction('delete', rowId);
      }
    });
  }

  /**
   * Povratak: ista logika kao na CRUD stranicama (ref → referrer → Meni.php).
   * history.back() nije prikladan: pagehide + sendBeacon tretira odlazak kao zatvaranje kartice ako
   * __vnlhAppNavInternal ostane false (0-Common.js), što uništava PHP sesiju prije učitavanja prethodne stranice.
   */
  (function () {
    var btnPovratak = document.getElementById('btnPovratak');
    if (!btnPovratak) return;
    btnPovratak.addEventListener('click', function () {
      var params = new URLSearchParams(window.location.search);
      var ref = (params.get('ref') || '').trim();
      if (ref) {
        try {
          var uRef = new URL(ref, window.location.href);
          if (uRef.origin === window.location.origin) {
            window.location.href = uRef.href;
            return;
          }
        } catch (eRef) {}
      }
      if (document.referrer) {
        try {
          var uRef2 = new URL(document.referrer);
          if (uRef2.origin === window.location.origin) {
            window.location.href = uRef2.href;
            return;
          }
        } catch (eRef2) {}
      }
      window.location.href = new URL('Meni.php', window.location.href).href;
    });
  })();

  /* Primjer obrade u JS forme – zamijeni vlastitom logikom */
  document.addEventListener(crudEventName, function (e) {
    var d = e.detail;
    if (d.action === 'add') { /* forma: novi slog */ }
    if (d.action === 'update') { /* forma: ažuriraj slog s id = d.rowId */ }
    if (d.action === 'delete') { /* forma: obriši slog s id = d.rowId */ }
  });

  if (editBrojKolona) {
    editBrojKolona.addEventListener('input', function () {
      setBrojKolona(getBrojKolona());
    });
    editBrojKolona.addEventListener('change', function () {
      setBrojKolona(getBrojKolona());
      tablica.refresh();
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', function () {
      tablica.refresh();
    });
  }

  if (btnDodajRed) {
    btnDodajRed.addEventListener('click', function () {
      var n = getBrojKolona();
      var row = [];
      for (var c = 0; c < n; c++) row.push(randomText());
      tablica.addRow(row);
    });
  }

  if (btnObrisiRandom) {
    btnObrisiRandom.addEventListener('click', function () {
      var data = tablica.getData();
      if (data.length === 0) return;
      var idx = Math.floor(Math.random() * data.length);
      tablica.removeRow(idx);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', function () {
      var link = document.querySelector('link[href*="0-Common.css"]');
      if (link) {
        var base = link.getAttribute('href').split('?')[0];
        link.setAttribute('href', base + '?t=' + Date.now());
        link.addEventListener('load', function onLoad() {
          link.removeEventListener('load', onLoad);
          tablica.refresh();
        });
      }
      tablica.refresh();
    });
  }

  // Enable/Disable svih kontrola na oba panela (tablica + panel s kontrolama)
  var enabled = true;
  if (btnToggleEnable && typeof KontroleSetEnabled === 'function') {
    btnToggleEnable.addEventListener('click', function () {
      enabled = !enabled;
      KontroleSetEnabled(document, enabled);
    });
  }

  /* Select kodova poruka – popuni prije inita custom selecta da lista ima opcije */
  var modalTestSelect = document.getElementById('modalTestSelect');
  if (typeof MODAL_MESSAGES === 'object' && modalTestSelect) {
    var codes = Object.keys(MODAL_MESSAGES).sort();
    codes.forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      modalTestSelect.appendChild(opt);
    });
  }

  /* Inicijalizacija kontrola (custom select, edit-delete) na ovoj stranici */
  if (typeof KontroleInitCustomSelect === 'function') KontroleInitCustomSelect(document);
  if (typeof KontroleInitEditDelete === 'function') KontroleInitEditDelete(document);

  function puniModalTestSelect() {
    if (!modalTestSelect || typeof MODAL_MESSAGES !== 'object') return;
    while (modalTestSelect.options.length) modalTestSelect.remove(0);
    var codes = Object.keys(MODAL_MESSAGES).sort();
    codes.forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      modalTestSelect.appendChild(opt);
    });
    var wrap = modalTestSelect.closest('.kontrola-select');
    if (wrap && wrap.dataset.customSelectInit === '1' && typeof KontroleInitCustomSelect === 'function') {
      delete wrap.dataset.customSelectInit;
      KontroleInitCustomSelect(wrap.parentElement);
    }
  }

  var btnModalOsvjezi = document.getElementById('btnModalOsvjezi');
  if (btnModalOsvjezi) btnModalOsvjezi.addEventListener('click', puniModalTestSelect);

  var btnModalTest = document.getElementById('btnModalTest');
  if (btnModalTest) {
    btnModalTest.addEventListener('click', function () {
      var code = modalTestSelect ? modalTestSelect.value : '';
      if (code && typeof window.showPorukaModal === 'function') window.showPorukaModal(code, []);
    });
  }

  /* Test Modal Tablica: naslov, tablica 2 kolone (Stupanj 20 %, Naziv), orijentacija L, bez sort ikone, min 3 reda */
  var modalTablicaTestZaglavlje = [
    { title: 'Stupanj', width: -20, align: 'L', sortable_icon: 0 },
    { title: 'Naziv', width: -80, align: 'L', sortable_icon: 0 }
  ];
  var modalTablicaTestRows = [
    ['1', 'Prvi stupanj'],
    ['2', 'Drugi stupanj'],
    ['3', 'Treći stupanj'],
    ['4', 'Četvrti stupanj'],
    ['5', 'Peti stupanj']
  ];
  var modalTablicaApi = null;
  if (typeof ModalTablicaInit === 'function') {
    modalTablicaApi = ModalTablicaInit({
      storageKey: 'alati_teme_modal_tablica',
      headerText: 'Test modala sa tablicom',
      getButtons: function () {
        return [
          { label: 'OK', primary: true, onClick: function () { if (modalTablicaApi) modalTablicaApi.close(); } },
          { label: 'Odustani', onClick: function () { if (modalTablicaApi) modalTablicaApi.close(); } }
        ];
      }
    });
  }
  var btnTestModalTablica = document.getElementById('btnTestModalTablica');
  if (btnTestModalTablica && modalTablicaApi) {
    btnTestModalTablica.addEventListener('click', function () {
      modalTablicaApi.open({
        zaglavlje: modalTablicaTestZaglavlje,
        rows: modalTablicaTestRows
      });
    });
  }

  /* Paleta boja – CORE tokeni iz 0-Common.css (BOJE + SJENE + nijanse); 6 u redu */
  var CORE_PALETA_TOKENI = [
    '--c-white', '--c-black',
    '--c-gray-50', '--c-gray-100', '--c-gray-200', '--c-gray-300', '--c-gray-700', '--c-gray-800', '--c-gray-900',
    '--c-blue-100', '--c-blue-200', '--c-blue-300', '--c-blue-500', '--c-blue-600', '--c-blue-700', '--c-blue-800',
    '--c-yellow-500', '--c-red-500', '--c-green-500',
    '--text',
    '--c-shadow-10', '--c-shadow-30', '--c-shadow-35', '--c-shadow-45', '--c-shadow-60', '--c-text-shadow-75',
    '--c-near-black', '--c-near-black-10', '--c-near-black-25', '--c-near-black-50', '--c-near-black-75',
    '--c-white-15', '--c-white-25', '--c-transparent'
  ];

  function refreshPaleta() {
    var container = document.getElementById('paletaContainer');
    if (!container) return;
    var root = document.documentElement;
    var styles = root && typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
    if (!styles) return;
    container.innerHTML = '';
    CORE_PALETA_TOKENI.forEach(function (token) {
      var value = (styles.getPropertyValue(token) || '').trim();
      var item = document.createElement('div');
      item.className = 'alati-teme__paleta-item';
      var swatch = document.createElement('div');
      swatch.className = 'alati-teme__paleta-swatch';
      swatch.style.background = value || 'transparent';
      var label = document.createElement('span');
      label.className = 'alati-teme__paleta-value';
      label.textContent = token + (value ? ': ' + value : '');
      item.appendChild(swatch);
      item.appendChild(label);
      container.appendChild(item);
    });
  }

  refreshPaleta();
})();
