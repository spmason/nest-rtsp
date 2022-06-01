FROM node:16
ENV LC_ALL=C.UTF-8
ENV GA_OAUTH_CID=
ENV GA_OAUTH_CS=
ENV GA_SDM_PID=
ENV HTTP_PORT=3000
ENV RTSP_CLIENT_PORT=554
ENV RTSP_SERVER_PORT=6554
ENV RTSP_RTP_START=10000
ENV RTSP_RTP_COUNT=10000
ENV GA_OAUTH_RDR=
WORKDIR /home/nest-rtsp
RUN apt-get update -y
RUN apt-get install ffmpeg -y
COPY package*.json ./
RUN NODE_ENV=build && npm ci && NODE_ENV=production
COPY . .
EXPOSE 3000/tcp
EXPOSE 554/tcp
EXPOSE 554/udp
EXPOSE 10000-20000/tcp
EXPOSE 10000-20000/udp
VOLUME /home/nest-rtsp/persistent/
CMD ["node", "/home/nest-rtsp/dockerized.js"]