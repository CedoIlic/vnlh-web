<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Meni_CRUD_sve.php
// Dohvat svih stavki menija za tablicu u formi (sve stavke sa svim poljima)
// =====================================================
//
// Izlaz (JSON):
// [
//   {
//     "id": 1,
//     "naziv": "...",
//     "html_fajl": "...",
//     "ref": "...",
//     "putanja": "...",
//     "redoslijed": 0,
//     "meni_tip_id": 1,
//     "meni_tip_naziv": "...",
//     "roditelj": 0,
//     "napomena": "...",
//     "aktivno": 1,
//     "test": 1
//   },
//   ...
// ]
//
// Koristi centralnu konekciju: 00_db.php ($mysqli)
// =====================================================

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

// --- Blok: SQL SELECT (sve stavke, LEFT JOIN meni_tip) ---
$sql = "
    SELECT
        m.id,
        m.naziv,
        m.opis,
        m.napomena,
        m.html_fajl,
        m.putanja,
        m.ref,
        m.meni_tip_id,
        mt.naziv AS meni_tip_naziv,
        m.roditelj,
        m.redoslijed,
        m.aktivno,
        m.test,
        m.device
    FROM meni m
    LEFT JOIN meni_tip mt ON mt.id = m.meni_tip_id
    ORDER BY m.naziv
";

// --- Blok: Izvršenje upita ---
$result = $mysqli->query($sql);
$rows = [];

if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}

// --- Blok: Iteracija i JSON izlaz ---
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
header('Content-Type: application/json');
echo json_encode($rows);

$mysqli->close();
?>
