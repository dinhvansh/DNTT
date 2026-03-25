# Tài liệu giải pháp
## Hệ thống Đề nghị thanh toán (Payment Request) có cấu hình linh động, workflow kiểm soát và phân quyền theo đối tượng liên quan / phòng ban

## 1. Mục tiêu
Xây dựng một module nội bộ cho quy trình **Đề nghị thanh toán** trong E-Office với các mục tiêu sau:

- Chuẩn hóa việc tạo, duyệt và theo dõi đề nghị thanh toán.
- Cho phép **Admin cấu hình mẫu (template) linh động tối đa** nhưng vẫn nằm trong khung kiểm soát của hệ thống.
- Cho phép cấu hình **workflow duyệt có kiểm soát**, không cho tạo luồng tự do gây phức tạp và khó bảo trì.
- Hỗ trợ **Payment Header + Payment Detail** để đủ dữ liệu đẩy sang ERP.
- Hỗ trợ **API tích hợp ERP** sau khi phiếu được duyệt hoàn tất.
- Hỗ trợ **phân quyền hiển thị dữ liệu theo mức độ liên quan**: chỉ người liên quan mới được xem, và có tùy chọn chia sẻ theo phòng ban.
- Đảm bảo truy vết, kiểm toán, lịch sử cấu hình, lịch sử duyệt, lịch sử đồng bộ ERP.

---

## 2. Phạm vi giai đoạn 1
Phạm vi triển khai giai đoạn đầu chỉ tập trung vào **01 quy trình duy nhất: Đề nghị thanh toán**.

Bao gồm:
- Tạo và quản lý phiếu đề nghị thanh toán.
- Quản lý danh sách phiếu.
- Tạo mẫu form linh động.
- Thiết lập chi tiết payment header / payment detail / chứng từ bắt buộc.
- Thiết lập workflow duyệt theo khung cố định:
  - Line Manager
  - Reviewer
  - HOD
  - CFO (nếu cần)
  - CEO (nếu cần)
- Thiết lập approver theo phòng ban.
- Hỗ trợ delegation / ủy quyền duyệt.
- Phân quyền truy cập và hiển thị theo người liên quan / phòng ban.
- Log và retry ERP integration.

Chưa triển khai trong giai đoạn 1:
- Workflow builder dạng kéo thả tự do.
- Nhiều loại chứng từ ngoài payment request.
- Mobile app riêng.
- Digital signature nâng cao.
- Budget control nâng cao theo real-time ERP.
- Workflow song song đa nhánh phức tạp.

---

## 3. Nguyên tắc thiết kế cốt lõi

### 3.1. Template linh động nhưng không phá cấu trúc
Template được phép cấu hình linh động ở mức:
- Header fields
- Detail grid schema
- Required attachments
- Display rules
- Validation rules cơ bản
- Output template (PDF/Word)

Nhưng template **không được phép**:
- Tự định nghĩa state mới.
- Tự viết workflow tự do.
- Tự chèn step duyệt tự do bằng script.
- Tự cấu hình approver bằng logic tùy ý không kiểm soát.

### 3.2. Workflow bán linh động, không tự do
Workflow phải giữ khung cứng để đảm bảo:
- Dễ hiểu
- Dễ audit
- Dễ test UAT
- Dễ tích hợp ERP
- Dễ bảo trì

Khung step chuẩn:
- Submit
- Line Manager
- Reviewer
- HOD
- CFO (conditional)
- CEO (conditional)
- Approved
- ERP Push

### 3.3. Phân quyền theo “need-to-know”
Mặc định chỉ những đối tượng liên quan trực tiếp mới được thấy phiếu.

Người được xem theo mặc định:
- Người tạo phiếu
- Người được chỉ định duyệt ở bất kỳ step nào
- Người được ủy quyền duyệt
- Finance Operations (nếu thuộc phạm vi quản trị nghiệp vụ)
- System/Workflow Admin (nếu được cấp quyền quản trị)

Có thể mở rộng phạm vi xem theo:
- Phòng ban của requester
- Phòng ban sở hữu phiếu
- Role nghiệp vụ
- Chính sách cấu hình riêng của template hoặc request type

### 3.4. Tách biệt 4 lớp cấu hình
Hệ thống phải tách rõ:
1. **Form Template** – cấu hình mẫu nhập liệu.
2. **Approval Policy** – cấu hình logic duyệt.
3. **Template Mapping Rule** – quy tắc gắn template với policy.
4. **Permission / Visibility Matrix** – quyền thao tác và quyền nhìn thấy dữ liệu.

---

## 4. Nhóm người dùng và vai trò

### 4.1. Requester
- Tạo phiếu mới
- Sửa draft của chính mình
- Submit phiếu
- Xem phiếu do mình tạo
- Theo dõi trạng thái duyệt
- Không được sửa phiếu sau khi đã submit, trừ khi bị trả về

