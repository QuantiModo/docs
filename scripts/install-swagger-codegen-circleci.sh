#!/bin/sh

#sudo apt-get update
#sudo apt-get install -y docker.io

echo "clone swagger-codegen"
git clone https://github.com/swagger-api/swagger-codegen

cd swagger-codegen

echo "Update packages"
./run-in-docker.sh mvn package