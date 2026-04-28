-- =============================================================================
-- sustav_korisnici: triggeri — osiguravanje retka u sustav_korisnici_login
--   i uklanjanje „siročadi” (login bez nijedne dodjele u sustav_korisnici).
--
-- Pretpostavke (usklađeno s produkcijom / migracijom a2d60b1):
--   - sustav_korisnici: (id_korisnik, id_duznosnik) sastavni PK; na testiranoj
--     bazi nema izlazećeg FK prema sustav_korisnici_login.
--   - sustav_korisnici_login: id_korisnik PK; ostala polja mogu NULL (shell red).
--
-- Redoslijed ponašanja:
--   - BEFORE INSERT / BEFORE UPDATE: ako za NEW.id_korisnik ne postoji red u
--     sustav_korisnici_login, umetni jedan (login/pass NULL, broj_duznosti 0);
--     postojećeg korisnika s drugom dužnošću ne duplicirati.
--   - AFTER INSERT / UPDATE / DELETE: ažuriranje broj_duznosti kao prije; zatim
--     ako za id_korisnik nema niti jednog retka u sustav_korisnici, obriši red
--     u sustav_korisnici_login. (Ako je FK prema sesijama s ON DELETE CASCADE,
--     aktivne sesije odu s login retkom — vidi Duznosnici_CRUD_brisanje.php.)
--
-- Pokreni ručno na serveru nakon backupa. Zamjenjuje postojeće triggere
-- tr_sustav_korisnici_{ai,au,ad}_broj_duznosti i dodaje bi_/bu_ ensure.
-- =============================================================================

DELIMITER //

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_bi_ensure_login`//
CREATE TRIGGER `tr_sustav_korisnici_bi_ensure_login` BEFORE INSERT ON `sustav_korisnici` FOR EACH ROW
BEGIN
  /* Jedan red u loginu po korisniku: umetak samo ako već nema retka. */
  IF NOT EXISTS (
    SELECT 1 FROM `sustav_korisnici_login` `l` WHERE `l`.`id_korisnik` = NEW.`id_korisnik` LIMIT 1
  ) THEN
    INSERT INTO `sustav_korisnici_login` (
      `id_korisnik`, `login`, `pass`, `pass_status`, `login_neuspjesni_pokusaji`, `broj_duznosti`
    ) VALUES (NEW.`id_korisnik`, NULL, NULL, NULL, 0, 0);
  END IF;
END//

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_bu_ensure_login`//
CREATE TRIGGER `tr_sustav_korisnici_bu_ensure_login` BEFORE UPDATE ON `sustav_korisnici` FOR EACH ROW
BEGIN
  /* Novi korisnik u retku mora imati shell login ako već ne postoji. */
  IF NOT EXISTS (
    SELECT 1 FROM `sustav_korisnici_login` `l` WHERE `l`.`id_korisnik` = NEW.`id_korisnik` LIMIT 1
  ) THEN
    INSERT INTO `sustav_korisnici_login` (
      `id_korisnik`, `login`, `pass`, `pass_status`, `login_neuspjesni_pokusaji`, `broj_duznosti`
    ) VALUES (NEW.`id_korisnik`, NULL, NULL, NULL, 0, 0);
  END IF;
END//

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_ai_broj_duznosti`//
CREATE TRIGGER `tr_sustav_korisnici_ai_broj_duznosti` AFTER INSERT ON `sustav_korisnici` FOR EACH ROW
BEGIN
  UPDATE `sustav_korisnici_login`
  SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = NEW.`id_korisnik`)
  WHERE `id_korisnik` = NEW.`id_korisnik`;
END//

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_au_broj_duznosti`//
CREATE TRIGGER `tr_sustav_korisnici_au_broj_duznosti` AFTER UPDATE ON `sustav_korisnici` FOR EACH ROW
BEGIN
  UPDATE `sustav_korisnici_login`
  SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = NEW.`id_korisnik`)
  WHERE `id_korisnik` = NEW.`id_korisnik`;
  IF NEW.`id_korisnik` <> OLD.`id_korisnik` THEN
    UPDATE `sustav_korisnici_login`
    SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = OLD.`id_korisnik`)
    WHERE `id_korisnik` = OLD.`id_korisnik`;
  END IF;
  /* Starom korisniku nakon izmjene može ostati 0 dodjela (npr. promjena id_korisnik). */
  DELETE FROM `sustav_korisnici_login`
  WHERE `id_korisnik` = OLD.`id_korisnik`
    AND (SELECT COUNT(*) FROM `sustav_korisnici` `s2` WHERE `s2`.`id_korisnik` = OLD.`id_korisnik`) = 0;
END//

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_ad_broj_duznosti`//
CREATE TRIGGER `tr_sustav_korisnici_ad_broj_duznosti` AFTER DELETE ON `sustav_korisnici` FOR EACH ROW
BEGIN
  UPDATE `sustav_korisnici_login`
  SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = OLD.`id_korisnik`)
  WHERE `id_korisnik` = OLD.`id_korisnik`;
  DELETE FROM `sustav_korisnici_login`
  WHERE `id_korisnik` = OLD.`id_korisnik`
    AND (SELECT COUNT(*) FROM `sustav_korisnici` `s2` WHERE `s2`.`id_korisnik` = OLD.`id_korisnik`) = 0;
END//

DELIMITER ;

-- =============================================================================
-- JEDNOKRATNO (nakon gornjih triggera) — korisnici s dodjelom bez retka u loginu
-- Pokreni po potrebi, uz backup. Drugi izraz usklađuje broj_duznosti za sve u loginu.
-- =============================================================================
/*
INSERT INTO `sustav_korisnici_login` (
  `id_korisnik`, `login`, `pass`, `pass_status`, `login_neuspjesni_pokusaji`, `broj_duznosti`
)
SELECT DISTINCT `s`.`id_korisnik`, NULL, NULL, NULL, 0, 0
FROM `sustav_korisnici` `s`
LEFT JOIN `sustav_korisnici_login` `l` ON `l`.`id_korisnik` = `s`.`id_korisnik`
WHERE `l`.`id_korisnik` IS NULL;

UPDATE `sustav_korisnici_login` `l`
SET `l`.`broj_duznosti` = (
  SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = `l`.`id_korisnik`
);
*/
