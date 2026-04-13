<?php
require_once __DIR__ . '/require_login_api.php';
// Adrese_CRUD_sve.php – dohvat svih adresa za člana. GET id_clanovi.
// Vraća JSON: [{ "id", "id_adrese_tip", "id_drzave_adrese", "adresa_1", "adresa_2", "grad", "posta", "tip" }, ...]
// tip = 1/0 iz adrese_tip.Tip (primarni tip).
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

$sql = "SELECT a.id, a.id_adrese_tip, a.id_drzave_adrese, a.adresa_1, a.adresa_2, a.grad, a.posta, COALESCE(at.`Tip`, 0) AS tip
        FROM adrese a
        LEFT JOIN adrese_tip at ON at.id = a.id_adrese_tip
        WHERE a.id_clanovi = ?
        ORDER BY at.`Tip` DESC, a.id ASC";
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
        'id_adrese_tip' => $row['id_adrese_tip'] !== null ? (int)$row['id_adrese_tip'] : null,
        'id_drzave_adrese' => $row['id_drzave_adrese'] !== null ? (int)$row['id_drzave_adrese'] : null,
        'adresa_1' => $row['adresa_1'],
        'adresa_2' => $row['adresa_2'],
        'grad' => $row['grad'],
        'posta' => $row['posta'],
        'tip' => (int)$row['tip']
    ];
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
