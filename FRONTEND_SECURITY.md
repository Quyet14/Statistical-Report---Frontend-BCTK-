# Frontend và backend trước production

## Ghi nhớ thiết bị cá nhân 30 ngày

- Người dùng chủ động chọn ghi nhớ ở lần đăng nhập OTP đầu tiên; mặc định tắt. Cookie `careops_device` HttpOnly/Secure/SameSite=Lax có hạn tuyệt đối 30 ngày, không lưu mật khẩu hoặc token trong localStorage. Redis lưu hash bí mật, hash User-Agent, userId/tokenVersion, trạng thái tự vào lại và hạn tuyệt đối. Đổi IP không tự làm mất ghi nhớ; đổi trình duyệt/User-Agent có thể yêu cầu OTP lại.
- Khi mở lại trên thiết bị hợp lệ, Next gọi backend khôi phục phiên sau kiểm tra DB. Bí mật thiết bị được xoay vòng; có grace 15 giây cho các request đồng thời, không kéo dài hạn gốc. Refresh session vẫn tối đa 12 giờ; thiết bị đã ghi nhớ có thể xác thực tạo phiên mới trong thời hạn 30 ngày. Thiết bị không ghi nhớ giữ chính sách trước đó.
- Chủ động logout thu hồi phiên hiện tại và tắt tự vào lại nhưng giữ nhận diện để lần sau nhập đúng mật khẩu và CAPTCHA có thể bỏ OTP. Không gửi mật khẩu đúng vẫn bị từ chối trước bước nhận diện thiết bị. Bỏ chọn ghi nhớ khi đăng nhập thành công xóa ghi nhớ cũ. Đổi mật khẩu, khóa tài khoản, hết hạn hoặc quên thiết bị chặn khôi phục và yêu cầu OTP lại.
- Khi không hoạt động 30 phút, `/auth/end-session` thu hồi phiên nhưng giữ ghi nhớ; `/login?reason=idle` không tự mở khóa. Người dùng có thể bấm tiếp tục trên thiết bị đã ghi nhớ; truy cập mới vào ứng dụng có thể khôi phục tự động. `/auth/logout` là đăng xuất chủ động, `/auth/forget-device` hủy ghi nhớ và thu hồi các phiên liên kết qua deviceId. Mọi API ghi đều kiểm tra Origin và gateway có chữ ký.
- Next chỉ lấy deviceToken và User-Agent từ cookie/header của request, ghi đè các trường do JavaScript tự gửi; không trả bí mật thiết bị trong JSON. Trạng thái thiết bị chỉ gồm remembered/autoLogin/expiresAt. Có nút “Quên thiết bị này và đăng xuất” ở trang tài khoản và nút quên thiết bị trên trang đăng nhập. Chi tiết: `deploy/TRUSTED_DEVICE_REVIEW.md`.

## CAPTCHA và hiển thị OTP

- Đăng nhập yêu cầu CAPTCHA ảnh PNG gồm 6 ký tự. Đáp án không trả về JSON/SVG; cookie challenge HttpOnly/SameSite=Strict, Secure trong production. Mã hết hạn sau 5 phút, ràng buộc IP đã được gateway xác minh, chỉ được thử một lần; đổi mã hủy mã cũ. Giới hạn 20 lần tạo/IP/phút và bộ nhớ tối đa 5.000 challenge, chặn khi đầy. Next.js kiểm tra trước khi gửi thông tin tới NestJS và bỏ trường captcha khỏi DTO.
- Kho challenge hiện ở bộ nhớ của một tiến trình Next.js, phù hợp bộ LAN một instance hiện tại; khởi động lại làm mất mã đang nhập. Khi chạy nhiều instance/worker phải chuyển kho challenge và bộ đếm sang Redis dùng chung trước khi triển khai. CAPTCHA bổ sung cho rate limit, không thay thế rate limit hoặc OTP.
- Bước OTP chỉ hiển thị email đã che, dùng thông báo cố định để tránh lộ email từ thông điệp backend. Sáu ô hỗ trợ nhập từng số, dán mã, tự chuyển ô, phím mũi tên và Backspace. Email đầy đủ vẫn cần thiết trong request xác minh, không được xem là bí mật khỏi chính trình duyệt của người đăng nhập.

## Luồng triển khai

`Trình duyệt HTTPS → gateway tin cậy → Next.js → NestJS → Redis/DB/SMTP`

Trình duyệt chỉ gọi `/api` cùng origin. Next giữ JWT trong cookie HttpOnly rồi gắn Bearer cho Nest; không cần bật `credentials: true` trên CORS backend. Không dùng static export.

