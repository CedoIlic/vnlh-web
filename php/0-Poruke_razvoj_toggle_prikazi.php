<?php
// =====================================================
// 0-Poruke_razvoj_toggle_prikazi.php
// API: vidljivost togglea „Razvoj” u modalu Poruke (lista + povijest tipa Poruka razvoju).
// Prikaz samo ako je var. 1004 = '1' I logirani id_korisnik u listi iz sustav_varijable.id = 1002.
//
// Izlaz:
//   (JSON) { “prikazi”: true|false }
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

$prikazi = false;
if (poruke_razvoj_sesija_je_clan_tima($mysqli)) {
    $res1004 = $mysqli->query('SELECT varijabla FROM sustav_varijable WHERE id = 1004 LIMIT 1');
    if ($res1004) {
        $row1004 = $res1004->fetch_assoc();
        $res1004->free();
        $prikazi = $row1004 && trim((string)($row1004['varijabla'] ?? '')) === '1';
    }
}
$mysqli->close();

echo json_encode(['prikazi' => $prikazi], JSON_UNESCAPED_UNICODE);
