<?php
/**
 * PDF_Stilovi_Tablice_CRUD_polja.php — zajedničko čitanje/validacija polja stila tablice
 * (pdf_tablica_stil) + stupaca (pdf_tablica_stil_kolona) za _upis i _izmjena.
 * `pdf_tablica_stil_citaj_polja(&$code)` → lista [stupac, mysqli_tip, vrijednost] (BEZ id) ili null (uz $code='105').
 * Uvjetna logika: linija debljina<=0 → boja NULL; pozadina/zebra off → boja NULL;
 *   pozicioniranje u_tijeku → poravnanje, x/y NULL; apsolutno → x/y, poravnanje ostaje default.
 */

/** Decimal iz POST-a: prazno -> $def; zarez->točka; klamp [$min,$max]. */
function pdf_tbl_dec($key, $min, $max, $def)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    if ($v === '') return $def;
    $v = str_replace(',', '.', $v);
    if (!is_numeric($v)) return $def;
    $f = (float) $v;
    if ($f < $min) $f = $min;
    if ($f > $max) $f = $max;
    return $f;
}

/** Hex #RRGGBB ili NULL (uvijek nullable kod stila tablice). */
function pdf_tbl_hex($key)
{
    $v = isset($_POST[$key]) ? strtoupper(trim((string) $_POST[$key])) : '';
    return ($v !== '' && preg_match('/^#[0-9A-F]{6}$/', $v)) ? $v : null;
}

/** tinyint 0/1 ('1','on','true'). */
function pdf_tbl_bool($key)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    return ($v === '1' || $v === 'on' || $v === 'true') ? 1 : 0;
}

/** ENUM iz dopuštenih; nevaljano -> $def. */
function pdf_tbl_enum($key, array $allowed, $def)
{
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    return in_array($v, $allowed, true) ? $v : $def;
}

/** int FK iz POST-a: >0 -> int, inače NULL. */
function pdf_tbl_fk($key)
{
    $n = isset($_POST[$key]) ? (int) $_POST[$key] : 0;
    return $n > 0 ? $n : null;
}

/** Veličina pt iz POST-a: >0 -> decimal, inače NULL. */
function pdf_tbl_pt($key)
{
    $v = isset($_POST[$key]) ? str_replace(',', '.', trim((string) $_POST[$key])) : '';
    if ($v === '' || !is_numeric($v)) return null;
    $f = (float) $v;
    return ($f > 0 && $f <= 999.99) ? $f : null;
}

/** Linija: debljina (mm, 0..99.99) + boja (NULL kad debljina<=0). Vraća [debljina, boja]. */
function pdf_tbl_linija($keyDeb, $keyBoja)
{
    $deb = pdf_tbl_dec($keyDeb, 0, 99.99, 0);
    return [$deb, ($deb > 0 ? pdf_tbl_hex($keyBoja) : null)];
}

/**
 * Sva polja stila tablice → [stupac, tip, vrijednost] (redoslijed isti u upis/izmjena) ili null.
 * @param string $code OUT — '105' kad vrati null.
 */
