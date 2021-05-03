// define promises as d3 method objects
const promises = [d3.json('data/counties.json'), d3.json('data/states.json'), d3.csv('data/svi-2018.csv'), d3.json('data/tri-2019.json'), d3.json('data/domains.json')];

// pass method objects to Promise constructor
const dataPromises = Promise.all(promises);

var expressed = 'EP_MINRTY'

// allows counties to be highlighted without clipping border
d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
        this.parentNode.appendChild(this);
    });
};

// in place of a proper margins object
var chartVars = {
    width: window.innerWidth * .33,
    height: 250,
    leftPadding: 1,
    rightPadding: 40,
    topBottomPadding: 10
};

// calcualted values
chartVars.innerWidth = chartVars.width - chartVars.leftPadding - chartVars.rightPadding;
chartVars.innerHeight = chartVars.height - (chartVars.topBottomPadding * 2);
chartVars.translate = "translate(" + chartVars.leftPadding + "," + chartVars.topBottomPadding + ")";

// call promises, construct datasets object, pass to map generation function
dataPromises.then(function (data) {

    const datasets = {
        counties: data[0],
        states: data[1],
        svi: data[2],
        tri: data[3],
        domains: data[4]
    };

    let attributes = ['EP_MINRTY', 'EP_POV', 'EP_SNGPNT', 'EP_UNEMP', 'EP_CROWD', 'EP_LIMENG']

    generateMap(datasets, attributes);

});

// in case of error
dataPromises.catch(function () {
    console.log("Promises not kept.")
});

var generateMap = function (datasets, attributes) {

    width = window.innerWidth * .8,
        height = window.innerHeight * .7

    const projection = d3.geoAlbers() // because
        .scale(2500) // big number
        .translate([width / 2, (height / 2) - height * .05]); // centers the map w/ 5% vertical offset

    // may not be necessary, but it works, so here it is
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on('zoom', function (e) {
            map.selectAll('path')
                .attr('transform', e.transform);

            map.selectAll('.pin')
                .attr('transform', e.transform)

            map.selectAll('.bin')
                .attr('transform', e.transform)

        });

    const path = d3.geoPath() // define geopath generator
        .projection(projection); // assign projection

    let map = d3.select('#map-container').append('svg') // create svg element
        .attr('class', 'map') // define class
        .attr('width', width) // assign width
        .attr('height', height) // assign height
        .style('background-color', 'rgba(255, 255, 255, .75)');

    map.call(zoom);

    // get data ready
    let counties = topojson.feature(datasets.counties, datasets.counties.objects['us-county-boundaries']).features;
    let triSites = topojson.feature(datasets.tri, datasets.tri.objects['tri-2019']).features;
    let states = topojson.feature(datasets.states, datasets.states.objects['states']).features;
    // add a title
    let mapTitle = map.append("text")
        .attr("x", width / 3)
        .attr("y", 30)
        .classed("mapTitle", true)
        .text("Datasets: US CDC Social Vulnerability Index - US EPA Toxic Release Inventory");

    let scales = scaler(datasets.domains, attributes);  // build scale object

    dataJoin(counties, datasets.svi, attributes); // get those attributes where they belong

    addCounties(map, path, counties); // attach counties to svg

    addSites(map, triSites, projection)

    addBins(map, path, counties, projection, scales)

    addStates(map, path, states, scales, projection, datasets, attributes)

    addLegend(map, scales.color, title = '% of minority status')

    let pins = d3.selectAll('.pin')
        .style('fill', 'rgba(0,0,0,0)')
        .style('stroke', 'rgba(0,0,0,0)')
        .transition('pins-g-in')
        .duration(3000)
        .style('fill', 'rgba(255,255,255,1)')

    let county_paths = d3.selectAll('.county')
        .style('fill', 'black')
        .style('stroke-width', 0)

    county_paths.transition('counties-in')
        .duration(5000)
    //.style('fill', (d) => {return choropleth(d.properties, scales)})

    let state_paths = d3.selectAll('.state')
        .style('stroke-width', 0)

    state_paths.transition('states-in')
        .duration(2000)
        .style('stroke-width', .5)

    addRadioButtons(map, attributes, datasets.domains);  // makes buttons change expression

    //chartFactory(map, attributes);  // makes a chart
};

