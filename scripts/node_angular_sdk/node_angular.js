var fs = require('fs');
var CodeGen = require('swagger-js-codegen').CodeGen;

var file = process.argv[2];
var swagger = JSON.parse(fs.readFileSync(file, 'UTF-8'));
var nodejsSourceCode = CodeGen.getNodeCode({ className: 'Quantimodo', swagger: swagger });
var angularjsSourceCode = CodeGen.getAngularCode({ className: 'Quantimodo', swagger: swagger });
fs.writeFile(process.argv[3], nodejsSourceCode, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("NodeJS file was saved!");
});
fs.writeFile(process.argv[4], angularjsSourceCode, function(err) {
    if(err) {
        return console.log(err);
    }

    console.log("AngularJS file was saved!");
});