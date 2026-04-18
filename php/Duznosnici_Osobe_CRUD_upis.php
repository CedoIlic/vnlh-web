<?php
require_once __DIR__ . '/require_login_api.php';
// Duznosnici_Osobe_CRUD_upis.php – nova dodjela (id_korisnik, id_duznosnik) u sustav_korisnici.
// POST: id_duznosnik (obavezno), id_clanovi (obavezno) = id_korisnik (član.id u tablici clanovi).
// Ako par već postoji: OK (bez promjene). Inače INSERT — druga dužnost istom korisniku = novi redak.
// Član mora imati aktivnost = 1.
// Izlaz (TEXT): OK | 100 | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$id_duznosnik = isset($_POST['id_duznosnik']) ? (int)$_POST['id_duznosnik'] : 0;
$id_clanovi   = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;

if ($id_duznosnik <= 0 || $id_clanovi <= 0) {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare('SELECT id FROM duznosnici WHERE id = ? LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_duznosnik);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    echo '105';
    exit;
}
$stmt->close();

$stmt = $mysqli->prepare('SELECT id FROM clanovi WHERE id = ? AND aktivnost = 1 LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_clanovi);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    echo '105';
    exit;
}
$stmt->close();

$stmt = $mysqli->prepare('SELECT 1 FROM sustav_korisnici WHERE id_korisnik = ? AND id_duznosnik = ? LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('ii', $id_clanovi, $id_duznosnik);
$stmt->execute();
$stmt->store_result();
$postoji_par = $stmt->num_rows > 0;
$stmt->close();

if ($postoji_par) {
    echo 'OK';
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare('INSERT INTO sustav_korisnici (id_duznosnik, id_korisnik) VALUES (?, ?)');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('ii', $id_duznosnik, $id_clanovi);
$ok = $stmt->execute();
$stmt->close();

if (!$ok) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

echo 'OK';
$mysqli->close();
