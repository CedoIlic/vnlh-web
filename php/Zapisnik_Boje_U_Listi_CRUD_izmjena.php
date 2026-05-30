<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
$id    = isset($_POST['id'])    ? (int)$_POST['id']    : 0;
$naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$opis  = isset($_POST['opis'])  ? trim($_POST['opis'])  : null;
$boja  = isset($_POST['boja'])  ? trim($_POST['boja'])  : null;
if ($id < 1 || $id > 255 || $naziv === '') { echo '105'; exit; }
if ($boja === '') $boja = null;
if ($opis  === '') $opis  = null;
$stmt = $mysqli->prepare("UPDATE zapisnik_boje_u_listi SET naziv = ?, opis = ?, boja = ? WHERE id = ?");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param('sssi', $naziv, $opis, $boja, $id);
if ($stmt->execute()) { echo 'OK'; exit; }
if ($mysqli->errno == 1062) { echo '109'; exit; }
echo '200,' . $mysqli->errno;
$stmt->close();
$mysqli->close();