`server.js` là API cũ, bị chặn trước khi tạo pool DB nếu không đồng thời đặt `NODE_ENV=development` và `ALLOW_LEGACY_BACKEND=true`. Khi được cho phép, nó chỉ nghe loopback ở cổng riêng 3099; cổng 3010 bị cấm. Không đưa dịch vụ này vào production. Production bắt buộc `API_BACKEND_URL` và kiểm tra header nhận diện `X-CareOps-Backend: nest-v1`; header này giúp phát hiện nhầm dịch vụ, không thay thế TLS/xác thực.

## Các biến production bắt buộc

| Nơi | Biến | Ý nghĩa |
| --- | --- | --- |
| Next | `FRONTEND_ORIGIN=https://careops.example.com` | Origin công khai cố định, không kèm path; không suy ra từ Host/X-Forwarded-Host |
| Next | `API_BACKEND_URL` | URL Nest cùng máy hoặc HTTPS tới mạng khác; không dựa vào fallback NEXT_PUBLIC trong production |
| Next | `TRUSTED_EDGE_ENABLED=true` | Bắt buộc trong production |
| Gateway + Next | `TRUSTED_EDGE_SECRET` | Secret ngẫu nhiên ít nhất 32 byte, chỉ gateway và Next biết |
| Next + Nest | `BFF_PROXY_SECRET` | Secret độc lập ít nhất 32 byte, khác JWT_SECRET và secret gateway |
| Nest | `RATE_LIMIT_REDIS_URL` | Redis dùng chung cho tất cả worker/replica; dùng TLS/ACL và mạng riêng theo môi trường |
| Nest | `RATE_LIMIT_PREFIX` | Cùng prefix giữa các replica một môi trường; khác prefix giữa staging/production |

