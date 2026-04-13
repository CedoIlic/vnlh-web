<?php
/**
 * meni_za_sesiju.php – dopuštene izvršne stavke menija za sesiju (isti SQL filter kao u meni_dohvat_stabla_menija.php).
 * Jedan dohvat: lista za $_SESSION['vnlh_meni_dopustene'] bez ponovnog građenja stabla.
 *
 * @return array<int, array{id:int, html_fajl:string, putanja:string}>
 */
function meni_za_sesiju_ucitaj_dopustene(mysqli $mysqli, int $idDuznosnik): array
{
    if ($idDuznosnik <= 0) {
        return [];
    }
    $stmtD = $mysqli->prepare('SELECT 1 FROM duznosnici WHERE id = ? LIMIT 1');
    if (!$stmtD) {
        return [];
    }
    $stmtD->bind_param('i', $idDuznosnik);
    $stmtD->execute();
    $resD = $stmtD->get_result();
    if (!$resD || $resD->num_rows === 0) {
        $stmtD->close();
        return [];
    }
    $stmtD->close();

    $ids = [103, 104, 105];
    $tipIds = [];
    foreach ($ids as $vid) {
        $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
        if (!$stmt) {
            continue;
        }
        $stmt->bind_param('i', $vid);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($res->num_rows > 0) {
            $row = $res->fetch_assoc();
            $v = isset($row['varijabla']) ? trim((string) $row['varijabla']) : '';
            if ($v !== '' && $v !== '0') {
                $tipIds[] = (int) $v;
            }
        }
        $stmt->close();
    }
    if ($tipIds === []) {
        return [];
    }

    $izvrsniTipIdForFilter = null;
    $stmt105 = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 105 LIMIT 1');
    if ($stmt105) {
        $stmt105->execute();
        $res105 = $stmt105->get_result();
        if ($res105->num_rows > 0) {
            $row105 = $res105->fetch_assoc();
            $v105 = isset($row105['varijabla']) ? trim((string) $row105['varijabla']) : '';
            if ($v105 !== '' && $v105 !== '0') {
                $izvrsniTipIdForFilter = (int) $v105;
            }
        }
        $stmt105->close();
    }

    $placeholders = implode(',', array_fill(0, count($tipIds), '?'));
    $types = str_repeat('i', count($tipIds));
    $sql = "SELECT m.id, m.html_fajl, m.putanja, m.meni_tip_id
            FROM meni m
            WHERE m.meni_tip_id IN ($placeholders) AND m.aktivno = 1";
    $params = $tipIds;

    if ($izvrsniTipIdForFilter !== null) {
        $sql .= ' AND (m.meni_tip_id != ? OR EXISTS (SELECT 1 FROM duznosnici_prava dp WHERE dp.duznost = ? AND dp.pravo = m.id))';
        $params[] = $izvrsniTipIdForFilter;
        $params[] = $idDuznosnik;
    }

    $sql .= ' ORDER BY m.redoslijed ASC, m.naziv ASC';

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        return [];
    }
    $extraParams = count($params) - count($tipIds);
    $stmt->bind_param($types . str_repeat('i', $extraParams), ...$params);
    if (!$stmt->execute()) {
        $stmt->close();
        return [];
    }
    $result = $stmt->get_result();
    $out = [];
    $izvrsniTipId = $izvrsniTipIdForFilter;
    while ($row = $result->fetch_assoc()) {
        $tid = isset($row['meni_tip_id']) ? (int) $row['meni_tip_id'] : 0;
        $html = isset($row['html_fajl']) ? trim((string) $row['html_fajl']) : '';
        if ($izvrsniTipId !== null && $tid === $izvrsniTipId && $html !== '') {
            $out[] = [
                'id' => (int) $row['id'],
                'html_fajl' => $html,
                'putanja' => isset($row['putanja']) ? trim((string) $row['putanja']) : '',
            ];
        }
    }
    $stmt->close();
    return $out;
}
