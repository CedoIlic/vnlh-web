<?php
/**
 * Esej_CRUD_lista.php — paginirana lista eseji za odabir/editiranje.
 * Vraća eseje iste lože + tuđe javno dostupne (javno_dostupan=1, loza != id_loza).
 * GET id_loza (obavezno), offset (default 0), limit (default 50), trazi (opcionalno).
 * Polje ista_loza: 1 = vlastiti esej, 0 = tuđi javni esej.
 */
require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

header('Content-Type: application/json; charset=utf-8');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$trazi   = isset($_GET['trazi'])   ? trim((string)$_GET['trazi']) : '';
$offset  = isset($_GET['offset'])  ? max(0, (int)$_GET['offset']) : 0;
$id_loza = isset($_GET['id_loza']) ? (int)$_GET['id_loza'] : 0;
$limit   = 50;

if ($id_loza <= 0) { echo '[]'; exit; }

$base_sql = "
    SELECT
        e.id,
        e.loza          AS id_loza,
        e.autor         AS id_autor,
        e.stupanj       AS id_stupanj,
        e.naslov_eseja,
        e.kljucne_rijeci,
        e.esej,
        e.javno_dostupan,
        IF(e.loza = ?, 1, 0) AS ista_loza,
        (SELECT zb.boja    FROM zapisnik_boje_u_listi zb WHERE zb.id = 10 LIMIT 1) AS boja_javno,
        (SELECT zb.boja_bg FROM zapisnik_boje_u_listi zb WHERE zb.id = 10 LIMIT 1) AS boja_javno_bg,
        (SELECT zb.boja    FROM zapisnik_boje_u_listi zb WHERE zb.id = 11 LIMIT 1) AS boja_javno_11,
        (SELECT zb.boja_bg FROM zapisnik_boje_u_listi zb WHERE zb.id = 11 LIMIT 1) AS boja_javno_11_bg,
        e.upisao,
        e.vrijeme_upisa,
        a.prezime       AS autor_prezime,
        a.ime           AS autor_ime,
        s.stupanj       AS stupanj_broj,
        s.naziv         AS stupanj_naziv,
        u.prezime       AS upisao_prezime,
        u.ime           AS upisao_ime,
        l.id_regija,
        l.id_drzava,
        l.naziv         AS loza_naziv,
        l.grad          AS loza_grad
    FROM eseji e
    LEFT JOIN clanovi  a  ON a.id  = e.autor
    LEFT JOIN stupnjevi s ON s.id  = e.stupanj
    LEFT JOIN clanovi  u  ON u.id  = e.upisao
    LEFT JOIN loze     l  ON l.id  = e.loza
    WHERE (e.loza = ? OR (e.javno_dostupan = 1 AND e.loza != ?))
";

try {
    if ($trazi !== '') {
        $q   = '%' . $trazi . '%';
        $sql = $base_sql
             . " AND (a.prezime LIKE ? OR a.ime LIKE ? OR e.naslov_eseja LIKE ?"
             . "   OR CAST(s.stupanj AS CHAR) LIKE ? OR e.kljucne_rijeci LIKE ?)"
             . " ORDER BY e.vrijeme_upisa DESC LIMIT ? OFFSET ?";
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param('iiisssssii',
            $id_loza, $id_loza, $id_loza,
            $q, $q, $q, $q, $q, $limit, $offset);
    } else {
        $sql  = $base_sql . " ORDER BY e.vrijeme_upisa DESC LIMIT ? OFFSET ?";
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param('iiiii', $id_loza, $id_loza, $id_loza, $limit, $offset);
    }

    $stmt->execute();
    $res  = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $row['ista_loza'] = (int) $row['ista_loza'];
        $rows[] = $row;
    }
    $stmt->close();
    $mysqli->close();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
} catch (mysqli_sql_exception $e) {
    $mysqli->close();
    echo '[]';
}
