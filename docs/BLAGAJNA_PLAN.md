# Blagajna lože (1.f) — plan

Radni dokument za dogovor. Kod se ne piše dok model nije potvrđen.
Nastalo 2026-07-28 iz razgovora; nadopunjuje se kako stvari dozrijevaju.

## 1. Opseg i kontekst

- Blagajna je **uvijek vezana za jednu ložu**. Korisnik sa širim pravom (npr. nadzor nad više loža)
  prebacuje se **s lože na ložu** — nikad konsolidirani prikaz više loža odjednom.
  Izbor lože ide kroz **geo grupu** (država → regija → loža), kao u `Clanovi_MOK_CRUD`,
  uz postojeća ograničenja tip 1–3.
- Razina obedijencije je **unutar države**: cjenik obedijencije vrijedi za sve lože te države,
  a obveza prema obedijenciji je stavka u blagajni pojedine lože.
- Kasnije će postojati i **blagajna obedijencije** — zato prefiks `loze_` u nazivima
  (tablice `loze_blagajna_*`, datoteke `Loze_Blagajna_*`).
- Valuta: **EUR**, bez kolone valute (ako zatreba druga država s drugom valutom → naknadna migracija).
- Upisuje onaj tko ima pravo na formu (Časni majstor ili blagajnik) — kroz standardna
  ograničenja tip 4 (upis/izmjena) i tip 5 (brisanje).

## 2. Što se prati

Dvije odvojene stvari, obje iz iste knjige:

| | Značenje | Primjer |
|---|---|---|
| **Saldo (potraživanje/obveza)** | tko kome duguje | član duguje loži 3 mjesečne članarine |
| **Stanje blagajne** | koliko novca loža ima | uplate − isplate |

Zaduženje ne dira stanje blagajne (novac još nije stigao); uplata dira oboje.

- Po **članu**: zaduženja, uplate, saldo.
- Po **loži**: isto za ložu (npr. obveza prema obedijenciji), plus **sveukupno** i **stanje blagajne**.

## 3. Tablice

### 3.1 Šifarnici

**`loze_blagajna_tip_prihoda`** — id, naziv, redosljed
**`loze_blagajna_tip_troska`** — id, naziv, redosljed

Uzor je `kandidat_dokumenti_sken_tip` — **bez** `aktivnost` i `opis` (odluka 2026-07-28).
Tipovi su zajednički za sve lože (jedan šifarnik, ne po loži).
Brisanje tipa u upotrebi = blokirano (FK `ON DELETE RESTRICT`, poruka 106) — isto kao „Tip skena".

### 3.2 Cjenici — dvije odvojene tablice

**`loze_blagajna_cjenik_loze`** — cjenik LOŽE; loža ga sama uređuje.

- `id_loza` — kojoj loži cjenik pripada
- `id_tip_prihoda` — na što se cijena odnosi (članarina, upisnina…)
- `iznos` — decimal(10,2)

Cjenik lože je **po loži** — svaka loža smije imati svoje iznose (članarina se od lože do lože razlikuje).
Jedan redak po tipu prihoda: **samo trenutni iznos, bez razdoblja valjanosti** (odluka 2026-07-28).
Povijest cijena čuva **knjiga** — svako zaduženje pamti iznos po kojem je nastalo, pa izmjena cjenika
ne dira već proknjižene stavke.

**`CSI_blagajna_cjenik`** — cjenik OBEDIJENCIJE (CSI): **jedinstven**, jedan skup cijena za sve lože,
**bez podjele po državi** (odluka 2026-07-28). Loži je **samo za čitanje** (vidi ga, ne uređuje).

- `id_tip_prihoda`
- `iznos` — decimal(10,2)

Bez `id_loza` i bez `id_drzava`. Forma: **`CSI_Blagajna_Cjenik_CRUD`**.

**Dvije tablice = dvije forme za unos**: cjenik lože uređuje loža, cjenik CSI uređuje razina
obedijencije (a loža ga samo čita).

### 3.2.1 Pozicije u meniju

Tri grupe u meniju (sve već postoje):

- **139 „Blagajna Lože"** — Sustav → Uvijeti (82), redoslijed 40 → **šifarnici**
- **140 „Blagajna lože"** — Administracija (89) → **cjenik lože + blagajna**
- **141 „Blagajna CSI"** — Administracija (89), redoslijed 35 → **cjenik CSI**

| Forma | Meni grupa |
|---|---|
| `Loze_Blagajna_Tip_Prihoda_CRUD` | 139 — Sustav → Uvijeti → Blagajna Lože |
| `Loze_Blagajna_Tip_Troska_CRUD` | 139 — Sustav → Uvijeti → Blagajna Lože |
| `Loze_Blagajna_Cjenik_Loze_CRUD` | 140 — Administracija → Blagajna lože |
| `Loze_Blagajna_CRUD` | 140 — Administracija → Blagajna lože |
| `CSI_Blagajna_Cjenik_CRUD` | 141 — Administracija → Blagajna CSI |

Grupa **140** stoji **odmah iza „Kandidati"** → redoslijed **15** (sad 20, treba UPDATE).
Opis grupe 141 u bazi pogrešno kaže „Sustav ⟶ Uvjeti" — stvarni roditelj je Administracija.

Razdoblje valjanosti postoji da promjena cijene **ne mijenja već proknjižena zaduženja**.

