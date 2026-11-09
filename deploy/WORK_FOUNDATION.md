# Duyệt việc, việc lặp lại và báo cáo

## Cập nhật 05/11/2026

Bản LAN chọn backend `dist-work-release-20261104-dependencies`, frontend `.next-work-release-20261104-dependencies-ui`, địa chỉ Wi-Fi `https://192.168.100.4:3443`. Đã bật `TASK_DEPENDENCIES_ENABLED` sau migration bổ sung hai bảng và kiểm thử DB tạm. Tính năng gồm liên kết tiên quyết, ngăn vòng và chặn thao tác trạng thái không hợp lệ ở backend, giao diện chọn/lưu ở thẻ việc và chi tiết workflow. Xem [hướng dẫn đầy đủ](TASK_DEPENDENCIES.md).

101 test frontend, 145 test backend (Redis riêng), 26 E2E HTTPS trên bản cuối đạt; integration MySQL xác nhận hai race, quyền/DTO, nhật ký và thùng rác. Các mục bên dưới giữ lịch sử đợt trước; xem [bảng đối chiếu](../FULLSTACK_REVIEW.md) để biết trạng thái hiện tại. Tích hợp ngoài vẫn tắt.

## Cập nhật 04/11/2026

Bản LAN hiện chọn frontend/backend `*-work-release-20261104-review`. Xem [bảng đối chiếu đầy đủ](../FULLSTACK_REVIEW.md) để biết các chức năng đã có/một phần/chưa có; các mục theo ngày bên dưới giữ lại lịch sử triển khai.

Đã bật `KPI_POLICIES_ENABLED`, `EMPLOYEE_IMPORT_ENABLED`, `TASK_EVIDENCE_ENABLED`. Cơ cấu tổ chức, nghiệp vụ bệnh viện và nghiệp vụ nâng cao vốn đã bật; `ADVANCED_SHIFT_TASKS_ENABLED` và các tích hợp bên ngoài vẫn tắt. Ba bảng KPI mới được bổ sung, không xóa bản ghi. Import và minh chứng dùng schema đã có sẵn.

Minh chứng dùng thư mục riêng `deploy/.runtime/task-evidence` của frontend, ngoài `public` và bị Git bỏ qua. Backup dữ liệu cần bao gồm cả DB và thư mục này; backup DDL khi migration không thay thế backup dữ liệu/file.

Gateway giữ 64 KB cho request thường; chỉ route `/api/users/import/(preview|commit)` có trần nginx 3 MB, `/api/tasks/:id/attachments` có trần 6 MB. BFF/backend vẫn giới hạn file Excel 2 MB, minh chứng 5 MB. Không bỏ kiểm tra Origin hoặc xác thực để upload. Bộ tạo cấu hình nginx và công cụ đổi IP đã được cập nhật cho các location này.

Kiểm tra đợt này: 100 test frontend, 145 test backend (Redis riêng), 22 E2E đạt; integration MySQL tạm đạt cả KPI bất biến, import nguyên tử/mật khẩu băm/buộc đổi lần đầu, minh chứng tải lên/tải xuống/quyền truy cập/khóa sau nộp. Sau chuyển bản, health/login/proxy 200; probe không đăng nhập ở upload trả 401 thay vì bị chặn 413 tại 64 KB, request thường vượt 64 KB vẫn trả 413. Chưa kiểm thử tài khoản người dùng thật hoặc thiết bị Wi-Fi khác trong lần này.

Để kiểm tra bản hiện chọn dùng `node scripts/select-reviewed-release.cjs --check`; không dùng script chọn bản cũ để ghi đè cấu hình mới. Không build đè thư mục đang phục vụ. Cấu hình trước các lần chuyển được lưu riêng dưới `.runtime`; không đưa các file đó vào Git hoặc chia sẻ vì có bí mật.

Đợt này bổ sung nền tảng nghiệp vụ của giai đoạn 1 trong [lộ trình](../FEATURE_ROADMAP.md). Các nhóm còn lại vẫn cần triển khai; không coi toàn bộ danh sách đã hoàn thành.

## Hành vi mới

