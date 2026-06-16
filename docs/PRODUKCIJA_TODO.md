# Produkcija — zadaci za sljedeću migraciju / deploy

Popis **serverskih / konfiguracijskih** zadataka koje treba primijeniti na produkciji
(digital.hr, MariaDB 10.6) pri sljedećoj migraciji. PHP kod i shema baze deployaju se
zasebno; ovdje su stvari koje se NE rješavaju kroz Skeemu ni kroz git.

---

## 1. `max_allowed_packet` (MariaDB) — povećati na 64M

- **Dodano:** 2026-06-16
- **Kontekst:** Forma „Slike, tekstovi, blokovi" (`Alati_Sustav_Slike_Tekstovi_CRUD`,
  tablica `sustav_slike_tekstovi`) sprema slike kao `LONGBLOB`. U 0-Obrada_Slike je za tu
  formu uklonjeno ograničenje veličine (`neogranicenaVelicina: true`) — učitava se i sprema
  slika bilo koje veličine; o veličini brine administrator.
- **Problem:** Lokalno je `max_allowed_packet` bio **1 MB** (XAMPP default) pa je INSERT slike
  > ~1 MB padao s greškom **1153** („Got a packet bigger than 'max_allowed_packet' bytes").
  Isti limit vrijedi i pri **čitanju** blob-a (serviranje slike kroz `..._podatak.php`).
- **Lokalno riješeno (2026-06-16):** podignuto na 64M u `C:\xampp\mysql\bin\my.ini`
  (`[mysqld]` → `max_allowed_packet=64M`), restart MySQL.
- **Za produkciju (digital.hr):**
  1. Provjeriti trenutnu vrijednost: `SELECT @@max_allowed_packet;`
  2. Podići na **64M** (`67108864`). Na shared hostingu kroz cPanel (MySQL postavke) ili
     `.my.cnf`; ako nije dostupno, otvoriti ticket podršci. (Gornja granica parametra je 1G.)
  3. **Verifikacija:** `SELECT @@max_allowed_packet;` → `67108864`; zatim test upisa i prikaza
     veće slike (> 1 MB) kroz formu.
- **Vrijedi i za upis i za čitanje** — podizanjem parametra riješeno je oboje, bez izmjene PHP-a.

---

## 2. Seed: 5 ikona modala u `sustav_slike_tekstovi`

- **Dodano:** 2026-06-16
- **Kontekst:** Ikone modala poruka servira se iz baze preko `php/modal_ikona.php`
  (helper `window.modalIconSrcForStanje` u 0-Poruke_Tekstovi.js). Endpoint mapira
  `stanje → rezervirani naziv`. Nema retka → 404 → **bez ikone** (modal i dalje radi).
- **Podatak, ne shema:** ovih 5 redaka NE migrira kroz Skeemu — treba ih unijeti ručno
  na produkciji (kroz formu „Slike, tekstovi, blokovi" ili INSERT-om), inače modali na
  produkciji nemaju ikone.
- **Točni nazivi (moraju se podudarati s mapom u `php/modal_ikona.php`):**
  `Modal ikona OK`, `Modal ikona Greska` (bez „š"), `Modal ikona Zabranjeno`,
  `Modal ikona Informacija`, `Modal ikona Upozorenje` — svi `tip_podatka = Slika PNG`.
- **Izvor slika:** `slike-arhiva/Check_mali.png`, `Error_mali.png`, `Forbidden_mali.png`,
  `information_mali.png`, `Warning_mali.png` (PNG, ~20–30 KB svaki; arhivirano iz `slike/` jer
  se ikone sad serviraju iz baze).
- **Verifikacija:** otvoriti `…/php/modal_ikona.php?stanje=ok|error|forbidden|information|warning`
  → svaki vraća PNG (200); zatim okinuti modal svakog stanja.
