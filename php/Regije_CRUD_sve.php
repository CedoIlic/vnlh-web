<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Regije_CRUD_sve.php
// Dohvat svih regija za odabranu državu (JSON)
// =====================================================
//
// Ulaz (GET):
//   id_drzava (obavezno) – ID države za koju dohvaćamo regije
//
// Izlaz:
//   (JSON) Uspjeh: [ { "id": 1, "naziv": "..." }, ... ]
//   (JSON) id_drzava <= 0: [] (prazan niz)
//   (TEXT) Greška konekcije (00_db.php): 100
//   (JSON) Prepare ne uspije: [] (prazan niz)
//
// Koristi centralnu konekciju: 00_db.php ($mysqli)
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// -----------------------------------------------------
// Validacija ulaza
// -----------------------------------------------------
$id_drzava = isset($_GET['id_drzava']) ? (int)$_GET['id_drzava'] : 0;

if ($id_drzava <= 0) {
    echo json_encode([]);
    exit;
}

// -----------------------------------------------------
// SQL
// -----------------------------------------------------
$sql = "
    SELECT id, naziv
    FROM regije
    WHERE id_drzava = ?
    ORDER BY naziv
";

// -----------------------------------------------------
// Priprema i izvršavanje (mysqli)
// -----------------------------------------------------
$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    // Ako prepare ne uspije, ne vraćamo grešku klijentu
    echo json_encode([]);
    exit;
}

$stmt->bind_param("i", $id_drzava);
$stmt->execute();

$result = $stmt->get_result();

$regije = [];

while ($row = $result->fetch_assoc()) {
    $regije[] = $row;
}

echo json_encode($regije, JSON_UNESCAPED_UNICODE);
exit;
