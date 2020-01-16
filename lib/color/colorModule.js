/**
 * @fileoverview colorModule.js provides support for color based NL queries.
 */
'use strict';



                        
var eviza = eviza || {};

/**
 * @constructor
 */
eviza.ColorModule = function () {

};


// function to get the corresponding rgba value of a query color token
function getQueryColor(qToken) {
	   try {
			var qColor = chroma(qToken);
			return qColor;
		}
		catch(err) {
			//console.log('unknown color token');
			return null;
		}
}

function getMarkColor(mark) {
	try {
		var mColor = chroma.hex(mark);
		return mColor;
	
	}
	catch(err) {
	//	console.log('unknown color token');
		return null;	
	}

}






// return an associative array of query color and an array of viz mark colors from lowest to highest Euclidean distance
eviza.ColorModule.prototype.matchColors = function(qList, mList){  //is the color in the list?
	var finalDict = new Array();
	for (var i = 0; i < qList.length; i++ ){
			var qColor = getQueryColor(qList[i]);
			var colorDict = new Array();
			for (var j = 0; j < mList.length; j++) {
				var mColor = getMarkColor(mList[j]);
				var dist = deltaE94(qColor,mColor);
				//console.log('DIST', qColor, mColor, dist);
				colorDict.push({
			    	key:   mList[j],
			    	value: dist
				});
				
				
			}
			// sort colorDict
			colorDict.sort(function(a,b) {
			    return a.value - b.value;
			});

			finalDict.push({
				key: qList[i],
				value: colorDict
			});
	}
	// return final dict

	return finalDict;
}



//color differences between chroma.js colors
//the basic one.
function deltaE(c1,c2){
	var lab1 = c1.lab()
	var lab2 = c2.lab()
	var dL = lab1[0]-lab2[0]
	var da= lab1[1]-lab2[1]
	var db= lab1[2]-lab2[2]
	var dE = Math.sqrt(dL*dL+da*da+db*db)
	return dE
}

//A somewhat better one.
//But, note this is an asymmetric function, deltaE94(c1,c2) != deltaE94(c2,c1)
function deltaE94(c1,c2){  
	var lab1 = c1.lab()  //.lch() returns the wrong h
	var lab2 = c2.lab()
	var C1 = Math.sqrt(lab1[1]*lab1[1]+lab1[2]*lab1[2]) //sqrt(a*a+b*b)
	var C2 = Math.sqrt(lab2[1]*lab2[1]+lab2[2]*lab2[2]) //sqrt(a*a+b*b)
	var da= lab1[1]-lab2[1]
	var db= lab1[2]-lab2[2]
	var dC = C1-C2
	
	//various weights. There are also kL, kC, kH, but they are all 1.0
	var K1 = 0.045
	var K2 = 0.015
	var SL = 1
	var SC = 1+K1*C1  //note the dependency on C1 only
	var SH = 1+K2*C1
	//these factors are dV/SV, will distance them below
	var fdL = (lab1[0]-lab2[0])/SL
	var fdC = (C1-C2)/SC
	var fdH = Math.sqrt(da*da+db*db-(dC*dC))/SH
	var dE94 = Math.sqrt(fdL*fdL + fdC*fdC + fdH*fdH)
	return dE94
	
}

