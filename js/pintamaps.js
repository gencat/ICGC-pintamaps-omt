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
mapboxgl.accessToken = 'pk.eyJ1IjoicmFmcm9zZXQiLCJhIjoiZW5HT0w2cyJ9.7S3z1vSbUQFJz1pSBKp0bg';
var map;
var mapStyle = {};
var socInici = true;
var pattern_map = false;
jQuery(document).ready(function() {

	var estil = '/pintamaps/styles/style_icgc_default.json';

	if (jQuery.url('?style')) {
		estil = '/pintaservice/styles/users/' + jQuery.url('?style') + ".json";
	}

	processaEstil(estil, true);

}); // fi inici

function processaEstil(estil, nouMapa) {

	$.getJSON(estil).done(function(nou_estil, textStatus) {

		if (nouMapa) {

			mapStyle = nou_estil;

			creaMapa(mapStyle.mapa);
		} else {

			mapStyle = nou_estil;

			actualitzaMapa(mapStyle.mapa, false);

		}

	}).fail(function(jqxhr, settings, exception) {
		alert("Fitxer no carregat");
		console.warn(exception);

	});

}

function actualitzaMapa(mapa, aplicaZoom) {
	socInici = true;

	// if(aplicaZoom){
	map.setCenter([ parseFloat(mapa.center.lng).toFixed(4),
			parseFloat(mapa.center.lat).toFixed(4) ]);
	map.setZoom(mapa.zoom);
	map.setPitch(mapa.pitch);
	map.setBearing(mapa.bearing);
	// }

	// arriba amb pattern
	if (mapStyle.styles[7].pattern != "") {
		actDesMenuFonsMapa('textura');
		pattern_map = true;
		changePatternMapFons(7, mapStyle.styles[7].pattern);
	} else {
		actDesMenuFonsMapa('color');
		pattern_map = false;
	}

	$('#c_edi').colorpicker('setValue', mapStyle.styles[0].color);
	$('#c_illes').colorpicker('setValue', mapStyle.styles[1].color);
	$('#c_polurbans').colorpicker('setValue', mapStyle.styles[2].color);

	$('#c_car').colorpicker('setValue', mapStyle.styles[3].color);
	$('#c_bos').colorpicker('setValue', mapStyle.styles[4].color);
	$('#c_rocam').colorpicker('setValue', mapStyle.styles[5].color);
	$('#c_platges').colorpicker('setValue', mapStyle.styles[6].color);
	$('#c_fons').colorpicker('setValue', mapStyle.styles[7].color);
	$('#c_rius').colorpicker('setValue', mapStyle.styles[8].color);
	$('#c_aigues').colorpicker('setValue', mapStyle.styles[9].color);
	$('#c_ferrocarrils').colorpicker('setValue', mapStyle.styles[10].color);
	$('#c_carrers').colorpicker('setValue', mapStyle.styles[11].color);
	$('#c_camins').colorpicker('setValue', mapStyle.styles[12].color);
	jQuery('#chk_toponims').attr('checked', mapStyle.estatToponimia);
	changeTopoLayer(mapStyle.estatToponimia);
	changeFontText(mapStyle.fontFamily);

	// setStylesMap();
}

function randomizeColor() {

	$('#c_edi').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_illes').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_polurbans').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_car').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_bos').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_rocam').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_platges').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_fons').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_rius').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_aigues').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_ferrocarrils').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_carrers').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	$('#c_camins').colorpicker('setValue',
			chroma.random().alpha(Math.random().toFixed(2)).css());
	jQuery('#chk_toponims').attr('checked', false);
	changeTopoLayer(false);
}

