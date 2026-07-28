# Migracija razvoj → produkcija — plan

Radni dokument. Zapisano 2026-07-28 iz razgovora; gradi se dalje.
Cilj: ponovljiv, provjerljiv postupak prijenosa razvoja na digital.hr — bez ručnog prisjećanja što je sve trebalo.

Okolina: razvoj = XAMPP (Windows, baza `vnlh`); produkcija = digital.hr (Linux, cPanel, MariaDB 10.6, baza `digital_vnlh`).
SSH ključ i WSL već postavljeni (vidi `CLAUDE.md`).

## 1. Šest situacija koje migracija mora pokriti

| # | Situacija | Stanje alata |
|---|---|---|
| 1 | Datoteke: novi, izmijenjeni i **obrisani** css/html/js/php | `rsync` — treba napisati skripte |
| 2 | Usklađivanje **sheme** baze | ✅ riješeno — Skeema (`Baza-Test-Razlika.sh` → `Baza-Uskladi_sa_razvojem.sh`) |
| 3 | **Inicijalno punjenje novih tablica** (PDF stilovi, dokumenti, šifarnici…) | nema — treba |
| 4 | **Dopisivanje novih redaka u postojeće tablice** (npr. ikone poruka u `sustav_slike_tekstovi`) | nema — treba |
| 5 | Podjela migracije u **grupe** (PDF, Zapisnik, Eseji, Blagajna…) | nema — treba |
| 6 | Novi i izmijenjeni retci u **`meni`** | nema — treba (poseban slučaj 4) |

Situacije 3, 4 i 6 su isti problem: **migracija PODATAKA**, koju Skeema namjerno ne radi.
Dosadašnja zamjena za to je ručni popis u `docs/PRODUKCIJA_TODO.md` (ikone modala, logo) — on bi trebao
postati dio ovog sustava umjesto zasebnog popisa.

## 2. Ključno pravilo: nikad po `id`

`AUTO_INCREMENT` id-evi se razlikuju između razvoja i produkcije. Primjer: `meni` 142/143 (Blagajna, 2026-07-28)
na produkciji će dobiti druge brojeve, a na `meni.id` vežu se `duznosnici_prava.pravo` i
`duznosnici_ogranicenja.id_tip_obred_funkcionalnost`. Kopiranje po `id`-u lomi reference.

Zato svaka podatkovna migracija ide po **prirodnom ključu**, uz **idempotentne** skripte
(`INSERT … ON DUPLICATE KEY UPDATE` ili `WHERE NOT EXISTS`) — smiju se pokrenuti dvaput bez štete.

Prirodni ključevi (popuniti kako se dodaju grupe):

| Tablica | Prirodni ključ | Napomena |
|---|---|---|
| `meni` | `html_fajl` (ili `ref`) | id se NE prenosi; djeca se vežu preko njega |
| `duznosnici_prava` | `duznost` + `pravo`→`meni.html_fajl` | preslikati kroz meni |
| `duznosnici_ogranicenja` (tip 4/5) | `id_duznosnik` + tip + `meni.html_fajl` | isto |
| `sustav_slike_tekstovi` | `naziv` | rezervirani nazivi (npr. „Modal ikona OK") |
| `sustav_varijable` | `id` | **iznimka** — id je fiksan, kod se poziva na njega |
| šifarnici (tipovi, stilovi…) | `naziv` | |

## 3. Redoslijed koraka (isti za svaku grupu)

1. Datoteke (`rsync` dry-run → pregled → slanje)
2. Shema (Skeema razlika → push)
3. Seed novih tablica
4. Dopis podataka u postojeće tablice (uklj. `meni` + prava)
5. Serverske/konfiguracijske stvari (`docs/PRODUKCIJA_TODO.md`)
6. Verifikacija (otvoriti forme grupe, provjeriti prava, prikaz, PDF)

## 4. „Migracijski paket po grupi"

Ideja iz situacije 5: jedna cjelina (PDF, Zapisnik, Eseji, Kandidati, Blagajna…) = jedan paket koji sadrži
popis datoteka, potrebne tablice, seed, podatke i verifikaciju. Migrira se grupa po grupa, a ne sve odjednom.

## 5. Alati — kandidati

- **Datoteke:** `rsync -avzn --delete --itemize-changes` iz WSL-a (dry-run = plan migracije).
  Exclude obavezan: produkcijski `00_db.php`, `.htaccess` ako se razlikuje, upload/cache folderi.
  Skripte po uzoru na postojeće: `Kod-Test-Razlika.sh` (samo plan) → `Kod-Uskladi_sa_razvojem.sh` (uz potvrdu + backup).
- **Podaci:** `dbForge Data Compare for MySQL` (GUI, generira sync skriptu, plaćen) ·
  Percona `pt-table-sync --print` (besplatno, iz WSL-a, oštro — traži filtere) · SQLyog Data Sync.
  HeidiSQL usporedba je preslaba za ovo.
- **Alternativa za datoteke:** cPanel → Git Version Control (`git pull` iz GitHub repoa).

## 6. Otvoreno

- Točne putanje na produkciji (`public_html/…`) i konačna exclude lista.
- Odabir alata za podatke (kupiti GUI ili pisati vlastite idempotentne SQL skripte po grupi).
- Politika brisanja datoteka na produkciji (`--delete` da/ne, ili ručna potvrda popisa).
- Kako verzionirati migracijske pakete (u `sql/` po grupi? zaseban folder `migracije/`?).
- Vezano: `docs/PRODUKCIJA_TODO.md` (serverske stvari + postojeći seedovi), [[project_migracija_na_server]].
