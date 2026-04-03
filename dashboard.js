import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyAvS4ekR50AhEPuXE2TOWcRrC96u8WGqi4",
    authDomain: "smart-cozy.firebaseapp.com",
    databaseURL: "https://smart-cozy-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-cozy",
    storageBucket: "smart-cozy.firebasestorage.app",
    messagingSenderId: "1069475843065",
    appId: "1:1069475843065:web:50c8a0a38be5d0e7d4cb28"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
console.log("✅ [Firebase] เริ่มต้นระบบเรียบร้อย");

// --- อัปเดต Database Status ---
onValue(ref(db, '.info/connected'), (snap) => {
    const badge = document.getElementById('db-status-badge');
    if (snap.val() === true) {
        badge.textContent = 'Online';
        badge.className = 'status-badge online-badge';
        console.log("✅ [Database] เชื่อมต่อ Firebase สำเร็จ");
    } else {
        badge.textContent = 'Offline';
        badge.className = 'status-badge offline-badge';
        console.warn("⚠️ [Database] ขาดการเชื่อมต่อ Firebase");
    }
});

// --- Dynamic Dropdown จาก Firebase devices/ ---
let deviceMap = {};
let devicesData = {};
let unsubClimate = null;
let unsubServo   = null;
let unsubVote    = null;

function subscribeRoom(roomId) {
    if (unsubClimate) { unsubClimate(); unsubClimate = null; }
    if (unsubServo)   { unsubServo();   unsubServo   = null; }
    if (unsubVote)    { unsubVote();    unsubVote    = null; }

    console.log(`🔔 [Database] subscribe → smart_room_system/${roomId}/ + vote_summary/${roomId}/`);

    unsubClimate = onValue(ref(db, `smart_room_system/${roomId}/climate/`), (snapshot) => {
        const c = snapshot.val();
        if (!c) {
            console.warn(`⚠️ [Database] smart_room_system/${roomId}/climate/ ไม่พบข้อมูล`);
            return;
        }
        console.log(`✅ [Database] climate/${roomId} →`, { A: `${c.temp_A}°C`, B: `${c.temp_B}°C`, C: `${c.temp_C}°C`, D: `${c.temp_D}°C` });
        ['A','B','C','D'].forEach(s => {
            const temp = c[`temp_${s}`];
            const mood = tempToMood(temp);
            const tempEl = document.getElementById(`temp_${s}`);
            if (tempEl) tempEl.innerText = temp != null ? `${temp} °C` : '--';
            const zoneEl  = document.getElementById(`Zone_${s}`);
            const badgeEl = document.getElementById(`status_${s}`);
            if (zoneEl)  zoneEl.style.backgroundColor = moodColor[mood];
            if (badgeEl) badgeEl.innerText = temp != null ? `${moodLabel[mood]}  ${temp} °C` : moodLabel[mood];
        });
    });

    unsubServo = onValue(ref(db, `smart_room_system/${roomId}/servo/`), (snapshot) => {
        const s = snapshot.val();
        if (!s) {
            console.warn(`⚠️ [Database] smart_room_system/${roomId}/servo/ ไม่พบข้อมูล`);
            return;
        }
        console.log(`✅ [Database] servo/${roomId} →`, { 1: `${s.servo_1?.angle ?? '--'}°`, 2: `${s.servo_2?.angle ?? '--'}°`, 3: `${s.servo_3?.angle ?? '--'}°` });
        [1, 2, 3].forEach(n => {
            const angle = s[`servo_${n}`]?.angle;
            const el = document.getElementById(`servo_${n}`);
            if (el) el.innerText = angle != null ? `${angle}°` : '--';
        });
    });

    unsubVote = onValue(ref(db, `vote_summary/${roomId}/`), (snapshot) => {
        const sum = snapshot.val();
        if (!sum) {
            console.warn(`⚠️ [Database] vote_summary/${roomId}/ ไม่พบข้อมูล`);
            return;
        }
        console.log(`✅ [Database] vote_summary/${roomId} →`, Object.fromEntries(
            Object.entries(sum).map(([z, v]) => [z, { หนาว: v?.cold||0, สบาย: v?.comfort||0, ร้อน: v?.hot||0 }])
        ));
        const coldData = [], comfortData = [], hotData = [], logLines = [];
        ['Zone_A', 'Zone_B', 'Zone_C', 'Zone_D'].forEach(zone => {
            const z = sum[zone];
            const s = zone.split('_')[1];
            coldData.push(z?.cold || 0);
            comfortData.push(z?.comfort || 0);
            hotData.push(z?.hot || 0);
            logLines.push(`Zone ${s}: ❄️${z?.cold||0} 😌${z?.comfort||0} 🔥${z?.hot||0} | cycle ${z?.cycle ?? '-'}`);
        });
        voteChart.data.datasets[0].data = coldData;
        voteChart.data.datasets[1].data = comfortData;
        voteChart.data.datasets[2].data = hotData;
        voteChart.update();
        document.getElementById("aiMessage").innerHTML = `<span style="color:#91268f"><b>Vote Summary:</b></span><br>${logLines.join('<br>')}`;
        ['Zone_A', 'Zone_B', 'Zone_C', 'Zone_D'].forEach(zone => {
            const z = sum[zone];
            const s = zone.split('_')[1];
            const coldEl = document.getElementById(`v_cold_${s}`);
            const cozyEl = document.getElementById(`v_cozy_${s}`);
            const hotEl  = document.getElementById(`v_hot_${s}`);
            if (coldEl) coldEl.innerText = z?.cold    || 0;
            if (cozyEl) cozyEl.innerText = z?.comfort || 0;
            if (hotEl)  hotEl.innerText  = z?.hot     || 0;
        });
    });
}

