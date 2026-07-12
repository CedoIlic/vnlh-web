<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Razgovori_CRUD_ispitivaci.php – popuna selekta „Razgovor vodio".
// Svi članovi: aktivnost = 1 AND kandidat = 0. GET q (pretraga po prezime/ime), LIMIT 50.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';

$sel = "SELECT c.id, c.prezime, c.ime, c.loza AS id_loza, l.naziv AS loza_naziv, l.grad AS loza_grad
        FROM clanovi c
        LEFT JOIN loze l ON l.id = c.loza";
if ($q === '') {
    $sql = "$sel
            WHERE c.aktivnost = 1 AND c.kandidat = 0
            ORDER BY c.prezime ASC, c.ime ASC
            LIMIT 50";
    $stmt = $mysqli->prepare($sql);
} else {
    $like = '%' . $q . '%';
    $sql = "$sel
            WHERE c.aktivnost = 1 AND c.kandidat = 0
              AND (c.prezime LIKE ? OR c.ime LIKE ? OR CONCAT(c.prezime, ' ', c.ime) LIKE ?)
            ORDER BY c.prezime ASC, c.ime ASC
            LIMIT 50";
    $stmt = $mysqli->prepare($sql);
    if ($stmt) { $stmt->bind_param('sss', $like, $like, $like); }
}
if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) { $rows[] = $row; }
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
