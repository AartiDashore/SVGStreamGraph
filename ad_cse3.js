async function loadAndProcessData(file) {
    const response = await fetch(file);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
    const cleaned = raw.map(row => ({
      Term: row.Term,
      Department: row.Department || "Unknown",
      Students: +row.Student_Count || 0
    }));
  
    const terms = [...new Set(cleaned.map(d => d.Term))].sort();
    const departments = [...new Set(cleaned.map(d => d.Department))];
  
    const nested = d3.rollup(
      cleaned,
      v => d3.sum(v, d => d.Students),
      d => d.Term,
      d => d.Department
    );
  
    const data = terms.map(term => {
      const row = { Term: term };
      departments.forEach(dep => {
        row[dep] = nested.get(term)?.get(dep) || 0;
      });
      return row;
    });
  
    drawStreamgraph(data, departments);
  }
  
  function drawStreamgraph(data, keys) {
    const svg = d3.select("svg");
    const width = 1000;
    const height = 400;
    const margin = { top: 20, right: 180, bottom: 70, left: 60 };
  
    svg.attr("viewBox", [0, 0, width, height]);
  
    const x = d3.scalePoint()
      .domain(data.map(d => d.Term))
      .range([margin.left, width - margin.right - 100]);
  
    const y = d3.scaleLinear().range([height - margin.bottom, margin.top]);
  
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(keys);
  
    const stack = d3.stack()
      .keys(keys)
      .offset(d3.stackOffsetWiggle);
  
    const area = d3.area()
      .x(d => x(d.data.Term))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);
  
    const stackedData = stack(data);
  
    y.domain([
      d3.min(stackedData, layer => d3.min(layer, d => d[0])),
      d3.max(stackedData, layer => d3.max(layer, d => d[1]))
    ]);
  
    const tooltip = d3.select(".tooltip");
  
    svg.selectAll("path.layer")
      .data(stackedData)
      .join("path")
      .attr("class", "layer")
      .attr("fill", d => color(d.key))
      .attr("d", area)
      .on("mouseover", function(event, d) {
        const [xCoord] = d3.pointer(event);
        const xDomain = x.domain();
        const nearestIndex = Math.round(x.invert ? x.invert(xCoord) : (xCoord - x.range()[0]) / (x.step()));
        const nearestTerm = xDomain[nearestIndex] || "";
        const value = d.find(p => p.data.Term === nearestTerm);
        const count = value ? (value[1] - value[0]).toFixed(0) : "N/A";
  
        tooltip.style("opacity", 1)
               .html(`<strong>Department:</strong> ${d.key}<br>
                      <strong>Term:</strong> ${nearestTerm}<br>
                      <strong>Students:</strong> ${count}`)
               .style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  
    // X Axis
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end")
      .style("font-weight", "bold");
  
    // Y Axis
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .style("font-weight", "bold");
  
    // X Label
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - margin.bottom + 60)
      .attr("text-anchor", "middle")
      .text("Academic Term")
      .style("font-size", "14px")
      .style("font-weight", "bold");
  
    // Y Label
    svg.append("text")
      .attr("x", -height / 2)
      .attr("y", 18)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text("Number of Students")
      .style("font-size", "14px")
      .style("font-weight", "bold");
  
    // Legend
    const legend = d3.select("#legend")
      .style("right", "30%")
      .style("top", "10%");
    keys.forEach(key => {
      const row = legend.append("div");
      row.append("div")
        .attr("class", "legend-color")
        .style("background", color(key));
      row.append("span").text(key);
    });
  }
  
  loadAndProcessData("CSE_Enrollment.xlsx");