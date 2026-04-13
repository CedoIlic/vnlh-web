<?php
/**
 * Alati_Sesije_Aktivne.php – logika za tablicu sustav_sesije_aktivne (Alati / aktivne sesije).
 *
 * INSERT: odmah nakon vnlh_establish_login_session (novi session_id); povijest_sesije počinje kanonskim nazivom (vidi Alati_Sesije_Aktivne_povijest_naziv_kao_html).
 * TOUCH: nakon valjane sesije u require_login / require_login_api.
 *        Za „preskočene” skripte (poll liste, Version_Check) ne radi se ništa – ne dira se zadnja_aktivnost
 *        (automatski poll ne smatra se korisničkom aktivnošću u zapisu).
 *        Inače: povijest_sesije kao niz naziva ", " – za skripte s parom html/<ime>.html koristi se <ime>.html, za čiste API skripte ostaje <ime>.php; throttle kad je ista stranica.
 * REKONCILIJACIJA: retci status=aktivna sa zadnja_aktivnost starijom od idle (1800 s) → timeout (npr. pri GET listu).
 * ODJAVA: vnlh_session_destroy_logout postavlja status = logout (retak ostaje za povijest).
 * ČIŠĆENJE: nakon INSERT/UPDATE na ovoj tablici brišu se neaktivni retci (timeout, logout) stariji od zadrške u satima (sustav_varijable id 108).
 * UI: zadani interval osvježavanja liste u Alatima čita se iz sustav_varijable id 109 (sekunde, 1–20).
 */
if (!function_exists('vnlh_client_ip')) {
    require_once __DIR__ . '/auth_start.php';
}

/** Idle sesije u sekundama – mora odgovarati VNLH_SESSION_IDLE_SECONDS i VNLH_SESSION_IDLE_SECONDS_API. */
if (!defined('VNLH_SESIJA_IDLE_SEKUNDI')) {
    define('VNLH_SESIJA_IDLE_SEKUNDI', 1800);
}

/** ID u sustav_varijable: zadrška u satima (kolona varijabla) prije DELETE neaktivnih redova sesije. */
if (!defined('VNLH_SUSTAV_VAR_SESIJA_NEAKTIVNE_ZADRZI_SATI')) {
    define('VNLH_SUSTAV_VAR_SESIJA_NEAKTIVNE_ZADRZI_SATI', 108);
}

/** Zadane sate ako red 108 ne postoji ili varijabla nije valjan pozitivan cijeli broj. */
if (!defined('VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT')) {
    define('VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT', 24);
}

/** ID u sustav_varijable: zadani interval osvježavanja tablice „Aktivne sesije” u sekundama (kolona varijabla). */
if (!defined('VNLH_SUSTAV_VAR_SESIJA_INTERVAL_OSVJEZI_SEC')) {
    define('VNLH_SUSTAV_VAR_SESIJA_INTERVAL_OSVJEZI_SEC', 109);
}

/** Zadane sekunde (1–20) ako red 109 ne postoji ili vrijednost nije valjana; usklađeno s min/max na #edit_interval. */
if (!defined('VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT')) {
    define('VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT', 5);
}

/**
 * Zahtjevi za koje se ne radi puni touch (niti zadnja_aktivnost – izbjegava lažno „aktivnost” pri samom osvježavanju liste).
 * – Poll liste.
 * – Version_Check.php – pozadinski XHR (ne smije prepisati otvorenu stranicu).
 */
function Alati_Sesije_Aktivne_touch_je_preskocen(): bool
{
    $base = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $preskoci = [
        'Alati_Aktivne_Sesije_sve.php',
        'Version_Check.php',
    ];
    return in_array($base, $preskoci, true);
}

/**
 * Stari zapis povijesti bio je višelinijski (datum/vrijeme + naziv skripte po retku).
 * Pretvara ga u jedan niz naziva odvojenih zarezom i razmakom ", " kako bi UI bio konzistentan.
 *
 * @param string $raw sadržaj stupca povijest_sesije iz baze
 * @return string normalizirani niz "Stranica1, Stranica2, …" ili prazan string
 */