window.updateFloors = function() {
    const building = document.getElementById("buildingSelect").value;
    const floorSelect = document.getElementById("floorSelect");
    const roomSelect = document.getElementById("roomSelect");

    floorSelect.innerHTML = '<option value="" disabled selected>-- เลือกชั้น --</option>';
    roomSelect.innerHTML  = '<option value="" disabled selected>-- กรุณาเลือกชั้นก่อน --</option>';
    document.getElementById("deviceInfo").style.display = 'none';

    if (building && deviceMap[building]) {
        Object.keys(deviceMap[building]).sort().forEach(f => {
            const opt = document.createElement("option");
            opt.value = f;
            opt.textContent = `ชั้น ${parseInt(f)}`;
            floorSelect.appendChild(opt);
        });
    }
};

window.updateRooms = function() {
    const building = document.getElementById("buildingSelect").value;
    const floor    = document.getElementById("floorSelect").value;
    const roomSelect = document.getElementById("roomSelect");

    roomSelect.innerHTML = '<option value="" disabled selected>-- เลือกห้อง --</option>';
    document.getElementById("deviceInfo").style.display = 'none';

    if (building && floor && deviceMap[building]?.[floor]) {
        deviceMap[building][floor].sort().forEach(r => {
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = `ห้อง ${r}`;
            roomSelect.appendChild(opt);
        });
    }
};

window.fetchRoomDevice = function() {
    const building = document.getElementById("buildingSelect").value;
    const floor    = document.getElementById("floorSelect").value;
    const room     = document.getElementById("roomSelect").value;

    if (!building || !floor || !room) return;

    const fStr = parseInt(floor) < 10 ? '0' + parseInt(floor) : String(parseInt(floor));
    const rStr = parseInt(room)  < 10 ? '0' + parseInt(room)  : String(parseInt(room));
    const bStr = parseInt(building) < 10 ? '0' + parseInt(building) : String(parseInt(building));
    const roomId = `bldg${bStr}_f${fStr}_r${rStr}`;
    const d = devicesData[roomId];

    if (!d) return;

    const zones = Array.isArray(d.zones) ? d.zones.join(', ') : String(d.zones);
    document.getElementById("deviceDetail").innerHTML =
        `🏢 อาคาร: ${parseInt(d.building)}<br>` +
        `🏢 ชั้น: ${parseInt(d.floor)}<br>` +
        `🚪 ห้อง: ${d.room}<br>` +
        `📡 โซน: ${zones}`;
    document.getElementById("deviceInfo").style.display = 'block';

    subscribeRoom(roomId);
    
    // ✅ แอบเพิ่มบรรทัดนี้เข้ามา เพื่อให้ดึงข้อมูล AI เมื่อกดเปลี่ยนห้อง
    if (typeof window.updateAiDisplay === "function") window.updateAiDisplay();
};

