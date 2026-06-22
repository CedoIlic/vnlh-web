<?php
/**
 * vnlh_api_pravo_modula.php — provjera ima li prijavljena sesija pravo na modul (formu),
 * po istom izvoru istine kao require_login.php / html_router.php: $_SESSION['vnlh_meni_dopustene'].
 *
 * Za XHR/API endpointe koji logički pripadaju nekoj formi a nisu sami stranica (pa ih
 * require_login_api.php propušta svakom ulogiranom korisniku). Primjer: PDF_Dokument_razvoj.php
 * pripada formi PDF_Dokument_CRUD.html → smije ga zvati samo onaj tko smije i otvoriti formu.
 *
 * Pretpostavlja da je require_login_api.php (ili require_login.php) već uključen (sesija postoji).
 */

/** @return bool true ako sesija smije pristup formi $htmlFajl (npr. 'PDF_Dokument_CRUD.html'). */
function vnlh_api_ima_pravo_na_modul($htmlFajl)
{
    $allowed = isset($_SESSION['vnlh_meni_dopustene']) && is_array($_SESSION['vnlh_meni_dopustene'])
        ? $_SESSION['vnlh_meni_dopustene'] : [];
    $want = strtolower(trim((string) $htmlFajl));
    if ($want === '') return false;
    foreach ($allowed as $item) {
        if (!is_array($item)) continue;
        $hf = isset($item['html_fajl']) ? strtolower(trim((string) $item['html_fajl'])) : '';
        if ($hf !== '' && $hf === $want) return true;
    }
    return false;
}

/** Prekini API zahtjev s 403 ako sesija nema pravo na modul $htmlFajl. */
function vnlh_api_zahtijevaj_modul($htmlFajl)
{
    if (!vnlh_api_ima_pravo_na_modul($htmlFajl)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo '403';
        exit;
    }
}
