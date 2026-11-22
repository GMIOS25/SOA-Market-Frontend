# 04. UI/UX Design Brief — SOA-Market

> **Định hướng thẩm mỹ chốt:** **Clean Modern Commerce** (cảm hứng **Tiki** về sự mạch lạc thương mại điện tử Việt Nam kết hợp **Stripe / Linear** về tính tinh gọn, minh bạch cho giao dịch tài chính và bảng điều khiển vận hành).  
> **Tiêu chuẩn bắt buộc:** Responsive `360px – 1920px` (`NFR-CMP-002`), **WCAG 2.1 Level AA** (`NFR-USA-004`), Tiếng Việt mặc định sẵn sàng i18n (`NFR-USA-001`), minh bạch đơn đa nhà bán (`NFR-USA-005`), menu quản trị ≤ 3 cấp (`NFR-USA-006`).

---

## 1. Phong cách thiết kế & Cảm hứng (Design Style & Inspiration)

### 1.1. Nguyên tắc thẩm mỹ cốt lõi
1. **Tin cậy & Minh bạch tài chính (Trust-First Commerce):** Thay vì giao diện TMĐT rực rỡ, nhấp nháy, nhiều banner gây nhiễu, SOA-Market ưu tiên nền sáng sạch, phân cấp thị giác rõ ràng và số liệu tiền tệ sắc nét để người mua luôn nhìn thấy chính xác *tiền hàng – phí ship – hoàn tiền* của từng nhà bán.
2. **Phân tách gói hàng trực quan (Multi-Vendor Clarity):** Trong mọi màn hình liên quan đến đa nhà bán (Giỏ hàng, Tóm tắt Checkout, Chi tiết Đơn hàng), mỗi nhà bán được đóng gói thành một **Shop Package Card** độc lập có viền, tiêu đề gian hàng, trạng thái và mã vận đơn riêng.
3. **Tách biệt cảm giác giữa Mua sắm và Vận hành:**
   - *Cổng Người mua (`/`)**: Thoáng, giàu hình ảnh sản phẩm, tối ưu chuyển đổi và dễ hiểu cho người dùng phổ thông.
   - *Cổng Nhà bán (`/seller/*`) & Quản trị – CSKH (`/admin/*`)**: Mật độ thông tin cao hơn, bố cục dạng Workspace/Dashboard tối giản kiểu Stripe/Linear, giảm tối đa màu trang trí để màu cảnh báo SLA và ngoại lệ nổi bật tức thì.

### 1.2. Tham chiếu cảm hứng (Inspiration References)
- **Tiki.vn:** Cấu trúc thanh tìm kiếm, cây danh mục 2 cấp gọn gàng, thẻ sản phẩm rõ ràng với số sao & giá VND, bố cục chia từng gói giao hàng dễ hiểu với người Việt.
- **Shopee (chọn lọc):** Chỉ học cách nhóm giỏ hàng theo từng Shop với checkbox chọn theo shop/sản phẩm; **tránh** popup khuyến mãi dày đặc và màu nền rối mắt.
- **Stripe Dashboard & Linear:** Hệ thống bảng dữ liệu sạch, badge trạng thái tinh tế, timeline lịch sử giao dịch/khiếu nại bất biến, mã định danh monospace copy 1-click và trải nghiệm bàn phím mượt mà.

---

## 2. Bảng màu chuẩn (Color Palette & WCAG 2.1 AA Tokens)

Chế độ mặc định là **Light Mode**. Tất cả cặp màu chữ/nền đều bảo đảm tỷ lệ tương phản **≥ 4.5:1** cho chữ thường và **≥ 3:1** cho chữ lớn/UI component (`NFR-USA-004`).

### 2.1. Màu thương hiệu & Trung tính (Tailwind CSS Tokens)

