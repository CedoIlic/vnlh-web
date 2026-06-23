<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_brisanje.php
// Brisanje jezika (sustav_jezici). Zadani jezik se ne smije brisati (034). FK 1451 → 106.
// =====================================================
//
// Ulaz (POST): id (obavezno)
// Izlaz (TEXT): OK | 100 | 105 | 034 | 106,<errno> | 200,<errno>
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

try {
    /* Zaštita zadanog (fallback) jezika. */
    $stmt = $mysqli->prepare("SELECT zadani FROM sustav_jezici WHERE id = ? LIMIT 1");
    if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if ($row && (int) $row['zadani'] === 1) {
        echo '034';
        exit;
    }

    $stmt = $mysqli->prepare("DELETE FROM sustav_jezici WHERE id = ?");
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