var dataJoin = function (geodata, attributes) {

    // pandas for javascript, anyone? ^_^

    // is it a triple-loop?  it's a triple-loop.  Here we go.

    for (let i = 0; i < geodata.length; i++) {  // start with geojson items
        let key = geodata[i].properties.geoid;  // town centre sitename is key
        for (let j = 0; j < attributes.length; j++) { // check against attributes array
            let lock = attributes[j]['FIPS'];  // find matching row name in csv data

            if (key === lock) {  // a match!
                let county = geodata[i].properties;  // attribute values will be assigned to this
                const data = attributes[j];  // individual row/col pairs

                for (let att in data) { // loop over attributes
                    const val = data[att]; // assign value to check whether text or number

                    // this is the join- it's also a type function to separately parse floats to avoid converting strings to NaN
                    if (val === '-999') {
                        county[att] = null
                    } else if (val >= 0) {
                        county[att] = parseFloat(val)
                    } else {
                        county[att] = val;
                    }
                }
            }
        }
    }
};

var addCounties = function (map, path, geodata) {

    let tooltip = d3.select(".map")
                  .append("div")
                  .classed("toolTip", true);

    let counties = map.append('g')
        .attr('id', 'counties')

    counties.selectAll('path')  // create path object placeholders
        .data(geodata)  // feed d3
        .enter()  // enter topology array
        .append('path')  // append path to svg
        .attr('d', path) // assign path data to svg path
        .attr('id', (d) => {
            return d.properties.LOCATION  // tag sitename to path
        })
        .classed('county', true)  // add class


};

var addStates = function (map, path, geodata, scales, projection, datasets, attributes) {

    // this is where the centre paths are created and added.  when they are added, they are also given a colorspace.
    // in converting attribute value to color value via color scale, each areal unit has a possible colorspace of (in
    // this case) 9 values.  In order to provide convenient and efficient color switching, we'll simply use the color
    // scales object created in colorize() to define an object which contains the color value of each attribute
    // for each town centre.  This will be called by .style() when the attribute selector radio button changes state.

    let states = map.append('g')
        .attr('id', 'states')

    states.selectAll('path')  // create path object placeholders
        .data(geodata)  // feed d3
        .enter()  // enter topology array
        .append('path')  // append path to svg
        .attr('d', path) // assign path data to svg path
        .attr('id', d => d.properties['st'])
        .style('fill-opacity', 0)
        .style('stroke', 'white')
        .style('stroke-width', 1)
        .on('mouseover', function () {
            highlighter(this.id, datasets, attributes)
        })
        .on('mouseout', function () {  // dehighlights
            dehighlighter(this.id, scales, projection, datasets, attributes)
        })
        .classed('state', true)  // add class

}

var addSites = function (map, geodata, projection) {

    let pins = map.append('g')

    pins.selectAll('circle')
        .data(geodata)
        .enter()
        .append('circle')
        .attr('cx', (d) => {
            return projection([d.geometry.coordinates[0], d.geometry.coordinates[1]])[0]
        })
        .attr('cy', (d) => {
            return projection([d.geometry.coordinates[0], d.geometry.coordinates[1]])[1]
        })
        .attr('r', .75)
        .style('fill-color', 'rgba(0,0,0,.25)')
        .style('stroke', ('rgba(0,0,0,0)'))
        .style('display', 'none')
        .classed('pin', true)
}

var addBins = function (map, path, geodata, projection, scales) {

    let hexbin = d3.hexbin()
        .extent([[0, 0], [width, height]])
        .radius(10);

    var radius = d3.scaleSqrt()
        .domain([0, 362])
        .range([0, 20]);

    let bins = map.append('g')
        .attr('id', 'bins')

    bins.selectAll("path")
        .data(geodata)
        .enter()
        .append("path")
        .attr("d", d => calcHexRadius(d, projection, hexbin, radius))
        .style('fill', d => choropleth(d.properties, scales))
        .style("stroke", 'rgba(0,0,0,1)')
        .style('stroke-width', 1)
        .classed('bin', true)

}

