# 01. Product Requirements Document (PRD) — SOA-Market

> **Nguồn chuẩn (Source of Truth):** SRS SOA-Market v2.2 (ISO/IEC/IEEE 29148:2018)  
> **Ngữ cảnh dự án:** Đồ án nhóm 5 thành viên — Học phần *Kiến trúc hướng dịch vụ (Service-Oriented Architecture — SOA)*  
> **Mục đích tài liệu:** Cung cấp định nghĩa sản phẩm đầy đủ, rõ ràng và không mơ hồ cho cả nhóm phát triển lẫn AI coding agent về *cái gì cần xây dựng*, *xây dựng cho ai*, *phạm vi từng giai đoạn* và *tiêu chí nghiệm thu*.

---

## 1. Tổng quan sản phẩm (App Overview)

| Hạng mục | Nội dung |
| :--- | :--- |
| **Tên sản phẩm (App Name)** | **SOA-Market** |
| **Ý tưởng một dòng (One-line App Idea)** | Sàn thương mại điện tử đa nhà bán (Multi-Vendor Marketplace) xây dựng theo kiến trúc hướng dịch vụ (SOA — 10 dịch vụ độc lập), cho phép người mua đặt hàng từ nhiều nhà bán trong một giỏ hàng và thanh toán một lần, đồng thời tách đơn để xử lý giao nhận, hoàn tiền, đánh giá và khiếu nại độc lập theo từng nhà bán. |
| **Mô hình kinh doanh** | Marketplace trung gian: nền tảng thu tiền hộ người mua, giữ tiền đến khi đơn con hoàn tất (`COMPLETED`), trích phí nền tảng `PLATFORM_FEE_RATE` (mặc định `5%` chỉ tính trên tiền hàng `itemsAmount`, không tính trên phí vận chuyển — `OQ-04`, `PRM-18`) và ghi nhận khoản phải trả nhà bán (`SellerLedgerEntry`). |
| **Kênh triển khai** | 3 cổng web đáp ứng (Responsive Web App, 360px–1920px) chạy trong cùng ứng dụng Frontend SPA: **Cổng Người mua**, **Cổng Nhà bán**, **Cổng Quản trị – CSKH**. |
| **Ngôn ngữ, tiền tệ, múi giờ** | Giao diện Tiếng Việt (tách chuỗi i18n sẵn sàng mở rộng — `NFR-USA-001`), tiền tệ duy nhất **VND** (số nguyên không thập phân), lưu trữ thời gian **UTC**, hiển thị **UTC+7** (`ASM-06`, `BR-GEN-03`). |

---

## 2. Vấn đề cần giải quyết (Problem Statement)

### 2.1. Bài toán nghiệp vụ sàn đa nhà bán
Khác với website bán hàng một cửa hàng đơn lẻ, một sàn thương mại điện tử đa nhà bán phải giải quyết các xung đột nghiệp vụ và phân tán thực tế:
1. **Một lần mua — nhiều bên thực hiện:** Người mua muốn gom sản phẩm của nhiều nhà bán vào chung một giỏ hàng và thanh toán **một lần duy nhất**, nhưng mỗi nhà bán lại có kho hàng, địa chỉ lấy hàng, phí vận chuyển, thời gian xác nhận và rủi ro hủy/giao lỗi hoàn toàn độc lập.
2. **Rủi ro bán vượt tồn kho & lệch tiền – đơn:** Khi nhiều người mua tranh chấp sản phẩm cuối cùng hoặc cổng thanh toán gửi kết quả (webhook) chậm/trùng/sau khi đơn đã hết hạn, hệ thống dễ bán âm kho hoặc thu tiền mà không có đơn (hoặc hủy đơn mà không hoàn tiền).
3. **Minh bạch trách nhiệm và tranh chấp nhiều bên:** Cần ranh giới rõ ràng giữa Nền tảng, Nhà bán và Đơn vị vận chuyển (ĐVVC) khi xảy ra giao thất bại, hoàn hàng, đánh giá giả mạo hoặc khiếu nại sai/hư hỏng hàng.

### 2.2. Bài toán kiến trúc học phần SOA
Hệ thống đồng thời phải chứng minh việc vận dụng chuẩn xác các nguyên lý **Kiến trúc hướng dịch vụ (SOA)**:
- **Phân rã dịch vụ thô theo năng lực nghiệp vụ (Coarse-Grained Services):** 10 dịch vụ tự chủ sở hữu dữ liệu riêng (`CON-01`, `CON-07`), giao tiếp qua hợp đồng chuẩn OpenAPI 3.0 và sự kiện miền bất đồng bộ (`CON-02`).
- **Hợp dịch vụ (Service Composition):** Kết hợp **Điều phối (Orchestration + Saga Compensation)** cho luồng đặt hàng (`SVC-ORD`) và khiếu nại (`SVC-CPL`) với **Phối hợp sự kiện (Choreography)** cho luồng hậu đơn, thông báo và báo cáo.
- **Cô lập lỗi và đối tác ngoài:** Lỗi của dịch vụ phụ trợ (`SVC-REV`, `SVC-NTF`, `SVC-RPT`, theo dõi vận chuyển) không được kéo sập luồng mua hàng (`NFR-REL-005`); thay đổi cổng thanh toán hoặc ĐVVC chỉ thay lớp Adapter (`NFR-MNT-003`).

### 2.3. Phân định trách nhiệm (Nền tảng — Nhà bán — Hệ thống ngoài)