onValue(ref(db, 'devices/'), (snapshot) => {
    const data = snapshot.val();
    if (!data) {
        console.warn("⚠️ [Database] อ่าน devices/ ไม่พบข้อมูล");
        return;
    }
    console.log("✅ [Database] อ่าน devices/ สำเร็จ จำนวนห้อง:", Object.keys(data).length, "ห้อง");

    deviceMap   = {};
    devicesData = {};

    Object.keys(data).forEach(roomId => {
        const raw = data[roomId];
        const d   = {};
        Object.keys(raw).forEach(k => { d[k.trim()] = raw[k]; });
        devicesData[roomId] = d;

        const b = d.building;
        const f = d.floor;
        const r = d.room;
        if (!b || !f || !r) return;
        if (!deviceMap[b])    deviceMap[b]    = {};
        if (!deviceMap[b][f]) deviceMap[b][f] = [];
        deviceMap[b][f].push(r);
    });

    const buildingSelect = document.getElementById('buildingSelect');
    buildingSelect.innerHTML = '<option value="" disabled selected>-- เลือกอาคาร --</option>';
    Object.keys(deviceMap).sort().forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = `อาคาร ${parseInt(b)}`;
        buildingSelect.appendChild(opt);
    });
});

const ctx = document.getElementById('voteChart').getContext('2d');
const voteChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Zone A', 'Zone B', 'Zone C', 'Zone D'],
        datasets: [
            { label: 'หนาว ❄️',  data: [0,0,0,0], backgroundColor: '#0ea5e9', borderRadius: 4 },
            { label: 'สบาย 😌',  data: [0,0,0,0], backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'ร้อน 🔥',   data: [0,0,0,0], backgroundColor: '#f43f5e', borderRadius: 4 }
        ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
});

const API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjhkZDc4MTU2ZWI4NTk0OGM3MzJmM2MyZGU0N2IyMzdhZjM1YzU0YTcwZmIwN2RjZmE0YjliNmY4MjlhNzJjZGU5YmJhNzUwZjI4OWI5NzA2In0.eyJhdWQiOiIyIiwianRpIjoiOGRkNzgxNTZlYjg1OTQ4YzczMmYzYzJkZTQ3YjIzN2FmMzVjNTRhNzBmYjA3ZGNmYTRiOWI2ZjgyOWE3MmNkZTliYmE3NTBmMjg5Yjk3MDYiLCJpYXQiOjE3NzQ4OTE2ODIsIm5iZiI6MTc3NDg5MTY4MiwiZXhwIjoxODA2NDI3NjgyLCJzdWIiOiI1MDU4Iiwic2NvcGVzIjpbXX0.QetsCG2URmZg4b5XBI6hKHJuNhud2lBh7JZgCMBVjgHPhSuVeHRJrqm35jt3HsCHIu-ONDW3XMWxQT93TIrN70yQwDxYrtCw7VpEQkbEQggB9GW1w_aqqmqMjQ6S-xKUUdf6EBjQxwhD0IDDA2kVBwPN_9lxxpIQD5wtja2uhnuy1XRAmWWr3wln8pwHmXo0e7CLKFSlC3TY4S8joa0VjgjWiN8i6Xnv8mqgHxs4YHXDCLAH3asAD9DEz6g4kyC2dsj-LYmSo18_c5TvDZ0c6cntS0uGk76xFnBaGegEqIovDvztwN4X0ZDntLjHINRHxFqqUSAxtgt_eEEIrsxFsssO6D4d0bIoiXFoIn8R6xnvLPh-Bc7pNZhHptfbXKf5-iMShLdeHDC0z75xaWsAQ_8zE7S82nzWZ2wWujN9cdmQYPnYahB0Oy-HCqASZTWI1Ec0SjeVyD2ZP_Hj8BnRICMySw-mrLHl17gKcFc2x1NRWmghzh55JmhPgvO9x2dCyueP0PWC7kdjnsTh1lH4iXKJbI2rojpVCXAdOCQ_TbYYVcibd9yILX9idwZksBuTW05hWGm7gGUrUMdGWHGnDwloiEbhsJoqIXFEIu01voGQlvT5kMiBgDQZlwR3CJoZcAp-yTbROyrlgZzH7B6QMnopJkLe-HLgsjym0ib3IBg";

