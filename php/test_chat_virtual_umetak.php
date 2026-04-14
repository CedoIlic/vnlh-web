<?php
/**
 * test_chat_virtual_umetak.php
 *
 * POST API za testnu stranicu test.php: umeće „Chat poruka” u sustav_sesije_poruke kao da je poslao
 * niz pošiljatelja prema primatelju (isti model id_razgovor kao poruke_chat_posalji.php).
 *
 * Zaštita:
 * - require_login_api.php (valjana sesija).
 * - Primatelj mora biti id prijavljenog korisnika (ne može se umetati tuđi inbox).
 * - Samo POST; ograničenja: najviše 20 poruka po pošiljatelju, najviše 15 različitih pošiljatelja.
 *
 * POST: posiljatelji (obavezno, npr. "214,291"), poruka_po (opcionalno, default 5),
 *       interval_sekundi (opcionalno, 0–60): pauza između dviju uzastopnih poruka (sleep na serveru); 0 = sve odjednom.
 *       Ukupno (ukupno−1)*interval ne smije premašiti 600 s (zaštita od predugog HTTP zahtjeva).
 *
 * Izlaz: JSON { ok: true, ukupno, primatelj, interval_sekundi, poruke: [...] } ili { ok: false, error: string }.
 */
require_once __DIR__ . '/require_login_api.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Samo POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$idPrimatelj = (int) ($_SESSION['id_korisnik'] ?? 0);
if ($idPrimatelj <= 0) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Nema prijave.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$rawPos = isset($_POST['posiljatelji']) ? trim((string) $_POST['posiljatelji']) : '';
$porukaPo = isset($_POST['poruka_po']) ? (int) $_POST['poruka_po'] : 5;
$porukaPo = max(1, min(20, $porukaPo));
$intervalSekundi = isset($_POST['interval_sekundi']) ? (int) $_POST['interval_sekundi'] : 0;
$intervalSekundi = max(0, min(60, $intervalSekundi));

if ($rawPos === '') {
    echo json_encode(['ok' => false, 'error' => 'Nedostaje posiljatelji (zarezom odvojeni ID-jevi).'], JSON_UNESCAPED_UNICODE);
    exit;
}

