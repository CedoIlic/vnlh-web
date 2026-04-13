<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_CRUD_sve.php – dohvat loza za regiju (bez blob kolona). GET id_regija.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_regija = isset($_GET['id_regija']) ? (int)$_GET['id_regija'] : 0;
if ($id_regija <= 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}
$sql = "SELECT id, id_regija, id_obred, id_tip_loze, id_drzava, id_drzava_adrese, naziv,
        adresa_loze_1, adresa_loze_2, grad, posta, telefon_loze, meil_loze, datum_nastanka, napomena, aktivnost,
        (slika IS NOT NULL) AS ima_sliku
        FROM loze WHERE id_regija = ? ORDER BY naziv";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_regija);
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