### 4.2. Approver
Bao gồm:
- Line Manager
- Reviewer
- HOD
- CFO
- CEO

Quyền:
- Xem các phiếu đang ở step của mình
- Approve / Reject / Return for Revision
- Xem thông tin cần thiết để ra quyết định
- Xem timeline duyệt liên quan đến phiếu

### 4.3. Finance Operations
- Xem danh sách phiếu theo phạm vi được cấp quyền
- Kiểm tra chứng từ và trạng thái hậu duyệt
- Theo dõi trạng thái chờ đồng bộ ERP
- Quyết định **Release to ERP** hoặc **Hold Sync** sau khi phiếu đã được duyệt hoàn tất
- Retry ERP push theo chính sách kiểm soát
- Xem lỗi tích hợp
- Không mặc định là approver trong luồng duyệt, trừ khi doanh nghiệp cấu hình Finance tham gia như một step duyệt riêng trong policy

**Lưu ý quan trọng:** trong giải pháp này, **Finance Operations là đơn vị quyết định phiếu nào được phép đồng bộ sang ERP** sau khi đã được duyệt hoàn tất về mặt nghiệp vụ. Nghĩa là:
- Business approval hoàn tất **không đồng nghĩa** dữ liệu được push ERP ngay.
- Sau final approval, phiếu sẽ đi vào trạng thái **Waiting Finance Release**.
- Chỉ khi Finance Operations thực hiện hành động **Release to ERP**, hệ thống mới tạo integration job để đồng bộ sang ERP.
- Nếu Finance chưa release hoặc đặt trạng thái hold, phiếu sẽ không được đẩy sang ERP.

### 4.4. Department Config Admin
- Cấu hình Reviewer / HOD / fallback approver cho phòng ban mình phụ trách
- Không được sửa rule CFO/CEO toàn cục nếu không có quyền

### 4.5. Template Admin
- Tạo và sửa form template
- Cấu hình field, detail grid, attachment rules, UI grouping
- Không được tự tạo workflow tự do

### 4.6. Workflow Admin
- Tạo approval policy
- Cấu hình threshold, skip logic, escalation logic
- Cấu hình mapping rule giữa template và approval policy
- Quản lý delegation

### 4.7. ERP Integration Admin
- Xem payload push ERP
- Xem response từ ERP
- Retry push
- Theo dõi log tích hợp

### 4.8. Auditor / View-only Controller
- Xem phiếu theo phạm vi được phân quyền
- Xem audit log
- Không được sửa dữ liệu

---

## 5. Tổng quan quy trình nghiệp vụ

### 5.1. Quy trình chuẩn
1. Requester tạo phiếu đề nghị thanh toán.
2. Nhập dữ liệu Header.
3. Nhập Payment Detail line items.
4. Tải chứng từ đính kèm.
5. Hệ thống validate theo template.
6. Requester bấm **Submit**.
7. Workflow engine thực hiện **transaction submit** gồm:
   - validate lần cuối dữ liệu + quyền submit,
   - resolve template mapping + approval chain,
   - snapshot workflow instance,
   - tạo step đầu tiên ở trạng thái pending,
   - cập nhật business status sang **Pending Approval**,
   - ghi audit event `SUBMITTED`.
8. Sau khi submit thành công, hệ thống gửi thông báo cho approver đầu tiên qua:
   - in-app notification,
   - email notification (nếu bật cấu hình),
   - có thể mở rộng thêm Teams/Chat notification sau.
9. Nếu gửi notification thất bại:
   - phiếu **không bị kẹt**,
   - trạng thái nghiệp vụ vẫn là **Pending Approval**,
   - lỗi notification được log riêng và job notification sẽ retry theo cơ chế riêng.
10. Phiếu đi qua các step duyệt tuần tự.
11. Khi được duyệt hoàn tất về mặt nghiệp vụ, phiếu chuyển sang trạng thái **Approved** và trạng thái ERP là **Waiting Finance Release**.
12. Finance Operations kiểm tra và quyết định:
   - **Release to ERP** → hệ thống tạo integration job,
   - hoặc **Hold Sync** → chưa đồng bộ ERP.
13. Integration worker đẩy dữ liệu sang ERP qua API.
14. Ghi nhận kết quả thành công/thất bại.
15. Finance/Admin theo dõi log và retry khi cần.

### 5.2. Trạng thái nghiệp vụ chính
Đề xuất sử dụng business status gọn, rõ và không dùng `Submitted` như một trạng thái kéo dài.

- Draft
- Pending Approval
- Returned
- Rejected
- Approved
- Cancelled

**Lưu ý:**
- `Submitted` nên được coi là **audit event / action**, không phải business state kéo dài.
- Sau khi submit thành công, phiếu chuyển thẳng sang **Pending Approval**.

### 5.3. Trạng thái tích hợp ERP
Trạng thái ERP/sync phải tách riêng với business status.

