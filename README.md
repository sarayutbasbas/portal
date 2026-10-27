# Basnana Portal

หน้า Portal แบบ mobile-first สำหรับรวมทางเข้าเว็บแอปของ Basnana ทั้ง 6 โปรเจกต์

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
