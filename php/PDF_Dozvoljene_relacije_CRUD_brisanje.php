<?php
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
    // Relacija u upotrebi (stavka dokumenta je referencira) → ne briši (nema tvrdog FK, ručna provjera).
    $stmt = $mysqli->prepare('SELECT 1 FROM pdf_dokument_stavke WHERE relacija_id = ? LIMIT 1');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->store_result();
    $uUpotrebi = $stmt->num_rows > 0;
    $stmt->close();
    if ($uUpotrebi) {
        echo '106,relacija je u upotrebi u dokumentu';   // #1 u poruci 106 (nema SQL koda — ručna provjera)
        exit;
    }

    $stmt = $mysqli->prepare('DELETE FROM pdf_dozvoljeni_relacije WHERE id = ?');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1451) {
        echo '106,' . $e->getCode();
        exit;
    }
    echo '200,' . $e->getCode();
}
$mysqli->close();
