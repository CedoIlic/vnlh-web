<?php
/**
 * PDF_Template_CRUD_polja.php — zajedničko čitanje + validacija polja predloška stranice (pdf_template)
 * za _upis i _izmjena. Vraća uređenu listu [stupac, mysqli_tip, vrijednost] (BEZ id).
 * Pri tvrdoj grešci (obavezna polja) postavi $code = '105' i vrati null.
 *
 * Uvjetna logika (kao u formi):
 *  - format != custom  -> sirina_mm/visina_mm = NULL; custom -> obavezne (>0)
 *  - zaglavlje=0        -> zaglavlje_visina/padding = 0, primjena = 'svaka'
 *  - podnozje=0         -> podnozje_visina/padding = 0, od_stranice = 1
 *  - broj_stranice=0    -> format/zona/poravnanje = default
 */

/** Decimal iz POST-a: prazno -> $def; zarez->točka; klamp na [$min,$max]. */
function pdf_tmpl_dec($key, $min, $max, $def)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    if ($v === '') {
        return $def;
    }
    $v = str_replace(',', '.', $v);
    if (!is_numeric($v)) {
        return $def;
    }
    $f = (float) $v;
    if ($f < $min) {
        $f = $min;
    }
    if ($f > $max) {
        $f = $max;
    }
    return $f;
}

/** int iz POST-a, klamp na [$min,$max]; prazno/nevaljano -> $def. */
function pdf_tmpl_int($key, $min, $max, $def)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    if ($v === '' || !is_numeric(str_replace(',', '.', $v))) {
        return $def;
    }
    $n = (int) round((float) str_replace(',', '.', $v));
    if ($n < $min) {
        $n = $min;
    }
    if ($n > $max) {
        $n = $max;
    }
    return $n;
}

/** tinyint 0/1 iz POST-a (prihvaća '1','on','true'). */
function pdf_tmpl_bool($key)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    return ($v === '1' || $v === 'on' || $v === 'true') ? 1 : 0;
}

/** ENUM iz dopuštenih vrijednosti; nevaljano/prazno -> $def. */
function pdf_tmpl_enum($key, array $allowed, $def)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    return in_array($v, $allowed, true) ? $v : $def;
}

/**
 * Pročita i validira sva polja predloška. Vraća listu [stupac, tip, vrijednost] ili null (uz $code).
 * @param string $code OUT — kod greške ('105') kad vrati null.
 * @return array|null
 */
