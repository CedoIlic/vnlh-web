# Projektni zadatak: Generator PDF dokumenata iz baze podataka

> Dokument je namijenjen kao specifikacija za implementaciju (Claude Code). Sadrži opis
> projekta, kompletne sheme baze (MySQL/MariaDB, `utf8mb4`) s komentarima na svakoj koloni, te
> faze izrade s opisom funkcionalnosti svake forme.

---

## 1. Opis projekta

### 1.1 Cilj
Izgraditi sustav koji iz podataka u bazi (tekstovi + stilovi + postavke stranice) generira
**PDF dokument za pregled, spremanje i ispis**. Generiranje PDF-a odvija se **u cijelosti na
strani korisnika** (u pregledniku), bez ikakvih instalacija ili dodataka kod krajnjeg korisnika.

### 1.2 Tehnologija
- **Frontend:** Čisti HTML + JavaScript (bez frameworka).
- **PDF biblioteka:** **pdfmake** (uključuje se kao `<script>` ili lokalni `.js`; putuje s
  aplikacijom — korisnik ništa ne instalira).
- **Backend:** PHP; dohvaća tekstove iz raznih tablica, pridružuje im stilove i postavke stranice,
  te frontendu šalje **gotov JSON paket spreman za PDF**. Sva poslovna logika (spajanje
  podataka) je na backendu; frontend samo prosljeđuje JSON pdfmake-u i prikazuje rezultat.
- **Baza:** MariaDB 10.4+ / MySQL 8.0.16+, sve tablice `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`.

### 1.3 Fontovi
- **Tekstualni fontovi (GNU FreeFont — izgled nalik Times/Helvetica):**
  **FreeSerif** (serif), **FreeSans** (sans-serif), **FreeMono** (monospace).
- **Simbol/fallback font:** **DejaVu Sans** — pokriva ∴, °, crtice, bulete i ček/ballot
  simbole u **sve 4 varijante** te sva europska pisma (grčki, ćirilica). Služi kao izvor
  glifova koje tekstualni fontovi nemaju.
- Svi u **sve četiri varijante** (normal, bold, italics, bolditalics). Sva pisma (latinica
  HR/PL/HU/baltička/RO, grčki, ćirilica) pokrivena su u svim fontovima.
- **Rukovanje simbolima (auto-rutanje):** tekstualni font ne mora imati simbole. Generator
  ima konfiguriran **skup simbol-znakova** (∴, ✓, ✗, ☑, ☒, ✔, posebni buleti…); pri sastavljanju
  paragrafa razbije tekst na segmente — simbol-znakove crta **DejaVu Sans**, ostatak font
  paragrafa. Admin u izvornim tablicama tipka **prave znakove** (bez placeholdera). Novi simbol
  = dodatak u konfiguracijski popis. Egzotični glif koji DejaVu Sans nema → tada dodati
  namjenski simbol-font (npr. Noto Sans Symbols 2).
- Fontovi se **ugrađuju u frontend** (pdfmake `vfs` — virtual file system), a **ne** šalju iz
  backenda. Učitavaju se **jednom**, na **glavnom izborniku** (stranica iza logina); preglednik
  ih cachira. Font **nikad ne putuje iz backenda** pri generiranju — backend šalje samo podatke.
- `.ttf` datoteke su u folderu `fontovi/` (staza u sustav_varijable id=119), imenovane po
  konvenciji `Porodica-Varijanta.ttf` (Regular/Bold/Italic/BoldItalic). Registar fontova vodi
  se u tablici `pdf_fontovi` (metapodaci); same `.ttf` datoteke **nisu** u bazi.

  ```javascript
  pdfMake.fonts = {
    FreeSerif:  { normal: 'FreeSerif-Regular.ttf',  bold: 'FreeSerif-Bold.ttf',
                  italics: 'FreeSerif-Italic.ttf',  bolditalics: 'FreeSerif-BoldItalic.ttf' },
    FreeSans:   { normal: 'FreeSans-Regular.ttf',   bold: 'FreeSans-Bold.ttf',
                  italics: 'FreeSans-Italic.ttf',   bolditalics: 'FreeSans-BoldItalic.ttf' },
    FreeMono:   { normal: 'FreeMono-Regular.ttf',   bold: 'FreeMono-Bold.ttf',
                  italics: 'FreeMono-Italic.ttf',   bolditalics: 'FreeMono-BoldItalic.ttf' },
    DejaVuSans: { normal: 'DejaVuSans-Regular.ttf', bold: 'DejaVuSans-Bold.ttf',
                  italics: 'DejaVuSans-Italic.ttf', bolditalics: 'DejaVuSans-BoldItalic.ttf' }
  };
  ```

### 1.4 Ključni koncepti

**Dokument = zaglavlje + stavke.**
`pdf_dokument` je zaglavlje (veže jedan `pdf_template`); `pdf_dokument_stavke` su sadržaj
(jedan red = jedna stavka). Jedan template može se koristiti na više dokumenata (1:N).

**Stavka.** Svaka stavka ima: pripadnost dokumentu, redoslijed iscrtavanja, zonu
(tijelo / zaglavlje / podnožje / naslovna), vrstu (tekst / slika), izvor podatka i prikaz (stil).

**Izvor podatka — sigurnost i struktura.**
Svaki mogući izvor (tablica + kolona) mora biti prethodno registriran u tablici
`pdf_dozvoljeni_izvori`. Stavka referencira `izvor_id` (FK na tu tablicu) — backend nikad
ne gradi SQL iz slobodnog stringa. Ovo sprječava SQL injection i osigurava kontrolirani
whitelist izvora kojeg uređuje administrator.

- *Statički* — stavka zna točan redak: `izvor_id` i `izvor_red_id`.
  Primjer: uvijek ista slika iz `moje_slike.slika`, id 143.
