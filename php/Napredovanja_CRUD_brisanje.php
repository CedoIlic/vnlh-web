<?php
require_once __DIR__ . '/require_login_api.php';
// Napredovanja_CRUD_brisanje.php – brisanje napredovanja po id (primarni ključ).
// POST: id (obavezno – id napredovanja iz desne tablice).
// Izlaz (TEXT): OK | 100 | 108,id | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;

if ($id <= 0) {
    echo '108,' . $id;
    exit;
}

$sql = "DELETE FROM napredovanja WHERE id = ?";
$stmt = $mysqli->prepare($sql);
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
