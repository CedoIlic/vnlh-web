<?php
require_once __DIR__ . '/require_login_api.php';
// Adrese_CRUD_brisanje.php – brisanje adrese po id.
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

// Dohvati id_clanovi prije brisanja (za ažuriranje clanovi.adresa).
$id_clanovi = null;
$res = $mysqli->query("SELECT id_clanovi FROM adrese WHERE id = " . (int)$id . " LIMIT 1");
if ($res && $row = $res->fetch_assoc()) {
    $id_clanovi = (int)$row['id_clanovi'];
}
if ($res) $res->free();

$stmt = $mysqli->prepare("DELETE FROM adrese WHERE id = ?");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id);
if (!$stmt->execute()) {
    echo '200,' . $stmt->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}
$deleted = $stmt->affected_rows > 0;
$stmt->close();

// Ako je obrisana adresa bila clanovi.adresa, postavi na drugu tip 1 ili NULL.
if ($deleted && $id_clanovi !== null) {
    $res = $mysqli->query("SELECT adresa FROM clanovi WHERE id = " . (int)$id_clanovi . " LIMIT 1");
    $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
    if ($res) $res->free();
    if ($row !== null && (int)$row['adresa'] === (int)$id) {
        $res2 = $mysqli->query("SELECT a.id FROM adrese a INNER JOIN adrese_tip at ON at.id = a.id_adrese_tip AND at.`Tip` = 1 WHERE a.id_clanovi = " . (int)$id_clanovi . " LIMIT 1");
        $new_fk = ($res2 && $res2->num_rows > 0 && $r = $res2->fetch_assoc()) ? (int)$r['id'] : null;
        if ($res2) $res2->free();
        $mysqli->query("UPDATE clanovi SET adresa = " . ($new_fk !== null ? $new_fk : 'NULL') . " WHERE id = " . (int)$id_clanovi);
    }
}
$mysqli->close();
echo $deleted ? 'OK' : '105';
