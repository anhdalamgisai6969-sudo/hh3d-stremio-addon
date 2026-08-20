# HH3D Stremio Addon

## Cài đặt

```bash
npm install
npm start
```

Sau đó mở:

http://127.0.0.1:7000/manifest.json

Để dùng từ thiết bị khác hoặc Stremio trên điện thoại, addon cần được chạy trên máy chủ có địa chỉ mạng mà Stremio có thể truy cập.

## Lưu ý

Website nguồn có thể thay đổi HTML hoặc cơ chế phát video. Khi đó cần cập nhật selector trong `scraper.js`, đặc biệt là hàm `extractVideoUrl()`.
