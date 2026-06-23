# Plan internacionalizacije (i18n) — VNLH WEB

Status: **prijedlog/plan** (kod se ne piše dok se ne dogovori faza). Ovaj dokument je izvor istine za i18n;
memorija (`project_i18n_plan.md`) drži samo sažetak/pokazivač.

---

## 1. Cilj i principi

- **Prebacivač jezika** (zaglavlje) već postoji kao simulacija. Cilj: stvarni prijevod cijelog sučelja, DB-vođeno.
- **Nijedan tekst u kodu** — svi vidljivi stringovi idu kroz ključ → prijevod iz baze.
- **Autonimi** za izbor jezika (već: `sustav_jezici.naziv_izvorni`).
- **Fallback lanac:** traženi jezik → zadani jezik (`sustav_jezici.zadani`) → izvorni tekst ključa → sam ključ.
- **Dijeljene kontrole** (CRUD tipke i sl.) imaju **jedan** ključ (`global.*`) i prevode se jednom.
- **utf8mb4** posvuda (već je) — bilo koje pismo.
- **OPSEG:** prevodi se **SUČELJE i poruke** po korisnikovom jeziku (`izvor='Forma'`+`'Poruka'`). Korisnik (npr. Talijan) radi u svom jeziku i **unosi podatke na svom jeziku — spremaju se kako su uneseni** (jedna verzija, utf8mb4), bez prijevoda i bez verzioniranja po jeziku. To sustav **već omogućava** (prevedeno sučelje + tekstualna polja). Posljedica: podatak je u jeziku u kojem je unesen i takav se prikazuje svima (nema auto-prijevoda **sadržaja**). NE radi se: prijevod korisničkih podataka ni N jezičnih verzija istog sloga. DB-vođeni nazivi (`izvor='Baza'`) i množina su **odgođeni / izvan opsega za sada**.

---

## 2. Model baze

Postojeće (gotovo): `sustav_jezici` (kod, naziv, naziv_izvorni, drzava_kod, zadani, aktivan, redoslijed),
`sustav_drzave` (kod, naziv, slika_naziv, aktivan), zastave preko `sustav_slike_tekstovi`.

### 2.1. `sustav_prijevodi_kljucevi` — registar ključeva (NOVA)
```
id            int unsigned PK AI        COMMENT 'Interni id ključa.'
kljuc         varchar(150) NOT NULL     COMMENT 'Hijerarhijski ključ <modul>.<sekcija>.<element> (npr. jezici_crud.tablica.jezik, global.gumb.upis). Jedinstven, stabilan — ne mijenjati nakon prijevoda.'
izvor         enum('Forma','Baza','Poruka') NOT NULL DEFAULT 'Forma' COMMENT 'Odakle string dolazi: Forma = UI tekst forme; Baza = DB-vođeni sadržaj (nazivi iz tablica); Poruka = modal poruka (0-Poruke).'
ime_forme     varchar(80)  DEFAULT NULL COMMENT 'Naziv forme za prikaz adminu pri reviziji (npr. "Države"). Za dijeljene UI ključeve "Globalno"; NULL za Baza/Poruka.'
naziv_fajla   varchar(120) DEFAULT NULL COMMENT 'HTML datoteka forme (npr. "Drzave_CRUD.html"). Za grupiranje i detekciju zastarjelih ključeva po formi. NULL za global/Baza/Poruka.'
tip           enum('naslov','labela','placeholder','gumb','zaglavlje_tablice','opcija','modal','popup','poruka','ostalo') NOT NULL DEFAULT 'ostalo' COMMENT 'Vrsta kontrole/teksta. Proširivo (dodavanje vrijednosti = mali ALTER na Heidi).'
kontrola      varchar(100) DEFAULT NULL COMMENT 'Ime/identifikator kontrole u kodu: id elementa (npr. "edit_jezik"), gumb ("btnUpisi"), ključ stupca tablice ("naziv") ili data-i18n cilj. Veže ključ na točnu kontrolu — za ekstraktor i precizno lociranje pri reviziji.'
izvorni_tekst varchar(1000) NOT NULL    COMMENT 'Izvorni (hrvatski) tekst; prikazuje se za zadani jezik i osnova je za AI prijevod.'
izvorni_hash  char(32)      DEFAULT NULL COMMENT 'MD5 izvornog teksta. Rutina za skeniranje forme usporedi tekst kontrole u kodu s ovim; ako se razlikuje → tekst je izmijenjen, osvježi izvorni_tekst/hash i označi prijevode zastarjelo=1.'
napomena      varchar(500)  DEFAULT NULL COMMENT 'Kontekst za prevoditelja/AI (npr. "gumb, max ~12 znakova", "naslov stupca").'
zadnji_skan   datetime      DEFAULT NULL COMMENT 'Vrijeme zadnjeg skeniranja koda u kojem je ključ pronađen. Stari datum = kandidat za uklanjanje (kontrola više ne postoji).'
aktivan       tinyint(1)    NOT NULL DEFAULT 1 COMMENT '0 = označen za uklanjanje (kontrola nestala), zadržan dok se brisanje ne potvrdi.'
PRIMARY KEY (id), UNIQUE KEY uq (kljuc), KEY ix_naziv_fajla (naziv_fajla), KEY ix_izvor (izvor)
```
> `izvor`/`ime_forme`/`naziv_fajla`/`tip` služe adminu kao kontekst i filtri u formi za uređivanje prijevoda (§5a). `tip` je enum (proširiv); ako se očekuje često dodavanje, alternativa je šifrarnik `sustav_prijevodi_tipovi`. NB: ova `izvor` kolona (Forma/Baza/Poruka) ≠ `sustav_prijevodi.izvor` (rucno/ai) — različite tablice.

