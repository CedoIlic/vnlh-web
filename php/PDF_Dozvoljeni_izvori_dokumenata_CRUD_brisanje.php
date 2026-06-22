<?php
// PDF_Dozvoljeni_izvori_dokumenata_CRUD_brisanje.php — miče tablicu iz dozvoljenih.
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
try {
    $st = $mysqli->prepare('DELETE FROM pdf_dozvoljeni_izvori_dokumenata WHERE id = ?');
    if (!$st) { echo '200,' . $mysqli->errno; exit; }
    $st->bind_param('i', $id);
    $st->execute();
    echo 'OK';
    $st->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
