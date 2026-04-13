<?php
/**
 * Obvezna promjena lozinke nakon prijave (sesija: must_change_password).
 * POST: pass_new, pass_confirm — plain text; uspjeh: UPDATE pass, pass_status=0; Izlaz: OK | 025 | 026 | prazno
 * Pet neuspjelih pokušaja (025) → pass_status=2, odjava, 026.
 */
require_once __DIR__ . '/auth_start.php';
require_once __DIR__ . '/vnlh_login_failures.php';
require_once __DIR__ . '/vnlh_password_policy.php';

header('Content-Type: text/plain; charset=utf-8');

if (!isset($_SESSION['id_korisnik']) || !is_numeric($_SESSION['id_korisnik']) || (int) $_SESSION['id_korisnik'] <= 0) {
    http_response_code(401);
    echo '401';
    exit;
}

if (empty($_SESSION['must_change_password'])) {
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

$passNew = isset($_POST['pass_new']) ? (string) $_POST['pass_new'] : '';
$passConfirm = isset($_POST['pass_confirm']) ? (string) $_POST['pass_confirm'] : '';

if ($passNew !== $passConfirm || trim($passNew) === '') {
    vnlh_login_pass_change_reject($mysqli, $idKorisnik);
}

if (!vnlh_password_meets_policy($passNew)) {
    vnlh_login_pass_change_reject($mysqli, $idKorisnik);
}

$hash = password_hash($passNew, PASSWORD_DEFAULT);
if ($hash === false) {
    $mysqli->close();
    echo '';
    exit;
}

/* Opcionalno novo korisničko ime (prazno = ne mijenjaj login, samo lozinku) */
$loginNew = isset($_POST['login_new']) ? trim((string) $_POST['login_new']) : '';

if ($loginNew !== '') {
    /* Provjera jedinstvenosti — case-insensitive, isključi trenutnog korisnika */
    $stmtChk = $mysqli->prepare(
        'SELECT id_korisnik FROM sustav_korisnici WHERE LOWER(TRIM(login)) = LOWER(?) AND id_korisnik <> ? LIMIT 1'
    );
    if (!$stmtChk) {
        $mysqli->close();
        echo '';
        exit;
    }
    $stmtChk->bind_param('si', $loginNew, $idKorisnik);
    $stmtChk->execute();
    $resChk = $stmtChk->get_result();
    $postojiDuplikat = $resChk && $resChk->num_rows > 0;
    $stmtChk->close();
    if ($postojiDuplikat) {
        $mysqli->close();
        echo '027';
        exit;
    }

    /* UPDATE login + pass + pass_status */
    $stmt = $mysqli->prepare('UPDATE sustav_korisnici SET login = ?, pass = ?, pass_status = 0 WHERE id_korisnik = ? LIMIT 1');
    if (!$stmt) {
        $mysqli->close();
        echo '';
        exit;
    }
    $stmt->bind_param('ssi', $loginNew, $hash, $idKorisnik);
} else {
    /* Samo promjena lozinke (postojeće ponašanje) */
    $stmt = $mysqli->prepare('UPDATE sustav_korisnici SET pass = ?, pass_status = 0 WHERE id_korisnik = ? LIMIT 1');
    if (!$stmt) {
        $mysqli->close();
        echo '';
        exit;
    }
    $stmt->bind_param('si', $hash, $idKorisnik);
}

if (!$stmt->execute() || $stmt->affected_rows < 1) {
    $stmt->close();
    $mysqli->close();
    echo '';
    exit;
}
$stmt->close();

vnlh_login_reset_failures($mysqli, $idKorisnik);
$mysqli->close();

unset($_SESSION['must_change_password']);
$_SESSION['last_activity'] = time();
vnlh_refresh_session_cookie();

echo 'OK';
