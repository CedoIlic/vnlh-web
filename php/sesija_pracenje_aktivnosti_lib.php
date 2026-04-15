<?php
/**
 * sesija_pracenje_aktivnosti_lib.php
 *
 * Centralni dohvat brojčanih varijabli iz sustav_varijable (id 111–113) za praćenje sesije / ping,
 * s in-memory cacheom (TTL) da se SELECT ne ponavlja na svakom zahtjevu.
 *
 * ID-jevi (usklađeno s tablicom u bazi):
 *   111 – ping_interval_sec
 *   112 – session_timeout_sec (kolačić, idle, prag zadnja_aktivnost)
 *   113 – cleanup_interval_sec (preporuka za cron)
 */

/** TTL in-memory cachea varijabli (sekunde). */
const SESIJA_PRACENJE_VAR_CACHE_TTL = 300;

const SESIJA_PRACENJE_PING_MIN = 15;
const SESIJA_PRACENJE_PING_MAX = 120;

const SESIJA_PRACENJE_TIMEOUT_MIN = 45;
const SESIJA_PRACENJE_TIMEOUT_MAX = 86400;

/**
 * Briše in-memory cache (nakon izmjene retka u Alatima / sustav_varijable id 111–113).
 */
function sesija_pracenje_aktivnosti_cache_invalidate(): void
{
    $GLOBALS['sesija_pracenje_var_cache'] = [];
}

/**
 * Dohvaća cijeli broj iz kolone varijabla za zadani id retka; cache po id (TTL).
 */
function sesija_pracenje_aktivnosti_varijabla_int(mysqli $mysqli, int $id, int $default, int $minVal, int $maxVal): int
{
    if ($id <= 0) {
        return max($minVal, min($maxVal, $default));
    }
    $now = time();
    if (!isset($GLOBALS['sesija_pracenje_var_cache'])) {
        $GLOBALS['sesija_pracenje_var_cache'] = [];
    }
    $key = (string) $id;
    if (isset($GLOBALS['sesija_pracenje_var_cache'][$key])) {
        $e = $GLOBALS['sesija_pracenje_var_cache'][$key];
        if (is_array($e) && isset($e['t'], $e['v']) && ($now - (int) $e['t']) < SESIJA_PRACENJE_VAR_CACHE_TTL) {
            return (int) $e['v'];
        }
    }
    $n = $default;
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
    if ($stmt) {
        $stmt->bind_param('i', $id);
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            if ($row && isset($row['varijabla'])) {
                $raw = trim((string) $row['varijabla']);
                if ($raw !== '' && ctype_digit($raw)) {
                    $n = (int) $raw;
                }
            }
        }
        $stmt->close();
    }
    if ($n < $minVal) {
        $n = $minVal;
    }
    if ($n > $maxVal) {
        $n = $maxVal;
    }
    $GLOBALS['sesija_pracenje_var_cache'][$key] = ['t' => $now, 'v' => $n];
    return $n;
}

function sesija_pracenje_aktivnosti_ping_interval_sec(mysqli $mysqli): int
{
    return sesija_pracenje_aktivnosti_varijabla_int($mysqli, 111, 30, SESIJA_PRACENJE_PING_MIN, SESIJA_PRACENJE_PING_MAX);
}

function sesija_pracenje_aktivnosti_session_timeout_sec(mysqli $mysqli): int
{
    return sesija_pracenje_aktivnosti_varijabla_int($mysqli, 112, 90, SESIJA_PRACENJE_TIMEOUT_MIN, SESIJA_PRACENJE_TIMEOUT_MAX);
}

function sesija_pracenje_aktivnosti_cleanup_interval_sec(mysqli $mysqli): int
{
    return sesija_pracenje_aktivnosti_varijabla_int($mysqli, 113, 60, 30, 3600);
}

/**
 * Trajanje kolačića pri prvom session_start (SELECT prije session_start).
 */
function sesija_pracenje_aktivnosti_cookie_max_age_pri_startu(): int
{
    require_once __DIR__ . '/vnlh_db_connect.php';
    $mysqli = vnlh_db_connect();
    if ($mysqli === false) {
        return 90;
    }
    $sec = sesija_pracenje_aktivnosti_session_timeout_sec($mysqli);
    $mysqli->close();
    return $sec;
}

/** Statički cache za Max-Age kolačića između zahtjeva (kratki TTL). */
function sesija_pracenje_aktivnosti_cookie_max_age_cached(): int
{
    static $cachedT = 0;
    static $cachedV = 90;
    $now = time();
    if ($now - $cachedT < 60) {
        return $cachedV;
    }
    $cachedT = $now;
    $cachedV = sesija_pracenje_aktivnosti_cookie_max_age_pri_startu();
    return $cachedV;
}

/**
 * @return array{ping_interval_sec:int,session_timeout_sec:int}
 */