- Not Ready
- Waiting Finance Release
- Hold by Finance
- Pending
- Processing
- Success
- Failed
- Manual Review Required

Diễn giải:
- `Not Ready`: phiếu chưa Approved nên chưa đủ điều kiện đồng bộ.
- `Waiting Finance Release`: phiếu đã Approved nhưng đang chờ Finance quyết định có cho đồng bộ hay không.
- `Hold by Finance`: Finance chủ động giữ lại, chưa cho sync.
- `Pending`: đã release, đã tạo integration job và chờ worker xử lý.
- `Processing`: worker đang gọi ERP API.
- `Success`: đồng bộ ERP thành công.
- `Failed`: lần push gần nhất thất bại nhưng còn trong giới hạn retry.
- `Manual Review Required`: đã vượt ngưỡng retry hoặc gặp lỗi bắt buộc con người xử lý.

### 5.4. Trigger và notification khi submit
Submit chỉ được coi là thành công khi hoàn tất đầy đủ các bước sau trong cùng transaction nghiệp vụ:
- validate template,
- validate chi tiết payment detail,
- validate attachment bắt buộc,
- resolve approver chain,
- tạo workflow instance,
- tạo pending step đầu tiên,
- cập nhật business status = `Pending Approval`.

Sau transaction này, notification được xử lý bất đồng bộ để tránh làm kẹt submit.

Nguyên tắc:
- Notification failure **không rollback submit**.
- Notification phải có log riêng và retry job riêng.
- Approver đầu tiên vẫn nhìn thấy phiếu trong **My Approvals** kể cả khi email gửi lỗi.

### 5.5. Vai trò của Finance Operations sau final approval
Trong giải pháp này, Finance Operations có vai trò nghiệp vụ hậu duyệt như sau:
- kiểm tra phiếu đã approved có đủ điều kiện sync ERP hay chưa,
- kiểm tra chứng từ/hồ sơ trước khi cho đồng bộ,
- quyết định `Release to ERP` hoặc `Hold Sync`,
- theo dõi lỗi đồng bộ,
- trigger manual retry trong phạm vi quyền được cấp.

Như vậy Finance không chỉ monitor đơn thuần, mà là **đầu mối quyết định việc đồng bộ ERP**.

## 6. Thiết kế Form Template linh động

## 6.1. Mục tiêu của Template
Template là thành phần giúp Admin định nghĩa các biến thể của Payment Request mà không cần sửa code.

Ví dụ template:
- Vendor Payment
- Employee Reimbursement
- Service Payment
- Urgent Payment

## 6.2. Thành phần của Template
Mỗi template gồm 5 phần:

### A. Template Header
- Template Code
- Template Name
- Description
- Active / Inactive
- Effective Date
- Version
- Department Scope (optional)

### B. Header Schema
Cấu hình các field phần đầu phiếu:
- Request Date
- Requester
- Department
- Payment Type
- Payee Type
- Vendor Code
- Payee Name
- Bank Info
- Currency
- Due Date
- Payment Reason
- Urgent flag
- Cost Center summary
- Internal reference

Mỗi field có thuộc tính:
- Field code
- Label
- Data type
- Required / Optional
- Read-only / Editable
- Default value
- Placeholder
- Help text
- Validation rule cơ bản
- Visibility rule cơ bản
- Order
- Group / section

### C. Detail Grid Schema
Phần Payment Detail phải là cấu hình độc lập.

Ví dụ các cột có thể cấu hình:
- Line No
- Description
- Invoice No
- Invoice Date
- Due Date
- Cost Center
- GL Account
- Project Code
- PO No
- Contract No
- Quantity
- Unit Price
- Amount
- VAT Amount
- Total Amount
- Remark

Thuộc tính từng cột:
- Column code
- Column label
- Data type
- Required / Optional
- Editable / Read-only
- Formula / derived field (giới hạn)
- Width
- Order
- Default value
- Validation rule

### D. Attachment Rules
Template phải cho cấu hình chứng từ đính kèm:
- Invoice
- Contract
- PO
- Acceptance Record
- Internal memo
- Supporting document

Mỗi loại attachment có thuộc tính:
- Attachment type code
- Label
- Required / Optional
- Allowed file types
- Max file size
- Max number of files
- Mandatory before submit / before final approval / before ERP push

### E. Output Template
- Mapping ra PDF/Word template
- Thiết lập tên file output
- Thiết lập trường nào hiển thị trên form in

## 6.3. Những gì Template Admin được phép làm
- Bật / tắt field
- Sắp xếp field
- Group field theo section
- Đặt field required/optional
- Cấu hình detail grid
- Cấu hình attachment bắt buộc
- Đặt mô tả, hướng dẫn điền form
- Gắn output template

