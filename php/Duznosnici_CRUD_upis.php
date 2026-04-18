<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
if (!isset($_POST['naziv'])) { echo '105'; exit; }
$naziv = trim($_POST['naziv']);
if ($naziv === '') { echo '105'; exit; }
$id_nadredjeni = isset($_POST['id_nadredjeni']) ? (int)$_POST['id_nadredjeni'] : 0;
/* Nadređeni: 0 ili bilo koji postojeći id u duznosnici (vidi duznosnici_je_dopusten_nadredjeni_pri_insertu). */
if ($id_nadredjeni !== 0) {
    require_once __DIR__ . '/duznosnici_hijerarhija.php';
    if (!duznosnici_je_dopusten_nadredjeni_pri_insertu($mysqli, $id_nadredjeni)) {
        echo '105';
        exit;
    }
}
$aktivnost = isset($_POST['aktivnost']) ? (int)$_POST['aktivnost'] : 1;
if ($aktivnost !== 0 && $aktivnost !== 1) {
    $aktivnost = 1;
}
try {
    $stmt = $mysqli->prepare("SELECT id FROM duznosnici WHERE LOWER(COALESCE(naziv,'')) = LOWER(?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("s", $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { echo '002'; exit; }
    $stmt->close();
    $stmt = $mysqli->prepare("INSERT INTO duznosnici (naziv, id_nadredjeni, aktivnost) VALUES (?, ?, ?)");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("sii", $naziv, $id_nadredjeni, $aktivnost);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) { echo '200,' . $e->getCode(); }
$mysqli->close();
?>
