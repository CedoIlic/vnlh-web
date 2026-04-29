<?php
// =====================================================
// Zapisnik_CRUD_loze_isti_tip_sve.php
// Za modal „Lože učesnice radova”: sve aktivne lože iz tablice loze koje imaju isti
// id_tip_loze kao loža odabrana u GET id_loza (null-safe: <=> za NULL tip).
//
// Ulaz: GET id_loza (>0) — ID retka u loze (odabir „Loža“ u zaglavlju Zapisnika).
// Izlaz: JSON niz [ { "id", "naziv", "grad", "drzava_naziv" }, ... ] sort po naziv.
// Prazan niz ako red ne postoji ili nema poklapanja.
//
// Zaštita: require_login_api (kao ostali CRUD XHR).
// =====================================================

require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$id_loza = isset($_GET['id_loza']) ? (int) $_GET['id_loza'] : 0;
if ($id_loza <= 0) {
    header('Content-Type: application/json; charset=utf-8');
    echo '[]';
    $mysqli->close();
    exit;
}

// l1 = referentna loža; l2 = sve lože istog tipa; drzava opcionalno (LEFT JOIN ako id_drzava nedostaje).
$sql = 'SELECT l2.id, l2.naziv, l2.grad, COALESCE(d.naziv, \'\') AS drzava_naziv
        FROM loze l1
        INNER JOIN loze l2 ON (l1.id_tip_loze <=> l2.id_tip_loze)
        LEFT JOIN drzave d ON d.id = l2.id_drzava
        WHERE l1.id = ? AND l2.aktivnost = 1
        ORDER BY l2.naziv ASC';

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: application/json; charset=utf-8');
    echo '[]';
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $id_loza);
if (!$stmt->execute()) {
    $stmt->close();
    header('Content-Type: application/json; charset=utf-8');
    echo '[]';
    $mysqli->close();
    exit;
}
$res = $stmt->get_result();
$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = [
        'id'            => (int) $row['id'],
        'naziv'         => $row['naziv'],
        'grad'          => $row['grad'],
        'drzava_naziv'  => $row['drzava_naziv'],
    ];
}
$stmt->close();
$mysqli->close();

header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
exit;
