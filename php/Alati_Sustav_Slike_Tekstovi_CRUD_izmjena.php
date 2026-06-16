<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}
require_once __DIR__ . '/Alati_Sustav_Slike_Tekstovi_CRUD_polja.php';

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}

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
    // Duplikat naziva osim tekućeg
    $stmt = $mysqli->prepare('SELECT id FROM sustav_slike_tekstovi WHERE LOWER(naziv) = LOWER(?) AND id <> ? LIMIT 1');
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('si', $naziv, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo '002';
        exit;
    }
    $stmt->close();

    // Sadržaj: nova slika → ažuriraj podatak+mime; slika bez nove datoteke → zadrži postojeće;
    // tekst/PDF blok → podatak=tekst, mime=NULL.
    $azurirajPodatak = false;
    $podatak = null;
    $mime = null;
    if (sst_je_slika($tip)) {
        if (isset($_FILES['podatak']) && $_FILES['podatak']['error'] === UPLOAD_ERR_OK) {
            $podatak = file_get_contents($_FILES['podatak']['tmp_name']);
            if ($podatak !== false) {
                $mime = isset($_POST['mime']) ? trim((string) $_POST['mime']) : (isset($_FILES['podatak']['type']) ? $_FILES['podatak']['type'] : '');
                if (!preg_match('#^image/[a-z0-9.+-]+$#i', $mime) || mb_strlen($mime, 'UTF-8') > 32) {
                    $mime = 'image/webp';
                }
                $azurirajPodatak = true;
            }
        }
    } else {
        $t = isset($_POST['podatak_tekst']) ? (string) $_POST['podatak_tekst'] : '';
        $podatak = ($t === '') ? null : $t;
        $mime = null;
        $azurirajPodatak = true;
    }

    if ($azurirajPodatak) {
        $stmt = $mysqli->prepare('UPDATE sustav_slike_tekstovi SET naziv = ?, tip_podatka = ?, mime = ?, podatak = ?, napomena = ? WHERE id = ?');
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            exit;
        }
        $stmt->bind_param('sssssi', $naziv, $tip, $mime, $podatak, $napomena, $id);
    } else {
        // slika bez nove datoteke — zadrži postojeći podatak/mime
        $stmt = $mysqli->prepare('UPDATE sustav_slike_tekstovi SET naziv = ?, tip_podatka = ?, napomena = ? WHERE id = ?');
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            exit;
        }
        $stmt->bind_param('sssi', $naziv, $tip, $napomena, $id);
    }
    $stmt->execute();
    echo 'OK';
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    echo '200,' . $e->getCode();
}
$mysqli->close();
