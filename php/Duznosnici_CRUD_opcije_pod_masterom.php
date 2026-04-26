<?php
/**
 * JSON: dužnosnici za select — ovisno o Master id-u, smjeru i načinu povrata.
 *
 * ULAZNI PARAMETRI (GET)
 *
 *     master_id — ID sloga u tablici dužnosnika koji je „Master“ (kontekst).
 *                 Stanja: int > 0 koji mora postojati i imati aktivnost = 1; inače [].
 *
 *     smjer — koji dio hijerarhije uzeti u odnosu na Mastera.
 *             Stanja: iznad | ispod (default iznad; sve ostalo → iznad).
 *             Primjena: samo kad je povrat_cijelog_seta = 0.
 *             • iznad — predci (nadređeni prema korijenu), bez Mastera.
 *             • ispod — potomci (podstablo ispod Mastera).
 *
 *     povrat_cijelog_seta — filtrirani skup ili cijeli set bez Mastera.
 *                           Stanja: 0 | 1 (default 0; sve ostalo → 0).
 *                           • 0 — vrijede smjer i hijerarhijski filteri.
 *                           • 1 — ignorira se smjer; svi dužnosnici osim Mastera (id <> master_id),
 *                                 osim ako je ukljuci_mastera = 1 (tada svi, uključujući Mastera).
 *
 *     ukljuci_mastera — uključuje li se Master u povratnu listu uz ostale.
 *                       Stanja: 0 | 1 (default 0; sve ostalo → 0).
 *                       • 0 — lista bez Mastera (postojeće ponašanje po načinu rada).
 *                       • 1 — Master je u listi (kod povrat_cijelog_seta = 1: cijela tablica).
 *
 * Povrat: u JSON-u samo slogovi s aktivnost = 1 (neaktivni dužnosnici se ne vraćaju).
 *         Svaki slog: id, naziv, razina (0–99; 0 = nije uneseno u Dužnici; za Nosioci / filtar „S razinom“).
 */
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$master_id = isset($_GET['master_id']) ? (int) $_GET['master_id'] : 0;
$smjerRaw = isset($_GET['smjer']) ? trim((string) $_GET['smjer']) : 'iznad';
$smjer = strtolower($smjerRaw);
if ($smjer !== 'ispod') {
    $smjer = 'iznad';
}

$povratCijelogSeta = isset($_GET['povrat_cijelog_seta']) ? (int) $_GET['povrat_cijelog_seta'] : 0;
if ($povratCijelogSeta !== 1) {
    $povratCijelogSeta = 0;
}

$ukljuciMastera = isset($_GET['ukljuci_mastera']) ? (int) $_GET['ukljuci_mastera'] : 0;
if ($ukljuciMastera !== 1) {
    $ukljuciMastera = 0;
}

if ($master_id <= 0) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([]);
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare('SELECT id FROM duznosnici WHERE id = ? AND aktivnost = 1 LIMIT 1');
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $master_id);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close();
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([]);
    $mysqli->close();
    exit;
}
$stmt->close();

// Cijeli set — bez filtriranja po smjeru; po defaultu bez Mastera, uz ukljuci_mastera = 1 i Master.
if ($povratCijelogSeta === 1) {
    if ($ukljuciMastera === 1) {
        $resFull = $mysqli->query('SELECT id, naziv, razina FROM duznosnici WHERE aktivnost = 1 ORDER BY naziv ASC');
    } else {
        $stmt = $mysqli->prepare('SELECT id, naziv, razina FROM duznosnici WHERE id <> ? AND aktivnost = 1 ORDER BY naziv ASC');
        if (!$stmt) {
            header('Content-Type: text/plain');
            echo '200,' . $mysqli->errno;
            $mysqli->close();
            exit;
        }
        $stmt->bind_param('i', $master_id);
        $stmt->execute();
        $resFull = $stmt->get_result();
    }
    $outFull = [];
    if ($resFull) {
        while ($r = $resFull->fetch_assoc()) {
            $outFull[] = [
                'id' => (int) $r['id'],
                'naziv' => $r['naziv'] !== null ? $r['naziv'] : '',
                'razina' => isset($r['razina']) ? (int) $r['razina'] : 0,
            ];
        }
    }
    if ($ukljuciMastera !== 1 && isset($stmt) && $stmt) {
        $stmt->close();
    }
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($outFull, JSON_UNESCAPED_UNICODE);
    $mysqli->close();
    exit;
}

$idsZaNazive = [];

if ($smjer === 'iznad') {
    $cur = $master_id;
    $guard = 0;
    while ($guard < 10000) {
        $guard++;
        $stmt = $mysqli->prepare('SELECT id_nadredjeni FROM duznosnici WHERE id = ? LIMIT 1');
        if (!$stmt) {
            break;
        }
        $stmt->bind_param('i', $cur);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        if (!$row) {
            break;
        }
        $p = isset($row['id_nadredjeni']) ? (int) $row['id_nadredjeni'] : 0;
        if ($p <= 0) {
            break;
        }
        $idsZaNazive[] = $p;
        $cur = $p;
    }
} else {
    $result = $mysqli->query('SELECT id, id_nadredjeni FROM duznosnici WHERE aktivnost = 1');
    if (!$result) {
        header('Content-Type: text/plain');
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
    $idsZaNazive = $potomciIds;
}

if ($ukljuciMastera === 1 && $master_id > 0) {
    $idsZaNazive[] = $master_id;
}

$idsZaNazive = array_values(array_unique(array_filter(array_map('intval', $idsZaNazive), function ($x) {
    return $x > 0;
})));

if (empty($idsZaNazive)) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([]);
    $mysqli->close();
    exit;
}

$inList = implode(',', $idsZaNazive);
$sql = "SELECT id, naziv, razina FROM duznosnici WHERE id IN ($inList) AND aktivnost = 1 ORDER BY naziv ASC";
$res2 = $mysqli->query($sql);
$out = [];
if ($res2) {
    while ($r = $res2->fetch_assoc()) {
        $out[] = [
            'id' => (int) $r['id'],
            'naziv' => $r['naziv'] !== null ? $r['naziv'] : '',
            'razina' => isset($r['razina']) ? (int) $r['razina'] : 0,
        ];
    }
}

header('Content-Type: application/json; charset=UTF-8');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
$mysqli->close();
