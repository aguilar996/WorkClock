const C=window.CLOCK_CONFIG,API=C.API_URL.replace(/\/$/,'');const $=s=>document.querySelector(s);const money=c=>new Intl.NumberFormat(C.locale,{style:'currency',currency:C.currency}).format((c||0)/100);const dur=m=>`${Math.floor((m||0)/60)}h ${String((m||0)%60).padStart(2,'0')}m`;let period='week';
async function load(){try{const r=await fetch(`${API}/api/report?period=${period}`);if(!r.ok)throw Error('Could not load report');const d=await r.json();$('#periodTitle').textContent=d.title||period.toUpperCase();$('#reportHours').textContent=dur(d.totalMinutes);$('#reportPay').textContent=money(d.earningsCents);$('#avgRate').textContent=`${money(d.averageRateCents)}/hr`;$('#shiftCount').textContent=d.shiftCount||0;$('#breakdown').innerHTML=(d.breakdown||[]).length?d.breakdown.map(x=>`<div class="row"><div><strong>${x.label}</strong><small>${x.subLabel||''}</small></div><div><strong>${dur(x.minutes)}</strong><small>${money(x.earningsCents)}</small></div></div>`).join(''):'<div class="empty">No data for this period.</div>'}catch(e){$('#breakdown').innerHTML='<div class="empty">Connect config.js to your Cloudflare Worker to load reports.</div>'}}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');period=b.dataset.period;load()});load();
document
  .querySelector("#exportCsvBtn")
  .addEventListener("click", async () => {

    try {
      const response = await fetch(
        `${API}/api/report?period=${period}`
      );

      if (!response.ok) {
        throw new Error("Could not load report");
      }

      const data = await response.json();

      const rows = [
        [
          "Date",
          "Time",
          "Hours",
          "Rate",
          "Earnings"
        ]
      ];

      for (const item of data.breakdown || []) {

        rows.push([
          item.label,
          item.subLabel || "",
          ((item.minutes || 0) / 60).toFixed(2),
          (
            item.minutes > 0
              ? (
                  item.earningsCents /
                  (item.minutes / 60) /
                  100
                ).toFixed(2)
              : "0.00"
          ),
          (
            (item.earningsCents || 0) / 100
          ).toFixed(2)
        ]);
      }

      // Summary at bottom
      rows.push([]);
      rows.push([
        "TOTAL",
        "",
        (
          (data.totalMinutes || 0) / 60
        ).toFixed(2),
        (
          (data.averageRateCents || 0) / 100
        ).toFixed(2),
        (
          (data.earningsCents || 0) / 100
        ).toFixed(2)
      ]);

      const escapeCsv = (value) => {
        const text = String(value ?? "");

        return `"${text.replaceAll('"', '""')}"`;
      };

      const csv =
        "\uFEFF" +
        rows
          .map(row =>
            row.map(escapeCsv).join(",")
          )
          .join("\r\n");

      const blob = new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      link.href = url;

      link.download =
        `workclock-${period}-${today}.csv`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

    } catch (error) {

      console.error(error);

      alert(
        "Could not export the report."
      );
    }
  });