### 3.3 Glavna knjiga — `loze_blagajna_glavna_knjiga`

Jedan redak = jedan događaj. Uvijek nosi `id_loza`.

- `id_loza` — obavezno (blagajna kojoj redak pripada)
- `id_clan` — popunjen → stavka **člana**; `NULL` → stavka **lože**
- `vrsta` — vidi tablicu učinaka dolje
- `id_tip_prihoda` / `id_tip_troska` — ovisno o vrsti, jedan od dva (drugi NULL)
- `iznos` — decimal(10,2), uvijek **pozitivan**; predznak određuje vrsta
- `datum` — datum događaja (knjiženja)
- `razdoblje_od`, `razdoblje_do` — na koje se razdoblje zaduženje odnosi (mjesec, kvartal); NULL za jednokratno
- `poziv_na_broj` — neobavezan (varchar), za povezivanje s izvodom/uplatnicom
- `opis` — slobodan tekst
- `automatski` — 1 = nastalo batchom, 0 = ručni unos (za kasnije: ne diraj tuđe, prepoznaj generirano)
- `upisao`, `datum_upisa`, `datum_zadnje_izmjene` — trag unosa

### Vrste stavaka i njihovi učinci

| Vrsta | Naziv | Saldo | Stanje blagajne |
|---|---|---|---|
| 1 | Zaduženje člana | član duguje **+** | — |
| 2 | Uplata člana | član duguje **−** | **+** |
| 3 | Prihod lože (nije od člana) | — | **+** |
| 4 | Trošak lože (isplata) | — | **−** |
| 5 | Zaduženje lože prema obedijenciji | loža duguje **+** | — |
| 6 | Plaćanje obedijenciji | loža duguje **−** | **−** |

Saldo i stanje su **izračun iz knjige**, ne pohranjene vrijednosti — nema rizika da se raziđu.

### 3.4 Početno stanje

Bez zasebne tablice: stavka vrste 1 (član) odnosno 5 (loža), s datumom otvaranja i tipom
„Početno stanje" iz šifarnika. Zatečeno stanje novca u blagajni = stavka vrste 3 s istim tipom.

## 4. Zaduženja

- **Članovi — mjesečno.** Batch „Generiraj zaduženja za mjesec": po cjeniku LOŽE stvori stavku
  svakom aktivnom članu; preskače one koji za to razdoblje već imaju stavku (idempotentno).
  Pojedinačna stavka se može ručno dodati, izmijeniti ili stornirati (oslobođenje, privremeni otpust).
- **Loža prema obedijenciji — kvartalno.** Loža dobije zaduženje (vrsta 5).
  **Faza 1: knjiži se ručno.** Kasnije automatika po cjeniku obedijencije.

Otvoreno za kasnije: što s članom na privremenom otpustu (vidi `clanovi_privremeni_otpust`) —
preskočiti ga u batchu ili zadužiti pa ručno stornirati.

## 5. Forme (faze)

| Faza | Forma / posao | Sadržaj |
|---|---|---|
| I ✅ kod | `Loze_Blagajna_Tip_Prihoda_CRUD`, `Loze_Blagajna_Tip_Troska_CRUD` | dva šifarnika (uzor: „Tip skena kandidata"); 2026-07-28 — čeka `sql/Loze_Blagajna_Faza_I_sifarnici.sql` i test |
| II | `Loze_Blagajna_Cjenik_CRUD` | cjenik lože (uređuje) + cjenik obedijencije (RO prikaz) |
| III | `Loze_Blagajna_CRUD` | glavna knjiga: geo izbor lože → članovi sa saldom → stavke odabranog člana; stavke lože; stanje blagajne |
| IV | batch | automatsko mjesečno zaduženje članova |
| V | PDF | izvještaji preko postojećeg generatora |

## 6. PDF izvještaji (skica, razrada kasnije)

- Kartica člana (zaduženja, uplate, saldo za razdoblje)
- Popis dugovanja po loži (tko i koliko duguje)
- Promet i stanje blagajne za razdoblje
- Godišnji obračun

## 7. Odlučeno (2026-07-28)

- **Storno** — knjiži se kao **negativna protustavka**, ne briše se redak. Knjiga ostaje revizijski trag;
  `iznos` zato smije biti i negativan (ograničenje „uvijek pozitivan" iz §3.3 ne vrijedi za storno).
- **Blagajna je zatvorena za članstvo** — član ne vidi svoje stanje kroz aplikaciju; vide ga samo
  nositelji prava na formu (Časni majstor / blagajnik).
- **Poziv na broj** — postoji, ali **nije obavezan**.
- **Djelomične uplate** — dozvoljene. Uplata zatvara zaduženja **redom od najstarijeg prema najnovijem**;
  posljednje zatvoreno zaduženje ostaje djelomično podmireno ako iznos ne pokriva cijelo.
  Namira se **računa iz knjige (FIFO)**, ne pohranjuje se veza uplata→zaduženje — tako se stanje
  ne može razići s knjigom, a storno automatski ulazi u izračun.

## 8. Otvoreno

- Potvrda naziva tablice/forme cjenika obedijencije (prijedlog u §3.2).
- Član na privremenom otpustu u batchu mjesečnih zaduženja — preskočiti ili zadužiti pa stornirati.