### 2.2. `sustav_prijevodi` — prijevodi (NOVA)
```
id        int unsigned PK AI    COMMENT 'Interni id.'
id_kljuc  int unsigned NOT NULL COMMENT 'FK na sustav_prijevodi_kljucevi.'
id_jezik  int unsigned NOT NULL COMMENT 'FK na sustav_jezici.'
tekst     varchar(1000) NOT NULL COMMENT 'Prijevod ključa na taj jezik.'
izvor     enum('rucno','ai') NOT NULL DEFAULT 'rucno' COMMENT 'rucno = ljudski; ai = strojni (treba reviziju). Zadani jezik se NE sprema ovdje — uzima se izvorni_tekst ključa.'
provjeren tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = ljudski potvrđen (osobito za AI prijevode).'
zastarjelo tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = izvorni (hr) tekst se promijenio NAKON ovog prijevoda → treba ponovno prevesti/potvrditi. Postavlja rutina za skeniranje forme (usporedba s izvorni_hash). Filtar u admin formi.'
PRIMARY KEY (id), UNIQUE KEY uq (id_kljuc, id_jezik),
CONSTRAINT fk_pr_kljuc FK (id_kljuc) -> sustav_prijevodi_kljucevi(id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT fk_pr_jezik FK (id_jezik) -> sustav_jezici(id) ON DELETE CASCADE ON UPDATE CASCADE
```
> Zadani jezik (hr) = `izvorni_tekst` iz ključa (bez retka ovdje), da se ne duplira. Prijevodi su za ostale jezike.

### 2.3. Dostupni jezici po formi (ODLUKA: konstanta po formi)
- Svaka forma u JS configu ima **konstantu `JEZICI_FORME = ['hr','it',…]`** — jezici za koje je **prijevod te forme gotov i objavljen**.
- **Prebacivač** (popup u zaglavlju) na toj formi nudi **samo te jezike**; jezik se pojavi tek kad je prijevod forme dovršen (do tada se ne vidi u popupu).
- Globalni `0-Jezik.js` čita konstantu trenutne forme (npr. `window.__VNLH_FORM_JEZICI__`); ako forma nema konstantu → samo zadani jezik (hr).
- Konstanta se postavlja kad se prijevod forme završi (ručno ili je alat održava).

---

## 3. Konvencija imenovanja ključeva

Format: **`<modul>.<sekcija>.<element>`** (mala slova, točka kao razdjelnik, `_` unutar segmenta).

