<?php
require_once __DIR__ . '/require_login_api.php';
// Popis dokumenata (zaglavlja) za picker forme PDF_Dokument_CRUD.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$result = $mysqli->query(
    'SELECT d.*, t.naziv AS template_naziv
     FROM pdf_dokument d
     LEFT JOIN pdf_template t ON t.id = d.template_id
     ORDER BY d.naziv ASC'
);
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();
