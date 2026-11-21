// Read-only Google Search Console integration for the private SEO console.
// Credentials are read only from Cloudflare Worker secrets and never returned to clients.
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_ROOT = "https://www.googleapis.com/webmasters/v3";

const encoder = new TextEncoder();

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem) {
  if (typeof pem !== "string" || !pem.includes("BEGIN PRIVATE KEY")) {
    throw new Error("مفتاح حساب الخدمة غير صالح: private_key مفقود أو ليس بصيغة PKCS#8.");
  }
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createServiceAccountAssertion(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now - 30,
    exp: now + 3600
  }));
  const unsigned = header + "." + claims;
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    encoder.encode(unsigned)
  ));
  return unsigned + "." + base64UrlEncode(signature);
}

async function getGoogleAccessToken(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("لم يتم العثور على سر GOOGLE_SERVICE_ACCOUNT_JSON في إعدادات Worker.");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("قيمة GOOGLE_SERVICE_ACCOUNT_JSON ليست ملف JSON صالحًا.");
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("ملف حساب الخدمة لا يحتوي client_email وprivate_key.");
  }

  const assertion = await createServiceAccountAssertion(serviceAccount);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const detail = payload?.error_description || payload?.error || "تعذر إصدار رمز OAuth.";
    throw new Error("فشل تفويض Google: " + String(detail).slice(0, 300));
  }
  return payload.access_token;
}

async function googleApi(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: "Bearer " + accessToken,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || ("HTTP " + response.status);
    throw new Error("Search Console API: " + String(detail).slice(0, 400));
  }
  return payload;
}

function defaultProperty(request) {
  return (new URL(request.url).origin + "/");
}

async function getSearchConsoleConnection(request, env) {
  const accessToken = await getGoogleAccessToken(env);
  const payload = await googleApi(GOOGLE_API_ROOT + "/sites", accessToken);
  const sites = Array.isArray(payload.siteEntry) ? payload.siteEntry : [];
  const preferred = String(env.GSC_SITE_URL || defaultProperty(request)).trim();
  const match = sites.find((site) => site.siteUrl === preferred);
  return {
    accessToken,
    requestedProperty: preferred,
    property: match || null,
    sites: sites.map((site) => ({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel
    }))
  };
}

function totalMetrics(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const clicks = safeRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const impressions = safeRows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const weightedPosition = safeRows.reduce(
    (sum, row) => sum + Number(row.position || 0) * Number(row.impressions || 0), 0
  );
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPosition / impressions : 0
  };
}


async function getSitemapDiagnostics(request, env) {
  const connection = await getSearchConsoleConnection(request, env);
  if (!connection.property) {
    return { propertyFound: false, requestedProperty: connection.requestedProperty, availableProperties: connection.sites };
  }
  const endpoint = GOOGLE_API_ROOT + "/sites/" + encodeURIComponent(connection.property.siteUrl) + "/sitemaps";
  const payload = await googleApi(endpoint, connection.accessToken);
  const sitemaps = Array.isArray(payload.sitemap) ? payload.sitemap : [];
  return {
    property: connection.property.siteUrl,
    permissionLevel: connection.property.permissionLevel,
    sitemapCount: sitemaps.length,
    sitemaps: sitemaps.map((item) => ({
      path: item.path || "",
      type: item.type || "",
      isPending: Boolean(item.isPending),
      isSitemapsIndex: Boolean(item.isSitemapsIndex),
      lastSubmitted: item.lastSubmitted || null,
      lastDownloaded: item.lastDownloaded || null,
      warnings: Number(item.warnings || 0),
      errors: Number(item.errors || 0),
      contents: (Array.isArray(item.contents) ? item.contents : []).map((content) => ({
        type: content.type || "",
        submitted: Number(content.submitted || 0),
        indexed: Number(content.indexed || 0)
      }))
    }))
  };
}