| Vai trò màu | Tên Token | Mã Hex | Tailwind tương đương | Mục đích sử dụng |
| :--- | :--- | :---: | :--- | :--- |
| **Primary (Tin cậy)** | `--color-primary` | `#1D4ED8` | `blue-700` | Header brand, link chính, tab đang chọn, nút xác nhận Seller/Admin, focus ring |
| **Primary Hover** | `--color-primary-hover` | `#1E40AF` | `blue-800` | Trạng thái hover của nút primary |
| **Primary Soft** | `--color-primary-soft` | `#EFF6FF` | `blue-50` | Nền highlight nhẹ, nền active sidebar item |
| **Accent CTA (Mua sắm / SLA)** | `--color-accent` | `#EA580C` | `orange-600` | Nút **"Đặt hàng & Thanh toán"**, **"Thêm vào giỏ"**, nhấn giá bán, badge SLA sắp hết hạn |
| **Accent Hover** | `--color-accent-hover` | `#C2410C` | `orange-700` | Hover CTA thương mại |
| **Page Background** | `--color-bg` | `#F8FAFC` | `slate-50` | Nền trang tổng thể tạo độ nổi cho các card trắng |
| **Surface / Card** | `--color-surface` | `#FFFFFF` | `white` | Nền Card sản phẩm, Shop Package Card, Bảng dữ liệu, Modal |
| **Border Default** | `--color-border` | `#E2E8F0` | `slate-200` | Viền card, đường kẻ phân cách bảng, input border |
| **Text Primary** | `--color-text` | `#0F172A` | `slate-900` | Tiêu đề, nội dung chính, số tiền VND (tương phản 17.7:1 trên trắng) |
| **Text Secondary** | `--color-text-muted` | `#475569` | `slate-600` | Mô tả phụ, nhãn form, timestamp, breadcrumb (tương phản 7.5:1) |

### 2.2. Bảng màu ngữ nghĩa cho Trạng thái (Semantic Status Badges)

Mọi trạng thái của hệ thống dùng thống nhất pill badge có **nền nhạt + chữ đậm + chấm tròn nhỏ** (không chỉ dùng màu mà luôn kèm text tiếng Việt rõ ràng để hỗ trợ người mù màu — WCAG AA):

| Nhóm ngữ nghĩa | Nền (`bg`) | Chữ (`text`) | Viền (`border`) | Trạng thái áp dụng trong hệ thống |
| :--- | :---: | :---: | :---: | :--- |
| **Neutral / Draft** | `#F1F5F9` | `#334155` | `#CBD5E1` | `DRAFT`, `PENDING_VERIFICATION`, `INITIATED`, `NONE`, `WITHDRAWN`, `NOT_ELIGIBLE` |
| **Info / In Progress** | `#EFF6FF` | `#1D4ED8` | `#BFDBFE` | `CONFIRMED`, `SHIPPING`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `PROCESSING`, `UNDER_REVIEW`, `EXECUTING` |
| **Warning / Action Needed** | `#FFFBEB` | `#B45309` | `#FDE68A` | `PENDING_PAYMENT`, `AWAITING_CONFIRMATION`, `PENDING_REVIEW`, `PENDING_MODERATION`, `AWAITING_SELLER`, `NEGOTIATING`, `SUSPENDED`, `ON_HOLD`, `RETURNING`, `PARTIAL` |
| **Success / Completed** | `#ECFDF5` | `#047857` | `#A7F3D0` | `ACTIVE`, `APPROVED`, `PAID`, `DELIVERED`, `COMPLETED`, `SUCCEEDED`, `CAPTURED`, `PUBLISHED`, `ELIGIBLE`, `CLOSED` |
| **Danger / Failed / Escalated** | `#FEF2F2` | `#B91C1C` | `#FECACA` | `CANCELLED`, `REJECTED`, `LOCKED`, `FAILED`, `EXPIRED`, `CREATE_FAILED`, `DELIVERY_FAILED`, `RETURNED`, `ESCALATED`, `HIDDEN` |

---

## 3. Hệ thống chữ viết & Định dạng dữ liệu (Typography & Formatting)

### 3.1. Font Family
- **Chữ giao diện chính (`font-sans`):** **`Be Vietnam Pro`** (fallback: `Inter, system-ui, sans-serif`) — thiết kế tối ưu riêng cho dấu thanh tiếng Việt ở cả cỡ nhỏ 12px lẫn tiêu đề lớn, không bao giờ lỗi dấu chồng.
- **Số liệu mã định danh (`font-mono`):** **`JetBrains Mono`** (fallback: `ui-monospace, monospace`) — dùng cho mã `Order`, `SellerOrder`, `trackingCode`, `gatewayRef`, `X-Correlation-Id`, `eventId`, `SHA-256` bằng chứng.
- **Số tiền & bảng biểu:** Luôn bật CSS `font-variant-numeric: tabular-nums` (`tabular-nums` trong Tailwind) để các cột tiền VND thẳng hàng tuyệt đối.

