<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Duznosnici_Prava_CRUD_sve.php
// Dohvat izvršnih menija za odabranog dužnosnika.
// Izvršni meniji = meni.meni_tip_id = varijabla iz sustav_varijable id 105.
// Tablica duznosnici_prava: duznost->duznosnici(id), pravo->meni(id).
// Postojanje retka (duznost, pravo) = stavka dozvoljena (kolona A. = 1).
// Sortiranje: naziv ASC.
// =====================================================
//
// Ulaz (GET):
//   id_duznosnik (obavezno) – ID dužnosnika
//
// Izlaz (JSON): [ { "id", "naziv", "opis", "aktivno" }, ... ]
//   id = meni.id, aktivno = 1 ako postoji (duznost,pravo), 0 inače
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$id_duznosnik = isset($_GET['id_duznosnik']) ? (int)$_GET['id_duznosnik'] : 0;

if ($id_duznosnik <= 0) {
    echo json_encode([]);
    $mysqli->close();
    exit;
}

// --- Izvršni meni tip = varijabla 105 ---
$izvrsniTipId = null;
$stmt = $mysqli->prepare("SELECT varijabla FROM sustav_varijable WHERE id = 105 LIMIT 1");
if ($stmt) {
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $v = isset($row['varijabla']) ? trim((string)$row['varijabla']) : '';
        if ($v !== '' && $v !== '0') {
            $izvrsniTipId = (int)$v;
        }
    }
    $stmt->close();
}

if ($izvrsniTipId === null) {
    echo json_encode([]);
    $mysqli->close();
    exit;
}

// --- Dohvat izvršnih menija + aktivno iz duznosnici_prava ---
// meni.aktivno=1 = samo aktivne stavke menija
// duznosnici_prava: duznost=id dužnosnika, pravo=id meni; postojanje retka = dozvoljena (A.=1)
$sql = "SELECT m.id, m.naziv, m.opis,
        IF(dp.id IS NOT NULL, 1, 0) AS aktivno
        FROM meni m
        LEFT JOIN duznosnici_prava dp ON dp.pravo = m.id AND dp.duznost = ?
        WHERE m.meni_tip_id = ? AND m.aktivno = 1
        ORDER BY m.naziv ASC";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200,' . $mysqli->errno]);
    $mysqli->close();
    exit;
}
$stmt->bind_param('ii', $id_duznosnik, $izvrsniTipId);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200,' . $mysqli->errno]);
    $stmt->close();
    $mysqli->close();
    exit;
}

$result = $stmt->get_result();
$out = [];
while ($row = $result->fetch_assoc()) {
    $out[] = [
        'id' => (int)$row['id'],
        'naziv' => $row['naziv'] ?? '',
        'opis' => $row['opis'] ?? '',
        'aktivno' => (isset($row['aktivno']) && ($row['aktivno'] == 1 || $row['aktivno'] === '1')) ? 1 : 0
    ];
}

$stmt->close();
$mysqli->close();

echo json_encode($out, JSON_UNESCAPED_UNICODE);