- *Dinamički* — stavka zna izvor (`izvor_id`), ali **id retka dolazi iz konteksta** pri
  generiranju (frontend šalje npr. `{ loza_id: 57 }`). Stavka nosi `kontekst_kljuc`
  (npr. `loza_id`). Primjer: logo lože `loze.logotip` — id ovisi o trenutno izabranoj loži.
- Dokument prima **više kontekstnih vrijednosti istovremeno**.

**Slike u bazi.** Slike su pohranjene kao BLOB s pratećim MIME poljem. Backend pri
sastavljanju JSON-a pretvara BLOB + MIME u base64 data URL koji pdfmake koristi.

**Prikaz po vrsti.** Tekst-stavka koristi `paragraf_id` (→ `pdf_paragraf`); slika-stavka
koristi `slika_stil_id` (→ `pdf_slika_stil`). CHECK ograničenja jamče da se popunjava ispravan.

**Nasljeđivanje formatiranja u tekstu.** Ako jedan podatak sadrži više odlomaka (razdvojenih
prijelomom retka `\n`), svaki odlomak postaje zaseban paragraf u PDF-u, a **svi dijele
formatiranje** paragrafa na koji je stavka vezana. Nasljeđivanje vrijedi **samo unutar istog
podatka** — ne prelijeva se na sljedeću stavku.

### 1.5 Tijek generiranja (backend → frontend)
1. Frontend (s glavnog izbornika) traži dokument: šalje `dokument_id` + kontekst (npr.
   `{ loza_id: 57 }`).
2. Backend pročita `pdf_dokument` → dohvati `template_id` → postavke stranice iz `pdf_template`.
3. Backend pročita pripadne `pdf_dokument_stavke` `WHERE dokument_id = ? ORDER BY redoslijed`.
4. Za svaku stavku dohvati `pdf_dozvoljeni_izvori` (tablica + kolona) te sadržaj:
   statički = `izvor_red_id`; dinamički = id iz konteksta po `kontekst_kljuc`.
   Slike: BLOB + MIME → base64 data URL.
5. Tekst razbije po `\n` na odlomke (isto formatiranje); primijeni stil (`paragraf_id` /
   `slika_stil_id`); rasporedi po zoni (tijelo/zaglavlje/podnožje/naslovna).
6. Sve složi u pdfmake JSON (template → page postavke; stavke → `content`/`header`/`footer`).
7. Frontend proslijedi JSON pdfmake-u → PDF se generira u pregledniku.
8. Korisnik PDF pregleda, sprema lokalno ili ispisuje.

### 1.6 Poznata ograničenja pdfmake-a (svjesno prihvaćena)
- **Nema obtekanja teksta oko slike** (text wrap). Podržano: slika kao zaseban blok, tekst
  preko slike, te usidrena/apsolutno pozicionirana slika. Jedini slučaj obtekanja rješava se
  zaobilazno (dva povezana okvira) i odgođen je — vidi TODO u `pdf_dokument_stavke`.
- **Nema zrcalnih (veznih) margina** po parnim/neparnim stranicama. Polja za dvostrani ispis
  (`dvostran`, `vezna_margina_mm`) **pripremljena** u `pdf_template`, ali generator ih zasad
  **ne primjenjuje** (buduće proširenje, moguć i prelazak na CSS Paged Media).
- **Prozirnost slika** ima ograničenu podršku — provjeriti u fazi izrade.
- **Uvlaka prvog retka** nije nativna — generator je simulira.

---

## 2. Sheme baze podataka

> Svaka tablica ima kolonu `napomena VARCHAR(1024)` (slobodna bilješka administratora).
> Svaka kolona ima SQL `COMMENT` s opisom funkcije.
> CHECK ograničenja zahtijevaju **MariaDB 10.4+** ili **MySQL 8.0.16+**; na starijim verzijama
> integritet osigurava aplikacija.

### 2.1 `pdf_fontovi` — registar fontova (metapodaci)

```sql
CREATE TABLE pdf_fontovi (
  id              INT AUTO_INCREMENT PRIMARY KEY            COMMENT 'Jedinstveni ključ fonta',
  naziv           VARCHAR(50)  NOT NULL                     COMMENT 'Ljudski naziv fonta, npr. "Roboto", "Liberation Serif"',
  pdfmake_kljuc   VARCHAR(50)  NOT NULL                     COMMENT 'Točan ključ u pdfMake.fonts; mora se podudarati (npr. "LiberationSerif")',
  tip             ENUM('serif','sans','mono') NOT NULL      COMMENT 'Kategorija fonta: serif, sans-serif ili monospace',
  podrzana_pisma  JSON         NOT NULL                     COMMENT 'Pisma koja font pokriva, npr. ["latin"] ili ["latin","cyrillic"]',
  aktivan         TINYINT(1)   NOT NULL DEFAULT 1           COMMENT 'Je li font dostupan za izbor (1=da, 0=ne)',
  napomena        VARCHAR(1024) NULL                        COMMENT 'Slobodna bilješka administratora'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO pdf_fontovi (naziv, pdfmake_kljuc, tip, podrzana_pisma, aktivan) VALUES
('Roboto',           'Roboto',          'sans',  '["latin"]', 1),
('Liberation Serif', 'LiberationSerif', 'serif', '["latin"]', 1);
```

**Napomene:** fontove dodaje isključivo administrator; svaki uključeni font ima **sve četiri**
varijante (jamči administratorski postupak, zato nema polja po varijantama). Same `.ttf`
datoteke nisu u bazi — ova tablica samo evidentira koji fontovi postoje i kako ih zvati.
Višejezičnost = dodavanje fonta s odgovarajućim glifovima u `vfs_fonts.js`; `podrzana_pisma`
evidentira koje pismo koji font pokriva.

### 2.2 `pdf_dozvoljeni_izvori` — whitelist izvora podataka