function pdf_template_citaj_polja(&$code)
{
    $naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
    if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 50) {
        $code = '105';
        return null;
    }

    $format = pdf_tmpl_enum('format_papira', ['A4', 'A5', 'A3', 'Letter', 'Legal', 'custom'], 'A4');
    if ($format === 'custom') {
        $sirina = pdf_tmpl_dec('sirina_mm', 0.01, 9999.99, 0);
        $visina = pdf_tmpl_dec('visina_mm', 0.01, 9999.99, 0);
        if ($sirina <= 0 || $visina <= 0) {
            $code = '105';
            return null;
        }
    } else {
        $sirina = null;
        $visina = null;
    }
    $orijentacija = pdf_tmpl_enum('orijentacija', ['portrait', 'landscape'], 'portrait');

    $mg = pdf_tmpl_dec('margina_gore_mm', 0, 999.99, 20);
    $md = pdf_tmpl_dec('margina_dolje_mm', 0, 999.99, 20);
    $ml = pdf_tmpl_dec('margina_lijevo_mm', 0, 999.99, 20);
    $mr = pdf_tmpl_dec('margina_desno_mm', 0, 999.99, 20);

    // Zaglavlje + ovisna polja (padding može biti negativan)
    $zaglavlje = pdf_tmpl_bool('zaglavlje');
    if ($zaglavlje) {
        $zv = pdf_tmpl_dec('zaglavlje_visina_mm', 0, 999.99, 0);
        $zp = pdf_tmpl_dec('zaglavlje_padding_mm', -999.99, 999.99, 0);
        $zpr = pdf_tmpl_enum('zaglavlje_primjena', ['prva', 'svaka'], 'svaka');
    } else {
        $zv = 0;
        $zp = 0;
        $zpr = 'svaka';
    }

    // Podnožje + ovisna polja
    $podnozje = pdf_tmpl_bool('podnozje');
    if ($podnozje) {
        $pv = pdf_tmpl_dec('podnozje_visina_mm', 0, 999.99, 0);
        $pp = pdf_tmpl_dec('podnozje_padding_mm', -999.99, 999.99, 0);
        $pod = pdf_tmpl_int('podnozje_od_stranice', 1, 9999, 1);
    } else {
        $pv = 0;
        $pp = 0;
        $pod = 1;
    }

    // Brojač stranica + ovisna polja
    $broj = pdf_tmpl_bool('broj_stranice');
    if ($broj) {
        $bf = isset($_POST['broj_stranice_format']) ? trim((string) $_POST['broj_stranice_format']) : '';
        if ($bf === '') {
            $bf = 'Stranica #S od #U';
        } elseif (mb_strlen($bf, 'UTF-8') > 100) {
            $bf = mb_substr($bf, 0, 100, 'UTF-8');
        }
        $bz = pdf_tmpl_enum('broj_stranice_zona', ['podnozje', 'zaglavlje'], 'podnozje');
        $bp = pdf_tmpl_enum('broj_stranice_poravnanje', ['lijevo', 'centar', 'desno'], 'centar');
    } else {
        $bf = 'Stranica #S od #U';
        $bz = 'podnozje';
        $bp = 'centar';
    }

    $naslovna = pdf_tmpl_bool('naslovna_stranica');

    // Buduće (u UI disabled) — spremi default vrijednosti
    $dvostran = pdf_tmpl_bool('dvostran');
    $vezna = pdf_tmpl_dec('vezna_margina_mm', 0, 999.99, 0);

    $napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
    if ($napomena === '') {
        $napomena = null;
    } elseif (mb_strlen($napomena, 'UTF-8') > 1024) {
        $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');
    }

    // Uređena lista: [stupac, mysqli_tip, vrijednost] — redoslijed isti u upis/izmjena.
    return [
        ['naziv', 's', $naziv],
        ['format_papira', 's', $format],
        ['sirina_mm', 'd', $sirina],
        ['visina_mm', 'd', $visina],
        ['orijentacija', 's', $orijentacija],
        ['margina_gore_mm', 'd', $mg],
        ['margina_dolje_mm', 'd', $md],
        ['margina_lijevo_mm', 'd', $ml],
        ['margina_desno_mm', 'd', $mr],
        ['zaglavlje', 'i', $zaglavlje],
        ['zaglavlje_visina_mm', 'd', $zv],
        ['zaglavlje_padding_mm', 'd', $zp],
        ['zaglavlje_primjena', 's', $zpr],
        ['podnozje', 'i', $podnozje],
        ['podnozje_visina_mm', 'd', $pv],
        ['podnozje_padding_mm', 'd', $pp],
        ['podnozje_od_stranice', 'i', $pod],
        ['broj_stranice', 'i', $broj],
        ['broj_stranice_format', 's', $bf],
        ['broj_stranice_zona', 's', $bz],
        ['broj_stranice_poravnanje', 's', $bp],
        ['naslovna_stranica', 'i', $naslovna],
        ['dvostran', 'i', $dvostran],
        ['vezna_margina_mm', 'd', $vezna],
        ['napomena', 's', $napomena],
    ];
}

/** Iz liste polja sastavi referencirani niz za call_user_func_array(bind_param). */
function pdf_template_bind_refs(&$types, array &$vals)
{
    $refs = [];
    $refs[] = &$types;
    foreach ($vals as $k => $v) {
        $refs[] = &$vals[$k];
    }
    return $refs;
}
