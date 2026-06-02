ALTER TABLE `zapisnik_sa_radova_eseji` DROP FOREIGN KEY `fk_zsre_eseji`;
ALTER TABLE `zapisnik_sa_radova_eseji` ADD CONSTRAINT `fk_zsre_eseji` FOREIGN KEY (`id_eseja`) REFERENCES `eseji` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