function Alati_Sesije_Aktivne_normalize_povijest_staro_u_listu(string $raw): string
{
    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }
    if (strpos($raw, "\n") === false) {
        return $raw;
    }
    $djelovi = [];
    foreach (explode("\n", $raw) as $ln) {
        $ln = trim($ln);
        if ($ln === '') {
            continue;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}\ \d{2}:\d{2}:\d{2}\s+(.+)$/', $ln, $m)) {
            $djelovi[] = $m[1];
        } else {
            $djelovi[] = $ln;
        }
    }
    return implode(', ', $djelovi);
}

/**
 * Jedan naziv u povijesti: kanonski prikaz za otvorena_stranica / povijest_sesije.
 *
 * - Ako je $basename ime .php skripte i postoji datoteka html/<isti_stem>.html (isti stem kao php/<stem>.php),
 *   vraća se <stem>.html (logička stranica u repou).
 * - Ako .php nema takvog para (XHR/API, JSON, samo backend), ostaje <stem>.php – ne izmišlja se lažni .html
 *   (npr. meni_dohvat_stabla_menija.php ostaje .php).
 * - Ako je $basename već .html ili nije .php (stari zapis), vraća se nakon trim-a nepromijenjeno.
 *
 * @param string $basename samo ime datoteke (npr. iz povijesti ili basename(SCRIPT_NAME))
 */
function Alati_Sesije_Aktivne_povijest_naziv_kao_html(string $basename): string
{
    $n = trim($basename);
    if ($n === '') {
        return '';
    }
    if (!preg_match('/\.php$/i', $n)) {
        return $n;
    }
    $stem = preg_replace('/\.php$/i', '', $n);
    $htmlTwin = __DIR__ . '/../html/' . $stem . '.html';
    if (is_file($htmlTwin)) {
        return $stem . '.html';
    }
    return $n;
}

/**
 * Naziv stranice za otvorena_stranica i nove stavke povijest_sesije: basename(SCRIPT_NAME) normaliziran preko Alati_Sesije_Aktivne_povijest_naziv_kao_html.
 */
function Alati_Sesije_Aktivne_trenutna_stranica_za_povijest(): string
{
    $base = isset($_SERVER['SCRIPT_NAME']) ? basename((string) $_SERVER['SCRIPT_NAME']) : '';
    return Alati_Sesije_Aktivne_povijest_naziv_kao_html($base);
}

/**
 * Broj sati zadržavanja neaktivnih redova (timeout/logout) prije DELETE; čita sustav_varijable.id = 108, kolona varijabla.
 * Keš po HTTP zahtjevu; nevaljano/prazno → VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT.
 */
function Alati_Sesije_Aktivne_zadrzavanje_neaktivnih_sati_iz_baze(mysqli $mysqli): int
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $idVar = (int) VNLH_SUSTAV_VAR_SESIJA_NEAKTIVNE_ZADRZI_SATI;
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
    if (!$stmt) {
        $cache = (int) VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT;
        return $cache;
    }
    $stmt->bind_param('i', $idVar);
    if (!$stmt->execute()) {
        $stmt->close();
        $cache = (int) VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT;
        return $cache;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row || !isset($row['varijabla'])) {
        $cache = (int) VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT;
        return $cache;
    }
    $raw = trim((string) $row['varijabla']);
    if ($raw === '') {
        $cache = (int) VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT;
        return $cache;
    }
    $n = (int) $raw;
    if ($n < 1) {
        $n = (int) VNLH_SESIJA_NEAKTIVNE_ZADRZI_SATI_DEFAULT;
    }
    $n = min(24 * 365, $n);
    $cache = $n;
    return $cache;
}

/**
 * Zadani interval osvježavanja tablice „Aktivne sesije” u sekundama; čita sustav_varijable.id = 109, kolona varijabla.
 * Keš po HTTP zahtjevu; nevaljano/prazno → VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT; ograničeno na 1–20 (kao u UI).
 */