var addLegend = function (map,
                          color,
                          title,
                          tickSize = 10,
                          legendWidth = width * .2,
                          legendHeight = height * .059 + tickSize,
                          marginTop = 18,
                          marginRight = 0,
                          marginBottom = 16 + tickSize,
                          marginLeft = 0,
                          ticks = legendWidth / 30,
                          tickFormat,
                          tickValues) {

    const legend = map.append("svg")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("viewBox", [width * -.6, height * -.1, legendWidth, legendHeight])
        .style("overflow", "visible")
        .classed('legend', true)

    let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - legendHeight);
    let x;


    // Threshold
    const thresholds = color.domain(); // scaleThreshold

    const thresholdFormat
        = tickFormat === undefined ? d => d
        : typeof tickFormat === "string" ? d3.format(tickFormat)
            : tickFormat;

    x = d3.scaleLinear()
        .domain([-1, color.range().length - 1])
        .rangeRound([marginLeft, legendWidth - marginRight]);

    legend.append("g")
        .selectAll("rect")
        .data(color.range())
        .join("rect")
        .attr("x", (d, i) => x(i))
        .attr("y", marginTop)
        .attr("width", (d, i) => x(i) - x(i - 1))
        .attr("height", legendHeight - marginTop - marginBottom)
        .attr("fill", d => d)
        .style('fill-opacity', 0)
        .classed("legend-rects", true)

    let rects = d3.selectAll('.legend-rects')
        .transition('rects')
        .ease(d3.easeCubicInOut)
        .duration(2000)
        .style('fill-opacity', 1)

    let locale = {"currency": ["", "%"]};  // formats scale values with % sign

    let fmt = d3.formatLocale(locale);

  let titles = {'EP_MINRTY': '% of minority population',
                'EP_POV': '% of population living in poverty',
                'EP_SNGPNT': '% of single parents',
                'EP_CROWD': '% living in overcrowded housing',
                'EP_LIMENG': '% with limited english skills',
                'EP_UNEMP': '% unemployed'}

    tickValues = d3.range(thresholds.length);
    tickFormat = i => thresholdFormat(thresholds[i], i);
    legend.append("g")
        .attr("transform", `translate(0,${legendHeight - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
            .tickFormat(typeof tickFormat === "function" ? tickFormat : fmt.format('$'))
            .tickSize(tickSize)
            .tickValues(tickValues))
        .call(tickAdjust)
        .call(g => g.select(".domain").remove())
        .call(g => g.append("text")
            .attr("x", legendWidth * .2)
            .attr("y", marginTop + marginBottom - legendHeight - 6)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
          .attr('font-size', 'medium')
            .text(titles[expressed]))
        .classed('legend-title', true)

}

var addRadioButtons = function (map, attributes, scales) {
// a click switches the radio button, then runs colorizer function on all boroughs for that attribute

    d3.selectAll('input')
        .on('click', function () {
            expressed = this.value;  // sets current expressed
            changeExpression(attributes, scales, map); // changes visual elements according to expressed attribute
        });
};

var scaler = function (domains, attributes) {
// makes the scales we need
// yay colorbrewer
    const colors = [colorbrewer.OrRd['5'],
        colorbrewer.BuGn['5'],
        colorbrewer.RdPu['5'],
        colorbrewer.YlOrRd['5'],
        colorbrewer.Blues['5'],
        colorbrewer.BrBG['5'],
        colorbrewer.Greens['5'],
    ]

    let place = attributes.indexOf(expressed)

    let values = domains[expressed]
    let domain = [d3.min(values), d3.max(values)];  // here's the domain for this attribute

// jenks classification
    let clusters = ss.ckmeans(values, 5);  // determine attribute value clusters
    let breaks = clusters.map(function (d) {
        return d3.min(d);
    });

// color scale
    let colorScale = d3.scaleQuantile()
        .range(colors[place])
        .domain(breaks);
// y scale
    let yScale = d3.scaleLinear()
        .range([chartVars.innerHeight, chartVars.topBottomPadding])
        .domain(domain);
// scales object
    let scales = {
        'color': colorScale,
        'y': yScale,
        'breaks': breaks
    };

    return scales;

};

let choropleth = function (props, scales) {
    let val = props[expressed];
    return scales.color(val)  // check val, make color
};

var changeExpression = function (attributes, domains, map) {

    const scales = scaler(domains, attributes);  // build scale object

    let bins = d3.selectAll(('.bin'))
        .transition('color_bins')
        .duration(2000)
        .ease(d3.easeCubicInOut)
        .style('fill', d => choropleth(d.properties, scales))

    let rects = d3.selectAll('.legend-rects')
        .transition('rects')
        .ease(d3.easeCubicInOut)
        .duration(1000)
        .style('fill-opacity', 0)

    d3.selectAll('.legend').remove()

    addLegend(map, scales.color, title = '% of minority status')

};

var highlighter = function (name, datasets, attributes) {
//change stroke
    var scales = scaler(datasets.domains, attributes);  // build scale object
    let bins = d3.selectAll('.bin')
        .filter((d) => {
            return d.properties['ST_ABBR'] === name
        })

    bins.transition('bins-out')
        .ease(d3.easeCubicIn)
        .duration(200)
        .attr('r', 0)
        .style('fill', 'rgba(0,0,0,0)')
        .style('stroke', 'rgba(0,0,0,0)');

    let pins = d3.selectAll('.pin')
        .filter((d) => {
            return d.properties['8. ST'] === name
        })

    pins.transition('pins-in')
        .style('display', 'inline')
        .ease(d3.easeCubicIn)
        .duration(200)
        .style('fill', 'rgba(255,255,255,1)')
        .attr('r', .75)

    let counties = d3.selectAll('.county')
        .filter((d) => {
            return d.properties['ST_ABBR'] === name
        })

    counties.transition('counties-in')
        .ease(d3.easeCubicIn)
        .duration(200)
        .style('fill', (d) => {
            return choropleth(d.properties, scales)
        })


};

var dehighlighter = function (name, scales, projection, datasets, attributes) {
//change stroke
    var scales = scaler(datasets.domains, attributes);  // build scale object

    let pins = d3.selectAll('.pin').filter((d) => {
        return d.properties['8. ST'] === name
    })

    pins.transition('pins-out')
        .ease(d3.easeCubicIn)
        .duration(200)
        .attr('r', 0)
        .style('fill', 'rgba(0,0,0,1)')

    let bins = d3.selectAll('.bin')
        .filter((d) => {
            return d.properties['ST_ABBR'] === name
        })

    let hexbin = d3.hexbin()
        .extent([[0, 0], [width, height]])
        .radius(10);

    var radius = d3.scaleSqrt()
        .domain([0, 362])
        .range([0, 20]);

    bins.transition('bins-in')
        .ease(d3.easeCubicIn)
        .duration(200)
        .attr("d", d => `M${projection([d.properties.geo_point_2d[1], d.properties.geo_point_2d[0]])[0]},${projection([d.properties.geo_point_2d[1], d.properties.geo_point_2d[0]])[1]},${hexbin.hexagon(2 * radius(d.properties['Count']))}`)
        .style('fill', (d) => {
            return choropleth(d.properties, scales)
        })
        .style('stroke', 'rgba(0,0,0,1)');

    let counties = d3.selectAll('.county')
        .filter((d) => {
            return d.properties['ST_ABBR'] === name
        })

    counties.transition('counties-out')
        .ease(d3.easeCubicIn)
        .duration(200)
        .style('fill', 'black')

};


var calcHexRadius = function(d, projection, hexbin, radius) {
    let x = projection([d.properties.geo_point_2d[1], d.properties.geo_point_2d[0]])[0]
    let y = projection([d.properties.geo_point_2d[1], d.properties.geo_point_2d[0]])[1]
    let r = d.properties['Count'] > 0 ? hexbin.hexagon(2 * radius(d.properties['Count'])) : hexbin.hexagon(0)

    return `M${x},${y},${r}`
}
