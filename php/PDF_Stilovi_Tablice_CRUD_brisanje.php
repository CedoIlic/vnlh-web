<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) { echo '105'; exit; }

try {
    // Stupci (pdf_tablica_stil_kolona) se brišu kaskadno (FK ON DELETE CASCADE).
    $stmt = $mysqli->prepare('DELETE FROM pdf_tablica_stil WHERE id = ?');
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    // 1451 = FK: stil je u upotrebi (buduće pdf_dokument_stavke.tablica_stil_id)
    if ($e->getCode() == 1451) { echo '106,' . $e->getCode(); exit; }
    echo '200,' . $e->getCode();
}
$mysqli->close();