function creaMapa(mapa) {

	if (mapa) {

		map = new mapboxgl.Map({
			container : 'map',
			center : mapa.center,
			zoom : mapa.zoom,
			pitch : mapa.pitch, // pitch in degrees
			bearing : mapa.bearing,
			minZoom : 7,
			hash : false,
			style : styleGL
		});

	} else {
		map = new mapboxgl.Map({
			container : 'map',
			center : [ 2.0644, 41.4670 ],
			zoom : 14,
			pitch : 0, // pitch in degrees
			minZoom : 7,
			bearing : 0,
			hash : false,
			style : styleGL
		});

	}

	map.off('style.error', map.onError);
	map.off('source.error', map.onError);
	map.off('tile.error', map.onError);
	map.addControl(new mapboxgl.Navigation());

	var controldiv = document
			.getElementsByClassName("mapboxgl-ctrl-bottom-right")[0];
	var zoom = document.createElement("div");
	zoom.setAttribute("class", "control-zoom");
	controldiv.appendChild(zoom);
	map.on('moveend', function() {
		zoom.innerHTML = "ZL: " + map.getZoom().toFixed(1) + " | ";
	});

	jQuery('.mapboxgl-ctrl-top-right div:first')
			.append(
					'<button id="bt_pitch" title="Perspectiva" class="mapboxgl-ctrl-icon glyphicon glyphicon-road"></button>');
	preparaColorCapes();
	preparaControlCerca();
	setupEventsButtons();
	addDropFileOptions();
	preparaFormPrint();

}

