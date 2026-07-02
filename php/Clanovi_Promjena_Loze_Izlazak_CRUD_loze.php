<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
// Popis svih loža (id, naziv, id_tip_loze) — id_tip_loze služi za filtriranje odlazne lože po tipu.
$result = $mysqli->query("SELECT id, naziv, id_tip_loze FROM loze ORDER BY naziv ASC");
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) $rows[] = $row;
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();
