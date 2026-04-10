/*
  Pasif Ramazan kodu. Bu dosya şu anda sayfada yüklenmiyor,
  ancak ihtiyaç olursa aktif kodu tekrar eklemek için referans olarak saklanıyor.
*/

const cities = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Şanlıurfa","Siirt","Sinop","Şırnak","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"];

let selectedCity = "Istanbul";
let timerInterval;

// Şehir listesini doldur
const select = document.getElementById('city-select');
cities.forEach(city => {
    let opt = document.createElement('option');
    // API için Türkçe karakterleri temizle
    let val = city.replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c');
    opt.value = val;
    opt.innerHTML = city;
    if(city === "İstanbul") opt.selected = true;
    select.appendChild(opt);
});

async function changeCity(cityVal) {
    selectedCity = cityVal;
    document.getElementById("active-city-name").innerText = select.options[select.selectedIndex].text;
    updateVakitler();
}

async function updateVakitler() {
    try {
        const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${selectedCity}&country=Turkey&method=13`, {
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        const timings = data.data.timings;
        
        if(timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            const now = new Date();
            const ramadanStart = new Date("2026-02-19T00:00:00");
            
            let target;
            let title;

            if (now < ramadanStart) {
                target = ramadanStart;
                title = "🌙 Ramazan'a Kalan";
            } else {
                const [iH, iM] = timings.Imsak.split(':');
                const [fH, fM] = timings.Maghrib.split(':');
                const imsakToday = new Date(); imsakToday.setHours(iH, iM, 0);
                const iftarToday = new Date(); iftarToday.setHours(fH, fM, 0);

                if (now < imsakToday) { target = imsakToday; title = "⏳ Sahura Kalan"; }
                else if (now < iftarToday) { target = iftarToday; title = "🍲 İftara Kalan"; }
                else { target = new Date(imsakToday.getTime() + 86400000); title = "✨ Sahura Kalan (Yarın)"; }
            }

            const diff = target - now;
            document.getElementById("status-title").innerText = title;
            document.getElementById("r-day").innerText = Math.floor(diff / 86400000).toString().padStart(2, '0');
            document.getElementById("r-hour").innerText = Math.floor((diff / 3600000) % 24).toString().padStart(2, '0');
            document.getElementById("r-min").innerText = Math.floor((diff / 60000) % 60).toString().padStart(2, '0');
            document.getElementById("r-sec").innerText = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
        }, 1000);
    } catch(e) { console.error("Hata:", e); }
}

async function openImsakiye() {
    const modal = document.getElementById("imsakiye-modal");
    const tbody = document.getElementById("imsakiye-body");
    document.getElementById("modal-city-title").innerText = select.options[select.selectedIndex].text + " İmsakiyesi";
    tbody.innerHTML = "<tr><td colspan='4'>Yükleniyor...</td></tr>";
    modal.style.display = "flex";

    try {
        const res = await fetch(`https://api.aladhan.com/v1/calendarByCity/2026?city=${selectedCity}&country=Turkey&method=13`, {
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();

        let html = "";
        
        const today = new Date(); today.setHours(0,0,0,0);
        const now = new Date();
        const ramadanStart = new Date(2026, 1, 19); // 19 Şubat
        let todaysIftar = null;
        let todayPassed = false;

        Object.keys(data.data).forEach(month => {
            data.data[month].forEach(day => {
                const dateParts = day.date.gregorian.date.split('-');
                const dateObj = new Date(dateParts[2], dateParts[1]-1, dateParts[0]);

                if(dateObj.getTime() === today.getTime()) {
                    const [fH, fMraw] = day.timings.Maghrib.split(':');
                    const fHn = parseInt(fH, 10);
                    const fMn = parseInt(fMraw, 10);
                    todaysIftar = new Date();
                    todaysIftar.setHours(fHn, fMn, 0, 0);
                }

                const ramadanDay = Math.floor((dateObj - ramadanStart) / 86400000) + 1;
                const isVisible = dateObj >= ramadanStart && dateObj >= today && ramadanDay >= 1 && ramadanDay <= 30;

                if(isVisible && dateObj.getTime() === today.getTime() && todaysIftar && now > todaysIftar) {
                    todayPassed = true;
                }

                if(isVisible && !(dateObj.getTime() === today.getTime() && todaysIftar && now > todaysIftar)) {
                    if(ramadanDay === 30) {
                        html += `<tr class="arefe-separator">
                            <td colspan="5" style="text-align:center;font-weight:bold;color:#a00;">Bayram Arefesi</td>
                        </tr>`;
                    }
                    let specialLabel = '';
                    if (ramadanDay === 27) specialLabel = '⭐ Kadir Gecesi';
                    if (ramadanDay === 29) specialLabel = '🌙 Bayram Arefesi';
                    html += `<tr>
                        <td>${ramadanDay}. Gün</td>
                        <td>${day.date.gregorian.day} ${day.date.gregorian.month.en.substring(0,3)}</td>
                        <td><b>${day.timings.Imsak.split(' ')[0]}</b></td>
                        <td class="accent-red"><b>${day.timings.Maghrib.split(' ')[0]}</b></td>
                        <td>${specialLabel}</td>
                    </tr>`;
                }
            });
        });

        let daysElapsed = 0;
        if(today >= ramadanStart) {
            daysElapsed = Math.floor((today - ramadanStart) / 86400000) + 1;
            if(daysElapsed > 30) daysElapsed = 30;
        }
        const daysLeft = 30 - daysElapsed;
        const summaryEl = document.getElementById("imsakiye-summary");
        if(summaryEl) {
            if(daysElapsed > 0) {
                summaryEl.innerText = `Kaç gündür niyetliyiz: ${daysElapsed} • Kaç gün kaldı: ${daysLeft >= 0 ? daysLeft : 0}`;
            } else {
                summaryEl.innerText = "Ramazan başlamadı.";
            }
        }
        const specialsEl = document.getElementById('imsakiye-specials');
        if (specialsEl) {
            let sHtml = '';
            if (kadirDate) sHtml += `✨ Kadir Gecesi: ${kadirDate}`;
            if (arefeDate) sHtml += (sHtml ? '<br>' : '') + `🌙 Bayram Arefesi: ${arefeDate}`;
            specialsEl.innerHTML = sHtml;
        }

        tbody.innerHTML = html;
    } catch(e) {
        tbody.innerHTML = "<tr><td colspan='4'>Vakitler alınamadı.</td></tr>";
        const summaryEl = document.getElementById("imsakiye-summary");
        if(summaryEl) summaryEl.innerText = "Vakitler alınamadı.";
        console.error(e);
    }
}

function closeImsakiye() { document.getElementById("imsakiye-modal").style.display = "none"; }

// Not: updateVakitler() çağrısı kaldırıldı, bu dosya şu anda pasif tutuluyor.
