<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_drzave_sve.php
// Sve države za modal aktiviranja zastava (kod, naziv, aktivan).
// Izlaz (JSON): [ { "kod": "hr", "naziv": "Hrvatska", "aktivan": 1 }, ... ]
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$result = $mysqli->query("SELECT kod, naziv, slika_naziv, aktivan FROM sustav_drzave ORDER BY naziv ASC");
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}

$rows = [];
while ($r = $result->fetch_assoc()) {
    $rows[] = [
        'kod'         => (string) $r['kod'],
        'naziv'       => (string) $r['naziv'],
        'slika_naziv' => ($r['slika_naziv'] !== null) ? (string) $r['slika_naziv'] : '',
        'aktivan'     => (int) $r['aktivan'],
    ];
}

header('Content-Type: application/json');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);

$mysqli->close();
