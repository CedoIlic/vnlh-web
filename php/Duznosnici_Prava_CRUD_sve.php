<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Duznosnici_Prava_CRUD_sve.php
// Dohvat redaka za tablicu prava odabranog dužnosnika.
//
// Zadano (sva_prava = 0 ili izostavljeno):
//   Redovi = izvršni meniji (tip iz varijable 105) koja logirani dužnosnik ima u duznosnici_prava.
//   aktivno = ima li odabrani dužnosnik (GET id_duznosnik) to pravo.
//
// Režim „Sva prava“ (GET sva_prava = 1, uz varijablu 1003 = 1 na formi):
//   Redovi = svi aktivni slogovi menija s nepraznim html_fajl, bez filtra po pravima logiranog.
//   aktivno = ima li odabrani dužnosnik (GET id_duznosnik) to pravo.
//
// GET id_duznosnik (opcionalno, >0) — za kolonu aktivno; ≤0 svi checkboxi 0.
// =====================================================
//
// Ulaz (GET):
//   id_duznosnik (opcionalno)
//   sva_prava (opcionalno) — 1 = svi HTML moduli iz meni (vidi gore)
//
// Izlaz (JSON): [ { "id", "naziv", "opis", "aktivno", "html_fajl"? }, ... ]
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$id_duznosnik = isset($_GET['id_duznosnik']) ? (int) $_GET['id_duznosnik'] : 0;
$id_za_aktivno = $id_duznosnik > 0 ? $id_duznosnik : -1;

$sva_prava = isset($_GET['sva_prava']) ? (int) $_GET['sva_prava'] : 0;
if ($sva_prava !== 1) {
    $sva_prava = 0;
}

$id_duznosnik_sesija = isset($_SESSION['id_duznosnik']) ? (int) $_SESSION['id_duznosnik'] : 0;
if ($id_duznosnik_sesija <= 0) {
    echo json_encode([]);
    $mysqli->close();
    exit;
}

$izvrsniTipId = null;
if ($sva_prava === 0) {
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 105 LIMIT 1');
    if ($stmt) {
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $v = isset($row['varijabla']) ? trim((string) $row['varijabla']) : '';
            if ($v !== '' && $v !== '0') {
                $izvrsniTipId = (int) $v;
            }
        }
        $stmt->close();
    }
    if ($izvrsniTipId === null) {
        echo json_encode([]);
        $mysqli->close();
        exit;
    }
}

if ($sva_prava === 1) {
    // Svi moduli s HTML predloškom — bez INNER JOIN na prava logiranog.
    $sql = 'SELECT m.id, m.naziv, m.opis, TRIM(m.html_fajl) AS html_fajl,
            IF(dp.id IS NOT NULL, 1, 0) AS aktivno
            FROM meni m
            LEFT JOIN duznosnici_prava dp ON dp.pravo = m.id AND dp.duznost = ?
            WHERE m.aktivno = 1
              AND m.html_fajl IS NOT NULL
              AND TRIM(m.html_fajl) <> \'\'
            ORDER BY TRIM(m.html_fajl) ASC, m.naziv ASC';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo json_encode(['error' => '200,' . $mysqli->errno]);
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('i', $id_za_aktivno);
} else {
    $sql = 'SELECT m.id, m.naziv, m.opis,
            IF(dp.id IS NOT NULL, 1, 0) AS aktivno
            FROM meni m
            INNER JOIN duznosnici_prava dpSes ON dpSes.pravo = m.id AND dpSes.duznost = ?
            LEFT JOIN duznosnici_prava dp ON dp.pravo = m.id AND dp.duznost = ?
            WHERE m.meni_tip_id = ? AND m.aktivno = 1
            ORDER BY m.naziv ASC';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo json_encode(['error' => '200,' . $mysqli->errno]);
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('iii', $id_duznosnik_sesija, $id_za_aktivno, $izvrsniTipId);
}

if (!$stmt->execute()) {
    echo json_encode(['error' => '200,' . $mysqli->errno]);
    $stmt->close();
    $mysqli->close();
    exit;
}

$result = $stmt->get_result();
$out = [];
while ($row = $result->fetch_assoc()) {
    $item = [
        'id' => (int) $row['id'],
        'naziv' => $row['naziv'] ?? '',
        'opis' => $row['opis'] ?? '',
        'aktivno' => (isset($row['aktivno']) && ($row['aktivno'] == 1 || $row['aktivno'] === '1')) ? 1 : 0,
    ];
    if ($sva_prava === 1 && array_key_exists('html_fajl', $row) && $row['html_fajl'] !== null && trim((string) $row['html_fajl']) !== '') {
        $item['html_fajl'] = trim((string) $row['html_fajl']);
    }
    $out[] = $item;
}

$stmt->close();
$mysqli->close();

echo json_encode($out, JSON_UNESCAPED_UNICODE);
