-- Dodavanje ID-a korisnika koji je čekirao ovjeru, te stupaca upisao / vrijeme_upisa.
-- Sve kolone su nullable; FK na clanovi.id (RESTRICT/CASCADE kao ostali FK-ovi).

ALTER TABLE `zapisnik_sa_radova`
  ADD COLUMN `ovjera_prije_casni_id`   int(11) unsigned DEFAULT NULL COMMENT 'ID člana (clanovi.id) koji je označio ovjeru prije radova — Časni majstor.'
    AFTER `ovjera_prije_casni`,

  ADD COLUMN `ovjera_poslije_casni_id` int(11) unsigned DEFAULT NULL COMMENT 'ID člana (clanovi.id) koji je označio ovjeru nakon radova — Časni majstor.'
    AFTER `ovjera_poslije_casni`,

  ADD COLUMN `ovjera_poslije_tajnik_id` int(11) unsigned DEFAULT NULL COMMENT 'ID člana (clanovi.id) koji je označio ovjeru nakon radova — Tajnik.'
    AFTER `ovjera_poslije_tajnik`,

  ADD COLUMN `ovjera_poslije_govornik_id` int(11) unsigned DEFAULT NULL COMMENT 'ID člana (clanovi.id) koji je označio ovjeru nakon radova — Govornik.'
    AFTER `ovjera_poslije_govornik`,

  ADD COLUMN `upisao`       int(11) unsigned DEFAULT NULL COMMENT 'ID člana (clanovi.id) koji je kreirao zapis.'
    AFTER `zapisnik`,

  ADD COLUMN `vrijeme_upisa` datetime DEFAULT NULL COMMENT 'Datum i vrijeme kreiranja zapisa.'
    AFTER `upisao`,

  ADD KEY `fk_zsr_ovjera_prije_casni_id`    (`ovjera_prije_casni_id`),
  ADD KEY `fk_zsr_ovjera_poslije_casni_id`  (`ovjera_poslije_casni_id`),
  ADD KEY `fk_zsr_ovjera_poslije_tajnik_id` (`ovjera_poslije_tajnik_id`),
  ADD KEY `fk_zsr_ovjera_poslije_govornik_id` (`ovjera_poslije_govornik_id`),
  ADD KEY `fk_zsr_upisao`                  (`upisao`),

  ADD CONSTRAINT `fk_zsr_ovjera_prije_casni_id`
    FOREIGN KEY (`ovjera_prije_casni_id`) REFERENCES `clanovi` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,

  ADD CONSTRAINT `fk_zsr_ovjera_poslije_casni_id`
    FOREIGN KEY (`ovjera_poslije_casni_id`) REFERENCES `clanovi` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,

  ADD CONSTRAINT `fk_zsr_ovjera_poslije_tajnik_id`
    FOREIGN KEY (`ovjera_poslije_tajnik_id`) REFERENCES `clanovi` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,

  ADD CONSTRAINT `fk_zsr_ovjera_poslije_govornik_id`
    FOREIGN KEY (`ovjera_poslije_govornik_id`) REFERENCES `clanovi` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,

  ADD CONSTRAINT `fk_zsr_upisao`
    FOREIGN KEY (`upisao`) REFERENCES `clanovi` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
