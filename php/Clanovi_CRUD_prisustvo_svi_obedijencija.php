<?php
require_once __DIR__ . '/require_login_api.php';
/**
 * Zapisnik prisustvo — „svi članovi obedijencije” kad je radovi_prisustvo_tip.svi_clanovi_obedijncije = 1.
 * Dohvat: svi redovi iz `clanovi` s aktivnost = 1 i kandidat = 0.
 * Izlaz: JSON niz s minimalnim poljima koje Zapisnik_CRUD.js treba (lista lijevo, Pretraži haystack,
 * isključivanje članova prema modalu loža učesnica, snimak za Dužnosnike). Bez stupnjeva, kontakata,
 * Na prijedlog, obreda i ostalog iz punog Clanovi_CRUD_sve_loze.php.
 */
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$sql = "SELECT
            c.id,
            c.loza,
            c.prezime,
            c.ime,
            l.grad AS loza_grad,
            l.naziv AS loza_naziv,
            d_loza.naziv AS drzava_loze
        FROM clanovi c
        LEFT JOIN loze l ON l.id = c.loza
        LEFT JOIN drzave d_loza ON d_loza.id = l.id_drzava
        WHERE c.aktivnost = 1 AND c.kandidat = 0
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
