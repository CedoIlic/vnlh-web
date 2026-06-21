<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_CRUD_izmjena.php – UPDATE loze (nova struktura + slika kao Stupnjevi).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$id_regija = isset($_POST['id_regija']) ? (int)$_POST['id_regija'] : 0;
$naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
$orjent = (isset($_POST['orjent']) && trim($_POST['orjent']) !== '') ? trim($_POST['orjent']) : null;   // Orijent lože; prazno → NULL
$adresa_1 = isset($_POST['adresa_loze_1']) ? trim($_POST['adresa_loze_1']) : '';
$adresa_2 = isset($_POST['adresa_loze_2']) ? trim($_POST['adresa_loze_2']) : '';
$grad = isset($_POST['grad']) ? trim($_POST['grad']) : '';
$posta = isset($_POST['posta']) ? trim($_POST['posta']) : '';
$telefon = isset($_POST['telefon_loze']) ? trim($_POST['telefon_loze']) : '';
$meil = isset($_POST['meil_loze']) ? trim($_POST['meil_loze']) : '';
$datum = isset($_POST['datum_nastanka']) && trim($_POST['datum_nastanka']) !== '' ? trim($_POST['datum_nastanka']) : null;
$napomena = isset($_POST['napomena']) ? trim($_POST['napomena']) : '';
$aktivnost = isset($_POST['aktivnost']) ? (int)$_POST['aktivnost'] : 1;
$raw_obred = isset($_POST['id_obred']) ? trim((string)$_POST['id_obred']) : '';
$raw_tip = isset($_POST['id_tip_loze']) ? trim((string)$_POST['id_tip_loze']) : '';
$raw_drzava = isset($_POST['id_drzava']) ? trim((string)$_POST['id_drzava']) : '';
$raw_drzava_adrese = isset($_POST['id_drzava_adrese']) ? trim((string)$_POST['id_drzava_adrese']) : '';
$id_obred = ($raw_obred === '' || $raw_obred === '0') ? null : (int)$raw_obred;
$id_tip_loze = ($raw_tip === '' || $raw_tip === '0') ? null : (int)$raw_tip;
$id_drzava = ($raw_drzava === '' || $raw_drzava === '0') ? null : (int)$raw_drzava;
$id_drzava_adrese = ($raw_drzava_adrese === '' || $raw_drzava_adrese === '0') ? null : (int)$raw_drzava_adrese;
if ($id <= 0 || $id_regija <= 0 || $naziv === '') { echo '105'; exit; }

$stmt_ex = $mysqli->prepare("SELECT slika, slika_mime, slika_thumbnail, slika_thumbnail_mime FROM loze WHERE id = ? LIMIT 1");
if (!$stmt_ex) { echo '200,' . $mysqli->errno; exit; }
$stmt_ex->bind_param('i', $id);
$stmt_ex->execute();
$res_ex = $stmt_ex->get_result();
$row_ex = $res_ex && $res_ex->num_rows > 0 ? $res_ex->fetch_assoc() : null;
$stmt_ex->close();
$slika = $row_ex ? $row_ex['slika'] : null;
$slika_mime = $row_ex ? $row_ex['slika_mime'] : null;
$slika_thumbnail = $row_ex ? $row_ex['slika_thumbnail'] : null;
$slika_thumbnail_mime = $row_ex ? $row_ex['slika_thumbnail_mime'] : null;

if (isset($_FILES['slika']) && $_FILES['slika']['error'] === UPLOAD_ERR_OK) {
    $tmp = $_FILES['slika']['tmp_name'];
    $t = isset($_FILES['slika']['type']) ? $_FILES['slika']['type'] : '';
    if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
        $slika = file_get_contents($tmp);
        if ($slika !== false) {
            $slika_mime = isset($_POST['slika_mime']) ? trim((string)$_POST['slika_mime']) : $t;
            if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_mime) || mb_strlen($slika_mime) > 32) $slika_mime = 'image/webp';
        } else $slika = null;
    }
}
if (isset($_FILES['thumb']) && $_FILES['thumb']['error'] === UPLOAD_ERR_OK) {
    $tmp = $_FILES['thumb']['tmp_name'];
    $t = isset($_FILES['thumb']['type']) ? $_FILES['thumb']['type'] : '';
    if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
        $thumbRaw = file_get_contents($tmp);
        if ($thumbRaw !== false) {
            $thumbMime = isset($_POST['thumb_mime']) ? trim((string)$_POST['thumb_mime']) : $t;
            if (!preg_match('#^image/[a-z0-9.+-]+$#i', $thumbMime) || mb_strlen($thumbMime) > 32) $thumbMime = 'image/jpeg';
            $processed = false;
            try {
                if (!function_exists('loze_thumb_remove_background')) require_once __DIR__ . '/Loze_thumb_remove_bg.php';
                $processed = loze_thumb_remove_background($thumbRaw, $thumbMime);
            } catch (Throwable $e) {
                $processed = false;
            }
            if ($processed && is_array($processed) && isset($processed[0], $processed[1])) {
                $slika_thumbnail = $processed[0];
                $slika_thumbnail_mime = $processed[1];
            } else {
                $slika_thumbnail = $thumbRaw;
                $slika_thumbnail_mime = $thumbMime;
            }
        } else $slika_thumbnail = null;
    }
}

