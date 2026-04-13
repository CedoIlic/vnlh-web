<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_CRUD_sve_regije.php – dohvat loza za jednu ili više regija.
// GET id_regija (broj ili zarezom odvojeni id-evi).
// Izlaz: [ { "id": 1, "naziv": "Loža", "regija_naziv": "Regija", "drzava_naziv": "Država" }, ... ]
// Format prikaza: naziv + ", " + regija_naziv + ", " + drzava_naziv
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$raw = isset($_GET['id_regija']) ? trim((string)$_GET['id_regija']) : '';
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
$sql = "SELECT l.id, l.naziv, r.naziv AS regija_naziv, d.naziv AS drzava_naziv
        FROM loze l
        JOIN regije r ON r.id = l.id_regija
        JOIN drzave d ON d.id = l.id_drzava
        WHERE l.id_regija IN ($placeholders) AND l.aktivnost = 1
        ORDER BY d.naziv ASC, r.naziv ASC, l.naziv ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}
$bind_types = str_repeat('i', count($id_list));
$stmt->bind_param($bind_types, ...$id_list);
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