## 6.4. Những gì Template Admin không được phép làm
- Tạo step duyệt ngoài khung chuẩn
- Tự định nghĩa approver logic bằng script
- Tự bypass CFO/CEO bằng logic tùy ý
- Ghi đè permission hệ thống nếu không có quyền riêng

---

## 7. Payment Request Header và Payment Detail

## 7.1. Payment Header
Thông tin tổng của phiếu, ví dụ:
- Request No
- Request Date
- Requester
- Department
- Payment Type
- Payee Type
- Vendor Code
- Payee Name
- Currency
- Total Amount
- Payment Reason
- Urgent Flag
- Request Status
- ERP Push Status

## 7.2. Payment Detail
Mỗi phiếu có thể có 1 hoặc nhiều dòng chi tiết.

Mỗi dòng detail nên hỗ trợ:
- Description
- Invoice No
- Invoice Date
- Due Date
- Cost Center
- GL Account
- Project Code
- PO No
- Contract No
- Amount
- VAT Amount
- Total Amount
- Remark

## 7.3. Tại sao bắt buộc phải có Detail
- Hỗ trợ nhiều invoice trong cùng 1 phiếu
- Hỗ trợ phân tách theo cost center/account/project
- Hỗ trợ mapping ERP header-lines đúng chuẩn
- Hỗ trợ validation tổng tiền
- Hỗ trợ kiểm toán và đối chiếu chi tiết

## 7.4. Summary Logic
Hệ thống phải tự tính:
- Subtotal = sum(detail.amount)
- VAT Total = sum(detail.vat_amount)
- Grand Total = sum(detail.total_amount)

Và đối chiếu với:
- Header Total Amount

---

## 8. Thiết kế Workflow duyệt có kiểm soát

## 8.1. Khung workflow chuẩn
Workflow chuẩn của Payment Request:
- Line Manager
- Reviewer
- HOD
- CFO (conditional)
- CEO (conditional)

Không cho phép workflow tự do ngoài khung này trong giai đoạn 1.

**Lưu ý:** bước `Finance Release to ERP` là **hậu duyệt / operational control**, không phải business approval step. Bước này chỉ xuất hiện sau khi request đã `Approved`.

## 8.2. Logic resolve approver
Approver được resolve theo thứ tự:
1. Line Manager từ hồ sơ user
2. Reviewer từ cấu hình phòng ban
3. HOD từ cấu hình phòng ban
4. CFO từ cấu hình global
5. CEO từ cấu hình global

## 8.3. Rule bật step
Ví dụ:
- Reviewer: always enabled
- HOD: enabled nếu cấu hình department có HOD
- CFO: bật nếu tổng tiền >= ngưỡng CFO
- CEO: bật nếu tổng tiền >= ngưỡng CEO hoặc special case

## 8.4. Rule deduplicate approver
Không cho cùng 1 người duyệt nhiều lần trên cùng 1 request.

Priority level:
CEO > CFO > HOD > Reviewer > Line Manager

Nếu cùng một user xuất hiện ở nhiều step:
- Giữ step cao nhất
- Step thấp hơn sẽ bị skip và log reason

## 8.5. Trường hợp đặc biệt quan trọng
### a. Line Manager = HOD
- Skip step thấp hơn hoặc gộp theo rule hệ thống

### b. Line Manager = CEO
- Không cho CEO xuất hiện ở giữa flow rồi lại final lần nữa
- Nếu request cần CEO final: skip Line Manager
- Nếu request không cần CEO final: có thể skip Line Manager hoặc dùng fallback approver

### c. CFO = CEO
- Chỉ giữ CEO final nếu cần
- CFO step bị skip nếu trùng user và CEO step đang bật

### d. Reviewer = HOD
- Giữ HOD hoặc Reviewer theo priority rule đã định

## 8.6. Delegation / Ủy quyền
Ủy quyền là lớp thay thế **người thực hiện action**, không làm thay đổi logic workflow.

Ví dụ:
- Original approver = HOD
- Acting approver = Delegate user
- Hệ thống vẫn log rõ original/acting

## 8.7. Snapshot workflow instance
Khi submit, hệ thống phải snapshot:
- Template version
- Approval policy version
- Resolved approver chain
- Rule match
- Delegation applied (nếu có)

Mục đích:
- Thay đổi config sau này không làm ảnh hưởng request đã submit

## 8.8. SLA, reminder và escalation
Workflow phải có SLA rõ ràng cho từng step hoặc theo policy.

Đề xuất tối thiểu giai đoạn 1:
- Sau **3 ngày làm việc** chưa action → gửi reminder cho approver hiện tại
- Sau **5 ngày làm việc** chưa action → gửi escalation notification cho cấp trên hoặc group kiểm soát theo policy
- Phiếu **không tự động approve** khi quá SLA
- Phiếu vẫn giữ ở step hiện tại cho đến khi có action hợp lệ hoặc admin override theo quyền đặc biệt