function sesija_pracenje_aktivnosti_js_config_niz(mysqli $mysqli): array
{
    return [
        'ping_interval_sec'   => sesija_pracenje_aktivnosti_ping_interval_sec($mysqli),
        'session_timeout_sec' => sesija_pracenje_aktivnosti_session_timeout_sec($mysqli),
    ];
}

/**
 * Inline <script>: window.__VNLH_SESIJA_PING__ i token za sendBeacon (zatvaranje kartice).
 */
function sesija_pracenje_aktivnosti_inline_script_tag(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return '';
    }
    $uid = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
    if ($uid <= 0) {
        return '';
    }
    require_once __DIR__ . '/vnlh_db_connect.php';
    $mysqli = vnlh_db_connect();
    if ($mysqli === false) {
        return '';
    }
    $cfg = sesija_pracenje_aktivnosti_js_config_niz($mysqli);
    $mysqli->close();

    if (empty($_SESSION['sesija_pracenje_tab_close_token']) || !is_string($_SESSION['sesija_pracenje_tab_close_token'])) {
        try {
            $_SESSION['sesija_pracenje_tab_close_token'] = bin2hex(random_bytes(16));
        } catch (Throwable $e) {
            $_SESSION['sesija_pracenje_tab_close_token'] = bin2hex((string) random_int(0, PHP_INT_MAX));
        }
    }
    $token = (string) $_SESSION['sesija_pracenje_tab_close_token'];
    $jsonCfg = json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
    $jsonTok = json_encode($token, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
    if (!is_string($jsonCfg)) {
        $jsonCfg = '{}';
    }
    if (!is_string($jsonTok)) {
        $jsonTok = '""';
    }
    require_once __DIR__ . '/vnlh_paths.php';
    $loginPath = json_encode(vnlh_login_path(null), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
    if (!is_string($loginPath)) {
        $loginPath = '""';
    }
    $baseJs = vnlh_app_base_path_for_js();
    $phpRel = ($baseJs !== '' ? rtrim($baseJs, '/') . '/' : '') . 'php/sesija_ping.php';
    $closeRel = ($baseJs !== '' ? rtrim($baseJs, '/') . '/' : '') . 'php/sesija_zatvori_karticu.php';
    $pingUrlJ = json_encode($phpRel, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
    $closeUrlJ = json_encode($closeRel, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
    if (!is_string($pingUrlJ)) {
        $pingUrlJ = '""';
    }
    if (!is_string($closeUrlJ)) {
        $closeUrlJ = '""';
    }
    return '<script>window.__VNLH_SESIJA_PING__=' . $jsonCfg . ';window.__VNLH_SESIJA_TAB_CLOSE_TOKEN__=' . $jsonTok . ';window.__VNLH_LOGIN_URL__=' . $loginPath . ';window.__VNLH_SESIJA_PING_URL__=' . $pingUrlJ . ';window.__VNLH_SESIJA_TAB_CLOSE_URL__=' . $closeUrlJ . ';</script>';
}

/**
 * Ako red u sustav_sesije_aktivne ne postoji, nije aktivna ili je zadnja_aktivnost starija od session_timeout_sec:
 * uništava PHP sesiju i prekida zahtjev (401 ili redirect).
 */
function sesija_pracenje_aktivnosti_odjava_ako_red_ne_valja(mysqli $mysqli, string $mode): void
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

    $timeoutSec = sesija_pracenje_aktivnosti_session_timeout_sec($mysqli);

    $stmt = $mysqli->prepare(
        'SELECT id, status, zadnja_aktivnost FROM sustav_sesije_aktivne WHERE session_id = ? AND id_korisnik = ? LIMIT 1'
    );
    if (!$stmt) {
        return;
    }
    $stmt->bind_param('si', $sid, $uid);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    $mustExit = false;

    if (!$row || !isset($row['status'])) {
        $mustExit = true;
    } else {
        $st = (string) $row['status'];
        if ($st !== 'aktivna') {
            $mustExit = true;
        } else {
            $za = isset($row['zadnja_aktivnost']) ? strtotime((string) $row['zadnja_aktivnost']) : false;
            if ($za === false) {
                $mustExit = true;
            } elseif ((time() - (int) $za) > $timeoutSec) {
                $idRow = (int) ($row['id'] ?? 0);
                if ($idRow > 0) {
                    $u = $mysqli->prepare(
                        'UPDATE sustav_sesije_aktivne SET status = \'timeout\', zadnja_aktivnost = NOW() WHERE id = ? AND id_korisnik = ? AND status = \'aktivna\''
                    );
                    if ($u) {
                        $u->bind_param('ii', $idRow, $uid);
                        $u->execute();
                        $u->close();
                    }
                }
                $mustExit = true;
            }
        }
    }

    if (!$mustExit) {
        return;
    }

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $p['path'] ?: '/',
            'domain'   => $p['domain'] ?? '',
            'secure'   => $p['secure'] ?? false,
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
