# Shop Telegram Bot

Bot mua hàng + VietQR + JSONBin

## Chạy local (test)

```bash
cd bot
npm install
node index.js
```

## Deploy lên Railway (khuyên dùng - free)

1. Tạo tài khoản tại [railway.app](https://railway.app)
2. New Project → Deploy from GitHub (hoặc upload folder này)
3. Thêm Environment Variables:
   - `BOT_TOKEN` = token bot của bạn
   - `BIN_ID` = 6b041f24ffd5d16053d776ed
   - `MASTER_KEY` = key JSONBin của bạn
4. Deploy xong bot sẽ chạy 24/7

## Deploy lên Render

1. [render.com](https://render.com) → New → Web Service
2. Upload code hoặc connect GitHub
3. Build Command: `npm install`
4. Start Command: `node index.js`
5. Thêm Environment Variables giống trên
6. Instance Type: Free

## Sau khi bot chạy

1. Mở Telegram → tìm bot của bạn
2. Gửi `/setadmin` (bạn phải là người gửi lệnh này) → bot sẽ lưu chat ID của bạn để nhận thông báo đơn mới
3. Gửi `/shop` để test mua hàng

## Admin HTML

Mở file `admin.html` bằng trình duyệt (double click hoặc Live Server).
Dùng để:
- Thêm / sửa / xóa sản phẩm (có nhiều loại + giá + tồn kho)
- Xem đơn hàng
- Duyệt đơn (trừ kho) khi khách bấm "Đã thanh toán"
