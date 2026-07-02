<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
// Zapisi iz clanovi_izlazak (za Tab 2) — samo za odabranu ložu (id_loza_odlaska = id_loza).
// Sort: datum_izlaska DESC (najnoviji na vrhu). Tekst retka slaže klijent.
$id_loza = isset($_GET['id_loza']) ? (int)$_GET['id_loza'] : 0;
if ($id_loza <= 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}
$sql = "SELECT
            ci.id,
            ci.datum_izlaska,
            c.prezime,
            c.ime,
            t.naziv AS tip_naziv,
            t.kljuc AS tip_kljuc,
            lo.naziv AS loza_odlaska_naziv,
            ld.naziv AS loza_dolaska_naziv
        FROM clanovi_izlazak ci
        LEFT JOIN clanovi c ON c.id = ci.id_clan
        LEFT JOIN clanovi_izlazak_tip t ON t.id = ci.id_izlazak_tip
        LEFT JOIN loze lo ON lo.id = ci.id_loza_odlaska
        LEFT JOIN loze ld ON ld.id = ci.id_loza_dolaska
        WHERE ci.id_loza_odlaska = ?
        ORDER BY ci.datum_izlaska DESC, ci.id DESC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200|' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_loza);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();
