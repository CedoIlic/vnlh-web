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

  /* Jedan odlomak (margin = razmaci/uvlake; okvir ili pozadina ga omotaju u tablicu). */
  function sastaviOdlomak(stil, kljuc, tekst, opts) {
    stil = stil || {};
    opts = opts || {};
    var par = {
      text: tekst,
      font: kljuc,
      fontSize: broj(stil.velicina_pt) || 12,
      bold: bool(stil.bold),
      italics: bool(stil.italic),
      lineHeight: broj(stil.prored) || 1,
      alignment: str(stil.poravnanje) || 'left',
      color: str(stil.boja) || '#000000'
    };
    if (bool(stil.podcrtano)) par.decoration = 'underline';
    var uvlPrvi = mm(stil, 'uvlaka_prvi_red_mm'); if (uvlPrvi) par.leadingIndent = uvlPrvi;

    var mL = mm(stil, 'uvlaka_lijevo_mm'), mR = mm(stil, 'uvlaka_desno_mm');
    var mT = mm(stil, 'razmak_prije_mm'), mB = mm(stil, 'razmak_poslije_mm');
    var marT = opts.noGapAbove ? 0 : mT;
    var marB = opts.fillGapBelow ? 0 : mB;

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
      /* Pozadina retka: tablica s 1 ćelijom (fill = boja_pozadine, padding trake; puna traka = '*'). */
      par.fillColor = str(stil.boja_pozadine);
      var puna = bool(stil.pozadina_cijeli_red);
      var dodatakDolje = opts.fillGapBelow ? (mT + mB) : 0;
      return {
        table: { widths: [puna ? '*' : 'auto'], body: [[par]] },
        layout: {
          hLineWidth: function () { return 0; },
          vLineWidth: function () { return 0; },
          paddingLeft: function () { return mm(stil, 'traka_padding_lijevo_mm'); },
          paddingRight: function () { return mm(stil, 'traka_padding_desno_mm'); },
          paddingTop: function () { return mm(stil, 'traka_padding_gore_mm'); },
          paddingBottom: function () { return mm(stil, 'traka_padding_dolje_mm') + dodatakDolje; }
        },
        margin: [mL, marT, mR, marB]
      };
    }
    par.margin = [mL, marT, mR, marB];
    return par;
  }

  /* Slika-stavka → pdfmake image element (dataurl + dimenzije/poravnanje iz pdf_slika_stil). */
  function sastaviSliku(stil, dataurl, opts) {
    var img = { image: dataurl };
    if (stil) {
      var w = mm(stil, 'sirina_mm'), h = mm(stil, 'visina_mm');
      if (w > 0 && h > 0) {
        if (str(stil.skaliranje) === 'razvuci') { img.width = w; img.height = h; }
        else { img.fit = [w, h]; }              /* uklopi = čuva proporcije */
      } else if (w > 0) { img.width = w; }
      var ph = str(stil.poravnanje_h);
      if (ph === 'centar') img.alignment = 'center';
      else if (ph === 'desno') img.alignment = 'right';
      else if (ph === 'lijevo') img.alignment = 'left';
      /* Apsolutno pozicioniranje: x/y (mm→pt) od ishodišta zone (opts.origin), zadano gornji-lijevi rub stranice. */
      if (str(stil.pozicioniranje) === 'apsolutno') {
        var o = (opts && opts.origin) || { x: 0, y: 0 };
        img.absolutePosition = { x: (o.x || 0) + mm(stil, 'pozicija_x_mm'), y: (o.y || 0) + mm(stil, 'pozicija_y_mm') };
      }
    } else {
      img.fit = [200, 200];                     /* bez stila: razuman default okvir */
    }
    return img;
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
  /* Vodilice (margine + zone zaglavlja/podnožja) iscrtane u SAMOM PDF-u kao background —
     za provjeru poravnanja elemenata u odnosu na margine. pageSize iz pdfmake je u pt i već orijentiran. */
  function vodiliceBackground(t, stranica) {
    stranica = (stranica === 2) ? 2 : 1;
    var mL = mm(t, 'margina_lijevo_mm'), mT = mm(t, 'margina_gore_mm'),
        mR = mm(t, 'margina_desno_mm'), mB = mm(t, 'margina_dolje_mm');
    /* Zone po pravilima stranice: zaglavlje (primjena=svaka → svaka, inače samo 1.); podnožje od_stranice. */
    var zaglNaStr = bool(t.zaglavlje) && broj(t.zaglavlje_visina_mm) > 0 && (stranica === 1 || str(t.zaglavlje_primjena) === 'svaka');
    var podnNaStr = bool(t.podnozje) && broj(t.podnozje_visina_mm) > 0 && (stranica >= (broj(t.podnozje_od_stranice) || 1));
    var zv = zaglNaStr ? mm(t, 'zaglavlje_visina_mm') : 0;
    var pv = podnNaStr ? mm(t, 'podnozje_visina_mm') : 0;
    var BOJA = '#2d6da3';
    return function (currentPage, pageSize) {
      var W = pageSize.width, H = pageSize.height;
      var canvas = [
        /* okvir margina (tijelo) — iscrtkano */
        { type: 'rect', x: mL, y: mT, w: W - mL - mR, h: H - mT - mB, lineColor: BOJA, lineWidth: 0.6, dash: { length: 3 } }
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
    function elementi(s) {
      if (!s || s.greska) return [];
      if (s.vrsta === 'slika') {
        if (!s.dataurl) return [];
        var ss = s.slika_stil_id ? slikaStilovi[s.slika_stil_id] : null;
        /* Apsolutno — ishodište po zoni:
           zaglavlje = gornji-lijevi kut zaglavlja (lijeva margina, vrh stranice);
           podnožje  = gornji-lijevi kut podnožja (lijeva margina, visina stranice − visina podnožja);
           tijelo/naslovna = gornji-lijevi rub stranice. */
        var origin;
        if (s.zona === 'zaglavlje') origin = { x: mm(t, 'margina_lijevo_mm'), y: 0 };
        else if (s.zona === 'podnozje') origin = { x: mm(t, 'margina_lijevo_mm'), y: dimPt.h - mm(t, 'podnozje_visina_mm') };
        else origin = { x: 0, y: 0 };
        return [sastaviSliku(ss, s.dataurl, { origin: origin })];
      }
      if (s.vrsta === 'tekst') {
        var ps = (s.paragraf_id && parStilovi[s.paragraf_id]) ? parStilovi[s.paragraf_id] : {};
        var kljuc = s.font_kljuc || undefined;
        var odlomci = s.odlomci || [];
        return odlomci.map(function (runovi) { return sastaviOdlomak(ps, kljuc, runovi, {}); });
      }
      return [];
    }

    var content = [], header = [], footer = [];
    stavke.forEach(function (s) {
      var el = elementi(s);
      if (!el.length) return;
      if (s.zona === 'zaglavlje') header = header.concat(el);
      else if (s.zona === 'podnozje') footer = footer.concat(el);
      else content = content.concat(el);        /* tijelo + (zasad) naslovna */
    });

    var dd = {
      pageOrientation: (str(t.orijentacija) === 'landscape') ? 'landscape' : 'portrait',
      pageMargins: [mm(t, 'margina_lijevo_mm'), mm(t, 'margina_gore_mm'), mm(t, 'margina_desno_mm'), mm(t, 'margina_dolje_mm')],
      content: content,
      /* pdfmake treba default font i za doc bez teksta (npr. footer brojač / inače Roboto kojeg nema u vfs). */
      defaultStyle: { font: str(model.default_font) || 'DejaVuSans' }
    };

    var fmt = str(t.format_papira) || 'A4';
    if (fmt === 'custom') dd.pageSize = { width: mm(t, 'sirina_mm'), height: mm(t, 'visina_mm') };
    else dd.pageSize = fmt.toUpperCase();        /* pdfmake: A4/A5/A3/LETTER/LEGAL */

    /* Zaglavlje: poštuj lijevu/desnu marginu stranice + gornji razmak (inače flush uz rub). */
    if (header.length) dd.header = { stack: header, margin: [mm(t, 'margina_lijevo_mm'), mm(t, 'margina_gore_mm') / 2, mm(t, 'margina_desno_mm'), 0] };

    var brojStr = bool(t.broj_stranice);
    var poravBroj = ({ lijevo: 'left', centar: 'center', desno: 'right' })[str(t.broj_stranice_poravnanje)] || 'center';
    if (footer.length || brojStr) {
      dd.footer = function (currentPage, pageCount) {
        var arr = footer.slice();
        if (brojStr) {
          var txt = (str(t.broj_stranice_format) || 'Stranica #S od #U')
            .split('#S').join(currentPage).split('#U').join(pageCount);
          arr.push({ text: txt, alignment: poravBroj, margin: [40, 4, 40, 0] });
        }
        return arr;
      };
    }
    if (opts.vodilice) dd.background = vodiliceBackground(t, opts.stranica);
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
    sastaviDocDefinition: sastaviDocDefinition,
    pripremiSlike: pripremiSlike,
    Pdf: Pdf,
    Fontovi: Fontovi
  };
})(typeof window !== 'undefined' ? window : this);
