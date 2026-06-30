<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { echo $db_ret; exit; }
require_once __DIR__ . '/PDF_Stilovi_Tablice_CRUD_polja.php';

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) { echo '105'; exit; }

$code = '';
$polja = pdf_tablica_stil_citaj_polja($code);
if ($polja === null) { echo $code; exit; }
$kolone = pdf_tablica_stil_citaj_kolone();
$naziv = $polja[0][2];

try {
    $stmt = $mysqli->prepare('SELECT id FROM pdf_tablica_stil WHERE LOWER(naziv) = LOWER(?) AND id <> ? LIMIT 1');
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('si', $naziv, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) { echo '002'; exit; }
    $stmt->close();

    $mysqli->begin_transaction();
    $set = implode(', ', array_map(function ($f) { return '`' . $f[0] . '` = ?'; }, $polja));
    $types = implode('', array_map(function ($f) { return $f[1]; }, $polja)) . 'i';
    $vals = array_map(function ($f) { return $f[2]; }, $polja);
    $vals[] = $id;
    $stmt = $mysqli->prepare("UPDATE pdf_tablica_stil SET $set WHERE id = ?");
    call_user_func_array([$stmt, 'bind_param'], pdf_tablica_stil_bind_refs($types, $vals));
    $stmt->execute();
    $stmt->close();

    pdf_tablica_stil_spremi_kolone($mysqli, $id, $kolone);
    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    echo '200,' . $e->getCode();
}
$mysqli->close();
