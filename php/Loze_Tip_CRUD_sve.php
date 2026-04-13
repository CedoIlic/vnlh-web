<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$obred_id = isset($_GET['obred_id']) ? (int)$_GET['obred_id'] : 0;
if ($obred_id <= 0) {
    header('Content-Type: text/plain');
    echo '105';
    exit;
}
$sql = "SELECT lt.id, lt.naziv, lt.redosljed,
  (SELECT GROUP_CONCAT(s.stupanj ORDER BY s.stupanj SEPARATOR ', ') FROM loze_tip_stupanj_enum e JOIN stupnjevi s ON s.id = e.id_stupanj WHERE e.id_vlasnik = lt.id AND e.id_pozicija = 1) AS nadleznost,
  (SELECT GROUP_CONCAT(s.stupanj ORDER BY s.stupanj SEPARATOR ', ') FROM loze_tip_stupanj_enum e JOIN stupnjevi s ON s.id = e.id_stupanj WHERE e.id_vlasnik = lt.id AND e.id_pozicija = 2) AS pregled
  FROM loze_tip lt WHERE lt.id_obred = ? ORDER BY lt.redosljed ASC, lt.naziv ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("i", $obred_id);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $stmt->close();
    exit;
}
while ($row = $result->fetch_assoc()) $rows[] = $row;
$stmt->close();
$mysqli->close();
header('Content-Type: application/json');
echo json_encode($rows);
?>
