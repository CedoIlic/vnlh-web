/* Zapisnik_CRUD.js – Zapisnik (mod URL, geo, modal lože; prisustvo: Pretraži + tablica kao Clanovi_Loza_CRUD clanoviLozaInitTraziTablica, tablica po tokenima 0-Common). */
// @ts-nocheck
(function () {
  'use strict';
  /* Prava na tipkama (Upis / Izbriši): Duznosnici_Drzave_Regije_Loze_sve.php?html_fajl=Zapisnik_CRUD.html (geo), ne common_prava_crud — isto kao Clanovi_Loza_CRUD. */

  var API_BASE = '../php/';

  /*
   * --- Blok: Modal „Lože učesnice radova” (ellipsis kod Tip radova). ---
   * ModalTablicaInit (0-Kontrole): drag zaglavlja, resize panela/trake, pozicija+veličina u localStorage
   * (ključ modal_tablica_zapisnik_loze_ucesnice). Podnožje: OK (primarna, disabled dok nema označenih redova)
   * upisuje u #zapisnik_loza_ucesnici cijele retke (naziv, grad, država), odvojeno «; »; textarea je readOnly.
   * Nakon OK: modal se zatvori, zatim u rAF puna zamjena textarea iz snapshota + getSelectedRowIds (ne miješanje sa starim prikazom).
   * Kolekcija id-jeva zapisnikLozeUcesniceKolekcijaId držan je u syncu s OK-om; ponovno otvaranje modala
   * obnavlja oznake redaka prema kolekciji (ne parsira textarea). Odustani zatvara bez izmjena.
   * Podaci: GET php/Zapisnik_CRUD_loze_isti_tip_sve.php?id_loza= (isti id_tip_loze kao odabrana loža).
   * Tablica: jedan stupac — u ćeliji naziv u <strong>, ostatak retka normalan; red [sortTekst, id, naziv, grad, država] —
   * prikaz nakon otvaranja: innerHTML jednostupanjski zamjena ćelije (KontroleTablica inicijalno postavi plain tekst).
   */

  /** Zadnji snimak redova pri otvaranju — bold HTML u ćeliji; OK puni textarea iz row[2–4] (naziv, grad, država). */
  var zapisnikModalLozeUcesniceSnapshot = null;
  /** Id-jevi odabranih loža učesnica (stringovi), redoslijed kao zadnji potvrđeni OK — izvor istine za ponovno otvaranje modala. */
  var zapisnikLozeUcesniceKolekcijaId = [];
  /** Članovi s GET Clanovi_CRUD_sve_loze.php — kao `data` + clanoviLozaPrimijeniTraži u Clanovi_Loza_CRUD (filtar po poljima iz JSON-a, ne po textContent-u ćelije). */
  var zapisnikPrisustvoClanoviIzvorData = [];
  /**
   * Premještaj članovi (lijevo → desna „prisustvo” lista), redoslijed kao korisnik.
   *
   * • id — id člana (`radovi_radovi_*` FK).
   * • fgCss — boja teksta za taj red na prebacivanju (#rrggbb ili prazno = sistemsko), iz opcije Tipa (`data-boja-prikaza`).
   * • tipUnosaId — string vrijednosti #zapisnik_prisustvo_tip_unosa u trenutku prebacivanja (`radovi_prisustvo_tip.id` kao string); za povratak / obnovu znaka koja je opcija pripala retku (starije zapise bez polja i dalje crtamo samo uz fgCss).
   * • prikazTekstZaClana — opcijski snimljeno „Prezime Ime · loža” u trenutku prebacivanja s liste; ako keš članova kasnije nema osobu (nova GET lista…), crtanje koristi ovaj tekst umjesto #id.
   * • slobodanUnos (+ tekstSlobPrikaz, idDrzaveGostiju) — opcija Tipa ima data-slobodan-unos=1: red nije FK na članove; id sintetički `su:N`, tekst Jedan red kao „Ime · loža · država”; id države iz #zapisnik_prisustvo_select_drzava.
   *
   * Reset: modal lože OK bez zadržavanja desnog, nova JSON lista lijevo ako nije `zadrziDesnuListu`, prazan skup loža (bez zadrži), ili pipe-greška od API-ja.
   */
  var zapisnikPrisustvoDesnoListaPoRedu = [];
  /** Jedinstven sufiks za slobodan-unos redove u desnoj listi (`su` + ovaj broj u `entry.id`). */
  var zapisnikPrisustvoSlobUnosSuIdSuffix = 0;
  /** Inicijalizacija modala pri učitavanju (ModalTablicaInit). */
  var modalZapisnikLozeUcesniceApi = null;

  /*
   * ZAGLAVLJE TABLICE (modal, jedan stupac; u ćeliji zarezom odvojeni naziv, grad, država — id u row[1] ne iscrtava se).
   *
   * key — logičko ime za sort po prikazanom tekstu.
   * title — tekst TH: „Podaci”.
   * sortable — 1.
   * sortable_icon — 0.
   * type — 't'.
   * width — 0 (fleks prema tijelu modala).
   * suffix — prazno.
   * align / row_align — L.
   * mobitel_prikaz — 1.
   */
  var ZAGLAVLJE_MODAL_LOZE_UCESNICE = [
    { key: 'podaci', title: 'Podaci', sortable: 1, sortable_icon: 0, type: 't', width: 0, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
  ];

  /**
   * URL do php/ ispod app korijena (npr. /app/html/… → /app/php/…).
   * Dvostruki pathname.replace(…/…$) pogađa krivi php/ kad je struktura drugačija — new URL('./../php/' + f, href) slijedi uobičajeni MPA raspored.
   * @param {string} file — npr. Duznosnici_Drzave_Regije_Loze_sve.php
   * @returns {string}
   */
  function getApiUrl(file) {
    var f = String(file || '').replace(/^\//, '');
    try {
      return new URL('./../php/' + f, window.location.href).href;
    } catch (e) {
      var p = (window.location.pathname || '').replace(/\/[^/]*$/, '').replace(/\/[^/]*$/, '');
      return window.location.origin + p + '/php/' + f;
    }
  }

  function trimZ(s) {
    return s == null ? '' : String(s).replace(/^\s+|\s+$/g, '');
  }

  /* Zaglavlje (#select_drzava … #select_loza) — rana referenca za očitanje ID-a lože od selectedOptions bez „temporalnog” problema. */
  var selectDrzava = document.getElementById('select_drzava');
  var selectRegija = document.getElementById('select_regija');
  var selectLoza = document.getElementById('select_loza');

  /**
   * API odgovori u obliku „kod,tekst” (npr. greška login) — za prikaz MODAL_MESSAGES; vraća null ako nije kod.
   * @param {string} res sirovi response
   * @returns {{ code: string, replacements: string[] }|null}
   */
  function parseResponseCode(res) {
    if (res == null || typeof res !== 'string') return null;
    var s = res.trim();
    if (s === '' || s === 'OK') return null;
    var idx = s.indexOf(',');
    if (idx < 0) return { code: s, replacements: [] };
    return { code: s.slice(0, idx).trim(), replacements: [s.slice(idx + 1).trim()] };
  }

  /**
   * Način rada: 0 = novi zapisnik (gumb uvijek „Upis”, Izbriši skriven); 1 = korekcija postojećeg (gumb „Izmjeni”, Izbriši vidljiv prema brisanje_sloga).
   * URL: ?mod_upisa_zapisnika=0 | 1; izostavak ili nevažeća vrijednost → 0. Izvor istine: window.mod_upisa_zapisnika.
   */
  function zapisnikInicijalizirajModUpisaIzUrla() {
    var v = 0;
    try {
      var sp = new URLSearchParams(window.location.search || '');
      var raw = sp.get('mod_upisa_zapisnika');
      if (raw !== null && raw !== '') v = parseInt(raw, 10) === 1 ? 1 : 0;
    } catch (eM) {}
    window.mod_upisa_zapisnika = v;
  }
  zapisnikInicijalizirajModUpisaIzUrla();

  /** @returns {boolean} true ako je mod korekcije (izmijena postojećeg zapisa). */
  function zapisnikJeModKorekcijePostojeceg() {
    return window.mod_upisa_zapisnika === 1;
  }

  /**
   * Postavi tekst i klasu gumba Upis/Izmjeni te vidljivost Izbriši ovisno o modu.
   * Izbriši u modu 0: uvijek skriven (0-Common: i hidden i display da CSS ne pokaže tipku).
   */
  function zapisnikPrimijeniFooterPremaModuUpisa() {
    var bUpis = document.getElementById('btnUpisi');
    var lab = bUpis ? bUpis.querySelector('.kontrola-btn__label') : null;
    if (bUpis && lab) {
      if (zapisnikJeModKorekcijePostojeceg()) {
        bUpis.classList.add('kontrola-btn--crud-izmjeni');
        lab.textContent = 'Izmjeni';
        bUpis.setAttribute('aria-label', 'Izmjeni');
      } else {
        bUpis.classList.remove('kontrola-btn--crud-izmjeni');
        lab.textContent = 'Upis';
        bUpis.setAttribute('aria-label', 'Upis');
      }
    }
    var bBr = document.getElementById('btnIzbrisi');
    if (!bBr) return;
    if (!zapisnikJeModKorekcijePostojeceg()) {
      bBr.hidden = true;
      bBr.style.display = 'none';
    }
  }

  /**
   * Nakon vnlhPrimijeniPravaCrud: u modu 0 prava ne smiju otkriti Izbriši (brisanje_sloga=1 u novom upisu nema smisla).
   */
  function zapisnikNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis() {
    if (zapisnikJeModKorekcijePostojeceg()) return;
    var bBr = document.getElementById('btnIzbrisi');
    if (bBr) {
      bBr.hidden = true;
      bBr.style.display = 'none';
    }
  }

  /** Puni URL za Stupnjevi_CRUD_sve.php s id_loza (baza: loze → id_obred + id_tip_loze; stupnjevi ograničeni enumom tipa ako je id_tip_loze postavljen) – ne spaja query u getApiPath kao jedan string. */
  function zapisnikStupnjeviUrlZaIdLozu(idLoza) {
    var idS = idLoza != null ? String(idLoza).replace(/^\s+|\s+$/g, '') : '';
    if (!idS) return '';
    try {
      var u = new URL('../php/Stupnjevi_CRUD_sve.php', window.location.href);
      u.searchParams.set('id_loza', idS);
      return u.href;
    } catch (e) {
      return getApiUrl('Stupnjevi_CRUD_sve.php') + '?id_loza=' + encodeURIComponent(idS);
    }
  }

  /**
   * Čita id lože s &lt;select&gt;: sve selectedOptions pa .value pa options[selectedIndex].
   * Usklađeno s custom select (0-Kontrole) kad .value zakasni do sljedećeg mikrotaska.
   */
  function zapisnikVrijednostSelektaZaLoz(sel) {
    if (!sel || sel.tagName !== 'SELECT') return '';
    var vx;
    try {
      var sos = sel.selectedOptions;
      var i;
      if (sos && sos.length) {
        for (i = 0; i < sos.length; i++) {
          vx = trimZ(sos[i].value);
          if (vx) return vx;
        }
      }
    } catch (eSo) {}
    vx = trimZ(sel.value);
    if (vx) return vx;
    var si = sel.selectedIndex;
    if (si >= 0 && sel.options && sel.options[si]) {
      vx = trimZ(sel.options[si].value);
      if (vx) return vx;
    }
    return '';
  }

  function zapisnikDohvatIdOdabraneLozIzSelectEl() {
    return selectLoza ? zapisnikVrijednostSelektaZaLoz(selectLoza) : '';
  }

  function zapisnikIdOdabraneLozISelecta() {
    return zapisnikDohvatIdOdabraneLozIzSelectEl();
  }

  /** Gumb PDF u zaglavlju (kasnije: generiranje dokumenta). */
  var btnPdfZapisnik = document.getElementById('zapisnik_btn_pdf');
  /** Gumb odabira postojećeg zapisnika (#zapisnik_btn_odabir_postojeceg, lijevo od PDF-a) — koristi zapisnikPostaviKontroleOvisnoLozi. */
  var btnOdabirPostojecegZapisnik = document.getElementById('zapisnik_btn_odabir_postojeceg');
  /** Ellipsis kod Tip radova → modal lože učesnice (isti element kao disabled u zapisnikPostaviKontroleOvisnoLozi). */
  var bTipEllipsis = document.getElementById('zapisnik_btn_tip_ellipsis');

  /* Geo keš: window.vnlhGeo* u 0-Filteri_Po_Ogranicenjima.js. Kaskada: Država → Regija → Loža, bez tablice. */

  /**
   * Labele u zaglavlju (for= Država / Regija / Loža) – klasa .kontrola-labela--disabled (0-Kontrole.css) u skladu s disabled na <select>.
   */
  function zapisnikSyncGeoLabels() {
    var parovi = [
      { el: selectDrzava, forId: 'select_drzava' },
      { el: selectRegija, forId: 'select_regija' },
      { el: selectLoza, forId: 'select_loza' }
    ];
    var k;
    for (k = 0; k < parovi.length; k++) {
      var p = parovi[k];
      if (!p.el) continue;
      var lab = document.querySelector('label[for="' + p.forId + '"]');
      if (!lab) continue;
      if (p.el.disabled) lab.classList.add('kontrola-labela--disabled');
      else lab.classList.remove('kontrola-labela--disabled');
    }
  }

  /**
   * Upis (#btnUpisi) i PDF (#zapisnik_btn_pdf): sve odjednom — odabrana loža, datum radova popunjen, stupanj i tip (bez praznog
   * placeholdera), te barem jedan id u zapisnikLozeUcesniceKolekcijaId (modal OK). Inače disabled.
   */
  function zapisnikMozePrihvatUpisPdf() {
    if (!zapisnikIdOdabraneLozISelecta()) return false;
    var inpD = document.getElementById('zapisnik_datum_radova');
    if (!inpD || trimZ(inpD.value) === '') return false;
    var selS = document.getElementById('zapisnik_select_stupanj_radova');
    if (!selS || trimZ(selS.value) === '') return false;
    var selT = document.getElementById('zapisnik_select_tip_radova');
    if (!selT || trimZ(selT.value) === '') return false;
    var k = zapisnikLozeUcesniceKolekcijaId;
    return Array.isArray(k) && k.length > 0;
  }

  /**
   * Postavi samo disabled na Upisu i PDF-u (bez punog KontroleRefresh na selectima — za input datuma i brze promjene).
   */
  function zapisnikPrimijeniUvjeteUpisPdfGumba() {
    var moze = zapisnikMozePrihvatUpisPdf();
    var bUpis = document.getElementById('btnUpisi');
    var bPdf = document.getElementById('zapisnik_btn_pdf');
    if (bUpis && !bUpis.hidden) bUpis.disabled = !moze;
    if (bPdf) bPdf.disabled = !moze;
  }

  /**
   * Dok nije odabrana loža: tab (kartice), polja u prvom tabu, Upis / Izbriši su disabled. Povratak ostaje aktivan.
   * Prava zastavice: vnlhPrimijeniPravaCrud i dalje upravlja vidljivošću (hidden); ovdje samo disabled za vidljive gumbe.
   * Upis i PDF: vidi zapisnikMozePrihvatUpisPdf / zapisnikPrimijeniUvjeteUpisPdfGumba. Ikona „postojeći zapisnik”: disabled dok nema lože. Kartica Prisustvo: sve kontrole u #zapisnikKontrolaTabPanel1 (uključ. tablice) kad nema lože. Izbriši: disabled kad nema lože, samo u modu korekcije vidljiv (mod_upisa_zapisnika=1) i uz brisanje_sloga.
   * Min. visina vanjskog panela s trakom: data-resize-min-px postavlja zapisnikScheduleMinVisinuResiza (sadržaj + 12px u tabu).
   * @param {string} [idLozaZaFormu] — ako zadan (npr. iz change na #select_loza), ima ložu se računa iz toga bez oslanjanja na .value koji u custom selectu u istome event tick-u još može nedostati.
   */
  function zapisnikPostaviKontroleOvisnoLozi(idLozaZaFormu) {
    var imaLozu =
      typeof idLozaZaFormu !== 'undefined'
        ? trimZ(idLozaZaFormu !== null ? String(idLozaZaFormu) : '') !== ''
        : !!zapisnikIdOdabraneLozISelecta();
    var tabRoot = document.getElementById('zapisnikKontrolaTab');
    if (tabRoot) {
      /* Vizual: Zapisnik_CRUD.css .zapisnik-crud__tab--onemogucen (sjene, boje labela, ugniježdeni panel). */
      tabRoot.classList.toggle('zapisnik-crud__tab--onemogucen', !imaLozu);
      var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
      var a;
      for (a = 0; a < kartice.length; a++) {
        var karta = kartice[a];
        /* Za <button>: removeAttribute pouzdaniji od disabled=false u nekim okruženjima kod ponovnog uključivanja. */
        if (!imaLozu) {
          karta.disabled = true;
        } else {
          karta.removeAttribute('disabled');
        }
      }
    }
    var inpD = document.getElementById('zapisnik_datum_radova');
    if (inpD) inpD.disabled = !imaLozu;
    var selS = document.getElementById('zapisnik_select_stupanj_radova');
    if (selS) {
      selS.disabled = !imaLozu;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_stupanj_radova');
    }
    var selT = document.getElementById('zapisnik_select_tip_radova');
    if (selT) {
      selT.disabled = !imaLozu;
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_tip_radova');
    }
    var taLoza = document.getElementById('zapisnik_loza_ucesnici');
    if (taLoza) {
      /* Bez odabrane lože: potpuno blokirano. S ložom: vrijednost samo iz modala (readonly), ne ručni unos. */
      if (!imaLozu) {
        taLoza.disabled = true;
        taLoza.readOnly = false;
      } else {
        taLoza.disabled = false;
        taLoza.readOnly = true;
      }
    }
    if (bTipEllipsis) bTipEllipsis.disabled = !imaLozu;
    /* Ikona liste + play u zaglavlju (#zapisnik_btn_odabir_postojeceg): smisao tek uz kontekst lože. */
    if (btnOdabirPostojecegZapisnik) btnOdabirPostojecegZapisnik.disabled = !imaLozu;
    /* Ovjera zapisnika: čekboxi u drugom ugniježdenom panelu. */
    var ovrCbIds = [
      'zapisnik_cb_ovjera_prije_casni_majstor',
      'zapisnik_cb_ovjera_prije_odg_inspektor',
      'zapisnik_cb_ovjera_nakon_casni_majstor',
      'zapisnik_cb_ovjera_nakon_tajnik',
      'zapisnik_cb_ovjera_nakon_govornik'
    ];
    for (var oi = 0; oi < ovrCbIds.length; oi++) {
      var cb = document.getElementById(ovrCbIds[oi]);
      if (cb) cb.disabled = !imaLozu;
    }
    /* Kartica Prisustvo: selekt / edita / razmjena / dvije jednostupčane tablice.
     * #zapisnik_prisustvo_tip_unosa se ne dira ovdje — disabled + label sinkron s brojem redaka u lijevom tbodyu (zapisnikPrisustvoPrimijeliRasporedLijevoIStanje). */
    var pk;
    var prisNodes = document.querySelectorAll('#zapisnikKontrolaTabPanel1 .zapisnik-crud__prisustvo-kontrola');
    for (pk = 0; pk < prisNodes.length; pk++) {
      var elPri = prisNodes[pk];
      if (!elPri) continue;
      if (elPri.id === 'zapisnik_prisustvo_tip_unosa') continue;
      if ('disabled' in elPri) elPri.disabled = !imaLozu;
    }
    if (typeof KontroleRefreshCustomSelect === 'function') {
      try {
        KontroleRefreshCustomSelect('zapisnik_prisustvo_tip_unosa');
        KontroleRefreshCustomSelect('zapisnik_prisustvo_select_drzava');
      } catch (ePr) {}
    }
    zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(imaLozu, false);

    zapisnikPrimijeniUvjeteUpisPdfGumba();
    var bBr = document.getElementById('btnIzbrisi');
    if (bBr && !bBr.hidden) bBr.disabled = !imaLozu;
  }

  /**
   * Sinkron oznaka labela geo + enable taba/forme; idLozaZaFormu prosljeđuje ako je poznato (nakon odabira u custom selectu).
   * @param {string} [idLozaZaFormu]
   */
  function zapisnikOsvjeziLoziGrupeIFormu(idLozaZaFormu) {
    zapisnikSyncGeoLabels();
    zapisnikPostaviKontroleOvisnoLozi(idLozaZaFormu);
    zapisnikScheduleMinVisinuResiza();
  }

  /* --- Minimalna visina #zapisnikPanel za traku (0-Kontrole: data-resize-min-px, getLimits) --- */

  var _zapisnikMinHVisRaf = null;
  var _zapisnikMinHResizeT = null;
  /** Jednokratno: postavi inline visinu=proračun (kao i min); ne dirati nakon toga (korisnik trakom). */
  var _zapisnikPocetnaVisinaPostavljena = false;

  /** Dodatni razmak na izračunatoj min. visini (15 + 12 + 6 px: traka, zaobljenja, subpixel, UI) – uz zbroj ostatka. */
  var ZAPISNIK_MIN_VIS_DODATNO_PX = 33;

  /**
   * Mjeri min. visinu vanjskog panela: zaglavlje (Država/…) + traka taba (kartice) + sadržaj prvog taba
   * (#zapisnikKontrolaTabPanel0: oba ugniježdena panela + padding-bottom 12px u .kontrola-tab__panel) + traka resiza
   * u tijelu + podnožje + ZAPISNIK_MIN_VIS_DODATNO_PX (15+12+6). Tijelo taba mora uvijek imati mjesta za oba unutarnja panela i 12px ispod donjeg – ne ovisi
   * o ostalim tabovima (kratki zaslonski odlomci). Panel se privremeno izmjeri izvan flex-lanca (body, fixed, isti
   * sadržajni prsten kao u .kontrola-tab__tijelo) da flex rastezanje ne iskrivi očitanje.
   * @returns {number} Pixels, zaokruženo gore, ili 0 ako nema elemenata.
   */
  function zapisnikIzracunajMinVisinuVanjskogPanelaPx() {
    var z = document.getElementById('zapisnikPanel');
    var tabR = document.getElementById('zapisnikKontrolaTab');
    if (!z || !tabR) return 0;
    var tij = tabR.querySelector('.kontrola-tab__tijelo');
    if (!tij) return 0;
    var p0 = document.getElementById('zapisnikKontrolaTabPanel0');
    if (!p0) return 0;

    var karts = tabR.querySelectorAll('.kontrola-tab__kartica');
    var a;
    var activeIdx = 0;
    for (a = 0; a < karts.length; a++) {
      if (karts[a].classList.contains('kontrola-tab__kartica--aktivna')) {
        activeIdx = a;
        break;
      }
    }

    var csT = getComputedStyle(tij);
    var pl = parseFloat(csT.paddingLeft) || 0;
    var pr = parseFloat(csT.paddingRight) || 0;
    var pt = parseFloat(csT.paddingTop) || 0;
    var pb = parseFloat(csT.paddingBottom) || 0;
    var contentW = Math.max(0, Math.round(tij.getBoundingClientRect().width) - pl - pr);
    if (contentW < 120) {
      contentW = Math.max(120, Math.round((tij.parentElement && tij.parentElement.getBoundingClientRect().width) || window.innerWidth || 320) - 32);
    }

    var parent = p0.parentNode;
    var nxt = p0.nextSibling;
    if (!parent) return 0;
    parent.removeChild(p0);
    p0.removeAttribute('hidden');
    p0.setAttribute('style', 'box-sizing:border-box;visibility:hidden;position:fixed;left:-40000px;top:0;width:' + contentW + 'px;');
    document.body.appendChild(p0);
    var hPanel0 = p0.offsetHeight;
    document.body.removeChild(p0);
    p0.removeAttribute('style');
    if (nxt) parent.insertBefore(p0, nxt);
    else parent.appendChild(p0);
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabR, activeIdx);

    if (!(hPanel0 > 0) || !isFinite(hPanel0)) return 0;
    var maxP = hPanel0;

    var trk = tabR.querySelector('.kontrola-tab__traka');
    var hTraka = trk ? trk.offsetHeight : 0;
    var hTij = pt + maxP + pb;
    var bar = z.querySelector('.kontrola-panel__resize-bar');
    var hBar = bar && bar.offsetHeight > 0 ? bar.offsetHeight : 28;
    var head = z.querySelector('.zapisnik-crud__panel-header');
    var foot = z.querySelector('.kontrola-panel__footer');
    var hHead = head ? head.offsetHeight : 0;
    var hFooter = foot ? foot.offsetHeight : 0;
    var total = hHead + hTraka + hTij + hBar + hFooter + ZAPISNIK_MIN_VIS_DODATNO_PX;
    if (!(total > 0) || !isFinite(total)) return 0;
    return Math.ceil(total);
  }

  /**
   * Postavi #zapisnikPanel na zadanu visinu (px) – ista shema kao applyPanelResizeHeight u 0-Kontrole.js (stubac flex).
   * @param {HTMLElement} el
   * @param {number} hPx
   */
  function zapisnikPostaviPocetnuVisinuPanela(el, hPx) {
    if (!el || !(hPx > 0) || !isFinite(hPx)) return;
    el.style.height = Math.round(hPx) + 'px';
    var pr = el.parentElement;
    if (pr && pr.nodeType === 1 && typeof getComputedStyle !== 'undefined') {
      var pds = getComputedStyle(pr);
      if (pds && pds.display === 'flex' && (pds.flexDirection === 'column' || pds.flexDirection === 'column-reverse')) {
        el.style.flex = '0 0 ' + Math.round(hPx) + 'px';
      } else {
        el.style.flex = '';
      }
    } else {
      el.style.flex = '';
    }
  }

  /**
   * Ažurira data-resize-min-px na #zapisnikPanel; pri prvom uspješnom proračunu postavlja i inicijalnu visinu (isto kao min).
   * Donja granična vrijednost 280 px; korisnički resize trakom poslije ne prepisujemo.
   */
  function zapisnikPrimijeniMinVisinuResiza() {
    var el = document.getElementById('zapisnikPanel');
    if (!el) return;
    var px = zapisnikIzracunajMinVisinuVanjskogPanelaPx();
    if (px < 1) return;
    var hPx = Math.max(280, px);
    el.setAttribute('data-resize-min-px', String(hPx));
    if (!_zapisnikPocetnaVisinaPostavljena) {
      zapisnikPostaviPocetnuVisinuPanela(el, hPx);
      _zapisnikPocetnaVisinaPostavljena = true;
    }
  }

  function zapisnikScheduleMinVisinuResiza() {
    if (_zapisnikMinHVisRaf) cancelAnimationFrame(_zapisnikMinHVisRaf);
    _zapisnikMinHVisRaf = requestAnimationFrame(function () {
      _zapisnikMinHVisRaf = null;
      zapisnikPrimijeniMinVisinuResiza();
    });
  }

  /** Postavi/makni CSS klasu kontrola-select--auto-locked na wrapperu oko <select> (jedna dozvoljena opcija). */
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
    for (var i = 0; i < (arr || []).length; i++) {
      var opt = document.createElement('option');
      opt.value = arr[i].id != null ? String(arr[i].id) : '';
      opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
      sel.appendChild(opt);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) KontroleRefreshCustomSelect(kontrolaId);
  }

  function popuniRegijeIzKeša(idDrzava, callback) {
    setAutoLockedClass(selectRegija, false);
    if (!selectRegija) {
      zapisnikOsvjeziLoziGrupeIFormu();
      if (callback) callback();
      return;
    }
    if (!idDrzava) {
      popuniSelectIzKeša(selectRegija, [], '— Odaberi regiju —', 'select_regija');
      selectRegija.disabled = true;
      popuniLozeIzKeša('', function () {});
      if (callback) callback();
      return;
    }
    var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano =
      typeof window.vnlhGeoFiltrirajRegijePoDrzavi === 'function' ? window.vnlhGeoFiltrirajRegijePoDrzavi(g.regije, idDrzava) : [];
    popuniSelectIzKeša(selectRegija, filtrirano, '— Odaberi regiju —', 'select_regija');

    if (filtrirano.length === 1) {
      selectRegija.value = String(filtrirano[0].id);
      selectRegija.disabled = true;
      setAutoLockedClass(selectRegija, true);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_regija');
      popuniLozeIzKeša(selectRegija.value, callback);
    } else {
      selectRegija.disabled = filtrirano.length === 0;
      popuniLozeIzKeša('', function () {});
      if (callback) callback();
    }
  }

  function popuniLozeIzKeša(idRegija, callback) {
    setAutoLockedClass(selectLoza, false);
    function finishLoza(idZaFormu) {
      zapisnikOsvjeziLoziGrupeIFormu(idZaFormu);
      zapisnikSyncHeaderLogoSize();
      if (typeof callback === 'function') callback();
    }
    if (!selectLoza) {
      finishLoza();
      return;
    }
    if (!idRegija) {
      popuniSelectIzKeša(selectLoza, [], '— Odaberi ložu —', 'select_loza');
      selectLoza.disabled = true;
      zapisnikUpdateHeaderLogo('');
      puniSelectStupanjRadovaZapisnik();
      finishLoza();
      return;
    }
    var g2 = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
    var filtrirano =
      typeof window.vnlhGeoFiltrirajLozePoRegiji === 'function' ? window.vnlhGeoFiltrirajLozePoRegiji(g2.loze, idRegija) : [];
    popuniSelectIzKeša(selectLoza, filtrirano, '— Odaberi ložu —', 'select_loza');

    if (filtrirano.length === 1) {
      selectLoza.value = String(filtrirano[0].id);
      selectLoza.disabled = true;
      setAutoLockedClass(selectLoza, true);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_loza');
      var jedinaLozaId = String(filtrirano[0].id);
      zapisnikUpdateHeaderLogo(jedinaLozaId);
      puniSelectStupanjRadovaZapisnik();
      finishLoza(jedinaLozaId);
    } else {
      selectLoza.disabled = filtrirano.length === 0;
      zapisnikUpdateHeaderLogo('');
      puniSelectStupanjRadovaZapisnik();
      finishLoza();
    }
  }

  /**
   * Jedan GET Duznosnici_Drzave_Regije_Loze_sve (html_fajl=Zapisnik_CRUD.html); puni Država i kaskadu.
   * Poziva se rano u onReady prije ostalih paralelnih puniSelect* (prioritet mrežnog učitavanja zaglavlja).
   * upis_izmjena / brisanje_sloga primjenjuju se na vnlhPrimijeniPravaCrud.
   */
  function ucitajPravaGeo(callback) {
    if (typeof window.vnlhGeoOgranicenjaUcitaj !== 'function') {
      zapisnikOsvjeziLoziGrupeIFormu();
      if (callback) callback();
      zapisnikNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis();
      return;
    }
    var url =
      typeof window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze === 'function'
        ? window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(getApiUrl, 'Zapisnik_CRUD.html')
        : getApiUrl('Duznosnici_Drzave_Regije_Loze_sve.php') +
            '?html_fajl=' +
            encodeURIComponent('Zapisnik_CRUD.html');
    window.vnlhGeoOgranicenjaUcitaj(url, function () {
      var g = typeof window.vnlhGeoOgranicenjaDohvatiKeš === 'function' ? window.vnlhGeoOgranicenjaDohvatiKeš() : {};
      var drz = g.drzave || [];

      popuniSelectIzKeša(selectDrzava, drz, '— Odaberi državu —', 'select_drzava');

      var ui = g.upis_izmjena != null ? parseInt(g.upis_izmjena, 10) : 0;
      var bs = g.brisanje_sloga != null ? parseInt(g.brisanje_sloga, 10) : 0;
      if (typeof vnlhPrimijeniPravaCrud === 'function') vnlhPrimijeniPravaCrud(ui, bs);
      zapisnikNakonPravaPrimijeniModSkriviIzbrisiAkoNovUpis();
      /* Nakon što prava mijenjaju hidden na Upisu, disabled mora odgovarati zapisnikMozePrihvatUpisPdf. */
      zapisnikPrimijeniUvjeteUpisPdfGumba();

      if (drz.length === 1 && selectDrzava) {
        selectDrzava.value = String(drz[0].id);
        selectDrzava.disabled = true;
        setAutoLockedClass(selectDrzava, true);
        if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('select_drzava');
        popuniRegijeIzKeša(selectDrzava.value, callback);
      } else {
        setAutoLockedClass(selectDrzava, false);
        if (selectDrzava) selectDrzava.disabled = false;
        popuniRegijeIzKeša('', function () {});
        if (callback) callback();
      }
    });
  }

  /**
   * Logo u zaglavlju: Loze_CRUD_slika.php (kao clanoviLozaUpdateTablicaHeaderLogo u Clanovi_Loza_CRUD).
   * Zajednički id #clanovi_loza_tablica_logo radi iste CSS klase okvira.
   * @param {string} [idLozaForced] — ako zadan (npr. vrijednost u change za #select_loza), koristi se umjesto očitanja iz selecta u istom event ticku.
   */
  function zapisnikUpdateHeaderLogo(idLozaForced) {
    var img = document.getElementById('clanovi_loza_tablica_logo');
    var frame = img && img.closest ? img.closest('.clanovi-loza-crud__tablica-header-logo-frame') : null;
    if (!img || !frame) return;
    var idLoza =
      typeof idLozaForced !== 'undefined'
        ? trimZ(idLozaForced !== null ? String(idLozaForced) : '')
        : zapisnikDohvatIdOdabraneLozIzSelectEl();
    var placeholderSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.onload = null;
    img.onerror = null;
    if (!idLoza) {
      img.hidden = true;
      img.src = placeholderSrc;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      return;
    }
    frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    img.hidden = true;
    img.onload = function () {
      if (img.naturalWidth > 0) {
        img.hidden = false;
        frame.classList.remove('clanovi-loza-crud__tablica-header-logo-frame--prazno');
        /* Nakon dekodiranja slike prilagodi kvadrat u zaglavlju (isti obrazac kao RO na kontrolama u Clanovi_Loza). */
        requestAnimationFrame(function () {
          zapisnikSyncHeaderLogoSize();
        });
      } else {
        img.hidden = true;
        frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
      }
    };
    img.onerror = function () {
      img.hidden = true;
      img.src = placeholderSrc;
      frame.classList.add('clanovi-loza-crud__tablica-header-logo-frame--prazno');
    };
    img.src = getApiUrl('Loze_CRUD_slika.php') + '?id=' + encodeURIComponent(idLoza) + '&t=' + String(Date.now());
  }

  var _zapisnikLogoSyncRaf = null;

  /**
   * Veličina kvadrata loga u zaglavlju — isto kao clanoviLozaSyncTablicaHeaderLogoSize (Clanovi_Loza_CRUD.js).
   * Postavlja --clanovi-loza-logo-side na .clanovi-loza-crud__tablica-header; bez dodatnog proračuna min. visine
   * panela (to mijenja mjerenje kvadrata i „razvuče” ili suzi logo kao u Zapisniku ranije).
   */
  function zapisnikSyncHeaderLogoSize() {
    if (_zapisnikLogoSyncRaf) cancelAnimationFrame(_zapisnikLogoSyncRaf);
    _zapisnikLogoSyncRaf = requestAnimationFrame(function () {
      _zapisnikLogoSyncRaf = null;
      var header = document.querySelector('.clanovi-loza-crud__tablica-header');
      var kontrole = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      var wrap = document.querySelector('.clanovi-loza-crud__tablica-header-logo-wrap');
      if (!header || !kontrole || !wrap) return;
      var csW = getComputedStyle(wrap);
      if (csW.display === 'none') {
        header.style.removeProperty('--clanovi-loza-logo-side');
        return;
      }
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

  /**
   * Puni #zapisnik_select_stupanj_radova: Stupnjevi_CRUD_sve.php?id_loza= (vrijednost #select_loza).
   * Na serveru: loze → id_obred i id_tip_loze; ako je tip postavljen, samo stupnjevi iz loze_tip_stupanj_enum (nadležnost, pozicija 1).
   */
  function puniSelectStupanjRadovaZapisnik() {
    setTimeout(puniSelectStupanjRadovaZapisnikOdmah, 0);
  }

  function puniSelectStupanjRadovaZapisnikOdmah() {
    var sel = document.getElementById('zapisnik_select_stupanj_radova');
    if (!sel) return;

    function resetSamoPrazanSelect() {
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi stupanj —';
      sel.appendChild(opt0);
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_stupanj_radova');
    }

    var idLozaZaZahtjev = zapisnikIdOdabraneLozISelecta();
    if (!idLozaZaZahtjev) {
      resetSamoPrazanSelect();
      zapisnikScheduleMinVisinuResiza();
      return;
    }

    var stupUrl = zapisnikStupnjeviUrlZaIdLozu(idLozaZaZahtjev);
    if (!stupUrl) {
      resetSamoPrazanSelect();
      zapisnikScheduleMinVisinuResiza();
      return;
    }

    var xhrS = new XMLHttpRequest();
    xhrS.open('GET', stupUrl, true);
    xhrS.onreadystatechange = function () {
      if (xhrS.readyState !== 4) return;
      if (zapisnikIdOdabraneLozISelecta() !== idLozaZaZahtjev) {
        return;
      }
      if (xhrS.status < 200 || xhrS.status >= 300) {
        return;
      }
      var textS = (xhrS.responseText || '').replace(/^\uFEFF/, '').trim();
      if (textS === '105' || textS.indexOf('200,') === 0) {
        resetSamoPrazanSelect();
        zapisnikScheduleMinVisinuResiza();
        return;
      }
      var arrSt = [];
      if (textS !== '') {
        if (textS.charAt(0) === '[') {
          try {
            arrSt = JSON.parse(textS);
          } catch (eS) {}
        } else {
          try {
            var parsed = JSON.parse(textS);
            if (Array.isArray(parsed)) {
              arrSt = parsed;
            }
          } catch (e2) {}
        }
      }
      if (!Array.isArray(arrSt)) {
        arrSt = [];
      }
      var niz = arrSt && arrSt.length ? arrSt : [];
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0b = document.createElement('option');
      opt0b.value = '';
      opt0b.textContent = '— Odaberi stupanj —';
      sel.appendChild(opt0b);
      var j;
      for (j = 0; j < niz.length; j++) {
        var o = niz[j];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = (o.stupanj != null ? String(o.stupanj) + '\u00B0, ' : '') + (o.naziv != null ? o.naziv : '');
        if (o.stupanj != null) opt.dataset.stupanj = String(o.stupanj);
        sel.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_stupanj_radova');
      zapisnikScheduleMinVisinuResiza();
    };
    xhrS.send();
  }

  /**
   * Puni #zapisnik_select_tip_radova iz Radovi_Tip_CRUD_sve.php (jednom pri učitavanju stranice; nije vezano za ložu).
   */
  function puniSelectTipRadovaZapisnik() {
    var sel = document.getElementById('zapisnik_select_tip_radova');
    if (!sel) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Radovi_Tip_CRUD_sve.php'), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || xhr.status < 200 || xhr.status >= 300) return;
      var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
      var arr = [];
      try { arr = JSON.parse(text); } catch (e) {}
      if (!Array.isArray(arr)) arr = [];
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Odaberi tip —';
      sel.appendChild(opt0);
      for (var i = 0; i < arr.length; i++) {
        var opt = document.createElement('option');
        opt.value = arr[i].id != null ? String(arr[i].id) : '';
        opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
        sel.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_tip_radova');
      zapisnikScheduleMinVisinuResiza();
    };
    xhr.send();
  }

  /**
   * Puni <select id="cfg.selectId"> iz GET cfg.svePhp. Opcijsko: cfg.dodatakNaOpciji(row, option), cfg.nakonPuno() nakon KontroleRefresh + raspored Prisustva.
   */
  function puniSelectIdNazivPrisustvaZapisnik(cfg) {
    var sel = document.getElementById(cfg.selectId);
    if (!sel) return;
    var svePhp = cfg.svePhp;
    var praznaTekst = cfg.praznaTekst || '— Odaberi —';
    var dodatakOpciji = cfg && typeof cfg.dodatakNaOpciji === 'function' ? cfg.dodatakNaOpciji : null;
    var nakonPuno = cfg && typeof cfg.nakonPuno === 'function' ? cfg.nakonPuno : null;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl(svePhp), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || xhr.status < 200 || xhr.status >= 300) return;
      var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
      var arr = [];
      try {
        arr = JSON.parse(text);
      } catch (eP) {}
      if (!Array.isArray(arr)) arr = [];
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = praznaTekst;
      sel.appendChild(opt0);
      for (var i = 0; i < arr.length; i++) {
        var opt = document.createElement('option');
        opt.value = arr[i].id != null ? String(arr[i].id) : '';
        opt.textContent = arr[i].naziv != null ? arr[i].naziv : '';
        if (dodatakOpciji) dodatakOpciji(arr[i], opt);
        sel.appendChild(opt);
      }
      if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect(cfg.selectId);
      zapisnikScheduleMinVisinuResiza();
      zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), true);
      if (nakonPuno) nakonPuno();
    };
    xhr.send();
  }

  /** #zapisnik_prisustvo_select_drzava — tablica radovi_drzave_gostiju (redosljed na serveru). */
  function puniSelectDrzavaPrisustvaZapisnik() {
    puniSelectIdNazivPrisustvaZapisnik({
      selectId: 'zapisnik_prisustvo_select_drzava',
      svePhp: 'Radovi_Drzave_Gostiju_CRUD_sve.php',
      praznaTekst: '— Odaberi državu —'
    });
  }

  /**
   * Tip prisustva: na option data-slobodan-unos (slobodan unos) i data-svi-clanovi-obedijncije (ispunjava se cijela obedijencija iz baze).
   */
  function puniSelectTipUnosaPrisustvaZapisnik() {
    puniSelectIdNazivPrisustvaZapisnik({
      selectId: 'zapisnik_prisustvo_tip_unosa',
      svePhp: 'Radovi_TipUnosaPrisutnih_CRUD_sve.php',
      praznaTekst: '— Odaberi tip —',
      dodatakNaOpciji: function (row, optH) {
        var su = row && row.slobodan_unos;
        var jedan = su === 1 || su === true || su === '1';
        optH.setAttribute('data-slobodan-unos', jedan ? '1' : '0');
        var svc = row && row.svi_clanovi_obedijncije;
        var sviOb = svc === 1 || svc === true || svc === '1';
        optH.setAttribute('data-svi-clanovi-obedijncije', sviOb ? '1' : '0');
        /* Boja teksta članova u desnoj tablici nakon prebacivanja iz lijeve (radovi_prisustvo_tip.boja_prikaza). */
        var bp =
          row && row.boja_prikaza !== undefined && row.boja_prikaza !== null ? String(row.boja_prikaza).trim() : '';
        if (bp) optH.setAttribute('data-boja-prikaza', bp);
        else optH.removeAttribute('data-boja-prikaza');
      },
      nakonPuno: function () {
        zapisnikPrisustvoOsvjeziIzvornuListuClanova();
      }
    });
  }

  /**
   * U desnoj je označen red dodan iz članske liste (ne slobodni unos su:N). Na #zapisnik_prisustvo_tip_unosa provjera snimljenog tipUnosaId opcije: data-slobodan-unos≠1.
   * Kad je u formi međutim odabran Tip s slobodnim unosom (inače skrivene tablice lijevo), treba privremeno pokazati „Pretraži+tablica” da korisnik može ulijevo vratiti osobu.
   * @returns {boolean}
   */
  function zapisnikPrisustvoJeDesniRedOznačenNeslobZaPovratTablice() {
    var tabD = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (!tabD) return false;
    var tr = tabD.querySelector('tbody tr.tablica-row-selected');
    if (!tr || tr.hidden) return false;
    var ix = parseInt(String(tr.dataset.rowIndex != null ? tr.dataset.rowIndex : ''), 10);
    var entry = null;
    if (!isNaN(ix) && zapisnikPrisustvoDesnoListaPoRedu[ix]) entry = zapisnikPrisustvoDesnoListaPoRedu[ix];
    if (!entry) {
      var rid = tr.dataset.rowId != null ? trimZ(String(tr.dataset.rowId)) : '';
      if (rid !== '') {
        var pi;
        for (pi = 0; pi < zapisnikPrisustvoDesnoListaPoRedu.length; pi++) {
          var en = zapisnikPrisustvoDesnoListaPoRedu[pi];
          if (en && String(en.id) === rid) {
            entry = en;
            break;
          }
        }
      }
    }
    if (!entry || entry.slobodanUnos) return false;
    var tipId = entry.tipUnosaId != null ? trimZ(String(entry.tipUnosaId)) : '';
    if (tipId === '') return false;
    var selTip = document.getElementById('zapisnik_prisustvo_tip_unosa');
    if (!selTip || !selTip.options) return true;
    var oi;
    for (oi = 0; oi < selTip.options.length; oi++) {
      var op = selTip.options[oi];
      if (trimZ(op.value) === tipId) {
        return op.getAttribute('data-slobodan-unos') !== '1';
      }
    }
    return true;
  }

  /**
   * Lijevo prisustvo: #zapisnik_prisustvo_lijevi_stupac klase --sam-edit | --sam-izvor ovisno o Tip unosa (`data-slobodan-unos`).
   * Iznimka: u desnoj tablici odabran je red člana (tip na retku bez slobodan_unos) dok je na selectu odabran Tip s slobodnim unosom → privremeno sam-izvor (Pretraži + lijeva tablica) radi povrata ulijevo.
   * Obje liste (lijevo i desno): aktivne ako je odabran Tip; uz to treba ili odabrana loža (klasično punjenje) ili opcija Tipa s
   *               data-svi-clanovi-obedijncije=1 (punjenje bez modala Lože učesnice).
   * Lijevo→desno / desno→lijevo: samo kad je izvorna lista u režimu (nije slobodan unos s tri polja).
   * Tip unosa (#zapisnik_prisustvo_tip_unosa) + labela: disabled kad je lijevi tbody bez <tr>; iznimka ako je aktivna opcija Tipa s „slobodan unos” (lista lijevo namjerno prazna, unos je u tri polja).
   */
  function zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(imaLozu, rasporediVisinu) {
    imaLozu = !!imaLozu;
    var lj = document.getElementById('zapisnik_prisustvo_lijevi_stupac');
    var selTipEl = document.getElementById('zapisnik_prisustvo_tip_unosa');
    var tipVal = selTipEl ? trimZ(selTipEl.value) : '';
    var hasTip = !!tipVal;
    var slobUnosJedan = false;
    var sviClanoviObedijncije = false;
    if (selTipEl && selTipEl.selectedIndex > 0) {
      var opT = selTipEl.options[selTipEl.selectedIndex];
      slobUnosJedan = opT && opT.getAttribute('data-slobodan-unos') === '1';
      sviClanoviObedijncije = opT && opT.getAttribute('data-svi-clanovi-obedijncije') === '1';
    }
    var povratLijevaTabZbogDesnogNesl = zapisnikPrisustvoJeDesniRedOznačenNeslobZaPovratTablice();
    if (lj) {
      lj.classList.remove('zapisnik-crud__prisustvo-li-rezim--sam-izvor');
      lj.classList.remove('zapisnik-crud__prisustvo-li-rezim--sam-edit');
      if (hasTip && slobUnosJedan && !povratLijevaTabZbogDesnogNesl) {
        lj.classList.add('zapisnik-crud__prisustvo-li-rezim--sam-edit');
        lj.setAttribute('data-prisustvo-li-rezim', 'edit');
      } else {
        lj.classList.add('zapisnik-crud__prisustvo-li-rezim--sam-izvor');
        lj.setAttribute('data-prisustvo-li-rezim', 'izvor');
      }
    }

    var tabLijevo = document.getElementById('zapisnik_prisustvo_tablica_lijevo');
    var tabDesno = document.getElementById('zapisnik_prisustvo_tablica_desno');
    var izvorListeEnabled = hasTip && (sviClanoviObedijncije || imaLozu || slobUnosJedan);
    if (tabLijevo && tabLijevo.classList) {
      tabLijevo.classList.toggle('kontrola-tablica--disabled', !izvorListeEnabled);
    }
    if (tabDesno && tabDesno.classList) {
      tabDesno.classList.toggle('kontrola-tablica--disabled', !izvorListeEnabled);
    }

    /* Tip unosa: disabled kad je lijevi tbody prazan, osim kad je aktivna opcija Tipa za slobodan unos (lijevo je bez tablice). */
    var tbodyLjZaTip = document.getElementById('zapisnik_prisustvo_tbody_lijevo');
    var trsLj = tbodyLjZaTip ? tbodyLjZaTip.getElementsByTagName('tr') : null;
    var nRedakaLj = trsLj ? trsLj.length : 0;
    var tipNativeDisabled = nRedakaLj === 0 && !(hasTip && slobUnosJedan);
    if (selTipEl && 'disabled' in selTipEl) {
      selTipEl.disabled = !!tipNativeDisabled;
    }
    var lblZaTip =
      typeof document.querySelector === 'function'
        ? document.querySelector('#zapisnikKontrolaTabPanel1 label[for="zapisnik_prisustvo_tip_unosa"]')
        : null;
    if (lblZaTip && lblZaTip.classList) {
      if (tipNativeDisabled) lblZaTip.classList.add('kontrola-labela--disabled');
      else lblZaTip.classList.remove('kontrola-labela--disabled');
    }
    if (typeof KontroleRefreshCustomSelect === 'function') {
      try {
        KontroleRefreshCustomSelect('zapisnik_prisustvo_tip_unosa');
      } catch (eKt) {}
    }

    var prisTraziInp = document.getElementById('zapisnik_prisustvo_trazi');
    var prisTraziWrap = prisTraziInp && prisTraziInp.closest ? prisTraziInp.closest('.kontrola-edit-delete') : null;
    if (prisTraziWrap && typeof KontroleSetControlEnabled === 'function') {
      KontroleSetControlEnabled(prisTraziWrap, izvorListeEnabled);
      if (!izvorListeEnabled && prisTraziInp) {
        prisTraziInp.value = '';
        zapisnikPrisustvoPrimijeniFilterLijeveListe();
      }
    }

    var bUde = document.getElementById('zapisnik_prisustvo_btn_udesno');
    var bUli = document.getElementById('zapisnik_prisustvo_btn_ulijevo');
    zapisnikPrisustvoAzurirajGumbovePremjestaja();

    if (rasporediVisinu) zapisnikScheduleMinVisinuResiza();
  }

  /**
   * Za Tip s „slobodan unos“: ime i loža (tekst), država kao prava opcija (#zapisnik_prisustvo_select_drzava, ne placeholder).
   * @returns {boolean}
   */
  function zapisnikPrisustvoSlobPoljaKompletZaUdesno() {
    var ei = document.getElementById('zapisnik_prisustvo_edit_ime');
    var lz = document.getElementById('zapisnik_prisustvo_edit_loza');
    var sd = document.getElementById('zapisnik_prisustvo_select_drzava');
    var ime = ei ? trimZ(ei.value) : '';
    var loz = lz ? trimZ(lz.value) : '';
    var drOk = !!(sd && sd.selectedIndex > 0 && trimZ(sd.value) !== '');
    return ime !== '' && loz !== '' && drOk;
  }

  /**
   * Nakon prebacivanja slobodnog unosa udesno: briše Ime i Loža, država na „– Odaberi –“ + refresh custom select.
   */
  function zapisnikPrisustvoOcistiPoljaSlobUnosaZaNovuOsobu() {
    var imeEl = document.getElementById('zapisnik_prisustvo_edit_ime');
    var lzEl = document.getElementById('zapisnik_prisustvo_edit_loza');
    var sd = document.getElementById('zapisnik_prisustvo_select_drzava');
    if (imeEl) imeEl.value = '';
    if (lzEl) lzEl.value = '';
    if (sd) sd.selectedIndex = 0;
    if (typeof KontroleRefreshCustomSelect === 'function') {
      try {
        KontroleRefreshCustomSelect('zapisnik_prisustvo_select_drzava');
      } catch (eCz) {}
    }
  }

  /**
   * Izvorna lista (lijevo): jedan redak = jedan član; prikaz „Prezime Ime · naziv lože” kad postoji loza_naziv (više učesničkih loža).
   * Korišteno pri ponovnom iscrtavanju nakon pretrage (isto kao što Clanovi_Loza_CRUD puni stupce iz zapisa).
   * @param {{ prezime?: string, ime?: string, loza_naziv?: string }} r red iz JSON-a
   * @returns {string} tekst u ćeliji
   */
  function zapisnikPrisustvoFormatTekstRetkaIzvor(r) {
    if (!r || typeof r !== 'object') return '';
    var p = trimZ(r.prezime);
    var ix = trimZ(r.ime);
    var ime = (p + (p && ix ? ' ' : '') + ix).trim();
    if (!ime) ime = p || ix || '';
    var lz = trimZ(r.loza_naziv);
    if (lz) return ime + ' \u00B7 ' + lz;
    return ime;
  }

  /**
   * Jedan lowercase niz za pretragu kao u Clanovi_Loza_CRUD `clanoviLozaPrimijeniTraži` (Clanovi_Loza_CRUD.js ~863–879),
   * dodano: loža naziv / grad / država kad je više učesnica (jedna ćelija ipak sama ne sadrži šifru stupnja itd.).
   * @param {object} r red Clanovi_CRUD_sve_loze.json
   */
  function zapisnikPrisustvoHaystackZaTrazenjeKaoClanoviLoza(r) {
    if (!r || typeof r !== 'object') return '';
    var sif = r.sifra != null ? String(r.sifra) : '';
    var st = r.stupanj_show != null ? String(r.stupanj_show) : '';
    var stNum = r.stupanj != null ? String(r.stupanj) : '';
    var vu = r.upisano != null ? String(r.upisano) : '';
    var spolTxt = (r.spol === 1 || r.spol === '1') ? 'ženski' : 'muški';
    var hay =
      ((r.prezime || '') + ' ' + (r.ime || '') + ' ' + st + ' ' + stNum + ' ' + sif + ' ' + vu + ' ' + spolTxt).toLowerCase();
    var lz = trimZ(r.loza_naziv || '');
    var lg = trimZ(r.loza_grad || '');
    var dLo = trimZ(r.drzava_loze || '');
    if (lz !== '') hay += ' ' + lz.toLowerCase();
    if (lg !== '') hay += ' ' + lg.toLowerCase();
    if (dLo !== '') hay += ' ' + dLo.toLowerCase();
    return hay;
  }

  /**
   * Filtrirani niz od `zapisnikPrisustvoClanoviIzvorData` kao `clanoviLozaPrimijeniTraži(data)` u Clanovi_Loza_CRUD.
   */
  function zapisnikPrisustvoFiltrirajKaoClanoviLoza(lista) {
    var el = document.getElementById('zapisnik_prisustvo_trazi');
    var q = el ? trimZ(el.value || '').toLowerCase() : '';
    if (!q) return (lista || []).slice();
    var out = [];
    var src = lista || [];
    for (var i = 0; i < src.length; i++) {
      var r = src[i];
      var hay = zapisnikPrisustvoHaystackZaTrazenjeKaoClanoviLoza(r);
      if (hay.indexOf(q) >= 0) out.push(r);
    }
    return out;
  }

  /**
   * Jednokratno punjenje tijela liste iz niza zapisa — zove se samo kada se promijeni keš (`zapisnikPrisustvoClanoviIzvorData`).
   * Pretraga ne mijenja innerHTML pri svakoj tipki — keš u varijabli, retci u tbody; filtar toggla `hidden` na <tr>.
   */
  function zapisnikPrisustvoNapuniLijevoTbodyIzNizaClanova(puniArr) {
    var tbody = document.getElementById('zapisnik_prisustvo_tbody_lijevo');
    if (!tbody) return;
    tbody.innerHTML = '';
    var arr = puniArr || [];
    for (var ri = 0; ri < arr.length; ri++) {
      var o = arr[ri];
      if (!o || o.id == null) continue;
      var tr = document.createElement('tr');
      tr.dataset.rowIndex = String(ri);
      tr.dataset.rowId = String(o.id);
      tr.hidden = false;
      tr.style.removeProperty('visibility');
      var td = document.createElement('td');
      var cellInner = document.createElement('div');
      cellInner.className = 'kontrola-tablica__cell-inner';
      cellInner.setAttribute('tabindex', '0');
      cellInner.textContent = zapisnikPrisustvoFormatTekstRetkaIzvor(o);
      td.appendChild(cellInner);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  /**
   * Istim poljima kao clanoviLozaPrimijeniTraži (JSON — ne samo tekst iz ćelije); rezultat: koji id-evi ostaju vidljivi.
   */
  function zapisnikPrisustvoIdSkupNakonKlFiltera(listaZaFiltrirati) {
    var filt = zapisnikPrisustvoFiltrirajKaoClanoviLoza(listaZaFiltrirati || []);
    var sk = Object.create(null);
    for (var i = 0; i < filt.length; i++) {
      var r = filt[i];
      if (r && r.id != null) sk[String(r.id)] = true;
    }
    return sk;
  }

  /**
   * Kratki put: prazan upit — sve ćelije liste vidljive (bez ponovnog iscrtavanja).
   */
  function zapisnikPrisustvoJeUpitPretragePrazan() {
    var el = document.getElementById('zapisnik_prisustvo_trazi');
    return !el ? true : trimZ(el.value || '') === '';
  }

  /**
   * Primijeni pretragu: na postojećem tbody-ju mijenja atribut `hidden` na <tr> (pouzdano kao display:none na retku tablice).
   * Prethodni visibility:collapse u nekim Chromium verzijama vizualno nije skidao retke dok JSON filtar radi ispravno.
   */
  function zapisnikPrisustvoPrimijeniFilterLijeveListe() {
    var tbody = document.getElementById('zapisnik_prisustvo_tbody_lijevo');
    if (!tbody) return;
    var trs = tbody.querySelectorAll('tr');
    if (!trs.length) {
      zapisnikPrisustvoPrimijeniStripedRedove(document.getElementById('zapisnik_prisustvo_tablica_lijevo'));
      zapisnikPrisustvoAzurirajVidljivostHasSelectedLijevo();
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
      return;
    }

    /* Set id-jeva koji zadovoljavaju upit — prazan upit ⇒ „svi“. */
    var prikaziSve = zapisnikPrisustvoJeUpitPretragePrazan();
    var dozvoljeni = prikaziSve ? null : zapisnikPrisustvoIdSkupNakonKlFiltera(zapisnikPrisustvoClanoviIzvorData);

    var ti;
    for (ti = 0; ti < trs.length; ti++) {
      var trOne = trs[ti];
      var rid = trOne.dataset ? String(trOne.dataset.rowId || '') : '';
      var ok =
        prikaziSve || (rid !== '' && Object.prototype.hasOwnProperty.call(dozvoljeni, rid));
      if (ok) {
        trOne.hidden = false;
        trOne.style.removeProperty('visibility');
      } else {
        trOne.hidden = true;
      }
      if (!ok && trOne.classList && trOne.classList.contains('tablica-row-selected')) {
        trOne.classList.remove('tablica-row-selected');
      }
    }

    zapisnikPrisustvoPrimijeniStripedRedove(document.getElementById('zapisnik_prisustvo_tablica_lijevo'));
    zapisnikPrisustvoAzurirajVidljivostHasSelectedLijevo();
    zapisnikPrisustvoAzurirajGumbovePremjestaja();
  }

  /* Isti interval kao Clanovi_Loza_CRUD clanoviLozaInitTraziTablica (200 ms). */
  var ZAPISNIK_PRISUSTVO_TRAZI_DEBOUNCE_MS = 200;
  var zapisnikPrisustvoFilterDebounceT = null;

  /**
   * Čitanje CSS tokena s :root — isti obrazac kao getToken u 0-Kontrole.js (za statičke .kontrola-tablica bez KontroleTablica builda).
   * @param {string} name npr. '--tablica_podaci_striped'
   * @returns {string}
   */
  function zapisnikPrisustvoGetCssToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /**
   * Klase na omotu tablice iz 0-Common tokena — isto što applyTokenClasses u 0-Kontrole.js (bez tablica--multi-select: prisustvo ima vlastiti klik).
   * @param {HTMLElement} container .kontrola-tablica
   */
  function zapisnikPrisustvoSyncTablicaWrapperKlaseIzTokena(container) {
    if (!container || !container.classList) return;
    container.classList.remove(
      'tablica--podaci-h-linije',
      'tablica--podaci-v-linije',
      'tablica--zaglavlje-v-linije',
      'tablica--striped'
    );
    if (zapisnikPrisustvoGetCssToken('--tablica_podaci_h_linije') === 'true') {
      container.classList.add('tablica--podaci-h-linije');
    }
    if (zapisnikPrisustvoGetCssToken('--tablica_podaci_v_linije') === 'true') {
      container.classList.add('tablica--podaci-v-linije');
    }
    if (zapisnikPrisustvoGetCssToken('--tablica_zaglavlje_v_linije') === 'true') {
      container.classList.add('tablica--zaglavlje-v-linije');
    }
    if (zapisnikPrisustvoGetCssToken('--tablica_podaci_striped') === 'true') {
      container.classList.add('tablica--striped');
    }
  }

  /**
   * Zebra redaka — applyStripedRows iz 0-Kontrole.js; samo ako je --tablica_podaci_striped: true.
   * @param {HTMLElement} container .kontrola-tablica (traži tbody unutar .kontrola-tablica__scroll)
   */
  function zapisnikPrisustvoPrimijeniStripedRedove(container) {
    if (!container) return;
    var rows = container.querySelectorAll('.kontrola-tablica__scroll tbody tr');
    /* Kada striped nije aktiviran, skidaj klase na svim retcima uključujući sakrivene. */
    if (zapisnikPrisustvoGetCssToken('--tablica_podaci_striped') !== 'true') {
      for (var ir = 0; ir < rows.length; ir++) {
        rows[ir].classList.remove('tablica-row-striped');
      }
      return;
    }
    /* Zebra samo po vidljivim redovima nakon filtra (sakriveni = tr.hidden). */
    var vidljivi = [];
    for (var j = 0; j < rows.length; j++) {
      var rrw = rows[j];
      if (rrw.hidden) {
        rrw.classList.remove('tablica-row-striped');
      } else {
        vidljivi.push(rrw);
      }
    }
    for (var i = 0; i < vidljivi.length; i++) {
      if (i % 2 === 1) vidljivi[i].classList.add('tablica-row-striped');
      else vidljivi[i].classList.remove('tablica-row-striped');
    }
  }

  function zapisnikPrisustvoInicStatickePrisustvoTabliceIzTokena() {
    var lijevo = document.getElementById('zapisnik_prisustvo_tablica_lijevo');
    var desno = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (lijevo) zapisnikPrisustvoSyncTablicaWrapperKlaseIzTokena(lijevo);
    if (desno) zapisnikPrisustvoSyncTablicaWrapperKlaseIzTokena(desno);
  }

  /**
   * Istim uzorkom kao Clanovi_Loza_CRUD `clanoviLozaInitTraziTablica` (~1315): input direktno na #zapisnik_prisustvo_trazi,
   * debounce 200 ms → primijeni filtar; kontrole-edit-delete-clear na najblijem .kontrola-edit-delete.
   * Jedan ponovljen setTimeout(0) ako polje još nije dostupno (kasni layout).
   */
  function zapisnikPrisustvoInitFilterLijeveListe() {
    function veziPremjePretragu() {
      var inpTrazi = document.getElementById('zapisnik_prisustvo_trazi');
      if (!inpTrazi) {
        return false;
      }
      if (inpTrazi.dataset.zapisnikTraziVeza === '1') {
        return true;
      }
      inpTrazi.dataset.zapisnikTraziVeza = '1';
      inpTrazi.addEventListener('input', function () {
        if (zapisnikPrisustvoFilterDebounceT) {
          clearTimeout(zapisnikPrisustvoFilterDebounceT);
        }
        zapisnikPrisustvoFilterDebounceT = setTimeout(function () {
          zapisnikPrisustvoFilterDebounceT = null;
          zapisnikPrisustvoPrimijeniFilterLijeveListe();
        }, ZAPISNIK_PRISUSTVO_TRAZI_DEBOUNCE_MS);
      });
      var traziEd = inpTrazi.closest('.kontrola-edit-delete');
      if (traziEd) {
        traziEd.addEventListener('kontrole-edit-delete-clear', function () {
          if (zapisnikPrisustvoFilterDebounceT) {
            clearTimeout(zapisnikPrisustvoFilterDebounceT);
            zapisnikPrisustvoFilterDebounceT = null;
          }
          zapisnikPrisustvoPrimijeniFilterLijeveListe();
        });
      }
      return true;
    }
    if (veziPremjePretragu()) {
      return;
    }
    setTimeout(function () {
      veziPremjePretragu();
    }, 0);
  }

  /** Nakon iscrtavanja lijeve liste: prati .kontrola-tablica--has-selected (isti vizual kao KontroleTablica). */
  function zapisnikPrisustvoAzurirajVidljivostHasSelectedLijevo() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_lijevo');
    if (!tab || !tab.classList) return;
    var ima = !!tab.querySelector('tbody tr.tablica-row-selected');
    tab.classList.toggle('kontrola-tablica--has-selected', ima);
  }

  /** Desna tablica: isti omot --has-selected kad postoji označen redak. */
  function zapisnikPrisustvoAzurirajVidljivostHasSelectedDesno() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (!tab || !tab.classList) return;
    var ima = !!tab.querySelector('tbody tr.tablica-row-selected');
    tab.classList.toggle('kontrola-tablica--has-selected', ima);
  }

  /**
   * data-boja-prikaza s opcije Tipa unosa (DB) — samo heks u formi #RGB / #RRGGBB; inače prazno (sistemska boja retka).
   * @param {string} s
   * @returns {string}
   */
  function zapisnikPrisustvoNormalizirajBojaPrikazaZaCss(s) {
    s = trimZ(s);
    if (!s) return '';
    if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
    return '';
  }

  /**
   * Boja teksta za NOVI red u desnoj tablici = trenutno odabrana opcija #zapisnik_prisustvo_tip_unosa (data-boja-prikaza).
   * @returns {string} npr. "#c0392b" ili ""
   */
  function zapisnikPrisustvoDohvatiFgZaTrenutnoOdabraniTipUnosa() {
    var sel = document.getElementById('zapisnik_prisustvo_tip_unosa');
    if (!sel || sel.selectedIndex <= 0) return '';
    var op = sel.options[sel.selectedIndex];
    var raw = op ? trimZ(op.getAttribute('data-boja-prikaza') || '') : '';
    return zapisnikPrisustvoNormalizirajBojaPrikazaZaCss(raw);
  }

  /** Pronađi člana u kešu izvorne liste (uključujući i one koji su već na desnoj listi — id ostaje u kešu). */
  function zapisnikPrisustvoNadjiClanUOstavPodacimaPoId(cid) {
    var src = zapisnikPrisustvoClanoviIzvorData || [];
    var ks = String(cid);
    for (var i = 0; i < src.length; i++) {
      var oo = src[i];
      if (oo && String(oo.id) === ks) return oo;
    }
    return null;
  }

  /** Nakon promjene cijelog lijevog izvora (GET, lože, greška): prazni desnu listu i DOM. */
  function zapisnikPrisustvoResetDesnuListuIZaNovaIzvor() {
    zapisnikPrisustvoDesnoListaPoRedu = [];
    var tbodyD = document.getElementById('zapisnik_prisustvo_tbody_desno');
    if (tbodyD) tbodyD.innerHTML = '';
    var tabD = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (tabD) zapisnikPrisustvoPrimijeniStripedRedove(tabD);
    zapisnikPrisustvoAzurirajVidljivostHasSelectedDesno();
  }

  /** Lijeva tablica prikazuje članove iz keša koji NISU trenutno u desnoj listi. */
  function zapisnikPrisustvoListaZaLijevoBezPremjestenih() {
    var idsDesno = {};
    var di;
    for (di = 0; di < zapisnikPrisustvoDesnoListaPoRedu.length; di++) {
      var en = zapisnikPrisustvoDesnoListaPoRedu[di];
      if (en && en.id != null) idsDesno[String(en.id)] = true;
    }
    var src = zapisnikPrisustvoClanoviIzvorData || [];
    var filt = [];
    for (var i = 0; i < src.length; i++) {
      var oo = src[i];
      if (!oo || oo.id == null) continue;
      if (idsDesno[String(oo.id)]) continue;
      filt.push(oo);
    }
    return filt;
  }

  /**
   * Cijeli iscrtaj desnu tablicu iz zapisnikPrisustvoDesnoListaPoRedu (tekstovi iz člana ili slobUnos.tekstSlobPrikaz; fg iz snimke).
   * Svaki <tr>: `data-tip-unosa-id`, kod slobodnog unosa i `data-drzava-id` (radovi_drzave_gostiju.id).
   * Lijevi stupac ostaje bez prilagođene boje teksta (.kontrola-tablica__cell-inner na lijevo nema inline color).
   */
  function zapisnikPrisustvoIzgradiDesnuTbodyIzListe() {
    var tbody = document.getElementById('zapisnik_prisustvo_tbody_desno');
    if (!tbody) return;
    tbody.innerHTML = '';
    var arr = zapisnikPrisustvoDesnoListaPoRedu || [];
    for (var ri = 0; ri < arr.length; ri++) {
      var entry = arr[ri];
      if (!entry) continue;
      var slobPri = !!(
        entry.slobodanUnos &&
        entry.tekstSlobPrikaz != null &&
        trimZ(String(entry.tekstSlobPrikaz)) !== ''
      );
      if (!slobPri && entry.id == null) continue;
      var prikaz;
      if (slobPri) {
        prikaz = trimZ(String(entry.tekstSlobPrikaz));
      } else {
        var o = zapisnikPrisustvoNadjiClanUOstavPodacimaPoId(entry.id);
        prikaz = o ? zapisnikPrisustvoFormatTekstRetkaIzvor(o) : '';
        if (trimZ(String(prikaz)) === '') {
          prikaz =
            entry.prikazTekstZaClana != null && trimZ(String(entry.prikazTekstZaClana)) !== ''
              ? trimZ(String(entry.prikazTekstZaClana))
              : '#' + String(entry.id);
        }
      }
      var tr = document.createElement('tr');
      tr.dataset.rowIndex = String(ri);
      tr.dataset.rowId = String(entry.id);
      var tipIdStored =
        entry.tipUnosaId != null && String(entry.tipUnosaId) !== ''
          ? String(entry.tipUnosaId).trim()
          : '';
      if (tipIdStored) tr.setAttribute('data-tip-unosa-id', tipIdStored);
      else tr.removeAttribute('data-tip-unosa-id');
      var drVidZn = entry.idDrzaveGostiju != null ? trimZ(String(entry.idDrzaveGostiju)) : '';
      if (drVidZn !== '') tr.setAttribute('data-drzava-id', drVidZn);
      else tr.removeAttribute('data-drzava-id');
      tr.hidden = false;
      tr.style.removeProperty('visibility');
      var td = document.createElement('td');
      var cellInner = document.createElement('div');
      cellInner.className = 'kontrola-tablica__cell-inner';
      cellInner.setAttribute('tabindex', '0');
      cellInner.textContent = prikaz;
      var fg = entry.fgCss && typeof entry.fgCss === 'string' ? entry.fgCss : '';
      if (fg) cellInner.style.color = fg;
      else cellInner.style.removeProperty('color');
      td.appendChild(cellInner);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    zapisnikPrisustvoPrimijeniStripedRedove(document.getElementById('zapisnik_prisustvo_tablica_desno'));
    zapisnikPrisustvoAzurirajVidljivostHasSelectedDesno();
  }

  /** Nakon promjene skupa u lijevom kešu — ponovno punjenje samo redaka koji nisu na desnoj strani; sinkron Tip unosa kad tbody postane prazan/punan. */
  function zapisnikPrisustvoOsvjeziLijevoTbodyIzCacheBezPremjestenih() {
    zapisnikPrisustvoNapuniLijevoTbodyIzNizaClanova(zapisnikPrisustvoListaZaLijevoBezPremjestenih());
    zapisnikPrisustvoPrimijeniFilterLijeveListe();
    zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
  }

  function zapisnikPrisustvoOcistiSelekcijuLijeveListe() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_lijevo');
    if (!tab) return;
    var tbody = tab.querySelector('tbody');
    if (!tbody) return;
    var sve = tbody.querySelectorAll('tr.tablica-row-selected');
    var si;
    for (si = 0; si < sve.length; si++) {
      sve[si].classList.remove('tablica-row-selected');
    }
    zapisnikPrisustvoAzurirajVidljivostHasSelectedLijevo();
  }

  function zapisnikPrisustvoOcistiSelekcijuDesnogTbodyja() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (!tab) return;
    var tbody = tab.querySelector('tbody');
    if (!tbody) return;
    var sve = tbody.querySelectorAll('tr.tablica-row-selected');
    var si;
    for (si = 0; si < sve.length; si++) {
      sve[si].classList.remove('tablica-row-selected');
    }
    zapisnikPrisustvoAzurirajVidljivostHasSelectedDesno();
  }

  /** Selektiran red lijevo smatra se aktivnim samo ako red nije sakriven pretragom. */
  function zapisnikPrisustvoJeSelekcijaNaLijevojZaPremjestaj() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_lijevo');
    if (!tab) return false;
    var sel = tab.querySelector('tbody tr.tablica-row-selected');
    return !!(sel && !sel.hidden);
  }

  function zapisnikPrisustvoJeSelekcijaNaDesnojZaPremjestaj() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (!tab) return false;
    var sel = tab.querySelector('tbody tr.tablica-row-selected');
    return !!(sel && !sel.hidden);
  }

  /**
   * Gumbi L↔D: u režimu slobodnog unosa (data-slobodan-unos=1 na Tipu) gumb udesno kad su Ime, Loža i Država ispunjeni; inače klasično (lista lijevo + selekcija).
   * Temeljni „smije li se koristiti zamjena”: tip + ili loža u zaglavlju ili sve obedijncije opcija ili slobodan unos.
   */
  function zapisnikPrisustvoAzurirajGumbovePremjestaja() {
    var bUde = document.getElementById('zapisnik_prisustvo_btn_udesno');
    var bUli = document.getElementById('zapisnik_prisustvo_btn_ulijevo');
    var imaLozuHdr = !!zapisnikIdOdabraneLozISelecta();
    var selTipEl = document.getElementById('zapisnik_prisustvo_tip_unosa');
    var tipVal = selTipEl ? trimZ(selTipEl.value) : '';
    var hasTip = !!tipVal;
    var slobUnosJedan = false;
    if (selTipEl && selTipEl.selectedIndex > 0) {
      var opT = selTipEl.options[selTipEl.selectedIndex];
      slobUnosJedan = !!(opT && opT.getAttribute('data-slobodan-unos') === '1');
    }
    var xferOk =
      hasTip &&
      (slobUnosJedan || imaLozuHdr || zapisnikPrisustvoJeTipUnosaSviClanoviObedijncije());
    var selL = zapisnikPrisustvoJeSelekcijaNaLijevojZaPremjestaj();
    var selD = zapisnikPrisustvoJeSelekcijaNaDesnojZaPremjestaj();
    var udeMozda = xferOk && (slobUnosJedan ? zapisnikPrisustvoSlobPoljaKompletZaUdesno() : !!selL);
    if (bUde && 'disabled' in bUde) bUde.disabled = !udeMozda;
    if (bUli && 'disabled' in bUli) bUli.disabled = !xferOk || !selD;
  }

  function zapisnikPrisustvoKlikPremjestUDesno() {
    var selTipElTip = document.getElementById('zapisnik_prisustvo_tip_unosa');
    var slobXfer = false;
    if (selTipElTip && selTipElTip.selectedIndex > 0) {
      var opSx = selTipElTip.options[selTipElTip.selectedIndex];
      slobXfer = !!(opSx && opSx.getAttribute('data-slobodan-unos') === '1');
    }
    if (slobXfer) {
      if (!zapisnikPrisustvoSlobPoljaKompletZaUdesno()) return;
      var fgSu = zapisnikPrisustvoDohvatiFgZaTrenutnoOdabraniTipUnosa();
      var ei = document.getElementById('zapisnik_prisustvo_edit_ime');
      var lz = document.getElementById('zapisnik_prisustvo_edit_loza');
      var sd = document.getElementById('zapisnik_prisustvo_select_drzava');
      var imeT = ei ? trimZ(ei.value) : '';
      var lozaT = lz ? trimZ(lz.value) : '';
      var drId = sd && sd.selectedIndex > 0 ? trimZ(sd.value) : '';
      var drTxt = '';
      if (sd && sd.selectedIndex > 0) {
        drTxt = trimZ(sd.options[sd.selectedIndex].textContent || '');
      }
      var tekstLin = imeT + ' \u00B7 ' + lozaT + ' \u00B7 ' + drTxt;
      zapisnikPrisustvoSlobUnosSuIdSuffix += 1;
      var sintId = 'su:' + String(zapisnikPrisustvoSlobUnosSuIdSuffix);
      zapisnikPrisustvoDesnoListaPoRedu.push({
        id: sintId,
        fgCss: fgSu,
        tipUnosaId: selTipElTip ? trimZ(selTipElTip.value) : '',
        slobodanUnos: true,
        idDrzaveGostiju: drId,
        tekstSlobPrikaz: tekstLin
      });
      zapisnikPrisustvoIzgradiDesnuTbodyIzListe();
      zapisnikPrisustvoOcistiPoljaSlobUnosaZaNovuOsobu();
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
      zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
      return;
    }

    var tab = document.getElementById('zapisnik_prisustvo_tablica_lijevo');
    if (!tab || tab.classList.contains('kontrola-tablica--disabled')) return;
    var tr = tab.querySelector('tbody tr.tablica-row-selected');
    if (!tr || tr.hidden || !tr.dataset || tr.dataset.rowId == null || tr.dataset.rowId === '') return;
    var cid = parseInt(String(tr.dataset.rowId), 10);
    if (isNaN(cid)) return;
    var fg = zapisnikPrisustvoDohvatiFgZaTrenutnoOdabraniTipUnosa();
    var selTipPr = document.getElementById('zapisnik_prisustvo_tip_unosa');
    var tipUnosaIdZaRed = selTipPr ? trimZ(selTipPr.value) : '';
    /* Snimi prikaz s retka ili iz keša jer kasnije GET može zamijeniti ClanoviIzvorData bez ovog člana — inače ostaje fallback #id. */
    var oZaPrikaz = zapisnikPrisustvoNadjiClanUOstavPodacimaPoId(cid);
    var tekstZaCl =
      oZaPrikaz != null ? zapisnikPrisustvoFormatTekstRetkaIzvor(oZaPrikaz) : '';
    if (trimZ(String(tekstZaCl)) === '') {
      var cin = tr.querySelector('.kontrola-tablica__cell-inner');
      if (cin) tekstZaCl = trimZ(cin.textContent || '');
    }
    zapisnikPrisustvoDesnoListaPoRedu.push({
      id: cid,
      fgCss: fg,
      tipUnosaId: tipUnosaIdZaRed,
      prikazTekstZaClana: tekstZaCl
    });
    zapisnikPrisustvoIzgradiDesnuTbodyIzListe();
    zapisnikPrisustvoOsvjeziLijevoTbodyIzCacheBezPremjestenih();
    zapisnikPrisustvoAzurirajGumbovePremjestaja();
  }

  function zapisnikPrisustvoKlikPremjestULijevo() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (!tab || tab.classList.contains('kontrola-tablica--disabled')) return;
    var tr = tab.querySelector('tbody tr.tablica-row-selected');
    if (!tr || tr.hidden || !tr.dataset || tr.dataset.rowId == null || String(tr.dataset.rowId).trim() === '')
      return;
    var rid = String(trimZ(String(tr.dataset.rowId)));
    if (!rid) return;
    var nova = [];
    var i;
    for (i = 0; i < zapisnikPrisustvoDesnoListaPoRedu.length; i++) {
      var e = zapisnikPrisustvoDesnoListaPoRedu[i];
      if (!e || e.id == null) continue;
      if (String(e.id) !== rid) nova.push(e);
    }
    zapisnikPrisustvoDesnoListaPoRedu = nova;
    zapisnikPrisustvoIzgradiDesnuTbodyIzListe();
    zapisnikPrisustvoOsvjeziLijevoTbodyIzCacheBezPremjestenih();
    zapisnikPrisustvoAzurirajGumbovePremjestaja();
    zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
  }

  function zapisnikPrisustvoInitGumbovePremjesaja() {
    var ude = document.getElementById('zapisnik_prisustvo_btn_udesno');
    var uli = document.getElementById('zapisnik_prisustvo_btn_ulijevo');
    if (ude && !ude._zapisnikPremjestajVeza) {
      ude._zapisnikPremjestajVeza = true;
      ude.addEventListener('click', function () {
        zapisnikPrisustvoKlikPremjestUDesno();
      });
    }
    if (uli && !uli._zapisnikPremjestajVeza) {
      uli._zapisnikPremjestajVeza = true;
      uli.addEventListener('click', function () {
        zapisnikPrisustvoKlikPremjestULijevo();
      });
    }
  }

  function zapisnikPrisustvoInitPoljaZaSlobGumbUdDesno() {
    function pomakniUdGumbZaSlobPolja() {
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
    }
    var idPolja = ['zapisnik_prisustvo_edit_ime', 'zapisnik_prisustvo_edit_loza'];
    var qi;
    for (qi = 0; qi < idPolja.length; qi++) {
      var elPo = document.getElementById(idPolja[qi]);
      if (elPo && !elPo._zapisnikSlobGdPoljeZaUdeBound) {
        elPo._zapisnikSlobGdPoljeZaUdeBound = true;
        elPo.addEventListener('input', pomakniUdGumbZaSlobPolja);
      }
    }
    var sdD = document.getElementById('zapisnik_prisustvo_select_drzava');
    if (sdD && !sdD._zapisnikSlobGdPoljeZaUdeBound) {
      sdD._zapisnikSlobGdPoljeZaUdeBound = true;
      sdD.addEventListener('change', pomakniUdGumbZaSlobPolja);
    }
  }

  /**
   * Desna lista: jedan označen redak; klik isključuje selekciju lijevo (međusobno isključivo).
   * Dvoklik na red: kao klik na trokut „ulijevo” (isti uvjeti kao gumb za povrat na lijevu tablicu).
   */
  function zapisnikPrisustvoInitDesnaListaSelekcija() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (!tab || tab._zapisnikDesnoSelekcijaBound) return;
    tab._zapisnikDesnoSelekcijaBound = true;
    var scroll = tab.querySelector('.kontrola-tablica__scroll');
    if (!scroll) return;
    scroll.addEventListener('click', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tbody tr') : null;
      if (!tr || !scroll.contains(tr)) return;
      if (tr.hidden) return;
      if (tab.classList.contains('kontrola-tablica--disabled')) return;
      var tbody = tab.querySelector('tbody');
      if (!tbody) return;
      zapisnikPrisustvoOcistiSelekcijuLijeveListe();
      var sve = tbody.querySelectorAll('tr');
      var si;
      for (si = 0; si < sve.length; si++) {
        sve[si].classList.remove('tablica-row-selected');
      }
      tr.classList.add('tablica-row-selected');
      zapisnikPrisustvoAzurirajVidljivostHasSelectedDesno();
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
      zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
      try {
        scroll.focus({ preventScroll: true });
      } catch (ef2) {}
    });
    /* Dvoklik: isti učinak kao trokut „ulijevo” (zapisnikPrisustvoKlikPremjestULijevo). */
    scroll.addEventListener('dblclick', function (eDblD) {
      var trDu = eDblD.target && eDblD.target.closest ? eDblD.target.closest('tbody tr') : null;
      if (!trDu || !scroll.contains(trDu)) return;
      if (trDu.hidden) return;
      if (tab.classList.contains('kontrola-tablica--disabled')) return;
      var tbodyDu = tab.querySelector('tbody');
      if (!tbodyDu) return;
      zapisnikPrisustvoOcistiSelekcijuLijeveListe();
      var sveDu = tbodyDu.querySelectorAll('tr');
      var sdu;
      for (sdu = 0; sdu < sveDu.length; sdu++) {
        sveDu[sdu].classList.remove('tablica-row-selected');
      }
      trDu.classList.add('tablica-row-selected');
      zapisnikPrisustvoAzurirajVidljivostHasSelectedDesno();
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
      try {
        eDblD.preventDefault();
      } catch (_) {}
      zapisnikPrisustvoKlikPremjestULijevo();
    });
  }

  /**
   * Je li na #zapisnik_prisustvo_tip_unosa opcija označena kao radovi_prisustvo_tip.svi_clanovi_obedijncije (data-svi-clanovi-obedijncije=1).
   */
  function zapisnikPrisustvoJeTipUnosaSviClanoviObedijncije() {
    var sel = document.getElementById('zapisnik_prisustvo_tip_unosa');
    if (!sel || sel.selectedIndex <= 0) return false;
    var op = sel.options[sel.selectedIndex];
    return !!(op && op.getAttribute('data-svi-clanovi-obedijncije') === '1');
  }

  /**
   * Kod opcije Tip unosa „svih obedijncija”: iz globalnog popisa maknuti sve članove čija je članska loža (= clanovi.loza)
   * među Odabranim ložama u modalu„Lože učesnice”; ti su već obrađeni pojedinačno kao učesnici radova u drugom listicu.
   * @param {Array<Object>} nab — kopija niza koja se obrađuje (ne mijenja ulaz ako nije aktivna opcija ili nema učesnica).
   * @returns {Array<Object>}
   */
  function zapisnikPrisustvoIzbaciClanoveLozaUcesnicaZaSviObe(nab) {
    var src = nab;
    if (!Array.isArray(src) || src.length === 0) return src || [];
    if (!zapisnikPrisustvoJeTipUnosaSviClanoviObedijncije()) return src;
    var rawIds = zapisnikLozeUcesniceKolekcijaId || [];
    if (!rawIds.length) return src.slice();
    var uz = {};
    var wi;
    for (wi = 0; wi < rawIds.length; wi++) {
      var nd = parseInt(String(rawIds[wi]), 10);
      if (!isNaN(nd) && nd > 0) uz[String(nd)] = true;
    }
    var filt = [];
    var ni;
    for (ni = 0; ni < src.length; ni++) {
      var r = src[ni];
      if (!r || r.id == null) continue;
      /* loza = clanovi.loza kao u Clanovi_CRUD_sve_loze / Clanovi_CRUD_prisustvo_svi_obedijencija. */
      var lidParsed = parseInt(String(r.loza != null ? r.loza : ''), 10);
      if (!isNaN(lidParsed) && lidParsed > 0 && uz[String(lidParsed)]) continue;
      filt.push(r);
    }
    return filt;
  }

  /**
   * Zajedničko parsiranje odgovora za listu članova (lijevo): JSON niz kao Clanovi_CRUD_sve_loze ili pipe-kod za showPorukaModal.
   * @param {{ zadrziDesnuListu?: boolean }} [opts]
   *   zadrziDesnuListu — ako true (npr. promjena Tipa unosa bez gubitka premještenih članova), ne poziva Reset desne liste nakon valjanog JSON-a (pipe-greška i dalje resetira).
   */
  function zapisnikPrisustvoObradaListeClanovaTeksta(text, callback, opts) {
    opts = opts || {};
    var zadrziDesnu = !!opts.zadrziDesnuListu;
    var t = (text || '').replace(/^\uFEFF/, '').trim();
    if (t !== '' && t.charAt(0) !== '[') {
      zapisnikPrisustvoResetDesnuListuIZaNovaIzvor();
      zapisnikPrisustvoClanoviIzvorData = [];
      zapisnikPrisustvoNapuniLijevoTbodyIzNizaClanova([]);
      zapisnikPrisustvoPrimijeniFilterLijeveListe();
      zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
      var parsed = parseResponseCode(t);
      if (parsed && typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[parsed.code] && typeof window.showPorukaModal === 'function') {
        window.showPorukaModal(parsed.code, parsed.replacements);
      }
      if (typeof callback === 'function') callback();
      return;
    }
    var arr = [];
    try {
      arr = JSON.parse(t || '[]');
    } catch (e1) {
      arr = [];
    }
    if (!Array.isArray(arr)) arr = [];
    var nab = [];
    for (var ri = 0; ri < arr.length; ri++) {
      var oo = arr[ri];
      if (oo && oo.id != null) nab.push(oo);
    }
    nab = zapisnikPrisustvoIzbaciClanoveLozaUcesnicaZaSviObe(nab);
    if (!zadrziDesnu) {
      zapisnikPrisustvoResetDesnuListuIZaNovaIzvor();
    }
    zapisnikPrisustvoClanoviIzvorData = nab;
    zapisnikPrisustvoNapuniLijevoTbodyIzNizaClanova(zapisnikPrisustvoListaZaLijevoBezPremjestenih());
    zapisnikPrisustvoPrimijeniFilterLijeveListe();
    zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
    if (typeof callback === 'function') callback();
  }

  /**
   * Punjenje lijeve izvorne liste: (A) opcija Tipa s svi_clanovi_obedijncije → svi aktivni nekandidati (aktivnost=1, kandidat=0) iz Clanovi_CRUD_prisustvo_svi_obedijencija.php.
   * (B) inače lože kao dosad iz zapisnikLozeUcesniceKolekcijaId + Clanovi_CRUD_sve_loze.php. Prazan skup loža u (B): prazan tbody.
   * @param {function(): void} [callback]
   * @param {{ zadrziDesnuListu?: boolean }} [opts] — kod promjene Tipa unosa bez brisanja desne liste; modal lože ostaje bez opcije (default reset desnog).
   */
  function zapisnikPrisustvoOsvjeziIzvornuListuClanova(callback, opts) {
    opts = opts || {};
    var tbody = document.getElementById('zapisnik_prisustvo_tbody_lijevo');
    if (!tbody) {
      if (typeof callback === 'function') callback();
      return;
    }

    if (zapisnikPrisustvoJeTipUnosaSviClanoviObedijncije()) {
      var xhrSvi = new XMLHttpRequest();
      xhrSvi.open('GET', getApiUrl('Clanovi_CRUD_prisustvo_svi_obedijencija.php'), true);
      xhrSvi.onreadystatechange = function () {
        if (xhrSvi.readyState !== 4) return;
        zapisnikPrisustvoObradaListeClanovaTeksta(xhrSvi.responseText, callback, opts);
      };
      xhrSvi.send();
      return;
    }

    var rawIds = zapisnikLozeUcesniceKolekcijaId || [];
    var idList = [];
    var seen = {};
    var k;
    for (k = 0; k < rawIds.length; k++) {
      var n = parseInt(String(rawIds[k]), 10);
      if (isNaN(n) || n <= 0) continue;
      var ks = String(n);
      if (seen[ks]) continue;
      seen[ks] = true;
      idList.push(n);
    }
    if (idList.length === 0) {
      if (!opts.zadrziDesnuListu) {
        zapisnikPrisustvoResetDesnuListuIZaNovaIzvor();
      }
      zapisnikPrisustvoClanoviIzvorData = [];
      zapisnikPrisustvoNapuniLijevoTbodyIzNizaClanova([]);
      zapisnikPrisustvoPrimijeniFilterLijeveListe();
      zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
      if (typeof callback === 'function') callback();
      return;
    }
    var xhr = new XMLHttpRequest();
    var qs = idList.join(',');
    xhr.open('GET', getApiUrl('Clanovi_CRUD_sve_loze.php') + '?id_loza=' + encodeURIComponent(qs), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      zapisnikPrisustvoObradaListeClanovaTeksta(xhr.responseText, callback, opts);
    };
    xhr.send();
  }

  /**
   * Jednokratno: klik na red u izvornoj listi (lijevo) — jednostruka selekcija, poštuj disabled stanje tablice.
   * Dvoklik na red: kao klik na trokut prema desnoj tablici (isti uvjeti / validacija kao gumb „udesno”).
   */
  function zapisnikPrisustvoInitIzvornaListaSelekcija() {
    var tab = document.getElementById('zapisnik_prisustvo_tablica_lijevo');
    if (!tab || tab._zapisnikIzvorSelekcijaBound) return;
    tab._zapisnikIzvorSelekcijaBound = true;
    var scroll = tab.querySelector('.kontrola-tablica__scroll');
    if (!scroll) return;
    scroll.addEventListener('click', function (e) {
      var tr = e.target && e.target.closest ? e.target.closest('tbody tr') : null;
      if (!tr || !scroll.contains(tr)) return;
      /* Sakriveni (<tr hidden>) retci ne selektiraju se. */
      if (tr.hidden) return;
      if (tab.classList.contains('kontrola-tablica--disabled')) return;
      var tbody = tab.querySelector('tbody');
      if (!tbody) return;
      zapisnikPrisustvoOcistiSelekcijuDesnogTbodyja();
      var sve = tbody.querySelectorAll('tr');
      var si;
      for (si = 0; si < sve.length; si++) {
        sve[si].classList.remove('tablica-row-selected');
      }
      tr.classList.add('tablica-row-selected');
      zapisnikPrisustvoAzurirajVidljivostHasSelectedLijevo();
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
      zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), false);
      try {
        scroll.focus({ preventScroll: true });
      } catch (ef) {}
    });
    /* Dvoklik: isti učinak kao trokut „udesno” (zapisnikPrisustvoKlikPremjestUDesno). */
    scroll.addEventListener('dblclick', function (eDblL) {
      var trUd = eDblL.target && eDblL.target.closest ? eDblL.target.closest('tbody tr') : null;
      if (!trUd || !scroll.contains(trUd)) return;
      if (trUd.hidden) return;
      if (tab.classList.contains('kontrola-tablica--disabled')) return;
      var tbodyUd = tab.querySelector('tbody');
      if (!tbodyUd) return;
      zapisnikPrisustvoOcistiSelekcijuDesnogTbodyja();
      var sveUd = tbodyUd.querySelectorAll('tr');
      var sj;
      for (sj = 0; sj < sveUd.length; sj++) {
        sveUd[sj].classList.remove('tablica-row-selected');
      }
      trUd.classList.add('tablica-row-selected');
      zapisnikPrisustvoAzurirajVidljivostHasSelectedLijevo();
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
      try {
        eDblL.preventDefault();
      } catch (_) {}
      zapisnikPrisustvoKlikPremjestUDesno();
    });
  }

  /**
   * Prazan <input type="date">: klasa date-empty; WebKit učitava „placeholder” u datetime-edit, ne ::placeholder.
   * Boja u CSS-u: var(--select_placeholder) kao .kontrola-select--placeholder (0-Kontrole.css).
   */
  function syncZapisnikDatumRadovaEmptyClass(el) {
    if (!el || el.type !== 'date') return;
    if (el.value === '') el.classList.add('date-empty');
    else el.classList.remove('date-empty');
  }

  /** Eskapiranje za innerHTML ćelije modala (naziv, grad, država iz baze). */
  function zapisnikEscapeHtml(unsafe) {
    return String(unsafe != null ? unsafe : '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Prikaz prvog stupca: samo ime lože u <strong>, grad i država ostaju običnim tekstom (odvojeni zarezom kao u sort tekstu).
   * @param {Array} row — [sortTekst_plain, id, naziv, grad, drzava]
   */
  function zapisnikModalHtmlZaCelijuLoze(row) {
    if (!row || row.length < 5) return '';
    var naz = row[2] != null ? trimZ(row[2]) : '';
    var gr = row[3] != null ? trimZ(row[3]) : '';
    var dr = row[4] != null ? trimZ(row[4]) : '';
    var dijelovi = [];
    if (naz) dijelovi.push('<strong>' + zapisnikEscapeHtml(naz) + '</strong>');
    var ostatak = [];
    if (gr) ostatak.push(zapisnikEscapeHtml(gr));
    if (dr) ostatak.push(zapisnikEscapeHtml(dr));
    if (ostatak.length) dijelovi.push(ostatak.join(', '));
    return dijelovi.join(dijelovi.length > 1 && naz ? ', ' : '');
  }

  /** Nakon što KontroleTablica iscrtaju plain tekst iz row[0], zamijeni s HTML-om bold naziva — isti red kao u snapshotu. */
  function zapisnikModalPrimijeniBoldNazivUPrikazu() {
    var rows = zapisnikModalLozeUcesniceSnapshot;
    if (!rows || !rows.length) return;
    var tbody = document.querySelector('.modal-tablica.modal-tablica--open .kontrola-tablica__scroll tbody');
    if (!tbody) return;
    var trs = tbody.querySelectorAll('tr');
    var ri;
    for (ri = 0; ri < trs.length; ri++) {
      var tr = trs[ri];
      var ix = parseInt(tr.dataset.rowIndex, 10);
      if (isNaN(ix)) ix = ri;
      if (ix < 0 || ix >= rows.length) continue;
      var inner = tr.querySelector('td .kontrola-tablica__cell-inner');
      if (!inner) continue;
      inner.innerHTML = zapisnikModalHtmlZaCelijuLoze(rows[ix]);
    }
  }

  /** Jedan red za sort/plain prikaz: naziv, grad, država odvojeni zarezom (isti redoslijed kao HTML). */
  function zapisnikModalFormatLozePodaciZarezom(o) {
    if (!o) return '';
    var parts = [];
    var nz = trimZ(o.naziv);
    var gr = trimZ(o.grad);
    var dr = trimZ(o.drzava_naziv);
    if (nz) parts.push(nz);
    if (gr) parts.push(gr);
    if (dr) parts.push(dr);
    return parts.join(', ');
  }

  /** Redovi za modal; svaki: [tekst_plain_za_sort, id, naziv, grad, drzava_naziv]. */
  function zapisnikModalDohvatiRedoveLozeIstiTip(callback) {
    var idLoza = zapisnikIdOdabraneLozISelecta();
    if (!idLoza) {
      if (typeof callback === 'function') callback([]);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', getApiUrl('Zapisnik_CRUD_loze_isti_tip_sve.php') + '?id_loza=' + encodeURIComponent(idLoza), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var rows = [];
      if (xhr.status >= 200 && xhr.status < 300) {
        var text = (xhr.responseText || '').replace(/^\uFEFF/, '').trim();
        var arr = [];
        try {
          arr = JSON.parse(text);
        } catch (e) {}
        if (!Array.isArray(arr)) arr = [];
        var i;
        for (i = 0; i < arr.length; i++) {
          var o = arr[i];
          if (!o || o.id == null) continue;
          var naz = o.naziv != null ? String(o.naziv) : '';
          var ug = trimZ(o.grad);
          var ud = trimZ(o.drzava_naziv);
          rows.push([zapisnikModalFormatLozePodaciZarezom(o), o.id, naz, ug, ud]);
        }
      }
      if (typeof callback === 'function') callback(rows);
    };
    xhr.send();
  }

  /**
   * Jedna loža kao jedna logička skupina za prelom retka u textarea (npr. „Sveti Ivan, Osijek, Hrvatska”).
   * Dijelovi se povezuju zarez + U+202F; obični razmaci unutar vrijednosti zamijene se s U+00A0 kako cijela skupina
   * ne bi bila lomljenja po riječima — pri nedostatku mjesta cjelina ide u novi red (prelom ostaje prirodan na '; ' između loža).
   * @param {Array} row — [sort, id, naziv, grad, država]
   */
  function zapisnikModalFormatJednaLozaZaTextarea(row) {
    if (!row || row.length < 5) return '';
    var nz = trimZ(row[2]);
    var gr = trimZ(row[3]);
    var dr = trimZ(row[4]);
    var dio = [];
    if (nz) dio.push(nz);
    if (gr) dio.push(gr);
    if (dr) dio.push(dr);
    var skupina = dio.join(',\u202f');
    /* Svi ASCII razmaci unutar jedne lože → neprekidni razmak; skupina ostaje na jednom vizualnom bloku. */
    skupina = skupina.replace(/ /g, '\u00A0');
    return skupina;
  }

  /** Koji id-jevi iz zapisnikLozeUcesniceKolekcijaId postoje u trenutnom skupu redova; redoslijed kao u kolekciji. */
  function zapisnikModalIdsZaPocetnuSelekciju(redovi) {
    var uRedu = {};
    var r;
    for (r = 0; r < redovi.length; r++) {
      var rz = redovi[r];
      if (rz && rz.length > 1 && rz[1] != null) uRedu[String(rz[1])] = true;
    }
    var k = zapisnikLozeUcesniceKolekcijaId || [];
    var out = [];
    for (var j = 0; j < k.length; j++) {
      var idStr = String(k[j]);
      if (uRedu[idStr]) out.push(idStr);
    }
    return out;
  }

  /**
   * Puna zamjena sadržaja textarea: novo stanje samo iz trenutačne multiselekcije tablice (nakon OK),
   * bez spajanja na prethodni tekst — jedan upis vrijednosti nakon što je modal već zatvoren (rAF u pozivatelju).
   */
  function zapisnikModalUpisiReadonlyTextareaUcesnice(idsOrder, rowsSnimka) {
    var ta = document.getElementById('zapisnik_loza_ucesnici');
    if (!ta || !rowsSnimka || !rowsSnimka.length) {
      /* Nema pouzdanog snapshota: polje kao prazno (nemešati sa starim ako nije došlo iz tablice). */
      if (ta) ta.value = '';
      return;
    }
    var byId = {};
    var i;
    for (i = 0; i < rowsSnimka.length; i++) {
      var row = rowsSnimka[i];
      if (row && row.length >= 5 && row[1] != null) byId[String(row[1])] = row;
    }
    var segmenti = [];
    for (i = 0; i < (idsOrder || []).length; i++) {
      var rw = byId[String(idsOrder[i])];
      if (!rw) continue;
      var seg = zapisnikModalFormatJednaLozaZaTextarea(rw);
      if (seg) segmenti.push(seg);
    }
    ta.value = segmenti.join('; ');
  }

  /** Kratka kopija snapshota za OK (primjerak prije close) da redovi ostanu konzistentni izboru. */
  function zapisnikModalKopijaSnapshotaLoze(sn) {
    if (!sn || !sn.length) return [];
    var out = [];
    var si;
    for (si = 0; si < sn.length; si++) {
      var r = sn[si];
      out.push(Array.isArray(r) ? r.slice() : r);
    }
    return out;
  }

  /**
   * Gumb OK u otvorenom modalu tablice: aktivno samo kad postoji barem jedan označeni redak.
   */
  function zapisnikModalSyncOkDisabledFromDom() {
    var root = document.querySelector('.modal-tablica.modal-tablica--open');
    if (!root) return;
    var nSel = root.querySelectorAll('.kontrola-tablica__scroll tbody tr.tablica-row-selected').length;
    var okBtn = root.querySelector('.modal-tablica__footer .kontrola-btn--primary');
    if (okBtn && 'disabled' in okBtn) okBtn.disabled = !(nSel > 0);
  }

  function zapisnikOtvoriModalLozeUcesnice() {
    if (typeof ModalTablicaInit !== 'function' || !modalZapisnikLozeUcesniceApi) return;
    zapisnikModalDohvatiRedoveLozeIstiTip(function (rows) {
      zapisnikModalLozeUcesniceSnapshot = rows;
      var preIds = zapisnikModalIdsZaPocetnuSelekciju(rows);
      modalZapisnikLozeUcesniceApi.open({
        zaglavlje: ZAGLAVLJE_MODAL_LOZE_UCESNICE,
        rows: rows,
        multiSelect: true,
        selectedRowIds: preIds,
        /* Nakon što se footer iscrtaju, rAF iz setSelectedRowIds postavlja disabled na OK-u. */
        onSelectionChange: zapisnikModalSyncOkDisabledFromDom,
        getRowId: function (row) {
          return row && row.length > 2 ? row[1] : '';
        }
      });
      requestAnimationFrame(function () {
        zapisnikModalPrimijeniBoldNazivUPrikazu();
        /* Ako nema odabranih id-jeva pri otvaranju setSelectedRowIds se ne poziva → onSelectionChange ne firea. */
        zapisnikModalSyncOkDisabledFromDom();
      });
    });
  }

  if (typeof ModalTablicaInit === 'function') {
    modalZapisnikLozeUcesniceApi = ModalTablicaInit({
      storageKey: 'zapisnik_loze_ucesnice',
      headerText: 'Lože učesnice radova',
      getButtons: function () {
        return [
          {
            label: 'OK',
            primary: true,
            onClick: function (tablicaApi) {
              var ids =
                tablicaApi && typeof tablicaApi.getSelectedRowIds === 'function'
                  ? tablicaApi.getSelectedRowIds()
                  : [];
              if (!ids.length) return;
              zapisnikLozeUcesniceKolekcijaId = ids.map(function (x) {
                return String(x);
              });
              /* Snapshot i id-jevi prije close — tablica u modalu još je konzistentna s ovim kopijama. */
              var kopijaSnapshota = zapisnikModalKopijaSnapshotaLoze(zapisnikModalLozeUcesniceSnapshot);
              if (modalZapisnikLozeUcesniceApi) modalZapisnikLozeUcesniceApi.close();
              /** Nakon zatvaranja polje se u jednoj akciji isprazni i puni selekcijom (ne miješanje s vrijednosti prije modalnog DOM-a). */
              requestAnimationFrame(function () {
                zapisnikModalUpisiReadonlyTextareaUcesnice(zapisnikLozeUcesniceKolekcijaId, kopijaSnapshota);
                zapisnikPrimijeniUvjeteUpisPdfGumba();
                /* Izvorna lista prisustva: članovi svih odabranih loža iz modala. */
                zapisnikPrisustvoOsvjeziIzvornuListuClanova();
              });
            }
          },
          {
            label: 'Odustani',
            className: 'kontrola-btn--crud-povratak',
            onClick: function () {
              /* Samo zatvaranje — close() pamti geometriju; bez mijenjanja textarea. */
              if (modalZapisnikLozeUcesniceApi) modalZapisnikLozeUcesniceApi.close();
            }
          }
        ];
      }
    });
  }

  function onReady() {
    var root = document.getElementById('zapisnikKontrolaTab');
    if (typeof KontroleTabInit === 'function') {
      KontroleTabInit(root);
    }
    if (root) {
      /* Tab promjena: sadržaj se mijenja (drugi tab) → ponovno izračunaj min. visinu za traku. */
      root.addEventListener('click', function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('.kontrola-tab__kartica')) {
          zapisnikScheduleMinVisinuResiza();
        }
      });
      root.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight' && ev.key !== 'Home' && ev.key !== 'End') return;
        if (!ev.target || !ev.target.closest || !ev.target.closest('.kontrola-tab__traka')) return;
        setTimeout(function () {
          zapisnikScheduleMinVisinuResiza();
        }, 0);
      });
    }
    /* Prije punjenja geo/lože: mod Upis vs Izmjeni i skriven Izbriši u modu novog zapisa. */
    zapisnikPrimijeniFooterPremaModuUpisa();

    /*
     * Geo zaglavlje (Država→Regija→Loža): listeneri prije ucitajPravaGeo — kao u Clanovi_Loza_CRUD
     * (u initFormi postoje kad stigne odgovor keša država/regija/loža).
     */
    if (selectDrzava) {
      selectDrzava.addEventListener('change', function () {
        var id = trimZ(this.value);
        popuniRegijeIzKeša(id, function () {
          zapisnikUpdateHeaderLogo();
          zapisnikSyncHeaderLogoSize();
        });
      });
    }
    if (selectRegija) {
      selectRegija.addEventListener('change', function () {
        var id = trimZ(this.value);
        popuniLozeIzKeša(id, function () {
          zapisnikUpdateHeaderLogo();
          zapisnikSyncHeaderLogoSize();
        });
      });
    }
    if (selectLoza) {
      selectLoza.addEventListener('change', function (ev) {
        /* Nova loža u zaglavlju → drugi skup kandidata u modalu — reset kolekcije učesnica (bez parsiranja textarea). */
        var selEl =
          ev.currentTarget && ev.currentTarget.tagName === 'SELECT'
            /** @type {HTMLSelectElement} */
            ? ev.currentTarget
            : selectLoza;

        function zapisnikPromijeniLozuUOsvjezi(idLozaParam) {
          zapisnikLozeUcesniceKolekcijaId = [];
          zapisnikPrisustvoOsvjeziIzvornuListuClanova();
          zapisnikUpdateHeaderLogo(idLozaParam);
          zapisnikSyncHeaderLogoSize();
          puniSelectStupanjRadovaZapisnik();
          zapisnikOsvjeziLoziGrupeIFormu(idLozaParam);
        }

        var idOdmah = zapisnikVrijednostSelektaZaLoz(selEl);
        if (idOdmah) {
          zapisnikPromijeniLozuUOsvjezi(idOdmah);
          return;
        }
        /* Zadnji pokušaj: u istoj milisekundi .value još može ostati ''; nakon mikrotaska je commitan za custom UI. */
        queueMicrotask(function () {
          zapisnikPromijeniLozuUOsvjezi(zapisnikVrijednostSelektaZaLoz(selEl));
        });
      });
    }

    /*
     * Jedan GET za keš država/regija/loža odmah nakon što su handleri vezani — prije paralelnih puniSelect.
     */
    ucitajPravaGeo(function () {
      zapisnikUpdateHeaderLogo();
      zapisnikSyncHeaderLogoSize();
      puniSelectStupanjRadovaZapisnik();
    });

    zapisnikPrisustvoInicStatickePrisustvoTabliceIzTokena();

    puniSelectTipRadovaZapisnik();
    puniSelectDrzavaPrisustvaZapisnik();
    puniSelectTipUnosaPrisustvaZapisnik();
    zapisnikPrisustvoInitFilterLijeveListe();
    zapisnikPrisustvoInitIzvornaListaSelekcija();
    zapisnikPrisustvoInitDesnaListaSelekcija();
    zapisnikPrisustvoInitGumbovePremjesaja();
    zapisnikPrisustvoInitPoljaZaSlobGumbUdDesno();
    var selTipPrisustvo = document.getElementById('zapisnik_prisustvo_tip_unosa');
    if (selTipPrisustvo) {
      selTipPrisustvo.addEventListener('change', function () {
        zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(!!zapisnikIdOdabraneLozISelecta(), true);
        /* Lijevo osvježiti prema novom tipu / GET-u; desna lista ostaje (premještaji + tip po retku za povratak). */
        zapisnikPrisustvoOsvjeziIzvornuListuClanova(undefined, { zadrziDesnuListu: true });
      });
    }

    var inpDatumRadova = document.getElementById('zapisnik_datum_radova');
    if (inpDatumRadova) {
      syncZapisnikDatumRadovaEmptyClass(inpDatumRadova);
      inpDatumRadova.addEventListener('change', function () {
        syncZapisnikDatumRadovaEmptyClass(inpDatumRadova);
        zapisnikPrimijeniUvjeteUpisPdfGumba();
      });
      inpDatumRadova.addEventListener('input', function () {
        syncZapisnikDatumRadovaEmptyClass(inpDatumRadova);
        zapisnikPrimijeniUvjeteUpisPdfGumba();
      });
    }

    var selStupanjRad = document.getElementById('zapisnik_select_stupanj_radova');
    if (selStupanjRad) selStupanjRad.addEventListener('change', zapisnikPrimijeniUvjeteUpisPdfGumba);
    var selTipRad = document.getElementById('zapisnik_select_tip_radova');
    if (selTipRad) selTipRad.addEventListener('change', zapisnikPrimijeniUvjeteUpisPdfGumba);

    if (selectRegija) selectRegija.disabled = true;
    if (selectLoza) selectLoza.disabled = true;
    zapisnikOsvjeziLoziGrupeIFormu();

    /* PDF zapisnika: placeholder do implementacije backend generiranja. */
    if (btnPdfZapisnik) {
      btnPdfZapisnik.addEventListener('click', function () {
        /* TODO: poziv API-ja / otvaranje generiranog PDF-a */
      });
    }

    /* Modal lože učesnice (ellipsis pored Tip radova): multiselect, OK → textarea „Lože koje su učestvovale…”. */
    if (bTipEllipsis) {
      bTipEllipsis.addEventListener('click', function () {
        if (bTipEllipsis.disabled) return;
        zapisnikOtvoriModalLozeUcesnice();
      });
    }

    if (typeof ResizeObserver !== 'undefined') {
      var kH = document.querySelector('.clanovi-loza-crud__tablica-header-kontrole');
      if (kH) {
        var roZ = new ResizeObserver(function () {
          zapisnikSyncHeaderLogoSize();
        });
        roZ.observe(kH);
      }
    }
    zapisnikSyncHeaderLogoSize();
    setTimeout(function () {
      zapisnikSyncHeaderLogoSize();
    }, 0);
    setTimeout(function () {
      zapisnikSyncHeaderLogoSize();
    }, 200);
    setTimeout(zapisnikScheduleMinVisinuResiza, 0);
    setTimeout(zapisnikScheduleMinVisinuResiza, 150);
    setTimeout(zapisnikScheduleMinVisinuResiza, 500);
    window.addEventListener('load', function () {
      zapisnikSyncHeaderLogoSize();
      zapisnikScheduleMinVisinuResiza();
    });
    window.addEventListener('resize', function () {
      if (_zapisnikMinHResizeT) clearTimeout(_zapisnikMinHResizeT);
      _zapisnikMinHResizeT = setTimeout(function () {
        _zapisnikMinHResizeT = null;
        zapisnikSyncHeaderLogoSize();
        zapisnikScheduleMinVisinuResiza();
      }, 200);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        zapisnikSyncHeaderLogoSize();
        zapisnikScheduleMinVisinuResiza();
      }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  /** Povratak: isti obrazac kao drugi CRUD (ref → referrer → Meni). Upis / Izbriši – logika s backendom kasnije. */
  (function initPovratak() {
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
})();
