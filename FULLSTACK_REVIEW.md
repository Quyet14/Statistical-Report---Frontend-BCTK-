# Đối chiếu backend/frontend — 05/11/2026

## Cập nhật phục hồi — 06/11/2026

Đã tối ưu thao tác ở bản frontend `.next-work-release-20261106-smooth`: menu chuyển trang trong layout chung, cache vành sao, giới hạn raster/hạt và tạm ngừng nền khi thao tác. Build/TypeScript, 13 test đăng nhập/phân quyền và 2 test Chrome HTTPS đạt. [Chi tiết và giới hạn hiệu năng](deploy/UI_PERFORMANCE.md).

MariaDB đã phục hồi quyền lịch sử: 3 bản ghi từ bốn bản BAK thống nhất; cả 7 bảng phân quyền CHECK OK, 50 bảng CareOps truy cập được. Bản sao database mã hóa đã phục hồi thực trên máy chủ độc lập: 50 bảng, 135 dòng. Sao lưu tự động vẫn tắt. [Chi tiết và giới hạn](deploy/MYSQL_DEEP_RECOVERY.md). Các mục ngày 05/11 bên dưới là lịch sử kiểm tra trước phục hồi.

Nền giao diện ngày 06/11 bổ sung vân khí quyển cong, bóng vành sao và ánh sao chuyển động; bản smooth tiếp nối giữ phong cách này. Gateway đã đồng bộ IP Wi-Fi **https://192.168.81.178:3443**. Kiểm tra Chrome trên gateway thật đạt cho CAPTCHA, hiện mật khẩu, CSP và trang ngoại tuyến; chưa thực hiện đăng nhập/OTP thật. [Giao diện và ảnh xem trước](deploy/GALAXY_UI.md).

## Cập nhật giao diện thiên hà và trạng thái hạ tầng — 05/11/2026

Frontend `.next-work-release-20261105-galaxy` đã chuyển theo IP Wi-Fi `https://192.168.100.4:3443`; build và kiểm tra Chrome desktop/mobile đạt. Tại thời điểm 05/11, backend bị chặn bởi lỗi CRC ở mysql.db; lỗi này đã được phục hồi ngày 06/11 theo biên nhận ở trên. Sao lưu tự động giữ tắt. [Giao diện](deploy/GALAXY_UI.md).


## Bản điều phối và trải nghiệm — 05/11/2026

- Đã triển khai ủy quyền có hạn; chuyển/trả/bàn giao nguyên tử; ước lượng và đo thời gian; nhiều người phối hợp; duyệt tối đa 5 cấp; checklist số và ký xác nhận nội bộ; bình luận/mention; thông báo cá nhân; KPI quý/năm; dashboard theo vai trò; phiên từ xa; tìm kiếm toàn cục; báo cáo tùy chỉnh/lịch gửi; ngoại tuyến mã hóa có xử lý xung đột.
- Nền thiên hà 3D chuyển động có chiều sâu, tạm dừng/tắt và hỗ trợ giảm chuyển động; giữ các mặt thẻ sáng, rõ chữ. Đã kiểm tra bố cục desktop/mobile và sửa ô lý do duyệt trong Kanban hẹp.
- Kiểm tra bản chính: **101 test frontend, 149 test backend (Redis riêng), 39 E2E HTTPS**; integration MySQL riêng đạt cho điều phối/ủy quyền/cộng tác/ngoại tuyến/báo cáo/sự cố. Chưa đăng nhập hoặc gửi OTP/email bằng tài khoản thật trong lượt này.
- Đã áp dụng migration điều phối, cộng tác, sự cố lặp, mẫu/lịch báo cáo và hàng đợi sao lưu; không xóa bản ghi. Frontend cuối: `.next-work-release-20261105-coordination-ui`; backend: `dist-work-release-20261105-coordination`. Gateway theo Wi-Fi hiện tại: **https://192.168.81.178:3443**. Xem [chi tiết bản nâng cấp](deploy/COORDINATION_RELEASE.md).
- Sao lưu mã hóa DB và minh chứng, khôi phục thử thực tế, hash/số dòng/khóa ngoại đã đạt trên MariaDB độc lập với dữ liệu giả. **Chưa bật sao lưu tự động trên máy đang dùng**: bảng phân quyền hệ thống `mysql.global_priv` lỗi chỉ mục; kiểm tra tự động từ chối cấp thêm ACL/sửa trực tiếp. Đã giữ bản sao file hệ thống được mã hóa, chưa sửa bảng. Không coi test độc lập là bản backup dữ liệu bệnh viện.
- Lịch email mới mặc định tắt; người nhận chỉ admin đang hoạt động. SMTP thực và thiết bị Wi-Fi khác chưa được xác nhận trong đợt này. HIS/SSO/LDAP/kênh ngoài/AI giữ tắt theo yêu cầu.


