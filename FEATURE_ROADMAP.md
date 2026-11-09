# Bổ sung chức năng theo mức ưu tiên

## Cập nhật 05/11/2026

Đã bổ sung các nhóm điều phối/ủy quyền/bàn giao/thời gian/nhiều người, duyệt nhiều cấp/checklist số-ký nội bộ, bình luận/mention/preference, KPI quý-năm, dashboard/phân quyền tìm kiếm/phiên, báo cáo tùy chỉnh-lịch gửi và ngoại tuyến mã hóa. Sao lưu/khôi phục thử đã qua môi trường độc lập; worker sao lưu thật giữ tắt vì lỗi bảng phân quyền MariaDB hiện tại. Xem [đối chiếu mới](FULLSTACK_REVIEW.md) và [giới hạn/cấu hình](deploy/COORDINATION_RELEASE.md). Các bảng “đối chiếu ban đầu” bên dưới là mốc lịch sử, không thay trạng thái cập nhật này.


Phạm vi: toàn bộ danh sách người dùng gửi ngày 30/10/2026; triển khai lần lượt. Không đánh dấu hoàn tất một chức năng chỉ vì đã có nút hoặc cờ dữ liệu.

## Đối chiếu mới nhất — 05/11/2026

Đã bổ sung phụ thuộc công việc xuyên suốt DB/API/UI, kiểm tra quyền và vòng phụ thuộc kể cả yêu cầu đồng thời. Đã chuyển backend sang build `20261104-dependencies`, thêm hai bảng không xóa dữ liệu, bật cờ sau kiểm thử. Đã sửa trạng thái đang làm 0% bị hiển thị thành chưa bắt đầu. 101 test frontend, 145 test backend đạt; kết quả E2E cuối ghi trong bảng đối chiếu. Xem [hướng dẫn sử dụng và triển khai](deploy/TASK_DEPENDENCIES.md). Các mục ủy quyền, bàn giao, đo thời gian và những chức năng còn thiếu trong bảng đối chiếu vẫn chưa được đánh dấu hoàn thành.

Xem [FULLSTACK_REVIEW.md](FULLSTACK_REVIEW.md) để biết tình trạng backend/frontend theo từng yêu cầu. Các bảng “đối chiếu ban đầu” bên dưới là lịch sử, không thay thế kết quả rà soát mới.

Đã bổ sung/chuyển bản: công thức KPI có phiên bản theo khoa/vị trí, hệ số khối lượng, chốt kỳ bất biến và lịch sử; vá phạm vi QR/kiểm tra/bảo trì thiết bị của trưởng nhóm; sửa quyền đọc chương trình công bố cho tài khoản chỉ xem và bảo vệ bản nháp cá nhân. 100 test frontend, 145 test backend và 22 E2E đạt. Đã thêm 3 bảng KPI, không xóa dữ liệu hiện có; LAN chạy bản review 20261104. Đã kiểm tra và bật import Excel/minh chứng, sửa giới hạn upload riêng tại gateway. Tích hợp ngoài giữ tắt theo yêu cầu. Danh sách đầy đủ vẫn còn các mục chưa triển khai, được ghi rõ trong bản đối chiếu.

## Tiến độ hiện tại — 30/10/2026

Đã viết mã, build riêng và kiểm thử nhóm nền tảng ở cả frontend/backend:

- Phạm vi công việc theo khoa ở API; nhân viên theo người thực hiện, admin toàn bộ.
- Người duyệt, gửi duyệt, chấp thuận/từ chối có lý do, khóa và mở lại công việc/checklist.
- Nhật ký thao tác và thùng rác/khôi phục công việc.
- Mẫu có phiên bản; sinh việc ngày/tuần/tháng, khóa giao dịch và chống trùng.
- Trung tâm 50 thông báo gần nhất; nhắc hạn bỏ qua việc đã xóa.
- Báo cáo đúng kỳ/khoa, so sánh kỳ trước, lưu báo cáo thật, Excel có logo và bố cục in PDF có chỗ ký.
- Sửa KPI lọc đúng kỳ và loại việc trong thùng rác; tính trễ hạn thay vì luôn trả 0. Cấu hình trọng số/chỉ tiêu và lịch sử KPI vẫn thuộc phần chưa triển khai.

