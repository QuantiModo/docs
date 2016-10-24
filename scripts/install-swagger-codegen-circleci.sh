#!/bin/sh

#sudo apt-get update
#sudo apt-get install -y docker.io

echo "Clone swagger-codegen..."
git clone https://github.com/swagger-api/swagger-codegen

cd swagger-codegen

echo "Updating maven packages..."
./run-in-docker.sh mvn package > /dev/null;