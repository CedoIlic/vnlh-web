<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
// nositelji_imena: aktivni članovi (clanovi) s id_duznosnik u sustav_korisnici — „Prezime Ime“, više nositelja odvojeno zarezom.
$sql = "SELECT d.id, d.naziv, d.aktivnost, d.razina, d.id_nadredjeni, n.naziv AS nadredjeni_naziv,
        (SELECT GROUP_CONCAT(DISTINCT CONCAT(TRIM(c.prezime), ' ', TRIM(c.ime))
                ORDER BY c.prezime ASC, c.ime ASC SEPARATOR ', ')
         FROM sustav_korisnici sk
         INNER JOIN clanovi c ON c.id = sk.id_korisnik AND c.aktivnost = 1
         WHERE sk.id_duznosnik = d.id) AS nositelji_imena
        FROM duznosnici d
        LEFT JOIN duznosnici n ON n.id = d.id_nadredjeni
        ORDER BY d.naziv ASC";
$result = $mysqli->query($sql);
$rows = [];
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
while ($row = $result->fetch_assoc()) {
    if ($row['id_nadredjeni'] == 0 || $row['id_nadredjeni'] === null) {
        $row['nadredjeni_naziv'] = '';
    }
    $rows[] = $row;
}
header('Content-Type: application/json');
echo json_encode($rows);
$mysqli->close();
?>