const getConditionText = (code) => {
    const map = {
        1:"ท้องฟ้าแจ่มใส", 2:"มีเมฆบางส่วน", 3:"เมฆเป็นส่วนมาก",
        4:"มีเมฆมาก", 5:"ฝนเล็กน้อย", 6:"ฝนปานกลาง", 7:"ฝนหนัก",
        8:"ฝนฟ้าคะนอง", 9:"อากาศหนาวจัด", 10:"อากาศหนาว",
        11:"อากาศเย็น", 12:"อากาศร้อนจัด"
    };
    return map[code] || `ไม่ระบุ (code ${code})`;
};

const fetchBangkokWeather = async () => {
    const province = encodeURIComponent("กรุงเทพมหานคร");
    const amphoe   = encodeURIComponent("จตุจักร");
    const API_URL  = `https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/place?province=${province}&amphoe=${amphoe}&fields=tc,cond,rh,rain&duration=1`;
    console.log("🌐 [Weather API] กำลังดึงข้อมูลสภาพอากาศ...");
    try {
        const res = await fetch(API_URL, {
            method: "GET",
            headers: { accept: "application/json", authorization: `Bearer ${API_TOKEN}` }
        });
        console.log(`🌐 [Weather API] ได้รับการตอบกลับ HTTP ${res.status}`);
        if (!res.ok) {
            console.error(`❌ [Weather API] ล้มเหลว: ${res.status} ${res.statusText}`);
            document.getElementById("weatherDisplay").innerText = `⚠️ ภายนอก: โหลดไม่ได้ (${res.status})`;
            return;
        }
        const json = await res.json();
        console.log("🌐 [Weather API] ข้อมูล JSON ที่ได้รับ:", json);
        const data = json.WeatherForecasts[0].forecasts[0].data;
        const temp = data.tc.toFixed(1);
        const cond = getConditionText(data.cond);
        const rh   = data.rh ?? null;
        const rain = data.rain ?? null;
        const ts   = Date.now();
        console.log(`🌐 [Weather API] สภาพอากาศ: ${cond} | อุณหภูมิ: ${temp}°C | ความชื้น: ${rh}% | ฝน: ${rain}mm`);

        document.getElementById("weatherDisplay").innerText = `🌤️ ภายนอก: ${cond} ${temp}°C`;

        console.log("💾 [Database] กำลังเขียน current_weather/ →", { condition: cond, temp: `${temp}°C`, rh: `${rh}%`, rain: `${rain}mm` });
        await set(ref(db, 'current_weather/'), { condition: cond, temp: temp, rh: rh, rain: rain, timestamp: ts });
        console.log("✅ [Database] เขียน current_weather/ สำเร็จ");

        console.log(`💾 [Database] กำลังเขียน history/weather/${ts} →`, { condition: cond, temp: `${temp}°C`, rh: `${rh}%`, rain: `${rain}mm` });
        await set(ref(db, `history/weather/${ts}`), { condition: cond, temp: temp, rh: rh, rain: rain, timestamp: ts });
        console.log("✅ [Database] เขียน history/weather/ สำเร็จ");
    } catch (err) {
        console.error("❌ [Weather API] เกิดข้อผิดพลาด:", err.message);
        console.error("   รายละเอียด:", err);
        document.getElementById("weatherDisplay").innerText = `⚠️ ภายนอก: เชื่อมต่อไม่ได้`;
    }
};

