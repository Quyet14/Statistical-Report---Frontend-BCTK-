import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Be_Vietnam_Pro } from "next/font/google";
import s from "./welcome.module.css";
import Showcase, { type Item } from "./Showcase";
import ScrollFX from "./ScrollFX";

const font = Be_Vietnam_Pro({ subsets: ["vietnamese", "latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "HuuNghi CareOps | Kết nối vận hành bệnh viện",
  description: "Không gian làm việc tập trung cho điều phối công việc, nghiệp vụ và báo cáo tại Bệnh viện Hữu Nghị.",
};

const features = [
  { icon: "↗", title: "Công việc hằng ngày", text: "Tổ chức đầu việc cá nhân và công việc chung theo ngày, theo dõi tiến độ, phối hợp và tra cứu nội dung đã hoàn tất.", tags: ["Việc hôm nay", "Việc cá nhân", "Điều phối", "Lưu trữ"] },
  { icon: "✓", title: "Phê duyệt & thông tin", text: "Theo dõi các nội dung cần xử lý, công việc lặp lại và thông báo tập trung để hạn chế bỏ sót.", tags: ["Phê duyệt", "Công việc lặp lại", "Thông báo"] },
  { icon: "✧", title: "Nghiệp vụ & chất lượng", text: "Hỗ trợ phối hợp liên khoa, ghi nhận sự cố và quản lý thiết bị; đồng thời theo dõi SOP, lịch trực, đào tạo và hoạt động chất lượng.", tags: ["Yêu cầu liên khoa", "Sự cố checklist", "Thiết bị", "SOP", "Lịch trực"] },
  { icon: "▥", title: "Báo cáo & chỉ số", text: "Tổng hợp nội dung giao ban, theo dõi KPI và xem báo cáo hoạt động bệnh viện theo quyền được cấp.", tags: ["Giao ban", "Báo cáo bệnh viện", "KPI", "Biểu đồ"] },
  { icon: "⌘", title: "Tổ chức & quản trị", text: "Hỗ trợ quản lý nhân viên, khoa/phòng, cơ cấu nhóm cùng các công cụ sao lưu và vận hành hệ thống.", tags: ["Nhân viên", "Khoa/phòng", "Cơ cấu & nhóm", "Vận hành"] },
];

const operationalFeatures = [
  { icon: "⇄", title: "Yêu cầu liên khoa", text: "Gửi đề nghị đến khoa/phòng liên quan, phân công người tiếp nhận, đặt mức ưu tiên và hạn xử lý, rồi theo dõi trạng thái đến khi hoàn tất." },
  { icon: "!", title: "Ghi nhận sự cố", text: "Tạo phiếu sự cố gắn với công việc hoặc mục checklist, giao người phụ trách và theo dõi tiến độ, mức độ cũng như kết quả khắc phục." },
  { icon: "▦", title: "Thiết bị & bảo trì", text: "Quản lý thiết bị, mã QR và checklist kiểm tra; theo dõi chu kỳ kiểm định, lịch bảo trì và người phụ trách." },
  { icon: "▤", title: "SOP & xác nhận", text: "Tập trung tài liệu quy trình, quản lý các phiên bản và ghi nhận nhân viên đã đọc, xác nhận nội dung đang áp dụng." },
  { icon: "◷", title: "Lịch trực & đào tạo", text: "Theo dõi lịch trực theo khoa/phòng và thông tin đào tạo, hỗ trợ nắm bắt lịch trình cùng tình trạng cần hoàn thành." },
  { icon: "◎", title: "Kiểm tra & cải tiến", text: "Tổ chức kiểm tra, theo dõi mục tiêu OKR và khảo sát để ghi nhận kết quả, phản hồi và nội dung cần cải thiện." },
];

const featureDiagrams: Pick<Item, "kind" | "labels" | "chip">[] = [
  { kind: "tasks", labels: ["Kiểm tra giường bệnh", "Bàn giao ca trực", "Cập nhật hồ sơ", "Họp giao ban"] },
  { kind: "approve" },
  { kind: "cal" },
  { kind: "chart" },
  { kind: "org", labels: ["Bệnh viện", "Khoa A", "Khoa B", "Khoa C"] },
];
const operationDiagrams: Pick<Item, "kind" | "labels" | "chip">[] = [
  { kind: "flow", labels: ["Khoa A", "Khoa B", "Hoàn tất"] },
  { kind: "flow", labels: ["Ghi nhận", "Xử lý", "Khắc phục"] },
  { kind: "scan" },
  { kind: "tasks", chip: "Đã đọc", labels: ["Quy trình vệ sinh tay", "Quy trình cấp cứu", "Quy trình bàn giao ca", "Kiểm soát nhiễm khuẩn"] },
  { kind: "cal" },
  { kind: "chart" },
];
const featureItems: Item[] = features.map((f, i) => ({ ...f, ...featureDiagrams[i] }));
const operationItems: Item[] = operationalFeatures.map((f, i) => ({ ...f, ...operationDiagrams[i] }));

const faces = ["✚", "✓", "▥", "⌘", "✧", "↗"];

export default function HomePage() {
  return (
    <main className={`${s.welcome} ${font.className}`}>
      <ScrollFX />
      <a className={s.skip} href="#noi-dung">Đến nội dung chính</a>
      <header className={s.header}>
        <Link href="/" className={s.brand} aria-label="HuuNghi CareOps, Trang chủ"><Image src="/hospital-logo.png" alt="" width={44} height={44} priority /><span>HuuNghi <b>CareOps</b><small>Bệnh viện Hữu Nghị</small></span></Link>
        <nav className={s.nav} aria-label="Điều hướng giới thiệu"><a href="#nen-tang">Nền tảng</a><a href="#cach-su-dung">Cách sử dụng</a></nav>
        <Link className={s.login} href="/login">Đăng nhập hệ thống <span aria-hidden="true">↗</span></Link>
      </header>
      <section id="noi-dung" className={s.hero} aria-labelledby="welcome-title">
        <div className={s.heroCopy}>
          <p className={s.eyebrow}><span /> Kết nối để vận hành tốt hơn</p>
          <h1 id="welcome-title">Một nền tảng.<br />Kết nối <em>mọi nhịp vận hành.</em></h1>
          <p className={s.description}>Từ công việc mỗi ngày đến bức tranh toàn viện. CareOps kết nối đội ngũ, quy trình và số liệu trong một không gian làm việc thống nhất.</p>
          <div className={s.actions}><a className={s.primary} href="#nen-tang">Khám phá nền tảng <span aria-hidden="true">↓</span></a><a className={s.secondary} href="#cach-su-dung">Xem cách sử dụng</a></div>
                  </div>
        <div className={s.visual} role="img" aria-label="Minh họa 3D về sự kết nối trong vận hành bệnh viện">
          <div className={s.glow} /><div className={s.floor} />
          <div className={s.stage}>
            <div className={s.ring}><i /></div>
            <div className={`${s.ring} ${s.ring2}`}><i /></div>
            <div className={s.cube}>{faces.map((c, i) => <div key={i} className={`${s.face} ${s["f" + i]}`}>{c}</div>)}<div className={s.core} /></div>
          </div>
          <div className={`${s.floatCard} ${s.tasks}`}><span className={s.icon}>✓</span><div><small>Công việc</small><strong>Phối hợp nhịp nhàng</strong><div className={s.miniSteps}><i /><i /><i /><i /></div></div></div>
          <div className={`${s.floatCard} ${s.report}`}><div><small>Báo cáo bệnh viện</small><strong>Nhìn rõ bức tranh chung</strong><div className={s.bars}><i /><i /><i /><i /><i /><i /><i /></div></div></div>
          <div className={`${s.floatCard} ${s.team}`}><span className={s.icon}>⌘</span><div><small>Khoa / phòng</small><strong>Kết nối đội ngũ</strong></div></div>
        </div>
      </section>
      <section id="nen-tang" className={s.features} aria-labelledby="features-title">
        <div className={s.sectionHeading}><div><p className={s.eyebrow}>Thiết kế cho công việc thực tế</p><h2 id="features-title">Một không gian cho toàn bộ vận hành</h2></div><p>Công cụ hiển thị tùy theo<br />vai trò và quyền truy cập.</p></div>
        <Showcase items={featureItems} />
        <p className={s.accessNote}>Các chức năng được phân quyền theo tài khoản, vai trò và phạm vi công việc; không phải tài khoản nào cũng truy cập được tất cả phân hệ.</p>
      </section>
      <section className={s.operations} aria-labelledby="operations-title">
        <div className={s.sectionHeading}><div><p className={s.eyebrow}>Nghiệp vụ được mô tả cụ thể</p><h2 id="operations-title">Từ phối hợp liên khoa đến cải tiến chất lượng</h2></div><p>Các luồng xử lý giúp đội ngũ<br />nắm rõ việc cần làm và trạng thái.</p></div>
        <Showcase items={operationItems} />
      </section>
      <section id="cach-su-dung" className={s.access} aria-labelledby="access-title">
        <div><p className={s.eyebrow}>Sẵn sàng cho ngày làm việc</p><h2 id="access-title">Không gian của bạn.<br />Công việc của cả đội.</h2><p>Đăng nhập bằng tài khoản được cấp để truy cập các chức năng theo vai trò và khoa/phòng của bạn.</p></div>
        <ol className={s.steps}><li><span>1</span><div><h3>Đăng nhập tài khoản</h3><p>Sử dụng tài khoản do đơn vị cung cấp.</p></div></li><li><span>2</span><div><h3>Vào không gian làm việc</h3><p>Các chức năng hiển thị theo quyền của bạn.</p></div></li><li><span>3</span><div><h3>Bắt đầu phối hợp</h3><p>Theo dõi công việc, nghiệp vụ và báo cáo.</p></div></li></ol>
      </section>
      <footer className={s.footer}><span><b>HuuNghi CareOps</b>, Bệnh viện Hữu Nghị</span><span>Kết nối đội ngũ. Đồng bộ vận hành.</span><a href="#noi-dung">Lên đầu trang ↑</a></footer>
    </main>
  );
}