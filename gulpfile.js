const gulp = require('gulp');
const rename = require('gulp-rename');
const fs = require('fs');
const runSequence = require('run-sequence');
const git = require('gulp-git');
const download = require('gulp-download-stream');
const path = require('path')
const rp = require('request-promise');
const ignore = require('gulp-ignore');
const del = require('del');
const decompress = require('gulp-decompress');
const bugsnag = require("bugsnag");
var downloadFile = require('download-file');
bugsnag.register("ae7bc49d1285848342342bb5c321a2cf");
process.on('unhandledRejection', function (err) {
    console.error("Unhandled rejection: " + (err && err.stack || err));
    bugsnag.notify(err);
});
bugsnag.onBeforeNotify(function (notification) {
    const metaData = notification.events[0].metaData;
    // modify meta-data
    metaData.subsystem = { name: "Your subsystem name" };
});
function isTruthy(value) {return (value && value !== "false");}
const debug = isTruthy(process.env.DEBUG);
const sdksZippedRelativePath = "./sdks-zipped";
const sdksUnzippedPath = "./sdks-unzipped";
const sdksReposPath = './sdk-repos';
let languages = [
    "akka-scala",
    "android",
    //"async-scala",
    "csharp",
    //"CsharpDotNet2",
    "dart",
    "dynamic-html",
    "flash",
    "go",
    "html",
    "inflector",
    "java",
    "javascript",
    //"javascript-closure-angular",
    "jaxrs",
    "objc",
    "perl",
    "php",
    "python",
    "qt5cpp",
    "ruby",
    "scala",
    "scalatra",
    "sinatra",
    "swift",
    "tizen",
    "typescript-angular",
    //"typescript-angular2",
    //"typescript-fetch",
    "typescript-node"
];
const sdkSwaggerCodegenOptions = {
    "php": {
        "invokerPackage": "QuantiModo\\Client",
        "composerProjectName": "quantimodo-sdk-php",
        "composerVendorName": "quantimodo",
        "modelPackage": "Model",
        "apiPackage": "Api",
        "packagePath": "QuantiModoClient"
    },
    "javascript": {
        //"projectName": "quantimodo",
    },
    "ruby": {
        "gemName": "quantimodoApi",
        "moduleName": "QuantiModoApi",
        "gemVersion": getAppVersionNumber(),
        "gemHomepage": "https://quantimo.do",
        "gemSummary": "A ruby wrapper for the QuantiModo API",
        "gemDescription": "A ruby wrapper for the QuantiModo API",
        "gemAuthor": "Mike P. Sinn",
        "gemAuthorEmail": "mike@quantimo.do"
    },
    "typescript-node": {
        supportsES6: true
    },
    "typescript-angular": {
        supportsES6: true
    },
    "typescript-angularjs": {
        supportsES6: true
    },
    "typescript-fetch": {
        supportsES6: true
    }
};
const majorMinorVersionNumbers = '5.11.';
function getPatchVersionNumber() {
    const date = new Date();
    const monthNumber = (date.getMonth() + 1).toString();
    const dayOfMonth = ('0' + date.getDate()).slice(-2);
    const hourOfDay = date.getHours();
    const hourOfDayString = ('0' + hourOfDay).slice(-2);
    //hourOfDayString = "72"; // Manually set if need to release more than once per hour
    return monthNumber + dayOfMonth + hourOfDayString;
}
const apiVersionNumber = majorMinorVersionNumbers + getPatchVersionNumber();
logInfo("API version is " + apiVersionNumber);
function obfuscateSecrets(object){
    if(typeof object !== 'object'){return object;}
    object = JSON.parse(JSON.stringify(object)); // Decouple so we don't screw up original object
    for (let propertyName in object) {
        if (object.hasOwnProperty(propertyName)) {
            const lowerCaseProperty = propertyName.toLowerCase();
            if(lowerCaseProperty.indexOf('secret') !== -1 || lowerCaseProperty.indexOf('password') !== -1 || lowerCaseProperty.indexOf('token') !== -1){
                object[propertyName] = "HIDDEN";
            } else {
                object[propertyName] = obfuscateSecrets(object[propertyName]);
            }
        }
    }
    return object;
}
function prettyJSONStringify(object, spaces) {
    if(!spaces){spaces = 2;}
    return JSON.stringify(object, null, spaces);
}
function obfuscateStringify(message, object) {
    let objectString = '';
    if(object){
        object = obfuscateSecrets(object);
        objectString = ':  ' + prettyJSONStringify(object);
    }
    message += objectString;
    if(process.env.QUANTIMODO_CLIENT_SECRET){message = message.replace(process.env.QUANTIMODO_CLIENT_SECRET, 'HIDDEN');}
    if(process.env.AWS_SECRET_ACCESS_KEY){message = message.replace(process.env.AWS_SECRET_ACCESS_KEY, 'HIDDEN');}
    if(process.env.ENCRYPTION_SECRET){message = message.replace(process.env.ENCRYPTION_SECRET, 'HIDDEN');}
    if(process.env.QUANTIMODO_ACCESS_TOKEN){message = message.replace(process.env.QUANTIMODO_ACCESS_TOKEN, 'HIDDEN');}
    return message;
}
function logDebug(message, object) {if(debug){logInfo(message, object);}}
function logInfo(message, object) {console.log(obfuscateStringify(message, object));}
function logError(message, object) {
    console.error(obfuscateStringify(message, object));
    bugsnag.notify(new Error(obfuscateStringify(message), obfuscateSecrets(object)));
}
function getAppVersionNumber() {
    const date = new Date();
    const monthNumber = (date.getMonth() + 1).toString();
    const dayOfMonth = ('0' + date.getDate()).slice(-2);
    const majorMinorVersionNumbers = '5.8.';
    const patchVersionNumber = monthNumber + dayOfMonth;
    return majorMinorVersionNumbers + patchVersionNumber;
}
function executeCommand(command, callback) {
    logInfo(command);
    const exec = require('child_process').exec;
    exec(command, function (err, stdout, stderr) {
        logInfo(stdout);
        if(stderr){logError(stderr);}
        if(callback){callback(err);}
    });
}
const swaggerJsonUrl = 'https://raw.githubusercontent.com/QuantiModo/docs/master/swagger/swagger.json';
//swaggerJsonUrl = 'https://utopia.quantimo.do:4443/api/docs/swagger/swagger.json';
function clone(organization, repoName, destinationFolder, callback){
    const repoUrl = 'https://github.com/' + organization + '/' + repoName;
    const repoFolder = destinationFolder + '/' + repoName;
    logInfo("Cloning " + repoUrl + " to " + destinationFolder + '/' + repoName);
    return git.clone(repoUrl, {args: repoFolder}, function (err) {
        if (err) {logError(err);} else {logInfo("Cloned " + repoUrl + " to " + destinationFolder + '/' + repoName);}
        if(callback){callback();}
    });
}
function cleanOneFolderExceptGit(folderToClean) {
    logInfo("cleaning " + folderToClean + ' and ignoring git stuff');
    return del([
        folderToClean + '/**/*',
        // we don't want to clean this file though so we negate the pattern
        '!' + folderToClean + '/.git',
        '!' + folderToClean + '/.git/**/*',
        '!' + folderToClean + '/.git*',
        '!' + folderToClean + '/README.md',
        '!' + folderToClean + '/LICENSE',
        '!' + folderToClean + '/bower.json',
        '!' + folderToClean + '/package.json',
        '!' + folderToClean + '/composer.json',
        '!' + folderToClean + '/quantimodo-api.js'
    ]);
}
function copyOneFoldersContentsToAnotherExceptReadme(sourceFolderPath, destinationFolderPath) {
    logInfo("Copying " + sourceFolderPath + " to " + destinationFolderPath);
    return gulp.src([sourceFolderPath + '/**/*', '!README.md'])
        .pipe(gulp.dest(destinationFolderPath));
}
function copyOneFoldersContentsToAnother(sourceFolderPath, destinationFolderPath) {
    logInfo("Copying " + sourceFolderPath + " to " + destinationFolderPath);
    return gulp.src([sourceFolderPath + '/**/*'])
        .pipe(gulp.dest(destinationFolderPath));
}
function getZipPathForLanguage(language) {
    return path.resolve(sdksZippedRelativePath + '/' + getSdkNameForLanguage(language) + '.zip');
}
function writeToFile(filePath, stringContents, callback) {
    logDebug("Writing to " + filePath);
    if(typeof stringContents !== "string"){stringContents = JSON.stringify(stringContents);}
    return fs.writeFile(filePath, stringContents, {}, callback);
}
function getSdkNameForLanguage(languageName) {
    return 'quantimodo-sdk-' + languageName;
}
function getUnzippedPathForSdkLanguage(languageName) {
    return sdksUnzippedPath + '/' + languageName + '-client';
}
function getRepoRelativePathForSdkLanguage(languageName) {
    return sdksReposPath + '/' + getSdkNameForLanguage(languageName);
}
const pathToIonic = '../../../public/ionic/Modo';
const pathToLaravel = '../../../laravel';
function readJsonFile(pathToFile) {
    logInfo("Reading " + pathToFile);
    return JSON.parse(fs.readFileSync(pathToFile, 'utf8'));
}
const pathToSwaggerJson = "swagger/swagger.json";
const swaggerJson = readJsonFile(pathToSwaggerJson);
function unzipFileToFolder(sourceFile, destinationFolder) {
    logInfo('Unzipping files in ' + sourceFile + ' to output path ' + destinationFolder);
    return gulp.src(sourceFile)
        .pipe(decompress())
        .pipe(gulp.dest(destinationFolder));
}
const pathToQmDocker = "../../..";
const pathToQuantiModoNodeModule = 'node_modules/quantimodo';
String.prototype.replaceAll = function(search, replacement) {
    const target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
let javascriptFlavor = 'javascript';
gulp.task('js-sdk-browserify-unzipped', [], function (callback) {
    browserify(getUnzippedPathForSdkLanguage(javascriptFlavor), callback);
});
gulp.task('js-sdk-browserify-repo', [], function (callback) {
    browserify(getRepoRelativePathForSdkLanguage(javascriptFlavor), callback);
});
function browserify(path, callback){
    const sourceFile = 'src/index.js';
    const outputFile = 'quantimodo-web.js';
    executeCommand('cd ' + path + ' && npm install -g browserify && browserify ' +
        sourceFile + ' --standalone Quantimodo > ' + outputFile, function () {
        callback();
    });
}
gulp.task('js-5-release', [], function (callback) {
    executeCommand("cd " + getRepoRelativePathForSdkLanguage(javascriptFlavor) +
        //' && npm install' +
        ' && git checkout HEAD -- README.md' +
        ' && git checkout HEAD -- package.json' +
        ' && git add .' +
        ' && git commit -m "' + apiVersionNumber + '"' +
        ' && git push' +
        ' && git tag ' + apiVersionNumber +
        ' && git push origin ' + apiVersionNumber +
        ' && bower version ' + apiVersionNumber, function () {
        executeCommand("cd " + getRepoRelativePathForSdkLanguage(javascriptFlavor) + " && npm version " + apiVersionNumber +
            ' && npm publish && git push && git push origin ' + apiVersionNumber, function () {
            //updateBowerAndPackageJsonVersions(pathToQmDocker);
            //updateBowerAndPackageJsonVersions(pathToIonic);
            //updateBowerAndPackageJsonVersions(".");
            callback();
        });
    });
});
gulp.task('clean-folders', [], function () {
    return del([
        sdksZippedRelativePath + '/**/*',
        sdksUnzippedPath + '/**/*',
        sdksReposPath + '/**/*'
    ]);
});
let laravelVendorPath = pathToQmDocker + '/laravel/vendor/quantimodo/quantimodo-sdk-php';
gulp.task('clean-laravel-vendor', [], function () {
    return del([laravelVendorPath + '/**/*'], {force: true});
});
gulp.task('clean-unzipped-folders', [], function () {
    return del([
        sdksUnzippedPath + '/**/*',
    ]);
});
gulp.task('clone-repos', [], function (callback) {
    for(let i = 0; i < languages.length; i++){
        if(i === languages.length - 1){
            clone('quantimodo', getSdkNameForLanguage(languages[i]), sdksReposPath, callback);
        } else {
            clone('quantimodo', getSdkNameForLanguage(languages[i]), sdksReposPath);
        }
    }
});
gulp.task('clean-folders-and-clone-repos', function (callback) { // Must be run before `gulp updateSdks` because I can't get it to wait for cloning to complete
    runSequence(
        'clean-folders',
        'clone-repos',
        function (error) {
            if (error) {logError(error.message);} else {logInfo('SDK RELEASE FINISHED SUCCESSFULLY');}
            callback(error);
        });
});
gulp.task('clean-repos-except-git', [], function(){
    for(let i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){ return cleanOneFolderExceptGit(getRepoRelativePathForSdkLanguage(languages[i]));}
        cleanOneFolderExceptGit(getRepoRelativePathForSdkLanguage(languages[i]));
        executeCommand("cd " + getRepoRelativePathForSdkLanguage(languages[i]) + " && git pull");
    }
});
function getGlobalSwaggerRequestOptions(language, useLocalSpec) {
    let opt = {
        method: 'POST',
            uri: 'http://generator.swagger.io/api/gen/clients/' + language,
        body: {
        },
        json: true // Automatically stringifies the body to JSON
    };
    if(useLocalSpec){
        opt.body.spec = require('./swagger/swagger.json');
    } else {
        opt.body.swaggerUrl = swaggerJsonUrl;
    }
    return opt;
}
let language = "javascript";
function getSwaggerDownloadRequestOptions(language, useLocalSpec) {
    const opts = getGlobalSwaggerRequestOptions(language, useLocalSpec);
    if (sdkSwaggerCodegenOptions[language]) {
        opts.body.options = sdkSwaggerCodegenOptions[language];
    } else {
        opts.body.options = {};
        opts.body.options.apiPackage = "QuantiModoApi";
        opts.body.options.artifactId = "quantimodoApi";
        opts.body.options.authorEmail = "mike@quantimo.do";
        opts.body.options.authorName = "Mike P. Sinn";
        opts.body.options.classPrefix = "QM";
        opts.body.options.developerEmail = "mike@quantimo.do";
        opts.body.options.developerName = "Mike P. Sinn";
        opts.body.options.invokerPackage = (sdkSwaggerCodegenOptions[language] && sdkSwaggerCodegenOptions[language].invokerPackage) ? sdkSwaggerCodegenOptions[language].invokerPackage : "quantimodoApi";
        opts.body.options.modelPackage = "quantimodoApi";
        opts.body.options.moduleName = "quantimodoApi";
        opts.body.options.packageName = "quantimodo_api";
        opts.body.options.packagePath = "QuantiModoClient";
        opts.body.options.podName = "QuantiModoApi";
        //requestOptions.body.options.podVersion = getAppVersionNumber();
        opts.body.options.projectName = (sdkSwaggerCodegenOptions[language] && sdkSwaggerCodegenOptions[language].projectName) ? sdkSwaggerCodegenOptions[language].projectName : "quantimodoApi";
    }
    //requestOptions.body.options.artifactVersion = requestOptions.body.options.projectVersion = requestOptions.body.options.packageVersion = requestOptions.body.options.podVersion = getAppVersionNumber();
    opts.body.options.artifactDescription = opts.body.options.projectDescription = swaggerJson.info.description;
    return opts;
}
function downloadSdk(opts, language, cb){
    rp(opts).then(function(res){
        const downloadLink = res.link.replace('https', 'http');
        let filename = getSdkNameForLanguage(language) + '.zip';
        console.info(`Downloading ${downloadLink}...`)
        downloadFile(downloadLink, {
            directory: sdksZippedRelativePath,
            filename: filename
        }, function(err){
            if(err) throw err
            console.log(`Downloaded ${filename}!`)
            cb();
        })
    });
}
// This function handles arrays and objects
function deleteKeyRecursively(obj, keyToDelete){
    for (var key in obj){
        if(!obj.hasOwnProperty(key)){
            continue;
        }
        if(key === keyToDelete){
            if(obj.description){
                obj.description = "Options: "+obj[keyToDelete].join(", ");
            }
            delete obj[keyToDelete]
        }
        if(typeof obj[key] == "object" && obj[key] !== null) {
            deleteKeyRecursively(obj[key], keyToDelete);
        }
    }
}
function generateOptionsAndDownloadSdk(language, localSpec, cb){
    const opts = getSwaggerDownloadRequestOptions(language, localSpec);
    if(debug){outputAvailableOptionsForLanguage(language, localSpec);}
    if(localSpec){
        opts.spec = require('./swagger/swagger.json');
        console.info("Deleting enum's because they break the typescript generator")
        deleteKeyRecursively(opts.spec, "enum")
        logInfo("Generating " + language + " sdk using local swagger.json");
    }else{
        logInfo("Generating " + language + " sdk using " +  swaggerJsonUrl);
    }
    downloadSdk(opts, language, cb);
}
gulp.task('generateExpressServer', [], function () {
    const path = require('path');
    const codegen = require('swagger-node-codegen');
    const swagger = require('./swagger/swagger.json');
    codegen.generate({
        swagger,
        target_dir: path.resolve(__dirname, './sdks-unzipped/'+getSdkNameForLanguage(language))
    }).then(() => {
        console.log('Done!');
    }).catch(err => {
        console.error(`Something went wrong: ${err.message}`);
    });
});
function outputAvailableOptionsForLanguage(language) {
    const opts = getGlobalSwaggerRequestOptions(language);
    opts.method = "GET";
    return rp(opts)
        .then(function (parsedBody) {
            logInfo("Available swagger config options for " + language, parsedBody);
        })
        .catch(function (err) {
            logError(err.error.message);
        });
}
//gulp.task('0-download', ['clean-folders-and-clone-repos'], function () {
gulp.task('0-download', ['clean-unzipped-folders'], function () {
    logInfo("Generating sdks with " + swaggerJsonUrl);
    logInfo("See https://github.com/swagger-api/swagger-codegen/tree/master/modules/swagger-codegen/src/main/java/io/swagger/codegen/languages for available clients");
    for(let i = 0; i < languages.length; i++){
        if(i === languages.length - 1){ return generateOptionsAndDownloadSdk(languages[i]);}
        generateOptionsAndDownloadSdk(languages[i]);
    }
});
//var javascriptFlavor = 'typescript-fetch';
gulp.task('js-1-download', [], function () {
    languages = [javascriptFlavor];
    return generateOptionsAndDownloadSdk(javascriptFlavor, true);
});
gulp.task('php-0-sdk-download', [], function () {
    languages = ['php'];
    logInfo("Generating " + language + " sdk using " +  swaggerJsonUrl);
    return generateOptionsAndDownloadSdk('php');
});
gulp.task('1-decompress', [], function () {
    for(let i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return unzipFileToFolder(getZipPathForLanguage(languages[i]), sdksUnzippedPath);
        }
        unzipFileToFolder(getZipPathForLanguage(languages[i]), sdksUnzippedPath);
    }
});
gulp.task('js-2-unzip', [], function () {
    return unzipFileToFolder(getZipPathForLanguage(javascriptFlavor), sdksUnzippedPath);
});
gulp.task('php-1-unzip', [], function () {
    return unzipFileToFolder(getZipPathForLanguage('php'), sdksUnzippedPath);
});
function copyUnzippedJsSdkToRepo(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(javascriptFlavor), getRepoRelativePathForSdkLanguage(javascriptFlavor));
}
function copyUnzippedJsSdkToApiDocsNodeModules(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(javascriptFlavor), pathToQuantiModoNodeModule);
}
function copyUnzippedJsSdkToIonicSrcLibForTesting(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(javascriptFlavor), pathToIonic+'/src/lib/quantimodo');
}
gulp.task('js-copy-to-src-lib', [], function(){
    return copyUnzippedJsSdkToIonicSrcLibForTesting();
});
function copySdksFromUnzippedPathToRepos(){
    for(let i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return copyOneFoldersContentsToAnotherExceptReadme(getUnzippedPathForSdkLanguage(languages[i]), getRepoRelativePathForSdkLanguage(languages[i]));
        }
        copyOneFoldersContentsToAnotherExceptReadme(getUnzippedPathForSdkLanguage(languages[i]), getRepoRelativePathForSdkLanguage(languages[i]));
    }
}
gulp.task('js-3-copy-everywhere', ['js-sdk-browserify-unzipped'], function(){
    try {
        copyUnzippedJsSdkToRepo();
        //copyUnzippedJsSdkToQmDockerNodeModules();
        //copyUnzippedJsSdkToIonicNodeModules();
        copyUnzippedJsSdkToIonicSrcLibForTesting();
        //copyQmWebJsToIonicCustomLib();
    } catch (error){
        logError(error, error);
    }
    try {
        return copyUnzippedJsSdkToApiDocsNodeModules();
    } catch (error){
        logError(error, error);
    }
    console.log("After completion, open repo, discard readme changes and commit new version to Github.  Then you can run js-4-release");
});
gulp.task('js-4-reset-package-json-readme', [], function(){
    resetNonGeneratedFiles();
});
gulp.task('php-2-sdk-copy-to-repo', [], function(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage('php') + '/QuantiModoClient/**/*',
        getRepoRelativePathForSdkLanguage('php'))
});
gulp.task('php-3-move-client-to-repo-root', [], function(){
    return copyOneFoldersContentsToAnother(getRepoRelativePathForSdkLanguage('php') + '/QuantiModoClient/**/*',
        getRepoRelativePathForSdkLanguage('php'));
});
gulp.task('php-4-update-sdk-composer', [], function(){
    const composerJsonPath = getRepoRelativePathForSdkLanguage('php') + '/composer.json';
    const composerJson = readJsonFile(composerJsonPath);
    composerJson.version = apiVersionNumber;
    return writeToFile(composerJsonPath, prettyJSONStringify(composerJson, 4), function () {
        return commitChanges('php');
    });
});
gulp.task('php-5-update-laravel-composer', [], function(callback){
    const composerJson = readJsonFile(pathToLaravel + '/composer.json');
    composerJson.require["quantimodo/quantimodo-sdk-php"] = apiVersionNumber;
    return writeToFile(pathToLaravel  + '/composer.json', prettyJSONStringify(composerJson, 4), function () {
        executeCommand("cd " + pathToLaravel + " && composer update --ignore-platform-reqs", function () {
            if(callback){callback();}
        });
    });
});
gulp.task('3-copy-to-repos', ['js-sdk-browserify-unzipped'], function(){
    return copySdksFromUnzippedPathToRepos();
});
function commitChanges(language, filesToResetArray){
    let command = "cd " + getRepoRelativePathForSdkLanguage(language);
    if(filesToResetArray){
        for (let i = 0; i < filesToResetArray.length; i++) {
            command += ' && git checkout ' + filesToResetArray[i];
        }
    }
    return executeCommand(command +
        ' && git add .' +
        ' && git commit -m "' + apiVersionNumber + '"' +
        ' && git push' +
        ' && git tag ' + apiVersionNumber +
        ' && git push origin ' + apiVersionNumber);
}
function resetNonGeneratedFiles(){
    const toReset = [
        'package.json',
        'README.md',
        'qmHelpers.js',
        'qmChrome.js',
        'qmLogger.js',
        'psychedelic-loader.js',
        'popup.js',
        'ionIcons.js'
    ];
    let command = "cd " + getRepoRelativePathForSdkLanguage(language);
    toReset.forEach(function(file){
        command += " && git checkout "+file;
    });
    executeCommand(command);
}
gulp.task('5-commit-changes', [], function(){
    for(let i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return commitChanges(getUnzippedPathForSdkLanguage(languages[i]));
        }
        commitChanges(getUnzippedPathForSdkLanguage(languages[i]));
    }
});
try {
    authenticateQuantiModoSdk();
} catch (error) {
    logError(error);
}
function authenticateQuantiModoSdk() {
    const Quantimodo = require('quantimodo');
    let defaultClient = Quantimodo.ApiClient.instance;
    if(process.env.APP_HOST_NAME){defaultClient.basePath = process.env.APP_HOST_NAME + '/api';}
    const quantimodo_oauth2 = defaultClient.authentications['quantimodo_oauth2'];
    const clientId = defaultClient.authentications['client_id'];
    clientId.apiKey = "testClient";
    if(process.env.TEST_ACCESS_TOKEN){
        logInfo("Using process.env.QUANTIMODO_ACCESS_TOKEN");
        quantimodo_oauth2.accessToken = process.env.TEST_ACCESS_TOKEN;
    } else {
        logInfo("Using test user access token");
        quantimodo_oauth2.accessToken = process.env.QUANTIMODO_ACCESS_TOKEN;
    }
}
function convertPathToFilename(path) {
    path = stripQueryFromPath(path);
    let filename = path.replace('/api/', '');
    filename = filename.replaceAll('/', '-') + '.json';
    return 'responses/' + filename;
}
function stripQueryFromPath(path) {
    const parts = path.split('?');
    return parts[0];
}
const variableIsArray = function(variable){
    const isAnArray = Array.isArray(variable);
    if(isAnArray){
        return true;
    }
    const constructorArray = variable.constructor === Array;
    if(constructorArray){
        return true;
    }
    const instanceOfArray = variable instanceof Array;
    if(instanceOfArray){
        return true;
    }
    return Object.prototype.toString.call(variable) === '[object Array]';
};
function handleApiResponse(error, data, response, requiredProperties) {
    function getUrlFromResponse(response) {
        return "https://" + response.request.host + response.req.path;
    }
    function checkRequiredProperties(data, requiredProperties) {
        let exampleObject = data;
        if (variableIsArray(data)) {
            exampleObject = data[0];
        }
        if (requiredProperties) {
            for (let i = 0; i < requiredProperties.length; i++) {
                if (!exampleObject[requiredProperties[i]]) {
                    logError('Example object', exampleObject);
                    throw "Required property " + requiredProperties[i] + " not returned from " + getUrlFromResponse(response);
                }
            }
        }
    }
    if (error && error.message) {
        logError(getUrlFromResponse(response) + " request failed: " + error.message, error);
        throw error.message;
    }
    if(!data || Object.keys(data).length === 0){
        throw "data not returned from " + getUrlFromResponse(response);
    }
    checkRequiredProperties(data, requiredProperties);
    fs.writeFileSync(convertPathToFilename(response.req.path), prettyJSONStringify(data));
    logDebug(getUrlFromResponse(response) + ' returned data', data);
}
gulp.task('get-aggregated-correlations', [], function (callback) {
    const apiInstance = new Quantimodo.AnalyticsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getCorrelations({commonOnly: true}, qmApiResponseCallback);
});
gulp.task('get-connectors', [], function (callback) {
    const apiInstance = new Quantimodo.ConnectorsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getConnectors({}, qmApiResponseCallback);
});
const dateTime = Date.now();
let currentUnixTime = Math.floor(dateTime / 1000);
let testVariableName = currentUnixTime + ' Unique Test Variable';
gulp.task('get-measurements', ['post-measurements'], function (callback) {
    // If this isn't working try waiting a few seconds after
    const apiInstance = new Quantimodo.MeasurementsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        if(data[0].startTimeEpoch !== currentUnixTime){
            logError("Most recent measurement from " + response.request.url, data[0]);
            logDebug("GET " + response.request.url + " response", response);
            throw "Could not get measurement we just posted!"
        }
        callback();
    }
    apiInstance.getMeasurements({sort: '-startTime', variableName: testVariableName}, qmApiResponseCallback);
});
gulp.task('default', ['check-responses']);
gulp.task('post-measurements', [], function (callback) {
    const expectedMethod = "POST";
    const apiInstance = new Quantimodo.MeasurementsApi();
    const options = {};
    function qmApiResponseCallback(error, data, response) {
        if(response.req.method !== expectedMethod){
            throw "Method should be " + expectedMethod + " but is actually " + response.req.method;
        }
        //logInfo("POST " + response.request.url + " response body", response.body);
        delete response.text;
        logInfo("POST " + response.request.url + " response", response);
        handleApiResponse(error, data, response);
        callback();
    }
    const measurement = {
        "variableName": testVariableName, "value": 1, "startTimeEpoch": currentUnixTime,
        "unitAbbreviatedName": "/5", "variableCategoryName": "Emotions", "combinationOperation": "MEAN"
    };
    logInfo("Posting measurement", measurement);
    apiInstance.postMeasurements(measurement, options, qmApiResponseCallback);
});
gulp.task('get-pairs', [], function (callback) {
    const apiInstance = new Quantimodo.MeasurementsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getPairs({causeVariableName: "Sleep Duration", effectVariableName: "Overall Mood"}, qmApiResponseCallback);
});
gulp.task('get-common-variables', [], function (callback) {
    const apiInstance = new Quantimodo.VariablesApi();
    function qmApiResponseCallback(error, data, response) {
        const requiredProperties = ['unitAbbreviatedName', 'unit', 'unitName', 'unitId'];
        handleApiResponse(error, data, response, requiredProperties);
        callback();
    }
    apiInstance.getVariables({commonOnly: true}, qmApiResponseCallback);
});
gulp.task('get-study', [], function (callback) {
    const apiInstance = new Quantimodo.AnalyticsApi();
    const requiredProperties = [
        'causeVariable',
        'effectVariable',
        'charts',
        'statistics',
        'studyText'
    ];
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response, requiredProperties);
        callback();
    }
    apiInstance.getStudy({causeVariableName: "Sleep Duration", effectVariableName: "Overall Mood"}, qmApiResponseCallback);
});
gulp.task('get-tracking-reminder-notifications', [], function (callback) {
    const apiInstance = new Quantimodo.RemindersApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getTrackingReminderNotifications({}, qmApiResponseCallback);
});
gulp.task('post-tracking-reminders', [], function (callback) {
    const apiInstance = new Quantimodo.RemindersApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    const postBody = [{
        "variableName": testVariableName,
        "reminderFrequency": 86400,
        "variableCategoryName": "Emotions",
        "unitAbbreviatedName": "/5",
        "instructions": "I am an instruction!"
    }];
    apiInstance.postTrackingReminders(postBody, qmApiResponseCallback);
});
gulp.task('get-tracking-reminders', ['post-tracking-reminders'], function (callback) {
    const apiInstance = new Quantimodo.RemindersApi();
    function qmApiResponseCallback(error, data, response) {
        let newReminderPresent = false;
        for(let i = 0; i < data.length; i++){
            const currentName = data[i].variableName;
            if(currentName === testVariableName){
                newReminderPresent = true;
            }
        }
        if(!newReminderPresent){throw "Could not get reminder we just created!";}
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getTrackingReminders({}, qmApiResponseCallback);
});
gulp.task('get-units', [], function (callback) {
    const apiInstance = new Quantimodo.UnitsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getUnits(qmApiResponseCallback);
});
gulp.task('get-unit-categories', [], function (callback) {
    const apiInstance = new Quantimodo.UnitsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getUnitCategories(qmApiResponseCallback);
});
gulp.task('get-user', [], function (callback) {
    const apiInstance = new Quantimodo.UserApi();
    function qmApiResponseCallback(error, data, response) {
        logInfo(response.request.url + " response", response);
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getUser({}, qmApiResponseCallback);
});
gulp.task('get-user-correlations', [], function (callback) {
    const apiInstance = new Quantimodo.AnalyticsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getCorrelations({}, qmApiResponseCallback);
});
gulp.task('get-user-variables', [], function (callback) {
    const apiInstance = new Quantimodo.VariablesApi();
    function qmApiResponseCallback(error, data, response) {
        const requiredProperties = ['unitAbbreviatedName', 'unit', 'unitName', 'unitId'];
        handleApiResponse(error, data, response, requiredProperties);
        callback();
    }
    apiInstance.getVariables({userOnly: true}, qmApiResponseCallback);
});
gulp.task('test-endpoints', [], function (callback) {
    runSequence(
        'post-measurements',
        'get-user',
        'get-aggregated-correlations',
        'get-connectors',
        'get-pairs',
        'get-common-variables',
        'get-study',
        'get-tracking-reminder-notifications',
        'get-tracking-reminders',
        'get-unit-categories',
        'get-units',
        'get-user-correlations',
        'get-user-variables',
        'get-measurements',
        function (error) {
            if (error) {
                logError(error.message);
                throw error.message;
            } else {
                logInfo('All endpoints work! :D');
            }
            callback(error);
        });
});
gulp.task('test-javascript-client', [], function (callback) {
    executeCommand('cd ' + getUnzippedPathForSdkLanguage(javascriptFlavor) + ' && npm install && npm test ', function () {
        callback();
    });
});
function verifyExistenceOfFile(filePath) {
    return fs.stat(filePath, function (err) {
        if (!err) {logInfo(filePath + ' exists');} else {throw 'Could not find ' + filePath + ': '+ err;}
    });
}
gulp.task('check-responses', ['test-endpoints'], function (callback) {
    const apiPaths = [
        '/api/v3/connectors/list',
        '/api/v3/measurements',
        '/api/v3/pairs',
        '/api/v4/study',
        '/api/v3/units',
        '/api/v3/user'
    ];
    for(let i = 0; i < apiPaths.length; i++){
        verifyExistenceOfFile(convertPathToFilename(apiPaths[i]));
    }
    callback();
});
gulp.task('delete-qm-node-module', [], function(){
    return cleanOneFolderExceptGit(pathToQuantiModoNodeModule);
});
gulp.task('js-sdk-copy-to-node-modules', ['delete-qm-node-module'], function(){
    language = javascriptFlavor;
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(language), pathToQuantiModoNodeModule);
});
gulp.task('JS-SDK-UPDATE', function(callback){
    language = javascriptFlavor;
    runSequence(
        'clean-unzipped-folders',
        'download-and-unzip-one-sdk',
        'js-sdk-copy-to-node-modules',
        function (error) {
            if (error) {
                logError(error.message);
            } else {
                logInfo('Run js-sdk-copy-to-node-modules again because it probably ran too early');
            }
            callback(error);
        });
});
function downloadAndExtractJavascriptClient(language, cb){
    let jsSdkFolder = getRepoRelativePathForSdkLanguage('javascript');
    let clientFolder = jsSdkFolder+'/' + language + '-client';
    const rimraf = require('rimraf')
    rimraf(clientFolder, function(){
        generateOptionsAndDownloadSdk(language, true, function(res){
            let zipPath = getZipPathForLanguage(language);
            var extract = require('extract-zip')
            console.info(`Extracting ${zipPath}...`)
            extract(zipPath, {dir: path.resolve(jsSdkFolder)}, function (err) {
                if(err) throw err
                console.info(`Extracted to ${clientFolder}!`)
                if(cb) cb()
            })
        });
    })
}

const swaggerCodegenVersion = "2.4.10";
const jar = `swagger-codegen-cli-${swaggerCodegenVersion}.jar`;
gulp.task('download-codegen-jar', [], function (cb) {
    downloadFile(`http://central.maven.org/maven2/io/swagger/swagger-codegen-cli/2.4.10/swagger-codegen-cli-#${swaggerCodegenVersion}.jar`, {
        directory: "./",
        filename: jar
    }, function(err){
        if (err) throw err
        console.log(`Downloaded ${jar}!`)
        cb();
    })
});
// noinspection JSUnusedLocalSymbols
function executeSynchronously(cmd, catchExceptions, cb){
    const execSync = require('child_process').execSync;
    console.info(cmd);
    try{
        execSync(cmd);
        if(cb){
            cb();
        }
    }catch (error){
        if(catchExceptions){
            console.error(error);
        }else{
            throw error;
        }
    }
}
function generateLocally(language, options){
    executeSynchronously(`java -jar ${jar} generate -i swagger/swagger.json -l ${language} -o sdks-unzipped/${language} ${options}`)
}
gulp.task('js-node-angular-react-typescript', function(cb){
    downloadAndExtractJavascriptClient('typescript-node', function(){
        downloadAndExtractJavascriptClient('typescript-angular', function(){
            downloadAndExtractJavascriptClient('typescript-angularjs', function(){
                downloadAndExtractJavascriptClient('typescript-fetch', cb);
            });
        });
    });
    //return downloadSdk('typescript-node', true);
});