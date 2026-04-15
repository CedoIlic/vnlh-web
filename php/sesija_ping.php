<?php
/**
 * sesija_ping.php
 * JSON ping: produžuje zadnja_aktivnost u sustav_sesije_aktivne i klizni kolačić sesije.
 * Ne uključuje require_login_api.php (izbjegava kružnu provjeru prije UPDATE-a).
 *
 * Izlaz: JSON { "ok": true } | { "ok": false, "reason": "expired"|"auth"|"db" }
 */
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/auth_start.php';

if (!isset($_SESSION['id_korisnik']) || (int) $_SESSION['id_korisnik'] <= 0) {
    echo json_encode(['ok' => false, 'reason' => 'auth'], JSON_UNESCAPED_UNICODE);
    exit;
}

/* Grace period: ping potvrđuje da je stranica još aktivna — obriši flag zatvaranja. */
if (!empty($_SESSION['tab_close_pending_at'])) {
    unset($_SESSION['tab_close_pending_at']);
}

if (!empty($_SESSION['must_change_password'])) {
    echo json_encode(['ok' => false, 'reason' => 'auth'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/vnlh_db_connect.php';
require_once __DIR__ . '/vnlh_login_failures.php';
require_once __DIR__ . '/sesija_pracenje_aktivnosti_lib.php';

$mysqli = vnlh_db_connect();
if ($mysqli === false) {
    echo json_encode(['ok' => false, 'reason' => 'db'], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int) $_SESSION['id_korisnik'];
if (!vnlh_auth_user_may_access($mysqli, $uid)) {
    $mysqli->close();
    echo json_encode(['ok' => false, 'reason' => 'auth'], JSON_UNESCAPED_UNICODE);
    exit;
}

$timeoutSec = sesija_pracenje_aktivnosti_session_timeout_sec($mysqli);
$sid = session_id();

$stmt = $mysqli->prepare(
    'SELECT id, status, zadnja_aktivnost FROM sustav_sesije_aktivne WHERE session_id = ? AND id_korisnik = ? LIMIT 1'
);
if (!$stmt) {
    $mysqli->close();
    echo json_encode(['ok' => false, 'reason' => 'db'], JSON_UNESCAPED_UNICODE);
    exit;
}
$stmt->bind_param('si', $sid, $uid);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();

if (!$row || ($row['status'] ?? '') !== 'aktivna') {
    require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
    Alati_Sesije_Aktivne_mark_timeout_session();
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
    $mysqli->close();
    echo json_encode(['ok' => false, 'reason' => 'expired'], JSON_UNESCAPED_UNICODE);
    exit;
}

$za = isset($row['zadnja_aktivnost']) ? strtotime((string) $row['zadnja_aktivnost']) : false;
if ($za === false || (time() - (int) $za) > $timeoutSec) {
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
    require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
    Alati_Sesije_Aktivne_mark_timeout_session();
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
    $mysqli->close();
    echo json_encode(['ok' => false, 'reason' => 'expired'], JSON_UNESCAPED_UNICODE);
    exit;
}

$idRow = (int) $row['id'];
$upd = $mysqli->prepare('UPDATE sustav_sesije_aktivne SET zadnja_aktivnost = NOW() WHERE id = ? AND id_korisnik = ? AND status = \'aktivna\'');
if (!$upd) {
    $mysqli->close();
    echo json_encode(['ok' => false, 'reason' => 'db'], JSON_UNESCAPED_UNICODE);
    exit;
}
$upd->bind_param('ii', $idRow, $uid);
$upd->execute();
$upd->close();
$mysqli->close();

$_SESSION['last_activity'] = time();
vnlh_refresh_session_cookie();

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
