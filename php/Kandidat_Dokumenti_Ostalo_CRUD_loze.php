<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Ostalo_CRUD_loze.php – lože za select „Loža iz koje se pridružuje" (tab „Ostalo").
// GET id_clan, id_drzava. Vraća JSON polje [{ id, naziv, grad }] — aktivne lože (aktivnost=1)
// ISTOG tipa (loze.id_tip_loze) kao loža kandidata i IZ DRŽAVE izabrane u geo grupi.
// Loža kojoj kandidat pripada je isključena (pridružuje se IZ druge lože).
// Ako kandidat nema ložu, loža nema tip ili država nije predana → prazno polje.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: application/json; charset=utf-8');

$id_clan   = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
$id_drzava = isset($_GET['id_drzava']) ? (int) $_GET['id_drzava'] : 0;
if ($id_clan <= 0 || $id_drzava <= 0) { echo '[]'; exit; }

try {
    $stmt = $mysqli->prepare('
        SELECT l.id, l.naziv, l.grad
          FROM loze l
         WHERE l.aktivnost = 1
           AND l.id_drzava = ?
           AND l.id_tip_loze IS NOT NULL
           AND l.id_tip_loze = (SELECT lk.id_tip_loze
                                  FROM clanovi c
                                  JOIN loze lk ON lk.id = c.loza
                                 WHERE c.id = ? LIMIT 1)
           AND l.id <> COALESCE((SELECT c2.loza FROM clanovi c2 WHERE c2.id = ? LIMIT 1), 0)
         ORDER BY l.naziv, l.grad');
    $stmt->bind_param('iii', $id_drzava, $id_clan, $id_clan);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($row = $res->fetch_assoc()) {
        $out[] = ['id' => (int) $row['id'], 'naziv' => $row['naziv'], 'grad' => $row['grad']];
    }
    $stmt->close();
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
} catch (mysqli_sql_exception $e) {
    echo json_encode(['greska' => '200,' . $e->getCode()], JSON_UNESCAPED_UNICODE);
}

$mysqli->close();
