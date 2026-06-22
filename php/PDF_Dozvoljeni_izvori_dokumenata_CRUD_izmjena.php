<?php
// PDF_Dozvoljeni_izvori_dokumenata_CRUD_izmjena.php — mijenja SAMO napomenu (tablica je nepromjenjiva).
require_once __DIR__ . '/require_login_api.php';
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

$napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
if ($napomena === '') {
    $napomena = null;
} elseif (mb_strlen($napomena, 'UTF-8') > 1024) {
    $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');
}

try {
    $st = $mysqli->prepare('UPDATE pdf_dozvoljeni_izvori_dokumenata SET napomena = ? WHERE id = ?');
    if (!$st) { echo '200,' . $mysqli->errno; exit; }
    $st->bind_param('si', $napomena, $id);
    $st->execute();
    echo 'OK';
    $st->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
