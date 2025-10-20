import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://watsana24033-dotcoms-project.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndheHRrcHJqZGprcGh5b216cmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MDcxMDcsImV4cCI6MjA3NjQ4MzEwN30.WWlVd-1kUnd4mM-uhrTAtkfopRd4P-iJ_lNvfClArXQ";
const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- utils ----------
function normalizePhone(p) {
  if (!p) return null;
  let s = String(p).replace(/[^0-9+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("66")) s = "0" + s.slice(2);
  if (!s.startsWith("0") && s.length === 9) s = "0" + s;
  if (s.length === 10 && s.startsWith("0")) return s;
  return s; // ถ้าไม่ตรง format ไทย 10 หลัก จะคืนค่าปัจจุบันไว้ตรวจสอบ
}

// ---------- UI refs ----------
const elTotal = document.getElementById("stat-total");
const elUnique = document.getElementById("stat-unique");
const elDup = document.getElementById("stat-dup");
const elFiles = document.getElementById("stat-files");
const elList = document.getElementById("list");
const elFile = document.getElementById("fileInput");
const elSearch = document.getElementById("searchInput");
const btnSearch = document.getElementById("btnSearch");
const btnRefresh = document.getElementById("btnRefresh");
const btnLoadMore = document.getElementById("btnLoadMore");

// ---------- state ----------
let currentQuery = "";
let from = 0;
const PAGE_SIZE = 50;

// ---------- render ----------
function card(item) {
  return `
    <div class="bg-green-200 text-black rounded-xl p-4">
      <div class="font-bold text-lg">${item.phone_normalized ?? item.raw_phone ?? "-"}</div>
      <div class="text-sm opacity-80">
        👤 ${item.full_name ?? "-"} &nbsp;&nbsp; 🪪 ${item.national_id ?? "-"}
      </div>
      <div class="text-xs mt-1">📄 ${item.source_file ?? "-"}</div>
    </div>
  `;
}

async function renderStats() {
  const { data, error } = await supabase.from("v_number_stats").select("*").single();
  if (error) { console.error(error); return; }
  elTotal.textContent = numberWithComma(data.total_numbers);
  elUnique.textContent = numberWithComma(data.unique_numbers);
  elDup.textContent = numberWithComma(data.duplicate_numbers);

  // นับจำนวนไฟล์จากคอลัมน์ source_file (distinct)
  const { data: files, error: e2 } = await supabase
    .from("uploads")
    .select("source_file", { count: "exact", head: true, distinct: true });
  elFiles.textContent = (files, e2) ? (e2 ? "-" : e2) : (files ?? "-"); // head:true จะไม่คืน data กลับ
  if (e2 && e2.count !== undefined) elFiles.textContent = numberWithComma(e2.count);
}

function numberWithComma(x) {
  if (x === null || x === undefined) return "-";
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function loadPage(reset = false) {
  if (reset) { from = 0; elList.innerHTML = ""; }
  let q = supabase.from("uploads").select("*").order("created_at", { ascending: false });

  if (currentQuery) {
    const s = currentQuery.trim();
    // ค้นหาได้ทั้ง เบอร์/ชื่อ/บัตรฯ/ไฟล์
    q = q.or(
      `phone_normalized.ilike.%${s}%,raw_phone.ilike.%${s}%,full_name.ilike.%${s}%,national_id.ilike.%${s}%,source_file.ilike.%${s}%`
    );
  }

  const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) { console.error(error); return; }

  data.forEach(row => elList.insertAdjacentHTML("beforeend", card(row)));
  from += data.length;

  // toggle ปุ่มโหลดเพิ่ม
  btnLoadMore.classList.toggle("hidden", data.length < PAGE_SIZE);
}

// ---------- events ----------
elFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      // คาดหวังคอลัมน์: phone, name, national_id (คุณตั้งชื่อคอลัมน์ในไฟล์ CSV ได้เอง)
      const rows = results.data.map(r => ({
        raw_phone: r.phone ?? r.เบอร์ ?? r.tel ?? r["phone number"],
        phone_normalized: normalizePhone(r.phone ?? r.เบอร์ ?? r.tel ?? r["phone number"]),
        full_name: r.name ?? r.ชื่อ ?? null,
        national_id: r.national_id ?? r.เลขบัตร ?? null,
        source_file: file.name
      }));

      // แบ่ง batch ล็อตละ 1000 แถวเพื่อความเสถียร
      const chunk = 1000;
      for (let i = 0; i < rows.length; i += chunk) {
        const batch = rows.slice(i, i + chunk);
        const { error } = await supabase.from("uploads").insert(batch);
        if (error) { console.error(error); alert("อัปโหลดบางส่วนล้มเหลว: " + error.message); break; }
      }

      await renderStats();
      await loadPage(true);
      alert(`อัปโหลดสำเร็จ ${rows.length} แถว`);
      elFile.value = "";
    }
  });
});

btnSearch.addEventListener("click", () => {
  currentQuery = elSearch.value || "";
  loadPage(true);
});
btnRefresh.addEventListener("click", async () => {
  elSearch.value = "";
  currentQuery = "";
  await renderStats();
  await loadPage(true);
});
btnLoadMore.addEventListener("click", () => loadPage(false));

// ---------- start ----------
renderStats();
loadPage(true);
