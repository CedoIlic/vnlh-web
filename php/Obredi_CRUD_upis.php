<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Obredi_CRUD_upis.php
// Dodavanje obreda (case-insensitive duplikati nisu dopušteni)
// =====================================================
//
// Ulaz (POST): naziv (obavezno)
// Izlaz (TEXT): OK | 100 | 105 | 002 | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
// Uključi 00_db.php; ako povrat nije -1, proslijedi kod (npr. 100) i prekini.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
// POST naziv mora postojati i biti neprazan nakon trima. Inače vraća 105.
if (!isset($_POST['naziv'])) {
    echo '105';
    exit;
}

$naziv = trim($_POST['naziv']);
if ($naziv === '') {
    echo '105';
    exit;
}

// --- Blok: Provjera duplikata i upis ---
// SELECT po LOWER(naziv); ako postoji → 002. INSERT; uspjeh → OK. Prepare/execute greška → 200,errno.
try {
    $stmt = $mysqli->prepare(
        "SELECT id FROM obredi WHERE LOWER(naziv) = LOWER(?)"
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param("s", $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();

    $stmt = $mysqli->prepare(
        "INSERT INTO obredi (naziv) VALUES (?)"
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param("s", $naziv);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();
?>
