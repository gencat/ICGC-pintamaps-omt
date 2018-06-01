var fs = require('fs');
var XLSX = require('xlsx');

var xls_entrada = "data/estilPintamaps.xlsx";
var XSLX_SHEET_line = "FINAL_ok";
var estil_salida = "estil/pintamapsGroups.json";

var workbook = XLSX.readFile(xls_entrada);
var worksheet_line = workbook.Sheets[XSLX_SHEET_line];
var json_entrada_line = XLSX.utils.sheet_to_json(worksheet_line);

console.log(json_entrada_line);

var group_styles = {};

json_entrada_line.forEach(element => {
    let id = "ul_" + element.GRUP + "_" + element.SUBGRUP;
    if (!(id in group_styles)){
        group_styles[id] = {
            label: element.ETIQUETASUB,
            elements: []
        };
    }
    group_styles[id].elements.push({
        id: element.ID,
        color: "paint."+element.PAINT 
    });
});

fs.writeFile(estil_salida, JSON.stringify(group_styles, null, 4), (err) => {
	if (err) throw err;
	console.log('estil done!');
});