export const CITIES = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkâri','Hatay','Isparta','Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş','Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'
];

export const CATEGORIES = [
  { id:'emlak', name:'Emlak', subcategories:['Satılık daire','Kiralık daire','Satılık müstakil ev','Kiralık müstakil ev','Satılık arsa','İş yeri','Devren iş yeri','Turistik tesis'], fields:[
    {key:'propertyType',label:'Taşınmaz türü',type:'select',options:['Daire','Müstakil ev','Arsa','Villa','İş yeri','Bina','Turistik tesis']},
    {key:'roomCount',label:'Oda sayısı',type:'select',options:['Stüdyo','1+1','2+1','3+1','4+1','5+1 ve üzeri']},
    {key:'squareMeters',label:'Metrekare (m²)',type:'number',min:0,max:1000000},
    {key:'buildingAge',label:'Bina yaşı',type:'select',options:['Sıfır','1-5','6-10','11-20','21+']}
  ]},
  { id:'vasita', name:'Vasıta', subcategories:['Otomobil','Arazi, SUV & Pickup','Motosiklet','Ticari araç','Elektrikli araç','Deniz araçları','Yedek parça'], fields:[
    {key:'brand',label:'Marka',type:'text',maxLength:40}, {key:'model',label:'Model',type:'text',maxLength:50},
    {key:'modelYear',label:'Model yılı',type:'number',min:1950,max:2100}, {key:'mileage',label:'Kilometre',type:'number',min:0,max:9999999},
    {key:'fuelType',label:'Yakıt',type:'select',options:['Benzin','Dizel','Elektrik','Hibrit','LPG','Benzin & LPG']},
    {key:'transmission',label:'Vites',type:'select',options:['Manuel','Otomatik','Yarı otomatik']}
  ]},
  { id:'elektronik', name:'Elektronik', subcategories:['Cep telefonu','Bilgisayar','Tablet','TV & görüntü','Fotoğraf makinesi','Oyun konsolu','Ses sistemleri','Ev elektroniği'], fields:[
    {key:'brand',label:'Marka',type:'text',maxLength:40}, {key:'model',label:'Model',type:'text',maxLength:50},
    {key:'warranty',label:'Garanti',type:'select',options:['Var','Yok','Bilinmiyor']}, {key:'conditionNote',label:'Kutu / aksesuar',type:'select',options:['Tam takım','Sadece cihaz','Eksik aksesuar']}
  ]},
  { id:'ev-yasam', name:'Ev ve yaşam', subcategories:['Mobilya','Dekorasyon','Mutfak gereçleri','Beyaz eşya','Bahçe','Aydınlatma','Ev tekstili'], fields:[{key:'brand',label:'Marka',type:'text',maxLength:40},{key:'conditionNote',label:'Ürün durumu',type:'select',options:['Ambalajında','Kurulu','Kullanılmış']}]},
  { id:'moda', name:'Giyim ve aksesuar', subcategories:['Kadın giyim','Erkek giyim','Ayakkabı','Çanta','Saat','Takı','Çocuk giyim'], fields:[{key:'brand',label:'Marka',type:'text',maxLength:40},{key:'size',label:'Beden',type:'text',maxLength:20}]},
  { id:'anne-bebek', name:'Anne ve bebek', subcategories:['Bebek arabası','Oto koltuğu','Bebek odası','Oyuncak','Bebek giyim','Beslenme'], fields:[{key:'ageGroup',label:'Yaş grubu',type:'select',options:['0-6 ay','6-12 ay','1-3 yaş','3+ yaş']}]},
  { id:'spor', name:'Spor ve outdoor', subcategories:['Fitness','Bisiklet','Kamp malzemeleri','Outdoor giyim','Takım sporları','Su sporları'], fields:[{key:'brand',label:'Marka',type:'text',maxLength:40},{key:'size',label:'Ölçü / beden',type:'text',maxLength:20}]},
  { id:'hobi', name:'Hobi ve eğlence', subcategories:['Müzik aletleri','Koleksiyon','Model araçlar','El işi','Oyun ve konsol','Sanat'], fields:[{key:'brand',label:'Marka / üretici',type:'text',maxLength:50}]},
  { id:'kitap', name:'Kitap ve müzik', subcategories:['Kitap','Dergi','Plak','CD','Nota ve müzik eğitimi'], fields:[{key:'author',label:'Yazar / sanatçı',type:'text',maxLength:60},{key:'language',label:'Dil',type:'select',options:['Türkçe','İngilizce','Almanca','Diğer']}]},
  { id:'evcil-hayvan', name:'Evcil hayvanlar', subcategories:['Kedi','Köpek','Kuş','Balık','Akvaryum','Evcil hayvan ürünleri','Bakım hizmetleri'], fields:[{key:'animalType',label:'Tür',type:'select',options:['Kedi','Köpek','Kuş','Balık','Diğer']},{key:'age',label:'Yaş',type:'text',maxLength:25}]},
  { id:'is-endustri', name:'İş ve endüstri', subcategories:['İş makineleri','Tarım makineleri','Sanayi ekipmanları','Ofis ekipmanları','Ticari ekipman','Yedek parça'], fields:[{key:'brand',label:'Marka',type:'text',maxLength:40},{key:'modelYear',label:'Üretim yılı',type:'number',min:1900,max:2100}]},
  { id:'is-ilanlari', name:'İş ilanları', subcategories:['Tam zamanlı','Yarı zamanlı','Uzaktan çalışma','Dönemsel','Stajyer','Freelance'], fields:[{key:'workType',label:'Çalışma şekli',type:'select',options:['Tam zamanlı','Yarı zamanlı','Uzaktan','Hibrit','Dönemsel','Staj']},{key:'experience',label:'Deneyim',type:'select',options:['Deneyimsiz','1-3 yıl','3-5 yıl','5+ yıl']}]},
  { id:'hizmetler', name:'Hizmetler', subcategories:['Ev bakım ve onarım','Nakliye','Temizlik','Eğitim','Bilgisayar hizmetleri','Organizasyon','Danışmanlık'], fields:[{key:'serviceArea',label:'Hizmet alanı',type:'text',maxLength:60}]}
];

