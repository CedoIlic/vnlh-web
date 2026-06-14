-- pdf_slika_stil: dodaj "sloj" (z-redoslijed slike u odnosu na sadrzaj).
-- ispod = slika iza sadrzaja (npr. vodeni zig); iznad = slika ispred sadrzaja.
-- Bitno kod lebdecih/apsolutnih slika (potiskuje=0 ili pozicioniranje=apsolutno).
ALTER TABLE `pdf_slika_stil`
  ADD COLUMN `sloj` enum('ispod','iznad') NOT NULL DEFAULT 'iznad'
    COMMENT 'Sloj slike u odnosu na sadrzaj: ispod (iza, vodeni zig) ili iznad (ispred); bitno kod lebdecih/apsolutnih slika'
    AFTER `potiskuje`;
