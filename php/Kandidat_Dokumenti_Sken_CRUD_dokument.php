<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Sken_CRUD_dokument.php – servira BLOB skena (GET id) s pripadajućim MIME-om (pregled).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { http_response_code(500); header('Content-Type: text/plain'); echo $db_ret; exit; }
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) { http_response_code(404); exit; }
$stmt = $mysqli->prepare("SELECT dokument, podatak_mime FROM kandidat_dokumenti_sken WHERE id = ? LIMIT 1");
if (!$stmt) { http_response_code(500); exit; }
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();
$mysqli->close();
if (!$row || $row['dokument'] === null || $row['dokument'] === '') { http_response_code(404); exit; }
$mime = !empty($row['podatak_mime']) ? $row['podatak_mime'] : 'application/pdf';
header('Content-Type: ' . $mime);
header('Content-Disposition: inline; filename="sken.pdf"');
header('X-Content-Type-Options: nosniff');
echo $row['dokument'];
?>
