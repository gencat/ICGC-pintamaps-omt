/*
* PINTAMAPS v.0.0.1
* Desenvolupat per GEOSTART
* "Fet amb el millor gust possible"
* Institut Cartogràfic i Geològic de Catalunya (ICGC) Gener 2016
* CC-BY
* http://www.icgc.cat
* http://betaportal.icgc.cat
*/

// mapboxgl.accessToken = 'pk.your-own-code-here-for-online-maps';
//mapboxgl.accessToken = 'pk.eyJ1IjoicmFmcm9zZXQiLCJhIjoiZW5HT0w2cyJ9.7S3z1vSbUQFJz1pSBKp0bg';
var map;
var mapStyle = {};
var socInici = true;
var pattern_map = false;
var aplicaZoom=false;
var estil;

jQuery(document).ready(function() {
	estil = './styles/mtc25mnotopomaputnik_7.json';
	//estil = './styles/blavos.json';
	processaEstil(estil, true);
});
// fi inici

function crearColorsButtons(groups, estil){
	for (const key of Object.keys(groups)) {
		crearBotonColor(key, groups[key], estil);
    }
}

function crearBotonColor(id, obj, estil){
	let options = {
		customClass : 'colorpicker-2x',
		sliders : {
			saturation : {
				maxLeft : 150,
				maxTop : 150
			},
			hue : {
				maxTop : 150
			},
			alpha : {
				maxTop : 150
			}
		},
		align : 'left',
		format : 'rgba'
	};
	
	jQuery('<div class="btn-group"><div>'+obj.label+'</div><div id="'+id+'" class="input-group"><input type="text" value="" class="form-control" /> <span class="input-group-addon"><i></i></span></div></div><br>').appendTo('#llegenda');

	var element = obj.elements[0]; 
	color = getColorFromEstil(element.id, element.color, estil);

	$.extend(options, {
		color : color
	});

	$('#'+id).colorpicker(options).on('changeColor.colorpicker',
	function(event) {
		changeEstilColorGruop(event.target.id, event.color);
	});
}

function getColorFromEstil(id, path, estil){
	let layers = estil.layers;
	let obj = layers.find(o => o.id === id);
	let color = _.get(obj,path);
	return color;
}

function changeEstilColorGruop(id, color){
	var group = group_styles[id];
	let layers = mapStyle.layers;
	group.elements.forEach(element => {
		let obj = layers.find(o => o.id === element.id);
		_.set(obj, element.color, color.toString());
		var property = element.color.split(".").pop();
		map.setPaintProperty(element.id, property, color.toString());
	});
}

function updateBotonColors(estil, groups){
	let layers = estil.layers;
	for (const key of Object.keys(groups)) {
		let group = groups[key].elements[0];
		let color = getColorFromEstil(group.id,group.color,estil);
		$('#ul_fonsmap').colorpicker('setValue', color);
	}
}

function processaEstil(estil, nouMapa) {
	$.getJSON(estil).done(function(nou_estil, textStatus) {
		if (nouMapa) {
			mapStyle = nou_estil;
			creaMapa(mapStyle);
			crearColorsButtons(group_styles, mapStyle);
		} else {
			mapStyle = nou_estil;
			actualitzaMapa(mapStyle);
		}
	}).fail(function(jqxhr, settings, exception) {
		alert("Fitxer no carregat");
		console.warn(exception);
	});
}

function creaMapa(estil) {
	map = new mapboxgl.Map({
		container : 'map',
		minZoom : 7,
		maxZoom: 15.99,
		hash : true,
		style : estil
	});
	var nav = new mapboxgl.NavigationControl();
    map.addControl(nav, 'top-right');
    /*
    map.addControl(new MapboxInspect({
        showInspectMap: true
    }));
    */
    

	var controldiv = document.getElementsByClassName("mapboxgl-ctrl-bottom-right")[0];
	var zoom = document.createElement("div");
	zoom.setAttribute("class", "control-zoom");
	controldiv.appendChild(zoom);
	map.on('moveend', function() {
		zoom.innerHTML = "ZL: " + map.getZoom().toFixed(1) + " | ";
	});
	addControlsExternFunctionality();
	updateBotonColors(estil, group_styles);
}

function actualitzaMapa(estil){
	map.setStyle(estil,{diff: false});
	map.setCenter(estil.center);
	map.setZoom(estil.zoom);
	map.setPitch(estil.pitch);
	map.setBearing(estil.bearing);
    updateBotonColors(estil, group_styles);
}