export const CATEGORY_ICON_PATHS = {
  emlak:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/>',
  vasita:'<path d="M3 13 5 7h14l2 6v6h-3v-3H6v3H3v-6Z"/><path d="M6 13h12M7 7l1-3h8l1 3"/>',
  elektronik:'<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M10 18.5h4"/>',
  'ev-yasam':'<path d="M4 11V6h16v5M3 11h18v9H3zM8 20v-5h8v5"/>',
  moda:'<path d="m8 3 4 2 4-2 5 5-4 3-2-2v12H9V9l-2 2-4-3 5-5Z"/>',
  'anne-bebek':'<path d="M5 10h14l-1 10H6L5 10Z"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 13v4M10 15h4"/>',
  spor:'<circle cx="12" cy="12" r="8.5"/><path d="m8 5 3 5-3 5m8-10-3 5 3 5M4 9h5m6 0h5M4 15h5m6 0h5"/>',
  hobi:'<path d="M4 8h16v12H4zM7 8V4h10v4M8 12h8M8 16h5"/>',
  kitap:'<path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H12v19H6.5A3.5 3.5 0 0 0 3 24V5.5Z"/><path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H12v19h5.5A3.5 3.5 0 0 1 21 24V5.5Z"/>',
  'evcil-hayvan':'<path d="M12 20c-4.5 0-7-2.2-7-5.1 0-2.1 1.7-3.6 4-3.6 1 0 2 .4 3 1.1 1-.7 2-1.1 3-1.1 2.3 0 4 1.5 4 3.6C19 17.8 16.5 20 12 20Z"/><circle cx="5" cy="7" r="2"/><circle cx="9" cy="4.5" r="2"/><circle cx="15" cy="4.5" r="2"/><circle cx="19" cy="7" r="2"/>',
  'is-endustri':'<path d="M3 21V9l6 3V9l6 3V4h6v17H3Z"/><path d="M7 17h2m3 0h2m3 0h2"/>',
  'is-ilanlari':'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18m-12 0v3h6v-3"/>',
  hizmetler:'<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5"/>'
};