Kiểm tra: 86 test frontend, 103 test backend (gồm Redis riêng), 19 test trình duyệt HTTPS; integration MySQL trên schema tạm đạt, không đổi bản ghi production. File Excel xuất từ trình duyệt đã kiểm tra cấu trúc ZIP/XML và ảnh logo.

**Đã bật trên LAN ngày 30/10/2026 sau khi được đồng ý:** đã tạo 5 bảng bổ sung, không xóa bản ghi; frontend/backend đang chạy bản `work`. Backend, login HTTPS và proxy trả 200. Kiểm tra Chrome thật sau chuyển bản đạt cho login/CAPTCHA/CSP và chặn người chưa đăng nhập; chưa kiểm thử luồng nghiệp vụ bằng tài khoản thật. Đã sửa lỗi TypeORM ở thao tác bỏ qua nhắc việc trùng và bổ sung regression MySQL cho việc giữ trạng thái đã đọc. Hướng dẫn tại [WORK_FOUNDATION.md](deploy/WORK_FOUNDATION.md). Không coi toàn bộ giai đoạn 1 hoặc danh sách khoảng 80 chức năng đã hoàn thành: vai trò trưởng nhóm/cây tổ chức, checklist theo ca, kênh gửi ngoài app và các nhóm bên dưới còn tiếp tục.

## Đối chiếu ban đầu

| Nhóm            | Đã có                                                                     | Còn thiếu hoặc chưa hoàn chỉnh                                                                                                                       |
| --------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tài khoản       | Mật khẩu băm, OTP, CAPTCHA, giới hạn đăng nhập, refresh/ghi nhớ thiết bị  | Nhật ký đăng nhập, quản lý/thu hồi phiên từ xa, SSO/LDAP, vai trò trưởng nhóm và chỉ xem                                                             |
| Tổ chức         | Chi nhánh, khoa/phòng, nhân viên, trưởng khoa quản lý nhân viên khoa mình | Cây tổ chức, nhóm, vị trí, điều chuyển/bàn giao và ủy quyền theo thời gian                                                                           |
| Công việc       | Giao việc, ưu tiên, tiến độ, checklist con, Kanban, danh sách và lịch     | Siết phạm vi khoa ở API task; giao/người duyệt; chờ duyệt/từ chối; khóa sau duyệt; phụ thuộc, trả/chuyển việc, nhóm thực hiện, theo dõi thời gian    |
| Việc lặp lại    | Có trường isRecurring                                                     | Mẫu có phiên bản, ca/ngày/tuần/tháng, sinh việc thực sự, chống sinh trùng, phát hiện bỏ sót                                                          |
| Thông báo       | Nhắc hạn/quá hạn trong app mỗi 15 phút, đánh dấu đã đọc                   | Trung tâm đầy đủ, cấu hình cá nhân, email/chat bot, tóm tắt ngày, leo thang, bản tin/xác nhận đã đọc                                                 |
| Nhật ký         | Lưu trạng thái pending/done theo ngày                                     | Audit ai thay đổi/xóa/duyệt, trước/sau, thời điểm; thùng rác và khôi phục                                                                            |
| Báo cáo         | Tổng hợp ngày/tuần/tháng, biểu đồ, xuất CSV                               | CSV hiện bị đặt tên Excel; lọc khoa chưa áp dụng ở backend; Excel/PDF thực, logo/chữ ký, kỳ trước, mẫu tùy chỉnh, lịch gửi và chia sẻ có hạn         |
| KPI             | Điểm/tỷ lệ hoàn thành và xếp hạng trong phạm vi khoa                      | Dữ liệu phải lọc đúng kỳ; lateCount chưa tính; cấu hình trọng số/chỉ tiêu, chuẩn hóa độ khó/khối lượng, lịch sử kỳ                                   |
| Phối hợp        | Checklist con và ghi chú cá nhân                                          | File/ảnh minh chứng, bình luận/@mention, SOP, bàn giao ca, lịch trực, quản lý chứng chỉ                                                              |
| Bệnh viện       | Checklist vận hành cơ bản                                                 | Checklist có kiểu dữ liệu/lý do không đạt, sự cố, yêu cầu liên khoa, tài sản/QR/bảo trì, kiểm tra nội bộ, PIN/chữ ký, nhắc tránh thông tin bệnh nhân |
| Quy mô/vận hành | MySQL, Redis cho phiên/rate limit; build/test CI                          | Phân trang/index/cache phù hợp, queue bền vững, import Excel, backup và kiểm tra restore, giám sát/online, lưu trữ dài hạn                           |
| Trải nghiệm     | Responsive, tìm kiếm header cơ bản                                        | PWA/offline có đồng bộ, tối/cỡ chữ, phím tắt, hướng dẫn, tìm kiếm báo cáo và dữ liệu toàn cục                                                        |
| Nâng cao        | Chưa có triển khai                                                        | Quy tắc tự động, bất thường, OKR, gợi ý phân công, AI/chatbot, huy hiệu, khảo sát, webhook/API và tích hợp HIS/nhân sự                               |

