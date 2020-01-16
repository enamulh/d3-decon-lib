var $ = require('jQuery');
var _ = require('lodash');

var sylvester = require('../lib/sylvester-node.js');
var html2canvas = require('../lib/html2canvas.min.js');


var CircularJSON = require('circular-json');


var rgbcolor = require('../lib/rgbcolor.js');
var chroma = require('../lib/color/chroma.js');


var stackBlur = require('../lib/StackBlur.js');
var canvgVar = require('../lib/canvg.js');

var savesvg = require('../lib/saveSvgAsPng.js');
var verbose = false;

/* Polyfill for node.getTransformToElement */
SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function(elem) {
    return elem.getScreenCTM().inverse().multiply(this.getScreenCTM());
};

var Deconstruction = require("./Deconstruction.js");
var MarkGroup = require("./MarkGroup.js");
var Mapping = require('./Mapping.js');

var d3;
if (typeof document !== 'undefined')
    d3 = require('../lib/d3-decon-fixed.min.js');
else
    d3 = require('d3');

var pageDeconstruct = function() {

    var svgNodes = $('svg');
    // console.log('svgnodes'+svgNodes.length);
    // console.log(svgNodes);
    var deconstructed = [];

    var iframe = $('iframe'); // or some other selector to get the iframe
    //console.log(iframe[0].src);
    for(var i=0;i<iframe.length;i++){

        try{
            //console.log('iframe source: '+iframe[i].src);

            var a = [];
            //saveDataToLocalStorage(iframe[i].src);
            //window.open(iframe[i].src.replace("https:","https:"));

            $.ajax({
                type: "POST",
                //url: "https://dry-island-89443.herokuapp.com/addURL/",
                url: "https://localhost:3000/addURL/",
                data: {
                    iframe_url: iframe[i].src,
                    original_url: window.location.href
                }
            }).done(function(o) {
                //console.log('iframe url saved');
            });
        }
        catch (e){console.log('error\n'+e);}

        function saveDataToLocalStorage(data)
        {
            var a = [];
            // Parse the serialized data back into an aray of objects
            if(localStorage.getItem('iframe')!=null){
                a = JSON.parse(localStorage.getItem('iframe'));
            }
            // Push the new data (whether it be an object or anything else) onto the array
            a.push(data);
            // Alert the array value
            // Re-serialize the array back into a string and store it in localStorage
            //console.log(JSON.stringify(a));
            localStorage.setItem('iframe', JSON.stringify(a));

        }

        /*
            $(document).ready(function() {
              $("#testFrame").load(function() {
                var doc = this.contentDocument || this.contentWindow.document;
                var target = doc.getElementById("target");
                target.innerHTML = "Found It!";
              });
            });
        */


        /*
            try{ //lets find the url if iframe contains svg.
              var iframesvg = $(iframe[i]).contents().find('svg');
              console.log(iframesvg);
              //svgNodes.push(iframesvg);

            }
            catch (e){console.log('error\n'+e);}
        */
    }


    $.each(svgNodes, function (i, svgNode) {
        // if(verbose){
        //   console.log(svgNode);
        // }


        var children = $(svgNode).find('*');
        var isD3Node = false;
        $.each(children, function (i, child) {


            if (child.__data__) {
                isD3Node = true;
                return false;
            }
        });

        if (isD3Node) {
            var canvas = getSVGAsImage(svgNode,i);

            var decon = deconstruct(svgNode,"pageDeconstruct");
            if(verbose){
                console.log('decon:');
                console.log(decon);
            }

            deconstructed.push(decon);
        }
        else{
            console.log('no d3 data');
        }
    });

    return deconstructed;
};

var getSVGAsImage = function(svgNode,i) {
    //canvg(document.getElementById('canvas'), svgNode);

    var bBox = svgNode.getBBox();

    //var svgString = getSVGString(svgNode);
    //svgString2Image( svgNode, svgString, bBox.width+10, bBox.height+10, 'png', save ); // passes Blob and filesize String to the callback
    //fix weird back fill

    d3.select(svgNode).selectAll("path").attr("fill", "none");
//fix no axes
    d3.select(svgNode).selectAll("path.domain").attr("stroke", "black");
//fix no tick
    d3.select(svgNode).selectAll(".tick line").attr("stroke", "black");

    savesvg.svgAsPngUri(svgNode, {}, function(dataURL) {
        save(dataURL);

    });


    function save( dataURL ){
        $.ajax({
            type: "POST",
            url: "https://localhost:3000/getScreenshot/",
            data: {
                vis_id: i,
                url: window.location.href,
                date: new Date().toUTCString(),
                imgBase64: dataURL
            }
        }).done(function(o) {
            console.log('saved');

        });
    }

    /* html2canvas(svgNode, {
       onrendered: function(canvas) {
         document.body.appendChild(canvas);

         //var dataURL = canvas.toDataURL();
         // here is the most important part because if you dont replace you will get a DOM 18 exception.
         var dataURL =  canvas.toDataURL("image/png");//.replace("image/png", "image/octet-stream");

         //window.location.href=dataURL; // it will save locally

         console.log(dataURL);
         $.ajax({
           type: "POST",
           url: "https://localhost:3000/getScreenshot/",
           data: {
             vis_id: i,
             url: window.location.href,
             imgBase64: dataURL
           }
         }).done(function(o) {
           console.log('saved');
           // If you want the file to be visible in the browser
           // - please modify the callback in javascript. All you
           // need is to return the url to the file, you just saved
           // and than put the image in your browser.
         });

         return dataURL;


       }
     });*/
}

// Below are the functions that handle actual exporting:
// getSVGString ( svgNode ) and svgString2Image( svgString, width, height, format, callback )
function getSVGString( svgNode ) {
    svgNode.setAttribute('xlink', 'https://www.w3.org/1999/xlink');
    var cssStyleText = getCSSStyles( svgNode );
    appendCSS( cssStyleText, svgNode );

    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgNode);
    svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
    svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix

    return svgString;

    function getCSSStyles( parentElement ) {
        var selectorTextArr = [];

        // Add Parent element Id and Classes to the list
        selectorTextArr.push( '#'+parentElement.id );
        for (var c = 0; c < parentElement.classList.length; c++)
            if ( !contains('.'+parentElement.classList[c], selectorTextArr) )
                selectorTextArr.push( '.'+parentElement.classList[c] );

        // Add Children element Ids and Classes to the list
        var nodes = parentElement.getElementsByTagName("*");
        for (var i = 0; i < nodes.length; i++) {
            var id = nodes[i].id;
            if ( !contains('#'+id, selectorTextArr) )
                selectorTextArr.push( '#'+id );

            var classes = nodes[i].classList;
            for (var c = 0; c < classes.length; c++)
                if ( !contains('.'+classes[c], selectorTextArr) )
                    selectorTextArr.push( '.'+classes[c] );
        }

        // Extract CSS Rules
        var extractedCSSText = "";
        for (var i = 0; i < document.styleSheets.length; i++) {
            var s = document.styleSheets[i];

            try {
                if(!s.cssRules) continue;
            } catch( e ) {
                if(e.name !== 'SecurityError') throw e; // for Firefox
                continue;
            }

            var cssRules = s.cssRules;
            for (var r = 0; r < cssRules.length; r++) {
                //if ( contains( cssRules[r].selectorText, selectorTextArr ) )
                if (includes(cssRules[r].selectorText, selectorTextArr)){
                    extractedCSSText += cssRules[r].cssText;
                }
            }
        }


        return extractedCSSText;

        function includes(str,arr) {
            if ("undefined" !== typeof str) {
                for (var q = 0; q < arr.length; q++) {
                    if (str.indexOf(arr[q]) !== -1) { return true; }
                }
            }
        }

        function contains(str,arr) {
            return arr.indexOf( str ) === -1 ? false : true;
        }

    }

    function appendCSS( cssText, element ) {
        var styleElement = document.createElement("style");
        styleElement.setAttribute("type","text/css");
        styleElement.innerHTML = cssText;
        var refNode = element.hasChildNodes() ? element.children[0] : null;
        element.insertBefore( styleElement, refNode );
    }
}
function svgString2Image( svgNode, svgString, width, height, format, callback ) {

    var format = format ? format : 'png';

    var imgsrc = 'data:image/svg+xml;base64,'+ btoa( unescape( encodeURIComponent( svgString ) ) ); // Convert SVG string to data URL

    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    /*
      canvg(document.getElementById('canvas'), svgNode.outerHTML);
      document.body.appendChild(canvas);
      if ( callback ) callback( canvas.toDataURL());
    */

    var image = new Image();
    image.onload = function() {
        context.clearRect ( 0, 0, width, height );
        context.drawImage(image, 0, 0, width, height);
        document.body.appendChild(canvas);

        if ( callback ) callback( canvas.toDataURL());
    };

    image.src = imgsrc;
}

