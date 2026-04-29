<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
if (!isset($_POST['naziv'])) {
    echo '105';
    exit;
}
$naziv = trim($_POST['naziv']);
if ($naziv === '') {
    echo '105';
    exit;
}
$redosljed = isset($_POST['redosljed']) ? trim($_POST['redosljed']) : '';
$redosljed_int = ($redosljed === '') ? null : (int) $redosljed;
if ($redosljed !== '' && ($redosljed_int === null || $redosljed_int < 1 || $redosljed_int > 99)) {
    echo '105';
    exit;
}
/** 0 ili 1 — smije li tip unosa nositi dužnosti na radovima */
$do_raw = isset($_POST['duznosnik_ok']) ? trim((string) $_POST['duznosnik_ok']) : '';
$duznosnik_ok = ($do_raw === '1' || $do_raw === 1 || $do_raw === true) ? 1 : 0;
/** 0 ili 1 — slobodan upis imena, lože i države za taj tip */
$su_raw = isset($_POST['slobodan_unos']) ? trim((string) $_POST['slobodan_unos']) : '';
$slobodan_unos = ($su_raw === '1' || $su_raw === 1 || $su_raw === true) ? 1 : 0;
$svc_raw = isset($_POST['svi_clanovi_obedijncije']) ? trim((string) $_POST['svi_clanovi_obedijncije']) : '';
$svi_clanovi_obedijncije = ($svc_raw === '1' || $svc_raw === 1 || $svc_raw === true) ? 1 : 0;
$boja_raw = isset($_POST['boja_prikaza']) ? trim((string) $_POST['boja_prikaza']) : '';
if (strlen($boja_raw) > 16) {
    echo '105';
    exit;
}
try {
    $stmt = $mysqli->prepare("SELECT id FROM radovi_prisustvo_tip WHERE LOWER(COALESCE(naziv, '')) = LOWER(?)");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('s', $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();
    $redosljed_val = ($redosljed_int === null || $redosljed_int < 1) ? 0 : $redosljed_int;
    /** NULL ako prazno — kao u Clanovi_Zastavice (#RRGGBBAA). */
    $stmt = $mysqli->prepare(
        'INSERT INTO radovi_prisustvo_tip (naziv, redosljed, duznosnik_ok, slobodan_unos, svi_clanovi_obedijncije, boja_prikaza) VALUES (?, ?, ?, ?, ?, NULLIF(TRIM(?), \'\'))'
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('siiiis', $naziv, $redosljed_val, $duznosnik_ok, $slobodan_unos, $svi_clanovi_obedijncije, $boja_raw);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
