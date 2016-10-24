#!/bin/sh

echo "On to v1 SDKs"
cp -R swagger.json swagger-codegen/api-docs-v1.json
cd swagger-codegen
mkdir quantimodo_v1_skds

echo "Generate v1 SDKs"
for i in "akka-scala" "android" "async-scala" "CsharpDotNet2" "csharp" "dart" "dynamic-html" "flash" "go" "html" "inflector" "java" "jaxrs" "nodejs" "objc" "perl" "php" "python" "qt5cpp" "ruby" "scala" "scalatra" "silex" "sinatra" "spring-mvc" "swift" "tizen" "typescript-angular" "typescript-node"
do
    echo "Generating $i SDK"
    ./run-in-docker.sh generate -i api-docs-v1.json -l $i -o quantimodo_v1_skds/$i
    echo "Replacing localhost with app.quantimo.do"
    find . -type f -exec sed -i 's/localhost/app.quantimo.do/g' {} +
    # Create SDK Zip
    #zip -r quantimodo_v1_skds/$i.zip quantimodo_v1_skds/$i
    # Remove SDK folder
    #rm -rf quantimodo_v1_skds/$i
done

mkdir quantimodo_v1_skds/nodejs_ionic
mkdir quantimodo_v1_skds/angularjs_ionic

cd ..

cp -R tooling/swagger_sdks/node_angular_sdk swagger-codegen/node_angular_sdk

cd swagger-codegen/node_angular_sdk
npm install swagger-js-codegen

cd ..

node node_angular_sdk/node_angular.js api-docs-v1.json quantimodo_v1_skds/nodejs_ionic/nodejs.js quantimodo_v1_skds/angularjs_ionic/angularjs.js

echo "Directory contents"
ls

echo "Replacing localhost with app.quantimo.do"
find . -type f -exec sed -i 's/localhost/app.quantimo.do/g' {} +

echo "Creating combined zip file"
zip -r quantimodo_v1_skds.zip quantimodo_v1_skds