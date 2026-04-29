<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
if (!isset($_POST['naziv'])) {
    echo '105';
    exit;
}
$naziv = trim($_POST['naziv']);
if ($naziv === '') {
    echo '105';
    exit;
}
$redosljed = isset($_POST['redosljed']) ? trim($_POST['redosljed']) : '';
$redosljed_int = ($redosljed === '') ? null : (int) $redosljed;
if ($redosljed !== '' && ($redosljed_int === null || $redosljed_int < 1 || $redosljed_int > 99)) {
    echo '105';
    exit;
}
try {
    $stmt = $mysqli->prepare("SELECT id FROM radovi_drzave_gostiju WHERE LOWER(COALESCE(naziv, '')) = LOWER(?)");
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
    $redosljed_val = ($redosljed_int === null || $redosljed_int < 1) ? 0 : $redosljed_int;
    $stmt = $mysqli->prepare("INSERT INTO radovi_drzave_gostiju (naziv, redosljed) VALUES (?, ?)");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('si', $naziv, $redosljed_val);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
