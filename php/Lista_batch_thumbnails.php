<?php
/**
 * Lista_batch_thumbnails.php – batch dohvat thumb slika za Listu članova (sprječava burst GET-ova).
 *
 * POST, Content-Type: application/json
 * Tijelo: { "id_clanovi": [int,...], "id_loze": [int,...] }
 * Odgovor: { "ok": true, "clanovi": { "id": { "mime": "...", "b64": "..." } }, "loze": { ... } }
 *
 * Logika slika ista kao Clanovi_CRUD_slika_thumb_round.php i Loze_CRUD_slika_thumb.php
 */
require_once __DIR__ . '/require_login_api.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'err' => 'method'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'err' => 'json'], JSON_UNESCAPED_UNICODE);
    exit;
}

/** @return int[] */
function lista_batch_sanitize_ids($arr)
{
    if (!is_array($arr)) {
        return [];
    }
    $seen = [];
    $out = [];
    foreach ($arr as $v) {
        $n = (int)$v;
        if ($n > 0 && !isset($seen[$n])) {
            $seen[$n] = true;
            $out[] = $n;
        }
    }
    return $out;
}

const LISTA_BATCH_THUMB_MAX_IDS = 500;

$id_clanovi = lista_batch_sanitize_ids($data['id_clanovi'] ?? []);
$id_loze = lista_batch_sanitize_ids($data['id_loze'] ?? []);

$total = count($id_clanovi) + count($id_loze);
if ($total > LISTA_BATCH_THUMB_MAX_IDS) {
    $id_clanovi = array_slice($id_clanovi, 0, max(0, LISTA_BATCH_THUMB_MAX_IDS));
    $remain = LISTA_BATCH_THUMB_MAX_IDS - count($id_clanovi);
    if ($remain > 0 && count($id_loze) > $remain) {
        $id_loze = array_slice($id_loze, 0, $remain);
    } elseif ($remain <= 0) {
        $id_loze = [];
    }
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'err' => 'db', 'code' => $db_ret], JSON_UNESCAPED_UNICODE);
    exit;
}

$out_clanovi = [];
$out_loze = [];

/**
 * ID-jevi su već pozitivni intovi; IN (...) kao literal zbog kompatibilnosti (mysqli bind_param + get_result bez mysqlnd često 500).
 *
 * @param mysqli $mysqli
 */
function lista_batch_fetch_clanovi($mysqli, array $ids, &$out)
{
    $ids = array_values(array_filter(array_map('intval', $ids), function ($x) {
        return $x > 0;
    }));
    if (count($ids) === 0) {
        return;
    }
    $in = implode(',', $ids);
    $sql = "SELECT id, slika_thumb_round, slika_thumb_round_mime, slika, slika_mime FROM clanovi WHERE id IN ($in)";
    $res = $mysqli->query($sql);
    if (!$res) {
        return;
    }
    while ($row = $res->fetch_assoc()) {
        $rid = (int)$row['id'];
        $data_b = $row['slika_thumb_round'];
        $mime = !empty($row['slika_thumb_round_mime']) ? trim((string)$row['slika_thumb_round_mime']) : null;
        if ($data_b === null || $data_b === '') {
            $data_b = $row['slika'];
            $mime = !empty($row['slika_mime']) ? trim((string)$row['slika_mime']) : null;
        }
        if ($data_b === null || $data_b === '') {
            continue;
        }
        $mime = $mime ?: 'application/octet-stream';
        $out[(string)$rid] = [
            'mime' => $mime,
            'b64' => base64_encode((string)$data_b),
        ];
    }
    $res->free();
}

/**
 * @param mysqli $mysqli
 */
function lista_batch_fetch_loze($mysqli, array $ids, &$out)
{
    $ids = array_values(array_filter(array_map('intval', $ids), function ($x) {
        return $x > 0;
    }));
    if (count($ids) === 0) {
        return;
    }
    $in = implode(',', $ids);
    $sql = "SELECT id, slika_thumbnail, slika_thumbnail_mime, slika, slika_mime FROM loze WHERE id IN ($in)";
    $res = $mysqli->query($sql);
    if (!$res) {
        return;
    }
    while ($row = $res->fetch_assoc()) {
        $rid = (int)$row['id'];
        $data_b = $row['slika_thumbnail'];
        $mime = !empty($row['slika_thumbnail_mime']) ? trim((string)$row['slika_thumbnail_mime']) : null;
        if ($data_b === null || $data_b === '') {
            $data_b = $row['slika'];
            $mime = !empty($row['slika_mime']) ? trim((string)$row['slika_mime']) : null;
        }
        if ($data_b === null || $data_b === '') {
            continue;
        }
        $mime = $mime ?: 'application/octet-stream';
        $out[(string)$rid] = [
            'mime' => $mime,
            'b64' => base64_encode((string)$data_b),
        ];
    }
    $res->free();
}

lista_batch_fetch_clanovi($mysqli, $id_clanovi, $out_clanovi);
lista_batch_fetch_loze($mysqli, $id_loze, $out_loze);

$mysqli->close();

echo json_encode([
    'ok' => true,
    'clanovi' => $out_clanovi,
    'loze' => $out_loze,
], JSON_UNESCAPED_UNICODE);
