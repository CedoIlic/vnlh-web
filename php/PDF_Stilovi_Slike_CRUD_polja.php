<?php
/**
 * PDF_Stilovi_Slike_CRUD_polja.php — zajedničko čitanje + validacija polja stila slike (pdf_slika_stil)
 * za _upis i _izmjena. Vraća uređenu listu [stupac, mysqli_tip, vrijednost] (BEZ id).
 * Pri tvrdoj grešci (obavezna polja) postavi $code = '105' i vrati null.
 *
 * Uvjetna logika (kao u formi):
 *  - okvir=0      -> okvir_boja = NULL, okvir_debljina_mm = NULL
 *  - u_tijeku     -> poravnanje_h; poravnanje_v / x / y = NULL; potiskuje = 1 (slika teče sa sadržajem)
 *  - usidreno     -> poravnanje_h + poravnanje_v; x / y = NULL
 *  - apsolutno    -> pozicija_x_mm + pozicija_y_mm; poravnanja = NULL
 */

/** Decimal iz POST-a: prazno -> $def; zarez->točka; klamp na [$min,$max]. */
function pdf_slika_dec($key, $min, $max, $def)
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

/** Hex boja #RRGGBB; nevaljano/prazno -> ($allow_null ? null : '#000000'). */
function pdf_slika_hex($key, $allow_null)
{
    $v = isset($_POST[$key]) ? strtoupper(trim((string) $_POST[$key])) : '';
    if ($v !== '' && preg_match('/^#[0-9A-F]{6}$/', $v)) {
        return $v;
    }
    return $allow_null ? null : '#000000';
}

/** tinyint 0/1 iz POST-a (prihvaća '1','on','true'). */
function pdf_slika_bool($key)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    return ($v === '1' || $v === 'on' || $v === 'true') ? 1 : 0;
}

/** ENUM iz dopuštenih vrijednosti; nevaljano/prazno -> $def. */
function pdf_slika_enum($key, array $allowed, $def)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    return in_array($v, $allowed, true) ? $v : $def;
}

/** int iz POST-a, klamp na [$min,$max]; prazno/nevaljano -> $def. */
function pdf_slika_int($key, $min, $max, $def)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    if ($v === '' || !is_numeric($v)) {
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

/**
 * Pročita i validira sva polja stila slike. Vraća listu [stupac, tip, vrijednost] ili null (uz $code).
 * @param string $code OUT — kod greške ('105') kad vrati null.
 * @return array|null
 */
function pdf_slika_stil_citaj_polja(&$code)
{
    $naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
    $sirina = pdf_slika_dec('sirina_mm', 0.01, 9999.99, 0);
    $visina = pdf_slika_dec('visina_mm', 0.01, 9999.99, 0);

    // Obavezno: naziv (<=50) + pozitivne dimenzije
    if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 50 || $sirina <= 0 || $visina <= 0) {
        $code = '105';
        return null;
    }

    $skaliranje = pdf_slika_enum('skaliranje', ['uklopi', 'razvuci'], 'uklopi');
    $prozirnost = pdf_slika_int('prozirnost', 0, 100, 100);

    // Okvir + ovisna polja
    $okvir = pdf_slika_bool('okvir');
    if ($okvir) {
        $okvir_boja = pdf_slika_hex('okvir_boja', false);
        $okvir_debljina = pdf_slika_dec('okvir_debljina_mm', 0.01, 99.99, 0.50);
    } else {
        $okvir_boja = null;
        $okvir_debljina = null;
    }

    // Pozicioniranje + ovisna polja
    $pozicioniranje = pdf_slika_enum('pozicioniranje', ['u_tijeku', 'usidreno', 'apsolutno'], 'u_tijeku');
    $poravnanje_h = null;
    $poravnanje_v = null;
    $x = null;
    $y = null;
    $potiskuje = 1;
    if ($pozicioniranje === 'u_tijeku') {
        $poravnanje_h = pdf_slika_enum('poravnanje_h', ['lijevo', 'centar', 'desno'], 'lijevo');
        $potiskuje = 1; // slika teče sa sadržajem -> uvijek gura
    } elseif ($pozicioniranje === 'usidreno') {
        $poravnanje_h = pdf_slika_enum('poravnanje_h', ['lijevo', 'centar', 'desno'], 'lijevo');
        $poravnanje_v = pdf_slika_enum('poravnanje_v', ['gore', 'centar', 'dolje'], 'gore');
        $potiskuje = pdf_slika_bool('potiskuje');
    } else { // apsolutno
        $x = pdf_slika_dec('pozicija_x_mm', -9999.99, 9999.99, 0);
        $y = pdf_slika_dec('pozicija_y_mm', -9999.99, 9999.99, 0);
        $potiskuje = pdf_slika_bool('potiskuje');
    }

    // Sloj (z-redoslijed): ispod = iza sadržaja, iznad = ispred
    $sloj = pdf_slika_enum('sloj', ['ispod', 'iznad'], 'iznad');

    $napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
    if ($napomena === '') {
        $napomena = null;
    } elseif (mb_strlen($napomena, 'UTF-8') > 1024) {
        $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');
    }

    // Uređena lista: [stupac, mysqli_tip, vrijednost] — redoslijed mora biti isti u upis/izmjena.
    return [
        ['naziv', 's', $naziv],
        ['sirina_mm', 'd', $sirina],
        ['visina_mm', 'd', $visina],
        ['skaliranje', 's', $skaliranje],
        ['okvir', 'i', $okvir],
        ['okvir_boja', 's', $okvir_boja],
        ['okvir_debljina_mm', 'd', $okvir_debljina],
        ['prozirnost', 'i', $prozirnost],
        ['pozicioniranje', 's', $pozicioniranje],
        ['poravnanje_h', 's', $poravnanje_h],
        ['poravnanje_v', 's', $poravnanje_v],
        ['pozicija_x_mm', 'd', $x],
        ['pozicija_y_mm', 'd', $y],
        ['potiskuje', 'i', $potiskuje],
        ['sloj', 's', $sloj],
        ['napomena', 's', $napomena],
    ];
}

/** Iz liste polja sastavi referencirani niz za call_user_func_array(bind_param). */
function pdf_slika_stil_bind_refs(&$types, array &$vals)
{
    $refs = [];
    $refs[] = &$types;
    foreach ($vals as $k => $v) {
        $refs[] = &$vals[$k];
    }
    return $refs;
}