- API công việc giới hạn trưởng khoa theo khoa của người thực hiện; nhân viên chỉ đọc công việc của mình, admin đọc toàn bộ. Khoa được kiểm tra từ DB tại mỗi yêu cầu.
- Khi giao việc có thể chọn người duyệt khác người thực hiện. Đạt 100% sẽ gửi duyệt, chưa tính hoàn thành. Người duyệt chấp thuận hoặc từ chối kèm lý do; chờ duyệt và đã duyệt đều khóa chỉnh sửa. Người duyệt hoặc admin có thể mở lại.
- Xóa đưa công việc vào thùng rác; người giao hoặc admin có thể khôi phục trong phạm vi được phép. Các thao tác được ghi người thực hiện, thời điểm và dữ liệu thay đổi. Không có API sửa/xóa nhật ký.
- Mẫu lặp theo ngày, tuần hoặc tháng có phiên bản. Mỗi lần sinh tạo công việc/checklist riêng; sửa mẫu không đổi việc cũ. Sinh lịch kiểm tra mỗi phút, tối đa 100 mẫu mỗi lượt; lịch chậm được bắt kịp qua các lượt. Khóa giao dịch và unique key chống sinh trùng khi chạy nhiều instance. Lịch tháng giữ ngày gốc (31/1 → 28/2 → 31/3). Mẫu tự tạm dừng nếu người giao/người thực hiện/người duyệt không còn hợp lệ.
- Báo cáo lấy dữ liệu đúng kỳ từ backend; tuần tính thứ Hai–Chủ nhật. Có lọc khoa, so sánh kỳ trước, file Excel `.xlsx` thực có logo và chỗ ký. PDF dùng chức năng In/Lưu PDF của trình duyệt. Chỗ ký chưa phải chữ ký điện tử.
- Ngày hoàn thành cũ chưa được ghi nhận sẽ hiển thị chưa đủ dữ liệu đúng hạn; không suy đoán ngày hoàn thành. Báo cáo vẫn chỉ dành cho admin theo chính sách hiện tại.
- Trung tâm thông báo hiển thị tối đa 50 nhắc việc gần nhất theo tài khoản, lọc chưa đọc và đánh dấu đã đọc. Chưa có gửi email/chat tự động hoặc phân trang toàn bộ lịch sử thông báo.
- KPI hiện lọc theo hạn công việc trong tuần/tháng, bỏ việc trong thùng rác, tính số hoàn thành trễ và giữ phạm vi khoa. API chấp nhận `date=YYYY-MM-DD` để chọn kỳ; trang hiện tại xem tháng hiện hành. Chưa có cấu hình trọng số/chỉ tiêu hoặc snapshot KPI lịch sử.

Kết quả kiểm tra bản này: 86 test frontend, 103 test backend, 19 test trình duyệt HTTPS và integration MySQL trên schema tạm đều đạt. Đây là kiểm tra mã/bản build riêng; chưa thay thế xác minh sau khi chuyển bản trên LAN và thử nghiệp vụ bằng tài khoản được phép.

## Trạng thái chuyển bản ngày 30/10/2026

Đã được người dùng cho phép cập nhật DB và chuyển bản ngay. Migration tạo đủ 5 bảng, báo `recordsDeleted=0`; cả frontend/backend đã chọn `work`. Health backend, login HTTPS và proxy đều trả 200 tại `https://192.168.81.178:3443`.

Khi khởi động đã phát hiện TypeORM không cập nhật được entity với insert bị bỏ qua do nhắc việc trùng. Đã thêm `updateEntity(false)`, cho bộ nhắc việc thử lại nếu khởi tạo lỗi, kiểm tra lại trên MySQL tạm cho chống trùng và giữ `readAt`, sau đó khởi động thành công. Sau bản vá chạy lại backend: 100 test đạt, 3 test Redis bỏ qua trong lần này; 3 test Redis đã đạt trước đó với Redis tạm riêng. Không chạy integration vào Redis LAN.

Chrome thật tại gateway đã kiểm tra login/CAPTCHA/CSP nonce, chuyển về login khi chưa xác thực và API công việc trả 401 cho người chưa đăng nhập. Kết quả cục bộ không chứa bí mật lưu ở `.runtime/work-deployment-check.json`. Chưa thực hiện luồng duyệt việc bằng tài khoản người dùng thật và chưa xác nhận truy cập từ thiết bị Wi-Fi khác trong lần chuyển bản này.

