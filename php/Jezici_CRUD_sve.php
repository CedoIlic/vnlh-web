<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_sve.php
// Dohvat svih jezika (sortirano po redoslijedu, pa nazivu)
// =====================================================
//
// Izlaz (JSON):
// [
//   { "id": 1, "kod": "hr", "naziv": "...", "zadani": 1, "aktivan": 1, "redoslijed": 1 },
//   ...
// ]
//
// Koristi centralnu konekciju: 00_db.php ($mysqli)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$sql = "SELECT j.id, j.kod, j.naziv, j.naziv_izvorni, j.zadani, j.aktivan, j.redoslijed, j.drzava_kod, d.naziv AS drzava_naziv
        FROM sustav_jezici j
        LEFT JOIN sustav_drzave d ON d.kod = j.drzava_kod
        ORDER BY j.redoslijed ASC, j.naziv ASC";

$result = $mysqli->query($sql);

$rows = [];

if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    $rows[] = [
        'id'            => (int) $row['id'],
        'kod'           => (string) $row['kod'],
        'naziv'         => (string) $row['naziv'],
        'naziv_izvorni' => ($row['naziv_izvorni'] !== null) ? (string) $row['naziv_izvorni'] : '',
        'zadani'        => (int) $row['zadani'],
        'aktivan'      => (int) $row['aktivan'],
        'redoslijed'   => (int) $row['redoslijed'],
        'drzava_kod'   => ($row['drzava_kod'] !== null) ? (string) $row['drzava_kod'] : '',
        'drzava_naziv' => ($row['drzava_naziv'] !== null) ? (string) $row['drzava_naziv'] : '',
    ];
}

header('Content-Type: application/json');
echo json_encode($rows);

$mysqli->close();
?>