```sql
CREATE TABLE pdf_dozvoljeni_izvori (
  id            INT AUTO_INCREMENT PRIMARY KEY             COMMENT 'Jedinstveni ključ izvora',
  naziv         VARCHAR(100) NOT NULL                      COMMENT 'Opis izvora za admina, npr. "Logo lože", "Ime lože"',
  tablica       VARCHAR(64)  NOT NULL                      COMMENT 'Naziv tablice iz koje se čita podatak',
  kolona        VARCHAR(64)  NOT NULL                      COMMENT 'Naziv kolone iz koje se čita podatak',
  tip_podatka   ENUM('tekst','slika') NOT NULL             COMMENT 'Vrsta podatka: tekst ili slika (BLOB+MIME); određuje koji tip stavke smije koristiti ovaj izvor',
  napomena      VARCHAR(1024) NULL                         COMMENT 'Slobodna bilješka administratora'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Svrha:** backend nikad ne gradi SQL iz slobodnog stringa — tablica i kolona uvijek dolaze
iz ovog whitelista. `pdf_dokument_stavke.izvor_id` referencira ovaj redak; backend za
taj `izvor_id` dohvati `tablica` i `kolona`, pa izvede: `SELECT {kolona} FROM {tablica} WHERE id = ?`.
Administrator dodaje novi izvor unošenjem u ovu tablicu; nijedan drugi string nije dozvoljen.

### 2.3 `pdf_paragraf` — stilovi teksta

```sql
CREATE TABLE pdf_paragraf (
  id                       INT AUTO_INCREMENT PRIMARY KEY   COMMENT 'Jedinstveni ključ stila paragrafa',
  naziv                    VARCHAR(50)  NOT NULL            COMMENT 'Naziv stila, npr. "Naslov1", "Tijelo", "Ime_loze"',

  font_id                  INT          NOT NULL            COMMENT 'FK na pdf_fontovi — koji font koristi (pdfmake: font)',
  velicina_pt              DECIMAL(5,2) NOT NULL DEFAULT 12.00 COMMENT 'Veličina slova u točkama pt (pdfmake: fontSize)',

  bold                     TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Podebljano (pdfmake: bold)',
  italic                   TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Kurziv (pdfmake: italics)',
  podcrtano                TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Podcrtano (pdfmake: decoration=underline)',
  boja                     VARCHAR(7)   NOT NULL DEFAULT '#000000' COMMENT 'Boja teksta, hex (pdfmake: color)',

  boja_pozadine            VARCHAR(7)   NULL DEFAULT NULL   COMMENT 'Boja pozadine teksta, hex; NULL=bez (pdfmake: background ili fillColor trake)',
  pozadina_cijeli_red      TINYINT(1)   NOT NULL DEFAULT 0  COMMENT '0=highlight samo iza teksta; 1=puna traka preko širine između margina (koristi boja_pozadine)',
  traka_padding_lijevo_mm  DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak teksta od lijevog ruba trake u mm (samo kad pozadina_cijeli_red=1)',
  traka_padding_desno_mm   DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak desno u mm (samo kad pozadina_cijeli_red=1)',
  traka_padding_gore_mm    DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak gore u mm (samo kad pozadina_cijeli_red=1)',
  traka_padding_dolje_mm   DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak dolje u mm (samo kad pozadina_cijeli_red=1)',

  poravnanje               ENUM('left','right','center','justify') NOT NULL DEFAULT 'left' COMMENT 'Poravnanje teksta (pdfmake: alignment)',
  prored                   DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT 'Množitelj proreda, npr. 1.00, 1.50 (pdfmake: lineHeight)',

  razmak_prije_mm          DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Razmak iznad paragrafa u mm (pdfmake: margin gornji)',
  razmak_poslije_mm        DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Razmak ispod paragrafa u mm (pdfmake: margin donji)',
  uvlaka_lijevo_mm         DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Lijeva uvlaka paragrafa u mm (pdfmake: margin lijevi)',
  uvlaka_desno_mm          DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Desna uvlaka paragrafa u mm (pdfmake: margin desni)',
  uvlaka_prvi_red_mm       DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Uvlaka prvog retka u mm; nije nativno u pdfmake — generator simulira',

  -- Okvir (border) oko paragrafa — render kao jedna-ćelija tablica; debljina 0 = strana bez linije
  okvir_debljina_gore_mm   DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina gornje linije okvira u mm; 0=nema (pdfmake: hLineWidth(0))',
  okvir_debljina_dolje_mm  DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina donje linije okvira u mm; 0=nema (pdfmake: hLineWidth(1))',
  okvir_debljina_lijevo_mm DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina lijeve linije okvira u mm; 0=nema (pdfmake: vLineWidth(0))',
  okvir_debljina_desno_mm  DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Debljina desne linije okvira u mm; 0=nema (pdfmake: vLineWidth(1))',
  okvir_padding_gore_mm    DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Unutarnji razmak teksta od gornje linije okvira u mm (pdfmake: paddingTop)',
  okvir_padding_dolje_mm   DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Padding dolje u mm (pdfmake: paddingBottom)',
  okvir_padding_lijevo_mm  DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Padding lijevo u mm (pdfmake: paddingLeft)',
  okvir_padding_desno_mm   DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Padding desno u mm (pdfmake: paddingRight)',
  okvir_boja               VARCHAR(7)   NOT NULL DEFAULT '#000000' COMMENT 'Boja linija okvira, hex; jedna za sve 4 strane (pdfmake: hLineColor/vLineColor)',
  okvir_boja_podloge       VARCHAR(7)   NULL DEFAULT NULL   COMMENT 'Boja ispune (podloge) okvira, hex; NULL=bez ispune (pdfmake: fillColor ćelije)',
  okvir_do_lijeve_margine  TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Lijevi rub okvira ide do lijeve margine (1) ili po sadržaju teksta (0)',
  okvir_do_desne_margine   TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Desni rub okvira ide do desne margine (1) ili po sadržaju teksta (0)',
  okvir_postuj_uvlaku      TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Kad strana ide do margine, a ovo=1, ide do uvlake te strane (uvlaka_lijevo/desno) umjesto do margine; obje strane',

  napomena                 VARCHAR(1024) NULL               COMMENT 'Slobodna bilješka administratora',

  CONSTRAINT fk_paragraf_font
    FOREIGN KEY (font_id) REFERENCES pdf_fontovi(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Logika pozadine:** `boja_pozadine` NULL → nema pozadine; zadana + `pozadina_cijeli_red=0` →
highlight iza slova; zadana + `pozadina_cijeli_red=1` → puna traka punom širinom (paragraf se
zamota u tablicu s `fillColor`, `traka_padding_*` kao padding ćelije).

**Logika okvira:** okvir „postoji" ako je bar jedna `okvir_debljina_*_mm > 0`. Tada se paragraf
renderira kao **jedna-ćelija tablica**: linije = `okvir_boja` (po strani uključene/širine iz
`okvir_debljina_*`, 0=nema), ispuna = `okvir_boja_podloge` (NULL=bez ispune), padding =
`okvir_padding_*`. Ta podloga **dominira** — kad okvir postoji, `boja_pozadine`/`traka_*` se
**ignorira**; bez okvira vrijedi gornja „Logika pozadine". **Širina okvira** kontroliraju dva
neovisna prekidača: `okvir_do_lijeve_margine` i `okvir_do_desne_margine` — svaka strana ide do
svoje margine (1) ili po sadržaju teksta (0). Kombinacije: 1/1 = puna širina (margina↔margina,
`widths:['*']`); 0/0 = po sadržaju (`widths:['auto']`); 1/0 i 0/1 = jednostrano rastezanje
(generator mjeri širinu sadržaja i pozicionira kutiju). Uz `okvir_postuj_uvlaku=1` strana koja
ide „do margine" ide do **uvlake** te strane (`uvlaka_lijevo/desno`) umjesto do prave margine
(vrijedi za obje strane). **Bez zaobljenih kutova** (tablični okvir u pdfmake to ne podržava).
mm→pt konverziju radi generator (1 mm ≈ 2.835 pt).

### 2.4 `pdf_slika_stil` — stilovi slika

```sql
CREATE TABLE pdf_slika_stil (
  id                 INT AUTO_INCREMENT PRIMARY KEY          COMMENT 'Jedinstveni ključ stila slike',
  naziv              VARCHAR(50)  NOT NULL                   COMMENT 'Naziv stila, npr. "Logo 3x3", "Zaglavlje lijevo"',

  sirina_mm          DECIMAL(6,2) NOT NULL                   COMMENT 'Širina okvira slike u mm',
  visina_mm          DECIMAL(6,2) NOT NULL                   COMMENT 'Visina okvira slike u mm',
  skaliranje         ENUM('uklopi','razvuci') NOT NULL DEFAULT 'uklopi' COMMENT 'uklopi=čuva proporcije unutar okvira (pdfmake fit); razvuci=popuni okvir, dopušta deformaciju (width+height)',

  okvir              TINYINT(1)   NOT NULL DEFAULT 0         COMMENT 'Ima li slika okvir (1=da)',
  okvir_boja         VARCHAR(7)   NULL                       COMMENT 'Hex boja okvira (kad okvir=1)',
  okvir_debljina_mm  DECIMAL(4,2) NULL                       COMMENT 'Debljina okvira u mm (kad okvir=1)',

  prozirnost         TINYINT      NOT NULL DEFAULT 100       COMMENT 'Prozirnost slike 0-100% (ograničena podrška u pdfmake — provjeriti)',

  pozicioniranje     ENUM('u_tijeku','usidreno','apsolutno') NOT NULL DEFAULT 'u_tijeku' COMMENT 'u_tijeku=teče s tekstom; usidreno=zona preko poravnanja; apsolutno=fiksne x/y koordinate',
  poravnanje_h       ENUM('lijevo','centar','desno') NULL    COMMENT 'Horizontalno poravnanje (u_tijeku/usidreno). lijevo=lijevi rub, desno=desni rub, centar=srednja os; referenca=margina',
  poravnanje_v       ENUM('gore','centar','dolje') NULL      COMMENT 'Vertikalno poravnanje (usidreno). gore=gornji rub, dolje=donji rub, centar=srednja os; referenca=margina',
  pozicija_x_mm      DECIMAL(6,2) NULL                       COMMENT 'X gornjeg lijevog kuta u mm (kad pozicioniranje=apsolutno)',
  pozicija_y_mm      DECIMAL(6,2) NULL                       COMMENT 'Y gornjeg lijevog kuta u mm (kad pozicioniranje=apsolutno)',
  potiskuje          TINYINT(1)   NOT NULL DEFAULT 1         COMMENT '1=slika gura ostali sadržaj; 0=lebdi (sadržaj je ne primjećuje)',

  napomena           VARCHAR(1024) NULL                      COMMENT 'Slobodna bilješka administratora'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Usidrenje:** referentni rub/os slike izvodi se iz `poravnanje_h`/`poravnanje_v`; referenca je
područje **unutar margina** (bez odmaka). `usidreno` se interno pretvara u apsolutne koordinate u
trenutku generiranja, na temelju dimenzija slike i stranice.

### 2.5 `pdf_template` — postavke stranice

```sql
CREATE TABLE pdf_template (
  id                        INT AUTO_INCREMENT PRIMARY KEY   COMMENT 'Jedinstveni ključ templatea',
  naziv                     VARCHAR(50) NOT NULL             COMMENT 'Naziv templatea',

  format_papira             ENUM('A4','A5','A3','Letter','Legal','custom') NOT NULL DEFAULT 'A4' COMMENT 'Format papira; custom koristi sirina_mm/visina_mm',
  sirina_mm                 DECIMAL(6,2) NULL                COMMENT 'Širina papira u mm (samo kad format_papira=custom)',
  visina_mm                 DECIMAL(6,2) NULL                COMMENT 'Visina papira u mm (samo kad format_papira=custom)',
  orijentacija              ENUM('portrait','landscape') NOT NULL DEFAULT 'portrait' COMMENT 'Orijentacija (pdfmake: pageOrientation)',

  margina_gore_mm           DECIMAL(5,2) NOT NULL DEFAULT 20.00 COMMENT 'Gornja margina u mm',
  margina_dolje_mm          DECIMAL(5,2) NOT NULL DEFAULT 20.00 COMMENT 'Donja margina u mm',
  margina_lijevo_mm         DECIMAL(5,2) NOT NULL DEFAULT 20.00 COMMENT 'Lijeva margina u mm',
  margina_desno_mm          DECIMAL(5,2) NOT NULL DEFAULT 20.00 COMMENT 'Desna margina u mm',

  zaglavlje                 TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Ima li dokument zaglavlje (1=da)',
  zaglavlje_visina_mm       DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Visina prostora zaglavlja u mm',
  zaglavlje_padding_mm      DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Pomak početka tijela ispod zaglavlja u mm; može biti negativan',
  zaglavlje_primjena        ENUM('prva','svaka') NOT NULL DEFAULT 'svaka' COMMENT 'Zaglavlje samo na prvoj stranici ili na svakoj',

  podnozje                  TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Ima li dokument podnožje (1=da)',
  podnozje_visina_mm        DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Visina prostora podnožja u mm',
  podnozje_padding_mm       DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Pomak kraja tijela iznad podnožja u mm; može biti negativan',
  podnozje_od_stranice      SMALLINT     NOT NULL DEFAULT 1  COMMENT 'Od koje stranice se podnožje prikazuje (npr. 2 preskače naslovnu)',

  broj_stranice             TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Prikazuje li se brojač stranica (1=da)',
  broj_stranice_format      VARCHAR(100) NOT NULL DEFAULT 'Stranica #S od #U' COMMENT 'Predložak brojača; #S=trenutna stranica, #U=ukupno stranica',
  broj_stranice_zona        ENUM('podnozje','zaglavlje') NOT NULL DEFAULT 'podnozje' COMMENT 'Zona u kojoj se prikazuje brojač stranica',
  broj_stranice_poravnanje  ENUM('lijevo','centar','desno') NOT NULL DEFAULT 'centar' COMMENT 'Horizontalno poravnanje brojača stranica unutar zone',

  naslovna_stranica         TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'Ima li dokument naslovnu stranicu (1=da); sadržaj naslovnice definira se stavkama s zona=naslovna',

  -- Dvostrani ispis — PRIPREMLJENO, logika zasad NEAKTIVNA (pdfmake ne podržava zrcalne margine)
  dvostran                  TINYINT(1)   NOT NULL DEFAULT 0  COMMENT 'TODO/budućnost: 0=jednostran, 1=dvostran. Generator zasad ignorira.',
  vezna_margina_mm          DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'TODO/budućnost: dodatak margine uz uvez, zrcali se po parnim/neparnim. Zasad neaktivno.',

  napomena                  VARCHAR(1024) NULL               COMMENT 'Slobodna bilješka administratora'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Margine i zaglavlje:** efektivni početak tijela = `margina_gore_mm + zaglavlje_padding_mm`
(kad zaglavlje postoji); zrcalno za podnožje. **Naslovna + dvostrano:** kad naslovna postoji i
dokument je dvostran, stranica 2 ostaje prazna (odgođeno — veže se uz dvostrani ispis).
**Brojač:** pdfmake `footer:(currentPage,pageCount)=>...`; generator zamijeni `#S`/`#U` i
poštuje `broj_stranice_zona` i `broj_stranice_poravnanje`.

### 2.6 `pdf_dokument` — zaglavlje dokumenta

```sql
CREATE TABLE pdf_dokument (
  id           INT AUTO_INCREMENT PRIMARY KEY               COMMENT 'Jedinstveni ključ dokumenta',
  naziv        VARCHAR(100) NOT NULL                        COMMENT 'Prepoznatljiv naziv dokumenta',
  template_id  INT NOT NULL                                 COMMENT 'FK na pdf_template — oblik stranice koji dokument koristi',
  opis         VARCHAR(255) NULL                            COMMENT 'Opcionalni opis dokumenta',
  aktivan      TINYINT(1) NOT NULL DEFAULT 1                COMMENT 'Je li dokument dostupan za generiranje (1=da)',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT 'Vrijeme kreiranja zapisa',
  napomena     VARCHAR(1024) NULL                           COMMENT 'Slobodna bilješka administratora',

  CONSTRAINT fk_dokument_template
    FOREIGN KEY (template_id) REFERENCES pdf_template(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Veza na stavke:** ostvaruje se s druge strane — `pdf_dokument_stavke.dokument_id` pokazuje
ovamo (1:N). Dokument ne drži popis stavki; dohvat ide upitom po `dokument_id`.

### 2.7 `pdf_dokument_stavke` — sadržaj dokumenta

```sql
CREATE TABLE pdf_dokument_stavke (
  id                INT AUTO_INCREMENT PRIMARY KEY           COMMENT 'Jedinstveni ključ stavke',
  dokument_id       INT NOT NULL                             COMMENT 'FK na pdf_dokument — kojem dokumentu stavka pripada',
  redoslijed        INT NOT NULL DEFAULT 0                   COMMENT 'Poredak iscrtavanja unutar dokumenta',
  zona              ENUM('tijelo','zaglavlje','podnozje','naslovna') NOT NULL DEFAULT 'tijelo'
                                                             COMMENT 'Zona stranice: tijelo=glavni sadržaj; zaglavlje/podnozje=ponavljaju se po stranicama; naslovna=isključivo na prvoj stranici (kad naslovna_stranica=1 u templateu)',
  vrsta             ENUM('tekst','slika') NOT NULL           COMMENT 'Vrsta stavke: tekst ili slika',

  izvor_id          INT NOT NULL                             COMMENT 'FK na pdf_dozvoljeni_izvori — whitelist tablice i kolone iz koje se čita sadržaj',
  izvor_tip         ENUM('staticki','dinamicki') NOT NULL    COMMENT 'staticki=fiksni izvor_red_id; dinamicki=id iz konteksta po kontekst_kljuc',
  izvor_red_id      INT NULL                                 COMMENT 'Fiksni id retka u izvoru (kad izvor_tip=staticki)',
  kontekst_kljuc    VARCHAR(64) NULL                         COMMENT 'Ključ konteksta iz kojeg dolazi id pri generiranju, npr. "loza_id" (kad izvor_tip=dinamicki)',

  paragraf_id       INT NULL                                 COMMENT 'FK na pdf_paragraf — stil teksta (kad vrsta=tekst)',
  slika_stil_id     INT NULL                                 COMMENT 'FK na pdf_slika_stil — stil slike (kad vrsta=slika)',

  -- TODO (buduće proširenje): prelijevanje teksta u dva povezana okvira (za 1 specifičan dokument).
  -- Dodati kad osnova radi i ispravno generira. Predviđena polja (sva nullable, popunjavaju se
  -- samo kad je prelijevanje uključeno; ostale stavke ih ignoriraju):
  --   prelijev TINYINT(1) DEFAULT 0,
  --   prelijev_okvir1_x_mm, prelijev_okvir1_y_mm, prelijev_okvir1_sirina_mm, prelijev_okvir1_visina_mm  DECIMAL(6,2),
  --   prelijev_okvir2_x_mm, prelijev_okvir2_y_mm, prelijev_okvir2_sirina_mm, prelijev_okvir2_visina_mm  DECIMAL(6,2)
  -- Logika: izmjeri tekst, napuni okvir1 do granice, ostatak u okvir2. Inače normalno crtanje.

  napomena          VARCHAR(1024) NULL                       COMMENT 'Slobodna bilješka administratora',

  CONSTRAINT chk_prikaz_po_vrsti CHECK (
    (vrsta = 'tekst' AND paragraf_id IS NOT NULL AND slika_stil_id IS NULL) OR
    (vrsta = 'slika' AND slika_stil_id IS NOT NULL AND paragraf_id IS NULL)
  ),
  CONSTRAINT chk_izvor_po_tipu CHECK (
    (izvor_tip = 'staticki'  AND izvor_red_id IS NOT NULL AND kontekst_kljuc IS NULL) OR
    (izvor_tip = 'dinamicki' AND kontekst_kljuc IS NOT NULL AND izvor_red_id IS NULL)
  ),
  CONSTRAINT fk_stavka_dokument
    FOREIGN KEY (dokument_id) REFERENCES pdf_dokument(id) ON DELETE CASCADE,
  CONSTRAINT fk_stavka_izvor
    FOREIGN KEY (izvor_id) REFERENCES pdf_dozvoljeni_izvori(id),
  CONSTRAINT fk_stavka_paragraf
    FOREIGN KEY (paragraf_id) REFERENCES pdf_paragraf(id),
  CONSTRAINT fk_stavka_slika_stil
    FOREIGN KEY (slika_stil_id) REFERENCES pdf_slika_stil(id),

  INDEX idx_dokument_redoslijed (dokument_id, redoslijed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**ON DELETE CASCADE** samo na `dokument_id` (brisanje dokumenta briše njegove stavke). FK na
`izvor_id`, `paragraf_id` i `slika_stil_id` **nemaju** cascade — štite referencirane zapise
od brisanja dok su u upotrebi.

**Naslovna stranica:** stavke s `zona='naslovna'` iscrtavaju se isključivo na prvoj stranici.
Ako `naslovna_stranica=0` u templateu, generator ignoriše stavke s tom zonom. Sadržaj naslovne
stranice može biti prazan (nema stavki s tom zonom) — template tada generira praznu prvu stranicu.

### 2.8 Relacijski pregled
```
pdf_fontovi (1) ──< pdf_paragraf (N)
                         │
pdf_dozvoljeni_izvori ───┤  (izvor_id — whitelist; zaštićen od brisanja)
pdf_slika_stil ──────────┤  (slika_stil_id — zaštićen od brisanja)
pdf_paragraf ────────────┘  (paragraf_id — zaštićen od brisanja)
                         │
pdf_template (1) ──< pdf_dokument (1) ──< pdf_dokument_stavke (N)
                                            (FK: dokument_id CASCADE,
                                                 izvor_id, paragraf_id,
                                                 slika_stil_id RESTRICT)
```

---

## 3. Faze izrade

> Projekt je podijeljen u **dvije glavne faze**. Sve administratorske forme dostupne su
> iza logina, s glavnog izbornika (gdje se učitavaju pdfmake i fontovi).

---

## FAZA 1 — Baza podataka: sve tablice i relacije

Cilj: postaviti kompletnu shemu baze s ispravnim relacijama, CHECK ograničenjima i
početnim zapisima. Ništa od UI-a — samo temelj na koji se sve ostalo gradi.

### 1.1 — Kreiranje tablica
Izvršiti SQL iz poglavlja 2 točno ovim redoslijedom (zbog FK ovisnosti):

1. `pdf_fontovi`
2. `pdf_dozvoljeni_izvori`
3. `pdf_paragraf` (FK → `pdf_fontovi`)
4. `pdf_slika_stil`
5. `pdf_template`
6. `pdf_dokument` (FK → `pdf_template`)
7. `pdf_dokument_stavke` (FK → `pdf_dokument`, `pdf_dozvoljeni_izvori`, `pdf_paragraf`, `pdf_slika_stil`)

### 1.2 — Početni podaci
```sql
INSERT INTO pdf_fontovi (naziv, pdfmake_kljuc, tip, podrzana_pisma, aktivan) VALUES
('Roboto',           'Roboto',          'sans',  '["latin"]', 1),
('Liberation Serif', 'LiberationSerif', 'serif', '["latin"]', 1);
```

### 1.3 — Provjera
- Sve tablice postoje s ispravnim kolonama i tipovima.
- FK veze su aktivne (probati INSERT koji krši FK — mora vratiti grešku).
- CHECK ograničenja su aktivna (probati INSERT koji krši CHECK — mora vratiti grešku).
- Početni zapisi `pdf_fontovi` su uneseni.

### 1.4 — Frontend/backend temelj
- Frontend skelet: login → **glavni izbornik**.
- Na glavni izbornik uključiti `pdfmake.min.js` i `vfs_fonts.js`
  (Roboto + Liberation Serif, sve 4 varijante). Registrirati `pdfMake.fonts`.
- Backend skelet: konekcija na bazu, osnovni API.
- **Provjera:** generirati trivijalan "Hello" PDF s oba fonta i hrvatskim znakovima (č,ć,ž,š,đ).

---

## FAZA 2 — Forme za upis (jedna po jedna)

Cilj: CRUD forme za svaku tablicu, redoslijedom ovisnosti — šifarnici prije dokumenata,
dokument i generator na kraju. Svaka forma je zasebna cjelina koja se implementira, testira
i zatvara prije prelaska na sljedeću.

### 2.1 — Forma: Fontovi (`pdf_fontovi`)
- CRUD nad registrom fontova: naziv, pdfmake_kljuc, tip, podrzana_pisma, aktivan, napomena.
- **Funkcionalnost:** administrator vidi popis fontova; dodaje/uređuje. Upozorenje da
  `pdfmake_kljuc` mora odgovarati ključu u `vfs_fonts.js`. Dodavanje stvarne `.ttf` datoteke u
  `vfs_fonts.js` je tehnički korak izvan forme (dokumentirati postupak).

### 2.2 — Forma: Stilovi paragrafa (`pdf_paragraf`)
- CRUD nad stilovima teksta sa svim poljima (font, veličina, bold/italic/podcrtano, boje,
  pozadina + traka + padding, poravnanje, prored, razmaci, uvlake).
- **Okvir (border):** kontrole za debljinu linije po strani u mm (gore/dolje/lijevo/desno;
  0=nema), padding po strani u mm, boju okvira (jedna), boju podloge (NULL=bez ispune), te
  prekidače „do lijeve margine", „do desne margine" i „poštuj uvlaku". Vidi „Logika okvira" u shemi `pdf_paragraf`.
- **Funkcionalnost:** **živi pregled (preview)** stila — pdfmake renderira primjer paragrafa
  dok administrator mijenja vrijednosti. Birač fonta povučen iz `pdf_fontovi` (aktivni).
  Birači boja (hex). Validacija raspona (prored, postoci).

### 2.3 — Forma: Stilovi slika (`pdf_slika_stil`)
- CRUD nad stilovima slika: dimenzije, skaliranje, okvir (+boja/debljina), prozirnost,
  pozicioniranje (u_tijeku/usidreno/apsolutno), poravnanja, apsolutne koordinate, potiskuje.
- **Funkcionalnost:** preview s test-slikom; dinamičko prikazivanje relevantnih polja (npr.
  x/y samo kad je "apsolutno", poravnanja kad je "usidreno"). Provjeriti podršku prozirnosti.

### 2.4 — Forma: Template stranice (`pdf_template`)
- CRUD nad postavkama stranice: papir, orijentacija, margine, zaglavlje (+visina/padding/
  primjena), podnožje (+visina/padding/od_stranice), brojač (+format/zona/poravnanje),
  naslovna stranica.
- Polja `dvostran`/`vezna_margina_mm` prikazati, ali označiti kao "buduće" (neaktivno).
- **Funkcionalnost:** preview prazne stranice s ucrtanim marginama i zonama zaglavlja/podnožja.
  Pomoć za format brojača (`#S`, `#U`).

### 2.5 — Forma: Dozvoljeni izvori (`pdf_dozvoljeni_izvori`)
- CRUD nad whitelistom izvora: naziv, tablica, kolona, tip_podatka, napomena.
- **Funkcionalnost:** administrator definira koje tablice i kolone smiju biti korištene kao
  izvor podataka. Forma prikazuje upozorenje: tablica i kolona moraju stvarno postojati u bazi.
  Opcijski: provjera postojanja tablice/kolone pri unosu.

### 2.6 — Forma: Dokument + stavke (`pdf_dokument` + `pdf_dokument_stavke`)
- Glavna forma: kreiranje dokumenta (naziv, izbor templatea, opis, aktivan) i uređivanje
  njegovih **stavki**.
- Uređivač stavki: dodavanje/uklanjanje/**preslagivanje redoslijeda** (drag-and-drop);
  po stavci: zona, vrsta (tekst/slika), izvor (birač iz `pdf_dozvoljeni_izvori`, statički id
  ili dinamički kontekst_kljuc), te stil (paragraf ili slika-stil ovisno o vrsti).
- **Funkcionalnost:** forma poštuje CHECK pravila (tekst→paragraf, slika→slika_stil;
  statički→id, dinamički→kontekst_kljuc) — sakriva/prikazuje polja prema izboru. Popis
  dostupnih kontekst-ključeva (npr. `loza_id`). Izvor se bira iz padajućeg popisa
  `pdf_dozvoljeni_izvori` — ne slobodni unos.

### 2.7 — Generator PDF-a (jezgra)
- Backend: sastavljanje JSON paketa (tijek iz 1.5) — čitanje dokumenta, templatea, stavki;
  dohvat sadržaja po izvoru (statički/dinamički + kontekst) iz whitelistanih tablica;
  BLOB → base64 data URL za slike; razbijanje teksta po `\n`; mapiranje stilova u pdfmake;
  mm→pt konverzije; raspoređivanje po zonama (tijelo/zaglavlje/podnožje/naslovna); brojač
  stranica prema zoni i poravnanju iz templatea.
- Frontend: primanje JSON-a, `pdfMake.createPdf(...)`, prikaz (preview), spremanje, ispis.
- **Učitavanje fontova — lazy-load (dogovoreno 2026-06-11):** NEMA monolitnog `vfs_fonts.js`.
  Fontovi se učitavaju **na klik PDF ikone**, i to **samo oni koje dokument stvarno koristi**
  (skup iz stilova paragrafa/slika korištenih stavki + `DejaVuSans` ako je aktivno auto-rutanje
  simbola), i **samo ako već nisu u `pdfMake.vfs`**.
  - Tok: izračunaj potrebne porodice → za svaku koja nije u `pdfMake.vfs` dohvati **sve 4
    varijante** `.ttf` (normal/bold/italic/bolditalic; inače pdfmake puca kad dokument zatraži
    varijantu koje nema), `ArrayBuffer → base64`, ubaci u `pdfMake.vfs` + osiguraj `pdfMake.fonts`
    mapiranje (gradi se iz `pdf_fontovi`); zatim `createPdf`.
  - **Dvije razine keša:** (1) u sesiji stranice — `pdfMake.vfs` drži već učitane do reloada;
    (2) između sesija — dohvaća se **statički `.ttf` iz `fontovi/`** s dugim `Cache-Control`/`ETag`,
    pa ga preglednik kešira na disk (base64 konverzija je klijentska). Provjeriti ispravan MIME za `.ttf`.
  - Prva generacija povuče potrebne fontove (par MB) → prikazati **spinner „priprema fontova…"**;
    sljedeći klikovi su instant.
- **Funkcionalnost:** generiranje stvarnog dokumenta s dinamičkim kontekstom (npr. izbor lože
  → logo + ime lože). Provjera hrvatskih znakova, margina, zaglavlja/podnožja, brojača.

### 2.8 — Doterivanje i buduća proširenja (TODO)
- **Prelijevanje teksta u dva povezana okvira** (mjerenje + dijeljenje teksta) — za onaj jedan
  dokument. Aktivirati TODO polja u `pdf_dokument_stavke`.
- **Dvostrani ispis sa zrcalnim marginama** + prazna stranica 2 za naslovnu. Razmotriti
  pdfmake ograničenja vs. prelazak na CSS Paged Media (Paged.js) za taj dio.
- **Višejezičnost:** dodavanje fontova s drugim pismima (ćirilica i sl.) — `.ttf` u `fontovi/`
  + zapis u `pdf_fontovi` (`podrzana_pisma`); lazy-load ih automatski povuče po potrebi
  (vidi „Učitavanje fontova" u 2.7).
- Provjeriti/riješiti **prozirnost slika** ako se pokaže nedostatnom u pdfmake.

#### Migracija formi na dijeljeni kolor picker (`kontrola-boja`) — ZAVRŠENO
Picker je dijeljena kontrola u `0-Kontrole` (`KontroleBojaInit` auto-init na `.kontrola-boja`;
`KontroleBojaRefresh(targetId)`; modal `#bojaModal` se gradi u JS-u). Forme se prebacuju
dodavanjem `.kontrola-boja[data-boja-za][data-boja-nullable]` markupa.

**Sve forme migrirane (svaka ima prozirnost i sprema `#RRGGBBAA`):**
- `PDF_Stilovi_CRUD` — 4 polja (`edit_boja`, `edit_boja_pozadine`, `edit_okvir_boja`, `edit_okvir_boja_podloge`); alpha isključen tokenom (boje za tisak).
- `Clanovi_Zastavice_CRUD` — 1 boja. ✔ (`6614c91`)
- `Zapisnik_Boje_U_Listi_CRUD` — 2 boje (tekst + podloga); izgubljen ručni unos hexa (RO hex). ✔ (`b01f29e`)
- `Radovi_TipUnosaPrisutnih_CRUD` — 1 boja; zadržano bojanje naziva. ✔ (`7e354fc`)
- `Alati_Poruke_Razvoja_Tip` — 2 boje (tekst + podloga). ✔ (`30fb33d`)

**Pristup (A):** DB format `#RRGGBBAA` ostaje netaknut; mijenja se samo UI pickera. Svaka forma
ima konverziju između `kontrola-boja` formata (6-hex opaque / 8-hex prozirno) i `#RRGGBBAA`
(`storageToKb` / `kbToStorage` / `setKbBoja`). DB/PHP/potrošači boje nepromijenjeni. Hex je RO
(ako zatreba kopiranje boje — riješiti drukčije). Migrirane forme NE override-aju
`--kontrola_boja_alpha` (alpha uključen); PDF_Stilovi ga gasi (token 0).

**Dorade pickera (uz migraciju, `a571c4c`):**
- Premještanje modala povlačenjem zaglavlja (`attachModalDrag` / `global.KontroleModalDrag` — radi za bilo koji modal; re-centrira se pri otvaranju).
- Default mod selekta po alpha stanju: alpha aktivan → „Korisnička boja"; disabled → „Paleta boja".
- Paleta: +9 dodatnih boja (`BOJE_EKSTRA`); zadnji red uvijek pun (nullable 8 swatcheva uz „Bez boje" ćeliju, non-nullable 9).

---

## 4. Napomene za implementaciju
- Sve mjere korisnik zadaje u **mm** (osim veličine fonta u **pt** i proreda kao **množitelja**).
  Konverzija mm→pt (×2.83465) radi se u backendu pri sastavljanju pdfmake JSON-a.
- `boja` polja su hex string (`#RRGGBB`).
- CHECK ograničenja rade na **MariaDB 10.4+** i **MySQL 8.0.16+**.
- Backend pristupa bazi isključivo kroz whitelistane izvore (`pdf_dozvoljeni_izvori`);
  tablično ime i ime kolone nikad ne dolaze iz nekontroliranog unosa.
- Font se učitava **jednom** (glavni izbornik), nikad ne putuje iz backenda po dokumentu.
- Slike se prenose kao BLOB + MIME iz baze; backend ih pretvara u base64 data URL za pdfmake.