$parts = preg_split('/\s*,\s*/', $rawPos, -1, PREG_SPLIT_NO_EMPTY);
if ($parts === false) {
    echo json_encode(['ok' => false, 'error' => 'Nevaljan format posiljatelji.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$posiljatelji = [];
foreach ($parts as $p) {
    $sid = (int) trim($p);
    if ($sid > 0 && $sid !== $idPrimatelj) {
        $posiljatelji[] = $sid;
    }
}
$posiljatelji = array_values(array_unique($posiljatelji));
if ($posiljatelji === []) {
    echo json_encode(['ok' => false, 'error' => 'Nema valjanih ID-jeva pošiljatelja.'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (count($posiljatelji) > 15) {
    echo json_encode(['ok' => false, 'error' => 'Najviše 15 pošiljatelja odjednom.'], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Redoslijed u krugovima: A,B,C,A,B,C… dok svaki ne dosegnu $porukaPo poruka.
 *
 * @param list<int> $posiljatelji
 * @return list<int>
 */
function test_chat_virtual_redoslijed(array $posiljatelji, int $porukaPo): array
{
    $preostalo = [];
    foreach ($posiljatelji as $id) {
        $preostalo[$id] = $porukaPo;
    }
    $redoslijed = [];
    while (true) {
        $jos = false;
        foreach ($posiljatelji as $sid) {
            if ($preostalo[$sid] > 0) {
                $redoslijed[] = $sid;
                $preostalo[$sid]--;
                $jos = true;
            }
        }
        if (!$jos) {
            break;
        }
    }
    return $redoslijed;
}

/**
 * Jedan INSERT u sustav_sesije_poruke (tip Chat poruka) – ista logika id_razgovor kao poruke_chat_posalji.php.
 */
function test_chat_virtual_umetni_jednu(mysqli $mysqli, int $idPosiljatelj, int $idPrimatelj, string $porukaTekst): bool
{
    if ($idPosiljatelj <= 0 || $idPrimatelj <= 0 || $idPosiljatelj === $idPrimatelj || $porukaTekst === '') {
        return false;
    }

    $idRazUlaz = 0;
    $idRazgovor = 0;
    if ($idRazUlaz > 0 && poruke_chat_id_razgovor_valjan_za_par($mysqli, $idPosiljatelj, $idPrimatelj, $idRazUlaz)) {
        $idRazgovor = $idRazUlaz;
    } else {
        $idRazgovor = poruke_chat_zadnji_id_razgovor($mysqli, $idPosiljatelj, $idPrimatelj);
    }

    if ($idRazgovor <= 0) {
        $sqlMax = 'SELECT COALESCE(MAX(id_razgovor), 0) + 1 AS novi FROM sustav_sesije_poruke WHERE tip = \'Chat poruka\'';
        $resMax = $mysqli->query($sqlMax);
        if ($resMax) {
            $rowMax = $resMax->fetch_assoc();
            $idRazgovor = $rowMax ? (int) $rowMax['novi'] : 1;
        } else {
            $idRazgovor = 1;
        }
    }

    $sessionId = 'test-web-' . $idPosiljatelj . '-' . bin2hex(random_bytes(4));

    $sql = '
        INSERT INTO sustav_sesije_poruke
            (id_razgovor, id_posiljatelj, id_primatelj, session_id_posiljatelj, poruka, vrijeme_slanja, status, tip, brisano)
        VALUES
            (?, ?, ?, ?, ?, NOW(), \'Novo\', \'Chat poruka\', 0)
    ';

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        return false;
    }

    $stmt->bind_param('iiiss', $idRazgovor, $idPosiljatelj, $idPrimatelj, $sessionId, $porukaTekst);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1 || !isset($mysqli) || !($mysqli instanceof mysqli)) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'Baza nije dostupna.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/poruke_chat_sesija.php';

$redoslijed = test_chat_virtual_redoslijed($posiljatelji, $porukaPo);
$ukupno = count($redoslijed);

$ukupnoPauzaS = $ukupno > 1 ? ($ukupno - 1) * $intervalSekundi : 0;
if ($ukupnoPauzaS > 600) {
    echo json_encode(
        [
            'ok'    => false,
            'error' => 'Ukupna pauza između poruka (' . $ukupnoPauzaS . ' s) premašuje 600 s. Smanji interval ili broj poruka.',
        ],
        JSON_UNESCAPED_UNICODE
    );
    $mysqli->close();
    exit;
}

@ini_set('max_execution_time', (string) max(120, $ukupnoPauzaS + 90));

$porukeOut = [];

$brojacPo = [];
foreach ($posiljatelji as $sid0) {
    $brojacPo[$sid0] = 0;
}

for ($i = 0; $i < $ukupno; $i++) {
    $sender = $redoslijed[$i];
    $brojacPo[$sender]++;
    $n = $brojacPo[$sender];
    $poruka = sprintf(
        '[Test forma web] %s | od korisnika %d → %d | #%d/%d',
        date('Y-m-d H:i:s'),
        $sender,
        $idPrimatelj,
        $n,
        $porukaPo
    );

    if (!test_chat_virtual_umetni_jednu($mysqli, $sender, $idPrimatelj, $poruka)) {
        $mysqli->close();
        echo json_encode(
            [
                'ok'    => false,
                'error' => 'SQL greška na koraku ' . ($i + 1) . ' (posiljatelj=' . $sender . ').',
            ],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
    $porukeOut[] = ['korak' => $i + 1, 'posiljatelj' => $sender, 'redni_za_posiljatelja' => $n];

    if ($intervalSekundi > 0 && $i + 1 < $ukupno) {
        sleep($intervalSekundi);
    }
}

$mysqli->close();

echo json_encode(
    [
        'ok'                 => true,
        'primatelj'          => $idPrimatelj,
        'ukupno'             => $ukupno,
        'interval_sekundi'   => $intervalSekundi,
        'poruke'             => $porukeOut,
    ],
    JSON_UNESCAPED_UNICODE
);
