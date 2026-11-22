# Museum Malam: Mahkota Firaun

![Kompetisi](https://make.fun/badge/best-heist-game-20261122-0559.svg)
![Peringkat](https://make.fun/badge/best-heist-game-20261122-0559/gta6scam/museum-malam-heist/rank.svg)
![Hadiah](https://make.fun/badge/best-heist-game-20261122-0559/gta6scam/museum-malam-heist/reward.svg)

Game heist 3D (Three.js) di museum tengah malam. Kamu pencuri yang menyelinap
melewati aula marmer berkarpet merah: hindari kerucut visi 4 satpam museum dan
seekor anjing K-9, lewati sapuan 2 kamera CCTV dan sorot lampu panggung, curi
3 artefak — **Mahkota Firaun**, **Topeng Emas Anubis**, **Prasasti Batu Nil** —
lalu kabur lewat pintu EXIT selatan sebelum alarm penuh.

## Cara main

- **WASD / panah** — bergerak; **Shift** — mengendap (lebih pelan, lebih sulit terlihat)
- **E** — ambil artefak di dekat pedestal
- **Q** — lempar koin pengalih (3x): penjaga dan anjing memeriksa bunyinya
- **M** — suara hidup/mati; **P** — jeda; **R / Enter** — mulai & ulang

## Aturan

- **Menang:** 3/3 artefak + sampai EXIT. **Kalah:** ketahuan 3 kali.
- Meter **alarm** naik saat terlihat penjaga atau kamera, turun saat sembunyi —
  dua kali lebih cepat di sudut gelap. Lampu sorot panggung membuatmu lebih
  mudah terlihat.
- Penjaga berpatroli → curiga (?) → mengejar (!) → mencari → kembali patroli.
  Kerucut kuning = patroli, oranye = curiga, merah = mengejar.
- Etalase kaca dan pilar marmer menghalangi pandangan — pakai sebagai cover.
- Skor + grade (S/A/B/C) dari waktu, jumlah ketahuan, dan loot.

## Cerita

Tengah malam, museum sepi. Di Ruang Firaun, mahkota emas berkilau di bawah sorot
lampu — dijaga satpam Rudi, Sari, Budi, Dewi, dan anjing K-9 Rex. Satu pencuri,
satu tas kosong, dan fajar yang semakin dekat.

## Teknologi

- Three.js 0.160.0 (vendored di `game/vendor/three.min.js`)
- Tanpa build step, tanpa request jaringan: semua file statis di `game/`
- Suara WebAudio synth sendiri (langkah, loot, alarm, ambient) — tanpa file audio
- Autopilot memainkan aturan asli sampai menang (grade + statistik asli)

## Jalankan lokal

```sh
python3 -m http.server
# buka http://localhost:8000/game/index.html
```

## Tangkapan layar

- `screenshots/1-cover.jpg` — klimaks mid-heist (pencuri + penjaga + kerucut + CCTV + loot + alarm dalam satu frame)
- `screenshots/2-title.jpg` — layar judul
- `screenshots/3-play.jpg` — permainan
- `screenshots/4-end.jpg` — layar kemenangan autopilot (grade + statistik asli)
