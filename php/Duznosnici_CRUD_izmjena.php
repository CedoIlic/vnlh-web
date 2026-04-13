<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$naziv_raw = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$id_nadredjeni = isset($_POST['id_nadredjeni']) ? (int)$_POST['id_nadredjeni'] : 0;
if ($id <= 0 || $naziv_raw === '') { echo '105'; exit; }
if ($id_nadredjeni === $id) { echo '105'; exit; }
$naziv_norm = mb_strtolower($naziv_raw, 'UTF-8');
$stmt = $mysqli->prepare("SELECT id FROM duznosnici WHERE LOWER(COALESCE(naziv,'')) = ? AND id <> ? LIMIT 1");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param("si", $naziv_norm, $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) { echo '002'; exit; }
$stmt->close();
$stmt = $mysqli->prepare("UPDATE duznosnici SET naziv = ?, id_nadredjeni = ? WHERE id = ?");
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param("sii", $naziv_raw, $id_nadredjeni, $id);
if ($stmt->execute()) { echo 'OK'; exit; }
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) { echo '107,' . $mysqli->errno; exit; }
if ($mysqli->errno == 1062) { echo '109'; exit; }
echo '200,' . $mysqli->errno;
$mysqli->close();
?>
