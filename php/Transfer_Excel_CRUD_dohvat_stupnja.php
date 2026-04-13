<?php
require_once __DIR__ . '/require_login_api.php';
// Transfer_Excel_CRUD_dohvat_stupnja.php – dohvat id stupnja po broju stupnja za obred 35.
// GET stupanj – broj iz kolone Stupanj radne tablice; vraća JSON { "id": <id> } ili { "id": null } ako nema reda u stupnjevi gdje stupanj = ? AND id_obred = 35.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$raw = isset($_GET['stupanj']) ? trim((string)$_GET['stupanj']) : '';
$stupanj_val = ($raw === '' || $raw === '0') ? null : (int)$raw;

header('Content-Type: application/json; charset=utf-8');

if ($stupanj_val === null) {
    echo json_encode(['id' => null], JSON_UNESCAPED_UNICODE);
    exit;
}

$id_obred = 35;
$sql = "SELECT id FROM stupnjevi WHERE stupanj = ? AND id_obred = ? LIMIT 1";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['id' => null, 'error' => $mysqli->errno], JSON_UNESCAPED_UNICODE);
    exit;
}
$stmt->bind_param('ii', $stupanj_val, $id_obred);
$stmt->execute();
$result = $stmt->get_result();
$row = $result ? $result->fetch_assoc() : null;
$stmt->close();
$mysqli->close();

$id = $row ? (int)$row['id'] : null;
echo json_encode(['id' => $id], JSON_UNESCAPED_UNICODE);