$set_parts = [];
$bind_types = '';
$bind_values = [];
$set_parts[] = 'id_regija=?'; $bind_types .= 'i'; $bind_values[] = &$id_regija;
$set_parts[] = ($id_obred === null ? 'id_obred=NULL' : 'id_obred=?'); if ($id_obred !== null) { $bind_types .= 'i'; $bind_values[] = &$id_obred; }
$set_parts[] = ($id_tip_loze === null ? 'id_tip_loze=NULL' : 'id_tip_loze=?'); if ($id_tip_loze !== null) { $bind_types .= 'i'; $bind_values[] = &$id_tip_loze; }
$set_parts[] = ($id_drzava === null ? 'id_drzava=NULL' : 'id_drzava=?'); if ($id_drzava !== null) { $bind_types .= 'i'; $bind_values[] = &$id_drzava; }
$set_parts[] = ($id_drzava_adrese === null ? 'id_drzava_adrese=NULL' : 'id_drzava_adrese=?'); if ($id_drzava_adrese !== null) { $bind_types .= 'i'; $bind_values[] = &$id_drzava_adrese; }
$set_parts[] = 'naziv=?'; $bind_types .= 's'; $bind_values[] = &$naziv;
$set_parts[] = 'orjent=?'; $bind_types .= 's'; $bind_values[] = &$orjent;
$set_parts[] = 'adresa_loze_1=?'; $bind_types .= 's'; $bind_values[] = &$adresa_1;
$set_parts[] = 'adresa_loze_2=?'; $bind_types .= 's'; $bind_values[] = &$adresa_2;
$set_parts[] = 'grad=?'; $bind_types .= 's'; $bind_values[] = &$grad;
$set_parts[] = 'posta=?'; $bind_types .= 's'; $bind_values[] = &$posta;
$set_parts[] = 'telefon_loze=?'; $bind_types .= 's'; $bind_values[] = &$telefon;
$set_parts[] = 'meil_loze=?'; $bind_types .= 's'; $bind_values[] = &$meil;
$set_parts[] = 'datum_nastanka=?'; $bind_types .= 's'; $bind_values[] = &$datum;
$set_parts[] = 'napomena=?'; $bind_types .= 's'; $bind_values[] = &$napomena;
$set_parts[] = 'aktivnost=?'; $bind_types .= 'i'; $bind_values[] = &$aktivnost;
$set_parts[] = 'slika=?'; $bind_types .= 's'; $bind_values[] = &$slika;
$set_parts[] = 'slika_mime=?'; $bind_types .= 's'; $bind_values[] = &$slika_mime;
$set_parts[] = 'slika_thumbnail=?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail;
$set_parts[] = 'slika_thumbnail_mime=?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail_mime;
$bind_types .= 'i'; $bind_values[] = &$id;

$sql = "UPDATE loze SET " . implode(', ', $set_parts) . " WHERE id=?";
$stmt = $mysqli->prepare($sql);
if (!$stmt) { echo '200,' . $mysqli->errno; exit; }
array_unshift($bind_values, $bind_types);
$refs = [];
foreach ($bind_values as $k => $v) { $refs[$k] = &$bind_values[$k]; }
call_user_func_array([$stmt, 'bind_param'], $refs);
try {
    $stmt->execute();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if ($e->getCode() == 1062) { echo '109'; exit; }
    echo '200,' . $e->getCode();
}
$stmt->close();
$mysqli->close();
