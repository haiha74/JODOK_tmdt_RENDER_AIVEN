
/* =========================================
   JODOK - INFORMATION & POLICY PAGES
========================================= */

/*
  Cần điền thông tin thật trước khi công bố:
  - Chủ thể kinh doanh
  - Địa chỉ và thông tin liên hệ
  - Phương thức thanh toán thực tế
  - Thời hạn xử lý, đổi trả, hoàn tiền
  - Chương trình thành viên và điểm thưởng
*/

const JODOK_POLICY_CONFIG = {
  businessName: "[Tên pháp lý của đơn vị kinh doanh]",
  businessAddress: "[Địa chỉ kinh doanh đầy đủ]",
  businessCode: "[Mã số thuế hoặc thông tin đăng ký phù hợp]",
  hotline: "0900 888 999",
  email: "[Email hỗ trợ chính thức]",
  supportHours: "[Giờ làm việc thực tế]",
  effectiveDate: "[Ngày áp dụng chính sách]"
};

const INFO_GROUPS = [
  {
    title: "HỖ TRỢ KHÁCH HÀNG",
    links: [
      ["Hướng dẫn đặt hàng", "ordering-guide"],
      ["Phương thức thanh toán", "payment-methods"],
      ["Chính sách sinh nhật thành viên", "birthday-policy"],
      ["Chính sách tích - tiêu điểm", "loyalty-policy"],
      ["Chính sách hoàn tiền", "refund-policy"]
    ]
  },
  {
    title: "CHÍNH SÁCH",
    links: [
      ["Chính sách vận chuyển", "shipping-policy"],
      ["Chính sách kiểm hàng", "inspection-policy"],
      ["Chính sách đổi trả", "return-policy"],
      ["Điều kiện & Điều khoản", "terms"],
      ["Chính sách bảo mật", "privacy-policy"]
    ]
  }
];