Nguồn yêu cầu: danh sách người dùng đính kèm ngày 04/11/2026. Tích hợp HIS/nhân sự, SSO/LDAP, Zalo/Telegram và AI giữ **tắt theo lựa chọn của người dùng**. Không đánh dấu hoàn thành dựa trên menu, một trường dữ liệu hoặc một form chung.

## Bổ sung phụ thuộc công việc — 05/11/2026

- Đã bổ sung API và giao diện phụ thuộc ở thẻ công việc/cửa sổ chi tiết workflow: tìm kiếm phân trang, chọn/bỏ/lưu tối đa 50 việc tiên quyết, giao diện chỉ xem và ẩn tên việc ngoài phạm vi.
- Backend ngăn tự phụ thuộc/vòng nhiều cấp, chặn bắt đầu/tăng tiến độ/checklist/gửi duyệt/duyệt khi việc trước chưa hoàn tất; ngăn mở lại/xóa/thay đổi checklist việc trước khi việc sau đã chạy. Kiểm tra cả khôi phục, đổi người duyệt và ghi nhận sự cố.
- Đã kiểm tra trên schema MySQL tạm cả hai race: thêm cạnh tạo vòng đồng thời, mở lại việc trước đồng thời với bắt đầu việc sau. Có kiểm tra HTTP DTO/quyền, nhật ký trước/sau, phạm vi khoa/nhóm và thùng rác. Không thay đổi dữ liệu người dùng thật trong kiểm thử.
- Đã sửa thêm việc trạng thái đang làm ở 0% bị chuẩn hóa thành chưa bắt đầu trên frontend. Có regression test và kiểm thử tải lại trình duyệt.
- Build hai phía và ESLint cho mã frontend mới đạt; **101 test frontend, 145 test backend (gồm Redis riêng), 26 E2E HTTPS** đạt trên bản cuối, gồm tải lại việc đang làm 0%.
- Migration thật bổ sung `task_dependencies`, `task_dependency_mutex` và bản ghi khóa, `recordsDeleted=0`. Backend dùng `dist-work-release-20261104-dependencies`; frontend cuối dùng `.next-work-release-20261104-dependencies-ui`. Bật `TASK_DEPENDENCIES_ENABLED`; giữ các tích hợp ngoài tắt.
- Wi-Fi hiện tại đổi IP: gateway chuyển sang `https://192.168.100.4:3443`, đồng bộ Origin và chứng chỉ LAN. Xem [hướng dẫn phụ thuộc](deploy/TASK_DEPENDENCIES.md). Chưa kiểm thử bằng tài khoản người dùng thật hay từ thiết bị Wi-Fi khác.
- Sau chuyển bản: health backend/login/proxy 200; Chrome xác nhận CAPTCHA, CSP nonce, chuyển trang bảo vệ về login, API phụ thuộc yêu cầu xác thực và giới hạn upload vẫn đúng. Biên nhận riêng ở `deploy/.runtime/work-deployment-check.json`.

## Đợt đối chiếu và chuyển bản trước — 04/11/2026

- Frontend `.next-work-release-20261104-review`; backend `dist-work-release-20261104-review`.
- Build hai phía đạt; **100 test frontend, 145 test backend, 22 test trình duyệt HTTPS** đạt. Backend gồm Redis thử nghiệm riêng, đã dọn sau kiểm tra.
- Integration MySQL dùng schema tạm, không sao chép dữ liệu người dùng thật: phạm vi khoa/nhóm, quyền chỉ xem, duyệt/khóa, thu hồi phạm vi sau đổi khoa/tạm dừng nhóm, công thức/vị trí KPI, chốt bất biến, DTO và quyền HTTP đều đạt.
- Migration bổ sung 3 bảng KPI, `recordsDeleted=0`. Cấu hình/secret/cổng hiện có được giữ; không tạo sẵn công thức hoặc thay chỉ tiêu của bệnh viện.
- Sau chuyển bản: backend, login HTTPS và proxy trả 200. Chrome kiểm tra CAPTCHA/CSP nonce và các trang/API được bảo vệ. Chưa đăng nhập/thao tác bằng tài khoản thật hoặc xác nhận từ thiết bị Wi-Fi khác trong đợt này.
- Đã bật nhập Excel và minh chứng sau kiểm tra thực trên DB/thư mục tạm. Schema của hai chức năng đã sẵn sàng nên không cần thêm migration trong bước bật này. Minh chứng lưu trong thư mục riêng bị Git bỏ qua, ngoài `public`; cần đưa thư mục này vào kế hoạch backup dữ liệu.
- Đã sửa gateway: request thông thường 64 KB, đúng route import có trần nginx 3 MB và đúng route minh chứng 6 MB để chứa multipart overhead. Ứng dụng vẫn giới hạn file Excel 2 MB, minh chứng 5 MB, kiểm tra Origin, xác thực và quyền dữ liệu. Không tăng giới hạn JSON toàn ứng dụng. Bộ tạo cấu hình và công cụ đổi IP cũng được cập nhật để giữ đúng route/Host.

