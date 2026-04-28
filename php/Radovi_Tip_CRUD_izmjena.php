<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
$naziv_raw = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$naziv_norm = mb_strtolower($naziv_raw, 'UTF-8');
if ($id <= 0 || $naziv_raw === '') {
    echo '105';
    exit;
}
$redosljed = isset($_POST['redosljed']) ? trim($_POST['redosljed']) : '';
$redosljed_int = ($redosljed === '') ? 0 : (int) $redosljed;
if ($redosljed !== '' && ($redosljed_int < 1 || $redosljed_int > 99)) {
    echo '105';
    exit;
}
$stmt = $mysqli->prepare("SELECT id FROM radovi_tip WHERE LOWER(COALESCE(naziv, '')) = ? AND id <> ? LIMIT 1");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("si", $naziv_norm, $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    echo '002';
    exit;
}
$stmt->close();
$stmt = $mysqli->prepare("UPDATE radovi_tip SET naziv = ?, redosljed = ? WHERE id = ?");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("sii", $naziv_raw, $redosljed_int, $id);
if ($stmt->execute()) {
    echo 'OK';
    exit;
}
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) {
    echo '107,' . $mysqli->errno;
    exit;
}
if ($mysqli->errno == 1062) {
    echo '109';
    exit;
}
echo '200,' . $mysqli->errno;
$mysqli->close();
?>
