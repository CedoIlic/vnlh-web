<?php
// Clanovi_MOK_CRUD_prava.php — zajednička pravila diskrecije za MOK (uključuje se u sve MOK endpointe).
// NIJE endpoint (nema izlaza); samo funkcije. Sesija i baza dolaze iz pozivatelja.
//
// Pravila (dogovor 2026-07-28, zamjenjuje prvotno pravilo po loži autora):
//  • RADNA razina — bilješku čita samo onaj tko zadovolji SVA TRI uvjeta:
//      1. autor je ulogirani            (clanovi_mok.upisao = sesija id_korisnik),
//      2. ulogiran je pod istom dužnošću pod kojom ju je zapisao
//         (clanovi_mok.upisao_duznost = sesija id_duznosnik; tko ima više dužnosti, bira ju pri loginu),
//      3. član na kojeg se bilješka odnosi je i danas u loži u kojoj je bio pri upisu
//         (clanovi.loza = clanovi_mok.id_loza_clan) — prelazak ČLANA u drugu ložu odsijeca stare bilješke.
//    Loža AUTORA (id_loza_upisao) VIŠE NIJE uvjet vidljivosti — ostaje samo povijesni zapis.
//  • KONTROLNA razina — dužnost ulogiranog je u sustav_varijable 127 → čita SVE bilješke (i brojka u koloni
//    „Bilježaka“ je ukupna), ali NE smije mijenjati ni brisati (to ostaje isključivo autoru).
//  • Izmjena/brisanje — samo autor, unutar roka (datum_upisa + sustav_varijable 128 mjeseci) i samo dok mu je
//    bilješka vidljiva po radnoj razini (što ne vidi, ne može ni mijenjati).
//  • Razina 4 (Časni majstori) se NE provjerava ovdje — pravo na formu se dodjeljuje kroz meni/prava.

/** Dužnost pod kojom je ulogiran (sesija; korisnik s više dužnosti bira ju pri loginu) ili 0. */
function mok_moja_duznost()
{
    return (int) ($_SESSION['id_duznosnik'] ?? 0);
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

/** Vidi li ulogirani bilješku po RADNOJ razini? Autor + ista dužnost + član još u loži iz zapisa.
 *  $red mora doći iz mok_red() (nosi clan_loza_sada). Kontrolna razina se provjerava zasebno. */
function mok_vidljiva_radna($red)
{
    $ja = (int) ($_SESSION['id_korisnik'] ?? 0);
    if ($ja <= 0 || !$red) return false;
    if ((int) ($red['upisao'] ?? 0) !== $ja) return false;
    $mojaDuznost = mok_moja_duznost();
    if ($mojaDuznost <= 0 || (int) ($red['upisao_duznost'] ?? 0) !== $mojaDuznost) return false;
    return (int) ($red['id_loza_clan'] ?? 0) === (int) ($red['clan_loza_sada'] ?? 0);
}

/** Smije li ulogirani mijenjati/brisati bilješku (redak iz mok_red)? Vidljiva po radnoj razini + unutar roka.
 *  Kontrolna razina NEMA ovo pravo — ona samo čita. */
function mok_smije_mijenjati($mysqli, $red)
{
    if (!mok_vidljiva_radna($red)) return false;
    return mok_u_roku($red['datum_upisa'] ?? null, mok_rok_mjeseci($mysqli));
}

/** Dohvati redak bilješke po id-u (bez filtera vidljivosti) ili null.
 *  clan_loza_sada = trenutna loža člana na kojeg se bilješka odnosi (za 3. uvjet vidljivosti). */
function mok_red($mysqli, $id)
{
    $id = (int) $id;
    if ($id <= 0) return null;
    $stmt = $mysqli->prepare(
        'SELECT m.id, m.id_clan, m.upisao, m.upisao_duznost, m.id_loza_upisao, m.id_loza_clan, m.datum_upisa,
                c.loza AS clan_loza_sada
         FROM clanovi_mok m
         LEFT JOIN clanovi c ON c.id = m.id_clan
         WHERE m.id = ? LIMIT 1'
    );
    if (!$stmt) return null;
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row;
}
