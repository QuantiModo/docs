var gulp = require('gulp');
var gutil = require('gulp-util');
var bower = require('bower');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var change = require('gulp-change');
var q = require('q');
var fs = require('fs');
var glob = require('glob');
var zip = require('gulp-zip');
var request = require('request');
var open = require('gulp-open');
var runSequence = require('run-sequence');
var plist = require('plist');
var clean = require('gulp-rimraf');
var replace = require('gulp-string-replace');
var unzip = require('gulp-unzip');
var conventionalChangelog = require('gulp-conventional-changelog');
var conventionalGithubReleaser = require('conventional-github-releaser');
var bump = require('gulp-bump');
var git = require('gulp-git');
var download = require('gulp-download-stream');
var inject = require('gulp-inject');
var jimp = require('gulp-jimp');
var rp = require('request-promise');
var minimatch = require('minimatch');
var ignore = require('gulp-ignore');
var del = require('del');
var logger = require('gulp-logger');
var decompress = require('gulp-decompress');
var bugsnag = require("bugsnag");
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
var buildDebug = isTruthy(process.env.BUILD_DEBUG);
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
        "composerVendorName": "quantimodo"
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
var shell = require('gulp-shell');
var prompt = require('gulp-prompt');
var util = require('util');
var s3 = require('gulp-s3-upload')({accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY});
var majorMinorVersionNumbers = '5.8.';
function getPatchVersionNumber() {
    var date = new Date();
    var monthNumber = (date.getMonth() + 1).toString();
    var dayOfMonth = ('0' + date.getDate()).slice(-2);
    return monthNumber + dayOfMonth;
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
function prettyJSONStringify(object) {return JSON.stringify(object, null, 2);}
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
function logDebug(message, object) {if(buildDebug){logInfo(message, object);}}
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
var swaggerJsonUrl = 'https://utopia.quantimo.do/api/docs/swagger/swagger.json';
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
function downloadOneSdk(language) {
    var requestOptions = {
        method: 'POST',
        uri: 'http://generator.swagger.io/api/gen/clients/' + language,
        body: {swaggerUrl: swaggerJsonUrl, options:{}},
        json: true
    };
    logInfo("Generating " + language + " sdk", requestOptions.body.options);
    return rp(requestOptions)
        .then(function (parsedBody) {
            logInfo("SDK response", parsedBody);
            return download(parsedBody.link.replace('https', 'http'))
                .pipe(rename(getSdkNameForLanguage(language) + '.zip'))
                .pipe(gulp.dest(sdksZippedPath));
        })
        .catch(function (err) {
            logError(err.error.message);
        });
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
var pathToIonic = './public.built/ionic/Modo';
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
gulp.task('changelog', function () {
    return gulp.src('CHANGELOG.md', {
        buffer: false
    })
        .pipe(conventionalChangelog({
            preset: 'angular' // Or to any other commit message convention you use.
        }))
        .pipe(gulp.dest('./'));
});
gulp.task('github-release', function(done) {
    conventionalGithubReleaser({
        type: "oauth",
        token: '0126af95c0e2d9b0a7c78738c4c00a860b04acc8' // change this to your own GitHub token or use an environment variable
    }, {
        preset: 'angular' // Or to any other commit message convention you use.
    }, done);
});
gulp.task('bump-version', function () {
// We hardcode the version change type to 'patch' but it may be a good idea to
// use minimist (https://www.npmjs.com/package/minimist) to determine with a
// command argument whether you are doing a 'major', 'minor' or a 'patch' change.
    return gulp.src(['./bower.json', './package.json'])
        .pipe(bump({type: "patch"}).on('error', gutil.log))
        .pipe(gulp.dest('./'));
});
gulp.task('commit-changes', function () {
    return gulp.src('.')
        .pipe(git.add())
        .pipe(git.commit('[Prerelease] Bumped version number'));
});
gulp.task('push-changes', function (cb) {
    git.push('origin', 'master', cb);
});
gulp.task('create-new-tag', function (cb) {
    var version = getPackageJsonVersion();
    git.tag(version, 'Created Tag for version: ' + version, function (error) {
        if (error) {
            return cb(error);
        }
        git.push('origin', 'master', {args: '--tags'}, cb);
    });
    function getPackageJsonVersion () {
        // We parse the json file instead of using require because require caches
        // multiple calls so the version number won't be updated
        return JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;
    }
});
gulp.task('release', function (callback) {
    runSequence(
        'bump-version',
        'changelog',
        'commit-changes',
        'push-changes',
        'create-new-tag',
        'github-release',
        function (error) {
            if (error) {
                logError(error.message);
            } else {
                logInfo('RELEASE FINISHED SUCCESSFULLY');
            }
            callback(error);
        });
});
gulp.task('cleanUnzipFolder', [], function(){
    return gulp.src("sdks-unzipped/*",
        { read: false }).pipe(clean());
});
function updateBowerAndPackageJsonVersions(path, callback) {
    var bowerJson = readJsonFile(path + '/bower.json');
    bowerJson.dependencies["quantimodo"] = apiVersionNumber;
    return writeToFile(path  + '/bower.json', prettyJSONStringify(bowerJson), function () {
        executeCommand("cd " + pathToIonic + " && bower install", function () {
            var packageJson = readJsonFile(path + '/package.json');
            packageJson.dependencies["quantimodo"] = apiVersionNumber;
            return writeToFile(path  + '/package.json', prettyJSONStringify(packageJson), function () {
                executeCommand("cd " + pathToIonic + " && npm install", function () {
                    if(callback){callback();}
                });
            });
        });
    });
}
var pathToQmDocker = "../../..";
gulp.task('build-and-release-javascript', ['getUnits'], function (callback) {
    var sourceFile = getRepoPathForSdkLanguage('javascript') + '/src/index.js';
    var outputFile = getRepoPathForSdkLanguage('javascript') + '/quantimodo-web.js';
    executeCommand('browserify ' + sourceFile + ' --standalone Quantimodo > ' + outputFile, function () {
        executeCommand("cd " + getRepoPathForSdkLanguage('javascript') +
            ' && npm install' +
            ' && git add .' +
            ' && git commit -m "' + apiVersionNumber + '"' +
            ' && git push' +
            ' && git tag ' + apiVersionNumber +
            ' && git push origin ' + apiVersionNumber +
            ' && bower version ' + apiVersionNumber, function () {
            executeCommand("cd " + getRepoPathForSdkLanguage('javascript') + " && npm version " + apiVersionNumber + ' && npm publish', function () {
                updateBowerAndPackageJsonVersions(pathToQmDocker);
                updateBowerAndPackageJsonVersions(pathToIonic);
                callback();
            });
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
gulp.task('download-js', [], function () {
    return downloadOneSdk('javascript');
});
gulp.task('download', ['clean-folders-and-clone-repos'], function () {
    function downloadSdk(language) {
        var requestOptions = {
            method: 'POST',
            uri: 'http://generator.swagger.io/api/gen/clients/' + language,
            body: {
                swaggerUrl: swaggerJsonUrl
            },
            json: true // Automatically stringifies the body to JSON
        };
        if (sdkSwaggerCodegenOptions[language]) {
            requestOptions.body.options = sdkSwaggerCodegenOptions[language];
        } else {
            requestOptions.body.options = {};
            requestOptions.body.options.apiPackage = "QuantiModoApi";
            requestOptions.body.options.artifactId = "quantimodoApi";
            requestOptions.body.options.artifactVersion = requestOptions.body.options.projectVersion = requestOptions.body.options.packageVarsion = getAppVersionNumber();
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
            requestOptions.body.options.podVersion = getAppVersionNumber();
            requestOptions.body.options.projectName = (sdkSwaggerCodegenOptions[language] && sdkSwaggerCodegenOptions[language].projectName) ? sdkSwaggerCodegenOptions[language].projectName : "quantimodoApi";
        }
        requestOptions.body.options.artifactDescription = requestOptions.body.options.projectDescription = swaggerJson.info.description;
        var sdkName = 'quantimodo-sdk-' + language;
        var getOptionsRequestOptions = JSON.parse(JSON.stringify(requestOptions));
        getOptionsRequestOptions.method = "GET";
        return rp(getOptionsRequestOptions)
            .then(function (parsedBody) {
                logInfo("Generating " + language + " sdk", requestOptions.body.options);
                logInfo("Available options for " + language, parsedBody);
                return rp(requestOptions)
                    .then(function (parsedBody) {
                        return download(parsedBody.link.replace('https', 'http'))
                            .pipe(rename(getSdkNameForLanguage(language) + '.zip'))
                            .pipe(gulp.dest(sdksZippedPath));
                    })
                    .catch(function (err) {
                        logError(err.error.message);
                    });
            })
            .catch(function (err) {
                logError(err.error.message);
            });
    }
    logInfo("Generating sdks with " + swaggerJsonUrl);
    logInfo("See https://github.com/swagger-api/swagger-codegen/tree/master/modules/swagger-codegen/src/main/java/io/swagger/codegen/languages for available clients");
    for(var i = 0; i < languages.length; i++){
        if(i === languages.length - 1){ return downloadSdk(languages[i]);}
        downloadSdk(languages[i]);
    }
});
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
gulp.task('decompress', ['clean-repos-except-git'], function () {
    for(var i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return unzipFileToFolder(getZipPathForLanguage(languages[i]), 'unzipped');
        }
        unzipFileToFolder(getZipPathForLanguage(languages[i]), 'unzipped');
    }
});
gulp.task('copy-to-repos', [], function(){
    for(var i = 0; i < languages.length; i++) {
        if(i === languages.length - 1){
            return copyOneFoldersContentsToAnotherExceptReadme(getUnzippedPathForSdkLanguage(languages[i]), getRepoPathForSdkLanguage(languages[i]));
        }
        copyOneFoldersContentsToAnotherExceptReadme(getUnzippedPathForSdkLanguage(languages[i]), getRepoPathForSdkLanguage(languages[i]));
    }
});
var pathToQuantiModoNodeModule = 'node_modules/quantimodo';
gulp.task('copy-js-to-node-modules', [], function(){
    copyOneFoldersContentsToAnother(getUnzippedPathForSdkLanguage('javascript'), pathToQuantiModoNodeModule);
});
var Quantimodo = require('quantimodo');
var defaultClient = Quantimodo.ApiClient.instance;
var quantimodo_oauth2 = defaultClient.authentications['quantimodo_oauth2'];
quantimodo_oauth2.accessToken = process.env.QUANTIMODO_ACCESS_TOKEN;
gulp.task('getUnits', ['copy-js-to-node-modules'], function (callback) {
    var apiInstance = new Quantimodo.UnitsApi();
    var qmApiResponseCallback = function(error, data, response) {
        if (error && response.body.errorMessage) {logError(response.req.path + "failed: " + response.body.errorMessage, error);}
        if(!response.body.units){throw "Unit array not returned!"}
        logInfo('API returned data', response.body);
        callback();
    };
    apiInstance.getUnits(qmApiResponseCallback);
});