## Thứ tự thực hiện

1. **Nền tảng nghiệp vụ:** phạm vi khoa phía backend, duyệt việc và khóa sau duyệt, audit/thùng rác, mẫu lặp lại thực sự, nhắc hạn, báo cáo đúng phạm vi/kỳ, xuất Excel/PDF.
2. **Tổ chức và điều phối:** vai trò/nhóm/cây tổ chức, ủy quyền/bàn giao, phụ thuộc, chuyển/trả việc, thời gian, giao nhóm, cấu hình KPI và dashboard theo vai trò.
3. **Checklist bệnh viện:** ca, mẫu phiên bản, kiểu dữ liệu và lý do không đạt, sự cố, QR/tài sản/bảo trì, SOP, trực/đào tạo, phê duyệt nhiều cấp và xác nhận quan trọng.
4. **Cộng tác và quy mô:** đính kèm/bình luận/mention, thông báo/bản tin, cấu hình cá nhân, mẫu/lịch gửi báo cáo, queue, phân trang/cache/index, import, backup/restore và giám sát.
5. **Trải nghiệm/tích hợp/nâng cao:** PWA/offline, tối/cỡ chữ/phím tắt/tour, SSO/LDAP/HIS/webhook/chat bot, AI/OKR/bất thường, đánh giá/khen thưởng/khảo sát.

Các kết nối ra ngoài cần endpoint, thông tin tích hợp và phạm vi dữ liệu được phép của bệnh viện. Không gửi email/chat/webhook thật, tự cấu hình hạ tầng hoặc đưa dữ liệu sang dịch vụ AI chỉ để thử chức năng. Các thay đổi DB phải có migration được kiểm tra và không xóa dữ liệu hiện có.

## Cập nhật 02/11/2026

Đã bổ sung luồng import nhân sự `.xlsx` cho admin: xem trước, xác thực toàn file, từ chối toàn bộ khi trùng/lỗi, transaction khi tạo, audit và mã nhân viên duy nhất. Luồng cần migration `employee-import-schema.cjs`, cơ cấu tổ chức đã bật và `EMPLOYEE_IMPORT_ENABLED=true`; không tự bật trên LAN.

**Frontend đã có:** quản lý nhân viên, cơ cấu nhóm, thông báo, công việc/duyệt, báo cáo, KPI và trang nghiệp vụ bệnh viện cho yêu cầu liên khoa, sự cố checklist, thiết bị.  
**Frontend mới bổ sung:** nút tải mẫu, upload/xem trước/hiển thị lỗi và xác nhận import; checklist có đính kèm ảnh/PDF, tải/xóa file qua proxy có session; multipart và download nhị phân chỉ được forward ở endpoint cho phép, có giới hạn dung lượng.  
**Frontend còn cần làm:** progress/preview ảnh và lý do checklist không đạt; UI SOP/ca trực/đoàn kiểm tra/OKR/quy tắc tự động/khảo sát; quản lý phiên đăng nhập, email và cài đặt thông báo; QR dạng ảnh để in/quét; UI vận hành/backup; PWA/offline và trải nghiệm nâng cao. Những module này cần API/schema và quyết định nghiệp vụ trước, không thể hoàn tất an toàn chỉ ở frontend.

HIS/SSO/Zalo/Telegram/AI tiếp tục tắt theo yêu cầu người dùng. Không coi danh sách trên là đã hoàn tất toàn bộ roadmap.

## Cập nhật 02/11/2026 — nghiệp vụ chuyên sâu (chưa phát hành)

Đã thêm API và giao diện ban đầu trong tab **SOP, trực & chất lượng**:

