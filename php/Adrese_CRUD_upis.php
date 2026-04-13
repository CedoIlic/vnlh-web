<?php
require_once __DIR__ . '/require_login_api.php';
// Adrese_CRUD_upis.php – upis nove adrese za člana.
// POST: id_clanovi (obavezno), id_adrese_tip (obavezno), id_drzave_adrese (opcionalno), adresa_1, adresa_2, grad, posta.
// Izlaz (TEXT): OK | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id_clanovi = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;
$id_adrese_tip = isset($_POST['id_adrese_tip']) ? (int)$_POST['id_adrese_tip'] : 0;
$id_drzave_adrese = isset($_POST['id_drzave_adrese']) && $_POST['id_drzave_adrese'] !== '' && $_POST['id_drzave_adrese'] !== '0' ? (int)$_POST['id_drzave_adrese'] : null;
$adresa_1 = isset($_POST['adresa_1']) ? trim((string)$_POST['adresa_1']) : '';
$adresa_2 = isset($_POST['adresa_2']) ? trim((string)$_POST['adresa_2']) : '';
$grad = isset($_POST['grad']) ? trim((string)$_POST['grad']) : '';
$posta = isset($_POST['posta']) ? trim((string)$_POST['posta']) : '';

if ($id_clanovi <= 0 || $id_adrese_tip <= 0) {
    echo '105';
    exit;
}

$stmt = $mysqli->prepare("INSERT INTO adrese (id_clanovi, id_adrese_tip, id_drzave_adrese, adresa_1, adresa_2, grad, posta) VALUES (?, ?, ?, ?, ?, ?, ?)");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('iiissss', $id_clanovi, $id_adrese_tip, $id_drzave_adrese, $adresa_1, $adresa_2, $grad, $posta);
if (!$stmt->execute()) {
    echo '200,' . $stmt->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}
$new_id = (int)$mysqli->insert_id;
$stmt->close();

// Ako je tip 1 (primarni), ažuriraj clanovi.adresa.
$res = $mysqli->query("SELECT 1 FROM adrese_tip WHERE id = " . (int)$id_adrese_tip . " AND `Tip` = 1 LIMIT 1");
if ($res && $res->num_rows > 0) {
    $res->free();
    $mysqli->query("UPDATE clanovi SET adresa = " . $new_id . " WHERE id = " . (int)$id_clanovi);
}
$mysqli->close();
echo 'OK';
