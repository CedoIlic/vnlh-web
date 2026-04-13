# Loze_CRUD – plan „Snimi” (validacija, payload, slika, fokus)

Plan za prvu CRUD tipku (Upis / Izmjeni) u Loze_CRUD: validacija prije slanja, pravila za što šalemo u bazu, poruke, fokus nakon greške, priprema slike. **Kod se još ne piše.**

---

## 1. Redoslijed na klik „Snimi”

1. **Validacija** (vidi odlomak 2). Ako neka ne prođe → prikaži poruku, u callbacku zatvaranja modala **fokus na tu kontrolu**, prekini (ne šalji na server).
2. **Payload** – priprema vrijednosti prema pravilima iz odlomka 3; uključiti **id_regija** i **id_drzava** iz header selektâ (id ili null).
3. **Slika** – ako postoji slika u kontroli: priprema **oba** mime sloga i thumb fajla po uzoru na Stupnjevi_CRUD (odlomak 5), zatim slanje.
4. Slanje na `Loze_CRUD_upis.php` ili `Loze_CRUD_izmjena.php`.

---

## 2. Validacija i poruke

- **Naziv lože**  
  - Prazan → poruka **017**.  
  - Tekst poruke: `Naziv lože mora biti upisan. Upišite naziv lože.`  
  - Nakon zatvaranja modala: **fokus na kontrolu naziva** (npr. `edit_naziv`).

- **Telefon**  
  - Ako je polje **ispunjeno**, mora **počinjati sa `+`** (pozivni + broj).  
  - Ako ne počinje sa `+` → poruka **018**.  
  - Tekst poruke: `Upišite ispravan broj telefona, + pozivni broj zemlje + broj telefona.`  
  - Nakon zatvaranja modala: **fokus na kontrolu telefona** (npr. `edit_telefon`).

- **E-mail**  
  - Ako je polje **ispunjeno**, mora biti **ispravna e-mail adresa** (format).  
  - Ako nije ispravna → poruka **019**.  
  - Tekst poruke: `Upišite ispravnu e-mail adresu.`  
  - Nakon zatvaranja modala: **fokus na kontrolu e-maila** (npr. `edit_email`).

Za **bilo koju** kontrolu koja izazove poruku greške: nakon gašenja modala s greškom **fokus na tu kontrolu** (treći argument `showPorukaModal` = callback koji pozove `control.focus()`).

---

## 3. Pravila za što šalemo u bazu (payload / FormData)

**Zaglavlje tablice (header selekti):**

- **id_regija** i **id_drzava** dolaze iz selektâ u zaglavlju tablice (npr. `select_regija`, `select_drzava`). Država mora biti odabrana inače su kontrole onemogućene; isto vrijedi za regiju – to je već riješeno u formi. Omogućavanje tipke Upis već je riješeno u CRUD grupi tipki (kao u Stupnjevi_CRUD: uvjet za enable Upis ovisi o odabranoj regiji i sadržaju). U bazu proslijediti **id** odabrane stavke ili **null** ako nisu selektirani (slučaj koji u praksi ne bi smio nastupiti, ali ga valja obraditi).

| Kontrola           | Nije upisano / nije odabrano | Upisano / odabrano        |
|--------------------|------------------------------|----------------------------|
| **Regija** (header) | u bazu → **null**             | u bazu → **id** selekcije (obavezno za upis) |
| **Država** (header) | u bazu → **null**             | u bazu → **id** selekcije (obavezno za upis) |
| **Obred**          | u bazu → **null**             | u bazu → **id** odabrane stavke |
| **Tip lože**       | u bazu → **null**            | u bazu → **id** odabrane stavke |
| **Telefon**        | u bazu → **""**              | u bazu → sadržaj edita (nakon validacije +…) |
| **E-mail**         | u bazu → **""**              | u bazu → sadržaj edita (nakon validacije formata) |
| **Adresa**         | u bazu → **""**              | u bazu → sadržaj edita |
| **Dodatni red adrese** | u bazu → **""**          | u bazu → sadržaj edita |
| **Grad**           | u bazu → **""**              | u bazu → sadržaj edita |
| **Pošta**          | u bazu → **""**              | u bazu → sadržaj edita |
| **Država adrese**  | u bazu → **null**            | u bazu → **id** selekcije |
| **Datum nastanka lože** | u bazu → **null**       | u bazu → datum iz edita |
| **Napomena**       | u bazu → **""**              | u bazu → sadržaj polja |
| **Aktivnost** (čekbox) | nije čekirano → **0**   | čekirano → **1** |

*(Regija, Država i Naziv su obavezni za upis; naziv se validira porukom 017. id_regija i id_drzava šalju se uvijek – id ili null. Pri implementaciji: u payload/FormData uključiti i id_drzava iz header selecta `select_drzava`, pored postojećeg id_regija.)*

---

## 4. Poruke u 0-Poruke_Tekstovi.js

- **Dodati** tri nove poruke (format kao ostale: `id|origin|tipke|stanje|boja_okvira|tekst_poruke`):
  - **017** – validacija naziva lože (prazan).
  - **018** – validacija telefona (mora počinjati sa +).
  - **019** – validacija e-mail adrese (format).

- **Poredak**: 017, 018, 019 staviti **neposredno nakon 016**, a **prije** poruka 100+ (server/SQL).

Predloženi redakovi (jedan redak = jedna poruka u `MODAL_MESSAGES`):

