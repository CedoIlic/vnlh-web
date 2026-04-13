<?php
require_once __DIR__ . '/require_login_api.php';
// Telefoni_CRUD_upis.php – upis novog telefona za člana.
// POST: id_clanovi (obavezno), id_telefoni_tip (obavezno), telefon (obavezno).
// Izlaz (TEXT): OK | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id_clanovi = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;
$id_telefoni_tip = isset($_POST['id_telefoni_tip']) ? (int)$_POST['id_telefoni_tip'] : 0;
$telefon = isset($_POST['telefon']) ? trim((string)$_POST['telefon']) : '';

if ($id_clanovi <= 0 || $id_telefoni_tip <= 0 || $telefon === '') {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare("INSERT INTO telefoni (id_clanovi, id_telefoni_tip, telefon) VALUES (?, ?, ?)");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('iis', $id_clanovi, $id_telefoni_tip, $telefon);
if ($stmt->execute()) {
    echo 'OK';
} else {
    echo '200,' . $stmt->errno;
}
$stmt->close();
$mysqli->close();
