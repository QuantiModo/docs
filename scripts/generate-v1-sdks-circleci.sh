#!/bin/sh
git config --global user.name "Mike Sinn"
git config --global user.email m@quantimodo.com

echo "Clone swagger-codegen..."
#git clone https://github.com/swagger-api/swagger-codegen

echo "Updating maven packages..."
#cd swagger-codegen && ./run-in-docker.sh mvn package
cp -R swagger/swagger.json swagger-codegen/api-docs-v1.json

cd swagger-codegen
mkdir quantimodo_v1_skds

echo "Generate v1 SDKs"
for i in "javascript" "android" "go" "java" "objc" "php" "python" "ruby" "swift"
do
    echo "Generating $i SDK"
    ./run-in-docker.sh generate -i api-docs-v1.json -l ${i} -o quantimodo_v1_skds/${i}
done

echo "Creating combined zip file"
zip -r quantimodo_v1_skds.zip quantimodo_v1_skds > /dev/null;

if [ -f ~/docs/swagger-codegen/quantimodo_v1_skds.zip ];
    then
       echo "SDK's are ready"
       exit 0
    else
       echo "SDK generation FAILED"
       exit 1
fi