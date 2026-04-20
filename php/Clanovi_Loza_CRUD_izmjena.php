<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_Loza_CRUD_izmjena.php – UPDATE samo polja s edit panela Clanovi_Loza (ne dira šifru, stupanj, aktivnost, kandidat, zastavice, upisano).

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function normalize_name($s)
{
    $s = trim((string)$s);
    if ($s === '') return '';
    if (function_exists('mb_convert_case')) {
        return mb_convert_case($s, MB_CASE_TITLE, 'UTF-8');
    }
    $s = strtolower($s);
    return ucwords($s);
}

header('Content-Type: text/plain; charset=utf-8');

try {
    $mysqli->begin_transaction();

    $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $id_loza = isset($_POST['id_loza']) ? (int)$_POST['id_loza'] : 0;

    $prezime_raw = isset($_POST['prezime']) ? $_POST['prezime'] : '';
    $ime_raw = isset($_POST['ime']) ? $_POST['ime'] : '';

    $prezime = normalize_name($prezime_raw);
    $ime = normalize_name($ime_raw);

    $spol = isset($_POST['spol']) ? (int)$_POST['spol'] : 0;

    $datum_rodjenja = isset($_POST['datum_rodjenja']) && trim((string)$_POST['datum_rodjenja']) !== '' ? trim((string)$_POST['datum_rodjenja']) : null;
    $oib_raw = isset($_POST['oib']) ? preg_replace('/\D/', '', (string)$_POST['oib']) : '';
    $oib = ($oib_raw === '') ? null : substr($oib_raw, 0, 11);
    /* datum_inicijacije / datum_stupnja: forma Clanovi_Loza ne uređuje – ne diramo u UPDATE-u. */

    $raw_porijeklo = isset($_POST['porijeklo']) ? trim((string)$_POST['porijeklo']) : '';
    $porijeklo = ($raw_porijeklo === '' || $raw_porijeklo === '0') ? null : (int)$raw_porijeklo;

    $raw_na_prijedlog = isset($_POST['na_prijedlog']) ? trim((string)$_POST['na_prijedlog']) : '';
    $na_prijedlog = ($raw_na_prijedlog === '' || $raw_na_prijedlog === '0') ? null : (int)$raw_na_prijedlog;

    $telefon_text = isset($_POST['telefon_text']) ? trim((string)$_POST['telefon_text']) : '';
    $email_text = isset($_POST['email_text']) ? trim((string)$_POST['email_text']) : '';

    $adresa_1 = isset($_POST['adresa_1']) ? trim((string)$_POST['adresa_1']) : '';
    $adresa_2 = isset($_POST['adresa_2']) ? trim((string)$_POST['adresa_2']) : '';
    $grad = isset($_POST['grad']) ? trim((string)$_POST['grad']) : '';
    $posta = isset($_POST['posta']) ? trim((string)$_POST['posta']) : '';
    $raw_id_drzava_adrese = isset($_POST['id_drzava_adrese']) ? trim((string)$_POST['id_drzava_adrese']) : '';
    $id_drzava_adrese = ($raw_id_drzava_adrese === '' || $raw_id_drzava_adrese === '0') ? null : (int)$raw_id_drzava_adrese;

    $napomena = isset($_POST['napomena']) ? trim((string)$_POST['napomena']) : '';

    if ($id <= 0 || $id_loza <= 0) {
        $mysqli->rollback();
        echo '105';
        exit;
    }
    if ($prezime === '') {
        $mysqli->rollback();
        echo '115';
        exit;
    }

    // Dohvat postojećih FK za telefon/e_mail/adresa i slike (radi brisanja / update-a).
    $stmt = $mysqli->prepare("SELECT telefon, e_mail, adresa, slika, slika_mime, slika_thumbnail, slika_thumbnail_mime, slika_thumb_round, slika_thumb_round_mime, slika_thumb_round_position FROM clanovi WHERE id = ? FOR UPDATE");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        $stmt->close();
        $mysqli->rollback();
        echo '108';
        exit;
    }
    $row_existing = $res->fetch_assoc();
    $stmt->close();
    $old_telefon_fk = $row_existing['telefon'] !== null ? (int)$row_existing['telefon'] : null;
    $old_email_fk = $row_existing['e_mail'] !== null ? (int)$row_existing['e_mail'] : null;
    $old_adresa_fk = $row_existing['adresa'] !== null ? (int)$row_existing['adresa'] : null;

    $slika = $row_existing['slika'];
    $slika_mime = $row_existing['slika_mime'];
    $slika_thumbnail = $row_existing['slika_thumbnail'];
    $slika_thumbnail_mime = $row_existing['slika_thumbnail_mime'];
    $slika_thumb_round = $row_existing['slika_thumb_round'];
    $slika_thumb_round_mime = $row_existing['slika_thumb_round_mime'];
    $slika_thumb_round_position = $row_existing['slika_thumb_round_position'] !== null ? (int)$row_existing['slika_thumb_round_position'] : null;

    // Validacija na_prijedlog.
    $infoCode = null;
    if ($na_prijedlog !== null) {
        $stmt = $mysqli->prepare("SELECT id FROM clanovi WHERE id = ? LIMIT 1");
        $stmt->bind_param('i', $na_prijedlog);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows === 0) {
            $na_prijedlog = null;
            $infoCode = '110';
        }
        $stmt->close();
    }

    // Dohvat id_drzava iz loze (obavezno za kolonu drzava u clanovi; FK, uvjet za sifru).
    $stmt = $mysqli->prepare("SELECT id_drzava FROM loze WHERE id = ? LIMIT 1");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id_loza);
    $stmt->execute();
    $res = $stmt->get_result();
    $row_loza = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row_loza || $row_loza['id_drzava'] === null || (string)$row_loza['id_drzava'] === '') {
        $mysqli->rollback();
        echo '117';
        exit;
    }
    $id_drzava = (int)$row_loza['id_drzava'];

    // Obrada slike: ako je došla nova slika / thumbs, zamijeniti postojeće vrijednosti.
    if (isset($_FILES['slika']) && $_FILES['slika']['error'] === UPLOAD_ERR_OK) {
        $tmp = $_FILES['slika']['tmp_name'];
        $t = isset($_FILES['slika']['type']) ? $_FILES['slika']['type'] : '';
        if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
            $slikaData = file_get_contents($tmp);
            if ($slikaData !== false) {
                $slika = $slikaData;
                $slika_mime = isset($_POST['slika_mime']) ? trim((string)$_POST['slika_mime']) : $t;
                if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_mime) || mb_strlen($slika_mime) > 32) $slika_mime = 'image/webp';
            }
        }
    }
    if (isset($_FILES['thumb']) && $_FILES['thumb']['error'] === UPLOAD_ERR_OK) {
        $tmp = $_FILES['thumb']['tmp_name'];
        $t = isset($_FILES['thumb']['type']) ? $_FILES['thumb']['type'] : '';
        if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
            $thumbData = file_get_contents($tmp);
            if ($thumbData !== false) {
                $slika_thumbnail = $thumbData;
                $slika_thumbnail_mime = isset($_POST['thumb_mime']) ? trim((string)$_POST['thumb_mime']) : $t;
                if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_thumbnail_mime) || mb_strlen($slika_thumbnail_mime) > 32) $slika_thumbnail_mime = 'image/jpeg';
            }
        }
    }
    if (isset($_FILES['thumb_round']) && $_FILES['thumb_round']['error'] === UPLOAD_ERR_OK) {
        $tmp = $_FILES['thumb_round']['tmp_name'];
        $t = isset($_FILES['thumb_round']['type']) ? $_FILES['thumb_round']['type'] : '';
        if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
            $roundData = file_get_contents($tmp);
            if ($roundData !== false) {
                $slika_thumb_round = $roundData;
                $slika_thumb_round_mime = isset($_POST['thumb_round_mime']) ? trim((string)$_POST['thumb_round_mime']) : $t;
                if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_thumb_round_mime) || mb_strlen($slika_thumb_round_mime) > 32) $slika_thumb_round_mime = 'image/webp';
            }
        }
    }
    $raw_pos = isset($_POST['thumb_round_position']) ? trim((string)$_POST['thumb_round_position']) : '';
    if ($raw_pos !== '' && is_numeric($raw_pos)) {
        $pos = (int)$raw_pos;
        if ($pos >= -32768 && $pos <= 32767) {
            $slika_thumb_round_position = $pos;
        }
    } elseif (isset($_POST['thumb_round_position']) && $raw_pos === '') {
        $slika_thumb_round_position = null;
    }

    // UPDATE osnovnih podataka u clanovi – bez šifre, stupnja, aktivnosti, kandidata, zastavica, upisano.
    $set_parts = [];
    $bind_types = '';
    $bind_values = [];

    $set_parts[] = 'loza=?'; $bind_types .= 'i'; $bind_values[] = &$id_loza;
    $set_parts[] = 'drzava=?'; $bind_types .= 'i'; $bind_values[] = &$id_drzava;
    $set_parts[] = 'prezime=?'; $bind_types .= 's'; $bind_values[] = &$prezime;
    $set_parts[] = 'ime=?'; $bind_types .= 's'; $bind_values[] = &$ime;
    $set_parts[] = 'spol=?'; $bind_types .= 'i'; $bind_values[] = &$spol;

    $set_parts[] = 'datum_rodjenja=?'; $bind_types .= 's'; $bind_values[] = &$datum_rodjenja;
    $set_parts[] = ($oib === null ? 'oib=NULL' : 'oib=?'); if ($oib !== null) { $bind_types .= 's'; $bind_values[] = &$oib; }

    $set_parts[] = ($porijeklo === null ? 'porijeklo=NULL' : 'porijeklo=?'); if ($porijeklo !== null) { $bind_types .= 'i'; $bind_values[] = &$porijeklo; }

    $set_parts[] = ($na_prijedlog === null ? 'na_prijedlog=NULL' : 'na_prijedlog=?'); if ($na_prijedlog !== null) { $bind_types .= 'i'; $bind_values[] = &$na_prijedlog; }

    $set_parts[] = 'napomena=?'; $bind_types .= 's'; $bind_values[] = &$napomena;
    $set_parts[] = 'slika=?'; $bind_types .= 's'; $bind_values[] = &$slika;
    $set_parts[] = 'slika_mime=?'; $bind_types .= 's'; $bind_values[] = &$slika_mime;
    $set_parts[] = 'slika_thumbnail=?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail;
    $set_parts[] = 'slika_thumbnail_mime=?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail_mime;
    $set_parts[] = 'slika_thumb_round=?'; $bind_types .= 's'; $bind_values[] = &$slika_thumb_round;
    $set_parts[] = 'slika_thumb_round_mime=?'; $bind_types .= 's'; $bind_values[] = &$slika_thumb_round_mime;
    $set_parts[] = ($slika_thumb_round_position === null ? 'slika_thumb_round_position=NULL' : 'slika_thumb_round_position=?');
    if ($slika_thumb_round_position !== null) {
        $bind_types .= 'i';
        $bind_values[] = &$slika_thumb_round_position;
    }

    $bind_types .= 'i'; $bind_values[] = &$id;
    $sql = "UPDATE clanovi SET " . implode(', ', $set_parts) . " WHERE id = ?";
    $stmt = $mysqli->prepare($sql);
    array_unshift($bind_values, $bind_types);
    $refs = [];
    foreach ($bind_values as $k => $v) {
        $refs[$k] = &$bind_values[$k];
    }
    call_user_func_array([$stmt, 'bind_param'], $refs);
    $stmt->execute();
    $stmt->close();

    // TELEFON
    $telefon_fk = $old_telefon_fk;
    if ($telefon_text === '') {
        // Brisanje postojećeg telefona (ako postoji).
        if ($old_telefon_fk !== null) {
            $stmt = $mysqli->prepare("DELETE FROM telefoni WHERE id = ?");
            $stmt->bind_param('i', $old_telefon_fk);
            $stmt->execute();
            $stmt->close();
            $telefon_fk = null;
        }
    } else {
        // Tip telefona = 1
        $res = $mysqli->query("SELECT id FROM telefoni_tip WHERE `Tip` = 1 ORDER BY id ASC LIMIT 1");
        if (!$res || $res->num_rows === 0) {
            $mysqli->rollback();
            echo '111';
            exit;
        }
        $row = $res->fetch_assoc();
        $id_tip_tel = (int)$row['id'];
        $res->free();

        if ($old_telefon_fk !== null) {
            $stmt = $mysqli->prepare("UPDATE telefoni SET id_clanovi = ?, id_telefoni_tip = ?, telefon = ? WHERE id = ?");
            $stmt->bind_param('iisi', $id, $id_tip_tel, $telefon_text, $old_telefon_fk);
            $stmt->execute();
            $stmt->close();
            $telefon_fk = $old_telefon_fk;
        } else {
            $stmt = $mysqli->prepare("INSERT INTO telefoni (id_clanovi, id_telefoni_tip, telefon) VALUES (?, ?, ?)");
            $stmt->bind_param('iis', $id, $id_tip_tel, $telefon_text);
            $stmt->execute();
            $telefon_fk = (int)$mysqli->insert_id;
            $stmt->close();
        }
    }

    // E-MAIL
    $email_fk = $old_email_fk;
    if ($email_text === '') {
        if ($old_email_fk !== null) {
            $stmt = $mysqli->prepare("DELETE FROM e_maili WHERE id = ?");
            $stmt->bind_param('i', $old_email_fk);
            $stmt->execute();
            $stmt->close();
            $email_fk = null;
        }
    } else {
        $res = $mysqli->query("SELECT id FROM email_tip WHERE `Tip` = 1 ORDER BY id ASC LIMIT 1");
        if (!$res || $res->num_rows === 0) {
            $mysqli->rollback();
            echo '112';
            exit;
        }
        $row = $res->fetch_assoc();
        $id_tip_email = (int)$row['id'];
        $res->free();

        if ($old_email_fk !== null) {
            $stmt = $mysqli->prepare("UPDATE e_maili SET id_clanovi = ?, id_email_tip = ?, email = ? WHERE id = ?");
            $stmt->bind_param('iisi', $id, $id_tip_email, $email_text, $old_email_fk);
            $stmt->execute();
            $stmt->close();
            $email_fk = $old_email_fk;
        } else {
            $stmt = $mysqli->prepare("INSERT INTO e_maili (id_clanovi, id_email_tip, email) VALUES (?, ?, ?)");
            $stmt->bind_param('iis', $id, $id_tip_email, $email_text);
            $stmt->execute();
            $email_fk = (int)$mysqli->insert_id;
            $stmt->close();
        }
    }

    // ADRESA
    $ima_adresu = ($adresa_1 !== '' || $adresa_2 !== '' || $grad !== '' || $posta !== '' || $id_drzava_adrese !== null);
    $adresa_fk = $old_adresa_fk;
    if (!$ima_adresu) {
        if ($old_adresa_fk !== null) {
            $stmt = $mysqli->prepare("DELETE FROM adrese WHERE id = ?");
            $stmt->bind_param('i', $old_adresa_fk);
            $stmt->execute();
            $stmt->close();
            $adresa_fk = null;
        }
    } else {
        $res = $mysqli->query("SELECT id FROM adrese_tip WHERE `Tip` = 1 ORDER BY id ASC LIMIT 1");
        if (!$res || $res->num_rows === 0) {
            $mysqli->rollback();
            echo '113';
            exit;
        }
        $row = $res->fetch_assoc();
        $id_tip_adrese = (int)$row['id'];
        $res->free();

        if ($old_adresa_fk !== null) {
            $stmt = $mysqli->prepare("UPDATE adrese SET id_clanovi = ?, id_adrese_tip = ?, id_drzave_adrese = ?, adresa_1 = ?, adresa_2 = ?, grad = ?, posta = ? WHERE id = ?");
            $stmt->bind_param('iiissssi', $id, $id_tip_adrese, $id_drzava_adrese, $adresa_1, $adresa_2, $grad, $posta, $old_adresa_fk);
            $stmt->execute();
            $stmt->close();
            $adresa_fk = $old_adresa_fk;
        } else {
            $stmt = $mysqli->prepare("INSERT INTO adrese (id_clanovi, id_adrese_tip, id_drzave_adrese, adresa_1, adresa_2, grad, posta) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param('iiissss', $id, $id_tip_adrese, $id_drzava_adrese, $adresa_1, $adresa_2, $grad, $posta);
            $stmt->execute();
            $adresa_fk = (int)$mysqli->insert_id;
            $stmt->close();
        }
    }

    // Ažurirati FK u clanovi (telefon/e_mail/adresa).
    $set_fk = [];
    $bind_types_fk = '';
    $bind_vals_fk = [];
    if ($telefon_fk !== $old_telefon_fk) {
        if ($telefon_fk === null) {
            $set_fk[] = 'telefon = NULL';
        } else {
            $set_fk[] = 'telefon = ?';
            $bind_types_fk .= 'i';
            $bind_vals_fk[] = &$telefon_fk;
        }
    }
    if ($email_fk !== $old_email_fk) {
        if ($email_fk === null) {
            $set_fk[] = 'e_mail = NULL';
        } else {
            $set_fk[] = 'e_mail = ?';
            $bind_types_fk .= 'i';
            $bind_vals_fk[] = &$email_fk;
        }
    }
    if ($adresa_fk !== $old_adresa_fk) {
        if ($adresa_fk === null) {
            $set_fk[] = 'adresa = NULL';
        } else {
            $set_fk[] = 'adresa = ?';
            $bind_types_fk .= 'i';
            $bind_vals_fk[] = &$adresa_fk;
        }
    }
    if (!empty($set_fk)) {
        $bind_types_fk .= 'i';
        $bind_vals_fk[] = &$id;
        $sql = "UPDATE clanovi SET " . implode(', ', $set_fk) . " WHERE id = ?";
        $stmt = $mysqli->prepare($sql);
        array_unshift($bind_vals_fk, $bind_types_fk);
        $refs = [];
        foreach ($bind_vals_fk as $k => $v) {
            $refs[$k] = &$bind_vals_fk[$k];
        }
        call_user_func_array([$stmt, 'bind_param'], $refs);
        $stmt->execute();
        $stmt->close();
    }

    $mysqli->commit();

    if ($infoCode !== null) {
        echo $infoCode;
    } else {
        echo 'OK';
    }
} catch (mysqli_sql_exception $e) {
    if (isset($mysqli) && $mysqli->errno) {
        $mysqli->rollback();
    }
    if ($e->getCode() == 1062) {
        echo '114';
    } else {
        echo '200,' . $e->getCode();
    }
} catch (Throwable $e) {
    if (isset($mysqli) && $mysqli->errno) {
        $mysqli->rollback();
    }
    echo '200,0';
}

$mysqli->close();