SLA nên được cấu hình theo:
- default system SLA,
- hoặc override theo approval policy,
- hoặc override theo urgent flag.

## 8.9. Trạng thái sau final approval
Sau khi step cuối cùng được approve:
- business_status = `Approved`
- erp_sync_status = `Waiting Finance Release`
- request xuất hiện trong worklist của Finance Operations để quyết định `Release to ERP` hoặc `Hold Sync`

## 9. Approval Policy và Mapping Rule

## 9.1. Approval Policy
Approval Policy định nghĩa:
- Step nào bật/tắt
- Rule ngưỡng tiền cho CFO/CEO
- Rule skip
- Escalation/SLA
- Special-case triggers

Ví dụ policy:
- PAY_STANDARD
- PAY_HIGH_VALUE
- PAY_URGENT

## 9.2. Template Mapping Rule
Dùng để gắn template với approval policy theo điều kiện.

Ví dụ:
- Template = Vendor Payment, Amount < 50m → PAY_STANDARD
- Template = Vendor Payment, Amount >= 50m → PAY_STANDARD + CFO enabled
- Template = Any, Amount >= 200m → CEO enabled

## 9.3. Nguyên tắc mapping
- Có priority
- Chỉ chọn 1 policy chính
- Các flag CFO/CEO có thể bật qua rule bổ sung nhưng vẫn trong khung cho phép
- Không cho mapping script tự do

---

## 10. Thiết kế Approval Setup theo phòng ban

## 10.1. Tư duy đúng
Không tạo mỗi phòng ban một workflow riêng hoàn toàn.

Thay vào đó:
- Dùng 1 khung workflow chuẩn
- Mỗi phòng ban cấu hình approver mapping cho các role cần thiết

## 10.2. Cấu hình department approval setup
Mỗi phòng ban có thể cấu hình:
- Reviewer user
- HOD user
- Optional fallback approver
- Active / Inactive
- Effective date

Line Manager lấy từ profile user.
CFO/CEO lấy từ global config.

## 10.3. Lợi ích
- Đơn giản hóa cấu hình
- Không nổ số lượng flow
- Dễ bảo trì khi đổi nhân sự
- Dễ audit

---

## 11. Phân quyền và phạm vi hiển thị dữ liệu

Đây là phần bắt buộc phải làm chặt.

## 11.1. Mục tiêu
- Chỉ người liên quan mới thấy phiếu theo mặc định
- Có tùy chọn cho phép nhìn theo phòng ban
- Có thể mở rộng cho role tài chính / kiểm soát / audit

## 11.2. Tách biệt hai loại quyền
### A. Action Permission
Quyền thao tác:
- create_request
- edit_own_draft
- submit_request
- approve_request
- reject_request
- return_request
- cancel_request
- retry_erp_push
- manage_template
- manage_policy
- manage_department_setup
- view_audit_log

### B. Data Visibility Permission
Quyền nhìn thấy dữ liệu:
- view_own_requests
- view_requests_pending_my_action
- view_requests_related_to_me
- view_department_requests
- view_all_requests_for_finance
- view_all_requests_for_admin
- view_erp_payload
- view_attachments
- view_audit_entries

## 11.3. Cơ chế visibility mặc định
Mặc định request chỉ hiển thị cho:
- Requester
- Các approver trong approval chain
- Delegate của approver đang active
- Finance Operations được cấp scope phù hợp
- System Admin / Workflow Admin nếu có quyền

## 11.4. Chế độ hiển thị theo phòng ban
Hệ thống hỗ trợ flag cấu hình trên template hoặc policy:
- `visibility_mode = related_only`
- `visibility_mode = related_and_same_department`
- `visibility_mode = related_and_department_admin`
- `visibility_mode = finance_shared`

### Ví dụ:
#### Mode 1 – related_only
Chỉ requester + approvers + finance/admin được xem

#### Mode 2 – related_and_same_department
Ngoài người liên quan trực tiếp, user cùng phòng ban có role phù hợp có thể thấy

#### Mode 3 – finance_shared
Toàn bộ Finance Operations có thể thấy

## 11.5. Visibility scope chi tiết theo cấp
### Cấp 1: Record-level visibility
Xác định user có nhìn thấy request hay không

### Cấp 2: Field-level masking (giai đoạn 2 hoặc nếu cần)
Ví dụ:
- Người xem được request nhưng không được xem bank account full
- Chỉ thấy 4 số cuối tài khoản

### Cấp 3: Attachment-level visibility
Ví dụ:
- Chỉ Finance và approver final được xem attachment loại bank proof

## 11.6. Chính sách visibility đề xuất giai đoạn 1
Áp dụng record-level là chính, attachment-level đơn giản.

Gợi ý:
- Requester: xem full phiếu của mình
- Approver: xem phiếu ở step của mình và lịch sử liên quan
- Related approver đã duyệt: vẫn xem được request để tra cứu lịch sử
- Same department: chỉ xem nếu template/policy cho phép
- Finance Ops: xem toàn bộ payment request trong công ty hoặc theo site/company
- Auditor: xem theo scope được cấp

