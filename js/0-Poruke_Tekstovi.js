/* ========== PORUKE I TEKSTOVI (0-Poruke_Tekstovi.js)
   Centralno mjesto za poruke modala, labele, captione i ostale tekste – lakši prijevod.
   ========================================================= */

/* --- MODAL – STANDARDNE PORUKE
   Format jedne poruke (delimiter između polja: |):
     id | origin | tipke | stanje | boja_okvira | tekst_poruke

   - id: broj (001, 002, …); rasponi: 1–99 UI, 100–199 Server, 200–299 SQL.
   - origin: tekst za header (npr. "Korisničko sučelje", "Poslužitelj", "Baza podataka").
   - tipke: jedna ili više, delimiter , ; default tipka u zagradama npr. "Yes, No, (Cancel)".
     Prazno = nema tipki → koristi se token za automatsko zatvaranje (ms).
   - stanje: ok | error | forbidden | information | warning. Prazno = information.
   - boja_okvira: prazno = token; ako postoji boja podloge slike, okvir ima istu boju.
   - tekst_poruke: placeholderi #1, #2, #3 zamjenjuju se tekstom koji se dostavi kontroli.
     Prazno = placeholder "—".

   Ako je polje za sliku prazno, cijela površina tijela za poruku (bez lijevog stupca).
   Caption tipki: OK=OK, Yes=Da, No=Ne, Cancel=Odustani (vidi MODAL_BUTTON_CAPTIONS).
   --- */

var MODAL_BUTTON_CAPTIONS = {
  OK: 'OK',
  Yes: 'Da',
  No: 'Ne',
  Cancel: 'Odustani'
};