async function inspectIndexUrl(connection, inspectionUrl) {
  const response = await googleApi(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    connection.accessToken,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inspectionUrl, siteUrl: connection.property.siteUrl, languageCode: "ar-SA" })
    }
  );
  const status = response.inspectionResult?.indexStatusResult || {};
  return {
    url: inspectionUrl,
    verdict: status.verdict || "UNKNOWN",
    coverageState: status.coverageState || "",
    robotsTxtState: status.robotsTxtState || "",
    indexingState: status.indexingState || "",
    pageFetchState: status.pageFetchState || "",
    lastCrawlTime: status.lastCrawlTime || null,
    googleCanonical: status.googleCanonical || "",
    userCanonical: status.userCanonical || "",
    sitemap: Array.isArray(status.sitemap) ? status.sitemap : [],
    referringUrls: Array.isArray(status.referringUrls) ? status.referringUrls.slice(0, 5) : []
  };
}

async function getIndexDiagnostics(request, env) {
  const connection = await getSearchConsoleConnection(request, env);
  if (!connection.property) {
    return { propertyFound: false, requestedProperty: connection.requestedProperty, availableProperties: connection.sites };
  }
  const base = connection.property.siteUrl.endsWith("/") ? connection.property.siteUrl : connection.property.siteUrl + "/";
  const urls = [
    base,
    base + "regions/",
    base + "categories/",
    base + "city/riyadh/",
    base + "city/jeddah/"
  ];
  const inspections = [];
  for (const url of urls) {
    try {
      inspections.push(await inspectIndexUrl(connection, url));
    } catch (error) {
      inspections.push({ url, verdict: "INSPECTION_ERROR", error: String(error?.message || "تعذر فحص العنوان").slice(0, 300) });
    }
  }
  return {
    property: connection.property.siteUrl,
    permissionLevel: connection.property.permissionLevel,
    inspectionCount: inspections.length,
    inspections
  };
}

async function getSearchConsoleReport(request, env) {
  const connection = await getSearchConsoleConnection(request, env);
  if (!connection.property) {
    return {
      connected: true,
      propertyFound: false,
      requestedProperty: connection.requestedProperty,
      availableProperties: connection.sites
    };
  }

  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - 27 * 86400000);
  const toDate = (date) => date.toISOString().slice(0, 10);
  const startDate = toDate(start);
  const endDate = toDate(end);
  const endpoint = GOOGLE_API_ROOT + "/sites/" +
    encodeURIComponent(connection.property.siteUrl) + "/searchAnalytics/query";

  const makeQuery = (dimensions) => googleApi(endpoint, connection.accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: 50 })
  });

  const [summaryResult, queryResult, pageResult] = await Promise.all([
    makeQuery([]),
    makeQuery(["query"]),
    makeQuery(["page"])
  ]);
  const summaryRows = Array.isArray(summaryResult.rows) ? summaryResult.rows : [];
  const summary = summaryRows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  return {
    connected: true,
    propertyFound: true,
    property: connection.property.siteUrl,
    permissionLevel: connection.property.permissionLevel,
    dateRange: { startDate, endDate },
    summary: {
      clicks: Number(summary.clicks || 0),
      impressions: Number(summary.impressions || 0),
      ctr: Number(summary.ctr || 0),
      position: Number(summary.position || 0)
    },
    topQueries: (queryResult.rows || []).map((row) => ({
      query: row.keys?.[0] || "",
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0)
    })),
    topPages: (pageResult.rows || []).map((row) => ({
      page: row.keys?.[0] || "",
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0)
    }))
  };
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function isAuthorized(request, env) {
  const configured = String(env.SEO_ADMIN_TOKEN || "");
  const header = request.headers.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(configured) && constantTimeEqual(supplied, configured);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function handleSeoConsoleApi(request, env, pathname) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (!env.SEO_ADMIN_TOKEN) {
    return jsonResponse({ error: "إعداد رمز دخول لوحة SEO غير مكتمل." }, 503);
  }
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "رمز الدخول غير صحيح أو غير موجود." }, 401);
  }

  try {
    if (pathname === "/api/seo/sitemaps") {
      return jsonResponse(await getSitemapDiagnostics(request, env));
    }
    if (pathname === "/api/seo/indexing") {
      return jsonResponse(await getIndexDiagnostics(request, env));
    }
    if (pathname === "/api/seo/connection") {
      const connection = await getSearchConsoleConnection(request, env);
      return jsonResponse({
        connected: true,
        propertyFound: Boolean(connection.property),
        requestedProperty: connection.requestedProperty,
        property: connection.property?.siteUrl || null,
        permissionLevel: connection.property?.permissionLevel || null,
        availableProperties: connection.sites
      });
    }
    return jsonResponse(await getSearchConsoleReport(request, env));
  } catch (error) {
    return jsonResponse({
      connected: false,
      error: String(error?.message || "تعذر الاتصال بـ Google Search Console").slice(0, 500)
    }, 502);
  }
}

