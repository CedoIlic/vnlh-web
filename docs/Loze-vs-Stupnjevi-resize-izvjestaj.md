# Izvještaj: Razlike resize panela tablice – Loze CRUD vs Stupnjevi CRUD

## 1. HTML struktura

### Stupnjevi CRUD
- **Panel tablice**: direktno u `.page-container.stupnjevi-crud`, **nema wrappera**.
- Redoslijed: panel Obred → panel tablice → panels-row (slika + edit).
- Panel tablice:
  ```html
  <div class="kontrola-panel-tablica kontrola-panel kontrola-panel--resize-y mb-3">
    <div class="kontrola-panel__body">
      <div id="tablicaContainer" class="kontrola-tablica"></div>
    </div>
  </div>
  ```
- **Nema** `.kontrola-panel__header` – samo body s tablicom.

### Loze CRUD
- **Panel tablice**: unutar **`.loze-crud__top-row`** (flex kontejner).
- Redoslijed: top-row [ panel slika | panel tablica ] → edit panel.
- Panel tablice ima **header** (Država, Regija) i dodatne klase:
  ```html
  <div class="loze-crud__top-row">
    <div class="loze-crud__panel-slika">...</div>
    <div class="kontrola-panel-tablica kontrola-panel-tablica--has-header kontrola-panel-tablica--has-header-two-rows kontrola-panel kontrola-panel--resize-y mb-3 loze-crud__panel-tablica">
      <div class="kontrola-panel__header loze-crud__tablica-header">...</div>
      <div class="kontrola-panel__body">
        <div id="tablicaContainer" class="kontrola-tablica"></div>
      </div>
    </div>
  </div>
  ```

**Razlika**: U Loze je panel tablice **flex child** unutar top-row; u Stupnjevima je samostalan blok u flowu.

---

## 2. CSS

### Stupnjevi_CRUD.css
- **Panel tablice**: nema niti jednog pravila za panel tablice (ni za 640px).
- Na 640px mijenja se samo `.stupnjevi-crud__panels-row` (column) i paneli slike/edit (width 100%); panel tablice ostaje neizmijenjen.

### Loze_CRUD.css
- **Panel tablice**: `.loze-crud__panel-tablica { flex: 1 1 0%; min-width: 0; }` – dio je flex layouta.
- **Na 640px**:
  - `.loze-crud__top-row { flex-direction: column }` – panel tablice postaje **flex child u column layoutu**.
  - `.loze-crud__panel-tablica { overflow: visible }` – overrida 0-Kontrole.
  - Dodana pravila za body/tablica/resize-bar (position, z-index).

**Razlika**: U Loze na mobitelu panel tablice **dijeli visinu** s panelom slike unutar column flexa; u Stupnjevima panel tablice **nikad nije u flex columnu** i visina mu je od sadržaja (min-height iz 0-Kontrole).

---

## 3. Zašto to sprječava resize na mobitelu

1. **Flex visina panela**  
   Kada je `.loze-crud__top-row` `flex-direction: column`, panel tablice ima `flex: 1 1 0%`. Visina mu je **odredena flex algoritmom** (dio dostupnog prostora), a ne samo sadržajem. Donja granica panela u layoutu može biti **iznad** stvarne resize trake (traka je u overflowu ispod).

2. **Zona za touch**  
   U Loze_CRUD.js zona za resize je: `touch.clientY >= panel.getBoundingClientRect().bottom - 56`.  
   `getBoundingClientRect().bottom` je donja granica **border boxa** panela – tj. donja granica **flexom dodijeljenog** prostora. Resize traka je ispod toga (overflow: visible). Zato dodir na traci ima `clientY` **veći** od `rect.bottom`, pa uvjet `clientY >= bottom - 56` **nikad nije ispunjen** kada korisnik dira točno traku.

3. **Stupnjevi**  
   Panel tablice nije u flex columnu; visina je od sadržaja, `rect.bottom` je stvarno dno panela (uključujući traku). Zona i touch se podudaraju, resize radi.

---

## 4. Zaključak i preporuka

- **Uzrok**: Kombinacija (a) panela tablice kao flex childa u columnu na 640px i (b) zone za touch koja se računa od `panel.getBoundingClientRect().bottom`, dok je resize traka vizualno ispod tog „dna”.
- **Preporuka**: Zonu za touch u Loze računati od **stvarne pozicije resize trake** (npr. `resizeBar.getBoundingClientRect()`), a ne od `panel.getBoundingClientRect().bottom`. Alternativa: na 640px layout za Loze učiniti sličnijim Stupnjevima (npr. top-row kao običan blok ili panel tablice izvan flex columna) tako da panel tablice nije flex child koji dijeli visinu.