var deconstruct = function(svgNode,text) {
    var marks = extractMarkData(svgNode);
    var labels = [];
    if(verbose){
        console.log('extracted marks:');
        console.log(marks);
    }

    var axes = extractAxes(svgNode);
    if(verbose) {
        console.log('axes:');
        console.log(axes);
    }
    var lineExpandedMarks = expandLines(marks);

    lineExpandedMarks.forEach(function(mark) {
        if (mark.data !== undefined) {
            mark.data.deconID = mark.deconID;
        }
        else{
            if (mark.attrs['shape'] === 'text') {
                labels.push(mark);
            }
        }
        if (mark.lineID !== undefined) {
            mark.data.lineID = mark.lineID;
        }
    });
    if(verbose){
        console.log('after line expanded marks:');
        console.log(lineExpandedMarks);
    }


    var grouped = groupMarks(lineExpandedMarks);
    if(verbose){
        console.log('grouped marks:');
        console.log(grouped);
        // for (var i = 0; i < grouped.length; ++i) {
        //   if(grouped[i].nodeType ==='linePoint')
        //        for(var k=0;k<grouped[i].attrs['xPosition'].length;k++)
        //         console.log(grouped[i].attrs['xPosition'][k]);
        // }
    }

    grouped.forEach(function(group) {
        group.mappings = extractMappings(group);
    });
    if(verbose){
        console.log('before recombine');
        console.log(CircularJSON.stringify(grouped));
    }
    grouped = recombineGroups(grouped);
    grouped = updateDerivedFields(grouped);

    if(verbose) {
        console.log('after dereived');
        console.log(grouped);
    }


    grouped.forEach(function(group) {
        group.mappings = extractMappings(group);
        for(var i=0; i<labels.length; i++){
            if(labels[i].axis=== undefined){
                if(group.name === 'xaxis-labels'){
                    if(labels[i].attrs.yPosition> group.attrs.yPosition[0]){
                        labels[i].axis = "xaxis";
                    }
                }
                if(group.name === 'yaxis-labels'){
                    if(labels[i].attrs.xPosition< group.attrs.xPosition[0]){
                        labels[i].axis = "yaxis";
                    }
                    else if(labels[i].attrs.xPosition> group.attrs.xPosition[0] && labels[i].attrs.xPosition< group.attrs.xPosition[0]+100){
                        labels[i].axis = "yaxis";
                    }

                }
            }
        }
    });

    if(verbose) {
        console.log("after extract mapping");
        console.log(grouped);
        console.log(grouped.mappings);
    }
    //console.log('background color:', $(svgNode).css("background-color"));
    /*    var background= getBackground($(svgNode));
        if(background) {
          $.ajax({
            type: "POST",
            //url: "https://dry-island-89443.herokuapp.com/addURL/",
            url: "https://localhost:3000/addbackground/",
            data: {
              url: window.location.href,
              background: background
            }
          }).done(function (o) {
            console.log('background saved');

          });
        }*/
    var svgSize = {
        "width": +$(svgNode).attr("width"),
        "height": +$(svgNode).attr("height"),
        "background": + getBackground($(svgNode))
    };
    //console.log('labels:', labels);

    var decon = new Deconstruction(labels, svgSize, grouped, marks, axes);
    decon = relateMappingRanges(decon);
    decon = matchDerived(decon);
    //console.log(CircularJSON.stringify(decon));
    return decon;
};


function getBackground(jqueryElement) {
    // Is current element's background color set?
    var color = jqueryElement.css("background-color");

    if (color !== 'rgba(0, 0, 0, 0)') {
        // if so then return that color
        return color;
    }

    // if not: are you at the body element?
    if (jqueryElement.is("body")) {
        // return known 'false' value
        return false;
    } else {
        // call getBackground with parent item
        return getBackground(jqueryElement.parent());
    }
}

var recombineGroups = function recombineGroups(groups) {
    var removed = 0;
    for (var i = 0; i < groups.length - removed; ++i) {
        var group1 = MarkGroup.fromJSON(groups[i]);

        for (var j = i+1; j < groups.length - removed; ++j) {
            var group2 = MarkGroup.fromJSON(groups[j]);
            if (i === j) continue;

            if (shouldCombine(group1, group2)) {
                //console.log("combining:", i, j);

                group1.addGroup(group2);
                groups.splice(j, 1);
                removed++;
            }
        }
    }
    return groups;
};

var shouldCombine = function shouldCombine(group1, group2) {
    var group1Data = _.keys(group1.data);
    var group2Data = _.keys(group2.data);
    var allDataFields = _.union(group1Data, group2Data);
    if (allDataFields.length > group1Data.length || group1Data.length !== group2Data.length) {
        return false;
    }

    if (group1.name || group2.name) {
        return false;
    }

    var equalMappings = true;
    for (var i = 0; i < group1.mappings.length; ++i) {
        var mapping1 = Mapping.fromJSON(group1.mappings[i]);
        if (mapping1.getData() === "deconID") continue;

        var foundEqual = false;
        for (var j = 0; j < group2.mappings.length; ++j) {
            var mapping2 = Mapping.fromJSON(group2.mappings[j]);
            if (mapping1.isEqualTo(mapping2)) {
                foundEqual = true;
            }
        }
        if (!foundEqual) equalMappings = false;

    }
    return equalMappings;
};

var matchDerived = function(decon) {
    return decon;
};

var updateDerivedFields = function(markGroups) {
    var orderingsFound = [];

    for (var i = 0; i < markGroups.length; ++i) {
        var markGroup = markGroups[i];
        var deconIDs = markGroup.data['deconID'];
        delete markGroup.data['deconID'];
        //markGroup.data['deconID' + i] = deconIDs;

        var attrs = ['xPosition', 'yPosition', 'width', 'height'];
        var prefix = '_deriv_';

        attrs.forEach(function(attr) {
            //We drop if all values aren't unique.
            //if (_.uniq(markGroup.attrs[attr]).length === markGroup.attrs[attr].length) {
            var ordering = _.map(markGroup.attrs[attr], function(attrVal, j) {
                return {val: attrVal, ord: j};
            });
            //var ordering = _.orderBy(markGroup.attrs[attr], function(attrVal) { return attrVal; });

            orderingsFound.push({group: markGroup, attr: attr, fieldName: prefix + attr + '_' + i,  ordering: ordering});

            ordering = _.sortBy(ordering, function(orderedVal) {return orderedVal.val;});
            ordering = _.map(ordering, function(orderedVal) {return orderedVal.ord;});
            markGroup.data[prefix + attr + '_' + i] = ordering;
            //}
        });

    }

    var orderingsByAttr = _.groupBy(orderingsFound, function(ordering) { return ordering.attr; });
    var attrs = _.keys(orderingsByAttr);
    attrs.forEach(function(attr) {
        var orderings = orderingsByAttr[attr];
        var orderingSets = [];

        for (var i = 0; i < orderings.length; ++i) {
            var ordering = orderings[i];
            var orderingSetFound = false;
            orderingSets.forEach(function(orderingSet) {
                if (sameOrdering(orderingSet[0].ordering, ordering.ordering)) {
                    orderingSet.push(ordering);
                }
            });

            if (!orderingSetFound) {
                orderingSets.push([ordering]);
            }
        }

        orderingSets.forEach(function(orderingSet) {
            var fieldName = orderingSet[0].fieldName;
            orderingSet.forEach(function(ordering) {
                var orderingData = ordering.group.data[ordering.fieldName];
                delete ordering.group.data[ordering.fieldName];
                ordering.group.data[fieldName] = orderingData;
                ordering.group.data = fixEmptyFields(ordering.group.data);
            });
        });
    });
    return markGroups;
};

var fixEmptyFields = function(obj) {
    var keys = _.keys(obj);
    var newObj = {};
    keys.forEach(function(key) {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    });
    return newObj;
};

var sameOrdering = function(ordering1, ordering2) {
    var ordering1Obj = {};
    ordering1.forEach(function(row) { ordering1Obj[row.ord] = Math.round(row.val); });
    var ordering2Obj = {};
    ordering2.forEach(function(row) { ordering2Obj[row.ord] = Math.round(row.val); });
    return _.isEqual(ordering1Obj, ordering2Obj);
};

