<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Meni_CRUD_Aktivnost_Change.php
// Promjena kolone aktivno za jedan redak (inline toggle)
// =====================================================
//
// Ulaz (POST): id, aktivno (0|1)
// Izlaz (TEXT): OK | 100 | 105 | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza (id, aktivno 0|1) ---
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$aktivno = isset($_POST['aktivno']) ? (int)$_POST['aktivno'] : -1;
if ($id <= 0 || ($aktivno !== 0 && $aktivno !== 1)) {
    echo '105';
    exit;
}

// --- Blok: UPDATE aktivno (prepare, bind) ---
$sql = "UPDATE meni SET aktivno = ? WHERE id = ?";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}

$stmt->bind_param("ii", $aktivno, $id);

// --- Blok: Izvršenje i odgovor ---
try {
    if ($stmt->execute()) {
        echo 'OK';
    } else {
        echo '200,' . $mysqli->errno;
    }
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$stmt->close();
$mysqli->close();
?>
