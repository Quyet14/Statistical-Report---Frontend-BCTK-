# Báo cáo số liệu HIS

Trang `/reports/hospital` gọi API NestJS `GET /reports/hospital?period=day|month|year&date=YYYY-MM-DD` qua proxy cùng origin. API và menu chỉ dành cho admin. Không có form cấu hình SQL hoặc mật khẩu trên web.

## Cấu hình backend

Trong `.env` của backend, tách riêng khỏi database CareOps `DB_*`:

```dotenv
HIS_REPORT_ENABLED=true
HIS_REPORT_DRIVER=mssql
HIS_REPORT_HOST=192.168.0.19
HIS_REPORT_PORT=1433
HIS_REPORT_DATABASE=eHospital_HuuNghi
HIS_REPORT_USERNAME=
HIS_REPORT_PASSWORD=
HIS_REPORT_ENCRYPT=true
HIS_REPORT_TRUST_SERVER_CERTIFICATE=false
HIS_REPORT_CONNECTION_TIMEOUT_MS=10000
HIS_REPORT_REQUEST_TIMEOUT_MS=20000
HIS_REPORT_POOL_MAX=3
HIS_REPORT_FPT_ENABLED=false
```

Tài khoản/mật khẩu chỉ nhập trên máy chủ backend. `.env` không đưa lên Git. Driver luôn mã hóa TLS. Máy SQL thử nghiệm hiện dùng chứng chỉ tự ký: người dùng đã cho phép đặt riêng `HIS_REPORT_TRUST_SERVER_CERTIFICATE=true` cho kết nối HIS nội bộ. Các kết nối khác không bị ảnh hưởng. Khi triển khai chứng chỉ CA, trả tùy chọn về `false`.

Đổi `.env` cần khởi động lại backend. Launcher LAN có thể dùng bản build/backend env riêng; kiểm tra phiên bản được chọn và tránh ghi đè cấu hình HIS bằng snapshot cũ. Frontend không đọc các biến `HIS_REPORT_*`.

## Quy tắc đã triển khai

### Đối chiếu dashboard FPT

Đặt `HIS_REPORT_FPT_ENABLED=true` tại backend để đọc bốn chỉ số tổng quan của **ngày hiện tại** trực tiếp từ `Dashboard_Core.dbo.BOARDOFMANAGER_DATA`, nối `Dashboard_Core.dbo.PARAM`, lọc bệnh viện `HUUNGHI`, dashboard `BOARDOFMANAGER`, biểu đồ `CHUNG`. Đây là cùng các dòng `KHAMBENH`, `CAPCUU`, `NAMVIEN`, `DOANHTHU` được API FPT `/Service/GetData?typeDashboard=2` sử dụng. Không gọi thủ tục cập nhật và không ghi vào nguồn HIS/FPT.

Giao diện giữ nguyên sáu ô và hệ thống biểu đồ hiện có. Lượt khám và đang điều trị nhận giá trị tham chiếu tương ứng khi có nguồn tổng hợp ngày hiện tại; cấp cứu và doanh thu tham chiếu được giữ trong dữ liệu API để đối chiếu, không tạo thêm ô hoặc đổi tên ô. Doanh thu FPT không thay thế thực thu sau hoàn trả. Công suất giường, thực thu và biểu đồ chi tiết vẫn dùng các định nghĩa HIS bên dưới. Không suy ra cơ cấu cấp cứu hoặc phân bổ chênh lệch khoa/phòng từ các tổng FPT khác phạm vi.

Dashboard_Core không có ngày chốt/lịch sử trong cấu trúc đang đọc. Không gán số hiện tại cho ngày cũ, tháng hoặc năm; các kỳ đó tiếp tục lấy HIS trực tiếp. Thời gian đọc nguồn không được hiểu là thời gian FPT hoàn tất tổng hợp. Nếu bật nguồn FPT nhưng thiếu dòng, trùng chỉ số hoặc giá trị không hợp lệ, API báo lỗi thay vì âm thầm thay bằng một công thức khác. Cache được tách theo nguồn để không dùng nhầm dữ liệu qua ngày.

