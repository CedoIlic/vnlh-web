<?php
/**
 * PDF_Whitelist_CRUD_meta.php — popis tablica i njihovih kolona iz trenutne baze (information_schema),
 * za kaskadne padajuće izbore u formi. Samo BASE TABLE. blob=1 → predlaže tip_podatka='slika'.
 * Vraća objekt: { "tablica": [ { "kolona": "...", "blob": 0|1 }, ... ], ... }
 */
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$sql = 'SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.COLUMN_COMMENT
        FROM information_schema.COLUMNS c
        JOIN information_schema.TABLES t
          ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = ?
        WHERE c.TABLE_SCHEMA = DATABASE()
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION';
$bt = 'BASE TABLE';
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('s', $bt);
$stmt->execute();
$res = $stmt->get_result();
$out = [];
while ($row = $res->fetch_assoc()) {
    $t = $row['TABLE_NAME'];
    if (!isset($out[$t])) {
        $out[$t] = [];
    }
    $out[$t][] = [
        'kolona' => $row['COLUMN_NAME'],
        'blob' => (stripos($row['DATA_TYPE'], 'blob') !== false) ? 1 : 0,
        'komentar' => $row['COLUMN_COMMENT'],
    ];
}
$stmt->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
$mysqli->close();
