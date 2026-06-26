# Plan: Popis prisutnih po tipu prisustva (`relacija_grupe`)

Status: **DOGOVORENO, čeka implementaciju.** Rješavamo redom; PRIJE ovoga ide još
jedna druga stavka (TBD). Bez koda dok se ne kaže „kreni".

Kontekst: PDF Generator, dokument **Zapisnik** (`pdf_dokument` id 5). Nadovezuje se na
postojeće relacija‑tipove `relacija_broj` / `relacija_lista` i tablicu
`pdf_dozvoljeni_relacije` (vidi memoriju `project_pdf_generator_status`).

## Cilj
Jedna stavka ispisuje **N redaka — po jedan tip prisustva koji ima ljude**:
```
<naziv tipa>: <Prezime Ime, Prezime Ime, …>
```
- redoslijed redaka = `radovi_prisustvo_tip.redosljed`
- prazan tip → redak se NE ispisuje; svi tipovi prazni → cijela stavka skrivena
- **dodavanje novog tipa u `radovi_prisustvo_tip` = novi redak automatski**, bez koda i
  bez diranja liste tipova (ključni zahtjev: ništa hardkodirano)

## Podaci (provjereno 2026-06-26)
Tablica tipova **`radovi_prisustvo_tip`**: `id`, `naziv`, `redosljed`, `slobodan_unos`, …
| id | naziv | redosljed | slobodan_unos |
|----|-------|-----------|---------------|
| 1 | Prisutan na radovima | 10 | 0 → iz `clanovi` |
| 2 | Opravdano odsutan | 20 | 0 → iz `clanovi` |
| 3 | Gost iz VNLH na radovima | 30 | 0 → iz `clanovi` |
| 4 | Gost van VNLH na radovima | 40 | 1 → `ime_i_prezime` |

Junction **`zapisnik_sa_radova_prisutni`**: `id_zapisnika`, `id_clana`, `id_prisustvo_tip`,
`ime_i_prezime`. Potvrđeno: tipovi 1–3 imaju `id_clana` (a `ime_i_prezime` NULL); tip 4 ima
`id_clana=NULL` i upisan `ime_i_prezime`.

### Ključni uvid — jedno pravilo za naziv (bez per‑tip grananja)
```
ime_retka = COALESCE( "{prezime} {ime}" iz clanovi po id_clana ,  ime_i_prezime iz junction-a )
```
Član upisan → ime iz matične tablice; slobodan unos (gost) → upisani tekst.

## Relacija (deklarativno, whitelist) — „Zapisnik → prisutni po tipu"
| dio | vrijednost |
|---|---|
| grupa‑tablica / labela / sort | `radovi_prisustvo_tip` / `naziv` / `redosljed` |
| junction / fk_baza / diskriminator | `zapisnik_sa_radova_prisutni` / `id_zapisnika` / `id_prisustvo_tip` |
| cilj imena (predložak) | `clanovi` preko `id_clana` → `{prezime} {ime}` |
| fallback kolona (gost) | `ime_i_prezime` |
| sort imena | `prezime` |

Konceptualni upit:
```sql
SELECT t.naziv AS labela,
       GROUP_CONCAT(
         COALESCE(NULLIF(CONCAT_WS(' ', c.prezime, c.ime), ''), p.ime_i_prezime)
         ORDER BY c.prezime, c.ime SEPARATOR ', '
       ) AS imena
FROM radovi_prisustvo_tip t
JOIN zapisnik_sa_radova_prisutni p ON p.id_prisustvo_tip = t.id AND p.id_zapisnika = ?
LEFT JOIN clanovi c ON c.id = p.id_clana
GROUP BY t.id, t.naziv, t.redosljed
ORDER BY t.redosljed;
```
(identifikatori iz whitelista, validirani; vrijednost `?` bound — kao i ostatak engine-a)

## Stavka (`izvor_tip='relacija_grupe'`) — bira samo prikaz
- relacija = „Zapisnik → prisutni po tipu"; `kontekst_kljuc='ID_Zapisnik'`
- razdvajanje **grupa** = novi red istog odlomka (meki prijelom `\x01`)
- razdvajanje **osoba** = `", "`
- separator labela↔lista = `": "` (default; podesivo) — **OPEN: potvrditi default**
- **labela podebljana** = ✔ (kontrola u stavci, ne hardkodirano)

