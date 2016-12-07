
var Thrills_hover;
var Thrills_hypeDocument;
var Thrills_spinners;
var Thrills_groups;
var Thrills_scene;
var Thrills_isShowingResults = false;

function Thrills_SceneInit(hypeDocument, spinners, groups) {
	Thrills_hypeDocument = hypeDocument;
	Thrills_groups = groups;

	Thrills_scene = hypeDocument.currentSceneName();

	Thrills_hover = [];

	if (spinners != null) {
		Thrills_spinners = spinners;

		for (var i = 0; i < spinners.length; i++) {
			var spinner = spinners[i];
			var spinnerElem = document.getElementById(spinner.name);
			spinnerElem.onchange = Thrills_OnSpinnerChange;
			spinnerElem.min = spinner.min;
			spinnerElem.max = spinner.max;
			spinnerElem.value = Math.round((spinner.min + spinner.max) / 2);
		}
	}
	var camInfo = hypeDocument.getSymbolInstanceById('CamSpeedDisplay');
	if (camInfo!=null){
		if (camInfo.isPlayingTimelineNamed("ShowCameraSpeed")){
			camInfo.pauseTimelineNamed("ShowCameraSpeed");
			camInfo.goToTimeInTimelineNamed(0, "ShowCameraSpeed");
		}
	}
	
	
	$(".clickThrough").css("pointer-events", "none");
	$(".valign").css("display", "");
}

function Thrills_Drag(hypeDocument, event, label, timeline, group) {
	if (Thrills_scene != hypeDocument.currentSceneName()) {
		return;
	}

	if (event.type == "mousemove" || event.type == "touchmove") {

		Thrills_StopAnimation();
		var percent = hypeDocument.currentTimeInTimelineNamed(timeline);

		for (var i = 0; i < Thrills_groups[group].length; i++) {
			var grouping = Thrills_groups[group][i];
			Thrills_SetGroup(grouping.group, percent, grouping.axis);
		}

		Thrills_CreateSpline();
		Thrills_RedrawEverything();

		if (Thrills_spinners != null) {
			for (var i = 0; i < Thrills_spinners.length; i++) {
				var spinner = Thrills_spinners[i];
				if (spinner.group == group) {
					var spinnerElem = document.getElementById(spinner.name);
					spinnerElem.value = spinner.min + Math.round(percent * (spinner.max - spinner.min));
					spinner.value = spinnerElem.value;
				}
			}
		}
	}

	if (event['hypeGesturePhase'] == hypeDocument.kHypeGesturePhaseStart) {
		label.startTimelineNamed('Push', hypeDocument.kDirectionForward);
		Thrills_HideResult();
		this.isDragging = true;
	}
	if (event['hypeGesturePhase'] == hypeDocument.kHypeGesturePhaseEnd || event['hypeGesturePhase'] == hypeDocument.kHypeGesturePhaseCancel) {
		if (Thrills_hover[group]) {
			label.startTimelineNamed('Hover', hypeDocument.kDirectionForward);
		} else {
			label.startTimelineNamed('Normal', hypeDocument.kDirectionForward);
		}
		this.isDragging = false;
	}

	if (event.type == "mouseover") {
		if (!this.isDragging) label.startTimelineNamed('Hover', hypeDocument.kDirectionForward);
		Thrills_hover[group] = true;
	}

	if (event.type == "mouseout") {
		if (!this.isDragging) label.startTimelineNamed('Normal', hypeDocument.kDirectionForward);
		Thrills_hover[group] = false;
	}
}

