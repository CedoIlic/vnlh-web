<?php
/**
 * poruke_chat_sesija.php
 * Pomoćne funkcije za pravo na chat (priprema za „Chat poruka”).
 * Lista dopuštenih korisnika: sustav_varijable.id = 110, kolona varijabla = npr. "214,228,291" (ID-jevi iz sustav_korisnici.id_korisnik).
 */

/**
 * Vraća 1 ako je $idKorisnik u listi iz varijable 110, inače 0.
 * Prazan retak, SQL greška ili prazan string varijable → 0.
 */
function poruke_chat_dozvoljen_za_korisnika(mysqli $mysqli, int $idKorisnik): int
{
    if ($idKorisnik <= 0) {
        return 0;
    }
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 110 LIMIT 1');
    if (!$stmt) {
        return 0;
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row || !isset($row['varijabla'])) {
        return 0;
    }
    $raw = trim((string) $row['varijabla']);
    if ($raw === '') {
        return 0;
    }
    $parts = preg_split('/\s*,\s*/', $raw, -1, PREG_SPLIT_NO_EMPTY);
    if ($parts === false || $parts === []) {
        return 0;
    }
    $ids = [];
    foreach ($parts as $p) {
        $n = (int) trim($p);
        if ($n > 0) {
            $ids[] = $n;
        }
    }
    return in_array($idKorisnik, $ids, true) ? 1 : 0;
}

/**
 * Zadnji aktivni chat-thread između dva korisnika (tip = Chat poruka, brisano = 0).
 * Koristi se za nastavak iste niti (id_razgovor) i za JSON povijesti.
 *
 * @return int id_razgovor ili 0 ako nema redaka
 */
function poruke_chat_zadnji_id_razgovor(mysqli $mysqli, int $idJa, int $idSugovornik): int
{
    if ($idJa <= 0 || $idSugovornik <= 0 || $idJa === $idSugovornik) {
        return 0;
    }
    $sql = 'SELECT id_razgovor
               FROM sustav_sesije_poruke
              WHERE tip = \'Chat poruka\'
                AND brisano = 0
                AND ((id_posiljatelj = ? AND id_primatelj = ?)
                 OR (id_posiljatelj = ? AND id_primatelj = ?))
              ORDER BY vrijeme_slanja DESC, id DESC
              LIMIT 1';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param('iiii', $idJa, $idSugovornik, $idSugovornik, $idJa);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ? (int) $row['id_razgovor'] : 0;
}

/**
 * Je li $idRazgovor valjan aktivni chat-thread za par (idJa, idSugovornik)?
 */
function poruke_chat_id_razgovor_valjan_za_par(mysqli $mysqli, int $idJa, int $idSugovornik, int $idRazgovor): bool
{
    if ($idRazgovor <= 0 || $idJa <= 0 || $idSugovornik <= 0) {
        return false;
    }
    $sql = 'SELECT 1 AS x
               FROM sustav_sesije_poruke
              WHERE id_razgovor = ?
                AND tip = \'Chat poruka\'
                AND brisano = 0
                AND ((id_posiljatelj = ? AND id_primatelj = ?)
                 OR (id_posiljatelj = ? AND id_primatelj = ?))
              LIMIT 1';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('iiiii', $idRazgovor, $idJa, $idSugovornik, $idSugovornik, $idJa);
    $stmt->execute();
    $res = $stmt->get_result();
    $ok = $res && $res->fetch_assoc();
    $stmt->close();
    return (bool) $ok;
}

/**
 * Ima li korisnik trenutno aktivnu sesiju u sustav_sesije_aktivne (status = aktivna).
 * Isti kriterij kao poruke_chat_aktivni_korisnici.php – slanje chata prema neaktivnom sugovorniku nije dopušteno.
 *
 * @return bool true ako postoji barem jedan red s tim id_korisnikom i statusom aktivna
 */
function poruke_chat_je_korisnik_aktivan(mysqli $mysqli, int $idKorisnik): bool
{
    if ($idKorisnik <= 0) {
        return false;
    }
    $stmt = $mysqli->prepare(
        'SELECT 1 FROM sustav_sesije_aktivne WHERE id_korisnik = ? AND status = \'aktivna\' LIMIT 1'
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('i', $idKorisnik);
    $stmt->execute();
    $res = $stmt->get_result();
    $ok = $res && $res->fetch_assoc();
    $stmt->close();
    return (bool) $ok;
}
