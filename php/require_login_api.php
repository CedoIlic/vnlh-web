<?php
/**
 * Zaštita PHP API skripti (XHR). Isti idle kao stranice; neuspjeh → 401 tekst.
 */
require_once __DIR__ . '/auth_start.php';
require_once __DIR__ . '/vnlh_paths.php';

define('VNLH_SESSION_IDLE_SECONDS_API', 1800);

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

require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
Alati_Sesije_Aktivne_odjava_ako_red_timeout('api');

$now = time();
if (isset($_SESSION['last_activity']) && ($now - (int) $_SESSION['last_activity'] > VNLH_SESSION_IDLE_SECONDS_API)) {
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

Alati_Sesije_Aktivne_touch_request();