function Alati_Sesije_Aktivne_interval_osvjezi_sec_iz_baze(mysqli $mysqli): int
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $idVar = (int) VNLH_SUSTAV_VAR_SESIJA_INTERVAL_OSVJEZI_SEC;
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
    if (!$stmt) {
        $cache = (int) VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT;
        return $cache;
    }
    $stmt->bind_param('i', $idVar);
    if (!$stmt->execute()) {
        $stmt->close();
        $cache = (int) VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT;
        return $cache;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row || !isset($row['varijabla'])) {
        $cache = (int) VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT;
        return $cache;
    }
    $raw = trim((string) $row['varijabla']);
    if ($raw === '') {
        $cache = (int) VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT;
        return $cache;
    }
    $n = (int) $raw;
    if ($n < 1) {
        $n = (int) VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT;
    }
    $n = min(20, $n);
    $cache = $n;
    return $cache;
}

/**
 * Briše neaktivne retke sesija (status timeout ili logout) starije od zadrške – tablica ne gomila povijest.
 * Poziva se nakon svakog INSERT/UPDATE na sustav_sesije_aktivne koji mijenja podatke.
 *
 * @param mysqli $mysqli otvorena veza (ista transakcija / zahtjev)
 * @param int|null $zadrzatiSati null = vrijednost iz sustav_varijable (id 108)
 */
function Alati_Sesije_Aktivne_obrisi_neaktivne_redove(mysqli $mysqli, ?int $zadrzatiSati = null): void
{
    $h = $zadrzatiSati ?? Alati_Sesije_Aktivne_zadrzavanje_neaktivnih_sati_iz_baze($mysqli);
    $h = max(1, min(24 * 365, $h));
    $stmt = $mysqli->prepare(
        'DELETE FROM sustav_sesije_aktivne
         WHERE status IN (\'timeout\', \'logout\')
           AND zadnja_aktivnost < DATE_SUB(NOW(), INTERVAL ? HOUR)'
    );
    if ($stmt) {
        $stmt->bind_param('i', $h);
        $stmt->execute();
        $stmt->close();
    }
}

/**
 * Zadnja stavka u povijesti (naziv skripte), ako je spremljena kao "a, b, c".
 */
function Alati_Sesije_Aktivne_povijest_zadnja_stranica(string $hist): string
{
    $hist = trim($hist);
    if ($hist === '') {
        return '';
    }
    $komadi = array_map('trim', explode(',', $hist));
    $zadnji = (string) end($komadi);
    return $zadnji;
}

/**
 * Eksplicitna odjava (Logout, odjava zbog prava): retak ostaje u tablici sa status = logout,
 * zadnja_aktivnost = trenutak odjave. (Za razliku od isteka sesije = timeout, ne briše se red.)
 */
function Alati_Sesije_Aktivne_mark_logout_for_session(string $sessionId, int $idKorisnik): void
{
    if ($sessionId === '' || $idKorisnik <= 0) {
        return;
    }
    require_once __DIR__ . '/vnlh_db_connect.php';
    $mysqli = vnlh_db_connect();
    if ($mysqli === false) {
        return;
    }
    $stmt = $mysqli->prepare(
        'UPDATE sustav_sesije_aktivne
         SET status = \'logout\', zadnja_aktivnost = NOW()
         WHERE session_id = ? AND id_korisnik = ?'
    );
    if ($stmt) {
        $stmt->bind_param('si', $sessionId, $idKorisnik);
        $stmt->execute();
        $stmt->close();
    }
    $mysqli->close();
}

/**
 * Kad PHP sesija istekne zbog neaktivnosti (idle), ažurira red u sustav_sesije_aktivne:
 * status = 'timeout', zadnja_aktivnost = trenutak isteka (NOW).
 * Poziva se prije brisanja sesije; red ostaje u tablici (status timeout; odjava eksplicitno postavlja logout).
 */
function Alati_Sesije_Aktivne_mark_timeout_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $sid = session_id();
    $uid = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
    if ($sid === '' || $uid <= 0) {
        return;
    }
    require_once __DIR__ . '/vnlh_db_connect.php';
    $mysqli = vnlh_db_connect();
    if ($mysqli === false) {
        return;
    }
    $stmt = $mysqli->prepare(
        'UPDATE sustav_sesije_aktivne
         SET status = \'timeout\', zadnja_aktivnost = NOW()
         WHERE session_id = ? AND id_korisnik = ? AND status = \'aktivna\''
    );
    if ($stmt) {
        $stmt->bind_param('si', $sid, $uid);
        $stmt->execute();
        $stmt->close();
    }
    $mysqli->close();
}

