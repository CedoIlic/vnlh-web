<?php
/**
 * Pomoćne funkcije za Login.php i Login_odabir_duznosti.php nakon uspješne provjere vjerodajnica.
 * Rad s tablicama sustav_korisnici_login (login/pass) i sustav_korisnici (dodjele dužnosti).
 */

/**
 * Dohvati sve dodijeljene dužnosti za korisnika (id_duznosnik + naziv), sortirano po nazivu.
 *
 * @return array<int, array{id:int, naziv:string}>
 */
function vnlh_login_duznosti_lista_za_korisnika(mysqli $mysqli, int $idKorisnik): array
{
    if ($idKorisnik <= 0) {
        return [];
    }
    $sql = 'SELECT d.id, d.naziv
            FROM sustav_korisnici sk
            INNER JOIN duznosnici d ON d.id = sk.id_duznosnik
            WHERE sk.id_korisnik = ?
            ORDER BY d.naziv ASC';
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $stmt->bind_param('i', $idKorisnik);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }
    $res = $stmt->get_result();
    $out = [];
    while ($res && ($row = $res->fetch_assoc())) {
        $out[] = [
            'id' => (int) $row['id'],
            'naziv' => isset($row['naziv']) ? trim((string) $row['naziv']) : '',
        ];
    }
    $stmt->close();
    return $out;
}

/**
 * Jedan id_duznosnik ako korisnik ima točno jednu dodjelu, inače 0.
 */
function vnlh_login_jedina_duznost_id(mysqli $mysqli, int $idKorisnik): int
{
    if ($idKorisnik <= 0) {
        return 0;
    }
    $stmt = $mysqli->prepare('SELECT id_duznosnik FROM sustav_korisnici WHERE id_korisnik = ? LIMIT 2');
    if (!$stmt) {
        return 0;
    }
    $stmt->bind_param('i', $idKorisnik);
    if (!$stmt->execute()) {
        $stmt->close();
        return 0;
    }
    $res = $stmt->get_result();
    $first = $res ? $res->fetch_assoc() : null;
    $second = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if ($first && !$second) {
        return (int) $first['id_duznosnik'];
    }
    return 0;
}

/**
 * Nakon odabira dužnosti (ili jedne dodjele): meni, chat, INSERT aktivne sesije, zastavice nepročitanih u sustav_sesije_aktivne.
 * Poziva se iz Login.php (jedna dužnost) i Login_odabir_duznosti.php (više dužnosti nakon izbora).
 *
 * @param string $loginDisplay Isti string kao pri prijavi (za login_display u sesiji).
 */
function vnlh_login_zavrsi_sesiju_puni_meni_chat_sesije(
    mysqli $mysqli,
    int $idKorisnik,
    int $idDuznosnik,
    string $loginDisplay
): void {
    $_SESSION['id_duznosnik'] = $idDuznosnik;
    $_SESSION['login_display'] = $loginDisplay;

    require_once __DIR__ . '/meni_za_sesiju.php';
    $_SESSION['vnlh_meni_dopustene'] = meni_za_sesiju_ucitaj_dopustene($mysqli, $idDuznosnik);

    require_once __DIR__ . '/poruke_chat_sesija.php';
    $_SESSION['chat_dozvoljen'] = poruke_chat_dozvoljen_za_korisnika($mysqli, $idKorisnik);

    require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
    Alati_Sesije_Aktivne_insert_after_login($mysqli, $idKorisnik);

    $sqlCntMail = "SELECT COUNT(*) AS cnt FROM sustav_sesije_poruke WHERE id_primatelj = ? AND status = 'Novo' AND brisano = 0 AND tip = 'Poruka'";
    $stmtCntMail = $mysqli->prepare($sqlCntMail);
    $imaNeprocitanih = 0;
    if ($stmtCntMail) {
        $stmtCntMail->bind_param('i', $idKorisnik);
        $stmtCntMail->execute();
        $resCntMail = $stmtCntMail->get_result();
        $rowCntMail = $resCntMail ? $resCntMail->fetch_assoc() : null;
        $imaNeprocitanih = ($rowCntMail && (int) $rowCntMail['cnt'] > 0) ? 1 : 0;
        $stmtCntMail->close();
    }

    $sqlCntChat = "SELECT COUNT(*) AS cnt FROM sustav_sesije_poruke WHERE id_primatelj = ? AND status = 'Novo' AND brisano = 0 AND tip = 'Chat poruka'";
    $stmtCntChat = $mysqli->prepare($sqlCntChat);
    $imaChatNeprocitanih = 0;
    if ($stmtCntChat) {
        $stmtCntChat->bind_param('i', $idKorisnik);
        $stmtCntChat->execute();
        $resCntChat = $stmtCntChat->get_result();
        $rowCntChat = $resCntChat ? $resCntChat->fetch_assoc() : null;
        $imaChatNeprocitanih = ($rowCntChat && (int) $rowCntChat['cnt'] > 0) ? 1 : 0;
        $stmtCntChat->close();
    }

    $sidLogin = session_id();
    $sqlSetFlag = "
        UPDATE sustav_sesije_aktivne
           SET ima_neprocitanih = ?, ima_chat_neprocitanih = ?
         WHERE session_id = ? AND status = 'aktivna'
    ";
    $stmtSetFlag = $mysqli->prepare($sqlSetFlag);
    if ($stmtSetFlag) {
        $stmtSetFlag->bind_param('iis', $imaNeprocitanih, $imaChatNeprocitanih, $sidLogin);
        $stmtSetFlag->execute();
        $stmtSetFlag->close();
    }
}
