# Công việc phối hợp, báo cáo và ngoại tuyến — 05/11/2026

Các thay đổi nằm trong frontend `.next-work-release-20261105-coordination-ui` và backend `dist-work-release-20261105-coordination`. Không build đè thư mục đang phục vụ. Dùng `scripts/select-coordination-release.cjs --check` để kiểm tra, `--migrate` để cập nhật schema bổ sung, rồi dừng dịch vụ quản lý trước `--activate`. Quy trình này giữ cấu hình và thư mục minh chứng hiện tại, không bật tích hợp ngoài.

## Các chức năng

| Chức năng | Vị trí và giới hạn |
|---|---|
| Ủy quyền duyệt | Công việc → Ủy quyền; tối đa 90 ngày, kiểm tra vai trò/khoa hiện tại; không tự duyệt hoặc gộp hai cấp vào một người |
| Chuyển/trả và bàn giao | Chi tiết việc và Công việc → Bàn giao; chuyển có lý do, bàn giao tối đa 200 việc chỉ áp dụng nguyên tử khi người nhận xác nhận |
| Ước lượng/thời gian/phối hợp | Chi tiết việc; một timer đang chạy/người, chặn đo quá 12 giờ mỗi lượt; tối đa 20 người phối hợp đủ quyền; người chính chịu trách nhiệm và được tính KPI |
| Duyệt nhiều cấp | Tối đa 5 người duyệt độc lập; chưa hoàn thành khi còn cấp tiếp theo; từ chối rồi nộp lại bắt đầu từ cấp đầu |
| Checklist số và ký | Nhập số có giới hạn và ký xác nhận bằng tài khoản; đây là xác nhận nội bộ, không phải chữ ký số CA |
| Bình luận và thông báo | Chi tiết việc, @mention chọn người có quyền; tùy chọn nhắc hạn/mention/bàn giao/duyệt ở trang Thông báo |
| KPI quý/năm | Cùng phạm vi và cơ chế chốt bất biến như kỳ hiện có |
| Dashboard theo vai trò | Tổng quan theo toàn bộ phạm vi hiện tại, độc lập bộ lọc thời gian của bảng việc; có xu hướng hoàn thành 7 ngày |
| Phiên và tìm kiếm | Tài khoản → Phiên khác; thu hồi cả tin cậy thiết bị gắn với phiên. Tìm kiếm đầu trang và `/workflow/search`, kiểm tra quyền ở server |
| Báo cáo tùy chỉnh | Giao ban → Mẫu & lịch gửi; chỉ admin. Chọn/kéo thứ tự cột, lọc phạm vi/trạng thái/ưu tiên; xem trước 100 dòng/trang, Excel tối đa 10.000 dòng |
| Gửi theo lịch | Gửi kỳ đã kết thúc vào đầu kỳ tiếp theo, giờ Việt Nam; người tạo/người nhận phải còn là admin đang hoạt động; lịch mới mặc định tắt |
| Ngoại tuyến | Công việc → Làm việc ngoại tuyến; chính sách bên dưới |
| Sao lưu/khôi phục thử | Quản lý → Sao lưu & vận hành; worker riêng, chi tiết bên dưới |

## Ngoại tuyến trên thiết bị cá nhân

Người dùng chủ động xác nhận thiết bị cá nhân có khóa màn hình. Lưu tối đa 50 việc mình thực hiện/phối hợp, chỉ giữ thông tin vận hành tối thiểu. Không lưu danh bạ, bình luận, file minh chứng, giá trị số/chữ ký hay token đăng nhập. Bản chụp có chứng thực riêng chỉ hợp lệ với tài khoản đã tạo, không dùng làm access token.

Dữ liệu IndexedDB được mã hóa AES-GCM 256 bit, khóa dẫn xuất PBKDF2-HMAC-SHA256 với 600.000 vòng và salt ngẫu nhiên. Mật khẩu ngoại tuyến riêng từ 12 ký tự, không gửi lên server hoặc lưu trong trình duyệt. Khóa giải mã chỉ ở bộ nhớ khi mở. Tự khóa sau 10 phút không thao tác; bản lưu hết hạn sau 24 giờ và bị xóa khi ứng dụng dùng lại/kiểm tra hạn. Không hứa xóa ngay trên thiết bị đã đóng hoặc mất kết nối. Đăng xuất chủ động/quên thiết bị xóa bản lưu; thao tác xóa phát tín hiệu các tab và khóa thế hệ ngăn tab cũ lưu hồi lại.

Chỉ sửa dấu chọn thông thường. Số liệu, ký xác nhận, duyệt và công việc khóa phải xử lý trực tuyến. Chưa đồng bộ không được tính KPI; thời điểm hoàn thành là lúc server nhận hợp lệ. Người dùng bấm đồng bộ khi có mạng, phải đăng nhập đúng tài khoản. Backend kiểm tra lại quyền, tokenVersion, người phối hợp, trạng thái, điều kiện phụ thuộc và bản chụp. Có xung đột thì giữ bản nháp để so sánh, không tự ghi đè. Không tự gửi lại thao tác lỗi 429 hoặc ghi đè sau mất quyền.

Service worker chỉ cache bốn file tĩnh `offline.html`, `offline.css`, `offline-app.js`, `offline-vault.js`. Không cache API, HTML tài khoản hay HTML Next riêng. CSP riêng của trang ngoại tuyến cho phép module cùng nguồn, không dùng inline script. Thiết bị phải tin cậy chứng chỉ HTTPS để Chrome cài service worker; bỏ qua cảnh báo khi điều hướng không bảo đảm cài được.

