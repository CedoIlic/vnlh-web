<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Razgovori_CRUD_sve.php – svi razgovori jednog kandidata (1:N po id_clan).
// GET id_clan. Vraća i razriješeno ime ispitivača (clanovi). Redoslijed: datum_razgovora ASC, id ASC.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
if ($id_clan <= 0) { header('Content-Type: application/json'); echo '[]'; exit; }

$sql = "SELECT
            r.id,
            r.id_clan,
            r.id_ispitivac,
            r.datum_razgovora,
            r.naslov,
            r.tekst,
            r.dokument_prored,
            isp.prezime AS ispitivac_prezime,
            isp.ime     AS ispitivac_ime,
            isp.loza    AS ispitivac_loza_id,
            lisp.naziv  AS ispitivac_loza_naziv,
            lisp.grad   AS ispitivac_loza_grad
        FROM kandidat_dokumenti_razgovori r
        LEFT JOIN clanovi isp ON isp.id = r.id_ispitivac
        LEFT JOIN loze lisp ON lisp.id = isp.loza
        WHERE r.id_clan = ?
        ORDER BY r.datum_razgovora ASC, r.id ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
$stmt->bind_param('i', $id_clan);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) { $rows[] = $row; }
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