var relateMappingRanges = function(decon) {
    var attrs = _.keys(decon.groups[0].attrs);
    var mappingSetsByAttr = {};

    attrs.forEach(function(attr) {
        var mappingsForAttr = decon.getAllMappingsForAttr(attr);
        var mappingSets = [];
        mappingsForAttr.forEach(function(mapping) {
            var mappingRange;
            if (mapping.type === "linear") {
                mappingRange = [mapping.params.attrMin, mapping.params.attrMax];
            }
            else if (mapping.type === "nominal") {
                mappingRange = _.values(mapping.params);
            }
            else {
                return;
            }

            if (mapping.data[0] === "tick") { return; }

            var mappingRef = {
                data: mapping.type === "linear" ? mapping.data[0] : mapping.data,
                attr: mapping.attr,
                type: mapping.type,
                range: mappingRange,
                groupID: _.indexOf(decon.groups, mapping.group)
            };

            var foundMappingSet = false;
            mappingSets.forEach(function(mappingSet) {
                if (belongsToSet(mappingRef, mappingSet)) {
                    updateMappingSetWithMapping(mappingRef, mappingSet);
                    foundMappingSet = true;
                }
            });
            if (!foundMappingSet) {
                mappingSets.push({
                    mappingRefs: [mappingRef],
                    attributes: _.clone(mappingRange),
                    type: mapping.type
                });
            }
        });
        mappingSetsByAttr[attr] = mappingSets;
        for (var i = 0; i < mappingSets.length; ++i) {
            var mappingSet = mappingSets[i];

            if (typeof mappingSet.attributes[0] !== 'number' || mappingSet.attributes.length > 2) continue;
            //
            //var maxRangeMappingRef = _.sortBy(mappingSet.mappingRefs, function(mapping) {
            //    return Math.abs(mapping.range[1] - mapping.range[0]);
            //});
            //maxRangeMappingRef = maxRangeMappingRef[0];
            //
            //var maxRangeMapping = MarkGroup.fromJSON(decon.groups[maxRangeMappingRef.groupID])
            //                               .getMapping(maxRangeMappingRef.data, maxRangeMappingRef.attr);
            //var maxMappingDataRange = [maxRangeMapping.invert(maxRangeMappingRef.range[0]), maxRangeMapping.invert(maxRangeMappingRef.range[1])];

            var minGroupDataVal = _.min(mappingSet.mappingRefs, function(mappingRef) {
                var group = decon.groups[mappingRef.groupID];
                return _.min(group.data[mappingRef.data]);
            });
            minGroupDataVal = _.min(decon.groups[minGroupDataVal.groupID].data[minGroupDataVal.data]);

            var maxGroupDataVal = _.max(mappingSet.mappingRefs, function(mappingRef) {
                var group = decon.groups[mappingRef.groupID];
                return _.max(group.data[mappingRef.data]);
            });
            maxGroupDataVal = _.max(decon.groups[maxGroupDataVal.groupID].data[maxGroupDataVal.data]);

            for (var j = 0; j < mappingSet.mappingRefs.length; ++j) {
                var mappingRef = mappingSet.mappingRefs[j];
                var mapping = decon.groups[mappingRef.groupID].getMapping(mappingRef.data, mappingRef.attr);
                //mapping.attrRange = _.clone(mappingSet.attributes);
                mapping.dataRange = [minGroupDataVal, maxGroupDataVal];
                mapping.attrRange = [mapping.map(minGroupDataVal), mapping.map(maxGroupDataVal)];
            }
        }
    });
    decon.mappingSets = mappingSetsByAttr;
    return decon;
};

var belongsToSet = function(mappingRef, mappingSet) {
    if (mappingRef.type === "linear" && mappingSet.type === "linear" && mappingRef.data !== "tick") {
        return rangeOverlaps(mappingSet.attributes, mappingRef.range);
    }
    else if (mappingRef.type === "nominal" && mappingSet.type === "nominal") {
        return _.intersection(_.values(mappingRef.params), mappingRef.range).length >= 1;
    }
    return false;
};

var rangeOverlaps = function(range1, range2) {
    var range1Min = _.min(range1) - 2;
    var range1Max = _.max(range1) + 2;
    var range2Min = _.min(range2);
    var range2Max = _.max(range2);

    var noOverlap = (range1Min <= range2Min && range1Max <= range2Min) || (range1Min >= range2Max && range1Max >= range2Max);
    return !noOverlap;
};

var updateMappingSetWithMapping = function(mappingRef, mappingSet) {
    if (mappingRef.type === "linear" && mappingRef.data[0] !== "tick") {
        if (mappingRef.range[0] < mappingSet.attributes[0]) {
            mappingSet.attributes[0] = mappingRef.range[0];
        }
        if (mappingRef.range[1] > mappingSet.attributes[1]) {
            mappingSet.attributes[1] = mappingRef.range[1];
        }
        mappingSet.mappingRefs.push(mappingRef);
    }
    else if (mappingRef.type === "nominal") {
        mappingSet.attributes = _.union(mappingSet.attributes, _.values(mappingRef.range));
        mappingSet.mappingRefs.push(mappingRef);
    }
};

var isDerived = function(fieldName) {
    var derivedRegex = /_deriv_*/;
    return fieldName.match(derivedRegex) || fieldName === 'lineID';
};

//group
var groupMarks = function(marks, callback) {
    var dataSchemas = [];
    function getSchemas(callback) {
        marks.forEach(function(mark) {
            var currSchema = _.keys(mark.data);

            // If there isn't a schema, we won't group it!
            if (_.isEqual(currSchema, [])) {
                //console.log('dont group', mark);
                return;
            }

            var foundSchema = false;
            //console.log(dataSchemas.length);
            for (var j = 0; j < dataSchemas.length; ++j) {
                var sameNodeType = (dataSchemas[j].nodeType === mark.attrs['shape']);
                var sameAxis = (dataSchemas[j].axis === mark.axis);
                //console.log(sameNodeType);
                //console.log(sameAxis);
                if (_.intersection(currSchema, dataSchemas[j].schema).length == currSchema.length
                    && sameNodeType && sameAxis) {
                    //if(!(dataSchemas[j].ids[dataSchemas[j].ids.length-1]!== mark.deconID && dataSchemas[j].nodeType==="linePoint")) {//[currSchema.ids.length-1]
                    //console.log('different id for linepoint:', mark, dataSchemas[j].ids[dataSchemas[j].ids.length - 1], mark.deconID);


                    foundSchema = true;
                    dataSchemas[j].ids.push(mark.deconID);
                    dataSchemas[j].nodeAttrs.push(mark.nodeAttrs);

                    // Not using _.each for this because there could be "length" data which
                    // would break underscore's ducktyping
                    for (var dataAttr in mark.data) {
                        if (mark.data.hasOwnProperty(dataAttr)) {
                            dataSchemas[j].data[dataAttr].push(mark.data[dataAttr]);
                        }
                    }

                    _.each(mark.attrs, function (val, attr) {
                        dataSchemas[j].attrs[attr].push(val);
                        if (dataSchemas[j].nodeType === 'linePoint' && attr === 'xPosition') {
                            //console.log(attr,val);
                            //console.log(dataSchemas[j].attrs[attr]);
                        }
                    });
                    //}
                    break;
                }
            }

            if (!foundSchema) {
                //console.log('schema not found');
                var newSchema = {
                    schema: currSchema,
                    nodeType: mark.attrs['shape'],
                    ids: [mark.deconID],
                    data: {},
                    attrs: {},
                    nodeAttrs: [mark.nodeAttrs],
                    isLine: mark.attrs['shape'] === 'linePoint'
                };

                if (mark.axis) {
                    newSchema.axis = mark.axis;
                    if (mark.attrs['shape'] === 'text') {
                        newSchema.name = mark.axis + '-labels';
                    }
                    else if (mark.attrs['shape'] === 'line') {
                        newSchema.name = mark.axis + '-ticks';
                    }
                    else if (mark.attrs['shape'] === 'linePoint') {
                        newSchema.name = mark.axis + '-line';
                    }
                    else if (mark.attrs['shape'] === 'path') {
                        newSchema.name = mark.axis + '-path';
                        if(verbose){
                            console.log('axis mark:'+mark.attrs['shape']);
                        }

                    }
                }

                for (var dataAttr in mark.data) {
                    if (mark.data.hasOwnProperty(dataAttr)) {
                        newSchema.data[dataAttr] = [mark.data[dataAttr]];
                    }
                }

                _.each(mark.attrs, function (val, attr) {
                    //if(attr==="fill") {
                    //console.log('not found schema: ',val, attr);
                    //}

                    //ENamul: this seems like a bug, why [val]?

                    //newSchema.attrs[attr] = [val];
                    if(newSchema.attrs[attr] !==undefined)
                        newSchema.attrs[attr].push(val);
                    else{
                        newSchema.attrs[attr] = [];
                        newSchema.attrs[attr].push(val);
                    }

                });
                if(newSchema.nodeType === 'linePoint'){
                    if(verbose) {
                        console.log('newSchema', mark);
                        console.log(newSchema);
                    }
                }


                dataSchemas.push(newSchema);
            }
        });
        callback(dataSchemas);
    }
    getSchemas(function (dataSchemas) {

        /*  for (var j = 0; j < dataSchemas.length; ++j) {
            if(dataSchemas[j].nodeType === 'linePoint'){
              for(var k=0;k<dataSchemas[j].attrs['xPosition'].length;k++)
                console.log(dataSchemas[j].attrs['xPosition'][k]);
            }
          }*/

    });

    return dataSchemas;



};