function Thrills_ShowResult(result) {

	var title = Thrills_hypeDocument.getElementById('SuccessTitle');
	var text = Thrills_hypeDocument.getElementById('SuccessBody');
	var replayButton = Thrills_hypeDocument.getElementById('SuccessReplayButton');
	var nextButton = Thrills_hypeDocument.getElementById('NextSymbolButton');

	if (Math.abs(result) < Thrills_CONST_EPSILON) {
		title.innerHTML = "Bem Feito!";
		if (Thrills_hypeDocument.currentSceneName().indexOf("L1") === 0){
			text.innerHTML = "Descobriste o quão alto tens que pôr cada secção da linha, de maneira a que a montanha-russa tenha a quantidade certa de energia, para completar a linha e acabar a uma velocidade segura. Bem feito!";
		}
		if (Thrills_hypeDocument.currentSceneName().indexOf("L2") === 0){
			text.innerHTML = "Encontraste a combinação perfeita entre o comprimento e altitude da linha que vai permitir a montanha-russa completar a sua viagem e acabar a uma velocidade segura. Bem feito!";
		}
		if (Thrills_hypeDocument.currentSceneName().indexOf("L3") === 0){
			text.innerHTML = "Calculaste a velocidade do comboio a cada fase e usaste isso para selecionar as alturas apropriadas para cada secção. A viagem vai ser muito divertida e segura. Excelente trabalho!";
		}
		replayButton.innerHTML = "Jogar Outra vez";
	} else {
		if (result > 0) {
			title.innerHTML = "Demasiado depressa!";
		} else {
			title.innerHTML = "Demasiado devagar!";
		}
		text.innerHTML = "Verifica as câmaras de velocidade e reconfigura a linha.";
		replayButton.innerHTML = "Tenta outra vez";
	}

	var scenePrefix = Thrills_hypeDocument.currentSceneName().substring(0, 3);
	var sceneNo = parseInt(Thrills_hypeDocument.currentSceneName().substring(3));
	var newScene = scenePrefix + (sceneNo + 1);
	if ($.inArray(newScene, Thrills_hypeDocument.sceneNames()) == -1) {
		nextButton.innerHTML = "Casa";
	} else {
		nextButton.innerHTML = "Próximo";
	}
	Thrills_hypeDocument.getSymbolInstanceById("SuccessDisplay").startTimelineNamed('ShowResult', Thrills_hypeDocument.kDirectionForward);
		Thrills_hypeDocument.startTimelineNamed("SuccessShow", Thrills_hypeDocument.kDirectionForward);

	Thrills_isShowingResults = true;
}

function Thrills_HideResult() {
	if (Thrills_isShowingResults) {
		var res = Thrills_hypeDocument.getSymbolInstanceById('SuccessDisplay');

		res.startTimelineNamed("HideResult", Thrills_hypeDocument.kDirectionForward);

		Thrills_hypeDocument.startTimelineNamed("SuccessHide", Thrills_hypeDocument.kDirectionForward);
		
		Thrills_RedrawEverything();

		Thrills_isShowingResults = false;
	}
}



function Thrills_OnSpinnerChange() {
	Thrills_HideResult();
	Thrills_StopAnimation();
	for (var i = 0; i < Thrills_spinners.length; i++) {
		var spinner = Thrills_spinners[i];
		var spinnerElem = document.getElementById(spinner.name);

		if (spinnerElem.value == null || spinnerElem.value.length === 0) {
			spinnerElem.value = Math.round((spinner.min + spinner.max) / 2);
		}
		if (spinnerElem.value < spinner.min) {
			spinnerElem.value = spinner.min;
		}
		if (spinnerElem.value > spinner.max) {
			spinnerElem.value = spinner.max;
		}

		var percent = (spinnerElem.value - spinner.min) / (spinner.max - spinner.min);

		for (var j = 0; j < Thrills_groups[spinner.group].length; j++) {
			var grouping = Thrills_groups[spinner.group][j];
			Thrills_SetGroup(grouping.group, percent, grouping.axis);
		}

		Thrills_spinners[i].value = spinnerElem.value;
		Thrills_hypeDocument.goToTimeInTimelineNamed(percent, spinner.timeline);
	}

	Thrills_CreateSpline();
	Thrills_RedrawEverything();
}