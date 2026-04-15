# Plan: sesija, ping, zatvaranje kartice (VNLH WEB)

## Potvrde iz baze (MCP, `sustav_varijable`)

| id  | Naziv                 | varijabla |
|-----|------------------------|-----------|
| 111 | ping_interval_sec      | 30        |
| 112 | session_timeout_sec    | 90        |
| 113 | cleanup_interval_sec   | 60        |

Postoje i 101 (poll poruka), 108 (zadržavanje neaktivnih redova), 109 (refresh alata aktivne sesije) — ne mijenjati bez posebnog zadatka.

## Odluke prije realizacije (potvrđeno)

1. **Ping URL:** `php/sesija_ping.php` (isti model kao ostali API-ji), ne zaseban `/api/` route.
2. **Slojevi:** **Usklađeno (strict unified)** — kad ping ili zaštićeni zahtjev utvrdi da sesija u bazi nije `aktivna` / istekla po pravilu `session_timeout_sec`, **odmah** kraj PHP sesije (401 ili redirect), bez paralelnog „dugog” PHP idlea 1800 s koji bi dopuštao rad nakon isteka u bazi.

## Kolačić i ping (namjera)

- Kolačić sesije: **~90 s** životnog vijeka; **svaki uspješan ping** ga produžuje (isto kao sadašnji princip `vnlh_refresh_session_cookie`, uz novi Max-Age iz `session_timeout_sec` ili usklađenu konstantu).
- Ping interval iz baze: **30 s** (id 111).

## Centralni dohvat varijabli (prethodna specifikacija)

- Jedna PHP funkcija: ključ (mapiranje na id 111–113 ili čitanje po `id`) + **in-memory cache** TTL npr. 5 min.
- Invalidacija cachea nakon UPDATE retka u Alatima (varijable sustava) po potrebi.

## Koraci implementacije

### Korak 3 — Backend ping (`php/sesija_ping.php`)

- `require_login_api` ili tanji `auth_start` + provjera — **uskladiti** da ne duplira tešku logiku; odgovor JSON ili plain `ok` / `expired`.
- `UPDATE sustav_sesije_aktivne SET zadnja_aktivnost = NOW() WHERE session_id = ? AND id_korisnik = ? AND status = 'aktivna'` (i uvjet da nije prošlo > `session_timeout_sec` od zadnje aktivnosti — ili prvo SELECT pa odluka).
- Ako isteklo: postavi `timeout` (ili koristi postojeću `Alati_Sesije_Aktivne_mark_timeout_session`), uništi PHP sesiju, vrati `expired`.

### Korak 4 — „Middleware” (PHP nema globalni middleware)

- Proširiti **`require_login.php`** i **`require_login_api.php`** (i eventualno druge ulaze ako postoje): nakon postojećih provjera, **provjera retka** `sustav_sesije_aktivne` za trenutni `session_id` + `status = aktivna` + `zadnja_aktivnost` unutar `session_timeout_sec`. Ako ne valja → 401 / redirect + isto ponašanje kao timeout.

### Korak 5 — Cleanup (`php/cleanup_sesije.php`)

- CLI/cron-dopušten skript: `aktivna` → `timeout` gdje je `zadnja_aktivnost` starija od `session_timeout_sec` (vrijednost iz varijable 112).
- Može pozvati postojeću `Alati_Sesije_Aktivne_reconcile_timeout_stale_aktivne` nakon proširenja da koristi dinamički prag iz baze umjesto samo `VNLH_SESIJA_IDLE_SEKUNDI` — **uskladiti jedan izvor istine** (112 vs 1800).

### Korak 6 — Frontend: varijable na loginu

- Odgovor nakon uspješnog logina (npr. `Login.php` / JSON redirect payload / inline script) proširiti s **`ping_interval_sec`** i **`session_timeout_sec`** (iz centralne funkcije ili direktno iz id 111/112).

### Korak 7 — Frontend: ping

- `setInterval` u zajedničkom layoutu (npr. **`0-Common.js`** nakon što postoje `id_korisnik` / flag logiranosti, ili samo na stranicama koje učitavaju zajednički JS nakon logina).
- Na `expired` → redirect na login (isto kao 401 XHR obrada ako već postoji).

### Korak 8 — Deploy + cron

- Cron npr. **svake minute** poziva `php/cleanup_sesije.php` (ili URL s tokenom ako web cron); interval 113 (60 s) je usklađen s minutom.