var expandLines = function(marks) {
    var removed = 0;
    for (var i = 0; i < marks.length - removed; ++i) {
        var mark = marks[i - removed];
        var lineData = getLineData(mark);

        if (lineData !== undefined) {
            marks.splice(i - removed, 1);
            removed++;
            var newMarks = getLinePoints(mark, lineData);
            Array.prototype.push.apply(marks, newMarks);
        }
    }
    return marks;
};

var arrayLikeObject = function(obj) {

    var length = 0;
    for (var attr in obj) {
        if (attr !== "length" && isNaN(+attr)) {
            return undefined;
        }
        ++length;
    }
    var array = [];
    for (var i = 0; i < length; ++i) {
        if (!obj.hasOwnProperty(i)) {
            return undefined;
        }
        else {
            array.push(obj[i]);
        }
    }

    return array;
};

var arrayLikeObject2 = function(obj) {
    var length = 0;
    for (var attr in obj) {
        if (attr !== "length" && isNaN(+attr)) {
            if(verbose) {
                console.log('undefined', attr);
            }
            //return undefined;
        }
        else{
            ++length;
        }

    }

    if(verbose){
        console.log('obj length', length);
    }

    var array = [];
    for (var i = 0; i < length; ++i) {
        if (!obj.hasOwnProperty(i)) {
            return undefined;
        }
        else {
            array.push(obj[i]);
        }
    }

    return array;
};
var getLinePoints = function(mark, lineData) {
    var linePointPositions = getLinePointPositions(mark);
    var linePoints = [];

    // If we have a basis line we should delete the irrelevant points
    if (lineData.array.length+2 === mark.node.animatedPathSegList.length) {
        linePointPositions.splice(1, 1);
        linePointPositions.splice(linePointPositions.length-2, 1);
    }

    lineData.array.forEach(function(arrayItem, j) {
        var ptData = {};

        if (typeof arrayItem === "object") {
            ptData = _.extend(ptData, arrayItem);
        }
        else {
            var type = typeof arrayItem;
            ptData[type] = arrayItem;
        }
        _.extend(ptData, lineData.other);

        var newMarkAttrs = _.extend({}, mark.attrs);
        newMarkAttrs['xPosition'] = linePointPositions[j].x;
        newMarkAttrs['yPosition'] = linePointPositions[j].y;
        newMarkAttrs['shape'] = 'linePoint';
        ptData['area'] = 'yes';

        var newMark = {
            data: ptData,
            attrs: newMarkAttrs,
            nodeAttrs: _.clone(mark.nodeAttrs),
            lineID: j,
            deconID: mark.deconID,
            axis: mark.axis
        };
        linePoints.push(newMark);
    });

    return linePoints;
};

var getLinePointPositions = function(mark) {
    var segs = mark.node.animatedPathSegList;
    if(segs._list) {
        var temp = [segs._list.length];
        for (var i = 0; i < segs._list.length; i++) {
            //console.log(segs._list[i]);
            temp[i] = {};
            if (segs._list[i]['x'] !== undefined) {
                temp[i].x = segs._list[i]['x'];
            }
            if (segs._list[i]['y'] !== undefined) {
                //console.log(segs._list[i]['y']);
                temp[i].y = segs._list[i]['y'];
            }
        }
        if (verbose) {
            //console.log('segs:');

        }
        segs = temp;
    }


    var currX;
    var currY;
    var linePointPositions = [];
    for (var i = 0; i < segs.length; ++i) {
        var seg = segs[i];
        if (seg.x !== undefined)
            currX = seg.x;
        if (seg.y !== undefined)
            currY = seg.y;

        var transformedPt = transformedPoint(currX, currY, mark.node);
        //console.log('transformed:', transformedPt);
        linePointPositions.push({
            x: transformedPt.x,
            y: transformedPt.y,
            pathSegType: seg.pathSegType,
            pathSegTypeAsLetter: seg.pathSegTypeAsLetter
        });
    }
    return linePointPositions;
};

var getLineData = function(mark) {
    var validLineArray = function(mark, dataArray) {


        var pathSegLength = mark.node.animatedPathSegList.length;
        if(isNaN(pathSegLength)){
            pathSegLength = mark.node.animatedPathSegList.numberOfItems;
        }

        if(verbose){
            console.log(pathSegLength, dataArray.length);
            //console.log(mark.node.animatedPathSegList.numberOfItems);
            //console.log(isNaN(mark.node.animatedPathSegList));
        }

        return pathSegLength === dataArray.length
            || pathSegLength === dataArray.length+2  // spline line?
            || pathSegLength === dataArray.length*2+1; // area
    };
    //console.log('get line data', mark);
    if (mark.attrs['shape'] === 'path') {
        var dataArray;
        var otherData = {};
        var coercedArray = arrayLikeObject(mark.data);
        var coercedArray2 = arrayLikeObject2 (mark.data);
        if(verbose){
            console.log('path data');
            console.log('mark data', mark.data);
            console.log('coerced Array', coercedArray);
            console.log('coerced Array2', coercedArray2);

        }
        if (mark.data instanceof Array && validLineArray(mark, mark.data)) {
            dataArray = _.clone(mark.data);
        }
        else if (coercedArray && validLineArray(mark, coercedArray)) {
            dataArray = _.clone(coercedArray);
        }
        else if (coercedArray2 && validLineArray(mark, coercedArray2)) {
            dataArray = _.clone(coercedArray2);
        }
        else if (mark.data instanceof Object) {
            for (var attr in mark.data) {

                /*if(verbose && !mark.axis){
                  console.log('path data attr');
                  console.log(attr,mark.data[attr]);
                }*/


                coercedArray = arrayLikeObject(mark.data[attr]);

                if (mark.data[attr] instanceof Array && validLineArray(mark, mark.data[attr])) {
                    dataArray = _.clone(mark.data[attr]);
                }
                else if (coercedArray && validLineArray(mark, coercedArray)) {
                    dataArray = _.clone(coercedArray);
                }
                else {
                    otherData[attr] = _.clone(mark.data[attr]);
                }
                /*if(verbose && !mark.axis){
                  console.log('mark data attr');
                  console.log(dataArray);
                  console.log(otherData);
                }*/
            }
        }

        if (dataArray !== undefined) {
            return {
                array: dataArray,
                other: otherData
            };
        }
    }

    return undefined;
};

var extractNodeAttrs = function(nodes) {
    var nodeAttrs = [];
    _.each(nodes, function(node) {
        var attrData = {};
        for (var i = 0; i < node.attributes.length; ++i) {
            var attr = node.attributes[i];
            attrData[attr.name] = attr.value;
        }
        attrData.text = $(node).text();
        nodeAttrs.push(attrData);
    });
    return nodeAttrs;
};

function extractMappings(schema) {

    var allMappings = extractNominalMappings(schema).concat(extractMultiLinearMappings(schema));
    return filterExtraMappings(allMappings);
}

/**
 * Given a schema object, returns a list of mappings between data and attribute values in the schema.
 * @param schema
 * @returns {Array}
 */
function extractNominalMappings (schema) {
    var nominalMappings = [];
    _.each(_.keys(schema.data), function (schemaItem) {
        var dataArray = schema.data[schemaItem];

        var attrNames = _.keys(schema.attrs);
        _.each(attrNames, function (attrName) {
            var attrArray = schema.attrs[attrName];
            var pairMapping = extractNominalMapping(schemaItem, attrName, dataArray, attrArray);
            nominalMappings = nominalMappings.concat(pairMapping);
        });
    });
    return nominalMappings;
}

