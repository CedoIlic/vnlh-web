# Stil tablice — plan (dogovor prije koda)

Cilj: uz stilove odlomaka (`pdf_paragraf`) i slika (`pdf_slika_stil`) dodati **stil tablice** (`pdf_tablica_stil`)
+ definiciju stupaca (`pdf_tablica_stil_kolona`). Stil je VIZUAL + STRUKTURA stupaca; **podaci** (relacija/redovi)
dolaze iz stavke u `pdf_dokument` (zaseban, kasniji korak). Render = jedna pdfmake `table` po stilu.

Forma: **PDF_Stilovi_Tablice_CRUD.\*** (naslov **„Stil tablice"**), uzor stranice **PDF_Template_CRUD** (lijevo tablica + edit s tabovima,
desno pdfmake pregled; Kolone = pod-lista+edit kao okviri). Boje = dijeljeni `kontrola-boja` (alpha OFF, tisak). Decimalni zarez (vBroj).
**Sve kolone osim `id` imaju COMMENT; glavna tablica ima `napomena`.**

---

## 1. Shema

### `pdf_tablica_stil` (glavni)
Bazno:
- `id` int(11) unsigned PK AUTO_INCREMENT (bez commenta)
- `naziv` varchar(50) NOT NULL — naziv stila tablice (jedinstven, kao i ostali stilovi)
- `napomena` varchar(1024) NULL

