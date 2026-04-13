<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$sql = "SELECT d.id, d.naziv, d.id_nadredjeni, n.naziv AS nadredjeni_naziv
        FROM duznosnici d
        LEFT JOIN duznosnici n ON n.id = d.id_nadredjeni
        ORDER BY d.naziv ASC";
$result = $mysqli->query($sql);
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    if ($row['id_nadredjeni'] == 0 || $row['id_nadredjeni'] === null) {
        $row['nadredjeni_naziv'] = '';
    }
    $rows[] = $row;
}
header('Content-Type: application/json');
echo json_encode($rows);
$mysqli->close();
?>