/**
 * Given a data field and attribute name and value array, returns an array of
 * mappings between the field and attribute.
 * @param dataName
 * @param attrName
 * @param dataArray
 * @param attrArray
 * @returns {Array}
 */
function extractNominalMapping (dataName, attrName, dataArray, attrArray) {
    if(typeof attrArray[0] === "object") {
        /** @TODO Handle linear mappings on colors correctly. */
        /** @TODO Detect colors rather than all objects. */
        attrArray = _.map(attrArray, function(color) {return "rgb(" + color.r +
            "," + color.g + "," + color.b + ")"});
    }

    var mapping = {};
    _.each(dataArray, function(dataVal, i) {
        if (mapping.hasOwnProperty(dataVal)) {
            mapping[dataVal].push(attrArray[i]);
        }
        else {
            mapping[dataVal] = [attrArray[i]];
        }
    });

    for (var dataVal in mapping) {
        mapping[dataVal] = _.uniq(mapping[dataVal]);
        if (mapping[dataVal].length > 1) {
            return [];
        }
    }

    var mappedVals = _.flatten(_.values(mapping));

    // If multiple attr values are in the range, no one-to-one
    if (_.uniq(mappedVals).length <  mappedVals.length) {
        return [];
    }

    // If it is a trivial mapping, don't save it
    if (_.keys(mapping).length === 1) {
        return [];
    }

    _.each(_.keys(mapping), function(key) {
        mapping[key] = mapping[key][0];
    });

    return [{
        type: 'nominal',
        params: mapping,
        data: dataName,
        attr: attrName
    }];
}

function filterExtraMappings (schemaMappings) {

    var attrsWithLinearMapping = [];
    var attrsWithDerivedMapping = [];
    _.each(schemaMappings, function(schemaMapping) {
        if (schemaMapping.type === "linear") {
            attrsWithLinearMapping.push(schemaMapping.attr);
        }
        else if(schemaMapping.type === "derived") {
            attrsWithDerivedMapping.push(schemaMapping.attr);
        }
    });
    var removed = 0;
    var numMappings = schemaMappings.length;
    for(var ind = 0; ind < numMappings; ++ind) {
        var schemaMapping = Mapping.fromJSON(schemaMappings[ind-removed]);
        var hasLinear = attrsWithLinearMapping.indexOf(schemaMapping.attr) !== -1;
        var hasDerived = attrsWithDerivedMapping.indexOf(schemaMapping.attr) !== -1;
        if(schemaMapping.type === 'nominal' && (hasLinear || hasDerived)) {
            schemaMappings.splice(ind-removed, 1);
            removed++;
        }
        else if(schemaMapping.type === 'derived' && hasLinear) {
            schemaMappings.splice(ind-removed, 1);
            removed++;
        }
        else if(isDerived(schemaMapping.getData())) {
            var attr = schemaMapping.getData().match(/_deriv_(.+)_\d*/);
            attr = attr && attr.length > 1 ? attr[1] : null;

            if (schemaMapping.attr !== attr) {
                schemaMappings.splice(ind-removed, 1);
                removed++;
            }
        }
    }

    return schemaMappings;
}


function extractMultiLinearMappings(schema) {

    var numberFields = [];
    var numberAttrs = [];
    for (var field in schema.data) {
        if (typeof schema.data[field][0] === "number") {
            numberFields.push(field);
        }
    }
    for (var attr in schema.attrs) {
        if(attr==='fill'){//Enamul:trying to find linear mapping between colors and numbers
            numberAttrs.push(attr);
        }
        if (typeof schema.attrs[attr][0] === "number") {
            numberAttrs.push(attr);
        }
    }



    var allLinearMappings = [];

    _.each(numberAttrs, function(attr) {

        for (var i = 1; i <= 3; ++i) {
            var combinations = k_combinations(numberFields, i);
            var mappings = [];
            _.each(combinations, function(fieldSet) {
                var xMatData = [];
                for(var i = 0; i < schema.data[numberFields[0]].length; ++i) {
                    var row = [1];
                    for(var j = 0; j < fieldSet.length; ++j) {
                        var fieldName = fieldSet[j];
                        row.push(schema.data[fieldName][i]);
                    }
                    xMatData.push(row);
                }
                var xMatrix = sylvester.$M(xMatData);

                var err = 0;


                if(attr==='fill') {

                    var colorSpaces = ['rgb', 'hsl', 'lab'];
                    for(var cs = 0;cs<colorSpaces.length;cs++ ){
                        var colorVectorArray = new Array(3);
                        for (var c = 0; c < colorVectorArray.length; c++) {
                            colorVectorArray[c] = new Array();
                        }

                        for (var attrIndex = 0; attrIndex < schema.attrs[attr].length; attrIndex++) {
                            var color;
                            if (schema.attrs[attr][attrIndex] === 'none'){
                                //color = chroma('rgb(0,0,0)').rgb();
                                schema.attrs[attr][attrIndex] = 'rgb(0,0,0)';
                            }
                            //else{
                            if(cs ===1)
                                color = chroma(schema.attrs[attr][attrIndex]).rgb();
                            else if(cs ===2)
                                color = chroma(schema.attrs[attr][attrIndex]).hsl();
                            else
                                color = chroma(schema.attrs[attr][attrIndex]).lab();

                            //}

                            colorVectorArray[0].push(color[0]);
                            colorVectorArray[1].push(color[1]);
                            colorVectorArray[2].push(color[2]);


                            //console.warn(color);
                        }
                        //console.log(colorVectorArray);
                        for (var colorIndex = 0; colorIndex < colorVectorArray.length; colorIndex++) {
                            var yVector = sylvester.$V(colorVectorArray[colorIndex]);
                            var coeffs = findCoefficients(xMatrix, yVector);
                            if (coeffs) {
                                coeffs = coeffs.elements;
                                var currentError = findRSquaredError(xMatrix, yVector, coeffs);
                                if (currentError > err) err = currentError;
                            }
                        }
                        if (err > 0.999) break;
                    }
                }

                else{
                    var yVector = sylvester.$V(schema.attrs[attr]);
                    var coeffs = findCoefficients(xMatrix, yVector);
                    if (coeffs) {
                        coeffs = coeffs.elements;
                        err = findRSquaredError(xMatrix, yVector, coeffs);
                    }
                }

                // if(attr==='fill'){
                //   console.log('mapping color fill');
                // }
                // if(attr==='linePoint'){
                //   console.log(yVector);
                //   console.log(xMatrix);
                //
                //   console.log(coeffs);
                //   console.warn(err);
                // }


                if (err > 0.999) {


                    var attrMin = _.min(schema.attrs[attr]);
                    var attrMax = _.max(schema.attrs[attr]);
                    var mapping;
                    mapping = {
                        type: 'linear',
                        data: fieldSet.reverse(),
                        attr: attr,
                        params: {
                            attrMin: attrMin,
                            attrMax: attrMax,
                            coeffs: coeffs.reverse(),
                            err: err
                        }
                    };

                    if (_.filter(fieldSet, function(field) {return isDerived(field);}).length > 0) {
                        mapping.type = 'derived';
                    }

                    mappings.push(mapping);
                }

            });
            if (mappings.length > 0) {
                allLinearMappings.push.apply(allLinearMappings, mappings);
                break;
            }
        }
    });


    if (verbose){
        console.log('all linear mapping:');
        console.log(allLinearMappings);
    }


    return allLinearMappings;
}


function findRSquaredError(xMatrix, yVector, coeffs) {
    var squaredError = 0;
    var sumSquares = 0;

    var sum = yVector.elements.reduce(function(a, b) { return a + b });
    var yAvg = sum / yVector.elements.length;

    for (var i = 1; i < yVector.elements.length+1; ++i) {
        var pred = 0;
        for (var j = 1; j < xMatrix.cols()+1; ++j) {
            pred += xMatrix.e(i, j) * coeffs[j-1];
        }
        squaredError += (yVector.e(i) - pred) * (yVector.e(i) - pred);
        sumSquares += (yVector.e(i) - yAvg) * (yVector.e(i) - yAvg);
    }

    return 1 - (squaredError / sumSquares);
}