Sinh từng secret độc lập bằng `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Không commit secret hoặc đưa vào `NEXT_PUBLIC_*`. Không thay `.env.local` hiện tại bằng cấu hình production khi chưa có gateway/Redis phù hợp.

## IP tin cậy và rate limit dùng chung

1. Gateway **ghi đè** `X-CareOps-Client-IP` bằng địa chỉ socket đã xác minh và thêm `X-CareOps-Edge-Key`. Gateway xóa các header forwarded/assertion của người gọi. Next phải bị chặn truy cập trực tiếp từ Internet.
2. Next kiểm tra edge secret bằng so sánh constant-time, kiểm tra IP đơn hợp lệ, rồi ký HMAC-SHA256 trên method, path/query, IP và timestamp. Không chuyển tiếp mù X-Forwarded-For.
3. Nest xác minh chữ ký và thời gian lệch tối đa 30 giây trước rate limiter. Khi cấu hình BFF secret, thiếu/sai chữ ký bị từ chối. Đồng bộ đồng hồ giữa Next/Nest; chỉ mở Nest cho mạng Next.
4. Các limiter API/IP, auth/IP và auth/email dùng ba Redis prefix riêng, chung Redis giữa các worker. Redis không kết nối được thì production không khởi động; lỗi store khi chạy không bỏ qua rate limit. Development không cấu hình Redis vẫn có thể dùng MemoryStore.

Đã có mẫu gateway để review tại `deploy/nginx.conf.example`, **chưa được cài hoặc reload**. Nếu có LB/CDN trước gateway, chỉ cấu hình real-IP từ IP/CIDR của LB đã xác minh; không tin mọi địa chỉ. Redis/WAF, firewall, secret rotation và giám sát phải triển khai trên hạ tầng thực tế.

## Origin và CSRF

- Mọi POST/PATCH/PUT/DELETE, kể cả login/logout, phải có Origin khớp `FRONTEND_ORIGIN`; khi thiếu Origin mới dùng origin của Referer. Thiếu cả hai, Origin `null`/sai hoặc Sec-Fetch-Site `cross-site` đều bị chặn.
- Không dùng Host/X-Forwarded-Host do người gọi cung cấp để suy ra origin hợp lệ. Development chỉ dùng danh sách origin cục bộ rõ ràng khi chưa khai báo biến.
- POST/PATCH/PUT yêu cầu JSON, body tối đa 64 KiB. Script kiểm tra bằng curl phải gửi Origin hợp lệ. Gateway phải giữ Origin/Referer từ trình duyệt.

## CSP và HTTPS

- Proxy tạo nonce mật mã mới cho mỗi request, ghi đè nonce/CSP đầu vào. Root layout render động; Next gắn nonce vào script và ConfigProvider truyền nonce cho Ant Design/icons.
- Production không có `unsafe-eval` hay `unsafe-inline` cho script; chỉ cho tài nguyên cùng origin, chặn object, frame-ancestors và base-uri ngoài origin. `style-src-attr 'unsafe-inline'` được giữ riêng cho React progress bars và vị trí động của Ant Design; style element dùng nonce.
- CSP development cho phép eval và WebSocket để Next dev hoạt động. Không dùng CSP `default-src 'none'` của API cho HTML.
- Next gửi HSTS `max-age=31536000` trong production; gateway phục vụ HTTPS và chuyển HTTP sang HTTPS. Không bật includeSubDomains/preload khi chưa rà soát toàn domain. Không cache dùng chung HTML có nonce; không thêm CSP mâu thuẫn tại gateway.

## Phiên và giao diện theo quyền

- OTP đúng 6 số tạo cookie `careops_session` (access token 15 phút) và `careops_refresh` (refresh token xoay vòng, tối đa 12 giờ): cả hai HttpOnly, SameSite=Lax, Secure trong production. Không trả token về JavaScript và không lưu token trong localStorage.
- Tải lại trang lấy tài khoản/quyền hiện tại từ `/auth/me`. 401 của API bảo vệ xóa phiên và về login; 403 hiển thị thiếu quyền, giữ cookie và không tự chuyển login, kể cả tại RequireAuth.
- Nest có POST `/auth/refresh` và `/auth/logout`; Next lấy refresh token từ cookie, bỏ qua token do JavaScript gửi và chỉ trả tài khoản về trình duyệt. Redis lưu hash token, ID tài khoản, tokenVersion, mốc tạo/hoạt động; TTL không hoạt động 30 phút, hạn cứng 12 giờ. Refresh xoay vòng bằng Lua nguyên tử, cho phép cùng token trước đó trong 15 giây để tránh lỗi nhiều tab; tái sử dụng sau khoảng này thu hồi phiên. Quyền/trạng thái/tokenVersion được đọc lại từ DB khi gia hạn. JWT mới có sid; guard kiểm tra phiên Redis để logout thu hồi cả access token hiện tại. Redis lỗi trả 503, không tự đăng xuất.
- Khi có thao tác, frontend gia hạn tối đa một lần/phút theo mốc dùng chung giữa các tab; không gia hạn chỉ vì timer chạy. BFF cũng gia hạn trước API nếu access token gần hết hạn/mất cookie, rồi chuyển tiếp thao tác đúng một lần. Không tự gửi lại POST/PATCH sau khi backend đã trả lỗi. Mọi lần gia hạn vẫn kiểm tra gateway/Origin, kể cả GET cần khôi phục phiên qua Referer/Origin cùng nguồn.
- Frontend cảnh báo trước 60 giây và tự thoát sau 30 phút không hoạt động; kiểm tra lại khi tab hiện lên để không bị timer nền trì hoãn. localStorage chỉ chứa mốc thời gian hoạt động/gia hạn/kết thúc, không chứa thông tin tài khoản hay token. Đóng trình duyệt không kéo dài hạn idle hoặc hạn cứng. Người dùng phiên cũ cần đăng nhập lại một lần để nhận refresh cookie mới. Đổi mật khẩu/khóa tài khoản làm refresh thất bại; logout thu hồi Redis trước khi xóa cookie.
- 400 hiển thị thông điệp DTO; 429 chờ Retry-After và đếm ngược, không tự retry POST. Quên mật khẩu dùng thông báo chung. Dữ liệu React được escape; không log OTP/mật khẩu/token.
- Báo cáo chỉ admin; trưởng khoa quản lý nhân viên khoa mình; backend quyết định quyền thực tế.

## Kiểm tra và các bước chưa thực hiện

`npm run build`

Hướng dẫn chạy trên Wi-Fi/LAN và chuyển server nội bộ: [deploy/INTERNAL_NETWORK.md](deploy/INTERNAL_NETWORK.md). Có bộ tạo cấu hình riêng, launcher Windows, kiểm tra schema additive và kiểm thử Playwright/Redis thật có thể tái lập trên CI.

`node --test --test-isolation=none tests/*.test.cjs`

Backend: `npm run build`, `npm test -- --runInBand`, `npm audit --omit=dev`.

Unit/E2E trình duyệt dùng upstream giả lập, không ghi DB nghiệp vụ hay gửi email. Integration Redis chạy với Redis thử nghiệm riêng và kiểm tra gián đoạn/kết nối lại. Máy LAN đã được bổ sung unique index OTP bằng công cụ additive có bản sao schema; không có bản ghi bị xóa. SMTP đã xác minh kết nối, chưa gửi OTP thật. Trước chuyển server nội bộ cần backup toàn DB, kiểm tra schema và dùng chứng chỉ CA nội bộ, rồi xác minh đăng nhập → OTP → thao tác theo quyền → hết phiên trên máy đích.

Tham chiếu: [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy), [express-rate-limit stores](https://express-rate-limit.mintlify.app/reference/stores).