var options = {
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

function actDesMenuFonsMapa(_text) {
	if (_text.indexOf('textura') != -1) {
		jQuery('#c_fons').hide();
		jQuery('#t_fons').show();
		pattern_map = true;
	} else {
		jQuery('#c_fons').show();
		jQuery('#t_fons').hide();
		pattern_map = false;
		$('#c_fons').colorpicker('setValue', mapStyle.styles[7].color);

	}
}

function setupEventsButtons() {

	jQuery('#ul_fonsmap li').on('click', function() {

		var _li = this.id;
		actDesMenuFonsMapa(_li);

	});
	
	jQuery('#ul_topomap li').on('click', function() {

		var _li = this.id;
		_li=_li.replace("li_","");
		
		changeFontText(_li);

	});
	
	
	

	jQuery('#t_fons div').on('click', function(e) {

		var pattern = this.id;
		pattern_map = true;
		changePatternMapFons(7, this.id);

	});

	jQuery('#bt_pitch').on('click', function() {
		var pitch = parseInt(map.getPitch());
		pitch == 60 ? pitch = 0 : pitch = pitch + 30;
		map.easeTo({
			'pitch' : pitch
		});

	});

	jQuery('#bt_export').on('click', function() {

		mapStyle.mapa.center.lng = map.getCenter().lng;
		mapStyle.mapa.center.lat = map.getCenter().lat;
		mapStyle.mapa.zoom = map.getZoom();
		mapStyle.mapa.pitch = map.getPitch();
		mapStyle.mapa.bearing = map.getBearing();

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

	jQuery('#bt_capture').on('click', function() {
		$('#md_print').modal({
			show : true
		});
	});

	jQuery('#chk_toponims').on('click', function() {

		var actiu = this.checked;

		changeTopoLayer(actiu);

	});

}

function preparaControlCerca() {

	var select = SelectMunicipis.createSelect();
	jQuery('#barraCerca').append(select);
	$(select).addClass("selectpicker").selectpicker({
		liveSearch : true
	});

}

function changeTopoLayer(actiu) {
	for (i = 0; i < styleGL.layers.length; i++) {
		var tema = styleGL.layers[i].id;

		if (tema.indexOf('toponim') != -1) {

			if (actiu) {
				map.setLayoutProperty(tema, 'visibility', 'visible');
				styleGL.layers[i].layout.visibility = 'visible';
			} else {
				map.setLayoutProperty(tema, 'visibility', 'none');
				styleGL.layers[i].layout.visibility = 'none';

			}

		}

	}

	mapStyle.estatToponimia = actiu;
}

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
function addDropFileOptions() {

	var opcionsBoto = drOpcionsMapa;
	opcionsBoto.clickable = true;

	if (drgFromBoto == null) {
		drgFromBoto = new window.Dropzone("#div_upload_estil", opcionsBoto);
		drgFromBoto.on("addedfile", function(file, xhr) {
			drgFromBoto.uploadFile(drgFromBoto.files[0]);
			;
		});
		drgFromBoto.on('success', function(file, resposta) {
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
			;
		});
		drgFromMapa.on('success', function(file, resposta) {
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

function setStylesMap() {

	var ls = mapStyle.styles.length

	for (var v = 0; v < ls; v++) {
		changeColorLayer(null, v);

	}

}



function changeFontText(font){
	
	//toponimia_cap#toponimia_nucli", 'text-color',10
	//"text-font" : ["Open Sans Regular","Arial Unicode MS Regular"],
	var layers = "toponimia_";
	var nomsCapes = layers.split('#');
	var tipusGeometria = "text-font";

	for (var i = 0; i < styleGL.layers.length; i++) {
		var tema = styleGL.layers[i].id;

		for (var j = 0; j < nomsCapes.length; j++) {
			if (tema.indexOf(nomsCapes[j]) != -1) {
				var arrTXT=map.getLayoutProperty(tema, tipusGeometria);
				
				if(arrTXT[0].indexOf(font)==-1){
				
						if(arrTXT[0].indexOf("Open Sans")!=-1){arrTXT[0]=arrTXT[0].replace("Open Sans",font);
							
						}else if(arrTXT[0].indexOf("Merriweather")!=-1){arrTXT[0]=arrTXT[0].replace("Merriweather",font);
							
							
						}else if(arrTXT[0].indexOf("Roboto")!=-1){arrTXT[0]=arrTXT[0].replace("Roboto",font);}
																	
						map.setLayoutProperty(tema, tipusGeometria, arrTXT);
						styleGL.layers[i].layout[tipusGeometria] = arrTXT
						mapStyle.fontFamily = font;
						break;
				}
			}
		}

	} // fi
	
}

function changePatternMapFons(index, pattern) {

	if (pattern == false) {
		pattern = "";
	}

	var fons = mapStyle.styles[index].layers;

	var tipusGeometria = "background-pattern";

	for (var i = 0; i < styleGL.layers.length; i++) {
		var tema = styleGL.layers[i].id;

		if (tema.indexOf(fons) != -1) {

			styleGL.layers[i].paint[tipusGeometria] = pattern;

		
			
			mapStyle.styles[index].pattern = pattern;
			map.setPaintProperty(tema, tipusGeometria, pattern);
			map.repaint;
			 break;
		}

	} // fi

}

function changeColorLayer(event, index) {

	var colorRGBA;
	var layers = mapStyle.styles[index].layers;
	var nomsCapes = layers.split('#');
	var tipusGeometria = mapStyle.styles[index].properties;

	for (var i = 0; i < styleGL.layers.length; i++) {
		var tema = styleGL.layers[i].id;

		for (var j = 0; j < nomsCapes.length; j++) {
			if (tema.indexOf(nomsCapes[j]) != -1) {

				if (event) {
					colorRGBA = 'rgba(' + event.color.toRGB().r + ','
							+ event.color.toRGB().g + ','
							+ event.color.toRGB().b + ','
							+ event.color.toRGB().a + ')'
				} else {
					colorRGBA = mapStyle.styles[index].color;
				}

				map.setPaintProperty(tema, tipusGeometria, colorRGBA);
				styleGL.layers[i].paint[tipusGeometria] = colorRGBA
				mapStyle.styles[index].color = colorRGBA;
				break;
			}
		}

	} // fi

}

function preparaColorCapes() {
	socInici = true;
	// Edificacions

	$.extend(options, {
		color : mapStyle.styles[0].color
	});

	$('#c_edi').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 0)
				}
				;
			});

	// Illes
	$.extend(options, {
		color : mapStyle.styles[1].color
	});
	$('#c_illes').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 1)
				}
				;
			});

	// Polígons urbans buffer
	$.extend(options, {
		color : mapStyle.styles[2].color
	});

	$('#c_polurbans').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 2)
				}
				;
			});

	// Carreteres
	$.extend(options, {
		color : mapStyle.styles[3].color
	});
	$('#c_car').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 3)
				}
				;
			});

	// Vegetació
	$.extend(options, {
		color : mapStyle.styles[4].color
	});
	$('#c_bos').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 4)
				}
				;
			});

	// Rocam
	$.extend(options, {
		color : mapStyle.styles[5].color
	});
	$('#c_rocam').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 5)
				}
				;
			});

	// Platges
	$.extend(options, {
		color : mapStyle.styles[6].color
	});

	$('#c_platges').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 6)
				}
				;

			});

	// Fons
	$.extend(options, {
		color : mapStyle.styles[7].color
	});

	$('#c_fons').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					if (!pattern_map) {
						changeColorLayer(event, 7);
						changePatternMapFons(7, false);
					}
				}
				;
			});

	// Rius
	$.extend(options, {
		color : mapStyle.styles[8].color
	});

	$('#c_rius').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 8)
				}
				;
			});

	// Masses d'aigua
	$.extend(options, {
		color : mapStyle.styles[9].color
	});

	$('#c_aigues').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 9)
				}
				;
			});

	// Toponimia
	/*
	 * $.extend(options, {color:mapStyle.styles[10]});
	 * $('#c_toponimia').colorpicker(options).on('changeColor.colorpicker',
	 * function(event){ if(socInici){changeColorLayer(event,
	 * "toponimia_cap#toponimia_nucli", 'text-color',10); });
	 */
	// Ferrocarrils
	$.extend(options, {
		color : mapStyle.styles[10].color
	});
	$('#c_ferrocarrils').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 10)
				}
				;

			});

	// Carrers
	$.extend(options, {
		color : mapStyle.styles[11].color
	});
	$('#c_carrers').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 11)
				}
				;
			});

	// Camins i corriols
	$.extend(options, {
		color : mapStyle.styles[12].color
	});
	$('#c_camins').colorpicker(options).on('changeColor.colorpicker',
			function(event) {
				if (socInici) {
					changeColorLayer(event, 12)
				}
				;
			});

	// console.info(mapStyle.styles[10]);
	jQuery('#chk_toponims').attr('checked', mapStyle.estatToponimia);
	
	
	
	
	jQuery('#bt_random').on('click',randomizeColor);

}

