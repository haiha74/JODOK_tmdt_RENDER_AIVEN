function store(){
  return header()+`<main class="wrap py-14 min-h-[60vh]"><p class="text-red-800 uppercase tracking-widest font-bold">JODOK Store</p><h1 class="serif text-5xl mt-2">Hệ thống cửa hàng</h1><p class="text-neutral-600 mt-3">Tìm chi nhánh gần bạn, xem giờ mở cửa và dịch vụ hỗ trợ.</p><div class="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">${["Cầu Giấy, Hà Nội","Hoàn Kiếm, Hà Nội","Quận 1, TP.HCM","Hải Châu, Đà Nẵng"].map((x,i)=>`<div class="bg-white border rounded-3xl p-6 shadow-sm"><h3 class="text-xl font-bold">JODOK ${i+1}</h3><p class="mt-3 flex gap-2">${icon("map-pin","w-5 h-5")} ${x}</p><p class="mt-2 flex gap-2">${icon("clock","w-5 h-5")} 08:30 - 22:00</p><button class="mt-5 bg-red-800 text-white rounded-full px-5 py-2">Chỉ đường</button></div>`).join("")}</div></main>`+footer();
}



function loadStorePage(){
  renderApp(store());
}

loadStorePage();