| Lĩnh vực | Nền tảng (SOA-Market) | Nhà bán (Seller) | Hệ thống bên ngoài |
| :--- | :--- | :--- | :--- |
| **Nhà bán & nội dung** | Duyệt hồ sơ KYC (NĐ 52/2013), khóa/tạm ngưng gian hàng, kiểm duyệt sản phẩm và đánh giá. | Chịu trách nhiệm tính hợp pháp, chính xác của hồ sơ, sản phẩm, giá, mô tả. | — |
| **Tồn kho** | Đảm bảo không bán vượt số tồn khai báo; giữ chỗ (`reservation`) khi đặt hàng. | Khai báo và cập nhật tồn kho thực tế; kiểm tra hàng hoàn trước khi cộng kho (`BR-PRD-08`). | — |
| **Đơn hàng** | Tạo `Order` & tách `SellerOrder`, tự hủy quá hạn thanh toán (`T_PAY`) / xác nhận (`T_CONFIRM`), tự hoàn tất (`T_COMPLETE`). | Xác nhận/từ chối trong `T_CONFIRM`; đóng gói và bàn giao ĐVVC đúng hạn. | — |
| **Thanh toán** | Thu tiền qua cổng, phân bổ theo `SellerOrder`, hoàn tiền toàn phần/một phần, giữ tiền đến khi `COMPLETED`, ghi nhận khoản phải trả. | Chịu khấu trừ hoàn tiền nếu lỗi thuộc nhà bán (`BR-CPL-07`). | **Cổng thanh toán (VNPay/Mock):** xử lý thẻ/giao dịch, giữ dữ liệu thẻ, hoàn tiền. |
| **Vận chuyển** | Tính phí từng nhà bán, tạo/hủy vận đơn, chuẩn hóa hành trình, xử lý hoàn tiền khi giao thất bại. | Đóng gói đúng quy cách, cung cấp địa chỉ lấy hàng chính xác. | **ĐVVC (GHN/Mock):** báo giá, lấy hàng, vận chuyển, giao lại, hoàn hàng. |
| **Khiếu nại** | Điều phối thương lượng, tự chuyển cấp quá hạn, CSKH phân xử chung thẩm (`BR-CPL-09`), thực thi hoàn tiền/đổi trả. | Phản hồi trong `T_CPL_SELLER`, cung cấp bằng chứng, xác nhận hàng hoàn. | — |
| **Dữ liệu cá nhân** | Tuân thủ NĐ 13/2023 (lưu `privacyConsentedAt`, ẩn danh hóa PII khi xóa), che dữ liệu nhạy cảm. | Chỉ thấy thông tin giao nhận của `SellerOrder` thuộc mình (`BR-GEN-05`). | **Email/SMS (Mailpit/SMTP):** chuyển phát nội dung từ mẫu hệ thống. |

---

## 3. Đối tượng người dùng & Vai trò (Target Users & User Roles)

### 3.1. Năm nhóm tác nhân con người

| Vai trò (Role Enum) | Mô tả đối tượng | Quyền hạn & Nhiệm vụ cốt lõi | Quy tắc đặc thù |
| :--- | :--- | :--- | :--- |
| **Khách (`Guest`)** | Người truy cập chưa đăng nhập. | Duyệt danh mục, tìm kiếm/lọc/sắp xếp sản phẩm, xem chi tiết sản phẩm, trang gian hàng công khai, đánh giá công khai; đăng ký tài khoản. | Không có giỏ hàng khách vãng lai (`ASM-09`); bấm "Thêm vào giỏ" yêu cầu đăng nhập. |
| **Người mua (`BUYER`)** | Tài khoản đã xác thực OTP email. | Quản lý hồ sơ & sổ địa chỉ; giỏ hàng đa nhà bán; đặt hàng & thanh toán trực tuyến; theo dõi từng gói hàng; hủy đơn trước xác nhận; xác nhận nhận hàng; đánh giá; mở/thương lượng khiếu nại; nhận thông báo. | Chỉ thao tác dữ liệu của chính mình (`BR-GEN-05`). Có thể nộp hồ sơ đăng ký làm Nhà bán. |
| **Nhà bán (`SELLER`)** | Cá nhân/tổ chức đã được duyệt hồ sơ (`APPROVED`), sở hữu 1 gian hàng. | Quản lý thông tin gian hàng, địa chỉ lấy hàng, tự tạm ngưng/mở lại gian hàng; CRUD sản phẩm/biến thể & tồn kho; xác nhận/từ chối/hủy `SellerOrder`; tạo lại/in nhãn/hủy vận đơn; phản hồi & báo cáo đánh giá; thương lượng khiếu nại; xem báo cáo gian hàng. | Mỗi tài khoản có tối đa 1 gian hàng (`ASM-04`, `BR-SEL-01`). Đồng thời giữ vai trò `BUYER` nhưng **cấm tự mua sản phẩm của gian hàng mình** (`BR-SEL-05`). Không thấy `SellerOrder` của nhà bán khác trong cùng `Order`. |
| **CSKH (`CS`)** | Nhân viên chăm sóc khách hàng của nền tảng. | Nhận khiếu nại từ hàng chờ `ESCALATED` (sắp xếp theo hạn SLA), xem hồ sơ tổng hợp xuyên dịch vụ (đơn, thanh toán, vận chuyển, các khiếu nại cùng `orderId`), yêu cầu bổ sung bằng chứng, ra quyết định phân xử & theo dõi thực thi hoàn tiền/đổi trả; tra cứu đơn và giao dịch toàn sàn. | Chỉ do `ADMINISTRATOR` cấp quyền (`BR-ACC-03`). Mỗi khiếu nại chỉ có 1 CSKH phụ trách tại một thời điểm. Quyết định `CLOSED` là chung thẩm (`BR-CPL-09`). |
| **Quản trị viên (`ADMINISTRATOR`)** | Người quản trị vận hành nền tảng. | Duyệt/từ chối hồ sơ nhà bán; khóa/mở khóa tài khoản & gian hàng; quản lý cây danh mục (≤ 2 cấp); kiểm duyệt sản phẩm & đánh giá; giám sát đơn/giao dịch/ngoại lệ; xác nhận hoàn tiền thủ công (`mark-manual-success`); cấu hình 21 tham số nghiệp vụ (`PRM-01..21`); tra cứu nhật ký kiểm toán; xem sức khỏe hệ thống & replay DLQ; xem báo cáo toàn sàn & nhà bán bất thường. | Không được tự khóa tài khoản của mình hoặc quản trị viên cuối cùng (`FR-ACC-006`). Mọi thao tác ảnh hưởng quyền lợi bên thứ ba bắt buộc nhập `reason` và ghi `AuditLog` (`BR-GEN-04`). |