### Korak 9 — Testiranje

- DevTools Network (ping), zatvaranje kartice, cleanup, opterećenje baze.

### Korak 10 — Monitoring 24 h

- Broj sesija, ping rate, greške u logu.

## Zatvaranje kartice (raniji plan)

- **`pagehide` + `sendBeacon`** na lagani endpoint koji poziva `vnlh_session_destroy_logout()` — uz **zaštitu od unutarnje navigacije** (capture `click` / `submit` zastavica).
- Više kartica: zatvaranje jedne = puna odjava (potvrđeno ranije).

## Implementacijski napomene

- Zamijeniti / uskladiti trenutačni **`gc_maxlifetime` / cookie 1800** u [`php/auth_start.php`](php/auth_start.php) s **`session_timeout_sec`** (90) za usklađeni model.
- U [`php/Alati_Sesije_Aktivne.php`](php/Alati_Sesije_Aktivne.php): `touch_request` treba **ažurirati `zadnja_aktivnost`** kad se radi stvarni touch, inače ping i touch govore različitu priču — riješiti u istom zadatku ili odmah nakon ping sloja.
- Bump revizije u [`js/00-Version.js`](js/00-Version.js) po pravilima repozitorija.

## Otvorena pitanja — prijedlog i preporuka

**Status (korisnik):** točke **1** i **2** u nastavku — **prihvaćeno** kako je predloženo.

### 1) `cleanup_sesije.php`: samo CLI ili i HTTP s tokenom?

**Prijedlog (prihvaćeno):** primarno **CLI** (`php /putanja/cleanup_sesije.php` u cronu).

**Zašto:** skripta mijenja bazu; HTTP endpoint uvijek nosi rizik curenja URL-a (logovi, referrer, proxy), pa treba tajni token, HTTPS, eventualno IP allowlist. CLI na istom serveru je jednostavniji i uobičajen na VPS-u.

**Preporuka za produkciju:** cron **svake minute** (ili 1–5 min, usklađeno s id 113) poziva **isključivo CLI**. Ako hosting **nema** CLI cron (rijetko, neki shared hosting): dodati **opcijski** HTTP način — `GET`/`POST` s dugim nasumičnim ključem iz **env** ili datoteke **izvan repozitorija**, bez ključa u URL-u u commitu; u planu deploya dokumentirati varijablu.

---

### 2) Login: samo HTML redirect ili i JSON odgovor s ping parametrima?

**Prijedlog (prihvaćeno):** **jedan izvor u PHP-u** (npr. funkcija `vnlh_sesija_ping_js_config(): array` koja čita 111/112 preko centralnog dohvata varijabli), a na frontend se vrijednosti dopiru na **dva načina**, ovisno o ulazu:

| Ulaz | Kako proslijediti `ping_interval_sec` / `session_timeout_sec` |
|------|------------------------------------------------------------------|
| Stranice koje već injektaju u HTML (`Meni.php`, `vnlh_emit_html_*`, …) | Isti uzorak kao `__VNLH_APP_BASE_PATH__`: jedan `<script>window.__VNLH_SESIJA_PING__={…}</script>` iznad `0-Common.js`. |
| **Login.php** nakon uspješne prijave | Ako redirect ide odmah na `Meni.php`, dovoljno je da **Meni** (prva stranica) nosi inject; ako postoji **direktan** skok na CRUD bez Menija, taj PHP wrapper mora isto injektirati (centralna pomoćna funkcija u `vnlh_paths.php` ili zasebni `php/vnlh_sesija_ping_inject.php` uključen u sve `require_login` izlaze). |
| **JSON login** (ako postoji ili dodaje se) | U JSON odgovor uključiti ista dva polja iz iste PHP funkcije — bez duplog čitanja baze na drugačiji način. |

**Zašto ne oslanjanje isključivo na „samo Login“:** korisnik može otvoriti bookmark na `Clanovi_CRUD.php` dok je sesija valjana — ping mora znati interval bez da je prošao kroz Login u tom tabu.

**Zašto ne obavezni drugi XHR „config“ odmah nakon loada:** radi, ali je dodatni round-trip na svaku stranicu ako se može riješiti jednim inline blokom iz PHP-a koji već zna sesiju.

---

## Čekanje na „kreni”

Kod se ne piše dok korisnik eksplicitno ne kaže **„kreni“** (workspace pravilo).