// functions print
var maxSize;
if (map) {
	var canvas = map.getCanvas();
	var gl = canvas.getContext('experimental-webgl');
	maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
}

var errors = {
	width : {
		state : false,
		msg : 'Amplada ha de ser un número positiu!',
		grp : 'widthGroup'
	},
	height : {
		state : false,
		grp : 'heightGroup'
	},
	dpi : {
		state : false,
		msg : 'DPI ha de ser un número positiu!',
		grp : 'dpiGroup'
	}
};

function handleErrors() {
	'use strict';
	var errorMsgElem = document.getElementById('error-message');
	var anError = false;
	var errorMsg;
	for ( var e in errors) {
		e = errors[e];
		if (e.state) {
			if (anError) {
				errorMsg += ' ' + e.msg;
			} else {
				errorMsg = e.msg;
				anError = true;
			}
			document.getElementById(e.grp).classList.add('has-error');
		} else {
			document.getElementById(e.grp).classList.remove('has-error');
		}
	}
	if (anError) {
		errorMsgElem.innerHTML = errorMsg;
		errorMsgElem.style.display = 'block';
	} else {
		errorMsgElem.style.display = 'none';
	}
}

function isError() {
	'use strict';
	for ( var e in errors) {
		if (errors[e].state) {
			return true;
		}
	}
	return false;
}

