<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_CRUD_upis.php – INSERT loze (nova struktura + slika kao Stupnjevi).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id_regija = isset($_POST['id_regija']) ? (int)$_POST['id_regija'] : 0;
$naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
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

if ($id_regija <= 0 || $naziv === '') {
    echo '105';
    exit;
}

$slika = null;
$slika_mime = null;
$slika_thumbnail = null;
$slika_thumbnail_mime = null;
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

$cols = ['id_regija', 'id_obred', 'id_tip_loze', 'id_drzava', 'id_drzava_adrese', 'naziv', 'adresa_loze_1', 'adresa_loze_2', 'grad', 'posta', 'telefon_loze', 'meil_loze', 'datum_nastanka', 'napomena', 'aktivnost', 'slika', 'slika_mime', 'slika_thumbnail', 'slika_thumbnail_mime'];
$vals = [];
$bind_types = '';
$bind_values = [];
$vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$id_regija;
$vals[] = ($id_obred === null ? 'NULL' : '?'); if ($id_obred !== null) { $bind_types .= 'i'; $bind_values[] = &$id_obred; }
$vals[] = ($id_tip_loze === null ? 'NULL' : '?'); if ($id_tip_loze !== null) { $bind_types .= 'i'; $bind_values[] = &$id_tip_loze; }
$vals[] = ($id_drzava === null ? 'NULL' : '?'); if ($id_drzava !== null) { $bind_types .= 'i'; $bind_values[] = &$id_drzava; }
$vals[] = ($id_drzava_adrese === null ? 'NULL' : '?'); if ($id_drzava_adrese !== null) { $bind_types .= 'i'; $bind_values[] = &$id_drzava_adrese; }
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$naziv;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$adresa_1;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$adresa_2;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$grad;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$posta;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$telefon;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$meil;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$datum;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$napomena;
$vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$aktivnost;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_mime;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail;
$vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail_mime;

$sql = "INSERT INTO loze (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $vals) . ")";
try {
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    array_unshift($bind_values, $bind_types);
    $refs = [];
    foreach ($bind_values as $k => $v) { $refs[$k] = &$bind_values[$k]; }
    call_user_func_array([$stmt, 'bind_param'], $refs);
    $stmt->execute();
    $stmt->close();
    echo 'OK';
} catch (mysqli_sql_exception $e) {
    if (isset($stmt) && $stmt) $stmt->close();
    if ($e->getCode() == 1062) { echo '109'; exit; }
    echo '200,' . $e->getCode();
    exit;
} catch (Throwable $e) {
    if (isset($stmt) && $stmt) $stmt->close();
    echo '200,0';
    exit;
}
$mysqli->close();
