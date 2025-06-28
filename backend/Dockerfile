FROM node:18-alpine
WORKDIR /app
COPY ./ .
RUN npm install
EXPOSE 5050
CMD ["node", "index.js"]