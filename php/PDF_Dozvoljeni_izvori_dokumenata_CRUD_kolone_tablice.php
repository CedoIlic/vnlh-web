<?php
// PDF_Dozvoljeni_izvori_dokumenata_CRUD_kolone_tablice.php
// Sve ne-BLOB/TEXT kolone tablice (?tablica=X) — za modal izbora dozvoljenih kolona.
// Radi i za novi izvor (još nije snimljen) i za postojeći jer ide po NAZIVU tablice.
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
header('Content-Type: application/json; charset=utf-8');
$tablica = isset($_GET['tablica']) ? trim((string) $_GET['tablica']) : '';
if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $tablica)) { echo '[]'; exit; }

$stmt = $mysqli->prepare(
    "SELECT COLUMN_NAME AS naziv FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND DATA_TYPE NOT IN ('blob','tinyblob','mediumblob','longblob','text','tinytext','mediumtext','longtext')
     ORDER BY ORDINAL_POSITION");
if (!$stmt) { echo '[]'; exit; }
$stmt->bind_param('s', $tablica);
$stmt->execute();
$res = $stmt->get_result();
$out = [];
while ($r = $res->fetch_assoc()) $out[] = $r['naziv'];
$stmt->close();
echo json_encode($out, JSON_UNESCAPED_UNICODE);
$mysqli->close();