### 3.2. Bốn tác nhân hệ thống & đối tác bên ngoài
- **Cổng thanh toán (`VNPay Sandbox` / `MockPaymentAdapter`):** Tạo phiên thanh toán, gửi webhook kết quả, truy vấn trạng thái, thực hiện hoàn tiền.
- **Đơn vị vận chuyển (`GHN Sandbox` / `MockShippingAdapter`):** Báo giá cước, tạo/hủy vận đơn, cung cấp nhãn, gửi webhook hành trình, vận đơn hoàn/đổi.
- **Nhà cung cấp Email (`Mailpit SMTP` / production SMTP):** Gửi OTP, liên kết đặt lại mật khẩu và email giao dịch.
- **Bộ lập lịch nội bộ (`Scheduler` — `robfig/cron` + PostgreSQL locks):** Tự động giải phóng giữ chỗ tồn kho (`T_RESERVE`), hủy đơn quá hạn thanh toán (`T_PAY`), hủy đơn con quá hạn xác nhận (`T_CONFIRM`), tự động hoàn tất đơn (`T_COMPLETE`), chuyển cấp khiếu nại quá hạn (`T_CPL_SELLER`, `T_CPL_NEGOTIATE`), truy vấn bù giao dịch/vận đơn.

---

## 4. Mô hình nghiệp vụ cốt lõi: Đơn hàng đa nhà bán

Điểm kiến trúc trung tâm xuyên suốt toàn hệ thống là mô hình 3 tầng **`Order` → `SellerOrder` → `OrderItem`**:
- **`Order` (Đơn tổng):** Kết quả của 1 lần checkout; người mua thanh toán 1 lần duy nhất (`PaymentTransaction.amount = Order.grandTotal`). Trạng thái `Order` (`PENDING_PAYMENT`, `PAID`, `COMPLETED`, `CANCELLED`) **luôn được suy ra tự động** từ tập `SellerOrder` (`BR-ORD-09`, `DC-10`).
- **`SellerOrder` (Đơn con theo nhà bán):** Mỗi nhà bán trong giỏ hàng đã chọn tạo đúng 1 `SellerOrder`. Đây là đơn vị độc lập cho: tính phí vận chuyển, xác nhận/từ chối, tạo vận đơn, hoàn tiền, giữ khoản phải trả (`SellerLedgerEntry`), đánh giá và khiếu nại. Hủy 1 `SellerOrder` không ảnh hưởng các `SellerOrder` khác (`BR-ORD-04`).
- **`OrderItem` (Dòng hàng):** Lưu **bản chụp bất biến (snapshot)** tên sản phẩm, nhãn biến thể, ảnh, đơn giá (`unitPrice`) tại thời điểm đặt (`BR-ORD-02`); địa chỉ giao cũng được chụp vào `Order`.

---

## 5. Danh mục tính năng chính (Main Features — 10 Miền / 69 FR)

