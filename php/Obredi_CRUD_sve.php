<?php
require_once __DIR__ . '/require_login_api.php';
// Obredi_CRUD_sve.php – dohvat svih obreda (sortirano po nazivu).
// Izlaz: JSON [ { "id": 1, "naziv": "..." }, ... ]
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$sql = "SELECT id, naziv FROM obredi ORDER BY naziv ASC";
$result = $mysqli->query($sql);
$obredi = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    $obredi[] = $row;
}
header('Content-Type: application/json');
echo json_encode($obredi);
$mysqli->close();
