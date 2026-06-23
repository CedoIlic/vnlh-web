<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Jezici_CRUD_drzave_aktivne.php
// Aktivne države za select izbora zastave (kod, naziv).
// Opcijski POST/GET 'ukljuci' = kod koji se uvijek uključi (npr. trenutno spremljena,
// makar je u međuvremenu deaktivirana) da se izborom u formi ne izgubi.
// Izlaz (JSON): [ { "kod": "hr", "naziv": "Hrvatska" }, ... ]
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$ukljuci = isset($_REQUEST['ukljuci']) ? strtolower(trim($_REQUEST['ukljuci'])) : '';
if ($ukljuci !== '' && !preg_match('/^[a-z]{2}$/', $ukljuci)) {
    $ukljuci = '';
}

if ($ukljuci !== '') {
    $sql = "SELECT kod, naziv FROM sustav_drzave WHERE aktivan = 1 OR kod = ? ORDER BY naziv ASC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }
    $stmt->bind_param('s', $ukljuci);
    $stmt->execute();
    $result = $stmt->get_result();
} else {
    $result = $mysqli->query("SELECT kod, naziv FROM sustav_drzave WHERE aktivan = 1 ORDER BY naziv ASC");
}

if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}

$rows = [];
while ($r = $result->fetch_assoc()) {
    $rows[] = ['kod' => (string) $r['kod'], 'naziv' => (string) $r['naziv']];
}

header('Content-Type: application/json');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);

$mysqli->close();