### 3.2. Thang cỡ chữ (Type Scale)
| Cấp độ | Cỡ chữ / Line-height | Weight | Sử dụng |
| :--- | :--- | :---: | :--- |
| `Page Title (H1)` | `24px–28px` / `1.3` | `700` | Tiêu đề trang Dashboard, tên trang Checkout, tiêu đề sản phẩm |
| `Section Title (H2)` | `18px–20px` / `1.4` | `600` | Tên khu vực, tiêu đề Shop Package Card, tiêu đề Modal |
| `Card Title (H3)` | `15px–16px` / `1.45` | `600` | Tên sản phẩm trên lưới, tên bảng biểu |
| `Body` | `14px` / `1.6` | `400` | Văn bản mặc định, mô tả, nội dung đánh giá & khiếu nại |
| `Caption / Label` | `12px–13px` / `1.4` | `500` | Nhãn form, thời gian UTC+7, tên biến thể, badge trạng thái |
| `Price Large` | `20px–24px` / `1.2` | `700` | Giá bán trên trang chi tiết, tổng thanh toán (`#EA580C` hoặc `#0F172A`) |

### 3.3. Quy tắc định dạng chuẩn Việt Nam (`BR-GEN-03`, `ASM-06`)
- **Tiền tệ:** `1.250.000 ₫` (dấu chấm ngăn hàng nghìn, không số thập phân, khoảng trắng trước `₫`).
- **Thời gian:** Lưu UTC ở API, luôn quy đổi và hiển thị **`DD/MM/YYYY HH:mm`** (UTC+7), kèm dạng tương đối cho sự kiện mới (*"15 phút trước"*, tooltip hiện đầy đủ giây + múi giờ `+07:00`).

---

## 4. Hệ thống Component & Các Component đặc thù SOA-Market

Xây dựng trên nền **shadcn/ui (Radix UI primitives)** với bo góc đồng nhất (`rounded-lg = 8px` cho card/modal, `rounded-md = 6px` cho button/input, `rounded-full` cho status pill) và đổ bóng cực nhẹ (`shadow-xs`, ưu tiên viền `1px solid #E2E8F0` thay vì đổ bóng nặng).

### 4.1. Button & Card Style
- **Nút hành động chính (Primary Buy CTA):** Nền `#EA580C`, chữ trắng, chiều cao `40px` (`44px` trên mobile — tap target ≥ 44px chuẩn WCAG), chỉ dùng cho 1 hành động chính duy nhất trên mỗi màn hình mua sắm.
- **Nút hành động hệ thống (Primary Ops):** Nền `#1D4ED8`, chữ trắng — dùng cho Seller/Admin (Xác nhận đơn, Duyệt hồ sơ, Lưu cấu hình).
- **Nút thứ cấp (Secondary):** Nền trắng, viền `#CBD5E1`, chữ `#0F172A`, hover `#F8FAFC`.
- **Nút hủy / nguy hiểm (Destructive):** Nền `#DC2626` (hoặc outline đỏ `#B91C1C` cho nút ít trọng tâm hơn như Hủy đơn, Khóa gian hàng).
- **Product Card:** Tỷ lệ ảnh vuông `1:1` (`object-cover`, bo góc trên), tối đa 2 dòng tên sản phẩm (`line-clamp-2`), giá VND nổi bật, hàng dưới gồm sao đánh giá (`★ 4.8 (124)`) + tên gian hàng dạng subtle badge.

### 4.2. Sáu Component đặc thù bắt buộc xây dựng chuẩn xác

1. **`<ShopPackageCard />` (Minh bạch đa nhà bán — `NFR-USA-005`):**
   - Header thẻ: Icon gian hàng + Tên Shop (link) + Badge trạng thái riêng của `SellerOrder` + Mã `SellerOrder` (monospace + nút copy) + Countdown SLA (nếu có).
   - Body thẻ: Danh sách `OrderItem` (ảnh thumbnail 56×56, tên đã chụp, nhãn biến thể, `SL × đơn giá`).
   - Footer thẻ: Tách bạch `Tiền hàng` | `Phí vận chuyển (ĐVVC + ETA)` | `Tổng gói hàng` + Hành động riêng của gói (Hủy gói / Xác nhận nhận hàng / In nhãn / Theo dõi hành trình).
2. **`<PartialRefundBreakdown />` (`FR-ORD-009`):**
   - Khối nền `#EFF6FF` viền trái `4px solid #1D4ED8` hiển thị rõ phép tính:
     - `Tổng đã thanh toán ban đầu`: `1.500.000 ₫`
     - `Đã hoàn tiền — Gói #SO-002 (Shop B hủy)`: `- 450.000 ₫` *(Badge `Đã hoàn`)*
     - **`Giá trị đơn thực tế còn lại`**: **`1.050.000 ₫`**