**Tab „Osnovno" (fontovi):**
- `zaglavlje_font_id` int(11) unsigned NULL → FK `pdf_fontovi(id)` — font zaglavlja
- `zaglavlje_velicina_pt` decimal(5,2) NULL — veličina fonta zaglavlja (pt)
- `zaglavlje_bold` / `zaglavlje_italic` / `zaglavlje_podcrtano` tinyint(1) NOT NULL DEFAULT 0
- `zaglavlje_boja` varchar(7) NULL — boja teksta zaglavlja (#RRGGBB)
- `podaci_font_id` int(11) unsigned NULL → FK `pdf_fontovi(id)` — font podataka
- `podaci_velicina_pt` decimal(5,2) NULL
- `podaci_bold` / `podaci_italic` / `podaci_podcrtano` tinyint(1) NOT NULL DEFAULT 0
- `podaci_boja` varchar(7) NULL

**Tab „Grafika" (linije + ispune + vertikalni padding):**
- `okvir_debljina_mm` decimal(5,2) NOT NULL DEFAULT 0 — vanjski okvir tablice (sve 4 strane); 0 = bez
- `okvir_boja` varchar(7) NULL
- `zaglavlje_linija_debljina_mm` decimal(5,2) NOT NULL DEFAULT 0 — linija ISPOD zaglavlja
- `zaglavlje_linija_boja` varchar(7) NULL
- `linija_vert_debljina_mm` decimal(5,2) NOT NULL DEFAULT 0 — okomite linije između stupaca
- `linija_vert_boja` varchar(7) NULL
- `linija_red_debljina_mm` decimal(5,2) NOT NULL DEFAULT 0 — vodoravne linije između redaka podataka
- `linija_red_boja` varchar(7) NULL
- `zaglavlje_pozadina` tinyint(1) NOT NULL DEFAULT 0 — ima li zaglavlje pozadinu
- `zaglavlje_pozadina_boja` varchar(7) NULL — boja pozadine zaglavlja (kad uključeno)
- `zebra` tinyint(1) NOT NULL DEFAULT 0 — naizmjenična pozadina parnih redova
- `zebra_boja` varchar(7) NULL
- `zaglavlje_padding_gore_mm` decimal(5,2) NOT NULL DEFAULT 0 — vert. padding ćelije zaglavlja (gore)
- `zaglavlje_padding_dolje_mm` decimal(5,2) NOT NULL DEFAULT 0
- `podaci_padding_gore_mm` decimal(5,2) NOT NULL DEFAULT 0 — vert. padding ćelije podataka (gore)
- `podaci_padding_dolje_mm` decimal(5,2) NOT NULL DEFAULT 0

**Tab „Ostalo":**
- `delimiter` varchar(8) NOT NULL DEFAULT '|' — razdvajač vrijednosti reda iz stavke (mora ga nema u podacima)
- `prikazi_zaglavlje` tinyint(1) NOT NULL DEFAULT 1 — prikaži red zaglavlja
- `zaglavlje_ponavljanje` enum('prva','svaka') NOT NULL DEFAULT 'prva' — zaglavlje samo na 1. stranici / ponovi na svim (pdfmake `headerRows`)
- `ne_lomi_red` tinyint(1) NOT NULL DEFAULT 0 — red ne smije prijeći preko stranice (pdfmake `dontBreakRows`)
- `razmak_prije_mm` decimal(5,2) NOT NULL DEFAULT 0 — razmak iznad tablice
- `razmak_poslije_mm` decimal(5,2) NOT NULL DEFAULT 0 — razmak ispod tablice
- `pozicioniranje` enum('u_tijeku','apsolutno') NOT NULL DEFAULT 'u_tijeku'
- `poravnanje` enum('lijevo','centar','desno') NOT NULL DEFAULT 'lijevo' — poravnanje tablice kad nije puna širina (u_tijeku)
- `pozicija_x_mm` decimal(6,2) NULL — apsolutno: x gornjeg-lijevog kuta
- `pozicija_y_mm` decimal(6,2) NULL — apsolutno: y gornjeg-lijevog kuta

Ključevi: PK(id), KEY+FK `zaglavlje_font_id`/`podaci_font_id` → `pdf_fontovi(id)` ON DELETE RESTRICT ON UPDATE CASCADE.

### `pdf_tablica_stil_kolona` (stupci — child)
- `id` int(11) unsigned PK AUTO_INCREMENT (bez commenta)
- `tablica_stil_id` int(11) unsigned NOT NULL → FK `pdf_tablica_stil(id)` **ON DELETE CASCADE** ON UPDATE CASCADE
- `redoslijed` int(11) NOT NULL DEFAULT 0 — poredak stupca (lijevo→desno; pozicijsko punjenje iz delimitiranog reda)
- `naziv` varchar(50) NULL — interna oznaka stupca (admin)
- `zaglavlje` varchar(100) NULL — tekst u redu zaglavlja
- `sirina_tip` enum('fiksna','popuni') NOT NULL DEFAULT 'popuni' — fiksna(mm) / popuni(pdfmake `*`)
- `sirina_mm` decimal(6,2) NULL — širina kad `sirina_tip='fiksna'`
- `zag_orijentacija` enum('lijevo','centar','desno') NOT NULL DEFAULT 'lijevo' — poravnanje ćelije zaglavlja
- `zag_padding_lijevo_mm` decimal(5,2) NOT NULL DEFAULT 0
- `zag_padding_desno_mm` decimal(5,2) NOT NULL DEFAULT 0
- `zag_prefix` varchar(50) NULL — ispred teksta zaglavlja
- `zag_sufiks` varchar(50) NULL — iza teksta zaglavlja
- `pod_orijentacija` enum('lijevo','centar','desno') NOT NULL DEFAULT 'lijevo' — poravnanje ćelije podataka
- `pod_padding_lijevo_mm` decimal(5,2) NOT NULL DEFAULT 0
- `pod_padding_desno_mm` decimal(5,2) NOT NULL DEFAULT 0
- `pod_prefix` varchar(50) NULL — ispred vrijednosti
- `pod_sufiks` varchar(50) NULL — iza vrijednosti

Ključevi: PK(id), KEY+FK `tablica_stil_id`, KEY (`tablica_stil_id`,`redoslijed`).

**Datoteke:** `db-schema/vnlh/pdf_tablica_stil.sql` + `pdf_tablica_stil_kolona.sql` (Skeema) + `sql/create_pdf_tablica_stil.sql` (ručno HeidiSQL).

---

## 2. Forma PDF_Stilovi_Tablice_CRUD (naslov „Stil tablice")

Raspored uzor **PDF_Template_CRUD**:
- **Lijevo:** tablica stilova (1 kolona „Stil") s resize trakom + naziv (edit-delete, X=novi) + „Nasljedi stil" (kopira sve osim naziva) + edit s **4 taba** (kontrola-tab, aktivna kartica u negativu; gating na naziv).
- **Desno:** pdfmake **pregled uzorka** tablice (zaglavlje + ~3 reda lorem; 3 stupca: fiksni / popuni / fiksni; zebra/linije/pozadina/padding/poravnanje uživo). Auto-render na change/blur.

Tabovi:
1. **Osnovno** — dva bloka (Zaglavlje / Podaci): font (select pdf_fontovi) + veličina (stepper) + bold/italic/podcrtano + boja (`kontrola-boja`).
2. **Grafika** — okvir, linija ispod zaglavlja, vertikalne, između redaka (debljina mm + boja); pozadina zaglavlja (čekbox + boja); zebra (čekbox + boja); vert. padding zaglavlje/podaci (gore/dolje).
3. **Kolone** — pod-tablica stupaca (CommonCRUD instanca) + traka Dodaj/Obriši/▲/▼ + edit (naziv, zaglavlje, širina fiksna/popuni+mm, set Zaglavlje, set Podaci). Drži se u memoriji (`kolonState`), sprema s stilom (JSON → PHP `citaj/upisi`, transakcijski upsert kao `pdf_template_okvir`). **Uzor: okviri u PDF_Template.**
4. **Ostalo** — delimiter; prikaži zaglavlje (čekbox) + ponavljanje (prva/svaka); ne lomi red; razmak prije/poslije; pozicioniranje (u_tijeku→poravnanje L/C/D | apsolutno→x/y).

PHP: `_sve` (+ `kolone[]` po stilu), `_jedan`, `_upis`, `_izmjena` (upsert stupaca ČUVA id-eve — pouka iz okvira/FK), `_brisanje`, `_polja` (zajedničko čitanje/validacija + `citaj/upisi/spremi_kolone`). Lint PHP CLI / node prije kraja.

---

## 3. Render + uporaba u dokumentu (KASNIJE, zaseban korak)
- Novi `izvor_tip = 'relacija_tablica'` na `pdf_dokument_stavke` (uz relacija_redak/lista/grupe): `relacija_id` + novi `tablica_stil_id` (FK).
- Stavka (predložak po retku) proizvodi redove kao **delimitirane stringove** (delimiter iz stila).
- Resolver: relacija → redovi → split po delimiteru → matrica ćelija (+ geometrija/stil iz `pdf_tablica_stil` i `…_kolona`).
- `pdf-render.js`: složi pdfmake `table`:
  - `widths` iz stupaca (fiksna mm→pt / `*`); header red (ako `prikazi_zaglavlje`); `headerRows=1` kad `zaglavlje_ponavljanje='svaka'`; `dontBreakRows`.
  - `layout`: hLine/vLine width+color po indeksu (okvir / ispod-zaglavlja / red / vert); `fillColor` (zaglavlje pozadina + zebra po parnosti); padding (per-stupac L/D + per-regija G/D).
  - ćelija = `prefix + vrijednost + sufiks`, font/boja/poravnanje iz regije+stupca; `noWrap`/delimiter-prijeloma (faza „kasnije").
  - poravnanje tablice: centar/desno = omotati u `columns` sa `*` spacerima; apsolutno = `absolutePosition:{x,y}`; razmak prije/poslije = `margin`.
  - relacija 0 redova → samo zaglavlje (ako uključeno), inače ništa.

## „Kasnije" (popis)
- Padding-wrap + delimiter prijeloma reda per-regija (`*_prelamanje`, `*_delimiter`).
- Crtkane linije (stil linije).
- Vertikalno poravnanje sadržaja ćelije — pdfmake NE podržava (samo gore; eventualno hak paddingom).
- FK stupca/ćelije na `pdf_paragraf` (umjesto ugrađenog fonta) — ako se ikad poželi.
