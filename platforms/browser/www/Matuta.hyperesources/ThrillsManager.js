
//constants
//{xmin:0,ymin:0,xmax:0,ymax:0,group:1}
"use strict"

var Thrills_ISDEBUG = false;
var Thrills_MIN_DELTA = 0.0001;
var Thrills_MIN_DRAWING_DELTA = 0.003;
var Thrills_CONST_EPSILON = 0.001;
var Thrills_DELTA_TIME = 1000 / 30;
var Thrills_AIR_COEFFICIENT = 0.2;
var Thrills_PIXELS_PER_METER = 15;

var Thrills_GROUND_HEIGHT = 535;

//variables
var Thrills_Canvas;
var Thrills_Context;
var Thrills_Points;
var Thrills_Cameras;
var Thrills_Spline;
var Thrills_Weights;
var Thrills_TotalLength;
var Thrills_Start;
var Thrills_End;
var Thrills_CartImage;
var Thrills_CartStart;
var Thrills_CartEnd;
var Thrills_Interval;

var Thrills_Velocity;
var Thrills_Distance;
var Thrills_EnergyLost;
var Thrills_tCart;

var Thrills_TotalEnergy;
var Thrills_WasLastSimGood;//-1 too slow 1 too fast 0 just right

var Thrills_Average;
var Thrills_TargetPoint = 1;
var Thrills_RCSound;
var Thrills_AudioInterval;
var Thrills_LengthDisplay;

//public methods
function Thrills_Init_Coaster(imgUrl,lengthDisplay) {
	Thrills_CartImage = new Image();
	Thrills_CartImage.src = imgUrl;
	
	Thrills_RCSound = document.getElementById("RCSound"); 
	Thrills_LengthDisplay = lengthDisplay;
}

function Thrills_Set_Data(canvas, points, cameras) {
	Thrills_LengthDisplay.innerHTML = "";	
	Thrills_Cameras = cameras;
	Thrills_Canvas = canvas;
	Thrills_Context = canvas.getContext('2d');
	Thrills_Points = points;
	Thrills_Weights = [];
	Thrills_Average = [];
	for (var i = 0; i < Thrills_Points.length; i++) {
		Thrills_Weights[i] = [0.5, 0.5];
		if (Thrills_Average[Thrills_Points[i].group] == null) {
			Thrills_Average[Thrills_Points[i].group] = Thrills_GetGroupAverage(Thrills_Points[i].group);
		}
	}
	//Thrills_CreateSpline();
	//Thrills_RedrawEverything();

	if (Thrills_ISDEBUG) {
		Thrills_Canvas.style.border = "1px solid #000000";
	}

	Thrills_OnSpinnerChange();
}

function Thrills_StopEverything() {
	Thrills_StopAnimation();
	Thrills_Context.clearRect(0, 0, Thrills_Canvas.width, Thrills_Canvas.height);
}

function Thrills_SetGroup(group, value, axis) {
	for (var i = 0; i < Thrills_Points.length; i++) {
		if (Thrills_Points[i].group == group) {
			Thrills_Weights[i][axis] = value;
		}
	}
}

function Thrills_RedrawEverything() {
	Thrills_Context.clearRect(0, 0, Thrills_Canvas.width, Thrills_Canvas.height);

	Thrills_DrawSpline();
	Thrills_DrawCartAt(Thrills_CartStart);
}

function Thrills_StartAnimation() {
	Thrills_StopAnimation();

	var p0 = Thrills_Spline.calcAt(Thrills_CartStart - Thrills_MIN_DELTA);
	var p1 = Thrills_Spline.calcAt(Thrills_CartStart);
	var angle = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
	Thrills_Velocity = Math.cos(angle) * 10 * Thrills_DELTA_TIME / 1000;

	Thrills_Distance = 0;
	Thrills_EnergyLost = 0;
	Thrills_tCart = Thrills_CartStart;
	Thrills_WasLastSimGood = 0;

	for (var c = 0; c < Thrills_Cameras.length; c++) {
		Thrills_Cameras[c].actual = "-";
	}
	
	if (Thrills_AudioInterval) {
		clearInterval(Thrills_AudioInterval);
		Thrills_AudioInterval = null;
	}
  	Thrills_RCSound.currentTime = 0;
	Thrills_RCSound.volume=1;
	Thrills_RCSound.play();
	Thrills_Interval = setInterval(Thrills_RunAnimation, Thrills_DELTA_TIME);
}

