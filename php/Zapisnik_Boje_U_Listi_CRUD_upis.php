<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
$id    = isset($_POST['id'])    ? (int)$_POST['id']         : 0;
$naziv = isset($_POST['naziv']) ? trim($_POST['naziv'])      : '';
$opis  = isset($_POST['opis'])  ? trim($_POST['opis'])       : null;
$boja  = isset($_POST['boja'])  ? trim($_POST['boja'])       : null;
if ($id < 1 || $id > 255 || $naziv === '') { echo '105'; exit; }
if ($boja === '') $boja = null;
if ($opis  === '') $opis  = null;
$stmt = $mysqli->prepare("SELECT id FROM zapisnik_boje_u_listi WHERE id = ? LIMIT 1");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param('i', $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) { $stmt->close(); echo '002'; exit; }
$stmt->close();
$stmt = $mysqli->prepare("INSERT INTO zapisnik_boje_u_listi (id, naziv, opis, boja) VALUES (?, ?, ?, ?)");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param('isss', $id, $naziv, $opis, $boja);
$stmt->execute();
echo 'OK';
$stmt->close();
$mysqli->close();
