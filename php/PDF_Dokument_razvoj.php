<?php
require_once __DIR__ . '/require_login_api.php';
// Razvojni/testni kontekst forme PDF_Dokument: pronalazak testnog ID-a sloga iz baze.
// Ulaz (GET):
//   ?sto=tablice                                  → popis baznih tablica koje imaju `id` PK
//   ?sto=kolone&tablica=X                          → kolone tablice X (bez BLOB/TEXT)
//   ?sto=vrijednosti&tablica=X&kolona=Y&trazi=Z     → [ {id, v}, ... ] (LIKE %Z%, LIMIT = sustav_varijable #121)
// Identifikatori se validiraju regexom i provjerom u information_schema (kao PDF_Generator_resolve.php).
$db_ret = require_once __DIR__ . '/00_db.php';
header('Content-Type: application/json; charset=utf-8');
if ($db_ret !== -1) {
    http_response_code(500);
    echo json_encode(['greska' => $db_ret]);
    exit;
}

/** Dozvoljen identifikator (tablica/kolona): slova, brojke, podvlaka. */
function razvoj_ident_ok($s) { return is_string($s) && preg_match('/^[A-Za-z0-9_]+$/', $s) === 1; }

/** Limit broja vrijednosti u selektu Vrijednost — sustav_varijable #121 (fallback 100). */
function razvoj_limit_vrijednosti($mysqli)
{
    $lim = 100;
    $st = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 121 LIMIT 1');
    if ($st) {
        $st->execute();
        $rs = $st->get_result();
        if ($rs && ($x = $rs->fetch_assoc())) {
            $n = (int) trim((string) $x['varijabla']);
            if ($n > 0) $lim = $n;
        }
        $st->close();
    }
    return $lim;
}

/** Postoji li kolona u tablici (trenutna baza)? */
function razvoj_kolona_postoji($mysqli, $tablica, $kolona)
{
    $stmt = $mysqli->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $stmt->bind_param('ss', $tablica, $kolona);
    $stmt->execute();
    $stmt->store_result();
    $ima = $stmt->num_rows > 0;
    $stmt->close();
    return $ima;
}

$sto = isset($_GET['sto']) ? (string) $_GET['sto'] : '';

if ($sto === 'tablice') {
    // Sve bazne tablice koje imaju stupac `id` (PK na koji se veže testni kontekst).
    $sql = "SELECT t.TABLE_NAME AS naziv
            FROM information_schema.TABLES t
            JOIN information_schema.COLUMNS c
              ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.COLUMN_NAME = 'id'
            WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE'
            ORDER BY t.TABLE_NAME";
    $res = $mysqli->query($sql);
    $out = [];
    if ($res) { while ($r = $res->fetch_assoc()) $out[] = $r['naziv']; }
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($sto === 'kolone') {
    $tablica = isset($_GET['tablica']) ? (string) $_GET['tablica'] : '';
    if (!razvoj_ident_ok($tablica)) { echo json_encode(['greska' => '105']); exit; }
    // Preskoči BLOB/TEXT tipove (nisu prikladni za pretragu/prikaz vrijednosti).
    $stmt = $mysqli->prepare(
        "SELECT COLUMN_NAME AS naziv FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
           AND DATA_TYPE NOT IN ('blob','tinyblob','mediumblob','longblob','text','tinytext','mediumtext','longtext')
         ORDER BY ORDINAL_POSITION");
    $stmt->bind_param('s', $tablica);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($r = $res->fetch_assoc()) $out[] = $r['naziv'];
    $stmt->close();
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($sto === 'vrijednosti') {
    $tablica = isset($_GET['tablica']) ? (string) $_GET['tablica'] : '';
    $kolona  = isset($_GET['kolona'])  ? (string) $_GET['kolona']  : '';
    $trazi   = isset($_GET['trazi'])   ? (string) $_GET['trazi']   : '';
    if (!razvoj_ident_ok($tablica) || !razvoj_ident_ok($kolona)) { echo json_encode(['greska' => '105']); exit; }
    // Identifikatori validirani regexom + provjerom postojanja → sigurni za interpolaciju s backtickovima.
    if (!razvoj_kolona_postoji($mysqli, $tablica, $kolona) || !razvoj_kolona_postoji($mysqli, $tablica, 'id')) {
        echo json_encode(['greska' => '108']);
        exit;
    }
    $MAX_VRIJEDNOSTI = razvoj_limit_vrijednosti($mysqli);   // limit iz sustav_varijable #121
    if ($trazi !== '') {
        $sql = "SELECT `id` AS id, `$kolona` AS v FROM `$tablica` WHERE `$kolona` LIKE ? ORDER BY `$kolona` LIMIT $MAX_VRIJEDNOSTI";
        $stmt = $mysqli->prepare($sql);
        $like = '%' . $trazi . '%';
        $stmt->bind_param('s', $like);
    } else {
        $sql = "SELECT `id` AS id, `$kolona` AS v FROM `$tablica` ORDER BY `$kolona` LIMIT $MAX_VRIJEDNOSTI";
        $stmt = $mysqli->prepare($sql);
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($r = $res->fetch_assoc()) $out[] = ['id' => (int) $r['id'], 'v' => $r['v']];
    $stmt->close();
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['greska' => '105']);