/**
 * K-combinations
 *
 * Get k-sized combinations of elements in a set.
 *
 * Usage:
 *   k_combinations(set, k)
 *
 * Parameters:
 *   set: Array of objects of any type. They are treated as unique.
 *   k: size of combinations to search for.
 *
 * Return:
 *   Array of found combinations, size of a combination is k.
 *
 * Examples:
 *
 *   k_combinations([1, 2, 3], 1)
 *   -> [[1], [2], [3]]
 *
 *   k_combinations([1, 2, 3], 2)
 *   -> [[1,2], [1,3], [2, 3]
 *
 *   k_combinations([1, 2, 3], 3)
 *   -> [[1, 2, 3]]
 *
 *   k_combinations([1, 2, 3], 4)
 *   -> []
 *
 *   k_combinations([1, 2, 3], 0)
 *   -> []
 *
 *   k_combinations([1, 2, 3], -1)
 *   -> []
 *
 *   k_combinations([], 0)
 *   -> []
 */
function k_combinations(set, k) {
    var i, j, combs, head, tailcombs;

    if (k > set.length || k <= 0) {
        return [];
    }

    if (k == set.length) {
        return [set];
    }

    if (k == 1) {
        combs = [];
        for (i = 0; i < set.length; i++) {
            combs.push([set[i]]);
        }
        return combs;
    }

    // Assert {1 < k < set.length}

    combs = [];
    for (i = 0; i < set.length - k + 1; i++) {
        head = set.slice(i, i+1);
        tailcombs = k_combinations(set.slice(i + 1), k - 1);
        for (j = 0; j < tailcombs.length; j++) {
            combs.push(head.concat(tailcombs[j]));
        }
    }
    return combs;
}

/**
 * Combinations
 *
 * Get all possible combinations of elements in a set.
 *
 * Usage:
 *   combinations(set)
 *
 * Examples:
 *
 *   combinations([1, 2, 3])
 *   -> [[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]
 *
 *   combinations([1])
 *   -> [[1]]
 */
function combinations(set) {
    var k, i, combs, k_combs;
    combs = [];

    // Calculate all non-empty k-combinations
    for (k = 1; k <= set.length; k++) {
        k_combs = k_combinations(set, k);
        for (i = 0; i < k_combs.length; i++) {
            combs.push(k_combs[i]);
        }
    }
    return combs;
}

function findCoefficients(xMatrix, yVector) {
    var xTrans = xMatrix.transpose();
    var inv = xTrans.multiply(xMatrix).inverse();
    if (inv) {
        return inv.multiply(xTrans).multiply(yVector);
    }
    return null;
}

function checkLine(data, attrs, nodeAttrs, node, id) {
    if (node.tagName.toLowerCase() !== "path") {
        return null;
    }


    var dataArray = [];
    var otherAttrs = {};
    if (data instanceof Array) {
        dataArray = data;
    }
    else if (data instanceof Object) {
        for (var attr in data) {
            if (data[attr] instanceof Array) {
                dataArray = data[attr];
            }
            else {
                otherAttrs[attr] = data[attr];
            }
        }
    }
    else {
        return null;
    }

    var segs = node.animatedPathSegList;
    if (segs.length === 0) {
        return undefined;
    }
    if (segs[0].pathSegType !== 2) {
        return undefined;
    }

    var lineLength = 0;
    var linePointPositions = [];
    var currX, currY;
    for (var i = 0; i < segs.length; ++i) {
        var seg = segs[i];
        if (seg.x !== undefined)
            currX = seg.x;
        if (seg.y !== undefined)
            currY = seg.y;

        var transformedPt = transformedPoint(currX, currY, node);
        linePointPositions.push({
            x: transformedPt.x,
            y: transformedPt.y
        });

        lineLength++;
    }

    var schema = [];
    var lineData = [];
    var lineAttrs = [];
    var lineIDs = [];
    var lineNodeAttrs = [];
    var lineCount = 0;

    if (dataArray && dataArray.length === 2*lineLength) {
        if (dataArray[0] instanceof Object) {
            schema = schema.concat(_.keys(dataArray[0]));
        }
        else {
            schema = schema.concat(typeof dataArray[0]);
        }
        schema = schema.concat(_.keys(otherAttrs));

        for (var k = 0; k < dataArray.length; ++k) {
            var areaDataRow = {};
            if (dataArray[0] instanceof Object) {
                areaDataRow = _.extend(areaDataRow, dataArray[k]);
            }
            else {
                areaDataRow = {dataType: dataArray[k]};
            }
            areaDataRow = _.extend(areaDataRow, otherAttrs);
            areaDataRow['lineID'] = lineCount;
            lineCount++;
            lineData[k] = areaDataRow;
            lineAttrs[k] = attrs;
            lineAttrs[k].xPosition = linePointPositions[k].x;
            lineAttrs[k].yPosition = linePointPositions[k].y;
            lineIDs.push(id);
            lineNodeAttrs.push(nodeAttrs);

            var svg = node.ownerSVGElement;
            var transform = node.getTransformToElement(svg);
            var pt = svg.createSVGPoint();
            pt.x = segs[k].x;
            pt.y = segs[k].y;
            pt = pt.matrixTransform(transform);
            lineAttrs[k]['xPosition'] = pt.x;
            lineAttrs[k]['yPosition'] = pt.y;
        }

        return {
            schema: schema,
            ids: lineIDs,
            data: lineData,
            attrs: lineAttrs,
            nodeAttrs: lineNodeAttrs,
            isLine: true,
            isArea: true
        }
    }

    if (dataArray && dataArray.length === lineLength) {
        var schema = [];
        if (dataArray[0] instanceof Object) {
            schema = schema.concat(_.keys(dataArray[0]));
        }
        else {
            schema = schema.concat(typeof dataArray[0]);
        }
        schema = schema.concat(_.keys(otherAttrs));
        var lineData = [];
        var lineAttrs = [];
        var lineIDs = [];
        var lineNodeAttrs = [];
        var lineCount = 0;

        for (var j = 0; j < dataArray.length; ++j) {
            var dataRow = {};
            if (dataArray[0] instanceof Object) {
                dataRow = _.extend(dataRow, dataArray[j]);
            }
            else {
                var dataType = typeof dataRow[0];
                dataRow = {dataType: dataArray[j]};
            }
            dataRow = _.extend(dataRow, otherAttrs);
            dataRow['lineID'] = lineCount;
            lineCount++;
            lineData[j] = dataRow;
            lineAttrs[j] = attrs;
            lineAttrs[j].xPosition = linePointPositions[j].x;
            lineAttrs[j].yPosition = linePointPositions[j].y;
            lineIDs.push(id);
            lineNodeAttrs.push(nodeAttrs);
        }

        _.each(segs, function(seg, ind) {
            var svg = node.ownerSVGElement;
            var transform = node.getTransformToElement(svg);
            var pt = svg.createSVGPoint();
            pt.x = seg.x;
            pt.y = seg.y;
            pt = pt.matrixTransform(transform);
            lineAttrs[ind]['xPosition'] = pt.x;
            lineAttrs[ind]['yPosition'] = pt.y;
        });

        return {
            schema: schema,
            ids: lineIDs,
            data: lineData,
            attrs: lineAttrs,
            nodeAttrs: lineNodeAttrs,
            isLine: true
        }
    }

    return null;

}

/**
 * Groups nodes by 'schema', the data type or set of data types contained in their D3-bound data.
 * @returns {Array} - Array of schemas, each containing a list of information about mark-generating SVG nodes
 * @param data
 * @param ids
 * @param attrs
 */
