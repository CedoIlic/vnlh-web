<?php
require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$d   = $raw ? json_decode($raw, true) : null;
if (!is_array($d)) { echo '105'; exit; }

function es_int($v)  { return ($v !== null && $v !== '') ? (int)$v : null; }
function es_str($v)  { $s = ($v !== null) ? trim((string)$v) : null; return ($s !== '' ? $s : null); }
function es_bit($v)  { return ($v ? 1 : 0); }

$id             = es_int($d['id']            ?? null);
$id_loza        = es_int($d['id_loza']       ?? null);
$id_autor       = es_int($d['id_autor']      ?? null);
$id_stupanj     = es_int($d['id_stupanj']    ?? null);

if (!$id || !$id_loza || !$id_autor || !$id_stupanj) { echo '105'; exit; }

$naslov_eseja   = es_str($d['naslov_eseja']   ?? null);
$kljucne_rijeci = es_str($d['kljucne_rijeci'] ?? null);
$esej           = es_str($d['esej']           ?? null);
$javno_dostupan = es_bit($d['javno_dostupan'] ?? 0);

try {
    $stmt = $mysqli->prepare("
        UPDATE eseji SET
            loza            = ?,
            autor           = ?,
            naslov_eseja    = ?,
            stupanj         = ?,
            kljucne_rijeci  = ?,
            esej            = ?,
            javno_dostupan  = ?
        WHERE id = ?
    ");
    $stmt->bind_param('iisissii',
        $id_loza, $id_autor, $naslov_eseja, $id_stupanj,
        $kljucne_rijeci, $esej, $javno_dostupan, $id
    );
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}

$mysqli->close();