3. **`<ServiceFallbackBanner />` (Giảm cấp có kiểm soát — `NFR-REL-005`):**
   - Hộp nhỏ gọn nền `#FFFBEB`, viền đứt `#F59E0B`, icon cảnh báo dịu, thông điệp tiếng Việt thân thiện (*"Tạm thời chưa tải được đánh giá / hành trình vận chuyển"*), kèm nút **"Thử tải lại khối này"** kích hoạt `refetch()` riêng query của dịch vụ đó.
4. **`<SlaCountdownPill />` (`FR-ADM-001`, `FR-ORD-006`, `FR-CPL-005`):**
   - Đồng hồ đếm ngược thời gian còn lại trước hạn (`T_PAY`, `T_CONFIRM`, `T_CPL_SELLER`, `T_CPL_NEGOTIATE`):
     - Còn > 25% thời gian: màu xanh/xám bình thường.
     - Còn ≤ 25% thời gian: màu cam `#EA580C` đậm.
     - Đã quá hạn: màu đỏ `#B91C1C` (*"Quá hạn 2 giờ"*).
5. **`<AuditReasonDialog />` (`BR-GEN-04`):**
   - Modal xác nhận chuẩn dùng chung cho mọi thao tác nhạy cảm của Admin/Seller/CSKH (Khóa tài khoản, Từ chối hồ sơ, Khóa gian hàng, Ẩn sản phẩm/đánh giá, Đổi tham số, Replay DLQ, Hoàn tiền thủ công). Bắt buộc nhập `reason` (textarea + đếm ký tự, nút xác nhận chỉ bật khi hợp lệ) và hiển thị nhắc nhở *"Hành động này sẽ được ghi vào Nhật ký kiểm toán bất biến"*.
6. **`<SyncTimestampBadge />` (Nhất quán cuối cùng — `FR-ADM-001`, `FR-RPT-001`):**
   - Chip nhỏ ở thanh tiêu đề các màn hình đọc từ `SVC-RPT`: chấm xanh + *"Đồng bộ sự kiện lúc 10:42:15"* + nút refresh icon.

---

## 5. Quy tắc bố cục & Responsive (Layout Rules & Mobile/Desktop Behavior)

### 5.1. Hệ lưới & Khoảng cách (Spacing & Grid)
- Thang khoảng cách bội số **4px / 8px** (`gap-4 = 16px`, `p-6 = 24px` cho card desktop, `p-4 = 16px` trên mobile).
- **Cổng Người mua:** Container tối đa `max-w-7xl` (`1280px`), căn giữa.
  - Lưới sản phẩm: `2 cột` (360px–639px) → `3 cột` (640px–1023px) → `4 cột` (1024px–1279px) → `5 cột` (≥ 1280px).
  - Giỏ hàng & Checkout: Desktop 2 cột `8/12` (danh sách Shop Package Cards) + `4/12` (Sticky Order Summary); Mobile xếp dọc + **Sticky Bottom Checkout Bar** cố định đáy màn hình hiện tổng tiền và nút Đặt hàng.
- **Cổng Nhà bán & Quản trị – CSKH:** Layout full-width (`max-w-[1600px]`) gồm **Left Sidebar cố định `240px`** (có thể thu gọn thành icon `64px` trên tablet, biến thành Slide-over Drawer trên mobile) + **Topbar `56px`** (Breadcrumb + Role badge + Chuông thông báo + User menu).
- **Quy tắc menu Quản trị (`NFR-USA-006`):** Tối đa **2 cấp thực tế** (≤ 3 cấp yêu cầu):
  - *Nhóm 1 — Vận hành:* Duyệt nhà bán, Đơn hàng & Giao dịch, Ngoại lệ & Hoàn tiền.
  - *Nhóm 2 — Danh mục & Kiểm duyệt:* Danh mục, Tài khoản, Gian hàng, Kiểm duyệt SP, Kiểm duyệt Đánh giá.
  - *Nhóm 3 — CSKH:* Hàng chờ khiếu nại (badge đếm số chưa nhận).
  - *Nhóm 4 — Báo cáo & Hệ thống:* Báo cáo toàn sàn, Tham số nghiệp vụ, Nhật ký kiểm toán, Sức khỏe & DLQ.

