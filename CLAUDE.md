# VNLH Projekt — Instrukcije za Claude Code agenta

## Pregled projekta

Web aplikacija VNLH. Lokalni razvoj na XAMPP-u (Windows), produkcija
na shared hostingu digital.hr (Linux + cPanel + MariaDB 10.6).

## Tehnologije

- **PHP** aplikacija
- **MariaDB** baza (lokalno 10.4 / produkcija 10.6)
- **Skeema** za schema management baze
- **Git** za verzioniranje
- **WSL + Ubuntu** za Linux alate (Skeema, SSH, bash skripte)

## Struktura projekta

- `D:\vnlh-web\` — root projekta (Windows)
- `D:\vnlh-web\db-schema\` — Skeema fileovi (deklarativna shema baze)
- `D:\vnlh-web\db-schema\vnlh\` — `.sql` fileovi za svaki objekt baze
- `E:\00-vnlh-web-backup\sql-baza\` — automatski backup-i produkcije (zadnjih 20)

## Skripte za bazu (u WSL-u, folder `~/scripts/`)

Sve se pokreću kroz WSL. Iz Windowsa:
`wsl bash -c "~/scripts/IME_SKRIPTE.sh"`

### `Baza-Test-Razlika.sh`
Pokazuje razlike između lokalne i produkcijske baze. SAMO ČITA, ništa ne mijenja.
Sigurno za pokretanje bilo kad.

### `Baza-Bekap_na_lokalno_racunalo.sh`
Pravi backup produkcijske baze, sprema u `E:\00-vnlh-web-backup\sql-baza\`.
Automatski briše stare backup-e (čuva zadnjih 20).
Sigurno za pokretanje bilo kad.

### `Baza-Test-Distribucije.sh`
Dry-run push na produkciju: simulira primjenu SQL-a u workspace bazi bez stvarnih promjena.
Detektira greške i upozorenja prije pravog pusha. Sigurno za pokretanje bilo kad.

### `Baza-Uskladi_sa_razvojem.sh`
KRITIČNO: Mijenja produkcijsku bazu da se podudara s lokalnom.
Workflow: pregled razlika → potvrda → backup → push → verifikacija.
Skripta interaktivno traži potvrdu "da/ne" prije primjene.

**NIKAD ne pokrećite ovu skriptu bez moje eksplicitne dozvole!**

## Pravila za agenta

1. **Slobodno pokretati**: Test-Razlika, Test-Distribucije, Bekap
2. **Tražiti dozvolu prije**: Uskladi (mijenja produkciju!)
3. Kad pitam "ima li razlika?", pokreni `Baza-Test-Razlika.sh` i interpretiraj rezultat
4. Kad pitam "napravi backup", pokreni `Baza-Bekap_na_lokalno_racunalo.sh`
5. Lozinka za bazu je u `~/.skeema/digital_vnlh.cnf` (ne pita se interaktivno)
6. SSH tunel se otvara automatski u skriptama

## Bitno o lokalnoj bazi

- XAMPP MySQL/MariaDB
- Baza: `vnlh`
- Korisnik za Skeema: `skeema` (lozinka u `vnlh-config.sh`)
- Konekcija iz WSL-a: `172.26.0.1:3306` (Windows host IP)

## Bitno o produkciji

- Server: digital.hr
- SSH: ključ-based (već postavljeno)
- Baza: `digital_vnlh`
- Korisnik za Skeema: `digital_skeema`
- Workspace baza: `digital_skeema_workspace` (samo za Skeema interne potrebe, ne dirati)

## Workflow za novu funkcionalnost

1. Razvijam lokalno (PHP + lokalna baza)
2. `skeema pull local` ili commit kroz git ako mijenjam .sql ručno
3. Test razlike s produkcijom: `Baza-Test-Razlika.sh`
4. Kad sam zadovoljan: `Baza-Uskladi_sa_razvojem.sh` (interaktivno)
5. Deploy PHP koda zasebno (još nije automatizirano)