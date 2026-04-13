<?php
// =====================================================
// 0-Poruke_neprocitane.php
// API: postoje li nepročitane poruke za logiranog korisnika.
// Lagani endpoint za polling (mail ikona boja).
//
// Optimizacija: umjesto COUNT(*) na tablici poruka (koja raste),
// čita boolean flag ima_neprocitanih iz sustav_sesije_aktivne
// (PK/UNIQUE lookup po session_id – minimalno opterećenje baze).
// Flag ažuriraju: 0-Poruke_posalji, 0-Poruke_poruke, 0-Poruke_brisi, Login.
//
// Ulaz: nema parametara (koristi session_id() za lookup)
//
// Izlaz:
//   (JSON) Uspjeh: {"neprocitane": 0 ili 1}
//   (TEXT) Greška konekcije: 100
//   (TEXT) SQL greška: 200
// =====================================================

require_once __DIR__ . '/require_login_api.php';

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// --- Blok: Čitaj flag ima_neprocitanih iz sustav_sesije_aktivne ---
// Lookup po UNIQUE KEY session_id – najbrži mogući upit na ovoj tablici.
$sessionId = session_id();

$sql = "SELECT ima_neprocitanih FROM sustav_sesije_aktivne WHERE session_id = ? AND status = 'aktivna' LIMIT 1";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno]);
    exit;
}

$stmt->bind_param('s', $sessionId);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmt->errno]);
    $stmt->close();
    exit;
}

$result = $stmt->get_result();
$row = $result->fetch_assoc();
// Ako sesija nije nađena (timeout/odjava), sigurno nema nepročitanih
$flag = $row ? (int) $row['ima_neprocitanih'] : 0;

$stmt->close();
$mysqli->close();

echo json_encode(['neprocitane' => $flag], JSON_UNESCAPED_UNICODE);
