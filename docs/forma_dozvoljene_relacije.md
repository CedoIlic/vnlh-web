# Plan: Admin forma „Dozvoljene relacije" (CRUD `pdf_dozvoljeni_relacije`)

Status: **DOGOVORENO, radi se NAKON završetka Zapisnik dokumenta** (relacija ima ~20 polja → SQL nezgodan).
Uzor: postojeća forma **„Dozvoljeni izvori"** (`PDF_Whitelist_CRUD.*`).

## Cilj
Admin definira relacije (1-na-više veze za PDF generator) kroz formu umjesto ručnog SQL-a.
Kaskadni dropdowni `tablica → kolone` iz `information_schema` (mehanizam već riješen na 2 mjesta:
`PDF_Whitelist_CRUD` i razvojni blok u `PDF_Dokument_CRUD`).

## Layout (kao PDF_Whitelist_CRUD)
- Panel‑tablica (popis relacija — kolona „Naziv") + edit‑panel.
- Edit u **3 sekcije** (polja su uvjetna po tipu relacije):

### 1) Osnovno (uvijek)
| polje | tip kontrole | izvor |
|---|---|---|
| `naziv` | tekst | — |
| `junction_tablica` | dropdown tablica | information_schema |
| `fk_baza_kolona` | dropdown kolona | kolone junction tablice |
| `link_kolona` | dropdown kolona | kolone junction tablice |
| `ciljni_izvor_id` | dropdown | `pdf_dozvoljeni_izvori` (naziv) |
| `sort_kolona` | dropdown kolona (neobavezno) | kolone junction tablice |
| `napomena` | textarea | — |

### 2) Sufiks (uvjetni „X iza imena ako se razlikuje od baznog"; neobavezno)
| polje | tip | izvor |
|---|---|---|
| `suffix_fk_kolona` | dropdown kolona | kolone **ciljne** tablice (iz ciljni_izvor_id) |
| `suffix_izvor_id` | dropdown | `pdf_dozvoljeni_izvori` |
| `suffix_bazni_izvor_id` | dropdown | `pdf_dozvoljeni_izvori` |
| `suffix_format` | tekst | npr. `-{v}` / `, {v}` ({v}=naziv, ^=razmak) |

### 3) Grupiranje (relacija_grupe; neobavezno)
| polje | tip | izvor |
|---|---|---|
| `grupa_tablica` | dropdown tablica | information_schema |
| `grupa_label_kolona` | dropdown kolona | kolone grupa tablice |
| `grupa_sort_kolona` | dropdown kolona | kolone grupa tablice |
| `diskriminator_kolona` | dropdown kolona | kolone junction tablice |
| `fallback_kolona` | dropdown kolona | kolone junction tablice |
| `fallback_predlozak` | textarea | predložak imena gosta ({j.kol}/{j.kol->tbl.kol}/[blok]) |

## Kaskade (koja tablica puni koje kolone)
- **junction_tablica** → puni: `fk_baza_kolona`, `link_kolona`, `sort_kolona`, `diskriminator_kolona`, `fallback_kolona`
- **grupa_tablica** → puni: `grupa_label_kolona`, `grupa_sort_kolona`
- **ciljna tablica** (iz `ciljni_izvor_id` → `pdf_dozvoljeni_izvori.tablica`) → puni: `suffix_fk_kolona`
- izvor‑dropdowni (`ciljni_izvor_id`, `suffix_izvor_id`, `suffix_bazni_izvor_id`) iz `pdf_dozvoljeni_izvori`

## Backend (novi)
- `PDF_Relacije_CRUD_sve.php` — popis (već postoji `PDF_Relacije_sve.php`; preimenovati ili reuse)
- `PDF_Relacije_CRUD_upis.php` / `_izmjena.php` / `_brisanje.php`
- Kolone tablica: reuse `PDF_Whitelist_CRUD_meta.php` (information_schema)
- Izvori dropdown: reuse `PDF_Whitelist_CRUD_sve.php`
- **Validacija (server):** identifikatori regexom + postojanje u information_schema (kao resolver/izvori);
  izvor‑reference postoje u `pdf_dozvoljeni_izvori`. CHECK/FK u bazi nema na relaciji (samo FK ciljni_izvor),
  pa validacija u PHP‑u.

## Meni / pristup
Stavka u meniju je **sistemska tablica `meni`** → po pravilima (feedback_pravila_rada pogl. 8) treba
**specifikacija + dozvola** prije unosa. Opcije: (a) izgraditi stranicu+backend pa pristup direktnim URL‑om
(kao ostale PDF forme u razvoju), (b) korisnik da meni‑stavku pa se ožiči. Prava nad whitelistom ovise o
razradi uloga Admin/SuperAdmin (master plan grupa 7).

## Reference
- Uzor forme: `html/PDF_Whitelist_CRUD.html`, `js/PDF_Whitelist_CRUD.js`, `php/PDF_Whitelist_CRUD_*.php`
- Kaskada tablica→kolone već riješena: `PDF_Whitelist_CRUD` + razvojni blok `PDF_Dokument_CRUD`
- Shema relacije: `db-schema/vnlh/pdf_dozvoljeni_relacije.sql`