/**
 * Označava timeout retke koji su još aktivni u bazi, ali im je zadnja_aktivnost starija od idle praga.
 * Potrebno jer se mark_timeout poziva tek pri prvom HTTP zahtjevu nakon isteka – bez zahtjeva red ostaje krivo „aktivna”.
 */
function Alati_Sesije_Aktivne_reconcile_timeout_stale_aktivne(mysqli $mysqli): void
{
    $idle = (int) VNLH_SESIJA_IDLE_SEKUNDI;
    if ($idle < 60) {
        $idle = 1800;
    }
    $sql = 'UPDATE sustav_sesije_aktivne SET status = \'timeout\'
            WHERE status = \'aktivna\' AND zadnja_aktivnost < DATE_SUB(NOW(), INTERVAL ' . $idle . ' SECOND)';
    $mysqli->query($sql);
    Alati_Sesije_Aktivne_obrisi_neaktivne_redove($mysqli);
}

/**
 * Reconciliacija može postaviti status=timeout dok PHP sesija još valja (poll osvježava last_activity, a zadnja_aktivnost u bazi ne).
 * Pri svakom zaštićenom zahtjevu: ako je red za ovu sesiju već timeout, uništava se PHP sesija i korisnik ide na login.
 * Ne briše red u bazi (za razliku od odjave koja postavlja status = logout).
 */
function Alati_Sesije_Aktivne_odjava_ako_red_timeout(string $mode = 'html'): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $uid = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
    if ($uid <= 0) {
        return;
    }
    $sid = session_id();
    if ($sid === '') {
        return;
    }

    require_once __DIR__ . '/vnlh_db_connect.php';
    $mysqli = vnlh_db_connect();
    if ($mysqli === false) {
        return;
    }
    $stmt = $mysqli->prepare('SELECT status FROM sustav_sesije_aktivne WHERE session_id = ? AND id_korisnik = ? LIMIT 1');
    if (!$stmt) {
        $mysqli->close();
        return;
    }
    $stmt->bind_param('si', $sid, $uid);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    $mysqli->close();

    if (!$row || !isset($row['status']) || $row['status'] !== 'timeout') {
        return;
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $p['path'] ?: '/',
            'domain' => $p['domain'] ?? '',
            'secure' => $p['secure'] ?? false,
            'httponly' => $p['httponly'] ?? true,
            'samesite' => $p['samesite'] ?? 'Lax',
        ]);
    }
    session_destroy();

    if ($mode === 'api') {
        http_response_code(401);
        header('Content-Type: text/plain; charset=utf-8');
        echo '401';
        exit;
    }

    require_once __DIR__ . '/vnlh_paths.php';
    header('Location: ' . vnlh_login_path(null));
    exit;
}

/**
 * Umetanje aktivne sesije nakon uspješnog logina (poziva se prije zatvaranja $mysqli u Login.php).
 */
function Alati_Sesije_Aktivne_insert_after_login(mysqli $mysqli, int $idKorisnik): void
{
    if ($idKorisnik <= 0 || session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $sid = session_id();
    if ($sid === '') {
        return;
    }
    $ip = vnlh_client_ip();
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 1024) : '';
    $stranica = Alati_Sesije_Aktivne_trenutna_stranica_za_povijest();

    $stmt = $mysqli->prepare(
        'INSERT INTO sustav_sesije_aktivne
            (id_korisnik, session_id, login_vrijeme, zadnja_aktivnost, otvorena_stranica, povijest_sesije, ip_adresa, user_agent, status)
         VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?, \'aktivna\')'
    );
    if (!$stmt) {
        return;
    }
    $stmt->bind_param('isssss', $idKorisnik, $sid, $stranica, $stranica, $ip, $ua);
    $stmt->execute();
    $stmt->close();
    Alati_Sesije_Aktivne_obrisi_neaktivne_redove($mysqli);
}

