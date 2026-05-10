-- =========================================================
-- Pregled: koje tablice iz db-schema/vnlh NEMAJU na trenutnoj bazi
--
-- Namjena: jedan SELECT na LOKALU i jedan na PRODUKCIJI (nakon USE baze).
-- Rezultat su imena tablica koje na tom serveru nedostaju – migracija
-- vnlh_migracija_pk_fk_unsigned.sql ih automatski preskače.
--
-- Napomena: očekivani popis sinkron je s .sql datotekama u db-schema/vnlh/
-- (40 tablica). Kad se shema proširi, dodaj red u UNION ALL ispod.
-- Potpuni pregled razlika razvoj↔prod ostaje workflow `Baza-Test-Razlika.sh`; ovaj upit
-- pokazuje što još nije na ovom serveru u odnosu na popis projekta.
-- =========================================================

SELECT
  e.ocekivana_tablica AS tablica_nedostaje_na_ovom_serveru
FROM (
  SELECT 'adrese' AS ocekivana_tablica
  UNION ALL SELECT 'adrese_tip'
  UNION ALL SELECT 'clanovi'
  UNION ALL SELECT 'clanovi_porijeklo'
  UNION ALL SELECT 'clanovi_zastavice'
  UNION ALL SELECT 'drzave'
  UNION ALL SELECT 'drzave_adresa'
  UNION ALL SELECT 'duznosnici'
  UNION ALL SELECT 'duznosnici_ogranicenja'
  UNION ALL SELECT 'duznosnici_prava'
  UNION ALL SELECT 'duznosnici_tip'
  UNION ALL SELECT 'email_tip'
  UNION ALL SELECT 'e_maili'
  UNION ALL SELECT 'jezici'
  UNION ALL SELECT 'loze'
  UNION ALL SELECT 'loze_tip'
  UNION ALL SELECT 'loze_tip_stupanj_enum'
  UNION ALL SELECT 'meni'
  UNION ALL SELECT 'meni_tip'
  UNION ALL SELECT 'napredovanja'
  UNION ALL SELECT 'napredovanja_tip'
  UNION ALL SELECT 'obredi'
  UNION ALL SELECT 'radovi_drzave_gostiju'
  UNION ALL SELECT 'radovi_prisustvo_tip'
  UNION ALL SELECT 'radovi_tip'
  UNION ALL SELECT 'regije'
  UNION ALL SELECT 'stupnjevi'
  UNION ALL SELECT 'sustav_korisnici'
  UNION ALL SELECT 'sustav_korisnici_login'
  UNION ALL SELECT 'sustav_odgovori_razvoja_boje'
  UNION ALL SELECT 'sustav_odgovori_razvoja_poruke'
  UNION ALL SELECT 'sustav_sesije_aktivne'
  UNION ALL SELECT 'sustav_sesije_poruke'
  UNION ALL SELECT 'sustav_varijable'
  UNION ALL SELECT 'telefoni'
  UNION ALL SELECT 'telefoni_tip'
  UNION ALL SELECT 'zapisnik_sa_radova'
  UNION ALL SELECT 'zapisnik_sa_radova_duznosnici'
  UNION ALL SELECT 'zapisnik_sa_radova_loze_ucesnice'
  UNION ALL SELECT 'zapisnik_sa_radova_prisutni'
) AS e
LEFT JOIN information_schema.TABLES AS t
  ON t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_NAME = e.ocekivana_tablica
  AND t.TABLE_TYPE = 'BASE TABLE'
WHERE t.TABLE_NAME IS NULL
ORDER BY e.ocekivana_tablica;