## 11.7. Điều kiện xác định “người liên quan”
Một user được xem request nếu thỏa ít nhất một trong các điều kiện:
- Là requester
- Là approver ở bất kỳ step nào
- Là delegate active của approver
- Thuộc role Finance Ops có scope phù hợp
- Thuộc role System/Workflow/ERP Admin có quyền xem
- Thuộc cùng department và request có visibility_mode cho phép department visibility

## 11.8. Tùy chọn hiển thị theo phòng ban
Admin có thể cấu hình cho từng template hoặc policy:
- Cho phép department members xem hay không
- Cho phép department admin xem tất cả phiếu của department hay không
- Cho phép HOD xem toàn bộ phiếu của phòng ban kể cả không phải approver trực tiếp hay không

---

## 12. Kiến trúc giải pháp đề xuất

## 12.1. Thành phần hệ thống
1. **Web Application / Frontend**
   - Requester portal
   - Approval inbox
   - Admin setup screens
   - ERP log monitor

2. **Application API / Backend**
   - CRUD request
   - Template engine
   - Workflow engine
   - Permission & visibility engine
   - Audit log
   - Integration job management

3. **Database**
   - Lưu request, details, templates, policies, roles, visibility config, audit

4. **File Storage**
   - Lưu attachment
   - Lưu generated PDF/Word nếu cần

5. **Integration Worker / Queue**
   - Xử lý push ERP không đồng bộ
   - Retry logic

6. **ERP API Connector**
   - Mapping payload
   - Gửi dữ liệu sang ERP
   - Nhận và lưu response

## 12.2. Kiến trúc xử lý ERP đúng
Không push ERP trực tiếp trong transaction approve.

Đúng hơn là:
- Approved → tạo integration job
- Worker → push ERP
- Update ERP status
- Retry nếu failed

---

## 13. Mô hình dữ liệu đề xuất

## 13.1. Master tables
### users
- user_id
- employee_code
- full_name
- email
- department_id
- line_manager_id
- is_active

### departments
- department_id
- department_code
- department_name
- is_active

### department_approval_setup
- department_id
- reviewer_user_id
- hod_user_id
- fallback_user_id
- effective_from
- effective_to
- is_active

### global_approver_config
- company_code
- cfo_user_id
- ceo_user_id
- cfo_amount_threshold
- ceo_amount_threshold
- is_active

### delegations
- delegation_id
- delegator_user_id
- delegate_user_id
- request_type
- valid_from
- valid_to
- scope
- is_active

## 13.2. Template tables
### request_templates
- template_id
- template_code
- template_name
- request_type
- description
- version
- form_schema_json
- detail_schema_json
- attachment_rules_json
- visibility_mode
- output_template_id
- is_active

### template_policy_mappings
- mapping_id
- template_id
- department_id nullable
- amount_min nullable
- amount_max nullable
- priority
- policy_id
- is_active

## 13.3. Policy tables
### approval_policies
- policy_id
- policy_code
- policy_name
- request_type
- config_json
- is_active

## 13.4. Transaction tables
### payment_requests
- request_id
- request_no
- template_id
- template_version
- requester_id
- department_id
- request_date
- payment_type
- payee_type
- vendor_code
- payee_name
- currency
- total_amount
- reason
- urgent_flag
- visibility_mode
- business_status
- approved_at
- erp_sync_status
- erp_release_by
- erp_release_at
- erp_hold_reason
- created_at
- updated_at

### payment_request_details
- detail_id
- request_id
- line_no
- description
- invoice_no
- invoice_date
- due_date
- cost_center
- gl_account
- project_code
- po_no
- contract_no
- amount
- vat_amount
- total_amount
- remark

### payment_request_attachments
- attachment_id
- request_id
- detail_id nullable
- attachment_type
- file_name
- file_path
- file_size
- uploaded_by
- uploaded_at

### request_workflow_instances
- workflow_instance_id
- request_id
- policy_id
- policy_version
- snapshot_json
- current_step_no
- status

### request_workflow_steps
- step_id
- workflow_instance_id
- step_no
- step_code
- original_user_id
- acting_user_id
- status
- action_at
- action_note
- skipped_reason

### integration_jobs
- job_id
- ref_type
- ref_id
- target_system
- payload_json
- status
- retry_count
- last_error
- next_retry_at
- created_at
- updated_at

### erp_push_logs
- log_id
- request_id
- payload_json
- response_json
- status
- attempt_no
- error_message
- pushed_at

### audit_logs
- audit_id
- entity_type
- entity_id
- action_code
- changed_by
- changed_at
- old_value_json
- new_value_json
- note

---

## 14. API tích hợp ERP

