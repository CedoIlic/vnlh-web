<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }
$result = $mysqli->query("SELECT id, naziv, opis, boja, boja_bg FROM zapisnik_boje_u_listi ORDER BY id ASC");
$rows = [];
if (!$result) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
while ($row = $result->fetch_assoc()) $rows[] = $row;
header('Content-Type: application/json');
echo json_encode($rows);
$mysqli->close();
