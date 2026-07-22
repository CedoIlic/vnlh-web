<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Zapisnik_CRUD_izmjena.php – izmjena veze (tip + bilješka) za dani red.
// POST: id, id_zapisnik_tip, biljeska. id_zapisnik/id_clan se NE mijenjaju.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

$id              = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$id_zapisnik_tip = isset($_POST['id_zapisnik_tip']) ? (int) $_POST['id_zapisnik_tip'] : 0;
$biljeska        = isset($_POST['biljeska']) ? trim((string) $_POST['biljeska']) : '';
if ($biljeska === '') { $biljeska = null; }
elseif (mb_strlen($biljeska, 'UTF-8') > 256) { $biljeska = mb_substr($biljeska, 0, 256, 'UTF-8'); }

if ($id <= 0 || $id_zapisnik_tip <= 0) { echo '105'; exit; }

try {
    $stmt = $mysqli->prepare("UPDATE kandidat_dokumenti_zapisnik SET id_zapisnik_tip = ?, biljeska = ? WHERE id = ?");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('isi', $id_zapisnik_tip, $biljeska, $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1452) { echo '107,' . $e->getCode(); exit; }   // FK: tip ne postoji
    echo '200,' . $e->getCode();
}
$mysqli->close();
?>
