FROM node:fermium-alpine

RUN mkdir -p /app

COPY package*.json /
RUN npm install --silent
ENV PATH /node_modules/.bin:$PATH

WORKDIR /app
COPY . /app

CMD [ "node", "index.js" ]