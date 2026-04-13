<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Regije_CRUD_upis.php
// Dodavanje nove regije za odabranu državu
// =====================================================
//
// Ulaz (POST):
// - id_drzava (obavezno)
// - naziv      (obavezno)
//
// Izlaz (TEXT):
//   OK          – uspjeh
//   100         – greška konekcije na bazu (00_db.php)
//   105         – neispravan ulaz (id_drzava <= 0 ili naziv prazan)
//   109         – duplikat (MySQL 1062, UNIQUE (id_drzava, naziv))
//   200,<kod>   – ostala SQL greška
//
// Napomena:
//   UNIQUE (id_drzava, naziv) u bazi; 1062 → 109 (MODAL_MESSAGES).
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
$id_drzava = isset($_POST['id_drzava']) ? (int)$_POST['id_drzava'] : 0;
$naziv_raw = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';

if ($id_drzava <= 0 || $naziv_raw === '') {
    echo '105';
    exit;
}

// -----------------------------------------------------
// INSERT (try/catch jer mysqli može bacati exception)
// -----------------------------------------------------
$sql = "INSERT INTO regije (id_drzava, naziv) VALUES (?, ?)";

try {
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }

    $stmt->bind_param("is", $id_drzava, $naziv_raw);
    $stmt->execute();

    echo 'OK';
    exit;

} catch (mysqli_sql_exception $e) {

    // -------------------------------------------------
    // 1062 = Duplicate entry (UNIQUE constraint) → poruka 109
    // Npr. UNIQUE (id_drzava, naziv)
    // -------------------------------------------------
    if ($e->getCode() == 1062) {
        echo '109';
        exit;
    }

    echo '200,' . $e->getCode();
    exit;
}
