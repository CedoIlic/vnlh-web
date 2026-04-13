<?php
require_once __DIR__ . '/require_login_api.php';
// E_maili_CRUD_izmjena.php – izmjena e-maila po id.
// POST: id (obavezno), id_clanovi (obavezno), id_email_tip (obavezno), email (obavezno).
// Izlaz (TEXT): OK | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$id_clanovi = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;
$id_email_tip = isset($_POST['id_email_tip']) ? (int)$_POST['id_email_tip'] : 0;
$email = isset($_POST['email']) ? trim((string)$_POST['email']) : '';

if ($id <= 0 || $id_clanovi <= 0 || $id_email_tip <= 0 || $email === '') {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare("UPDATE e_maili SET id_clanovi = ?, id_email_tip = ?, email = ? WHERE id = ? AND id_clanovi = ?");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('iisii', $id_clanovi, $id_email_tip, $email, $id, $id_clanovi);
if ($stmt->execute() && $stmt->affected_rows > 0) {
    echo 'OK';
} else {
    echo $stmt->errno ? '200,' . $stmt->errno : '105';
}
$stmt->close();
$mysqli->close();
