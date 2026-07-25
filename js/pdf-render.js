/* pdf-render.js — dijeljeni pdfmake sloj (koriste ga PDF_Stilovi preview i PDF generator).
 * Jedan izvor istine za: lazy-load pdfmake biblioteke + fontova, mm→pt, i mapiranje
 * pdf_paragraf stila → pdfmake element (sastaviOdlomak).
 *
 * sastaviOdlomak(stil, kljuc, tekst, opts):
 *   - stil  = objekt s pdf_paragraf poljima (col → vrijednost); isti oblik daje i DB redak i forma.
 *   - kljuc = pdfmake font ključ (pdf_fontovi.pdfmake_kljuc).
 *   - tekst = string ILI niz pdfmake runova (npr. [{text:'…'},{text:'∴',font:'DejaVuSans'}]).
 *   - opts.fillGapBelow / opts.noGapAbove — logika spajanja pozadine između odlomaka.
 */
// @ts-nocheck
(function (global) {
  'use strict';

  var MM_PT = 2.83465; /* mm → pt */

  function broj(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }
  function mm(stil, col) { return broj(stil[col]) * MM_PT; }
  function bool(v) { return v === 1 || v === '1' || v === true; }
  function str(v) { var s = (v == null ? '' : String(v)).trim(); return s !== '' ? s : null; }

  /* Korijen aplikacije izveden iz VLASTITE <script> lokacije (js/pdf-render.js) — radi iz svake dubine
     (root test.html ili html/ forme), neovisno o vnlhAppBasePathname. */
  var _appBase = (function () {
    if (typeof document === 'undefined') return null;
    var src = (document.currentScript && document.currentScript.src) || '';
    if (!src) {
      var ss = document.getElementsByTagName('script');
      for (var i = 0; i < ss.length; i++) {
        if (ss[i].src && /\/pdf-render\.js(?:[?#]|$)/i.test(ss[i].src)) { src = ss[i].src; break; }
      }
    }
    var m = src.match(/^(.*\/)js\/pdf-render\.js(?:[?#].*)?$/i);
    return m ? m[1] : null;   /* npr. "http://localhost/vnlh/" */
  })();

  function appUrl(rel) {
    if (_appBase) return _appBase + rel;
    if (typeof global.vnlhAppBasePathname === 'function') {
      var base = global.vnlhAppBasePathname();
      if (base !== '') return (base.replace(/\/$/, '') + '/' + rel).replace(/([^:])\/{2,}/g, '$1/');
    }
    return '../' + rel;   /* zadnji fallback */
  }

  function okvirImaLiniju(stil) {
    return ['gore', 'dolje', 'lijevo', 'desno'].some(function (s) {
      return broj(stil['okvir_debljina_' + s + '_mm']) > 0;
    });
  }

  /* Fiksna pozicija stavke: INTERNI marker ~(N) (ubacuje ga resolver iz stavka.fiksna_pozicija) znači da
     sljedeći segment počinje na N mm od lijevog ruba teksta. NIJE korisnička sintaksa — admin koristi polje
     „Fiksna pozicija stavke". Skenira runove i reže na segmente {pos, runovi} (prvi pos=0); pozicije moraju
     rasti (nerastući se ignorira). Vraća null ako markera nema (ponašanje se ne dira). */
  /* Prenesi sva pdfmake run-svojstva (za rezanje runova na tab-segmente / stilove). bold/italics mogu biti
     eksplicitno false (override stila prve stavke), zato != null (ne truthy) da se false ne izgubi. */
  function _prenesiRunStil(src, dst) {
    if (src.font != null) dst.font = src.font;
    if (src.color != null) dst.color = src.color;
    if (src.fontSize != null) dst.fontSize = src.fontSize;
    if (src.bold != null) dst.bold = src.bold;
    if (src.italics != null) dst.italics = src.italics;
    if (src.decoration != null) dst.decoration = src.decoration;
    return dst;
  }

  var TAB_RE = /~\((\d+(?:\.\d+)?)\)/;
  function tabSegmenti(tekst) {
    var runovi = (typeof tekst === 'string') ? [{ text: tekst }] : (tekst || []);
    var ima = false;
    for (var j = 0; j < runovi.length; j++) {
      if (runovi[j] && typeof runovi[j].text === 'string' && TAB_RE.test(runovi[j].text)) { ima = true; break; }
    }
    if (!ima) return null;
    var segs = [{ pos: 0, runovi: [] }];
    var maxPos = 0;
    runovi.forEach(function (r) {
      if (!r || typeof r.text !== 'string') { if (r) segs[segs.length - 1].runovi.push(r); return; }
      var rest = r.text, m;
      while ((m = rest.match(TAB_RE))) {
        var before = rest.slice(0, m.index);
        if (before !== '') { segs[segs.length - 1].runovi.push(_prenesiRunStil(r, { text: before })); }
        var pos = parseFloat(m[1]);
        rest = rest.slice(m.index + m[0].length);
        if (pos > maxPos) { segs.push({ pos: pos, runovi: [] }); maxPos = pos; }   // nerastući → ignoriraj marker
      }
      if (rest !== '') { segs[segs.length - 1].runovi.push(_prenesiRunStil(r, { text: rest })); }
    });
    return segs;
  }

  /* Tab-redak → pdfmake columns: širina stupca = razlika pozicija (mm→pt), zadnji '*'.
     MVP: bez okvira/pozadine; stil (font/veličina/boja/lineHeight) na svaki stupac; poravnanje lijevo. */
  function sastaviTabRedak(stil, kljuc, segs, opts) {
    opts = opts || {};
    var mL = mm(stil, 'uvlaka_lijevo_mm'), mR = mm(stil, 'uvlaka_desno_mm');
    var mT = mm(stil, 'razmak_prije_mm'), mB = mm(stil, 'razmak_poslije_mm');
    var marT = opts.noGapAbove ? 0 : mT, marB = (opts.fillGapBelow || opts.noGapBelow) ? 0 : mB;
    var baza = {
      font: kljuc,
      fontSize: broj(stil.velicina_pt) || 12,
      bold: bool(stil.bold),
      italics: bool(stil.italic),
      lineHeight: (opts.proredVrijednost != null ? broj(opts.proredVrijednost) : (broj(stil.prored) || 1)),
      color: str(stil.boja) || '#000000',
      alignment: 'left'
    };
    if (bool(stil.podcrtano)) baza.decoration = 'underline';
    var cols = segs.map(function (seg, idx) {
      var col = {}; for (var key in baza) col[key] = baza[key];
      col.text = seg.runovi.length ? seg.runovi : '';
      col.width = (idx < segs.length - 1) ? ((segs[idx + 1].pos - seg.pos) * MM_PT) : '*';
      return col;
    });
    return { columns: cols, columnGap: 0, margin: [mL, marT, mR, marB] };
  }

  /* Prazno → linija za ručni upis: INTERNI marker ~L(mm) (ubacuje ga resolver iz prazno_nacin='linija').
     Reže runove na dijelove {tip:'tekst'|'linija'}; vraća null ako markera nema. */
  var LINIJA_RE = /~L\((\d+(?:\.\d+)?)\)/;
  function linijaDijelovi(tekst) {
    var runovi = (typeof tekst === 'string') ? [{ text: tekst }] : (tekst || []);
    var ima = false;
    for (var j = 0; j < runovi.length; j++) {
      if (runovi[j] && typeof runovi[j].text === 'string' && LINIJA_RE.test(runovi[j].text)) { ima = true; break; }
    }
    if (!ima) return null;
    var out = [{ tip: 'tekst', runovi: [] }];
    runovi.forEach(function (r) {
      if (!r || typeof r.text !== 'string') { if (r) out[out.length - 1].runovi.push(r); return; }
      var rest = r.text, m;
      while ((m = rest.match(LINIJA_RE))) {
        var before = rest.slice(0, m.index);
        if (before !== '') out[out.length - 1].runovi.push(_prenesiRunStil(r, { text: before }));
        out.push({ tip: 'linija', mm: parseFloat(m[1]) });
        out.push({ tip: 'tekst', runovi: [] });
        rest = rest.slice(m.index + m[0].length);
      }
      if (rest !== '') out[out.length - 1].runovi.push(_prenesiRunStil(r, { text: rest }));
    });
    return out;
  }

  /* Redak s linijom → pdfmake columns: tekst 'auto', linija fiksne mm širine (donji rub ćelije),
     zadnji stupac '*' da se linija ne rasteže. Visina ćelije ≈ visina retka teksta. */
  function sastaviLinijaRedak(stil, kljuc, dijelovi, opts) {
    opts = opts || {};
    var mL = mm(stil, 'uvlaka_lijevo_mm'), mR = mm(stil, 'uvlaka_desno_mm');
    var mT = mm(stil, 'razmak_prije_mm'), mB = mm(stil, 'razmak_poslije_mm');
    var marT = opts.noGapAbove ? 0 : mT, marB = (opts.fillGapBelow || opts.noGapBelow) ? 0 : mB;
    var fsPt = broj(stil.velicina_pt) || 12;
    var prored = (opts.proredVrijednost != null ? broj(opts.proredVrijednost) : (broj(stil.prored) || 1));
    var boja = str(stil.boja) || '#000000';
    var debljinaPt = 0.25 * MM_PT;
    var lhPt = fsPt * prored * OBTJ_LH_FAKTOR;
    var baza = {
      font: kljuc, fontSize: fsPt, bold: bool(stil.bold), italics: bool(stil.italic),
      lineHeight: prored, color: boja, alignment: 'left'
    };
    if (bool(stil.podcrtano)) baza.decoration = 'underline';
    /* Poravnanje odlomka: stupci su 'auto' širine, pa se centriranje/desno postiže praznim
       '*' spacerima s obje / lijeve strane (pdfmake columns nema alignment). */
    var por = str(stil.poravnanje) || 'left';
    var cols = [];
    if (por === 'center' || por === 'right') cols.push({ width: '*', text: '' });
    dijelovi.forEach(function (d) {
      if (d.tip === 'linija') {
        cols.push({
          width: (d.mm > 0 ? d.mm : 40) * MM_PT,
          table: { widths: ['*'], heights: [lhPt], body: [[{ text: '', fontSize: 1 }]] },
          layout: {
            hLineWidth: function (i) { return (i === 0) ? 0 : debljinaPt; },
            vLineWidth: function () { return 0; },
            hLineColor: function () { return boja; },
            paddingLeft: function () { return 0; }, paddingRight: function () { return 0; },
            paddingTop: function () { return 0; }, paddingBottom: function () { return 0; }
          }
        });
        return;
      }
      if (!d.runovi.length) return;
      var col = {}; for (var k in baza) col[k] = baza[k];
      col.text = d.runovi;
      col.width = 'auto';
      cols.push(col);
    });
    if (por !== 'right') cols.push({ width: '*', text: '' });
    return { columns: cols, columnGap: 0, margin: [mL, marT, mR, marB] };
  }

  /* Jedan odlomak (margin = razmaci/uvlake; okvir ili pozadina ga omotaju u tablicu). */
  function sastaviOdlomak(stil, kljuc, tekst, opts) {
    stil = stil || {};
    opts = opts || {};
    /* Linija za ručni upis ima prednost pred tab-pozicijama (ne kombiniraju se u istom retku). */
    var _linDijelovi = linijaDijelovi(tekst);
    if (_linDijelovi) return sastaviLinijaRedak(stil, kljuc, _linDijelovi, opts);
    var _tabSegs = tabSegmenti(tekst);
    if (_tabSegs) {
      if (_tabSegs.length > 1) return sastaviTabRedak(stil, kljuc, _tabSegs, opts);
      tekst = _tabSegs[0].runovi.length ? _tabSegs[0].runovi : '';   // svi markeri nevaljani → očišćen tekst
    }
    var par = {
      text: tekst,
      font: kljuc,
      fontSize: broj(stil.velicina_pt) || 12,
      bold: bool(stil.bold),
      italics: bool(stil.italic),
      lineHeight: (opts.proredVrijednost != null ? broj(opts.proredVrijednost) : (broj(stil.prored) || 1)),
      alignment: str(stil.poravnanje) || 'left',
      color: str(stil.boja) || '#000000'
    };
    if (bool(stil.podcrtano)) par.decoration = 'underline';
    var uvlPrvi = mm(stil, 'uvlaka_prvi_red_mm'); if (uvlPrvi) par.leadingIndent = uvlPrvi;

    var mL = mm(stil, 'uvlaka_lijevo_mm'), mR = mm(stil, 'uvlaka_desno_mm');
    var mT = mm(stil, 'razmak_prije_mm'), mB = mm(stil, 'razmak_poslije_mm');
    var marT = opts.noGapAbove ? 0 : mT;
    var marB = (opts.fillGapBelow || opts.noGapBelow) ? 0 : mB;   /* noGapBelow: samo nuliraj razmak (bez pozadina-semantike fillGapBelow) */

    if (okvirImaLiniju(stil)) {
      /* Okvir dominira: tablica s 1 ćelijom (border po stranama, podloga = okvir_boja_podloge, padding okvira). */
      var oG = mm(stil, 'okvir_debljina_gore_mm'), oD = mm(stil, 'okvir_debljina_dolje_mm'),
          oL = mm(stil, 'okvir_debljina_lijevo_mm'), oR = mm(stil, 'okvir_debljina_desno_mm');
      var oBoja = str(stil.okvir_boja) || '#000000';
      var podloga = str(stil.okvir_boja_podloge);
      if (podloga) par.fillColor = podloga;
      return {
        table: { widths: ['*'], body: [[par]] },
        layout: {
          hLineWidth: function (i) { return i === 0 ? oG : oD; },
          vLineWidth: function (i) { return i === 0 ? oL : oR; },
          hLineColor: function () { return oBoja; },
          vLineColor: function () { return oBoja; },
          paddingLeft: function () { return mm(stil, 'okvir_padding_lijevo_mm'); },
          paddingRight: function () { return mm(stil, 'okvir_padding_desno_mm'); },
          paddingTop: function () { return mm(stil, 'okvir_padding_gore_mm'); },
          paddingBottom: function () { return mm(stil, 'okvir_padding_dolje_mm'); }
        },
        margin: [bool(stil.okvir_do_lijeve_margine) ? 0 : mL, marT, bool(stil.okvir_do_desne_margine) ? 0 : mR, marB]
      };
    }
    if (str(stil.boja_pozadine)) {
      /* Pozadina retka: tablica s 1 ćelijom (fill = boja_pozadine, padding trake). */
      par.fillColor = str(stil.boja_pozadine);
      var puna = bool(stil.pozadina_cijeli_red);
      var dodatakDolje = opts.fillGapBelow ? (mT + mB) : 0;
      var layoutTraka = {
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; },
        paddingLeft: function () { return mm(stil, 'traka_padding_lijevo_mm'); },
        paddingRight: function () { return mm(stil, 'traka_padding_desno_mm'); },
        paddingTop: function () { return mm(stil, 'traka_padding_gore_mm'); },
        paddingBottom: function () { return mm(stil, 'traka_padding_dolje_mm') + dodatakDolje; }
      };
      if (puna) {
        return { table: { widths: ['*'], body: [[par]] }, layout: layoutTraka, margin: [mL, marT, mR, marB] };
      }
      /* Auto-širina (pozadina samo iza teksta): pdfmake tablica nema alignment pa bi ostala lijevo.
         Za center/right omotamo „traku" u columns sa spacerima da bude centrirana/desno poravnata. */
      var por = str(stil.poravnanje) || 'left';
      /* Apsolutni mod: X pozicionira kutiju → koristi bare auto-širinu (align-columns bi zauzeo punu širinu). */
      if (!opts.apsolutna && (por === 'center' || por === 'right')) {
        var trakaCol = { width: 'auto', table: { widths: ['auto'], body: [[par]] }, layout: layoutTraka };
        var cols = (por === 'center')
          ? [{ width: '*', text: '' }, trakaCol, { width: '*', text: '' }]
          : [{ width: '*', text: '' }, trakaCol];
        return { columns: cols, columnGap: 0, margin: [mL, marT, mR, marB] };
      }
      return { table: { widths: ['auto'], body: [[par]] }, layout: layoutTraka, margin: [mL, marT, mR, marB] };
    }
    par.margin = [mL, marT, mR, marB];
    return par;
  }

  /* Slika-stavka → pdfmake image element (dataurl + dimenzije/poravnanje iz pdf_slika_stil). */
  function sastaviSliku(stil, dataurl, opts) {
    var img = { image: dataurl };
    if (!stil) { img.fit = [200, 200]; return img; }   /* bez stila: razuman default okvir */

    var w = mm(stil, 'sirina_mm'), h = mm(stil, 'visina_mm');
    if (w > 0 && h > 0) {
      if (str(stil.skaliranje) === 'razvuci') { img.width = w; img.height = h; }
      else { img.fit = [w, h]; }              /* uklopi = čuva proporcije */
    } else if (w > 0) { img.width = w; }

    /* Okvir (pdfmake slika nema border) → omotaj sliku u tablicu w×h s obrubom, kao placeholder.
       Aktivira se samo kad stil ima okvir + debljinu i poznate dimenzije. */
    var okvirW = (bool(stil.okvir) && mm(stil, 'okvir_debljina_mm') > 0) ? mm(stil, 'okvir_debljina_mm') : 0;
    var el;
    if (okvirW > 0 && w > 0 && h > 0) {
      var okvirBoja = str(stil.okvir_boja) || '#000000';
      el = {
        table: { widths: [w], heights: [h], body: [[ { image: dataurl, fit: [w, h], alignment: 'center' } ]] },
        layout: {
          hLineWidth: function () { return okvirW; }, vLineWidth: function () { return okvirW; },
          hLineColor: function () { return okvirBoja; }, vLineColor: function () { return okvirBoja; },
          paddingLeft: function () { return 0; }, paddingRight: function () { return 0; },
          paddingTop: function () { return 0; }, paddingBottom: function () { return 0; }
        }
      };
    } else {
      el = img;
    }

    var ph = str(stil.poravnanje_h);
    if (ph === 'centar') el.alignment = 'center';
    else if (ph === 'desno') el.alignment = 'right';
    else if (ph === 'lijevo') el.alignment = 'left';
    /* Apsolutno pozicioniranje: x/y (mm→pt) od ishodišta zone (opts.origin), zadano gornji-lijevi rub stranice. */
    if (str(stil.pozicioniranje) === 'apsolutno') {
      var o = (opts && opts.origin) || { x: 0, y: 0 };
      el.absolutePosition = { x: (o.x || 0) + mm(stil, 'pozicija_x_mm'), y: (o.y || 0) + mm(stil, 'pozicija_y_mm') };
    }
    return el;
  }

  /* Placeholder za NERAZRIJEŠENU dinamičku sliku (npr. uređivanje/pregled bez konteksta):
     siva ploha dimenzija iz stila (sirina_mm × visina_mm), s ključem konteksta u sredini.
     Okvir SAMO ako je definiran u stilu (okvir + okvir_debljina_mm), bojom okvir_boja.
     Pozicioniranje/poravnanje preslikano iz sastaviSliku radi istog položaja kao prava slika. */
  function sastaviPlaceholder(stil, tekst, opts) {
    stil = stil || {};
    var w = mm(stil, 'sirina_mm'), h = mm(stil, 'visina_mm');
    if (!(w > 0)) w = 120;            /* bez dimenzija u stilu: razuman default okvir */
    if (!(h > 0)) h = 60;
    var okvirW = (bool(stil.okvir) && mm(stil, 'okvir_debljina_mm') > 0) ? mm(stil, 'okvir_debljina_mm') : 0;
    var okvirBoja = str(stil.okvir_boja) || '#000000';
    var fs = (opts && opts.veliki) ? 13 : 8;   /* uz prikazane vodilice tekst placeholdera je veći (čitljiv) */
    var cell = {
      text: str(tekst) || '',
      fontSize: fs,
      color: '#555555',
      alignment: 'center',
      fillColor: '#cccccc',
      margin: [2, Math.max(0, (h - (fs + 3)) / 2), 2, 0]   /* grubo vertikalno centriranje ključa */
    };
    var box = {
      table: { widths: [w], heights: [h], body: [[cell]] },
      layout: {
        hLineWidth: function () { return okvirW; }, vLineWidth: function () { return okvirW; },
        hLineColor: function () { return okvirBoja; }, vLineColor: function () { return okvirBoja; },
        paddingLeft: function () { return 0; }, paddingRight: function () { return 0; },
        paddingTop: function () { return 0; }, paddingBottom: function () { return 0; }
      }
    };
    var ph = str(stil.poravnanje_h);
    if (ph === 'centar') box.alignment = 'center';
    else if (ph === 'desno') box.alignment = 'right';
    else if (ph === 'lijevo') box.alignment = 'left';
    if (str(stil.pozicioniranje) === 'apsolutno') {
      var o = (opts && opts.origin) || { x: 0, y: 0 };
      box.absolutePosition = { x: (o.x || 0) + mm(stil, 'pozicija_x_mm'), y: (o.y || 0) + mm(stil, 'pozicija_y_mm') };
    }
    return box;
  }

  /* ===== Vezani tekst blokovi: mjerenje teksta + prelijevanje (obtjecanje) =====
     Dvije podesive konstante (fidelity):
       OBTJ_LH_FAKTOR — odnos stvarnog proreda u pdfmake-u i (velicina_pt × prored). pdfkit natural
                        line ≈ 1.15× veličine; ako blok prima previše/premalo redova, ugodi ovo.
       Mjerni font     — širina lomljenja mjeri se canvasom u istoj porodici; točno od 2. rendera
                        (1. render može biti grub dok se font ne registrira). */
  var OBTJ_LH_FAKTOR = 1.15;   /* fallback visine reda dok font nije učitan (1. render) */
  var OBTJ_LH_FINO = 1.0;      /* fino doštimavanje izmjerene visine reda (ako blok prima red previše/premalo) */
  var _mjerCanvas = null, _mjerFontReg = {};
  function _mjerCtx() {
    if (typeof global.document === 'undefined' || !global.document.createElement) return null;
    if (!_mjerCanvas) _mjerCanvas = global.document.createElement('canvas');
    return _mjerCanvas.getContext ? _mjerCanvas.getContext('2d') : null;
  }
  /* Registriraj mjerni font (FontFace) iz vfs-a ili s URL-a — točnije lomljenje na sljedećim renderima. */
  function _registrirajMjerniFont(porodica) {
    if (!porodica || _mjerFontReg[porodica]) return;
    _mjerFontReg[porodica] = true;
    try {
      if (typeof global.FontFace === 'undefined' || typeof global.document === 'undefined' || !global.document.fonts) return;
      var file = porodica + '-Regular.ttf';
      var src = (global.pdfMake && global.pdfMake.vfs && global.pdfMake.vfs[file])
        ? 'url(data:font/ttf;base64,' + global.pdfMake.vfs[file] + ')'
        : 'url(' + appUrl('fontovi/' + file) + ')';
      var ff = new global.FontFace(porodica, src);
      ff.load().then(function (l) { try { global.document.fonts.add(l); } catch (e) {} }).catch(function () {});
    } catch (e) {}
  }
  /* Lomi JEDAN odlomak na linije (canvas), uz uvlaku prvog reda (prvi red ima manju širinu).
     Vraća niz linija (stringova); za split bloka i brojanje redova u prelijevanju okvira. */
  function _lomiOdlomak(tekst, maxW, indentPt, fontStr) {
    var ctx = _mjerCtx();
    var rijeci = String(tekst == null ? '' : tekst).split(/\s+/).filter(function (w) { return w.length; });
    if (!rijeci.length) return [''];
    if (!ctx) return [String(tekst)];
    ctx.font = fontStr;
    var lines = [], cur = '', prvi = true;
    for (var i = 0; i < rijeci.length; i++) {
      var probe = cur ? (cur + ' ' + rijeci[i]) : rijeci[i];
      var w = prvi ? (maxW - (indentPt || 0)) : maxW;
      if (cur && ctx.measureText(probe).width > w) { lines.push(cur); cur = rijeci[i]; prvi = false; }
      else cur = probe;
    }
    lines.push(cur);
    return lines;
  }

  /* Kao _lomiOdlomak, ali nad stiliziranim riječima [{t, r}] — vraća linije (svaka = niz stiliziranih riječi).
     Mjeri po TEKSTU s istim fontStr (veličina početnog dijela) → identičan lom kao plain varijanta istog teksta. */
  function _lomiOdlomakStyled(words, maxW, indentPt, fontStr) {
    var ctx = _mjerCtx();
    if (!words.length) return [[]];
    if (!ctx) return [words.slice()];
    ctx.font = fontStr;
    var lines = [], cur = [], curTxt = '', prvi = true;
    for (var i = 0; i < words.length; i++) {
      var probe = curTxt ? (curTxt + ' ' + words[i].t) : words[i].t;
      var w = prvi ? (maxW - (indentPt || 0)) : maxW;
      if (cur.length && ctx.measureText(probe).width > w) { lines.push(cur); cur = [words[i]]; curTxt = words[i].t; prvi = false; }
      else { cur.push(words[i]); curTxt = probe; }
    }
    lines.push(cur);
    return lines;
  }

  /* Javno: broj prelomljenih redaka + visina reda (pt) za tekst na zadanoj širini/fontu.
     Koristi isti FontFace-mjerni mehanizam kao render (točno kao pdfmake lom). Za V poravnanje ćelija tablice. */
  function mjeriRedove(text, maxWpt, porodica, fsPt, bold) {
    _registrirajMjerniFont(porodica);
    var fs = broj(fsPt) || 12;
    var fontStr = (bold ? 'bold ' : '') + fs + 'px "' + (porodica || 'sans-serif') + '", sans-serif';
    var mc = _mjerCtx();
    if (mc) mc.font = fontStr;
    /* Predugačku liniju (riječ šira od stupca) pdfmake lomi po znaku — nadopuni preko lomOdlomka (koji lomi samo po razmaku). */
    function podredovi(linija) {
      if (!mc || !linija) return 1;
      if (mc.measureText(linija).width <= maxWpt) return 1;
      var n = 0, rest = linija;
      while (rest.length > 0) {
        var fit = 1;
        while (fit < rest.length && mc.measureText(rest.slice(0, fit + 1)).width <= maxWpt) fit++;
        n++; rest = rest.slice(fit);
      }
      return Math.max(1, n);
    }
    var redova = 0, par = String(text == null ? '' : text).split('\n');
    for (var i = 0; i < par.length; i++) {
      var lin = _lomiOdlomak(par[i], maxWpt, 0, fontStr);
      for (var j = 0; j < lin.length; j++) redova += podredovi(lin[j]);
    }
    var lh = fs;
    if (mc && porodica && global.document && global.document.fonts && global.document.fonts.check) {
      try {
        if (global.document.fonts.check(fontStr)) {
          mc.font = fontStr;
          var mt = mc.measureText('Hg');
          if (mt && mt.fontBoundingBoxAscent != null && mt.fontBoundingBoxDescent != null) {
            var nat = mt.fontBoundingBoxAscent + mt.fontBoundingBoxDescent;
            if (nat > 0) lh = nat;
          }
        }
      } catch (e) {}
    }
    return { redova: Math.max(1, redova), visinaReda: lh };
  }

  /* Gornja margina (pt) za V poravnanje ćelije: 'gore/top'=0, 'centar/center/middle'=½ razlike, 'dolje/bottom'=puna. */
  function vMarginaCelije(valign, nRedaka, maxRedaka, lhPt) {
    var extra = Math.max(0, (maxRedaka || 1) - (nRedaka || 1));
    if (extra <= 0) return 0;
    if (valign === 'centar' || valign === 'center' || valign === 'middle') return extra / 2 * (lhPt || 0);
    if (valign === 'dolje' || valign === 'bottom') return extra * (lhPt || 0);
    return 0;
  }
  /* Za skup ćelija ISTOG fonta (npr. svi zaglavlje ili svi podaci jednog reda): izmjeri i vrati marginu po ćeliji.
     celije: [{ text, valign, sirinaPt }] → [{ redova, marginaGore }]. Za V poravnanje ćelija pdfmake tablice. */
  function valignCelije(celije, porodica, fsPt, bold) {
    var mj = (celije || []).map(function (c) { return mjeriRedove(c.text, c.sirinaPt, porodica, fsPt, bold); });
    var maxR = mj.reduce(function (m, x) { return Math.max(m, x.redova); }, 1);
    return (celije || []).map(function (c, i) {
      return { redova: mj[i].redova, marginaGore: vMarginaCelije(c.valign, mj[i].redova, maxR, mj[i].visinaReda) };
    });
  }

  /* Dimenzije stranice u pt (s orijentacijom). Za izračun ishodišta apsolutnih slika (npr. podnožje). */
  var FORMATI_MM = { A4: [210, 297], A5: [148, 210], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
  function dimsPt(t) {
    var fmt = str(t.format_papira) || 'A4', w, h, d;
    if (fmt === 'custom') { w = broj(t.sirina_mm); h = broj(t.visina_mm); }
    else { d = FORMATI_MM[fmt] || FORMATI_MM.A4; w = d[0]; h = d[1]; }
    if (str(t.orijentacija) === 'landscape') { var tmp = w; w = h; h = tmp; }
    return { w: w * MM_PT, h: h * MM_PT };
  }

  /* Render model (iz PDF_Generator_resolve.php) → pdfmake docDefinition.
     Zone: zaglavlje→header, podnožje→footer (+ brojač), naslovna/tijelo→content. */
  /* Margine tijela (kao PDF_Template, PDF_Template_CRUD.js): margina je UVIJEK tvrda granica; zaglavlje/
     podnožje, ako vrijedi na stranici, ponaša se kao da je taj prostor već popunjen → tijelo se gura na
     (visina_zone + padding) ako to prelazi marginu. Padding = razmak iza dna zaglavlja / ispred vrha podnožja. */
  function gornjaTijela(t, zaglavljeVrijedi) {
    var mg = mm(t, 'margina_gore_mm');
    return zaglavljeVrijedi ? Math.max(mg, mm(t, 'zaglavlje_visina_mm') + mm(t, 'zaglavlje_padding_mm')) : mg;
  }
  function donjaTijela(t, podnozjeVrijedi) {
    var md = mm(t, 'margina_dolje_mm');
    return podnozjeVrijedi ? Math.max(md, mm(t, 'podnozje_visina_mm') + mm(t, 'podnozje_padding_mm')) : md;
  }

  /* Vodilice (margine + zone zaglavlja/podnožja) iscrtane u SAMOM PDF-u kao background —
     za provjeru poravnanja elemenata u odnosu na margine. pageSize iz pdfmake je u pt i već orijentiran. */
  /* efektivnaStrFn(currentPage) → broj stranice po kojem se ODREĐUJU zone (zaglavlje/podnožje).
     Vjeran prikaz: vraća stvarni currentPage (svaka stranica svoje zone). Simulacija (jednostranični
     dokument): vraća fiksnu (1/2). Zone se računaju PO STRANICI unutar vraćene funkcije. */
  function vodiliceBackground(t, efektivnaStrFn) {
    var mL = mm(t, 'margina_lijevo_mm'), mR = mm(t, 'margina_desno_mm');
    var BOJA = '#2d6da3';
    var podnOd = broj(t.podnozje_od_stranice) || 1;
    var primjenaSvaka = str(t.zaglavlje_primjena) === 'svaka';
    return function (currentPage, pageSize) {
      var stranica = efektivnaStrFn ? efektivnaStrFn(currentPage) : currentPage;
      /* Zone po pravilima stranice: zaglavlje (primjena=svaka → svaka, inače samo 1.); podnožje od_stranice. */
      var zaglNaStrL = bool(t.zaglavlje) && broj(t.zaglavlje_visina_mm) > 0 && (stranica === 1 || primjenaSvaka);
      var podnNaStrL = bool(t.podnozje) && broj(t.podnozje_visina_mm) > 0 && (stranica >= podnOd);
      var zv = zaglNaStrL ? mm(t, 'zaglavlje_visina_mm') : 0;
      var pv = podnNaStrL ? mm(t, 'podnozje_visina_mm') : 0;
      /* Okvir tijela prati efektivne margine (zaglavlje/podnožje); uvjet vrijedi po pravilu stranice. */
      var mTef = gornjaTijela(t, bool(t.zaglavlje) && (stranica === 1 || primjenaSvaka));
      var mBef = donjaTijela(t, bool(t.podnozje) && (stranica >= podnOd));
      var W = pageSize.width, H = pageSize.height;
      var canvas = [
        /* okvir margina (tijelo) — iscrtkano */
        { type: 'rect', x: mL, y: mTef, w: W - mL - mR, h: H - mTef - mBef, lineColor: BOJA, lineWidth: 0.6, dash: { length: 3 } }
      ];
      if (zv > 0) canvas.push({ type: 'rect', x: mL, y: 0, w: W - mL - mR, h: zv, color: BOJA, fillOpacity: 0.15, lineColor: BOJA, lineWidth: 0.4 });
      if (pv > 0) canvas.push({ type: 'rect', x: mL, y: H - pv, w: W - mL - mR, h: pv, color: BOJA, fillOpacity: 0.15, lineColor: BOJA, lineWidth: 0.4 });
      var out = [{ canvas: canvas }];
      if (zv > 0) out.push({ text: 'Zaglavlje', font: 'DejaVuSans', fontSize: 6, color: '#1d4e74', absolutePosition: { x: mL + 2, y: 1 } });
      if (pv > 0) out.push({ text: 'Podnožje', font: 'DejaVuSans', fontSize: 6, color: '#1d4e74', absolutePosition: { x: mL + 2, y: H - pv + 1 } });
      return out;
    };
  }

  function sastaviDocDefinition(model, opts) {
    model = model || {};
    opts = opts || {};
    var t = model.template || {};
    var dimPt = dimsPt(t);
    var parStilovi = model.stilovi_paragraf || {};
    var slikaStilovi = model.stilovi_slika || {};
    var stavke = (model.stavke || []).slice().sort(function (a, b) {
      return (a.redoslijed || 0) - (b.redoslijed || 0);
    });

    /* Jedna stavka → niz pdfmake elemenata (tekst = više odlomaka; slika = jedan). */
    /* Tablica (vrsta=tablica): pdfmake table iz razriješenog modela (stil + stupci + redovi).
       Logika prati PDF_Stilovi_Tablice_CRUD preview (obrubi/ispune/padding/poravnanja), ali iz podataka. */
    function sastaviTablica(tab) {
      var st = (tab && tab.stil) || {}, stupci = (tab && tab.stupci) || [], redovi = (tab && tab.redovi) || [];
      var nCol = stupci.length || (redovi[0] ? redovi[0].length : 0);
      function num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }
      function mmpt(v) { return num(v) * MM_PT; }
      function porav(o) { return o === 'centar' ? 'center' : (o === 'desno' ? 'right' : 'left'); }
      var imaZag = (st.prikazi_zaglavlje == null) ? true : !!(+st.prikazi_zaglavlje);
      var prvaKolZag = !!(+st.prva_kolona_kao_zaglavlje);
      var zagStil = { fontSize: num(st.zaglavlje_velicina_pt) || 10, bold: !!(+st.zaglavlje_bold), italics: !!(+st.zaglavlje_italic) };
      if (st.zaglavlje_font_kljuc) zagStil.font = st.zaglavlje_font_kljuc;
      if (+st.zaglavlje_podcrtano) zagStil.decoration = 'underline';
      if (st.zaglavlje_boja) zagStil.color = st.zaglavlje_boja;
      var podStil = { fontSize: num(st.podaci_velicina_pt) || 10, bold: !!(+st.podaci_bold), italics: !!(+st.podaci_italic) };
      if (st.podaci_font_kljuc) podStil.font = st.podaci_font_kljuc;
      if (+st.podaci_podcrtano) podStil.decoration = 'underline';
      if (st.podaci_boja) podStil.color = st.podaci_boja;
      var meki = (st.meki_prijelom != null && String(st.meki_prijelom) !== '') ? String(st.meki_prijelom) : '';
      function mekiLom(v) { v = (v == null ? '' : String(v)); return meki ? v.split(meki).join('\n') : v; }
      function celija(txt, align, stil) { var c = { text: txt, alignment: align }; for (var k in stil) c[k] = stil[k]; return c; }
      var widths = [];
      for (var ci = 0; ci < nCol; ci++) { var k = stupci[ci] || {}; widths.push((k.sirina_tip === 'fiksna' && num(k.sirina_mm) > 0) ? mmpt(k.sirina_mm) : '*'); }
      var body = [];
      if (imaZag) {
        var zrow = [];
        for (var zi = 0; zi < nCol; zi++) { var kz = stupci[zi] || {}; zrow.push(celija(mekiLom((kz.zag_prefix || '') + (kz.zaglavlje || '') + (kz.zag_sufiks || '')) || ' ', porav(kz.zag_orijentacija), zagStil)); }
        body.push(zrow);
      }
      for (var r = 0; r < redovi.length; r++) {
        var drow = [];
        for (var di = 0; di < nCol; di++) {
          var kd = stupci[di] || {}, prvaZag = (prvaKolZag && di === 0), bs = prvaZag ? zagStil : podStil;
          var raw = (redovi[r][di] != null) ? String(redovi[r][di]) : '';
          drow.push(celija(mekiLom((kd.pod_prefix || '') + raw + (kd.pod_sufiks || '')), porav(prvaZag ? kd.zag_orijentacija : kd.pod_orijentacija), bs));
        }
        body.push(drow);
      }
      var okvirD = mmpt(st.okvir_debljina_mm), okvirB = st.okvir_boja || '#000000';
      var zagLinD = mmpt(st.zaglavlje_linija_debljina_mm), zagLinB = st.zaglavlje_linija_boja || '#000000';
      var vertD = mmpt(st.linija_vert_debljina_mm), vertB = st.linija_vert_boja || '#000000';
      var redD = mmpt(st.linija_red_debljina_mm), redB = st.linija_red_boja || '#000000';
      var zagPoz = (+st.zaglavlje_pozadina) ? (st.zaglavlje_pozadina_boja || null) : null;
      var zebra = (+st.zebra) ? (st.zebra_boja || null) : null;
      var zPadG = mmpt(st.zaglavlje_padding_gore_mm), zPadD = mmpt(st.zaglavlje_padding_dolje_mm);
      var pPadG = mmpt(st.podaci_padding_gore_mm), pPadD = mmpt(st.podaci_padding_dolje_mm);
      var node = {
        table: { headerRows: (imaZag && st.zaglavlje_ponavljanje === 'svaka') ? 1 : 0, dontBreakRows: !!(+st.ne_lomi_red), widths: widths, body: body },
        layout: {
          hLineWidth: function (i, n) { if (i === 0 || i === n.table.body.length) return okvirD; if (imaZag && i === 1) return zagLinD; return redD; },
          vLineWidth: function (i, n) { return (i === 0 || i === n.table.widths.length) ? okvirD : vertD; },
          hLineColor: function (i, n) { if (i === 0 || i === n.table.body.length) return okvirB; if (imaZag && i === 1) return zagLinB; return redB; },
          vLineColor: function (i, n) { return (i === 0 || i === n.table.widths.length) ? okvirB : vertB; },
          fillColor: function (rowIndex, n, colIndex) {
            if (imaZag && rowIndex === 0) return zagPoz;
            if (prvaKolZag && colIndex === 0) return zagPoz;
            var dataIdx = imaZag ? rowIndex - 1 : rowIndex;
            return (zebra && dataIdx >= 0 && dataIdx % 2 === 1) ? zebra : null;
          },
          paddingLeft: function (ci) { var kk = stupci[ci] || {}; return mmpt(kk.pod_padding_lijevo_mm) || mmpt(kk.zag_padding_lijevo_mm) || 2; },
          paddingRight: function (ci) { var kk = stupci[ci] || {}; return mmpt(kk.pod_padding_desno_mm) || mmpt(kk.zag_padding_desno_mm) || 2; },
          paddingTop: function (rowIndex) { return (imaZag && rowIndex === 0) ? zPadG : pPadG; },
          paddingBottom: function (rowIndex) { return (imaZag && rowIndex === 0) ? zPadD : pPadD; }
        },
        margin: [0, mmpt(st.razmak_prije_mm), 0, mmpt(st.razmak_poslije_mm)]
      };
      if (st.pozicioniranje === 'apsolutno') { node.absolutePosition = { x: mmpt(st.pozicija_x_mm), y: mmpt(st.pozicija_y_mm) }; return node; }
      var por = st.poravnanje, sp = { width: '*', text: '' };
      if (por === 'centar') { var nc = {}; for (var a in node) nc[a] = node[a]; nc.width = 'auto'; return { columns: [sp, nc, { width: '*', text: '' }] }; }
      if (por === 'desno') { var nd = {}; for (var b in node) nd[b] = node[b]; nd.width = 'auto'; return { columns: [sp, nd] }; }
      return node;
    }

    /* Linije (vrsta=linije): prazan prostor za ručno popunjavanje — opcionalna labela +
       N linija (puno/crtkano/točkasto). Visina reda = paragraf (velicina × prored × lh fonta).
       Linija = donji rub tablice-ćelije (crtkanje kroz layout.hLineStyle). */
    function sastaviLinije(s) {
      var ps = (s.paragraf_id && parStilovi[s.paragraf_id]) ? parStilovi[s.paragraf_id] : {};
      var fsPt = broj(ps.velicina_pt) || 12;
      var prored = broj(ps.prored) || 1;
      if (opts.proredVrijednost != null && opts.proredStilId && ps && +ps.id === +opts.proredStilId) prored = broj(opts.proredVrijednost);
      var boja = str(ps.boja) || '#000000';
      var kljuc = s.font_kljuc || undefined;
      /* Visina reda iz metrike fonta (server lh), fallback konstanta. */
      var serverLh = null;
      (model.fontovi || []).forEach(function (f) { if (f.kljuc === kljuc && f.lh != null) serverLh = broj(f.lh); });
      var lhFaktor = (serverLh && serverLh > 0.8 && serverLh < 2.2) ? serverLh : OBTJ_LH_FAKTOR;
      var lhPt = fsPt * prored * lhFaktor * OBTJ_LH_FINO;

      var n = parseInt(s.broj_linija, 10); if (!(n > 0)) n = 1;
      var debljinaPt = broj(s.linija_debljina_mm) * MM_PT; if (!(debljinaPt > 0)) debljinaPt = 0.25 * MM_PT;
      var stilLin = s.stil_linije || 'crtkano';
      var dash = null;
      if (stilLin === 'tockasto') dash = { length: Math.max(0.5, debljinaPt), space: Math.max(1.1, debljinaPt * 1.6) };   /* gušće točke */
      else if (stilLin !== 'puno') dash = { length: 2, space: 1.5 };   /* crtkano (default) — gušće crtice */

      var mL = mm(t, 'margina_lijevo_mm'), mR = mm(t, 'margina_desno_mm');
      var W = dimPt.w - mL - mR;
      var razT = mm(ps, 'razmak_prije_mm'), razB = mm(ps, 'razmak_poslije_mm');

      var labela = str(s.labela);
      var uIstom = bool(s.labela_u_istom_redu) && !!labela;

      function linijaLayout() {
        return {
          hLineWidth: function (i) { return (i === 0) ? 0 : debljinaPt; },   /* samo donji rub svakog reda */
          vLineWidth: function () { return 0; },
          hLineColor: function () { return boja; },
          hLineStyle: dash ? function () { return { dash: dash }; } : undefined,
          paddingLeft: function () { return 0; }, paddingRight: function () { return 0; },
          paddingTop: function () { return 0; }, paddingBottom: function () { return 0; }
        };
      }
      function linijeTablica(brojR, w, margin) {
        var body = [], heights = [];
        for (var r = 0; r < brojR; r++) { body.push([{ text: '', fontSize: 1 }]); heights.push(lhPt); }
        return { table: { widths: [w], heights: heights, body: body }, layout: linijaLayout(), margin: margin || [0, 0, 0, 0] };
      }

      var out = [], linijeCiljevi = [];   /* linijeCiljevi = elementi koje pomak diže (samo linije, ne labela) */
      if (uIstom) {
        var labelaNode = {
          text: labela, font: kljuc, fontSize: fsPt, color: boja, lineHeight: prored,
          bold: bool(ps.bold), italics: bool(ps.italic), width: 'auto', margin: [0, 0, 3, 0]
        };
        if (bool(ps.podcrtano)) labelaNode.decoration = 'underline';
        var nacin = s.prva_linija_nacin || 'margina';
        var prvaLin = linijeTablica(1, '*', [0, 0, 0, 0]);        /* unutarnja tablica uvijek puni svoj stupac */
        var stupci = [labelaNode];
        if (nacin === 'duzina' && broj(s.prva_linija_mm) > 0) {
          prvaLin.width = broj(s.prva_linija_mm) * MM_PT;         /* fiksna dužina linije */
          stupci.push(prvaLin);
          stupci.push({ width: '*', text: '' });                 /* prazan ostatak reda */
        } else if (nacin === 'fiksni_x') {
          var xLoc = (broj(s.prva_linija_mm) * MM_PT) - mL;       /* apsolutni X → lokalno (0 = lijeva margina) */
          var filler = W - xLoc; if (filler < 0) filler = 0;
          prvaLin.width = '*';                                    /* puni do fillera → kraj na X */
          stupci.push(prvaLin);
          if (filler > 0) stupci.push({ width: filler, text: '' });
        } else {
          prvaLin.width = '*';                                    /* margina: do desne margine */
          stupci.push(prvaLin);
        }
        out.push({ columns: stupci, columnGap: 0, margin: [0, razT, 0, (n > 1 ? 0 : razB)] });
        linijeCiljevi.push(prvaLin);                              /* pomak diže SAMO liniju (ne labelu) */
        if (n > 1) { var ltInline = linijeTablica(n - 1, '*', [0, 0, 0, razB]); out.push(ltInline); linijeCiljevi.push(ltInline); }
      } else {
        if (labela) out.push(sastaviOdlomak(ps, kljuc, labela, {}));   /* labela u svom redu — ostaje na mjestu */
        var ltBlok = linijeTablica(n, '*', [0, (labela ? 0 : razT), 0, razB]);
        out.push(ltBlok); linijeCiljevi.push(ltBlok);
      }
      /* Okomiti pomak (mm, +gore/−dolje): pomiče SAMO linije (labela ostaje). Tok-neutralno po elementu
         (manja gornja + veća donja margina) → ostatak dokumenta se ne pomakne, a linija se digne/spusti
         RELATIVNO na labelu i okolinu. */
      var pomakPt = broj(s.pomak_y_mm) * MM_PT;
      if (pomakPt) linijeCiljevi.forEach(function (el) { podesiMargin(el, 1, -pomakPt); podesiMargin(el, 3, pomakPt); });
      return out;

      function podesiMargin(el, idx, delta) {
        if (!el) return;
        var m = el.margin;
        if (typeof m === 'number') m = [m, m, m, m];
        else if (!m) m = [0, 0, 0, 0]; else m = m.slice();
        m[idx] = (m[idx] || 0) + delta;
        el.margin = m;
      }
    }

    function elementi(s) {
      if (!s || s.greska || s.sakrij) return [];
      if (s.vrsta === 'tablica') return s.tablica ? [sastaviTablica(s.tablica)] : [];
      if (s.vrsta === 'linije') return sastaviLinije(s);
      if (s.vrsta === 'slika') {
        var ss = s.slika_stil_id ? slikaStilovi[s.slika_stil_id] : null;
        /* Apsolutno — ishodište po zoni:
           zaglavlje = gornji-lijevi kut zaglavlja (lijeva margina, vrh stranice);
           podnožje  = gornji-lijevi kut podnožja (lijeva margina, visina stranice − visina podnožja);
           tijelo/naslovna = gornji-lijevi rub stranice. */
        var origin;
        if (s.zona === 'zaglavlje') origin = { x: mm(t, 'margina_lijevo_mm'), y: 0 };
        else if (s.zona === 'podnozje') origin = { x: mm(t, 'margina_lijevo_mm'), y: dimPt.h - mm(t, 'podnozje_visina_mm') };
        else origin = { x: 0, y: 0 };
        if (s.placeholder) return [sastaviPlaceholder(ss, s.kontekst_kljuc, { origin: origin, veliki: !!opts.vodilice })];
        if (!s.dataurl) return [];
        return [sastaviSliku(ss, s.dataurl, { origin: origin })];
      }
      if (s.vrsta === 'tekst') {
        var ps = (s.paragraf_id && parStilovi[s.paragraf_id]) ? parStilovi[s.paragraf_id] : {};
        var kljuc = s.font_kljuc || undefined;
        var odlomci = s.odlomci || [];
        /* Extra prored dokumenta: APSOLUTNI override lineHeight-a SAMO na stilu dokument_prored_default_stil. */
        var elOpts = {};
        if (opts.proredVrijednost != null && opts.proredStilId && ps && +ps.id === +opts.proredStilId) elOpts.proredVrijednost = opts.proredVrijednost;
        /* Apsolutno pozicioniranje: fiksna_pozicija_y != -1/null → absolutePosition {x,y} (mm→pt, ishodište = gornji-lijevi
           kut stranice). U apsolutnom modu stavka izlazi iz toka (kao slika); X = fiksna_pozicija (apsolutni), Y = fiksna_pozicija_y. */
        var apsPos = null;
        if (s.fiksna_pozicija_y != null && s.fiksna_pozicija_y !== '' && +s.fiksna_pozicija_y !== -1) {
          var apsX = (s.fiksna_pozicija != null && s.fiksna_pozicija !== '') ? +s.fiksna_pozicija : 0;
          apsPos = { x: apsX * MM_PT, y: +s.fiksna_pozicija_y * MM_PT };
          elOpts.apsolutna = true;   /* sastaviOdlomak: negativ-kutija u auto-širini (bez align-columns) */
        }
        /* Spojeni odlomci (relacija-liste): retci su JEDAN blok → razmak prije samo na prvom, poslije samo na zadnjem. */
        var spojeni = !!s.spojeni_odlomci, nOd = odlomci.length;
        return odlomci.map(function (runovi, i) {
          var o = {}; for (var k in elOpts) o[k] = elOpts[k];
          if (spojeni && i > 0) o.noGapAbove = true;
          if (spojeni && i < nOd - 1) o.noGapBelow = true;
          var node = sastaviOdlomak(ps, kljuc, runovi, o);
          if (apsPos) node.absolutePosition = apsPos;
          return node;
        });
      }
      return [];
    }

    var content = [], headerTxt = [], headerSlike = [], footer = [];   /* headerSlike: { el, stil } radi potiskuje */
    var okviriPoId = {};
    (model.okviri || []).forEach(function (o) { if (o && o.id != null) okviriPoId[String(o.id)] = o; });
    var okvirStavke = {};   /* okvir_id → [raw stavke] (vezani tekst blokovi) */
    stavke.forEach(function (s) {
      if (!s || s.greska || s.sakrij) return;
      /* Vezani tekst blok: skupi RAW stavke po okviru (render = prelijevanje u geometriji bloka). */
      if (s.okvir_id && okviriPoId[String(s.okvir_id)]) {
        (okvirStavke[String(s.okvir_id)] = okvirStavke[String(s.okvir_id)] || []).push(s);
        return;
      }
      if (s.zona === 'zaglavlje') {
        if (s.vrsta === 'slika') {
          var ss = s.slika_stil_id ? slikaStilovi[s.slika_stil_id] : null;
          var hOrigin = { x: mm(t, 'margina_lijevo_mm'), y: 0 };
          var hEl = s.placeholder
            ? sastaviPlaceholder(ss, s.kontekst_kljuc, { origin: hOrigin, veliki: !!opts.vodilice })
            : (s.dataurl ? sastaviSliku(ss, s.dataurl, { origin: hOrigin }) : null);
          if (!hEl) return;
          headerSlike.push({ el: hEl, stil: ss || {}, placeholder: !!s.placeholder });
        } else {
          headerTxt = headerTxt.concat(elementi(s));
        }
        return;
      }
      var el = elementi(s);
      if (!el.length) return;
      if (s.zona === 'podnozje') footer = footer.concat(el);
      else {
        /* Prijelom stranice prije stavke (resolve ga gata na tok u zoni tijelo). Ne na prvu stavku
           (izbjegni prazni prvi list) ni na apsolutno pozicioniran element (van toka). */
        if (s.prijelom_prije && content.length && !el[0].absolutePosition) el[0].pageBreak = 'before';
        /* Prijelom stranice poslije stavke → na ZADNJI element stavke (van toka element preskoči).
           Prijelom na zadnjoj stavci toka (prazni zadnji list) čisti se nakon petlje. */
        if (s.prijelom_poslije && !el[el.length - 1].absolutePosition) el[el.length - 1].pageBreak = 'after';
        content = content.concat(el);        /* tijelo + (zasad) naslovna */
      }
    });
    /* Zadnji element toka NE smije nositi pageBreak:'after' (stvara prazni zadnji list) —
       u ovom trenutku content zadnji je zadnja tok-stavka (okviri niže dodaju samo apsolutne stackove). */
    if (content.length && content[content.length - 1].pageBreak === 'after') delete content[content.length - 1].pageBreak;

    /* Okviri (vezani tekst blokovi) → tekst se lomi: M redova u bloku (širina bloka), ostatak
       PUNOM ŠIRINOM (margina–margina) ispod bloka. M = visina bloka / prored; meki rub = ceil
       (prelivni red cijel), tvrdi = floor. Mjerenje širine lomljenja: canvas u istoj porodici. */
    Object.keys(okvirStavke).forEach(function (oid) {
      var o = okviriPoId[oid];
      var bx = mm(o, 'x_mm'), by = mm(o, 'y_mm'), bw = mm(o, 'sirina_mm'), bh = mm(o, 'visina_mm');
      if (bw <= 0 || bh <= 0) return;
      var lista = okvirStavke[oid];
      /* Ne-tekst (slike) u okviru → apsolutno u blok (bez prelijevanja). */
      lista.forEach(function (s) {
        if (s.vrsta !== 'tekst') { var elx = elementi(s); if (elx.length) content.push({ stack: elx, width: bw, absolutePosition: { x: bx, y: by } }); }
      });
      var tekstStavke = lista.filter(function (s) { return s.vrsta === 'tekst' && s.odlomci && s.odlomci.length; });
      if (!tekstStavke.length) return;
      /* Vlastiti stil segmenta u okviru: stilizirane riječi, ali veličina ostaje početnog dijela (mreža/prored). */
      var imaStilRun = tekstStavke.some(function (s) { return s.ima_vlastiti_stil; });
      var first = tekstStavke[0];
      var ps = (first.paragraf_id && parStilovi[first.paragraf_id]) ? parStilovi[first.paragraf_id] : {};
      var fsPt = broj(ps.velicina_pt) || 12;
      var prored = broj(ps.prored) || 1;
      /* Extra prored dokumenta (modal stepper): override SAMO na stilu dokument_prored_default_stil
         (proredStilId) — mijenja mrežu (lhPt) i pdfmake lineHeight okvir-teksta. */
      if (opts.proredVrijednost != null && opts.proredStilId && ps && +ps.id === +opts.proredStilId) prored = broj(opts.proredVrijednost);
      var por = str(ps.poravnanje) || 'left';
      var boja = str(ps.boja) || '#000000';
      var kljuc = first.font_kljuc || undefined;
      var porodica = null, serverLh = null;
      (model.fontovi || []).forEach(function (f) { if (f.kljuc === kljuc) { porodica = f.porodica; if (f.lh != null) serverLh = broj(f.lh); } });
      _registrirajMjerniFont(porodica);
      var fontStr = fsPt + 'px "' + (porodica || 'sans-serif') + '", sans-serif';
      /* Visina reda (mreža za blok + nastavak → jedinstven prored, točan meki rub):
         1) točna metrika fonta sa servera (OS/2 typo) — stabilno, neovisno o renderu;
         2) fallback: prirodna visina reda iz canvasa (fontBoundingBox) kad je font učitan;
         3) fallback: konstanta OBTJ_LH_FAKTOR. Fino ugađanje preko OBTJ_LH_FINO. */
      var lhFaktor = OBTJ_LH_FAKTOR;
      if (serverLh && serverLh > 0.8 && serverLh < 2.2) {
        lhFaktor = serverLh;
      } else {
        var _mc = _mjerCtx();
        if (_mc && porodica && global.document && global.document.fonts && global.document.fonts.check) {
          try {
            if (global.document.fonts.check(fontStr)) {
              _mc.font = fontStr;
              var _mt = _mc.measureText('Hg');
              if (_mt && _mt.fontBoundingBoxAscent != null && _mt.fontBoundingBoxDescent != null) {
                var _nat = (_mt.fontBoundingBoxAscent + _mt.fontBoundingBoxDescent) / fsPt;
                if (_nat > 0.8 && _nat < 2.2) lhFaktor = _nat;
              }
            }
          } catch (e) {}
        }
      }
      var lhPt = fsPt * prored * lhFaktor * OBTJ_LH_FINO;
      /* Spoji sav tekst okvira (odlomak po odlomak iz svih tekst-stavki). Kad ima vlastitih stilova
         gradimo stilizirane riječi [{t, r}] (r = font/boja/bold/italic/podcrtano; BEZ veličine — ostaje
         početnog dijela), pa paras (plain) izvedemo iz njih da lom/mreža budu identični. */
      var paras, parasStyled = null;
      if (imaStilRun) {
        parasStyled = [];
        tekstStavke.forEach(function (s) {
          (s.odlomci || []).forEach(function (od) {
            var cur = [];
            for (var r = 0; r < od.length; r++) {
              var run = od[r]; if (!run) continue;
              var txt = (run.text != null) ? String(run.text) : '';
              if (txt === '\n') { parasStyled.push(cur); cur = []; continue; }   // meki prijelom → nova para (kao plain)
              var rstyle = _prenesiRunStil(run, {}); delete rstyle.fontSize;      // veličina ostaje početnog dijela
              var rijeci = txt.split(/\s+/);
              for (var wi = 0; wi < rijeci.length; wi++) { if (rijeci[wi] !== '') cur.push({ t: rijeci[wi], r: rstyle }); }
            }
            parasStyled.push(cur);
          });
        });
        paras = parasStyled.map(function (p) { return p.map(function (w) { return w.t; }).join(' '); });
      } else {
        var paragrafi = [];
        tekstStavke.forEach(function (s) {
          (s.odlomci || []).forEach(function (od) {
            var t2 = ''; for (var r = 0; r < od.length; r++) t2 += (od[r] && od[r].text != null ? od[r].text : '');
            paragrafi.push(t2);
          });
        });
        paras = paragrafi.join('\n').split('\n');
      }
      var uvlPt = mm(ps, 'uvlaka_prvi_red_mm');      /* uvlaka prvog reda odlomka */
      var razPosPt = mm(ps, 'razmak_poslije_mm');    /* razmak iza odlomka */
      var meka = (o.y_meka === 1 || o.y_meka === '1' || o.y_meka === true);
      var paraLines = [];
      for (var pli = 0; pli < paras.length; pli++) paraLines.push(_lomiOdlomak(paras[pli], bw, uvlPt, fontStr));
      /* Hod kroz odlomke/linije: nakupljaj visinu (lhPt po liniji + razmak_poslije po odlomku);
         meki rub uključuje liniju koja straddla dno bloka. Split = prva linija iznad dna bloka. */
      var usedH = 0, splitPara = paras.length, splitLine = 0, gotovo = false;
      for (var wpi = 0; wpi < paras.length && !gotovo; wpi++) {
        var lns = paraLines[wpi];
        for (var wli = 0; wli < lns.length; wli++) {
          var over = meka ? (usedH >= bh - 0.01) : (usedH + lhPt > bh + 0.01);
          if (over) { splitPara = wpi; splitLine = wli; gotovo = true; break; }
          usedH += lhPt;
        }
        if (gotovo) break;
        if (wpi < paras.length - 1) usedH += razPosPt;   /* razmak iza odlomka (ne iza zadnjeg) */
      }
      /* Nakon hoda (mreža izmjerena plain tekstom) prebaci na stilizirane riječi za render. Lom je identičan
         (isti tekst/font/veličina), pa splitPara/splitLine i dalje vrijede. */
      if (imaStilRun) {
        var paraLinesS = [];
        for (var pls = 0; pls < parasStyled.length; pls++) paraLinesS.push(_lomiOdlomakStyled(parasStyled[pls], bw, uvlPt, fontStr));
        paras = parasStyled; paraLines = paraLinesS;
      }
      /* Izvor teksta odlomka: string (plain) ili niz stiliziranih riječi [{t, r}] → pdfmake run-niz
         (razmak iza svake osim zadnje; veličina se ne stavlja pa ostaje početnog dijela). */
      function tekstIzvor(src) {
        if (typeof src === 'string') return src;
        var arr = [];
        for (var i = 0; i < src.length; i++) { var run = { text: src[i].t + (i < src.length - 1 ? ' ' : '') }; _prenesiRunStil(src[i].r, run); arr.push(run); }
        return arr.length ? arr : '';
      }
      function lineToWords(lineUnit) { return (typeof lineUnit === 'string') ? lineUnit.split(' ').filter(Boolean) : lineUnit; }
      function joinLines(lines) {
        if (!lines.length) return '';
        if (typeof lines[0] === 'string') return lines.join(' ');
        var out = []; for (var i = 0; i < lines.length; i++) out = out.concat(lines[i]); return out;
      }
      /* Jedan odlomak → pdfmake element (uvlaka prvog reda + razmak iza). Zadnji red odlomka pdfmake
         ostavlja lijevo poravnat (kraj odlomka) — što je ispravno za PUNE odlomke. */
      function odlomakEl(src, indent, marginDolje) {
        var el = { text: tekstIzvor(src), fontSize: fsPt, lineHeight: prored, alignment: por, color: boja, margin: [0, 0, 0, marginDolje || 0] };
        if (kljuc) el.font = kljuc;
        if (indent && uvlPt) el.leadingIndent = uvlPt;
        return el;
      }
      /* Ručno obostrano poravnanje JEDNE linije: riječi kao 'auto' stupci, '*' razmaci IZMEĐU riječi
         (jednolika raspodjela viška, bez praznine na kraju). Koristi se za blokove redove odlomka koji
         se NASTAVLJA (svi se justifiraju, pa i zadnji u bloku) — bez pdfmake filler-trika i završnog razmaka. */
      function justifyRed(rijeci, indentPt) {
        var styled = rijeci.length && typeof rijeci[0] === 'object';
        if (por !== 'justify' || rijeci.length < 2) {
          var el = { text: styled ? tekstIzvor(rijeci) : rijeci.join(' '), fontSize: fsPt, lineHeight: prored, alignment: por, color: boja, margin: [indentPt || 0, 0, 0, 0] };
          if (kljuc) el.font = kljuc;
          return el;
        }
        var cols = [];
        if (indentPt) cols.push({ text: '', width: indentPt });
        for (var ji = 0; ji < rijeci.length; ji++) {
          var w = { text: styled ? rijeci[ji].t : rijeci[ji], width: 'auto', fontSize: fsPt, lineHeight: prored, color: boja };
          if (kljuc) w.font = kljuc;
          if (styled) _prenesiRunStil(rijeci[ji].r, w);   /* per-riječ font/boja/bold/italic/podcrtano (bez veličine) */
          cols.push(w);
          if (ji < rijeci.length - 1) cols.push({ text: '', width: '*' });
        }
        return { columns: cols, columnGap: 0 };
      }
      var blockStack = [], contStack = [];
      for (var bpi = 0; bpi <= splitPara && bpi < paras.length; bpi++) {
        if (bpi < splitPara) {
          blockStack.push(odlomakEl(paras[bpi], true, razPosPt));               /* cijeli odlomak u bloku */
        } else if (splitLine > 0) {
          /* Dio odlomka koji se NASTAVLJA → svi blokovi redovi ručno justifirani (i zadnji). */
          var spRows = [], spLines = paraLines[bpi].slice(0, splitLine);
          for (var sl = 0; sl < spLines.length; sl++) spRows.push(justifyRed(lineToWords(spLines[sl]), sl === 0 ? uvlPt : 0));
          blockStack.push({ stack: spRows });
        }
      }
      if (splitPara < paras.length) {
        if (splitLine === 0) {
          contStack.push(odlomakEl(paras[splitPara], true, razPosPt));          /* cijeli odlomak ide u nastavak */
        } else {
          var contSrc = joinLines(paraLines[splitPara].slice(splitLine));         /* ostatak odlomka (bez uvlake); string ili stilizirane riječi */
          if (contSrc.length) contStack.push(odlomakEl(contSrc, false, razPosPt));
        }
        for (var cpi = splitPara + 1; cpi < paras.length; cpi++) contStack.push(odlomakEl(paras[cpi], true, razPosPt));
      }
      if (blockStack.length) content.push({ stack: blockStack, width: bw, absolutePosition: { x: bx, y: by } });
      if (contStack.length) {
        var mLpt = mm(t, 'margina_lijevo_mm'), mRpt = mm(t, 'margina_desno_mm');
        content.push({ stack: contStack, width: dimPt.w - mLpt - mRpt, absolutePosition: { x: mLpt, y: by + usedH } });
      }
    });

    /* Margine tijela moraju poštovati zaglavlje/podnožje. pdfmake ima JEDNU pageMargins za sve stranice, pa:
       - preview (vodilice): simuliramo jednu stranicu → margine baš za tu stranicu (vrijedi li zona?).
       - stvarni izlaz (multipage):
         · zaglavlje 'svaka' → rezerviraj gore na svim stranicama; 'prva' → baseline + nevidljivi spacer na
           vrhu sadržaja (gura SAMO 1. stranicu; str. 2+ teku unutar obične margine).
         · podnožje → rezervira dolje na SVIM stranicama (fiksnu donju marginu ne možemo „od-rezervirati"
           po stranici; kod od_stranice>1 ranije stranice dobiju malo viška dolje — prihvaćeno ograničenje). */
    var zaglAktivno = bool(t.zaglavlje);   /* margina ovisi o uključenoj zoni (kao template), ne o visini */
    var podnAktivno = bool(t.podnozje);
    var primjenaSvaka = str(t.zaglavlje_primjena) === 'svaka';
    var podnOd = broj(t.podnozje_od_stranice) || 1;
    var gornjaMargina, donjaMargina, spacerVisina = 0;
    if (opts.simuliraj) {
      /* Simulacija (jednostranični dokument): margine baš za simuliranu stranicu. */
      var simStr2 = (opts.simuliraj === 2 ? 2 : 1);
      gornjaMargina = gornjaTijela(t, zaglAktivno && (simStr2 === 1 || primjenaSvaka));
      donjaMargina = donjaTijela(t, podnAktivno && (simStr2 >= podnOd));
    } else {
      if (zaglAktivno && primjenaSvaka) {
        gornjaMargina = gornjaTijela(t, true);
      } else if (zaglAktivno) {
        gornjaMargina = mm(t, 'margina_gore_mm');
        spacerVisina = gornjaTijela(t, true) - gornjaMargina;   /* rezervacija samo za 1. stranicu */
      } else {
        gornjaMargina = mm(t, 'margina_gore_mm');
      }
      donjaMargina = donjaTijela(t, podnAktivno);   /* rezervacija na svim stranicama (vidi ograničenje gore) */
    }
    if (spacerVisina > 0) {
      /* Nevidljiva rezervacija visine: bijela ispuna (grana fill → BEZ obruba; bez color pdfmake bi
         pravokutnik obrubio crnom linijom). Bijelo na bijeloj stranici = nevidljivo. */
      content.unshift({ canvas: [{ type: 'rect', x: 0, y: 0, w: 1, h: spacerVisina, color: '#ffffff', lineWidth: 0 }] });
    }

    var dd = {
      pageOrientation: (str(t.orijentacija) === 'landscape') ? 'landscape' : 'portrait',
      pageMargins: [mm(t, 'margina_lijevo_mm'), gornjaMargina, mm(t, 'margina_desno_mm'), donjaMargina],
      content: content,
      /* pdfmake treba default font i za doc bez teksta (npr. footer brojač / inače Roboto kojeg nema u vfs). */
      defaultStyle: { font: str(model.default_font) || 'DejaVuSans' }
    };

    var fmt = str(t.format_papira) || 'A4';
    if (fmt === 'custom') dd.pageSize = { width: mm(t, 'sirina_mm'), height: mm(t, 'visina_mm') };
    else dd.pageSize = fmt.toUpperCase();        /* pdfmake: A4/A5/A3/LETTER/LEGAL */

    /* Efektivna stranica: SAMO kod simulacije (opts.simuliraj 1/2 — jednostranični dokument, da se može
       pregledati izgled 2. stranice) forsiramo broj stranice. Inače (vjeran pregled višestraničnog,
       običan pregled, stvarni izlaz) vrijedi pravi pdfmake currentPage → zaglavlje samo gdje template kaže. */
    var simStr = opts.simuliraj ? (opts.simuliraj === 2 ? 2 : 1) : null;
    function efektivnaStr(currentPage) { return simStr || currentPage; }
    function zaglNaStr(currentPage) {
      var p = efektivnaStr(currentPage);
      return str(t.zaglavlje_primjena) === 'svaka' || p === 1;
    }
    function podnNaStr(currentPage) {
      return efektivnaStr(currentPage) >= (broj(t.podnozje_od_stranice) || 1);
    }

    var brojStr = bool(t.broj_stranice);
    var poravBroj = ({ lijevo: 'left', centar: 'center', desno: 'right' })[str(t.broj_stranice_poravnanje)] || 'center';
    /* Stil teksta brojača (dokument-razina); poravnanje ostaje iz broj_stranice_poravnanje. */
    var brojStil = (model.broj_stranice_paragraf_id && parStilovi[model.broj_stranice_paragraf_id]) ? parStilovi[model.broj_stranice_paragraf_id] : null;
    /* Startni broj stranice (model.startni_broj_stranice, default 1): pomak SAMO prikazanih brojeva — #S i #U dobiju
       +(startni-1). NE dira efektivnaStr/zone (zaglavlje 1. str., podnožje od_stranice ostaju na stvarnoj poziciji). */
    var pomakStranice = Math.max(1, broj(model.startni_broj_stranice) || 1) - 1;
    if (footer.length || brojStr) {
      dd.footer = function (currentPage, pageCount) {
        var arr = podnNaStr(currentPage) ? footer.slice() : [];   /* podnožje od_stranice (i simulacija) */
        if (brojStr) {
          var txt = (str(t.broj_stranice_format) || 'Stranica #S od #U')
            .split('#S').join(efektivnaStr(currentPage) + pomakStranice).split('#U').join(pageCount + pomakStranice);
          var bel;
          if (brojStil) {
            /* Pun stil (okvir/linija, podloga, font…) preko sastaviOdlomak; poravnanje iz broj_stranice_poravnanje. */
            var bs = {}; for (var bk in brojStil) { if (Object.prototype.hasOwnProperty.call(brojStil, bk)) bs[bk] = brojStil[bk]; }
            bs.poravnanje = poravBroj;
            bel = sastaviOdlomak(bs, brojStil.pdfmake_kljuc, txt, {});
            /* Podnožje nije uvučeno pageMargins-ima → dodaj lijevu/desnu marginu da okvir/tekst poštuje margine. */
            var mLp = mm(t, 'margina_lijevo_mm'), mRp = mm(t, 'margina_desno_mm');
            if (bel.margin && bel.margin.length === 4) { bel.margin[0] += mLp; bel.margin[2] += mRp; }
            else { bel.margin = [mLp, 0, mRp, 0]; }
          } else {
            bel = { text: txt, alignment: poravBroj, margin: [40, 4, 40, 0] };
          }
          arr.push(bel);
        }
        return arr;
      };
    }

    /* Zaglavlje kroz background — pdfmake NE reže background (dd.header se reže na pojas gornje margine).
       potiskuje=1 (ne-apsolutna slika) rezervira širinu na svojoj strani → tekst u slobodan prostor;
       potiskuje=0 / apsolutno = overlay (tekst ga ignorira i centrira se preko cijelog zaglavlja). */
    var mLpt = mm(t, 'margina_lijevo_mm'), mRpt = mm(t, 'margina_desno_mm');
    /* Slike zaglavlja → dd.header. absolutePosition izbjegava rez zaglavlja i NE rezervira prostor tekstu.
       potiskuje=1 (ne-apsolutna slika) rezervira širinu pa se tekst centrira u slobodnom prostoru. */
    var resL = 0, resR = 0, headerImgEls = [], headerPhEls = [];
    headerSlike.forEach(function (hi) {
      var ss = hi.stil || {};
      var imgW = broj(ss.sirina_mm) > 0 ? mm(ss, 'sirina_mm') : 0;
      var desno = str(ss.poravnanje_h) === 'desno';
      var potiskuje = bool(ss.potiskuje) && str(ss.pozicioniranje) !== 'apsolutno';
      if (!hi.el.absolutePosition) hi.el.absolutePosition = { x: desno ? (dimPt.w - mRpt - imgW) : mLpt, y: 0 };
      if (potiskuje && imgW > 0) { if (desno) resR += imgW; else resL += imgW; }
      /* Slika apsolutno izbjegava rez dd.header-a; tablica (placeholder) NE — pa placeholder ide u background. */
      (hi.placeholder ? headerPhEls : headerImgEls).push(hi.el);
    });
    /* Zaglavlje samo na stranicama gdje vrijedi (zaglNaStr, gore): 'svaka' → sve; inače samo 1. stranica. */
    if (headerImgEls.length) {
      dd.header = function (currentPage) { return zaglNaStr(currentPage) ? { stack: headerImgEls } : null; };
    }

    /* Tekst zaglavlja → background (bez reza), SAM (slike su u dd.header pa ne guraju tekst).
       pdfmake zanemaruje width na običnom/stack elementu (dijagnostika), pa tekst omotamo u TABLICU
       fiksne širine = širina BLOKA zaglavlja (zona sadržaja, umanjena za slike koje potiskuju).
       Tablice poštuju zadane širine → sva poravnanja (left/center/right/justify) su u odnosu na blok;
       ako se margine promijene, blok i poravnanja prate. Pozicija = lijeva margina (+ rezervacija lijevo). */
    var blokW = dimPt.w - mLpt - mRpt - resL - resR;
    var headerTextItem = (headerTxt.length && blokW > 0) ? {
      table: { widths: [blokW], body: [[{ stack: headerTxt }]] },
      layout: {
        hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; },
        paddingLeft: function () { return 0; }, paddingRight: function () { return 0; },
        paddingTop: function () { return 0; }, paddingBottom: function () { return 0; }
      },
      absolutePosition: { x: mLpt + resL, y: 0 }
    } : null;
    var vodiliceFn = opts.vodilice ? vodiliceBackground(t, efektivnaStr) : null;
    if (headerTextItem || vodiliceFn || headerPhEls.length) {
      dd.background = function (currentPage, pageSize) {
        var out = [];
        if (vodiliceFn) { var v = vodiliceFn(currentPage, pageSize); if (v) out = out.concat(v); }
        if (zaglNaStr(currentPage)) {
          for (var i = 0; i < headerPhEls.length; i++) out.push(headerPhEls[i]);   /* placeholderi (tablice) bez reza */
          if (headerTextItem) out.push(headerTextItem);
        }
        return out;
      };
    }

    /* Broj stranica → callback (preview treba znati je li dokument jednostraničan radi simulacije 2. strane).
       Omotamo dd.header (header dobiva pageCount); ako headera nema, vraća null (bez utjecaja na izgled). */
    /* TODO (almanah — klijentska app funkcija, još neimplementirano):
       Ulančani ispis niza zapisnika za godinu uz neprekidan brojač stranica. Plan:
       reusable helper (npr. renderirajDokument(model, {startni}) → {blob, zadnjaStranica}) koji app petlja
       zove redom; svakom dokumentu prosljeđuje startni_broj_stranice, a iz onPageCount računa
       zadnjaStranica = (startni − 1) + pageCount te ga koristi kao startni sljedećeg (startni_next = zadnjaStranica + 1).
       Ulaz (startni_broj_stranice) i pomak prikaza već postoje; nedostaje samo ovaj omotač + spajanje blob-ova. */
    if (typeof opts.onPageCount === 'function') {
      var _hdrOrig = dd.header;
      dd.header = function (currentPage, pageCount, pageSize) {
        try { opts.onPageCount(pageCount); } catch (e) {}
        return _hdrOrig ? _hdrOrig(currentPage, pageCount, pageSize) : null;
      };
    }
    return dd;
  }

  /* pdfmake (pdfkit) podržava samo PNG/JPEG. Ostalo (WebP/GIF…) → PNG preko canvasa (async). */
  function uPngDataUrl(dataurl, cb) {
    if (typeof dataurl !== 'string' || /^data:image\/(png|jpeg);/i.test(dataurl)) { cb(dataurl); return; }
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        cb(c.toDataURL('image/png'));
      } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = dataurl;
  }

  /* Pripremi sve slike modela za pdfmake (ne-PNG/JPEG → PNG); cb(model) kad gotovo. */
  function pripremiSlike(model, cb) {
    var stavke = (model && model.stavke) || [];
    var slike = stavke.filter(function (s) { return s && s.vrsta === 'slika' && s.dataurl; });
    if (!slike.length) { cb(model); return; }
    var preostalo = slike.length;
    slike.forEach(function (s) {
      uPngDataUrl(s.dataurl, function (png) {
        if (png) s.dataurl = png;
        else { s.dataurl = null; s.greska = s.greska || 'Slika se ne može konvertirati.'; }
        if (--preostalo === 0) cb(model);
      });
    });
  }

  /* ===== Lazy učitavanje pdfmake biblioteke (js/vendor/pdfmake.min.js) ===== */
  var Pdf = {
    _ucitano: false,
    _ucitavanje: false,
    _cekaci: [],
    spreman: function () { return this._ucitano && !!global.pdfMake; },
    ucitaj: function (cb, errCb) {
      if (this.spreman()) { if (cb) cb(); return; }
      if (cb) this._cekaci.push(cb);
      if (this._ucitavanje) return;
      this._ucitavanje = true;
      var self = this;
      var s = document.createElement('script');
      s.src = appUrl('js/vendor/pdfmake.min.js');
      s.async = true;
      s.onload = function () {
        self._ucitano = true; self._ucitavanje = false;
        var red = self._cekaci; self._cekaci = [];
        red.forEach(function (f) { try { f(); } catch (e) {} });
      };
      s.onerror = function () {
        self._ucitavanje = false; self._cekaci = [];
        if (errCb) errCb();
      };
      document.head.appendChild(s);
    }
  };

  /* ===== Fontovi za pdfmake — lazy-load (porodica → 4×.ttf → vfs/fonts, keš) ===== */
  var Fontovi = {
    _ucitani: {},      /* pdfmake_kljuc → true */
    _uTijeku: {},      /* pdfmake_kljuc → [cb...] */
    _abBase64: function (buf) {
      var bytes = new Uint8Array(buf), bin = '', chunk = 0x8000, i;
      for (i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      return btoa(bin);
    },
    spreman: function (kljuc) { return !!this._ucitani[kljuc]; },
    /* Osigura da je font (kljuc/porodica) registriran u pdfMake.vfs/.fonts; cb() kad spreman. */
    osiguraj: function (kljuc, porodica, cb, errCb) {
      if (!global.pdfMake || !kljuc || !porodica) { if (errCb) errCb(); return; }
      if (this._ucitani[kljuc]) { if (cb) cb(); return; }
      if (this._uTijeku[kljuc]) { if (cb) this._uTijeku[kljuc].push(cb); return; }
      this._uTijeku[kljuc] = cb ? [cb] : [];
      var self = this;
      var mapa = { normal: 'Regular', bold: 'Bold', italics: 'Italic', bolditalics: 'BoldItalic' };
      var stilovi = ['normal', 'bold', 'italics', 'bolditalics'];
      var files = {};
      var preostalo = stilovi.length, greska = false;
      pdfMake.vfs = pdfMake.vfs || {};
      function gotovo() {
        if (--preostalo > 0) return;
        var red = self._uTijeku[kljuc] || []; delete self._uTijeku[kljuc];
        if (greska) { if (errCb) errCb(); return; }
        pdfMake.fonts = pdfMake.fonts || {};
        pdfMake.fonts[kljuc] = { normal: files.normal, bold: files.bold, italics: files.italics, bolditalics: files.bolditalics };
        self._ucitani[kljuc] = true;
        red.forEach(function (f) { try { f(); } catch (e) {} });
      }
      stilovi.forEach(function (stil) {
        var file = porodica + '-' + mapa[stil] + '.ttf';
        files[stil] = file;
        if (pdfMake.vfs[file]) { gotovo(); return; }
        var xhr = new XMLHttpRequest();
        xhr.open('GET', appUrl('fontovi/' + file), true);
        xhr.responseType = 'arraybuffer';
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            try { pdfMake.vfs[file] = self._abBase64(xhr.response); } catch (e) { greska = true; }
          } else { greska = true; }
          gotovo();
        };
        xhr.send();
      });
    }
  };

  global.PdfRender = {
    MM_PT: MM_PT,
    broj: broj,
    mm: mm,
    bool: bool,
    str: str,
    okvirImaLiniju: okvirImaLiniju,
    sastaviOdlomak: sastaviOdlomak,
    sastaviSliku: sastaviSliku,
    sastaviPlaceholder: sastaviPlaceholder,
    sastaviDocDefinition: sastaviDocDefinition,
    mjeriRedove: mjeriRedove,
    vMarginaCelije: vMarginaCelije,
    valignCelije: valignCelije,
    pripremiSlike: pripremiSlike,
    Pdf: Pdf,
    Fontovi: Fontovi
  };
})(typeof window !== 'undefined' ? window : this);