const INFO_PAGES = {
  "ordering-guide": {
    title: "Hướng dẫn đặt hàng",
    intro: "Các bước mua sắm và xác nhận đơn hàng tại JODOK.",
    sections: [
      {
        title: "1. Lựa chọn sản phẩm",
        paragraphs: [
          "Khách hàng truy cập danh mục sản phẩm, xem hình ảnh, mô tả, giá bán, kích cỡ, màu sắc và tình trạng còn hàng.",
          "Vui lòng kiểm tra bảng kích thước và thông tin biến thể trước khi thêm sản phẩm vào giỏ hàng."
        ]
      },
      {
        title: "2. Kiểm tra giỏ hàng",
        paragraphs: [
          "Tại giỏ hàng, khách hàng có thể điều chỉnh số lượng hoặc loại bỏ sản phẩm. Giá bán, ưu đãi và tổng tiền cần được kiểm tra trước khi tiếp tục."
        ]
      },
      {
        title: "3. Nhập thông tin giao hàng",
        paragraphs: [
          "Cung cấp chính xác họ tên, số điện thoại, địa chỉ nhận hàng và ghi chú giao hàng nếu cần. Thông tin không đầy đủ có thể làm chậm quá trình giao nhận."
        ]
      },
      {
        title: "4. Kiểm tra và xác nhận đơn",
        paragraphs: [
          "Trước khi đặt hàng, khách hàng cần được xem lại sản phẩm, số lượng, giá, giảm giá, phí vận chuyển, phương thức thanh toán và tổng số tiền.",
          "Sau khi gửi đơn, hệ thống ghi nhận yêu cầu đặt hàng. Trạng thái xác nhận, xử lý và giao hàng được cập nhật trong mục đơn hàng hoặc qua kênh liên hệ đã đăng ký."
        ]
      },
      {
        title: "5. Thay đổi hoặc hủy đơn",
        paragraphs: [
          "Khách hàng liên hệ JODOK càng sớm càng tốt và cung cấp mã đơn hàng. Khả năng thay đổi hoặc hủy phụ thuộc vào trạng thái xử lý và bàn giao vận chuyển.",
          "Nếu đơn đã được giao cho đơn vị vận chuyển, JODOK sẽ thông báo phương án xử lý và các chi phí phát sinh nếu có trước khi khách hàng quyết định."
        ]
      }
    ]
  },

  "payment-methods": {
    title: "Phương thức thanh toán",
    intro: "Khách hàng được biết rõ số tiền và phương thức thanh toán trước khi xác nhận đơn hàng.",
    sections: [
      {
        title: "1. Phương thức được hỗ trợ",
        paragraphs: [
          "JODOK chỉ áp dụng những phương thức được hiển thị và cho phép lựa chọn tại bước thanh toán của đơn hàng.",
          "Nếu hỗ trợ thanh toán khi nhận hàng (COD), khách hàng thanh toán theo số tiền được xác nhận trên đơn.",
          "Nếu hỗ trợ chuyển khoản hoặc thanh toán trực tuyến, thông tin nhận tiền và hướng dẫn sẽ được cung cấp trong quy trình thanh toán chính thức."
        ]
      },
      {
        title: "2. Tổng số tiền thanh toán",
        paragraphs: [
          "Tổng thanh toán bao gồm giá sản phẩm sau ưu đãi, phí vận chuyển và các khoản phí khác nếu có. Những khoản này phải được hiển thị trước khi khách hàng đặt hàng.",
          "JODOK không yêu cầu khách hàng chuyển tiền vào tài khoản cá nhân được gửi qua tin nhắn không xác minh."
        ]
      },
      {
        title: "3. Giao dịch lỗi hoặc thanh toán trùng",
        paragraphs: [
          "Nếu đã bị trừ tiền nhưng đơn hàng chưa được ghi nhận, khách hàng vui lòng lưu mã giao dịch, thời gian, số tiền và liên hệ bộ phận hỗ trợ.",
          "JODOK phối hợp đối soát với đơn vị thanh toán và thông báo kết quả, phương án hoàn trả nếu xác định có khoản thu không hợp lệ."
        ]
      },
      {
        title: "4. Bảo mật thanh toán",
        paragraphs: [
          "Không cung cấp mật khẩu, mã OTP hoặc thông tin xác thực ngân hàng cho bất kỳ người nào. JODOK không yêu cầu khách hàng gửi những thông tin này qua điện thoại hoặc tin nhắn."
        ]
      }
    ]
  },

  "birthday-policy": {
    title: "Chính sách sinh nhật thành viên",
    intro: "Thông tin về ưu đãi sinh nhật dành cho khách hàng tham gia chương trình thành viên.",
    sections: [
      {
        title: "1. Điều kiện tham gia",
        paragraphs: [
          "Ưu đãi sinh nhật chỉ áp dụng khi JODOK đang triển khai chương trình và khách hàng đáp ứng điều kiện được công bố tại thời điểm sử dụng.",
          "Ngày sinh cần được cung cấp chính xác trong tài khoản theo quy trình của chương trình."
        ]
      },
      {
        title: "2. Giá trị và thời hạn ưu đãi",
        paragraphs: [
          "Giá trị quà tặng hoặc mã giảm giá, thời gian hiệu lực, đơn hàng tối thiểu, sản phẩm áp dụng và khả năng kết hợp ưu đãi phải được thể hiện trong thông báo chương trình.",
          "Không mặc định mọi tài khoản đều nhận cùng một ưu đãi hoặc có thể quy đổi quà tặng thành tiền mặt."
        ]
      },
      {
        title: "3. Sử dụng ưu đãi",
        paragraphs: [
          "Khách hàng kiểm tra điều kiện tại tài khoản hoặc trang chương trình trước khi đặt hàng. Mã đã hết hạn hoặc không đáp ứng điều kiện sẽ không được áp dụng."
        ]
      },
      {
        title: "4. Điều chỉnh chương trình",
        paragraphs: [
          "Các thay đổi về chương trình sẽ được công bố rõ ràng. Quyền lợi đã phát sinh hợp lệ được xử lý theo điều kiện đã thông báo và quy định pháp luật có liên quan."
        ]
      }
    ]
  },

  "loyalty-policy": {
    title: "Chính sách tích - tiêu điểm",
    intro: "Nguyên tắc ghi nhận, sử dụng và điều chỉnh điểm thành viên.",
    sections: [
      {
        title: "1. Cách tích điểm",
        paragraphs: [
          "Tỷ lệ tích điểm, giao dịch đủ điều kiện và thời điểm ghi nhận điểm được công bố trong chương trình thành viên hiện hành.",
          "Đơn hàng bị hủy, hoàn tiền hoặc trả hàng có thể dẫn đến điều chỉnh số điểm tương ứng theo điều kiện chương trình."
        ]
      },
      {
        title: "2. Cách sử dụng điểm",
        paragraphs: [
          "Giá trị quy đổi, mức điểm tối thiểu, mức sử dụng tối đa và sản phẩm áp dụng được hiển thị trước khi khách hàng xác nhận sử dụng điểm.",
          "Điểm thưởng không tự động được coi là tiền mặt và chỉ được quy đổi theo các hình thức mà chương trình công bố."
        ]
      },
      {
        title: "3. Thời hạn và lịch sử điểm",
        paragraphs: [
          "Nếu điểm có thời hạn sử dụng, ngày hết hạn phải được thông báo rõ. Khách hàng có thể đối chiếu số điểm và lịch sử giao dịch qua kênh hỗ trợ hoặc tính năng tài khoản nếu được cung cấp."
        ]
      },
      {
        title: "4. Khiếu nại điểm thưởng",
        paragraphs: [
          "Khi có sai lệch, khách hàng cung cấp mã đơn hàng hoặc chứng từ liên quan để JODOK kiểm tra và phản hồi."
        ]
      }
    ]
  },

  "refund-policy": {
    title: "Chính sách hoàn tiền",
    intro: "Quy trình xử lý khoản tiền phải hoàn cho khách hàng.",
    sections: [
      {
        title: "1. Trường hợp xem xét hoàn tiền",
        paragraphs: [
          "Đơn hàng được hủy hợp lệ sau khi đã thanh toán; sản phẩm được chấp thuận trả hàng; thanh toán trùng; hoặc các trường hợp khác phát sinh nghĩa vụ hoàn tiền theo thỏa thuận và pháp luật."
        ]
      },
      {
        title: "2. Xác nhận số tiền hoàn",
        paragraphs: [
          "JODOK thông báo số tiền hoàn, căn cứ tính toán và các khoản điều chỉnh nếu có. Khoản phí chỉ được khấu trừ khi có cơ sở hợp lệ và đã được thông tin rõ."
        ]
      },
      {
        title: "3. Phương thức hoàn",
        paragraphs: [
          "Khoản tiền được hoàn qua phương thức phù hợp với giao dịch ban đầu hoặc phương thức khác được khách hàng xác nhận. JODOK không yêu cầu cung cấp mật khẩu hay OTP để nhận hoàn tiền."
        ]
      },
      {
        title: "4. Thời gian xử lý",
        paragraphs: [
          "Thời hạn xử lý nội bộ: [Điền số ngày làm việc thực tế]. Thời gian tiền về tài khoản còn phụ thuộc ngân hàng hoặc đơn vị trung gian thanh toán.",
          "JODOK thông báo khi hồ sơ thiếu thông tin, cần đối soát hoặc có phát sinh chậm trễ."
        ]
      },
      {
        title: "5. Tra soát",
        paragraphs: [
          "Khách hàng cung cấp mã đơn hàng, thông tin giao dịch và kênh liên hệ để yêu cầu kiểm tra trạng thái hoàn tiền."
        ]
      }
    ]
  },

  "shipping-policy": {
    title: "Chính sách vận chuyển",
    intro: "Thông tin giao nhận, phí vận chuyển và trách nhiệm khi đơn hàng phát sinh sự cố.",
    sections: [
      {
        title: "1. Phạm vi giao hàng",
        paragraphs: [
          "JODOK giao hàng đến những địa chỉ được hệ thống và đơn vị vận chuyển hỗ trợ tại thời điểm đặt hàng. Trường hợp địa chỉ ngoài phạm vi phục vụ sẽ được thông báo trước khi xác nhận đơn."
        ]
      },
      {
        title: "2. Phí vận chuyển",
        paragraphs: [
          "Phí vận chuyển được tính theo địa chỉ nhận hàng, đặc điểm đơn hàng, đơn vị giao nhận và chương trình ưu đãi đang áp dụng.",
          "Phí thực tế phải được hiển thị trong bước kiểm tra đơn hàng. Nếu có phụ phí phát sinh, JODOK thông báo và xin xác nhận trước khi thực hiện."
        ]
      },
      {
        title: "3. Thời gian giao hàng",
        paragraphs: [
          "Thời gian xử lý đơn dự kiến: [Điền thời gian thực tế]. Thời gian giao hàng dự kiến: [Điền theo khu vực hoặc đơn vị vận chuyển].",
          "Ngày giao dự kiến không đồng nghĩa với cam kết giao chính xác trong mọi trường hợp. Nếu có chậm trễ, JODOK sẽ cập nhật thông tin và hỗ trợ phương án xử lý phù hợp."
        ]
      },
      {
        title: "4. Theo dõi đơn hàng",
        paragraphs: [
          "Khách hàng theo dõi trạng thái tại mục đơn hàng hoặc qua mã vận đơn nếu được cung cấp."
        ]
      },
      {
        title: "5. Thất lạc hoặc hư hỏng",
        paragraphs: [
          "Khi phát hiện kiện hàng thất lạc, hư hỏng hoặc giao sai, khách hàng liên hệ JODOK kèm mã đơn và hình ảnh liên quan nếu có.",
          "JODOK phối hợp đơn vị vận chuyển xác minh và thông báo phương án giao lại, đổi trả hoặc hoàn tiền theo kết quả xử lý và quyền lợi hợp pháp của khách hàng."
        ]
      }
    ]
  },

  "inspection-policy": {
    title: "Chính sách kiểm hàng",
    intro: "Hướng dẫn kiểm tra kiện hàng và xử lý khi sản phẩm không đúng đơn.",
    sections: [
      {
        title: "1. Trước khi nhận hàng",
        paragraphs: [
          "Khách hàng kiểm tra thông tin người nhận, tình trạng bao bì, dấu hiệu rách, móp, ướt hoặc bị mở bất thường.",
          "Quyền mở kiện để kiểm tra trước khi thanh toán phụ thuộc phương thức giao nhận và quy định được thông báo cho đơn hàng cụ thể."
        ]
      },
      {
        title: "2. Nội dung kiểm tra",
        paragraphs: [
          "Đối chiếu tên sản phẩm, số lượng, màu sắc, kích cỡ và tình trạng bên ngoài với thông tin đặt hàng.",
          "Việc thử hoặc sử dụng sản phẩm trong quá trình kiểm hàng cần tuân theo điều kiện giao nhận đã công bố."
        ]
      },
      {
        title: "3. Khi phát hiện sai lệch",
        paragraphs: [
          "Nếu kiện hàng có dấu hiệu bất thường, khách hàng có thể ghi nhận hình ảnh, trao đổi với nhân viên giao nhận và liên hệ JODOK.",
          "Trường hợp đã nhận hàng, khách hàng giữ sản phẩm, bao bì và chứng từ liên quan để được hỗ trợ đối chiếu."
        ]
      },
      {
        title: "4. Quyền lợi khách hàng",
        paragraphs: [
          "Việc không quay video mở hộp không tự động làm mất quyền khiếu nại hợp pháp. JODOK xem xét chứng cứ và thông tin giao dịch có liên quan."
        ]
      }
    ]
  },

  "return-policy": {
    title: "Chính sách đổi trả",
    intro: "Điều kiện, cách yêu cầu đổi trả và phân định trách nhiệm chi phí.",
    sections: [
      {
        title: "1. Các trường hợp hỗ trợ",
        paragraphs: [
          "Sản phẩm giao sai mẫu, sai kích cỡ hoặc màu so với đơn đã xác nhận; thiếu hàng; hư hỏng; lỗi chất lượng; hoặc trường hợp khác theo chính sách đã công bố và quy định pháp luật.",
          "Đổi do nhu cầu cá nhân, chẳng hạn muốn thay kích cỡ hoặc mẫu mã, được xem xét theo điều kiện chương trình đổi hàng đang áp dụng."
        ]
      },
      {
        title: "2. Thời hạn yêu cầu",
        paragraphs: [
          "Thời hạn yêu cầu đổi trả thông thường: [Điền số ngày thực tế và mốc tính thời gian].",
          "Thời hạn nêu trong chính sách không hạn chế các quyền khiếu nại hoặc yêu cầu khắc phục mà pháp luật dành cho người tiêu dùng."
        ]
      },
      {
        title: "3. Tình trạng sản phẩm",
        paragraphs: [
          "Với yêu cầu đổi do nhu cầu cá nhân, sản phẩm cần đáp ứng điều kiện về tình trạng, phụ kiện và chứng từ đã công bố.",
          "Với sản phẩm lỗi hoặc giao sai, JODOK xem xét bản chất sự cố; không áp dụng máy móc điều kiện còn nguyên bao bì để từ chối quyền lợi hợp pháp."
        ]
      },
      {
        title: "4. Quy trình đổi trả",
        paragraphs: [
          "Bước 1: Liên hệ hỗ trợ và cung cấp mã đơn, vấn đề gặp phải cùng chứng cứ nếu có.",
          "Bước 2: JODOK tiếp nhận, kiểm tra thông tin và thông báo hướng xử lý.",
          "Bước 3: Hai bên thống nhất cách thu hồi hoặc gửi trả hàng khi cần.",
          "Bước 4: JODOK xác nhận kết quả đổi hàng hoặc hoàn tiền."
        ]
      },
      {
        title: "5. Chi phí đổi trả",
        paragraphs: [
          "Nếu lỗi thuộc về JODOK hoặc quá trình thực hiện đơn hàng, chi phí xử lý hợp lý được phân bổ theo trách nhiệm của các bên và quy định pháp luật.",
          "Nếu khách hàng đổi do nhu cầu cá nhân, mọi khoản phí áp dụng phải được thông báo trước khi khách hàng xác nhận."
        ]
      }
    ]
  },

  "terms": {
    title: "Điều kiện & Điều khoản",
    intro: "Thông tin chung về việc sử dụng website và giao dịch mua bán tại JODOK.",
    sections: [
      {
        title: "1. Thông tin đơn vị kinh doanh",
        paragraphs: [
          "Đơn vị vận hành: " + JODOK_POLICY_CONFIG.businessName,
          "Địa chỉ: " + JODOK_POLICY_CONFIG.businessAddress,
          "Thông tin đăng ký: " + JODOK_POLICY_CONFIG.businessCode,
          "Liên hệ: " + JODOK_POLICY_CONFIG.hotline + " — " + JODOK_POLICY_CONFIG.email
        ]
      },
      {
        title: "2. Thông tin sản phẩm và giá",
        paragraphs: [
          "JODOK cung cấp thông tin sản phẩm để khách hàng đánh giá trước khi mua, bao gồm đặc tính, giá bán và biến thể liên quan.",
          "Giá, ưu đãi và phí phát sinh được thể hiện trong quy trình đặt hàng. Khi phát hiện thông tin sai lệch, JODOK thông báo để khách hàng xác nhận lại hoặc xử lý đơn theo quy định."
        ]
      },
      {
        title: "3. Giao kết đơn hàng",
        paragraphs: [
          "Việc khách hàng gửi đơn là yêu cầu đặt mua. JODOK thông báo tình trạng tiếp nhận và xác nhận đơn qua hệ thống hoặc kênh liên hệ đã đăng ký.",
          "Khách hàng có trách nhiệm cung cấp thông tin nhận hàng chính xác và kiểm tra nội dung đơn trước khi xác nhận."
        ]
      },
      {
        title: "4. Quyền và trách nhiệm",
        paragraphs: [
          "JODOK có trách nhiệm cung cấp thông tin trung thực, thực hiện giao dịch đã xác nhận và tiếp nhận phản ánh của khách hàng.",
          "Khách hàng có trách nhiệm sử dụng thông tin hợp pháp, không can thiệp trái phép vào hệ thống và thanh toán theo giao dịch đã xác nhận."
        ]
      },
      {
        title: "5. Khiếu nại và tranh chấp",
        paragraphs: [
          "Khách hàng có thể gửi phản ánh kèm mã đơn hàng và nội dung sự việc qua kênh hỗ trợ chính thức.",
          "JODOK ưu tiên đối chiếu chứng từ và trao đổi để giải quyết. Nếu không đạt được thỏa thuận, các bên có quyền sử dụng cơ chế giải quyết tranh chấp theo pháp luật."
        ]
      },
      {
        title: "6. Cập nhật điều khoản",
        paragraphs: [
          "Phiên bản áp dụng và ngày cập nhật cần được công bố. Thay đổi điều khoản không được sử dụng để đơn phương tước bỏ quyền lợi đã phát sinh hợp pháp của khách hàng."
        ]
      }
    ]
  },

  "privacy-policy": {
    title: "Chính sách bảo mật",
    intro: "Thông tin về cách JODOK thu thập, sử dụng, lưu giữ và bảo vệ dữ liệu cá nhân.",
    sections: [
      {
        title: "1. Đơn vị xử lý dữ liệu",
        paragraphs: [
          "Đơn vị vận hành: " + JODOK_POLICY_CONFIG.businessName,
          "Địa chỉ liên hệ: " + JODOK_POLICY_CONFIG.businessAddress,
          "Kênh tiếp nhận yêu cầu về dữ liệu: " + JODOK_POLICY_CONFIG.email
        ]
      },
      {
        title: "2. Dữ liệu có thể được thu thập",
        paragraphs: [
          "Thông tin tài khoản và liên hệ như họ tên, số điện thoại, email, địa chỉ giao hàng; thông tin đơn hàng, lịch sử mua sắm và yêu cầu hỗ trợ.",
          "Dữ liệu kỹ thuật như địa chỉ IP, thông tin thiết bị hoặc cookie chỉ được xử lý theo hoạt động thực tế của website và thông báo áp dụng."
        ]
      },
      {
        title: "3. Mục đích sử dụng",
        paragraphs: [
          "Xử lý đơn hàng, giao nhận, thanh toán, chăm sóc khách hàng, xử lý khiếu nại, bảo vệ tài khoản và thực hiện nghĩa vụ pháp lý.",
          "Hoạt động quảng cáo, tiếp thị hoặc cá nhân hóa cần được thực hiện theo căn cứ xử lý dữ liệu phù hợp và lựa chọn của khách hàng."
        ]
      },
      {
        title: "4. Bên nhận dữ liệu",
        paragraphs: [
          "Trong phạm vi cần thiết, thông tin có thể được cung cấp cho đơn vị giao nhận, thanh toán, hạ tầng kỹ thuật hoặc cơ quan có thẩm quyền theo quy định.",
          "JODOK cần công bố cụ thể các nhóm bên nhận dữ liệu thực tế và không tuyên bố tuyệt đối rằng dữ liệu không được chia sẻ khi giao dịch cần bên thứ ba xử lý."
        ]
      },
      {
        title: "5. Thời gian lưu trữ",
        paragraphs: [
          "Dữ liệu được lưu trong thời gian cần thiết cho mục đích đã thông báo và nghĩa vụ lưu trữ theo pháp luật.",
          "Thời hạn cụ thể theo từng nhóm dữ liệu: [Điền theo hoạt động thực tế và lịch lưu trữ của hệ thống]."
        ]
      },
      {
        title: "6. Quyền của khách hàng",
        paragraphs: [
          "Khách hàng có thể gửi yêu cầu truy cập, chỉnh sửa, rút lại sự đồng ý, xóa dữ liệu hoặc thực hiện quyền khác theo quy định pháp luật áp dụng.",
          "Một số yêu cầu có thể bị giới hạn bởi nghĩa vụ lưu trữ, căn cứ xử lý hợp pháp hoặc yêu cầu của cơ quan có thẩm quyền. JODOK cần giải thích rõ khi không thể đáp ứng toàn bộ."
        ]
      },
      {
        title: "7. Bảo vệ dữ liệu và sự cố",
        paragraphs: [
          "JODOK áp dụng biện pháp quản lý và kỹ thuật phù hợp với hệ thống thực tế để hạn chế truy cập trái phép, thất thoát và sử dụng sai mục đích.",
          "Khi phát sinh sự cố dữ liệu, JODOK thực hiện quy trình xử lý và thông báo theo nghĩa vụ pháp luật tương ứng."
        ]
      },
      {
        title: "8. Liên hệ",
        paragraphs: [
          "Mọi yêu cầu liên quan đến dữ liệu cá nhân được tiếp nhận tại: " + JODOK_POLICY_CONFIG.email,
          "Ngày áp dụng: " + JODOK_POLICY_CONFIG.effectiveDate
        ]
      }
    ]
  }
};

