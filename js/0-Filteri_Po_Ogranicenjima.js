/* 0-Filteri_Po_Ogranicenjima.js — zajednički pomoćni modul za filtriranje u skladu s ograničenjima dužnosti / geo prava.
   Učitavanje: nakon 0-Common.js (i po potrebi nakon 0-Razine.js ako stranica koristi hijerarhiju).
   Povezano: duznosnici_ogranicenja_stupnjevi_po_obredu.php (tip 6), Duznosnici_Drzave_Regije_Loze_sve.php (geo, tipovi 1–3),
   Clanovi_CRUD_sve_loze.php (id_obred). */

// @ts-nocheck
(function () {
  'use strict';

  /* =========================================================================
   * ▒▒ BLOK: NAMJENA MODULA ▒▒
   *
   * Funkcije koje na klijentu kombiniraju pravila ograničenja (dozvoljene države,
   * stupnjevi po obredu za prikaz, …).
   *
   * Tablica duznosnici_ogranicenja, tip 6 (stupnjevi po obredu):
   *   id_tip_obred_funkcionalnost = id obreda (obredi.id)
   *   vrijednost = stupnjevi.id (FK na red u stupnjevi)
   * Za usporedbu stupnja u prikazu koristi se stupnjevi.stupanj (broj), ne samo id.
   *
   * Prvo uključivanje: Lista članova (Lista.html / Lista.js); Clanovi_CRUD (select stupnjeva).
   * Geo (država / regija / loža): jedan GET u vnlhGeoOgranicenjaUcitaj, keš u modulu, filtri na klijentu.
   * ========================================================================= */

  /* -------------------------------------------------------------------------
   * GEO OGRANIČENJA (Duznosnici_Drzave_Regije_Loze_sve.php)
   *
   * _vnlhGeoKes — jedinstveni keš nakon uspješnog GET-a:
   *   drzave, regije, loze — nizovi objekata koje vraća PHP (id, naziv, id_drzava na regiji, id_regija na loži, …).
   *   upis_izmjena, brisanje_sloga — brojevi 0/1 za CRUD tipke (isti odgovor kao geo keš).
   *
   * vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(phpBaseOrResolve, htmlFajl):
   *   phpBaseOrResolve — string s putem do php/ (npr. '../php/') ILI funkcija getApiUrl(path) koja vraća puni URL.
   *   htmlFajl — ime HTML ulaza za sesiju/ograničenja (npr. 'Clanovi_CRUD.html').
   *
   * vnlhGeoFiltrirajRegijePoDrzavi(kešRegije, idDrzava) — regije čiji id_drzava odgovara (bez „Sve”).
   * vnlhGeoFiltrirajRegijeZaDrzavuIliSve(kešRegije, idDrzava, idSveDrzave) — Lista: ako idDrzava === idSveDrzave, cijeli keš regija.
   * vnlhGeoFiltrirajLozePoRegiji(kešLoze, idRegija) — lože za jednu regiju.
   * vnlhGeoFiltrirajLozePoSkupuRegija(kešLoze, regijeIdMap) — Lista SVE_REGIJE: regijeIdMap = { [id_regija]: true }.
   * ------------------------------------------------------------------------- */

  /** @type {{ drzave: Array, regije: Array, loze: Array, upis_izmjena: number, brisanje_sloga: number }} */
  var _vnlhGeoKes = {
    drzave: [],
    regije: [],
    loze: [],
    upis_izmjena: 0,
    brisanje_sloga: 0
  };
  var _vnlhGeoLoadGen = 0;
  var _vnlhGeoXhr = null;

  /**
   * Dodaje id_duznosnik_test iz query stringa (Alati_Meni_Test) ako je pozitivan broj.
   * @param {string} url
   * @returns {string}
   */
  function vnlhGeoUrlDodajDuznosnikTest(url) {
    try {
      var sp = new URLSearchParams(window.location.search);
      var idt = sp.get('id_duznosnik_test');
      if (idt && parseInt(idt, 10) > 0) {
        return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'id_duznosnik_test=' + encodeURIComponent(idt);
      }
    } catch (eUrl) {}
    return url;
  }

  /**
   * Puni URL za GET Duznosnici_Drzave_Regije_Loze_sve.php?html_fajl=… (& id_duznosnik_test ako treba).
   * @param {string|function(string): string} phpBaseOrResolve — '../php/' ili getApiUrl
   * @param {string} htmlFajl
   * @returns {string}
   */
  function vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze(phpBaseOrResolve, htmlFajl) {
    var u;
    if (typeof phpBaseOrResolve === 'function') {
      u = phpBaseOrResolve('Duznosnici_Drzave_Regije_Loze_sve.php');
    } else {
      u = String(phpBaseOrResolve || '').replace(/\/?$/, '/') + 'Duznosnici_Drzave_Regije_Loze_sve.php';
    }
    u += (u.indexOf('?') >= 0 ? '&' : '?') + 'html_fajl=' + encodeURIComponent(htmlFajl);
    return vnlhGeoUrlDodajDuznosnikTest(u);
  }

  /**
   * Jedan GET; puni modulski keš. Novi poziv prije završetka prethodnog poništava stari XHR (gen brojač).
   * @param {string} fullUrl — već s html_fajl (npr. iz vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze).
   * @param {function(): void} [callback]
   */
  function vnlhGeoOgranicenjaUcitaj(fullUrl, callback) {
    _vnlhGeoLoadGen++;
    var myGen = _vnlhGeoLoadGen;
    if (_vnlhGeoXhr) {
      try {
        _vnlhGeoXhr.abort();
      } catch (eAb) {}
    }
    var xhr = new XMLHttpRequest();
    _vnlhGeoXhr = xhr;
    xhr.open('GET', fullUrl, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) {
        return;
      }
      if (myGen !== _vnlhGeoLoadGen) {
        return;
      }
      _vnlhGeoXhr = null;
      /*
       * Odgovor mora biti JSON objekt s ključevima drzave/regije/loze. Realno povremeno:
       * UTF-8 BOM na početku (pa charAt(0)!=='{'); PHP notice/warning ispred tijela ({…});
       * 401/tekst ako session istekne — tada pad u prazan keš i prazni selecti (istražiti Network).
       * Zato: ukloni BOM, pronađi prvi '{' i parsiraj od tamo.
       */
      var raw = xhr.responseText || '';
      raw = raw.replace(/^\uFEFF/, '').trim();
      var obj = null;
      var ix = raw.indexOf('{');
      if (ix >= 0) {
        try {
          obj = JSON.parse(raw.slice(ix));
        } catch (eParse) {
          obj = null;
        }
      }
      if (!obj || typeof obj !== 'object') {
        obj = { drzave: [], regije: [], loze: [], upis_izmjena: 0, brisanje_sloga: 0 };
      }
      _vnlhGeoKes.drzave = obj.drzave || [];
      _vnlhGeoKes.regije = obj.regije || [];
      _vnlhGeoKes.loze = obj.loze || [];
      _vnlhGeoKes.upis_izmjena = obj.upis_izmjena != null ? parseInt(obj.upis_izmjena, 10) : 0;
      _vnlhGeoKes.brisanje_sloga = obj.brisanje_sloga != null ? parseInt(obj.brisanje_sloga, 10) : 0;
      if (typeof callback === 'function') {
        callback();
      }
    };
    xhr.send();
  }

  /**
   * Čitanje trenutačnog keša (isti nizovi po referenci — ne mutirati izvan filtriranja u kopiju ako treba izolacija).
   * @returns {{ drzave: Array, regije: Array, loze: Array, upis_izmjena: number, brisanje_sloga: number }}
   */
  function vnlhGeoOgranicenjaDohvatiKeš() {
    return {
      drzave: _vnlhGeoKes.drzave,
      regije: _vnlhGeoKes.regije,
      loze: _vnlhGeoKes.loze,
      upis_izmjena: _vnlhGeoKes.upis_izmjena,
      brisanje_sloga: _vnlhGeoKes.brisanje_sloga
    };
  }

  /**
   * @param {Array<Object>} kešRegije
   * @param {string|number} idDrzava
   * @returns {Array<Object>}
   */
  function vnlhGeoFiltrirajRegijePoDrzavi(kešRegije, idDrzava) {
    if (idDrzava == null || idDrzava === '') {
      return [];
    }
    var out = [];
    for (var i = 0; i < (kešRegije || []).length; i++) {
      if (String(kešRegije[i].id_drzava) === String(idDrzava)) {
        out.push(kešRegije[i]);
      }
    }
    return out;
  }

  /**
   * Lista: ako je odabir „Sve države“ (marker), sve regije iz keša; inače kao vnlhGeoFiltrirajRegijePoDrzavi.
   * @param {Array<Object>} kešRegije
   * @param {string|number} idDrzava
   * @param {string} idSveDrzave — npr. 'sve_drzave'
   * @returns {Array<Object>}
   */
  function vnlhGeoFiltrirajRegijeZaDrzavuIliSve(kešRegije, idDrzava, idSveDrzave) {
    if (idDrzava == null || idDrzava === '') {
      return [];
    }
    if (String(idDrzava) === String(idSveDrzave)) {
      var all = kešRegije || [];
      var copy = [];
      for (var i = 0; i < all.length; i++) {
        copy.push(all[i]);
      }
      return copy;
    }
    return vnlhGeoFiltrirajRegijePoDrzavi(kešRegije, idDrzava);
  }

  /**
   * @param {Array<Object>} kešLoze
   * @param {string|number} idRegija
   * @returns {Array<Object>}
   */
  function vnlhGeoFiltrirajLozePoRegiji(kešLoze, idRegija) {
    if (idRegija == null || idRegija === '') {
      return [];
    }
    var out = [];
    for (var i = 0; i < (kešLoze || []).length; i++) {
      if (String(kešLoze[i].id_regija) === String(idRegija)) {
        out.push(kešLoze[i]);
      }
    }
    return out;
  }

  /**
   * Lista: „Sve regije“ — lože čija je regija u skupu (mapa iz opcija selecta).
   * @param {Array<Object>} kešLoze
   * @param {Object} regijeIdMap — { [id_regija]: true }
   * @returns {Array<Object>}
   */
  function vnlhGeoFiltrirajLozePoSkupuRegija(kešLoze, regijeIdMap) {
    var out = [];
    if (!regijeIdMap) {
      return out;
    }
    for (var i = 0; i < (kešLoze || []).length; i++) {
      var l = kešLoze[i];
      if (regijeIdMap[String(l.id_regija)]) {
        out.push(l);
      }
    }
    return out;
  }

  /*
   * Rezervirano: hook za provjeru je li modul učitan (window.vnlhFilteriPoOgranicenjimaJeModulUcitani).
   * Trenutačno nitko u repou ne poziva — ostavljeno zakomentirano za slučaj buduće upotrebe.
   *
  function jeModulUcitani() {
    return true;
  }
  */

  /**
   * Filter_Stupnjeva_Po_Ograničenjima — prilagodba prikaza stupnja člana prema dozvolama dužnosti.
   *
   * @param {number} mod — Način rada:
   *   1 = samo prikaz: ako stupanj člana (stupnjevi.id) nije u skupu dozvoljenih za obred retka,
   *       zamijeni prikaz s najvećim dozvoljenim stupnjem (stupnjevi.stupanj + naziv). Ne mijenja bazu.
   *   0 = (rezervirano) filtriranje skupa redaka — još nije implementirano.
   * @param {Array<Object>} redovi — Niz redaka liste (isti objekti kao u Lista.js `podaci`), mutira se in-place.
   *   Očekivana polja po retku:
   *   - id_obred (number) — obred lože (loze.id_obred); ako 0/null, red se preskače.
   *   - id_stupnj_clan (number) — clanovi.stupanj (FK na stupnjevi.id).
   *   - Stupanj, StupanjBroj, StupanjNaziv — polja za prikaz (ažuriraju se ako treba zamjena).
   * @param {Object} poObredu — JSON iz duznosnici_ogranicenja_stupnjevi_po_obredu.php: ključ = id obreda (string),
   *   vrijednost = { stupnjevi: [ { id, stupanj, naziv }, … ], … }.
   *   Ako za neki id_obred nema ključa ili je stupnjevi prazan niz: za taj obred nema ograničenja → prikaz bez izmjene.
   *
   * Rubni slučajevi:
   *   - Prazan cijeli poObredu {} → nema tipa 6 uopće → sve ostaje kako API šalje.
   *   - Članov stupanj je već u dozvoljenom skupu → bez promjene.
   */
  function primijeniStupnjevaPoOgranicenjima(mod, redovi, poObredu) {
    if (mod !== 1 || !redovi || !redovi.length) {
      return;
    }
    var mapa = poObredu && typeof poObredu === 'object' ? poObredu : {};
    for (var i = 0; i < redovi.length; i++) {
      var row = redovi[i];
      if (!row) {
        continue;
      }
      var oid = row.id_obred;
      if (oid == null || oid === '' || oid === 0) {
        continue;
      }
      var ent = mapa[String(oid)];
      if (!ent) {
        ent = mapa[oid];
      }
      if (!ent || !ent.stupnjevi || !ent.stupnjevi.length) {
        continue;
      }
      var allowed = ent.stupnjevi;
      var mid = row.id_stupnj_clan;
      if (mid == null || mid === '' || (typeof mid === 'number' && (isNaN(mid) || mid <= 0))) {
        continue;
      }
      var j;
      var uSkupu = false;
      for (j = 0; j < allowed.length; j++) {
        if (String(allowed[j].id) === String(mid)) {
          uSkupu = true;
          break;
        }
      }
      if (uSkupu) {
        continue;
      }
      var maxEntry = null;
      var maxNum = -Infinity;
      for (j = 0; j < allowed.length; j++) {
        var sn = parseInt(allowed[j].stupanj, 10);
        if (!isNaN(sn) && sn > maxNum) {
          maxNum = sn;
          maxEntry = allowed[j];
        }
      }
      if (!maxEntry) {
        continue;
      }
      var brojStr = String(maxEntry.stupanj);
      row.Stupanj = brojStr;
      row.StupanjBroj = brojStr;
      row.StupanjNaziv = maxEntry.naziv != null ? String(maxEntry.naziv) : '';
    }
  }

  /**
   * Filter_Stupnjevi_Po_ogranicenjima_za_selekt — iz punog niza stupnjeva za obred ostavlja samo one
   * dozvoljene u duznosnici_ogranicenja (tip 6) za zadanog dužnosnika (mapa s PHP-a).
   *
   * @param {Array<Object>} sviStupnjevi — niz kao u Stupnjevi_CRUD_sve.php (id, stupanj, naziv, …).
   * @param {number} idObred — loze.id_obred za odabranu ložu; ako nije pozitivan broj, vraća se isti niz (bez filtriranja).
   * @param {Object} poObredu — JSON iz duznosnici_ogranicenja_stupnjevi_po_obredu.php (sesija = id_duznosnik).
   *   Ako za taj obred nema ključa ili je stupnjevi prazan/nedostaje: nema ograničenja tipa 6 → vraća se cijeli ulaz.
   * @returns {Array<Object>} novi niz (filtrirani redovi) ili isti referenca kao ulaz kad nema reza.
   */
  function filtrirajStupnjeviPoOgranicenjimaZaSelekt(sviStupnjevi, idObred, poObredu) {
    if (!sviStupnjevi || !sviStupnjevi.length) {
      return sviStupnjevi || [];
    }
    var oid = parseInt(idObred, 10);
    if (isNaN(oid) || oid <= 0) {
      return sviStupnjevi;
    }
    var mapa = poObredu && typeof poObredu === 'object' ? poObredu : {};
    var ent = mapa[String(oid)];
    if (!ent) {
      ent = mapa[oid];
    }
    if (!ent || !ent.stupnjevi || !ent.stupnjevi.length) {
      return sviStupnjevi;
    }
    var dopusteni = {};
    var k;
    for (k = 0; k < ent.stupnjevi.length; k++) {
      dopusteni[String(ent.stupnjevi[k].id)] = true;
    }
    var out = [];
    for (k = 0; k < sviStupnjevi.length; k++) {
      var red = sviStupnjevi[k];
      if (!red || red.id == null) {
        continue;
      }
      if (dopusteni[String(red.id)]) {
        out.push(red);
      }
    }
    return out;
  }

  try {
    // window.vnlhFilteriPoOgranicenjimaJeModulUcitani = jeModulUcitani; — uz funkciju iznad (zakomentirano)
    window.vnlhFilteriPrimijeniStupnjevaPoOgranicenjima = primijeniStupnjevaPoOgranicenjima;
    window.vnlhFilteriStupnjeviPoOgranicenjimaZaSelekt = filtrirajStupnjeviPoOgranicenjimaZaSelekt;
    window.vnlhGeoUrlDodajDuznosnikTest = vnlhGeoUrlDodajDuznosnikTest;
    window.vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze = vnlhGeoOgranicenjaNapraviUrlZaDrzaveRegijeLoze;
    window.vnlhGeoOgranicenjaUcitaj = vnlhGeoOgranicenjaUcitaj;
    window.vnlhGeoOgranicenjaDohvatiKeš = vnlhGeoOgranicenjaDohvatiKeš;
    window.vnlhGeoFiltrirajRegijePoDrzavi = vnlhGeoFiltrirajRegijePoDrzavi;
    window.vnlhGeoFiltrirajRegijeZaDrzavuIliSve = vnlhGeoFiltrirajRegijeZaDrzavuIliSve;
    window.vnlhGeoFiltrirajLozePoRegiji = vnlhGeoFiltrirajLozePoRegiji;
    window.vnlhGeoFiltrirajLozePoSkupuRegija = vnlhGeoFiltrirajLozePoSkupuRegija;
  } catch (eExport) {}
})();