function Thrills_StopAnimation() {
	if (Thrills_Interval) {
		clearInterval(Thrills_Interval);
		Thrills_Interval = null;
	}
	if (!Thrills_RCSound.paused && Thrills_AudioInterval == null){
		Thrills_AudioInterval = setInterval (Thrills_MuteSound,Thrills_DELTA_TIME);
	}
}


//private methods
function Thrills_MuteSound(){
	Thrills_RCSound.volume-=0.03;
	if (Thrills_RCSound.volume<0.03){
		clearInterval(Thrills_AudioInterval);
		Thrills_AudioInterval = null;
		Thrills_RCSound.pause();
	}
}

function Thrills_GetGroupAverage(group) {
	var avg = { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };
	var count = 0;
	for (var i = 0; i < Thrills_Points.length; i++) {
		if (Thrills_Points[i].group == group) {
			count++;
			avg.xmin += Thrills_Points[i].xmin;
			avg.ymin += Thrills_Points[i].ymin;
			avg.xmax += Thrills_Points[i].xmax;
			avg.ymax += Thrills_Points[i].ymax;
		}
	}

	avg.xmin /= count;
	avg.ymin /= count;
	avg.xmax /= count;
	avg.ymax /= count;
	return avg;
}

function Thrills_CreateSpline() {
	var points = [];
	for (var i = 0; i < Thrills_Points.length; i++) {
		points[i] =
		[
			Thrills_Points[i].xmin + (Thrills_Points[i].xmax - Thrills_Points[i].xmin) * Thrills_Weights[i][0],
			Thrills_Points[i].ymin + (Thrills_Points[i].ymax - Thrills_Points[i].ymin) * Thrills_Weights[i][1],
		]
	}
	Thrills_Spline = new BSpline(points, 3);

	//move cameras above points
	for (var i = 0; i < Thrills_Cameras.length; i++) {
		var point = points[Thrills_Cameras[i].point];
		Thrills_Cameras[i].pointCoords = point;
		Thrills_Cameras[i].dist = Number.MAX_VALUE;
		var camObj = Thrills_hypeDocument.getElementById(Thrills_Cameras[i].name);
		if (camObj == null) {
			console.error("Missing camera ", Thrills_Cameras[i].name);
			continue;
		}
		camObj.style.left = (point[0] + 5) + "px";
		camObj.style.top = (point[1] - 100) + "px";
	}

	Thrills_TotalLength = 0;
	Thrills_Start = 0;
	Thrills_End = 0;
	
	var prevp = Thrills_Spline.calcAt(0);
    for (var t = Thrills_MIN_DELTA; t <= 1; t += Thrills_MIN_DRAWING_DELTA) {
		var p = Thrills_Spline.calcAt(t);
		var delta = Math.sqrt(Math.pow(p[0] - prevp[0], 2) + Math.pow(p[1] - prevp[1], 2));
		Thrills_TotalLength += delta;
		if (Thrills_TotalLength < Thrills_CONST_EPSILON) {
			Thrills_Start = t;
		} else {
			if (Thrills_End < Thrills_CONST_EPSILON && delta < Thrills_CONST_EPSILON) {
				Thrills_End = t - Thrills_MIN_DELTA;
			}
		}

		for (var i = 0; i < Thrills_Cameras.length; i++) {
			var dist = Math.pow(p[0] - Thrills_Cameras[i].pointCoords[0], 2) + Math.pow(p[1] - Thrills_Cameras[i].pointCoords[1], 2);
			if (Thrills_Cameras[i].dist > dist) {
				Thrills_Cameras[i].dist = dist;
				Thrills_Cameras[i].t = t;
			}
		}

		prevp = p;
	}

	prevp = Thrills_Spline.calcAt(0);
	var startHeight = 0;
    var minDist = Number.MAX_VALUE;

	for (t = Thrills_Start; t <= Thrills_End; t += Thrills_MIN_DELTA) {
		p = Thrills_Spline.calcAt(t);
		delta = Math.sqrt(Math.pow(p[0] - points[Thrills_TargetPoint][0], 2) + Math.pow(p[1] - points[Thrills_TargetPoint][1], 2));
		if (delta < minDist) {
			Thrills_CartStart = t;
			startHeight = p[1];
			minDist = delta;
		}
		prevp = p;
	}

	Thrills_TotalLength = 0;
	prevp = Thrills_Spline.calcAt(Thrills_CartStart);
	for (t = Thrills_CartStart+Thrills_MIN_DELTA; t <= Thrills_Cameras[Thrills_Cameras.length-1].t; t += Thrills_MIN_DELTA) {
		p = Thrills_Spline.calcAt(t);
		Thrills_TotalLength += Math.sqrt(Math.pow(p[0] - prevp[0], 2) + Math.pow(p[1] - prevp[1], 2));
		prevp = p;
	}

	Thrills_CartEnd = Thrills_End;
	p = Thrills_Spline.calcAt(Thrills_CartStart);
	Thrills_TotalEnergy = 5000 * 10 * (Thrills_GROUND_HEIGHT - p[1]) / Thrills_PIXELS_PER_METER;

	Thrills_LengthDisplay.innerHTML = (Math.round(Thrills_TotalLength/Thrills_PIXELS_PER_METER))+"m";	
}

