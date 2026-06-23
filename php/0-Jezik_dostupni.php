<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// 0-Jezik_dostupni.php
// Aktivni jezici za globalni prebacivač u zaglavlju (0-Jezik.js).
// Izlaz (JSON): [ { "kod","naziv","naziv_izvorni","drzava_kod","zadani" }, ... ] sortirano po redoslijedu.
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$sql = "SELECT kod, naziv, naziv_izvorni, drzava_kod, zadani
        FROM sustav_jezici
        WHERE aktivan = 1
        ORDER BY redoslijed ASC, naziv ASC";
$result = $mysqli->query($sql);
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}

$rows = [];
while ($r = $result->fetch_assoc()) {
    $rows[] = [
        'kod'           => (string) $r['kod'],
        'naziv'         => (string) $r['naziv'],
        'naziv_izvorni' => ($r['naziv_izvorni'] !== null) ? (string) $r['naziv_izvorni'] : '',
        'drzava_kod'    => ($r['drzava_kod'] !== null) ? (string) $r['drzava_kod'] : '',
        'zadani'        => (int) $r['zadani'],
    ];
}

header('Content-Type: application/json');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);

$mysqli->close();