- `modul`: ime forme malim slovima (`jezici_crud`, `clanovi_crud`) ili **`global`** za dijeljeno.
- `sekcija`: `naslov`, `labela`, `gumb`, `tablica` (zaglavlja), `placeholder`, `poruka`, `opcija`, `tab`.
- `element`: konkretno (`upis`, `izbrisi`, `jezik`, `izvorni_naziv`).

Primjeri:
- `global.gumb.upis`, `global.gumb.izmjeni`, `global.gumb.izbrisi`, `global.gumb.povratak` — CRUD tipke (jedan prijevod, svuda).
- `jezici_crud.naslov` = „Jezici"
- `jezici_crud.tablica.rb`, `jezici_crud.tablica.jezik`, `jezici_crud.tablica.zastava`
- `jezici_crud.labela.izvorni_naziv`, `jezici_crud.placeholder.jezik`
- `global.poruka.001` … (poruke iz 0-Poruke_Tekstovi.js — kodovi → ključevi)

Pravila: ključ je **stabilan** (ne mijenja se s tekstom); jedan tekst koji se ponavlja u više formi → razmotriti `global.*`.

---

## 4. Posebni slučajevi

- **Zaglavlja tablica:** titlovi stupaca su u JS-u (`Tablica_Zaglavlje[].title`). Prevode se preko `<modul>.tablica.<key>`; render čita prijevod umjesto literala.
- **Jedinstvene kontrole (CRUD tipke, „Povratak", standardne poruke):** `global.*` — jedan prijevod za sve forme.
- **Poruke** (`MODAL_MESSAGES` u 0-Poruke_Tekstovi.js): kodovi 001–200 → `global.poruka.<kod>`; tekst iz baze.
- **DB-vođeni sadržaj** (nazivi iz `meni`, dužnosti…): **IZVAN OPSEGA za sada** (§1 — prevodi se sučelje, ne podaci). Ako kasnije zatreba: zaseban sloj (`izvor='Baza'`, sintetički ključ ili model `(tablica,id,kolona)`).
- **Dinamički tekst s vrijednostima:** ključ s placeholderima `{n}` (npr. „Dozvoljen raspon od {1} do {2}."). Alat provjerava da prijevod sadrži **iste placeholdere** kao izvor.
- **Množina (hrvatski 3 oblika): ODGOĐENO za kraj** (Faza 4+). Zasad zaseban ključ po obliku ili ICU-stil ako zatreba — dokumentirati ograničenje.

---

## 5. Runtime (kako se prevodi prikazuje)

- **Rječnik (PO FORMI):** server pri emitu forme injektira `window.__I18N__ = { kljuc: tekst, … }` za jezik korisnika — **samo `global.*` + ključeve te forme** (filtrirano po `naziv_fajla`), ne cijela aplikacija. Upit je per-forma (formu korisnik upravo učitava). Fallback ugrađen. Kasnije po potrebi **kompajlirani cache po (jezik, forma)** koji se regenerira pri uređivanju prijevoda — bez živog upita svaki load.
- **JS helper:** `t('kljuc', {1:'x'})` čita iz `__I18N__`; fallback → ključ.
- **PHP helper:** `t('kljuc')` za PHP-renderiran tekst (čita isti rječnik iz baze, in-request cache).
- **HTML:** atribut `data-i18n="kljuc"` na elementima; swapper (dio `0-Jezik.js`) prošeta `[data-i18n]` i zamijeni tekst; `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria` za atribute. **Mora se ponovo pokrenuti nad dinamički ubačenim DOM-om** (modali, popup, AJAX-fragmenti `0-Poruke`/`0-Chat`) — poziv nakon inserta ili MutationObserver. **JS-generirani tekstovi** idu kroz `t()`, ne `data-i18n`.
- **Prebacivač:** odabir jezika → spremi na korisnika (`sustav_korisnici_login.id_jezik`, NOVA kolona) + ponovo učitaj rječnik (ili reload). Tek tada prestaje „simulacija".

---

## 5a. Admin forma: uređivanje prijevoda

In-app CRUD forma (Alati) za **ručno ugađanje prijevoda** kad AI/strojni prijevod nije dovoljno dobar. Radni naziv `Prijevodi_CRUD` (ime po formi, vidi pravilo imenovanja).

- **Lista:** filtri **modul**, **jezik**, **status** (svi / nedostaje / AI-neprovjereno / provjereno) + tražilica. Stupci: `kljuc`, `modul`, `izvorni_tekst` (hr), **prijevod** (za odabrani jezik), `izvor` (rucno/ai), `provjeren`.
- **Uređivanje:** izmijeni `tekst` prijevoda; spremanje ručne izmjene postavlja `izvor='rucno'` i `provjeren=1` (admin potvrdio). Opcijski uređivanje `napomena`/`izvorni_tekst` ključa.
- **Tok:** AI napuni → admin u ovoj formi pregleda neprovjereno (`provjeren=0`), ugodi tekst, potvrdi. Izvor istine je `sustav_prijevodi`; promjena je odmah vidljiva nakon ponovnog učitavanja rječnika.
- Komplementarno s `I18nDetektorNedostajucih` (§6): detektor nađe rupe/neprovjereno → forma ih popuni/potvrdi.

## 6. Alat `js/0-Internacionalizacija.js` — klase

Skup klasa za poluautomatizaciju. Dio treba prateće PHP endpointe (čitanje fajlova, DB, AI). Predlažu se kao **razvojni alat** (ne učitava se u produkciji).

1. **`I18nEkstraktor`** — ulaz: ime forme. Pronađe pripadne `html/<F>.html`, `js/<F>*.js`, `php/<F>*.php`; izvuče kandidate za prijevod:
   - HTML: tekstualni čvorovi, `placeholder`, `title`, `aria-label`.
   - JS: `Tablica_Zaglavlje[].title`, labele gumba, korisnički stringovi (heuristika + bijela lista).
   - PHP: `echo`/stringovi koji idu korisniku (uz reviziju — ne API kodovi).
   - Izlaz: `[{kljuc_prijedlog, izvorni_tekst, izvor_fajl, vrsta}]` za pregled.
2. **`I18nSinkBaze`** — ulaz: rezultat ekstraktora. Usporedi s `sustav_prijevodi_kljucevi`:
   - novi ključevi → **SQL za dodavanje**;
   - ključevi u bazi kojih nema u skeniranju (po `naziv_fajla`) → označi `aktivan=0` / **SQL za uklanjanje** (kontrola nestala);
   - **izmijenjen izvorni tekst** (hash u kodu ≠ `izvorni_hash`) → osvježi `izvorni_tekst`/`izvorni_hash` i **označi sve prijevode tog ključa `zastarjelo=1`**;
   - osvježi `zadnji_skan`.
3. **`I18nDetektorNedostajucih`** — prođe bazu; po jeziku nađe ključeve bez prijevoda (ili `provjeren=0`). Izvještaj + **SQL za popunjavanje** rupa.
4. **`I18nAIPrevoditelj`** — za nedostajuće: generira prijevod (AI endpoint) iz `izvorni_tekst` + `napomena`; sprema `izvor='ai', provjeren=0` (za ljudsku reviziju). Inicijalno punjenje novog jezika.

> Napomena: potpuna automatska ekstrakcija je nepouzdana — alat radi **kandidate za reviziju**, ne slijepu zamjenu. Svaka klasa ima i „dry-run/izvještaj" i „generiraj SQL" način (SQL se pokreće ručno na Heidi).

---

## 7. Plan rada (faze)

- **Faza 0 — Temelj:** tablice `sustav_prijevodi_kljucevi` + `sustav_prijevodi`; kolona `sustav_korisnici_login.id_jezik`; `t()` (PHP+JS); injekt rječnika; `data-i18n` swapper; prebacivač spojen na pravo spremanje. (Bez prevođenja formi još.)
- **Faza 1 — Globalni ključevi:** `global.*` (CRUD tipke, „Povratak", zajedničke labele, poruke 0-Poruke). Dokaz na 1 formi end-to-end.
- **Faza 2 — Alat + admin forma:** `0-Internacionalizacija.js` (ekstraktor → sink → detektor → AI) + prateći PHP endpointi; **admin forma za uređivanje prijevoda** (§5a, `Prijevodi_CRUD`).
- **Faza 3 — Prevođenje formi:** redom jednostavne → složene (vidi §8), forma po forma; alat vadi ključeve, AI puni, čovjek revidira.
- **Faza 4 — Kvaliteta i čišćenje:** detektor nedostajućih, revizija AI prijevoda, uklanjanje zastarjelih ključeva, dostupni jezici po formi.

---

## 8. Popis formi po složenosti (red prevođenja)

**A) Jednostavne (1–2 kontrole, šifrarnik CRUD) — prvo:**
Obredi_CRUD, Stupnjevi_CRUD, Drzave_CRUD, Drzave_Adrese_CRUD, Regije_CRUD, Adrese_Tip_CRUD, Email_Tip_CRUD, Telefoni_Tip_CRUD, Clanovi_Porijeklo_CRUD, Meni_Tip_CRUD, Napredovanja_Tip_CRUD, Loze_Tip_CRUD, Radovi_Tip_CRUD, Radovi_Drzave_Gostiju_CRUD, Radovi_TipUnosaPrisutnih_CRUD, Zapisnik_Boje_U_Listi_CRUD, Alati_Poruke_Razvoja_Tip.

**B) Srednje (više polja/tabova/modala):**
Jezici_CRUD, Meni_CRUD, Clanovi_Zastavice_CRUD, Napredovanja_CRUD, Alati_Varijable_Sustava_CRUD, Alati_LogPass_Ini_CRUD, Alati_Sustav_Slike_Tekstovi_CRUD, Alati_teme, Alati_Meni_Test, Alati_Aktivne_Sesije, Lista, Alati_Poruke_Razvoja_Odgovori, PDF_Fontovi_CRUD, PDF_Whitelist_CRUD, PDF_Stilovi_Slike_CRUD, PDF_Template_CRUD.

**C) Složene (mnogo polja, tabovi, dinamika):**
Clanovi_CRUD, Clanovi_Loza_CRUD, Loze_CRUD, Loze_Tip_CRUD, Duznosnici_CRUD, Duznosnici_Prava_CRUD, Duznosnici_Ogranicenja_CRUD, Duznosnici_Osobe_CRUD, Transfer_Excel_CRUD, PDF_Stilovi_CRUD, PDF_Dozvoljeni_izvori_dokumenata_CRUD, Esej_CRUD.

