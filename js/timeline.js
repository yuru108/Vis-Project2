let timelineLastInput = [];
let timelineResizeBound = false;

function renderTimelineChart(data) {
  const chartContainer = d3.select("#timeline-chart");
  if (chartContainer.empty()) {
    return;
  }

  const timelineTooltip = d3.select("#tooltip");
  timelineLastInput = Array.isArray(data) ? data : [];

  const parsed = timelineLastInput
    .map((d) => ({
      ...d,
      createdDate: parseRequestDate(d.DATE_CREATED || d.DATE_TIME_RECEIVED),
    }))
    .filter((d) => d.createdDate instanceof Date && !Number.isNaN(d.createdDate.getTime()));

  if (!parsed.length) {
    chartContainer.html("<p>No timeline data available for selected service types.</p>");
    return;
  }

  const dailyCounts = aggregateByDay(parsed);
  renderTimeline(dailyCounts, parsed, chartContainer, timelineTooltip);

  if (!timelineResizeBound) {
    window.addEventListener("resize", () => {
      renderTimelineChart(timelineLastInput);
    });
    timelineResizeBound = true;
  }
}

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

function renderTimeline(data, originalData, chartContainer, timelineTooltip) {
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

  const focus = g
    .append("circle")
    .attr("class", "timeline-dot")
    .attr("r", 5)
    .style("display", "none");

  const hoverLine = g
    .append("line")
    .attr("class", "timeline-hover-line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .style("display", "none");

  const bisectDate = d3.bisector((d) => d.date).left;

  g.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const mouseX = d3.pointer(event, this)[0];
      const hoveredDate = x.invert(mouseX);
      const idx = bisectDate(data, hoveredDate, 1);
      const d0 = data[idx - 1] || data[0];
      const d1 = data[idx] || d0;
      const d = hoveredDate - d0.date > d1.date - hoveredDate ? d1 : d0;

      focus
        .style("display", null)
        .attr("cx", x(d.date))
        .attr("cy", y(d.count));

      hoverLine
        .style("display", null)
        .attr("x1", x(d.date))
        .attr("x2", x(d.date));

      timelineTooltip
        .style("opacity", 1)
        .html(`
          <div><strong>Date:</strong> ${d3.timeFormat("%Y-%m-%d")(d.date)}</div>
          <div><strong>Requests:</strong> ${d.count}</div>
        `)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`);
    })
    .on("mouseleave", function () {
      focus.style("display", "none");
      hoverLine.style("display", "none");
      timelineTooltip.style("opacity", 0);
    });

  const brush = d3.brushX().extent([[0, 0], [innerWidth, innerHeight]]).on("brush end", brushed);

  g.append("g").attr("class", "brush").call(brush);

  function brushed(event) {
    if (typeof dispatcher === "undefined" || !dispatcher) {
      return;
    }

    if (!event.selection) {
      dispatcher.call("filterData", null, null, "timeline_brush");
      return;
    }

    const [x0, x1] = event.selection;
    const startDate = x.invert(x0);
    const endDate = x.invert(x1);
    const filteredData = originalData.filter((d) => {
      const date = d.createdDate;
      return date >= startDate && date <= endDate;
    });

    dispatcher.call("filterData", null, filteredData, "timeline_brush");
  }
}
