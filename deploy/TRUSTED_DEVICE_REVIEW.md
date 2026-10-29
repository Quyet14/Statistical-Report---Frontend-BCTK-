# Ghi nhớ thiết bị cá nhân 30 ngày

Người dùng đã xác nhận cho phép thời hạn 30 ngày trên thiết bị cá nhân và cho phép chuyển bản/khởi động lại. Hai bản build riêng đã thành công; 82 kiểm thử frontend, 90 backend (có Redis thật cô lập) và 14 tình huống trình duyệt HTTPS đã qua. Bản mới đã được chọn và chạy; kiểm tra HTTP và trình duyệt thực tế đạt tại `https://192.168.100.6:3443` sau khi IP Wi-Fi đổi. Checkbox ghi nhớ hiển thị, mặc định tắt; chưa thực hiện đăng nhập/OTP bằng tài khoản thật.

Frontend được build tại `.next-device-release`, backend tại `dist-device-release`. `node scripts/select-device-release.cjs --check` kiểm tra sẵn sàng mà không đổi cấu hình. Khi được cho phép gián đoạn 10–30 giây: dừng launcher, chọn `--activate` (lưu bản sao hai env, không đổi secret) rồi khởi động launcher. Có `--restore` để chọn lại cấu hình trước nếu cần. Không migration DB hay mở thêm cổng mạng nội bộ.

## Hành vi đề xuất

- Lần đầu nhập email, mật khẩu, CAPTCHA và OTP; người dùng chủ động chọn “Ghi nhớ thiết bị cá nhân này”. Mặc định không chọn để phù hợp máy dùng chung trong bệnh viện.
- Mở lại trên trình duyệt đã ghi nhớ trong thời hạn được duyệt: tự khôi phục sau khi backend kiểm tra tài khoản, trạng thái thiết bị và tokenVersion.
- Chủ động đăng xuất: thu hồi phiên hiện tại và tắt tự vào lại, giữ khả năng nhận diện thiết bị. Lần đăng nhập kế tiếp bắt buộc đúng email/mật khẩu và CAPTCHA, có thể bỏ OTP nếu thiết bị vẫn hợp lệ.
- Thiết bị mới, cookie bị xóa, hết thời hạn, đổi mật khẩu hoặc thiết bị bị hủy ghi nhớ: yêu cầu OTP trở lại. Không lưu mật khẩu hay token trong localStorage.
- Khóa sau 30 phút không thao tác vẫn được giữ. Trên thiết bị đã ghi nhớ, có thể bấm tiếp tục để mở lại; không tự mở khóa ngay sau khi tự khóa.
- Có “Quên thiết bị này và đăng xuất”; thu hồi thiết bị làm các phiên liên kết không còn hợp lệ.

## Lưu và kiểm tra

Cookie HttpOnly, Secure trên HTTPS, SameSite=Lax; Redis lưu hash của bí mật ngẫu nhiên, hash User-Agent, ID tài khoản, tokenVersion, hạn tuyệt đối và trạng thái tự đăng nhập. Bí mật thiết bị xoay vòng khi dùng lại, có grace 15 giây cho các request đồng thời. Đổi IP mạng không tự làm mất ghi nhớ. Không coi User-Agent là một yếu tố xác thực độc lập.

Thời hạn **30 ngày**, tính từ lần OTP tạo thiết bị; không tự kéo dài vô hạn. Khi cookie còn hiệu lực, người có quyền sử dụng trình duyệt này có thể vào lại tài khoản, vì vậy chỉ bật trên thiết bị cá nhân có khóa màn hình. Bỏ chọn ghi nhớ ở lần đăng nhập thành công sẽ xóa ghi nhớ cũ.

Backend dùng `src/common/trusted-devices.ts`, DTO thiết bị và các API `device-status`, `resume-device`, `forget-device`, `end-session`. Frontend giữ bí mật thiết bị trong cookie `careops_device`; JavaScript chỉ nhận trạng thái. Trang tài khoản có nút hủy ghi nhớ và đăng xuất.
