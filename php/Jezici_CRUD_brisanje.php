<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_brisanje.php
// Brisanje jezika (FK 1451 → kod 106)
// =====================================================
//
// Ulaz (POST): id (obavezno)
// Izlaz (TEXT): OK | 100 | 105 | 106,<errno> | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}

$sql = "DELETE FROM jezici WHERE id = ?";

try {
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param("i", $id);
    $stmt->execute();
    echo 'OK';
    exit;
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1451) {
        echo '106,' . $e->getCode();
        exit;
    }
    echo '200,' . $e->getCode();
    exit;
}
?>