## Các lỗi và khoảng trống đã xử lý trong đợt này

| Vấn đề | Kết quả |
|---|---|
| Trưởng nhóm mở QR/kiểm tra thiết bị nhóm khác trong cùng khoa | QR, kiểm tra và bảo trì dùng chung phạm vi người được giao/nhóm đang hoạt động; kiểm tra khoa hiện tại của thành viên |
| Yêu cầu liên khoa còn dựa vào thành viên cũ khi đổi khoa | Kiểm tra đồng thời khoa của trưởng nhóm, nhóm và thành viên hiện tại |
| Tài khoản chỉ xem không gán khoa không mở được chương trình đã công bố | Được xem nội dung công bố ở toàn viện; vẫn chặn ghi dữ liệu |
| Trưởng nhóm xem nhầm bản nháp cá nhân của người khác trong khoa | Chỉ nhận nội dung chia sẻ đã phát hành và hồ sơ được giao cho mình |
| KPI cố định và hàm lưu giả trả ID theo giờ | Thay bằng chính sách lưu DB, phiên bản, vị trí, trọng số, hệ số ưu tiên và snapshot kỳ; bỏ hàm lưu giả không được dùng |
| Kỳ KPI thay đổi sau khi sửa/xóa mềm công việc | Snapshot giữ công thức/điểm/số lượng; kết quả vẫn xuất hiện khi không còn công việc đang đọc được trong kỳ |
| Thiếu ngày hoàn thành nhưng vẫn chấm như đã có ngày | Đánh dấu tạm tính nếu điểm có thành phần đúng hạn; không cho chốt dữ liệu chưa đủ |

## Đối chiếu chức năng

“Một phần” nghĩa là cần làm tiếp trước khi coi đủ yêu cầu ban đầu. Những mục chưa có bên dưới chưa được triển khai hoặc bật chỉ bằng lần kiểm tra này.

