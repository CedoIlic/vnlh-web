<?php
// Login.php – GET: prijavna forma (html/Login.html). POST (login, pass): API – provjera sustav_korisnici_login + dodjele u sustav_korisnici;
// uspjeh: sesija id_korisnik, id_duznosnik (ili 0 dok se ne odabere dužnost), vnlh_meni_dopustene kad je poznata dužnost.
// Izlaz POST: OK | PASS_CHANGE | MULTI_DUTY + JSON u drugom retku | 026 | prazno (neuspjeh)
// pass_status: NULL = odbij; 0 = normalna; 1 = obvezna promjena lozinke; 2 = blokiran (026).

require_once __DIR__ . '/auth_start.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require __DIR__ . '/login_stranica_get.php';
    exit;
}

/**
 * Svaki POST s pokušajem prijave (login + pass) mora ukloniti staru sesiju prije provjere.
 * Inače nakon 026 (blokada) preglednik i dalje šalje kolačić prethodnog korisnika –
 * GET Login.php vidi tu sesiju i redirecta na Meni umjesto čiste prijave.
 */
$isLoginPost = $_SERVER['REQUEST_METHOD'] === 'POST'
    && array_key_exists('login', $_POST)
    && array_key_exists('pass', $_POST);

if ($isLoginPost) {
    vnlh_session_destroy_logout();
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

if (!$isLoginPost) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

require_once __DIR__ . '/vnlh_login_failures.php';
require_once __DIR__ . '/vnlh_login_post_auth.php';

$loginRaw = isset($_POST['login']) ? trim((string) $_POST['login']) : '';
$passRaw = isset($_POST['pass']) ? (string) $_POST['pass'] : '';

if ($loginRaw === '' || trim($passRaw) === '') {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

if ((function_exists('mb_strlen') ? mb_strlen($loginRaw, 'UTF-8') : strlen($loginRaw)) > 100) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$stmt = $mysqli->prepare(
    'SELECT id_korisnik, pass, pass_status, login_neuspjesni_pokusaji, broj_duznosti
     FROM sustav_korisnici_login
     WHERE login IS NOT NULL AND TRIM(login) <> \'\' AND LOWER(TRIM(login)) = LOWER(?)
     LIMIT 1'
);
if (!$stmt) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$stmt->bind_param('s', $loginRaw);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();

if (!$row) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$idKorisnikRow = (int) $row['id_korisnik'];

$passCol = isset($row['pass']) && $row['pass'] !== null ? trim((string) $row['pass']) : '';
if ($passCol === '' || strtoupper($passCol) === 'NULL') {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

if (!password_verify($passRaw, $passCol)) {
    vnlh_login_record_auth_failure($mysqli, $loginRaw, $idKorisnikRow);
    $stmtBlok = $mysqli->prepare(
        'SELECT pass_status, login_neuspjesni_pokusaji FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1'
    );
    $odgovor = '';
    if ($stmtBlok) {
        $stmtBlok->bind_param('i', $idKorisnikRow);
        $stmtBlok->execute();
        $resBlok = $stmtBlok->get_result();
        $rowBlok = $resBlok ? $resBlok->fetch_assoc() : null;
        $stmtBlok->close();
        if ($rowBlok) {
            $psBlok = isset($rowBlok['pass_status']) && $rowBlok['pass_status'] !== null ? (int) $rowBlok['pass_status'] : -1;
            $nFail = isset($rowBlok['login_neuspjesni_pokusaji']) ? (int) $rowBlok['login_neuspjesni_pokusaji'] : 0;
            if ($psBlok === 2 || $nFail >= vnlh_login_max_failed_attempts($mysqli)) {
                $odgovor = '026';
            }
        }
    }
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo $odgovor;
    exit;
}

$stmtFresh = $mysqli->prepare(
    'SELECT id_korisnik, pass_status, login_neuspjesni_pokusaji, broj_duznosti FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1'
);
if (!$stmtFresh) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}
$stmtFresh->bind_param('i', $idKorisnikRow);
if (!$stmtFresh->execute()) {
    $stmtFresh->close();
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}
$resFresh = $stmtFresh->get_result();
$freshRow = $resFresh ? $resFresh->fetch_assoc() : null;
$stmtFresh->close();
if (!$freshRow) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$ps = $freshRow['pass_status'];
if ($ps === null) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$psInt = (int) $ps;
$nFailFresh = isset($freshRow['login_neuspjesni_pokusaji']) ? (int) $freshRow['login_neuspjesni_pokusaji'] : 0;
if ($psInt === 2 || $nFailFresh >= vnlh_login_max_failed_attempts($mysqli)) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '026';
    exit;
}

if ($psInt !== 0 && $psInt !== 1) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$idKorisnik = (int) $freshRow['id_korisnik'];
$nDuty = isset($freshRow['broj_duznosti']) ? (int) $freshRow['broj_duznosti'] : 0;
if ($nDuty <= 0) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

vnlh_login_reset_failures($mysqli, $idKorisnik);

/** Jedna dodjela: id dužnosti za sesiju; više uz pass 0: odabir kasnije (0). */
$idJedinaDuznost = vnlh_login_jedina_duznost_id($mysqli, $idKorisnik);

$sessionDuznost = 0;
if ($psInt === 1) {
    $sessionDuznost = 0;
} elseif ($psInt === 0 && $nDuty > 1) {
    $sessionDuznost = 0;
} else {
    $sessionDuznost = $idJedinaDuznost;
}

vnlh_establish_login_session($idKorisnik, $sessionDuznost);
$_SESSION['login_display'] = $loginRaw;

if ($psInt === 0) {
    unset($_SESSION['must_change_password']);
} else {
    $_SESSION['must_change_password'] = true;
}

/**
 * Zajednički blok: INSERT aktivne sesije + zastavice nepročitanih (isti kao pri starom jednoretnom modelu).
 * Samo PASS_CHANGE: INSERT + zastavice. Jedna dužnost + OK: vnlh_login_zavrsi_sesiju_puni_meni_chat_sesije.
 * MULTI_DUY: INSERT tek nakon Login_odabir_duznosti.php.
 */
$runSesijeInsert = ($psInt === 1);

if ($runSesijeInsert) {
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

if ($psInt === 1) {
    $_SESSION['vnlh_meni_dopustene'] = [];
    require_once __DIR__ . '/poruke_chat_sesija.php';
    $_SESSION['chat_dozvoljen'] = poruke_chat_dozvoljen_za_korisnika($mysqli, $idKorisnik);
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo 'PASS_CHANGE';
    exit;
}

if ($nDuty > 1) {
    $_SESSION['needs_duznost_choice'] = true;
    $_SESSION['vnlh_meni_dopustene'] = [];
    require_once __DIR__ . '/poruke_chat_sesija.php';
    $_SESSION['chat_dozvoljen'] = poruke_chat_dozvoljen_za_korisnika($mysqli, $idKorisnik);
    $lista = vnlh_login_duznosti_lista_za_korisnika($mysqli, $idKorisnik);
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo "MULTI_DUTY\n" . json_encode(['duznosti' => $lista], JSON_UNESCAPED_UNICODE);
    exit;
}

vnlh_login_zavrsi_sesiju_puni_meni_chat_sesije($mysqli, $idKorisnik, $idJedinaDuznost, $loginRaw);

$mysqli->close();
header('Content-Type: text/plain; charset=utf-8');
echo 'OK';
