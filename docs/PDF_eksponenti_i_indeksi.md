# PDF: eksponenti (superskript) i indeksi (subskript) u tekstu stavke

Naputak za slaganje PDF dokumenata kroz formu **PDF_Dokument**. Bez izmjena koda —
znak se upisuje ravno u polje **Tekst** stavke (`pdf_dokument_stavke.literal_tekst`)
ili u **sufiks** stavke, pa tekst teče dalje u istom odlomku.

## Znakovi za kopiranje

| namjena | znakovi |
|---|---|
| eksponenti — znamenke | `⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹` |
| eksponenti — zagrade i operatori | `⁽ ⁾ ⁺ ⁻` |
| eksponenti — slova | `ⁿ ᵒ ª` |
| stupanj | `°` |
| indeksi (donji) — znamenke | `₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉` |

Fusnota uz nastavak teksta:

```
Podnositelj zahtjeva⁽¹⁾ izjavljuje da su podaci točni.
```

## Pravila

- Znak je dio istog teksta i odlomka → `bez_kraja_odlomka` se ne mijenja, ne treba nova stavka.
- Eksponent **iza dinamičkog podatka** (npr. iza imena iz baze) upiši u polje **sufiks** te
  stavke — tada se ispisuje samo kad podatak postoji.
- `^` u tekstu stavke i dalje znači razmak; s ovim znakovima nema sukoba.
- Veličina je fiksna (iz fonta), ne skalira se kao pravi pdfmake `sup`/`sub`.
  Dostupne su samo znamenke i nekoliko slova — za proizvoljan tekst u eksponentu treba dorada
  generatora (vidi „Ako zatreba pravi sup/sub" niže).

## Podrška u fontovima (provjereno čitanjem cmapa TTF-ova iz `fontovi/`)

| font | eksponenti | indeksi |
|---|---|---|
| **FreeSerif** (stilovi Obrasca 101: 71/72/77) | svi | svi |
| **FreeMono** | svi | svi |
| **DejaVuSans** | svi | svi |
| Roboto | znamenke da, slova dijelom | svi |
| LiberationSerif | dijelom (bez `⁽ ⁾ ⁺ ⁻`) | svi |
| FreeSans | **nema** | — |

Prije promjene fonta stila provjeri stupac — na fontu bez znaka eksponent nestaje ili se
ispiše prazan pravokutnik. Isto vrijedi za ček-kvadratiće `☐ ☒ ☑` (ima ih FreeSerif i
DejaVuSans, nema FreeSans).

## Ako zatreba pravi sup/sub

pdfmake 0.2.10 (`js/vendor/pdfmake.min.js`) podržava inline stilove `sup: true` / `sub: true`:
bez eksplicitnog `fontSize` skalira run na **58 %**, a u printeru pomiče bazu za
`-0,75 × fontSize` (sup) odnosno `+0,35 × fontSize` (sub).

Za ugradnju treba: nova kolona na `pdf_dokument_stavke` (npr. `skript enum('ne','gornji','donji')`),
prijenos kroz resolver, dopuna `_prenesiRunStil` u `js/pdf-render.js` i kontrola u formi PDF_Dokument.
