# Basnana Portal

หน้า Portal แบบ mobile-first สำหรับรวมทางเข้าเว็บแอปของ Basnana โดยมี 7 แอปใน Production และ 8 แอปใน Dev

## Production / Dev

สลับโหมดได้จากปุ่มเหนือรายการแอป ระบบจำโหมดล่าสุดไว้ในเบราว์เซอร์
Production ใช้ URL เว็บจริง ส่วน Dev ใช้ URL ด้านล่าง แอปที่ไม่มี Dev ใช้ URL Production เดิม

| แอป | Production | Dev |
| --- | --- | --- |
| Games | games.basnana.com | bn-games.basnana.com |
| สองที่นั่ง | two-seats.basnana.com | ใช้ Production |
| RouteRao | trip.basnana.com | bn-trip.basnana.com |
| calio | calio.basnana.com | ใช้ Production |
| Portify | portify.basnana.com | ใช้ Production |
| HouseRao | house-rao.basnana.com | bn-house-rao.basnana.com |
| Toolbox | tools.basnana.com | bn-tools.basnana.com |
| Movie | ไม่แสดง | movie.basnana.com |

กำหนด URL Dev ด้วย `data-dev-href` บนลิงก์ใน `index.html` และใช้ `data-dev-only` กับการ์ดที่แสดงเฉพาะ Dev
ปลายทาง Dev ต้องมี Cloudflare Tunnel และแอป Docker ของตัวเองทำงานอยู่

### สถานะเว็บในโหมด Dev

การ์ดตรวจปลายทางจริงผ่าน `/api/status` เมื่อเข้าโหมด Dev และตรวจซ้ำทุก 30 วินาทีขณะที่หน้าเปิดอยู่
แสดงออนไลน์, เข้าไม่ได้พร้อมรหัส HTTP, จำกัดการเข้าถึง หรือ ตรวจสอบไม่ได้เมื่อ API ไม่ตอบกลับ
ตรวจเฉพาะ URL ที่กำหนดไว้ใน `lib/status-check.mjs` ไม่รับ URL จากผู้เรียก และไม่ติดตาม redirect ไป origin อื่น
แอปที่ใช้ Production เป็น fallback จะตรวจ URL Production นั้นจริง

Vercel ใช้ `api/status.mjs` ส่วน Docker ใช้ service `status` และ Nginx proxy ผ่านพอร์ต 2022 เดิม
คำสั่ง `docker compose up --build -d portal` จะ build/start service ที่จำเป็นให้ด้วย

ทดสอบระบบตรวจสถานะ:

```bash
node --test tests/status-check.test.mjs
```

### ไอคอนบนหน้าจอ Home

ไอคอน Portal มีต้นฉบับ SVG ที่ `public/assets/icons/portal-v2.svg` และ PNG ขนาด 180, 192, 512 พิกเซล
รองรับ Apple Touch Icon ที่ `/apple-touch-icon.png` และ Web App Manifest ที่ `/manifest.webmanifest`
หาก iPhone ยังใช้ไอคอนตัวอักษรเก่า ให้ลบทางลัดเดิมแล้วเพิ่มหน้าเว็บลง Home Screen ใหม่ผ่าน Safari

## First-time setup

สร้างไฟล์ `.env` จากตัวอย่าง แล้วใส่ Cloudflare Tunnel token จริง:

```bash
cp .env.example .env
```

```dotenv
CLOUDFLARE_TUNNEL_TOKEN=your_real_token
```

จากนั้น Build และเริ่ม Portal กับ Tunnel:

```bash
docker compose up --build -d
```

เปิด <http://localhost:2022>

ทั้ง `basnana-portal` และ `basnana-cloudflared` ใช้ restart policy แบบ `always`
จึงเริ่มกลับมาเองเมื่อ Docker daemon ทำงานหลังเปิดเครื่องใหม่

บน macOS ให้เปิด Docker Desktop แล้วเปิดการตั้งค่า:

`Settings → General → Start Docker Desktop when you sign in`

ตั้งค่านี้เพียงครั้งเดียว หลังจากนั้นไม่ต้องกด Start container เอง

## Stop

```bash
docker compose down
```

คำสั่งนี้จะนำ container ออก หากต้องการให้เริ่มอัตโนมัติอีกครั้งต้องรัน
`docker compose up --build -d` หนึ่งครั้ง

## Local preview without Docker

```bash
python3 -m http.server 2022
```
# portal
