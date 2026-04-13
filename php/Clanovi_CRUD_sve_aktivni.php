<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_sve_aktivni.php – svi članovi s aktivnost = 1 (za odabir nosioca dužnosti).
// GET bez parametara. Izlaz: JSON [ { id, prezime, ime, stupanj_show, loza_naziv, loza_grad }, ... ].

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$sql = "SELECT c.id, c.prezime, c.ime, s.stupanj AS stupanj_show,
               l.naziv AS loza_naziv, l.grad AS loza_grad
        FROM clanovi c
        LEFT JOIN stupnjevi s ON s.id = c.stupanj
        LEFT JOIN loze l ON l.id = c.loza
        WHERE c.aktivnost = 1
        ORDER BY c.prezime ASC, c.ime ASC";
$result = $mysqli->query($sql);
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
