CREATE TABLE `zapisnik_sa_radova_eseji` (
  `id_radova` int(11) unsigned NOT NULL COMMENT 'ID radova na kojima je esej čitan (veza na zapisnik_sa_radova.id).',
  `id_eseja`  int(11) unsigned NOT NULL COMMENT 'ID eseja koji je čitan (veza na eseji.id).',
  PRIMARY KEY (`id_radova`, `id_eseja`),
  KEY `fk_zsre_eseji` (`id_eseja`),
  CONSTRAINT `fk_zsre_zapisnik` FOREIGN KEY (`id_radova`) REFERENCES `zapisnik_sa_radova` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_zsre_eseji`    FOREIGN KEY (`id_eseja`)  REFERENCES `eseji`              (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
