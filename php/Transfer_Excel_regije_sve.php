<?php
require_once __DIR__ . '/require_login_api.php';
// Transfer_Excel_regije_sve.php – dohvat svih regija (id, naziv) za dropdown u modalu odabira lože.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$sql = "SELECT id, naziv FROM regije ORDER BY naziv";
$result = $mysqli->query($sql);
$rows = [];
if (!$result) {
    header('Content-Type: application/json');
    echo '[]';
    $mysqli->close();
    exit;
}
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