| # | Nhóm tính năng | Dịch vụ sở hữu | Mã FR | Tóm tắt năng lực chính | Giai đoạn |
| :-: | :--- | :---: | :--- | :--- | :---: |
| 1 | **Tài khoản & Phân quyền** | `SVC-IDN` | `FR-ACC-001` → `006` (6 FR) | Đăng ký OTP email + đồng ý NĐ 13/2023, đăng nhập/đăng xuất JWT xoay vòng refresh token, thu hồi access token tức thì khi khóa, hồ sơ & sổ địa chỉ, quên/đổi mật khẩu, RBAC, quản lý trạng thái tài khoản. | **Giai đoạn 1 (Core MVP)** |
| 2 | **Nhà bán & Gian hàng** | `SVC-SEL` | `FR-SEL-001` → `005` (5 FR) | Đăng ký KYC nhà bán (cá nhân/tổ chức theo NĐ 52/2013), admin phê duyệt/từ chối, quản lý thông tin gian hàng & địa chỉ lấy hàng, tạm ngưng/khóa/mở gian hàng, trang gian hàng công khai. | **Giai đoạn 1 (Core MVP)** |
| 3 | **Sản phẩm, Danh mục & Tồn kho** | `SVC-PRD` | `FR-PRD-001` → `009` (9 FR) | CRUD sản phẩm & biến thể SKU (bắt buộc `weightGram`), ẩn/xóa mềm, chi tiết sản phẩm, cây danh mục tối đa 2 cấp, tìm kiếm/lọc/sắp xếp (50.000 SP ≤ 1s), quản lý tồn kho khóa lạc quan, API nội bộ `validate-and-reserve`/`commit`/`release`, kiểm duyệt sản phẩm (hậu kiểm mặc định `PRE_MODERATION_ENABLED=false`). | **Giai đoạn 1 (Core MVP)** |
| 4 | **Giỏ hàng & Đơn hàng (Saga)** | `SVC-ORD` | `FR-CRT-001` → `004`, `FR-ORD-001` → `010` (14 FR) | Giỏ hàng nhóm theo nhà bán, tự bỏ chọn & cảnh báo đổi giá/hết hàng, tóm tắt đơn & cache báo giá 5 phút, tạo `Order` + tách `SellerOrder` với `Idempotency-Key`, điều phối Saga đặt hàng – thanh toán, máy trạng thái đơn, nhà bán xác nhận/từ chối, hủy tự động quá `T_PAY` / `T_CONFIRM`, hủy theo giai đoạn, hoàn tiền tự động khi thanh toán muộn, xem lịch sử & đối chiếu hoàn một phần, xác nhận nhận hàng & tự hoàn tất `T_COMPLETE`. | **Giai đoạn 1 (Core MVP)** |
| 5 | **Thanh toán & Hoàn tiền** | `SVC-PAY` | `FR-PAY-001` → `007` (7 FR) | Tạo giao dịch + `PaymentAllocation` theo từng `SellerOrder`, webhook HMAC + chống trùng + chống phát lại `T_SKEW`, truy vấn chủ động cổng khi mất webhook (`inquiry`), hoàn tiền toàn phần/một phần idempotent + retry backoff + xác nhận hoàn thủ công (`mark-manual-success`), ghi nhận khoản phải trả nhà bán (phí 5% tiền hàng, giữ khi có khiếu nại), tra cứu lịch sử giao dịch. | **Giai đoạn 1 (Core MVP)** |
| 6 | **Vận chuyển & Giao nhận** | `SVC-SHP` | `FR-SHP-001` → `006` (6 FR) | Tính phí vận chuyển riêng từng nhà bán (kèm bảng phí dự phòng), tự động tạo vận đơn khi nhà bán xác nhận + retry/tạo lại khi `CREATE_FAILED`, quản lý mã vận đơn/in nhãn/hủy trước `PICKED_UP`, webhook cập nhật hành trình chống lùi trạng thái, theo dõi từng gói hàng, xử lý giao thất bại tối đa `1 + R_REDELIVERY` lần và hoàn hàng/hoàn 100% tiền. | **Giai đoạn 1 (Core MVP)** |
| 7 | **Đánh giá sản phẩm** | `SVC-REV` | `FR-REV-001` → `005` (5 FR) | Người mua đã nhận hàng đánh giá (1–5 sao, tối đa 5 ảnh/1.000 ký tự, 1 đánh giá/`OrderItem` trong `T_REVIEW=14 ngày`), bộ lọc từ cấm, tổng hợp điểm bất đồng bộ sang `SVC-PRD`/`SVC-SEL`, nhà bán phản hồi 1 lần, báo cáo đánh giá vi phạm (giữ hiển thị dưới ngưỡng `N_REPORT_HIDE=3`), admin kiểm duyệt. | **Giai đoạn 2 (Extended)** |
| 8 | **Xử lý khiếu nại nhiều bên** | `SVC-CPL` | `FR-CPL-001` → `009` (9 FR) | Gửi khiếu nại theo `SellerOrder` trong `T_CPL_OPEN=3 ngày` (tách độc lập nếu nhiều nhà bán, liên kết `orderId`), xác minh tự động, tải bằng chứng bất biến có mã băm SHA-256 (≤ 5 tệp/bên), nhà bán phản hồi (`T_CPL_SELLER=24h`) & thương lượng (`T_CPL_NEGOTIATE=48h`), tự chuyển cấp `ESCALATED`, CSKH nhận xử lý theo SLA & ra quyết định chung thẩm, điều phối hoàn tiền & vận đơn hoàn hàng (chỉ hoàn sau `shipment.returned`), dòng thời gian bất biến. | **Giai đoạn 2 (Extended)** |
| 9 | **Thông báo giao dịch** | `SVC-NTF` | `FR-NTF-001` → `002` (2 FR) | Gửi email tự động từ mẫu theo 28 sự kiện miền (idempotent theo `eventId + recipientId + channel`), trung tâm thông báo trong ứng dụng & đánh dấu đã đọc. *(Lưu ý: ở Giai đoạn 1, `SVC-IDN` sử dụng adapter SMTP/Mailpit tối giản hoặc endpoint OTP stub để kích hoạt đăng ký và quên mật khẩu thông suốt).* | **Giai đoạn 2 (Extended)** *(OTP stub ở GĐ1)* |
| 10 | **Quản trị, Kiểm toán & Báo cáo** | `SVC-RPT` | `FR-ADM-001` → `004`, `FR-RPT-001` → `002` (6 FR) | Read model giám sát đơn/giao dịch/danh sách ngoại lệ toàn sàn, quản lý động 21 tham số nghiệp vụ (`PRM-01..21` qua Consul KV + `config.changed`), nhật ký kiểm toán append-only (`AuditLog`), giám sát sức khỏe dịch vụ & quản lý/replay DLQ, báo cáo doanh thu/đơn/hoàn tiền toàn sàn, báo cáo hiệu suất nhà bán & cảnh báo bất thường. | **Giai đoạn 2 (Extended)** |