- SOP: lưu phiên bản, phát hành và xác nhận đã đọc theo phiên bản.
- Lịch trực: lưu nhân viên được phân ca cùng giờ bắt đầu/kết thúc.
- Đào tạo/chứng chỉ: gán nhân viên, hạn hết hạn và nhắc trong ứng dụng tối đa 30 ngày trước khi hết hạn.
- Đoàn kiểm tra: bộ tiêu chí, điểm 0–5 và ghi chú/khắc phục theo từng tiêu chí.
- OKR: mục tiêu theo quý cùng kết quả then chốt và chỉ tiêu.
- Khảo sát: phát hành và trả lời một lần/tài khoản; danh tính được lưu, chỉ người tạo hoặc admin được xem câu trả lời.
- Quy tắc: ngưỡng số việc quá hạn đang mở, thông báo trưởng khoa trong ứng dụng. Quy tắc mới ở trạng thái tạm dừng và chỉ bắt đầu sau khi quản lý phát hành. Bộ thực thi kiểm tra 15 phút/lần, chống lặp bằng khóa thông báo theo việc/người/ngày.
- PWA: cài đặt được, cache vỏ ngoại tuyến tĩnh; không cache API, trang riêng tư hoặc dữ liệu công việc. Mất mạng chỉ có trang hướng dẫn, chưa có sửa việc hoặc đồng bộ offline.

Đây là lát chức năng đầu, chưa thay thế các nghiệp vụ đầy đủ: nhắc đào tạo hiện tạo trong trung tâm riêng của trang, chưa gửi email; OKR chưa có tiến độ snapshot; inspection chưa có luồng phê duyệt; PWA chưa đồng bộ offline. Tích hợp HIS, SSO/LDAP, Zalo/Telegram, email, webhook và AI được báo `false`, không có request ra ngoài.

Migration additive mới là `scripts/advanced-operations-schema.cjs`; yêu cầu bảng work foundation, organization và notifications. **Trong lượt này không chạy migration, không bật `ADVANCED_OPERATIONS_ENABLED`, không thay đổi cấu hình LAN.** API giữ trạng thái unavailable đến khi có kế hoạch bảo trì, backup/restore và phê duyệt riêng.

## Cập nhật 02/11/2026 — hoàn thiện giao diện frontend

Đã bổ sung trong frontend:

- Mẫu import nhân sự là workbook `.xlsx` có header ở dòng đầu; kiểm tra phần mở rộng và giới hạn 2 MB trước khi gọi API preview/commit.
- Checklist có tiến trình tải minh chứng, xem trước ảnh/PDF và tải file riêng; proxy chỉ cho inline các MIME hỗ trợ.
- Proxy cho phép route `/advanced-operations` qua phiên đăng nhập hiện có.
- Nghiệp vụ chuyên sâu hiển thị hạn hiệu lực đào tạo, tiến độ/người phụ trách kiểm tra, xuất biên bản Excel/in PDF, cập nhật tiến độ OKR và xem lịch sử phiên bản, tổng hợp biểu đồ/câu trả lời khảo sát chỉ cho người tạo/admin.
- Lịch ca lưu tham chiếu công việc, ghi chú bàn giao và chu kỳ khai báo; trạng thái tích hợp lấy từ capabilities. Việc sinh task phụ thuộc cờ backend riêng.
- Màn hình KPI chọn ngày/tuần/tháng; workflow có trường ưu tiên cho mẫu, trưởng nhóm không có tab quản trị mẫu/thùng rác, chi tiết thùng rác chỉ đọc.

Đã xác minh trong backend: lịch sử khảo sát là `GET /api/advanced-operations/:id/responses`, trả về `name`, `submittedAt`, `answers`; backend chỉ cho admin hoặc người tạo khảo sát xem danh tính. Frontend hiển thị đúng DTO này.

Đã bổ sung source backend và giao diện cho:

- Danh sách xác nhận SOP theo phiên bản, chỉ người tạo hoặc admin xem; lấy nhân sự đang hoạt động cùng khoa/phòng, loại trừ viewer.
- Lịch sử tối đa 100 lần chạy quy tắc, lưu trạng thái, số việc đánh giá, số thông báo, mã lỗi và thời lượng; không lưu nội dung công việc vào log.
- Lặp ca ngày/tuần/tháng đến ngày kết thúc bắt buộc; giao diện hiển thị tối đa 10 ca sắp tới. Task liên kết phải còn hoạt động và thuộc cùng khoa/phòng; đây là tham chiếu, không tự tạo việc hoặc đồng bộ trạng thái.
- DTO kết quả khảo sát đã đối chiếu với backend: `name`, `submittedAt`, `answers`.

