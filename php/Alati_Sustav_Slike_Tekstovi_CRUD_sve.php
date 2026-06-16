<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
// Bez BLOB-a (podatak) — samo metapodaci + zastavica ima li sadržaja.
$result = $mysqli->query(
    'SELECT id, naziv, tip_podatka, mime, napomena, (podatak IS NOT NULL) AS ima_podatak
     FROM sustav_slike_tekstovi ORDER BY naziv ASC'
);
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$rows = [];
while ($row = $result->fetch_assoc()) {
    $row['ima_podatak'] = (int) $row['ima_podatak'];
    $rows[] = $row;
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();
