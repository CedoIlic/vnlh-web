<?php
require_once __DIR__ . '/require_login_api.php';
// Pretraga ID retka po vrijednosti kolone u whitelist tablici (za modal "Izbor ID za test").
// Ulaz: POST JSON { izvor_id, kolona, vrijednost }. Tablica se izvodi iz pdf_dozvoljeni_izvori,
// kolona se validira (postoji u tablici); vrijednost ide kao bound parametar. Izlaz: { id: <broj|null> }.
$db_ret = require_once __DIR__ . '/00_db.php';
header('Content-Type: application/json; charset=utf-8');
if ($db_ret !== -1) {
    http_response_code(500);
    echo json_encode(['greska' => 'Baza nedostupna.']);
    exit;
}

function ti_ident_ok($s) { return is_string($s) && preg_match('/^[A-Za-z0-9_]+$/', $s) === 1; }

$raw = file_get_contents('php://input');
$u = json_decode($raw, true);
if (!is_array($u)) { echo json_encode(['id' => null]); exit; }

$izvorId = isset($u['izvor_id']) ? (int) $u['izvor_id'] : 0;
$kolona = isset($u['kolona']) ? (string) $u['kolona'] : '';
$vrijednost = isset($u['vrijednost']) ? (string) $u['vrijednost'] : '';
if ($izvorId <= 0 || !ti_ident_ok($kolona)) { echo json_encode(['id' => null]); exit; }

// izvor_id -> tablica (whitelist)
$stmt = $mysqli->prepare('SELECT tablica FROM pdf_dozvoljeni_izvori WHERE id = ? LIMIT 1');
$stmt->bind_param('i', $izvorId);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();
if (!$row || !ti_ident_ok($row['tablica'])) { echo json_encode(['id' => null]); exit; }
$tablica = $row['tablica'];

// kolona mora postojati u toj tablici
$stmt = $mysqli->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
$stmt->bind_param('ss', $tablica, $kolona);
$stmt->execute();
$r2 = $stmt->get_result();
$ok = $r2 && $r2->fetch_row();
$stmt->close();
if (!$ok) { echo json_encode(['id' => null]); exit; }

// Točno podudaranje, najmanji id
$sql = "SELECT id FROM `$tablica` WHERE `$kolona` = ? ORDER BY id LIMIT 1";
$stmt = $mysqli->prepare($sql);
if (!$stmt) { echo json_encode(['id' => null]); exit; }
$stmt->bind_param('s', $vrijednost);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();
$mysqli->close();

echo json_encode(['id' => $row ? (int) $row['id'] : null]);
