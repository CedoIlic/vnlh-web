<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
if (!isset($_POST['naziv'])) { echo '105'; exit; }
$naziv = trim($_POST['naziv']);
if ($naziv === '') { echo '105'; exit; }
$redosljed = isset($_POST['redosljed']) && $_POST['redosljed'] !== '' ? (int)$_POST['redosljed'] : 0;
$kljuc = isset($_POST['kljuc']) && $_POST['kljuc'] !== '' ? (int)$_POST['kljuc'] : 0;
if ($redosljed < 0) $redosljed = 0; elseif ($redosljed > 100) $redosljed = 100;
if ($kljuc < 0) $kljuc = 0; elseif ($kljuc > 100) $kljuc = 100;
try {
    $stmt = $mysqli->prepare("SELECT id FROM clanovi_izlazak_tip WHERE LOWER(naziv) = LOWER(?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("s", $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { echo '002'; exit; }
    $stmt->close();
    $stmt = $mysqli->prepare("INSERT INTO clanovi_izlazak_tip (naziv, redosljed, kljuc) VALUES (?, ?, ?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("sii", $naziv, $redosljed, $kljuc);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) { echo '200,' . $e->getCode(); }
$mysqli->close();
?>
