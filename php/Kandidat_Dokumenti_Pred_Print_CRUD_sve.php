<?php
require_once __DIR__ . '/require_login_api.php';
// Svi reci šifarnika pred-printa + naziv dokumenta iz pdf_dokument.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$sql = "SELECT p.id, p.id_dokument, p.naziv, p.izvor_tablica, p.izvor_kolona, p.redosljed, p.aktivan, p.napomena,
               d.naziv AS dokument_naziv
          FROM kandidat_dokumenti_pred_print p
          JOIN pdf_dokument d ON d.id = p.id_dokument
      ORDER BY p.redosljed ASC, d.naziv ASC";
$result = $mysqli->query($sql);
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$rows = [];
while ($row = $result->fetch_assoc()) $rows[] = $row;
header('Content-Type: application/json');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();
?>
