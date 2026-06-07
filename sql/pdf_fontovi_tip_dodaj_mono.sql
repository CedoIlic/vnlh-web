-- pdf_fontovi.tip: dodaj 'mono' (monospace) u enum.
ALTER TABLE `pdf_fontovi`
  MODIFY COLUMN `tip` enum('serif','sans','mono') NOT NULL
  COMMENT 'Kategorija fonta: serif, sans-serif ili monospace';
