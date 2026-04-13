<?php
require_once __DIR__ . '/require_login_api.php';
// Telefoni_CRUD_sve.php – dohvat svih telefona za člana. GET id_clanovi.
// Vraća JSON: [{ "id", "id_telefoni_tip", "telefon", "tip" }, ...]
// tip = 1/0 iz telefoni_tip.Tip (primarni tip).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_clanovi = isset($_GET['id_clanovi']) ? (int)$_GET['id_clanovi'] : 0;
if ($id_clanovi <= 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}

$sql = "SELECT t.id, t.id_telefoni_tip, t.telefon, COALESCE(tt.`Tip`, 0) AS tip
        FROM telefoni t
        LEFT JOIN telefoni_tip tt ON tt.id = t.id_telefoni_tip
        WHERE t.id_clanovi = ?
        ORDER BY tt.`Tip` DESC, t.id ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_clanovi);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = [
        'id' => (int)$row['id'],
        'id_telefoni_tip' => $row['id_telefoni_tip'] !== null ? (int)$row['id_telefoni_tip'] : null,
        'telefon' => $row['telefon'],
        'tip' => (int)$row['tip']
    ];
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