### 5.2. Hành vi Responsive (`360px` → `1920px` — `NFR-CMP-002`)
- **Không bao giờ tràn ngang (`overflow-x-hidden` an toàn, không bảng bị cắt mất nút):** Mọi Data Table ở Seller/Admin khi xuống `< 768px` tự chuyển sang dạng **Stacked Card List** hoặc bảng cuộn ngang cục bộ với cột hành động sticky.
- **Bộ lọc sản phẩm trên Mobile:** Ẩn sidebar lọc vào nút **"Bộ lọc (N)"** mở Bottom Sheet / Drawer.
- **Hộp tìm kiếm:** Luôn tiếp cận nhanh ở Header Buyer (cả desktop lẫn mobile).

---

## 6. Định hướng thiết kế Dashboard (Seller & Admin/CSKH)

### 6.1. Seller Dashboard (`/seller`)
- Hàng trên cùng: 4 KPI Cards (`Đơn chờ xác nhận` có màu nhấn cam nếu > 0, `Doanh thu kỳ này`, `Tỷ lệ hủy / quá hạn`, `Điểm đánh giá gian hàng`).
- Khối cảnh báo hành động ngay (nếu có): *Thiếu địa chỉ lấy hàng*, *Có vận đơn `CREATE_FAILED` cần tạo lại*, *Có khiếu nại sắp hết hạn `T_CPL_SELLER`*.
- Hàng dưới: Biểu đồ doanh thu/đơn theo ngày (Recharts) + Danh sách `SellerOrder` mới nhất cần xử lý.

### 6.2. CSKH Arbitration Workspace (`/admin/complaints/:id`)
Thiết kế **3 cột (trên ≥ 1280px)** / **Tab chuyển đổi (trên Mobile/Tablet)** giúp CSKH phân xử chính xác không cần mở nhiều tab trình duyệt:
- **Cột trái (Ngữ cảnh đơn hàng — 30%):** Thông tin `SellerOrder`, số tiền đã thu/đã hoàn/còn lại (`SVC-PAY`), trạng thái vận đơn (`SVC-SHP`), danh sách link các khiếu nại khác cùng `orderId` (`BR-CPL-03`).
- **Cột giữa (Dòng thời gian & Bằng chứng — 42%):** Toàn bộ lịch sử thương lượng bất biến Buyer/Seller/System + gallery xem trước ảnh/video/PDF bằng chứng kèm mã băm SHA-256 và thời điểm tải.
- **Cột phải (Bảng phân xử — 28%):** Trạng thái hiện tại, SLA countdown, form chọn phương án (`outcome`), ô nhập số tiền hoàn có kiểm tra tự động `≤ số còn lại`, chọn bên chịu trách nhiệm (`SELLER` / `CARRIER` / `PLATFORM` / `NONE`), ô lý do bắt buộc và nút ra quyết định.

---

## 7. Nguyên tắc trải nghiệm & Khả năng tiếp cận (UX & Accessibility Checklist)

1. **Tối đa 3 màn hình để đặt hàng (`NFR-USA-002`):** `/cart` (1) → `/checkout` (2) → Cổng thanh toán / `/checkout/result` (3). Không bắt người mua đi qua các bước phụ rườm rà; cho thêm địa chỉ bằng modal ngay tại `/checkout`.
2. **Thông báo lỗi bằng ngôn ngữ nghiệp vụ (`NFR-USA-003`):** Không bao giờ hiện `500 Internal Server Error`, `pq: duplicate key`, hay stack trace. Luôn hiện nguyên nhân dễ hiểu + gợi ý hành động cụ thể + mã `correlationId` nhỏ ở cuối (collapsible/copyable) để báo hỗ trợ.
3. **Điều hướng bàn phím & ARIA (`NFR-USA-004`):**
   - Mọi phần tử tương tác có `focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2`.
   - Modal/Drawer có focus trap và đóng bằng phím `Esc` (Radix UI cung cấp mặc định).
   - Mọi input có `<label htmlFor>` tường minh, lỗi gắn `aria-describedby` và `aria-invalid="true"`.
   - Hình ảnh sản phẩm có `alt` mô tả, icon-only button bắt buộc có `aria-label` tiếng Việt.
4. **Hỗ trợ Demo học phần SOA (tùy chọn Dev/Demo Helper):** Ở môi trường non-production (`VITE_DEMO_MODE=true`), có thể hiển thị thanh công cụ nhỏ gọn góc dưới phải cho phép mở nhanh **Mailpit UI (`:8025`)**, **MockPayment / MockShipping Control Panel**, **Consul UI (`:8500`)** và **Grafana (`:3000`)** để nhóm 5 người trình diễn luồng SOA mượt mà trong buổi bảo vệ môn học.
