<?php
// =====================================================
// 0-Poruke_razvoj_toggle_prikazi.php
// API: vidljivost togglea „Razvoj” u modalu Poruke (lista + povijest tipa Poruka razvoju).
// Prikaz samo ako je logirani id_korisnik u listi iz sustav_varijable.id = 1002 (i lista nije prazna).
//
// Izlaz:
//   (JSON) { "prikazi": true|false }
//   (TEXT) Greška konekcije: 100
// =====================================================

require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/poruke_razvoj_var_1002.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$prikazi = poruke_razvoj_sesija_je_clan_tima($mysqli);
$mysqli->close();

echo json_encode(['prikazi' => $prikazi], JSON_UNESCAPED_UNICODE);