> **Tổng cộng:** 69 FR (`57 Must` + `12 Should`), 100% truy vết đến 10 mục tiêu nghiệp vụ (`BRQ-01..BRQ-10`) và 40 Use Case (`UC-01..UC-40`).

---

## 6. Bộ 21 tham số nghiệp vụ cấu hình động (`PRM-01` → `PRM-21`)

Mọi ngưỡng nghiệp vụ **không được hard-code** trong mã nguồn mà nạp động qua Consul KV / `SVC-RPT` (`NFR-MNT-005`, `FR-ADM-002`):

| Mã | Tên tham số | Mặc định (Khoảng hợp lệ) | Áp dụng |
| :---: | :--- | :--- | :--- |
| `PRM-01` | `T_OTP` | `5 phút` (1–15 phút) | Hiệu lực mã OTP đăng ký (`FR-ACC-001`) |
| `PRM-02` | `N_OTP` | `5 lần` (3–10 lần) | Số lần nhập sai OTP tối đa (`FR-ACC-001`) |
| `PRM-03` | `T_ACCESS` | `15 phút` (5–60 phút) | Thời hạn Access Token JWT (`FR-ACC-002`) |
| `PRM-04` | `T_REFRESH` | `7 ngày` (1–30 ngày) | Thời hạn Refresh Token (`FR-ACC-002`) |
| `PRM-05` | `T_PAY` | `15 phút` (10–30 phút) | Hạn thanh toán Order (`FR-ORD-005`) |
| `PRM-06` | `T_RESERVE` | `15 phút` (10–30 phút; `≥ T_PAY`) | Hạn giữ chỗ tồn kho (`FR-PRD-008`) |
| `PRM-07` | `T_CONFIRM` | `24 giờ` (4–72 giờ) | Hạn nhà bán xác nhận `SellerOrder` (`FR-ORD-006`) |
| `PRM-08` | `T_COMPLETE` | `3 ngày` (1–7 ngày) | Thời gian tự `COMPLETED` sau `DELIVERED` (`FR-ORD-010`) |
| `PRM-09` | `R_REDELIVERY` | `2 lần` (1–3 lần) | Số lần giao lại tối đa sau lần đầu (`FR-SHP-006`) |
| `PRM-10` | `T_REVIEW` | `14 ngày` (7–30 ngày) | Thời hạn gửi đánh giá sau giao (`FR-REV-001`) |
| `PRM-11` | `T_CPL_OPEN` | `3 ngày` (1–7 ngày; `= T_COMPLETE`) | Thời hạn mở khiếu nại sau giao (`FR-CPL-001`) |
| `PRM-12` | `T_CPL_SELLER` | `24 giờ` (12–48 giờ) | Hạn nhà bán phản hồi khiếu nại (`FR-CPL-005`) |
| `PRM-13` | `T_CPL_NEGOTIATE` | `48 giờ` (24–72 giờ) | Hạn thương lượng khiếu nại (`FR-CPL-005`) |
| `PRM-14` | `N_RETRY` | `3 lần` (1–5 lần) | Số lần thử lại tối đa với backoff lũy tiến (`NFR-REL-002`) |
| `PRM-15` | `T_SKEW` | `300 giây` (60–600 giây) | Dung sai dấu thời gian chữ ký webhook (`NFR-SEC-005`) |
| `PRM-16` | `MAX_IMG_PRODUCT` | `8 ảnh` (1–15 ảnh) | Số ảnh tối đa/sản phẩm (`FR-PRD-001`) |
| `PRM-17` | `MAX_EVIDENCE` | `5 tệp` (1–10 tệp) | Số tệp bằng chứng tối đa/bên/khiếu nại (`FR-CPL-003`) |
| `PRM-18` | `PLATFORM_FEE_RATE` | `5%` (0%–30%) | Phí hoa hồng sàn trên `itemsAmount` (`FR-PAY-006`) |
| `PRM-19` | `MAX_IMG_REVIEW` / `MAX_REVIEW_LEN` | `5 ảnh` / `1.000 ký tự` | Giới hạn nội dung đánh giá (`BR-REV-02`) |
| `PRM-20` | `N_REPORT_HIDE` | `3 báo cáo` (2–10) | Ngưỡng báo cáo để tự ẩn đánh giá (`FR-REV-004`) |
| `PRM-21` | `PRE_MODERATION_ENABLED` | `false` (hậu kiểm) | Bật/tắt tiền kiểm sản phẩm mới (`FR-PRD-009`) |

---

## 7. User Stories (Truy vết theo Vai trò & Use Case)