## Format imena (potvrđeno)
- `Prezime Ime` — razmak između, BEZ zareza između prezimena i imena; zarez samo IZMEĐU osoba
- sort po `prezime`

## Bold labela — mehanizam
Generirani tekst nema inline‑stil; bold se izvodi kao **podebljani run** (`bold:true`) na dijelu
„labela". Radi samo ako font paragrafa ima bold varijantu (lazy‑load registrira porodice u 4
varijante → trebalo bi raditi; provjeriti). Kontrola: checkbox „Labela podebljana" u stavci.
(Boja tipa `radovi_prisustvo_tip.boja_prikaza` kao „labela u boji" = mogući kasniji korak.)

## Opseg implementacije (kad se kaže „kreni")
1. **Shema (ručno Heidi + `.sql` za Skeemu, seed u `sql/`):**
   - proširenje `pdf_dozvoljeni_relacije`: grupa‑tablica/label/sort, diskriminator,
     ciljni predložak, fallback‑kolona (sve nullable; postojeća lista/broj relacija ostaju)
   - `radovi_prisustvo_tip` + `clanovi.prezime` u `pdf_dozvoljeni_izvori` (whitelist)
   - novi `izvor_tip='relacija_grupe'` u `pdf_dokument_stavke` (+ eventualno `labela_bold`)
2. **Engine `PDF_Generator_resolve.php`:** grouped upit (GROUP BY tip, COALESCE ime, ORDER
   redosljed/prezime), izlaz = retci spojeni mekim prijelomom; bold run za labelu; prazni
   tipovi preskočeni; sve prazno → `sakrij`.
3. **CRUD UI `PDF_Dokument_CRUD.*`:** novi tip u modalu + polja (relacija, separatori,
   labela‑bold). `js/pdf-render.js` — podrška za bold run ako već nema.

## Otvorene odluke (za potvrdu prije/na početku implementacije)
1. Separator labela↔lista default `": "` — potvrditi.
2. **Admin forma „Dozvoljene relacije"** (CRUD za `pdf_dozvoljeni_relacije`) — sad ili kasnije?
   Ova relacija je preglomazna za ručni SQL; forma bi bila poželjna. Alternativa: opet seed‑SQL.

## Redoslijed rada (dogovor)
- [ ] **PRVA: dužnosnici (`relacija_redak`)** — vidi dolje (radi se prvo)
- [ ] Tek onda: `relacija_grupe` (prisutni) po gornjem planu

---

# Dužnosnici (`relacija_redak`) — ZAKLJUČAN SPEC (radi se PRVO)

Status: **DOGOVOREN, implementacija u tijeku (2026-06-26).**

## Cilj
Jedna stavka → odlomak s više redaka, **po jedan redak za svakog dužnosnika**:
```
Časni majstor:          Sestra Morana
Prvi nadzornik:         Brat Toni
…
```
- redak = `naziv dužnosti` + `:` + **fiksna pozicija (tab)** + `Brat|Sestra` + `ime`
- „samo ime" (clanovi.ime); spol → Brat/Sestra (`clanovi.spol` 0/1)
- redoslijed = ENUM `naziv_duznosti` (hijerarhija; `ORDER BY` na ENUM-u daje redoslijed definicije)
- prazno (nema dužnosnika) → cijela stavka skrivena

## Podaci (provjereno)
`zapisnik_sa_radova_duznosnici`: `id_zapisnika`, `naziv_duznosti` (ENUM), `id_clana`.
`clanovi`: `ime`, `prezime`, `spol` (0=Brat, 1=Sestra). ENUM proširen: dodan **„Majstor sklada"** na kraj
(NAPOMENA: za UNOS te dužnosti u app treba i `Zapisnik_CRUD.js` ZAPISNIK_DUZNOSNICI_REDOVI + HTML red —
zaseban zadatak, NIJE dio PDF-a).

## Novi primitiv `relacija_redak` (per-row predložak)
Svaki redak = **predložak** s poljima iz spojne i ciljne tablice + tab. Render: svaki redak je
ZASEBAN ODLOMAK s internim `~(N)` markerom → postojeći pdf-render (`tabSegmenti`/`sastaviTabRedak`)
pretvori u pdfMake `columns` (lijevo širine N mm, desno `*`). **Nema izmjene u pdf-render.**

## Model
**Relacija „Zapisnik → dužnosnici"** (whitelist): junction `zapisnik_sa_radova_duznosnici`,
fk_baza `id_zapisnika`, link `id_clana` → cilj `clanovi` (ciljni_izvor = clanovi.* anchor),
**sort_kolona `naziv_duznosti`** (novo polje na relaciji).

**Stavka `relacija_redak`** drži **redak-predložak** (na stavci, ne relaciji) + fiksnu poziciju:
```
{j.naziv_duznosti}:{tab}{c.spol|0:Brat;1:Sestra} {c.ime}
```
- `{j.kol}` = spojna tablica; `{c.kol}` = cilj (clanovi); svaka kolona validirana whitelistom
- `{c.kol|mapa}` = inline mapa (ista sintaksa kao polje „Mapa")
- `{tab}` = postojeća **„Fiksna pozicija stavke"** (mm); početno **100 mm** (korisnik podešava)
- retci spojeni `\n` (svaki svoj odlomak/columns-redak)
- `^` → razmak

## Schema dodaci
- `pdf_dokument_stavke`: `izvor_tip` + `'relacija_redak'`; nova kolona `redak_predlozak` varchar(512); CHECK grana
- `pdf_dozvoljeni_relacije`: nova kolona `sort_kolona` varchar(64) (junction sort; NULL = po vezi)
- `pdf_dozvoljeni_izvori`: + `zapisnik_sa_radova_duznosnici.naziv_duznosti` (clanovi.ime/spol već postoje)

## Engine (resolve.php)
- grana `relacija_redak`: parsiraj predložak (`{j.x}`/`{c.x[|mapa]}`/`{tab}`), validiraj kolone whitelistom,
  jedan SELECT (junction JOIN cilj, WHERE fk_baza=?, ORDER BY sort_kolona), po retku renderiraj predložak,
  `{tab}`→`~(N)` (N=fiksna_pozicija stavke), retci spojeni `\n`; prazno → null (sakrij)
- chain: `relacija_redak` IZUZET od user-`~()`-stripa i auto-prepend fiksne pozicije (već ima pozicionirane tabove)

## CRUD
- modal: tip „Tekst — relacija (redak)"; polje „Redak-predložak" (textarea + ⓘ help); vidljivost
  (relacija + predložak + ključ konteksta + fiksna pozicija; skriveni izvor/preko/traži/literal/mapa)
- spremi.php + JS plumbing (stavkaIzReda + payloadi) + validacija (relacija_id, kontekst, predložak)

## Uvjetni sufiks „loža člana ako nije iz lože nosioca" (Opcija B, 2026-06-26)
Ako dužnosnik nije iz lože nosioca (`clanovi.loza != zapisnik_sa_radova.id_domacin`) → iza imena
dodaj „, <naziv lože>". Izvedba: 4 nova polja na `pdf_dozvoljeni_relacije` (`suffix_fk_kolona`,
`suffix_izvor_id`, `suffix_bazni_izvor_id`, `suffix_format`) — sufiks je na RELACIJI, predložak ostaje
nepromijenjen. Engine (relacija_redak): LEFT JOIN suffix tablice + dohvat bazne usporedbe po baseId,
po retku doda format `, {v}` kad se FK razlikuje i naziv postoji. Seed: `sql/pdf_relacija_redak_duznosnici_suffix.sql`
(+ `clanovi.loza` u whitelist; UPDATE relacije: loza / izvor 5 loze.naziv / izvor 15 id_domacin / ", {v}").
Bez CRUD izmjena (relacija nema formu). Test: zapisnik 8 „Prvi nadzornik: Brat Zlatan, Iliria".

## Otvoreno
- Unos „Majstor sklada" u Zapisnik formu (ZAPISNIK_DUZNOSNICI_REDOVI) — sada ili kasnije? (zaseban posao)
- Admin forma „Dozvoljene relacije" sve poželjnija (relacija sad ima dosta polja: sort, suffix_*).
