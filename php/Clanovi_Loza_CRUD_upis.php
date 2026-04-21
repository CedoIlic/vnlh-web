<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_Loza_CRUD_upis.php – INSERT (forma Clanovi_Loza): samo polja koja stvarno šaljemo (bez eksplicitnog NULL za „prazna“ polja).
// drzava = id_drzava iz POST-a (select države); loza = id_loza (select lože). Provjera: loža mora pripadati toj državi.
// Ne upisujemo: sifra, stupanj, datum_inicijacije, datum_stupnja (kolone u INSERT-u uopće ne ulaze).
// Fiksno kad upisujemo red: aktivnost=0, kandidat=1, zastavice=0; upisano = NOW().
// Napredovanja (Transfer Excel) – ovaj endpoint ne upisuje ništa u napredovanja.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

/**
 * Normalizira ime/prezime: trim, svaka riječ prvo slovo veliko ostala mala.
 */
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

    $id_loza = isset($_POST['id_loza']) ? (int)$_POST['id_loza'] : 0;
    $id_drzava = isset($_POST['id_drzava']) ? (int)$_POST['id_drzava'] : 0;

    $prezime_raw = isset($_POST['prezime']) ? $_POST['prezime'] : '';
    $ime_raw = isset($_POST['ime']) ? $_POST['ime'] : '';

    $prezime = normalize_name($prezime_raw);
    $ime = normalize_name($ime_raw);

    $spol = isset($_POST['spol']) ? (int)$_POST['spol'] : 0;

    $datum_rodjenja = isset($_POST['datum_rodjenja']) && trim((string)$_POST['datum_rodjenja']) !== '' ? trim((string)$_POST['datum_rodjenja']) : null;
    $oib_raw = isset($_POST['oib']) ? preg_replace('/\D/', '', (string)$_POST['oib']) : '';
    $oib = ($oib_raw === '') ? null : substr($oib_raw, 0, 11);

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
    /* Poslovno pravilo ove forme: novi član je kandidat, neaktivan, bez zastavica u UI. */
    $aktivnost = 0;
    $kandidat = 1;
    $zastavice = 0;

    if ($id_loza <= 0 || $id_drzava <= 0) {
        $mysqli->rollback();
        echo '105';
        exit;
    }
    if ($prezime === '') {
        $mysqli->rollback();
        echo '115';
        exit;
    }

    // Loža mora postojati i imati isti id_drzava kao odabrana država u formi.
    $stmt = $mysqli->prepare("SELECT id FROM loze WHERE id = ? AND id_drzava = ? LIMIT 1");
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('ii', $id_loza, $id_drzava);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows === 0) {
        $stmt->close();
        $mysqli->rollback();
        echo '117';
        exit;
    }
    $stmt->close();

    // Validacija na_prijedlog – ako ne postoji član, ne šaljemo polje (NULL u starom modelu); informacija 110.
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

    // Obrada slike: slika, thumb, kružni thumb (64px).
    $slika = null;
    $slika_mime = null;
    $slika_thumbnail = null;
    $slika_thumbnail_mime = null;
    $slika_thumb_round = null;
    $slika_thumb_round_mime = null;
    $slika_thumb_round_position = null;

    if (isset($_FILES['slika']) && $_FILES['slika']['error'] === UPLOAD_ERR_OK) {
        $tmp = $_FILES['slika']['tmp_name'];
        $t = isset($_FILES['slika']['type']) ? $_FILES['slika']['type'] : '';
        if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
            $slika = file_get_contents($tmp);
            if ($slika !== false) {
                $slika_mime = isset($_POST['slika_mime']) ? trim((string)$_POST['slika_mime']) : $t;
                if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_mime) || mb_strlen($slika_mime) > 32) $slika_mime = 'image/webp';
            } else {
                $slika = null;
            }
        }
    }
    if (isset($_FILES['thumb']) && $_FILES['thumb']['error'] === UPLOAD_ERR_OK) {
        $tmp = $_FILES['thumb']['tmp_name'];
        $t = isset($_FILES['thumb']['type']) ? $_FILES['thumb']['type'] : '';
        if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
            $slika_thumbnail = file_get_contents($tmp);
            if ($slika_thumbnail !== false) {
                $slika_thumbnail_mime = isset($_POST['thumb_mime']) ? trim((string)$_POST['thumb_mime']) : $t;
                if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_thumbnail_mime) || mb_strlen($slika_thumbnail_mime) > 32) $slika_thumbnail_mime = 'image/jpeg';
            } else {
                $slika_thumbnail = null;
            }
        }
    }
    if (isset($_FILES['thumb_round']) && $_FILES['thumb_round']['error'] === UPLOAD_ERR_OK) {
        $tmp = $_FILES['thumb_round']['tmp_name'];
        $t = isset($_FILES['thumb_round']['type']) ? $_FILES['thumb_round']['type'] : '';
        if (is_uploaded_file($tmp) && $t && strpos($t, 'image/') === 0) {
            $slika_thumb_round = file_get_contents($tmp);
            if ($slika_thumb_round !== false) {
                $slika_thumb_round_mime = isset($_POST['thumb_round_mime']) ? trim((string)$_POST['thumb_round_mime']) : $t;
                if (!preg_match('#^image/[a-z0-9.+-]+$#i', $slika_thumb_round_mime) || mb_strlen($slika_thumb_round_mime) > 32) $slika_thumb_round_mime = 'image/webp';
            } else {
                $slika_thumb_round = null;
            }
        }
    }
    $raw_pos = isset($_POST['thumb_round_position']) ? trim((string)$_POST['thumb_round_position']) : '';
    if ($raw_pos !== '' && is_numeric($raw_pos)) {
        $pos = (int)$raw_pos;
        if ($pos >= -32768 && $pos <= 32767) {
            $slika_thumb_round_position = $pos;
        }
    }

    /*
     * INSERT: samo kolone za koje imamo vrijednost (bez stupnjeva / datum_inicijacije / datum_stupnja / šifre).
     * telefon, e_mail, adresa FK-ovi ne ulaze ovdje – popune se UPDATE-om nakon pomoćnih tablica.
     */
    $cols = ['loza', 'drzava', 'prezime', 'ime', 'spol'];
    $placeholders = ['?', '?', '?', '?', '?'];
    $bind_types = 'iissi';
    $bind_params = [&$id_loza, &$id_drzava, &$prezime, &$ime, &$spol];

    if ($datum_rodjenja !== null) {
        $cols[] = 'datum_rodjenja';
        $placeholders[] = '?';
        $bind_types .= 's';
        $bind_params[] = &$datum_rodjenja;
    }
    if ($oib !== null) {
        $cols[] = 'oib';
        $placeholders[] = '?';
        $bind_types .= 's';
        $bind_params[] = &$oib;
    }
    if ($porijeklo !== null) {
        $cols[] = 'porijeklo';
        $placeholders[] = '?';
        $bind_types .= 'i';
        $bind_params[] = &$porijeklo;
    }
    if ($na_prijedlog !== null) {
        $cols[] = 'na_prijedlog';
        $placeholders[] = '?';
        $bind_types .= 'i';
        $bind_params[] = &$na_prijedlog;
    }
    if ($napomena !== '') {
        $cols[] = 'napomena';
        $placeholders[] = '?';
        $bind_types .= 's';
        $bind_params[] = &$napomena;
    }

    /* Slike – samo ako postoji glavna slika; thumb/kružni samo ako su generirani. */
    if ($slika !== null) {
        $cols[] = 'slika';
        $placeholders[] = '?';
        $bind_types .= 's';
        $bind_params[] = &$slika;
        $cols[] = 'slika_mime';
        $placeholders[] = '?';
        $bind_types .= 's';
        $bind_params[] = &$slika_mime;
        if ($slika_thumbnail !== null) {
            $cols[] = 'slika_thumbnail';
            $placeholders[] = '?';
            $bind_types .= 's';
            $bind_params[] = &$slika_thumbnail;
            $cols[] = 'slika_thumbnail_mime';
            $placeholders[] = '?';
            $bind_types .= 's';
            $bind_params[] = &$slika_thumbnail_mime;
        }
        if ($slika_thumb_round !== null) {
            $cols[] = 'slika_thumb_round';
            $placeholders[] = '?';
            $bind_types .= 's';
            $bind_params[] = &$slika_thumb_round;
            $cols[] = 'slika_thumb_round_mime';
            $placeholders[] = '?';
            $bind_types .= 's';
            $bind_params[] = &$slika_thumb_round_mime;
        }
        if ($slika_thumb_round_position !== null) {
            $cols[] = 'slika_thumb_round_position';
            $placeholders[] = '?';
            $bind_types .= 'i';
            $bind_params[] = &$slika_thumb_round_position;
        }
    }

    $cols[] = 'upisano';
    $placeholders[] = 'NOW()';

    $cols[] = 'aktivnost';
    $placeholders[] = '?';
    $bind_types .= 'i';
    $bind_params[] = &$aktivnost;
    $cols[] = 'kandidat';
    $placeholders[] = '?';
    $bind_types .= 'i';
    $bind_params[] = &$kandidat;
    $cols[] = 'zastavice';
    $placeholders[] = '?';
    $bind_types .= 'i';
    $bind_params[] = &$zastavice;

    $sql = 'INSERT INTO clanovi (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    array_unshift($bind_params, $bind_types);
    $refs = [];
    foreach ($bind_params as $key => $value) {
        $refs[$key] = &$bind_params[$key];
    }
    call_user_func_array([$stmt, 'bind_param'], $refs);
    $stmt->execute();
    $stmt->close();

    $clan_id = (int)$mysqli->insert_id;

    // TELEFON – samo ako je upisan tekst.
    $telefon_fk = null;
    if ($telefon_text !== '') {
        $res = $mysqli->query("SELECT id FROM telefoni_tip WHERE `Tip` = 1 ORDER BY id ASC LIMIT 1");
        if (!$res || $res->num_rows === 0) {
            $mysqli->rollback();
            echo '111';
            exit;
        }
        $row = $res->fetch_assoc();
        $id_tip_tel = (int)$row['id'];
        $res->free();

        $stmt = $mysqli->prepare("INSERT INTO telefoni (id_clanovi, id_telefoni_tip, telefon) VALUES (?, ?, ?)");
        $stmt->bind_param('iis', $clan_id, $id_tip_tel, $telefon_text);
        $stmt->execute();
        $telefon_fk = (int)$mysqli->insert_id;
        $stmt->close();
    }

    // E-MAIL – samo ako je upisan tekst.
    $email_fk = null;
    if ($email_text !== '') {
        $res = $mysqli->query("SELECT id FROM email_tip WHERE `Tip` = 1 ORDER BY id ASC LIMIT 1");
        if (!$res || $res->num_rows === 0) {
            $mysqli->rollback();
            echo '112';
            exit;
        }
        $row = $res->fetch_assoc();
        $id_tip_email = (int)$row['id'];
        $res->free();

        $stmt = $mysqli->prepare("INSERT INTO e_maili (id_clanovi, id_email_tip, email) VALUES (?, ?, ?)");
        $stmt->bind_param('iis', $clan_id, $id_tip_email, $email_text);
        $stmt->execute();
        $email_fk = (int)$mysqli->insert_id;
        $stmt->close();
    }

    // ADRESA – samo ako je bilo koje od polja upisano.
    $ima_adresu = ($adresa_1 !== '' || $adresa_2 !== '' || $grad !== '' || $posta !== '' || $id_drzava_adrese !== null);
    $adresa_fk = null;
    if ($ima_adresu) {
        $res = $mysqli->query("SELECT id FROM adrese_tip WHERE `Tip` = 1 ORDER BY id ASC LIMIT 1");
        if (!$res || $res->num_rows === 0) {
            $mysqli->rollback();
            echo '113';
            exit;
        }
        $row = $res->fetch_assoc();
        $id_tip_adrese = (int)$row['id'];
        $res->free();

        $stmt = $mysqli->prepare("INSERT INTO adrese (id_clanovi, id_adrese_tip, id_drzave_adrese, adresa_1, adresa_2, grad, posta) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param('iiissss', $clan_id, $id_tip_adrese, $id_drzava_adrese, $adresa_1, $adresa_2, $grad, $posta);
        $stmt->execute();
        $adresa_fk = (int)$mysqli->insert_id;
        $stmt->close();
    }

    // Ažurirati FK u tablici clanovi (telefon, e_mail, adresa) – samo ako postoji novi zapis.
    if ($telefon_fk !== null || $email_fk !== null || $adresa_fk !== null) {
        $sql_set = [];
        $bind_types_u = '';
        $bind_values_u = [];
        if ($telefon_fk !== null) {
            $sql_set[] = 'telefon = ?';
            $bind_types_u .= 'i';
            $bind_values_u[] = &$telefon_fk;
        }
        if ($email_fk !== null) {
            $sql_set[] = 'e_mail = ?';
            $bind_types_u .= 'i';
            $bind_values_u[] = &$email_fk;
        }
        if ($adresa_fk !== null) {
            $sql_set[] = 'adresa = ?';
            $bind_types_u .= 'i';
            $bind_values_u[] = &$adresa_fk;
        }
        if (!empty($sql_set)) {
            $sql_u = "UPDATE clanovi SET " . implode(', ', $sql_set) . " WHERE id = ?";
            $bind_types_u .= 'i';
            $bind_values_u[] = &$clan_id;
            $stmt = $mysqli->prepare($sql_u);
            $bind_args_u = [$bind_types_u];
            foreach ($bind_values_u as $k => $_) {
                $bind_args_u[] = &$bind_values_u[$k];
            }
            call_user_func_array([$stmt, 'bind_param'], $bind_args_u);
            $stmt->execute();
            $stmt->close();
        }
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
