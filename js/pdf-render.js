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
      s.src = '../js/vendor/pdfmake.min.js';
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
        xhr.open('GET', '../fontovi/' + file, true);
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
    Pdf: Pdf,
    Fontovi: Fontovi
  };
})(typeof window !== 'undefined' ? window : this);
