# Chạy thử Wi-Fi/LAN rồi chuyển server nội bộ

## Đang chạy trên máy kiểm thử

Bản ghi nhớ thiết bị được build riêng, không ghi đè bản đang chạy: frontend `$env:CAREOPS_RELEASE='device'; npm run build` tạo `.next-device-release`; backend `node node_modules/typescript/bin/tsc --project tsconfig.build.json --outDir dist-device-release --tsBuildInfoFile dist-device-release/tsconfig.tsbuildinfo` tạo `dist-device-release`. Kiểm tra bằng `node scripts/select-device-release.cjs --check`. E2E dùng `$env:CAREOPS_RELEASE='device'; $env:E2E_HTTPS_PORT='3444'; npm run test:e2e:run` trên fixture riêng, giữ nguyên gateway LAN 3443.

Chỉ trong thời gian bảo trì đã được đồng ý: dừng bộ launcher, chạy `node scripts/select-device-release.cjs --activate`, rồi khởi động lại launcher. Lệnh chọn bản chỉ sửa hai env dưới `.runtime`, không đổi secret; lưu bản trước ở `.runtime/device-release-previous.json` (chứa bí mật, không chia sẻ). Nếu cần quay lại cấu hình trước, dùng `--restore` rồi khởi động lại bộ dịch vụ. Không tự chuyển cấu hình hoặc dừng dịch vụ khi chưa cho phép gián đoạn.

- Origin kiểm thử: `https://192.168.100.4:3443` (phải cùng Wi-Fi/LAN).
- Bộ LAN hiện dùng Next và Nest trên loopback 3300/3310; thiết bị khác truy cập qua gateway HTTPS 3443. Cổng 3000/3010 dành cho development riêng.
- `deploy/.runtime` chứa cấu hình riêng, chứng chỉ tự ký, Redis password và secret; thư mục này bị Git bỏ qua. Không gửi thư mục này cho người không được phép, không chụp/log nội dung env.
- Chứng chỉ tự ký chỉ dùng kiểm thử. Thiết bị khác cần chấp nhận chứng chỉ hoặc được quản trị viên cài chứng chỉ tin cậy phù hợp. Không bỏ xác minh TLS cho production, không tự cài root CA trên máy người dùng.
- IP Wi-Fi có thể đổi. Nếu đổi IP/origin, tạo bộ cấu hình mới ở thư mục runtime khác; không sửa riêng Origin mà quên chứng chỉ/SAN. Server nội bộ nên có IP/DNS cố định và chứng chỉ CA nội bộ.

## Tạo cấu hình mới

Từ thư mục frontend, dùng backend nằm cạnh frontend hoặc truyền `--backend-dir`:

```powershell
node scripts/deployment-config.cjs --generate --origin=https://192.168.100.4:3443 --lan
node scripts/deployment-config.cjs --check --generated
```

Công cụ tạo secret mới, sao chép cấu hình DB/SMTP hiện có sang bộ env riêng, không ghi đè `.env` đang dùng và từ chối ghi đè bộ runtime đã có. Khi tạo cho server mới, đặt `--out=deploy/.runtime-server`; giữ thư mục này riêng tư. Đường dẫn chạy dịch vụ cũng có thể truyền thư mục runtime đó.

Trên server thật, thay `--lan` bằng `--cert=... --key=...` với chứng chỉ của CA nội bộ và dùng HTTPS origin thực tế. Nginx config chứa đường dẫn tuyệt đối; tạo lại trên đúng máy đích. Windows nginx portable chỉ dành cho kiểm thử ở đây; production dùng gateway được quản trị hỗ trợ (Linux nginx hoặc gateway/IIS phù hợp).

## Khởi động

Nếu vẫn mở terminal `npm run dev` trong lúc thử bộ HTTPS, có thể đặt `DEV_LOGIN_GATEWAY_ORIGIN=https://192.168.100.4:3443` trong `.env.local`. Trang `/`, `/login`, `/forgot-password` ở development sẽ chuyển tạm thời sang gateway; không chuyển tiếp POST API hoặc bỏ kiểm tra bảo mật. Biến này không áp dụng cho production. Xóa biến khi quay lại chế độ development độc lập; cập nhật khi đổi IP của gateway.

Chỉ chạy một bộ LAN do launcher quản lý. Bản LAN build riêng dùng 3300/3310, development có thể dùng 3000/3010. Không chạy hai tiến trình cùng cổng hoặc build đè thư mục của bản đang phục vụ; lỗi `EADDRINUSE` nghĩa là cổng đã có tiến trình lắng nghe.

Truy cập bằng HTTPS origin trong `deploy/.runtime/manifest.json` (máy thử hiện tại: `https://192.168.100.4:3443`). Truy cập trực tiếp HTTP cổng 3000 hoặc HTTPS bằng hostname khác sẽ không khớp cấu hình Origin/gateway và bị chặn. Khi Wi-Fi đổi IP, cần tạo lại bộ cấu hình cho IP mới. Không tắt kiểm tra Origin hoặc chữ ký để bỏ qua lỗi này.

```powershell
docker compose -p careops-lan -f deploy/.runtime/redis.compose.yml up -d
# Build hai repo trước khi khởi động dịch vụ; dừng dịch vụ trước khi build lại.
npm run build
# Terminal riêng cho từng dịch vụ:
node scripts/run-service.cjs backend
node scripts/run-service.cjs frontend
```

Backend cần có `dist/main.js` từ `npm run build` ở repo backend. Khởi động nginx với `deploy/.runtime/nginx.conf`; kiểm tra `nginx -t` trước. Nginx binary và logs nằm dưới runtime trên máy thử, không phải dependency production của Next/Nest. Mở đúng cổng HTTPS trên firewall cho subnet nội bộ; không mở DB/Redis/3010 ra Wi-Fi.

