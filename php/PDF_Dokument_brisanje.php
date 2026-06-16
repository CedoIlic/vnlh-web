<?php
require_once __DIR__ . '/require_login_api.php';
// Brisanje dokumenta; stavke se brišu kaskadno (FK pdf_dokument_stavke.dokument_id ON DELETE CASCADE).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}
try {
    $stmt = $mysqli->prepare('DELETE FROM pdf_dokument WHERE id = ?');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
