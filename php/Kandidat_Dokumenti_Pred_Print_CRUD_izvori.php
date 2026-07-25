<?php
require_once __DIR__ . '/require_login_api.php';
// Bijela lista tablica koje smiju biti izvor (subjekt) dokumenta — ponuda za „Izvor tablica".
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$result = $mysqli->query("SELECT tablica FROM pdf_dozvoljeni_izvori_dokumenata ORDER BY tablica ASC");
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$rows = [];
while ($row = $result->fetch_assoc()) $rows[] = $row;
header('Content-Type: application/json');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();
?>