function schematize (data, ids, nodeInfo) {
    var dataSchemas = [];
    var attrs = nodeInfo.attrData;
    var nodeAttrs = nodeInfo.nodeAttrs;

    for (var i = 0; i < data.length; ++i) {

        var line = checkLine(data[i], nodeInfo.attrData[i],
            nodeInfo.nodeAttrs[i], nodeInfo.nodes[i], ids[i]);
        if (line) {
            Array.prototype.push.apply(data, line.data);
            Array.prototype.push.apply(ids, line.ids);
            Array.prototype.push.apply(nodeInfo.attrData, line.attrs);
            Array.prototype.push.apply(nodeInfo.nodeAttrs, line.nodeAttrs);
            _.each(line.ids, function(id, ind) {
                nodeInfo.nodes.push(nodeInfo.nodes[ind]);
            });
            continue;
        }


//        if (typeof data[i] === "object") {
//            data[i] = flattenObject(data[i]);
//        }
        var currSchema = _.keys(data[i]);

        var foundSchema = false;
        for (var j = 0; j < dataSchemas.length; ++j) {
            if (_.intersection(currSchema,dataSchemas[j].schema).length == currSchema.length
                && !dataSchemas[j].isLine
                && dataSchemas[j].nodeType === nodeInfo.attrData[i]['shape']) {
                foundSchema = true;
                dataSchemas[j].ids.push(ids[i]);
                dataSchemas[j].nodeAttrs.push(nodeAttrs[i]);

                // Not using _.each for this because there could be "length" data which
                // would break underscore's ducktyping
                for (var dataAttr in data[i]) {
                    if (data[i].hasOwnProperty(dataAttr)) {
                        dataSchemas[j].data[dataAttr].push(data[i][dataAttr]);
                    }
                }

                _.each(attrs[i], function(val, attr) {
                    dataSchemas[j].attrs[attr].push(val);
                });
                break;
            }
        }

        if (!foundSchema) {
            var newSchema = {
                schema: currSchema,
                nodeType: nodeInfo.attrData[i]['shape'],
                ids: [ids[i]],
                data: {},
                attrs: {},
                nodeAttrs: [nodeAttrs[i]],
                isLine: nodeInfo.attrData[i]['shape'] === 'linePoint'
            };

            for (var dataAttr in data[i]) {
                if (data[i].hasOwnProperty(dataAttr)) {
                    newSchema.data[dataAttr] = [data[i][dataAttr]];
                }
            }

            _.each(attrs[i], function(val, attr) {
                newSchema.attrs[attr] = [val];
            });

            dataSchemas.push(newSchema);
        }
    }

    return dataSchemas;
}

var getAxis = function(axisGroupNode) {

    var axisTickLines = $(axisGroupNode).find('line');
    var axisTickLabels = $(axisGroupNode).find('text');
    var subdivide = axisTickLabels.length < axisTickLines.length;
    var tickCount = axisTickLines.length;
    var exampleTick = d3.select(axisTickLines[0]);
    var tickSize = +exampleTick.attr('x2') + (+exampleTick.attr('y2'));

    var axisOrient = +exampleTick.attr("x2") === 0 ? "horizontal" : "vertical";
    var exampleLabel = d3.select(axisTickLabels[0]);
    if (axisOrient === "horizontal") {
        axisOrient = +exampleLabel.attr("y") > 0 ? "bottom" : "top";
    }
    else {
        axisOrient = +exampleLabel.attr("x") > 0 ? "right" : "left";
    }

    if (axisOrient === "left" || axisOrient === "top") {
        tickSize = -tickSize;
    }

    return d3.svg.axis()
        .scale(axisGroupNode.__chart__)
        .tickSubdivide(subdivide)
        .ticks(tickCount)
        .tickSize(tickSize)
        .orient(axisOrient);
};

var getAxisD4 = function(axisGroupNode) {

    var axisTickLines = $(axisGroupNode).find('line');
    var axisTickLabels = $(axisGroupNode).find('text');
    var subdivide = axisTickLabels.length < axisTickLines.length;
    var tickCount = axisTickLines.length;
    var exampleTick = d3.select(axisTickLines[0]);
    var tickSize = +exampleTick.attr('x2') + (+exampleTick.attr('y2'));

    var axisOrient = +exampleTick.attr("x2") === 0 ? "horizontal" : "vertical";
    var exampleLabel = d3.select(axisTickLabels[0]);
    if (axisOrient === "horizontal") {
        axisOrient = +exampleLabel.attr("y") > 0 ? "bottom" : "top";
    }
    else {
        axisOrient = +exampleLabel.attr("x") > 0 ? "right" : "left";
    }

    if (axisOrient === "left" || axisOrient === "top") {
        tickSize = -tickSize;
    }
    return axisOrient;
};
/**
 * Given a root SVG element, returns all of the mark generating SVG nodes
 * and their order in the DOM traversal ('id').
 * @param svgNode
 * @returns Array
 */
var extractMarkData = function(svgNode) {
    var svgChildren = $(svgNode).find('*');
    var marks = [];


    for (var i = 0; i < svgChildren.length; ++i) {
        var node = svgChildren[i];

        // Deal with axes, add data if they aren't data-bound.

        if(node.__axis){  //to handle axes in d4
            //console.log(node, node.__axis);
            var orient = getAxisD4(node);
            //console.log(orient);
            var axisOrientation = (orient === "left" || orient === "right") ? "yaxis" : "xaxis";
            var axisChildren = $(node).find('*');
            for (var j = 0; j < axisChildren.length; ++j) {
                var axisChild = axisChildren[j];
                axisChild.__axisMember__ = true;
                axisChild.__whichAxis__ = axisOrientation;
            }

        }
        if (node.__chart__ && !node.__axis__) { //in d3
            var axis = getAxis(node);
            var labels = $(node).find("text");
            var labelData = {};
            $.each(labels, function(i, label) {
                labelData[label.__data__] = label.textContent;
            });

            d3.select(node).call(axis);

            var newLabels = $(node).find("text");
            $.each(labels, function(i, label) {
                d3.select(label).text(labelData[label.__data__]);
            });
        }

        // We've found a data-bound axis.  Now let's separate the axis from the remainder of the deconstruction.
        if (node.__axis__) {
            var axisOrientation = (node.__axis__.orient === "left" || node.__axis__.orient === "right") ? "yaxis" : "xaxis";
            var axisChildren = $(node).find('*');
            for (var j = 0; j < axisChildren.length; ++j) {
                var axisChild = axisChildren[j];
                axisChild.__axisMember__ = true;
                axisChild.__whichAxis__ = axisOrientation;
            }
        }


        var mark = extractMarkDataFromNode(node, i);
        if (mark)
            marks.push(mark);

    }

    fixTypes(_.map(marks, function(mark) {return mark.data;}));
    // if(verbose)
    //   console.log(marks);
    return marks;
};

var extractAxes = function(svgNode) {
    var svgChildren = $(svgNode).find('*');
    var axes = [];

    for (var i = 0; i < svgChildren.length; ++i) {
        var node = svgChildren[i];

        // Deal with axes, add data if they aren't data-bound.
        // if(verbose) {
        //   console.log('Deal with axes');
        //   console.log(svgNode);
        //   console.log(node);
        //   console.log(node.__chart__, node.__axis__);
        //   console.log(node.__chart__, node.__axisBottom__, node.__axisLeft__);
        // }
        if (node.__chart__ && !node.__axis__) {

            var axis = getAxis(node);
            var labels = $(node).find("text");
            var labelData = {};
            $.each(labels, function (i, label) {
                labelData[label.__data__] = label.textContent;
            });

            d3.select(node).call(axis);

            var newLabels = $(node).find("text");
            $.each(labels, function (i, label) {
                d3.select(label).text(labelData[label.__data__]);
            });
        }

        // We've found a data-bound axis.  Now let's separate the axis from the remainder of the deconstruction.
        if (node.__axis__) {

            var axisOrientation = (node.__axis__.orient === "left" || node.__axis__.orient === "right") ? "yaxis" : "xaxis";
            node.__axis__.axis = axisOrientation;
            node.__axis__.scaleDomain = _.clone(node.__chart__.domain());

            var axisBoundingBox = transformedBoundingBox(node);
            var localScaleRange = node.__chart__.range();
            var axisTransform = node.getTransformToElement(node.ownerSVGElement);
            var axisZero = node.ownerSVGElement.createSVGPoint().matrixTransform(axisTransform);
            node.__axis__.offset = {
                x: axisZero.x,
                y: axisZero.y
            };

            if (localScaleRange.length > 2) {
                var axisOffset = axisOrientation === "xaxis" ? axisZero.x : axisZero.y;
                node.__axis__.scaleRange = _.map(localScaleRange, function(rangeVal) { return rangeVal + axisOffset; });
            }
            else if (axisOrientation === "xaxis") {
                node.__axis__.scaleRange = [localScaleRange[0] + axisZero.x, localScaleRange[1] + axisZero.x];
            }
            else if (axisOrientation === "yaxis") {
                node.__axis__.scaleRange = [localScaleRange[0] + axisZero.y, localScaleRange[1] + axisZero.y];
            }

            node.__axis__.boundingBox = axisBoundingBox;
            axes.push(node.__axis__);
        }
    }
    return axes;
};