/**
 * Ažuriranje retka sesije za trenutni PHP session_id (otvorena stranica, IP, UA, povijest).
 * Poziva se na kraju require_login.php i require_login_api.php.
 */
function Alati_Sesije_Aktivne_touch_request(): void
{
    if (Alati_Sesije_Aktivne_touch_je_preskocen()) {
        return;
    }
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $uid = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
    if ($uid <= 0) {
        return;
    }
    $sid = session_id();
    if ($sid === '') {
        return;
    }

    $stranica = Alati_Sesije_Aktivne_trenutna_stranica_za_povijest();
    $now = time();
    $minSec = 30;
    $throttleOk = empty($_SESSION['alati_sesije_aktivne_touch_ts'])
        || ($now - (int) $_SESSION['alati_sesije_aktivne_touch_ts']) >= $minSec;
    /** Zadnja stranica upisana u povijest u ovoj PHP sesiji; null = još nismo sinkronizirali s bazom. */
    $sessLast = $_SESSION['alati_sesije_aktivne_last_logged_script'] ?? null;
    $poznataPromjenaStranice = ($sessLast !== null && $stranica !== $sessLast);
    if ($sessLast !== null && !$poznataPromjenaStranice && !$throttleOk) {
        return;
    }

    require_once __DIR__ . '/vnlh_db_connect.php';
    $mysqli = vnlh_db_connect();
    if ($mysqli === false) {
        return;
    }

    $ip = vnlh_client_ip();
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 1024) : '';

    $sel = $mysqli->prepare(
        'SELECT id, COALESCE(povijest_sesije, \'\') AS pv FROM sustav_sesije_aktivne WHERE session_id = ? AND id_korisnik = ? LIMIT 1'
    );
    if (!$sel) {
        $mysqli->close();
        return;
    }
    $sel->bind_param('si', $sid, $uid);
    $sel->execute();
    $res = $sel->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $sel->close();

    if (!$row || !isset($row['id'])) {
        $mysqli->close();
        return;
    }

    $idRow = (int) $row['id'];
    $hist = Alati_Sesije_Aktivne_normalize_povijest_staro_u_listu((string) ($row['pv'] ?? ''));

    if ($sessLast === null) {
        $zadnjaIzBaze = Alati_Sesije_Aktivne_povijest_zadnja_stranica($hist);
        $_SESSION['alati_sesije_aktivne_last_logged_script'] = Alati_Sesije_Aktivne_povijest_naziv_kao_html($zadnjaIzBaze);
    }
    $scriptPromijenjena = ($stranica !== $_SESSION['alati_sesije_aktivne_last_logged_script']);
    if (!$scriptPromijenjena && !$throttleOk) {
        $mysqli->close();
        return;
    }

    if ($scriptPromijenjena) {
        if ($hist === '') {
            $hist = $stranica;
        } else {
            $hist .= ', ' . $stranica;
        }
        $_SESSION['alati_sesije_aktivne_last_logged_script'] = $stranica;
        if (strlen($hist) > 60000) {
            $hist = substr($hist, -60000);
        }
    }

    $upd = $mysqli->prepare(
        'UPDATE sustav_sesije_aktivne
         SET otvorena_stranica = ?, ip_adresa = ?, user_agent = ?, povijest_sesije = ?
         WHERE id = ? AND id_korisnik = ?'
    );
    if ($upd) {
        $upd->bind_param('ssssii', $stranica, $ip, $ua, $hist, $idRow, $uid);
        $upd->execute();
        $upd->close();
    }

    $_SESSION['alati_sesije_aktivne_touch_ts'] = $now;
    Alati_Sesije_Aktivne_obrisi_neaktivne_redove($mysqli);
    $mysqli->close();
}
