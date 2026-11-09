# Phụ thuộc công việc

Trong thẻ công việc hoặc cửa sổ chi tiết ở trang Quy trình công việc, mở **Phụ thuộc công việc**. Người quản lý tìm việc theo tên/người thực hiện, chọn việc tiên quyết và lưu. Có phân trang, tối đa 50 liên kết trực tiếp; tự phụ thuộc và vòng phụ thuộc bị từ chối. Nhân viên và tài khoản chỉ xem không có nút sửa.

Việc có phụ thuộc chỉ được bắt đầu, tăng tiến độ, tick hoàn thành checklist, gửi duyệt hoặc duyệt khi mọi việc tiên quyết đã hoàn tất và được duyệt nếu có người duyệt. Việc trong thùng rác không được tính là hoàn tất. Chỉ thay đổi liên kết khi việc chưa bắt đầu, tiến độ 0 và chưa khóa. Liên kết không tự sao chép sang việc định kỳ mới.

Không cho mở lại, xóa hoặc thay đổi checklist làm mất trạng thái hoàn tất của việc trước khi việc sau đã bắt đầu. Quy tắc cũng áp dụng khi thêm người duyệt hoặc ghi nhận sự cố checklist. Đưa việc sau về chưa bắt đầu trước khi sửa việc trước; việc sau đã khóa phải được người có quyền mở lại theo quy trình hiện có. Khôi phục việc đã chạy cũng phải kiểm tra lại việc tiên quyết.

API kiểm tra phạm vi khoa/nhóm/người thực hiện bằng thông tin hiện tại ở DB. Liên kết do admin đặt tới việc ngoài phạm vi vẫn hiển thị tình trạng chờ/đủ điều kiện, nhưng ẩn tiêu đề. Không cấp thêm quyền đọc công việc khác. Thay đổi liên kết ghi nhật ký trước/sau trong cùng giao dịch.

## Triển khai

Backend cần `WORK_FOUNDATION_ENABLED=true` và migration nền tảng. Chạy từ thư mục backend:

```powershell
node scripts/dependency-schema.cjs --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env
node scripts/dependency-schema.cjs --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env --apply
```

Migration thêm `task_dependencies`, `task_dependency_mutex` và một bản ghi khóa; không xóa/chuyển dữ liệu công việc cũ. Có backup DDL trước thay đổi; đây không phải backup dữ liệu. Sau khi kiểm tra schema mới bật `TASK_DEPENDENCIES_ENABLED=true` và chạy bản backend/frontend mới.

Khóa DB dùng chung được lấy trước khóa công việc ở mọi đường cập nhật trạng thái, giúp tránh vòng phụ thuộc hoặc tình trạng kiểm tra xong nhưng việc trước bị mở lại bởi yêu cầu đồng thời. Hiện các giao dịch ghi này chạy lần lượt qua một khóa; truy vấn đọc không lấy khóa. Cần đo tải thực tế trước khi tăng quy mô lớn hơn.

Không tắt riêng cờ tính năng khi đã sử dụng liên kết: tắt cờ cũng bỏ thực thi quy tắc. Khi rollback cần giữ bản backend có kiểm tra phụ thuộc hoặc tạm ngừng thao tác ghi cho đến khi xử lý liên kết.

## Kiểm thử

Integration MySQL dùng schema ngẫu nhiên tạm, chỉ sao chép cấu trúc bảng; không sao chép dữ liệu người dùng thật:

```powershell
$env:TEST_BACKEND_RELEASE='dist-work-release-20261104-dependencies'
node test/fullstack-review.integration.cjs --allow-temporary-schema --env=C:/bctk-bvhn-frontend/deploy/.runtime/backend.env
```

Bao gồm kiểm tra quyền HTTP/DTO, ẩn tiêu đề, tự phụ thuộc/vòng nhiều cấp, chặn trạng thái/checklist/duyệt, mở lại/thùng rác, nhật ký và hai tình huống cập nhật đồng thời. Schema tạm được dọn khi kết thúc. Playwright kiểm tra tìm/chọn/lưu/bỏ liên kết trên mobile, lỗi server giữ bản nháp và chế độ chỉ xem qua HTTPS giả lập.
