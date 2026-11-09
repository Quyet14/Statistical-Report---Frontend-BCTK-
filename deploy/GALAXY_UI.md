# Nền thiên hà và màu chữ — 06/11/2026

Frontend hiện tại: `.next-work-release-20261106-smooth`. Tiếp nối bản galaxy bằng [tối ưu thao tác/chuyển trang](UI_PERFORMANCE.md). Giữ build backend và không chạy migration trong bước chuyển giao diện.

- Hành tinh lớn hơn, các dải khí quyển cong chuyển động, bóng vành sao trên bề mặt, ánh sáng phân biệt mặt trước/sau và tia sao mảnh. Nền phía sau bảng giảm cường độ để banner nổi bật và mắt dễ tập trung vào công việc.
- Build, TypeScript, ESLint component đạt. Chrome HTTPS với tài khoản giả xác nhận chuyển động, tạm dừng/ghi nhớ, nền sáng, tương phản banner và không tràn ngang trên 390px. Ảnh xem trước: [desktop](previews/galaxy-desktop.png), [mobile](previews/galaxy-mobile.png).

- Cảnh hành tinh/vành sáng xanh, bụi sao và ánh sáng có chiều sâu xuất hiện rõ trong banner. Nền toàn trang dùng cùng phong cách và ít hạt hơn trên điện thoại.
- Banner dùng xanh đậm, tiêu đề trắng, điểm nhấn cyan, nội dung xanh trắng. Thẻ và bảng làm việc giữ nền sáng/chữ đậm. Ô thống kê có nền riêng để chữ không chìm khi nằm trên vùng sáng của thiên hà.
- Có chế độ chuyển động/tĩnh/nền sáng, nhớ lựa chọn trên trình duyệt. Tôn trọng giảm chuyển động; dừng khi tab ẩn hoặc cảnh ra khỏi viewport. Canvas giới hạn DPR 1.5, giảm số hạt/tần số trên điện thoại.
- Kiểm tra: build thành công, ESLint component nền đạt; Chrome xác nhận chuyển động, tạm dừng, khôi phục lựa chọn, chuyển nền sáng, không tràn ngang 390px và không có lỗi CSP. Tương phản nội dung banner với vùng nền sáng nhất khai báo trong CSS đạt trên 4.5:1.

Gateway hiện tại: `https://192.168.81.178:3443` theo IP Wi-Fi ngày 06/11. Đã đồng bộ Origin/chứng chỉ LAN và xác nhận quy tắc firewall hiện có chỉ cho nginx từ LocalSubnet. Kiểm tra Chrome thật trên trang đăng nhập/CAPTCHA, nút hiện mật khẩu, CSP và trang ngoại tuyến đạt. Đây là kiểm tra frontend chưa đăng nhập, không xác nhận luồng đăng nhập thật.

## Trạng thái MariaDB

**Cập nhật 06/11:** đã phục hồi 3 quyền lịch sử, 7 bảng phân quyền CHECK OK; bản sao mã hóa database đã phục hồi thực trên MySQL độc lập (50 bảng, 135 dòng). Xem [biên nhận phục hồi](MYSQL_DEEP_RECOVERY.md). Những đoạn dưới ghi lại trạng thái trước phục hồi.

Người dùng đã đồng ý xử lý riêng sau kiểm thử độc lập. `mysql.global_priv` đã được dựng lại định nghĩa chỉ mục trên chế độ bootstrap không mở mạng rồi kiểm tra lại bằng MariaDB; CHECK TABLE cuối trả OK, đọc được 4 tài khoản. Bước offline giữ hash dữ liệu; bước REPAIR trong server có cập nhật định dạng/metadata Aria, vì vậy không tuyên bố toàn bộ file cuối giữ cùng hash ban đầu. Các bản sao mã hóa và biên nhận kiểm tra giữ riêng trong `deploy/.runtime`.

Kiểm thử cấp quyền tiếp phát hiện `mysql.db` lỗi CRC dữ liệu. Đã chụp đủ ba file bằng DPAPI theo tài khoản Windows trước thử QUICK. QUICK không vượt qua kiểm tra, nên đã dừng server và trả ba file về snapshot trước thử, đối chiếu hash từng file. Chưa có bản sao lưu MySQL tốt trước lỗi theo xác nhận của người dùng. Không thay bằng bảng phân quyền mẫu hoặc xóa dữ liệu để ép chạy.

**Trước phục hồi ngày 06/11, backend chưa sẵn sàng vì MariaDB không khởi động ổn định.** Trạng thái đó đã được xử lý theo biên nhận ở trên. Sao lưu tự động tiếp tục tắt. Việc build/kiểm tra giao diện dùng backend giả lập độc lập, không thay dữ liệu bệnh viện.