## Build riêng và kiểm tra

Frontend:

```powershell
$env:CAREOPS_RELEASE='work'
npm run build
npm test
$env:E2E_HTTPS_PORT='3444'
$env:E2E_BROWSER_CHANNEL='chrome'
npm run test:e2e:run
```

Backend:

```powershell
node node_modules/typescript/bin/tsc --project tsconfig.work-build.json
npm test -- --runInBand
node test/work-foundation.integration.cjs --allow-temporary-schema --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env
```

Integration MySQL chỉ sao chép cấu trúc bảng sang schema tạm ngẫu nhiên `careops_work_test_*`, tạo dữ liệu giả rồi xóa đúng schema tạm. Không sao chép dữ liệu tài khoản thật. Cần tài khoản DB có quyền tạo/xóa schema thử nghiệm; không dùng môi trường production để thử.

## Chuyển bản LAN

`node scripts/select-work-release.cjs --check` kiểm tra build và schema theo cấu hình riêng trong `.runtime`, không in bí mật. Trước khi bật cần đủ 5 bảng `task_operations`, `audit_events`, `task_templates`, `task_template_versions`, `task_occurrences`.

Trong cửa sổ bảo trì đã được đồng ý:

1. Ở backend, chạy `node scripts/work-schema.cjs --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env` để xem kế hoạch. Thêm `--apply` để tạo bảng còn thiếu. Công cụ chỉ thêm bảng, không xóa dữ liệu. Bản sao DDL lưu trong `deploy/backups`; bản sao này không thay thế backup toàn DB khi triển khai chính thức.
2. Ở frontend, dừng bộ LAN bằng `./scripts/lan-services.ps1 -Action stop`.
3. Chạy `node scripts/select-work-release.cjs --activate`. Công cụ giữ nguyên secret/cổng/origin, chọn `CAREOPS_RELEASE=work` ở hai dịch vụ và bật `WORK_FOUNDATION_ENABLED=true` ở backend. Cấu hình trước được lưu riêng trong `.runtime/work-release-previous.json`; không chia sẻ file này.
4. Chạy `./scripts/lan-services.ps1 -Action start`, sau đó `node scripts/check-lan.cjs`.
5. Đăng nhập bằng tài khoản thử được phép: kiểm tra trưởng khoa không thấy khoa khác, giao một việc có duyệt, hoàn tất → duyệt/từ chối → mở lại, xóa/khôi phục, tạo mẫu ngày mai và xuất báo cáo.

Không build đè thư mục bản đang phục vụ. Không tự tắt cờ nghiệp vụ hoặc quay về bản cũ khi đã có việc chờ duyệt/đã duyệt/thùng rác: mã cũ không áp dụng khóa và phạm vi dữ liệu mới. Nếu cần quay lui, phải đánh giá dữ liệu phát sinh và giữ kiểm soát duyệt; không drop bảng để quay lui.

## Nghiệp vụ bệnh viện (bản đầu)

Backend/frontend có API và giao diện cho yêu cầu liên khoa, báo sự cố gắn mục checklist, danh mục thiết bị kèm QR-ID, lịch kiểm tra và ghi nhận bảo trì. Chưa bật mặc định. Chỉ kích hoạt trong đợt bảo trì sau khi đã xác nhận backup toàn DB, phân công theo khoa và tài khoản thử:

Khi báo mục checklist không đạt, nguyên nhân tối thiểu 3 ký tự là bắt buộc ở giao diện và API; mục đã có phiếu sự cố không thể chọn tạo thêm.

1. Dừng bộ LAN theo quy trình ở trên.
2. Từ backend, chạy `node scripts/hospital-operations-schema.cjs --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env` để xem kế hoạch; sau khi kiểm tra, thêm `--apply` để tạo các bảng và cột bổ sung. Đây là migration additive; bản sao DDL không thay thế backup toàn DB.
3. Trong `deploy/.runtime/backend.env`, đặt `HOSPITAL_OPERATIONS_ENABLED=true`. Giữ file env riêng tư, không gửi file này.
4. Build/chuyển bản theo quy trình release hiện hành, khởi động lại và kiểm tra `/api/hospital-operations/capabilities` trả `enabled: true`.
5. Thử bằng tài khoản giả được phép: yêu cầu giữa hai khoa, tiếp nhận/từ chối/hoàn thành; báo mục checklist không đạt, xử lý/đóng sự cố; tạo thiết bị, hoàn thành kiểm tra và ghi bảo trì.