## 14.1. Nguyên tắc
- Chỉ push khi request đã Approved hoàn tất **và đã được Finance Operations release**.
- Không push trùng request đã success nếu không có override hợp lệ.
- Ghi log đầy đủ request/response.
- Hỗ trợ auto-retry + manual retry có kiểm soát.
- Finance Operations là role quyết định có cho đồng bộ ERP hay chưa.

## 14.2. Luồng
1. Final approver approve step cuối cùng.
2. Hệ thống cập nhật:
   - business_status = `Approved`
   - erp_sync_status = `Waiting Finance Release`
3. Phiếu đi vào queue làm việc của Finance Operations.
4. Finance Operations quyết định:
   - `Release to ERP` → hệ thống tạo integration job = Pending
   - `Hold Sync` → erp_sync_status = `Hold by Finance`
5. Worker đọc job Pending.
6. Build payload header + detail.
7. Gọi ERP API.
8. ERP trả response.
9. Update status + log.

## 14.3. Dữ liệu đẩy sang ERP
Payload thực tế phải được chốt với phía ERP, nhưng tối thiểu cần đối chiếu đầy đủ với dữ liệu Payment Header / Payment Detail.

### Header đề xuất
- Request No
- Request Date
- Requester
- Department
- Payment Type
- Payee Type
- Vendor / Payee
- Currency
- Total Amount
- Due Date
- Urgent Flag
- Bank Account Name
- Bank Account Number
- Bank Name
- Reason
- Released to ERP By
- Released to ERP At

### Detail đề xuất
- Line No
- Description
- Invoice No
- Invoice Date
- Due Date
- Cost Center
- GL Account
- Project Code
- PO No
- Contract No
- Amount
- VAT Amount
- Total Amount
- Remark

**Lưu ý:** do mapping ERP phụ thuộc hệ thống đích, cần workshop chốt field mapping với đội ERP trước khi phát triển integration chính thức.

## 14.4. Retry policy và quyền retry
### Auto-retry đề xuất
- Retry tối đa **3 lần tự động**
- Khoảng cách retry: ví dụ 5 phút → 30 phút → 2 giờ
- Chỉ auto-retry với nhóm lỗi tạm thời như timeout, network error, 5xx
- Không auto-retry với lỗi dữ liệu/business validation từ ERP nếu payload chắc chắn sai

### Sau khi vượt retry
- erp_sync_status = `Manual Review Required`
- Finance Operations và ERP Integration Admin được notify để xử lý thủ công

### Manual retry
- Chỉ role `Finance Operations` hoặc `ERP Integration Admin` mới được manual retry
- Manual retry phải có reason/note
- Có thể giới hạn theo policy, ví dụ tối đa 5 manual retries trước khi bắt buộc escalate

## 14.5. Quyền trigger ERP sync
Chỉ các role được cấp quyền sau mới được thao tác:
- `release_to_erp`
- `hold_erp_sync`
- `retry_erp_push`
- `view_erp_payload`
- `view_erp_response`

Điểm quan trọng:
- **Requester không có quyền đẩy ERP**
- **Approver nghiệp vụ không mặc định có quyền đẩy ERP**
- **Finance Operations là chủ thể quyết định release sang ERP**

## 14.6. Atomicity và chống race condition
Rủi ro cần xử lý: request đã `Approved` nhưng không tạo được integration job hoặc tạo không nhất quán.

Giải pháp đề xuất:
- Hành động `Release to ERP` phải được xử lý theo 1 transaction nhất quán:
  - update erp_sync_status,
  - tạo integration job/outbox record,
  - ghi audit log release action.
- Có job reconcile định kỳ để phát hiện bất thường như:
  - request `Approved` + `erp_sync_status = Waiting Finance Release` quá lâu,
  - request `Released` nhưng chưa có integration job,
  - integration job tồn tại nhưng request status không đồng bộ.

Khuyến nghị kỹ thuật:
- dùng **transactional outbox pattern** hoặc cơ chế tương đương,
- worker chỉ đọc từ outbox/job table sau khi transaction chính commit thành công.

## 14.7. Endpoint nội bộ đề xuất
- POST /api/payment-requests
- GET /api/payment-requests
- GET /api/payment-requests/{id}
- PUT /api/payment-requests/{id}
- POST /api/payment-requests/{id}/submit
- POST /api/payment-requests/{id}/approve
- POST /api/payment-requests/{id}/reject
- POST /api/payment-requests/{id}/return
- POST /api/payment-requests/{id}/cancel
- POST /api/payment-requests/{id}/release-to-erp
- POST /api/payment-requests/{id}/hold-erp-sync
- GET /api/erp-jobs
- POST /api/erp-jobs/{id}/retry

## 15. Giao diện nghiệp vụ chính

## 15.1. Dashboard
- KPI cards
- Pending approvals
- Recent requests
- ERP failed pushes
- Bottleneck chart

