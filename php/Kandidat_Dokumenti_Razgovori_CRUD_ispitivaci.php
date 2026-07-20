<?php
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/0-Filteri_Drzava.php';
// Kandidat_Dokumenti_Razgovori_CRUD_ispitivaci.php – popuna selekta „Razgovor vodio".
// Članovi: aktivnost = 1 AND kandidat = 0. GET q (pretraga po prezime/ime), LIMIT 50.
// GET id_drzava (opcijski): filter po DRŽAVI LOŽE (0-Filteri_Drzava.php); -1/prazno = sve države.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$q        = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
$idDrzava = isset($_GET['id_drzava']) ? (int) $_GET['id_drzava'] : -1;

$sel = "SELECT c.id, c.prezime, c.ime, c.loza AS id_loza, l.naziv AS loza_naziv, l.grad AS loza_grad
        FROM clanovi c
        LEFT JOIN loze l ON l.id = c.loza";

$joins  = [];
$where  = ['c.aktivnost = 1', 'c.kandidat = 0'];
$params = [];
$types  = '';

// Lanac filtera (redom; -1/prazno = preskoči).
vnlhFilterDrzava($joins, $where, $params, $types, $idDrzava);   // država lože (iz geogrupe forme)

if ($q !== '') {
    $like = '%' . $q . '%';
    $where[]  = '(c.prezime LIKE ? OR c.ime LIKE ? OR CONCAT(c.prezime, \' \', c.ime) LIKE ?)';
    $params[] = $like; $params[] = $like; $params[] = $like;
    $types   .= 'sss';
}

$sql = $sel . ' ' . implode(' ', $joins)
     . ' WHERE ' . implode(' AND ', $where)
     . ' ORDER BY c.prezime ASC, c.ime ASC LIMIT 50';

$stmt = $mysqli->prepare($sql);
if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
if ($types !== '') {
    $allParams = array_merge([$types], $params);
    $refs = [];
    foreach ($allParams as $k => $v) { $refs[$k] = &$allParams[$k]; }
    call_user_func_array([$stmt, 'bind_param'], $refs);
}
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) { $rows[] = $row; }
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
