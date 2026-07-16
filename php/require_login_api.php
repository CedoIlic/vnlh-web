<?php
/**
 * Zaštita PHP API skripti (XHR). Isti idle kao stranice; neuspjeh → 401 tekst.
 */
require_once __DIR__ . '/auth_start.php';
require_once __DIR__ . '/vnlh_paths.php';

// API odgovori se NE keširaju — inače preglednik u drugom tabu posluži stari GET (staro stanje) dok se ne
// forsira Ctrl+F5. Vrijedi za sve API endpointe (svi uvlače ovaj file); statika (JS/CSS/slike) ide zasebno.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if (!isset($_SESSION['id_korisnik']) || !is_numeric($_SESSION['id_korisnik']) || (int) $_SESSION['id_korisnik'] <= 0) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo '401';
    exit;
}

if (!empty($_SESSION['must_change_password'])) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'PASS_CHANGE_REQUIRED';
    exit;
}

if (!empty($_SESSION['needs_duznost_choice'])) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'NEEDS_DUTY_CHOICE';
    exit;
}

require_once __DIR__ . '/vnlh_db_connect.php';
require_once __DIR__ . '/vnlh_login_failures.php';
$vnlhAuthDb = vnlh_db_connect();
if ($vnlhAuthDb === false) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo '503';
    exit;
}
if (!vnlh_auth_user_may_access($vnlhAuthDb, (int) $_SESSION['id_korisnik'])) {
    vnlh_session_destroy_logout();
    $vnlhAuthDb->close();
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo '401';
    exit;
}
$vnlhAuthDb->close();

/** Stare XHR sesije: duznosnici.razina u sesiji (kao require_login). */
if (!array_key_exists('id_duznosnik_razina', $_SESSION)) {
    $idDuzApi = isset($_SESSION['id_duznosnik']) ? (int) $_SESSION['id_duznosnik'] : 0;
    if ($idDuzApi > 0) {
        $dbRz = vnlh_db_connect();
        if ($dbRz !== false) {
            require_once __DIR__ . '/vnlh_login_post_auth.php';
            vnlh_session_postavi_razinu_za_duznosnika($dbRz, $idDuzApi);
            $dbRz->close();
        } else {
            $_SESSION['id_duznosnik_razina'] = 0;
        }
    } else {
        $_SESSION['id_duznosnik_razina'] = 0;
    }
}

/** Stare XHR sesije bez punog require_login.php: pravo na chat (varijabla 110). */
if (!array_key_exists('chat_dozvoljen', $_SESSION) && isset($_SESSION['id_korisnik'])) {
    $idK = (int) $_SESSION['id_korisnik'];
    if ($idK > 0) {
        require_once __DIR__ . '/poruke_chat_sesija.php';
        $dbChat = vnlh_db_connect();
        if ($dbChat !== false) {
            $_SESSION['chat_dozvoljen'] = poruke_chat_dozvoljen_za_korisnika($dbChat, $idK);
            $dbChat->close();
        } else {
            $_SESSION['chat_dozvoljen'] = 0;
        }
    } else {
        $_SESSION['chat_dozvoljen'] = 0;
    }
}

require_once __DIR__ . '/sesija_pracenje_aktivnosti_lib.php';
$apiScript = basename($_SERVER['SCRIPT_NAME'] ?? '');
$mysqliSesApi = vnlh_db_connect();
$idleSecApi = 90;
if ($mysqliSesApi !== false) {
    if ($apiScript !== 'sesija_ping.php' && $apiScript !== 'sesija_zatvori_karticu.php') {
        sesija_pracenje_aktivnosti_odjava_ako_red_ne_valja($mysqliSesApi, 'api');
    }
    $idleSecApi = sesija_pracenje_aktivnosti_session_timeout_sec($mysqliSesApi);
    $mysqliSesApi->close();
}

$now = time();
if (isset($_SESSION['last_activity']) && ($now - (int) $_SESSION['last_activity'] > $idleSecApi)) {
    require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
    Alati_Sesije_Aktivne_mark_timeout_session();
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
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo '401';
    exit;
}

$_SESSION['last_activity'] = $now;
vnlh_refresh_session_cookie();

require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
Alati_Sesije_Aktivne_touch_request();
