<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
require_once __DIR__ . '/Alati_Sustav_Slike_Tekstovi_CRUD_polja.php';

$code = '';
$p = sst_citaj_polja($code);
if ($p === null) {
    echo $code;
    exit;
}
$naziv = $p['naziv'];
$tip = $p['tip_podatka'];
$napomena = $p['napomena'];

try {
    // Duplikat naziva
    $stmt = $mysqli->prepare('SELECT id FROM sustav_slike_tekstovi WHERE LOWER(naziv) = LOWER(?) LIMIT 1');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('s', $naziv);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();

    // Sadržaj: slika ($_FILES) ili tekst ($_POST['podatak_tekst'])
    $podatak = null;
    $mime = null;
    if (sst_je_slika($tip)) {
        if (isset($_FILES['podatak']) && $_FILES['podatak']['error'] === UPLOAD_ERR_OK) {
            $podatak = file_get_contents($_FILES['podatak']['tmp_name']);
            if ($podatak === false) {
                $podatak = null;
            }
            $mime = isset($_POST['mime']) ? trim((string) $_POST['mime']) : (isset($_FILES['podatak']['type']) ? $_FILES['podatak']['type'] : '');
            if (!preg_match('#^image/[a-z0-9.+-]+$#i', $mime) || mb_strlen($mime, 'UTF-8') > 32) {
                $mime = 'image/webp';
            }
        }
        if ($podatak === null) {
            echo '105'; // slika je obavezna kod novog zapisa slike
            exit;
        }
    } else {
        $t = isset($_POST['podatak_tekst']) ? (string) $_POST['podatak_tekst'] : '';
        $podatak = ($t === '') ? null : $t;
        $mime = null;
    }

    $stmt = $mysqli->prepare('INSERT INTO sustav_slike_tekstovi (naziv, tip_podatka, mime, podatak, napomena) VALUES (?, ?, ?, ?, ?)');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('sssss', $naziv, $tip, $mime, $podatak, $napomena);
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
