/*
Written by Joshua Fabian
August 2016, MIT Transit Lab
jfabi@alum.mit.edu, joshuajfabian@gmail.com

Last updated 2 March 2018
*/

apiKey = config.PERFORMANCE_API_KEY

var time = document.getElementsByClassName('timeField'); //Get all elements with class "time"
for (var i = 0; i < time.length; i++) { //Loop trough elements
    time[i].addEventListener('keyup', function (e) {; //Add event listener to every element
        var reg = /[0-9]/;
        if (this.value.length == 2 && reg.test(this.value)) this.value = this.value + ":"; //Add colon if string length > 2 and string is a number 
        if (this.value.length > 5) this.value = this.value.substr(0, this.value.length - 1); //Delete the last digit if string length > 5
    });
};




var headwayURL = "https://api-v3.mbta.com/stops?filter[route]=Red%2CBlue%2COrange%2CMattapan%2CGreen-B%2CGreen-C%2CGreen-D%2CGreen-E";
var stationArray = []
var map = null

jQuery(document).ready(function($) {
    $.ajax({
        url : headwayURL,
        dataType : "json",
        async: false,
        success : function(parsed_json) {
            var stationJson = parsed_json['data'];
            var display = '';
            var stationSelectorString = 'Select station <select id="stationInput">'

            // iterate over all observed headways at this station

            for (j = 0; j < stationJson.length; j++) {
                var stopId = stationJson[j]['id'];
                var stopName = stationJson[j]['attributes']['name'];
                newStation = {
                    stationId: stopId,
                    stationName: stopName,
                    stationLat: stationJson[j]['attributes']['latitude'],
                    stationLon: stationJson[j]['attributes']['longitude']
                };
                stationSelectorString = stationSelectorString + '<option value="' + stopId + '">' + stopName + '</option>';
                stationArray.push(newStation)
            }
            stationSelectorString = stationSelectorString + '</select><button onclick="nextStationUpdate()">View station map</button>';
            document.getElementById('stationSelector').innerHTML = stationSelectorString;

            // initialize the map
            var layer = new L.StamenTileLayer('toner');
            map = L.map('map').setView([42.35, -71.08], 15);
            map.addLayer(layer);
        }
    });
});


