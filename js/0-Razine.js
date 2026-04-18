/* 0-Razine.js — zajedničke funkcije za hijerarhije (Master / podstablo). Učitavanje nakon 0-Common.js. */
// @ts-nocheck
(function () {
  'use strict';

  /* =========================================================================
   * ▒▒ BLOK: POŠTOVANJE RAZINE (zajedničke funkcije za hijerarhije) ▒▒
   *
   * Endpoint (GET): Duznosnici_CRUD_opcije_pod_masterom.php
   *
   *     Povrat (JSON): samo slogovi s aktivnost = 1; master_id također mora postojati i biti aktivan, inače [].
   *
   * ULAZNI PARAMETRI
   *
   *     master_id — ID sloga u tablici dužnosnika koji je „Master“ (kontekst retka).
   *                 Stanja: pozitivan int koji mora postojati u bazi i imati aktivnost = 1; inače prazan JSON [].
   *
   *     smjer — koji dio hijerarhije uzeti u odnosu na Mastera.
   *             Stanja: iznad | ispod (neosetljivo na veliko/malo; sve ostalo → iznad).
   *             Primjena: samo kad je povrat_cijelog_seta = 0.
   *             • iznad — predci (nadređeni prema korijenu), bez samog Mastera.
   *             • ispod — potomci (podstablo ispod Mastera).
   *
   *     povrat_cijelog_seta — želi li se filtrirani skup ili cijeli set bez Mastera.
   *                          Stanja: 0 | 1 (bilo što osim 1 tretira se kao 0).
   *                          • 0 — vrijede smjer i hijerarhijski filteri (gore).
   *                          • 1 — ignorira se smjer; svi dužnosnici osim Mastera (id ≠ master_id),
   *                                osim ako je ukljuci_mastera = 1 (cijela tablica).
   *
   *     ukljuci_mastera — uključuje li se Master u povrat (uz ostale).
   *                       Stanja: 0 | 1 (default 0).
   *                       • 0 — bez Mastera u listi (postojeće po smjeru / povratu).
   *                       • 1 — Master u listi (kod povrat_cijelog_seta = 1: svi aktivni slogovi u tablici).
   *
   * Primjer (Dužnosnici, select Odgovornost): Master = logirani dužnosnik; povrat_cijelog_seta = 1, ukljuci_mastera = 1 (smjer se na serveru ignorira).
   * Primjer (Prava dužnosnika, zadano): smjer = ispod, povrat = 0, ukljuci_mastera = 0 (samo potomci Mastera).
   * Primjer (Prava dužnosnika, toggle „Sva prava“): povrat = 1, ukljuci_mastera = 1 (svi aktivni dužnosnici, uključujući Mastera).
   * Primjer (Ograničenja dužnosnika): smjer = ispod, povrat = 0, ukljuci_mastera = 0 (samo potomci logiranog Mastera).
   * Primjer (Nosioci dužnosti / Osobe CRUD, lijeva tablica): smjer = ispod, povrat = 0, ukljuci_mastera = 0 (isti GET kao select, rezultat u tablicu).
   * ========================================================================= */

  /**
   * Puni <select> iz niza { id, naziv }.
   * @param {HTMLSelectElement} selectEl
   * @param {Array<{id:number,naziv?:string}>} rows
   * @param {string|number|null|undefined} zeljeniId — željeni odabir nakon punjenja
   * @param {{ value: string, label: string }|null|undefined} praznaPrvaOpcija — ako je zadano, prvi redak je
   *   value/label (npr. „— Odaberi dužnosnika —“, value ''); inače 0 / „Ne odgovara nikome“ (Dužnosnici CRUD).
   */
  function puniSelectIzJsona(selectEl, rows, zeljeniId, praznaPrvaOpcija) {
    if (!selectEl) return;
    while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
    var usePraz = praznaPrvaOpcija != null && typeof praznaPrvaOpcija === 'object';
    var opt0 = document.createElement('option');
    if (usePraz) {
      opt0.value = praznaPrvaOpcija.value != null ? String(praznaPrvaOpcija.value) : '';
      opt0.textContent = praznaPrvaOpcija.label != null ? String(praznaPrvaOpcija.label) : '';
    } else {
      opt0.value = '0';
      opt0.textContent = 'Ne odgovara nikome';
    }
    selectEl.appendChild(opt0);
    var prazVal = usePraz ? opt0.value : '0';
    var ima = {};
    ima[prazVal] = true;
    if (!usePraz) ima[0] = true;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var idv = r.id != null ? Number(r.id) : 0;
      if (idv <= 0) continue;
      ima[idv] = true;
      var opt = document.createElement('option');
      opt.value = String(idv);
      opt.textContent = r.naziv != null ? String(r.naziv) : '';
      selectEl.appendChild(opt);
    }
    if (usePraz) {
      var want = zeljeniId;
      if (want === '' || want === null || want === undefined || want === prazVal) {
        selectEl.value = prazVal;
      } else {
        var zn = Number(want);
        if (!isNaN(zn) && zn > 0 && ima[zn]) selectEl.value = String(zn);
        else selectEl.value = prazVal;
      }
    } else {
      var z = zeljeniId != null ? Number(zeljeniId) : 0;
      if (z !== 0 && !ima[z]) z = 0;
      selectEl.value = String(z);
    }
    if (typeof KontroleRefreshCustomSelect === 'function' && selectEl.id) {
      KontroleRefreshCustomSelect(selectEl.id);
    }
  }

  /**
   * Potomci Master čvora iz pune liste slogova { id, id_nadredjeni } (BFS).
   * @param {string|number} masterId
   * @param {Array<{id:number,id_nadredjeni?:number}>} lista
   * @returns {number[]}
   */
  function idjeviPotomakaIzListe(masterId, lista) {
    var m = masterId != null ? Number(masterId) : 0;
    if (isNaN(m) || m <= 0 || !lista || !lista.length) return [];
    var children = {};
    for (var i = 0; i < lista.length; i++) {
      var row = lista[i];
      var cid = row.id != null ? Number(row.id) : 0;
      var pid = row.id_nadredjeni != null ? Number(row.id_nadredjeni) : 0;
      if (!children[pid]) children[pid] = [];
      if (cid > 0) children[pid].push(cid);
    }
    var out = [];
    var queue = children[m] ? children[m].slice() : [];
    var seen = {};
    while (queue.length) {
      var nid = queue.shift();
      if (seen[nid]) continue;
      seen[nid] = true;
      out.push(nid);
      if (children[nid]) {
        for (var j = 0; j < children[nid].length; j++) queue.push(children[nid][j]);
      }
    }
    return out;
  }

  /**
   * Predci Mastera (id-jevi nadređenih prema korijenu), iz pune liste.
   * @param {string|number} masterId
   * @param {Array<{id:number,id_nadredjeni?:number}>} lista
   * @returns {number[]}
   */
  function idjeviPredakaIzListe(masterId, lista) {
    var out = [];
    var m = masterId != null ? Number(masterId) : 0;
    if (isNaN(m) || m <= 0 || !lista || !lista.length) return out;
    var mapa = {};
    for (var i = 0; i < lista.length; i++) {
      var row = lista[i];
      var cid = row.id != null ? Number(row.id) : 0;
      if (cid > 0) {
        mapa[cid] = row.id_nadredjeni != null ? Number(row.id_nadredjeni) : 0;
      }
    }
    var cur = m;
    var guard = 0;
    while (guard++ < 10000 && mapa[cur] !== undefined) {
      var p = mapa[cur];
      if (p <= 0) break;
      out.push(p);
      cur = p;
    }
    return out;
  }

  /**
   * Zajednički GET za Duznosnici_CRUD_opcije_pod_masterom.php (isti query kao punjenje selecta).
   * @param {function(number, string): void} onComplete — status HTTP, tijelo odgovora (trim); za nevaljan master_id=0 bez XHR: (200, '[]').
   */
  function opcijePodMasteromHttpGet(masterId, apiBase, smjer, povratCijelogSeta, ukljuciMastera, onComplete) {
    var cb = typeof onComplete === 'function' ? onComplete : function () {};
    var m = masterId != null ? String(masterId).trim() : '';
    if (m === '' || m === '0' || m === 'null') {
      cb(200, '[]');
      return;
    }
    var base = apiBase != null ? String(apiBase) : '../php/';
    var sm = smjer != null ? String(smjer).trim().toLowerCase() : 'iznad';
    if (sm !== 'ispod') sm = 'iznad';
    var pc = povratCijelogSeta != null && Number(povratCijelogSeta) === 1 ? 1 : 0;
    var um = ukljuciMastera != null && Number(ukljuciMastera) === 1 ? 1 : 0;
    var xhr = new XMLHttpRequest();
    var url =
      base +
      'Duznosnici_CRUD_opcije_pod_masterom.php?master_id=' +
      encodeURIComponent(m) +
      '&smjer=' +
      encodeURIComponent(sm) +
      '&povrat_cijelog_seta=' +
      encodeURIComponent(String(pc)) +
      '&ukljuci_mastera=' +
      encodeURIComponent(String(um));
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      cb(xhr.status, (xhr.responseText || '').trim());
    };
    xhr.send();
  }

  window.VNLHPostivanjeRazine = {
    /**
     * Poziva PHP (smjer iznad | ispod); puni <select>.
     * @param {string|number|null|undefined} masterId
     * @param {string} apiBase npr. '../php/'
     * @param {HTMLSelectElement|null} selectEl
     * @param {number} zeljeniIdNadredjeni
     * @param {function():void} [onDone]
     * @param {string} [smjer] 'iznad' | 'ispod' (default 'iznad'; ignorira se ako je povrat 1)
     * @param {number|string} [povratCijelogSeta] 0 | 1 — 1 = cijeli skup (bez Mastera ako je ukljuci_mastera 0; s Masterom ako je 1)
     * @param {{ value: string, label: string }|null|undefined} [praznaPrvaOpcija] — vidi puniSelectIzJsona
     * @param {number|string} [ukljuciMastera] 0 | 1 — 1 = u povratu je i Master (default 0)
     */
    ucitajOpcijeDuznosnikaPodMasterom: function (masterId, apiBase, selectEl, zeljeniIdNadredjeni, onDone, smjer, povratCijelogSeta, praznaPrvaOpcija, ukljuciMastera) {
      if (!selectEl) {
        if (typeof onDone === 'function') onDone();
        return;
      }
      opcijePodMasteromHttpGet(masterId, apiBase, smjer, povratCijelogSeta, ukljuciMastera, function (status, text) {
        var rows = [];
        if (status === 200 && text !== '' && text.charAt(0) === '[') {
          try {
            rows = JSON.parse(text);
          } catch (e) {
            rows = [];
          }
        }
        puniSelectIzJsona(selectEl, Array.isArray(rows) ? rows : [], zeljeniIdNadredjeni, praznaPrvaOpcija);
        if (typeof onDone === 'function') onDone();
      });
    },

    /**
     * Isti endpoint i parametri kao ucitajOpcijeDuznosnikaPodMasterom, ali bez select elementa: za tablice (npr. Nosioci dužnosti).
     * @param {string|number|null|undefined} masterId
     * @param {string} apiBase
     * @param {function(Array<{id:number,naziv?:string}>, number, string): void} onDone — (redovi, httpStatus, rawBody); redovi su [] ako status≠200 ili tijelo nije JSON niz.
     */
    dohvatiOpcijeDuznosnikaPodMasteromJson: function (masterId, apiBase, onDone, smjer, povratCijelogSeta, ukljuciMastera) {
      var fin = typeof onDone === 'function' ? onDone : function () {};
      opcijePodMasteromHttpGet(masterId, apiBase, smjer, povratCijelogSeta, ukljuciMastera, function (status, text) {
        var rows = [];
        if (status === 200 && text !== '' && text.charAt(0) === '[') {
          try {
            rows = JSON.parse(text);
          } catch (e) {
            rows = [];
          }
        }
        fin(Array.isArray(rows) ? rows : [], status, text);
      });
    },

    idjeviPotomakaIzListe: idjeviPotomakaIzListe,
    idjeviPredakaIzListe: idjeviPredakaIzListe
  };

  /* =========================================================================
   * ▒▒ KRAJ BLOKA: POŠTOVANJE RAZINE ▒▒
   * ========================================================================= */
})();
