# Plan migracije: PK/FK cjelobrojni stupci → UNSIGNED

Dokument za izvršenje **kad dođe vrijeme**, nakon što su nove tablice već na produkciji i Skeema je uskladila strukturu.

---

## Cilj

Na stupcima koji sudjeluju u **PRIMARY KEY** ili **FOREIGN KEY** (`INT` / `BIGINT` itd., gdje je semantički prikladno) preći na **`UNSIGNED`**, ako podaci to dopuštaju (nema negativnih vrijednosti gdje nije dopušten NULL kao poseban slučaj).

**Izvan opsega ove migracije:** stupci koji nisu PK/FK (npr. pozicije, koordinate s dopuštenim negativnim vrijednostima) — procijeniti posebno.

---

## Preduvjeti (prije bilo kakvog pusha na produkciju)

1. **Nove tablice** već deployane na produkciju putem Skeeme (`db-schema`), uz **`UNSIGNED` na PK/FK od prvog dana** gdje je smisleno — bez dodatnog kruga ALTER-a samo za te stupce.
2. **Backup produkcije** (npr. `Baza-Bekap_na_lokalno_racunalo.sh` iz `CLAUDE.md`).
3. **Provjera podataka na produkciji** — isti tip uvida kao na lokalu: za svaki stupac koji će postati `UNSIGNED`, provjeriti `MIN(value)` / postoji li `< 0` (nullable FK: samo nenegativne ili NULL).
4. **Dry-run:** `Baza-Test-Razlika.sh` / `Baza-Test-Distribucije.sh` kad Skeema diff uključuje shemu; za čisti SQL skriptni ALTER — pregled skripte i redoslijeda (FK ovisnosti).

---

## Redosljed rada

| Korak | Gdje | Što |
|-------|------|-----|
| 1 | Lokalno (`vnlh`) | Primijeni migraciju `UNSIGNED` (ALTER ili generirana skripta). |
| 2 | Git / Skeema | Ažuriraj izvore sheme u `db-schema/` tako da odgovaraju stanju nakon ALTER-a (`skeema pull` s lokala **ili** ručno uskladiti `.sql` po tablicama — što je standard u projektu). |
| 3 | Produkcija | **Ista** ALTER skripta kao na lokalu (nakon potvrde podataka i backupa). |
| 4 | Skeema ↔ prod | Provjeri da Skeema više ne želi promjene za te stupce (status čist za te objekte). |
| 5 | Operativno | **Punjenje podataka** u nove tablice **nakon** što su tipovi na relevantnim stupcima finalni. |

---

## Tehničke napomene

- **Redoslijed FK-a:** InnoDB traži da tipovi referenciranog i referencirajućeg stupca odgovaraju (`UNSIGNED` mora biti usklađen na obje strane). Kod mijenjanja postojećih stupaca često je potrebno: child stupci → parent, ili privremeno drop FK → ALTER → recreate FK — ovisno o shemi; skriptu složiti prema stvarnim ovisnostima.
- **Izvor istine:** Nakon ručnog ALTER-a na produkciji **obavezno** uskladiti `db-schema/` u repou; inače sljedeći Skeema push može predložiti povratak na stare tipove ili neočekivani diff.
- **Produkcija:** `Baza-Uskladi_sa_razvojem.sh` i bilo koji push koji mijenja produkciju — **samo uz eksplicitnu suglasnost** vlasnika projekta (`CLAUDE.md`).

---

## Kontrolna lista nakon izvršenja

- [ ] Lokalna i produkcijska shema odgovaraju dokumentiranom stanju u `db-schema/`.
- [ ] Nema negativnih vrijednosti na stupcima koji su sada `UNSIGNED` (gdje to nije dopušteno poslovnom logikom).
- [ ] Aplikacija / API testirani na ključnim tokovima koji koriste te tablice.

---

*Plan je sažetak dogovorenog workflowa; konkretni ALTER-i po tablicama dodaju se u zasebnu SQL skriptu ili u Skeema fileove u trenutku izvršenja.*
