<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Regije_CRUD_izmjena.php
// Izmjena naziva regije (bez promjene države)
// =====================================================
//
// Ulaz (POST):
// - id    (ID regije – obavezno)
// - naziv (novi naziv – obavezno)
//
// Izlaz (TEXT):
// - OK
// - 100       (greška konekcije na bazu – 00_db.php)
// - 105       (neispravan ulaz)
// - 109       (duplikat: 1062, UNIQUE (id_drzava, naziv))
// - 200,<kod> (SQL greška)
//
// Napomena:
// - Regija se NE može prebaciti u drugu državu
// - UNIQUE (id_drzava, naziv) u bazi štiti od duplikata; 1062 → 109
// - Koristi centralnu konekciju: 00_db.php ($mysqli)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

// -----------------------------------------------------
// Validacija ulaza
// -----------------------------------------------------
$id        = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$naziv_raw = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';

if ($id <= 0 || $naziv_raw === '') {
    echo '105';
    exit;
}

// -----------------------------------------------------
// UPDATE
// -----------------------------------------------------
// Namjerno NE mijenjamo id_drzava
// Regija ostaje u istoj državi
$sql = "UPDATE regije
        SET naziv = ?
        WHERE id = ?";

try {
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }

    $stmt->bind_param("si", $naziv_raw, $id);
    $stmt->execute();

    echo 'OK';
    exit;

} catch (mysqli_sql_exception $e) {

    // -------------------------------------------------
    // 1062 = Duplicate entry → poruka 109
    // UNIQUE (id_drzava, naziv)
    // -------------------------------------------------
    if ($e->getCode() == 1062) {
        echo '109';
        exit;
    }

    echo '200,' . $e->getCode();
    exit;
}
