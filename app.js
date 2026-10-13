const margin = { top: 30, right: 30, bottom: 65, left: 120 };
const colorScale = d3.scaleSequential(d3.interpolateViridis);

const cityMapping = {
    "İstanbul": "Istanbul", "İzmir": "Izmir", "Eskişehir": "Eskisehir",
    "Kayseri": "Kayseri", "Antalya": "Antalya", "Bursa": "Bursa",
    "Ankara": "Ankara", "Konya": "Konya", "Gaziantep": "Gaziantep", "Adana": "Adana"
};

const regionMapping = {
    "Istanbul": "Marmara", 
    "Bursa": "Marmara", 
    "Izmir": "Aegean", 
    "Ankara": "Central Anatolia",
    "Konya": "Central Anatolia", 
    "Eskisehir": "Central Anatolia", 
    "Kayseri": "Central Anatolia",
    "Antalya": "Mediterranean", 
    "Adana": "Mediterranean", 
    "Gaziantep": "Southeastern Anatolia"
};

let globalData = [];
let geoJSONData = null;
let activeRegion = "all";
let activeCity = null;
let activeDateRange = null;
let activeDevice = "all";
let activePayment = "all";

Promise.all([
    d3.json("turkey_geo.json"),
    d3.csv("ecommerce_customer_behavior_dataset.csv")
]).then(([geoData, rawData]) => {
    geoJSONData = geoData;

    const firstRow = rawData[0];
    const sessionColumn = Object.keys(firstRow).find(key =>
        key.toLowerCase().includes("session") && key.toLowerCase().includes("duration")
    );

    console.log("The detected session duration column:", sessionColumn);

    globalData = rawData.map(d => ({
        ...d,
        Total_Amount: +d.Total_Amount || 0,
        Discount_Amount: +d.Discount_Amount || 0,
        Age: +d.Age || 0,
        Session_Duration: sessionColumn ? (+d[sessionColumn] || 0) : 0,
        Date: d3.timeParse("%Y-%m-%d")(d.Date),
        AgeGroup: d.Age <= 25 ? "18-25" : d.Age <= 35 ? "26-35" : d.Age <= 50 ? "36-50" : "51+",
        Region: regionMapping[d.City] || "Diğer"
    }));

    applyFilters();

    d3.select("#region-select").on("change", function () { activeRegion = this.value; activeCity = null; applyFilters(); });
    d3.select("#device-select").on("change", function () { activeDevice = this.value; applyFilters(); });
    d3.select("#payment-select").on("change", function () { activePayment = this.value; applyFilters(); });

    d3.select("#reset-filter").on("click", () => {
        activeRegion = "all"; activeCity = null; activeDateRange = null; activeDevice = "all"; activePayment = "all";
        d3.select("#region-select").property("value", "all");
        d3.select("#device-select").property("value", "all");
        d3.select("#payment-select").property("value", "all");
        d3.select("#selected-city-label").text("All of Turkey is being shown.");
        applyFilters();
    });
});