Windows đã được chuẩn bị launcher `scripts/lan-services.ps1 -Action start|stop|status` để quản lý các tiến trình riêng; `stop` giữ nguyên Redis volume và dữ liệu. Khi cần mở truy cập từ thiết bị Wi-Fi khác, chạy **PowerShell Administrator** một lần:

```powershell
& C:\bctk-bvhn-frontend\scripts\open-lan-firewall.ps1
```

Script chỉ cho đúng nginx ở IP origin hiện tại nhận TCP 3443 từ LocalSubnet, không tắt firewall và không mở DB/Redis/backend. Thêm `-Remove` để thu hồi đúng rule này. Trên máy kiểm thử, rule đã được áp dụng qua UAC; trạng thái xác nhận lưu ở `deploy/.runtime/firewall-status.json`. Gateway/ứng dụng đã được kiểm tra tại URL HTTPS bằng request cục bộ; thiết bị Wi-Fi khác vẫn cần cùng subnet và không bị AP/router cách ly.

## Schema, SMTP và health

Trong repo backend:

```powershell
npm run schema:check
npm run schema:apply
```

`schema:apply` là công cụ additive/idempotent: lưu bản sao schema ở `deploy/backups`, bổ sung cột/độ dài/index còn thiếu, từ chối nếu OTP bị trùng nhóm, không xóa tài khoản hoặc OTP. Đây là bản sao schema, không thay thế backup toàn DB trước một đợt triển khai chính thức. Không chạy lại SQL migration cũ có câu DELETE OTP trên DB đã nâng cấp.

`http://127.0.0.1:3310/health/ready` trả 200 khi Redis sẵn sàng và 503 khi Redis mất kết nối. Backend giữ chặn request khi Redis lỗi, tự reconnect có backoff; không cần tắt rate limit để phục hồi.

SMTP đã kiểm tra được kết nối/xác thực trên máy thử; chưa gửi email tới người dùng. Người kiểm thử tự đăng nhập bằng tài khoản của mình để xác minh OTP đầu cuối. Secret mới của bộ triển khai khiến phiên cũ phải đăng nhập lại.

## Kiểm thử tái lập

- Frontend: `npm test`, `npm run test:e2e` (cài `npx playwright install chromium`; máy Windows có Chrome dùng `$env:E2E_BROWSER_CHANNEL='chrome'`). E2E tự khởi động backend giả lập và gateway HTTPS riêng, không dùng DB hoặc SMTP thật.
- Backend: `npm test -- --runInBand`; thêm `RUN_REDIS_INTEGRATION=true`, `REDIS_INTEGRATION_URL=redis://127.0.0.1:16379` để kiểm thử reconnect/bộ đếm với Redis thử nghiệm riêng. Không dùng Redis production cho integration test.
- Hai repo đều có workflow CI: build, audit production và test. Backend CI có Redis thật; frontend CI có Chromium/HTTPS.

Khi Wi-Fi có client isolation hoặc thiết bị ở subnet khác, cần quản trị mạng cho phép kết nối tới cổng HTTPS; ứng dụng không thể tự bỏ cách ly của router/AP.

## Khôi phục sau khi tắt máy hoặc đổi Wi-Fi

Mở Docker Desktop, sau đó chạy `./scripts/lan-services.ps1 -Action start` tại frontend. Dùng `node scripts/check-lan.cjs` để xem URL hiện tại và kiểm tra gateway/backend/proxy. Máy thử không tự khởi động các tiến trình Node/nginx sau khi Windows tắt.

Nếu IP Wi-Fi đổi, xác minh IP của máy trước rồi chạy `node scripts/prepare-lan-runtime.cjs --host=IP_THUC_TE` khi bộ LAN đã dừng. Công cụ kiểm tra IP được gắn trên máy, giữ nguyên secret và Redis prefix, dùng lại chứng chỉ còn hạn có SAN phù hợp hoặc tạo chứng chỉ thử mới; cổng nội bộ giữ 3300/3310. Với PowerShell Administrator, `./scripts/open-lan-firewall.ps1 -RefreshLocalAddress` chỉ cập nhật IP cục bộ của đúng rule nginx/3443/LocalSubnet đã có. Không tắt kiểm tra Origin hoặc mở 3300/3310 ra mạng.

Bản duyệt việc, việc lặp lại và báo cáo có hướng dẫn chuyển bản riêng tại [WORK_FOUNDATION.md](WORK_FOUNDATION.md).

## Cập nhật giao diện và tránh trùng cổng

`npm run deploy:lan` build vào thư mục release riêng, chỉ thay frontend sau khi build xong; backend, Redis và nginx tiếp tục chạy. Nếu health không đạt, script khôi phục lựa chọn frontend trước đó. Sau khi thành công, tải lại trình duyệt một lần.

Chỉ dùng launcher cho bộ LAN; không chạy thêm backend `npm run start:dev` trên cùng cổng 3310. Launcher từ chối start khi cổng đã bị chiếm và không tự dừng tiến trình ngoài quản lý. Kiểm tra trạng thái bằng `./scripts/lan-services.ps1 -Action status` và health bằng `node scripts/check-lan.cjs`.

Có thể dừng/chạy riêng bằng `-Action stop -Service frontend` rồi `-Action start -Service frontend`; tương tự với `-Service backend`. Chỉ dùng khi đã có bộ LAN được quản lý; không thay cấu hình release khi dịch vụ đó còn đang chạy.
