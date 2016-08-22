FROM mhart/alpine-node:6.4.0

COPY . /usr/src/bravify-api

WORKDIR /usr/src/bravify-api
RUN npm install

EXPOSE 8080

CMD [ "npm", "start" ]