function pdf_tablica_stil_citaj_polja(&$code)
{
    $naziv = isset($_POST['naziv']) ? trim($_POST['naziv']) : '';
    if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 50) { $code = '105'; return null; }

    $napomena = isset($_POST['napomena']) ? trim((string) $_POST['napomena']) : '';
    if ($napomena === '') $napomena = null;
    elseif (mb_strlen($napomena, 'UTF-8') > 1024) $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');

    // Linije (debljina + boja)
    list($okvirD, $okvirB)       = pdf_tbl_linija('okvir_debljina_mm', 'okvir_boja');
    list($zagLinD, $zagLinB)     = pdf_tbl_linija('zaglavlje_linija_debljina_mm', 'zaglavlje_linija_boja');
    list($vertD, $vertB)         = pdf_tbl_linija('linija_vert_debljina_mm', 'linija_vert_boja');
    list($redD, $redB)           = pdf_tbl_linija('linija_red_debljina_mm', 'linija_red_boja');

    // Ispune (boja NULL kad isključeno)
    $zagPoz = pdf_tbl_bool('zaglavlje_pozadina');
    $zagPozB = $zagPoz ? pdf_tbl_hex('zaglavlje_pozadina_boja') : null;
    $zebra = pdf_tbl_bool('zebra');
    $zebraB = $zebra ? pdf_tbl_hex('zebra_boja') : null;

    // Pozicioniranje
    $poz = pdf_tbl_enum('pozicioniranje', ['u_tijeku', 'apsolutno'], 'u_tijeku');
    $porav = pdf_tbl_enum('poravnanje', ['lijevo', 'centar', 'desno'], 'lijevo');
    $px = null; $py = null;
    if ($poz === 'apsolutno') {
        $px = pdf_tbl_dec('pozicija_x_mm', -9999.99, 9999.99, 0);
        $py = pdf_tbl_dec('pozicija_y_mm', -9999.99, 9999.99, 0);
    }

    return [
        ['naziv', 's', $naziv],
        ['napomena', 's', $napomena],
        // Osnovno — fontovi
        ['zaglavlje_font_id', 'i', pdf_tbl_fk('zaglavlje_font_id')],
        ['zaglavlje_velicina_pt', 'd', pdf_tbl_pt('zaglavlje_velicina_pt')],
        ['zaglavlje_bold', 'i', pdf_tbl_bool('zaglavlje_bold')],
        ['zaglavlje_italic', 'i', pdf_tbl_bool('zaglavlje_italic')],
        ['zaglavlje_podcrtano', 'i', pdf_tbl_bool('zaglavlje_podcrtano')],
        ['zaglavlje_boja', 's', pdf_tbl_hex('zaglavlje_boja')],
        ['podaci_font_id', 'i', pdf_tbl_fk('podaci_font_id')],
        ['podaci_velicina_pt', 'd', pdf_tbl_pt('podaci_velicina_pt')],
        ['podaci_bold', 'i', pdf_tbl_bool('podaci_bold')],
        ['podaci_italic', 'i', pdf_tbl_bool('podaci_italic')],
        ['podaci_podcrtano', 'i', pdf_tbl_bool('podaci_podcrtano')],
        ['podaci_boja', 's', pdf_tbl_hex('podaci_boja')],
        // Grafika — linije
        ['okvir_debljina_mm', 'd', $okvirD],
        ['okvir_boja', 's', $okvirB],
        ['zaglavlje_linija_debljina_mm', 'd', $zagLinD],
        ['zaglavlje_linija_boja', 's', $zagLinB],
        ['linija_vert_debljina_mm', 'd', $vertD],
        ['linija_vert_boja', 's', $vertB],
        ['linija_red_debljina_mm', 'd', $redD],
        ['linija_red_boja', 's', $redB],
        // Grafika — ispune
        ['zaglavlje_pozadina', 'i', $zagPoz],
        ['zaglavlje_pozadina_boja', 's', $zagPozB],
        ['zebra', 'i', $zebra],
        ['zebra_boja', 's', $zebraB],
        // Grafika — vertikalni padding
        ['zaglavlje_padding_gore_mm', 'd', pdf_tbl_dec('zaglavlje_padding_gore_mm', 0, 999.99, 0)],
        ['zaglavlje_padding_dolje_mm', 'd', pdf_tbl_dec('zaglavlje_padding_dolje_mm', 0, 999.99, 0)],
        ['podaci_padding_gore_mm', 'd', pdf_tbl_dec('podaci_padding_gore_mm', 0, 999.99, 0)],
        ['podaci_padding_dolje_mm', 'd', pdf_tbl_dec('podaci_padding_dolje_mm', 0, 999.99, 0)],
        // Ostalo
        ['razdvajac', 's', (function () { $v = isset($_POST['razdvajac']) ? (string) $_POST['razdvajac'] : '|'; $v = ($v === '') ? '|' : mb_substr($v, 0, 8, 'UTF-8'); return $v; })()],
        ['meki_prijelom', 's', (function () { $v = isset($_POST['meki_prijelom']) ? trim((string) $_POST['meki_prijelom']) : ''; return ($v === '') ? null : mb_substr($v, 0, 8, 'UTF-8'); })()],
        ['prikazi_zaglavlje', 'i', isset($_POST['prikazi_zaglavlje']) ? pdf_tbl_bool('prikazi_zaglavlje') : 1],
        ['zaglavlje_ponavljanje', 's', pdf_tbl_enum('zaglavlje_ponavljanje', ['prva', 'svaka'], 'prva')],
        ['ne_lomi_red', 'i', pdf_tbl_bool('ne_lomi_red')],
        ['razmak_prije_mm', 'd', pdf_tbl_dec('razmak_prije_mm', 0, 999.99, 0)],
        ['razmak_poslije_mm', 'd', pdf_tbl_dec('razmak_poslije_mm', 0, 999.99, 0)],
        ['pozicioniranje', 's', $poz],
        ['poravnanje', 's', $porav],
        ['pozicija_x_mm', 'd', $px],
        ['pozicija_y_mm', 'd', $py],
    ];
}

