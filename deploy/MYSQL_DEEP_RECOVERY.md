# Phục hồi MariaDB — 06/11/2026

Đã phục hồi bảng phân quyền từ dữ liệu lịch sử, không thay quyền bằng bảng mẫu XAMPP. MariaDB nhận truy vấn bình thường; kiểm tra lại sau khi tiến trình máy chủ thay đổi vẫn đạt.

- Bốn file `db.MAD-*.BAK` được kiểm tra trên MariaDB độc lập đều cho cùng 3 bản ghi quyền. Bản gần nhất dùng để phục hồi là `db.MAD-261002082922.BAK`. SHA-256 của nội dung logic: `d28591c639d5fc6d7814adbb27abd42708376699eb343958684e424018a67647`.
- Các file hỏng ban đầu được giữ lại với hậu tố `careops-before-deep-*`; snapshot hệ thống mã hóa vẫn giữ riêng. Không mở rộng ACL của bản sao được bảo vệ và không thay tài khoản/mật khẩu nghiệp vụ.
- `CHECK TABLE` cuối cho cả 7 bảng phân quyền đều OK; đọc được 4 tài khoản MySQL và 50 bảng CareOps. Đối chiếu ba quyền phục hồi khớp hoàn toàn dữ liệu lịch sử.
- Đã sửa chỉ mục các bảng quyền phụ, đối chiếu nội dung trước/sau. Có bảng rỗng cần REPAIR đầy đủ sau khi QUICK không giải quyết được bitmap; dữ liệu logic vẫn giữ nguyên.
- Đã tạo bản sao thủ công của database CareOps: SQL được nén và mã hóa AES-256-GCM trực tiếp trong luồng, khóa bảo vệ bằng Windows DPAPI CurrentUser. Không ghi SQL rõ ra đĩa. Phục hồi thực trên MySQL độc lập thành công: 50 bảng, 135 dòng, CHECK TABLE đạt. Snapshot này không có ràng buộc khóa ngoại khai báo; không diễn giải số kiểm tra khóa ngoại bằng 0 là đã kiểm thử toàn vẹn quan hệ nghiệp vụ.
- Integration backup với dữ liệu giả đạt: phục hồi bằng tài khoản giới hạn, số/nhị phân/ngày/cột tính toán, khóa ngoại, minh chứng, từ chối bản bị sửa và dọn schema thử.

Biên nhận và bản sao ở `deploy/.runtime` (không đưa vào Git): `mysql-deep-recovery-verified.json`, `recovery-backup-restore-verification.json`, `latest-recovery-backup.json`. Khóa DPAPI phụ thuộc tài khoản và hồ sơ Windows hiện tại; bản sao tại máy chưa thay thế backup ngoài máy.

Đã quan sát nội dung log lẫn trong các file Aria hỏng. MariaDB Windows cũ được cấu hình `console=1`; launcher phục hồi ghi stdout/stderr ra ngoài thư mục dữ liệu. Đây là biện pháp tránh đường ghi log có vấn đề, chưa phải kết luận đầy đủ về nguyên nhân gốc. Không sửa database `emrhuunghi` khác đang có cảnh báo tablespace.

Sao lưu tự động vẫn tắt; snapshot thủ công này chỉ gồm database, chưa bao gồm thư mục minh chứng. SMTP thật và đăng nhập OTP bằng tài khoản thật chưa được xác minh trong đợt phục hồi. Các tích hợp ngoài vẫn tắt theo yêu cầu.
