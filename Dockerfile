FROM quay.io/qasimtech/mega-md:latest

WORKDIR /root/amon-md

RUN git clone https://github.com/Amon3Dev/AMON-MD . && \
    npm install

EXPOSE 5000

CMD ["npm", "start"]
