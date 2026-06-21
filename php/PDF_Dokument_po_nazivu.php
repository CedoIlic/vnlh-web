<?php
require_once __DIR__ . '/require_login_api.php';
// Jedan dokument PO NAZIVU: zaglavlje (pdf_dokument) + sve stavke (pdf_dokument_stavke).
// Koristi se za generiranje PDF-a iz aplikacije (npr. Esej forma traži dokument "Esej").
// Referenca po nazivu (a ne po fiksnom id-u) — odluka projekta.
$db_ret = require_once __DIR__ . '/00_db.php';
header('Content-Type: application/json; charset=utf-8');
if ($db_ret !== -1) {
    http_response_code(500);
    echo json_encode(['greska' => $db_ret]);
    exit;
}

$naziv = isset($_GET['naziv']) ? trim((string) $_GET['naziv']) : '';
if ($naziv === '') {
    echo json_encode(['greska' => '105']);
    exit;
}

$stmt = $mysqli->prepare('SELECT * FROM pdf_dokument WHERE naziv = ? ORDER BY id LIMIT 1');
$stmt->bind_param('s', $naziv);
$stmt->execute();
$res = $stmt->get_result();
$dokument = $res ? $res->fetch_assoc() : null;
$stmt->close();
if (!$dokument) {
    echo json_encode(['greska' => '108']);
    exit;
}

$id = (int) $dokument['id'];
$stmt = $mysqli->prepare('SELECT * FROM pdf_dokument_stavke WHERE dokument_id = ? ORDER BY redoslijed ASC, id ASC');
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result();
$stavke = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $stavke[] = $row;
    }
}
$stmt->close();

// Prored stila iz dokument_prored_default_stil — početna (default) vrijednost edita „Prored" u aplikaciji
// kad zapis (npr. esej) nema vlastiti dokument_prored.
$default_stil_prored = null;
if (!empty($dokument['dokument_prored_default_stil'])) {
    $sid = (int) $dokument['dokument_prored_default_stil'];
    $stmt = $mysqli->prepare('SELECT prored FROM pdf_paragraf WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $sid);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if ($row && $row['prored'] !== null) $default_stil_prored = $row['prored'];
}
$mysqli->close();

echo json_encode([
    'dokument' => $dokument,
    'stavke' => $stavke,
    'default_stil_prored' => $default_stil_prored
], JSON_UNESCAPED_UNICODE);
