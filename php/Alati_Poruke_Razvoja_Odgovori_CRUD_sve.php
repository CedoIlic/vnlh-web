<?php
/**
 * API: sve poruke tipa „Poruka razvoju“ (brisano = 0), s prezimenom i imenom pošiljatelja iz clanovi.
 * Izlaz: JSON niz objekata { id, vrijeme_slanja, id_posiljatelj, poruka, poruka_baza, kod_zadnji, s_fg_boja, s_bg_boja, clan_prezime, clan_ime }.
 * poruka_baza — tekst bez sufiksnih blokova #kod*tekst#; s_* — boje stupca S. prema zadnjem kodu (šifarnik).
 */
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/poruke_razvoj_odgovor_parse.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$sql = '
    SELECT
        p.id,
        p.vrijeme_slanja,
        p.id_posiljatelj,
        p.poruka,
        c.prezime AS clan_prezime,
        c.ime AS clan_ime
    FROM sustav_sesije_poruke p
    LEFT JOIN clanovi c ON c.id = p.id_posiljatelj
    WHERE p.brisano = 0
      AND p.tip = \'Poruka razvoju\'
    ORDER BY p.vrijeme_slanja DESC, p.id DESC
';

$result = $mysqli->query($sql);
if (!$result) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . (int) $mysqli->errno;
    $mysqli->close();
    exit;
}

$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$result->free();

/* Jedinstveni kodovi zadnjih blokova za batch dohvat boja (prvi red u šifranu po kodu). */
$kodSet = [];
foreach ($rows as $r) {
    $raz = razvoj_razlozi_bazu_i_blokove_s_kraja((string) ($r['poruka'] ?? ''));
    $bl = $raz['blokovi'];
    if ($bl !== []) {
        $kodSet[(int) $bl[count($bl) - 1]['kod']] = true;
    }
}
$kodToBoja = [];
if ($kodSet !== []) {
    $kodList = array_keys($kodSet);
    $placeholders = implode(',', array_fill(0, count($kodList), '?'));
    $types = str_repeat('i', count($kodList));
    $sqlB = 'SELECT p.kod, b.fg_boja AS s_fg_boja, b.bg_boja AS s_bg_boja
             FROM `Sustav_Odgovori_Razvoja_Poruke` p
             LEFT JOIN `Sustav_Odgovori_Razvoja_Boje` b ON p.boja = b.id
             WHERE p.kod IN (' . $placeholders . ')
             ORDER BY p.kod ASC, p.redosljed ASC, p.id ASC';
    $stmtB = $mysqli->prepare($sqlB);
    if ($stmtB) {
        $stmtB->bind_param($types, ...$kodList);
        if ($stmtB->execute()) {
            $resB = $stmtB->get_result();
            if ($resB) {
                while ($brow = $resB->fetch_assoc()) {
                    $kk = (int) $brow['kod'];
                    if (!isset($kodToBoja[$kk])) {
                        $kodToBoja[$kk] = [
                            's_fg_boja' => $brow['s_fg_boja'],
                            's_bg_boja' => $brow['s_bg_boja'],
                        ];
                    }
                }
            }
        }
        $stmtB->close();
    }
}

$out = [];
foreach ($rows as $r) {
    $raz = razvoj_razlozi_bazu_i_blokove_s_kraja((string) ($r['poruka'] ?? ''));
    $r['poruka_baza'] = $raz['baza'];
    $bl = $raz['blokovi'];
    if ($bl === []) {
        $r['kod_zadnji'] = null;
        $r['s_fg_boja'] = null;
        $r['s_bg_boja'] = null;
    } else {
        $zk = (int) $bl[count($bl) - 1]['kod'];
        $r['kod_zadnji'] = $zk;
        $r['s_fg_boja'] = isset($kodToBoja[$zk]) ? $kodToBoja[$zk]['s_fg_boja'] : null;
        $r['s_bg_boja'] = isset($kodToBoja[$zk]) ? $kodToBoja[$zk]['s_bg_boja'] : null;
    }
    $out[] = $r;
}

$mysqli->close();

echo json_encode($out, JSON_UNESCAPED_UNICODE);
