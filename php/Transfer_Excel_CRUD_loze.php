<?php
require_once __DIR__ . '/require_login_api.php';
// Transfer_Excel_CRUD_loze.php – dohvat svih loza (bez filtera po državi/regiji) za modal u Transfer Excel formi.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

// Sve lože, bez WHERE na id_regija / id_drzava; sortirano po nazivu.
$sql = "SELECT id, id_regija, id_obred, id_tip_loze, id_drzava, id_drzava_adrese, naziv,
        adresa_loze_1, adresa_loze_2, grad, posta, telefon_loze, meil_loze, datum_nastanka, napomena, aktivnost,
        (slika IS NOT NULL) AS ima_sliku
        FROM loze
        ORDER BY naziv";

$result = $mysqli->query($sql);
if (!$result) {
    $mysqli->close();
    header('Content-Type: application/json');
    echo '[]';
    exit;
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$result->free();
$mysqli->close();

header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);

