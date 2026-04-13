<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_CRUD_loze_tip_sve.php – dohvat tipova lože za odabrani obred (za select u Loze CRUD).
// GET id_obred – ID obreda; vraća JSON [{ "id", "naziv" }, ...]. Ako id_obred nije izabran, vraća [].
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_obred = isset($_GET['id_obred']) ? (int)$_GET['id_obred'] : 0;
if ($id_obred <= 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}
$sql = "SELECT id, naziv FROM loze_tip WHERE id_obred = ? ORDER BY redosljed ASC, naziv ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_obred);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $rows[] = ['id' => (int)$row['id'], 'naziv' => $row['naziv']];
    }
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
