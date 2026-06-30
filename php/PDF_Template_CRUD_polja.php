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

/**
 * Pročita i validira okvire (pdf_template_okvir) iz POST['okviri'] (JSON niz).
 * Vraća listu redova [id, redoslijed, naziv|null, x_mm, y_mm, sirina_mm, visina_mm, y_meka].
 * id > 0 = postojeći okvir (UPDATE, čuva id koji referenciraju dokumenti); 0 = novi (INSERT).
 * Degenerirani okviri (sirina<=0 ili visina<=0) se preskaču. Nikad ne vraća null
 * (prazan/nevaljan payload = nema okvira). Redoslijed se renormalizira 1..N po dolasku.
 * @return array
 */
function pdf_template_citaj_okvire()
{
    $raw = isset($_POST['okviri']) ? (string) $_POST['okviri'] : '';
    if (trim($raw) === '') {
        return [];
    }
    $arr = json_decode($raw, true);
    if (!is_array($arr)) {
        return [];
    }
    $out = [];
    $red = 0;
    foreach ($arr as $it) {
        if (!is_array($it)) {
            continue;
        }
        $dec = function ($key, $min, $max, $def) use ($it) {
            if (!isset($it[$key])) {
                return $def;
            }
            $v = str_replace(',', '.', trim((string) $it[$key]));
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
        };
        $sirina = $dec('sirina_mm', 0, 9999.99, 0);
        $visina = $dec('visina_mm', 0, 9999.99, 0);
        if ($sirina <= 0 || $visina <= 0) {
            continue;   // degeneriran okvir — preskoči
        }
        $x = $dec('x_mm', 0, 9999.99, 0);
        $y = $dec('y_mm', 0, 9999.99, 0);
        $naziv = isset($it['naziv']) ? trim((string) $it['naziv']) : '';
        if ($naziv === '') {
            $naziv = null;
        } elseif (mb_strlen($naziv, 'UTF-8') > 50) {
            $naziv = mb_substr($naziv, 0, 50, 'UTF-8');
        }
        $ym = (isset($it['y_meka']) && in_array($it['y_meka'], [1, '1', true, 'true'], true)) ? 1 : 0;
        $oid = (isset($it['id']) && (int) $it['id'] > 0) ? (int) $it['id'] : 0;
        $red++;
        $out[] = [$oid, $red, $naziv, $x, $y, $sirina, $visina, $ym];
    }
    return $out;
}

/**
 * Ubaci okvire za dati template_id (NOVI template — svi okviri su novi; id iz payloada se ignorira).
 * Unutar tekuće transakcije; baca mysqli_sql_exception na grešku.
 * @param array $okviri  rezultat pdf_template_citaj_okvire() — redovi [id, red, naziv, x, y, sir, vis, ym]
 */
function pdf_template_upisi_okvire($mysqli, $template_id, array $okviri)
{
    if (empty($okviri)) {
        return;
    }
    $stmt = $mysqli->prepare(
        'INSERT INTO pdf_template_okvir (template_id, redoslijed, naziv, x_mm, y_mm, sirina_mm, visina_mm, y_meka)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($okviri as $o) {
        $red = (int) $o[1];
        $naziv = $o[2];
        $x = (float) $o[3];
        $y = (float) $o[4];
        $sir = (float) $o[5];
        $vis = (float) $o[6];
        $ym = (int) $o[7];
        $stmt->bind_param('iisddddi', $template_id, $red, $naziv, $x, $y, $sir, $vis, $ym);
        $stmt->execute();
    }
    $stmt->close();
}

/**
 * Spremi okvire postojećeg templatea ČUVAJUĆI id-eve (UPDATE postojećih, INSERT novih,
 * DELETE samo onih kojih više nema u payloadu). Time okvir_id u dokumentima ostaje valjan kad se
 * okvir samo uređuje; FK ON DELETE SET NULL okida se SAMO za stvarno uklonjene okvire (namjerno).
 * Unutar tekuće transakcije; baca mysqli_sql_exception na grešku.
 * @param array $okviri  redovi [id, red, naziv, x, y, sir, vis, ym] (id>0 postojeći, 0 novi)
 */
function pdf_template_spremi_okvire($mysqli, $template_id, array $okviri)
{
    // Obriši okvire kojih više nema (postojeći id-evi iz payloada se zadržavaju)
    $zadrzi = [];
    foreach ($okviri as $o) { if ((int) $o[0] > 0) $zadrzi[] = (int) $o[0]; }
    if (empty($zadrzi)) {
        $del = $mysqli->prepare('DELETE FROM pdf_template_okvir WHERE template_id = ?');
        $del->bind_param('i', $template_id);
        $del->execute();
        $del->close();
    } else {
        // $zadrzi su int-evi (cast iznad) → sigurno za interpolaciju
        $inList = implode(',', array_map('intval', $zadrzi));
        $mysqli->query('DELETE FROM pdf_template_okvir WHERE template_id = ' . (int) $template_id . ' AND id NOT IN (' . $inList . ')');
    }
    if (empty($okviri)) {
        return;
    }
    $upd = $mysqli->prepare('UPDATE pdf_template_okvir SET redoslijed = ?, naziv = ?, x_mm = ?, y_mm = ?, sirina_mm = ?, visina_mm = ?, y_meka = ? WHERE id = ? AND template_id = ?');
    $ins = $mysqli->prepare('INSERT INTO pdf_template_okvir (template_id, redoslijed, naziv, x_mm, y_mm, sirina_mm, visina_mm, y_meka) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($okviri as $o) {
        $oid = (int) $o[0]; $red = (int) $o[1]; $naziv = $o[2];
        $x = (float) $o[3]; $y = (float) $o[4]; $sir = (float) $o[5]; $vis = (float) $o[6]; $ym = (int) $o[7];
        if ($oid > 0) {
            $upd->bind_param('isddddiii', $red, $naziv, $x, $y, $sir, $vis, $ym, $oid, $template_id);
            $upd->execute();
        } else {
            $ins->bind_param('iisddddi', $template_id, $red, $naziv, $x, $y, $sir, $vis, $ym);
            $ins->execute();
        }
    }
    $upd->close();
    $ins->close();
}