- Lượt khám: đếm phiếu `dbo.KhamBenh` theo `NgayKham`, không phải số người duy nhất. Khoa từ `PhongBan_Id`; phân loại cấp cứu theo `KhamCapCuu`.
- Nhập viện: đếm `dbo.BenhAn` theo `NgayVaoVien`, có phiếu `dbo.NoiTru_NhapVien` liên kết. Dùng `EXISTS` để tránh nhân bản khi nhiều phiếu liên kết.
- Xuất viện: cùng tập bệnh án trên, theo `NgayRaVien`. Nhập/xuất chỉ nhận trạng thái đã thấy trên nguồn: `DangDieuTri`, `DaXuatVien`, `DaKhoa`.
- Đang điều trị: số bệnh án đã vào viện và chưa ra viện tại thời điểm chốt (cuối kỳ hoặc thời gian SQL Server hiện tại, lấy mốc sớm hơn). Đây là số dư, không phải số phát sinh trong kỳ. Khoa hiện tại lấy lịch sử `NoiTru_LuuTru` ở thời điểm chốt, dự phòng `KhoaVao_Id` nếu thiếu.
- Tên khoa từ `DM_PhongBan`; bản ghi thiếu khoa vẫn được giữ trong nhóm chưa xác định.
- Công suất giường: `DM_GiuongBenh.TamNgung=0` là mẫu số, trong đó `GiuongTrong=0` là giường đang dùng. Đây là **ảnh chụp hiện tại**, kể cả khi chọn kỳ quá khứ; UI hiển thị thời điểm riêng và số giường dùng/tổng giường. Không phải công suất bình quân theo ngày giường trong kỳ, không suy ra từ số bệnh án. Mẫu số bằng 0 hoặc thiếu trạng thái trả `null`.
- Thực thu: số tiền VND của chứng từ `HoaDon` đã thanh toán, không hủy; gồm tạm ứng. Loại `H` là dòng tiền hoàn, trừ theo ngày chứng từ; các loại thu còn lại cộng `GiaTriThucThu` theo `NgayHoaDon`. Hoàn toàn bộ trên chứng từ gốc theo `HoanTra=1` lấy giá trị chứng từ, hoàn chi tiết theo `DaHoanTra=1` lấy tổng dòng hoàn, trừ theo `NgayTra`. Nếu có chứng từ `H` liên kết thì không trừ lại trên chứng từ gốc. Không cộng bảng mirror `HoaDon_HIS`; `HoaDonVienPhi` chưa có dữ liệu tại thời điểm đối chiếu. Phạm vi số liệu là bảng `HoaDon`, không phải doanh thu dịch vụ hay doanh thu dồn tích.
- Thực thu theo khoa/phòng phân theo **nơi lập chứng từ** (`NoiPhatSinh_Id`), không phân bổ tiền một hóa đơn về nhiều khoa thực hiện dịch vụ. Tổng thu, tổng hoàn và số ròng được giữ riêng; cho phép số ròng âm. Tính số tiền bằng đơn vị 1/100 đồng trước khi chuyển sang JSON; dữ liệu tiền không hợp lệ, thiếu ngày hoàn hoặc ngoại tệ chưa quy đổi khiến chỉ số trả `null`, không báo số thiếu như số đầy đủ.
- Tình hình CLS lấy phiếu chưa hủy trong `CLSYeuCau`, nối `DM_NhomDichVu`/`DM_LoaiDichVu`; chỉ gồm loại `Cận Lâm Sàng` và `Thăm dò chức năng`. Lượt chỉ định đếm phiếu; đã thực hiện đếm dịch vụ chi tiết `CLSYeuCauChiTiet.TrangThai='DaThucHien'` chưa hủy; chờ kết quả đếm phiếu có `TrangThai='ChuaKetQua'`. Xu hướng theo ngày chỉ tính tới thời điểm chốt. Phân nhóm dịch vụ dùng tên loại/nhóm trong danh mục HIS; biểu đồ nhóm hiển thị tối đa 12 nhóm có nhiều chỉ định nhất. API chỉ trả số tổng hợp, không trả dữ liệu bệnh nhân.

Dữ liệu tổng hợp này cần được đối chiếu với báo cáo gốc trước khi dùng làm báo cáo chính thức. Không tự suy diễn loại bệnh án, số người duy nhất hoặc cách ghi nhận doanh thu chỉ từ tên cột.

## Giới hạn truy vấn

Chỉ có các câu SELECT cố định, không nhận SQL/tên bảng từ trình duyệt. Biên ngày được truyền bằng tham số và dùng khoảng `[start, end)`; kiểm tra ngày lịch thực và giới hạn kỳ tối đa một năm. `LOCK_TIMEOUT=2000`, `MAXDOP 1`, timeout hữu hạn, pool tối đa 3. Không tạo/sửa bảng, migration hoặc dữ liệu tại nguồn HIS.

Cache tổng hợp tối đa 8 kỳ; gộp request cùng kỳ, tối đa 3 kỳ đang truy vấn. Bản tổng hợp được làm mới ở nền theo thời gian chạy truy vấn; báo cáo năm có khoảng nghỉ tối thiểu 30 giây. Khi cache hết hạn, có thể trả bản trước thêm tối đa 5 phút trong lúc khởi tạo/làm mới, giữ nguyên thời điểm chốt và revision của bản đó. Không thay bản đang xem bằng trạng thái trống khi làm mới. Lỗi không được ghi thành số liệu thành công. Thông báo lỗi không chứa credentials/cấu hình SQL.

Báo cáo tháng/năm lấy một thời điểm chốt từ SQL Server, rồi tách bốn nhóm SELECT: khám/điều trị, giường/tiền, CLS và dược. Pool kết nối giới hạn số nhóm chạy đồng thời. CLS tổng hợp chi tiết theo phiếu trước khi nối để giữ nguyên số phiếu và số dịch vụ; hoàn trả tổng hợp chi tiết của các hóa đơn nằm trong kỳ trước khi nối. Truy vấn ngày giữ đường truy vấn riêng. Không tạo chỉ mục hoặc thay đổi bảng HIS.

Phép đo trên nguồn ngày 25/11/2026: tháng tải đầu khoảng 8,1 giây, năm khoảng 14 giây, đọc lại bản đã lưu trong bộ nhớ khoảng 0–1 ms tại service. Đây không phải cam kết thời gian đầu cuối của trình duyệt; tải SQL/mạng có thể làm thời gian thay đổi.

Frontend dùng revision và long polling để nhận bản mới khi truy vấn nền hoàn tất; khi chưa có bản đầu thì thử lại sau 1 giây. Chỉ cập nhật khi tab hiển thị và có mạng; cập nhật lại khi quay về tab hoặc có mạng trở lại. Không gửi chồng request trong cùng trang. Đổi bộ lọc xóa số của kỳ trước và bỏ response đến trễ. Cập nhật cùng kỳ giữ số hiện tại để tránh nhấp nháy; nếu lỗi, ghi rõ đang hiển thị bản cũ cùng thời điểm chốt và tự thử lại. Không lưu dữ liệu báo cáo vào localStorage. Thời gian nhận số mới còn phụ thuộc truy vấn SQL và kết nối mạng.