/** Iz liste polja sastavi referencirani niz za call_user_func_array(bind_param). */
function pdf_tablica_stil_bind_refs(&$types, array &$vals)
{
    $refs = [];
    $refs[] = &$types;
    foreach ($vals as $k => $v) $refs[] = &$vals[$k];
    return $refs;
}

/**
 * Pročita stupce iz POST['kolone'] (JSON) → redovi [id, red, naziv, zaglavlje, sirina_tip, sirina_mm,
 *  zag_orijentacija, zag_pad_l, zag_pad_d, zag_prefix, zag_sufiks, pod_orijentacija, pod_pad_l, pod_pad_d, pod_prefix, pod_sufiks].
 *  id>0 postojeći (UPDATE, čuva id), 0 novi (INSERT). Redoslijed renormaliziran 1..N.
 */
function pdf_tablica_stil_citaj_kolone()
{
    $raw = isset($_POST['kolone']) ? (string) $_POST['kolone'] : '';
    if (trim($raw) === '') return [];
    $arr = json_decode($raw, true);
    if (!is_array($arr)) return [];
    $out = [];
    $red = 0;
    foreach ($arr as $it) {
        if (!is_array($it)) continue;
        $dec = function ($key, $min, $max) use ($it) {
            if (!isset($it[$key])) return 0.0;
            $v = str_replace(',', '.', trim((string) $it[$key]));
            if (!is_numeric($v)) return 0.0;
            $f = (float) $v;
            if ($f < $min) $f = $min;
            if ($f > $max) $f = $max;
            return $f;
        };
        $str = function ($key, $max) use ($it) {
            $v = isset($it[$key]) ? trim((string) $it[$key]) : '';
            if ($v === '') return null;
            return mb_substr($v, 0, $max, 'UTF-8');
        };
        $enum = function ($key, $allowed, $def) use ($it) {
            $v = isset($it[$key]) ? trim((string) $it[$key]) : '';
            return in_array($v, $allowed, true) ? $v : $def;
        };
        $oid = (isset($it['id']) && (int) $it['id'] > 0) ? (int) $it['id'] : 0;
        $sirTip = $enum('sirina_tip', ['fiksna', 'popuni'], 'popuni');
        $sirMm = ($sirTip === 'fiksna') ? $dec('sirina_mm', 0, 9999.99) : null;
        $red++;
        $out[] = [
            $oid, $red, $str('naziv', 50), $str('zaglavlje', 100), $sirTip, $sirMm,
            $enum('zag_orijentacija', ['lijevo', 'centar', 'desno'], 'lijevo'),
            $dec('zag_padding_lijevo_mm', 0, 999.99), $dec('zag_padding_desno_mm', 0, 999.99),
            $str('zag_prefix', 50), $str('zag_sufiks', 50),
            $enum('pod_orijentacija', ['lijevo', 'centar', 'desno'], 'lijevo'),
            $dec('pod_padding_lijevo_mm', 0, 999.99), $dec('pod_padding_desno_mm', 0, 999.99),
            $str('pod_prefix', 50), $str('pod_sufiks', 50),
            $enum('zag_valign', ['gore', 'centar', 'dolje'], 'gore'),   // [16]
            $enum('pod_valign', ['gore', 'centar', 'dolje'], 'gore'),   // [17]
        ];
    }
    return $out;
}

