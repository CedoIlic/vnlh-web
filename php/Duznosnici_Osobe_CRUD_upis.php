<?php
require_once __DIR__ . '/require_login_api.php';
// Duznosnici_Osobe_CRUD_upis.php – upis / zamjena nosioca u tablici sustav_korisnici.
// POST: id_duznosnik (obavezno), id_clanovi (obavezno) = id_korisnik (član.id u tablici clanovi).
// Ako postoji redak s tim id_korisnik: UPDATE id_duznosnik. Inače INSERT (id_duznosnik, id_korisnik).
// Ako INSERT traži i login (NOT NULL bez defaulta), u bazi dodati default ili proširiti skriptu.
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

$stmt = $mysqli->prepare('SELECT 1 FROM sustav_korisnici WHERE id_korisnik = ? LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_clanovi);
$stmt->execute();
$stmt->store_result();
$postoji_korisnik = $stmt->num_rows > 0;
$stmt->close();

if (!$mysqli->begin_transaction()) {
    echo '200,' . $mysqli->errno;
    exit;
}

$ok = false;
if ($postoji_korisnik) {
    $stmt = $mysqli->prepare('UPDATE sustav_korisnici SET id_duznosnik = ? WHERE id_korisnik = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('ii', $id_duznosnik, $id_clanovi);
    $ok = $stmt->execute();
    $stmt->close();
} else {
    $stmt = $mysqli->prepare('INSERT INTO sustav_korisnici (id_duznosnik, id_korisnik) VALUES (?, ?)');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('ii', $id_duznosnik, $id_clanovi);
    $ok = $stmt->execute();
    $stmt->close();
}

if (!$ok) {
    $mysqli->rollback();
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

$mysqli->commit();
echo 'OK';
$mysqli->close();