function preparaFormPrint() {

	jQuery('#widthInput')
			.on(
					'change',
					function(e) {

						
						'use strict';
						var val = Number(e.target.value);
						var dpi = Number(jQuery('#dpiInput').val());
						if (val > 0) {
							if (val * dpi > maxSize) {
								errors.width.state = true;
								errors.width.msg = 'El valor màxim de l´amplada és '
										+ maxSize
										+ 'px, però l´amplada entrada és '
										+ (val * dpi) + 'px.';
							} else if (val * window.devicePixelRatio * 96 > maxSize) {
								errors.width.state = true;
								errors.width.msg = 'l´amplada és massa gran!';
							} else {
								errors.width.state = false;
								// document.getElementById('map').style.width =
								// toPixels(val);
								// map.resize();
							}
						} else {
							errors.width.state = true;
							errors.height.msg = 'l´amplada ha de ser un número positiu!';
						}
						handleErrors();
					});

	jQuery('#heightInput')
			.on(
					'change',
					function(e) {
						// form.heightInput.addEventListener('change',
						// function(e) {
						'use strict';

						var val = Number(e.target.value);

						var dpi = Number(jQuery('#dpiInput').val());

						if (val > 0) {
							if (val * dpi > maxSize) {
								errors.height.state = true;
								errors.height.msg = 'El valor màxim de l´alçada és '
										+ maxSize
										+ 'px, però l´alçada entrada és '
										+ (val * dpi) + 'px.';
							} else if (val * window.devicePixelRatio * 96 > maxSize) {
								errors.height.state = true;
								errors.height.msg = 'l´alçada és massa gran!';
							} else {
								errors.height.state = false;
								// document.getElementById('map').style.height =
								// toPixels(val);
								// map.resize();
							}
						} else {
							errors.height.state = true;
							errors.height.msg = 'l´alçada ha de ser un número positiu!';
						}
						handleErrors();
					});

	jQuery('#dpiInput').on('change', function(e) {
		// form.dpiInput.addEventListener('change', function(e) {
		'use strict';
		var val = Number(e.target.value);
		if (val > 0) {
			errors.dpi.state = false;
			var event = document.createEvent('HTMLEvents');
			// event.initEvent('change', true, true);
			// form.widthInput.dispatchEvent(event);
			// form.heightInput.dispatchEvent(event);
		} else {
			errors.dpi.state = true;
		}
		handleErrors();
	});

	jQuery('#mmUnit').on('change', function(e) {

		jQuery('#widthInput').val(jQuery('#widthInput').val() * 25.4);
		jQuery('#heightInput').val(jQuery('#heightInput').val() * 25.4);
	});

	jQuery('#inUnit').on('change', function(e) {
		// form.inUnit.addEventListener('change', function() {
		'use strict';
		jQuery('#widthInput').val(jQuery('#widthInput').val() / 25.4);
		jQuery('#heightInput').val(jQuery('#heightInput').val() / 25.4);
	});

	/*
	 * if($('input[name=unitOptions]:checked', '#config').val()=='mm'){
	 * 
	 * jQuery('#widthInput').val(jQuery('#widthInput').val() *25.4) ;
	 * jQuery('#heightInput').val(jQuery('#heightInput').val() * 25.4) ; }
	 */
	/*
	 * if (jQuery('#unitOptions').val() == 'mm') { jQuery('#widthInput').val() *=
	 * 25.4; jQuery('#heightInput').val() *= 25.4; }
	 */

}

function toPixels(length) {
	'use strict';
	var unit = $('input[name=unitOptions]:checked', '#config').val();
	var conversionFactor = 96;
	if (unit == 'mm') {
		conversionFactor /= 25.4;
	}

	return conversionFactor * length + 'px';
}

jQuery('#generate-btn').on('click', generateMap);

