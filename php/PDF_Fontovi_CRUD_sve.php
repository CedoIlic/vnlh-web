<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$result = $mysqli->query(
    'SELECT id, naziv, pdfmake_kljuc, porodica, tip, podrzana_pisma, aktivan, napomena
     FROM pdf_fontovi
     ORDER BY naziv ASC'
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
