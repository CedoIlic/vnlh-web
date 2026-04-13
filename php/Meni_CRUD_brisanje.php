<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Meni_CRUD_brisanje.php
// Brisanje stavke menija
// =====================================================
//
// Ulaz (POST): id (obavezno, > 0)
// Izlaz (TEXT): OK | 100 | 105 | 200,<errno>
// Koristi: 00_db.php ($mysqli)
//
// Napomena:
// - FK ograničenja (ako postoje) prepuštamo bazi
// - Frontend odlučuje kako prikazati poruku
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ID-a ---
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;

if ($id <= 0) {
    echo '105';
    exit;
}

// --- Blok: DELETE (prepare i bind) ---
$sql = "DELETE FROM meni WHERE id = ?";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id);

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
