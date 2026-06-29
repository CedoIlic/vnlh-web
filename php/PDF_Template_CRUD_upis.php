<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
require_once __DIR__ . '/PDF_Template_CRUD_polja.php';

$code = '';
$polja = pdf_template_citaj_polja($code);
if ($polja === null) {
    echo $code;
    exit;
}

$naziv = $polja[0][2]; // prvi je 'naziv'
$okviri = pdf_template_citaj_okvire();

try {
    // Duplikat naziva
    $stmt = $mysqli->prepare('SELECT id FROM pdf_template WHERE LOWER(naziv) = LOWER(?) LIMIT 1');
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

    $mysqli->begin_transaction();
    $stmt = $mysqli->prepare("INSERT INTO pdf_template ($cols) VALUES ($ph)");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    call_user_func_array([$stmt, 'bind_param'], pdf_template_bind_refs($types, $vals));
    $stmt->execute();
    $template_id = (int) $mysqli->insert_id;
    $stmt->close();

    pdf_template_upisi_okvire($mysqli, $template_id, $okviri);

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    echo '200,' . $e->getCode();
}
$mysqli->close();
