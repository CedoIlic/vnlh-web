<?php
require_once __DIR__ . '/require_login_api.php';
// Telefoni_CRUD_brisanje.php – brisanje telefona po id.
// POST: id (obavezno).
// Izlaz (TEXT): OK | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;

if ($id <= 0) {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare("DELETE FROM telefoni WHERE id = ?");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id);
if ($stmt->execute()) {
    echo $stmt->affected_rows > 0 ? 'OK' : '105';
} else {
    echo '200,' . $stmt->errno;
}
$stmt->close();
$mysqli->close();
