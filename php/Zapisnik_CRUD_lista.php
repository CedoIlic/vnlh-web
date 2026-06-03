<?php
/**
 * Zapisnik_CRUD_lista.php — paginirana lista zapisnika za odabir/editiranje.
 * Vraća zapise u kojima je odabrana loža bila domaćin ili učesnica.
 * GET: id_loza (obavezno), offset (zadano 0), limit (zadano 50), trazi (opcionalno).
 * Pretraga: unos "N°" → točno s.stupanj = N; ostalo → LIKE po datumu, stupnju, tipu, sažetku.
 */
require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

header('Content-Type: application/json; charset=utf-8');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$id_loza = isset($_GET['id_loza']) ? (int)$_GET['id_loza'] : 0;
$offset  = isset($_GET['offset'])  ? max(0, (int)$_GET['offset']) : 0;
$trazi   = isset($_GET['trazi'])   ? trim((string)$_GET['trazi']) : '';
$limit   = isset($_GET['limit'])   ? max(10, min(200, (int)$_GET['limit'])) : 50;

if ($id_loza <= 0) { echo '[]'; exit; }

/* Dohvat id_obred i id_tip_loze za filtriranje stupnjeva (isti obrazac kao Stupnjevi_CRUD_sve.php). */
$id_obred_loze   = 0;
$id_tip_loze_fil = 0;
$stL = $mysqli->prepare('SELECT id_obred, id_tip_loze FROM loze WHERE id = ? LIMIT 1');
if ($stL) {
    $stL->bind_param('i', $id_loza);
    $stL->execute();
    $rowL = $stL->get_result()->fetch_assoc();
    $stL->close();
    if (!$rowL) { echo '[]'; exit; }
    $id_obred_loze = (int)$rowL['id_obred'];
    if ($rowL['id_tip_loze'] !== null && $rowL['id_tip_loze'] !== '') {
        $id_tip_loze_fil = (int)$rowL['id_tip_loze'];
    }
}
/* Subquery za dozvoljene stupnjeve lože — ako tip nije definiran, svi stupnjevi obreda. */
$stupanj_filter = $id_tip_loze_fil > 0
    ? "AND zsr.id_stupanj IN (SELECT s.id FROM stupnjevi s
           INNER JOIN loze_tip_stupanj_enum e ON e.id_stupanj = s.id
             AND e.id_vlasnik = $id_tip_loze_fil AND e.id_pozicija = 1
           WHERE s.id_obred = $id_obred_loze)"
    : "AND 1=0";

/* Pretraga po stupnju: "N°" → točna vrijednost; inače LIKE po tekstu. */
$stupanjExact = null;
if ($trazi !== '' && preg_match('/^(\d+)\s*°\s*$/', $trazi, $m)) {
    $stupanjExact = (int)$m[1];
}

$base_sql = "
    SELECT DISTINCT
        zsr.id,
        zsr.datum_radova,
        zsr.sazetak,
        s.stupanj   AS stupanj_broj,
        s.naziv     AS stupanj_naziv,
        rt.naziv    AS tip_naziv,
        IF(zsr.id_domacin = ?, 1, 0)                            AS je_domacin,
        zsr.ovjera_prije_casni,
        zsr.ovjera_poslije_casni,
        zsr.ovjera_poslije_tajnik,
        zsr.ovjera_poslije_govornik,
        (SELECT zb.boja    FROM zapisnik_boje_u_listi zb WHERE zb.id = 1 LIMIT 1) AS boja_1,
        (SELECT zb.boja_bg FROM zapisnik_boje_u_listi zb WHERE zb.id = 1 LIMIT 1) AS boja_1_bg,
        (SELECT zb.boja    FROM zapisnik_boje_u_listi zb WHERE zb.id = 2 LIMIT 1) AS boja_2,
        (SELECT zb.boja_bg FROM zapisnik_boje_u_listi zb WHERE zb.id = 2 LIMIT 1) AS boja_2_bg,
        (SELECT zb.boja    FROM zapisnik_boje_u_listi zb WHERE zb.id = 3 LIMIT 1) AS boja_ucesnica,
        (SELECT zb.boja_bg FROM zapisnik_boje_u_listi zb WHERE zb.id = 3 LIMIT 1) AS boja_ucesnica_bg
    FROM zapisnik_sa_radova zsr
    LEFT JOIN stupnjevi  s  ON s.id  = zsr.id_stupanj
    LEFT JOIN radovi_tip rt ON rt.id = zsr.id_tip_radova
    WHERE (
        zsr.id_domacin = ?
        OR EXISTS (
            SELECT 1 FROM zapisnik_sa_radova_loze_ucesnice lu
            WHERE lu.id_zapisnika = zsr.id AND lu.id_loza = ?
        )
    )
";

try {
    if ($stupanjExact !== null) {
        $sql  = $base_sql . " $stupanj_filter AND s.stupanj = ? ORDER BY zsr.datum_radova DESC LIMIT ? OFFSET ?";
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param('iiiiii', $id_loza, $id_loza, $id_loza, $stupanjExact, $limit, $offset);
    } elseif ($trazi !== '') {
        $q   = '%' . $trazi . '%';
        $sql = $base_sql . " $stupanj_filter"
             . " AND (DATE_FORMAT(zsr.datum_radova, '%d.%m.%Y.') LIKE ?"
             . "   OR s.naziv LIKE ? OR rt.naziv LIKE ? OR zsr.sazetak LIKE ?)"
             . " ORDER BY zsr.datum_radova DESC LIMIT ? OFFSET ?";
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param('iiissssii', $id_loza, $id_loza, $id_loza, $q, $q, $q, $q, $limit, $offset);
    } else {
        $sql  = $base_sql . " $stupanj_filter ORDER BY zsr.datum_radova DESC LIMIT ? OFFSET ?";
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param('iiiii', $id_loza, $id_loza, $id_loza, $limit, $offset);
    }

    $stmt->execute();
    $res  = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();
    $mysqli->close();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
} catch (mysqli_sql_exception $e) {
    $mysqli->close();
    echo '[]';
}
