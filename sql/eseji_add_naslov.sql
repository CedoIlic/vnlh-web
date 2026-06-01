ALTER TABLE `eseji`
  ADD COLUMN `naslov_eseja` varchar(2048) DEFAULT NULL COMMENT 'Naslov eseja'
  AFTER `autor`;
