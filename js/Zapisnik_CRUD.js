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
   * Dvoklik na redak: isto kao OK uz selekciju samo tog retka (open.rowDoubleClickLikePrimary).
   * Nakon OK: modal se zatvori, zatim u rAF puna zamjena textarea iz snapshota + getSelectedRowIds (ne miješanje sa starim prikazom).
   * Kolekcija id-jeva zapisnikLozeUcesniceKolekcijaId držan je u syncu s OK-om; ponovno otvaranje modala
   * obnavlja oznake redaka prema kolekciji (ne parsira textarea). Odustani zatvara bez izmjena.
   * Podaci: GET php/Zapisnik_CRUD_loze_isti_tip_sve.php?id_loza= (isti id_tip_loze kao odabrana loža).
   * Tablica: jedan stupac — u ćeliji naziv u <strong>, ostatak retka normalan; red [sortTekst, id, naziv, grad, država] —
   * prikaz nakon otvaranja: innerHTML jednostupanjski zamjena ćelije (KontroleTablica inicijalno postavi plain tekst).
   */

  /** Zadnji snimak redova pri otvaranju — bold HTML u ćeliji; OK puni textarea iz row[2–4] (naziv, grad, država). */
  var zapisnikModalLozeUcesniceSnapshot = null;
  /** Snimak redova modala Dužnosnika — nakon open() ćelije dobiju HTML (<strong>prezime ime</strong>, ostatak). */
  var zapisnikModalDuznosnikSnapshot = null;
  /** Id-jevi odabranih loža učesnica (stringovi), redoslijed kao zadnji potvrđeni OK — izvor istine za ponovno otvaranje modala. */
  var zapisnikLozeUcesniceKolekcijaId = [];
  /** ID trenutno učitanog/upisanog zapisnika (mod 1); null u modu 0. */
  var zapisnikTrenutniId = null;
  /** Row podataka lože domaćina [sortTekst, id, naziv, grad, drzava] — uvijek na vrhu textarea, ne pojavljuje se u modalu. */
  var zapisnikLozeDomacinRow = null;
  /** ID (string) lože domaćina — uvijek první u kolekciji. */
  var zapisnikLozeDomacinId = null;
  /** Članovi s GET Clanovi_CRUD_sve_loze.php — kao `data` + clanoviLozaPrimijeniTraži u Clanovi_Loza_CRUD (filtar po poljima iz JSON-a, ne po textContent-u ćelije). */
  var zapisnikPrisustvoClanoviIzvorData = [];
  /**
   * Premještaj članovi (lijevo → desna „prisustvo” lista), redoslijed kao korisnik.
   *
   * • id — id člana (`radovi_radovi_*` FK).
   * • fgCss — boja teksta za taj red na prebacivanju (#rrggbb ili prazno = sistemsko), iz opcije Tipa (`data-boja-prikaza`).
   * • tipUnosaId — string vrijednosti #zapisnik_prisustvo_tip_unosa u trenutku prebacivanja (`radovi_prisustvo_tip.id` kao string); za povratak / obnovu znaka koja je opcija pripala retku (starije zapise bez polja i dalje crtamo samo uz fgCss).
   * • prikazTekstZaClana — opcijski snimljeno „Prezime Ime · loža” za ćeliju desne tablice Prisustva (isti kao lijeva lista).
   * • duznosnikClanPolja — snimak { prezime, ime, loza_naziv, loza_grad, drzava_loze } pri premještaju udesno; ako novi GET zamijeni ClanoviIzvorData, modal Dužnosnika i edit i dalje koriste zarez-format (FormatPlain/Html), ne prikazTekstZaClana.
   * • slobodanUnos (+ tekstSlobPrikaz, idDrzaveGostiju) — opcija Tipa ima data-slobodan-unos=1: red nije FK na članove; id sintetički `su:N`, tekst Jedan red kao „Ime · loža · država”; id države iz #zapisnik_prisustvo_select_drzava.
   *
   * Reset: modal lože OK bez zadržavanja desnog, nova JSON lista lijevo ako nije `zadrziDesnuListu`, prazan skup loža (bez zadrži), ili pipe-greška od API-ja.
   */
  var zapisnikPrisustvoDesnoListaPoRedu = [];
  /** Broj paralelnih GET-ova liste članova (lijevo); kad pada na 0, skida se UI blokada u tabu Prisustvo. */
  var zapisnikPrisustvoListaLoadDepth = 0;
  /** Jedinstven sufiks za slobodan-unos redove u desnoj listi (`su` + ovaj broj u `entry.id`). */
  var zapisnikPrisustvoSlobUnosSuIdSuffix = 0;
  /** Inicijalizacija modala pri učitavanju (ModalTablicaInit). */
  var modalZapisnikLozeUcesniceApi = null;
  /** Modal jednostrukog odabira člana za polje Dužnosnika (storageKey modal_tablica_zapisnik_duznosnik_izbor). */
  var modalZapisnikDuznosnikIzborApi = null;
  /** Koje polje #edit_* puni zadnji OK modala dužnosnika — referenca do close/OK. */
  var zapisnikDuznosnikModalCiljniEditId = null;
  /** Podaci tabova Eseji: 5 redova [{ autor, naslov, tekst }]. */
  var zapisnikEsejiData = [
    { autor: '', naslov: '', tekst: '' },
    { autor: '', naslov: '', tekst: '' },
    { autor: '', naslov: '', tekst: '' },
    { autor: '', naslov: '', tekst: '' },
    { autor: '', naslov: '', tekst: '' }
  ];
  /** Indeks retka koji je trenutno otvoren u modalu za tekst eseja (-1 = zatvoren). */
  var zapisnikEsejModalTrenutniRed = -1;

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

  /*
   * ZAGLAVLJE — modal „Izbor dužnosnika” (jedan stupac, članovi iz desne tablice Prisustva).
   *
   * key — logičko ime stupca za sort po prikazanom tekstu.
   * title — tekst TH: „Prisutni članovi”.
   * sortable — 1 (korisnik može sortirati po ćeliji).
   * sortable_icon — 0 (bez posebne ikone ako zajednički CRUD tako očekuje).
   * type — 't' (tekstualna ćelija).
   * width — 0 (širina fleksibilna unutar tijela modala).
   * suffix — prazno.
   * align / row_align — L (lijevo).
   * mobitel_prikaz — 1 (stupac se prikazuje i na užem prikazu).
   */
  var ZAGLAVLJE_MODAL_DUZNOSNICI_PRISUTNI = [
    {
      key: 'podaci',
      title: 'Prisutni članovi',
      sortable: 1,
      sortable_icon: 0,
      type: 't',
      width: 0,
      suffix: '',
      align: 'L',
      row_align: 'L',
      mobitel_prikaz: 1
    }
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

  /*
   * Tab Dužnosnici: parovi editId / ellipsisId — grid (labela, edit-delete + ellipsis); okomita crta na .kontrola-tab__tijelo (:has ovaj panel).
   * Bez lože: omot edit-delete onemogućen (KontroleSetControlEnabled); s ložom: input readonly, vrijednost i data-zapisnik-clan-id iz modala „Izbor dužnosnika”; X briše tekst i ID. Ellipsis onemogućen bez lože.
   */
  var ZAPISNIK_DUZNOSNICI_REDOVI = [
    { editId: 'edit_casni_majstor', ellipsisId: 'ellipsis_casni_majstor' },
    { editId: 'edit_prvi_nadzornik', ellipsisId: 'ellipsis_prvi_nadzornik' },
    { editId: 'edit_drugi_nadzornik', ellipsisId: 'ellipsis_drugi_nadzornik' },
    { editId: 'edit_tajnik_loze', ellipsisId: 'ellipsis_tajnik_loze' },
    { editId: 'edit_govornik', ellipsisId: 'ellipsis_govornik' },
    { editId: 'edit_majstor_ceremonije', ellipsisId: 'ellipsis_majstor_ceremonije' },
    { editId: 'edit_prvi_dakon', ellipsisId: 'ellipsis_prvi_dakon' },
    { editId: 'edit_drugi_dakon', ellipsisId: 'ellipsis_drugi_dakon' },
    { editId: 'edit_unutarnji_cuvar_hrama', ellipsisId: 'ellipsis_unutarnji_cuvar_hrama' }
  ];

  /** Kartica „Dužnosnici”: minimalno prisutnih u desnoj tablici čiji je tip s radovi_prisustvo_tip.duznosnik_ok = 1. */
  var ZAPISNIK_MIN_PRISUTNIH_ZA_KARTICU_DUZNOSNICI = 5;

  /**
   * Primijeni disabled/readonly na sve redove Dužnosnika (isti obrasci kao textarea loža učesnica).
   * @param {boolean} smijeKarticaDuznosnika — true tek kad je kartica Dužnosnici omogućena (broj dužnosničkih prisutnih u desnoj tablici).
   */
  function zapisnikPrimijeniDuznosniciOvisnoLozi(smijeKarticaDuznosnika) {
    var di;
    var ima = !!smijeKarticaDuznosnika;
    for (di = 0; di < ZAPISNIK_DUZNOSNICI_REDOVI.length; di++) {
      var pair = ZAPISNIK_DUZNOSNICI_REDOVI[di];
      var editDu = document.getElementById(pair.editId);
      var ellDu = document.getElementById(pair.ellipsisId);
      var edWrap = editDu && editDu.closest ? editDu.closest('.kontrola-edit-delete') : null;
      if (edWrap && typeof KontroleSetControlEnabled === 'function') {
        KontroleSetControlEnabled(edWrap, ima);
      } else if (editDu) {
        /* Fallback ako struktura još nije .kontrola-edit-delete (stariji HTML). */
        editDu.disabled = !ima;
        editDu.readOnly = false;
      }
      if (editDu && ima && editDu.tagName === 'INPUT') {
        editDu.readOnly = true;
      }
      if (ellDu) ellDu.disabled = !ima;
    }
  }

  /**
   * „Prezime Ime” iz zapisa člana (isti redoslijed kao u modalu i editu Dužnosnika).
   * @param {{ prezime?: string, ime?: string }|null} r
   * @returns {string}
   */
  function zapisnikDuznosnikSastaviPrezimeImeIzPolja(r) {
    if (!r || typeof r !== 'object') return '';
    var p = trimZ(r.prezime);
    var ix = trimZ(r.ime);
    var ime = (p + (p && ix ? ' ' : '') + ix).trim();
    if (!ime) ime = p || ix || '';
    return ime;
  }

  /**
   * Jedinstveni plain tekst za sort u modalu i za usporedbe: „Prezime Ime, loža, grad, država” (prazni segmenti izostavljeni).
   * @param {{ prezime?: string, ime?: string, loza_naziv?: string, loza_grad?: string, drzava_loze?: string }|null} r
   * @returns {string}
   */
  function zapisnikDuznosnikFormatPlainClana(r) {
    if (!r || typeof r !== 'object') return '';
    var ime = zapisnikDuznosnikSastaviPrezimeImeIzPolja(r);
    var dijelovi = [];
    if (ime) dijelovi.push(ime);
    var lz = trimZ(r.loza_naziv);
    var lg = trimZ(r.loza_grad);
    var dLo = trimZ(r.drzava_loze);
    if (lz) dijelovi.push(lz);
    if (lg) dijelovi.push(lg);
    if (dLo) dijelovi.push(dLo);
    return dijelovi.join(', ');
  }

  /**
   * Je li `radovi_prisustvo_tip.id` (string u retku desne liste / value opcije) označen za UI odabira dužnosnika.
   * Izvor: opcije #zapisnik_prisustvo_tip_unosa — data-duznosnik-ok punjen iz Radovi_TipUnosaPrisutnih_CRUD_sve.php (duznosnik_ok).
   * @param {string} tipIdStr
   * @returns {boolean}
   */
  function zapisnikDuznosnikJeTipZaDuznosnika(tipIdStr) {
    var tid = trimZ(String(tipIdStr || ''));
    if (!tid) return false;
    var sel = document.getElementById('zapisnik_prisustvo_tip_unosa');
    if (!sel || !sel.options) return false;
    var oi;
    for (oi = 0; oi < sel.options.length; oi++) {
      var op = sel.options[oi];
      if (trimZ(op.value) === tid) return op.getAttribute('data-duznosnik-ok') === '1';
    }
    return false;
  }

  /**
   * Za uvjet kartice „Dužnosnici”: koliko je u desnoj listi Prisustva neslobodnih redaka čiji tip unosa ima duznosnik_ok (option data-duznosnik-ok=1).
   * @returns {number}
   */
  function zapisnikPrebrojiPrisutneSDuznosnikTipom() {
    var arr = zapisnikPrisustvoDesnoListaPoRedu || [];
    var cnt = 0;
    var i;
    for (i = 0; i < arr.length; i++) {
      var en = arr[i];
      if (!en || en.slobodanUnos) continue;
      var cid = en.id != null ? String(en.id) : '';
      if (!cid || cid.indexOf('su:') === 0) continue;
      var tipId = en.tipUnosaId != null ? trimZ(String(en.tipUnosaId)) : '';
      if (!zapisnikDuznosnikJeTipZaDuznosnika(tipId)) continue;
      cnt += 1;
    }
    return cnt;
  }

  /**
   * Polja za zarez/HTML prikaz Dužnosnika — kopija pri premještaju udesno kad još postoji zapis u kešu članova.
   * @param {{ prezime?: string, ime?: string, loza_naziv?: string, loza_grad?: string, drzava_loze?: string }|null} o
   * @returns {object|null}
   */
  function zapisnikSnimiPoljaZaDuznosnikaIzClana(o) {
    if (!o || typeof o !== 'object') return null;
    return {
      prezime: o.prezime,
      ime: o.ime,
      loza_naziv: o.loza_naziv,
      loza_grad: o.loza_grad,
      drzava_loze: o.drzava_loze
    };
  }

  /**
   * Za modal i edit Dužnosnika: prednost živom kešu iz GET-a; inače snimak na retku desne liste (nakon zamjene ClanoviIzvorData član može ostati samo na desnoj strani).
   * @param {string} cid id člana
   * @param {{ duznosnikClanPolja?: object }|null} entry red iz zapisnikPrisustvoDesnoListaPoRedu ili null
   * @returns {{ prezime?: string, ime?: string, loza_naziv?: string, loza_grad?: string, drzava_loze?: string }|null}
   */
  function zapisnikPrisustvoDohvatObjektClanaZaDuznosnika(cid, entry) {
    var oLive = zapisnikPrisustvoNadjiClanUOstavPodacimaPoId(cid);
    if (oLive) return oLive;
    var snap = entry && entry.duznosnikClanPolja;
    if (snap && typeof snap === 'object') return snap;
    return null;
  }

  /**
   * Za modal Dužnosnika: članovi koji već imaju dodjelu u bilo kojem od devet polja ne ulaze u listu (dataset.zapisnikClanId na omotu edit-delete).
   * @returns {Object.<string, boolean>}
   */
  function zapisnikDuznosnikMapaClanovaZaIskljucivanjeIzModala() {
    var map = {};
    var di;
    for (di = 0; di < ZAPISNIK_DUZNOSNICI_REDOVI.length; di++) {
      var editId = ZAPISNIK_DUZNOSNICI_REDOVI[di].editId;
      var inp = document.getElementById(editId);
      if (!inp || !inp.closest) continue;
      var wrap = inp.closest('.kontrola-edit-delete');
      var cid = wrap && wrap.dataset.zapisnikClanId ? trimZ(String(wrap.dataset.zapisnikClanId)) : '';
      if (cid) map[cid] = true;
    }
    return map;
  }

  /**
   * Formira redove za ModalTablicaInit: [plain_sort, id_člana, …opcijski polja za HTML ćelije].
   * Kad postoji član u kešu: [plain, cid, prezime, ime, loza_naziv, loza_grad, drzava_loze] — zapisnikModalPrimijeniBoldDuznosnikUPrikazu puni <strong> na prezime+ime.
   * Inače samo [plain, cid] — ćelija ostaje običan tekst (escape).
   * @param {Object.<string, boolean>} excludeMap
   * @returns {Array<Array>}
   */
  function zapisnikDuznosnikPripremiRedoveZaModal(excludeMap) {
    var arr = zapisnikPrisustvoDesnoListaPoRedu || [];
    var seen = {};
    var out = [];
    var i;
    for (i = 0; i < arr.length; i++) {
      var en = arr[i];
      if (!en || en.slobodanUnos) continue;
      var cid = en.id != null ? String(en.id) : '';
      if (!cid || cid.indexOf('su:') === 0) continue;
      if (seen[cid]) continue;
      var tipId = en.tipUnosaId != null ? trimZ(String(en.tipUnosaId)) : '';
      if (!zapisnikDuznosnikJeTipZaDuznosnika(tipId)) continue;
      if (excludeMap && excludeMap[cid]) continue;
      seen[cid] = true;
      var o = zapisnikPrisustvoDohvatObjektClanaZaDuznosnika(cid, en);
      var plain = o ? zapisnikDuznosnikFormatPlainClana(o) : trimZ(en.prikazTekstZaClana || '');
      if (!plain) plain = 'ID ' + cid;
      if (o) {
        out.push([
          plain,
          cid,
          trimZ(o.prezime),
          trimZ(o.ime),
          trimZ(o.loza_naziv),
          trimZ(o.loza_grad),
          trimZ(o.drzava_loze)
        ]);
      } else {
        out.push([plain, cid]);
      }
    }
    return out;
  }

  /**
   * Otvara modal jednostrukog izbora člana za jedno polje Dužnosnika (ellipsis ili dvoklik na input).
   * @param {string} editId npr. edit_casni_majstor
   */
  function zapisnikOtvoriModalDuznosnikaZaEdit(editId) {
    if (typeof ModalTablicaInit !== 'function' || !modalZapisnikDuznosnikIzborApi) return;
    if (!zapisnikIdOdabraneLozISelecta()) return;
    var exclude = zapisnikDuznosnikMapaClanovaZaIskljucivanjeIzModala();
    var rows = zapisnikDuznosnikPripremiRedoveZaModal(exclude);
    if (!rows.length) {
      if (typeof window.showPorukaModal === 'function') window.showPorukaModal('125');
      return;
    }
    zapisnikDuznosnikModalCiljniEditId = editId;
    zapisnikModalDuznosnikSnapshot = rows.map(function (rw) {
      return Array.isArray(rw) ? rw.slice() : rw;
    });
    modalZapisnikDuznosnikIzborApi.open({
      zaglavlje: ZAGLAVLJE_MODAL_DUZNOSNICI_PRISUTNI,
      rows: rows,
      multiSelect: false,
      rowDoubleClickLikePrimary: true,
      onSelectionChange: zapisnikModalSyncOkDisabledFromDom,
      getRowId: function (row) {
        return row && row.length > 1 ? String(row[1]) : '';
      }
    });
    requestAnimationFrame(function () {
      zapisnikModalPrimijeniBoldDuznosnikUPrikazu();
      zapisnikModalSyncOkDisabledFromDom();
    });
  }

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
   * Upis (#btnUpisi) i PDF (#zapisnik_btn_pdf): odabrana loža, datum radova popunjen, stupanj i tip (bez praznog
   * placeholdera), te učitani podaci lože domaćina (zapisnikLozeDomacinId — automatski pri odabiru lože). Inače disabled.
   */
  function zapisnikMozePrihvatUpisPdf() {
    if (!zapisnikIdOdabraneLozISelecta()) return false;
    var inpD = document.getElementById('zapisnik_datum_radova');
    if (!inpD || trimZ(inpD.value) === '') return false;
    var selS = document.getElementById('zapisnik_select_stupanj_radova');
    if (!selS || trimZ(selS.value) === '') return false;
    var selT = document.getElementById('zapisnik_select_tip_radova');
    if (!selT || trimZ(selT.value) === '') return false;
    return !!zapisnikLozeDomacinId;
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
   * Za kartice glavnog taba zapisnika: Podaci / Prisustvo / Dužnosnici / Zapisnik.
   * Prisustvo je dostupno tek kad je odabrana glavna loža i barem jedna loža učesnica (`zapisnikLozeUcesniceKolekcijaId` nakon modala).
   * Dužnosnici tek kad su u desnoj tablici Prisustva ispunjeni uvjeti (≥ ZAPISNIK_MIN_PRISUTNIH_ZA_KARTICU_DUZNOSNICI članova s tipom duznosnik_ok).
   * @param {boolean} imaLozu — odabrana glavna loža u zaglavlju
   * @returns {{ mozePrisustvo: boolean, mozeDuznosnici: boolean }}
   */
  function zapisnikIzracunajMozePrisustvoIDuznosniciZaTabove(imaLozu) {
    var imaBarLozUces = !!zapisnikLozeDomacinId ||
      (Array.isArray(zapisnikLozeUcesniceKolekcijaId) && zapisnikLozeUcesniceKolekcijaId.length > 0);
    var mozePrisustvo = !!imaLozu && imaBarLozUces;
    var mozeDuznosnici =
      mozePrisustvo &&
      zapisnikPrebrojiPrisutneSDuznosnikTipom() >= ZAPISNIK_MIN_PRISUTNIH_ZA_KARTICU_DUZNOSNICI;
    return { mozePrisustvo: mozePrisustvo, mozeDuznosnici: mozeDuznosnici };
  }

  /**
   * Ako je aktivna kartica ostala s klasom --aktivna ali je sada disabled (npr. promjena desne liste),
   * vrati fokus i prikaz na tab „Podaci” (indeks 0). Koristi se nakon ažuriranja disabled stanja kartica.
   * @param {Element|null} tabRoot #zapisnikKontrolaTab
   */
  function zapisnikTabVratiNaPodaciAkoAktivnaJeOnemogucena(tabRoot) {
    if (!tabRoot) return;
    var akt = tabRoot.querySelector('.kontrola-tab__kartica.kontrola-tab__kartica--aktivna');
    if (!akt || !akt.disabled) return;
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabRoot, 0);
    var k0 = document.getElementById('zapisnikKontrolaTabKart0');
    if (k0 && !k0.disabled) {
      try {
        k0.focus();
      } catch (ef) {}
    }
  }

  /**
   * Postavlja disabled na pojedinim karticama (ne jednako za sve). Kartice 0 i 3 = imaLozu; 1 = može Prisustvo; 2 = može Dužnosnici.
   * @param {boolean} imaLozu
   * @param {boolean} mozePrisustvo
   * @param {boolean} mozeDuznosnici
   */
  function zapisnikPrimijeniDisabledNaKarticeZapisnika(imaLozu, mozePrisustvo, mozeDuznosnici) {
    var map = [
      { id: 'zapisnikKontrolaTabKart0', ok: !!imaLozu },
      { id: 'zapisnikKontrolaTabKart1', ok: !!mozePrisustvo },
      { id: 'zapisnikKontrolaTabKart2', ok: !!mozeDuznosnici },
      { id: 'zapisnikKontrolaTabKart3', ok: !!imaLozu },
      { id: 'zapisnikKontrolaTabKart4', ok: !!imaLozu }
    ];
    var mi;
    for (mi = 0; mi < map.length; mi++) {
      var btn = document.getElementById(map[mi].id);
      if (!btn) continue;
      if (!map[mi].ok) btn.disabled = true;
      else btn.removeAttribute('disabled');
    }
  }

  /**
   * Capture na `.kontrola-tab__traka`: `0-Kontrole_Tab.js` ne preskače disabled kartice pri strelicama/Home/End.
   * Kada bi sljedeća kartica bila disabled, pronalazi sljedeću omogućenu u istom smjeru ili odustaje (sve disabled).
   * Ne mijenja globalni KontroleTabInit — samo Zapisnik_CRUD.
   * @param {KeyboardEvent} ev
   * @param {Element} tabRoot .kontrola-tab
   */
  function zapisnikKontrolaTabZaobilaziDisabledTipkovnica(ev, tabRoot) {
    var key = ev.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('kontrola-tab__kartica')) return;
    var kartice = tabRoot.querySelectorAll('.kontrola-tab__kartica');
    var tijelo = tabRoot.querySelector('.kontrola-tab__tijelo');
    if (!tijelo) return;
    var paneli = tijelo.querySelectorAll('.kontrola-tab__panel');
    var n = Math.min(kartice.length, paneli.length);
    if (n === 0) return;

    function indeksIzGumba(btn) {
      var j;
      var s;
      if (btn && btn.getAttribute) {
        s = btn.getAttribute('data-tab-index');
        if (s != null && s !== '') {
          var parsed = parseInt(s, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
      for (j = 0; j < kartice.length; j++) {
        if (kartice[j] === btn) return j;
      }
      return 0;
    }

    var cur = indeksIzGumba(t);
    var naiveNext = cur;
    if (key === 'ArrowLeft') naiveNext = (cur - 1 + n) % n;
    else if (key === 'ArrowRight') naiveNext = (cur + 1) % n;
    else if (key === 'Home') naiveNext = 0;
    else if (key === 'End') naiveNext = n - 1;

    if (kartice[naiveNext] && !kartice[naiveNext].disabled) return;

    var next = cur;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      var step = key === 'ArrowRight' ? 1 : -1;
      var tries = 0;
      next = cur;
      while (tries < n) {
        next = (next + step + n) % n;
        if (kartice[next] && !kartice[next].disabled) break;
        tries += 1;
      }
      if (tries >= n || next === cur) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
    } else if (key === 'Home') {
      next = -1;
      var hi;
      for (hi = 0; hi < n; hi++) {
        if (kartice[hi] && !kartice[hi].disabled) {
          next = hi;
          break;
        }
      }
      if (next < 0) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
    } else if (key === 'End') {
      next = -1;
      var ei;
      for (ei = n - 1; ei >= 0; ei--) {
        if (kartice[ei] && !kartice[ei].disabled) {
          next = ei;
          break;
        }
      }
      if (next < 0) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
    }

    if (next === cur) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return;
    }

    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (typeof kontrolaTabPostaviAktivni === 'function') kontrolaTabPostaviAktivni(tabRoot, next);
    if (kartice[next]) {
      try {
        kartice[next].focus();
      } catch (eFc) {}
    }
    setTimeout(function () {
      zapisnikScheduleMinVisinuResiza();
    }, 0);
  }

  /** Id-jevi čekboxova „Ovjera nakon usvajanja na radovima” (desna kolona u panelu Ovjera zapisnika). */
  var ZAPISNIK_OVJERA_NAKON_CB_IDS = [
    'zapisnik_cb_ovjera_nakon_casni_majstor',
    'zapisnik_cb_ovjera_nakon_tajnik',
    'zapisnik_cb_ovjera_nakon_govornik'
  ];

  /**
   * Čekbox u redu Ovjere: bez HTML disabled — zaključan red koristi .zapisnik-crud__ovjera-cb-red--samoprikaz (vidljivo checked/unchecked).
   * @param {HTMLInputElement|null} cbEl
   * @param {boolean} samoPrikaz true = nije klikabilan (ni labela)
   */
  function zapisnikPostaviOvjeraRedSamoprikaz(cbEl, samoPrikaz) {
    if (!cbEl || cbEl.type !== 'checkbox') return;
    var red = cbEl.closest && cbEl.closest('.zapisnik-crud__ovjera-cb-red');
    cbEl.disabled = false;
    if (samoPrikaz) {
      if (red) red.classList.add('zapisnik-crud__ovjera-cb-red--samoprikaz');
      cbEl.tabIndex = -1;
    } else {
      if (red) red.classList.remove('zapisnik-crud__ovjera-cb-red--samoprikaz');
      cbEl.removeAttribute('tabindex');
    }
  }

  /**
   * Panel „Ovjera zapisnika” (#zapisnikPodpanelOvjeraZapisnika):
   * • #zapisnik_cb_ovjera_prije_casni_majstor — interaktivan samo uz imaLozu; inače samo prikaz.
   * • Desna kolona — interaktivna samo ako imaLozu i lijevi čekbox checked; inače samo prikaz i bez oznake desno.
   * @param {boolean} imaLozu
   */
  function zapisnikOvjeraAzurirajKorisnikLabel(cb, jeChecked) {
    if (!cb) return;
    var red = cb.closest && cb.closest('.zapisnik-crud__ovjera-cb-red');
    if (!red) return;
    var span = red.querySelector('.zapisnik-crud__ovjera-korisnik-span');
    if (jeChecked) {
      var k = window.VNLH_TEKUCI_KORISNIK;
      if (!k || (!k.prezime && !k.ime)) return;
      var naziv = (k.prezime || '') + (k.prezime && k.ime ? ' ' : '') + (k.ime || '');
      cb.dataset.ovjeraKorisnikId = String(k.id);
      if (!span) {
        span = document.createElement('span');
        span.className = 'zapisnik-crud__ovjera-korisnik-span';
        red.appendChild(span);
      }
      span.textContent = '(' + naziv + ')';
    } else {
      if (span) span.parentNode.removeChild(span);
      delete cb.dataset.ovjeraKorisnikId;
    }
  }

  function zapisnikPrimijeniStanjeOvjereZapisnika(imaLozu) {
    var cbPrijeCm = document.getElementById('zapisnik_cb_ovjera_prije_casni_majstor');
    var mozeDesnuKolonu = !!imaLozu && !!(cbPrijeCm && cbPrijeCm.checked);
    zapisnikPostaviOvjeraRedSamoprikaz(cbPrijeCm, !imaLozu);
    var ix;
    for (ix = 0; ix < ZAPISNIK_OVJERA_NAKON_CB_IDS.length; ix++) {
      var cbN = document.getElementById(ZAPISNIK_OVJERA_NAKON_CB_IDS[ix]);
      if (!cbN) continue;
      if (!mozeDesnuKolonu) {
        cbN.checked = false;
        zapisnikOvjeraAzurirajKorisnikLabel(cbN, false);
        zapisnikPostaviOvjeraRedSamoprikaz(cbN, true);
      } else {
        zapisnikPostaviOvjeraRedSamoprikaz(cbN, false);
      }
    }
  }

  /**
   * Dok nije odabrana loža: tab (kartice), polja u prvom tabu, Upis / Izbriši su disabled. Povratak ostaje aktivan.
   * Prava zastavice: vnlhPrimijeniPravaCrud i dalje upravlja vidljivošću (hidden); ovdje samo disabled za vidljive gumbe.
   * Upis i PDF: vidi zapisnikMozePrihvatUpisPdf / zapisnikPrimijeniUvjeteUpisPdfGumba. Ikona „postojeći zapisnik”: disabled dok nema lože.
   * Kartica „Prisustvo”: disabled dok nema barem jednu ložu učesnicu (modal). Kartica „Dužnosnici”: disabled dok u desnoj tablici Prisustva nema dovoljno članova s tipom duznosnik_ok.
   * Ovjera zapisnika: čekboxovi bez HTML disabled — zaključani redovi .zapisnik-crud__ovjera-cb-red--samoprikaz (vidljivo checked). Inspektor (prije) samo prikaz stanja s druge forme; Časni majstor (prije) interaktivan uz ložu; desna kolona interaktivna samo ako ima ložu i oba lijeva čekboxa uključena (inače pražnjenje desno).
   * Kontrole u #zapisnikKontrolaTabPanel1 (uključ. tablice) slave isti uvjet kao kartica Prisustvo. Tab Dužnosnici: ZAPISNIK_DUZNOSNICI_REDOVI tek kad je kartica Dužnosnici smislena.
   * Izbriši: disabled kad nema lože, samo u modu korekcije vidljiv (mod_upisa_zapisnika=1) i uz brisanje_sloga.
   * Min. visina vanjskog panela s trakom: data-resize-min-px postavlja zapisnikScheduleMinVisinuResiza (sadržaj + 12px u tabu).
   * @param {string} [idLozaZaFormu] — ako zadan (npr. iz change na #select_loza), ima ložu se računa iz toga bez oslanjanja na .value koji u custom selectu u istome event tick-u još može nedostati.
   */
  function zapisnikPostaviKontroleOvisnoLozi(idLozaZaFormu) {
    var imaLozu =
      typeof idLozaZaFormu !== 'undefined'
        ? trimZ(idLozaZaFormu !== null ? String(idLozaZaFormu) : '') !== ''
        : !!zapisnikIdOdabraneLozISelecta();
    var stanjeTabova = zapisnikIzracunajMozePrisustvoIDuznosniciZaTabove(imaLozu);
    var mozePrisustvo = stanjeTabova.mozePrisustvo;
    var mozeDuznosnici = stanjeTabova.mozeDuznosnici;
    var tabRoot = document.getElementById('zapisnikKontrolaTab');
    if (tabRoot) {
      /* Vizual: Zapisnik_CRUD.css .zapisnik-crud__tab--onemogucen (sjene, boje labela, ugniježdeni panel). */
      tabRoot.classList.toggle('zapisnik-crud__tab--onemogucen', !imaLozu);
      zapisnikPrimijeniDisabledNaKarticeZapisnika(imaLozu, mozePrisustvo, mozeDuznosnici);
      zapisnikTabVratiNaPodaciAkoAktivnaJeOnemogucena(tabRoot);
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
    /* Ovjera zapisnika: posebna pravila — zapisnikPrimijeniStanjeOvjereZapisnika. */
    zapisnikPrimijeniStanjeOvjereZapisnika(imaLozu);
    /* Dužnosnici: svi redovi iz ZAPISNIK_DUZNOSNICI_REDOVI — aktivni tek kad je tab Dužnosnici dopušten brojem prisutnih dužnosničkih tipova. */
    zapisnikPrimijeniDuznosniciOvisnoLozi(mozeDuznosnici);
    /* Kartica Prisustvo: selekt / edita / razmjena / dvije jednostupčane tablice.
     * #zapisnik_prisustvo_tip_unosa se ne dira ovdje — disabled + label sinkron s brojem redaka u lijevom tbodyu (zapisnikPrisustvoPrimijeliRasporedLijevoIStanje). */
    var pk;
    var prisNodes = document.querySelectorAll('#zapisnikKontrolaTabPanel1 .zapisnik-crud__prisustvo-kontrola');
    for (pk = 0; pk < prisNodes.length; pk++) {
      var elPri = prisNodes[pk];
      if (!elPri) continue;
      if (elPri.id === 'zapisnik_prisustvo_tip_unosa') continue;
      if ('disabled' in elPri) elPri.disabled = !mozePrisustvo;
    }
    /* Tab Zapisnik: Sažetak + Tekst zapisnika — kao ostatak forme ovisno o odabiru glavne lože. */
    var zi;
    var zapisnikTekstNodes = document.querySelectorAll('#zapisnikKontrolaTabPanel3 .zapisnik-crud__zapisnik-kontrola');
    for (zi = 0; zi < zapisnikTekstNodes.length; zi++) {
      var elZap = zapisnikTekstNodes[zi];
      if (!elZap || !('disabled' in elZap)) continue;
      elZap.disabled = !imaLozu;
    }
    var esejiNodes = document.querySelectorAll('#zapisnikKontrolaTabPanel4 .zapisnik-crud__eseji-kontrola');
    var ei;
    for (ei = 0; ei < esejiNodes.length; ei++) {
      var elEsej = esejiNodes[ei];
      if (!elEsej || !('disabled' in elEsej)) continue;
      elEsej.disabled = !imaLozu;
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
   * Tip prisustva: na option data-slobodan-unos, data-svi-clanovi-obedijncije, data-duznosnik-ok (tab Dužnosnici — filtriranje desne liste u modalu), data-boja-prikaza.
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
        /* Odabir dužnosnika u tabu Dužnosnici: članovi u desnoj tablici samo ako je red tipa s radovi_prisustvo_tip.duznosnik_ok=1. */
        var duOk = row && row.duznosnik_ok;
        var dzOk = duOk === 1 || duOk === true || duOk === '1';
        optH.setAttribute('data-duznosnik-ok', dzOk ? '1' : '0');
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
   * Obje liste (lijevo i desno): aktivne ako je odabran Tip i ako je kontekst Prisustva dopušten (glavna loža + barem jedna loža učesnica iz modala — isto kao kartica „Prisustvo”).
   * Unutar toga: klasična lista, opcija Tipa s data-svi-clanovi-obedijncije=1 ili slobodan unos (isti rezultat kao prije uz dodatak modalnog uvjeta).
   * Lijevo→desno / desno→lijevo: samo kad je izvorna lista u režimu (nije slobodan unos s tri polja).
   * Tip unosa (#zapisnik_prisustvo_tip_unosa) + labela: disabled kad je lijevi tbody bez <tr>; iznimka ako je aktivna opcija Tipa s „slobodan unos” (lista lijevo namjerno prazna, unos je u tri polja).
   * @param {boolean} _legacyImaLozu zanemaren — stanje se uvijek čita iz selekta lože i zapisnikLozeUcesniceKolekcijaId (radi jednakih poziva iz starijih mjesta).
   */
  function zapisnikPrisustvoPrimijeliRasporedLijevoIStanje(_legacyImaLozu, rasporediVisinu) {
    var imaSelLozu = !!zapisnikIdOdabraneLozISelecta();
    var imaBarLozUces =
      Array.isArray(zapisnikLozeUcesniceKolekcijaId) && zapisnikLozeUcesniceKolekcijaId.length > 0;
    var kontekstPrisustvoOmogucen = imaSelLozu && imaBarLozUces;
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
    /* Liste: isti kontekst kao kartica Prisustvo + odabran Tip (tip bez vrijednosti → sve zamrznuto). */
    var izvorListeEnabled = kontekstPrisustvoOmogucen && hasTip;
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
   * Pretraga u tabu Prisustvo: samo tekst koji odgovara ćeliji liste (`zapisnikPrisustvoFormatTekstRetkaIzvor` —
   * prezime + ime + naziv lože ako postoji), lowercase i spojeno razmacima da podudaranje ne ovisi o znaku «·» u prikazu.
   * Ne uključuje šifru, stupanj, grad države lože itd. — to se u jednostupanjskoj ćeliji ne prikazuje.
   * @param {object} r red iz Clanovi_CRUD_sve_loze.json ili minimalnog Clanovi_CRUD_prisustvo_svi_obedijencija.php
   */
  function zapisnikPrisustvoHaystackZaTrazenjeKaoClanoviLoza(r) {
    if (!r || typeof r !== 'object') return '';
    var p = trimZ(r.prezime);
    var ix = trimZ(r.ime);
    var ime = (p + (p && ix ? ' ' : '') + ix).trim();
    if (!ime) ime = p || ix || '';
    var lz = trimZ(r.loza_naziv || '');
    var hay = (ime + (lz ? ' ' + lz : '')).trim().toLowerCase();
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
      if (entry.slobodanUnos) {
        var imeSZ = entry.imeSlobUnos != null ? String(entry.imeSlobUnos) : '';
        var lozaSZ = entry.lozaSlobUnos != null ? String(entry.lozaSlobUnos) : '';
        if (imeSZ) tr.setAttribute('data-ime-prezime', imeSZ); else tr.removeAttribute('data-ime-prezime');
        if (lozaSZ) tr.setAttribute('data-loza', lozaSZ); else tr.removeAttribute('data-loza');
      } else {
        tr.removeAttribute('data-ime-prezime');
        tr.removeAttribute('data-loza');
      }
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
   * Premještaj je moguć samo kad je kontekst isti kao za karticu Prisustvo: glavna loža + barem jedna loža učesnica (`zapisnikLozeUcesniceKolekcijaId`) i odabran Tip.
   */
  function zapisnikPrisustvoAzurirajGumbovePremjestaja() {
    var bUde = document.getElementById('zapisnik_prisustvo_btn_udesno');
    var bUli = document.getElementById('zapisnik_prisustvo_btn_ulijevo');
    var selTipEl = document.getElementById('zapisnik_prisustvo_tip_unosa');
    var tipVal = selTipEl ? trimZ(selTipEl.value) : '';
    var hasTip = !!tipVal;
    var slobUnosJedan = false;
    if (selTipEl && selTipEl.selectedIndex > 0) {
      var opT = selTipEl.options[selTipEl.selectedIndex];
      slobUnosJedan = !!(opT && opT.getAttribute('data-slobodan-unos') === '1');
    }
    var mozePrisustvoXfer =
      !!zapisnikIdOdabraneLozISelecta() &&
      Array.isArray(zapisnikLozeUcesniceKolekcijaId) &&
      zapisnikLozeUcesniceKolekcijaId.length > 0;
    var xferOk = mozePrisustvoXfer && hasTip;
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
        imeSlobUnos: imeT,
        lozaSlobUnos: lozaT,
        tekstSlobPrikaz: tekstLin
      });
      zapisnikPrisustvoIzgradiDesnuTbodyIzListe();
      zapisnikPrisustvoOcistiPoljaSlobUnosaZaNovuOsobu();
      zapisnikPrisustvoAzurirajGumbovePremjestaja();
      zapisnikPostaviKontroleOvisnoLozi();
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
      prikazTekstZaClana: tekstZaCl,
      duznosnikClanPolja: zapisnikSnimiPoljaZaDuznosnikaIzClana(oZaPrikaz)
    });
    zapisnikPrisustvoIzgradiDesnuTbodyIzListe();
    zapisnikPrisustvoOsvjeziLijevoTbodyIzCacheBezPremjestenih();
    zapisnikPrisustvoAzurirajGumbovePremjestaja();
    zapisnikPostaviKontroleOvisnoLozi();
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
    zapisnikPostaviKontroleOvisnoLozi();
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
   * Vizualna blokada taba Prisustvo tijekom async GET-a liste članova: sve osim selecta Tip unosa i njegove labele (pointer-events + lagani vizualni „waiting”).
   * @param {boolean} blok — true na početku učitavanja, false nakon obrade odgovora
   */
  function zapisnikPrisustvoPrimijeniUITijekomUcitavanjeListe(blok) {
    var wrap = document.querySelector('#zapisnikKontrolaTabPanel1 .zapisnik-crud__prisustvo-wrap');
    if (!wrap) return;
    if (blok) {
      wrap.classList.add('zapisnik-crud__prisustvo-wrap--lista-loading');
      wrap.setAttribute('aria-busy', 'true');
    } else {
      wrap.classList.remove('zapisnik-crud__prisustvo-wrap--lista-loading');
      wrap.removeAttribute('aria-busy');
    }
  }

  /** Učitavanje liste (XHR): zapocni + dubina — blokada ostaje dok ima neriješenih zahtjeva (više brzih promjena Tipa). */
  function zapisnikPrisustvoZapocniUcitavanjeListeZaTip() {
    zapisnikPrisustvoListaLoadDepth += 1;
    if (zapisnikPrisustvoListaLoadDepth === 1) zapisnikPrisustvoPrimijeniUITijekomUcitavanjeListe(true);
  }

  /** Poziva se iz obrade odgovora nakon što je lista primijenjena u DOM (uvijek uparen sa Zapocni kad je bio XHR). */
  function zapisnikPrisustvoZavrsiUcitavanjeListeZaTip() {
    if (zapisnikPrisustvoListaLoadDepth <= 0) return;
    zapisnikPrisustvoListaLoadDepth -= 1;
    if (zapisnikPrisustvoListaLoadDepth === 0) zapisnikPrisustvoPrimijeniUITijekomUcitavanjeListe(false);
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
      zapisnikPostaviKontroleOvisnoLozi();
      zapisnikPrisustvoZavrsiUcitavanjeListeZaTip();
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
    zapisnikPostaviKontroleOvisnoLozi();
    zapisnikPrisustvoZavrsiUcitavanjeListeZaTip();
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
      zapisnikPrisustvoZapocniUcitavanjeListeZaTip();
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
    /* Domaćin uvijek u listi — može biti jedini učesnik ako modal nije korišten. */
    if (zapisnikLozeDomacinId) {
      var domN = parseInt(String(zapisnikLozeDomacinId), 10);
      if (!isNaN(domN) && domN > 0) { seen[String(domN)] = true; idList.push(domN); }
    }
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
      zapisnikPostaviKontroleOvisnoLozi();
      if (typeof callback === 'function') callback();
      return;
    }
    zapisnikPrisustvoZapocniUcitavanjeListeZaTip();
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
   * HTML za prikaz člana u modalu Dužnosnika i u rich edit-delete polju: samo prezime i ime u <strong>, ostatak običnim tekstom (zarez + razmak kao u plain liniji).
   * @param {{ prezime?: string, ime?: string, loza_naziv?: string, loza_grad?: string, drzava_loze?: string }|null} r
   * @returns {string}
   */
  function zapisnikDuznosnikFormatHtmlClana(r) {
    if (!r || typeof r !== 'object') return '';
    var ime = zapisnikDuznosnikSastaviPrezimeImeIzPolja(r);
    var lz = trimZ(r.loza_naziv);
    var lg = trimZ(r.loza_grad);
    var dLo = trimZ(r.drzava_loze);
    var ostatak = [];
    if (lz) ostatak.push(zapisnikEscapeHtml(lz));
    if (lg) ostatak.push(zapisnikEscapeHtml(lg));
    if (dLo) ostatak.push(zapisnikEscapeHtml(dLo));
    var tail = ostatak.join(', ');
    if (ime && tail) return '<strong>' + zapisnikEscapeHtml(ime) + '</strong>, ' + tail;
    if (ime) return '<strong>' + zapisnikEscapeHtml(ime) + '</strong>';
    return tail;
  }

  /**
   * Jedna ćelija modala Dužnosnika: ako je red proširen s podacima člana (≥7 elemenata), HTML kao u edit polju; inače samo escape plain teksta iz row[0].
   * @param {Array} row
   * @returns {string}
   */
  function zapisnikModalHtmlZaCelijuDuznosnik(row) {
    if (!row || row.length < 2) return '';
    if (row.length >= 7) {
      var fake = {
        prezime: row[2],
        ime: row[3],
        loza_naziv: row[4],
        loza_grad: row[5],
        drzava_loze: row[6]
      };
      return zapisnikDuznosnikFormatHtmlClana(fake);
    }
    return zapisnikEscapeHtml(row[0]);
  }

  /** Nakon KontroleTablica plain teksta u modalu Dužnosnika, zamijeni innerHTML (bold prezime ime). */
  function zapisnikModalPrimijeniBoldDuznosnikUPrikazu() {
    var rows = zapisnikModalDuznosnikSnapshot;
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
      inner.innerHTML = zapisnikModalHtmlZaCelijuDuznosnik(rows[ix]);
    }
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
        var idDomacinStr = String(idLoza);
        zapisnikLozeDomacinRow = null;
        zapisnikLozeDomacinId = null;
        for (i = 0; i < arr.length; i++) {
          var o = arr[i];
          if (!o || o.id == null) continue;
          var naz = o.naziv != null ? String(o.naziv) : '';
          var ug = trimZ(o.grad);
          var ud = trimZ(o.drzava_naziv);
          var row = [zapisnikModalFormatLozePodaciZarezom(o), o.id, naz, ug, ud];
          if (String(o.id) === idDomacinStr) {
            zapisnikLozeDomacinRow = row;
            zapisnikLozeDomacinId = idDomacinStr;
          } else {
            rows.push(row);
          }
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
    if (!ta) return;
    var segmenti = [];
    /* Loža domaćin uvijek na prvom mjestu. */
    if (zapisnikLozeDomacinRow) {
      var segDom = zapisnikModalFormatJednaLozaZaTextarea(zapisnikLozeDomacinRow);
      if (segDom) segmenti.push(segDom);
    }
    if (rowsSnimka && rowsSnimka.length) {
      var byId = {};
      var i;
      for (i = 0; i < rowsSnimka.length; i++) {
        var row = rowsSnimka[i];
        if (row && row.length >= 5 && row[1] != null) byId[String(row[1])] = row;
      }
      for (i = 0; i < (idsOrder || []).length; i++) {
        var rw = byId[String(idsOrder[i])];
        if (!rw) continue;
        var seg = zapisnikModalFormatJednaLozaZaTextarea(rw);
        if (seg) segmenti.push(seg);
      }
    }
    ta.value = segmenti.join('; ');
    zapisnikPrisustvoOsvjeziIzvornuListuClanova();
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

  function zapisnikModalLozeUcesniceEnableOk() {
    var root = document.querySelector('.modal-tablica.modal-tablica--open');
    if (!root) return;
    var okBtn = root.querySelector('.modal-tablica__footer .kontrola-btn--primary');
    if (okBtn && 'disabled' in okBtn) okBtn.disabled = false;
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
        onSelectionChange: zapisnikModalLozeUcesniceEnableOk,
        /* Dvoklik na redak: isto kao OK uz selekciju samo tog retka (ModalTablicaInit + 0-Kontrole.js). */
        rowDoubleClickLikePrimary: true,
        getRowId: function (row) {
          return row && row.length > 2 ? row[1] : '';
        }
      });
      requestAnimationFrame(function () {
        zapisnikModalPrimijeniBoldNazivUPrikazu();
        zapisnikModalLozeUcesniceEnableOk();
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
              zapisnikLozeUcesniceKolekcijaId = ids.map(function (x) {
                return String(x);
              });
              /* Loža domaćin uvijek na čelu kolekcije (za prisustvo i logičke provjere). */
              if (zapisnikLozeDomacinId && zapisnikLozeUcesniceKolekcijaId.indexOf(zapisnikLozeDomacinId) === -1) {
                zapisnikLozeUcesniceKolekcijaId.unshift(zapisnikLozeDomacinId);
              }
              /* Snapshot i id-jevi prije close — tablica u modalu još je konzistentna s ovim kopijama. */
              var kopijaSnapshota = zapisnikModalKopijaSnapshotaLoze(zapisnikModalLozeUcesniceSnapshot);
              if (modalZapisnikLozeUcesniceApi) modalZapisnikLozeUcesniceApi.close();
              /** Nakon zatvaranja polje se u jednoj akciji isprazni i puni selekcijom (ne miješanje s vrijednosti prije modalnog DOM-a). */
              requestAnimationFrame(function () {
                zapisnikModalUpisiReadonlyTextareaUcesnice(zapisnikLozeUcesniceKolekcijaId, kopijaSnapshota);
                zapisnikPrimijeniUvjeteUpisPdfGumba();
                /* Kartica Prisustvo i Dužnosnici ovise o kolekciji — osvježi prije async GET-a liste članova. */
                zapisnikPostaviKontroleOvisnoLozi();
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
    modalZapisnikDuznosnikIzborApi = ModalTablicaInit({
      storageKey: 'zapisnik_duznosnik_izbor',
      headerText: 'Izbor dužnosnika',
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
              var cid = String(ids[0]);
              var editId = zapisnikDuznosnikModalCiljniEditId;
              var inp = editId ? document.getElementById(editId) : null;
              if (!inp) {
                zapisnikDuznosnikModalCiljniEditId = null;
                if (modalZapisnikDuznosnikIzborApi) modalZapisnikDuznosnikIzborApi.close();
                return;
              }
              var arrF = zapisnikPrisustvoDesnoListaPoRedu || [];
              var enSel = null;
              var jf;
              for (jf = 0; jf < arrF.length; jf++) {
                var enCand = arrF[jf];
                if (enCand && String(enCand.id) === cid) {
                  enSel = enCand;
                  break;
                }
              }
              var oOk = zapisnikPrisustvoDohvatObjektClanaZaDuznosnika(cid, enSel);
              var htmlPrikaz = '';
              if (oOk) htmlPrikaz = zapisnikDuznosnikFormatHtmlClana(oOk);
              if (!htmlPrikaz) {
                var plainFb = enSel && enSel.prikazTekstZaClana ? trimZ(enSel.prikazTekstZaClana) : '';
                if (!plainFb) plainFb = 'ID ' + cid;
                htmlPrikaz = zapisnikEscapeHtml(plainFb);
              }
              inp.innerHTML = htmlPrikaz;
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));
              var wrapOk = inp.closest('.kontrola-edit-delete');
              if (wrapOk) wrapOk.dataset.zapisnikClanId = cid;
              zapisnikDuznosnikModalCiljniEditId = null;
              if (modalZapisnikDuznosnikIzborApi) modalZapisnikDuznosnikIzborApi.close();
            }
          },
          {
            label: 'Odustani',
            className: 'kontrola-btn--crud-povratak',
            onClick: function () {
              zapisnikDuznosnikModalCiljniEditId = null;
              if (modalZapisnikDuznosnikIzborApi) modalZapisnikDuznosnikIzborApi.close();
            }
          }
        ];
      }
    });
  }

  /**
   * Omot .zapisnik-crud__wrap (sadrži cijeli panel) i naslov .naslov-forme: sprječava HTML5 drag-and-drop (ispust datoteke u prozor).
   */
  function zapisnikOnemoguciDragDropNaPanelu() {
    var wrap = document.querySelector('.zapisnik-crud__wrap');
    var naslov = document.querySelector('.naslov-forme');
    var roots = [];
    if (wrap) roots.push(wrap);
    if (naslov) roots.push(naslov);
    var ri;
    for (ri = 0; ri < roots.length; ri++) {
      (function (root) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (evtName) {
          root.addEventListener(
            evtName,
            function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
            },
            false
          );
        });
      })(roots[ri]);
    }
  }

  var ZAPISNIK_DUZNOSNICI_ENUM_MAP = [
    { editId: 'edit_casni_majstor',          naziv: 'Časni majstor' },
    { editId: 'edit_prvi_nadzornik',         naziv: 'Prvi nadzornik' },
    { editId: 'edit_drugi_nadzornik',        naziv: 'Drugi nadzornik' },
    { editId: 'edit_tajnik_loze',            naziv: 'Tajnik lože' },
    { editId: 'edit_govornik',               naziv: 'Govornik' },
    { editId: 'edit_majstor_ceremonije',     naziv: 'Majstor ceremonije' },
    { editId: 'edit_prvi_dakon',             naziv: 'Prvi đakon' },
    { editId: 'edit_drugi_dakon',            naziv: 'Drugi đakon' },
    { editId: 'edit_unutarnji_cuvar_hrama',  naziv: 'Unutarnji čuvar hrama' }
  ];

  function zapisnikSakupiPayload() {
    var idLoza = zapisnikIdOdabraneLozISelecta();
    var inpD = document.getElementById('zapisnik_datum_radova');
    var selS = document.getElementById('zapisnik_select_stupanj_radova');
    var selT = document.getElementById('zapisnik_select_tip_radova');
    var cbPrijeCm  = document.getElementById('zapisnik_cb_ovjera_prije_casni_majstor');
    var cbNakonCm  = document.getElementById('zapisnik_cb_ovjera_nakon_casni_majstor');
    var cbNakonTj  = document.getElementById('zapisnik_cb_ovjera_nakon_tajnik');
    var cbNakonGv  = document.getElementById('zapisnik_cb_ovjera_nakon_govornik');
    var taS = document.getElementById('zapisnik_edit_sazetak');
    var taT = document.getElementById('zapisnik_edit_tekst');

    var domIdStr = zapisnikLozeDomacinId ? String(zapisnikLozeDomacinId) : '';
    var lozeIds = [];
    var k = zapisnikLozeUcesniceKolekcijaId || [];
    for (var li = 0; li < k.length; li++) {
      if (String(k[li]) !== domIdStr) lozeIds.push(parseInt(k[li], 10));
    }

    var prisutni = [];
    var tDesno = document.getElementById('zapisnik_prisustvo_tablica_desno');
    if (tDesno) {
      var trs = tDesno.querySelectorAll('tbody tr');
      for (var ri = 0; ri < trs.length; ri++) {
        var tr = trs[ri];
        var tipIdVal = tr.getAttribute('data-tip-unosa-id') || '';
        var rowId = tr.getAttribute('data-row-id') || '';
        var tipInt = tipIdVal ? parseInt(tipIdVal, 10) : null;
        if (rowId.indexOf('su:') === 0) {
          var drSl = tr.getAttribute('data-drzava-id') || null;
          prisutni.push({
            id_clana: null,
            id_prisustvo_tip: tipInt,
            ime_i_prezime: tr.getAttribute('data-ime-prezime') || null,
            loza: tr.getAttribute('data-loza') || null,
            id_drzave: drSl ? parseInt(drSl, 10) : null
          });
        } else {
          prisutni.push({
            id_clana: rowId ? parseInt(rowId, 10) : null,
            id_prisustvo_tip: tipInt,
            ime_i_prezime: null,
            loza: null,
            id_drzave: null
          });
        }
      }
    }

    var duznosnici = [];
    for (var di = 0; di < ZAPISNIK_DUZNOSNICI_ENUM_MAP.length; di++) {
      var dm = ZAPISNIK_DUZNOSNICI_ENUM_MAP[di];
      var editEl = document.getElementById(dm.editId);
      var wrapEl = editEl ? editEl.closest('.kontrola-edit-delete') : null;
      var cid = wrapEl && wrapEl.dataset.zapisnikClanId ? trimZ(String(wrapEl.dataset.zapisnikClanId)) : '';
      if (cid) duznosnici.push({ naziv_duznosti: dm.naziv, id_clana: parseInt(cid, 10) });
    }

    function cbVal(cb) { return cb && cb.checked ? 1 : 0; }
    function cbId(cb)  { return cb && cb.checked && cb.dataset.ovjeraKorisnikId ? parseInt(cb.dataset.ovjeraKorisnikId, 10) : null; }

    return {
      id_domacin:              idLoza ? parseInt(idLoza, 10) : null,
      id_stupanj:              selS && selS.value ? parseInt(selS.value, 10) : null,
      id_tip_radova:           selT && selT.value ? parseInt(selT.value, 10) : null,
      datum_radova:            inpD ? trimZ(inpD.value) || null : null,
      ovjera_prije_casni:      cbVal(cbPrijeCm),
      ovjera_prije_casni_id:   cbId(cbPrijeCm),
      ovjera_poslije_casni:    cbVal(cbNakonCm),
      ovjera_poslije_casni_id: cbId(cbNakonCm),
      ovjera_poslije_tajnik:    cbVal(cbNakonTj),
      ovjera_poslije_tajnik_id: cbId(cbNakonTj),
      ovjera_poslije_govornik:    cbVal(cbNakonGv),
      ovjera_poslije_govornik_id: cbId(cbNakonGv),
      sazetak:       taS ? trimZ(taS.value) || null : null,
      zapisnik:      taT ? trimZ(taT.value) || null : null,
      loze_ucesnice: lozeIds,
      prisutni:      prisutni,
      duznosnici:    duznosnici,
      eseji:         zapisnikEsejiData.map(function (d) {
        return { autor: trimZ(d.autor) || null, naslov: trimZ(d.naslov) || null, tekst: trimZ(d.tekst) || null };
      }),
      eseji_sazetak: (function () { var el = document.getElementById('zapisnik_eseji_sazetak'); return el ? trimZ(el.value) || null : null; }())
    };
  }

  function zapisnikOcistiSvuFormu() {
    /* Stanje upisa — reset na novi zapis */
    zapisnikTrenutniId = null;
    window.mod_upisa_zapisnika = 0;

    /* Loža učesnica: guest lože se brišu, domaćin ostaje (kolekcija prazna, textarea piše samo domaćin) */
    zapisnikLozeUcesniceKolekcijaId = [];
    zapisnikModalUpisiReadonlyTextareaUcesnice([], null);

    /* Datum, stupanj, tip */
    var inpD = document.getElementById('zapisnik_datum_radova');
    if (inpD) { inpD.value = ''; inpD.classList.add('date-empty'); }
    var selS = document.getElementById('zapisnik_select_stupanj_radova');
    if (selS) { selS.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_stupanj_radova'); }
    var selT = document.getElementById('zapisnik_select_tip_radova');
    if (selT) { selT.value = ''; if (typeof KontroleRefreshCustomSelect === 'function') KontroleRefreshCustomSelect('zapisnik_select_tip_radova'); }

    /* Ovjera čekboxovi + korisnik spanovi */
    var cbIds = ['zapisnik_cb_ovjera_prije_casni_majstor', 'zapisnik_cb_ovjera_nakon_casni_majstor', 'zapisnik_cb_ovjera_nakon_tajnik', 'zapisnik_cb_ovjera_nakon_govornik'];
    for (var ci = 0; ci < cbIds.length; ci++) {
      var cb = document.getElementById(cbIds[ci]);
      if (!cb) continue;
      if (cb.checked) { cb.checked = false; zapisnikOvjeraAzurirajKorisnikLabel(cb, false); }
      delete cb.dataset.ovjeraKorisnikId;
    }

    /* Sažetak i tekst zapisnika */
    var taS = document.getElementById('zapisnik_edit_sazetak');
    if (taS) taS.value = '';
    var taT = document.getElementById('zapisnik_edit_tekst');
    if (taT) taT.value = '';

    /* Eseji */
    var esejCont = document.getElementById('zapisnikEsejiTablica');
    var esejTbody = esejCont ? esejCont.querySelector('.kontrola-tablica__scroll tbody') : null;
    for (var esi = 0; esi < zapisnikEsejiData.length; esi++) {
      zapisnikEsejiData[esi] = { autor: '', naslov: '', tekst: '' };
      if (esejTbody) {
        var esejTr = esejTbody.querySelector('tr[data-esej-red="' + esi + '"]');
        if (esejTr) {
          var esejSpA = esejTr.querySelector('td:first-child .kontrola-tablica__cell-inner');
          var esejSpN = esejTr.querySelector('td:nth-child(2) .kontrola-tablica__cell-inner');
          if (esejSpA) esejSpA.textContent = '';
          if (esejSpN) esejSpN.textContent = '';
        }
      }
    }
    var esejTaSaz = document.getElementById('zapisnik_eseji_sazetak');
    if (esejTaSaz) esejTaSaz.value = '';
    /* Osvježi ikone (sve prazne → ellipsis samo u redu 0, trash skriven svugdje) */
    (function () {
      if (!esejTbody) return;
      var esejRows = esejTbody.querySelectorAll('tr[data-esej-red]');
      for (var er = 0; er < esejRows.length; er++) {
        var eBtnEl = esejRows[er].querySelector('.zapisnik-crud__eseji-btn--elipsis');
        var eBtnBr = esejRows[er].querySelector('.zapisnik-crud__eseji-btn--brisanje');
        if (eBtnEl) eBtnEl.hidden = (er !== 0);
        if (eBtnBr) eBtnBr.hidden = true;
      }
    }());

    /* Dužnosnici editi */
    for (var di = 0; di < ZAPISNIK_DUZNOSNICI_ENUM_MAP.length; di++) {
      var editEl = document.getElementById(ZAPISNIK_DUZNOSNICI_ENUM_MAP[di].editId);
      if (editEl) { editEl.innerHTML = ''; editEl.dispatchEvent(new Event('input', { bubbles: true })); }
      var wrapEl = editEl ? editEl.closest('.kontrola-edit-delete') : null;
      if (wrapEl) delete wrapEl.dataset.zapisnikClanId;
    }

    /* Prisustvo — desna lista */
    zapisnikPrisustvoDesnoListaPoRedu = [];
    zapisnikPrisustvoIzgradiDesnuTbodyIzListe();

    /* Osvježi stanje forme i gumba */
    zapisnikPostaviKontroleOvisnoLozi();
    zapisnikPrimijeniUvjeteUpisPdfGumba();
  }

  function zapisnikPostJson(url, payload, onDone) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      onDone((xhr.responseText || '').trim(), xhr.status);
    };
    xhr.send(JSON.stringify(payload));
  }

  function onReady() {
    var root = document.getElementById('zapisnikKontrolaTab');
    if (typeof KontroleTabInit === 'function') {
      KontroleTabInit(root);
    }
    zapisnikOnemoguciDragDropNaPanelu();
    if (root) {
      var trakaZap = root.querySelector('.kontrola-tab__traka');
      if (trakaZap) {
        /* Capture prije bubble listenera u 0-Kontrole_Tab.js: preskoči disabled kartice pri strelicama/Home/End. */
        trakaZap.addEventListener(
          'keydown',
          function (evKb) {
            zapisnikKontrolaTabZaobilaziDisabledTipkovnica(evKb, root);
          },
          true
        );
      }
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
          zapisnikLozeDomacinRow = null;
          zapisnikLozeDomacinId = null;
          var taUcesnice = document.getElementById('zapisnik_loza_ucesnici');
          if (taUcesnice) taUcesnice.value = '';
          zapisnikPrisustvoOsvjeziIzvornuListuClanova();
          zapisnikUpdateHeaderLogo(idLozaParam);
          zapisnikSyncHeaderLogoSize();
          puniSelectStupanjRadovaZapisnik();
          zapisnikOsvjeziLoziGrupeIFormu(idLozaParam);
          /* Odmah upiši ložu domaćina u textarea učesnica, osvježi tab stanja i tipku Upiši. */
          zapisnikModalDohvatiRedoveLozeIstiTip(function () {
            zapisnikModalUpisiReadonlyTextareaUcesnice([], null);
            zapisnikPostaviKontroleOvisnoLozi();
            zapisnikPrimijeniUvjeteUpisPdfGumba();
          });
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

    /* Ovjera prije: Časni majstor mijenja dostupnost desne kolone. */
    var cbOvjeraPrijeCm = document.getElementById('zapisnik_cb_ovjera_prije_casni_majstor');
    if (cbOvjeraPrijeCm) {
      cbOvjeraPrijeCm.addEventListener('change', function () {
        zapisnikOvjeraAzurirajKorisnikLabel(cbOvjeraPrijeCm, cbOvjeraPrijeCm.checked);
        zapisnikPrimijeniStanjeOvjereZapisnika(!!zapisnikIdOdabraneLozISelecta());
      });
    }
    /* Ovjera nakon: svaki čekbox bilježi tko ga je čekirao. */
    for (var _oix = 0; _oix < ZAPISNIK_OVJERA_NAKON_CB_IDS.length; _oix++) {
      (function (cbId) {
        var cbNak = document.getElementById(cbId);
        if (cbNak) {
          cbNak.addEventListener('change', function () {
            zapisnikOvjeraAzurirajKorisnikLabel(cbNak, cbNak.checked);
          });
        }
      })(ZAPISNIK_OVJERA_NAKON_CB_IDS[_oix]);
    }

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
    /* Dvoklik na readonly textarea loža učesnica = isto što i ellipsis (modal odabira loža). */
    var taLozaUces = document.getElementById('zapisnik_loza_ucesnici');
    if (taLozaUces && bTipEllipsis) {
      taLozaUces.addEventListener('dblclick', function (ev) {
        if (taLozaUces.disabled || bTipEllipsis.disabled) return;
        ev.preventDefault();
        bTipEllipsis.click();
      });
    }

    /* Tab Dužnosnici: modal jednostrukog izbora; edit-delete (X briše i ID); dvoklik na input = ellipsis. */
    (function zapisnikInitDuznosniciModalIUrediBrisanje() {
      var panelDuz = document.getElementById('zapisnikKontrolaTabPanel2');
      if (panelDuz) {
        panelDuz.addEventListener('kontrole-edit-delete-clear', function (ev) {
          var wrap = ev.target && ev.target.closest ? ev.target.closest('.zapisnik-crud__duznosnici-edit-delete') : null;
          if (!wrap) return;
          delete wrap.dataset.zapisnikClanId;
        });
      }
      var ei;
      for (ei = 0; ei < ZAPISNIK_DUZNOSNICI_REDOVI.length; ei++) {
        (function (cfg) {
          var ellBtn = document.getElementById(cfg.ellipsisId);
          if (ellBtn) {
            ellBtn.addEventListener('click', function () {
              if (ellBtn.disabled) return;
              zapisnikOtvoriModalDuznosnikaZaEdit(cfg.editId);
            });
          }
          var inpDuz = document.getElementById(cfg.editId);
          if (inpDuz) {
            inpDuz.addEventListener('dblclick', function (ev) {
              var wrapIn = inpDuz.closest && inpDuz.closest('.kontrola-edit-delete');
              var wrapDis = wrapIn && wrapIn.classList.contains('kontrola-edit-delete--disabled');
              var ariaDis = inpDuz.getAttribute && inpDuz.getAttribute('aria-disabled') === 'true';
              if (inpDuz.disabled || ariaDis || wrapDis) return;
              ev.preventDefault();
              var eb = document.getElementById(cfg.ellipsisId);
              if (eb && !eb.disabled) eb.click();
            });
          }
        })(ZAPISNIK_DUZNOSNICI_REDOVI[ei]);
      }
      if (typeof KontroleInitEditDelete === 'function') {
        KontroleInitEditDelete(document.getElementById('zapisnikKontrolaTabPanel2') || document);
      }
    })();

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

  (function initUpisIzbrisHandleri() {
    var btnUpisi  = document.getElementById('btnUpisi');
    var btnIzbrisi = document.getElementById('btnIzbrisi');

    if (btnUpisi) {
      btnUpisi.addEventListener('click', function () {
        if (!zapisnikMozePrihvatUpisPdf()) return;
        var jeMod1 = zapisnikJeModKorekcijePostojeceg();
        var payload = zapisnikSakupiPayload();
        if (jeMod1) payload.id = zapisnikTrenutniId;
        var url = jeMod1
          ? getApiUrl('Zapisnik_CRUD_izmjena.php')
          : getApiUrl('Zapisnik_CRUD_upis.php');
        btnUpisi.disabled = true;
        zapisnikPostJson(url, payload, function (res, status) {
          btnUpisi.disabled = false;
          if (status >= 200 && status < 300 && (res === 'OK' || /^\d+$/.test(res))) {
            var kodPoruke = (!jeMod1 && /^\d+$/.test(res)) ? '001' : '004';
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(kodPoruke, [], function () { zapisnikOcistiSvuFormu(); });
            } else {
              zapisnikOcistiSvuFormu();
            }
          } else {
            var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
            var kod = p && p.code ? p.code : (res || '200');
            if (typeof window.showPorukaModal === 'function') {
              window.showPorukaModal(typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[kod] ? kod : '200', p ? p.replacements || [] : [res]);
            }
          }
        });
      });
    }

    if (btnIzbrisi) {
      btnIzbrisi.addEventListener('click', function () {
        if (!zapisnikTrenutniId) return;
        if (typeof window.showPorukaModal !== 'function') return;
        window.showPorukaModal('126', [], function (odgovor) {
          if (odgovor !== 'OK') return;
          btnIzbrisi.disabled = true;
          zapisnikPostJson(getApiUrl('Zapisnik_CRUD_brisanje.php'), { id: zapisnikTrenutniId }, function (res, status) {
            btnIzbrisi.disabled = false;
            if (status >= 200 && status < 300 && res === 'OK') {
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal('003', [], function () {
                  window.location.href = new URL('Meni.php', window.location.href).href;
                });
              } else {
                window.location.href = new URL('Meni.php', window.location.href).href;
              }
            } else {
              var p = typeof parseResponseCode === 'function' ? parseResponseCode(res) : null;
              var kod = p && p.code ? p.code : '200';
              if (typeof window.showPorukaModal === 'function') {
                window.showPorukaModal(typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[kod] ? kod : '200', p ? p.replacements || [] : [res]);
              }
            }
          });
        });
      });
    }
  })();

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

  /* ============================================================
   * Tab „Eseji": KontroleTablica (3 kol.), ellipsis modal, sažetak
   * ============================================================ */
  (function zapisnikInitEseji() {
    var container = document.getElementById('zapisnikEsejiTablica');
    if (!container || typeof KontroleTablica !== 'function') return;

    var esejiZaglavlje = [
      { key: 'autor',  title: 'Autor',       SQL_Naziv: '', sortable: 0, sortable_icon: 0, type: 't', width: -25, suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'naslov', title: 'Naslov eseja', SQL_Naziv: '', sortable: 0, sortable_icon: 0, type: 't', width: 0,   suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 },
      { key: 'akcije', title: '',             SQL_Naziv: '', sortable: 0, sortable_icon: 0, type: 't', width: 86,  suffix: '', align: 'L', row_align: 'L', mobitel_prikaz: 1 }
    ];

    KontroleTablica(container, {
      getBrojKolona: 3,
      headerColumns: esejiZaglavlje,
      data: []
    });

    var tbody = container.querySelector('.kontrola-tablica__scroll tbody');
    if (!tbody) return;

    /* Gradi 5 fiksnih redaka u tbody. */
    var bi;
    for (bi = 0; bi < zapisnikEsejiData.length; bi++) {
      (function (i) {
        var tr = document.createElement('tr');
        tr.setAttribute('data-esej-red', String(i));

        var tdA = document.createElement('td');
        var dA = document.createElement('div');
        dA.className = 'kontrola-tablica__cell-inner';
        dA.setAttribute('tabindex', '0');
        tdA.appendChild(dA);
        tr.appendChild(tdA);

        var tdN = document.createElement('td');
        var dN = document.createElement('div');
        dN.className = 'kontrola-tablica__cell-inner';
        dN.setAttribute('tabindex', '0');
        tdN.appendChild(dN);
        tr.appendChild(tdN);

        var tdAk = document.createElement('td');
        var akcije = document.createElement('div');
        akcije.className = 'zapisnik-crud__eseji-akcije';

        var btnEl = document.createElement('button');
        btnEl.type = 'button';
        btnEl.className = 'zapisnik-crud__eseji-btn zapisnik-crud__eseji-btn--elipsis zapisnik-crud__eseji-kontrola';
        btnEl.setAttribute('aria-label', 'Uredi esej ' + (i + 1));
        var spEl = document.createElement('span');
        spEl.className = 'kontrola-icon--ellipsis-horizontal';
        spEl.setAttribute('aria-hidden', 'true');
        btnEl.appendChild(spEl);
        if (i !== 0) btnEl.hidden = true;

        var btnBr = document.createElement('button');
        btnBr.type = 'button';
        btnBr.className = 'zapisnik-crud__eseji-btn zapisnik-crud__eseji-btn--brisanje zapisnik-crud__eseji-kontrola';
        btnBr.setAttribute('aria-label', 'Obriši esej ' + (i + 1));
        btnBr.hidden = true;
        var spBr = document.createElement('span');
        spBr.className = 'kontrola-icon--trash';
        spBr.setAttribute('aria-hidden', 'true');
        btnBr.appendChild(spBr);

        akcije.appendChild(btnEl);
        akcije.appendChild(btnBr);
        tdAk.appendChild(akcije);
        tr.appendChild(tdAk);

        tbody.appendChild(tr);
      }(bi));
    }

    if (typeof CommonCRUD !== 'undefined' && typeof CommonCRUD.primijeniTablicaZaglavlje === 'function') {
      CommonCRUD.primijeniTablicaZaglavlje(container, esejiZaglavlje);
    }

    function esejRedPopunjen(i) {
      var d = zapisnikEsejiData[i];
      return !!(d && (trimZ(d.autor) || trimZ(d.naslov)));
    }

    /** Ažurira ikone: ellipsis — vidljiv na popunjenim redovima i prvom praznom; trash — vidljiv samo na popunjenim redovima. */
    function esejAzurirajIkone() {
      var rows = tbody.querySelectorAll('tr[data-esej-red]');
      var prviPrazan = -1;
      var ri;
      for (ri = 0; ri < rows.length; ri++) {
        if (!esejRedPopunjen(ri) && prviPrazan === -1) prviPrazan = ri;
      }
      for (ri = 0; ri < rows.length; ri++) {
        var tr = rows[ri];
        var popunjen = esejRedPopunjen(ri);
        var btnEl = tr.querySelector('.zapisnik-crud__eseji-btn--elipsis');
        var btnBr = tr.querySelector('.zapisnik-crud__eseji-btn--brisanje');
        if (btnEl) btnEl.hidden = (!popunjen && ri !== prviPrazan);
        if (btnBr) btnBr.hidden = !popunjen;
      }
    }

    /** Upiše tekst u cell-inner divove retka i. */
    function esejAzurirajCelije(i) {
      var tr = tbody.querySelector('tr[data-esej-red="' + i + '"]');
      if (!tr) return;
      var d = zapisnikEsejiData[i];
      var cellA = tr.querySelector('td:first-child .kontrola-tablica__cell-inner');
      var cellN = tr.querySelector('td:nth-child(2) .kontrola-tablica__cell-inner');
      if (cellA) cellA.textContent = trimZ(d.autor)  || '';
      if (cellN) cellN.textContent = trimZ(d.naslov) || '';
    }

    function esejOtvoriModal(i) {
      var modal = document.getElementById('zapisnikEsejTekstModal');
      var inpA  = document.getElementById('zapisnikEsejModalAutor');
      var inpN  = document.getElementById('zapisnikEsejModalNaslov');
      var ta    = document.getElementById('zapisnikEsejModalTekst');
      if (!modal || !inpA || !inpN || !ta) return;
      zapisnikEsejModalTrenutniRed = i;
      var d = zapisnikEsejiData[i];
      inpA.value = d.autor || '';
      inpN.value = d.naslov || '';
      ta.value   = d.tekst  || '';
      modal.hidden = false;
      try { inpA.focus(); } catch (ef) {}
    }

    function esejZatvoriModal() {
      var modal = document.getElementById('zapisnikEsejTekstModal');
      if (modal) modal.hidden = true;
      zapisnikEsejModalTrenutniRed = -1;
    }

    /* Handleri za gumbe u redovima tablice. */
    var rows = tbody.querySelectorAll('tr[data-esej-red]');
    var ri;
    for (ri = 0; ri < rows.length; ri++) {
      (function (idx) {
        var tr    = rows[idx];
        var btnEl = tr.querySelector('.zapisnik-crud__eseji-btn--elipsis');
        var btnBr = tr.querySelector('.zapisnik-crud__eseji-btn--brisanje');
        if (btnEl) btnEl.addEventListener('click', function (e) { e.stopPropagation(); esejOtvoriModal(idx); });
        if (btnBr) btnBr.addEventListener('click', function (e) {
          e.stopPropagation();
          zapisnikEsejiData[idx] = { autor: '', naslov: '', tekst: '' };
          esejAzurirajCelije(idx);
          esejAzurirajIkone();
        });
      }(ri));
    }

    /* Modal handleri */
    var modalOk       = document.getElementById('zapisnikEsejModalOk');
    var modalOdustani = document.getElementById('zapisnikEsejModalOdustani');
    var modalBackdrop = document.querySelector('#zapisnikEsejTekstModal .zapisnik-crud__esej-modal-backdrop');

    if (modalOk) modalOk.addEventListener('click', function () {
      var i = zapisnikEsejModalTrenutniRed;
      if (i >= 0) {
        var inpA = document.getElementById('zapisnikEsejModalAutor');
        var inpN = document.getElementById('zapisnikEsejModalNaslov');
        var ta   = document.getElementById('zapisnikEsejModalTekst');
        zapisnikEsejiData[i].autor  = inpA ? trimZ(inpA.value) : '';
        zapisnikEsejiData[i].naslov = inpN ? trimZ(inpN.value) : '';
        zapisnikEsejiData[i].tekst  = ta   ? ta.value : '';
        esejAzurirajCelije(i);
        esejAzurirajIkone();
      }
      esejZatvoriModal();
    });
    if (modalOdustani) modalOdustani.addEventListener('click', esejZatvoriModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', esejZatvoriModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('zapisnikEsejTekstModal');
        if (modal && !modal.hidden) esejZatvoriModal();
      }
    });
  }());

})();