function applyFilters() {
    let filtered = globalData;
    
    if (activeRegion !== "all") filtered = filtered.filter(d => d.Region === activeRegion);
    if (activeCity) filtered = filtered.filter(d => d.City === activeCity);
    if (activeDevice !== "all") filtered = filtered.filter(d => d.Device_Type === activeDevice);
    if (activePayment !== "all") filtered = filtered.filter(d => d.Payment_Method === activePayment);
    if (activeDateRange) filtered = filtered.filter(d => d.Date >= activeDateRange[0] && d.Date <= activeDateRange[1]);

    let barFiltered = globalData;
    if (activeDevice !== "all") barFiltered = barFiltered.filter(d => d.Device_Type === activeDevice);
    if (activePayment !== "all") barFiltered = barFiltered.filter(d => d.Payment_Method === activePayment);
    if (activeDateRange) barFiltered = barFiltered.filter(d => d.Date >= activeDateRange[0] && d.Date <= activeDateRange[1]);

    renderMap(geoJSONData, filtered);
    renderHeatmap(filtered);
    renderScatter(filtered);
    renderLineChart(filtered);
    renderRegionSalesBar(barFiltered); 
}
function renderRegionSalesBar(data) {
    const container = d3.select("#region-sales-bar");
    container.selectAll("*").remove();
    
    // Etiketlerin sığması için marjları biraz genişlettik
    const w = 450, h = 320, marginBar = {top: 40, right: 30, bottom: 80, left: 60};
    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${w} ${h}`)
        .style("overflow", "visible"); // Tooltip ve etiketlerin kesilmesini önler

    if (data.length === 0) {
        svg.append("text").attr("x", w / 2).attr("y", h / 2).attr("text-anchor", "middle").text("Veri Bulunamadı");
        return;
    }

    // Satışları bölgeye göre toplayıp büyükten küçüğe sıralıyoruz
    const salesByRegion = d3.rollup(data, v => d3.sum(v, d => d.Total_Amount), d => d.Region);
    const sortedData = Array.from(salesByRegion, ([region, sales]) => ({region, sales}))
                            .sort((a, b) => b.sales - a.sales);

    const regions = sortedData.map(d => d.region);
    const values = sortedData.map(d => d.sales);

    // Eksen ayarları ve barların arasına boşluk (padding)
    const x = d3.scaleBand().domain(regions).range([marginBar.left, w - marginBar.right]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(values) * 1.15]).range([h - marginBar.bottom, marginBar.top]); // Etiketler için üstte %15 ekstra boşluk

    // Her bölge için modern bir renk paleti
    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range(["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1"]);

    // Arka plan ızgara çizgileri (Gridlines)
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(${marginBar.left},0)`)
        .call(d3.axisLeft(y).tickSize(-(w - marginBar.left - marginBar.right)).tickFormat(""))
        .call(g => g.selectAll(".tick line").attr("stroke", "#e0e0e0").attr("stroke-dasharray", "3,3"))
        .call(g => g.select(".domain").remove());

    // X Ekseni (Yazıları hafif eğik yaptık ki üst üste binmesin)
    svg.append("g")
        .attr("transform", `translate(0,${h - marginBar.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end")
        .style("font-size", "11px");

    // Y Ekseni (Sayıları k (bin) cinsinden kısalttık)
    svg.append("g")
        .attr("transform", `translate(${marginBar.left},0)`)
        .call(d3.axisLeft(y).ticks(6).tickFormat(d => d >= 1000 ? (d/1000) + "k" : d))
        .style("font-size", "11px");

    // Barları ekliyoruz (Başlangıçta yüksekliği 0, sonra animasyonla büyüyecek)
    const bars = svg.selectAll("rect.bar")
        .data(sortedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.region))
        .attr("y", y(0))
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("rx", 3) // Hafif oval köşeler
        .style("fill", d => colorScale(d.region))
        .style("opacity", 0.85);

    // Animasyon (Yukarı doğru uzama)
    bars.transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr("y", d => y(d.sales))
        .attr("height", d => y(0) - y(d.sales));

    // Hover (Üzerine gelince parlaması ve tooltip çıkması)
    bars.on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 1).style("filter", "brightness(1.1)");
            d3.select("#tooltip").style("opacity", 1).html(`<b>${d.region}</b><br/>Sales: <b>${d.sales.toLocaleString(undefined, { maximumFractionDigits: 2 })} TL</b>`);
        })
        .on("mousemove", function(event) {
            d3.select("#tooltip").style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 0.85).style("filter", "none");
            d3.select("#tooltip").style("opacity", 0);
        });

    // Barların üzerindeki rakam etiketleri
    svg.selectAll("text.val-label")
        .data(sortedData)
        .enter()
        .append("text")
        .attr("class", "val-label")
        .attr("x", d => x(d.region) + x.bandwidth() / 2)
        .attr("y", y(0)) // Animasyonla yukarı çıkacak
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#2c3e50")
        .text(d => d.sales >= 1000 ? (d.sales/1000).toFixed(1) + "k" : Math.round(d.sales))
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr("y", d => y(d.sales) - 6);
}
function renderMap(geo, data) {
    const cityStats = d3.rollup(data, v => {
        const counts = d3.rollup(v, g => g.length, d => d.Payment_Method);
        const topPayment = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
        const avgSession = d3.mean(v, d => d.Session_Duration);

        return {
            totalSales: d3.sum(v, d => d.Total_Amount),
            orderCount: v.length,
            avgSession: avgSession ? avgSession.toFixed(1) : "0.0",
            payment: topPayment
        };
    }, d => d.City);
    const globalCityStats = d3.rollup(globalData, v => ({
        totalSales: d3.sum(v, d => d.Total_Amount)
    }), d => d.City);

    function drawChoropleth(containerId, metricFn, colorInterpolator, label, isMain = false) {
        const container = d3.select(containerId);
        container.selectAll("*").remove();
        if (container.empty()) return;

        const width = container.node().getBoundingClientRect().width || (isMain ? 800 : 400);
        const height = isMain ? 450 : 300;
        const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`);
        const tooltip = d3.select("#tooltip");
        const shiftUp = isMain ? 25 : 10;
        const allValues = Array.from(cityStats.values()).map(metricFn).sort(d3.ascending);
        const absoluteMax = d3.max(allValues) || 1;
        const capValue = d3.quantile(allValues, 0.85) || absoluteMax; 
        const colorScaleLocal = d3.scaleSequential(colorInterpolator).domain([0, capValue]);
        const projection = d3.geoMercator()
            .center([35, 39])
            .scale(isMain ? 2800 : 1650)
            .translate([width / 2, (height / 2) - shiftUp]);

        const path = d3.geoPath().projection(projection);

        svg.selectAll("path").data(geo.features).enter().append("path")
            .attr("d", path).attr("class", "city-path")
            .attr("fill", d => {
                const csvName = cityMapping[d.properties.name] || d.properties.name;
                const stats = cityStats.get(csvName);
                return stats ? colorScaleLocal(metricFn(stats)) : "#eee";
            })
            .classed("region-highlight", d => {
                const csvName = cityMapping[d.properties.name] || d.properties.name;
                return (activeCity && csvName === activeCity) || (activeRegion !== "all" && regionMapping[csvName] === activeRegion);
            })
            .on("mouseover", (event, d) => {
                const csvName = cityMapping[d.properties.name] || d.properties.name;
                const stats = cityStats.get(csvName);

                const globalStats = globalCityStats.get(csvName); 
                const globalTotal = globalStats ? globalStats.totalSales : 0;

                if (!stats) return;

                const val = metricFn(stats);
                const displayVal = typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val;
                const suffix = label.includes("Sales") ? " TL" : "";


                tooltip.style("opacity", 1).html(`
                    <b>${csvName}</b><br/>
                   Total Sales: <b>${globalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} TL</b><br/>
                    <hr>
                    Selected Sales: <b>${stats.totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })} TL</b><br/>
                    Orders: <b>${stats.orderCount}</b><br/>
                    Avg Session: <b>${stats.avgSession} min</b>
                `);
            })
            .on("mousemove", (event) => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"))
            .on("mouseout", () => tooltip.style("opacity", 0))
            .on("click", (event, d) => {
                activeCity = cityMapping[d.properties.name] || d.properties.name;
                d3.select("#selected-city-label").text("City: " + activeCity);
                applyFilters();
            });

        const legendWidth = 160;
        const legendHeight = 10;
        const bottomPadding = 40;
        const leftPadding = 30;
        const defs = svg.append("defs");
        const gradientId = "gradient-" + containerId.replace("#", "");
        const linearGradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");

        linearGradient.selectAll("stop")
            .data(d3.ticks(0, 1, 10))
            .enter().append("stop")
            .attr("offset", d => (d * 100) + "%")
            .attr("stop-color", d => colorInterpolator(d));

        const legend = svg.append("g")
            .attr("transform", `translate(${leftPadding}, ${height - bottomPadding})`);
        legend.append("text")
            .attr("x", 0).attr("y", -6)
            .style("font-size", "11px").style("font-weight", "bold")
            .text(label);

        legend.append("rect")
            .attr("width", legendWidth).attr("height", legendHeight)
            .style("fill", `url(#${gradientId})`);

        legend.append("text")
            .attr("x", 0).attr("y", legendHeight + 12)
            .style("font-size", "10px").text("Low");

const maxLabel = capValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) + (label.includes("Sales") ? " TL+" : "+");
        legend.append("text")
            .attr("x", legendWidth).attr("y", legendHeight + 12)
            .attr("text-anchor", "end")
            .style("font-size", "10px")
            .text("High (" + maxLabel + ")");
    }

    drawChoropleth("#choropleth-map", d => d.totalSales, d3.interpolateViridis, "Total Sales", true);
    drawChoropleth("#map-order-count", d => d.orderCount, d3.interpolateOranges, "Order Count");
    drawChoropleth("#map-session-duration", d => +d.avgSession, d3.interpolateBlues, "Avg Session");
}

