<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_spol.php – promjena spola (0|1) za jedan red. POST: id, spol (0 ili 1).
// Izlaz: OK | 100 | 105 | 200,errno
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$spol = isset($_POST['spol']) ? (int)$_POST['spol'] : -1;
if ($id <= 0 || ($spol !== 0 && $spol !== 1)) {
    header('Content-Type: text/plain');
    echo '105';
    exit;
}
$stmt = $mysqli->prepare("UPDATE clanovi SET spol = ? WHERE id = ?");
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('ii', $spol, $id);
if (!$stmt->execute()) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->close();
$mysqli->close();
header('Content-Type: text/plain');
echo 'OK';
