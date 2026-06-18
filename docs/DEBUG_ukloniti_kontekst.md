# DEBUG za uklanjanje — kontekst iz „Napomena" (PDF_Dokument)

⚠️ **PRIVREMENO.** Ukloniti kad završimo razvoj forme PDF_Dokument. Ako se zaboravi,
generiranje **iz aplikacije** (stvarni kontekst) izgledat će kao da ne radi jer se id
čita iz polja Napomena umjesto iz proslijeđenog konteksta.

## Što radi
U živom previewu (Tab PDF) se, **pri svakom osvježavanju**, id eseja čita iz polja
**Napomena** (`edit_napomena`) i šalje kao `kontekst = { ID_Esej: <broj> }`. Služi samo
za ručno testiranje indirektnog/direktnog dinamičkog dohvata bez stvarnog poziva iz app-a.

## Gdje je
Datoteka: `js/PDF_Dokument_CRUD.js`, funkcija `generirajPreview()`.
Omeđeno markerima:

```
/* ===== DEBUG (privremeno — ukloniti nakon testiranja) ===== */
...
/* ===== /DEBUG ===== */
```

## Kako ukloniti
1. Obriši cijeli DEBUG blok:

```js
/* ===== DEBUG (privremeno — ukloniti nakon testiranja) =====
   Za test indirektnog ključa: id eseja se čita iz polja „Napomena" (edit_napomena)
   i šalje kao kontekst ID_Esej pri svakom osvježavanju PDF-a. */
var kontekstDebug = {};
var _debugEsejId = parseInt(trim(val('edit_napomena')), 10);
if (_debugEsejId > 0) kontekstDebug.ID_Esej = _debugEsejId;
/* ===== /DEBUG ===== */
```

2. U `payload` vrati prazan kontekst:

```js
// iz:
kontekst: kontekstDebug,
// u:
kontekst: {},
```

(Stvarni kontekst se pri pozivu iz aplikacije prosljeđuje izvana — ne iz Napomene.)
