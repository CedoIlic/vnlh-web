/* 0-Filteri_Po_Tip_Loze_Stupnjevi_Nadleznosti.js
   Punjenje selekta stupnjeva prema nadležnosti tipa lože.
   Endpoint: Stupnjevi_CRUD_sve.php?id_loza= — PHP čita loze.id_tip_loze i filtrira
   prema loze_tip_stupanj_enum (id_pozicija=1, stupnjevi nadležnosti).
   Ako loža nema definiran tip ili enum je prazan, vraća sve stupnjeve tog obreda.
   Učitavanje: nakon 0-Kontrole.js (koristi KontroleRefreshCustomSelect). */

// @ts-nocheck
(function () {
  'use strict';

  /**
   * Puni <select> element stupnjevima nadležnosti za zadanu ložu.
   *
   * @param {HTMLSelectElement} sel     - Nativni <select> element koji se puni
   * @param {string|number}     idLoza  - ID lože (string ili number)
   * @param {Object}            opcije
   *   @param {Function}  opcije.getApiUrl       - function(file) → puni URL; obavezno
   *   @param {string}   [opcije.kontrolaId]     - ID za KontroleRefreshCustomSelect
   *   @param {string}   [opcije.placeholder]    - Tekst placeholder opcije; default '— Odaberi stupanj —'
   *   @param {string}   [opcije.pendingValue]   - Vrijednost (stupnjevi.id) koja se postavi nakon učitavanja
   *   @param {Function} [opcije.getRaceIdLoza]  - Vraća trenutni idLoza; za provjeru race conditiona
   *   @param {Function} [opcije.onComplete]     - callback(arr) nakon uspješnog punjenja
   */
  function vnlhPuniSelectStupanjNadleznosti(sel, idLoza, opcije) {
    if (!sel || !idLoza) return;
    opcije = opcije || {};
    var getApiUrl    = typeof opcije.getApiUrl      === 'function' ? opcije.getApiUrl      : null;
    var kontrolaId   = opcije.kontrolaId             != null        ? String(opcije.kontrolaId) : null;
    var placeholder  = opcije.placeholder            != null        ? String(opcije.placeholder) : '— Odaberi stupanj —';
    var pendingValue = opcije.pendingValue           != null        ? String(opcije.pendingValue) : null;
    var getRaceId    = typeof opcije.getRaceIdLoza   === 'function' ? opcije.getRaceIdLoza   : function () { return String(idLoza); };
    var onComplete   = typeof opcije.onComplete      === 'function' ? opcije.onComplete      : null;

    if (!getApiUrl) return;

    function refresh() {
      if (typeof KontroleRefreshCustomSelect === 'function' && kontrolaId) {
        try { KontroleRefreshCustomSelect(kontrolaId); } catch (e) {}
      }
    }

    function resetSelect() {
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = placeholder;
      sel.appendChild(opt0);
      refresh();
    }

    var url = getApiUrl('Stupnjevi_CRUD_sve.php') + '?id_loza=' + encodeURIComponent(idLoza);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      /* Race condition: loža se promijenila za vrijeme zahtjeva — ignoriraj odgovor. */
      if (getRaceId() !== String(idLoza)) return;
      if (xhr.status < 200 || xhr.status >= 300) { resetSelect(); return; }
      var text = (xhr.responseText || '').replace(/^﻿/, '').trim();
      if (text === '105' || text.indexOf('200,') === 0) { resetSelect(); return; }
      var arr = [];
      try { arr = JSON.parse(text); } catch (ep) {}
      if (!Array.isArray(arr)) arr = [];

      /* Ponovo napuni select opcijama. */
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = placeholder;
      sel.appendChild(opt0);
      var j;
      for (j = 0; j < arr.length; j++) {
        var o = arr[j];
        var opt = document.createElement('option');
        opt.value = o.id != null ? String(o.id) : '';
        opt.textContent = (o.stupanj != null ? String(o.stupanj) + '°, ' : '') +
                          (o.naziv   != null ? o.naziv : '');
        if (o.stupanj != null) opt.dataset.stupanj = String(o.stupanj);
        sel.appendChild(opt);
      }

      /* Auto-selekcija: jedina opcija ili pendingValue. */
      if (arr.length === 1 && arr[0].id != null) sel.value = String(arr[0].id);
      if (pendingValue) sel.value = pendingValue;

      refresh();
      if (onComplete) onComplete(arr);
    };
    xhr.send();
  }

  /* Globalni export. */
  window.vnlhPuniSelectStupanjNadleznosti = vnlhPuniSelectStupanjNadleznosti;

}());