### 7.1. Khách & Người mua (`Guest` / `BUYER`)
- **US-01 (UC-01, UC-03 — Duyệt & tìm kiếm):** Là *Khách/Người mua*, tôi muốn tìm kiếm sản phẩm theo từ khóa, lọc theo danh mục lá, khoảng giá, gian hàng, điểm sao, còn hàng và sắp xếp theo giá/mới nhất/phổ biến để nhanh chóng tìm đúng món hàng cần mua. *(AC: sản phẩm ở danh mục `HIDDEN` hoặc gian hàng `SUSPENDED/LOCKED` không xuất hiện; lỗi `SVC-REV` không làm lỗi trang sản phẩm/gian hàng).*
- **US-02 (UC-02, UC-04, UC-05, UC-06 — Tài khoản an toàn):** Là *Khách*, tôi muốn đăng ký bằng email + xác thực OTP + tự tích chọn đồng ý xử lý dữ liệu cá nhân (NĐ 13/2023), đăng nhập nhận JWT, quản lý sổ địa chỉ giao hàng và đặt lại mật khẩu khi quên. *(AC: không tích đồng ý trả 422; nhập sai OTP 5 lần vô hiệu OTP; đăng xuất/đổi mật khẩu thu hồi refresh token cũ).*
- **US-03 (UC-15 — Giỏ hàng đa nhà bán):** Là *Người mua*, tôi muốn thêm biến thể của nhiều nhà bán vào một giỏ hàng hiển thị nhóm riêng theo từng gian hàng và tự động cảnh báo + bỏ chọn nếu sản phẩm đổi giá, hết hàng hoặc bị ẩn. *(AC: không cho thêm sản phẩm của chính gian hàng mình sở hữu; lỗi `SVC-PRD` chặn đặt hàng nhưng vẫn hiển thị dữ liệu giỏ cuối cùng kèm cảnh báo).*
- **US-04 (UC-16, UC-17 — Đặt hàng & thanh toán một lần):** Là *Người mua*, tôi muốn xem tóm tắt phí vận chuyển riêng của từng nhà bán, hoàn tất đặt hàng trong tối đa 3 màn hình và thanh toán trực tuyến 1 lần cho toàn bộ `Order` mà không lo bị đặt trùng khi mạng lag. *(AC: thiếu 1 món thì không tạo đơn và không giữ chỗ món nào — all-or-nothing; gửi trùng `Idempotency-Key` trả `Order` cũ; thanh toán thất bại có thể thanh toán lại trong `T_PAY`; thanh toán đến muộn sau khi đơn hủy được tự động hoàn 100% tiền).*
- **US-05 (UC-18, UC-19, UC-21 — Theo dõi, hủy & nhận hàng):** Là *Người mua*, tôi muốn xem trạng thái, vận đơn, hành trình và bảng đối chiếu hoàn tiền một phần của từng gói hàng (`SellerOrder`), hủy gói chưa được nhà bán xác nhận và bấm "Đã nhận hàng" để hoàn tất. *(AC: hủy 1 `SellerOrder` đã thanh toán chỉ hoàn tiền phần phân bổ của gói đó; đã `SHIPPING` thì chặn hủy 409 và gợi ý mở khiếu nại).*
- **US-06 (UC-25, UC-27 — Đánh giá xác thực):** Là *Người mua đã nhận hàng*, tôi muốn gửi đánh giá 1–5 sao kèm tối đa 5 ảnh trong vòng 14 ngày (`T_REVIEW`) cho từng `OrderItem` để phản ánh chất lượng sản phẩm. *(AC: người chưa mua bị từ chối; mỗi `OrderItem` chỉ 1 đánh giá).*
- **US-07 (UC-28, UC-29 — Khiếu nại & thương lượng):** Là *Người mua*, tôi muốn mở khiếu nại kèm bằng chứng (tối đa 5 tệp) trong 3 ngày sau giao hoặc khi quá hạn giao dự kiến, thương lượng trực tiếp với nhà bán hoặc yêu cầu CSKH can thiệp. *(AC: chọn lỗi ở 2 nhà bán cùng đơn tự tách thành 2 khiếu nại liên kết `orderId`; khiếu nại mở khóa việc tự động `COMPLETED` và giữ tiền của nhà bán).*

### 7.2. Nhà bán (`SELLER`)
- **US-08 (UC-07, UC-09 — Mở & vận hành gian hàng):** Là *Người mua*, tôi muốn nộp hồ sơ đăng ký nhà bán (CCCD + MST cá nhân hoặc ĐKKD + MST tổ chức), sau khi được duyệt thì thiết lập thông tin gian hàng, địa chỉ lấy hàng và tự tạm ngưng/mở lại gian hàng khi nghỉ bán. *(AC: thiếu địa chỉ lấy hàng không thể xác nhận đơn).*
- **US-09 (UC-11, UC-12 — Quản lý sản phẩm & tồn kho):** Là *Nhà bán*, tôi muốn tạo/sửa/ẩn/xóa mềm sản phẩm với nhiều biến thể SKU (giá VND, `weightGram` 10–50.000g) và điều chỉnh tồn kho vật lý xem rõ số đang giữ chỗ và số khả dụng. *(AC: không được chỉnh `onHand < reserved`; xung đột phiên bản trả 409; đổi giá/xóa sản phẩm không làm đổi đơn hàng đã tạo).*
- **US-10 (UC-20, UC-22 — Xử lý đơn & vận đơn):** Là *Nhà bán*, tôi muốn chỉ nhìn thấy các `SellerOrder` của gian hàng mình, xác nhận (tự động tạo vận đơn) hoặc từ chối kèm lý do trong `T_CONFIRM=24h`, in nhãn vận đơn, bấm "Tạo lại vận đơn" nếu ĐVVC lỗi (`CREATE_FAILED`) hoặc hủy đơn trước khi ĐVVC lấy hàng (`CREATED`). *(AC: quá 24h không xác nhận hệ thống tự hủy, hoàn tiền người mua và ghi nhận chỉ số quá hạn).*
- **US-11 (UC-26, UC-29, UC-34 — Phản hồi & báo cáo):** Là *Nhà bán*, tôi muốn phản hồi công khai tối đa 1 lần cho mỗi đánh giá, báo cáo đánh giá vi phạm, phản hồi khiếu nại trong `T_CPL_SELLER=24h` và xem báo cáo doanh thu/hiệu suất của riêng gian hàng mình. *(AC: không thể sửa/xóa đánh giá người mua; không xem được dữ liệu gian hàng khác).*

