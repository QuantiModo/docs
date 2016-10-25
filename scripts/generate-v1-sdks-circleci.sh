#!/bin/sh
git config --global user.name "Mike Sinn"
git config --global user.email m@quantimodo.com

echo "Clone swagger-codegen..."
git clone https://github.com/swagger-api/swagger-codegen
cp -R swagger.json swagger-codegen/api-docs-v1.json
cp -R config.json swagger-codegen/config.json
cp -R scripts/node_angular_sdk swagger-codegen/node_angular_sdk
cd swagger-codegen

echo "Updating maven packages..."
./run-in-docker.sh mvn package > /dev/null;

mkdir quantimodo_v1_skds
mkdir quantimodo_v1_skds/nodejs_ionic
mkdir quantimodo_v1_skds/angularjs_ionic

echo "Generate v1 SDKs"
for i in "akka-scala" "android" "async-scala" "CsharpDotNet2" "csharp" "dart" "dynamic-html" "flash" "go" "html" "inflector" "java" "jaxrs" "nodejs" "objc" "perl" "php" "python" "qt5cpp" "ruby" "scala" "scalatra" "silex" "sinatra" "spring-mvc" "swift" "tizen" "typescript-angular" "typescript-node"
do
    echo "Generating $i SDK"
    ./run-in-docker.sh generate -i api-docs-v1.json -l ${i} -o quantimodo_v1_skds/$i -c config.json
    echo "Replacing localhost with app.quantimo.do"
    find . -type f -exec sed -i 's/localhost/app.quantimo.do/g' {} +
    sudo chmod +x -R quantimodo_v1_skds/${i}/*
    cd quantimodo_v1_skds/${i}
    /bin/sh ./git_push.sh quantimodo quantimodo-sdk-${i} "minor update"
    cd ../..
    # Create SDK Zip
    #zip -r quantimodo_v1_skds/$i.zip quantimodo_v1_skds/$i
    # Remove SDK folder
    #rm -rf quantimodo_v1_skds/$i
done

cd node_angular_sdk
npm install swagger-js-codegen

cd ..

node node_angular_sdk/node_angular.js api-docs-v1.json quantimodo_v1_skds/nodejs_ionic/nodejs.js quantimodo_v1_skds/angularjs_ionic/angularjs.js

echo "Directory contents"
ls

echo "Replacing localhost with app.quantimo.do"
find . -type f -exec sed -i 's/localhost/app.quantimo.do/g' {} +

echo "Creating combined zip file"
zip -r quantimodo_v1_skds.zip quantimodo_v1_skds