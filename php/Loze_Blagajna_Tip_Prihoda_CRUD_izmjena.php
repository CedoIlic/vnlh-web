<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_Blagajna_Tip_Prihoda_CRUD_izmjena.php — izmjena tipa prihoda (POST: id, naziv, redosljed).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$naziv_raw = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$naziv_norm = mb_strtolower($naziv_raw, 'UTF-8');
if ($id <= 0 || $naziv_raw === '') { echo '105'; exit; }
$redosljed = isset($_POST['redosljed']) && $_POST['redosljed'] !== '' ? (int)$_POST['redosljed'] : 0;
if ($redosljed < 0) $redosljed = 0; elseif ($redosljed > 100) $redosljed = 100;
$stmt = $mysqli->prepare("SELECT id FROM loze_blagajna_tip_prihoda WHERE LOWER(naziv) = ? AND id <> ? LIMIT 1");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param("si", $naziv_norm, $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) { echo '002'; exit; }
$stmt->close();
$stmt = $mysqli->prepare("UPDATE loze_blagajna_tip_prihoda SET naziv = ?, redosljed = ? WHERE id = ?");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param("sii", $naziv_raw, $redosljed, $id);
if ($stmt->execute()) { echo 'OK'; exit; }
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) { echo '107,' . $mysqli->errno; exit; }
if ($mysqli->errno == 1062) { echo '109'; exit; }
echo '200,' . $mysqli->errno;
$mysqli->close();
