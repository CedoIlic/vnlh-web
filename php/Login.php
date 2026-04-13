<?php
// Login.php – GET: prijavna forma (html/Login.html). POST (login, pass): API – provjera sustav_korisnici; uspjeh: sesija id_korisnik, id_duznosnik, vnlh_meni_dopustene
// Izlaz POST: OK | PASS_CHANGE | 026 | prazno (neuspjeh)
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
    'SELECT id_korisnik, id_duznosnik, pass, pass_status
     FROM sustav_korisnici
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
        'SELECT pass_status, login_neuspjesni_pokusaji FROM sustav_korisnici WHERE id_korisnik = ? LIMIT 1'
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

// Svježi očitaj nakon ispravne lozinke: stari $row ne uključuje ažurirani brojač / blokadu iz istog zahtjeva ili Alata.
$stmtFresh = $mysqli->prepare(
    'SELECT id_korisnik, id_duznosnik, pass_status, login_neuspjesni_pokusaji FROM sustav_korisnici WHERE id_korisnik = ? LIMIT 1'
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
$idDuznosnik = (int) $freshRow['id_duznosnik'];

vnlh_login_reset_failures($mysqli, $idKorisnik);

vnlh_establish_login_session($idKorisnik, $idDuznosnik);
$_SESSION['login_display'] = $loginRaw;

if ($psInt === 0) {
    unset($_SESSION['must_change_password']);
} else {
    $_SESSION['must_change_password'] = true;
}

require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
Alati_Sesije_Aktivne_insert_after_login($mysqli, $idKorisnik);

// --- Blok: Postavi inicijalni flag ima_neprocitanih za upravo kreiranu sesiju ---
// Korisnik može imati nepročitane poruke od ranije (primljene dok nije bio ulogiran).
// Provjerimo COUNT i odmah postavimo flag da prvi polling ne mora raditi teški upit.
$sqlCntLogin = "SELECT COUNT(*) AS cnt FROM sustav_sesije_poruke WHERE id_primatelj = ? AND status = 'Novo'";
$stmtCntLogin = $mysqli->prepare($sqlCntLogin);
if ($stmtCntLogin) {
    $stmtCntLogin->bind_param('i', $idKorisnik);
    $stmtCntLogin->execute();
    $resCntLogin = $stmtCntLogin->get_result();
    $rowCntLogin = $resCntLogin ? $resCntLogin->fetch_assoc() : null;
    $imaNeprocitanih = ($rowCntLogin && (int) $rowCntLogin['cnt'] > 0) ? 1 : 0;
    $stmtCntLogin->close();

    // Ažuriraj samo sesiju ovog korisnika s ovim session_id
    $sidLogin = session_id();
    $sqlSetFlag = "
        UPDATE sustav_sesije_aktivne
           SET ima_neprocitanih = ?
         WHERE session_id = ? AND status = 'aktivna'
    ";
    $stmtSetFlag = $mysqli->prepare($sqlSetFlag);
    if ($stmtSetFlag) {
        $stmtSetFlag->bind_param('is', $imaNeprocitanih, $sidLogin);
        $stmtSetFlag->execute();
        $stmtSetFlag->close();
    }
}

require_once __DIR__ . '/meni_za_sesiju.php';
$_SESSION['vnlh_meni_dopustene'] = meni_za_sesiju_ucitaj_dopustene($mysqli, $idDuznosnik);

$mysqli->close();
header('Content-Type: text/plain; charset=utf-8');
echo $psInt === 1 ? 'PASS_CHANGE' : 'OK';
