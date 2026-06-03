<?php
require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

header('Content-Type: application/json; charset=utf-8');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) { echo 'null'; exit; }

try {
    $stmt = $mysqli->prepare("
        SELECT zsr.*,
               l.id_regija   AS domacin_id_regija,
               l.id_drzava   AS domacin_id_drzava,
               l.naziv       AS domacin_naziv,
               l.grad        AS domacin_grad,
               COALESCE(d.naziv, '') AS domacin_drzava_naziv,
               s.stupanj     AS stupanj_broj,
               s.naziv       AS stupanj_naziv
        FROM zapisnik_sa_radova zsr
        LEFT JOIN loze    l ON l.id = zsr.id_domacin
        LEFT JOIN drzave  d ON d.id = l.id_drzava
        LEFT JOIN stupnjevi s ON s.id = zsr.id_stupanj
        WHERE zsr.id = ?
        LIMIT 1
    ");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) { echo 'null'; exit; }

    $id_domacin = (int)$row['id_domacin'];

    $stmt = $mysqli->prepare("
        SELECT lu.id_loza AS id, l.naziv, l.grad, COALESCE(d.naziv, '') AS drzava
        FROM zapisnik_sa_radova_loze_ucesnice lu
        LEFT JOIN loze  l ON l.id = lu.id_loza
        LEFT JOIN drzave d ON d.id = l.id_drzava
        WHERE lu.id_zapisnika = ?
        ORDER BY l.naziv
    ");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $loze = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $stmt = $mysqli->prepare("
        SELECT p.id_clana, p.id_prisustvo_tip, p.ime_i_prezime, p.loza, p.id_drzave,
               rpt.slobodan_unos, rpt.boja_prikaza, rpt.duznosnik_ok,
               c.prezime, c.ime,
               lc.naziv AS loza_naziv, lc.grad AS loza_grad,
               dc.naziv AS drzava_loze,
               rdg.naziv AS ime_drzave_gostiju
        FROM zapisnik_sa_radova_prisutni p
        LEFT JOIN radovi_prisustvo_tip  rpt ON rpt.id = p.id_prisustvo_tip
        LEFT JOIN clanovi               c   ON c.id   = p.id_clana
        LEFT JOIN loze                  lc  ON lc.id  = c.loza
        LEFT JOIN drzave                dc  ON dc.id  = lc.id_drzava
        LEFT JOIN radovi_drzave_gostiju rdg ON rdg.id = p.id_drzave
        WHERE p.id_zapisnika = ?
        ORDER BY p.id
    ");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $prisutni = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $stmt = $mysqli->prepare("
        SELECT duz.naziv_duznosti, duz.id_clana,
               c.prezime, c.ime,
               lc.naziv AS loza_naziv, lc.grad AS loza_grad,
               dc.naziv AS drzava_loze
        FROM zapisnik_sa_radova_duznosnici duz
        LEFT JOIN clanovi c  ON c.id  = duz.id_clana
        LEFT JOIN loze    lc ON lc.id = c.loza
        LEFT JOIN drzave  dc ON dc.id = lc.id_drzava
        WHERE duz.id_zapisnika = ?
        ORDER BY FIELD(duz.naziv_duznosti,
            'Časni majstor','Prvi nadzornik','Drugi nadzornik',
            'Tajnik lože','Govornik','Majstor ceremonije',
            'Prvi đakon','Drugi đakon','Unutarnji čuvar hrama')
    ");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $duznosnici = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $stmt = $mysqli->prepare("
        SELECT e.id AS id_eseja, e.naslov_eseja, e.kljucne_rijeci,
               IF(e.loza = ?, 1, 0) AS ista_loza,
               c.prezime AS autor_prezime, c.ime AS autor_ime,
               e.vrijeme_upisa,
               l.naziv AS loza_naziv, l.grad AS loza_grad
        FROM zapisnik_sa_radova_eseji zsre
        LEFT JOIN eseji   e ON e.id  = zsre.id_eseja
        LEFT JOIN clanovi c ON c.id  = e.autor
        LEFT JOIN loze    l ON l.id  = e.loza
        WHERE zsre.id_radova = ?
        ORDER BY zsre.id_eseja
    ");
    $stmt->bind_param('ii', $id_domacin, $id);
    $stmt->execute();
    $eseji = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $row['loze_ucesnice'] = $loze;
    $row['prisutni']      = $prisutni;
    $row['duznosnici']    = $duznosnici;
    $row['eseji']         = $eseji;

    $mysqli->close();
    echo json_encode($row, JSON_UNESCAPED_UNICODE);
} catch (mysqli_sql_exception $e) {
    if (isset($mysqli)) $mysqli->close();
    echo '200,' . $e->getCode();
}
