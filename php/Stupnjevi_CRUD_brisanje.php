<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Stupnjevi_CRUD_brisanje.php
// Brisanje stupnja po id
// =====================================================
//
// Blokovi: Konekcija na bazu, Validacija ulaza, Brisanje (DELETE).
// Ulaz (POST): id (obavezno)
// Izlaz (TEXT): OK | 100 | 106,<errno> (vezani podaci, FK) | 108,<id> | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    /* Greška konekcije (00_db vraća kod 100 ili drugi); ispiši kod i prekini. */
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
if ($id <= 0) {
    /* id nedostaje ili nije > 0 → greška 108. */
    echo '108,' . $id;
    exit;
}

// --- Blok: Brisanje ---
$sql = "DELETE FROM stupnjevi WHERE id = ?";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    /* prepare() nije uspio → SQL greška. */
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("i", $id);
/* Brisanje NE kaskadira: stupanj vezan na eseje/napredovanja/zapisnik (FK RESTRICT) → 1451 → poruka 106 (ne tiha greška). */
try {
    $stmt->execute();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if ((int)$e->getCode() === 1451) {
        echo '106,' . $e->getCode();
    } else {
        echo '200,' . $e->getCode();
    }
}
$stmt->close();
$mysqli->close();
