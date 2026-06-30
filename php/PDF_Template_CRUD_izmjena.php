<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
require_once __DIR__ . '/PDF_Template_CRUD_polja.php';

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}

$code = '';
$polja = pdf_template_citaj_polja($code);
if ($polja === null) {
    echo $code;
    exit;
}

$naziv = $polja[0][2];
$okviri = pdf_template_citaj_okvire();

try {
    // Duplikat naziva osim tekućeg sloga
    $stmt = $mysqli->prepare('SELECT id FROM pdf_template WHERE LOWER(naziv) = LOWER(?) AND id <> ? LIMIT 1');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('si', $naziv, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();

    $set = implode(', ', array_map(function ($f) {
        return '`' . $f[0] . '` = ?';
    }, $polja));
    $types = implode('', array_map(function ($f) {
        return $f[1];
    }, $polja)) . 'i';
    $vals = array_map(function ($f) {
        return $f[2];
    }, $polja);
    $vals[] = $id;

    $mysqli->begin_transaction();
    $stmt = $mysqli->prepare("UPDATE pdf_template SET $set WHERE id = ?");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    call_user_func_array([$stmt, 'bind_param'], pdf_template_bind_refs($types, $vals));
    $stmt->execute();
    $stmt->close();

    // Okviri: UPDATE postojećih (čuva id) + INSERT novih + DELETE samo uklonjenih.
    // Ne smije se raditi DELETE-all jer FK ON DELETE SET NULL ponuli okvir_id u dokumentima.
    pdf_template_spremi_okvire($mysqli, $id, $okviri);

    $mysqli->commit();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    $mysqli->rollback();
    echo '200,' . $e->getCode();
}
$mysqli->close();
