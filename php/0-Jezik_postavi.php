<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// 0-Jezik_postavi.php
// Sprema jezik sučelja korisnika (sustav_korisnici_login.id_jezik) + sesija (i18n).
// Ulaz (POST): kod (2-3 slova, aktivan jezik)
// Izlaz (TEXT): OK | 105 (loš kod/sesija) | 106 (nepoznat/neaktivan jezik) | 200,<errno>
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$kod = isset($_POST['kod']) ? strtolower(trim($_POST['kod'])) : '';
$idKorisnik = (int) ($_SESSION['id_korisnik'] ?? 0);

if ($kod === '' || !preg_match('/^[a-z]{2,3}$/', $kod) || $idKorisnik <= 0) {
    echo '105';
    exit;
}

/* Razriješi kod → id aktivnog jezika. */
$idJezik = 0;
$stmt = $mysqli->prepare("SELECT id FROM sustav_jezici WHERE kod = ? AND aktivan = 1 LIMIT 1");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('s', $kod);
$stmt->execute();
$res = $stmt->get_result();
if ($res && ($row = $res->fetch_assoc())) {
    $idJezik = (int) $row['id'];
}
$stmt->close();

if ($idJezik <= 0) {
    echo '106';
    exit;
}

/* Persistiraj na korisnika + sesija (jezik_korisnika() čita $_SESSION['id_jezik']). */
$upd = $mysqli->prepare("UPDATE sustav_korisnici_login SET id_jezik = ? WHERE id_korisnik = ?");
if (!$upd) {
    echo '200,' . $mysqli->errno;
    exit;
}
$upd->bind_param('ii', $idJezik, $idKorisnik);
$upd->execute();
$upd->close();

$_SESSION['id_jezik'] = $idJezik;

echo 'OK';
$mysqli->close();
