<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_CRUD_brisanje.php – DELETE loze. 1451 -> 106.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}
try {
    $stmt = $mysqli->prepare("DELETE FROM loze WHERE id = ?");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1451) {
        echo '106,' . $e->getCode();
        exit;
    }
    echo '200,' . $e->getCode();
}
$stmt->close();
$mysqli->close();