function nextStationUpdate() {
    document.getElementById("stationHeader").innerHTML = 'Please wait. Your diagram is currently baking...<br>&nbsp;';

    setTimeout(function() {
        // parse input date into epoch time, set beginning and ending time to search
        // by default, we search from 04:00 of chosen day until 03:00 next morning

        // also obtain a reference midnight time so that epoch times can be later converted
        // into generic seconds from midnight
        var e = document.getElementById('stationInput');
        var stationInput = e.options[e.selectedIndex].value;
        var stationName = '';
        var stationLat = '';
        var stationLon = '';

        for (var i = 0; i < stationArray.length; i++) { //Loop trough elements
            if (stationArray[i]['stationId'] == stationInput) {
                stationName = stationArray[i]['stationName'];
                stationLat = stationArray[i]['stationLat'];
                stationLon = stationArray[i]['stationLon'];
            }
        };

        // define route, which here is eastbound C-branch on MBTA Green Line

        var allSegments = [];
        var allFacilities = [];
        var nearbyStops = [];
        var stationFacilities = [];
        var directRoutes = [];
        var nearbyRoutes = [];

        var MARGINS = {top: 30, right: 30, bottom: 122, left: 50};
        var WIDTH = 1200 - MARGINS.left - MARGINS.right;
        var HEIGHT = 650 - MARGINS.top - MARGINS.bottom;

        // iterate over each stop

        var nearbyURL = 'https://api-v3.mbta.com/stops?fields[stop]=latitude,location_type,longitude,name,wheelchair_boarding,platform_name,platform_code,description,parent_station&filter[latitude]=' + stationLat + '&filter[longitude]=' + stationLon + '&filter[radius]=0.002';
        var facilityURL = 'https://api-v3.mbta.com/facilities?filter[stop]=' + stationInput;

        jQuery(document).ready(function($) {
            $.ajax({
                url : nearbyURL,
                dataType : "json",
                async: false,
                success : function(parsed_json) {
                    var nearbyJson = parsed_json['data'];

                    for (j = 0; j < nearbyJson.length; j++) {
                        var stopId = nearbyJson[j]['id'];
                        var stopName = nearbyJson[j]['attributes']['name'];
                        var parentStation = null;
                        if (nearbyJson[j]['relationships']['parent_station']['data']) {
                            parentStation = nearbyJson[j]['relationships']['parent_station']['data']['id'];
                        }
                        newStation = {
                            id: stopId,
                            name: stopName,
                            description: nearbyJson[j]['attributes']['description'],
                            lat: nearbyJson[j]['attributes']['latitude'],
                            lon: nearbyJson[j]['attributes']['longitude'],
                            platformName: nearbyJson[j]['attributes']['platform_name'],
                            platformCode: nearbyJson[j]['attributes']['platform_code'],
                            wheelchair: nearbyJson[j]['attributes']['wheelchair_boarding'],
                            locationType: nearbyJson[j]['attributes']['location_type'],
                            parentStation: parentStation,
                            routes: []
                        };
                        nearbyStops.push(newStation)
                    }
                }
            });
        });

        jQuery(document).ready(function($) {
            $.ajax({
                url: 'facilities.csv',
                async: false,
                success: function (csvd) {
                    allFacilities = $.csv.toArrays(csvd);

                    for (j = 0; j < allFacilities.length; j++) {
                        if (allFacilities[j][4] == stationInput) {
                            stopLatitude = null;
                            stopLongitude = null;
                            if (allFacilities[j][8] != '') {
                                stopLatitude = parseFloat(allFacilities[j][8])
                            }
                            if (allFacilities[j][9] != '') {
                                stopLongitude = parseFloat(allFacilities[j][9])
                            }
                            newFacility = {
                                id: allFacilities[j][0],
                                name: allFacilities[j][6],
                                type: allFacilities[j][3],
                                lat: stopLatitude,
                                lon: stopLongitude
                            };
                            stationFacilities.push(newFacility);
                        }
                    }
                },
                dataType: 'text',
                complete: function () {
                    // call a function on complete
                }
            });
        });

        for (k = 0; k < nearbyStops.length; k++) {
            if (nearbyStops[k]['locationType'] == 0) {
                var childURL = 'https://api-v3.mbta.com/routes?filter[stop]=' + nearbyStops[k]['id'];

                jQuery(document).ready(function($) {
                    $.ajax({
                        url : childURL,
                        dataType : "json",
                        async: false,
                        success : function(parsed_json) {
                            var routesJson = parsed_json['data'];
                            var routesServed = []

                            for (j = 0; j < routesJson.length; j++) {
                                var routeName = routesJson[j]['attributes']['short_name']
                                if (routesJson[j]['attributes']['long_name'] != '') {
                                    routeName = routesJson[j]['attributes']['long_name']
                                }
                                newRoute = {
                                    id: routesJson[j]['id'],
                                    name: routeName,
                                    colorBg: routesJson[j]['attributes']['color'],
                                    colorText: routesJson[j]['attributes']['text_color']
                                };
                                nearbyStops[k]['routes'].push(newRoute);
                                var match = false;

                                if (nearbyStops[k]['parentStation'] != null) {
                                    for (l = 0; l < directRoutes.length; l++) {
                                        if (directRoutes[l]['id'] == routesJson[j]['id']) {
                                            match = true;
                                        }
                                    }
                                    if (match == false) {
                                        directRoutes.push(newRoute);
                                    }
                                } else {
                                    for (l = 0; l < nearbyRoutes.length; l++) {
                                        if (nearbyRoutes[l]['id'] == routesJson[j]['id']) {
                                            match = true;
                                        }
                                    }
                                    if (match == false) {
                                        nearbyRoutes.push(newRoute);
                                    }
                                }
                            }
                        }
                    });
                });
            }
        }

        console.log('-- STOPS --')
        console.log(nearbyStops)
        console.log('-- FACILITIES --')
        console.log(stationFacilities)
        console.log('-- DIRECT ROUTES --')
        console.log(directRoutes)
        console.log('-- NEARBY ROUTES --')
        console.log(nearbyRoutes)

        map.setView([stationLat, stationLon], 18);

        // load GeoJSON from an external file
        // $.getJSON("rodents.geojson",function(data){
        //     // add GeoJSON layer to the map once the file is loaded
        //     L.geoJson(data).addTo(map);
        // });

        var servingText = '';
        var nearbyText = '';
        for (l = 0; l < directRoutes.length; l++) {
            servingText = servingText + '<span style="color: #' + directRoutes[l]['colorText'] + '; background-color: #' + directRoutes[l]['colorBg'] + ';"><b>&nbsp;' + directRoutes[l]['name'] + '&nbsp;</b></span>&nbsp;&nbsp;'
        }

        for (l = 0; l < nearbyRoutes.length; l++) {
            nearbyText = nearbyText + '<span style="color: #' + nearbyRoutes[l]['colorText'] + '; background-color: #' + nearbyRoutes[l]['colorBg'] + ';"><b>&nbsp;' + nearbyRoutes[l]['name'] + '&nbsp;</b></span>&nbsp;&nbsp;'
        }

        for (l = 0; l < nearbyStops.length; l++) {
            var marker = L.marker([nearbyStops[l]['lat'], nearbyStops[l]['lon']]).addTo(map);
            
            var stopName = ''
            var accessibility = ''
            var routeText = ''
            if (nearbyStops[l]['platformCode'] != null || nearbyStops[l]['platformName'] != null) {
                var platformCode = '';
                var platformName = '';
                if (nearbyStops[l]['platformCode'] != null) {
                    platformCode = 'Platform ' + nearbyStops[l]['platformCode'] + ' - ';
                }
                platformName = nearbyStops[l]['platformName'];
                stopName = nearbyStops[l]['name'] + ': <b>' + platformCode + platformName + '</b>';
            } else {
                stopName = '<b>' + nearbyStops[l]['name'] + '</b>';
            }
            if (nearbyStops[l]['wheelchair'] == 1) {
                accessibility = '&nbsp;<img src="icons/access.png" width="18px">'
            }
            for (m = 0; m < nearbyStops[l]['routes'].length; m++) {
                route = nearbyStops[l]['routes'][m];
                routeText = routeText + '<br><span style="color: #' + route['colorText'] + '; background-color: #' + route['colorBg'] + ';"><b>&nbsp;' + route['name'] + '&nbsp;</b></span>'
            }

            var popupText = stopName + accessibility + routeText;
            marker.bindPopup(popupText).openPopup();
        }

        setTimeout(function(){
            document.getElementById('stationHeader').innerHTML = stationName + '<br>&nbsp;';
            document.getElementById('directlyServing').innerHTML = 'Serving ' + servingText + '<br>&nbsp;';
            if (nearbyText != '') {
                document.getElementById('nearbyServing').innerHTML = 'Nearby connections to ' + nearbyText + '<br>&nbsp;';
            } else {
                document.getElementById('nearbyServing').innerHTML = '&nbsp;<br>&nbsp;';
            }
        }, 1000);
    }, 100);
};

// GOOD SOURCES
// http://stackoverflow.com/questions/30093786/jquery-how-to-automatically-insert-colon-after-entering-2-numeric-digits
// http://www.d3noob.org/2013/01/format-date-time-axis-with-specified.html
//