## 15.2. Payment Request List
- Bộ lọc mạnh
- Status badges
- ERP status badges
- Saved filters
- Export

## 15.3. Payment Request Form
Bao gồm:
- Header section
- Payment Detail Grid
- Summary panel
- Attachments section
- Approval preview

## 15.4. Payment Request Detail
- Summary card
- Detail lines table
- Approval timeline
- Audit/activity log
- ERP result panel

## 15.5. Approval Inbox
- Pending
- Completed
- Delegated to me
- SLA highlight

## 15.6. Template Admin Setup
- Template list
- Template editor
- Header field config
- Detail grid config
- Attachment rules
- Visibility mode setting
- Preview

## 15.7. Approval Setup
- Department list
- Reviewer/HOD setup
- Global CFO/CEO config
- Threshold config
- Preview chain per scenario

## 15.8. Permission / Visibility Setup
- Role matrix
- Action permissions
- Visibility policies
- Department visibility options

## 15.9. ERP Integration Log
- Retry
- Payload preview
- Response preview
- Error timeline

---

## 16. Bảo mật, kiểm toán và truy vết

## 16.1. Bảo mật
- Authentication qua SSO/AD hoặc identity nội bộ
- Authorization theo role + visibility engine
- HTTPS only
- Attachment access control
- API auth cho integration

## 16.2. Audit bắt buộc
Phải log các hành động:
- Tạo/Sửa/Xóa template
- Thay đổi approval policy
- Thay đổi approver mapping theo phòng ban
- Submit/Approve/Reject/Return request
- Retry ERP push
- Visibility changes
- Delegation changes

## 16.3. Versioning
- Template versioning
- Policy versioning
- Output template versioning
- Snapshot request khi submit

---

## 17. Quy tắc validate chính

### 17.1. Form validation
- Ít nhất 1 detail line
- Tổng header = tổng detail
- Field required phải có dữ liệu
- Attachment required phải đủ trước khi submit
- Dữ liệu tài khoản ngân hàng hợp lệ theo cấu hình

### 17.2. Workflow validation
- Department phải có reviewer/HOD nếu policy yêu cầu
- User phải có line manager nếu step LM đang

1. Tạo phiếu vendor payment với 1 detail line, amount dưới ngưỡng CFO.
2. Tạo phiếu nhiều detail lines, amount trên ngưỡng CFO.
3. Tạo phiếu trên ngưỡng CEO.
4. Line Manager trùng HOD.
5. Line Manager là CEO.
6. Reviewer trùng HOD.
7. HOD đang ủy quyền cho user khác.
8. Phiếu bị return về requester để sửa rồi resubmit.
9. Approved thành công nhưng ERP push failed.
10. Finance retry ERP push thành công.
11. User không liên quan cố truy cập request → bị chặn.
12. User cùng phòng ban truy cập request khi visibility_mode = related_and_same_department → được xem.
13. User cùng phòng ban truy cập request khi visibility_mode = related_only → không được xem.
14. Department admin xem toàn bộ phiếu phòng ban nếu policy cho phép.
15. Template đổi version nhưng request cũ vẫn giữ snapshot cũ.

---

## 19. Lộ trình triển khai đề xuất

## Phase 1 – MVP
- User / Department / Approver setup
- Payment Request Header + Detail + Attachments
- Fixed workflow engine
- Department approval mapping
- CFO/CEO threshold
- Record-level visibility
- ERP push job + retry
- Basic audit logs

## Phase 2
- Template config nâng cao
- Attachment-level visibility
- Field masking
- Delegation nâng cao
- Output PDF/Word template hoàn chỉnh
- Better dashboards

## Phase 3
- Nhiều loại request khác
- Budget checking
- Digital signature
- Analytics & SLA escalation nâng cao

---

## 20. Kiến nghị triển khai

1. Giai đoạn đầu nên **ưu tiên chạy ổn 1 flow duy nhất**.
2. Template phải linh động nhưng chỉ trong phạm vi cho phép.
3. Permission và visibility phải được coi là phần lõi, không làm bổ sung sau.
4. ERP integration phải tách bằng job/queue.
5. Mọi cấu hình quan trọng phải có audit và version.
6. Không làm workflow builder tự do trong giai đoạn đầu.

---

## 21. Kết luận
Giải pháp đề xuất cho phép xây dựng một module Đề nghị thanh toán:
- đủ linh động để Template Admin cấu hình mẫu mạnh,
- đủ kiểm soát để workflow không bị biến số quá lớn,
- đủ dữ liệu để tích hợp ERP,
- và đủ chặt về phân quyền để chỉ người liên quan mới thấy dữ liệu, có tùy chọn chia sẻ theo phòng ban.

Đây là hướng phù hợp để triển khai thực tế trong doanh nghiệp mà vẫn giữ được tính kiểm soát, tính kiểm toán và khả năng mở rộng về sau.

