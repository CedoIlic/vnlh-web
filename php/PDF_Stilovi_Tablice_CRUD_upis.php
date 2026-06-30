<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
require_once __DIR__ . '/PDF_Stilovi_Tablice_CRUD_polja.php';

$code = '';
$polja = pdf_tablica_stil_citaj_polja($code);
if ($polja === null) { echo $code; exit; }
$kolone = pdf_tablica_stil_citaj_kolone();
$naziv = $polja[0][2];

try {
    $stmt = $mysqli->prepare('SELECT id FROM pdf_tablica_stil WHERE LOWER(naziv) = LOWER(?) LIMIT 1');
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('s', $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { echo '002'; exit; }
    $stmt->close();

    $mysqli->begin_transaction();
    $cols = implode(', ', array_map(function ($f) { return '`' . $f[0] . '`'; }, $polja));
    $ph = implode(', ', array_fill(0, count($polja), '?'));
    $types = implode('', array_map(function ($f) { return $f[1]; }, $polja));
    $vals = array_map(function ($f) { return $f[2]; }, $polja);
    $stmt = $mysqli->prepare("INSERT INTO pdf_tablica_stil ($cols) VALUES ($ph)");
    call_user_func_array([$stmt, 'bind_param'], pdf_tablica_stil_bind_refs($types, $vals));
    $stmt->execute();
    $id = (int) $mysqli->insert_id;
    $stmt->close();

    pdf_tablica_stil_spremi_kolone($mysqli, $id, $kolone);
    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    echo '200,' . $e->getCode();
}
$mysqli->close();
