<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// common_sustav_varijable.php
// Dohvat sadržaja kolone varijabla za jedan id iz tablice sustav_varijable.
// Koristi istu bazu kao 00_db.php (vnlh).
// =====================================================
//
// Ulaz (GET ili POST):
//   id (obavezno) – ID sistemske varijable
//
// Izlaz:
//   (TEXT) Uspjeh: sadržaj kolone varijabla (plain text), mora biti "0" ili string
//   (TEXT) Greška konekcije (00_db.php): 100
//   (TEXT) Nedostaje id ili nije broj: 120
//   (TEXT) Tablica/red ne postoji ili sadržaj nije "0"/string: 120
//   (TEXT) Greška SQL (prepare/execute): 120
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

// -----------------------------------------------------
// Parametar id (GET ili POST)
// -----------------------------------------------------
$id = isset($_GET['id']) ? $_GET['id'] : (isset($_POST['id']) ? $_POST['id'] : null);
if ($id === null || $id === '') {
    echo '120';
    exit;
}
$id = (int) $id;
if ($id <= 0) {
    echo '120';
    exit;
}

// -----------------------------------------------------
// SQL – samo kolona varijabla
// -----------------------------------------------------
$sql = "SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1";
$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    echo '120';
    exit;
}

$stmt->bind_param("i", $id);
if (!$stmt->execute()) {
    echo '120';
    exit;
}

$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo '120';
    exit;
}

$row = $result->fetch_assoc();
$varijabla = isset($row['varijabla']) ? $row['varijabla'] : null;

// Sadržaj mora postojati i biti "0" ili string (ne null)
if ($varijabla === null) {
    echo '120';
    exit;
}
echo is_string($varijabla) ? $varijabla : (string) $varijabla;
exit;