function addControlsExternFunctionality(){
	jQuery('.mapboxgl-ctrl-top-right div:first').append(
		'<button id="bt_pitch" title="Perspectiva" class="mapboxgl-ctrl-icon glyphicon glyphicon-road"></button>');

	jQuery('#bt_pitch').on('click', function() {
		var pitch = parseInt(map.getPitch());
		pitch == 60 ? pitch = 0 : pitch = pitch + 30;
		map.easeTo({
			'pitch' : pitch
		});
	});

    jQuery('.mapboxgl-ctrl-top-right div:first').append(
		'<button id="bt_toponims" title="Toponims" class="mapboxgl-ctrl-icon glyphicon glyphicon-tag"></button>');

	jQuery('#bt_toponims').on('click', function() {
        var topomins_i = _.intersectionBy(mapStyle.layers, TOPO_FLOTANT, 'id');
        if(topomins_i.length === 0){
            mapStyle.layers = mapStyle.layers.concat(TOPO_FLOTANT);
        }else{
            _.pullAllBy(mapStyle.layers, TOPO_FLOTANT, 'id');
        }
        actualitzaMapa(mapStyle);
	});

	jQuery('#bt_export').on('click', function() {
		console.log(map.getStyle());
		mapStyle.center.lng = map.getCenter().lng;
		mapStyle.center.lat = map.getCenter().lat;
		mapStyle.zoom = map.getZoom();
		mapStyle.pitch = map.getPitch();
		mapStyle.bearing = map.getBearing();
		console.log(mapStyle);
		var msg = JSON.stringify(mapStyle);
		var data = "text/json;charset=utf-8," + encodeURIComponent(msg);
		var a = document.createElement('a');
		a.href = 'data:' + data;
		a.download = 'estil_mapa.json';
		a.title = 'Descarregar estil';
		a.className = 'verd glyphicon glyphicon-cloud-download';
		jQuery('#div_exportar').html(a);
		var container = document.getElementById('div_exportar');
		$('#md_export').modal({
			show : true
		});
	});

	jQuery('#bt_import').on('click', function() {
		$('#md_import').modal({
			show : true
		});
    });   

	addDropFileOptions();
}

function addDropFileOptions() {
	var drgFromMapa = null;
	var drgFromBoto = null;
	var drOpcionsMapa = {
		url : '/pintaservice/up.php',
		paramName : "file",
		maxFilesize : 1, // MB
		method : 'post',
		accept : function(file, done) {
		}
	};
	var opcionsBoto = drOpcionsMapa;
	opcionsBoto.clickable = true;
	if (drgFromBoto == null) {
		drgFromBoto = new window.Dropzone("#div_upload_estil", opcionsBoto);
		drgFromBoto.on("addedfile", function(file, xhr) {
			drgFromBoto.uploadFile(drgFromBoto.files[0]);
		});
		drgFromBoto.on('success', function(file, resposta) {
			console.log(file);
			console.log(resposta);
			drgFromBoto.removeAllFiles(true);
			resposta = JSON.parse(resposta);
			if (resposta.STATUS == "OK") {
				$('#md_import').modal('hide');
				processaEstil(resposta.STYLE, false);
			} else {
				$('#md_import').modal('hide');
				alert("Error al carregar l'arxiu");
			}
		});
		drgFromBoto.on('error', function(file, errorMessage) {
			drgFromBoto.removeAllFiles(true);
			$('#md_import').modal('hide');
			alert("Error al carregar l'arxiu");
		});
	}

	var opcionsMapa = drOpcionsMapa;
	opcionsMapa.clickable = false;
	if (drgFromMapa == null) {
		drgFromMapa = new window.Dropzone("#map", opcionsMapa);
		drgFromMapa.on("addedfile", function(file, xhr) {
			drgFromMapa.uploadFile(drgFromMapa.files[0]);
		});
		drgFromMapa.on('success', function(file, resposta) {
			var name=file.name;
			if(name.indexOf('goto')!=-1){
				aplicaZoom=true;
			}else{
				aplicaZoom=false;
			}
			drgFromMapa.removeAllFiles(true);
			resposta = JSON.parse(resposta);
			if (resposta.STATUS == "OK") {
				processaEstil(resposta.STYLE, false);
			} else {
				alert("Error al carregar l'arxiu");
			}
		});
		drgFromMapa.on('error', function(file, errorMessage) {
			drgFromMapa.removeAllFiles(true);
			alert("Error al carregar l'arxiu");
		});
	}
}