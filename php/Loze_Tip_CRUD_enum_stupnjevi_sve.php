<?php
require_once __DIR__ . '/require_login_api.php';
// Dohvat stupnjeva nadležnosti za vlasnika (loze_tip) i poziciju 1.
// GET: id_vlasnik (obavezno), id_pozicija (opcionalno, default 1)
// Izlaz (JSON): [ { "id": 1, "stupanj": 1 }, ... ] poredano po stupanj (id = stupnjevi.id za selekciju u modalu)
// Greška (TEXT): 105 | 200,<errno>

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }
$id_vlasnik = isset($_GET['id_vlasnik']) ? (int)$_GET['id_vlasnik'] : 0;
if ($id_vlasnik <= 0) { header('Content-Type: text/plain'); echo '105'; exit; }
$id_pozicija = isset($_GET['id_pozicija']) ? (int)$_GET['id_pozicija'] : 1;
try {
    $sql = "SELECT s.id, s.stupanj FROM loze_tip_stupanj_enum e JOIN stupnjevi s ON s.id = e.id_stupanj WHERE e.id_vlasnik = ? AND e.id_pozicija = ? ORDER BY s.stupanj ASC, s.naziv ASC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("ii", $id_vlasnik, $id_pozicija);
    $stmt->execute();
    $result = $stmt->get_result();
    if (!$result) { $stmt->close(); header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
    $rows = [];
    while ($row = $result->fetch_assoc()) $rows[] = $row;
    $stmt->close();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($rows);
} catch (mysqli_sql_exception $e) {
    header('Content-Type: text/plain');
    echo '200,' . $e->getCode();
}
$mysqli->close();
?>
