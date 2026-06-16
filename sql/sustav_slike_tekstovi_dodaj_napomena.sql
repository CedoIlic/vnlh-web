-- sustav_slike_tekstovi: dodaj napomena (slobodna biljeska administratora).
ALTER TABLE `sustav_slike_tekstovi`
  ADD COLUMN `napomena` varchar(1024) DEFAULT NULL
    COMMENT 'Slobodna bilješka administratora' AFTER `podatak`;