function renderHeatmap(data) {
    const container = d3.select("#heatmap"); container.selectAll("*").remove();
    const w = 400, h = 300, svg = container.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    if (data.length === 0) { svg.append("text").attr("x", w / 2).attr("y", h / 2).attr("text-anchor", "middle").text("No Data Found"); return; }

    const cats = [...new Set(globalData.map(d => d.Product_Category))];
    const ages = ["18-25", "26-35", "36-50", "51+"];
    const x = d3.scaleBand().range([margin.left, w - margin.right]).domain(ages).padding(0.05);
    const y = d3.scaleBand().range([h - margin.bottom, margin.top]).domain(cats).padding(0.05);
    const color = d3.scaleSequential(d3.interpolateGreens).domain([0, d3.max(data, d => d.Total_Amount) || 1000]);

    svg.append("g").attr("transform", `translate(0,${h - margin.bottom})`).call(d3.axisBottom(x));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

    svg.append("text").attr("text-anchor", "middle").attr("x", (w + margin.left) / 2).attr("y", h - 15).style("font-size", "12px").style("font-weight", "bold").text("Age Group");
    svg.append("text").attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("y", 25).attr("x", -h / 2).style("font-size", "12px").style("font-weight", "bold").text("Category");

    cats.forEach(cat => {
        ages.forEach(age => {
            const val = d3.sum(data.filter(d => d.Product_Category === cat && d.AgeGroup === age), d => d.Total_Amount);
            svg.append("rect").attr("x", x(age)).attr("y", y(cat)).attr("width", x.bandwidth()).attr("height", y.bandwidth())
                .style("fill", val > 0 ? color(val) : "#eee").style("stroke", "#fff");
        });
    });
}