/* =========================================
   PAGE RENDERING
========================================= */

function infoEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function infoSidebar(currentSlug) {
  return INFO_GROUPS.map(group => `
    <div class="info-nav-group">
      <h3>${infoEscape(group.title)}</h3>

      ${group.links.map(([label, slug]) => `
        <a
          href="/pages/${slug}"
          class="${currentSlug === slug ? "active" : ""}"
          ${currentSlug === slug ? 'aria-current="page"' : ""}
        >
          ${infoEscape(label)}
        </a>
      `).join("")}
    </div>
  `).join("");
}

function renderInformationPage() {
  const slug = decodeURIComponent(
    location.pathname.split("/").filter(Boolean).pop() || ""
  );

  const page = INFO_PAGES[slug];

  if (!page) {
    document.title = "Không tìm thấy trang | JODOK";

    renderApp(
      header() + `
        <main class="wrap info-not-found">
          <h1>Không tìm thấy trang</h1>
          <p>Trang bạn tìm kiếm không tồn tại hoặc đã được chuyển.</p>
          <a href="/">Về trang chủ</a>
        </main>
      ` + footer()
    );

    return;
  }

  document.title = `${page.title} | JODOK`;

  const content = page.sections.map(section => `
    <section class="info-section">
      <h2>${infoEscape(section.title)}</h2>

      ${section.paragraphs.map(paragraph => `
        <p>${infoEscape(paragraph)}</p>
      `).join("")}
    </section>
  `).join("");

  renderApp(
    header() + `
      <main class="wrap info-layout">
        <aside class="info-sidebar">
          ${infoSidebar(slug)}
        </aside>

        <article class="info-content">
          <div class="info-breadcrumb">
            <a href="/">Trang chủ</a>
            <span>/</span>
            <span>${infoEscape(page.title)}</span>
          </div>

          <h1>${infoEscape(page.title)}</h1>
          <p class="info-intro">${infoEscape(page.intro)}</p>

          <div class="info-article-body">
            ${content}
          </div>

          <div class="info-contact">
            <strong>Cần hỗ trợ thêm?</strong>
            <p>
              Liên hệ JODOK qua hotline
              ${infoEscape(JODOK_POLICY_CONFIG.hotline)}
              hoặc email
              ${infoEscape(JODOK_POLICY_CONFIG.email)}.
            </p>
          </div>
        </article>
      </main>
    ` + footer()
  );
}

renderInformationPage();
