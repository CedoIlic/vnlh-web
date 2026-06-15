<?php
/**
 * PDF_Whitelist_CRUD_polja.php — čitanje + validacija polja dozvoljenog izvora (pdf_dozvoljeni_izvori).
 * Vraća uređenu listu [stupac, mysqli_tip, vrijednost] ili null (uz $code='105').
 * Defenzivno: tablica/kolona moraju biti valjani identifikatori I stvarno postojati u trenutnoj bazi
 * (ne vjeruje se klijentu iako se biraju iz padajućeg popisa).
 */

/** @return array|null */
function pdf_whitelist_citaj_polja($mysqli, &$code)
{
    $naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
    $tablica = isset($_POST['tablica']) ? trim($_POST['tablica']) : '';
    $kolona = isset($_POST['kolona']) ? trim($_POST['kolona']) : '';
    $tip = isset($_POST['tip_podatka']) ? trim($_POST['tip_podatka']) : '';

    if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 100) {
        $code = '105';
        return null;
    }
    if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $tablica) || !preg_match('/^[A-Za-z0-9_]{1,64}$/', $kolona)) {
        $code = '105';
        return null;
    }
    if (!in_array($tip, ['tekst', 'slika'], true)) {
        $code = '105';
        return null;
    }

    // Postojanje tablica.kolona u trenutnoj bazi
    $stmt = $mysqli->prepare('SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    if (!$stmt) {
        $code = '200,' . $mysqli->errno;
        return null;
    }
    $stmt->bind_param('ss', $tablica, $kolona);
    $stmt->execute();
    $stmt->store_result();
    $postoji = $stmt->num_rows > 0;
    $stmt->close();
    if (!$postoji) {
        $code = '105';
        return null;
    }

    $napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
    if ($napomena === '') {
        $napomena = null;
    } elseif (mb_strlen($napomena, 'UTF-8') > 1024) {
        $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');
    }

    return [
        ['naziv', 's', $naziv],
        ['tablica', 's', $tablica],
        ['kolona', 's', $kolona],
        ['tip_podatka', 's', $tip],
        ['napomena', 's', $napomena],
    ];
}

/** Iz liste polja sastavi referencirani niz za call_user_func_array(bind_param). */
function pdf_whitelist_bind_refs(&$types, array &$vals)
{
    $refs = [];
    $refs[] = &$types;
    foreach ($vals as $k => $v) {
        $refs[] = &$vals[$k];
    }
    return $refs;
}
