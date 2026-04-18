<?php
/**
 * Duznosnici_Osobe_CRUD_dodjele.php — početno stanje dodjela za „Nosioci dužnosti”.
 *
 * GET: master_id — isti kontekst kao Duznosnici_CRUD_opcije_pod_masterom.php (smjer ispod, bez mastera u listi).
 * JSON: [ { "id_duznosnik": int, "id_korisnik": int }, ... ]
 *        id_korisnik u sustav_korisnici = id člana (clanovi.id), usklađeno s Duznosnici_Osobe_CRUD_upis.php.
 * Više korisnika na istoj dužnosti: više redaka; klijent uzima prvi po sortiranju za mapu jedan-na-jedan.
 */
require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$master_id = isset($_GET['master_id']) ? (int) $_GET['master_id'] : 0;

if ($master_id <= 0) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare('SELECT id FROM duznosnici WHERE id = ? AND aktivnost = 1 LIMIT 1');
if (!$stmt) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $master_id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}
$stmt->close();

// Isti skup id-jeva dužnosti kao u opcije_pod_masterom (smjer = ispod, bez povrata cijelog seta).
$result = $mysqli->query('SELECT id, id_nadredjeni FROM duznosnici WHERE aktivnost = 1');
if (!$result) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

$children = [];
while ($row = $result->fetch_assoc()) {
    $pid = isset($row['id_nadredjeni']) ? (int) $row['id_nadredjeni'] : 0;
    if (!isset($children[$pid])) {
        $children[$pid] = [];
    }
    $children[$pid][] = (int) $row['id'];
}

$potomciIds = [];
$queue = isset($children[$master_id]) ? $children[$master_id] : [];
$seen = [];
while (!empty($queue)) {
    $nid = (int) array_shift($queue);
    if (isset($seen[$nid])) {
        continue;
    }
    $seen[$nid] = true;
    $potomciIds[] = $nid;
    if (!empty($children[$nid])) {
        foreach ($children[$nid] as $c) {
            $queue[] = $c;
        }
    }
}

$idsZaNazive = array_values(array_unique(array_filter(array_map('intval', $potomciIds), function ($x) {
    return $x > 0;
})));

if (empty($idsZaNazive)) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([], JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

$inList = implode(',', $idsZaNazive);
$sql = "SELECT id_duznosnik, id_korisnik FROM sustav_korisnici WHERE id_duznosnik IN ($inList) ORDER BY id_duznosnik ASC, id_korisnik ASC";
$resS = $mysqli->query($sql);
$out = [];
if ($resS) {
    while ($r = $resS->fetch_assoc()) {
        $out[] = [
            'id_duznosnik' => (int) $r['id_duznosnik'],
            'id_korisnik' => (int) $r['id_korisnik'],
        ];
    }
}

$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