Tính năng hiện không gửi email/thông báo ngoài ứng dụng cho các yêu cầu này. QR-ID được sinh và tra cứu qua API; màn hình chưa render ảnh QR để in. Bộ lọc dữ liệu chỉ chặn một số nhãn nhận diện phổ biến, không phải công cụ DLP và không thể đảm bảo nhận biết mọi dữ liệu bệnh nhân. Không nhập dữ liệu bệnh nhân; cần rà soát và phê duyệt chính sách bảo vệ dữ liệu trước khi dùng thực tế. Các module còn lại trong roadmap (PDF server-side, SOP, ca trực, audit đoàn, OKR, AI, tích hợp) chưa được bật/triển khai trong bản này.

## Import nhân sự Excel

Backend và màn hình quản lý nhân viên có luồng import `.xlsx` gồm kiểm tra/xem trước và tạo giao dịch: tối đa 500 dòng, file 2 MB; email/mã nhân viên trùng hoặc bất kỳ dòng sai nào đều từ chối cả file, không cập nhật tài khoản có sẵn. Cột bắt buộc: `Họ tên`, `Email`, `Mã nhân viên`, `Khoa/phòng`; vai trò trống mặc định là nhân viên; khoa/phòng và chi nhánh có thể dùng tên hoặc ID. Không import tài khoản quản trị. Mã nhân viên là dữ liệu mới nên phải áp dụng migration trước khi build/chuyển backend.

Chưa bật trên môi trường đang chạy. Trong cửa sổ bảo trì được phê duyệt và sau backup toàn DB:

1. Xem kế hoạch migration cơ cấu tổ chức; nếu DB chưa có `leader`/`viewer`, `organization_teams`, `organization_members` và `audit_events`, thực hiện migration cơ cấu theo quy trình được duyệt trước. Import cần `ORGANIZATION_ENABLED=true` để gán vai trò mới và cần bảng audit.
2. Từ backend, chạy `node scripts/employee-import-schema.cjs --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env` xem kế hoạch; chỉ thêm `--apply` sau khi review. Migration thêm cột mã nhân viên và unique index, không xóa tài khoản.
3. Đưa đồng bộ bản backend/frontend có thay đổi lên release riêng; đặt `EMPLOYEE_IMPORT_ENABLED=true` và giữ `ORGANIZATION_ENABLED=true` trong env backend. Nếu chưa bật, giao diện admin hiển thị import bị khóa.
4. Thử preview với file giả, xác nhận một dòng lỗi/trùng chặn toàn bộ, sau đó import vào môi trường test và kiểm tra audit, department, role, đăng nhập/OTP.

Mật khẩu khởi tạo hiện là một mật khẩu dùng chung do admin nhập (tối thiểu 12 ký tự), không gửi qua file/email; bàn giao qua kênh riêng. Hệ thống chưa bắt buộc đổi mật khẩu lần đầu, vì vậy không dùng mật khẩu này cho tài khoản thật nếu chưa có quy trình đổi và bàn giao được phê duyệt.

## Minh chứng checklist/công việc

Đã thêm API và giao diện đính kèm ảnh JPEG/PNG hoặc PDF tối đa 5 MB/công việc. File lưu ngoài web root trong thư mục riêng `TASK_EVIDENCE_STORAGE_DIR` (đường dẫn tuyệt đối, chỉ backend đọc), được đổi tên ngẫu nhiên, tải/xóa qua API có session và phạm vi công việc; file của người khác chỉ admin hoặc người giao việc được xóa. Công việc đã gửi duyệt/đã duyệt bị khóa. Không phục vụ file trực tiếp/public. Migration additive: `node scripts/task-evidence-schema.cjs --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env`, chỉ thêm `--apply` sau khi review và backup toàn DB.

Chưa bật trên LAN. Trước khi bật cần cấu hình thư mục lưu ngoài thư mục phục vụ, ACL tối thiểu cho service account, backup/restore file cùng DB, rà soát quét malware/chính sách lưu giữ; sau đó mới đặt `TASK_EVIDENCE_ENABLED=true` và phát hành đồng bộ frontend/backend. File có thể chứa dữ liệu nhạy cảm; cảnh báo UI không phải DLP. Cần được an toàn thông tin bệnh viện phê duyệt trước khi dùng dữ liệu thật.

