<?php
/**
 * POST: id_duznosnik — nakon prijave s više dužnosti (sesija: needs_duznost_choice).
 * Postavlja id_duznosnik, puni izbornik i chat, INSERT aktivne sesije ako još nije bilo (MULTI_DUTY bez PASS_CHANGE).
 * Izlaz: OK | 105 | 401 | 403 | prazno
 */
require_once __DIR__ . '/auth_start.php';
require_once __DIR__ . '/vnlh_login_post_auth.php';

header('Content-Type: text/plain; charset=utf-8');

if (!isset($_SESSION['id_korisnik']) || !is_numeric($_SESSION['id_korisnik']) || (int) $_SESSION['id_korisnik'] <= 0) {
    http_response_code(401);
    echo '401';
    exit;
}

if (empty($_SESSION['needs_duznost_choice'])) {
    http_response_code(403);
    echo '403';
    exit;
}

if (!empty($_SESSION['must_change_password'])) {
    http_response_code(403);
    echo '403';
    exit;
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo '';
    exit;
}

$idKorisnik = (int) $_SESSION['id_korisnik'];
$idDuznosnik = isset($_POST['id_duznosnik']) ? (int) $_POST['id_duznosnik'] : 0;

if ($idDuznosnik <= 0) {
    echo '105';
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare(
    'SELECT 1 FROM sustav_korisnici WHERE id_korisnik = ? AND id_duznosnik = ? LIMIT 1'
);
if (!$stmt) {
    echo '';
    $mysqli->close();
    exit;
}
$stmt->bind_param('ii', $idKorisnik, $idDuznosnik);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    echo '105';
    $mysqli->close();
    exit;
}
$stmt->close();

$loginDisplay = isset($_SESSION['login_display']) ? (string) $_SESSION['login_display'] : '';

/** Prvi put nakon MULTI_DUTY (bez retka u sustav_sesije_aktivne): puni sve uključujući INSERT. */
$trebaPuniInsert = true;
$chk = $mysqli->prepare(
    'SELECT 1 FROM sustav_sesije_aktivne WHERE session_id = ? AND status = \'aktivna\' LIMIT 1'
);
if ($chk) {
    $sid = session_id();
    $chk->bind_param('s', $sid);
    $chk->execute();
    $chk->store_result();
    if ($chk->num_rows > 0) {
        $trebaPuniInsert = false;
    }
    $chk->close();
}

unset($_SESSION['needs_duznost_choice']);

if ($trebaPuniInsert) {
    vnlh_login_zavrsi_sesiju_puni_meni_chat_sesije($mysqli, $idKorisnik, $idDuznosnik, $loginDisplay);
} else {
    $_SESSION['id_duznosnik'] = $idDuznosnik;
    require_once __DIR__ . '/meni_za_sesiju.php';
    $_SESSION['vnlh_meni_dopustene'] = meni_za_sesiju_ucitaj_dopustene($mysqli, $idDuznosnik);
    require_once __DIR__ . '/poruke_chat_sesija.php';
    $_SESSION['chat_dozvoljen'] = poruke_chat_dozvoljen_za_korisnika($mysqli, $idKorisnik);
    vnlh_session_postavi_razinu_za_duznosnika($mysqli, $idDuznosnik);
}

$mysqli->close();
$_SESSION['last_activity'] = time();
vnlh_refresh_session_cookie();
echo 'OK';
