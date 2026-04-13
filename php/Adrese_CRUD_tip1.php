<?php
require_once __DIR__ . '/require_login_api.php';
// Adrese_CRUD_tip1.php – dohvat adrese s tipom 1 (primarni) za člana.
// GET id_clanovi. Vraća JSON: { adresa_1, adresa_2, grad, posta, id_drzava_adrese } ili {} ako nema.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_clanovi = isset($_GET['id_clanovi']) ? (int)$_GET['id_clanovi'] : 0;
if ($id_clanovi <= 0) {
    header('Content-Type: application/json; charset=utf-8');
    echo '{}';
    exit;
}

$sql = "SELECT a.adresa_1, a.adresa_2, a.grad, a.posta, a.id_drzave_adrese
        FROM adrese a
        INNER JOIN adrese_tip at ON at.id = a.id_adrese_tip AND at.`Tip` = 1
        WHERE a.id_clanovi = ?
        LIMIT 1";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_clanovi);
$stmt->execute();
$result = $stmt->get_result();
$out = null;
if ($row = $result->fetch_assoc()) {
    $out = [
        'adresa_1' => $row['adresa_1'] ?? '',
        'adresa_2' => $row['adresa_2'] ?? '',
        'grad' => $row['grad'] ?? '',
        'posta' => $row['posta'] ?? '',
        'id_drzava_adrese' => $row['id_drzave_adrese'] !== null ? (int)$row['id_drzave_adrese'] : null
    ];
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($out !== null ? $out : (object)[], JSON_UNESCAPED_UNICODE);
