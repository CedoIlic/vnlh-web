<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_sve.php
// Dohvat svih jezika (sortirano po nazivu abecedno)
// =====================================================
//
// Izlaz (JSON):
// [
//   { "id": 1, "naziv": "..." },
//   { "id": 2, "naziv": "..." }
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

$sql = "SELECT id, naziv FROM jezici ORDER BY naziv ASC";

$result = $mysqli->query($sql);

$rows = [];

if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}

header('Content-Type: application/json');
echo json_encode($rows);

$mysqli->close();
?>
