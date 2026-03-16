(function () {
  const csvPath = "data/Cincinnati311.csv";
  const selectedServiceKeyword = "POTHOLE";
  const chartContainer = d3.select("#timeline-chart");

  if (chartContainer.empty()) {
    return;
  }

  d3.csv(csvPath)
    .then((data) => {
      const allowedFields = ["SR_TYPE", "SR_TYPE_DESC", "DATE_CREATED", "DATE_TIME_RECEIVED"];
      const mappedRows = data.map((d) => {
        const row = {};
        allowedFields.forEach((field) => {
          const rawValue = d[field] ?? d[field.replace(/^\uFEFF/, "")];
          row[field] = rawValue ?? "";
        });
        return row;
      });

      const filtered = mappedRows.filter((d) => {
        const srType = (d.SR_TYPE || "").toUpperCase();
        const srTypeDesc = (d.SR_TYPE_DESC || "").toUpperCase();
        return srType === "PTHOLE" || srTypeDesc.includes(selectedServiceKeyword);
      });

      const parsed = filtered
        .map((d) => ({
          ...d,
          createdDate: parseRequestDate(d.DATE_CREATED || d.DATE_TIME_RECEIVED),
        }))
        .filter((d) => d.createdDate instanceof Date && !Number.isNaN(d.createdDate.getTime()));

      if (!parsed.length) {
        chartContainer.html("<p>No timeline data available.</p>");
        return;
      }

      const dailyCounts = aggregateByDay(parsed);
      renderTimeline(dailyCounts);

      window.addEventListener("resize", () => {
        renderTimeline(dailyCounts);
      });
    })
    .catch((error) => {
      console.error("Timeline load error:", error);
      chartContainer.html("<p>Failed to load timeline data.</p>");
    });

  function parseRequestDate(rawDate) {
    if (!rawDate) {
      return null;
    }

    const parsePrimary = d3.timeParse("%Y %b %d %I:%M:%S %p");
    const parseSlash = d3.timeParse("%m/%d/%y");
    const primary = parsePrimary(rawDate);
    if (primary) return primary;
    const slash = parseSlash(rawDate);
    if (slash) return slash;

    const fallback = new Date(rawDate);
    if (!Number.isNaN(fallback.getTime())) return fallback;

    return null;
  }

  function aggregateByDay(records) {
    const countByDay = d3.rollup(records, (v) => v.length, (d) => +d3.timeDay.floor(d.createdDate));

    const minDay = d3.timeDay.floor(d3.min(records, (d) => d.createdDate));
    const maxDay = d3.timeDay.floor(d3.max(records, (d) => d.createdDate));
    const allDays = d3.timeDay.range(minDay, d3.timeDay.offset(maxDay, 1));

    return allDays.map((day) => ({
      date: day,
      count: countByDay.get(+day) || 0,
    }));
  }

  function renderTimeline(data) {
    chartContainer.selectAll("*").remove();

    const containerWidth = chartContainer.node().clientWidth;
    const width = Math.max(containerWidth, 320);
    const height = 300;
    const margin = { top: 10, right: 20, bottom: 38, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer
      .append("svg")
      .attr("class", "timeline-svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "none");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.date))
      .range([0, innerWidth]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) || 1])
      .nice()
      .range([innerHeight, 0]);

    const xAxis = d3
      .axisBottom(x)
      .ticks(8)
      .tickFormat(d3.timeFormat("%b %d"));

    const yAxis = d3.axisLeft(y).ticks(6);

    g.append("g")
      .attr("class", "timeline-grid")
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(""));

    g.append("g")
      .attr("class", "timeline-grid")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(8).tickSize(0).tickFormat(""));

    g.append("g")
      .attr("class", "timeline-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);

    g.append("g").attr("class", "timeline-axis").call(yAxis);

    g.append("text")
      .attr("class", "timeline-axis-title")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + margin.bottom - 6)
      .attr("text-anchor", "middle")
      .text("Date (2025)");

    g.append("text")
      .attr("class", "timeline-axis-title")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -margin.left + 16)
      .attr("text-anchor", "middle")
      .text("Number of Requests");

    const line = d3
      .line()
      .curve(d3.curveMonotoneX)
      .x((d) => x(d.date))
      .y((d) => y(d.count));

    g.append("path").datum(data).attr("class", "timeline-line").attr("d", line);

  }
})();
