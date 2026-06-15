<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
require_once __DIR__ . '/PDF_Whitelist_CRUD_polja.php';

$code = '';
$polja = pdf_whitelist_citaj_polja($mysqli, $code);
if ($polja === null) {
    echo $code;
    exit;
}

$naziv = $polja[0][2]; // prvi je 'naziv'

try {
    $stmt = $mysqli->prepare('SELECT id FROM pdf_dozvoljeni_izvori WHERE LOWER(naziv) = LOWER(?) LIMIT 1');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('s', $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();

    $cols = implode(', ', array_map(function ($f) {
        return '`' . $f[0] . '`';
    }, $polja));
    $ph = implode(', ', array_fill(0, count($polja), '?'));
    $types = implode('', array_map(function ($f) {
        return $f[1];
    }, $polja));
    $vals = array_map(function ($f) {
        return $f[2];
    }, $polja);

    $stmt = $mysqli->prepare("INSERT INTO pdf_dozvoljeni_izvori ($cols) VALUES ($ph)");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    call_user_func_array([$stmt, 'bind_param'], pdf_whitelist_bind_refs($types, $vals));
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
