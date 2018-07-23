(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.GS = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
var v1 = require('./v1');
var v4 = require('./v4');

var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;

module.exports = uuid;

},{"./v1":4,"./v4":5}],2:[function(require,module,exports){
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  return bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

module.exports = bytesToUuid;

},{}],3:[function(require,module,exports){
// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection

// getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues.bind(crypto)) ||
                      (typeof(msCrypto) != 'undefined' && msCrypto.getRandomValues.bind(msCrypto));
if (getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

  module.exports = function whatwgRNG() {
    getRandomValues(rnds8);
    return rnds8;
  };
} else {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);

  module.exports = function mathRNG() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}

},{}],4:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

var _nodeId;
var _clockseq;

// Previous uuid creation time
var _lastMSecs = 0;
var _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};
  var node = options.node || _nodeId;
  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189
  if (node == null || clockseq == null) {
    var seedBytes = rng();
    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [
        seedBytes[0] | 0x01,
        seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]
      ];
    }
    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  }

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  for (var n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf ? buf : bytesToUuid(b);
}

module.exports = v1;

},{"./lib/bytesToUuid":2,"./lib/rng":3}],5:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid(rnds);
}

module.exports = v4;

},{"./lib/bytesToUuid":2,"./lib/rng":3}],6:[function(require,module,exports){
module.exports={
  "version": "0.0.1"
}
},{}],7:[function(require,module,exports){
//      
"use strict";

var version         = require("../package.json").version;
var Sidebar = require("./ui/sidebar");
var Input = require("./ui/input");
var RadioGroup = require("./ui/radioGroup");
var PrintControl = require("./ui/printControl");
var Button = require("./ui/button");

module.exports = {
	version: version,
	Sidebar: Sidebar,
	Input: Input,
	RadioGroup: RadioGroup,
	PrintControl: PrintControl,
	Button: Button
};

/**
 * The version of the project in use as specified in `package.json`,
 * `CHANGELOG.md`, and the GitHub release.
 *
 * @var {string} version
 */

},{"../package.json":6,"./ui/button":8,"./ui/input":12,"./ui/printControl":15,"./ui/radioGroup":16,"./ui/sidebar":18}],8:[function(require,module,exports){
//      
"use strict";

var Input = require("./input");

/**
 * Creates an HTML Button. Convenience class.
 *
 * @param {Object} inAttributes The button attributes
 * @example
 * var input = new Button();
 */
var Button = (function (Input) {
	function Button(inAttributes         ) {

		Input.call(this, "button", inAttributes);

	}

	if ( Input ) Button.__proto__ = Input;
	Button.prototype = Object.create( Input && Input.prototype );
	Button.prototype.constructor = Button;

	return Button;
}(Input));

module.exports = Button;

},{"./input":12}],9:[function(require,module,exports){
//      
"use strict";

var DomElement = require("./domElement");

/**
 * Creates an HTML Div. Convenience class.
 *
 * @param {Object} inAttributes The div attributes
 * @example
 * var input = new Input();
 */
var Div = (function (DomElement) {
	function Div(inAttributes         , shouldCreateId) {
		if ( shouldCreateId === void 0 ) shouldCreateId          = true;


		DomElement.call(this, "div", inAttributes, shouldCreateId);

	}

	if ( DomElement ) Div.__proto__ = DomElement;
	Div.prototype = Object.create( DomElement && DomElement.prototype );
	Div.prototype.constructor = Div;

	return Div;
}(DomElement));

module.exports = Div;

},{"./domElement":10}],10:[function(require,module,exports){
//      
"use strict";

var random = require("../utils/random");

/**
 * A DOMElement element that represents an HTML DOM element.
 *
 * @param {string} tag The element tag
 * @example
 * var div = new DOMElement("div");
 */
var DOMElement = function DOMElement(tag        , attributes         , shouldCreateId) {
	if ( shouldCreateId === void 0 ) shouldCreateId          = true;


	this.tag = tag;
	this.content = "";
	this.setAttributes(attributes, shouldCreateId);

};

/**
	 * Set the input attributes
	 *
	 * @param {Object} attributes
	 * @returns {DOMElement} `this`
	 */
DOMElement.prototype.setAttributes = function setAttributes (attributes         , shouldCreateId) {
		if ( shouldCreateId === void 0 ) shouldCreateId          = true;


	this.attributes = Object.assign({}, attributes);
	if (!this.attributes.id && shouldCreateId) {

		this.attributes.id = random.createId();

	}
	return this;

};

/**
	 * Sets the content of the DOMElement
	 *
	 * @param {string} html
	 * @returns {DOMElement} `this`
	 */
DOMElement.prototype.setContent = function setContent (html        ) {

	this.content = html;
	return this;

};

/**
	 * Adds the html to the contents of the DOMElement
	 *
	 * @param {string} html
	 * @returns {DOMElement} `this`
	 */
DOMElement.prototype.addContent = function addContent (html        ) {

	this.content = "" + (this.content) + html;
	return this;

};

/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
DOMElement.prototype.render = function render () {
		var this$1 = this;


	var attStr = Object.keys(this.attributes).map(function (key) {

		return (key + "=\"" + (this$1.attributes[key]) + "\"");

	}).join(" ");

	return ("<" + (this.tag) + " " + attStr + ">" + (this.content) + "</" + (this.tag) + ">");

};

module.exports = DOMElement;

},{"../utils/random":19}],11:[function(require,module,exports){
//      
"use strict";

var Div = require("./div");

/**
 * Creates an HTML Form group. Convenience class.
 *
 * @param {InputType} type The input type
 * @param {Object} inAttributes The input attributes
 * @example
 * var formGroup = new FormGroup();
 */
var FormGroup = function FormGroup(inAttributes         , shouldCreateId) {
	if ( shouldCreateId === void 0 ) shouldCreateId          = true;


	var attribs = Object.assign({}, inAttributes, {class: "form-group"});
	this.div = new Div(attribs, shouldCreateId);

};

/**
	 * Sets the content of the DOMElement
	 *
	 * @param {string} html
	 * @returns {DOMElement} `this`
	 */
FormGroup.prototype.setContent = function setContent (html        ) {

	this.div.setContent(html);
	return this;

};

/**
	 * Adds the html to the contents of the DOMElement
	 *
	 * @param {string} html
	 * @returns {DOMElement} `this`
	 */
FormGroup.prototype.addContent = function addContent (html        ) {

	this.div.addContent(html);
	return this;

};

/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
FormGroup.prototype.render = function render () {

	return this.div.render();

};

module.exports = FormGroup;

},{"./div":9}],12:[function(require,module,exports){
//      
"use strict";

var DomElement = require("./domElement");

/**
 * Creates an HTML Input. Convenience class.
 *
 * @param {InputType} type The input type
 * @param {Object} inAttributes The input attributes
 * @example
 * var input = new Input();
 */
var Input = (function (DomElement) {
	function Input(inType           , inAttributes         , shouldCreateId) {
		if ( shouldCreateId === void 0 ) shouldCreateId          = true;


		var attr = Object.assign({}, inAttributes, {type: inType});
		DomElement.call(this, "input", attr, shouldCreateId);

		this.type = inType;

	}

	if ( DomElement ) Input.__proto__ = DomElement;
	Input.prototype = Object.create( DomElement && DomElement.prototype );
	Input.prototype.constructor = Input;

	return Input;
}(DomElement));

module.exports = Input;

},{"./domElement":10}],13:[function(require,module,exports){
//      
"use strict";

var DomElement = require("./domElement");

/**
 * Creates an HTML Label. Convenience class.
 *
 * @param {Object} inAttributes The label attributes
 * @example
 * var input = new Input();
 */
var Label = (function (DomElement) {
	function Label(inAttributes         , shouldCreateId) {
		if ( shouldCreateId === void 0 ) shouldCreateId          = true;


		DomElement.call(this, "label", inAttributes, shouldCreateId);

	}

	if ( DomElement ) Label.__proto__ = DomElement;
	Label.prototype = Object.create( DomElement && DomElement.prototype );
	Label.prototype.constructor = Label;

	return Label;
}(DomElement));

module.exports = Label;

},{"./domElement":10}],14:[function(require,module,exports){
//      
"use strict";

var Input = require("./input");
var Label = require("./label");
var FormGroup = require("./formGroup");

/**
 * A LabeledInput represents an input with a label.
 *
 * @param {string} labelText Input label.
 * @param {InputType} type Input type.
 * @param {?Object} inputAttributes The attributes that the input element will have
 * @example
 */
var LabeledInput = function LabeledInput(labelText        , type           , insideGroup, inputAttributes         , labelAttributes         ) {
	if ( insideGroup === void 0 ) insideGroup          = true;


	var attr = Object.assign({}, inputAttributes, {class: "form-control"});
	this.insideGroup = insideGroup;
	this.input = new Input(type, attr, false);

	var labelAttr = Object.assign({}, labelAttributes);
	if (this.input.attributes.id) {

		labelAttr.for = this.input.attributes.id;

	}

	this.label = new Label(labelAttr, false);
	this.label.setContent(labelText);

	if (this.insideGroup) {

		this.formGroup = new FormGroup({}, false);
		this.formGroup.addContent(this.label.render());
		this.formGroup.addContent(this.input.render());

	}

};

/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
LabeledInput.prototype.render = function render () {

	if (this.insideGroup) {

		return this.formGroup.render();

	} else {

		return ("" + (this.label.render()) + (this.input.render()));

	}

};

module.exports = LabeledInput;

},{"./formGroup":11,"./input":12,"./label":13}],15:[function(require,module,exports){
//      
"use strict";
var LabeledInput = require("./labeledInput");
var Selector = require("./selector");
var RadioGroup = require("./radioGroup");
var Button = require("./button");
//const PrintMap = require("../utils/printMap");

/**
 * A Input element.
 *
 * @param {string} label Input label.
 * @param {string} type Input type.
 * @example
 * var ll = new LatLon(42.10376, 1.84584);
 */
var PrintControl = function PrintControl(container        , canvas        ) {

	this.container = container;
	this.canvas = canvas;
	this.controls = this.createControls();

};

PrintControl.prototype.createControls = function createControls () {

	return [
		new RadioGroup("Layout", [
			{label: "Portrait", value: "portrait", selected: true},
			{label: "Landscape", value: "landscape", selected: false}
		], {name: "inputLayout"}),
		new Selector("Mides", [
			{label:"Personalitzada", value: "custom"},
			{label:"A2", value: "a2"},
			{label:"A3", value: "a3"},
			{label:"A4", value: "a4"},
			{label:"Galaxy S7", value: "s7"},
			{label:"Galaxy S8", value: "s8"},
			{label:"Galaxy S8+", value: "s8+"},
			{label:"Galaxy Note 8", value: "n8"},
			{label:"iPhone X", value: "iX"},
			{label:"HTC One M8", value: "htcOM8"},
			{label:"Galaxy S4", value: "s4"},
			{label:"Galaxy S5", value: "s5"},
			{label:"Xiaomi Readmi Note 450", value: "xrn450"},
			{label:"iPhone 8+", value: "i8+"},
			{label:"Lenovo K4 note", value: "lk4n"},
			{label:"Galaxy Note 3", value: "gn3"},
			{label:"iPhone 6s", value: "i6s"},
			{label:"iPhone 7", value: "i7"},
			{label:"iPhone 8", value: "i8"},
			{label:"Xiaomi Readmi 3s Prime", value: "xr3p"},
			{label:"iPhone 5s", value: "i5s"},
			{label:"iPhone 4s", value: "i4s"}
		], {id: "inputMida", placeholder: "Seleccioneu la mida"}),
		new LabeledInput("Amplada", "text", true,
			{id: "inputAmplada", placeholder: "valor en mm"}),
		new LabeledInput("Alçada", "text", true,
			{id: "inputAlcada", placeholder: "valor en mm"}),
		new Selector("DPI", [
			{label:"150", value: "150"},
			{label:"254", value: "254"},
			{label:"300", value: "300"},
			{label:"600", value: "600"}
		], {id: "inputDPI", placeholder: "Seleccioneu la resolució"}),
		new Selector("Escala", [
			{label:"Personalitzada", value: "custom"},
			{label:"5000", value: "5000"},
			{label:"10000", value: "10000"},
			{label:"25000", value: "25000"},
			{label:"50000", value: "50000"},
			{label:"100000", value: "100000"},
			{label:"250000", value: "250000"},
			{label:"500000", value: "500000"},
			{label:"1000000", value: "1000000"},
			{label:"2000000", value: "2000000"} ], {id: "inputEscala", placeholder: "Seleccioneu l'escala"}),
		new Button({id:"inputGenerarMapa", value:"Generar mapa"})
	];

};

/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
PrintControl.prototype.getHtml = function getHtml () {

	var attStr = this.controls.map(function (element) {

		return element.render();

	}).join("");

	return attStr;

};

/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
PrintControl.prototype.render = function render (document) {

	var attStr = this.getHtml();
	this.container.innerHTML = attStr;

	this.sizeSelector = document.querySelector("#inputMida");
	this.widthInput = document.querySelector("#inputAmplada");
	this.heightInput = document.querySelector("#inputAlcada");
	this.dpiInput = document.querySelector("#inputDPI");
	this.buttonInput = document.querySelector("#inputGenerarMapa");
	this.addEvents();

};

PrintControl.prototype.addEvents = function addEvents () {
		var this$1 = this;


	this.sizeSelector.addEventListener("change", function () { return this$1.sizeChanged(); });


};

PrintControl.prototype.sizeChanged = function sizeChanged () {

	var size = this.sizeSelector.options[this.sizeSelector.selectedIndex];

	if (size === "custom") {

		this.widthInput.style.display = "block";
		this.heightInput.style.display = "block";

	} else {

		this.widthInput.style.display = "none";
		this.heightInput.style.display = "none";

	}

};

PrintControl.prototype.addEventToButton = function addEventToButton (document,functionclick){
	document.querySelector("#inputGenerarMapa").addEventListener("click", functionclick);
};

module.exports = PrintControl;

},{"./button":8,"./labeledInput":14,"./radioGroup":16,"./selector":17}],16:[function(require,module,exports){
//      
"use strict";
var LabeledInput = require("./labeledInput");
var Div = require("./div");
var Label = require("./label");

/**
 * A RadioGroup element.
 *
 * @param {string} label Input label.
 * @param {string} type Input type.
 * @example
 * var ll = new LatLon(42.10376, 1.84584);
 */
var RadioGroup = function RadioGroup(label        , options, attributes         ) {
	if ( options === void 0 ) options               = [];


	this.createOptions(options, attributes);
	this.label = new Label({}, false);
	this.label.setContent(label);
	this.div = new Div({class: "form-group"}, false);
	this.div.setContent(this.label.render());

};

/**
	 * Set the input attributes
	 *
	 * @param {number} lat
	 *
	 * @returns {RadioGroup} `this`
	 */
RadioGroup.prototype.createOptions = function createOptions (options              , attributes         ) {

	this.options = options.map(function (elem) {

		var elemAttribs = Object.assign({}, attributes, {value: elem.value});
		if (elem.selected) {

			elemAttribs.checked = true;

		}

		if (elem.id) {

			elemAttribs.id = elem.id;

		}

		return new LabeledInput(elem.label, "radio", false, elemAttribs, {class: "radio-inline"});

	});

	return this;

};

/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
RadioGroup.prototype.render = function render () {

	var optionsStr = this.options.map(function (elem) {

		return elem.render();

	}).join("");

	this.div.addContent(optionsStr);
	return this.div.render();

};

module.exports = RadioGroup;

},{"./div":9,"./label":13,"./labeledInput":14}],17:[function(require,module,exports){
//      
"use strict";

var random = require("../utils/random");

/**
 * A Input element.
 *
 * @param {string} label Input label.
 * @param {string} type Input type.
 * @example
 * var ll = new LatLon(42.10376, 1.84584);
 */
var Selector = function Selector(label        , options              , attributes         ) {

	this.label = label;
	this.setOptions(options);
	this.setAttributes(attributes);

};

/**
	 * Set the select options
	 *
	 * @param {Object} options
	 * @returns {Selector} `this`
	 */
Selector.prototype.setOptions = function setOptions (options         ) {

	this.options = options.slice(0);
	return this;

};

/**
	 * Set the select attributes
	 *
	 * @param {Object} attributes
	 * @returns {Selector} `this`
	 */
Selector.prototype.setAttributes = function setAttributes (attributes         ) {

	this.attributes = Object.assign({}, attributes);
	if (!this.attributes.id) {

		this.attributes.id = random.createId();

	}
	return this;

};

/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
Selector.prototype.render = function render () {
		var this$1 = this;


	var attStr = Object.keys(this.attributes).map(function (key) {

		return (key + "=\"" + (this$1.attributes[key]) + "\"");

	}).join(" ");
	var optStr = this.options.map(function (element) {

		return ("<option value=\"" + (element.value) + "\">" + (element.label) + "</option>");

	}).join("");
	return ("<div class=\"form-group\"><label for=\"" + (this.attributes.id) + "\">" + (this.label) + "</label><select class=\"form-control\" " + attStr + ">" + optStr + "</select></div>");

};

module.exports = Selector;

},{"../utils/random":19}],18:[function(require,module,exports){
//      
"use strict";

/**
 * A sidebar element.
 *
 * @param {boolean} visibility Sidebar visibility.
 * @param {PositionType} position Sidebar position.
 * @param {String} header Sidebar header.
 * @param {?Object} components Sidebar components.
 * @example
 * new Sidebar(false, "left", "Header","<input type=\"text\" id=\"id\" value=\"value\">");
 */
var Sidebar = function Sidebar(visibility         , position              , header        , component         ) {

	this.visibility = visibility;
	this.position = position;
	if (undefined !== component) {

		if (undefined !== this.components) {

			this.components = "" + (this.components) + component;

		} else  {

			this.components = component;

		}

	} else {

		this.components = "";

	}
	if (undefined !== header) {

		this.header = header;

	} else {

		this.header = "";

	}

};

Sidebar.prototype.hide = function hide (document) {

	var self = this;
	self.visibility = false;
	if (undefined !== document) {

		document.querySelector("body").innerHTML = self.render();
		self.addEventToButton(document);

	}

};

Sidebar.prototype.show = function show (document) {

	var self = this;
	self.visibility = true;
	if (undefined !== document) {

		document.querySelector("body").innerHTML = self.render();
		self.addEventToButton(document);

	}

};

Sidebar.prototype.setPosition = function setPosition (position              ) {

	var self = this;
	self.position = position;

};


/**
	 * Add component to sidebar
	 *
	 * @param {?Object} component
	 */
Sidebar.prototype.addComponent = function addComponent (component         ) {

	if (undefined !== component) {

		if (undefined !== this.components) {

			this.components = "" + (this.components) + component;

		} else  {

			this.components = component;

		}

	}

};

/**
	 * Add header to sidebar
	 *
	 * @param {String} header
	 */
Sidebar.prototype.addHeader = function addHeader (header        ) {

	this.header = header;

};

Sidebar.prototype.addEventToButton = function addEventToButton (document) {

	var self = this;
	if (undefined !== document) {

		document.getElementById("sidebarCollapse").onclick = function () {

			self.changeVisibility(document);

		};

	}

};

Sidebar.prototype.changeVisibility = function changeVisibility (document) {

	var self = this;
	// open or close navbar
	if (!self.visibility) {

		self.show(document);

	} else {

		self.hide(document);

	}

};
/**
	 * Create HTML string
	 *
	 * @returns {string} `html`
	 */
Sidebar.prototype.render = function render () {

	var html = "<div class=\"wrapper  sidebar-" + (this.position) + "\">" +
					"<nav id=\"sidebar\" class=\"" + (this.visibility ? "active" : "unactive") + "\">" +
					"<!-- Sidebar Header -->" +
						"<div class=\"sidebar-header\">" +
							"<span class=\"title\">" + (this.header) + "</span>" +
						"</div>" +
						"<div class=\"sidebar-body\">" +
							"" + (this.components) +
						"</div>" +
					"</nav>" +
				"</div>" +
				"<div id=\"content\" class=\"sidebar-" + (this.position) + "\">" +
					"<button type=\"button\" id=\"sidebarCollapse\" class=\"btn btn-info navbar-btn\">" +
						"" + (this.visibility ? ">" : "<") +
					"</button>" +
				"<div>";
	return html;

};

module.exports = Sidebar;

},{}],19:[function(require,module,exports){
//      
"use strict";

var uuid = require("uuid");

var Random = function Random () {};

Random.createId = function createId () {

	return uuid();

};

module.exports = Random;

},{"uuid":1}]},{},[7])(7)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvdXVpZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91dWlkL2xpYi9ieXRlc1RvVXVpZC5qcyIsIm5vZGVfbW9kdWxlcy91dWlkL2xpYi9ybmctYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy91dWlkL3YxLmpzIiwibm9kZV9tb2R1bGVzL3V1aWQvdjQuanMiLCJwYWNrYWdlLmpzb24iLCJFOi91c3VhcmlzL20ub3J0ZWdhL0luc3RhbWFwZXMvcHJpbnQtY29udHJvbC9zcmMvaW5kZXguanMiLCJFOi91c3VhcmlzL20ub3J0ZWdhL0luc3RhbWFwZXMvcHJpbnQtY29udHJvbC9zcmMvdWkvYnV0dG9uLmpzIiwiRTovdXN1YXJpcy9tLm9ydGVnYS9JbnN0YW1hcGVzL3ByaW50LWNvbnRyb2wvc3JjL3VpL2Rpdi5qcyIsIkU6L3VzdWFyaXMvbS5vcnRlZ2EvSW5zdGFtYXBlcy9wcmludC1jb250cm9sL3NyYy91aS9kb21FbGVtZW50LmpzIiwiRTovdXN1YXJpcy9tLm9ydGVnYS9JbnN0YW1hcGVzL3ByaW50LWNvbnRyb2wvc3JjL3VpL2Zvcm1Hcm91cC5qcyIsIkU6L3VzdWFyaXMvbS5vcnRlZ2EvSW5zdGFtYXBlcy9wcmludC1jb250cm9sL3NyYy91aS9pbnB1dC5qcyIsIkU6L3VzdWFyaXMvbS5vcnRlZ2EvSW5zdGFtYXBlcy9wcmludC1jb250cm9sL3NyYy91aS9sYWJlbC5qcyIsIkU6L3VzdWFyaXMvbS5vcnRlZ2EvSW5zdGFtYXBlcy9wcmludC1jb250cm9sL3NyYy91aS9sYWJlbGVkSW5wdXQuanMiLCJFOi91c3VhcmlzL20ub3J0ZWdhL0luc3RhbWFwZXMvcHJpbnQtY29udHJvbC9zcmMvdWkvcHJpbnRDb250cm9sLmpzIiwiRTovdXN1YXJpcy9tLm9ydGVnYS9JbnN0YW1hcGVzL3ByaW50LWNvbnRyb2wvc3JjL3VpL3JhZGlvR3JvdXAuanMiLCJFOi91c3VhcmlzL20ub3J0ZWdhL0luc3RhbWFwZXMvcHJpbnQtY29udHJvbC9zcmMvdWkvc2VsZWN0b3IuanMiLCJFOi91c3VhcmlzL20ub3J0ZWdhL0luc3RhbWFwZXMvcHJpbnQtY29udHJvbC9zcmMvdWkvc2lkZWJhci5qcyIsIkU6L3VzdWFyaXMvbS5vcnRlZ2EvSW5zdGFtYXBlcy9wcmludC1jb250cm9sL3NyYy91dGlscy9yYW5kb20uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBOztBQ0ZBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0FBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0FBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0FBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0FBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0pKCkiLCJ2YXIgdjEgPSByZXF1aXJlKCcuL3YxJyk7XG52YXIgdjQgPSByZXF1aXJlKCcuL3Y0Jyk7XG5cbnZhciB1dWlkID0gdjQ7XG51dWlkLnYxID0gdjE7XG51dWlkLnY0ID0gdjQ7XG5cbm1vZHVsZS5leHBvcnRzID0gdXVpZDtcbiIsIi8qKlxuICogQ29udmVydCBhcnJheSBvZiAxNiBieXRlIHZhbHVlcyB0byBVVUlEIHN0cmluZyBmb3JtYXQgb2YgdGhlIGZvcm06XG4gKiBYWFhYWFhYWC1YWFhYLVhYWFgtWFhYWC1YWFhYWFhYWFhYWFhcbiAqL1xudmFyIGJ5dGVUb0hleCA9IFtdO1xuZm9yICh2YXIgaSA9IDA7IGkgPCAyNTY7ICsraSkge1xuICBieXRlVG9IZXhbaV0gPSAoaSArIDB4MTAwKS50b1N0cmluZygxNikuc3Vic3RyKDEpO1xufVxuXG5mdW5jdGlvbiBieXRlc1RvVXVpZChidWYsIG9mZnNldCkge1xuICB2YXIgaSA9IG9mZnNldCB8fCAwO1xuICB2YXIgYnRoID0gYnl0ZVRvSGV4O1xuICByZXR1cm4gYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dICsgJy0nICtcbiAgICAgICAgICBidGhbYnVmW2krK11dICsgYnRoW2J1ZltpKytdXSArICctJyArXG4gICAgICAgICAgYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gKyAnLScgK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dICsgJy0nICtcbiAgICAgICAgICBidGhbYnVmW2krK11dICsgYnRoW2J1ZltpKytdXSArXG4gICAgICAgICAgYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ5dGVzVG9VdWlkO1xuIiwiLy8gVW5pcXVlIElEIGNyZWF0aW9uIHJlcXVpcmVzIGEgaGlnaCBxdWFsaXR5IHJhbmRvbSAjIGdlbmVyYXRvci4gIEluIHRoZVxuLy8gYnJvd3NlciB0aGlzIGlzIGEgbGl0dGxlIGNvbXBsaWNhdGVkIGR1ZSB0byB1bmtub3duIHF1YWxpdHkgb2YgTWF0aC5yYW5kb20oKVxuLy8gYW5kIGluY29uc2lzdGVudCBzdXBwb3J0IGZvciB0aGUgYGNyeXB0b2AgQVBJLiAgV2UgZG8gdGhlIGJlc3Qgd2UgY2FuIHZpYVxuLy8gZmVhdHVyZS1kZXRlY3Rpb25cblxuLy8gZ2V0UmFuZG9tVmFsdWVzIG5lZWRzIHRvIGJlIGludm9rZWQgaW4gYSBjb250ZXh0IHdoZXJlIFwidGhpc1wiIGlzIGEgQ3J5cHRvIGltcGxlbWVudGF0aW9uLlxudmFyIGdldFJhbmRvbVZhbHVlcyA9ICh0eXBlb2YoY3J5cHRvKSAhPSAndW5kZWZpbmVkJyAmJiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzLmJpbmQoY3J5cHRvKSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAodHlwZW9mKG1zQ3J5cHRvKSAhPSAndW5kZWZpbmVkJyAmJiBtc0NyeXB0by5nZXRSYW5kb21WYWx1ZXMuYmluZChtc0NyeXB0bykpO1xuaWYgKGdldFJhbmRvbVZhbHVlcykge1xuICAvLyBXSEFUV0cgY3J5cHRvIFJORyAtIGh0dHA6Ly93aWtpLndoYXR3Zy5vcmcvd2lraS9DcnlwdG9cbiAgdmFyIHJuZHM4ID0gbmV3IFVpbnQ4QXJyYXkoMTYpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmXG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB3aGF0d2dSTkcoKSB7XG4gICAgZ2V0UmFuZG9tVmFsdWVzKHJuZHM4KTtcbiAgICByZXR1cm4gcm5kczg7XG4gIH07XG59IGVsc2Uge1xuICAvLyBNYXRoLnJhbmRvbSgpLWJhc2VkIChSTkcpXG4gIC8vXG4gIC8vIElmIGFsbCBlbHNlIGZhaWxzLCB1c2UgTWF0aC5yYW5kb20oKS4gIEl0J3MgZmFzdCwgYnV0IGlzIG9mIHVuc3BlY2lmaWVkXG4gIC8vIHF1YWxpdHkuXG4gIHZhciBybmRzID0gbmV3IEFycmF5KDE2KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG1hdGhSTkcoKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHI7IGkgPCAxNjsgaSsrKSB7XG4gICAgICBpZiAoKGkgJiAweDAzKSA9PT0gMCkgciA9IE1hdGgucmFuZG9tKCkgKiAweDEwMDAwMDAwMDtcbiAgICAgIHJuZHNbaV0gPSByID4+PiAoKGkgJiAweDAzKSA8PCAzKSAmIDB4ZmY7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJuZHM7XG4gIH07XG59XG4iLCJ2YXIgcm5nID0gcmVxdWlyZSgnLi9saWIvcm5nJyk7XG52YXIgYnl0ZXNUb1V1aWQgPSByZXF1aXJlKCcuL2xpYi9ieXRlc1RvVXVpZCcpO1xuXG4vLyAqKmB2MSgpYCAtIEdlbmVyYXRlIHRpbWUtYmFzZWQgVVVJRCoqXG4vL1xuLy8gSW5zcGlyZWQgYnkgaHR0cHM6Ly9naXRodWIuY29tL0xpb3NLL1VVSUQuanNcbi8vIGFuZCBodHRwOi8vZG9jcy5weXRob24ub3JnL2xpYnJhcnkvdXVpZC5odG1sXG5cbnZhciBfbm9kZUlkO1xudmFyIF9jbG9ja3NlcTtcblxuLy8gUHJldmlvdXMgdXVpZCBjcmVhdGlvbiB0aW1lXG52YXIgX2xhc3RNU2VjcyA9IDA7XG52YXIgX2xhc3ROU2VjcyA9IDA7XG5cbi8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYnJvb2ZhL25vZGUtdXVpZCBmb3IgQVBJIGRldGFpbHNcbmZ1bmN0aW9uIHYxKG9wdGlvbnMsIGJ1Ziwgb2Zmc2V0KSB7XG4gIHZhciBpID0gYnVmICYmIG9mZnNldCB8fCAwO1xuICB2YXIgYiA9IGJ1ZiB8fCBbXTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIG5vZGUgPSBvcHRpb25zLm5vZGUgfHwgX25vZGVJZDtcbiAgdmFyIGNsb2Nrc2VxID0gb3B0aW9ucy5jbG9ja3NlcSAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5jbG9ja3NlcSA6IF9jbG9ja3NlcTtcblxuICAvLyBub2RlIGFuZCBjbG9ja3NlcSBuZWVkIHRvIGJlIGluaXRpYWxpemVkIHRvIHJhbmRvbSB2YWx1ZXMgaWYgdGhleSdyZSBub3RcbiAgLy8gc3BlY2lmaWVkLiAgV2UgZG8gdGhpcyBsYXppbHkgdG8gbWluaW1pemUgaXNzdWVzIHJlbGF0ZWQgdG8gaW5zdWZmaWNpZW50XG4gIC8vIHN5c3RlbSBlbnRyb3B5LiAgU2VlICMxODlcbiAgaWYgKG5vZGUgPT0gbnVsbCB8fCBjbG9ja3NlcSA9PSBudWxsKSB7XG4gICAgdmFyIHNlZWRCeXRlcyA9IHJuZygpO1xuICAgIGlmIChub2RlID09IG51bGwpIHtcbiAgICAgIC8vIFBlciA0LjUsIGNyZWF0ZSBhbmQgNDgtYml0IG5vZGUgaWQsICg0NyByYW5kb20gYml0cyArIG11bHRpY2FzdCBiaXQgPSAxKVxuICAgICAgbm9kZSA9IF9ub2RlSWQgPSBbXG4gICAgICAgIHNlZWRCeXRlc1swXSB8IDB4MDEsXG4gICAgICAgIHNlZWRCeXRlc1sxXSwgc2VlZEJ5dGVzWzJdLCBzZWVkQnl0ZXNbM10sIHNlZWRCeXRlc1s0XSwgc2VlZEJ5dGVzWzVdXG4gICAgICBdO1xuICAgIH1cbiAgICBpZiAoY2xvY2tzZXEgPT0gbnVsbCkge1xuICAgICAgLy8gUGVyIDQuMi4yLCByYW5kb21pemUgKDE0IGJpdCkgY2xvY2tzZXFcbiAgICAgIGNsb2Nrc2VxID0gX2Nsb2Nrc2VxID0gKHNlZWRCeXRlc1s2XSA8PCA4IHwgc2VlZEJ5dGVzWzddKSAmIDB4M2ZmZjtcbiAgICB9XG4gIH1cblxuICAvLyBVVUlEIHRpbWVzdGFtcHMgYXJlIDEwMCBuYW5vLXNlY29uZCB1bml0cyBzaW5jZSB0aGUgR3JlZ29yaWFuIGVwb2NoLFxuICAvLyAoMTU4Mi0xMC0xNSAwMDowMCkuICBKU051bWJlcnMgYXJlbid0IHByZWNpc2UgZW5vdWdoIGZvciB0aGlzLCBzb1xuICAvLyB0aW1lIGlzIGhhbmRsZWQgaW50ZXJuYWxseSBhcyAnbXNlY3MnIChpbnRlZ2VyIG1pbGxpc2Vjb25kcykgYW5kICduc2VjcydcbiAgLy8gKDEwMC1uYW5vc2Vjb25kcyBvZmZzZXQgZnJvbSBtc2Vjcykgc2luY2UgdW5peCBlcG9jaCwgMTk3MC0wMS0wMSAwMDowMC5cbiAgdmFyIG1zZWNzID0gb3B0aW9ucy5tc2VjcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5tc2VjcyA6IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXG4gIC8vIFBlciA0LjIuMS4yLCB1c2UgY291bnQgb2YgdXVpZCdzIGdlbmVyYXRlZCBkdXJpbmcgdGhlIGN1cnJlbnQgY2xvY2tcbiAgLy8gY3ljbGUgdG8gc2ltdWxhdGUgaGlnaGVyIHJlc29sdXRpb24gY2xvY2tcbiAgdmFyIG5zZWNzID0gb3B0aW9ucy5uc2VjcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5uc2VjcyA6IF9sYXN0TlNlY3MgKyAxO1xuXG4gIC8vIFRpbWUgc2luY2UgbGFzdCB1dWlkIGNyZWF0aW9uIChpbiBtc2VjcylcbiAgdmFyIGR0ID0gKG1zZWNzIC0gX2xhc3RNU2VjcykgKyAobnNlY3MgLSBfbGFzdE5TZWNzKS8xMDAwMDtcblxuICAvLyBQZXIgNC4yLjEuMiwgQnVtcCBjbG9ja3NlcSBvbiBjbG9jayByZWdyZXNzaW9uXG4gIGlmIChkdCA8IDAgJiYgb3B0aW9ucy5jbG9ja3NlcSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgY2xvY2tzZXEgPSBjbG9ja3NlcSArIDEgJiAweDNmZmY7XG4gIH1cblxuICAvLyBSZXNldCBuc2VjcyBpZiBjbG9jayByZWdyZXNzZXMgKG5ldyBjbG9ja3NlcSkgb3Igd2UndmUgbW92ZWQgb250byBhIG5ld1xuICAvLyB0aW1lIGludGVydmFsXG4gIGlmICgoZHQgPCAwIHx8IG1zZWNzID4gX2xhc3RNU2VjcykgJiYgb3B0aW9ucy5uc2VjcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbnNlY3MgPSAwO1xuICB9XG5cbiAgLy8gUGVyIDQuMi4xLjIgVGhyb3cgZXJyb3IgaWYgdG9vIG1hbnkgdXVpZHMgYXJlIHJlcXVlc3RlZFxuICBpZiAobnNlY3MgPj0gMTAwMDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3V1aWQudjEoKTogQ2FuXFwndCBjcmVhdGUgbW9yZSB0aGFuIDEwTSB1dWlkcy9zZWMnKTtcbiAgfVxuXG4gIF9sYXN0TVNlY3MgPSBtc2VjcztcbiAgX2xhc3ROU2VjcyA9IG5zZWNzO1xuICBfY2xvY2tzZXEgPSBjbG9ja3NlcTtcblxuICAvLyBQZXIgNC4xLjQgLSBDb252ZXJ0IGZyb20gdW5peCBlcG9jaCB0byBHcmVnb3JpYW4gZXBvY2hcbiAgbXNlY3MgKz0gMTIyMTkyOTI4MDAwMDA7XG5cbiAgLy8gYHRpbWVfbG93YFxuICB2YXIgdGwgPSAoKG1zZWNzICYgMHhmZmZmZmZmKSAqIDEwMDAwICsgbnNlY3MpICUgMHgxMDAwMDAwMDA7XG4gIGJbaSsrXSA9IHRsID4+PiAyNCAmIDB4ZmY7XG4gIGJbaSsrXSA9IHRsID4+PiAxNiAmIDB4ZmY7XG4gIGJbaSsrXSA9IHRsID4+PiA4ICYgMHhmZjtcbiAgYltpKytdID0gdGwgJiAweGZmO1xuXG4gIC8vIGB0aW1lX21pZGBcbiAgdmFyIHRtaCA9IChtc2VjcyAvIDB4MTAwMDAwMDAwICogMTAwMDApICYgMHhmZmZmZmZmO1xuICBiW2krK10gPSB0bWggPj4+IDggJiAweGZmO1xuICBiW2krK10gPSB0bWggJiAweGZmO1xuXG4gIC8vIGB0aW1lX2hpZ2hfYW5kX3ZlcnNpb25gXG4gIGJbaSsrXSA9IHRtaCA+Pj4gMjQgJiAweGYgfCAweDEwOyAvLyBpbmNsdWRlIHZlcnNpb25cbiAgYltpKytdID0gdG1oID4+PiAxNiAmIDB4ZmY7XG5cbiAgLy8gYGNsb2NrX3NlcV9oaV9hbmRfcmVzZXJ2ZWRgIChQZXIgNC4yLjIgLSBpbmNsdWRlIHZhcmlhbnQpXG4gIGJbaSsrXSA9IGNsb2Nrc2VxID4+PiA4IHwgMHg4MDtcblxuICAvLyBgY2xvY2tfc2VxX2xvd2BcbiAgYltpKytdID0gY2xvY2tzZXEgJiAweGZmO1xuXG4gIC8vIGBub2RlYFxuICBmb3IgKHZhciBuID0gMDsgbiA8IDY7ICsrbikge1xuICAgIGJbaSArIG5dID0gbm9kZVtuXTtcbiAgfVxuXG4gIHJldHVybiBidWYgPyBidWYgOiBieXRlc1RvVXVpZChiKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB2MTtcbiIsInZhciBybmcgPSByZXF1aXJlKCcuL2xpYi9ybmcnKTtcbnZhciBieXRlc1RvVXVpZCA9IHJlcXVpcmUoJy4vbGliL2J5dGVzVG9VdWlkJyk7XG5cbmZ1bmN0aW9uIHY0KG9wdGlvbnMsIGJ1Ziwgb2Zmc2V0KSB7XG4gIHZhciBpID0gYnVmICYmIG9mZnNldCB8fCAwO1xuXG4gIGlmICh0eXBlb2Yob3B0aW9ucykgPT0gJ3N0cmluZycpIHtcbiAgICBidWYgPSBvcHRpb25zID09PSAnYmluYXJ5JyA/IG5ldyBBcnJheSgxNikgOiBudWxsO1xuICAgIG9wdGlvbnMgPSBudWxsO1xuICB9XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIHZhciBybmRzID0gb3B0aW9ucy5yYW5kb20gfHwgKG9wdGlvbnMucm5nIHx8IHJuZykoKTtcblxuICAvLyBQZXIgNC40LCBzZXQgYml0cyBmb3IgdmVyc2lvbiBhbmQgYGNsb2NrX3NlcV9oaV9hbmRfcmVzZXJ2ZWRgXG4gIHJuZHNbNl0gPSAocm5kc1s2XSAmIDB4MGYpIHwgMHg0MDtcbiAgcm5kc1s4XSA9IChybmRzWzhdICYgMHgzZikgfCAweDgwO1xuXG4gIC8vIENvcHkgYnl0ZXMgdG8gYnVmZmVyLCBpZiBwcm92aWRlZFxuICBpZiAoYnVmKSB7XG4gICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IDE2OyArK2lpKSB7XG4gICAgICBidWZbaSArIGlpXSA9IHJuZHNbaWldO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWYgfHwgYnl0ZXNUb1V1aWQocm5kcyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdjQ7XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gIFwidmVyc2lvblwiOiBcIjAuMC4xXCJcbn0iLCIvLyAgICAgIFxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbmNvbnN0IHZlcnNpb24gICAgICAgICA9IHJlcXVpcmUoXCIuLi9wYWNrYWdlLmpzb25cIikudmVyc2lvbjtcclxuY29uc3QgU2lkZWJhciA9IHJlcXVpcmUoXCIuL3VpL3NpZGViYXJcIik7XHJcbmNvbnN0IElucHV0ID0gcmVxdWlyZShcIi4vdWkvaW5wdXRcIik7XHJcbmNvbnN0IFJhZGlvR3JvdXAgPSByZXF1aXJlKFwiLi91aS9yYWRpb0dyb3VwXCIpO1xyXG5jb25zdCBQcmludENvbnRyb2wgPSByZXF1aXJlKFwiLi91aS9wcmludENvbnRyb2xcIik7XHJcbmNvbnN0IEJ1dHRvbiA9IHJlcXVpcmUoXCIuL3VpL2J1dHRvblwiKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdHZlcnNpb24sXHJcblx0U2lkZWJhcixcclxuXHRJbnB1dCxcclxuXHRSYWRpb0dyb3VwLFxyXG5cdFByaW50Q29udHJvbCxcclxuXHRCdXR0b25cclxufTtcclxuXHJcbi8qKlxyXG4gKiBUaGUgdmVyc2lvbiBvZiB0aGUgcHJvamVjdCBpbiB1c2UgYXMgc3BlY2lmaWVkIGluIGBwYWNrYWdlLmpzb25gLFxyXG4gKiBgQ0hBTkdFTE9HLm1kYCwgYW5kIHRoZSBHaXRIdWIgcmVsZWFzZS5cclxuICpcclxuICogQHZhciB7c3RyaW5nfSB2ZXJzaW9uXHJcbiAqL1xyXG4iLCIvLyAgICAgIFxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbmNvbnN0IElucHV0ID0gcmVxdWlyZShcIi4vaW5wdXRcIik7XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhbiBIVE1MIEJ1dHRvbi4gQ29udmVuaWVuY2UgY2xhc3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbkF0dHJpYnV0ZXMgVGhlIGJ1dHRvbiBhdHRyaWJ1dGVzXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBpbnB1dCA9IG5ldyBCdXR0b24oKTtcclxuICovXHJcbmNsYXNzIEJ1dHRvbiBleHRlbmRzIElucHV0IHtcclxuXHJcblx0Y29uc3RydWN0b3IoaW5BdHRyaWJ1dGVzICAgICAgICAgKSB7XHJcblxyXG5cdFx0c3VwZXIoXCJidXR0b25cIiwgaW5BdHRyaWJ1dGVzKTtcclxuXHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdXR0b247XHJcbiIsIi8vICAgICAgXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxuY29uc3QgRG9tRWxlbWVudCA9IHJlcXVpcmUoXCIuL2RvbUVsZW1lbnRcIik7XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhbiBIVE1MIERpdi4gQ29udmVuaWVuY2UgY2xhc3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbkF0dHJpYnV0ZXMgVGhlIGRpdiBhdHRyaWJ1dGVzXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBpbnB1dCA9IG5ldyBJbnB1dCgpO1xyXG4gKi9cclxuY2xhc3MgRGl2IGV4dGVuZHMgRG9tRWxlbWVudCB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKGluQXR0cmlidXRlcyAgICAgICAgICwgc2hvdWxkQ3JlYXRlSWQgICAgICAgICAgPSB0cnVlKSB7XHJcblxyXG5cdFx0c3VwZXIoXCJkaXZcIiwgaW5BdHRyaWJ1dGVzLCBzaG91bGRDcmVhdGVJZCk7XHJcblxyXG5cdH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRGl2O1xyXG4iLCIvLyAgICAgIFxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbmNvbnN0IHJhbmRvbSA9IHJlcXVpcmUoXCIuLi91dGlscy9yYW5kb21cIik7XHJcblxyXG4vKipcclxuICogQSBET01FbGVtZW50IGVsZW1lbnQgdGhhdCByZXByZXNlbnRzIGFuIEhUTUwgRE9NIGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0YWcgVGhlIGVsZW1lbnQgdGFnXHJcbiAqIEBleGFtcGxlXHJcbiAqIHZhciBkaXYgPSBuZXcgRE9NRWxlbWVudChcImRpdlwiKTtcclxuICovXHJcbmNsYXNzIERPTUVsZW1lbnQge1xyXG5cclxuXHQgICAgICAgICAgICBcclxuXHQgICAgICAgICAgICAgICAgICAgIFxyXG5cdCAgICAgICAgICAgICAgICBcclxuXHJcblx0Y29uc3RydWN0b3IodGFnICAgICAgICAsIGF0dHJpYnV0ZXMgICAgICAgICAsIHNob3VsZENyZWF0ZUlkICAgICAgICAgID0gdHJ1ZSkge1xyXG5cclxuXHRcdHRoaXMudGFnID0gdGFnO1xyXG5cdFx0dGhpcy5jb250ZW50ID0gXCJcIjtcclxuXHRcdHRoaXMuc2V0QXR0cmlidXRlcyhhdHRyaWJ1dGVzLCBzaG91bGRDcmVhdGVJZCk7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHRoZSBpbnB1dCBhdHRyaWJ1dGVzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gYXR0cmlidXRlc1xyXG5cdCAqIEByZXR1cm5zIHtET01FbGVtZW50fSBgdGhpc2BcclxuXHQgKi9cclxuXHRzZXRBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMgICAgICAgICAsIHNob3VsZENyZWF0ZUlkICAgICAgICAgID0gdHJ1ZSkge1xyXG5cclxuXHRcdHRoaXMuYXR0cmlidXRlcyA9IE9iamVjdC5hc3NpZ24oe30sIGF0dHJpYnV0ZXMpO1xyXG5cdFx0aWYgKCF0aGlzLmF0dHJpYnV0ZXMuaWQgJiYgc2hvdWxkQ3JlYXRlSWQpIHtcclxuXHJcblx0XHRcdHRoaXMuYXR0cmlidXRlcy5pZCA9IHJhbmRvbS5jcmVhdGVJZCgpO1xyXG5cclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldHMgdGhlIGNvbnRlbnQgb2YgdGhlIERPTUVsZW1lbnRcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBodG1sXHJcblx0ICogQHJldHVybnMge0RPTUVsZW1lbnR9IGB0aGlzYFxyXG5cdCAqL1xyXG5cdHNldENvbnRlbnQoaHRtbCAgICAgICAgKSB7XHJcblxyXG5cdFx0dGhpcy5jb250ZW50ID0gaHRtbDtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZHMgdGhlIGh0bWwgdG8gdGhlIGNvbnRlbnRzIG9mIHRoZSBET01FbGVtZW50XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gaHRtbFxyXG5cdCAqIEByZXR1cm5zIHtET01FbGVtZW50fSBgdGhpc2BcclxuXHQgKi9cclxuXHRhZGRDb250ZW50KGh0bWwgICAgICAgICkge1xyXG5cclxuXHRcdHRoaXMuY29udGVudCA9IGAke3RoaXMuY29udGVudH0ke2h0bWx9YDtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBIVE1MIHN0cmluZ1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3N0cmluZ30gYGh0bWxgXHJcblx0ICovXHJcblx0cmVuZGVyKCkge1xyXG5cclxuXHRcdGNvbnN0IGF0dFN0ciA9IE9iamVjdC5rZXlzKHRoaXMuYXR0cmlidXRlcykubWFwKChrZXkpID0+IHtcclxuXHJcblx0XHRcdHJldHVybiBgJHtrZXl9PVwiJHt0aGlzLmF0dHJpYnV0ZXNba2V5XX1cImA7XHJcblxyXG5cdFx0fSkuam9pbihcIiBcIik7XHJcblxyXG5cdFx0cmV0dXJuIGA8JHt0aGlzLnRhZ30gJHthdHRTdHJ9PiR7dGhpcy5jb250ZW50fTwvJHt0aGlzLnRhZ30+YDtcclxuXHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBET01FbGVtZW50O1xyXG4iLCIvLyAgICAgIFxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbmNvbnN0IERpdiA9IHJlcXVpcmUoXCIuL2RpdlwiKTtcclxuXHJcbi8qKlxyXG4gKiBDcmVhdGVzIGFuIEhUTUwgRm9ybSBncm91cC4gQ29udmVuaWVuY2UgY2xhc3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7SW5wdXRUeXBlfSB0eXBlIFRoZSBpbnB1dCB0eXBlXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbkF0dHJpYnV0ZXMgVGhlIGlucHV0IGF0dHJpYnV0ZXNcclxuICogQGV4YW1wbGVcclxuICogdmFyIGZvcm1Hcm91cCA9IG5ldyBGb3JtR3JvdXAoKTtcclxuICovXHJcbmNsYXNzIEZvcm1Hcm91cCB7XHJcblxyXG5cdCAgICAgICAgIFxyXG5cclxuXHRjb25zdHJ1Y3RvcihpbkF0dHJpYnV0ZXMgICAgICAgICAsIHNob3VsZENyZWF0ZUlkICAgICAgICAgID0gdHJ1ZSkge1xyXG5cclxuXHRcdGNvbnN0IGF0dHJpYnMgPSBPYmplY3QuYXNzaWduKHt9LCBpbkF0dHJpYnV0ZXMsIHtjbGFzczogXCJmb3JtLWdyb3VwXCJ9KTtcclxuXHRcdHRoaXMuZGl2ID0gbmV3IERpdihhdHRyaWJzLCBzaG91bGRDcmVhdGVJZCk7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2V0cyB0aGUgY29udGVudCBvZiB0aGUgRE9NRWxlbWVudFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGh0bWxcclxuXHQgKiBAcmV0dXJucyB7RE9NRWxlbWVudH0gYHRoaXNgXHJcblx0ICovXHJcblx0c2V0Q29udGVudChodG1sICAgICAgICApIHtcclxuXHJcblx0XHR0aGlzLmRpdi5zZXRDb250ZW50KGh0bWwpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQWRkcyB0aGUgaHRtbCB0byB0aGUgY29udGVudHMgb2YgdGhlIERPTUVsZW1lbnRcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBodG1sXHJcblx0ICogQHJldHVybnMge0RPTUVsZW1lbnR9IGB0aGlzYFxyXG5cdCAqL1xyXG5cdGFkZENvbnRlbnQoaHRtbCAgICAgICAgKSB7XHJcblxyXG5cdFx0dGhpcy5kaXYuYWRkQ29udGVudChodG1sKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBIVE1MIHN0cmluZ1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3N0cmluZ30gYGh0bWxgXHJcblx0ICovXHJcblx0cmVuZGVyKCkge1xyXG5cclxuXHRcdHJldHVybiB0aGlzLmRpdi5yZW5kZXIoKTtcclxuXHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGb3JtR3JvdXA7XHJcbiIsIi8vICAgICAgXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxuY29uc3QgRG9tRWxlbWVudCA9IHJlcXVpcmUoXCIuL2RvbUVsZW1lbnRcIik7XHJcblxyXG4vKipcclxuICogQ3JlYXRlcyBhbiBIVE1MIElucHV0LiBDb252ZW5pZW5jZSBjbGFzcy5cclxuICpcclxuICogQHBhcmFtIHtJbnB1dFR5cGV9IHR5cGUgVGhlIGlucHV0IHR5cGVcclxuICogQHBhcmFtIHtPYmplY3R9IGluQXR0cmlidXRlcyBUaGUgaW5wdXQgYXR0cmlidXRlc1xyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgaW5wdXQgPSBuZXcgSW5wdXQoKTtcclxuICovXHJcbmNsYXNzIElucHV0IGV4dGVuZHMgRG9tRWxlbWVudCB7XHJcblxyXG5cdCAgICAgICAgICAgICAgICBcclxuXHJcblx0Y29uc3RydWN0b3IoaW5UeXBlICAgICAgICAgICAsIGluQXR0cmlidXRlcyAgICAgICAgICwgc2hvdWxkQ3JlYXRlSWQgICAgICAgICAgPSB0cnVlKSB7XHJcblxyXG5cdFx0Y29uc3QgYXR0ciA9IE9iamVjdC5hc3NpZ24oe30sIGluQXR0cmlidXRlcywge3R5cGU6IGluVHlwZX0pO1xyXG5cdFx0c3VwZXIoXCJpbnB1dFwiLCBhdHRyLCBzaG91bGRDcmVhdGVJZCk7XHJcblxyXG5cdFx0dGhpcy50eXBlID0gaW5UeXBlO1xyXG5cclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0O1xyXG4iLCIvLyAgICAgIFxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbmNvbnN0IERvbUVsZW1lbnQgPSByZXF1aXJlKFwiLi9kb21FbGVtZW50XCIpO1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZXMgYW4gSFRNTCBMYWJlbC4gQ29udmVuaWVuY2UgY2xhc3MuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbkF0dHJpYnV0ZXMgVGhlIGxhYmVsIGF0dHJpYnV0ZXNcclxuICogQGV4YW1wbGVcclxuICogdmFyIGlucHV0ID0gbmV3IElucHV0KCk7XHJcbiAqL1xyXG5jbGFzcyBMYWJlbCBleHRlbmRzIERvbUVsZW1lbnQge1xyXG5cclxuXHQgICAgICAgICAgICAgICAgXHJcblxyXG5cdGNvbnN0cnVjdG9yKGluQXR0cmlidXRlcyAgICAgICAgICwgc2hvdWxkQ3JlYXRlSWQgICAgICAgICAgPSB0cnVlKSB7XHJcblxyXG5cdFx0c3VwZXIoXCJsYWJlbFwiLCBpbkF0dHJpYnV0ZXMsIHNob3VsZENyZWF0ZUlkKTtcclxuXHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBMYWJlbDtcclxuIiwiLy8gICAgICBcclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5jb25zdCBJbnB1dCA9IHJlcXVpcmUoXCIuL2lucHV0XCIpO1xyXG5jb25zdCBMYWJlbCA9IHJlcXVpcmUoXCIuL2xhYmVsXCIpO1xyXG5jb25zdCBGb3JtR3JvdXAgPSByZXF1aXJlKFwiLi9mb3JtR3JvdXBcIik7XHJcblxyXG4vKipcclxuICogQSBMYWJlbGVkSW5wdXQgcmVwcmVzZW50cyBhbiBpbnB1dCB3aXRoIGEgbGFiZWwuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbFRleHQgSW5wdXQgbGFiZWwuXHJcbiAqIEBwYXJhbSB7SW5wdXRUeXBlfSB0eXBlIElucHV0IHR5cGUuXHJcbiAqIEBwYXJhbSB7P09iamVjdH0gaW5wdXRBdHRyaWJ1dGVzIFRoZSBhdHRyaWJ1dGVzIHRoYXQgdGhlIGlucHV0IGVsZW1lbnQgd2lsbCBoYXZlXHJcbiAqIEBleGFtcGxlXHJcbiAqL1xyXG5jbGFzcyBMYWJlbGVkSW5wdXQge1xyXG5cclxuXHQgICAgICAgICAgICAgICAgICAgICBcclxuXHQgICAgICAgICAgICAgXHJcblx0ICAgICAgICAgICAgIFxyXG5cdCAgICAgICAgICAgICAgICAgICAgIFxyXG5cclxuXHRjb25zdHJ1Y3RvcihsYWJlbFRleHQgICAgICAgICwgdHlwZSAgICAgICAgICAgLCBpbnNpZGVHcm91cCAgICAgICAgICA9IHRydWUsIGlucHV0QXR0cmlidXRlcyAgICAgICAgICwgbGFiZWxBdHRyaWJ1dGVzICAgICAgICAgKSB7XHJcblxyXG5cdFx0Y29uc3QgYXR0ciA9IE9iamVjdC5hc3NpZ24oe30sIGlucHV0QXR0cmlidXRlcywge2NsYXNzOiBcImZvcm0tY29udHJvbFwifSk7XHJcblx0XHR0aGlzLmluc2lkZUdyb3VwID0gaW5zaWRlR3JvdXA7XHJcblx0XHR0aGlzLmlucHV0ID0gbmV3IElucHV0KHR5cGUsIGF0dHIsIGZhbHNlKTtcclxuXHJcblx0XHRjb25zdCBsYWJlbEF0dHIgPSBPYmplY3QuYXNzaWduKHt9LCBsYWJlbEF0dHJpYnV0ZXMpO1xyXG5cdFx0aWYgKHRoaXMuaW5wdXQuYXR0cmlidXRlcy5pZCkge1xyXG5cclxuXHRcdFx0bGFiZWxBdHRyLmZvciA9IHRoaXMuaW5wdXQuYXR0cmlidXRlcy5pZDtcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5sYWJlbCA9IG5ldyBMYWJlbChsYWJlbEF0dHIsIGZhbHNlKTtcclxuXHRcdHRoaXMubGFiZWwuc2V0Q29udGVudChsYWJlbFRleHQpO1xyXG5cclxuXHRcdGlmICh0aGlzLmluc2lkZUdyb3VwKSB7XHJcblxyXG5cdFx0XHR0aGlzLmZvcm1Hcm91cCA9IG5ldyBGb3JtR3JvdXAoe30sIGZhbHNlKTtcclxuXHRcdFx0dGhpcy5mb3JtR3JvdXAuYWRkQ29udGVudCh0aGlzLmxhYmVsLnJlbmRlcigpKTtcclxuXHRcdFx0dGhpcy5mb3JtR3JvdXAuYWRkQ29udGVudCh0aGlzLmlucHV0LnJlbmRlcigpKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlIEhUTUwgc3RyaW5nXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfSBgaHRtbGBcclxuXHQgKi9cclxuXHRyZW5kZXIoKSB7XHJcblxyXG5cdFx0aWYgKHRoaXMuaW5zaWRlR3JvdXApIHtcclxuXHJcblx0XHRcdHJldHVybiB0aGlzLmZvcm1Hcm91cC5yZW5kZXIoKTtcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0cmV0dXJuIGAke3RoaXMubGFiZWwucmVuZGVyKCl9JHt0aGlzLmlucHV0LnJlbmRlcigpfWA7XHJcblxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IExhYmVsZWRJbnB1dDtcclxuIiwiLy8gICAgICBcclxuXCJ1c2Ugc3RyaWN0XCI7XHJcbmNvbnN0IExhYmVsZWRJbnB1dCA9IHJlcXVpcmUoXCIuL2xhYmVsZWRJbnB1dFwiKTtcclxuY29uc3QgU2VsZWN0b3IgPSByZXF1aXJlKFwiLi9zZWxlY3RvclwiKTtcclxuY29uc3QgUmFkaW9Hcm91cCA9IHJlcXVpcmUoXCIuL3JhZGlvR3JvdXBcIik7XHJcbmNvbnN0IEJ1dHRvbiA9IHJlcXVpcmUoXCIuL2J1dHRvblwiKTtcclxuLy9jb25zdCBQcmludE1hcCA9IHJlcXVpcmUoXCIuLi91dGlscy9wcmludE1hcFwiKTtcclxuXHJcbi8qKlxyXG4gKiBBIElucHV0IGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbCBJbnB1dCBsYWJlbC5cclxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgSW5wdXQgdHlwZS5cclxuICogQGV4YW1wbGVcclxuICogdmFyIGxsID0gbmV3IExhdExvbig0Mi4xMDM3NiwgMS44NDU4NCk7XHJcbiAqL1xyXG5jbGFzcyBQcmludENvbnRyb2wge1xyXG5cclxuXHQgICAgICAgICAgICAgICAgICBcclxuXHQgICAgICAgICAgICAgICBcclxuXHQgICAgICAgICAgICAgICAgICAgXHJcblxyXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lciAgICAgICAgLCBjYW52YXMgICAgICAgICkge1xyXG5cclxuXHRcdHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xyXG5cdFx0dGhpcy5jYW52YXMgPSBjYW52YXM7XHJcblx0XHR0aGlzLmNvbnRyb2xzID0gdGhpcy5jcmVhdGVDb250cm9scygpO1xyXG5cclxuXHR9XHJcblxyXG5cdGNyZWF0ZUNvbnRyb2xzKCkge1xyXG5cclxuXHRcdHJldHVybiBbXHJcblx0XHRcdG5ldyBSYWRpb0dyb3VwKFwiTGF5b3V0XCIsIFtcclxuXHRcdFx0XHR7bGFiZWw6IFwiUG9ydHJhaXRcIiwgdmFsdWU6IFwicG9ydHJhaXRcIiwgc2VsZWN0ZWQ6IHRydWV9LFxyXG5cdFx0XHRcdHtsYWJlbDogXCJMYW5kc2NhcGVcIiwgdmFsdWU6IFwibGFuZHNjYXBlXCIsIHNlbGVjdGVkOiBmYWxzZX1cclxuXHRcdFx0XSwge25hbWU6IFwiaW5wdXRMYXlvdXRcIn0pLFxyXG5cdFx0XHRuZXcgU2VsZWN0b3IoXCJNaWRlc1wiLCBbXHJcblx0XHRcdFx0e2xhYmVsOlwiUGVyc29uYWxpdHphZGFcIiwgdmFsdWU6IFwiY3VzdG9tXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIkEyXCIsIHZhbHVlOiBcImEyXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIkEzXCIsIHZhbHVlOiBcImEzXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIkE0XCIsIHZhbHVlOiBcImE0XCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIkdhbGF4eSBTN1wiLCB2YWx1ZTogXCJzN1wifSxcclxuXHRcdFx0XHR7bGFiZWw6XCJHYWxheHkgUzhcIiwgdmFsdWU6IFwiczhcIn0sXHJcblx0XHRcdFx0e2xhYmVsOlwiR2FsYXh5IFM4K1wiLCB2YWx1ZTogXCJzOCtcIn0sXHJcblx0XHRcdFx0e2xhYmVsOlwiR2FsYXh5IE5vdGUgOFwiLCB2YWx1ZTogXCJuOFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCJpUGhvbmUgWFwiLCB2YWx1ZTogXCJpWFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCJIVEMgT25lIE04XCIsIHZhbHVlOiBcImh0Y09NOFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCJHYWxheHkgUzRcIiwgdmFsdWU6IFwiczRcIn0sXHJcblx0XHRcdFx0e2xhYmVsOlwiR2FsYXh5IFM1XCIsIHZhbHVlOiBcInM1XCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIlhpYW9taSBSZWFkbWkgTm90ZSA0NTBcIiwgdmFsdWU6IFwieHJuNDUwXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcImlQaG9uZSA4K1wiLCB2YWx1ZTogXCJpOCtcIn0sXHJcblx0XHRcdFx0e2xhYmVsOlwiTGVub3ZvIEs0IG5vdGVcIiwgdmFsdWU6IFwibGs0blwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCJHYWxheHkgTm90ZSAzXCIsIHZhbHVlOiBcImduM1wifSxcclxuXHRcdFx0XHR7bGFiZWw6XCJpUGhvbmUgNnNcIiwgdmFsdWU6IFwiaTZzXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcImlQaG9uZSA3XCIsIHZhbHVlOiBcImk3XCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcImlQaG9uZSA4XCIsIHZhbHVlOiBcImk4XCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIlhpYW9taSBSZWFkbWkgM3MgUHJpbWVcIiwgdmFsdWU6IFwieHIzcFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCJpUGhvbmUgNXNcIiwgdmFsdWU6IFwiaTVzXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcImlQaG9uZSA0c1wiLCB2YWx1ZTogXCJpNHNcIn1cclxuXHRcdFx0XSwge2lkOiBcImlucHV0TWlkYVwiLCBwbGFjZWhvbGRlcjogXCJTZWxlY2Npb25ldSBsYSBtaWRhXCJ9KSxcclxuXHRcdFx0bmV3IExhYmVsZWRJbnB1dChcIkFtcGxhZGFcIiwgXCJ0ZXh0XCIsIHRydWUsXHJcblx0XHRcdFx0e2lkOiBcImlucHV0QW1wbGFkYVwiLCBwbGFjZWhvbGRlcjogXCJ2YWxvciBlbiBtbVwifSksXHJcblx0XHRcdG5ldyBMYWJlbGVkSW5wdXQoXCJBbMOnYWRhXCIsIFwidGV4dFwiLCB0cnVlLFxyXG5cdFx0XHRcdHtpZDogXCJpbnB1dEFsY2FkYVwiLCBwbGFjZWhvbGRlcjogXCJ2YWxvciBlbiBtbVwifSksXHJcblx0XHRcdG5ldyBTZWxlY3RvcihcIkRQSVwiLCBbXHJcblx0XHRcdFx0e2xhYmVsOlwiMTUwXCIsIHZhbHVlOiBcIjE1MFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCIyNTRcIiwgdmFsdWU6IFwiMjU0XCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIjMwMFwiLCB2YWx1ZTogXCIzMDBcIn0sXHJcblx0XHRcdFx0e2xhYmVsOlwiNjAwXCIsIHZhbHVlOiBcIjYwMFwifVxyXG5cdFx0XHRdLCB7aWQ6IFwiaW5wdXREUElcIiwgcGxhY2Vob2xkZXI6IFwiU2VsZWNjaW9uZXUgbGEgcmVzb2x1Y2nDs1wifSksXHJcblx0XHRcdG5ldyBTZWxlY3RvcihcIkVzY2FsYVwiLCBbXHJcblx0XHRcdFx0e2xhYmVsOlwiUGVyc29uYWxpdHphZGFcIiwgdmFsdWU6IFwiY3VzdG9tXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIjUwMDBcIiwgdmFsdWU6IFwiNTAwMFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCIxMDAwMFwiLCB2YWx1ZTogXCIxMDAwMFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCIyNTAwMFwiLCB2YWx1ZTogXCIyNTAwMFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCI1MDAwMFwiLCB2YWx1ZTogXCI1MDAwMFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCIxMDAwMDBcIiwgdmFsdWU6IFwiMTAwMDAwXCJ9LFxyXG5cdFx0XHRcdHtsYWJlbDpcIjI1MDAwMFwiLCB2YWx1ZTogXCIyNTAwMDBcIn0sXHJcblx0XHRcdFx0e2xhYmVsOlwiNTAwMDAwXCIsIHZhbHVlOiBcIjUwMDAwMFwifSxcclxuXHRcdFx0XHR7bGFiZWw6XCIxMDAwMDAwXCIsIHZhbHVlOiBcIjEwMDAwMDBcIn0sXHJcblx0XHRcdFx0e2xhYmVsOlwiMjAwMDAwMFwiLCB2YWx1ZTogXCIyMDAwMDAwXCJ9LFxyXG5cdFx0XHRdLCB7aWQ6IFwiaW5wdXRFc2NhbGFcIiwgcGxhY2Vob2xkZXI6IFwiU2VsZWNjaW9uZXUgbCdlc2NhbGFcIn0pLFxyXG5cdFx0XHRuZXcgQnV0dG9uKHtpZDpcImlucHV0R2VuZXJhck1hcGFcIiwgdmFsdWU6XCJHZW5lcmFyIG1hcGFcIn0pXHJcblx0XHRdO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBIVE1MIHN0cmluZ1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3N0cmluZ30gYGh0bWxgXHJcblx0ICovXHJcblx0Z2V0SHRtbCgpIHtcclxuXHJcblx0XHRjb25zdCBhdHRTdHIgPSB0aGlzLmNvbnRyb2xzLm1hcCgoZWxlbWVudCkgPT4ge1xyXG5cclxuXHRcdFx0cmV0dXJuIGVsZW1lbnQucmVuZGVyKCk7XHJcblxyXG5cdFx0fSkuam9pbihcIlwiKTtcclxuXHJcblx0XHRyZXR1cm4gYXR0U3RyO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBIVE1MIHN0cmluZ1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3N0cmluZ30gYGh0bWxgXHJcblx0ICovXHJcblx0cmVuZGVyKGRvY3VtZW50KSB7XHJcblxyXG5cdFx0Y29uc3QgYXR0U3RyID0gdGhpcy5nZXRIdG1sKCk7XHJcblx0XHR0aGlzLmNvbnRhaW5lci5pbm5lckhUTUwgPSBhdHRTdHI7XHJcblxyXG5cdFx0dGhpcy5zaXplU2VsZWN0b3IgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2lucHV0TWlkYVwiKTtcclxuXHRcdHRoaXMud2lkdGhJbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjaW5wdXRBbXBsYWRhXCIpO1xyXG5cdFx0dGhpcy5oZWlnaHRJbnB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjaW5wdXRBbGNhZGFcIik7XHJcblx0XHR0aGlzLmRwaUlucHV0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNpbnB1dERQSVwiKTtcclxuXHRcdHRoaXMuYnV0dG9uSW5wdXQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2lucHV0R2VuZXJhck1hcGFcIik7XHJcblx0XHR0aGlzLmFkZEV2ZW50cygpO1xyXG5cclxuXHR9XHJcblxyXG5cdGFkZEV2ZW50cygpIHtcclxuXHJcblx0XHR0aGlzLnNpemVTZWxlY3Rvci5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHRoaXMuc2l6ZUNoYW5nZWQoKSk7XHJcblxyXG5cclxuXHR9XHJcblxyXG5cdHNpemVDaGFuZ2VkKCkge1xyXG5cclxuXHRcdGNvbnN0IHNpemUgPSB0aGlzLnNpemVTZWxlY3Rvci5vcHRpb25zW3RoaXMuc2l6ZVNlbGVjdG9yLnNlbGVjdGVkSW5kZXhdO1xyXG5cclxuXHRcdGlmIChzaXplID09PSBcImN1c3RvbVwiKSB7XHJcblxyXG5cdFx0XHR0aGlzLndpZHRoSW5wdXQuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcclxuXHRcdFx0dGhpcy5oZWlnaHRJbnB1dC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHR0aGlzLndpZHRoSW5wdXQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xyXG5cdFx0XHR0aGlzLmhlaWdodElucHV0LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcclxuXHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0YWRkRXZlbnRUb0J1dHRvbihkb2N1bWVudCxmdW5jdGlvbmNsaWNrKXtcclxuXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjaW5wdXRHZW5lcmFyTWFwYVwiKS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb25jbGljayk7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBQcmludENvbnRyb2w7XHJcbiIsIi8vICAgICAgXHJcblwidXNlIHN0cmljdFwiO1xyXG5jb25zdCBMYWJlbGVkSW5wdXQgPSByZXF1aXJlKFwiLi9sYWJlbGVkSW5wdXRcIik7XHJcbmNvbnN0IERpdiA9IHJlcXVpcmUoXCIuL2RpdlwiKTtcclxuY29uc3QgTGFiZWwgPSByZXF1aXJlKFwiLi9sYWJlbFwiKTtcclxuXHJcbi8qKlxyXG4gKiBBIFJhZGlvR3JvdXAgZWxlbWVudC5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGxhYmVsIElucHV0IGxhYmVsLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBJbnB1dCB0eXBlLlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgbGwgPSBuZXcgTGF0TG9uKDQyLjEwMzc2LCAxLjg0NTg0KTtcclxuICovXHJcbmNsYXNzIFJhZGlvR3JvdXAge1xyXG5cclxuXHQgICAgICAgICAgICAgICAgICAgICAgXHJcblx0ICAgICAgICAgICAgICAgICAgICBcclxuXHJcblx0Y29uc3RydWN0b3IobGFiZWwgICAgICAgICwgb3B0aW9ucyAgICAgICAgICAgICAgID0gW10sIGF0dHJpYnV0ZXMgICAgICAgICApIHtcclxuXHJcblx0XHR0aGlzLmNyZWF0ZU9wdGlvbnMob3B0aW9ucywgYXR0cmlidXRlcyk7XHJcblx0XHR0aGlzLmxhYmVsID0gbmV3IExhYmVsKHt9LCBmYWxzZSk7XHJcblx0XHR0aGlzLmxhYmVsLnNldENvbnRlbnQobGFiZWwpO1xyXG5cdFx0dGhpcy5kaXYgPSBuZXcgRGl2KHtjbGFzczogXCJmb3JtLWdyb3VwXCJ9LCBmYWxzZSk7XHJcblx0XHR0aGlzLmRpdi5zZXRDb250ZW50KHRoaXMubGFiZWwucmVuZGVyKCkpO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCB0aGUgaW5wdXQgYXR0cmlidXRlc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IGxhdFxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge1JhZGlvR3JvdXB9IGB0aGlzYFxyXG5cdCAqL1xyXG5cdGNyZWF0ZU9wdGlvbnMob3B0aW9ucyAgICAgICAgICAgICAgLCBhdHRyaWJ1dGVzICAgICAgICAgKSB7XHJcblxyXG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucy5tYXAoKGVsZW0pID0+IHtcclxuXHJcblx0XHRcdGNvbnN0IGVsZW1BdHRyaWJzID0gT2JqZWN0LmFzc2lnbih7fSwgYXR0cmlidXRlcywge3ZhbHVlOiBlbGVtLnZhbHVlfSk7XHJcblx0XHRcdGlmIChlbGVtLnNlbGVjdGVkKSB7XHJcblxyXG5cdFx0XHRcdGVsZW1BdHRyaWJzLmNoZWNrZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGVsZW0uaWQpIHtcclxuXHJcblx0XHRcdFx0ZWxlbUF0dHJpYnMuaWQgPSBlbGVtLmlkO1xyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIG5ldyBMYWJlbGVkSW5wdXQoZWxlbS5sYWJlbCwgXCJyYWRpb1wiLCBmYWxzZSwgZWxlbUF0dHJpYnMsIHtjbGFzczogXCJyYWRpby1pbmxpbmVcIn0pO1xyXG5cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBIVE1MIHN0cmluZ1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3N0cmluZ30gYGh0bWxgXHJcblx0ICovXHJcblx0cmVuZGVyKCkge1xyXG5cclxuXHRcdGNvbnN0IG9wdGlvbnNTdHIgPSB0aGlzLm9wdGlvbnMubWFwKChlbGVtKSA9PiB7XHJcblxyXG5cdFx0XHRyZXR1cm4gZWxlbS5yZW5kZXIoKTtcclxuXHJcblx0XHR9KS5qb2luKFwiXCIpO1xyXG5cclxuXHRcdHRoaXMuZGl2LmFkZENvbnRlbnQob3B0aW9uc1N0cik7XHJcblx0XHRyZXR1cm4gdGhpcy5kaXYucmVuZGVyKCk7XHJcblxyXG5cdH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUmFkaW9Hcm91cDtcclxuIiwiLy8gICAgICBcclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5jb25zdCByYW5kb20gPSByZXF1aXJlKFwiLi4vdXRpbHMvcmFuZG9tXCIpO1xyXG5cclxuLyoqXHJcbiAqIEEgSW5wdXQgZWxlbWVudC5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGxhYmVsIElucHV0IGxhYmVsLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBJbnB1dCB0eXBlLlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB2YXIgbGwgPSBuZXcgTGF0TG9uKDQyLjEwMzc2LCAxLjg0NTg0KTtcclxuICovXHJcbmNsYXNzIFNlbGVjdG9yIHtcclxuXHJcbiAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG5cdCAgICAgICAgICAgICAgICAgICAgXHJcblxyXG5cdGNvbnN0cnVjdG9yKGxhYmVsICAgICAgICAsIG9wdGlvbnMgICAgICAgICAgICAgICwgYXR0cmlidXRlcyAgICAgICAgICkge1xyXG5cclxuXHRcdHRoaXMubGFiZWwgPSBsYWJlbDtcclxuXHRcdHRoaXMuc2V0T3B0aW9ucyhvcHRpb25zKTtcclxuXHRcdHRoaXMuc2V0QXR0cmlidXRlcyhhdHRyaWJ1dGVzKTtcclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgdGhlIHNlbGVjdCBvcHRpb25zXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xyXG5cdCAqIEByZXR1cm5zIHtTZWxlY3Rvcn0gYHRoaXNgXHJcblx0ICovXHJcblx0c2V0T3B0aW9ucyhvcHRpb25zICAgICAgICAgKSB7XHJcblxyXG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucy5zbGljZSgwKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCB0aGUgc2VsZWN0IGF0dHJpYnV0ZXNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyaWJ1dGVzXHJcblx0ICogQHJldHVybnMge1NlbGVjdG9yfSBgdGhpc2BcclxuXHQgKi9cclxuXHRzZXRBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMgICAgICAgICApIHtcclxuXHJcblx0XHR0aGlzLmF0dHJpYnV0ZXMgPSBPYmplY3QuYXNzaWduKHt9LCBhdHRyaWJ1dGVzKTtcclxuXHRcdGlmICghdGhpcy5hdHRyaWJ1dGVzLmlkKSB7XHJcblxyXG5cdFx0XHR0aGlzLmF0dHJpYnV0ZXMuaWQgPSByYW5kb20uY3JlYXRlSWQoKTtcclxuXHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGUgSFRNTCBzdHJpbmdcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IGBodG1sYFxyXG5cdCAqL1xyXG5cdHJlbmRlcigpIHtcclxuXHJcblx0XHRjb25zdCBhdHRTdHIgPSBPYmplY3Qua2V5cyh0aGlzLmF0dHJpYnV0ZXMpLm1hcCgoa2V5KSA9PiB7XHJcblxyXG5cdFx0XHRyZXR1cm4gYCR7a2V5fT1cIiR7dGhpcy5hdHRyaWJ1dGVzW2tleV19XCJgO1xyXG5cclxuXHRcdH0pLmpvaW4oXCIgXCIpO1xyXG5cdFx0Y29uc3Qgb3B0U3RyID0gdGhpcy5vcHRpb25zLm1hcCgoZWxlbWVudCkgPT4ge1xyXG5cclxuXHRcdFx0cmV0dXJuIGA8b3B0aW9uIHZhbHVlPVwiJHtlbGVtZW50LnZhbHVlfVwiPiR7ZWxlbWVudC5sYWJlbH08L29wdGlvbj5gO1xyXG5cclxuXHRcdH0pLmpvaW4oXCJcIik7XHJcblx0XHRyZXR1cm4gYDxkaXYgY2xhc3M9XCJmb3JtLWdyb3VwXCI+PGxhYmVsIGZvcj1cIiR7dGhpcy5hdHRyaWJ1dGVzLmlkfVwiPiR7dGhpcy5sYWJlbH08L2xhYmVsPjxzZWxlY3QgY2xhc3M9XCJmb3JtLWNvbnRyb2xcIiAke2F0dFN0cn0+JHtvcHRTdHJ9PC9zZWxlY3Q+PC9kaXY+YDtcclxuXHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTZWxlY3RvcjtcclxuIiwiLy8gICAgICBcclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogQSBzaWRlYmFyIGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gdmlzaWJpbGl0eSBTaWRlYmFyIHZpc2liaWxpdHkuXHJcbiAqIEBwYXJhbSB7UG9zaXRpb25UeXBlfSBwb3NpdGlvbiBTaWRlYmFyIHBvc2l0aW9uLlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVyIFNpZGViYXIgaGVhZGVyLlxyXG4gKiBAcGFyYW0gez9PYmplY3R9IGNvbXBvbmVudHMgU2lkZWJhciBjb21wb25lbnRzLlxyXG4gKiBAZXhhbXBsZVxyXG4gKiBuZXcgU2lkZWJhcihmYWxzZSwgXCJsZWZ0XCIsIFwiSGVhZGVyXCIsXCI8aW5wdXQgdHlwZT1cXFwidGV4dFxcXCIgaWQ9XFxcImlkXFxcIiB2YWx1ZT1cXFwidmFsdWVcXFwiPlwiKTtcclxuICovXHJcbmNsYXNzIFNpZGViYXIge1xyXG5cclxuXHQgICAgICAgICAgICAgICAgICAgIFxyXG5cdCAgICAgICAgICAgICAgICAgICAgICAgXHJcblx0ICAgICAgICAgICAgICAgICAgICBcclxuXHQgICAgICAgICAgICAgICBcclxuXHJcblx0Y29uc3RydWN0b3IodmlzaWJpbGl0eSAgICAgICAgICwgcG9zaXRpb24gICAgICAgICAgICAgICwgaGVhZGVyICAgICAgICAsIGNvbXBvbmVudCAgICAgICAgICkge1xyXG5cclxuXHRcdHRoaXMudmlzaWJpbGl0eSA9IHZpc2liaWxpdHk7XHJcblx0XHR0aGlzLnBvc2l0aW9uID0gcG9zaXRpb247XHJcblx0XHRpZiAodW5kZWZpbmVkICE9PSBjb21wb25lbnQpIHtcclxuXHJcblx0XHRcdGlmICh1bmRlZmluZWQgIT09IHRoaXMuY29tcG9uZW50cykge1xyXG5cclxuXHRcdFx0XHR0aGlzLmNvbXBvbmVudHMgPSBgJHt0aGlzLmNvbXBvbmVudHN9JHtjb21wb25lbnR9YDtcclxuXHJcblx0XHRcdH0gZWxzZSAge1xyXG5cclxuXHRcdFx0XHR0aGlzLmNvbXBvbmVudHMgPSBjb21wb25lbnQ7XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdHRoaXMuY29tcG9uZW50cyA9IFwiXCI7XHJcblxyXG5cdFx0fVxyXG5cdFx0aWYgKHVuZGVmaW5lZCAhPT0gaGVhZGVyKSB7XHJcblxyXG5cdFx0XHR0aGlzLmhlYWRlciA9IGhlYWRlcjtcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0dGhpcy5oZWFkZXIgPSBcIlwiO1xyXG5cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRoaWRlKGRvY3VtZW50KSB7XHJcblxyXG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XHJcblx0XHRzZWxmLnZpc2liaWxpdHkgPSBmYWxzZTtcclxuXHRcdGlmICh1bmRlZmluZWQgIT09IGRvY3VtZW50KSB7XG5cclxuXHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImJvZHlcIikuaW5uZXJIVE1MID0gc2VsZi5yZW5kZXIoKTtcclxuXHRcdFx0c2VsZi5hZGRFdmVudFRvQnV0dG9uKGRvY3VtZW50KTtcclxuXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdHNob3coZG9jdW1lbnQpIHtcclxuXHJcblx0XHRjb25zdCBzZWxmID0gdGhpcztcclxuXHRcdHNlbGYudmlzaWJpbGl0eSA9IHRydWU7XHJcblx0XHRpZiAodW5kZWZpbmVkICE9PSBkb2N1bWVudCkge1xuXHJcblx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJib2R5XCIpLmlubmVySFRNTCA9IHNlbGYucmVuZGVyKCk7XHJcblx0XHRcdHNlbGYuYWRkRXZlbnRUb0J1dHRvbihkb2N1bWVudCk7XHJcblxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHRzZXRQb3NpdGlvbihwb3NpdGlvbiAgICAgICAgICAgICAgKSB7XHJcblxyXG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XHJcblx0XHRzZWxmLnBvc2l0aW9uID0gcG9zaXRpb247XHJcblxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBjb21wb25lbnQgdG8gc2lkZWJhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHs/T2JqZWN0fSBjb21wb25lbnRcclxuXHQgKi9cclxuXHRhZGRDb21wb25lbnQoY29tcG9uZW50ICAgICAgICAgKSB7XHJcblxyXG5cdFx0aWYgKHVuZGVmaW5lZCAhPT0gY29tcG9uZW50KSB7XHJcblxyXG5cdFx0XHRpZiAodW5kZWZpbmVkICE9PSB0aGlzLmNvbXBvbmVudHMpIHtcclxuXHJcblx0XHRcdFx0dGhpcy5jb21wb25lbnRzID0gYCR7dGhpcy5jb21wb25lbnRzfSR7Y29tcG9uZW50fWA7XHJcblxyXG5cdFx0XHR9IGVsc2UgIHtcclxuXHJcblx0XHRcdFx0dGhpcy5jb21wb25lbnRzID0gY29tcG9uZW50O1xyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBZGQgaGVhZGVyIHRvIHNpZGViYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJcclxuXHQgKi9cclxuXHRhZGRIZWFkZXIoaGVhZGVyICAgICAgICApIHtcclxuXHJcblx0XHR0aGlzLmhlYWRlciA9IGhlYWRlcjtcclxuXHJcblx0fVxyXG5cclxuXHRhZGRFdmVudFRvQnV0dG9uKGRvY3VtZW50KSB7XHJcblxyXG5cdFx0Y29uc3Qgc2VsZiA9IHRoaXM7XHJcblx0XHRpZiAodW5kZWZpbmVkICE9PSBkb2N1bWVudCkge1xuXHJcblx0XHRcdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwic2lkZWJhckNvbGxhcHNlXCIpLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRcdHNlbGYuY2hhbmdlVmlzaWJpbGl0eShkb2N1bWVudCk7XHJcblxyXG5cdFx0XHR9O1xyXG5cblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0Y2hhbmdlVmlzaWJpbGl0eShkb2N1bWVudCkge1xyXG5cclxuXHRcdGNvbnN0IHNlbGYgPSB0aGlzO1xyXG5cdFx0Ly8gb3BlbiBvciBjbG9zZSBuYXZiYXJcclxuXHRcdGlmICghc2VsZi52aXNpYmlsaXR5KSB7XHJcblxyXG5cdFx0XHRzZWxmLnNob3coZG9jdW1lbnQpO1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRzZWxmLmhpZGUoZG9jdW1lbnQpO1xyXG5cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBIVE1MIHN0cmluZ1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3N0cmluZ30gYGh0bWxgXHJcblx0ICovXHJcblx0cmVuZGVyKCkge1xyXG5cclxuXHRcdGNvbnN0IGh0bWwgPSBgPGRpdiBjbGFzcz1cIndyYXBwZXIgIHNpZGViYXItJHt0aGlzLnBvc2l0aW9ufVwiPmAgK1xyXG5cdFx0XHRcdFx0XHRgPG5hdiBpZD1cInNpZGViYXJcIiBjbGFzcz1cIiR7dGhpcy52aXNpYmlsaXR5ID8gXCJhY3RpdmVcIiA6IFwidW5hY3RpdmVcIn1cIj5gICtcclxuXHRcdFx0XHRcdFx0XCI8IS0tIFNpZGViYXIgSGVhZGVyIC0tPlwiICtcclxuXHRcdFx0XHRcdFx0XHRcIjxkaXYgY2xhc3M9XFxcInNpZGViYXItaGVhZGVyXFxcIj5cIiArXHJcblx0XHRcdFx0XHRcdFx0XHRgPHNwYW4gY2xhc3M9XCJ0aXRsZVwiPiR7dGhpcy5oZWFkZXJ9PC9zcGFuPmAgK1xyXG5cdFx0XHRcdFx0XHRcdFwiPC9kaXY+XCIgK1xyXG5cdFx0XHRcdFx0XHRcdFwiPGRpdiBjbGFzcz1cXFwic2lkZWJhci1ib2R5XFxcIj5cIiArXHJcblx0XHRcdFx0XHRcdFx0XHRgJHt0aGlzLmNvbXBvbmVudHN9YCArXHJcblx0XHRcdFx0XHRcdFx0XCI8L2Rpdj5cIiArXHJcblx0XHRcdFx0XHRcdFwiPC9uYXY+XCIgK1xyXG5cdFx0XHRcdFx0XCI8L2Rpdj5cIiArXHJcblx0XHRcdFx0XHRgPGRpdiBpZD1cImNvbnRlbnRcIiBjbGFzcz1cInNpZGViYXItJHt0aGlzLnBvc2l0aW9ufVwiPmAgK1xyXG5cdFx0XHRcdFx0XHRcIjxidXR0b24gdHlwZT1cXFwiYnV0dG9uXFxcIiBpZD1cXFwic2lkZWJhckNvbGxhcHNlXFxcIiBjbGFzcz1cXFwiYnRuIGJ0bi1pbmZvIG5hdmJhci1idG5cXFwiPlwiICtcclxuXHRcdFx0XHRcdFx0XHRgJHt0aGlzLnZpc2liaWxpdHkgPyBcIj5cIiA6IFwiPFwifWAgK1xyXG5cdFx0XHRcdFx0XHRcIjwvYnV0dG9uPlwiICtcclxuXHRcdFx0XHRcdFwiPGRpdj5cIjtcclxuXHRcdHJldHVybiBodG1sO1xyXG5cclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNpZGViYXI7XHJcbiIsIi8vICAgICAgXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxuY29uc3QgdXVpZCA9IHJlcXVpcmUoXCJ1dWlkXCIpO1xyXG5cclxuY2xhc3MgUmFuZG9tIHtcclxuXHJcblx0c3RhdGljIGNyZWF0ZUlkKCkge1xyXG5cclxuXHRcdHJldHVybiB1dWlkKCk7XHJcblxyXG5cdH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUmFuZG9tO1xyXG4iXX0=
