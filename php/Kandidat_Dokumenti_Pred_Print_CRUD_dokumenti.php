<?php
require_once __DIR__ . '/require_login_api.php';
// Aktivni PDF dokumenti za padajući izbornik. razvoj_tablica/razvoj_kolona služe za prefill
// izvora u šifarniku (dokument je razvijan nad tim slogom) — vidi Kandidat_Dokumenti_Pred_Print_CRUD.js.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$result = $mysqli->query("SELECT id, naziv, razvoj_tablica, razvoj_kolona FROM pdf_dokument WHERE aktivan = 1 ORDER BY naziv ASC");
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
