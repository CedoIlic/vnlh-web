<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) { echo '105'; exit; }
try {
    $mysqli->begin_transaction();
    $stmt = $mysqli->prepare("DELETE FROM loze_tip_stupanj_enum WHERE id_vlasnik = ?");
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    $stmt = $mysqli->prepare("DELETE FROM loze_tip WHERE id = ?");
    if (!$stmt) { $mysqli->rollback(); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    $mysqli->commit();
    echo 'OK';
    exit;
} catch (mysqli_sql_exception $e) {
    if (isset($mysqli)) $mysqli->rollback();
    if ($e->getCode() == 1451) { echo '106,' . $e->getCode(); exit; }
    echo '200,' . $e->getCode();
    exit;
}
$mysqli->close();
?>
