<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$opis = isset($_POST['opis']) ? trim($_POST['opis']) : null;
$boja = isset($_POST['boja']) ? trim($_POST['boja']) : null;
$aktivnost = isset($_POST['aktivnost']) ? (int)$_POST['aktivnost'] : 0;
if ($id < 1 || $id > 16 || $naziv === '') { echo '105'; exit; }
if ($boja === '') $boja = null;
if ($aktivnost !== 1) $aktivnost = 0;
$stmt = $mysqli->prepare("UPDATE clanovi_zastavice SET naziv = ?, opis = ?, boja = ?, aktivnost = ? WHERE id = ?");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param("sssii", $naziv, $opis, $boja, $aktivnost, $id);
if ($stmt->execute()) { echo 'OK'; exit; }
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) { echo '107,' . $mysqli->errno; exit; }
if ($mysqli->errno == 1062) { echo '109'; exit; }
echo '200,' . $mysqli->errno;
$stmt->close();
$mysqli->close();
?>
