ALTER TABLE `zapisnik_boje_u_listi`
  ADD COLUMN `boja_podloge` char(9) DEFAULT NULL COMMENT 'Boja podloge retka (bg, #RRGGBBAA)'
  AFTER `boja`;