```text
'017': '017|Korisničko sučelje|(OK)|error||Naziv lože mora biti upisan. Upišite naziv lože.',
'018': '018|Korisničko sučelje|(OK)|error||Upišite ispravan broj telefona, + pozivni broj zemlje + broj telefona.',
'019': '019|Korisničko sučelje|(OK)|error||Upišite ispravnu e-mail adresu.',
```

U datoteci: nakon `'016': '016|...'` uvrstiti 017, 018, 019; zatim ostaviti `'100': ...` itd.

**Dokumentacija u nastavku** (komentar u istom fajlu):  
- 017 – Validacija Loze_CRUD: naziv lože prazan.  
- 018 – Validacija Loze_CRUD: telefon upisan ali ne počinje sa + (pozivni + broj).  
- 019 – Validacija Loze_CRUD: e-mail upisan ali format nije ispravan.

---

## 5. Slika: kad je nema vs. kad je ima

- **Ako slike nema**: u bazu u sva **četiri** pripadajuća polja ide **null**. Imena kolona u tablici `loze`: **slika**, **slika_mime**, **slika_thumbnail**, **slika_thumbnail_mime**.
- **Ako slika postoji**: vidi odlomak 6 (priprema prije snimanja).

---

## 6. Priprema slike prije snimanja (po uzoru na Stupnjevi_CRUD)

Prije slanja na server, ako postoji slika u kontroli (`img._obradaSlikaBlob`):

- **Slika (glavni blob)**  
  - Koristiti `img._obradaSlikaBlob` i `img._obradaSlikaMime`.  
  - Za FormData: filename prema mime-u – npr. ako mime sadrži `png` → `slika.png`, inače `slika.webp`.  
  - Dodati u FormData: `slika` (blob s tim filenameom), `slika_mime` (npr. `img._obradaSlikaMime || 'image/webp'`).

- **Thumb**  
  - Generirati thumb iz glavnog bloba (npr. `createThumbFromBlob(img._obradaSlikaBlob, 64)`).  
  - U FormData dodati i **oba** mime sloga: i za sliku i za thumb – npr. `thumb` (blob), `thumb_mime` (npr. `thumb.mime || 'image/jpeg'`), s filenameom `thumb.jpg`.

Referenca u kodu: **Stupnjevi_CRUD.js** – blok gdje se prije `doSubmit` poziva `createThumbFromBlob`, zatim sastavlja `postPayload` s `slika`, `slika_mime`, `thumb`, `thumb_mime`, i slanje preko `postFormDataWithFiles` s pravilnim filename-om za `slika` (slika.png / slika.webp) i za thumb (thumb.jpg). U Loze_CRUD trenutno se koristi `fetch` + FormData; priprema **oba** mime sloga i thumb fajla treba biti ista kao u Stupnjevi_CRUD (oba mime-a eksplicitno, filename za sliku i thumb).

---

## 7. Sažetak

- **Validacija prva**: naziv (017), zatim telefon ako je upisan (018), zatim e-mail ako je upisan (019).  
- **Payload**: id_regija i id_drzava iz header selektâ (id ili null; u praksi oba obavezna za upis). Null za neodabrane selecte (Obred, Tip lože, Država adrese, Datum), "" za prazna tekstualna polja, 0/1 za aktivnost.  
- **Poruke**: 017, 018, 019 u `0-Poruke_Tekstovi.js` odmah nakon 016, s komentarima u nastavku.  
- **Fokus**: nakon zatvaranja modala s greškom → fokus na kontrolu koja je izazvala grešku (callback `showPorukaModal(..., function() { control.focus(); })`).  
- **Slika**: ako nema slike – u bazu u sva četiri pripadajuća polja **null**; ako ima – prije snimanja pripremiti oba mime sloga i thumb fajl kao u Stupnjevi_CRUD.

Kod se prema ovom planu implementira kad korisnik potvrdi (npr. naredbom „kreni”).

---

## Provjera PHP prema tablici `loze`

| Kolona | Tip u bazi | PHP upis/izmjena | Napomena |
|--------|------------|-------------------|----------|
| id | int PK auto_increment | — (upis) / POST id (izmjena) | ✓ |
| id_regija | int NOT NULL | POST id_regija, 105 ako ≤ 0 | ✓ |
| id_obred | int NULL | POST id_obred → int ili null | ✓ |
| id_tip_loze | int UNSIGNED NULL | POST id_tip_loze → int ili null | ✓ |
| id_drzava | int NULL | POST id_drzava → int ili null | Iz header selecta (select_drzava); obavezan za upis; ako nije poslan, PHP postavlja null. ✓ |
| id_drzava_adrese | int UNSIGNED NULL | POST id_drzava_adrese → int ili null | ✓ |
| naziv | varchar(50) NULL | trim, 105 ako '' | ✓ |
| adresa_loze_1, adresa_loze_2 | varchar(50) NOT NULL DEFAULT '' | trim, default '' | ✓ |
| grad, posta | varchar NOT NULL | trim, default '' | ✓ |
| telefon_loze, meil_loze | varchar NOT NULL | trim, default '' | ✓ |
| datum_nastanka | date NULL | POST; prazan → null | ✓ |
| napomena | varchar(1024) NOT NULL DEFAULT '' | trim, default '' | ✓ |
| aktivnost | tinyint(1) NOT NULL DEFAULT 1 | POST, default 1 | ✓ |
| slika, slika_mime, slika_thumbnail, slika_thumbnail_mime | NULL | Ako nema FILES slika/thumb → sva četiri null | ✓ |
