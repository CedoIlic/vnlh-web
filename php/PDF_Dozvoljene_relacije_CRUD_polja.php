<?php
/**
 * PDF_Dozvoljene_relacije_CRUD_polja.php — čitanje + validacija polja relacije (pdf_dozvoljeni_relacije).
 * Vraća uređenu listu [stupac, mysqli_tip, vrijednost] (redoslijed kao u shemi) ili null (uz $code).
 * Defenzivno: tablice/kolone moraju biti valjani identifikatori I stvarno postojati u trenutnoj bazi;
 * izvor-id-evi postojati u pdf_dozvoljeni_izvori (ne vjeruje se klijentu iako bira iz padajućih popisa).
 */

function rel_ident_ok($s) { return is_string($s) && preg_match('/^[A-Za-z0-9_]{1,64}$/', $s) === 1; }

function rel_tablica_postoji($mysqli, $t)
{
    $stmt = $mysqli->prepare('SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND TABLE_TYPE = "BASE TABLE" LIMIT 1');
    if (!$stmt) return false;
    $stmt->bind_param('s', $t);
    $stmt->execute();
    $stmt->store_result();
    $ok = $stmt->num_rows > 0;
    $stmt->close();
    return $ok;
}

function rel_kolona_postoji($mysqli, $t, $k)
{
    $stmt = $mysqli->prepare('SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    if (!$stmt) return false;
    $stmt->bind_param('ss', $t, $k);
    $stmt->execute();
    $stmt->store_result();
    $ok = $stmt->num_rows > 0;
    $stmt->close();
    return $ok;
}

function rel_izvor_postoji($mysqli, $id)
{
    $id = (int) $id;
    if ($id <= 0) return false;
    $stmt = $mysqli->prepare('SELECT 1 FROM pdf_dozvoljeni_izvori WHERE id = ? LIMIT 1');
    if (!$stmt) return false;
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->store_result();
    $ok = $stmt->num_rows > 0;
    $stmt->close();
    return $ok;
}

/** Tablica ciljnog izvora (pdf_dozvoljeni_izvori.tablica) ili '' — za provjeru suffix_fk_kolona. */
function rel_izvor_tablica($mysqli, $id)
{
    $id = (int) $id;
    if ($id <= 0) return '';
    $stmt = $mysqli->prepare('SELECT tablica FROM pdf_dozvoljeni_izvori WHERE id = ? LIMIT 1');
    if (!$stmt) return '';
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ? (string) $row['tablica'] : '';
}

/**
 * @return array|null  Lista [stupac, tip, vrijednost] u redoslijedu sheme, ili null uz $code (najčešće '105').
 */
function pdf_relacije_citaj_polja($mysqli, &$code)
{
    $code = '105';
    $g = function ($k) { return isset($_POST[$k]) ? trim((string) $_POST[$k]) : ''; };

    // --- Obavezno ---
    $naziv = $g('naziv');
    if ($naziv === '' || mb_strlen($naziv, 'UTF-8') > 128) return null;

    $junction = $g('junction_tablica');
    if (!rel_ident_ok($junction) || !rel_tablica_postoji($mysqli, $junction)) return null;

    $fk = $g('fk_baza_kolona');
    if (!rel_ident_ok($fk) || !rel_kolona_postoji($mysqli, $junction, $fk)) return null;

    $link = $g('link_kolona');
    if (!rel_ident_ok($link) || !rel_kolona_postoji($mysqli, $junction, $link)) return null;

    $ciljni = (int) $g('ciljni_izvor_id');
    if ($ciljni <= 0 || !rel_izvor_postoji($mysqli, $ciljni)) return null;

    // Neobavezna junction kolona: '' -> null; inače mora postojati u junction tablici.
    $junKolOpc = function ($val) use ($mysqli, $junction) {
        if ($val === '') return [true, null];
        if (!rel_ident_ok($val) || !rel_kolona_postoji($mysqli, $junction, $val)) return [false, null];
        return [true, $val];
    };

    list($ok, $sort) = $junKolOpc($g('sort_kolona'));
    if (!$ok) return null;

    // --- Sufiks (lenient; svako zadano polje validirano) ---
    $suffixFk = $g('suffix_fk_kolona');
    if ($suffixFk !== '') {
        $ciljnaTbl = rel_izvor_tablica($mysqli, $ciljni);
        if ($ciljnaTbl === '' || !rel_ident_ok($suffixFk) || !rel_kolona_postoji($mysqli, $ciljnaTbl, $suffixFk)) return null;
    } else {
        $suffixFk = null;
    }
    $suffixIzvor = $g('suffix_izvor_id');
    if ($suffixIzvor !== '') {
        $suffixIzvor = (int) $suffixIzvor;
        if ($suffixIzvor <= 0 || !rel_izvor_postoji($mysqli, $suffixIzvor)) return null;
    } else {
        $suffixIzvor = null;
    }
    $suffixBazni = $g('suffix_bazni_izvor_id');
    if ($suffixBazni !== '') {
        $suffixBazni = (int) $suffixBazni;
        if ($suffixBazni <= 0 || !rel_izvor_postoji($mysqli, $suffixBazni)) return null;
    } else {
        $suffixBazni = null;
    }
    $suffixFormat = $g('suffix_format');
    if ($suffixFormat === '') $suffixFormat = null;
    elseif (mb_strlen($suffixFormat, 'UTF-8') > 64) $suffixFormat = mb_substr($suffixFormat, 0, 64, 'UTF-8');

    // --- Grupiranje ---
    $grupaTbl = $g('grupa_tablica');
    if ($grupaTbl !== '') {
        if (!rel_ident_ok($grupaTbl) || !rel_tablica_postoji($mysqli, $grupaTbl)) return null;
    } else {
        $grupaTbl = null;
    }
    // Grupa kolona pripada grupa_tablici: '' dopušteno (osim ako obavezno); inače mora postojati u grupa_tablici.
    $grupaKol = function ($val, $obavezno) use ($mysqli, $grupaTbl) {
        if ($val === '') return [!$obavezno, null];
        if ($grupaTbl === null) return [false, null];   // kolona bez tablice
        if (!rel_ident_ok($val) || !rel_kolona_postoji($mysqli, $grupaTbl, $val)) return [false, null];
        return [true, $val];
    };
    // Uz grupiranje su label grupe i diskriminator obavezni (resolver ih traži).
    list($ok2, $grupaLabel) = $grupaKol($g('grupa_label_kolona'), $grupaTbl !== null);
    if (!$ok2) return null;
    list($ok3, $grupaSort) = $grupaKol($g('grupa_sort_kolona'), false);
    if (!$ok3) return null;

    $diskVal = $g('diskriminator_kolona');
    if ($grupaTbl !== null) {
        if (!rel_ident_ok($diskVal) || !rel_kolona_postoji($mysqli, $junction, $diskVal)) return null;
    } else {
        list($okd, $diskVal) = $junKolOpc($diskVal);
        if (!$okd) return null;
    }

    list($okf, $fallbackKol) = $junKolOpc($g('fallback_kolona'));
    if (!$okf) return null;

    $fallbackPred = $g('fallback_predlozak');
    if ($fallbackPred === '') $fallbackPred = null;
    elseif (mb_strlen($fallbackPred, 'UTF-8') > 512) $fallbackPred = mb_substr($fallbackPred, 0, 512, 'UTF-8');

    $napomena = $g('napomena');
    if ($napomena === '') $napomena = null;
    elseif (mb_strlen($napomena, 'UTF-8') > 1024) $napomena = mb_substr($napomena, 0, 1024, 'UTF-8');

    $code = '';
    return [
        ['naziv', 's', $naziv],
        ['junction_tablica', 's', $junction],
        ['fk_baza_kolona', 's', $fk],
        ['link_kolona', 's', $link],
        ['ciljni_izvor_id', 'i', $ciljni],
        ['sort_kolona', 's', $sort],
        ['suffix_fk_kolona', 's', $suffixFk],
        ['suffix_izvor_id', 'i', $suffixIzvor],
        ['suffix_bazni_izvor_id', 'i', $suffixBazni],
        ['suffix_format', 's', $suffixFormat],
        ['grupa_tablica', 's', $grupaTbl],
        ['grupa_label_kolona', 's', $grupaLabel],
        ['grupa_sort_kolona', 's', $grupaSort],
        ['diskriminator_kolona', 's', $diskVal === '' ? null : $diskVal],
        ['fallback_kolona', 's', $fallbackKol],
        ['fallback_predlozak', 's', $fallbackPred],
        ['napomena', 's', $napomena],
    ];
}

/** Iz liste polja sastavi referencirani niz za call_user_func_array(bind_param). */
function pdf_relacije_bind_refs(&$types, array &$vals)
{
    $refs = [];
    $refs[] = &$types;
    foreach ($vals as $k => $v) {
        $refs[] = &$vals[$k];
    }
    return $refs;
}
