<?php
/**
 * Lista_slika_thumb_batch.php
 * Skupno vraćanje thumb slika za formu Lista (jedan HTTP zahtjev umjesto N paralelnih GET-ova).
 *
 * Ulaz: POST, Content-Type application/json, tijelo npr.
 *   { "id_clanovi": [1,2,3], "id_loze": [5] }
 * Izlaz: application/json { "ok": true, "clanovi": { "id": { "mime": "...", "b64": "..." } }, "loze": { ... } }
 * Za prazne slike ključ se ne uključuje.
 *
 * Logika thumba ista kao u Clanovi_CRUD_slika_thumb_round.php i Loze_CRUD_slika_thumb.php.
 * Nakon autentikacije session_write_close() da se ne drži lock tijekom čitanja blobova.
 */
require_once __DIR__ . '/require_login_api.php';

// Oslobađanje session locka prije čitanja većih podataka iz baze (paralelni zahtjevi istog korisnika).
if (session_status() === PHP_SESSION_ACTIVE) {
    session_write_close();
}

header('Content-Type: application/json; charset=utf-8');

// --- Parsiranje JSON tijela ---
$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!is_array($in)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json'], JSON_UNESCAPED_UNICODE);
    exit;
}

$idClanoviIn = isset($in['id_clanovi']) && is_array($in['id_clanovi']) ? $in['id_clanovi'] : [];
$idLozeIn = isset($in['id_loze']) && is_array($in['id_loze']) ? $in['id_loze'] : [];

/**
 * Normalizira niz u pozitivne jedinstvene cijele brojeve.
 *
 * @param array $arr
 * @param int $max
 * @return int[]
 */
function vnlh_lista_thumb_batch_int_ids(array $arr, int $max): array
{
    $out = [];
    $seen = [];
    foreach ($arr as $v) {
        $v = (int) $v;
        if ($v <= 0) {
            continue;
        }
        if (isset($seen[$v])) {
            continue;
        }
        $seen[$v] = true;
        $out[] = $v;
        if (count($out) >= $max) {
            break;
        }
    }
    return $out;
}

// Max jedinstvenih ID-jeva po zahtjevu (sprečava prevelik odgovor i opterećenje).
$idClanovi = vnlh_lista_thumb_batch_int_ids($idClanoviIn, 80);
$idLoze = vnlh_lista_thumb_batch_int_ids($idLozeIn, 40);

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'db'], JSON_UNESCAPED_UNICODE);
    exit;
}

$clanoviOut = [];
$lozeOut = [];

if (!empty($idClanovi)) {
    $sqlClan = 'SELECT slika_thumb_round, slika_thumb_round_mime, slika, slika_mime FROM clanovi WHERE id = ? LIMIT 1';
    $stmtClan = $mysqli->prepare($sqlClan);
    if ($stmtClan) {
        foreach ($idClanovi as $cid) {
            $idBind = (int) $cid;
            $stmtClan->bind_param('i', $idBind);
            $stmtClan->execute();
            $res = $stmtClan->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            if (!$row) {
                continue;
            }
            $data = $row['slika_thumb_round'];
            $mime = !empty($row['slika_thumb_round_mime']) ? trim((string) $row['slika_thumb_round_mime']) : null;
            if ($data === null || $data === '') {
                $data = $row['slika'];
                $mime = !empty($row['slika_mime']) ? trim((string) $row['slika_mime']) : null;
            }
            if ($data === null || $data === '') {
                continue;
            }
            $mime = $mime ?: 'application/octet-stream';
            $clanoviOut[(string) $cid] = [
                'mime' => $mime,
                'b64' => base64_encode($data),
            ];
        }
        $stmtClan->close();
    }
}

if (!empty($idLoze)) {
    $sqlLoza = 'SELECT slika_thumbnail, slika_thumbnail_mime, slika, slika_mime FROM loze WHERE id = ? LIMIT 1';
    $stmtLoza = $mysqli->prepare($sqlLoza);
    if ($stmtLoza) {
        foreach ($idLoze as $lid) {
            $idBindL = (int) $lid;
            $stmtLoza->bind_param('i', $idBindL);
            $stmtLoza->execute();
            $res = $stmtLoza->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            if (!$row) {
                continue;
            }
            $data = $row['slika_thumbnail'];
            $mime = !empty($row['slika_thumbnail_mime']) ? trim((string) $row['slika_thumbnail_mime']) : null;
            if ($data === null || $data === '') {
                $data = $row['slika'];
                $mime = !empty($row['slika_mime']) ? trim((string) $row['slika_mime']) : null;
            }
            if ($data === null || $data === '') {
                continue;
            }
            $mime = $mime ?: 'application/octet-stream';
            $lozeOut[(string) $lid] = [
                'mime' => $mime,
                'b64' => base64_encode($data),
            ];
        }
        $stmtLoza->close();
    }
}

$mysqli->close();

echo json_encode([
    'ok' => true,
    'clanovi' => $clanoviOut,
    'loze' => $lozeOut,
], JSON_UNESCAPED_UNICODE);
