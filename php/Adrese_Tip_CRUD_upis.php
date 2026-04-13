<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Adrese_Tip_CRUD_upis.php
// Dodavanje tipa adrese (case-insensitive duplikati nisu dopušteni)
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

$tip_val = isset($_POST['Tip']) ? (int)$_POST['Tip'] : 0;
if ($tip_val !== 0 && $tip_val !== 1) {
    $tip_val = 0;
}

// --- Blok: Provjera duplikata i upis ---
// SELECT po LOWER(naziv); ako postoji → 002. INSERT; uspjeh → OK. Prepare/execute greška → 200,errno.
try {
    $stmt = $mysqli->prepare(
        "SELECT id FROM adrese_tip WHERE LOWER(naziv) = LOWER(?)"
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
        "INSERT INTO adrese_tip (naziv, `Tip`) VALUES (?, ?)"
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param("si", $naziv, $tip_val);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();
?>
