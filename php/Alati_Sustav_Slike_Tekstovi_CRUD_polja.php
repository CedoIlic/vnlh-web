<?php
/**
 * Alati_Sustav_Slike_Tekstovi_CRUD_polja.php — čitanje + validacija osnovnih polja
 * (naziv, tip_podatka, napomena) za _upis i _izmjena. Sadržaj (podatak/mime) obrađuju
 * upis/izmjena zasebno (slika preko $_FILES, tekst preko $_POST['podatak_tekst']).
 * Vraća ['naziv'=>, 'tip_podatka'=>, 'napomena'=>] ili null (uz $code='105').
 */

/** Je li tip slika (BLOB + mime) ili tekstualni (tekst / PDF blok). */
function sst_je_slika($tip)
{
    return in_array($tip, ['Slika JPG', 'Slika PNG', 'Slika WEBP'], true);
}

/** @return array|null */
function sst_citaj_polja(&$code)
{
    $naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
    $tip = isset($_POST['tip_podatka']) ? trim($_POST['tip_podatka']) : '';

    if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 150) {
        $code = '105';
        return null;
    }
    if (!in_array($tip, ['Slika JPG', 'Slika PNG', 'Slika WEBP', 'Tekst', 'PDF blok'], true)) {
        $code = '105';
        return null;
    }

    $napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
    if ($napomena === '') {
        $napomena = null;
    } elseif (mb_strlen($napomena, 'UTF-8') > 1024) {
        $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');
    }

    return ['naziv' => $naziv, 'tip_podatka' => $tip, 'napomena' => $napomena];
}