var extractMarkDataFromNode = function(node, deconID) {
    /** List of tag names which generate marks in SVG and are accepted by our system. **/
    var markGeneratingTags = ["circle", "ellipse", "rect", "path", "polygon", "text", "line"];
    var isMarkGenerating = _.contains(markGeneratingTags, node.tagName.toLowerCase());
    if (isMarkGenerating) {
        var mark = {
            deconID: deconID,
            node: node,
            attrs: extractAttrsFromMark(node),
            nodeAttrs: extractNodeAttrsFromMark(node)
        };

        if (node.__axisMember__) {
            mark.axis = node.__whichAxis__;
        }

        // Extract data for marks that have data bound
        var data = node.__data__;
        // if(mark.attrs['shape']==='path'){
        //   console.log('pathdata', JSON.stringify(node),node.__data, data);
        // }

        if (data !== undefined) {
            if (typeof data === "object") {
                data = $.extend({}, data);
            }
            else if (typeof data === "number") {
                data = {number: data};
            }
            else {
                data = {string: data};
            }
        }
        //
        //if (node.tagName.toLowerCase() === "text" && data) {
        //    data.text = $(node).text();
        //}

        if (data !== undefined) {
            mark.data = data;
        }
        if (mark.attrs.shape === 'path') { //new: to recovre angle as mapping
            if(mark.data){
                if (mark.data.startAngle!==undefined && mark.data.endAngle!==undefined) {
                    mark.attrs.angle = Math.abs(mark.data.startAngle - mark.data.endAngle);
                    delete mark.data.startAngle;
                    delete mark.data.endAngle;
                }

            }
        }
    }

    return mark;
};

var extractAttrsFromMark = function(mark) {
    var attrs = extractStyle(mark);
    attrs.shape = mark.tagName;
    var boundingBox = transformedBoundingBox(mark);

    attrs.xPosition = boundingBox.x + (boundingBox.width / 2);
    attrs.yPosition = boundingBox.y + (boundingBox.height / 2);

    attrs.area = boundingBox.width * boundingBox.height;
    attrs.width = boundingBox.width;
    attrs.height = boundingBox.height;

    if (mark.tagName === "text") {
        attrs.text = $(mark).text();
    }
    else {
        attrs.text = "";
    }

    // TODO: FIXME
    attrs.rotation = 0;

    return fixTypes([attrs])[0];
};

/**
 * Extracts the style and positional properties for each of a list of nodes, placing each node's in
 * attributes in a Javascript object.
 * @param nodes
 * @returns {Array}
 */
function extractVisAttrs (nodes) {
    var visAttrData = [];

    for (var i = 0; i < nodes.length; ++i) {
        var node = nodes[i];
        var style = extractStyle(node);
        style.shape = node.tagName;

        var boundingBox = transformedBoundingBox(node);
        style.xPosition = boundingBox.x + (boundingBox.width / 2);
        style.yPosition = boundingBox.y + (boundingBox.height / 2);

        style.area = boundingBox.width * boundingBox.height;
        style.width = boundingBox.width;
        style.height = boundingBox.height;

        style.rotation = 0;

        visAttrData.push(style);
    }
    visAttrData = fixTypes(visAttrData);
    return visAttrData;
}

var extractNodeAttrsFromMark = function(markNode) {
    var attrData = {};
    for (var i = 0; i < markNode.attributes.length; ++i) {
        var attr = markNode.attributes[i];
        attrData[attr.name] = attr.value;
    }
    attrData.text = $(markNode).text();
    return attrData;
};

/**
 * All style and some data attributes are extracted as strings, though some are number data or
 * colors, a more complex type in reality.  This function parses those types and
 * replaces the strings with the appropriate data types.
 * @param objArray - Array of objects
 * @returns {*} - objArray object with updated data types
 */
function fixTypes (objArray) {

    var fieldType = {};
    var rgbRegex = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/;
    var object, property, rgbChannels;

    // Find the most specific type for each style attribute
    for (var i = 0; i < objArray.length; ++i) {
        object = objArray[i];
        if (typeof object !== "object") {
            continue;
        }

        for (property in object) {
            if (object.hasOwnProperty(property)) {
                if (object[property] instanceof Date) {
                    object[property] = object[property].getTime();
                }

                rgbChannels = rgbRegex.exec(object[property]);
                // If this is our first pass, set it to whatever we see
                if (!fieldType.hasOwnProperty(property)) {
                    if (!isNaN(+object[property]) && property !== "text") {
                        // This is a number
                        fieldType[property] = "number";
                    }
                    else if (rgbChannels) {
                        fieldType[property] = "color";
                    }
                    else {
                        fieldType[property] = "string";
                    }
                }
                // In the future, generalize to string if not all match number/color
                else {
                    if (fieldType[property] === "number" && isNaN(+object[property])) {
                        fieldType[property] = "string";
                    }
                    else if (fieldType[property] === "color" && !rgbChannels) {
                        fieldType[property] = "string";
                    }
                }
            }
        }
    }

    // Now based on the types found we need to change the JS datatypes as necessary
    for (var j = 0; j < objArray.length; ++j) {
        object = objArray[j];
        for (var attr in object) {
            if (object.hasOwnProperty(attr)) {
                if (fieldType[attr] === "number") {
                    object[attr] = +object[attr];
                }
                else if (fieldType[attr] === "color") {
                    rgbChannels = rgbRegex.exec(object[attr]);
                    /*
                     object[attr] = {
                     r: parseFloat(rgbChannels[1]),
                     g: parseFloat(rgbChannels[2]),
                     b: parseFloat(rgbChannels[3])
                     }
                     */
                    object[attr] = "rgb(" + rgbChannels[1] + "," + rgbChannels[2] + "," + rgbChannels[3] + ")";
                }
            }
        }
    }


    return objArray;
}

/**
 * Finds the CSS style properties for a DOM node.
 * @param domNode
 * @returns {{}}
 */
function extractStyle (domNode) {
    var style = window.getComputedStyle(domNode, null);
    var styleObject = {};

    for (var i = 0; i < style.length; ++i) {
        var prop = style[i];
        styleObject[prop] = style.getPropertyValue(prop);
    }

    // A little hack since SVG's default is to scale the stroke-width
    styleObject["vector-effect"] = "non-scaling-stroke";

    var filterAttrs = [
        "stroke",
        "fill",
        "font-family",
        "font-weight",
        "font-size",
        "stroke-width",
        "opacity",
        "fill-opacity"
    ];
    var filteredStyleObject = {};
    _.each(styleObject, function(val, key) {
        if (_.contains(filterAttrs, key)) {
            filteredStyleObject[key] = val;
        }
    });

    return filteredStyleObject;
}

function transformedBoundingBox(el, to) {
    var bb = el.getBBox();
    var svg = el.ownerSVGElement;
    if (!to) {
        to = svg;
    }
    var m = el.getTransformToElement(to);
    var pts = [svg.createSVGPoint(), svg.createSVGPoint(), svg.createSVGPoint(), svg.createSVGPoint()];
    pts[0].x = bb.x;
    pts[0].y = bb.y;
    pts[1].x = bb.x + bb.width;
    pts[1].y = bb.y;
    pts[2].x = bb.x + bb.width;
    pts[2].y = bb.y + bb.height;
    pts[3].x = bb.x;
    pts[3].y = bb.y + bb.height;

    var xMin = Infinity;
    var xMax = -Infinity;
    var yMin = Infinity;
    var yMax = -Infinity;

    for (var i = 0; i < pts.length; i++) {
        var pt = pts[i];
        pt = pt.matrixTransform(m);
        xMin = Math.min(xMin, pt.x);
        xMax = Math.max(xMax, pt.x);
        yMin = Math.min(yMin, pt.y);
        yMax = Math.max(yMax, pt.y);
    }
    bb.x = xMin;
    bb.width = xMax - xMin;
    bb.y = yMin;
    bb.height = yMax - yMin;
    return bb;
}

var transformedPoint = function(ptX, ptY, ptBaseElem, ptTargetElem) {
    var svg = ptBaseElem.ownerSVGElement;
    if (!ptTargetElem) {
        ptTargetElem = svg;
    }

    var m = ptBaseElem.getTransformToElement(ptTargetElem);
    var transformedPt = svg.createSVGPoint();
    transformedPt.x = ptX;
    transformedPt.y = ptY;
    return transformedPt.matrixTransform(m);
};

module.exports = {
    pageDeconstruct: pageDeconstruct,
    deconstruct: deconstruct,
    extractNodeAttrs: extractNodeAttrs,
    extractMappings: extractMappings,
    extractMultiLinearMappings: extractMultiLinearMappings,
    schematize: schematize,
    extractData: extractMarkData,
    extractVisAttrs: extractVisAttrs,
    extractStyle: extractStyle,
    isDerived: isDerived
};