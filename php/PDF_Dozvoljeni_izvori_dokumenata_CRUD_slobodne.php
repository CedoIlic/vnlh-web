<?php
// PDF_Dozvoljeni_izvori_dokumenata_CRUD_slobodne.php
// Tablice koje se MOGU dodati u selekt: bazne tablice koje imaju stupac `id`
// (razvojni blok veže testni kontekst na `id`) i koje JOŠ NISU uključene.
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$sql = "SELECT t.TABLE_NAME AS naziv
        FROM information_schema.TABLES t
        JOIN information_schema.COLUMNS c
          ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.COLUMN_NAME = 'id'
        WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE'
          AND t.TABLE_NAME NOT IN (SELECT tablica FROM pdf_dozvoljeni_izvori_dokumenata)
        ORDER BY t.TABLE_NAME";
$res = $mysqli->query($sql);
if (!$res) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$out = [];
while ($r = $res->fetch_assoc()) {
    $out[] = $r['naziv'];
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
$mysqli->close();