function Thrills_DrawSpline() {
	Thrills_Context.save();
	Thrills_Context.lineWidth = 6;
	Thrills_Context.strokeStyle = "#FFF";
	var p = Thrills_Spline.calcAt(0);
	Thrills_Context.beginPath();
    Thrills_Context.moveTo(p[0], p[1]);
	for (var t = Thrills_Start; t <= Thrills_End; t += Thrills_MIN_DRAWING_DELTA) {
		p = Thrills_Spline.calcAt(t);
		Thrills_Context.lineTo(p[0], p[1]);
	}
    Thrills_Context.stroke();
	Thrills_Context.restore();

	if (Thrills_ISDEBUG) {
		Thrills_DrawPoints();
	}
}

function Thrills_DrawPoints() {
	Thrills_Context.save();
	Thrills_Context.strokeStyle = "#f00";
	for (var i = 0; i < Thrills_Points.length; i++) {
		Thrills_Context.beginPath();
		Thrills_Context.arc(Thrills_Points[i].xmin + (Thrills_Points[i].xmax - Thrills_Points[i].xmin) * Thrills_Weights[i][0],
			Thrills_Points[i].ymin + (Thrills_Points[i].ymax - Thrills_Points[i].ymin) * Thrills_Weights[i][1],
			10, 0, 2 * Math.PI);
		Thrills_Context.stroke();
	}
	Thrills_Context.restore();
}

function Thrills_DrawCartAt(t) {
	var angle;
	var p = Thrills_Spline.calcAt(t);
	var p0 = Thrills_Spline.calcAt(t - Thrills_MIN_DELTA);
	angle = Math.atan2(p[1] - p0[1], p[0] - p0[0]);
	Thrills_DrawCart(p, angle);

}

function Thrills_DrawCart(point, angle) {
	Thrills_Context.save();
	Thrills_Context.translate(point[0], point[1]);
	Thrills_Context.rotate(angle);
	Thrills_Context.translate(0, -3);
    Thrills_Context.drawImage(Thrills_CartImage, -Thrills_CartImage.width / 4, -Thrills_CartImage.height / 2, Thrills_CartImage.width / 2, Thrills_CartImage.height / 2);
	Thrills_Context.restore();
}

