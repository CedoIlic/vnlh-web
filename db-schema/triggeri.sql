-- =============================================================================
-- Okidači (TRIGGERS) baze vnlh
--
-- NAPOMENA: Skeema NE upravlja okidačima (ni procedurama/funkcijama) — drži samo
-- tablice u db-schema/vnlh/. Ovaj file čuva strukturu okidača radi KOMPLETNOG
-- backupa sheme i primjenjuje se RUČNO na HeidiSQL pri (re)kreiranju baze,
-- NAKON što Skeema kreira tablice.
--
-- Izvor: produkcijski dump prod_20260621_173503 (2026-06-21); `DEFINER` uklonjen
-- (okidač se kreira s trenutnim korisnikom). Ako se okidači promijene u bazi,
-- osvježi ovaj file (npr. iz `SHOW CREATE TRIGGER`).
--
-- 8 okidača:
--   sustav_korisnici       : bi/bu_ensure_login, ai/au/ad_broj_duznosti
--   sustav_sesije_poruke   : trg_poruke_after_insert/update/delete
-- =============================================================================

DELIMITER ;;

-- ── sustav_korisnici: shell-login + broj dužnosti ───────────────────────────

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_bi_ensure_login`;;
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
END;;

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_ai_broj_duznosti`;;
CREATE TRIGGER `tr_sustav_korisnici_ai_broj_duznosti` AFTER INSERT ON `sustav_korisnici` FOR EACH ROW
BEGIN
  UPDATE `sustav_korisnici_login`
  SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = NEW.`id_korisnik`)
  WHERE `id_korisnik` = NEW.`id_korisnik`;
END;;

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_bu_ensure_login`;;
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
END;;

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_au_broj_duznosti`;;
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
END;;

DROP TRIGGER IF EXISTS `tr_sustav_korisnici_ad_broj_duznosti`;;
CREATE TRIGGER `tr_sustav_korisnici_ad_broj_duznosti` AFTER DELETE ON `sustav_korisnici` FOR EACH ROW
BEGIN
  UPDATE `sustav_korisnici_login`
  SET `broj_duznosti` = (SELECT COUNT(*) FROM `sustav_korisnici` `s` WHERE `s`.`id_korisnik` = OLD.`id_korisnik`)
  WHERE `id_korisnik` = OLD.`id_korisnik`;
  DELETE FROM `sustav_korisnici_login`
  WHERE `id_korisnik` = OLD.`id_korisnik`
    AND (SELECT COUNT(*) FROM `sustav_korisnici` `s2` WHERE `s2`.`id_korisnik` = OLD.`id_korisnik`) = 0;
END;;

-- ── sustav_sesije_poruke: indikatori nepročitanih (poruka / chat) ───────────

DROP TRIGGER IF EXISTS `trg_poruke_after_insert`;;
CREATE TRIGGER `trg_poruke_after_insert` AFTER INSERT ON `sustav_sesije_poruke` FOR EACH ROW UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = IF(NEW.status = 'Novo' AND NEW.brisano = 0 AND NEW.tip = 'Poruka', 1, sa.ima_neprocitanih),
       sa.ima_chat_neprocitanih = IF(NEW.status = 'Novo' AND NEW.brisano = 0 AND NEW.tip = 'Chat poruka', 1, sa.ima_chat_neprocitanih)
 WHERE sa.id_korisnik = NEW.id_primatelj
   AND sa.status = 'aktivna'
   AND NEW.status = 'Novo'
   AND NEW.brisano = 0;;

DROP TRIGGER IF EXISTS `trg_poruke_after_update`;;
CREATE TRIGGER `trg_poruke_after_update` AFTER UPDATE ON `sustav_sesije_poruke` FOR EACH ROW UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = IF(
         OLD.status = 'Novo'
         AND (NEW.status <> 'Novo' OR (OLD.brisano = 0 AND NEW.brisano = 1))
         AND OLD.tip = 'Poruka'
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = NEW.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Poruka'
         ),
         0,
         sa.ima_neprocitanih
       ),
       sa.ima_chat_neprocitanih = IF(
         OLD.tip = 'Chat poruka'
         AND OLD.status = 'Novo'
         AND (NEW.status <> 'Novo' OR (OLD.brisano = 0 AND NEW.brisano = 1))
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = NEW.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Chat poruka'
         ),
         0,
         sa.ima_chat_neprocitanih
       )
 WHERE sa.id_korisnik = NEW.id_primatelj
   AND sa.status = 'aktivna'
   AND OLD.status = 'Novo'
   AND (NEW.status <> 'Novo' OR (OLD.brisano = 0 AND NEW.brisano = 1));;

DROP TRIGGER IF EXISTS `trg_poruke_after_delete`;;
CREATE TRIGGER `trg_poruke_after_delete` AFTER DELETE ON `sustav_sesije_poruke` FOR EACH ROW UPDATE sustav_sesije_aktivne sa
   SET sa.ima_neprocitanih = IF(
         OLD.status = 'Novo'
         AND OLD.tip = 'Poruka'
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = OLD.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Poruka'
         ),
         0,
         sa.ima_neprocitanih
       ),
       sa.ima_chat_neprocitanih = IF(
         OLD.status = 'Novo'
         AND OLD.tip = 'Chat poruka'
         AND NOT EXISTS (
             SELECT 1 FROM sustav_sesije_poruke sp
              WHERE sp.id_primatelj = OLD.id_primatelj
                AND sp.status = 'Novo'
                AND sp.brisano = 0
                AND sp.tip = 'Chat poruka'
         ),
         0,
         sa.ima_chat_neprocitanih
       )
 WHERE sa.id_korisnik = OLD.id_primatelj
   AND sa.status = 'aktivna'
   AND OLD.status = 'Novo';;

DELIMITER ;
