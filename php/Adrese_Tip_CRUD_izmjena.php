<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Adrese_Tip_CRUD_izmjena.php
// Izmjena tipa adrese (naziv); duplikati nisu dopušteni
// =====================================================
//
// Ulaz (POST): id (obavezno), naziv (obavezno)
// Izlaz (TEXT): OK | 100 | 105 | 002 | 107,<errno> | 200,<errno>
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
// id mora biti cijeli broj > 0, naziv neprazan nakon trima. Inače vraća 105.
$id        = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$naziv_raw = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$naziv_norm = mb_strtolower($naziv_raw, 'UTF-8');

$tip_val = isset($_POST['Tip']) ? (int)$_POST['Tip'] : 0;
if ($tip_val !== 0 && $tip_val !== 1) {
    $tip_val = 0;
}

if ($id <= 0 || $naziv_raw === '') {
    echo '105';
    exit;
}

// --- Blok: Provjera duplikata ---
// SELECT po LOWER(naziv), isključujući trenutni id. Ako postoji → 002. Prepare greška → 200,errno.
$stmt = $mysqli->prepare(
    "SELECT id FROM adrese_tip WHERE LOWER(naziv) = ? AND id <> ? LIMIT 1"
);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("si", $naziv_norm, $id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    echo '002';
    exit;
}
$stmt->close();

// --- Blok: Izmjena (UPDATE) ---
// Execute uspjeh → OK. Neuspjeh: 1451/1452 → 107,errno (FK pri izmjeni); 1062 → 109; ostalo → 200,errno.
$stmt = $mysqli->prepare(
    "UPDATE adrese_tip SET naziv = ?, `Tip` = ? WHERE id = ?"
);
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("sii", $naziv_raw, $tip_val, $id);

if ($stmt->execute()) {
    echo 'OK';
    exit;
}

if ($mysqli->errno == 1451 || $mysqli->errno == 1452) {
    echo '107,' . $mysqli->errno;
    exit;
}
if ($mysqli->errno == 1062) {
    echo '109';
    exit;
}
echo '200,' . $mysqli->errno;
$mysqli->close();
?>