| Yêu cầu | Backend và frontend hiện tại | Trạng thái |
|---|---|---|
| Admin / trưởng khoa / trưởng nhóm / nhân viên | Role DB, guard, scope công việc/KPI, trang cơ cấu và menu theo quyền | Đã có |
| Cơ cấu đơn vị/khoa/nhóm/vị trí | Chi nhánh → khoa → nhóm; thành viên và vị trí nhóm; vị trí chấm KPI riêng | Đã có; chưa có cây đơn vị nhiều cấp tùy ý |
| Giao việc/người thực hiện/người duyệt | API `/tasks`, `/work`; form giao việc và bảng duyệt | Đã có |
| Chờ duyệt/từ chối kèm lý do | Gửi duyệt, duyệt, từ chối, mở lại và nhật ký | Đã có |
| Phê duyệt nhiều cấp cấu hình | Hiện một người duyệt | Chưa có |
| Mẫu phiên bản không sửa dữ liệu cũ | Mẫu/version/occurrence, trang workflow | Đã có |
| Lặp ngày/tuần/tháng | Sinh thực, khóa giao dịch và unique key | Đã có |
| Lặp theo ca, lịch trực liên kết việc | Có API/lịch trực và bộ sinh theo cờ riêng; chưa bật `ADVANCED_SHIFT_TASKS_ENABLED` | Một phần |
| Nhắc sắp hạn/quá hạn trong app | Nhắc định kỳ, chống trùng và bỏ việc trong thùng rác | Đã có |
| Email/Zalo/Telegram nhắc việc | Chưa có luồng gửi nghiệp vụ; email OTP là luồng khác | Tắt; chưa hoàn thiện gửi nghiệp vụ |
| Audit ai sửa/xóa/duyệt, trước/sau | `audit_events`, trang nhật ký; một số nghiệp vụ mới mới ghi dữ liệu sau | Một phần |
| Excel/PDF có logo/chữ ký | XLSX thực; in/lưu PDF, chỗ ký tên | Đã có xuất; chưa phải chữ ký điện tử |
| Dashboard theo vai trò/đúng hạn/xu hướng | Phạm vi dữ liệu theo vai trò, thống kê/biểu đồ báo cáo | Một phần; chưa có dashboard riêng cho từng vai trò |
| KPI cấu hình trọng số/công thức/chỉ tiêu vị trí | `/kpi/policies`, gán vị trí, công thức hữu hạn có kiểm tra, không chạy biểu thức tùy ý | Đã có |
| So sánh kỳ trước | Backend báo cáo trả so sánh kỳ, frontend hiển thị | Đã có |
| Lịch sử KPI tháng/tuần | Chốt kỳ kết thúc, snapshot bất biến, xem lịch sử từ tên nhân sự | Đã có |
| KPI quý/năm | Chưa có tổng hợp quý/năm | Chưa có |
| Xếp hạng chuẩn hóa khối lượng/độ khó | Hệ số theo ưu tiên, trọng số khối lượng và chỉ tiêu theo vị trí | Một phần; chưa có độ khó riêng từng việc |
| Tự gửi báo cáo cuối tuần/tháng | Có hàm sinh/lưu; chưa có lịch gửi và danh sách nhận | Chưa hoàn thiện |
| File/ảnh minh chứng | Private storage, giới hạn loại/kích thước, scope, khóa sau nộp; vòng tải lên/tải xuống/xóa đã kiểm tra trên file và DB tạm; đã bật | Đã có |
| Bình luận/@mention/chat theo task | Chưa có mô hình/bộ API đầy đủ | Chưa có |
| Checklist con | Checklist, tiến độ, tick từng mục | Đã có |
| Lọc/tìm kiếm/ưu tiên | Bộ lọc và ưu tiên; workflow có phân trang | Đã có; nhãn tùy chỉnh chưa có |
| Kanban/danh sách/lịch | Các trang công việc có các cách xem hiện tại | Đã có |
| PWA/mobile | Manifest, icon, service worker chỉ lưu trang ngoại tuyến công khai | Một phần |
| Offline rồi đồng bộ công việc | Không cache dữ liệu nội bộ, không xếp hàng ghi offline | Chưa có |
| Mật khẩu/OTP/CAPTCHA/rate limit | Luồng bảo mật thực, cookie HttpOnly, refresh và ghi nhớ thiết bị | Đã có |
| SSO/LDAP | Chưa có cấu hình và giao thức tích hợp được xác nhận | Tắt theo yêu cầu |
| Backup tự động/kiểm tra phục hồi | Có backup DDL khi migration; chưa phải backup dữ liệu và thử restore | Chưa hoàn thiện |
| Phân trang/index/cache báo cáo | Workflow/nghiệp vụ có phân trang và index; báo cáo vẫn truy vấn trực tiếp | Một phần |
| Queue bền vững/cron | Sinh việc/nhắc hạn/rule dùng vòng định kỳ; chưa có queue retry bền vững | Một phần |
| Import nhân sự Excel | Preview, validate, transaction, mật khẩu băm, buộc đổi lần đầu; kiểm tra trùng và không nhập dở dang; đã bật cho admin | Đã có |
| AI tóm tắt/phát hiện/gợi ý/chatbot | Không gửi dữ liệu sang AI; chưa có tích hợp | Tắt theo yêu cầu |
| Đánh giá nhân viên tự đánh giá/quản lý | KPI chưa thay thế quy trình đánh giá hai phía | Chưa có |
| API/webhook hệ thống ngoài | API nội bộ có; chưa có webhook giao nhận/chữ ký/retry ngoài hệ thống | Chưa có tích hợp ngoài |
| Phụ thuộc giữa công việc | Đồ thị lưu DB, chống vòng kể cả yêu cầu đồng thời; gate bắt đầu/checklist/duyệt; bảo vệ mở lại/xóa, UI và nhật ký | Đã có; liên kết không tự sao chép sang việc định kỳ mới |
| Ủy quyền có thời hạn | Chưa có quyền duyệt thay theo khoảng ngày | Chưa có |
| Bàn giao toàn bộ việc kèm lịch sử | Chưa có luồng bàn giao nguyên tử và xác nhận | Chưa có |
| Ước lượng/thời gian thực tế | Chưa có timer/bảng thời gian | Chưa có |
| Leo thang theo giờ/cấp | Có rule ngưỡng việc quá hạn báo trưởng khoa; chưa có nhiều cấp theo giờ | Một phần |
| Việc khẩn cấp/giao nhanh | Có ưu tiên cao/giao việc; chưa có cờ khẩn và gửi ngay riêng | Một phần |
| Một task nhiều người | Tối đa 20 người phối hợp đủ quyền; một người chính chịu trách nhiệm/KPI | Đã có |
| Chuyển/trả việc kèm lý do | Trả/tạm dừng, xử lý trả, chuyển người nhận; bàn giao chờ người nhận xác nhận | Đã có |
| Checklist tick/số/đạt-không đạt/ảnh/ký | Tick, số có giới hạn, sự cố không đạt, minh chứng, ký bằng tài khoản | Đã có; ký nội bộ, chưa chữ ký số CA |
| Bắt buộc lý do khi không đạt | Luồng sự cố từ checklist yêu cầu mô tả và theo dõi | Đã có trong luồng sự cố |
| Khóa checklist sau nộp/duyệt | Backend chặn mutation; người duyệt/admin mở lại | Đã có |
| Phát hiện bỏ sót cuối ca/ngày | Chưa có đối chiếu danh sách bắt buộc theo từng ca | Chưa có |
| PIN/chữ ký số | Chưa có xác nhận giao dịch riêng/chứng thư số | Chưa có |
| Báo cáo tùy chỉnh kéo thả/lưu mẫu | Mẫu phiên bản, kéo thứ tự cột, lọc phạm vi, xem trước/phân trang và xuất Excel | Đã có, chỉ admin |
| Heatmap năng suất | Chưa có biểu đồ theo giờ/ngày dạng heatmap | Chưa có |
| Nguyên nhân trễ hạn | Chưa có danh mục nguyên nhân và thống kê | Chưa có |
| Hẹn lịch người nhận báo cáo | Hàng đợi MySQL/lease/kiểm tra quyền trước gửi, lịch mới tắt | Đã có mã và test SMTP giả; chưa gửi thật |
| Link báo cáo có hạn/mật khẩu | Không xuất dữ liệu công khai; chưa có chia sẻ có hạn | Chưa có |
| Trung tâm thông báo/đã đọc | Thông báo gần nhất, lọc chưa đọc, đánh dấu | Đã có; chưa phân trang toàn lịch sử |
| Bản tin nội bộ/xác nhận đã đọc | SOP có xác nhận phiên bản; chưa có bản tin riêng | Một phần |
| Cấu hình thông báo cá nhân/kênh | Nhắc hạn, mention, bàn giao, duyệt theo tài khoản trong ứng dụng | Đã có preference; kênh ngoài giữ tắt |
| Tóm tắt hàng ngày | Chưa có bản tổng hợp một tin | Chưa có |
| Loại việc/trạng thái/nhãn cấu hình | KPI đã cấu hình; trạng thái/loại việc chưa là danh mục admin | Một phần |
| Thùng rác/khôi phục | Có cho công việc; chưa bao phủ mọi loại dữ liệu | Một phần |
| Nhật ký đăng nhập/quản lý phiên từ xa | Liệt kê/thu hồi phiên khác và thiết bị gắn với phiên; guard kiểm tra Redis | Đã có quản lý phiên; nhật ký đăng nhập đầy đủ còn thiếu |
| 2FA quản lý | OTP email trong đăng nhập; không phải TOTP/WebAuthn | Đã có OTP; chưa có phương thức bổ sung |
| Ban giám đốc chỉ xem | Role viewer, chặn mutation ở API; báo cáo/KPI và chương trình công bố | Đã có |
| Lưu trữ dữ liệu 1–2 năm | Trang lưu việc hoàn thành không phải di chuyển dữ liệu sang kho dài hạn | Chưa có |
| Sức khỏe/online/lỗi/dung lượng | Có health Redis/API; chưa có dashboard vận hành đầy đủ | Một phần |
| QR mở checklist thiết bị | QR có kiểm soát quyền, thiết bị/kiểm tra/bảo trì | Đã có cho thiết bị |
| Tối/cỡ chữ | Chưa có preference/accessibility setting đầy đủ | Chưa có |
| Phím tắt | Chưa có hệ phím tắt được hướng dẫn | Chưa có |
| Tìm kiếm toàn cục việc/người/báo cáo | Tìm nhiều loại theo quyền backend, không trả hash/token/email trong kết quả người | Đã có |
| Tour/tooltip hướng dẫn | Chưa có tour lần đầu | Chưa có |
| Yêu cầu liên khoa | Tiếp nhận/từ chối/xử lý/hoàn thành, API và trang bệnh viện | Đã có |
| Báo sự cố từ checklist | Tạo phiếu khi không đạt, người nhận, trạng thái và cách xử lý | Đã có |
| Tài sản/QR/lịch kiểm tra/bảo trì | Có tài sản và lịch/checklist kiểm tra/bảo trì; cần tiếp tục kiểm chứng tác vụ định kỳ theo cấu hình | Một phần |
| Đoàn kiểm tra/chấm điểm/khắc phục/biên bản | Hồ sơ bộ tiêu chí/chấm điểm/ghi chú khắc phục có; chưa là quy trình đầy đủ theo đoàn/phân công | Một phần |
| SOP phiên bản/xác nhận | Có phiên bản/phát hành/xác nhận và theo dõi người đã đọc | Đã có |
| Lịch trực/phân ca | Có lưu lịch, ca lặp và liên kết việc; sinh tự động đang tắt | Một phần |
| Chứng chỉ/đào tạo hết hạn | Hồ sơ hạn và nhắc trong ứng dụng | Đã có phần nhắc; chưa có hồ sơ chứng chỉ chuyên biệt |
| Tránh dữ liệu người bệnh | Guard kiểm tra nội dung vận hành và cảnh báo; không bảo đảm phát hiện mọi dữ liệu nhạy cảm | Một phần |
| Nếu X thì Y | Có một số rule ngưỡng quá hạn; chưa có rule engine tổng quát | Một phần |
| Cảnh báo bất thường | Chưa có phân tích xu hướng bất thường nhiều ngày | Chưa có |
| OKR | Có quý/key result/target/progress; chưa liên kết đầy đủ công việc hằng ngày | Một phần |
| Gợi ý phân công theo tải | Chưa có | Chưa có |
| Khen thưởng/huy hiệu | Chưa có | Chưa có |
| Khảo sát/phản hồi | Có khảo sát có định danh, trả lời một lần và xem kết quả theo quyền | Đã có; không phải khảo sát ẩn danh |
| Ghi chú/nhắc việc cá nhân | Trang việc cá nhân hiện tại; chưa có nhắc giờ đa thiết bị đầy đủ | Một phần |

