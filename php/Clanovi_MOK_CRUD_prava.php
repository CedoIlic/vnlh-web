<?php
// Clanovi_MOK_CRUD_prava.php — zajednička pravila diskrecije za MOK (uključuje se u sve MOK endpointe).
// NIJE endpoint (nema izlaza); samo funkcije. Sesija i baza dolaze iz pozivatelja.
//
// Pravila (dogovor 2026-07-27):
//  • RADNA razina  — bilješku čita SAMO njezin autor, i to dok je još član iste lože u kojoj ju je zapisao
//    (clanovi_mok.id_loza_upisao = trenutna loža ulogiranog). Prelazak u drugu ložu odsijeca stare bilješke.
//  • KONTROLNA razina — dužnost ulogiranog je u sustav_varijable 127 → čita SVE bilješke,
//    ali NE smije mijenjati ni brisati (to ostaje isključivo autoru).
//  • Izmjena/brisanje — samo autor i samo unutar roka: datum_upisa + (sustav_varijable 128) mjeseci.
//  • Razina 4 (Časni majstori) se NE provjerava ovdje — pravo na formu se dodjeljuje kroz meni/prava.

/** Trenutna loža ulogiranog člana (clanovi.loza) ili 0. */
function mok_moja_loza($mysqli)
{
    $idClan = (int) ($_SESSION['id_korisnik'] ?? 0);
    if ($idClan <= 0) return 0;
    $stmt = $mysqli->prepare('SELECT loza FROM clanovi WHERE id = ? LIMIT 1');
    if (!$stmt) return 0;
    $stmt->bind_param('i', $idClan);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ? (int) $row['loza'] : 0;
}

/** Vrijednost sistemske varijable kao string ('' ako je nema). */
function mok_varijabla($mysqli, $id)
{
    $id = (int) $id;
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
    if (!$stmt) return '';
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ? trim((string) $row['varijabla']) : '';
}

/** Ima li ulogirani KONTROLNI uvid (dužnost mu je u varijabli 127)? Samo čitanje. */
function mok_kontrolna_razina($mysqli)
{
    $idDuz = (int) ($_SESSION['id_duznosnik'] ?? 0);
    if ($idDuz <= 0) return false;
    $lista = mok_varijabla($mysqli, 127);
    if ($lista === '') return false;
    foreach (explode(',', $lista) as $dio) {
        if ((int) trim($dio) === $idDuz) return true;
    }
    return false;
}

/** Rok izmjene/brisanja u mjesecima (sustav_varijable 128); default 1 kad varijabla nije postavljena. */
function mok_rok_mjeseci($mysqli)
{
    $v = mok_varijabla($mysqli, 128);
    if ($v === '' || !is_numeric($v)) return 1;
    $n = (int) $v;
    return $n < 0 ? 0 : $n;
}

/** Je li bilješka JOŠ u roku za izmjenu/brisanje? $datumUpisa = 'Y-m-d H:i:s' ili null. */
function mok_u_roku($datumUpisa, $mjeseci)
{
    if ($datumUpisa === null || trim((string) $datumUpisa) === '') return false;   // bez datuma ne riskiramo
    $t = strtotime((string) $datumUpisa);
    if ($t === false) return false;
    $granica = strtotime('+' . (int) $mjeseci . ' months', $t);
    if ($granica === false) return false;
    return time() <= $granica;
}

/** Smije li ulogirani mijenjati/brisati bilješku (redak iz clanovi_mok)? Autor + unutar roka.
 *  Kontrolna razina NEMA ovo pravo — ona samo čita. */
function mok_smije_mijenjati($mysqli, $red)
{
    $ja = (int) ($_SESSION['id_korisnik'] ?? 0);
    if ($ja <= 0 || !$red) return false;
    if ((int) ($red['upisao'] ?? 0) !== $ja) return false;
    return mok_u_roku($red['datum_upisa'] ?? null, mok_rok_mjeseci($mysqli));
}

/** Dohvati redak bilješke po id-u (bez filtera vidljivosti) ili null. */
function mok_red($mysqli, $id)
{
    $id = (int) $id;
    if ($id <= 0) return null;
    $stmt = $mysqli->prepare('SELECT id, id_clan, upisao, id_loza_upisao, datum_upisa FROM clanovi_mok WHERE id = ? LIMIT 1');
    if (!$stmt) return null;
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row;
}
