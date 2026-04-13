<?php
require_once __DIR__ . '/require_login_api.php';
// Alati_LogPass_Ini_CRUD_brisanje.php – NULL na login, pass i pass_status; login_neuspjesni_pokusaji = 0; red u tablici ostaje.
// POST: id_korisnik
// Izlaz: OK | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$id = isset($_POST['id_korisnik']) ? (int) $_POST['id_korisnik'] : 0;
if ($id <= 0) {
    echo '105';
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare('SELECT 1 FROM sustav_korisnici WHERE id_korisnik = ? LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    echo '105';
    $mysqli->close();
    exit;
}
$stmt->close();

$stmt = $mysqli->prepare('UPDATE sustav_korisnici SET login = NULL, pass = NULL, pass_status = NULL, login_neuspjesni_pokusaji = 0 WHERE id_korisnik = ?');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $id);
if (!$stmt->execute()) {
    echo '200,' . $mysqli->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}
$stmt->close();
echo 'OK';
$mysqli->close();
