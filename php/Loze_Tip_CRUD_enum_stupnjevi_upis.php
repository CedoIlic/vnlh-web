<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
$id_vlasnik = isset($_POST['id_vlasnik']) ? (int)$_POST['id_vlasnik'] : 0;
if ($id_vlasnik <= 0) { echo '105'; exit; }
$id_pozicija = isset($_POST['id_pozicija']) ? (int)$_POST['id_pozicija'] : 1;
$id_stupnjevi = [];
if (isset($_POST['id_stupanj']) && is_array($_POST['id_stupanj'])) {
    foreach ($_POST['id_stupanj'] as $v) {
        $id = (int)$v;
        if ($id > 0) $id_stupnjevi[] = $id;
    }
}
try {
    $mysqli->begin_transaction();
    $stmt = $mysqli->prepare("DELETE FROM loze_tip_stupanj_enum WHERE id_vlasnik = ? AND id_pozicija = ?");
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("ii", $id_vlasnik, $id_pozicija);
    $stmt->execute();
    $stmt->close();
    $stmt = $mysqli->prepare("INSERT INTO loze_tip_stupanj_enum (id_vlasnik, id_stupanj, id_pozicija) VALUES (?, ?, ?)");
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    foreach ($id_stupnjevi as $id_stupanj) {
        $stmt->bind_param("iii", $id_vlasnik, $id_stupanj, $id_pozicija);
        $stmt->execute();
    }
    $stmt->close();
    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if (isset($mysqli)) $mysqli->rollback();
    echo '200,' . $e->getCode();
}
$mysqli->close();
?>