// document.getElementById('generate-btn').addEventListener('click',
// generateMap);

function generateMap() {
	'use strict';

	if (isError()) {
		openErrorModal('Configuració invàlida.');
		return;
	}

	document.getElementById('spinner').style.display = 'inline-block';
	document.getElementById('generate-btn').classList.add('disabled');

	var width = Number(jQuery('#widthInput').val());
	var height = Number(jQuery('#heightInput').val());

	var dpi = Number(jQuery('#dpiInput').val());

	var format = $('input[name=outputOptions]:checked', '#config').val();

	var unit = $('input[name=unitOptions]:checked', '#config').val();

	var zoom = map.getZoom();
	var center = map.getCenter();
	var bearing = map.getBearing();

	createPrintMap(width, height, dpi, format, unit, zoom, center, bearing);
}

function createPrintMap(width, height, dpi, format, unit, zoom, center, bearing) {
	'use strict';

	// Calculate pixel ratio

	/*
	 * console.info(width); console.info(height); console.info(dpi);
	 * console.info(format); console.info(unit); console.info(zoom);
	 * console.info(center); console.info( bearing);
	 */

	var actualPixelRatio = window.devicePixelRatio;
	Object.defineProperty(window, 'devicePixelRatio', {
		get : function() {
			return dpi / 96
		}
	});

	// Create map container
	var hidden = document.createElement('div');
	hidden.className = 'hidden-map';
	document.body.appendChild(hidden);
	var container = document.createElement('div');
	container.style.width = toPixels(width);
	container.style.height = toPixels(height);

	// console.info( container.style.width);
	// console.info( container.style.height);

	hidden.appendChild(container);

	// Render map
	var renderMap = new mapboxgl.Map({
		container : container,
		center : center,
		zoom : zoom,
		style : styleGL,
		bearing : bearing,
		interactive : false,
		attributionControl : false
	});
	renderMap.once('load', function() {
		if (format == 'png') {
			renderMap.getCanvas().toBlob(function(blob) {
				saveAs(blob, 'captura_mapa.png');
			});
		} else {
			var pdf = new jsPDF({
				orientation : width > height ? 'l' : 'p',
				unit : unit,
				format : [ width, height ],
				compress : true
			});

			pdf.addImage(renderMap.getCanvas().toDataURL('image/jpeg', 0.95),
					'jpeg', 0, 0, width, height);
			pdf.save('captura_mapa.pdf');
		}

		renderMap.remove();
		hidden.parentNode.removeChild(hidden);
		Object.defineProperty(window, 'devicePixelRatio', {
			get : function() {
				return actualPixelRatio
			}
		});
		document.getElementById('spinner').style.display = 'none';
		document.getElementById('generate-btn').classList.remove('disabled');
	});
}

// Funcions captura tecles
var keys = [];

window.executeHotkeyTest = function(callback, keyValues) {
	if (typeof callback !== "function")
		throw new TypeError("Expected callback as first argument");
	if (typeof keyValues !== "object"
			&& (!Array.isArray || Array.isArray(keyValues)))
		throw new TypeError("Expected array as second argument");

	var allKeysValid = true;

	for (var i = 0; i < keyValues.length; ++i)
		allKeysValid = allKeysValid && keys[keyValues[i]];

	if (allKeysValid)
		callback();
};

window.addGlobalHotkey = function(callback, keyValues) {
	if (typeof keyValues === "number")
		keyValues = [ keyValues ];

	var fnc = function(cb, val) {
		return function(e) {
			keys[e.keyCode] = true;
			executeHotkeyTest(cb, val);
		};
	}(callback, keyValues);
	window.addEventListener('keydown', fnc);
	return fnc;
};

window.addEventListener('keyup', function(e) {
	keys[e.keyCode] = false;
});

addGlobalHotkey(function() {

	randomizeColor();

}, [ 17, 13 ]);