function renderScatter(data) {
    const container = d3.select("#scatter-plot"); container.selectAll("*").remove();
    const w = 400, h = 300, svg = container.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    if (data.length === 0) { svg.append("text").attr("x", w / 2).attr("y", h / 2).attr("text-anchor", "middle").text("No Data Found"); return; }

    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.Discount_Amount) || 1]).range([margin.left, w - margin.right]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.Total_Amount) || 1]).range([h - margin.bottom, margin.top]);
    svg.append("g").attr("transform", `translate(0,${h - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));

    svg.append("text").attr("text-anchor", "middle").attr("x", (w + margin.left) / 2).attr("y", h - 15).style("font-size", "12px").style("font-weight", "bold").text("Discount (TL)");
    svg.append("text").attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("y", 30).attr("x", -h / 2).style("font-size", "12px").style("font-weight", "bold").text("Spending (TL)");

    svg.selectAll("circle").data(data).enter().append("circle").attr("cx", d => x(d.Discount_Amount)).attr("cy", d => y(d.Total_Amount)).attr("r", 3).style("fill", "#3498db").style("opacity", 0.5);
}

function renderLineChart(data) {
    const container = d3.select("#line-chart"); container.selectAll("*").remove();
    const w = 400, h = 300, svg = container.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    if (data.length === 0) { svg.append("text").attr("x", w / 2).attr("y", h / 2).attr("text-anchor", "middle").text("No Data Found"); return; }

    const salesByDate = d3.rollup(data, v => d3.sum(v, d => d.Total_Amount), d => d.Date);
    const dates = Array.from(salesByDate.keys()).sort((a, b) => a - b);
    const x = d3.scaleTime().domain(d3.extent(dates)).range([margin.left, w - margin.right]);
    const y = d3.scaleLinear().domain([0, d3.max(salesByDate.values()) || 1]).range([h - margin.bottom, margin.top]);

    svg.append("g").attr("transform", `translate(0,${h - margin.bottom})`).call(d3.axisBottom(x).ticks(4));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));

    svg.append("text").attr("text-anchor", "middle").attr("x", (w + margin.left) / 2).attr("y", h - 15).style("font-size", "12px").style("font-weight", "bold").text("Date");
    svg.append("text").attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("y", 30).attr("x", -h / 2).style("font-size", "12px").style("font-weight", "bold").text("Sales Trend (TL)");

    svg.append("path").datum(dates).attr("fill", "none").attr("stroke", "#e67e22").attr("stroke-width", 2).attr("d", d3.line().x(d => x(d)).y(d => y(salesByDate.get(d))));

    const brush = d3.brushX().extent([[margin.left, margin.top], [w - margin.right, h - margin.bottom]]).on("brush end", (event) => {
        activeDateRange = !event.selection ? null : event.selection.map(x.invert);
        updateLinkedCharts();
    });
    svg.append("g").attr("class", "brush").call(brush);
}

function updateLinkedCharts() {
    let f = globalData;
    let barF = globalData;

    if (activeRegion !== "all") f = f.filter(d => d.Region === activeRegion);
    if (activeCity) f = f.filter(d => d.City === activeCity);
    
    // İkisine de uygulanan filtreler
    if (activeDevice !== "all") {
        f = f.filter(d => d.Device_Type === activeDevice);
        barF = barF.filter(d => d.Device_Type === activeDevice);
    }
    if (activePayment !== "all") {
        f = f.filter(d => d.Payment_Method === activePayment);
        barF = barF.filter(d => d.Payment_Method === activePayment);
    }
    if (activeDateRange) {
        f = f.filter(d => d.Date >= activeDateRange[0] && d.Date <= activeDateRange[1]);
        barF = barF.filter(d => d.Date >= activeDateRange[0] && d.Date <= activeDateRange[1]);
    }

    renderMap(geoJSONData, f); 
    renderHeatmap(f); 
    renderScatter(f);
    renderRegionSalesBar(barF); 
}