### 7.3. CSKH (`CS`) & Quản trị viên (`ADMINISTRATOR`)
- **US-12 (UC-30, UC-31 — CSKH phân xử khiếu nại):** Là *CSKH*, tôi muốn xem hàng chờ khiếu nại `ESCALATED` sắp xếp theo hạn SLA còn lại, nhận xử lý (1 người phụ trách), xem hồ sơ tổng hợp xuyên dịch vụ cùng các khiếu nại cùng `orderId`, ra quyết định kèm lý do bắt buộc và để hệ thống tự thực thi vận đơn hoàn hàng + hoàn tiền (chỉ hoàn sau `shipment.returned`). *(AC: không được hoàn vượt số tiền còn lại của `SellerOrder`; khiếu nại chỉ `CLOSED` sau khi nhận `refund.completed`).*
- **US-13 (UC-08, UC-10, UC-13, UC-14, UC-27 — Quản trị nội dung & tài khoản):** Là *Quản trị viên*, tôi muốn duyệt/từ chối hồ sơ nhà bán, khóa/mở tài khoản (vô hiệu JWT tức thì) và gian hàng, quản lý cây danh mục ≤ 2 cấp và kiểm duyệt sản phẩm/đánh giá vi phạm. *(AC: mọi hành động ảnh hưởng quyền lợi đều bắt buộc lý do và lưu `AuditLog`).*
- **US-14 (UC-32, UC-33, UC-34, UC-35, UC-36 — Giám sát, cấu hình & vận hành SOA):** Là *Quản trị viên*, tôi muốn theo dõi đơn/giao dịch và danh sách ngoại lệ, xác nhận hoàn tiền thủ công (`mark-manual-success` kèm mã ngân hàng), cập nhật 21 tham số nghiệp vụ không cần rebuild dịch vụ, tra cứu nhật ký kiểm toán bất biến, giám sát sức khỏe dịch vụ & replay thông điệp DLQ, và xem báo cáo toàn sàn/nhà bán bất thường.

---

## 8. Phân chia phạm vi MVP & Giai đoạn (MVP Scope & Phasing)

Bám sát **SRS Mục 10.3** và phân bổ hợp lý cho **nhóm 5 người**:

### 8.1. Giai đoạn 1 — Core MVP (6 dịch vụ lõi + Hạ tầng SOA)
Mục tiêu: Chạy thông suốt **kịch bản đắt giá nhất của sàn đa nhà bán & SOA** — từ duyệt hàng → đặt hàng đa nhà bán → Saga giữ chỗ tồn kho all-or-nothing → thanh toán một lần & phân bổ → tách `SellerOrder` → nhà bán xác nhận → tạo vận đơn & giao hàng/hủy một phần/hoàn tiền.
- **Hạ tầng SOA bắt buộc:** Docker Compose, PostgreSQL (10 schema + 10 role), NATS JetStream (Streams + DLQ + KV), Consul (Registry + KV), Traefik API Gateway + `gateway-auth` (ForwardAuth JWT + revoked token sync + rate limit + `X-Correlation-Id`), MinIO, Mailpit (OTP email).
- **6 dịch vụ lõi:** `SVC-IDN` (kèm adapter SMTP/Mailpit tối giản gửi OTP & reset password), `SVC-SEL`, `SVC-PRD`, `SVC-ORD`, `SVC-PAY` (`MockPaymentAdapter` + `VnPayAdapter`), `SVC-SHP` (`MockShippingAdapter` + `GhnAdapter`).
- **Frontend cốt lõi:** Buyer Portal (Duyệt/Tìm kiếm, Chi tiết SP, Gian hàng, Auth/Profile/Địa chỉ, Giỏ hàng đa nhà bán, Tóm tắt & Checkout ≤ 3 màn hình, Đơn hàng & Theo dõi từng gói), Seller Portal (Đăng ký KYC, Quản lý Shop/Địa chỉ lấy hàng, Sản phẩm/Tồn kho, Xử lý `SellerOrder` & Vận đơn), Admin cơ bản (Duyệt nhà bán, Danh mục, Khóa tài khoản/gian hàng, Hoàn tiền thủ công).

### 8.2. Giai đoạn 2 — Extended (4 dịch vụ mở rộng + Full Observability & QA)
Mục tiêu: Hoàn thiện toàn bộ 69 FR, 118 API, 34 sự kiện, chứng minh giảm cấp có kiểm soát và độ phủ kiểm thử nghiệm thu.
- **4 dịch vụ mở rộng:** `SVC-REV`, `SVC-CPL`, `SVC-NTF` (full 28-event consumer + In-App Notification Center, thay thế OTP stub ở `SVC-IDN`), `SVC-RPT` (Read Models, Ngoại lệ, Cấu hình động 21 `PRM-xx`, Audit Log, Health/DLQ Replay, Báo cáo toàn sàn & Nhà bán).
- **Frontend mở rộng:** Đánh giá & Kiểm duyệt, Trung tâm Thông báo, Quy trình Khiếu nại (Buyer/Seller/CSKH Arbitration Workspace), Bảng điều khiển Quản trị – Giám sát – Báo cáo.
- **Observability & Kiểm thử tải:** OTel + Prometheus + Grafana + Loki, bộ kiểm thử tiêm lỗi (Fault Injection) và tải chuẩn `k6` (200 RPS).