## Cách tái kiểm tra bản review

Frontend: `npm test`; build riêng với `CAREOPS_RELEASE=work`, `CAREOPS_WORK_DIST_DIR=.next-work-release-20261104-review`. Không build đè thư mục đang phục vụ.

Backend: build mới vào một `dist-work-release-*` riêng qua `tsconfig.work-build.json`. `npm test -- --runInBand` bỏ qua 3 test Redis nếu không khai báo `RUN_REDIS_INTEGRATION=true` và `REDIS_INTEGRATION_URL` tới Redis **thử nghiệm riêng**.

Integration: `node test/fullstack-review.integration.cjs --allow-temporary-schema --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env`; script mặc định đọc build review, tạo/xóa đúng schema tạm `careops_org_test_*`, không thay dữ liệu production. Cần quyền tạo schema thử nghiệm. Không dùng Redis LAN cho integration phá kết nối.

E2E: `CAREOPS_RELEASE=work`, `CAREOPS_WORK_DIST_DIR=.next-work-release-20261104-review`, `E2E_HTTPS_PORT=3444`, `E2E_BROWSER_CHANNEL=chrome`, rồi `npm run test:e2e:run`. Backend/SMTP giả lập, không gửi email thật.

Sau chuyển bản: `node scripts/check-lan.cjs`; `node scripts/select-reviewed-release.cjs --check`. Biên nhận Chrome tại gateway lưu riêng trong `deploy/.runtime/work-deployment-check.json`.

## Công việc tiếp theo chưa được coi hoàn tất

Các nhóm điều phối, cộng tác, duyệt nhiều cấp, trường số/xác nhận, báo cáo và ngoại tuyến đã được bổ sung trong bản 05/11. Còn hoàn tất backup thật sau xử lý quyền MariaDB, kiểm tra SMTP/nghiệp vụ với tài khoản thật và các mục chưa có khác trong bảng khoảng 80 chức năng (ví dụ tour, heatmap, nguyên nhân trễ, TOTP/WebAuthn, chia sẻ báo cáo có hạn). Không coi toàn bộ danh sách ban đầu hoàn tất.
