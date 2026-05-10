-- =========================================================
-- Produkcija: uskladi stupac meni.device s db-schema/vnlh/meni.sql
--
-- Namjena: tip je već obično tinyint(3) unsigned NOT NULL DEFAULT 0; na serveru
--   često nedostaje COMMENT kao u repou — Skeema tada ponovo predlaže MODIFY.
--
-- Pokretanje (cPanel Terminal):
--   mysql -u digital_VnlhClient -p digital_vnlh < ~/public_html/vnlh/sql/vnlh_distribucija_meni_device.sql
--
-- Zahtijeva privilegije ALTER na tablici meni.
-- =========================================================

SET NAMES utf8mb4;

ALTER TABLE `meni`
  MODIFY COLUMN `device` tinyint(3) unsigned NOT NULL DEFAULT 0 COMMENT '0 za sv device, 1 za samo desktop, 2 za samo mobile';
