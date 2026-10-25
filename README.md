# ExamGen Dashboard

Dashboard giao diện hiện đại cho hệ thống sinh đề thi theo ma trận, sử dụng HTML, Bootstrap 5, CSS, JavaScript, Node.js/Express và MySQL.

## 1. Yêu cầu
- Node.js 18 trở lên
- MySQL 8 trở lên
- CSDL `quan_ly_ngan_hang_cau_hoi` đã được tạo từ file SQL của dự án

## 2. Cài đặt
Mở terminal tại thư mục `ExamGenDashboard`:

```bash
npm install
```

Tạo file `.env` bằng cách sao chép `.env.example`, sau đó điền mật khẩu MySQL đúng trên máy của bạn:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=mat_khau_mysql_cua_ban
DB_NAME=quan_ly_ngan_hang_cau_hoi
```

Không để dấu nháy quanh giá trị và không đưa `.env` lên GitHub.

## 3. Khởi chạy
```bash
npm run dev
```
Hoặc:
```bash
npm start
```
Mở trình duyệt tại `http://localhost:3000`.

## 4. Kiểm tra kết nối
- `http://localhost:3000/api/health`: kiểm tra server Node.js.
- `http://localhost:3000/api/dashboard/stats`: lấy dữ liệu thống kê dashboard từ MySQL.

## 5. Cấu trúc thư mục
```text
ExamGenDashboard/
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/dashboard.js
├── routes/dashboard.js
├── db.js
├── server.js
├── package.json
├── .env.example
└── README.md
```

## 6. Các bảng đang được dùng
- `cau_hoi`: tổng số câu hỏi và phân bố theo `muc_do_kho`, `dang_cau_hoi`.
- `hoc_phan`: số học phần đang hoạt động.
- `ma_tran_de`, `chi_tiet_ma_tran`: số ma trận và cảnh báo tổng số câu trong ma trận không khớp.
- `de_thi`, `cau_hoi_trong_de`: đề thi gần đây và số câu mỗi đề.

Tên bảng/cột dựa trên file SQL người dùng cung cấp. Nếu gặp lỗi `Unknown column` hoặc `Table doesn't exist`, hãy kiểm tra đã import đúng file SQL vào đúng database hay chưa.

## Lưu ý
Đây là bước đầu gồm dashboard và API thống kê thật từ MySQL. Các liên kết sidebar ngoài Tổng quan đang là chỗ giữ chỗ giao diện; màn hình Ngân hàng câu hỏi, Ma trận, Sinh đề, Quản lý đề và đăng nhập/phân quyền sẽ được triển khai tiếp theo. Đăng nhập và bảo mật quyền truy cập chưa được bật ở bản dashboard đầu tiên.
