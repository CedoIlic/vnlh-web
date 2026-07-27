<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_MOK_CRUD_izmjena.php — izmjena teksta MOK bilješke (POST: id, tekst).
// Dopušteno SAMO autoru i SAMO unutar roka (sustav_varijable 128 mjeseci od datum_upisa).
// Kontrolna razina (varijabla 127) čita tuđe bilješke, ali ih NE smije mijenjati → 132.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
require_once __DIR__ . '/Clanovi_MOK_CRUD_prava.php';

$id    = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$tekst = isset($_POST['tekst']) ? trim((string) $_POST['tekst']) : '';
if ($id <= 0 || $tekst === '') { echo '105'; exit; }

$red = mok_red($mysqli, $id);
if (!$red) { echo '108'; exit; }                                   // zapis ne postoji (u međuvremenu obrisan)
if (!mok_smije_mijenjati($mysqli, $red)) { echo '132'; exit; }      // nije autor ili je rok istekao

try {
    $stmt = $mysqli->prepare('UPDATE clanovi_mok SET tekst = ?, datum_zadnje_izmjene = NOW() WHERE id = ?');
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('si', $tekst, $id);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
