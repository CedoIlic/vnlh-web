<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_CRUD_sve_drzava.php – dohvat loza za jednu ili više država (samo id, naziv za select). GET id_drzava (broj ili zarezom odvojeni id-evi).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$raw = isset($_GET['id_drzava']) ? trim((string)$_GET['id_drzava']) : '';
$id_list = [];
if (strpos($raw, ',') !== false) {
    foreach (array_map('trim', explode(',', $raw)) as $part) {
        $id = (int) $part;
        if ($id > 0) $id_list[] = $id;
    }
} else {
    $id = (int) $raw;
    if ($id > 0) $id_list[] = $id;
}
if (count($id_list) === 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}

$placeholders = implode(',', array_fill(0, count($id_list), '?'));
$sql = "SELECT id, naziv FROM loze WHERE id_drzava IN ($placeholders) ORDER BY naziv ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param(str_repeat('i', count($id_list)), ...$id_list);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
