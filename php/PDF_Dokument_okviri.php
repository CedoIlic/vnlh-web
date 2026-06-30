<?php
require_once __DIR__ . '/require_login_api.php';
// PDF_Dokument_okviri.php — vraća vezane tekst blokove (pdf_template_okvir) za zadani template_id.
// Koristi „zona" select u PDF_Dokument formi (ponuda blokova uz zaglavlje/podnožje/tijelo/naslovna).
// GET template_id. Vraća JSON [ {id, naziv, redoslijed}, ... ] (prazan niz ako nema okvira).
require_once __DIR__ . '/vnlh_api_pravo_modula.php';
vnlh_api_zahtijevaj_modul('PDF_Dokument_CRUD.html');
$db_ret = require_once __DIR__ . '/00_db.php';
header('Content-Type: application/json; charset=utf-8');
if ($db_ret !== -1) {
    http_response_code(500);
    echo json_encode(['greska' => $db_ret]);
    exit;
}

$template_id = isset($_GET['template_id']) ? (int) $_GET['template_id'] : 0;
if ($template_id <= 0) { echo json_encode([]); exit; }

$stmt = $mysqli->prepare('SELECT id, naziv, redoslijed FROM pdf_template_okvir WHERE template_id = ? ORDER BY redoslijed, id');
$stmt->bind_param('i', $template_id);
$stmt->execute();
$res = $stmt->get_result();
$out = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $out[] = ['id' => (int) $row['id'], 'naziv' => $row['naziv'], 'redoslijed' => (int) $row['redoslijed']];
    }
}
$stmt->close();
$mysqli->close();

echo json_encode($out, JSON_UNESCAPED_UNICODE);
