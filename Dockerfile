FROM node:20-slim

RUN apt-get update && apt-get install -y gcc build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN gcc -O3 -pthread rpow-native-miner.c -o rpow-native-miner && chmod +x rpow-native-miner

CMD ["node", "automine.js"]