---

## 9. Tính năng KHÔNG bao gồm trong phiên bản 1 (Out of Scope)

Tuyệt đối **không tự ý xây dựng** các tính năng sau trong phạm vi đồ án v1 (dựa theo Bảng 1.1, `CON-06`, `ASM-01..19`, `OQ-06`, `OQ-13`):
1. **Thanh toán khi nhận hàng (COD)** (`ASM-19`) — chỉ hỗ trợ thanh toán trực tuyến qua cổng.
2. **Mã giảm giá, khuyến mãi, flash sale, trả góp tín dụng, tiếp thị tự động** (`OQ-13`, `CON-06`) — chỉ dự phòng cột `discount_amount = 0` trong `SellerOrder` cho tương lai.
3. **Chi trả tiền thực tế (bank payout) cho nhà bán, tính thuế VAT, hóa đơn điện tử, kế toán nội bộ nhà bán, đối soát cước với ĐVVC** (`ASM-07`, `ASM-08`, `BR-CPL-07`).
4. **Hàng hóa số (digital goods) và dịch vụ không giao nhận** (`ASM-05`); **tách nhiều kiện cho 1 `SellerOrder`** (`ASM-16`).
5. **Giỏ hàng cho khách vãng lai (Guest Cart)** (`ASM-09`) và **hủy một phần sản phẩm trong cùng 1 `SellerOrder`** (`ASM-10`).
6. **Kháng cáo quyết định phân xử của CSKH** (`OQ-06`, `BR-CPL-09`) và **bồi thường vượt quá giá trị đã thu của `SellerOrder`** (`OQ-05`, `BR-CPL-06`).
7. **Ứng dụng di động gốc (Native iOS/Android)** (`ASM-01`), **thông báo đẩy thời gian thực WebSocket/Push** (`ASM-14`), **đa ngôn ngữ/đa tiền tệ** (`CON-06`, `ASM-06`).
8. **Tính năng AI/ML trong runtime ứng dụng** (chatbot AI, gợi ý sản phẩm AI, nhận diện ảnh KYC tự động) — giữ hệ thống thuần nghiệp vụ SOA xác định rõ ràng.

---

## 10. Chỉ số thành công & Tiêu chí nghiệm thu (Success Metrics & Acceptance Criteria)

### 10.1. Chỉ số sản phẩm & trải nghiệm
- **Tốc độ đặt hàng (`NFR-USA-002`):** Người mua đã đăng nhập có địa chỉ hoàn tất checkout từ giỏ hàng đến trang cổng thanh toán trong **≤ 3 màn hình**.
- **Minh bạch đa nhà bán (`NFR-USA-005`):** ≥ **80%** người thử (tối thiểu 5 người đại diện) xác định đúng trạng thái, phí ship và mã vận đơn của từng gói `SellerOrder` mà không cần trợ giúp.
- **Nhất quán tiền – đơn (`NFR-REL-004`, `ACP-06`):** **0** `Order`/`SellerOrder` đã thu tiền bị hủy hoặc `DELIVERY_FAILED` mà không có `Refund SUCCEEDED` hoặc bản ghi ngoại lệ cần xử lý.

### 10.2. Chỉ số kỹ thuật & Kiến trúc SOA (Học phần)
- **Hiệu năng ở tải chuẩn (`NFR-PER-001..007`):** Chịu tải **200 req/s** hỗn hợp (**10 checkout/s**, **500 concurrent users**), lỗi 5xx **< 1%**; p95 đọc ≤ **500ms**, ghi ≤ **800ms**, tìm kiếm 50.000 SP ≤ **1s**, đặt hàng checkout ≤ **2s**, webhook ≤ **2s**, báo cáo 1 tháng ≤ **5s**.
- **Chịu lỗi & Giảm cấp (`NFR-REL-001..009`, `SOA-R06..09`):** Tắt NATS không mất sự kiện (Outbox); tắt `SVC-REV`/`SVC-NTF`/`SVC-RPT` luồng đặt hàng vẫn trả HTTP 2xx và giao diện hiển thị Fallback Banner; gửi trùng webhook/checkout/refund tạo đúng 1 giao dịch; chạy đa bản sao bộ lập lịch không xử lý trùng.
- **Độ phủ & Nghiệm thu (`ACP-01..09`, `NFR-MNT-004`):**
  - 100% kịch bản `CN`/`BT` của 57 FR mức `Must` đạt; 100% kịch bản `TH` đặt hàng – thanh toán – hoàn tiền – vận chuyển – khiếu nại đạt kể cả tiêm lỗi.
  - 100% kịch bản bảo mật `BM` đạt (không IDOR, không lộ mật khẩu/thẻ, từ chối webhook sai HMAC, khóa tài khoản thu hồi JWT tức thì).
  - Unit test logic lõi ≥ **70%** coverage (`go test -race`); toàn bộ **118 API** có hợp đồng OpenAPI 3.0 sinh tự động từ Huma khớp cài đặt và được kiểm thử hợp đồng; **12/12 yêu cầu SOA (`SOA-R01..SOA-R12`)** kiểm chứng thành công.