/**
 * Spremi stupce ČUVAJUĆI id-eve (UPDATE postojećih / INSERT novih / DELETE uklonjenih).
 * Unutar tekuće transakcije; baca mysqli_sql_exception na grešku.
 */
function pdf_tablica_stil_spremi_kolone($mysqli, $stil_id, array $kolone)
{
    $zadrzi = [];
    foreach ($kolone as $k) if ((int) $k[0] > 0) $zadrzi[] = (int) $k[0];
    if (empty($zadrzi)) {
        $del = $mysqli->prepare('DELETE FROM pdf_tablica_stil_kolona WHERE tablica_stil_id = ?');
        $del->bind_param('i', $stil_id);
        $del->execute();
        $del->close();
    } else {
        $inList = implode(',', array_map('intval', $zadrzi));
        $mysqli->query('DELETE FROM pdf_tablica_stil_kolona WHERE tablica_stil_id = ' . (int) $stil_id . ' AND id NOT IN (' . $inList . ')');
    }
    if (empty($kolone)) return;
    $cols = 'redoslijed, naziv, zaglavlje, sirina_tip, sirina_mm, zag_orijentacija, zag_padding_lijevo_mm, zag_padding_desno_mm, zag_prefix, zag_sufiks, zag_valign, pod_orijentacija, pod_padding_lijevo_mm, pod_padding_desno_mm, pod_prefix, pod_sufiks, pod_valign';
    $upd = $mysqli->prepare('UPDATE pdf_tablica_stil_kolona SET redoslijed=?, naziv=?, zaglavlje=?, sirina_tip=?, sirina_mm=?, zag_orijentacija=?, zag_padding_lijevo_mm=?, zag_padding_desno_mm=?, zag_prefix=?, zag_sufiks=?, zag_valign=?, pod_orijentacija=?, pod_padding_lijevo_mm=?, pod_padding_desno_mm=?, pod_prefix=?, pod_sufiks=?, pod_valign=? WHERE id=? AND tablica_stil_id=?');
    $ins = $mysqli->prepare("INSERT INTO pdf_tablica_stil_kolona (tablica_stil_id, $cols) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    foreach ($kolone as $k) {
        $oid = (int) $k[0]; $red = (int) $k[1]; $naziv = $k[2]; $zag = $k[3]; $st = $k[4]; $sm = $k[5];
        $zo = $k[6]; $zpl = (float) $k[7]; $zpd = (float) $k[8]; $zpf = $k[9]; $zsf = $k[10];
        $po = $k[11]; $ppl = (float) $k[12]; $ppd = (float) $k[13]; $ppf = $k[14]; $psf = $k[15];
        $zv = $k[16]; $pv = $k[17];
        if ($oid > 0) {
            $upd->bind_param('isssdsddssssddsssii', $red, $naziv, $zag, $st, $sm, $zo, $zpl, $zpd, $zpf, $zsf, $zv, $po, $ppl, $ppd, $ppf, $psf, $pv, $oid, $stil_id);
            $upd->execute();
        } else {
            $ins->bind_param('iisssdsddssssddsss', $stil_id, $red, $naziv, $zag, $st, $sm, $zo, $zpl, $zpd, $zpf, $zsf, $zv, $po, $ppl, $ppd, $ppf, $psf, $pv);
            $ins->execute();
        }
    }
    $upd->close();
    $ins->close();
}