**D) Najsloženije / posebne (zadnje):**
Zapisnik_CRUD, PDF_Dokument_CRUD, Meni (glavni izbornik), Login, 0-Poruke, 0-Chat, 0-Obrada_Slike.

---

## 9. Odluke (POTVRĐENO)

1. **Dostupni jezici po formi: konstanta po formi** (`JEZICI_FORME`) — jezik se pojavi u prebacivaču te forme **tek kad je njezin prijevod gotov i objavljen** (do tada se ne vidi). Vidi §2.3.
2. **AI prijevod: Claude `claude-opus-4-8` (Opus 4.8)** — vrhunska kvaliteta, uz ljudsku reviziju (`izvor='ai', provjeren=0`). Preko službenog `anthropic-ai/sdk` (composer), Batch API + prompt caching + structured output. Razvojni alat (ne u produkciji); `ANTHROPIC_API_KEY` izvan repo-a. Procjena cijele app × svi jezici: **~$3–6 jednokratno** (s Batchom bliže $3). **Provodi se tek u Fazi 2/3 — „kad dođe vrijeme".**
3. **Jezik korisnika: kolona `sustav_korisnici_login.id_jezik`** (FK → sustav_jezici).
4. **Rječnik: server-injekt `window.__I18N__`** (uz `t()` PHP/JS i `data-i18n` swapper) — **po formi** (global + ključevi te forme), upit per-forma; opcijski kompajlirani cache.
5. **Detekcija izmjene izvornog teksta:** `izvorni_hash` na ključu + `zastarjelo` na prijevodu; rutina za skeniranje forme uspoređuje i na promjenu označi prijevode `zastarjelo=1` (pa ih admin/AI osvježi).
6. **Dinamički DOM** (modali/popup/fragmenti): swapper se ponovo pokreće nad ubačenim sadržajem; JS-tekst kroz `t()`.
7. **OPSEG:** prevodi se **sučelje** (hr/it/fr verzije), ne korisnički podaci; **DB-vođeni nazivi i množina = odgođeno** (§1, §4).
