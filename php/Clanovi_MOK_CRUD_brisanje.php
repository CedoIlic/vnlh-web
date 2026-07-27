<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_MOK_CRUD_brisanje.php — brisanje MOK bilješke (POST: id).
// Ista pravila kao izmjena: samo autor i samo unutar roka; kontrolna razina ne briše → 132.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
require_once __DIR__ . '/Clanovi_MOK_CRUD_prava.php';

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) { echo '105'; exit; }

$red = mok_red($mysqli, $id);
if (!$red) { echo 'OK'; exit; }                                    // već ga nema — brisanje je „uspjelo"
if (!mok_smije_mijenjati($mysqli, $red)) { echo '132'; exit; }

try {
    $stmt = $mysqli->prepare('DELETE FROM clanovi_mok WHERE id = ?');
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1451) { echo '106,' . $e->getCode(); exit; }
    echo '200,' . $e->getCode();
}
$mysqli->close();