## Gửi báo cáo

`REPORT_BUILDER_ENABLED=true` bật API/giao diện. `REPORT_AUTOMATION_ENABLED=true` bật worker mỗi phút; không tự tạo người nhận hoặc bật lịch. Hàng đợi MySQL có khóa nhận việc, lease và tối đa 3 lần thử, cách lần lỗi truyền tải 10 phút. Kiểm tra quyền và phiên bản lịch/mẫu trước từng người nhận. File Excel tối đa 8 MiB. Không dùng email nhập tự do; chỉ chọn tài khoản admin hiện có.

Nếu tiến trình chết ngay sau SMTP nhận thư nhưng trước khi lưu trạng thái, thư có thể được gửi lại. Message-ID cố định giúp đối chiếu nhưng không cam kết SMTP gửi đúng một lần. Việc sửa mẫu/lịch hủy job cũ không còn khớp phiên bản. Nếu máy tắt qua nhiều kỳ, không tự gửi dồn tất cả kỳ đã lỡ.

## Sao lưu mã hóa và kiểm tra khôi phục

`BACKUP_MANAGEMENT_ENABLED=true` bật trang quản trị và hàng đợi. Thực thi chỉ khi worker riêng được cấu hình và `BACKUP_AUTOMATION_ENABLED=true`. Khởi chạy worker bằng `node scripts/backup-worker.cjs --env=<private-file>` trong backend; `--once` xử lý một lượt. Launcher LAN chỉ khởi chạy worker nếu có `deploy/.runtime/backup.env` bật cờ. Không truyền mật khẩu vào dòng lệnh.

Worker cần cấu hình DB, `TASK_EVIDENCE_STORAGE_DIR`, `CAREOPS_BACKUP_DIR` tuyệt đối ngoài public và `CAREOPS_BACKUP_KEY_FILE` tuyệt đối, file nhị phân đúng 32 byte nằm ngoài thư mục bản sao. Giữ khóa riêng, giới hạn ACL theo tài khoản vận hành; sao lưu khóa an toàn trên nơi khác. Không thay khóa tùy tiện vì sẽ không đọc được bản cũ. Không lưu khóa trong Git hoặc tải qua API. Bản sao trên cùng máy không thay thế bản sao ngoài máy.

Bản sao logic chứa schema/dữ liệu bảng InnoDB trong consistent snapshot và file minh chứng được tham chiếu, gzip rồi mã hóa AES-GCM. Từ chối bảng không giao dịch, bảng không có khóa chính, view/trigger/routine/event thay vì âm thầm bỏ qua. Giới hạn 2 triệu dòng và file mã hóa 2 GiB. Redis phiên đăng nhập không nằm trong bản này; sau khôi phục thật cần thu hồi phiên và xử lý cấu hình bí mật riêng.

Khôi phục thử xác thực toàn bộ file trước khi chạy DDL, tạo schema/tài khoản tạm ngẫu nhiên, tài khoản chỉ có quyền trong schema đó; không import bằng tài khoản toàn quyền. Khôi phục bản số/nhị phân/ngày/cột tính toán, kiểm tra hash/số dòng, CHECK TABLE, khóa ngoại và file minh chứng, rồi dọn schema/tài khoản/thư mục riêng. Tài khoản worker cần đủ quyền tạo/xóa schema thử và cấp quyền tài khoản tạm; API HTTP không thực thi câu lệnh tùy ý hay nhận đường dẫn từ người dùng. Không có nút khôi phục ghi đè production.

Lịch hằng ngày mặc định tắt, giữ 30 ngày và ít nhất 3 bản đã kiểm chứng. Bản chưa kiểm chứng không tự bị xóa. Trang hiển thị mã lỗi/tổng số, không hiển thị dữ liệu, mật khẩu hay file khóa.

**Cập nhật 06/11:** đã phục hồi sâu quyền lịch sử, cả 7 bảng phân quyền CHECK OK. Bản sao database CareOps mã hóa đã được phục hồi thực trên MariaDB độc lập: 50 bảng, 135 dòng. Worker sao lưu tự động vẫn tắt. Không mở rộng ACL của snapshot bảo vệ; không thay quyền bằng dữ liệu mẫu. Xem [biên nhận phục hồi](MYSQL_DEEP_RECOVERY.md) để biết phạm vi và giới hạn.

## Kiểm tra

- Frontend `npm test`, build riêng; Chrome qua gateway HTTPS giả lập, không SMTP/DB thật.
- Backend `npm test -- --runInBand`; Redis integration chỉ chạy với Redis thử nghiệm riêng.
- `test/fullstack-review.integration.cjs --allow-temporary-schema --env=<private-env>` kiểm tra thêm điều phối, ủy quyền, cộng tác, dashboard, ngoại tuyến, báo cáo và sự cố. Chỉ schema tạm.
- `test/backup.integration.cjs --allow-temporary-schema --env=<isolated-db-env>` tạo dữ liệu giả, sao lưu/khôi phục thực, từ chối file bị sửa và kiểm tra worker đồng thời. Dùng MariaDB kiểm thử riêng nếu server hiện tại chưa đáp ứng quyền.

Tham chiếu: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [MariaDB REPAIR TABLE](https://mariadb.com/docs/server/reference/sql-statements/table-statements/repair-table).
