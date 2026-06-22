<?php
require_once __DIR__ . '/require_login_api.php';
// Razvojni/testni kontekst forme PDF_Dokument: pronalazak testnog ID-a sloga iz baze.
// Ulaz (GET):
//   ?sto=tablice                                  → popis baznih tablica koje imaju `id` PK
//   ?sto=kolone&tablica=X                          → kolone tablice X (bez BLOB/TEXT)
//   ?sto=vrijednosti&tablica=X&kolona=Y&trazi=Z     → [ {id, v}, ... ] (LIKE %Z%, LIMIT = sustav_varijable #121)
// Identifikatori se validiraju regexom i provjerom u information_schema (kao PDF_Generator_resolve.php).
// Sigurnost: smije ga zvati samo onaj tko smije i otvoriti formu PDF_Dokument; tablice su ograničene
// na whitelist pdf_dozvoljeni_izvori_dokumenata (i za kolone/vrijednosti, ne samo za popis).
require_once __DIR__ . '/vnlh_api_pravo_modula.php';
vnlh_api_zahtijevaj_modul('PDF_Dokument_CRUD.html');
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

/** Je li tablica na whitelisti dozvoljenih izvora dokumenta? (table-level granica za sve grane) */
function razvoj_tablica_dozvoljena($mysqli, $tablica)
{
    $stmt = $mysqli->prepare('SELECT 1 FROM pdf_dozvoljeni_izvori_dokumenata WHERE tablica = ? LIMIT 1');
    if (!$stmt) return false;
    $stmt->bind_param('s', $tablica);
    $stmt->execute();
    $stmt->store_result();
    $ima = $stmt->num_rows > 0;
    $stmt->close();
    return $ima;
}

/** Je li kolona na whitelisti dozvoljenih kolona te tablice? (pdf_dozvoljeni_izvori_dokumenata_kolone) */
function razvoj_kolona_dozvoljena($mysqli, $tablica, $kolona)
{
    $stmt = $mysqli->prepare('SELECT 1 FROM pdf_dozvoljeni_izvori_dokumenata d
        JOIN pdf_dozvoljeni_izvori_dokumenata_kolone k ON k.id_izvor = d.id
        WHERE d.tablica = ? AND k.kolona = ? LIMIT 1');
    if (!$stmt) return false;
    $stmt->bind_param('ss', $tablica, $kolona);
    $stmt->execute();
    $stmt->store_result();
    $ima = $stmt->num_rows > 0;
    $stmt->close();
    return $ima;
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
    // Dozvoljene tablice = whitelist (pdf_dozvoljeni_izvori_dokumenata) ∩ bazne tablice koje
    // stvarno postoje i imaju stupac `id` (PK na koji se veže testni kontekst). Popis se uređuje
    // kroz formu „Dozvoljeni izvori dokumenata" (PDF_Dozvoljeni_izvori_dokumenata_CRUD).
    $sql = "SELECT d.tablica AS naziv
            FROM pdf_dozvoljeni_izvori_dokumenata d
            JOIN information_schema.TABLES t
              ON t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = d.tablica AND t.TABLE_TYPE = 'BASE TABLE'
            JOIN information_schema.COLUMNS c
              ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.COLUMN_NAME = 'id'
            ORDER BY d.tablica";
    $res = $mysqli->query($sql);
    $out = [];
    if ($res) { while ($r = $res->fetch_assoc()) $out[] = $r['naziv']; }
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($sto === 'kolone') {
    $tablica = isset($_GET['tablica']) ? (string) $_GET['tablica'] : '';
    if (!razvoj_ident_ok($tablica)) { echo json_encode(['greska' => '105']); exit; }
    if (!razvoj_tablica_dozvoljena($mysqli, $tablica)) { echo json_encode(['greska' => '105']); exit; }
    // Samo DOZVOLJENE kolone (pdf_dozvoljeni_izvori_dokumenata_kolone) koje i dalje postoje i nisu BLOB/TEXT.
    $stmt = $mysqli->prepare(
        "SELECT k.kolona AS naziv
         FROM pdf_dozvoljeni_izvori_dokumenata d
         JOIN pdf_dozvoljeni_izvori_dokumenata_kolone k ON k.id_izvor = d.id
         JOIN information_schema.COLUMNS c
           ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = d.tablica AND c.COLUMN_NAME = k.kolona
          AND c.DATA_TYPE NOT IN ('blob','tinyblob','mediumblob','longblob','text','tinytext','mediumtext','longtext')
         WHERE d.tablica = ?
         ORDER BY k.kolona");
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
    if (!razvoj_tablica_dozvoljena($mysqli, $tablica)) { echo json_encode(['greska' => '105']); exit; }
    if (!razvoj_kolona_dozvoljena($mysqli, $tablica, $kolona)) { echo json_encode(['greska' => '105']); exit; }
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
