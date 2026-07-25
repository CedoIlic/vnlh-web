<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Ostalo_CRUD_jedan.php – dohvat zapisa taba „Ostalo" po id_clan (1:1).
// GET id_clan. Vraća JSON { id_clan, id (red u tablici|null), postoji (bool),
//                            planirani_datum_inicijacije (YYYY-MM-DD|null), ispis_imena_kandidata (0/1), napomena (string|null) }.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
header('Content-Type: application/json; charset=utf-8');
// Novi zapis: ispis imena je uključen (isti default kao u shemi).
$prazno = ['id_clan' => $id_clan, 'id' => null, 'postoji' => false,
           'planirani_datum_inicijacije' => null, 'ispis_imena_kandidata' => 1, 'napomena' => null];
if ($id_clan <= 0) {
    $prazno['id_clan'] = 0;
    echo json_encode($prazno, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $stmt = $mysqli->prepare('SELECT id, planirani_datum_inicijacije, ispis_imena_kandidata, napomena
                                FROM kandidat_dokumenti_ostalo WHERE id_clan = ? LIMIT 1');
    $stmt->bind_param('i', $id_clan);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();
    if ($row) {
        echo json_encode([
            'id_clan' => $id_clan,
            'id' => (int) $row['id'],
            'postoji' => true,
            'planirani_datum_inicijacije' => $row['planirani_datum_inicijacije'],
            'ispis_imena_kandidata' => (int) $row['ispis_imena_kandidata'],
            'napomena' => $row['napomena']
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode($prazno, JSON_UNESCAPED_UNICODE);
    }
} catch (mysqli_sql_exception $e) {
    echo json_encode(['greska' => '200,' . $e->getCode()], JSON_UNESCAPED_UNICODE);
}

$mysqli->close();