export function renderSeoConsole() {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>لوحة SEO — دليل السعودية</title>
<style>
:root{color-scheme:light;--ink:#172b3a;--muted:#637381;--line:#e4eaf0;--paper:#f5f8fb;--card:#fff;--brand:#136c62;--soft:#e8f4f1}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1100px;margin:auto;padding:28px 18px 60px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
h1{font-size:25px;margin:0}h2{font-size:19px;margin:0 0 14px}.sub{color:var(--muted);font-size:14px;margin-top:4px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 5px 20px #1a33400a}
label{display:block;font-weight:650;margin-bottom:7px}input{width:100%;padding:12px 14px;border:1px solid #cbd6df;border-radius:10px;font:inherit;direction:ltr}
button{border:0;border-radius:10px;background:var(--brand);color:#fff;padding:11px 18px;font:inherit;font-weight:650;cursor:pointer;margin-top:12px}
button.secondary{background:#eaf0f4;color:var(--ink);margin-right:8px}.status{padding:11px 14px;border-radius:10px;background:var(--soft);color:#15574f;margin-top:12px}
.status.error{background:#fff0ed;color:#9b3326}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.stat{border:1px solid var(--line);border-radius:13px;padding:14px;background:#fff}.stat span{display:block;color:var(--muted);font-size:13px}.stat strong{font-size:25px;display:block;margin-top:5px;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:right;padding:9px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}td.num{white-space:nowrap;font-variant-numeric:tabular-nums}
.table-wrap{overflow:auto}.hidden{display:none}.note{font-size:13px;color:var(--muted)}
@media(max-width:700px){.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}h1{font-size:21px}}
</style>
</head>
<body><main class="wrap">
<header class="top"><div><h1>لوحة أداء البحث — دليل السعودية</h1><p class="sub">تقارير Search Console للقراءة فقط · آخر 28 يومًا مكتملة تقريبًا</p></div><a href="/" style="color:var(--brand)">العودة إلى الموقع</a></header>
<section class="card">
<label for="token">رمز دخول لوحة SEO</label>
<input id="token" type="password" autocomplete="off" spellcheck="false" placeholder="ألصق رمز الدخول الذي استلمته من مسؤول الموقع">
<button id="connect">اختبار الاتصال وعرض الأداء</button>
<button id="clear" class="secondary" type="button">مسح الرمز</button>
<div id="status" class="status" role="status">أدخل رمز الدخول لقراءة بيانات Search Console. لا يُحفظ على الخادم.</div>
</section>
<section id="report" class="hidden">
<div class="card"><h2>ملخص الأداء</h2><p id="property" class="sub"></p><div id="range" class="note"></div><div class="stats" id="stats"></div></div>
<section class="card">
<h2>تشخيص الفهرسة وخرائط الموقع</h2>
<p class="note">يفحص حالة خريطة الموقع المسجلة لدى Google وخمس صفحات أساسية في فهرسها. لا يرسل طلبات فهرسة ولا يغيّر إعدادات Google.</p>
<button id="diagnose" type="button">فحص الفهرسة وخرائط الموقع</button>
<div id="diagnostics" class="hidden" style="margin-top:14px"></div>
</section>
<div class="grid">
<section class="card"><h2>أهم كلمات البحث</h2><div class="table-wrap"><table><thead><tr><th>الكلمة</th><th>النقرات</th><th>الظهور</th><th>الموضع</th></tr></thead><tbody id="queries"></tbody></table></div></section>
<section class="card"><h2>أفضل الصفحات</h2><div class="table-wrap"><table><thead><tr><th>الصفحة</th><th>النقرات</th><th>الظهور</th><th>الموضع</th></tr></thead><tbody id="pages"></tbody></table></div></section>
</div>
</section>
<p class="note">هذه اللوحة خاصة. لا تشارك رمز الدخول. لا تقوم بتعديل الموقع أو إرسال الصفحات إلى Google؛ تعرض التقارير فقط.</p>
</main>
<script>
const tokenInput=document.getElementById("token");
const statusBox=document.getElementById("status");
const reportBox=document.getElementById("report");
const fmt=new Intl.NumberFormat("ar-SA");
const pct=v=>(Number(v||0)*100).toFixed(1)+"%";
function setStatus(message,isError=false){statusBox.textContent=message;statusBox.className="status"+(isError?" error":"")}
function cell(value,cls=""){const td=document.createElement("td");td.textContent=value; if(cls)td.className=cls;return td}
function fillTable(id,rows,key){const body=document.getElementById(id);body.replaceChildren();for(const r of rows||[]){const tr=document.createElement("tr");let label=r[key]||"";tr.append(cell(label));tr.append(cell(fmt.format(r.clicks),"num"));tr.append(cell(fmt.format(r.impressions),"num"));tr.append(cell(Number(r.position||0).toFixed(1),"num"));body.append(tr)}if(!rows||!rows.length){const tr=document.createElement("tr");const td=cell("لا توجد بيانات متاحة في هذه الفترة");td.colSpan=4;tr.append(td);body.append(tr)}}
async function connect(){const token=tokenInput.value.trim();if(!token){setStatus("أدخل رمز الدخول أولًا.",true);return}sessionStorage.setItem("sgSeoToken",token);setStatus("جارٍ الاتصال بـ Google Search Console…");document.getElementById("connect").disabled=true;try{const res=await fetch("/api/seo/report",{headers:{Authorization:"Bearer "+token}});const data=await res.json();if(!res.ok||data.connected===false)throw new Error(data.error||"تعذر الاتصال.");if(!data.propertyFound){setStatus("تم توثيق حساب الخدمة، لكن الخاصية المطلوبة غير موجودة ضمن صلاحياته. راجع الخاصية المعروضة.",true);document.getElementById("property").textContent="الخاصية المطلوبة: "+data.requestedProperty+" · الخصائص المتاحة: "+(data.availableProperties||[]).map(x=>x.siteUrl).join("، ");reportBox.classList.remove("hidden");return}document.getElementById("property").textContent="الخاصية: "+data.property+" · صلاحية الحساب: "+data.permissionLevel;document.getElementById("range").textContent="الفترة: "+data.dateRange.startDate+" إلى "+data.dateRange.endDate;const s=data.summary||{};document.getElementById("stats").replaceChildren();[["النقرات",fmt.format(s.clicks)],["مرات الظهور",fmt.format(s.impressions)],["معدل النقر",pct(s.ctr)],["متوسط الموضع",Number(s.position||0).toFixed(1)]].forEach(([label,value])=>{const div=document.createElement("div");div.className="stat";const span=document.createElement("span");span.textContent=label;const strong=document.createElement("strong");strong.textContent=value;div.append(span,strong);document.getElementById("stats").append(div)});fillTable("queries",data.topQueries,"query");fillTable("pages",data.topPages,"page");reportBox.classList.remove("hidden");setStatus("تم الاتصال بنجاح وقراءة تقارير Search Console.");}catch(e){reportBox.classList.add("hidden");setStatus(e.message||"حدث خطأ غير معروف.",true)}finally{document.getElementById("connect").disabled=false}}

async function runDiagnostics(){
 const token=tokenInput.value.trim()||sessionStorage.getItem("sgSeoToken")||"";
 if(!token){setStatus("أدخل رمز دخول لوحة SEO أولًا.",true);return}
 sessionStorage.setItem("sgSeoToken",token);
 const button=document.getElementById("diagnose");
 const target=document.getElementById("diagnostics");
 button.disabled=true;target.classList.remove("hidden");target.textContent="جارٍ فحص خرائط الموقع وحالة الصفحات…";
 try{
  const headers={Authorization:"Bearer "+token};
  const [smRes,ixRes]=await Promise.all([
   fetch("/api/seo/sitemaps",{headers}),
   fetch("/api/seo/indexing",{headers})
  ]);
  const [sm,ix]=await Promise.all([smRes.json(),ixRes.json()]);
  if(!smRes.ok)throw new Error(sm.error||"تعذر قراءة خرائط الموقع.");
  if(!ixRes.ok)throw new Error(ix.error||"تعذر فحص حالة الفهرسة.");
  target.replaceChildren();
  const title=document.createElement("h3");title.textContent="خرائط الموقع المسجلة في Google";target.append(title);
  const count=document.createElement("p");count.className="note";count.textContent="عدد الخرائط المسجلة: "+fmt.format(sm.sitemapCount||0);target.append(count);
  const smTable=document.createElement("table");
  const smHead=document.createElement("thead");const smHr=document.createElement("tr");
  ["الخريطة","آخر قراءة","الأخطاء","التحذيرات","الروابط المرسلة / المفهرسة"].forEach(x=>{const th=document.createElement("th");th.textContent=x;smHr.append(th)});smHead.append(smHr);smTable.append(smHead);
  const smBody=document.createElement("tbody");
  for(const item of sm.sitemaps||[]){
   const tr=document.createElement("tr");
   const loc=cell(item.path);loc.style.direction="ltr";loc.style.textAlign="left";tr.append(loc);
   tr.append(cell(item.lastDownloaded||"لم تُقرأ بعد"));
   tr.append(cell(fmt.format(item.errors||0)));
   tr.append(cell(fmt.format(item.warnings||0)));
   const sums=(item.contents||[]).map(x=>fmt.format(x.submitted)+" / "+fmt.format(x.indexed)).join(" · ")||"—";
   tr.append(cell(sums));smBody.append(tr);
  }
  if(!(sm.sitemaps||[]).length){const tr=document.createElement("tr");const td=cell("لا توجد خريطة مسجلة عبر Search Console API. تحقق من تقرير Sitemaps أو أرسل /sitemap.xml.");td.colSpan=5;tr.append(td);smBody.append(tr)}
  smTable.append(smBody);const smWrap=document.createElement("div");smWrap.className="table-wrap";smWrap.append(smTable);target.append(smWrap);
  const ixTitle=document.createElement("h3");ixTitle.textContent="فحص الصفحات الأساسية في فهرس Google";ixTitle.style.marginTop="24px";target.append(ixTitle);
  const ixTable=document.createElement("table");
  const ixHead=document.createElement("thead");const ixHr=document.createElement("tr");
  ["العنوان","النتيجة","حالة التغطية","آخر زحف","Google canonical"].forEach(x=>{const th=document.createElement("th");th.textContent=x;ixHr.append(th)});ixHead.append(ixHr);ixTable.append(ixHead);
  const ixBody=document.createElement("tbody");
  for(const item of ix.inspections||[]){
   const tr=document.createElement("tr");
   const u=cell(item.url);u.style.direction="ltr";u.style.textAlign="left";tr.append(u);
   tr.append(cell(item.verdict||"—"));
   tr.append(cell(item.coverageState||item.error||"—"));
   tr.append(cell(item.lastCrawlTime||"لم يزحف بعد / غير متاح"));
   const can=cell(item.googleCanonical||"—");can.style.direction="ltr";can.style.textAlign="left";tr.append(can);
   ixBody.append(tr);
  }
  ixTable.append(ixBody);const ixWrap=document.createElement("div");ixWrap.className="table-wrap";ixWrap.style.marginTop="12px";ixWrap.append(ixTable);target.append(ixWrap);
  const note=document.createElement("p");note.className="note";note.textContent="فحص URL Inspection يقرأ النسخة المعروفة لدى Google، وليس اختبارًا مباشرًا لقابلية فهرسة الصفحة الآن.";target.append(note);
  setStatus("اكتمل تشخيص خرائط الموقع وفحص خمس صفحات.");
 }catch(e){target.textContent=e.message||"حدث خطأ أثناء التشخيص.";setStatus(e.message||"تعذر إكمال التشخيص.",true)}
 finally{button.disabled=false}
}
document.getElementById("diagnose").addEventListener("click",runDiagnostics);

document.getElementById("connect").addEventListener("click",connect);
document.getElementById("clear").addEventListener("click",()=>{tokenInput.value="";sessionStorage.removeItem("sgSeoToken");reportBox.classList.add("hidden");setStatus("تم مسح رمز الدخول من جلسة المتصفح.")});
tokenInput.value=sessionStorage.getItem("sgSeoToken")||"";
</script></body></html>`;
}
