# Plan: Obtjecanje teksta oko slike (ulančani tekst frameovi)

Status: **DOGOVOREN DIZAJN za template; ide nakon test-tablice/forme (izvor istine).**
Datum dogovora: 2026-06-28.

## Cilj
Simulirati **obtjecanje teksta oko slike** u PDF generatoru. pdfmake (v0.2.10) **nema** nativni
float/wrap, pa se izvodi kao **ulančani (linked) tekst frameovi** s apsolutnim pozicioniranjem
(InDesign-stil threadinga): tekst se prelijeva iz frame A (uži, pored slike) u frame B (pun, ispod),
a slika je apsolutno pozicionirana između.

## Mehanizam

Autor zadaje **apsolutni položaj i dimenzije**:
- slike (već podržano: `pdf_slika_stil.pozicioniranje='apsolutno'` + `pozicija_x/y_mm`, `sirina/visina_mm`),
- **frame A** (uži, pored slike) i **frame B** (pun, ispod slike).

Frameovi se **linkaju** (A → B → … lanac). Tekst je **jedan logički sadržaj**: puni se prvo frame A,
gleda se koliko je stalo, ostatak se nastavlja u frame B.

```
┌────────┬──────────────┐
│        │  FRAME A      │   ← uži tekst pored slike
│ SLIKA  │  (preljev)    │
│ (aps.) │               │
├────────┴──────────────┤
│  FRAME B (puna širina) │   ← nastavak istog teksta
│  …                     │
└────────────────────────┘
```

### Grid-snap (USVOJENO: Opcija A — vezano na A-mrežu)
Vertikalni ritam (prored) je **kontinuiran kroz A i B**. Nevidljiva mreža kreće od vrha frame A
(`yA`) s korakom `L = velicina_pt × prored`. Gornji rub frame B je **mekan**: prvi red B-a sjeda na
**prvu crtu mreže ≥ zadane pozicije B**:

```
y_snap = yA + ceil((yB − yA) / L) · L
```

Primjer (`L=5mm`, `yA=100`): zadano `yB=120` → 120; zadano `yB=121` → 125; zadano `yB=118` → 120.
Posljedica: razmak svih redaka (A i B, preko slike) je identičan — „baseline grid". Pomak gornjeg ruba
B može biti do jednog `L`.

(Alternativa „Opcija B — tvrd vrh" odbačena: B bi krenuo točno na zadanoj poziciji, ali razmak A→B
ne bi nužno bio jednak ostatku.)

### Rez teksta A→B (auto, mjerenjem)
1. Izmjeri lomove cijelog teksta na **širini frame A**.
2. Puni A red po red dok `k·L ≤ visina_A` → to je točka reza (prvi red koji bi prešao visinu A ide u B).
3. Prvi red koji „uđe" u B je uvijek **cjelovit** (nikad presječen).

## Render model (pdf-render.js)
- Slika = apsolutni pdfmake `image` (već podržano u `sastaviSliku`).
- Svaki frame = pdfmake **tablica fiksne širine na `absolutePosition`** (isti trik kao tekst zaglavlja
  na ~liniji 499 — pdfmake poštuje širinu tablice pa **sam točno lomi** tekst unutar frame-a).
- Mi računamo **samo točku reza** (koliko riječi u A, ostatak u B); pdfmake radi lom unutar svakog frame-a.
- Bešavni nastavak: reuse postojeće `noGapAbove`/`noGapBelow` / `spojeni_odlomci` semantike.

```
1. Izmjeri lomove teksta na ŠIRINI frame A
2. A = tablica(width=A.š) @ (A.x, A.y), prvih N redaka
3. B = tablica(width=B.š) @ (B.x, y_snap), ostatak
   y_snap = A.y + ceil((B.y − A.y)/L)·L
```

## Mjerenje (USVOJENO: canvas measureText)
- pdfmake v0.2.10 ima interni `LayoutBuilder`/`TextTools`/`widthOfString`/`measureLeaf`, ali su
  **webpack-interni** (javno samo `pdfMake.createPdf`) → dohvaćanje je krhko, lomi se na update-u.
- Zato: **canvas `measureText`** s pravim fontom (TTF iz `/fontovi/` učitan preko `FontFace` API-ja).
  Točno za naše latinične fontove uz mogući **±1 red** na granici — dizajn to podnosi (meki rub B).
