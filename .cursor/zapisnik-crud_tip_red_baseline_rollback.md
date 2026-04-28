# Zapisnik CRUD – baseline retka „Tip radova” (prije proširenja select + napomena)

**Svrha:** točan referentni sadržaj za ručni rollback izmjena na tom dijelu forme.  
**Datum snimke:** 2026-04-27 (stanje u repou prije implementacije proširenja).

## Datoteke koje se vraćaju

- `html/Zapisnik_CRUD.html` – isječak retka tip (linije 73–81 u tom trenutku)
- `css/Zapisnik_CRUD.css` – pravilo za `.zapisnik-crud__red-tip-radova .kontrola-select` (linije 184–188)
- `js/Zapisnik_CRUD.js` – u `zapisnikPostaviKontroleOvisnoLozi` nema upravljanja poljem „napomena tip” (dodano tek poslije ove snimke)

**Rollback (bez oslanjanja na git u repou):** distribucijski server nije nužno usklađen s gitom – **ne dirati git zbog drugih stvari**. Za povrat samo zamijeni sadržaj u **ovim tri datoteke** koje su u zadatku dirane; isječci ispod su dovoljni za ručni paste. (Ako lokalno koristiš git isključivo za sebe, možeš commit – to nije dio uputa za upload.)

---

## `html/Zapisnik_CRUD.html` (retar Tip radova)

```html
                                    <!-- (2,1): tip – label lijevo, select desno -->
                                    <div class="zapisnik-crud__edit-row zapisnik-crud__red-tip-radova">
                                        <label class="kontrola-labela mb-0" for="zapisnik_select_tip_radova">Tip radova</label>
                                        <div class="kontrola-select zapisnik-crud__select-tip-wrap">
                                            <select id="zapisnik_select_tip_radova" aria-label="Tip radova">
                                                <option value="">— Odaberi tip —</option>
                                            </select>
                                        </div>
                                    </div>
```

---

## `css/Zapisnik_CRUD.css` (tip select – cijelo pravilo)

```css
/* (2,1) tip: select rasteže na preostalu širinu unutar edit-row. */
.zapisnik-crud__red-tip-radova .kontrola-select {
  flex: 1 1 auto;
  min-width: 0;
}
```

---

## `js/Zapisnik_CRUD.js` (dio `zapisnikPostaviKontroleOvisnoLozi` – nema `napomena_tip`)

Kontekst: odmah nakon upravljanja `zapisnik_select_tip_radova` slijedi samo `zapisnik_loza_ucesnici`:

- `zapisnik_select_tip_radova`: `disabled` + `KontroleRefreshCustomSelect` kao sada
- `zapisnik_loza_ucesnici`: `taLoza` – **nema** `getElementById` za `zapisnik_napomena_tip_radova` (ili sličnog ida)

(Za implementaciju i agenta: **mijenjati samo datoteke koje zadatak zahtijeva** – npr. `Zapisnik_CRUD.html` / `.css` / `.js` + `00-Version.js` uz bump revizije – bez masovnih git operacija ili datoteka izvan dosega.)
