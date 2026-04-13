<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Obredi_CRUD_brisanje.php
// Brisanje obreda (FK 1451 → kod 106)
// =====================================================
//
// Ulaz (POST): id (obavezno)
// Izlaz (TEXT): OK | 100 | 105 | 106,<errno> | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
// Uključi 00_db.php; ako povratna vrijednost nije -1, to je kod greške (npr. 100).
// Proslijedi kod klijentu i prekini izvođenje.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
// POST id mora postojati i biti cijeli broj > 0. Inače vraća 105 (nevaljani podaci).
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}

// --- Blok: Brisanje reda ---
// Pripremi DELETE, izvrši. Uspjeh → OK. Neuspjeh prepare → 200,errno.
// Iznimka pri execute: 1451 (FK) → 106,errno; ostalo → 200,errno.
$sql = "DELETE FROM obredi WHERE id = ?";

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
