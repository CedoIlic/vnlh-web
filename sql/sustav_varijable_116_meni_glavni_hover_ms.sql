-- Jednokratno: kašnjenje (ms) prije prikaza prvog dropdowna s glavne trake menija pri hoveru (Meni.js, Alati_Meni_Test.js).
-- Čita js/0-Common.js (vnlhLoadMeniHoverDelaysFromVar116And115 → common_sustav_varijable.php?id=116).
-- Vrijednost 0 ili nedostatak retka: zadano 300 ms.

INSERT INTO sustav_varijable (id, varijabla, Naziv, opis)
VALUES (
    116,
    '300',
    'Kašnjenje hover glavnog menija (ms)',
    'Milisekunde čekanja prije prikaza prvog dropdowna s horizontalne trake pri hoveru. Klik na glavni gumb otvara odmah. 0 = zadano 300 ms.'
)
ON DUPLICATE KEY UPDATE
    varijabla = VALUES(varijabla),
    Naziv = VALUES(Naziv),
    opis = VALUES(opis);
