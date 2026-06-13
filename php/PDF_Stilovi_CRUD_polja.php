<?php
/**
 * PDF_Stilovi_CRUD_polja.php — zajedničko čitanje + validacija polja stila paragrafa (pdf_paragraf)
 * za _upis i _izmjena. Vraća uređenu listu [stupac, mysqli_tip, vrijednost] (BEZ id).
 * Pri tvrdoj grešci (obavezna polja) postavi $code = '105' i vrati null.
 */

/** Decimal iz POST-a: prazno -> $def; zarez->točka; klamp na [$min,$max]. */
function pdf_stil_dec($key, $min, $max, $def)
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
function pdf_stil_hex($key, $allow_null)
{
    $v = isset($_POST[$key]) ? strtoupper(trim((string) $_POST[$key])) : '';
    if ($v !== '' && preg_match('/^#[0-9A-F]{6}$/', $v)) {
        return $v;
    }
    return $allow_null ? null : '#000000';
}

/** tinyint 0/1 iz POST-a (prihvaća '1','on','true'). */
function pdf_stil_bool($key)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    return ($v === '1' || $v === 'on' || $v === 'true') ? 1 : 0;
}

/**
 * Pročita i validira sva polja stila. Vraća listu [stupac, tip, vrijednost] ili null (uz $code).
 * @param string $code OUT — kod greške ('105') kad vrati null.
 * @return array|null
 */
function pdf_stilovi_citaj_polja(&$code)
{
    $naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
    $font_id = isset($_POST['font_id']) ? (int) $_POST['font_id'] : 0;
    $poravnanje = isset($_POST['poravnanje']) ? trim($_POST['poravnanje']) : '';

    // Obavezno
    if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 50
        || $font_id <= 0
        || !in_array($poravnanje, ['left', 'right', 'center', 'justify'], true)) {
        $code = '105';
        return null;
    }

    $napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
    if ($napomena === '') {
        $napomena = null;
    } elseif (mb_strlen($napomena, 'UTF-8') > 1024) {
        $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');
    }

    // Uređena lista: [stupac, mysqli_tip, vrijednost] — redoslijed mora biti isti u upis/izmjena.
    return [
        ['naziv', 's', $naziv],
        ['font_id', 'i', $font_id],
        ['velicina_pt', 'd', pdf_stil_dec('velicina_pt', 0.01, 999.99, 12.00)],
        ['bold', 'i', pdf_stil_bool('bold')],
        ['italic', 'i', pdf_stil_bool('italic')],
        ['podcrtano', 'i', pdf_stil_bool('podcrtano')],
        ['boja', 's', pdf_stil_hex('boja', false)],
        ['boja_pozadine', 's', pdf_stil_hex('boja_pozadine', true)],
        ['pozadina_cijeli_red', 'i', pdf_stil_bool('pozadina_cijeli_red')],
        ['traka_padding_lijevo_mm', 'd', pdf_stil_dec('traka_padding_lijevo_mm', 0, 999.99, 0)],
        ['traka_padding_desno_mm', 'd', pdf_stil_dec('traka_padding_desno_mm', 0, 999.99, 0)],
        ['traka_padding_gore_mm', 'd', pdf_stil_dec('traka_padding_gore_mm', 0, 999.99, 0)],
        ['traka_padding_dolje_mm', 'd', pdf_stil_dec('traka_padding_dolje_mm', 0, 999.99, 0)],
        ['poravnanje', 's', $poravnanje],
        ['prored', 'd', pdf_stil_dec('prored', 0.01, 99.99, 1.00)],
        ['razmak_prije_mm', 'd', pdf_stil_dec('razmak_prije_mm', 0, 999.99, 0)],
        ['razmak_poslije_mm', 'd', pdf_stil_dec('razmak_poslije_mm', 0, 999.99, 0)],
        ['uvlaka_lijevo_mm', 'd', pdf_stil_dec('uvlaka_lijevo_mm', 0, 999.99, 0)],
        ['uvlaka_desno_mm', 'd', pdf_stil_dec('uvlaka_desno_mm', 0, 999.99, 0)],
        ['uvlaka_prvi_red_mm', 'd', pdf_stil_dec('uvlaka_prvi_red_mm', 0, 999.99, 0)],
        ['okvir_debljina_gore_mm', 'd', pdf_stil_dec('okvir_debljina_gore_mm', 0, 999.99, 0)],
        ['okvir_debljina_dolje_mm', 'd', pdf_stil_dec('okvir_debljina_dolje_mm', 0, 999.99, 0)],
        ['okvir_debljina_lijevo_mm', 'd', pdf_stil_dec('okvir_debljina_lijevo_mm', 0, 999.99, 0)],
        ['okvir_debljina_desno_mm', 'd', pdf_stil_dec('okvir_debljina_desno_mm', 0, 999.99, 0)],
        ['okvir_padding_gore_mm', 'd', pdf_stil_dec('okvir_padding_gore_mm', 0, 999.99, 0)],
        ['okvir_padding_dolje_mm', 'd', pdf_stil_dec('okvir_padding_dolje_mm', 0, 999.99, 0)],
        ['okvir_padding_lijevo_mm', 'd', pdf_stil_dec('okvir_padding_lijevo_mm', 0, 999.99, 0)],
        ['okvir_padding_desno_mm', 'd', pdf_stil_dec('okvir_padding_desno_mm', 0, 999.99, 0)],
        ['okvir_boja', 's', pdf_stil_hex('okvir_boja', false)],
        ['okvir_boja_podloge', 's', pdf_stil_hex('okvir_boja_podloge', true)],
        ['okvir_do_lijeve_margine', 'i', pdf_stil_bool('okvir_do_lijeve_margine')],
        ['okvir_do_desne_margine', 'i', pdf_stil_bool('okvir_do_desne_margine')],
        ['okvir_postuj_uvlaku', 'i', pdf_stil_bool('okvir_postuj_uvlaku')],
        ['napomena', 's', $napomena],
    ];
}

/** Iz liste polja sastavi referencirani niz za call_user_func_array(bind_param). */
function pdf_stilovi_bind_refs(&$types, array &$vals)
{
    $refs = [];
    $refs[] = &$types;
    foreach ($vals as $k => $v) {
        $refs[] = &$vals[$k];
    }
    return $refs;
}