const moodColor = { hot: '#f43f5e', cold: '#0ea5e9', comfort: '#10b981' };
const moodLabel = { hot: '🔥 ร้อน', cold: '❄️ หนาว', comfort: '😌 สบาย' };

const tempToMood = (temp) => {
    if (temp == null) return 'comfort';
    if (temp > 27)    return 'hot';
    if (temp < 24)    return 'cold';
    return 'comfort';
};


fetchBangkokWeather();
setInterval(fetchBangkokWeather, 600000);

// ======================================================================
// ✅ ส่วนที่เพิ่มเข้ามาใหม่ (AI Explanation & AC Louvers) ห้ามลบโค้ดข้างบน!
// ======================================================================

let globalAiData = {};

// คอยดักฟังข้อมูลจากโฟลเดอร์ ai_commands/ ใน Firebase ตลอดเวลา
onValue(ref(db, 'ai_commands/'), (snapshot) => {
    globalAiData = snapshot.val() || {};
    // ถ้ามีข้อมูล AI อัปเดตใหม่ ให้สั่งวาดหน้าจอใหม่ทันที
    if (typeof window.updateAiDisplay === "function") window.updateAiDisplay(); 
});

window.updateAiDisplay = function() {
    const b = document.getElementById("buildingSelect")?.value;
    const f = document.getElementById("floorSelect")?.value;
    const r = document.getElementById("roomSelect")?.value;

    if (b && f && r) {
        // จัด Format ชื่อห้องให้ตรงกับ Database เช่น bldg05_f07_r06
        const bStr = parseInt(b) < 10 ? '0' + parseInt(b) : parseInt(b);
        const fStr = parseInt(f) < 10 ? '0' + parseInt(f) : parseInt(f);
        const rStr = parseInt(r) < 10 ? '0' + parseInt(r) : parseInt(r);
        const roomId = `bldg${bStr}_f${fStr}_r${rStr}`;

        const roomAiData = globalAiData[roomId];
        const aiReasoningDisplay = document.getElementById('aiReasoningDisplay');
        
        if (roomAiData) {
            // 1. นำคำอธิบาย (Reasoning) ไปใส่ในกรอบสีเขียว
            if (aiReasoningDisplay && roomAiData.reasoning) {
                aiReasoningDisplay.innerText = roomAiData.reasoning;
            }
            
            // 2. นำข้อมูลบานเกล็ด (swing_mode) ไปอัปเดตทับค่าเดิมในกรอบสีม่วง
            if (roomAiData.actions) {
                const ac1 = roomAiData.actions.AC_1?.swing_mode || "--";
                const ac2 = roomAiData.actions.AC_2?.swing_mode || "--";
                const ac3 = roomAiData.actions.AC_3?.swing_mode || "--";

                const servo1El = document.getElementById('servo_1');
                const servo2El = document.getElementById('servo_2');
                const servo3El = document.getElementById('servo_3');

                if (servo1El) servo1El.innerText = ac1.toUpperCase();
                if (servo2El) servo2El.innerText = ac2.toUpperCase();
                if (servo3El) servo3El.innerText = ac3.toUpperCase();
            }
        } else {
            // กรณีที่ห้องนี้ยังไม่มี AI ประมวลผลส่งมาให้
            if (aiReasoningDisplay) {
                aiReasoningDisplay.innerText = "-- รอรับข้อมูลจาก Database (ยังไม่มี AI คำนวณห้องนี้) --";
            }
        }
    }
};