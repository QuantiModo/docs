#!/bin/sh

#sudo apt-get update
#sudo apt-get install -y docker.io

echo "clone swagger-codegen"
git clone https://github.com/swagger-api/swagger-codegen

cd swagger-codegen

echo "Update packages"
cp ../tooling/swagger_sdks/run-in-docker-it.sh run-in-docker-it.sh
./run-in-docker-it.sh mvn package