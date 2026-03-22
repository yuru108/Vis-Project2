const width = 900;
const height = 480;

const svg = d3
  .select("#viz")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("role", "img")
  .attr("aria-label", "D3 placeholder graphic");

const data = d3.range(18).map(() => ({
  x: Math.random() * width,
  y: Math.random() * height,
  r: 12 + Math.random() * 36,
}));

svg
  .append("rect")
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "url(#bg)");

const defs = svg.append("defs");

const gradient = defs
  .append("linearGradient")
  .attr("id", "bg")
  .attr("x1", "0%")
  .attr("y1", "0%")
  .attr("x2", "100%")
  .attr("y2", "100%");

gradient.append("stop").attr("offset", "0%").attr("stop-color", "#fde2e4");
gradient.append("stop").attr("offset", "100%").attr("stop-color", "#cfe1f5");

svg
  .selectAll("circle")
  .data(data)
  .join("circle")
  .attr("cx", (d) => d.x)
  .attr("cy", (d) => d.y)
  .attr("r", (d) => d.r)
  .attr("fill", "rgba(239, 71, 111, 0.55)")
  .attr("stroke", "#ef476f")
  .attr("stroke-width", 1.5);

svg
  .append("text")
  .attr("x", width / 2)
  .attr("y", height / 2)
  .attr("text-anchor", "middle")
  .attr("dominant-baseline", "middle")
  .attr("fill", "#1b1b1b")
  .attr("font-size", 28)
  .attr("font-family", "'Noto Serif TC', 'Source Serif 4', serif")
  .text("D3 已就緒");

// **This Needs To Be Moved To A Separate File**

// Load 311 service requests, then normalize and filter records before mapping.
// Reason: raw CSV fields can vary in naming/casing and may include invalid coordinates,
// which can break or clutter the map. This step standardizes latitude/longitude and
// the Leaflet layer renders accurate, focused points.

d3.csv('data/Cincinnati311.csv')
.then(data => {
    console.log("number of items: " + data.length);

    const allowedFields = [
      'SR_TYPE',
      'SR_TYPE_DESC',
      'PRIORITY',
      'DEPT_CODE',
      'DEPT_NAME',
      'DEPT_DIVISION',
      'ADDRESS',
      'LOCATION',
      'NEIGHBORHOOD',
      'ZIPCODE',
      'METHOD_RECEIVED',
      'DATE_CREATED',
      'TIME_RECEIVED',
      'DATE_CLOSED',
      'DATE_STATUS_CHANGE',
      'TIME_STATUS_CHANGE',
      'DATE_LAST_UPDATE',
      'TIME_LAST_UPDATE',
      'PLANNED_RESPONSE_TIME',
      'PLANNED_END_DATE',
      'PLANNED_COMPLETION_DAYS',
      'DATE_DISPATCHED',
      'TIME_DISPATCHED',
      'DATE_REVISED_COMPLETION',
      'DATE_REVISED_COMPLETION_REASON',
      'COLLECTION_SPECIAL_DATE',
      'COLLECTION_DAY',
      'COLLECTION_ROUTE',
      'COLLECTION_DIST',
      'PROPTY_CITY_OWNED_YN',
      'PROPTY_CITY_DEPT_OWNER',
      'STREET_NO',
      'STREET_DIRECTION',
      'STREET_NAME',
      'REQUEST_RETURN_CALL',
      'NUM_POTHOLES',
      'POLICE_DISTRICT',
      'POLICE_RPT_AREA',
      'LATITUDE',
      'LONGITUDE',
      'DATE_TIME_RECEIVED',
      'COMMUNITY_COUNCIL_NEIGHBORHOOD'
    ];

    const parsedData = data
      .map(d => {
        const row = {};
        allowedFields.forEach(field => {
          row[field] = d[field] ?? '';
        });

        row.LATITUDE = +(d.LATITUDE ?? d.latitude);
        row.LONGITUDE = +(d.LONGITUDE ?? d.longitude);

        return row;
      })
      .filter(d => Number.isFinite(d.LATITUDE) && Number.isFinite(d.LONGITUDE))
      .filter(d => {
        const srType = (d.SR_TYPE ?? '').toUpperCase();
        const srTypeDesc = (d.SR_TYPE_DESC ?? '').toUpperCase();
        return srType === 'PTHOLE' || srTypeDesc.includes('POTHOLE');
      });

    leafletMap = new LeafletMap({ parentElement: '#my-map'}, parsedData);
    renderAllBarCharts(parsedData);

  })
  .catch(error => console.error(error));
