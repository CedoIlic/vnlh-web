<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$naziv_raw = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$naziv_norm = mb_strtolower($naziv_raw, 'UTF-8');
if ($id <= 0 || $naziv_raw === '') {
    echo '105';
    exit;
}
$redosljed = isset($_POST['redosljed']) ? trim($_POST['redosljed']) : '';
$redosljed_int = ($redosljed === '') ? 0 : (int) $redosljed;
if ($redosljed !== '' && ($redosljed_int < 1 || $redosljed_int > 99)) {
    echo '105';
    exit;
}
$do_raw = isset($_POST['duznosnik_ok']) ? trim((string) $_POST['duznosnik_ok']) : '';
$duznosnik_ok = ($do_raw === '1' || $do_raw === 1 || $do_raw === true) ? 1 : 0;
$su_raw = isset($_POST['slobodan_unos']) ? trim((string) $_POST['slobodan_unos']) : '';
$slobodan_unos = ($su_raw === '1' || $su_raw === 1 || $su_raw === true) ? 1 : 0;
$svc_raw = isset($_POST['svi_clanovi_obedijncije']) ? trim((string) $_POST['svi_clanovi_obedijncije']) : '';
$svi_clanovi_obedijncije = ($svc_raw === '1' || $svc_raw === 1 || $svc_raw === true) ? 1 : 0;
$boja_raw = isset($_POST['boja_prikaza']) ? trim((string) $_POST['boja_prikaza']) : '';
if (strlen($boja_raw) > 16) {
    echo '105';
    exit;
}
$stmt = $mysqli->prepare("SELECT id FROM radovi_prisustvo_tip WHERE LOWER(COALESCE(naziv, '')) = ? AND id <> ? LIMIT 1");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('si', $naziv_norm, $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    echo '002';
    exit;
}
$stmt->close();
$stmt = $mysqli->prepare(
    'UPDATE radovi_prisustvo_tip SET naziv = ?, redosljed = ?, duznosnik_ok = ?, slobodan_unos = ?, svi_clanovi_obedijncije = ?, boja_prikaza = NULLIF(TRIM(?), \'\') WHERE id = ?'
);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('siiiisi', $naziv_raw, $redosljed_int, $duznosnik_ok, $slobodan_unos, $svi_clanovi_obedijncije, $boja_raw, $id);
if ($stmt->execute()) {
    echo 'OK';
    exit;
}
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) {
    echo '107,' . $mysqli->errno;
    exit;
}
if ($mysqli->errno == 1062) {
    echo '109';
    exit;
}
echo '200,' . $mysqli->errno;
$mysqli->close();
