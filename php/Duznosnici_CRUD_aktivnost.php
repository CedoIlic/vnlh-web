<?php
/**
 * Brzi UPDATE samo kolone aktivnost (checkbox u tablici Dužnosnici_CRUD).
 * POST: id (int), aktivnost (0|1).
 */
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$aktivnost = isset($_POST['aktivnost']) ? (int)$_POST['aktivnost'] : -1;
if ($id <= 0 || ($aktivnost !== 0 && $aktivnost !== 1)) {
    echo '105';
    exit;
}
$stmt = $mysqli->prepare('UPDATE duznosnici SET aktivnost = ? WHERE id = ?');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('ii', $aktivnost, $id);
if ($stmt->execute()) {
    echo 'OK';
    $stmt->close();
    $mysqli->close();
    exit;
}
$stmt->close();
if ($mysqli->errno == 1451 || $mysqli->errno == 1452) {
    echo '107,' . $mysqli->errno;
    exit;
}
echo '200,' . $mysqli->errno;
$mysqli->close();
?>