var MODAL_MESSAGES = {
  '001': '001|Korisničko sučelje||ok||Novi slog je uspješno dodan u bazu.',   /* Bez tipki (auto-close), stanje ok */
  '002': '002|Korisničko sučelje|(OK)|error||Upisani podatak već postoji. #1',   /* Duplikat – greška; #1 = labela polja */
  '003': '003|Korisničko sučelje||ok||Označeni slog je uspješno obrisan.',   /* Uspjeh brisanja, auto-close */
  '004': '004|Korisničko sučelje||ok||Označeni slog je uspješno izmijenjen.',   /* Uspjeh izmjene */
  '005': '005|Korisničko sučelje|(OK)|error||Ako je upisan HTML fajl mora biti upisana i referenca.',   /* HTML fajl bez reference */
  '006': '006|Korisničko sučelje|(OK)|error||Naziv stranice mora završavati s .html ili .php (npr. Clanovi_CRUD.html ili index.php).',   /* bez ispravnog nastavka */
  '007': '007|Korisničko sučelje|(OK)|error||Prekoračen omjer. Dozvoljen je maksimalan omjer stranica 5:1 ili 1:5.',   /* Omjer stranica slike prekoračen */
  '008': '008|Korisničko sučelje|(OK)|error||Naziv stupnja mora biti upisan.',   /* Validacija – naziv stupnja prazan */
  '009': '009|Korisničko sučelje|(OK)|error||Broj stupnja mora biti upisan.',   /* Validacija – stupanj prazan */
  '010': '010|Korisničko sučelje|(OK)|error||Broj stupnja mora biti između 1 i 99.',   /* Validacija – stupanj izvan 1–99 */
  '011': '011|Korisničko sučelje|(OK)|error||Dozvoljeno je učitavanje samo jpg ili png formata slike.',   /* Format slike u obradi – nije jpg/png */
  '012': '012|Korisničko sučelje|(OK)|error||Prije dodavanja pripadajućih stupnjeva potrebno je dodati obred kojem stupanj pripada.',
  '013': '013|Korisničko sučelje|(OK)|information||Kod jedinog reda tip se ne može isključiti. Tip se može samo prebaciti na drugi red.',   /* Tip CRUD (Telefoni/Adrese/Email): isključivanje Tip checkboxa kada postoji samo jedan red nije dozvoljeno */
  '014': '014|Korisničko sučelje|(OK)|error||Dozvoljen raspon od #1 do #2.',
  '015': '015|Korisničko sučelje|(OK)|error||Dodavanje stupnjeva je moguće samo na slogu koji je već upisan u bazu. Najprije upiši slog, selektiraj ga u tablici pa onda dodaj stupnjeve.',
  '016': '016|Korisničko sučelje|(OK)|error||Prije dodavanja regije potrebno je dodati bar jednu državu kojoj regija pripada.',
  '017': '017|Korisničko sučelje|(OK)|error||Naziv lože mora biti upisan. Upišite naziv lože.',   /* Validacija Loze_CRUD: naziv lože prazan */
  '018': '018|Korisničko sučelje|(OK)|error||Upišite ispravan broj telefona, + pozivni broj zemlje + broj telefona.',   /* Validacija Loze_CRUD: telefon upisan ali ne počinje sa + */
  '019': '019|Korisničko sučelje|(OK)|error||Upišite ispravnu e-mail adresu.',   /* Validacija Loze_CRUD: e-mail upisan ali format nije ispravan */
  '020': '020|Korisničko sučelje|(OK)|error||Loža pod navedenim imenom već postoji u ovoj regiji.',   /* Validacija Loze_CRUD: duplikat naziva (case-insensitive) */
  '021': '021|Korisničko sučelje|(OK)|error||Prije učitavanja Excel tablica potrebno je izabrati mapu u kojoj se tablice nalaze, koristi ikonu za izbor staze.',   /* Transfer Excel: folder nije izabran prije punjenja tablice ili File System Access API nije podržan */
  '022': '022|Korisničko sučelje|(OK)|error||Prije učitavanja podataka iz excel tablica potrebno je postaviti početni red i kolonu podataka, po potrebi isključene kolone te odabrati mapu u kojoj se nalaze slike..',   /* Transfer Excel: 1. faza – nije postavljen folder slika, početna kolona ili početni red prije učitavanja rezultata */
  '023': '023|Korisničko sučelje|OK,(Cancel)|warning||Ovaj korisnik ima vezane podatke, to mogu biti adresa, telefoni, meil adrese ili napredovanja. Svi eventualno postojeći podaci biti će nepovratno izgubljeni. Jesi li siguran da želiš brisati korisnika?',  /* Clanovi_CRUD brisanje: upozorenje kad član ima vezane podatke (adrese, telefoni, e_maili, napredovanja); tipke OK i Odustani, default Odustani */
  '024': '024|Korisničko sučelje|(OK)|error||Stupanj koji želite upisati ovaj član već posjeduje, ne može se dva puta upisati isti stupanj.',  /* Napredovanja_CRUD upis/zamjena: stupanj već postoji u desnoj tablici za člana */
  '025': '025|Korisničko sučelje|(OK)|error||Lozinka nije ispravna.',   /* Login obvezna promjena lozinke: validacija ili nepodudaranje */
  '026': '026|Korisničko sučelje|(OK)|information||Korisnik je blokiran.',   /* Login: blokada (pass_status=2) ili pet neuspjelih pokušaja */
  '027': '027|Korisničko sučelje|(OK)|error||Izmijenite korisničko ime, ovo nije dozvoljeno.',   /* Login promjena lozinke: novo korisničko ime već postoji u bazi */
  '100': '100|Poruka servera|(OK)|error||Nije moguće povezivanje sa bazom podataka.',   /* Greška konekcije (00_db.php) */
  '101': '101|Poruka servera|(OK)|error||Neočekivani odgovor poslužitelja. Pokušajte ponovno.',   /* Nepoznat kod odgovora (npr. PHP greška) */
  '105': '105|Poruka servera|(OK)|error||Podaci poslani na upis nisu ispravni.',         /* Nevaljani ulaz (npr. id <= 0) */
  '106': '106|Poruka SQL baze|(OK)|error||Redak nije dozvoljeno brisati zbog postojećih povezanih podataka, kod greške: #1',  /* FK pri brisanju; #1 = sql kod */
  '107': '107|Poruka SQL baze|(OK)|error||Redak nije moguće izmjeniti jer postoje povezani podatci, kod greške: #1',     /* FK pri izmjeni; #1 = sql kod */
  '108': '108|Poruka SQL baze|(OK)|error||ID retka nije ispravan, #1, ne mogu dohvatiti podatke.',   /* ID retka nevaljan ili red ne postoji pri dohvatu (npr. slika); #1 = id */
  '109': '109|Poruka SQL baze|(OK)|error||Podatak koji ste htjeli upisati već postoji u bazi podataka.',   /* 1062 Duplicate entry */
  '110': '110|Poruka SQL baze|(OK)|information||Predlagač koji je odabran ne postoji više u bazi, nije upisan.',   /* Predlagač ne postoji u bazi. */
  '111': '111|Poruka SQL baze|(OK)|error||Ne postoji telefon u listi tipova telefona sa čekiranim tipom, unos prekinut.',   /* Ne postoji čekiran tip telefona. */
  '112': '112|Poruka SQL baze|(OK)|error||Ne postoji email u listi tipova emaila sa čekiranim tipom, unos prekinut.',        /* Ne postoji čekiran tip e-maila. */
  '113': '113|Poruka SQL baze|(OK)|error||Ne postoji adresa u listi tipova adresa sa čekiranim tipom, unos prekinut.',       /* Ne postoji čekiran tip adrese. */
  '114': '114|Poruka SQL baze|(OK)|error||Iskaznica sa ovim brojem već postoji. Dozvoljen je samo jedan isti broj iskaznice u državi.', /* Duplikat šifre iskaznice. */
  '115': '115|Poruka SQL baze|(OK)|error||Prezime mora biti upisano.',                                                       /* Prezime obavezno. */
  '116': '116|Poruka SQL baze|(OK)|error||Upis bez šifre dozvoljen samo za kandidata.',                                     /* Šifra obavezna osim za kandidata. */
  '117': '117|Poruka SQL baze|(OK)|error||Ne može se dohvatiti država u kojoj je loža formirana, upis ili izmjena podataka nisu mogući.',  /* Clanovi: id_drzava iz loze obavezan; ako loza nema državu → 117, prekid transakcije */
  '118': '118|Korisničko sučelje|(OK)|error||U ovoj formi nesmije se duplirati ID polje.',   /* Clanovi_Zastavice_CRUD: duplikat ID pri upisu */
  '119': '119|Korisničko sučelje|(OK)|error||U polju ID nije dozvoljena vrijednost 0. Dozvoljeni su brojevi od 1 do 16.',   /* Clanovi_Zastavice_CRUD: 0 ili nevažeći ID */
  '120': '120|Korisničko sučelje|(OK)|error||Greška u dohvatu varijabli sustava iz baze. Konzultiraj administratora za nastavak.',   /* common_sustav_varijable: tablica/red/sadržaj nije u redu */
  '121': '121|Korisničko sučelje|(OK)|error||Funkcija nije implementirana.',   /* Izbor dužnosnika – funkcija nije implementirana */
  '122': '122|Korisničko sučelje|OK,(Cancel)|warning||Jesi li siguran da želiš izbrisati sva prava koja ima ovaj dužnosnik?',   /* Duznosnici_Prava_CRUD Izbriši: upozorenje prije brisanja svih prava; tipke OK i Odustani, default Odustani */
  '123': '123|Korisničko sučelje|OK,(Cancel)|warning||Brisanje dužnosti ujedno će obrisati vezana prava i ograničenja. Ako je ovo bila jedina dužnost nekog korisnika biti će obrisani i njegovi login podaci, jesi li siguran da želiš brisati dužnosnika?',   /* Duznosnici_CRUD Izbriši: kaskada (prava, ograničenja, veze korisnik–dužnost, login ako jedina dužnost); OK / Odustani, default Odustani */
  '124': '124|Korisničko sučelje|OK,(Cancel)|warning||Jesi li siguran da želiš obrisati ovog člana?',   /* Clanovi_CRUD / Clanovi_Loza_CRUD Izbriši: opća potvrda kad nema vezanih slogova u adrese/telefoni/e_maili/napredovanja (023 se prikazuje kad ima); OK / Odustani, default Odustani */
  '154': '154|Baza podataka|(OK)|error||Shema tablica za ovu formu nije ažurna (nedostaje stupac, npr. redosljed). Pokreni u bazi sql/sustav_odgovori_razvoja_dodaj_redosljed_obje_tablice.sql (ili pojedinačno *_boje_* i *_poruke_*), zatim osvježi stranicu.',
  '155': '155|Odgovori razvoja|(OK)|error||Tekst predloška ne smije sadržavati znak „#“ (korišten je u formatu odgovora).',
  '156': '156|Odgovori razvoja||ok||Svi odgovori su uklonjeni; poruka je snimljena bez sufiksnih odgovora.',   /* Gumb „Ukloni sve odgovore“: očisti #kod*tekst# i UPDATE polja poruka */
  '200': '200|Poruka SQL baze|(OK)|error||Greška SQL baze podataka, kod: #1'             /* SQL greška; #1 = sql kod(ovi) */
};