## Bổ sung source — tự sinh công việc theo lịch trực (chưa phát hành)

- Khi cờ `ADVANCED_SHIFT_TASKS_ENABLED=true` và bảng occurrence đã được áp dụng, phát hành lịch trực tạo tối đa một task cho mỗi occurrence trong 30 ngày tới; người trực là người được giao, không tự gán người duyệt.
- Khóa duy nhất theo lịch/phiên bản lịch và thời điểm bắt đầu, cùng khóa trên bản ghi lịch, ngăn job đồng thời tạo task trùng. Job nền chạy lại mỗi 15 phút để bù các lịch phát hành khi server gián đoạn.
- Sửa lịch hoặc tạm dừng/hoàn tất lịch sẽ ẩn task tương lai chưa bắt đầu nếu task chưa tiến hành, chưa gửi duyệt và checklist chưa được thực hiện. Task đã bắt đầu/đã thay đổi được giữ nguyên. Phát hành lại cùng lịch có thể khôi phục task đã hủy nếu task vẫn chưa được thực hiện.
- Quản lý có thể xem trạng thái task theo occurrence trên màn hình lịch trực. Tài khoản nhân viên nhận task trong danh sách công việc sau khi tải lại ứng dụng; hiện chưa có push/websocket để cập nhật tức thời.
- Source và test đã được cập nhật, nhưng **không chạy migration, không bật cờ tự sinh task và không phát hành/restart LAN** trong lượt này. Script `scripts/advanced-operations-schema.cjs` sẽ thêm bảng `advanced_shift_occurrences` nếu thiếu; snapshot DDL của script không phải backup toàn DB.

## Tình trạng phát hành 02/11/2026

Theo xác nhận của người dùng, đã áp dụng migration additive tạo đúng một bảng `advanced_automation_runs`; script xác nhận `recordsDeleted=0`. **Người dùng xác nhận không có backup toàn DB và yêu cầu tiếp tục.** Snapshot DDL mà migration lưu trong `C:\bctk-backend-bvhn\deploy\backups` không phải backup dữ liệu và không thay thế backup toàn DB.

Đã build và chuyển bản theo thư mục release riêng, bật `ORGANIZATION_ENABLED=true` và `ADVANCED_OPERATIONS_ENABLED=true`; `WORK_FOUNDATION_ENABLED=true` tiếp tục giữ nguyên. Restart LAN hoàn tất. `check-lan.cjs` xác nhận backend, login và proxy trả 200; API capability nâng cao yêu cầu đăng nhập (401 khi smoke-test không có session). Các test trình duyệt dùng fixture đạt 19/19. Chưa đăng nhập bằng tài khoản nhân viên thật để kiểm thử luồng nghiệp vụ sau phát hành.

Giữ `HOSPITAL_OPERATIONS_ENABLED`, `EMPLOYEE_IMPORT_ENABLED` và `TASK_EVIDENCE_ENABLED` chưa bật: vận hành bệnh viện cần duyệt chính sách dữ liệu/nhân sự và không nhập dữ liệu bệnh nhân; minh chứng cần thư mục lưu, ACL, quét malware và backup/restore file. HIS/SSO/LDAP/Zalo/Telegram/email/webhook/AI tiếp tục tắt. Ca lặp hiện hỗ trợ sinh task trong source nhưng chưa áp dụng bảng occurrence và cờ riêng vẫn tắt; PWA chưa đồng bộ offline. Vì vậy đây là đợt phát hành các phần nội bộ đủ điều kiện, **không đồng nghĩa hoàn tất toàn bộ roadmap**.

## Cập nhật mã nguồn sau phát hành

Luồng import nhân sự hiện yêu cầu tài khoản mới xác minh OTP rồi đặt mật khẩu riêng tối thiểu 12 ký tự trước khi cấp quyền sử dụng; challenge đổi mật khẩu chỉ có hiệu lực 5 phút và không tạo phiên ứng dụng. Migration additive `scripts/employee-import-schema.cjs` bổ sung `users.mustChangePassword` (mặc định `false`) bên cạnh mã nhân viên. Thay đổi này mới ở source: chưa chạy migration, build release hay bật import trên LAN; phải xem kế hoạch migration, có backup toàn DB đã xác minh và triển khai backend/frontend đồng bộ trước khi kích hoạt.
