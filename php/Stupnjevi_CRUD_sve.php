<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Stupnjevi_CRUD_sve.php
// Dohvat stupnjeva za obred (bez kolona slika)
// =====================================================
//
// Ulaz (GET): obred_id (obavezno, id obreda)
// Izlaz (JSON): [ { "id": 1, "id_obred": 1, "naziv": "...", "stupanj": 0, "ima_sliku": 1 }, ... ]
//               ima_sliku: 1 ako je slika IS NOT NULL, 0 ako je NULL
// Greška (TEXT): 100 | 105 | 200,<errno>
// Koristi: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

// --- Blok: Validacija ulaza ---
// obred_id mora postojati i biti cijeli broj > 0. Inače vraća 105.
$obred_id = isset($_GET['obred_id']) ? (int)$_GET['obred_id'] : 0;
if ($obred_id <= 0) {
    header('Content-Type: text/plain');
    echo '105';
    exit;
}

// --- Blok: Dohvat stupnjeva (bez slika) ---
$sql = "SELECT id, id_obred, naziv, stupanj, (slika IS NOT NULL) AS ima_sliku FROM stupnjevi WHERE id_obred = ? ORDER BY stupanj ASC, naziv ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param("i", $obred_id);
$stmt->execute();
$result = $stmt->get_result();
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();
$mysqli->close();

header('Content-Type: application/json');
echo json_encode($rows);