function Thrills_RunAnimation() {
	//advance on curve with current velocity
	var targetDist = Thrills_Velocity * Thrills_PIXELS_PER_METER * Thrills_DELTA_TIME / 1000;
	var crtDist = 0;
	var prevp = Thrills_Spline.calcAt(Thrills_tCart);
	var initCart = Thrills_tCart;
	var initX = prevp[0];
	var p = Thrills_Spline.calcAt(Thrills_tCart + Thrills_MIN_DELTA);
	var delta = Math.sqrt(Math.pow(p[0] - prevp[0], 2) + Math.pow(p[1] - prevp[1], 2));
    while (crtDist + delta < targetDist && Thrills_tCart + Thrills_MIN_DELTA < Thrills_CartEnd) {
		Thrills_tCart += Thrills_MIN_DELTA;
		crtDist += delta;
        prevp = p;
		p = Thrills_Spline.calcAt(Thrills_tCart);
		delta = Math.sqrt(Math.pow(p[0] - prevp[0], 2) + Math.pow(p[1] - prevp[1], 2));
	}
	
	var bigDelta = delta;
	var div = 1;
	var crtDiv = Thrills_MIN_DELTA;
	var prevDelta;
	prevp = Thrills_Spline.calcAt(Thrills_tCart);
	while (delta>(targetDist - crtDist) && div<1000){
		div++;
		crtDiv=(targetDist - crtDist) * crtDiv / delta;
		p = Thrills_Spline.calcAt(Thrills_tCart+ crtDiv);
		prevDelta = delta;
		delta = Math.sqrt(Math.pow(p[0] - prevp[0], 2) + Math.pow(p[1] - prevp[1], 2));
	}
	
	Thrills_tCart += crtDiv;
	Thrills_Distance += crtDist+delta;
	//console.log(Thrills_tCart,crtDiv,delta,prevDelta);
	/*if (delta != 0) {
		Thrills_tCart += (targetDist - crtDist) * Thrills_MIN_DELTA / delta;
		Thrills_Distance += targetDist;
	}*/
	prevp = p;
	p = Thrills_Spline.calcAt(Thrills_tCart);
	
	//check if camera covers trajectory
		
	for (var c = 0; c < Thrills_Cameras.length; c++) {
		if (Thrills_Cameras[c].t >= initCart && Thrills_Cameras[c].t < Thrills_tCart) {
			if (Thrills_Cameras[c].energyLost == -1){
				Thrills_Cameras[c].actual = Math.round(Thrills_Velocity*10)/10;
			}else{
				var theoreticTotalEnergy;
				if (Thrills_spinners.length>0){
					theoreticTotalEnergy = Thrills_spinners[0].value*10*5000;
				}else{
					theoreticTotalEnergy = Thrills_TotalEnergy; 
				}
				var theoreticPE;
				if (Thrills_Cameras[c].flatHeight!==-1){
					theoreticPE = 5000 * 10 * Thrills_Cameras[c].flatHeight;
				}else if (Thrills_Cameras[c].spinner!==-1){
					theoreticPE = 5000 * 10 * Thrills_spinners[Thrills_Cameras[c].spinner].value;				
				}else{					
					theoreticPE = 5000 * 10 * (Thrills_GROUND_HEIGHT - p[1]) / Thrills_PIXELS_PER_METER;
				}
				
				var theoreticEnergy = theoreticTotalEnergy * Thrills_Cameras[c].energyLost/100;
				var theoreticKE = theoreticEnergy - theoreticPE;
				Thrills_Cameras[c].actual =  Math.round(Math.sqrt(theoreticKE / (0.5 * 5000))*10)/10;
			}
			Thrills_hypeDocument.getSymbolInstanceById(Thrills_Cameras[c].name).startTimelineNamed("Flash", Thrills_hypeDocument.kDirectionForward);
			
		}
	}
				
	//calculate new velocity
	

	var potentialEnergy = 5000 * 10 * (Thrills_GROUND_HEIGHT - p[1]) / Thrills_PIXELS_PER_METER;
	var angle = Math.atan2(p[1] - prevp[1], p[0] - prevp[0]);
	var crtEnergyLost = 0.1 * 5000 * 10 * Math.cos(angle) * targetDist / Thrills_PIXELS_PER_METER;
	Thrills_EnergyLost += crtEnergyLost;

	var airResistance = Thrills_AIR_COEFFICIENT * Math.pow(Thrills_Velocity, 2) * targetDist;
	Thrills_EnergyLost += airResistance;

	var kineticEnergy = (Thrills_TotalEnergy - Thrills_EnergyLost) - potentialEnergy;

	if (kineticEnergy < 0) {
		Thrills_Velocity = 0;
	} else {
		Thrills_Velocity = Math.sqrt(kineticEnergy / (0.5 * 5000));
	}

	if (Thrills_tCart >= Thrills_CartEnd || Thrills_Velocity < Thrills_CONST_EPSILON || bigDelta == 0) {
		Thrills_StopAnimation();
		if (Thrills_Cameras[Thrills_Cameras.length-1].actual == "-") {
			Thrills_WasLastSimGood = -1;
		}else if (Thrills_Cameras[Thrills_Cameras.length-1].actual<=Thrills_Cameras[Thrills_Cameras.length-1].target){
			Thrills_WasLastSimGood = 0;
		}else{
			Thrills_WasLastSimGood = 1;
		}
		Thrills_ShowResult(Thrills_WasLastSimGood);
	} else {
		Thrills_Context.clearRect(0, 0, Thrills_Canvas.width, Thrills_Canvas.height);

		Thrills_DrawSpline();
		Thrills_DrawCartAt(Thrills_tCart);
	}
}