var gulp = require('gulp');
var rename = require('gulp-rename');
var fs = require('fs');
var runSequence = require('run-sequence');
var git = require('gulp-git');
var download = require('gulp-download-stream');
var rp = require('request-promise');
var ignore = require('gulp-ignore');
var del = require('del');
var decompress = require('gulp-decompress');
var bugsnag = require("bugsnag");
var q = require('q');
var unzip = require('gulp-unzip');
bugsnag.register("ae7bc49d1285848342342bb5c321a2cf");
process.on('unhandledRejection', function (err, promise) {
    console.error("Unhandled rejection: " + (err && err.stack || err));
    bugsnag.notify(err);
});
bugsnag.onBeforeNotify(function (notification) {
    var metaData = notification.events[0].metaData;
    // modify meta-data
    metaData.subsystem = { name: "Your subsystem name" };
});
function isTruthy(value) {return (value && value !== "false");}
var debug = isTruthy(process.env.DEBUG);
var sdksZippedPath = "./sdks-zipped";
var sdksUnzippedPath = "./sdks-unzipped";
var sdksReposPath = './sdk-repos';
var languages = [
    "akka-scala",
    "android",
    "async-scala",
    "csharp",
    "CsharpDotNet2",
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
    "typescript-angular2",
    //"typescript-fetch",
    "typescript-node"
];
var sdkSwaggerCodegenOptions ={
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
    }
};
var majorMinorVersionNumbers = '5.9.';
function getPatchVersionNumber() {
    var date = new Date();
    var monthNumber = (date.getMonth() + 1).toString();
    var dayOfMonth = ('0' + date.getDate()).slice(-2);
    var hourOfDay = date.getHours();
    var hourOfDayString = ('0' + hourOfDay).slice(-2);
    //hourOfDayString = "72"; // Manually set if need to release more than once per hour
    return monthNumber + dayOfMonth + hourOfDayString;
}
var apiVersionNumber = majorMinorVersionNumbers + getPatchVersionNumber();
logInfo("API version is " + apiVersionNumber);
function obfuscateSecrets(object){
    if(typeof object !== 'object'){return object;}
    object = JSON.parse(JSON.stringify(object)); // Decouple so we don't screw up original object
    for (var propertyName in object) {
        if (object.hasOwnProperty(propertyName)) {
            var lowerCaseProperty = propertyName.toLowerCase();
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
    var objectString = '';
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
    var date = new Date();
    var longDate = date.getFullYear().toString() + (date.getMonth() + 1).toString() + date.getDate().toString();
    var monthNumber = (date.getMonth() + 1).toString();
    var dayOfMonth = ('0' + date.getDate()).slice(-2);
    var majorMinorVersionNumbers = '5.8.';
    var patchVersionNumber = monthNumber + dayOfMonth;
    return majorMinorVersionNumbers + patchVersionNumber;
}
function executeCommand(command, callback) {
    logInfo(command);
    var exec = require('child_process').exec;
    exec(command, function (err, stdout, stderr) {
        logInfo(stdout);
        if(stderr){logError(stderr);}
        if(callback){callback(err);}
    });
}
var swaggerJsonUrl = 'https://raw.githubusercontent.com/QuantiModo/docs/develop/swagger/swagger.json';
function clone(organization, repoName, destinationFolder, callback){
    var repoUrl = 'https://github.com/' + organization + '/' + repoName;
    var repoFolder = destinationFolder + '/' + repoName;
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
    return sdksZippedPath + '/' + getSdkNameForLanguage(language) + '.zip';
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
function getRepoPathForSdkLanguage(languageName) {
    return sdksReposPath + '/' + getSdkNameForLanguage(languageName);
}
var pathToIonic = '../../../public.built/ionic/Modo';
var pathToLaravel = '../../../laravel';
function readJsonFile(pathToFile) {
    logInfo("Reading " + pathToFile);
    return JSON.parse(fs.readFileSync(pathToFile, 'utf8'));
}
var pathToSwaggerJson = "swagger/swagger.json";
var swaggerJson = readJsonFile(pathToSwaggerJson);
function unzipFileToFolder(sourceFile, destinationFolder) {
    logInfo('Unzipping files in ' + sourceFile + ' to output path ' + destinationFolder);
    return gulp.src(sourceFile)
        .pipe(decompress())
        .pipe(gulp.dest(destinationFolder));
}
var pathToQmDocker = "../../..";
var pathToQuantiModoNodeModule = 'node_modules/quantimodo';
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
gulp.task('js-sdk-browserify-unzipped', [], function (callback) {
    browserify(getUnzippedPathForSdkLanguage(javascriptFlavor), callback);
});
gulp.task('js-sdk-browserify-repo', [], function (callback) {
    browserify(getRepoPathForSdkLanguage(javascriptFlavor), callback);
});
function browserify(path, callback){
    var sourceFile = 'src/index.js';
    var outputFile = 'quantimodo-web.js';
    executeCommand('cd ' + path + ' && npm install -g browserify && browserify ' +
        sourceFile + ' --standalone Quantimodo > ' + outputFile, function () {
        callback();
    });
}
gulp.task('js-5-release', [], function (callback) {
    function updateBowerAndPackageJsonVersions(path, callback) {
        var bowerJson = readJsonFile(path + '/bower.json');
        bowerJson.dependencies.quantimodo = apiVersionNumber;
        return writeToFile(path  + '/bower.json', prettyJSONStringify(bowerJson), function () {
            executeCommand("cd " + pathToIonic + " && bower install && yarn install", function () {
                var packageJson = readJsonFile(path + '/package.json');
                packageJson.dependencies.quantimodo = apiVersionNumber;
                return writeToFile(path  + '/package.json', prettyJSONStringify(packageJson), function () {
                    executeCommand("cd " + pathToIonic + " && yarn install", function () {
                        if(callback){callback();}
                    });
                });
            });
        });
    }
    executeCommand("cd " + getRepoPathForSdkLanguage(javascriptFlavor) +
        //' && npm install' +
        ' && git checkout HEAD -- README.md' +
        ' && git checkout HEAD -- package.json' +
        ' && git add .' +
        ' && git commit -m "' + apiVersionNumber + '"' +
        ' && git push' +
        ' && git tag ' + apiVersionNumber +
        ' && git push origin ' + apiVersionNumber +
        ' && bower version ' + apiVersionNumber, function () {
        executeCommand("cd " + getRepoPathForSdkLanguage(javascriptFlavor) + " && npm version " + apiVersionNumber +
            ' && npm publish', function () {
            updateBowerAndPackageJsonVersions(pathToQmDocker);
            updateBowerAndPackageJsonVersions(pathToIonic);
            //updateBowerAndPackageJsonVersions(".");
            callback();
        });
    });
});
gulp.task('clean-folders', [], function () {
    return del([
        sdksZippedPath + '/**/*',
        sdksUnzippedPath + '/**/*',
        sdksReposPath + '/**/*'
    ]);
});
gulp.task('clean-laravel-vendor', [], function () {
    return del([laravelVendorPath + '/**/*'], {force: true});
});
gulp.task('clean-unzipped-folders', [], function () {
    return del([
        sdksUnzippedPath + '/**/*',
    ]);
});
gulp.task('clone-repos', [], function (callback) {
    for(var i = 0; i < languages.length; i++){
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
    for(var i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){ return cleanOneFolderExceptGit(getRepoPathForSdkLanguage(languages[i]));}
        cleanOneFolderExceptGit(getRepoPathForSdkLanguage(languages[i]));
    }
});
function getRequestOptions(language) {
    return {
        method: 'POST',
            uri: 'http://generator.swagger.io/api/gen/clients/' + language,
        body: {
        swaggerUrl: swaggerJsonUrl
    },
        json: true // Automatically stringifies the body to JSON
    };
}
var sdkDownloadLink;
var language = "javascript";
function getSdkDownloadLink() {
    var requestOptions = getRequestOptions(language);
    if (sdkSwaggerCodegenOptions[language]) {
        requestOptions.body.options = sdkSwaggerCodegenOptions[language];
    } else {
        requestOptions.body.options = {};
        requestOptions.body.options.apiPackage = "QuantiModoApi";
        requestOptions.body.options.artifactId = "quantimodoApi";
        requestOptions.body.options.authorEmail = "mike@quantimo.do";
        requestOptions.body.options.authorName = "Mike P. Sinn";
        requestOptions.body.options.classPrefix = "QM";
        requestOptions.body.options.developerEmail = "mike@quantimo.do";
        requestOptions.body.options.developerName = "Mike P. Sinn";
        requestOptions.body.options.invokerPackage = (sdkSwaggerCodegenOptions[language] && sdkSwaggerCodegenOptions[language].invokerPackage) ? sdkSwaggerCodegenOptions[language].invokerPackage : "quantimodoApi";
        requestOptions.body.options.modelPackage = "quantimodoApi";
        requestOptions.body.options.moduleName = "quantimodoApi";
        requestOptions.body.options.packageName = "quantimodo_api";
        requestOptions.body.options.packagePath = "QuantiModoClient";
        requestOptions.body.options.podName = "QuantiModoApi";
        //requestOptions.body.options.podVersion = getAppVersionNumber();  // Commented because it makes too many file changes in git
        requestOptions.body.options.projectName = (sdkSwaggerCodegenOptions[language] && sdkSwaggerCodegenOptions[language].projectName) ? sdkSwaggerCodegenOptions[language].projectName : "quantimodoApi";
    }
    // Commented because it makes too many file changes in git repo
    //requestOptions.body.options.artifactVersion = requestOptions.body.options.projectVersion = requestOptions.body.options.packageVarsion = requestOptions.body.options.podVersion = getAppVersionNumber();
    requestOptions.body.options.artifactDescription = requestOptions.body.options.projectDescription = swaggerJson.info.description;
    if(debug){getSwaggerConfigOptions(language);}
    return rp(requestOptions)
        .then(function (parsedBody) {
            sdkDownloadLink = parsedBody.link.replace('https', 'http');
        })
        .catch(function (err) {
            logError(err.error.message);
        });
}
function getSwaggerDownloadRequestOptions(language) {
    var requestOptions = getRequestOptions(language);
    if (sdkSwaggerCodegenOptions[language]) {
        requestOptions.body.options = sdkSwaggerCodegenOptions[language];
    } else {
        requestOptions.body.options = {};
        requestOptions.body.options.apiPackage = "QuantiModoApi";
        requestOptions.body.options.artifactId = "quantimodoApi";
        requestOptions.body.options.authorEmail = "mike@quantimo.do";
        requestOptions.body.options.authorName = "Mike P. Sinn";
        requestOptions.body.options.classPrefix = "QM";
        requestOptions.body.options.developerEmail = "mike@quantimo.do";
        requestOptions.body.options.developerName = "Mike P. Sinn";
        requestOptions.body.options.invokerPackage = (sdkSwaggerCodegenOptions[language] && sdkSwaggerCodegenOptions[language].invokerPackage) ? sdkSwaggerCodegenOptions[language].invokerPackage : "quantimodoApi";
        requestOptions.body.options.modelPackage = "quantimodoApi";
        requestOptions.body.options.moduleName = "quantimodoApi";
        requestOptions.body.options.packageName = "quantimodo_api";
        requestOptions.body.options.packagePath = "QuantiModoClient";
        requestOptions.body.options.podName = "QuantiModoApi";
        //requestOptions.body.options.podVersion = getAppVersionNumber();
        requestOptions.body.options.projectName = (sdkSwaggerCodegenOptions[language] && sdkSwaggerCodegenOptions[language].projectName) ? sdkSwaggerCodegenOptions[language].projectName : "quantimodoApi";
    }
    //requestOptions.body.options.artifactVersion = requestOptions.body.options.projectVersion = requestOptions.body.options.packageVersion = requestOptions.body.options.podVersion = getAppVersionNumber();
    requestOptions.body.options.artifactDescription = requestOptions.body.options.projectDescription = swaggerJson.info.description;
    return requestOptions;
}
function downloadSdk(language) {
    var requestOptions = getSwaggerDownloadRequestOptions(language);
    if(debug){getSwaggerConfigOptions(language);}
    return rp(requestOptions)
        .then(function (parsedBody) {
            var downloadLink = parsedBody.link.replace('https', 'http');
            return download(downloadLink)
                .pipe(rename(getSdkNameForLanguage(language) + '.zip'))
                .pipe(gulp.dest(sdksZippedPath));
        })
        .catch(function (err) {
            logError(err.error.message);
        });
}
function downloadAndUnzipSdk(language, destinationPath) {
    if(!destinationPath){
        destinationPath = sdksUnzippedPath;
    }
    logInfo("Downloading and unzipping " + language + " sdk to " + destinationPath);
    var requestOptions = getSwaggerDownloadRequestOptions(language);
    if(debug){getSwaggerConfigOptions(language);}
    return rp(requestOptions)
        .then(function (parsedBody) {
            var downloadLink = parsedBody.link.replace('https', 'http');
            return download(downloadLink)
                .pipe(unzip())
                .pipe(gulp.dest(destinationPath));
        })
        .catch(function (err) {
            logError(err.error.message);
        });
}
function getSwaggerConfigOptions(language) {
    var getOptionsRequestOptions = getRequestOptions(language);
    getOptionsRequestOptions.method = "GET";
    return rp(getOptionsRequestOptions)
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
    for(var i = 0; i < languages.length; i++){
        if(i === languages.length - 1){ return downloadSdk(languages[i]);}
        downloadSdk(languages[i]);
    }
});
var javascriptFlavor = 'javascript';
//var javascriptFlavor = 'typescript-fetch';
gulp.task('js-1-download', ['clean-unzipped-folders'], function () {
    languages = [javascriptFlavor];
    logInfo("Generating " + language + " sdk using " +  swaggerJsonUrl);
    return downloadSdk(javascriptFlavor);
});
gulp.task('php-0-sdk-download', [], function () {
    languages = ['php'];
    logInfo("Generating " + language + " sdk using " +  swaggerJsonUrl);
    return downloadSdk('php');
});
gulp.task('1-decompress', ['clean-repos-except-git'], function () {
    for(var i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return unzipFileToFolder(getZipPathForLanguage(languages[i]), sdksUnzippedPath);
        }
        unzipFileToFolder(getZipPathForLanguage(languages[i]), sdksUnzippedPath);
    }
});
gulp.task('js-2-unzip', ['clean-repos-except-git'], function () {
    return unzipFileToFolder(getZipPathForLanguage(javascriptFlavor), sdksUnzippedPath);
});
gulp.task('php-1-unzip', [], function () {
    return unzipFileToFolder(getZipPathForLanguage('php'), sdksUnzippedPath);
});
function copyUnzippedJsSdkToQmDockerNodeModules(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(javascriptFlavor), pathToQmDocker + '/' + pathToQuantiModoNodeModule);
}
function copyUnzippedJsSdkToIonicNodeModules(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(javascriptFlavor), pathToIonic + '/' + pathToQuantiModoNodeModule);
}
function copyUnzippedJsSdkToRepo(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(javascriptFlavor), getRepoPathForSdkLanguage(javascriptFlavor));
}
function copyUnzippedJsSdkToApiDocsNodeModules(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage(javascriptFlavor), pathToQuantiModoNodeModule);
}
function copySdksFromUnzippedPathToRepos(){
    for(var i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return copyOneFoldersContentsToAnotherExceptReadme(getUnzippedPathForSdkLanguage(languages[i]), getRepoPathForSdkLanguage(languages[i]));
        }
        copyOneFoldersContentsToAnotherExceptReadme(getUnzippedPathForSdkLanguage(languages[i]), getRepoPathForSdkLanguage(languages[i]));
    }
}
gulp.task('js-3-copy-everywhere', ['js-sdk-browserify-unzipped'], function(){
    try {
        copyUnzippedJsSdkToRepo();
        //copyUnzippedJsSdkToQmDockerNodeModules();
        //copyUnzippedJsSdkToIonicNodeModules();
        //copyUnzippedJsSdkToIonicCustomLib();
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
    resetPackageJsonAndReadme();
});
var laravelVendorPath = pathToQmDocker + '/laravel/vendor/quantimodo/quantimodo-sdk-php';
gulp.task('php-2-sdk-copy-to-repo', ['clean-repos-except-git'], function(){
    return copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage('php') + '/QuantiModoClient/**/*',
        getRepoPathForSdkLanguage('php'))
});
gulp.task('php-3-move-client-to-repo-root', [], function(){
    return copyOneFoldersContentsToAnother(getRepoPathForSdkLanguage('php') + '/QuantiModoClient/**/*',
        getRepoPathForSdkLanguage('php'));
});
gulp.task('php-4-update-sdk-composer', [], function(){
    var composerJsonPath = getRepoPathForSdkLanguage('php') + '/composer.json';
    var composerJson = readJsonFile(composerJsonPath);
    composerJson.version = apiVersionNumber;
    return writeToFile(composerJsonPath, prettyJSONStringify(composerJson, 4), function () {
        return commitChanges('php');
    });
});
gulp.task('php-5-update-laravel-composer', [], function(callback){
    var composerJson = readJsonFile(pathToLaravel + '/composer.json');
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
    var command = "cd " + getRepoPathForSdkLanguage(language);
    if(filesToResetArray){
        for (var i = 0; i < filesToResetArray.length; i++) {
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
function resetPackageJsonAndReadme(){
    var command = "cd " + getRepoPathForSdkLanguage(language) + ' && git checkout package.json && git checkout README.md';
    executeCommand(command);
}
gulp.task('5-commit-changes', [], function(){
    for(var i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return commitChanges(getUnzippedPathForSdkLanguage(languages[i]));
        }
        commitChanges(getUnzippedPathForSdkLanguage(languages[i]));
    }
});
try {
    var Quantimodo = require('quantimodo');
    authenticateQuantiModoSdk();
} catch (error) {
    logError(error);
}
var defaultClient;
function authenticateQuantiModoSdk() {
    defaultClient = Quantimodo.ApiClient.instance;
    if(process.env.APP_HOST_NAME){defaultClient.basePath = process.env.APP_HOST_NAME + '/api';}
    var quantimodo_oauth2 = defaultClient.authentications['quantimodo_oauth2'];
    var clientId = defaultClient.authentications['client_id'];
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
    var filename = path.replace('/api/', '');
    filename = filename.replaceAll('/', '-') + '.json';
    return 'responses/' + filename;
}
function stripQueryFromPath(path) {
    var parts = path.split('?');
    return parts[0];
}
var variableIsArray = function(variable) {
    var isAnArray = Array.isArray(variable);
    if(isAnArray){return true;}
    var constructorArray = variable.constructor === Array;
    if(constructorArray){return true;}
    var instanceOfArray = variable instanceof Array;
    if(instanceOfArray){return true;}
    var prototypeArray = Object.prototype.toString.call(variable) === '[object Array]';
    if(prototypeArray){return true;}
    return false;
};
function handleApiResponse(error, data, response, requiredProperties) {
    function getUrlFromResponse(response) {
        return "https://" + response.request.host + response.req.path;
    }
    function checkRequiredProperties(data, requiredProperties) {
        var exampleObject = data;
        if (variableIsArray(data)) {
            exampleObject = data[0];
        }
        if (requiredProperties) {
            for (var i = 0; i < requiredProperties.length; i++) {
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
    var apiInstance = new Quantimodo.AnalyticsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getCorrelations({commonOnly: true}, qmApiResponseCallback);
});
gulp.task('get-connectors', [], function (callback) {
    var apiInstance = new Quantimodo.ConnectorsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getConnectors({}, qmApiResponseCallback);
});
gulp.task('get-measurements', ['post-measurements'], function (callback) {
    // If this isn't working try waiting a few seconds after
    var apiInstance = new Quantimodo.MeasurementsApi();
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
var dateTime = Date.now();
var currentUnixTime = Math.floor(dateTime / 1000);
var testVariableName = currentUnixTime + ' Unique Test Variable';
gulp.task('default', ['check-responses']);
gulp.task('post-measurements', [], function (callback) {
    var expectedMethod = "POST";
    var apiInstance = new Quantimodo.MeasurementsApi();
    var options = {};
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
    var measurement = {"variableName":testVariableName ,"value":1,"startTimeEpoch":currentUnixTime,
        "unitAbbreviatedName":"/5","variableCategoryName":"Emotions","combinationOperation":"MEAN"};
    logInfo("Posting measurement", measurement);
    apiInstance.postMeasurements(measurement, options, qmApiResponseCallback);
});
gulp.task('get-pairs', [], function (callback) {
    var apiInstance = new Quantimodo.MeasurementsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getPairs({causeVariableName: "Sleep Duration", effectVariableName: "Overall Mood"}, qmApiResponseCallback);
});
gulp.task('get-common-variables', [], function (callback) {
    var apiInstance = new Quantimodo.VariablesApi();
    function qmApiResponseCallback(error, data, response) {
        var requiredProperties = ['unitAbbreviatedName', 'unit', 'unitName', 'unitId'];
        handleApiResponse(error, data, response, requiredProperties);
        callback();
    }
    apiInstance.getVariables({commonOnly: true}, qmApiResponseCallback);
});
gulp.task('get-study', [], function (callback) {
    var apiInstance = new Quantimodo.AnalyticsApi();
    var requiredProperties = [
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
    var apiInstance = new Quantimodo.RemindersApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getTrackingReminderNotifications({}, qmApiResponseCallback);
});
gulp.task('post-tracking-reminders', [], function (callback) {
    var apiInstance = new Quantimodo.RemindersApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    var postBody = [{
        "variableName" : testVariableName,
        "reminderFrequency" : 86400,
        "variableCategoryName" : "Emotions",
        "unitAbbreviatedName" : "/5",
        "instructions" : "I am an instruction!"
    }];
    apiInstance.postTrackingReminders(postBody, qmApiResponseCallback);
});
gulp.task('get-tracking-reminders', ['post-tracking-reminders'], function (callback) {
    var apiInstance = new Quantimodo.RemindersApi();
    function qmApiResponseCallback(error, data, response) {
        var newReminderPresent = false;
        for(var i = 0; i < data.length; i++){
            var currentName = data[i].variableName;
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
    var apiInstance = new Quantimodo.UnitsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getUnits(qmApiResponseCallback);
});
gulp.task('get-unit-categories', [], function (callback) {
    var apiInstance = new Quantimodo.UnitsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getUnitCategories(qmApiResponseCallback);
});
gulp.task('get-user', [], function (callback) {
    var apiInstance = new Quantimodo.UserApi();
    function qmApiResponseCallback(error, data, response) {
        logInfo(response.request.url + " response", response);
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getUser({}, qmApiResponseCallback);
});
gulp.task('get-user-correlations', [], function (callback) {
    var apiInstance = new Quantimodo.AnalyticsApi();
    function qmApiResponseCallback(error, data, response) {
        handleApiResponse(error, data, response);
        callback();
    }
    apiInstance.getCorrelations({}, qmApiResponseCallback);
});
gulp.task('get-user-variables', [], function (callback) {
    var apiInstance = new Quantimodo.VariablesApi();
    function qmApiResponseCallback(error, data, response) {
        var requiredProperties = ['unitAbbreviatedName', 'unit', 'unitName', 'unitId'];
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
    return fs.stat(filePath, function (err, stat) {
        if (!err) {logInfo(filePath + ' exists');} else {throw 'Could not find ' + filePath + ': '+ err;}
    });
}
gulp.task('check-responses', ['test-endpoints'], function (callback) {
    var apiPaths = [
        '/api/v3/connectors/list',
        '/api/v3/measurements',
        '/api/v3/pairs',
        '/api/v4/study',
        '/api/v3/units',
        '/api/v3/user'
    ];
    for(var i = 0; i < apiPaths.length; i++){
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