## Việc frontend cần hoàn thành cho roadmap

Import nhân sự và minh chứng checklist là các luồng frontend vừa bổ sung. Các hạng mục tiếp theo phải làm theo thứ tự, mỗi luồng gồm: thiết kế trạng thái rỗng/đang tải/lỗi/thành công; lọc phạm vi theo vai trò; kết nối API thật; responsive; kiểm tra trình duyệt và test quyền. Không chỉ dựng UI trước khi backend/schema sẵn sàng.

1. **MVP:** bổ sung progress/preview ảnh cho upload minh chứng và bắt buộc lý do checklist không đạt; UI ủy quyền/bàn giao; email notification opt-in khi SMTP được bệnh viện cấu hình; lịch sử và kỳ trước cho báo cáo. Có sẵn phần nền task/KPI/report nên cần đối chiếu API hiện tại trước khi thêm màn hình.
2. **Tổ chức và phân ca:** cây khoa/nhóm, thành viên và vai trò; UI quản lý quy tắc KPI; lịch trực/bàn giao; biểu đồ khối lượng và gợi ý phân công có giải thích.
3. **Nghiệp vụ bệnh viện:** QR in/quét và trang thiết bị; mẫu checklist theo ca, SOP có version/xác nhận đọc; đoàn kiểm tra/khắc phục; chứng chỉ/đào tạo; giao diện cài phạm vi riêng tư và cảnh báo dữ liệu nhạy cảm.
4. **Cộng tác/vận hành:** bình luận/@mention, trung tâm notification và cài đặt, lịch gửi báo cáo, trạng thái backup/health/audit, phân trang và tìm kiếm toàn cục; PWA/offline chỉ khi có thiết kế giải quyết xung đột đồng bộ.
5. **Nâng cao:** màn hình OKR, automation/rules, bất thường, khảo sát/huy hiệu, chatbot/AI, webhook, SSO/HIS. HIS/SSO/bot/AI giữ tắt cho đến khi có API contract, endpoint, chủ sở hữu dữ liệu và chấp thuận an toàn thông tin; không gửi dữ liệu bệnh viện ra dịch vụ ngoài để thử.

## Nghiệp vụ chuyên sâu — chưa áp dụng

`src/advanced-operations` bổ sung API cho SOP/phiên bản/xác nhận đọc, lịch trực, hạn đào tạo/chứng chỉ và nhắc trong ứng dụng, đoàn kiểm tra/chấm điểm/ghi chú khắc phục, OKR theo quý, khảo sát có định danh và quy tắc nhắc trưởng khoa khi số việc quá hạn đạt ngưỡng. Frontend ở `/programs`; PWA chỉ lưu trang hướng dẫn ngoại tuyến, không lưu dữ liệu nội bộ hay cho sửa offline.

Migration `scripts/advanced-operations-schema.cjs` chỉ tạo bảng `advanced_records`, phiên bản, xác nhận SOP, câu trả lời khảo sát và nhắc đào tạo. Script hỗ trợ xem kế hoạch mặc định; **không chạy `--apply` trong lượt này**. Yêu cầu các bảng `users`, `departments`, `audit_events`, `task_operations`, `notifications`, `organization_teams` và `organization_members`. Tính năng yêu cầu đồng thời `ADVANCED_OPERATIONS_ENABLED=true`, `ORGANIZATION_ENABLED=true` và `WORK_FOUNDATION_ENABLED=true`; các cờ hiện không được bật bởi thay đổi này.

Không chuyển bản LAN hoặc chạy migration theo tài liệu này nếu chưa có cửa sổ bảo trì, backup DB và dữ liệu file, kiểm tra phục hồi, review quyền DB và tài khoản test. Automation nội bộ chỉ chạy khi cả ba cờ đã bật và người quản lý phát hành quy tắc; bot/email/webhook/HIS/SSO/LDAP/AI luôn trả trạng thái tắt trong API này. Khảo sát lưu danh tính; chỉ người tạo/admin xem câu trả lời. PWA hiện không có hàng đợi ghi hoặc đồng bộ offline.