- Mjerač u **zaseban modul** → kasnije zamjenjiv egzaktnim (font-metrics parsiranje TTF-a) bez dodira
  u resolver/render.

## Shema (USVOJENO) — `pdf_dokument_stavke`
Nove kolone (vrijede kad je tekst-stavka „frame"; ALTER za Heidi, .sql za Skeemu):

| kolona | tip | značenje |
|---|---|---|
| `frame_x_mm`, `frame_y_mm` | decimal(6,2) NULL | apsolutni gornji-lijevi kut frame-a |
| `frame_sirina_mm`, `frame_visina_mm` | decimal(6,2) NULL | dimenzije frame-a |
| `frame_nastavak_id` | int unsigned NULL, FK self | sljedeći frame u lancu (A→B→…); NULL=zadnji |
| `frame_y_meka` | tinyint(1) NOT NULL DEFAULT 1 | gornji rub mekan (snap na mrežu); 0=tvrd |

Novi `izvor_tip = 'frame_nastavak'` (frame B/C…: samo geometrija, bez vlastitog izvora — prima preljev;
dodaje se u CHECK `chk_izvor_po_tipu`).

Autor slaže: **stavka A** (puni tekst + frame A geom + `frame_nastavak_id`=B), **stavka B**
(`izvor_tip=frame_nastavak` + frame B geom), **slika** (apsolutna). Lanac proširiv na N frameova.

## Izvor istine (sadržaj za test)
Tablica **`kandidat_dokumenti_zivotopis`** (1:1 s članom):
- `id` int PK AI, `id_clan` int unsigned NOT NULL UNIQUE → FK `clanovi.id`, `zivotopis` text NULL.
- Tekst koji se prelijeva = `zivotopis`. **Slika nije u ovoj tablici** — izvor slike = **foto člana iz
  `clanovi`** (preko `id_clan`). Dostupne varijante: `slika`+`slika_mime` (puna, preporuka),
  `slika_thumbnail`+`…_mime`, `slika_thumb_round`+`…_mime`. Generator MIME čita iz magic-bytes, BLOB radi
  izravno. Za sada **frame slike ostaje prazan** (slika se žiči kasnije).
- Shema: `db-schema/vnlh/kandidat_dokumenti_zivotopis.sql` (Skeema) + `sql/alter_…` (one-off Heidi).

## Forma za unos (GOTOVO — 2026-06-28)
**`Kandidat_Dokumenti_CRUD`** (naslov „Dokumentacija kandidata"), uzor `Clanovi_Loza_CRUD` + `Esej_CRUD`:
- `html/Kandidat_Dokumenti_CRUD.html`, `css/…`, `js/…`, `php/Kandidat_Dokumenti_CRUD_{jedan,spremi,brisanje}.php`
- gornji red: slika člana (SAMO PRIKAZ, `Clanovi_CRUD_slika.php`) + tablica (geo + Traži), filtrirana `kandidat=1`
- edit: tab „Životopis" (contenteditable) + CRUD (upsert po `id_clan`, brisanje zapisa životopisa)
- meni-stavka: `sql/update_meni_kandidat_dokumenti.sql` (roditelj 127, leaf tip 4, device 1)
- **Pojednostavljenja (za doradu):** nije portan dinamički 60/40 sizing slika/tablica (oslonac na
  naslijeđeni CSS); server ne re-provjerava prava upisa (kao esej — oslonac na login + meni-prava na klijentu).

## Otvoreno / sljedeći koraci (redom)
1. Pokrenuti u Heidiju: `sql/alter_kandidat_dokumenti_zivotopis.sql` + `sql/update_meni_kandidat_dokumenti.sql`.
2. **Izvor slike** za obtjecanje (`clanovi.slika`) — registracija + frame ostaje prazan zasad.
3. Registracija izvora (`zivotopis`, slika) u `pdf_dozvoljeni_izvori` da ih dokument povuče.
4. Tek onda: render-kod (mjerač modul → resolver → `pdf-render.js`).

## Reference
- Render: `js/pdf-render.js` (`sastaviSliku`, `sastaviOdlomak`, absolute-pos tablica zaglavlja ~lin. 499).
- Resolver: `php/PDF_Generator_resolve.php`.
- Shema: `db-schema/vnlh/pdf_dokument_stavke.sql`, `pdf_slika_stil.sql`, `pdf_paragraf.sql`, `pdf_template.sql`.
- pdfmake: `js/vendor/pdfmake.min.js` (v0.2.10).
