<?php
require_once __DIR__ . '/require_login_api.php';
// Duznosnici_Osobe_CRUD_brisanje.php – uklanjanje jednog sloga u sustav_korisnici za par (dužnost, korisnik).
// POST: id_duznosnik, id_clanovi (= id_korisnik). DELETE WHERE id_duznosnik AND id_korisnik.
// Izlaz (TEXT): OK | 105 | 108,id | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$id_duznosnik = isset($_POST['id_duznosnik']) ? (int)$_POST['id_duznosnik'] : 0;
$id_clanovi   = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;

if ($id_duznosnik <= 0) {
    echo '108,' . $id_duznosnik;
    exit;
}
if ($id_clanovi <= 0) {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare('DELETE FROM sustav_korisnici WHERE id_duznosnik = ? AND id_korisnik = ?');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}

$stmt->bind_param('ii', $id_duznosnik, $id_clanovi);
if ($stmt->execute()) {
    echo $stmt->affected_rows > 0 ? 'OK' : '105';
} else {
    echo '200,' . $stmt->errno;
}
$stmt->close();
$mysqli->close();
