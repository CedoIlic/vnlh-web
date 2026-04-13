<?php
require_once __DIR__ . '/require_login_api.php';
// Napredovanja_CRUD_sve.php – dohvat napredovanja za člana. GET id_clanovi.
// Vraća JSON: [{ "id", "id_stupanj", "id_tip_napredovanja", "id_loza_napredovanja", "datum_napredovanja", "loza_napredovanja", "stupanj", "naziv" }, ...] sortirano po stupanj (broj).
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

$sql = "SELECT n.id, n.id_stupanj, n.id_tip_napredovanja, n.id_loza_napredovanja,
        n.datum_napredovanja, n.loza_napredovanja,
        s.stupanj, s.naziv
        FROM napredovanja n
        JOIN stupnjevi s ON s.id = n.id_stupanj
        WHERE n.id_clanovi = ?
        ORDER BY s.stupanj ASC";
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
    $rows[] = $row;
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
