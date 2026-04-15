/* =========================================================
   0-Chat.js
   Chat UI (popup aktivnih korisnika, modal „Razgovor”); učitava se dinamički iz 0-Poruke.js
   kad je window.VNLH_CHAT_DOZVOLJEN === 1.
   API: 0-Chat.php (fragment), poruke_chat_aktivni_korisnici.php, poruke_chat_modal_status.php,
   poruke_chat_povijest.php (GET, sugovornik_aktivan), poruke_chat_posalji.php, poruke_chat_brisi.php (POST).
   ========================================================= */
(function () {
  'use strict';

  function trim(s) {
    return s != null ? String(s).replace(/^\s+|\s+$/g, '') : '';
  }

  /**
   * Chat modal: fokus ostaje na #vnlh_chat_input; #vnlh_chat_history je scroll-only (tabindex -1 u HTML).
   */
  function chatFokusirajChatInput() {
    try {
      var inp = document.getElementById('vnlh_chat_input');
      if (inp && !inp.disabled && typeof inp.focus === 'function') {
        inp.focus();
      }
    } catch (eF) {}
  }

  /**
   * null = još nema odgovora poruke_chat_povijest.php; true = sugovornik ima aktivnu sesiju (smije se slati chat);
   * false = nema aktivne sesije – textarea i Pošalji disabled (poruke_chat_posalji.php također odbija).
   */
  var chatSugovornikJeAktivan = null;

  /**
   * Sinkronizira #vnlh_chat_input i #vnlh_chat_btn_send s chatSugovornikJeAktivan.
   * Poziva se nakon GET povijesti, pri otvaranju modala (null = učitavanje) i na input događaju kad je sugovornik aktivan.
   */
  function chatOsvjeziKomponenteSlanjaPoAktivnosti() {
    var inp = document.getElementById('vnlh_chat_input');
    var btn = document.getElementById('vnlh_chat_btn_send');
    if (!inp || !btn) return;

    var titleNeakt = 'Sugovornik nije u aplikaciji – slanje chata nije dostupno.';
    var titleLoad = 'Učitavanje stanja chata…';

    if (chatSugovornikJeAktivan === null) {
      inp.disabled = true;
      btn.disabled = true;
      inp.setAttribute('title', titleLoad);
      btn.setAttribute('title', titleLoad);
      return;
    }
    if (chatSugovornikJeAktivan === false) {
      inp.disabled = true;
      btn.disabled = true;
      inp.setAttribute('title', titleNeakt);
      btn.setAttribute('title', titleNeakt);
      return;
    }
    inp.disabled = false;
    inp.removeAttribute('title');
    btn.removeAttribute('title');
    btn.disabled = trim(inp.value) === '';
  }

  function resolveApiBase() {
    var p = window.location.pathname || '';
    if (/\/html\//i.test(p) || /\/html$/i.test(p)) return '../php/';
    if (/\/php\//i.test(p)) return '';
    return 'php/';
  }

  /**
   * URL za 0-Chat.php: kao 0-Poruke.js resolveTemplateUrl – /js/… → /php/… (ne samo zamjena imena datoteke).
   * Jedan ?v= (bez duplikata ako je na 0-Poruke.js već bio query u src).
   */
  function resolveChatFragmentUrl() {
    try {
      var nodes = document.querySelectorAll('script[src*="0-Poruke.js"]');
      var el = nodes.length ? nodes[nodes.length - 1] : null;
      if (el && el.src) {
        var scriptUrl = new URL(el.src);
        var pathname = scriptUrl.pathname;
        var jsDir = pathname.replace(/\/[^/]+$/, '/');
        var phpDir = jsDir.replace(/\/js\/$/i, '/php/');
        var base = scriptUrl.origin + phpDir + '0-Chat.php';
        var ver = typeof window !== 'undefined' && window.VNLH_VERZIJA ? String(window.VNLH_VERZIJA) : '';
        return ver ? base + '?v=' + encodeURIComponent(ver) : base;
      }
    } catch (e0) {}
    try {
      var nodesC = document.querySelectorAll('script[src*="0-Chat.js"]');
      var elC = nodesC.length ? nodesC[nodesC.length - 1] : null;
      if (elC && elC.src) {
        var scriptUrl = new URL(elC.src);
        var pathname = scriptUrl.pathname;
        var jsDir = pathname.replace(/\/[^/]+$/, '/');
        var phpDir = jsDir.replace(/\/js\/$/i, '/php/');
        return scriptUrl.origin + phpDir + '0-Chat.php';
      }
    } catch (e0b) {}
    return resolveApiBase() + '0-Chat.php';
  }

  function resolveChatCssUrl() {
    try {
      var nodesP = document.querySelectorAll('script[src*="0-Poruke.js"]');
      var elP = nodesP.length ? nodesP[nodesP.length - 1] : null;
      if (elP && elP.src && /\/js\/0-Poruke\.js/i.test(elP.src)) {
        return elP.src.replace(/\/js\/0-Poruke\.js/i, '/css/0-Chat.css');
      }
      var nodes = document.querySelectorAll('script[src*="0-Chat.js"]');
      var el = nodes.length ? nodes[nodes.length - 1] : null;
      if (el && el.src) {
        return el.src.replace(/\/js\/0-Chat\.js/i, '/css/0-Chat.css');
      }
    } catch (e1) {}
    return '';
  }

  var API_BASE = resolveApiBase();
  var CHAT_PHP_FRAGMENT = resolveChatFragmentUrl();
  var chatFragmentLoaded = false;
  /** XHR fragment u tijeku – spriječi paralelne zahtjeve; zadnji onDone zamjenjuje prethodni. */
  var chatFragmentLoading = false;
  var chatFragmentOnLoadCallback = null;
  var chatPopupOpen = false;
  var chatModalOpen = false;
  /** ID sugovornika u otvorenom modalu (polling: auto-osvježaj povijesti kad stigne nova poruka od istog). */
  var chatModalPartnerId = 0;
  /** Ime za oznaku primljenih poruka u povijesti (isto kao testniNadjiImePosiljatelja u testnom modalu). */
  var chatSugovornikPrikaznoIme = '';
  /** Zadnji id_razgovor za par (šalje se u poruke_chat_posalji.php za nastavak iste niti). */
  var chatTrenutniIdRazgovor = 0;
  /** Zadnji niz s poruke_chat_aktivni_korisnici.php (za pretragu u popupu kao 0-Poruke_korisnici). */
  var chatAktivniKorisniciCache = null;
  /** Prvi uspješan poll nakon učitavanja stranice – samo postavi referencu, bez auto-otvaranja modala. */
  var chatPollBaselineDone = false;
  /** Zadnji poznati MAX(id) nepročitane chat poruke (0-Poruke_neprocitane.php) – porast = nova poruka. */
  var chatLastKnownZadnjaNeprocitanaId = 0;

  function chatJeMobitelPopup() {
    return typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  /**
   * Desktop: popup lijevo od ikone (desni rub popupa uz lijevi rub ikone) + clamp u viewport.
   * Mobitel: centrirano po X, Y ispod ikone (s clamp ako nema mjesta).
   */
  function chatPositionPopup(anchorBtn) {
    var pop = document.getElementById('vnlh_chat_popup');
    if (!pop || !anchorBtn) return;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var rect = anchorBtn.getBoundingClientRect();
    var gap = 4;
    var margin = 8;
    var pw = pop.offsetWidth > 0 ? pop.offsetWidth : 280;
    var ph = pop.offsetHeight > 0 ? pop.offsetHeight : 200;
    pop.style.right = 'auto';
    pop.style.transform = '';

    if (chatJeMobitelPopup()) {
      var leftMob = (vw - pw) / 2;
      leftMob = Math.max(margin, Math.min(leftMob, vw - pw - margin));
      var topMob = rect.bottom + gap;
      if (topMob + ph > vh - margin) {
        topMob = Math.max(margin, vh - ph - margin);
      }
      pop.style.left = Math.round(leftMob) + 'px';
      pop.style.top = Math.round(topMob) + 'px';
      return;
    }

    var desiredRightEdge = rect.left - gap;
    var left = desiredRightEdge - pw;
    if (left < margin) {
      left = margin;
    }
    if (left + pw > vw - margin) {
      left = Math.max(margin, vw - pw - margin);
    }
    var top = rect.bottom + gap;
    if (top + ph > vh - margin) {
      top = Math.max(margin, vh - ph - margin);
    }
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }

  function chatRenderPopupLista(arr) {
    var lista = document.getElementById('vnlh_chat_popup_list');
    if (!lista) return;
    lista.innerHTML = '';
    if (!arr || arr.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'poruke__popup-empty';
      empty.textContent = 'Nema aktivnih korisnika ni nepročitanih chat poruka';
      lista.appendChild(empty);
      return;
    }
    for (var i = 0; i < arr.length; i++) {
      (function (row) {
        var div = document.createElement('div');
        div.className = 'poruke__popup-item';
        /* API poruke_chat_aktivni_korisnici.php: ima_neprocitanih_chat + aktivan. Boja imena (0-Chat.css):
           aktivan + nema nepročitanih → bez modifikatora (sistemska .poruke__popup-item);
           aktivan + nepročitano → crvena 900; neaktivan + nepročitano → crvena 500 (neaktivni bez nepročitanih nisu u listi); ista težina fonta kao ostali redovi. */
        var imaNep =
          row.ima_neprocitanih_chat === true ||
          row.ima_neprocitanih_chat === 1 ||
          String(row.ima_neprocitanih_chat) === '1';
        var akt =
          row.aktivan === undefined || row.aktivan === null
            ? true
            : row.aktivan === true || row.aktivan === 1 || String(row.aktivan) === '1';
        if (imaNep) {
          div.classList.add(akt ? 'vnlh-chat-popup__item--neprocitan-aktivan' : 'vnlh-chat-popup__item--neprocitan-neaktivan');
        }
        div.textContent = trim((row.prezime || '') + ' ' + (row.ime || '')) || 'Korisnik ' + row.id;
        div.addEventListener('click', function () {
          chatOpenModalForPartner(row.id, row.prezime || '', row.ime || '');
        });
        lista.appendChild(div);
      })(arr[i]);
    }
  }

  function chatFiltrirajPopupKorisnika(tekst) {
    var lista = document.getElementById('vnlh_chat_popup_list');
    if (!lista || !chatAktivniKorisniciCache) return;
    var t = trim(tekst).toLowerCase();
    if (!t) {
      chatRenderPopupLista(chatAktivniKorisniciCache);
      return;
    }
    var filtered = [];
    for (var i = 0; i < chatAktivniKorisniciCache.length; i++) {
      var item = chatAktivniKorisniciCache[i];
      var full = (trim((item.prezime || '') + ' ' + (item.ime || ''))).toLowerCase();
      if (full.indexOf(t) >= 0) {
        filtered.push(item);
      }
    }
    chatRenderPopupLista(filtered);
  }

  function chatWirePopupFilterOnce() {
    var f = document.getElementById('vnlh_chat_popup_filter');
    if (!f || f.getAttribute('data-vnlh-chat-filter-bound') === '1') return;
    f.setAttribute('data-vnlh-chat-filter-bound', '1');
    f.addEventListener('input', function () {
      chatFiltrirajPopupKorisnika(f.value);
    });
  }

  /** Isti semantički model kao testniExtractDate / testniExtractTime / testniFormatDateHR u 0-Poruke.js. */
  function chatExtractDate(dt) {
    if (!dt) return '';
    return String(dt).substring(0, 10);
  }

  function chatExtractTime(dt) {
    if (!dt) return '';
    var s = String(dt);
    var sp = s.indexOf(' ');
    if (sp >= 0 && s.length >= sp + 6) return s.substring(sp + 1, sp + 6);
    var tIdx = s.indexOf('T');
    if (tIdx >= 0 && s.length >= tIdx + 6) return s.substring(tIdx + 1, tIdx + 6);
    return '';
  }

  function chatFormatDateHR(dateStr) {
    if (!dateStr || dateStr.length < 10) return dateStr || '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts[2] + '.' + parts[1] + '.' + parts[0] + '.';
  }

  /** Jednoredni placeholder (učitavanje, greška, prazan razgovor) – kao testniPovijestPostaviPlaceholder. */
  function chatPovijestPostaviPlaceholder(tekst) {
    var hist = document.getElementById('vnlh_chat_history');
    if (!hist) return;
    hist.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'testni-modal__povijest-placeholder';
    d.textContent = tekst != null ? String(tekst) : '';
    hist.appendChild(d);
  }

  function chatPovijestObrisiSadrzaj() {
    var hist = document.getElementById('vnlh_chat_history');
    if (hist) hist.innerHTML = '';
  }

  /**
   * Render u #vnlh_chat_history – iste CSS klase kao testniRenderPovijest (0-Poruke.js): .poruke__datum-separator,
   * .poruke__msg*, vrijeme u .poruke__msg-vrijeme na kraju retka. Niz poruke s API-ja je novije-prvo.
   */
  function chatRenderPovijestDom(poruke) {
    var hist = document.getElementById('vnlh_chat_history');
    if (!hist) return;
    hist.innerHTML = '';
    if (!poruke || poruke.length === 0) {
      chatPovijestPostaviPlaceholder('Nema poruka.');
      hist.scrollTop = 0;
      requestAnimationFrame(function () {
        chatFokusirajChatInput();
      });
      return;
    }
    for (var i = 0; i < poruke.length; i++) {
      var p = poruke[i];
      var datum = chatExtractDate(p.vrijeme_slanja);
      var prevDatum = i > 0 ? chatExtractDate(poruke[i - 1].vrijeme_slanja) : '';
      if (i === 0 || datum !== prevDatum) {
        var sep = document.createElement('div');
        sep.className = 'poruke__datum-separator';
        sep.textContent = chatFormatDateHR(datum);
        hist.appendChild(sep);
      }
      var div = document.createElement('div');
      div.className = 'poruke__msg';
      var proc = Number(p.procitano) === 1;
      if (p.smjer === 'odgovor') {
        div.classList.add(proc ? 'poruke__msg--odgovor-procitan' : 'poruke__msg--odgovor');
      } else {
        div.classList.add(proc ? 'poruke__msg--primljena-procitana' : 'poruke__msg--primljena');
      }
      var autorSpan = document.createElement('span');
      autorSpan.className = 'poruke__msg-autor';
      autorSpan.textContent = p.smjer === 'odgovor' ? 'Ti:' : (chatSugovornikPrikaznoIme || 'Sugovornik') + ':';
      div.appendChild(autorSpan);
      div.appendChild(document.createTextNode(p.poruka != null ? String(p.poruka) : ''));
      var vrSpan = document.createElement('span');
      vrSpan.className = 'poruke__msg-vrijeme';
      vrSpan.textContent = chatExtractTime(p.vrijeme_slanja);
      if (proc) {
        var checkSpan = document.createElement('span');
        checkSpan.className = 'poruke__msg-procitano';
        checkSpan.textContent = ' \u2713\u2713';
        vrSpan.appendChild(checkSpan);
      }
      div.appendChild(vrSpan);
      hist.appendChild(div);
    }
    hist.scrollTop = 0;
    requestAnimationFrame(function () {
      chatFokusirajChatInput();
    });
  }

  /**
   * GET poruke_chat_povijest.php – puni povijest i chatTrenutniIdRazgovor (0 ako nema niti).
   */
  function chatUcitajPovijest(partnerId) {
    var pid = parseInt(String(partnerId), 10);
    if (!pid || pid <= 0) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'poruke_chat_povijest.php?id_sugovornik=' + encodeURIComponent(String(pid)), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (!chatModalOpen || chatModalPartnerId !== pid) return;
      if (xhr.status === 401 || xhr.status === 403) {
        chatPovijestPostaviPlaceholder(xhr.status === 403 ? 'Chat nije dopušten.' : 'Sesija istekla.');
        chatTrenutniIdRazgovor = 0;
        chatSugovornikJeAktivan = false;
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
        requestAnimationFrame(function () {
          chatFokusirajChatInput();
        });
        return;
      }
      if (xhr.status !== 200) {
        chatPovijestPostaviPlaceholder('Podaci nisu dostupni.');
        chatTrenutniIdRazgovor = 0;
        chatSugovornikJeAktivan = false;
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
        requestAnimationFrame(function () {
          chatFokusirajChatInput();
        });
        return;
      }
      var t = trim(xhr.responseText);
      if (!t) {
        chatPovijestPostaviPlaceholder('Nema poruka.');
        chatTrenutniIdRazgovor = 0;
        chatSugovornikJeAktivan = false;
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
        requestAnimationFrame(function () {
          chatFokusirajChatInput();
        });
        return;
      }
      if (t === '105' || t === '401' || t === '403') {
        chatPovijestPostaviPlaceholder('Podaci nisu dostupni (' + t + ').');
        chatTrenutniIdRazgovor = 0;
        chatSugovornikJeAktivan = false;
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
        requestAnimationFrame(function () {
          chatFokusirajChatInput();
        });
        return;
      }
      if (t.charAt(0) !== '{') {
        chatPovijestPostaviPlaceholder('Neočekivan odgovor poslužitelja.');
        chatTrenutniIdRazgovor = 0;
        chatSugovornikJeAktivan = false;
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
        requestAnimationFrame(function () {
          chatFokusirajChatInput();
        });
        return;
      }
      try {
        var data = JSON.parse(t);
        if (data && data.error) {
          chatPovijestPostaviPlaceholder(data.error === 'CHAT_DENIED' ? 'Chat nije dopušten.' : String(data.error));
          chatTrenutniIdRazgovor = 0;
          chatSugovornikJeAktivan = false;
          chatOsvjeziKomponenteSlanjaPoAktivnosti();
          requestAnimationFrame(function () {
            chatFokusirajChatInput();
          });
          return;
        }
        chatTrenutniIdRazgovor = typeof data.id_razgovor === 'number' ? data.id_razgovor : parseInt(String(data.id_razgovor || '0'), 10) || 0;
        /* Polje sugovornik_aktivan dodano u poruke_chat_povijest.php; ako ga stariji poslužitelj ne šalje, pretpostavi aktivan da se UI ne zaključa. */
        if (data.sugovornik_aktivan === undefined || data.sugovornik_aktivan === null) {
          chatSugovornikJeAktivan = true;
        } else {
          chatSugovornikJeAktivan =
            data.sugovornik_aktivan === true || data.sugovornik_aktivan === 1 || String(data.sugovornik_aktivan) === '1';
        }
        chatRenderPovijestDom(data.poruke);
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
        /* Odmah osvježi mail/chat ikone (npr. crvena chat ikona) – ne čekaj sljedeći interval polla. */
        if (typeof window.vnlhPorukeOsvjeziNeprocitaneBadge === 'function') {
          try {
            window.vnlhPorukeOsvjeziNeprocitaneBadge();
          } catch (eBadge) {}
        }
      } catch (eCh) {
        chatPovijestPostaviPlaceholder('Greška pri čitanju povijesti.');
        chatTrenutniIdRazgovor = 0;
        chatSugovornikJeAktivan = false;
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
        requestAnimationFrame(function () {
          chatFokusirajChatInput();
        });
      }
    };
    xhr.send();
  }

  function chatPokaziSlanjeGreska(res) {
    if (typeof window.showPorukaModal === 'function') {
      var code = trim(res) || '101';
      var parts = code.split(',');
      var mainCode = parts[0];
      var replacements = parts.length > 1 ? [parts.slice(1).join(',')] : [];
      if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES[mainCode]) {
        window.showPorukaModal(mainCode, replacements);
      } else if (typeof MODAL_MESSAGES !== 'undefined' && MODAL_MESSAGES['101']) {
        window.showPorukaModal('101', []);
      }
    }
  }

  function chatPostForm(url, params, onDone) {
    if (typeof window.CommonPostFormData === 'function') {
      window.CommonPostFormData(url, params, function (res) {
        if (typeof onDone === 'function') onDone(trim(res));
      });
      return;
    }
    var formData = new FormData();
    var k;
    for (k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k)) {
        formData.append(k, params[k]);
      }
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (typeof onDone === 'function') onDone(trim(xhr.responseText));
    };
    xhr.send(formData);
  }

  function chatPosaljiTekst() {
    if (!chatModalOpen || chatModalPartnerId <= 0) return;
    if (chatSugovornikJeAktivan !== true) return;
    var inp = document.getElementById('vnlh_chat_input');
    var btn = document.getElementById('vnlh_chat_btn_send');
    var tekst = inp ? trim(inp.value) : '';
    if (!tekst) return;
    if (btn) btn.disabled = true;
    var params = {
      id_sugovornik: String(chatModalPartnerId),
      poruka: tekst,
      id_razgovor: String(chatTrenutniIdRazgovor > 0 ? chatTrenutniIdRazgovor : 0)
    };
    chatPostForm(API_BASE + 'poruke_chat_posalji.php', params, function (res) {
      if (btn) btn.disabled = false;
      if (res === '-1') {
        if (inp) inp.value = '';
        /* Zahtjev: modal se gasi nakon poslane poruke (ne ostaje otvoren za pregled povijesti). */
        chatCloseModalUi();
      } else if (res === 'CHAT_DENIED') {
        chatCloseModalUi();
      } else if (res === 'CHAT_SUGOVORNIK_NEAKTIVAN') {
        /* Sukorisnik se u međuvremenu odjavio ili istekla sesija – ponovno učitaj povijest (sugovornik_aktivan) i UI. */
        chatUcitajPovijest(chatModalPartnerId);
      } else {
        chatPokaziSlanjeGreska(res);
      }
    });
  }

  /**
   * Min/max širina i visina chat modala na mobu – isti brojevi kao testniModalMobGranice() u 0-Poruke.js
   * (initTestniMobileDialogResizeHandle) da ponašanje resizea bude dosljedno.
   */
  function chatModalMobGranice() {
    var minW = 260;
    var minH = 160;
    var vw = typeof window.innerWidth === 'number' ? window.innerWidth : 400;
    var vh = typeof window.innerHeight === 'number' ? window.innerHeight : 600;
    var maxW = Math.max(minW, Math.min(vw * 0.98, vw - 8));
    var maxH = Math.max(minH, Math.min(vh * 0.92, vh - 16));
    return { minW: minW, minH: minH, maxW: maxW, maxH: maxH };
  }

  /**
   * Mobitel (≤768px): #vnlh_chat_dialog_resize u podnožju mijenja širinu i visinu .testni-modal__dialog
   * unutar #vnlh_chat_modal (isti model kao initTestniMobileDialogResizeHandle u 0-Poruke.js).
   */
  function chatInitMobileDialogResizeOnce() {
    var handle = document.getElementById('vnlh_chat_dialog_resize');
    var modal = document.getElementById('vnlh_chat_modal');
    if (!handle || !modal || handle.getAttribute('data-vnlh-chat-dialog-resize') === '1') return;
    var dialog = modal.querySelector('.testni-modal__dialog');
    if (!dialog) return;
    handle.setAttribute('data-vnlh-chat-dialog-resize', '1');

    function jeMobitelResize() {
      return typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    }

    function startResize(clientX, clientY) {
      if (!jeMobitelResize()) return;
      var g = chatModalMobGranice();
      var startX = clientX;
      var startY = clientY;
      var startW = dialog.offsetWidth;
      var startH = dialog.offsetHeight;

      function move(cx, cy) {
        var dw = cx - startX;
        var dh = cy - startY;
        var newW = Math.max(g.minW, Math.min(g.maxW, Math.round(startW + dw)));
        var newH = Math.max(g.minH, Math.min(g.maxH, Math.round(startH + dh)));
        dialog.style.width = newW + 'px';
        dialog.style.height = newH + 'px';
      }

      function onMouseMove(e) {
        move(e.clientX, e.clientY);
      }
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onTouchStart(e) {
      if (!jeMobitelResize()) return;
      if (e.touches.length !== 1) return;
      e.preventDefault();
      var g = chatModalMobGranice();
      var startX = e.touches[0].clientX;
      var startY = e.touches[0].clientY;
      var startW = dialog.offsetWidth;
      var startH = dialog.offsetHeight;

      function onTouchMove(ev) {
        if (ev.touches.length !== 1) return;
        ev.preventDefault();
        var cx = ev.touches[0].clientX;
        var cy = ev.touches[0].clientY;
        var dw = cx - startX;
        var dh = cy - startY;
        var newW = Math.max(g.minW, Math.min(g.maxW, Math.round(startW + dw)));
        var newH = Math.max(g.minH, Math.min(g.maxH, Math.round(startH + dh)));
        dialog.style.width = newW + 'px';
        dialog.style.height = newH + 'px';
      }
      function onTouchEnd() {
        document.removeEventListener('touchmove', onTouchMove, { passive: false });
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
      }
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
      document.addEventListener('touchcancel', onTouchEnd);
    }

    handle.addEventListener('mousedown', function (e) {
      if (!jeMobitelResize()) return;
      if (e.button !== 0) return;
      e.preventDefault();
      startResize(e.clientX, e.clientY);
    });
    handle.addEventListener('touchstart', onTouchStart, { passive: false });
  }

  function chatObrisiRazgovor() {
    if (!chatModalOpen || chatModalPartnerId <= 0) return;
    if (typeof window.confirm === 'function' && !window.confirm('Obrisati cijeli chat s ovim sugovornikom?')) return;
    var btn = document.getElementById('vnlh_chat_btn_trash');
    if (btn) btn.disabled = true;
    chatPostForm(API_BASE + 'poruke_chat_brisi.php', { id_sugovornik: String(chatModalPartnerId) }, function (res) {
      if (btn) btn.disabled = false;
      if (res === '-1') {
        chatTrenutniIdRazgovor = 0;
        chatPovijestPostaviPlaceholder('Nema poruka.');
        var inp = document.getElementById('vnlh_chat_input');
        if (inp) inp.value = '';
        chatUcitajPovijest(chatModalPartnerId);
      } else if (res === 'CHAT_DENIED') {
        chatCloseModalUi();
      } else {
        chatPokaziSlanjeGreska(res);
      }
    });
  }

  function chatWireModalActionsOnce() {
    var modal = document.getElementById('vnlh_chat_modal');
    if (!modal || modal.getAttribute('data-vnlh-chat-actions') === '1') return;
    modal.setAttribute('data-vnlh-chat-actions', '1');
    var send = document.getElementById('vnlh_chat_btn_send');
    if (send) {
      send.addEventListener('click', function (e) {
        e.preventDefault();
        chatPosaljiTekst();
      });
    }
    var trash = document.getElementById('vnlh_chat_btn_trash');
    if (trash) {
      trash.addEventListener('click', function (e) {
        e.preventDefault();
        chatObrisiRazgovor();
      });
    }
    var inpSlanje = document.getElementById('vnlh_chat_input');
    if (inpSlanje && !inpSlanje._vnlhChatSlanjeInputBound) {
      inpSlanje._vnlhChatSlanjeInputBound = true;
      inpSlanje.addEventListener('input', function () {
        chatOsvjeziKomponenteSlanjaPoAktivnosti();
      });
    }
    chatInitMobileDialogResizeOnce();

    var modalFc = document.getElementById('vnlh_chat_modal');
    var histFc = document.getElementById('vnlh_chat_history');
    var inpFc = document.getElementById('vnlh_chat_input');
    if (histFc && !histFc._vnlhChatHistoryFocusGuard) {
      histFc._vnlhChatHistoryFocusGuard = true;
      histFc.addEventListener('focus', function () {
        try {
          histFc.blur();
        } catch (eBl) {}
        chatFokusirajChatInput();
      });
    }
    if (modalFc && !modalFc._vnlhChatModalFocusinGuard) {
      modalFc._vnlhChatModalFocusinGuard = true;
      modalFc.addEventListener(
        'focusin',
        function (e) {
          if (!histFc || !inpFc || !e || !e.target) return;
          var t = e.target;
          if (t === inpFc || (typeof inpFc.contains === 'function' && inpFc.contains(t))) return;
          if (t === histFc || (typeof histFc.contains === 'function' && histFc.contains(t))) {
            try {
              if (typeof t.blur === 'function') t.blur();
            } catch (eB) {}
            chatFokusirajChatInput();
          }
        },
        true
      );
    }
  }

  function injectChatCssOnce() {
    if (document.querySelector('link[href*="0-Chat.css"]')) return;
    var href = resolveChatCssUrl();
    if (!href) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function postFormData(url, params, callback) {
    if (window.CommonPostFormData) window.CommonPostFormData(url, params, callback);
    else callback('');
  }

  function chatModalStatus(akcija, idSugovornik, cb) {
    var p = { akcija: akcija };
    if (idSugovornik != null && idSugovornik > 0) p.id_sugovornik = String(idSugovornik);
    postFormData(API_BASE + 'poruke_chat_modal_status.php', p, function (t) {
      if (typeof cb === 'function') cb(trim(t));
    });
  }

  /** Roditelj popupa + modala; mora biti vidljiv kad je otvoren ijedan od njih (HTML: hidden na #vnlh_chat_root). */
  function chatSetRootVisible(visible) {
    var root = document.getElementById('vnlh_chat_root');
    if (!root) return;
    if (visible) {
      root.hidden = false;
      root.removeAttribute('hidden');
    } else {
      root.hidden = true;
      root.setAttribute('hidden', 'hidden');
    }
  }

  function chatCloseModalUi() {
    var modal = document.getElementById('vnlh_chat_modal');
    if (modal) {
      modal.classList.remove('kontrola-modal--open', 'kontrola-modal--dim', 'kontrola-modal--fade-in', 'kontrola-modal--fade-out');
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    chatModalOpen = false;
    chatModalPartnerId = 0;
    chatSugovornikPrikaznoIme = '';
    chatSugovornikJeAktivan = null;
    var pop = document.getElementById('vnlh_chat_popup');
    if (pop) {
      pop.hidden = true;
      pop.setAttribute('hidden', 'hidden');
    }
    chatPopupOpen = false;
    chatSetRootVisible(false);
    chatModalStatus('zatvori', 0, function () {});
  }

  function chatOpenModalForPartner(id, prezime, ime) {
    chatModalPartnerId = id;
    chatTrenutniIdRazgovor = 0;
    chatSugovornikPrikaznoIme = trim((prezime || '') + ' ' + (ime || '')) || 'Sugovornik';
    /* Samo zatvori popup; root ostaje vidljiv jer odmah otvaramo modal (ne smije chatClosePopupUi sakriti root). */
    chatClosePopupUi(true);
    var modal = document.getElementById('vnlh_chat_modal');
    var hist = document.getElementById('vnlh_chat_history');
    var inp = document.getElementById('vnlh_chat_input');
    if (hist) hist.innerHTML = '';
    if (inp) inp.value = '';
    chatSugovornikJeAktivan = null;
    chatOsvjeziKomponenteSlanjaPoAktivnosti();
    if (modal) {
      modal.hidden = false;
      modal.removeAttribute('hidden');
      modal.setAttribute('aria-hidden', 'false');
      /* Bez kontrola-modal--open dijalog ostaje opacity:0 (0-Kontrole.css); --dim prikazuje overlay. */
      modal.classList.add('kontrola-modal--open', 'kontrola-modal--dim');
    }
    chatSetRootVisible(true);
    chatModalOpen = true;
    var title = document.getElementById('vnlh_chat_modal_title');
    if (title) title.textContent = 'Razgovor: ' + trim(prezime + ' ' + ime);
    chatModalStatus('otvori', id, function (resp) {
      if (resp !== '-1') chatCloseModalUi();
    });
    chatUcitajPovijest(id);
    requestAnimationFrame(function () {
      chatFokusirajChatInput();
    });
  }

  /**
   * @param {boolean} [samoPopupBezMijenjanjaRoot] – true kad odmah slijedi otvaranje modala (root mora ostati otkriven).
   */
  function chatClosePopupUi(samoPopupBezMijenjanjaRoot) {
    var pop = document.getElementById('vnlh_chat_popup');
    if (pop) {
      pop.hidden = true;
      pop.setAttribute('hidden', 'hidden');
    }
    var pf = document.getElementById('vnlh_chat_popup_filter');
    if (pf) pf.value = '';
    chatAktivniKorisniciCache = null;
    chatPopupOpen = false;
    if (!samoPopupBezMijenjanjaRoot && !chatModalOpen) {
      chatSetRootVisible(false);
    }
  }

  function chatTogglePopup(anchorBtn) {
    var pop = document.getElementById('vnlh_chat_popup');
    if (!pop) {
      chatLoadFragment(function () {
        if (document.getElementById('vnlh_chat_popup')) {
          chatTogglePopup(anchorBtn);
        }
      });
      return;
    }
    if (chatPopupOpen) {
      chatClosePopupUi();
      return;
    }
    chatPopupOpen = true;
    chatSetRootVisible(true);
    pop.hidden = false;
    pop.removeAttribute('hidden');
    chatPositionPopup(anchorBtn);
    requestAnimationFrame(function () {
      chatPositionPopup(anchorBtn);
    });

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE + 'poruke_chat_aktivni_korisnici.php', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var lista = document.getElementById('vnlh_chat_popup_list');
      if (!lista) return;
      lista.innerHTML = '';
      var resp = trim(xhr.responseText);
      var arr = [];
      if (resp && resp.charAt(0) === '[') {
        try {
          arr = JSON.parse(resp);
          if (!Array.isArray(arr)) arr = [];
        } catch (e2) {
          arr = [];
        }
      }
      chatAktivniKorisniciCache = arr;
      chatRenderPopupLista(arr);
      var f = document.getElementById('vnlh_chat_popup_filter');
      if (f) f.value = '';
      chatPositionPopup(anchorBtn);
      requestAnimationFrame(function () {
        chatPositionPopup(anchorBtn);
      });
      if (f && typeof f.focus === 'function') {
        try {
          f.focus();
        } catch (eF) {}
      }
    };
    xhr.send();
  }

  /**
   * Klik izvan popupa (capture): zatvara samo popup; ne dira modal. Isključeno: unutar popupa, na chat ikoni.
   */
  function chatDocumentPointerDownClosePopup(ev) {
    if (!chatPopupOpen || chatModalOpen) return;
    var pop = document.getElementById('vnlh_chat_popup');
    if (!pop || pop.hidden || pop.getAttribute('hidden') === 'hidden') return;
    var t = ev.target;
    if (!t || typeof t.closest !== 'function') return;
    if (pop.contains(t)) return;
    if (t.closest('.naslov-forme__chat')) return;
    chatClosePopupUi();
  }

  function chatWirePopupDismissHandlersOnce() {
    if (document.documentElement.getAttribute('data-vnlh-chat-popup-dismiss-wired') === '1') return;
    document.documentElement.setAttribute('data-vnlh-chat-popup-dismiss-wired', '1');
    document.addEventListener('pointerdown', chatDocumentPointerDownClosePopup, true);
  }

  function wireModalCloseHandlers() {
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (chatModalOpen) {
        var modal = document.getElementById('vnlh_chat_modal');
        if (modal && modal.getAttribute('aria-hidden') === 'false') {
          ev.preventDefault();
          ev.stopPropagation();
          chatCloseModalUi();
        }
        return;
      }
      if (chatPopupOpen) {
        ev.preventDefault();
        ev.stopPropagation();
        chatClosePopupUi();
      }
    });
    var modal = document.getElementById('vnlh_chat_modal');
    if (!modal) return;
    modal.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.closest && t.closest('[data-vnlh-chat-close="1"]')) {
        ev.preventDefault();
        chatCloseModalUi();
      }
    });
    var back = document.getElementById('vnlh_chat_btn_back');
    if (back) back.addEventListener('click', function (e) {
      e.preventDefault();
      chatCloseModalUi();
    });
  }

  function wireChatIconClicks() {
    var icons = document.querySelectorAll('.naslov-forme__chat');
    for (var i = 0; i < icons.length; i++) {
      (function (anchor) {
        if (anchor.getAttribute('data-vnlh-chat-bound') === '1') return;
        anchor.setAttribute('data-vnlh-chat-bound', '1');
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          if (chatModalOpen) return;
          chatTogglePopup(anchor);
        });
      })(icons[i]);
    }
  }

  /**
   * Učitava html fragment (0-Chat.php) u body. Jednom po stranici; pri neuspjehu ostaje chatFragmentLoaded=false.
   * onDone se poziva nakon završetka XHR-a (uspjeh ili neuspjeh) da se npr. ponovi toggle.
   */
  function chatLoadFragment(onDone) {
    if (chatFragmentLoaded) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    if (typeof onDone === 'function') {
      chatFragmentOnLoadCallback = onDone;
    }
    if (chatFragmentLoading) {
      return;
    }
    chatFragmentLoading = true;
    injectChatCssOnce();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', CHAT_PHP_FRAGMENT, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      chatFragmentLoading = false;
      var html = xhr.responseText || '';
      if (xhr.status === 200 && trim(html)) {
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        while (wrap.firstChild) {
          document.body.appendChild(wrap.firstChild);
        }
        chatFragmentLoaded = true;
        wireModalCloseHandlers();
        chatWirePopupDismissHandlersOnce();
        chatWireModalActionsOnce();
        chatWirePopupFilterOnce();
        wireChatIconClicks();
      } else if (typeof console !== 'undefined' && console.warn) {
        console.warn('0-Chat.js: fragment se nije učitao (status ' + xhr.status + '). URL: ' + CHAT_PHP_FRAGMENT);
      }
      var cb = chatFragmentOnLoadCallback;
      chatFragmentOnLoadCallback = null;
      if (typeof cb === 'function') {
        try {
          cb();
        } catch (eFragCb) {}
      }
    };
    xhr.send();
  }

  window.vnlhChatBoot = function () {
    if (typeof window.VNLH_CHAT_DOZVOLJEN === 'undefined' || Number(window.VNLH_CHAT_DOZVOLJEN) !== 1) return;
    /* Stilovi (npr. crvena ikona kad ima nepročitanih) moraju biti učitani prije prvog otvaranja popupa – inače klasa postoji bez pravila. */
    injectChatCssOnce();
    /* Odmah poveži ikone: prvi klik lazy-učitava DOM (chatTogglePopup → chatLoadFragment), bez utrke s XHR prefetchom. */
    wireChatIconClicks();
  };

  /**
   * Pun JSON iz 0-Poruke_neprocitane.php: detektira novu nepročitanu chat poruku (rast chat_zadnja_neprocitana_id)
   * – otvara modal ako je zatvoren; ako je otvoren razgovor s istim sugovornikom, automatski osvježava povijest.
   */
  function chatNeprocitanePollFromPoruke(obj) {
    if (typeof window.VNLH_CHAT_DOZVOLJEN === 'undefined' || Number(window.VNLH_CHAT_DOZVOLJEN) !== 1) return;
    if (!obj || typeof obj !== 'object') return;
    var z = typeof obj.chat_zadnja_neprocitana_id === 'number' ? obj.chat_zadnja_neprocitana_id : parseInt(obj.chat_zadnja_neprocitana_id, 10) || 0;
    var sid = typeof obj.chat_sugovornik_id === 'number' ? obj.chat_sugovornik_id : parseInt(obj.chat_sugovornik_id, 10) || 0;
    var prez = typeof obj.chat_sugovornik_prezime === 'string' ? obj.chat_sugovornik_prezime : '';
    var ime = typeof obj.chat_sugovornik_ime === 'string' ? obj.chat_sugovornik_ime : '';

    if (!chatPollBaselineDone) {
      chatPollBaselineDone = true;
      chatLastKnownZadnjaNeprocitanaId = z;
      return;
    }

    var novi = z > chatLastKnownZadnjaNeprocitanaId && z > 0 && sid > 0;
    chatLastKnownZadnjaNeprocitanaId = z;
    if (!novi) return;
    if (chatModalOpen) {
      if (sid === chatModalPartnerId && chatModalPartnerId > 0) {
        chatUcitajPovijest(chatModalPartnerId);
      }
      return;
    }

    function doOpen() {
      if (chatModalOpen) return;
      chatOpenModalForPartner(sid, prez, ime);
    }
    if (chatFragmentLoaded) {
      doOpen();
    } else {
      chatLoadFragment(function () {
        doOpen();
      });
    }
  }

  window.vnlhChatNeprocitanePoll = chatNeprocitanePollFromPoruke;
})();
