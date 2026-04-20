<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_Loza_CRUD_upis.php – INSERT (forma Clanovi_Loza): samo polja s edit panela.
// Fiksno: aktivnost=0, kandidat=1, zastavice=0; šifra i stupanj = NULL (ne šalju se s forme).

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

    $prezime_raw = isset($_POST['prezime']) ? $_POST['prezime'] : '';
    $ime_raw = isset($_POST['ime']) ? $_POST['ime'] : '';
    /* Šifra i stupanj se na ovoj formi ne unose – uvijek NULL u bazi pri novom članu. */
    $sifra = '';
    $stupanj = null;

    $prezime = normalize_name($prezime_raw);
    $ime = normalize_name($ime_raw);

    $spol = isset($_POST['spol']) ? (int)$_POST['spol'] : 0;

    $datum_rodjenja = isset($_POST['datum_rodjenja']) && trim((string)$_POST['datum_rodjenja']) !== '' ? trim((string)$_POST['datum_rodjenja']) : null;
    $oib_raw = isset($_POST['oib']) ? preg_replace('/\D/', '', (string)$_POST['oib']) : '';
    $oib = ($oib_raw === '') ? null : substr($oib_raw, 0, 11);
    /* datum_inicijacije / datum_stupnja: forma Loza ne šalje – INSERT kao NULL. */

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

    if ($id_loza <= 0) {
        $mysqli->rollback();
        echo '105';
        exit;
    }
    if ($prezime === '') {
        $mysqli->rollback();
        echo '115';
        exit;
    }

    // Za potrebe upisa u bazu: prazna šifra (dozvoljeno samo za kandidata) ide kao NULL,
    // kako bi se u koloni sifra moglo imati više NULL vrijednosti.
    $sifra_db = ($sifra === '' ? null : $sifra);

    // Validacija na_prijedlog – ako ne postoji član, upisujemo NULL i informacija 110.
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

    // Jedinstvenost šifre iskaznice unutar države (UNIQUE drzava, sifra u bazi).
    if ($sifra !== '') {
        $stmt = $mysqli->prepare("SELECT id FROM clanovi WHERE drzava = ? AND sifra = ? LIMIT 1");
        $stmt->bind_param('is', $id_drzava, $sifra);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            $stmt->close();
            $mysqli->rollback();
            echo '114';
            exit;
        }
        $stmt->close();
    }

    // INSERT u clanovi (bez telefona/e_mail/adresa – oni idu naknadno).
    $cols = [
        'sifra', 'loza', 'drzava', 'prezime', 'ime', 'spol',
        'datum_rodjenja', 'oib', 'datum_inicijacije', 'porijeklo', 'stupanj', 'datum_stupnja',
        'telefon', 'e_mail', 'adresa', 'na_prijedlog',
        'slika', 'slika_mime', 'slika_thumbnail', 'slika_thumbnail_mime', 'slika_thumb_round', 'slika_thumb_round_mime', 'slika_thumb_round_position',
        'napomena', 'upisano', 'aktivnost', 'kandidat', 'zastavice'
    ];
    $vals = [];
    $bind_types = '';
    $bind_values = [];

    // sifra (može biti NULL ako nije upisana)
    $vals[] = ($sifra_db === null ? 'NULL' : '?');
    if ($sifra_db !== null) {
        $bind_types .= 's';
        $bind_values[] = &$sifra_db;
    }
    // loza
    $vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$id_loza;
    // drzava (dohvaćena iz loze)
    $vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$id_drzava;
    // prezime, ime, spol
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$prezime;
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$ime;
    $vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$spol;
    // datumi
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$datum_rodjenja;
    $vals[] = ($oib === null ? 'NULL' : '?'); if ($oib !== null) { $bind_types .= 's'; $bind_values[] = &$oib; }
    $vals[] = 'NULL'; /* datum_inicijacije */
    // porijeklo, stupanj (mogu NULL)
    $vals[] = ($porijeklo === null ? 'NULL' : '?'); if ($porijeklo !== null) { $bind_types .= 'i'; $bind_values[] = &$porijeklo; }
    $vals[] = ($stupanj === null ? 'NULL' : '?'); if ($stupanj !== null) { $bind_types .= 'i'; $bind_values[] = &$stupanj; }
    // datum_stupnja
    $vals[] = 'NULL';
    // telefon, e_mail, adresa – za sada NULL (popunit ćemo nakon insert-a u pomoćne tablice)
    $vals[] = 'NULL';
    $vals[] = 'NULL';
    $vals[] = 'NULL';
    // na_prijedlog
    $vals[] = ($na_prijedlog === null ? 'NULL' : '?'); if ($na_prijedlog !== null) { $bind_types .= 'i'; $bind_values[] = &$na_prijedlog; }
    // slika i thumbovi
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika;
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_mime;
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail;
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_thumbnail_mime;
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_thumb_round;
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$slika_thumb_round_mime;
    $vals[] = ($slika_thumb_round_position === null ? 'NULL' : '?');
    if ($slika_thumb_round_position !== null) {
        $bind_types .= 'i';
        $bind_values[] = &$slika_thumb_round_position;
    }
    // napomena
    $vals[] = '?'; $bind_types .= 's'; $bind_values[] = &$napomena;
    // upisano – vrijeme sa servera (NOW())
    $vals[] = 'NOW()';
    // aktivnost, kandidat, zastavice
    $vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$aktivnost;
    $vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$kandidat;
    $vals[] = '?'; $bind_types .= 'i'; $bind_values[] = &$zastavice;

    $sql = "INSERT INTO clanovi (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $vals) . ")";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    if ($bind_types !== '') {
        array_unshift($bind_values, $bind_types);
        $refs = [];
        foreach ($bind_values as $k => $v) {
            $refs[$k] = &$bind_values[$k];
        }
        call_user_func_array([$stmt, 'bind_param'], $refs);
    }
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
        // id_drzave_adrese može biti NULL → koristimo 'i' s nullom, mysqli će postaviti NULL.
        $stmt->bind_param('iiissss', $clan_id, $id_tip_adrese, $id_drzava_adrese, $adresa_1, $adresa_2, $grad, $posta);
        $stmt->execute();
        $adresa_fk = (int)$mysqli->insert_id;
        $stmt->close();
    }

    // Ažurirati FK u tablici clanovi (telefon, e_mail, adresa).
    if ($telefon_fk !== null || $email_fk !== null || $adresa_fk !== null) {
        $sql_set = [];
        $bind_types = '';
        $bind_values = [];
        if ($telefon_fk !== null) {
            $sql_set[] = 'telefon = ?';
            $bind_types .= 'i';
            $bind_values[] = &$telefon_fk;
        }
        if ($email_fk !== null) {
            $sql_set[] = 'e_mail = ?';
            $bind_types .= 'i';
            $bind_values[] = &$email_fk;
        }
        if ($adresa_fk !== null) {
            $sql_set[] = 'adresa = ?';
            $bind_types .= 'i';
            $bind_values[] = &$adresa_fk;
        }
        if (!empty($sql_set)) {
            $sql = "UPDATE clanovi SET " . implode(', ', $sql_set) . " WHERE id = ?";
            $bind_types .= 'i';
            $bind_values[] = &$clan_id;
            $stmt = $mysqli->prepare($sql);
            array_unshift($bind_values, $bind_types);
            $refs = [];
            foreach ($bind_values as $k => $v) {
                $refs[$k] = &$bind_values[$k];
            }
            call_user_func_array([$stmt, 'bind_param'], $refs);
            $stmt->execute();
            $stmt->close();
        }
    }

    // Napredovanja (Transfer Excel): jedan red po članu, u istoj transakciji.
    // POST: simuliraj (1 = nakon upisa rollback), id_stupanj, id_loza_napredovanja (0 = ne postoji, upisujemo NULL), loza_napredovanja, datum_napredovanja.
    $simuliraj = isset($_POST['simuliraj']) && trim((string)$_POST['simuliraj']) === '1';
    $napredovanja_id_stupanj = isset($_POST['napredovanja_id_stupanj']) ? (int)$_POST['napredovanja_id_stupanj'] : 0;
    $napredovanja_id_loza_raw = isset($_POST['napredovanja_id_loza']) ? (int)$_POST['napredovanja_id_loza'] : 0;
    $napredovanja_id_loza = ($napredovanja_id_loza_raw === 0) ? null : $napredovanja_id_loza_raw; // 0 = loža ne postoji u listi → NULL u bazi
    $napredovanja_loza_text = isset($_POST['napredovanja_loza_text']) ? trim((string)$_POST['napredovanja_loza_text']) : null;
    $napredovanja_datum = isset($_POST['napredovanja_datum']) && trim((string)$_POST['napredovanja_datum']) !== '' ? trim((string)$_POST['napredovanja_datum']) : null;
    $id_tip_napredovanja = 1;
    if ($napredovanja_id_stupanj > 0) {
        $d_nap = $napredovanja_datum;
        $l_nap = $napredovanja_loza_text === null || $napredovanja_loza_text === '' ? null : $napredovanja_loza_text;
        $col_loza = $napredovanja_id_loza === null ? 'NULL' : '?';
        $col_datum = $d_nap === null ? 'NULL' : '?';
        $col_loza_text = $l_nap === null ? 'NULL' : '?';
        $sql = "INSERT INTO napredovanja (id_clanovi, id_stupanj, id_tip_napredovanja, id_loza_napredovanja, datum_napredovanja, loza_napredovanja) VALUES (?, ?, ?, $col_loza, $col_datum, $col_loza_text)";
        $stmt = $mysqli->prepare($sql);
        if ($stmt) {
            $bind_types = 'iii';
            $bind_values = [&$clan_id, &$napredovanja_id_stupanj, &$id_tip_napredovanja];
            if ($napredovanja_id_loza !== null) {
                $bind_types .= 'i';
                $bind_values[] = &$napredovanja_id_loza;
            }
            if ($d_nap !== null) {
                $bind_types .= 's';
                $bind_values[] = &$d_nap;
            }
            if ($l_nap !== null) {
                $bind_types .= 's';
                $bind_values[] = &$l_nap;
            }
            array_unshift($bind_values, $bind_types);
            $refs = [];
            foreach ($bind_values as $k => $v) {
                $refs[$k] = &$bind_values[$k];
            }
            call_user_func_array([$stmt, 'bind_param'], $refs);
            $stmt->execute();
            $stmt->close();
        }
    }

    if ($simuliraj) {
        $mysqli->rollback();
    } else {
        $mysqli->commit();
    }

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
