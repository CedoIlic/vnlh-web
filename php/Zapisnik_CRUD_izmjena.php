<?php
require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
header('Content-Type: text/plain; charset=utf-8');

$raw = file_get_contents('php://input');
$d   = $raw ? json_decode($raw, true) : null;
if (!is_array($d)) { echo '105'; exit; }

function zsr_int($v)  { return ($v !== null && $v !== '') ? (int)$v : null; }
function zsr_str($v)  { return ($v !== null) ? trim((string)$v) : null; }
function zsr_date($v) { $s = zsr_str($v); return ($s !== '' && $s !== null) ? $s : null; }
function zsr_bit($v)  { return ($v ? 1 : 0); }

try {
    $mysqli->begin_transaction();

    $id            = zsr_int($d['id']            ?? null);
    $id_domacin    = zsr_int($d['id_domacin']    ?? null);
    $id_stupanj    = zsr_int($d['id_stupanj']    ?? null);
    $id_tip_radova = zsr_int($d['id_tip_radova'] ?? null);
    $datum_radova  = zsr_date($d['datum_radova'] ?? null);

    if (!$id || !$id_domacin || !$id_stupanj || !$id_tip_radova) {
        $mysqli->rollback(); echo '105'; exit;
    }

    // Provjera postoji li zapis
    $stmt = $mysqli->prepare("SELECT id FROM zapisnik_sa_radova WHERE id = ? LIMIT 1 FOR UPDATE");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows === 0) { $stmt->close(); $mysqli->rollback(); echo '108'; exit; }
    $stmt->close();

    // Dohvat id_obred iz loze
    $stmt = $mysqli->prepare("SELECT id_obred FROM loze WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $id_domacin);
    $stmt->execute();
    $rowL = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$rowL || !$rowL['id_obred']) { $mysqli->rollback(); echo '117'; exit; }
    $id_obred = (int)$rowL['id_obred'];

    $ovjera_prije_casni      = zsr_bit($d['ovjera_prije_casni']      ?? 0);
    $ovjera_prije_casni_id   = zsr_int($d['ovjera_prije_casni_id']   ?? null);
    $ovjera_poslije_casni    = zsr_bit($d['ovjera_poslije_casni']    ?? 0);
    $ovjera_poslije_casni_id = zsr_int($d['ovjera_poslije_casni_id'] ?? null);
    $ovjera_poslije_tajnik   = zsr_bit($d['ovjera_poslije_tajnik']   ?? 0);
    $ovjera_poslije_tajnik_id= zsr_int($d['ovjera_poslije_tajnik_id']?? null);
    $ovjera_poslije_govornik = zsr_bit($d['ovjera_poslije_govornik'] ?? 0);
    $ovjera_poslije_govornik_id = zsr_int($d['ovjera_poslije_govornik_id'] ?? null);
    $sazetak  = zsr_str($d['sazetak']  ?? null);
    $zapisnik = zsr_str($d['zapisnik'] ?? null);

    // UPDATE zapisnik_sa_radova (bez upisao i vrijeme_upisa)
    $stmt = $mysqli->prepare("
        UPDATE zapisnik_sa_radova SET
            id_domacin = ?, id_obred = ?, id_stupanj = ?, id_tip_radova = ?, datum_radova = ?,
            ovjera_prije_casni = ?, ovjera_prije_casni_id = ?,
            ovjera_poslije_casni = ?, ovjera_poslije_casni_id = ?,
            ovjera_poslije_tajnik = ?, ovjera_poslije_tajnik_id = ?,
            ovjera_poslije_govornik = ?, ovjera_poslije_govornik_id = ?,
            sazetak = ?, zapisnik = ?
        WHERE id = ?
    ");
    $stmt->bind_param(
        'iiiisiiiiiiiissi',
        $id_domacin, $id_obred, $id_stupanj, $id_tip_radova, $datum_radova,
        $ovjera_prije_casni, $ovjera_prije_casni_id,
        $ovjera_poslije_casni, $ovjera_poslije_casni_id,
        $ovjera_poslije_tajnik, $ovjera_poslije_tajnik_id,
        $ovjera_poslije_govornik, $ovjera_poslije_govornik_id,
        $sazetak, $zapisnik, $id
    );
    $stmt->execute();
    $stmt->close();

    // Obnovi child tablice: DELETE + INSERT

    $stmt = $mysqli->prepare("DELETE FROM zapisnik_sa_radova_loze_ucesnice WHERE id_zapisnika = ?");
    $stmt->bind_param('i', $id); $stmt->execute(); $stmt->close();

    $stmt = $mysqli->prepare("DELETE FROM zapisnik_sa_radova_prisutni WHERE id_zapisnika = ?");
    $stmt->bind_param('i', $id); $stmt->execute(); $stmt->close();

    $stmt = $mysqli->prepare("DELETE FROM zapisnik_sa_radova_duznosnici WHERE id_zapisnika = ?");
    $stmt->bind_param('i', $id); $stmt->execute(); $stmt->close();

    // INSERT loze_ucesnice
    $loze = isset($d['loze_ucesnice']) && is_array($d['loze_ucesnice']) ? $d['loze_ucesnice'] : [];
    if ($loze) {
        $stmt = $mysqli->prepare("INSERT INTO zapisnik_sa_radova_loze_ucesnice (id_zapisnika, id_loza) VALUES (?, ?)");
        foreach ($loze as $idL) {
            $idL = (int)$idL; if (!$idL) continue;
            $stmt->bind_param('ii', $id, $idL); $stmt->execute();
        }
        $stmt->close();
    }

    // INSERT prisutni
    $prisutni = isset($d['prisutni']) && is_array($d['prisutni']) ? $d['prisutni'] : [];
    if ($prisutni) {
        $stmt = $mysqli->prepare("
            INSERT INTO zapisnik_sa_radova_prisutni
                (id_zapisnika, id_clana, id_prisustvo_tip, ime_i_prezime, loza, id_drzave)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        foreach ($prisutni as $p) {
            $idCl = zsr_int($p['id_clana']       ?? null);
            $idTip= (int)($p['id_prisustvo_tip'] ?? 0);
            $ime  = zsr_str($p['ime_i_prezime']  ?? null);
            $loza = zsr_str($p['loza']           ?? null);
            $idDr = zsr_int($p['id_drzave']      ?? null);
            if (!$idTip) continue;
            $stmt->bind_param('iiissi', $id, $idCl, $idTip, $ime, $loza, $idDr);
            $stmt->execute();
        }
        $stmt->close();
    }

    // INSERT duznosnici
    $duznosnici = isset($d['duznosnici']) && is_array($d['duznosnici']) ? $d['duznosnici'] : [];
    if ($duznosnici) {
        $stmt = $mysqli->prepare("
            INSERT INTO zapisnik_sa_radova_duznosnici (id_zapisnika, naziv_duznosti, id_clana)
            VALUES (?, ?, ?)
        ");
        foreach ($duznosnici as $dz) {
            $naziv = isset($dz['naziv_duznosti']) ? trim((string)$dz['naziv_duznosti']) : '';
            $idCl  = (int)($dz['id_clana'] ?? 0);
            if (!$naziv || !$idCl) continue;
            $stmt->bind_param('isi', $id, $naziv, $idCl); $stmt->execute();
        }
        $stmt->close();
    }

    $mysqli->commit();
    echo 'OK';

} catch (mysqli_sql_exception $e) {
    if (isset($mysqli)) $mysqli->rollback();
    echo $e->getCode() == 1062 ? '114' : '200,' . $e->getCode();
} catch (Throwable $e) {
    if (isset($mysqli)) $mysqli->rollback();
    echo '200,0';
}
$mysqli->close();
