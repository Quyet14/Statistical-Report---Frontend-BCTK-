# Tối ưu thao tác — 06/11/2026

- Menu dùng chuyển trang của Next Link. Đã bỏ `preventDefault` và `window.location.href` gây tải lại toàn bộ document ở mỗi lần bấm. Khung giao diện, phiên và TaskProvider được giữ trong layout dùng chung.
- Thêm loading boundary để hiển thị phản hồi khi chờ trang động và cho phép prefetch một phần theo cơ chế của Next.js hiện tại.
- Vành sao phát sáng được raster hóa một lần theo kích thước rồi dùng lại; các khung chuyển động chỉ vẽ hạt, hành tinh và tia sáng. Không chạy lại hàng chục phép shadow blur cho vành sao trong mỗi frame.
- Giới hạn nền toàn màn hình khoảng 900.000 pixel, banner 400.000 pixel; giảm hạt và nhịp vẽ trên điện thoại. Không giảm độ phân giải của chữ hoặc nội dung nghiệp vụ.
- Dừng animation khi cuộn, bấm hoặc gõ, chờ thao tác ngừng rồi tiếp tục; trì hoãn resize nền trong thời gian này. Vẫn tôn trọng giảm chuyển động, dừng khi tab ẩn/cảnh ngoài viewport và lựa chọn tĩnh/tắt của người dùng.
- Bỏ backdrop blur trên sidebar và header thu gọn khi có nền thiên hà; cô lập vùng paint của canvas.

Kiểm tra trình duyệt dùng backend/tài khoản giả qua HTTPS riêng, không đăng nhập hoặc gửi OTP thật. Kiểm thử xác nhận chuyển ba trang không có document request mới, canvas layout vẫn tồn tại, giới hạn pixel, nhường tương tác và tái sử dụng vành sáng; kiểm tra cũ bao gồm chuyển động/tĩnh/tắt và bố cục 390px.

Bản `.next-work-release-20261106-smooth`: build/TypeScript đạt; 13 test đăng nhập/phân quyền và 2 test Chrome HTTPS đạt. ESLint cho renderer/loading boundary đạt. Kiểm tra toàn bộ AppSidebar còn quy tắc `set-state-in-effect` ở phần đọc tùy chọn menu có từ trước; lần sửa này chỉ bỏ ép tải lại trang trong Link.

Trong lúc kiểm thử, máy 8 GB có thời điểm chỉ còn 207 MB RAM trống. Đây là giới hạn môi trường; không tuyên bố mức tăng FPS hay thời gian phản hồi trên mọi thiết bị. Không đóng IDE, trình duyệt hoặc dịch vụ không thuộc tác vụ.
