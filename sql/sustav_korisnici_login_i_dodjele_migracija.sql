-- =============================================================================
-- Migracija: sustav_korisnici_login (vjerodajnice, jedan red po id_korisnik) +
--           sustav_korisnici samo dodjele (PK / UNIQUE na id_korisnik + id_duznosnik).
-- FK sustav_sesije_aktivne.id_korisnik → sustav_korisnici_login(id_korisnik).
-- Triggeri održavaju broj_duznosti u sustav_korisnici_login.
-- Pokreni jednom na bazi prije deploya PHP promjena.
-- =============================================================================

-- 1) Nova tablica vjerodajnica
CREATE TABLE IF NOT EXISTS `sustav_korisnici_login` (
  `id_korisnik` int(11) NOT NULL,
  `login` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `pass` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `pass_status` smallint(6) DEFAULT NULL COMMENT 'Status lozinke: 0 ok, 1 obavezna promjena lozinke, 2 Korisnik je blokiran',
  `login_neuspjesni_pokusaji` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Neuspjeli pokušaji prijave/promjene lozinke; reset pri uspjehu; 5+ -> pass_status=2',
  `broj_duznosti` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT 'Broj redaka u sustav_korisnici za ovaj id_korisnik (održavaju triggeri)',
  PRIMARY KEY (`id_korisnik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2) Kopiraj vjerodajnice iz postojeće sustav_korisnici (jedan red po korisniku u starom modelu)
INSERT INTO `sustav_korisnici_login` (`id_korisnik`, `login`, `pass`, `pass_status`, `login_neuspjesni_pokusaji`, `broj_duznosti`)
SELECT `id_korisnik`, `login`, `pass`, `pass_status`, `login_neuspjesni_pokusaji`, 0
FROM `sustav_korisnici`;

-- 3) Ukloni FK koji veže sesije na staru tablicu (id_korisnik više neće biti jedinstven u sustav_korisnici)
ALTER TABLE `sustav_sesije_aktivne` DROP FOREIGN KEY `fk_ssa_korisnik`;

-- 4) Stari PK na sustav_korisnici je samo id_korisnik — zamijeni sastavnim ključem, pa ukloni stupce vjerodajnica
ALTER TABLE `sustav_korisnici` DROP PRIMARY KEY, ADD PRIMARY KEY (`id_korisnik`, `id_duznosnik`);
ALTER TABLE `sustav_korisnici`
  DROP COLUMN `login`,
  DROP COLUMN `pass`,
  DROP COLUMN `pass_status`,
  DROP COLUMN `login_neuspjesni_pokusaji`;

-- 5) Poveži sesije s novom tablicom (jedan korisnik = jedan red u login tablici)
ALTER TABLE `sustav_sesije_aktivne`
  ADD CONSTRAINT `fk_ssa_korisnik` FOREIGN KEY (`id_korisnik`) REFERENCES `sustav_korisnici_login` (`id_korisnik`) ON UPDATE CASCADE ON DELETE CASCADE;

-- 6) Inicijalno popuni broj_duznosti
UPDATE `sustav_korisnici_login` `l`
SET `l`.`broj_duznosti` = (
  SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = `l`.`id_korisnik`
);

-- 7) Triggeri: nakon svake promjene dodjela ažuriraj broj_duznosti
DROP TRIGGER IF EXISTS `tr_sustav_korisnici_ai_broj_duznosti`;
DROP TRIGGER IF EXISTS `tr_sustav_korisnici_au_broj_duznosti`;
DROP TRIGGER IF EXISTS `tr_sustav_korisnici_ad_broj_duznosti`;

DELIMITER //
CREATE TRIGGER `tr_sustav_korisnici_ai_broj_duznosti` AFTER INSERT ON `sustav_korisnici` FOR EACH ROW
BEGIN
  UPDATE `sustav_korisnici_login`
  SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = NEW.`id_korisnik`)
  WHERE `id_korisnik` = NEW.`id_korisnik`;
END//
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
END//
CREATE TRIGGER `tr_sustav_korisnici_ad_broj_duznosti` AFTER DELETE ON `sustav_korisnici` FOR EACH ROW
BEGIN
  UPDATE `sustav_korisnici_login`
  SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = OLD.`id_korisnik`)
  WHERE `id_korisnik` = OLD.`id_korisnik`;
END//
DELIMITER ;
