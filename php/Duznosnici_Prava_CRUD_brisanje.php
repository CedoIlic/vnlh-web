<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Duznosnici_Prava_CRUD_brisanje.php
// Brisanje svih prava za dužnosnika.
// =====================================================
//
// Ulaz (POST):
//   id_duznosnik (obavezno) – ID dužnosnika
//
// Izlaz (TEXT): OK | 100 | 105 | 200,errno
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id_duznosnik = isset($_POST['id_duznosnik']) ? (int)$_POST['id_duznosnik'] : 0;

if ($id_duznosnik <= 0) {
    echo '105';
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare("DELETE FROM duznosnici_prava WHERE duznost = ?");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

$stmt->bind_param('i', $id_duznosnik);
if (!$stmt->execute()) {
    echo '200,' . $mysqli->errno;
    $stmt->close();
    $mysqli->close();
    exit;
}

$stmt->close();
$mysqli->close();

echo 'OK';
